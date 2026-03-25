/**
 * API Route: /api/tfl/line-arrivals
 *
 * Fetches ALL arrivals for a specific line — used for train tracking.
 * Unlike /api/tfl/arrivals (which gets arrivals for one station),
 * this returns every active train on the entire line.
 *
 * Query params:
 *   ?lineId=central   — the line ID to track
 *
 * Returns:
 *   Array of arrival predictions for every train on the line.
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
     * Fetch arrivals for the ENTIRE line.
     * This gives us every active train with its currentLocation.
     */
    const url = `${TFL_API_BASE}/Line/${lineId}/Arrivals?${params}`;

    const response = await fetch(url, {
      /* Cache for 15 seconds — matches our polling interval */
      next: { revalidate: 15 },
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
    console.error("TfL line arrivals error:", error);
    return NextResponse.json(
      { error: "Failed to fetch line arrivals" },
      { status: 500 }
    );
  }
}
