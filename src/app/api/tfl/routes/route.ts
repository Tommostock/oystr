/**
 * API Route: /api/tfl/routes
 *
 * Fetches the route sequence for a tube line — an ordered list
 * of stations with their coordinates. Used to draw lines on the map.
 *
 * Query params:
 *   ?lineId=central   — the line ID to fetch routes for
 *
 * Returns:
 *   The TfL route sequence response with station coordinates.
 */

import { NextRequest, NextResponse } from "next/server";
import { TFL_API_BASE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const lineId = request.nextUrl.searchParams.get("lineId");

  if (!lineId) {
    return NextResponse.json(
      { error: "lineId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const params = new URLSearchParams();

    if (process.env.TFL_APP_KEY) {
      params.set("app_key", process.env.TFL_APP_KEY);
    }

    /*
     * Fetch the outbound route sequence.
     * This gives us an ordered list of stations for this line
     * with their lat/lng coordinates.
     */
    const url = `${TFL_API_BASE}/Line/${lineId}/Route/Sequence/outbound?${params}`;

    const response = await fetch(url, {
      /* Cache route data for 24 hours — it rarely changes */
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "TfL API error", status: response.status },
        { status: response.statusText === "Too Many Requests" ? 429 : 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("TfL routes error:", error);
    return NextResponse.json(
      { error: "Failed to fetch route data" },
      { status: 500 }
    );
  }
}
