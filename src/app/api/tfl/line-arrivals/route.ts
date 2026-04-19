/**
 * API Route: /api/tfl/line-arrivals
 *
 * Proxies `/Line/{lineId}/Arrivals` — every live vehicle prediction
 * for a given line, across all its stops. Includes the critical
 * `currentLocation` string we use to position buses on the Nearby map.
 *
 * Query params:
 *   ?lineId=25   — the line/route ID (bus route, tube line, etc.)
 *
 * Returns a deduped list of active vehicles:
 *   [{ vehicleId, lineId, destinationName, currentLocation, towards }]
 *
 * "Deduped" because every arrival prediction repeats the same vehicle
 * once per stop it has yet to call at. For map plotting we only want
 * one entry per vehicle — we pick the soonest upcoming arrival.
 */

import { NextRequest, NextResponse } from "next/server";
import { TFL_API_BASE } from "@/lib/constants";

interface TflLineArrival {
  vehicleId: string;
  lineId: string;
  destinationName?: string;
  towards?: string;
  currentLocation?: string;
  timeToStation: number;
  stationName?: string;
}

function buildParams(): URLSearchParams {
  const params = new URLSearchParams();
  if (process.env.TFL_APP_KEY) {
    params.set("app_key", process.env.TFL_APP_KEY);
  }
  return params;
}

export async function GET(request: NextRequest) {
  const lineId = request.nextUrl.searchParams.get("lineId");

  if (!lineId) {
    return NextResponse.json(
      { error: "lineId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const params = buildParams();
    const url = `${TFL_API_BASE}/Line/${lineId}/Arrivals?${params}`;
    const upstream = await fetch(url, {
      /*
       * Short cache window (15s) — live vehicle positions update
       * faster than that upstream, but caching for a quarter-minute
       * smooths out double-requests when multiple map tiles mount.
       */
      next: { revalidate: 15 },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream error ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const data: TflLineArrival[] = await upstream.json();
    if (!Array.isArray(data)) {
      return NextResponse.json([]);
    }

    /*
     * Dedupe by vehicleId. For each vehicle keep the entry with the
     * smallest timeToStation — that's the one closest in time to
     * calling at a stop, which is where "Between X and Y" /
     * "Approaching Y" will be most accurate.
     */
    const byVehicle = new Map<string, TflLineArrival>();
    for (const a of data) {
      if (!a.vehicleId || !a.currentLocation) continue;
      const existing = byVehicle.get(a.vehicleId);
      if (!existing || a.timeToStation < existing.timeToStation) {
        byVehicle.set(a.vehicleId, a);
      }
    }

    const vehicles = Array.from(byVehicle.values()).map((v) => ({
      vehicleId: v.vehicleId,
      lineId: v.lineId,
      destinationName: v.destinationName || v.towards || "",
      currentLocation: v.currentLocation || "",
      timeToStation: v.timeToStation,
      nextStopName: v.stationName || "",
    }));

    return NextResponse.json(vehicles);
  } catch (error) {
    console.error("TfL line-arrivals error:", error);
    return NextResponse.json(
      { error: "Failed to fetch line arrivals" },
      { status: 500 }
    );
  }
}
