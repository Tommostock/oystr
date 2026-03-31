/**
 * API Route: /api/tfl/line-route
 *
 * Fetches the ordered sequence of stops for a given line/route.
 * Returns station coordinates in route order, suitable for drawing
 * the route path on a map.
 *
 * Works for both bus routes (e.g. 365) and tube lines (e.g. central).
 *
 * Query params:
 *   ?lineId=365              — the line/route ID
 *   ?direction=outbound      — optional, defaults to outbound
 *
 * Returns:
 *   Array of { naptanId, name, lat, lon } in route order
 */

import { NextRequest, NextResponse } from "next/server";
import { TFL_API_BASE } from "@/lib/constants";

interface RouteStop {
  naptanId: string;
  name: string;
  lat: number;
  lon: number;
}

/**
 * Build TfL API query params with optional app key.
 */
function buildParams(): URLSearchParams {
  const params = new URLSearchParams();
  if (process.env.TFL_APP_KEY) {
    params.set("app_key", process.env.TFL_APP_KEY);
  }
  return params;
}

/**
 * Fetch route sequence for a single direction.
 */
async function fetchDirection(
  lineId: string,
  direction: string,
  params: URLSearchParams
): Promise<RouteStop[]> {
  const resp = await fetch(
    `${TFL_API_BASE}/Line/${lineId}/Route/Sequence/${direction}?${params}`,
    { next: { revalidate: 3600 } }
  );

  if (!resp.ok) return [];

  const data = await resp.json();

  /*
   * The response has stopPointSequences — an array of route branches.
   * Each branch has a stopPoint array with coordinates.
   * We use the first (longest) branch for simplicity.
   */
  const sequences = data.stopPointSequences || [];
  if (sequences.length === 0) return [];

  /* Pick the longest sequence */
  const longest = sequences.reduce(
    (a: { stopPoint: unknown[] }, b: { stopPoint: unknown[] }) =>
      (b.stopPoint?.length || 0) > (a.stopPoint?.length || 0) ? b : a,
    sequences[0]
  );

  const stops: RouteStop[] = (longest.stopPoint || []).map(
    (sp: { id: string; name: string; lat: number; lon: number }) => ({
      naptanId: sp.id || "",
      name: (sp.name || "")
        .replace(/\s*Underground Station$/i, "")
        .replace(/\s*DLR Station$/i, "")
        .replace(/\s*Rail Station$/i, "")
        .replace(/\s*Station$/i, "")
        .trim(),
      lat: sp.lat,
      lon: sp.lon,
    })
  );

  return stops.filter((s) => s.lat && s.lon);
}

export async function GET(request: NextRequest) {
  const lineId = request.nextUrl.searchParams.get("lineId");
  const direction = request.nextUrl.searchParams.get("direction") || "outbound";

  if (!lineId) {
    return NextResponse.json(
      { error: "lineId parameter is required" },
      { status: 400 }
    );
  }

  try {
    const params = buildParams();

    /* Fetch the requested direction */
    let stops = await fetchDirection(lineId, direction, params);

    /* If outbound returned nothing, try inbound */
    if (stops.length === 0 && direction === "outbound") {
      stops = await fetchDirection(lineId, "inbound", params);
    }

    return NextResponse.json(stops);
  } catch (error) {
    console.error("TfL line-route error:", error);
    return NextResponse.json(
      { error: "Failed to fetch route" },
      { status: 500 }
    );
  }
}
