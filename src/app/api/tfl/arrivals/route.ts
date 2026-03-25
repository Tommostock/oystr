/**
 * API Route: /api/tfl/arrivals
 *
 * Proxies station arrival requests to the TfL API.
 * Returns live arrival predictions for a specific station.
 *
 * Query params:
 *   ?stopId=940GZZLUMLE   — the station's Naptan ID
 *
 * Returns:
 *   Array of arrival predictions sorted by time to station.
 */

import { NextRequest, NextResponse } from "next/server";
import { TFL_API_BASE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  /* Extract the station ID from the URL */
  const stopId = request.nextUrl.searchParams.get("stopId");

  /* Return an error if no station ID was provided */
  if (!stopId) {
    return NextResponse.json(
      { error: "stopId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    /* Build the TfL API URL */
    const params = new URLSearchParams();

    /* Add the API key if available */
    if (process.env.TFL_APP_KEY) {
      params.set("app_key", process.env.TFL_APP_KEY);
    }

    const url = `${TFL_API_BASE}/StopPoint/${stopId}/Arrivals?${params}`;

    const response = await fetch(url, {
      /*
       * Cache for 30 seconds server-side.
       * This means if two users request the same station within 30s,
       * only one actual API call is made to TfL.
       */
      next: { revalidate: 30 },
    });

    /* Handle TfL API errors */
    if (!response.ok) {
      return NextResponse.json(
        { error: "TfL API error", status: response.status },
        { status: response.statusText === "Too Many Requests" ? 429 : 502 }
      );
    }

    const data = await response.json();

    /*
     * The TfL API returns arrivals unsorted.
     * Sort by timeToStation (seconds until arrival) so the
     * soonest train appears first on the departure board.
     */
    const sorted = Array.isArray(data)
      ? data.sort(
          (a: { timeToStation: number }, b: { timeToStation: number }) =>
            a.timeToStation - b.timeToStation
        )
      : [];

    return NextResponse.json(sorted);
  } catch (error) {
    console.error("TfL arrivals error:", error);
    return NextResponse.json(
      { error: "Failed to fetch arrivals" },
      { status: 500 }
    );
  }
}
