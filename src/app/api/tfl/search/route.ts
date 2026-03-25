/**
 * API Route: /api/tfl/search
 *
 * Proxies station search requests to the TfL API.
 * This keeps our API key secret on the server side.
 *
 * Query params:
 *   ?query=mile end   — the search term
 *
 * Returns:
 *   Array of matching stations with their IDs, names, and coordinates.
 */

import { NextRequest, NextResponse } from "next/server";
import { TFL_API_BASE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  /* Extract the search query from the URL */
  const query = request.nextUrl.searchParams.get("query");

  /* Return an error if no search query was provided */
  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: "Search query must be at least 2 characters" },
      { status: 400 }
    );
  }

  try {
    /*
     * Build the TfL API URL.
     * We search for stops that serve tube, bus, DLR, overground, and Elizabeth line.
     * maxResults limits results to avoid overwhelming the autocomplete dropdown.
     */
    const params = new URLSearchParams({
      query: query.trim(),
      modes: "tube,bus,dlr,overground,elizabeth-line",
      maxResults: "10",
    });

    /* Add the API key if we have one (increases rate limit from 50 to 500 req/min) */
    if (process.env.TFL_APP_KEY) {
      params.set("app_key", process.env.TFL_APP_KEY);
    }

    const response = await fetch(
      `${TFL_API_BASE}/StopPoint/Search?${params}`,
      {
        /* Cache the response for 60 seconds to reduce API calls */
        next: { revalidate: 60 },
      }
    );

    /* If TfL returns an error, pass it through */
    if (!response.ok) {
      return NextResponse.json(
        { error: "TfL API error", status: response.status },
        { status: response.statusText === "Too Many Requests" ? 429 : 502 }
      );
    }

    const data = await response.json();

    /*
     * Transform the TfL response into a simpler format.
     * We only need the station ID, name, and which modes it supports.
     */
    const stations = (data.matches || []).map(
      (match: {
        id: string;
        name: string;
        lat: number;
        lon: number;
        modes: string[];
        lines: { id: string; name: string }[];
      }) => ({
        naptanId: match.id,
        name: match.name,
        lat: match.lat,
        lon: match.lon,
        modes: match.modes || [],
        lines: match.lines || [],
      })
    );

    return NextResponse.json(stations);
  } catch (error) {
    console.error("TfL search error:", error);
    return NextResponse.json(
      { error: "Failed to search stations" },
      { status: 500 }
    );
  }
}
