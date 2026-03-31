/**
 * API Route: /api/tfl/arrivals
 *
 * Proxies station arrival requests to the TfL API.
 * Returns live arrival predictions for a specific station.
 *
 * Handles both naptan IDs (940GZZLUMLE) and hub IDs (HUBBAN).
 * Hub IDs are resolved to their child naptan stops first,
 * then arrivals are fetched for all children and merged.
 *
 * Query params:
 *   ?stopId=940GZZLUMLE   — the station's Naptan ID or Hub ID
 *
 * Returns:
 *   Array of arrival predictions sorted by time to station.
 */

import { NextRequest, NextResponse } from "next/server";
import { TFL_API_BASE } from "@/lib/constants";

/**
 * Build TfL API params with the API key.
 */
function buildParams(): URLSearchParams {
  const params = new URLSearchParams();
  if (process.env.TFL_APP_KEY) {
    params.set("app_key", process.env.TFL_APP_KEY);
  }
  return params;
}

/**
 * Fetch arrivals for a single stop ID.
 */
async function fetchArrivalsForStop(
  stopId: string
): Promise<{ timeToStation: number }[]> {
  const params = buildParams();
  const url = `${TFL_API_BASE}/StopPoint/${stopId}/Arrivals?${params}`;

  const response = await fetch(url, {
    /* No server cache — arrivals are time-sensitive and we use the
       absolute expectedArrival timestamp for accurate countdowns */
    cache: "no-store",
  });

  if (!response.ok) return [];

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Resolve a hub ID to its child naptan IDs.
 * Hub IDs (like HUBBAN for Bank) don't have arrivals directly.
 * We need to find the child stops (tube, DLR, etc.) and query those.
 */
async function resolveHubChildren(hubId: string): Promise<string[]> {
  const params = buildParams();
  const url = `${TFL_API_BASE}/StopPoint/${hubId}?${params}`;

  try {
    const response = await fetch(url, {
      next: { revalidate: 3600 }, /* Cache for 1 hour — hub children rarely change */
    });

    if (!response.ok) return [];

    const data = await response.json();

    /*
     * The StopPoint response includes a children array.
     * Each child has a naptanId and stationNaptan.
     * We want the unique station-level naptan IDs (940GZZLU... format).
     */
    const childIds = new Set<string>();

    if (data.children && Array.isArray(data.children)) {
      for (const child of data.children) {
        if (child.naptanId) {
          childIds.add(child.naptanId);
        }
        /* Some children have their own children (platforms) */
        if (child.children && Array.isArray(child.children)) {
          for (const grandchild of child.children) {
            if (grandchild.stationNaptan) {
              childIds.add(grandchild.stationNaptan);
            }
          }
        }
      }
    }

    /* Also check the stationNaptan at the top level */
    if (data.stationNaptan) {
      childIds.add(data.stationNaptan);
    }

    return Array.from(childIds);
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const stopId = request.nextUrl.searchParams.get("stopId");

  if (!stopId) {
    return NextResponse.json(
      { error: "stopId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    let allArrivals: { timeToStation: number }[] = [];

    /*
     * Support comma-separated stop IDs for consolidated stations.
     * E.g. "940GZZLULVT,910GLVST" for Liverpool Street (tube + Elizabeth line).
     */
    const stopIds = stopId.split(",").map((id) => id.trim()).filter(Boolean);

    for (const id of stopIds) {
      /*
       * Detect hub IDs — they start with "HUB" (e.g. HUBBAN, HUBVIC).
       * For hub IDs, resolve to child stops and fetch arrivals from each.
       * For regular naptan IDs, fetch directly.
       */
      if (id.startsWith("HUB")) {
        const childIds = await resolveHubChildren(id);

        if (childIds.length === 0) {
          /* Fallback: try fetching directly anyway */
          const arrivals = await fetchArrivalsForStop(id);
          allArrivals = allArrivals.concat(arrivals);
        } else {
          /* Fetch arrivals from all child stops in parallel */
          const results = await Promise.all(
            childIds.map((childId) => fetchArrivalsForStop(childId))
          );
          allArrivals = allArrivals.concat(results.flat());
        }
      } else {
        const arrivals = await fetchArrivalsForStop(id);
        allArrivals = allArrivals.concat(arrivals);
      }
    }

    /* Sort by timeToStation (soonest first) */
    const sorted = allArrivals.sort(
      (a, b) => a.timeToStation - b.timeToStation
    );

    return NextResponse.json(sorted);
  } catch (error) {
    console.error("TfL arrivals error:", error);
    return NextResponse.json(
      { error: "Failed to fetch arrivals" },
      { status: 500 }
    );
  }
}
