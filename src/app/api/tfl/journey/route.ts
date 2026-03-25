/**
 * API Route: /api/tfl/journey
 *
 * Proxies journey planning requests to the TfL API.
 * Returns multiple journey options between two stations.
 *
 * Query params:
 *   ?from=940GZZLUMLE     — starting station Naptan ID
 *   &to=940GZZLULNB       — destination station Naptan ID
 *   &timeIs=Departing      — "Departing" or "Arriving"
 *   &dateTime=202603251430 — optional departure/arrival time (YYYYMMDDHHmm)
 *
 * Returns:
 *   TfL journey response with multiple route options.
 */

import { NextRequest, NextResponse } from "next/server";
import { TFL_API_BASE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  /* Extract query parameters */
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const timeIs = request.nextUrl.searchParams.get("timeIs") || "Departing";
  const dateTime = request.nextUrl.searchParams.get("dateTime");

  /* Validate required parameters */
  if (!from || !to) {
    return NextResponse.json(
      { error: "Both 'from' and 'to' parameters are required" },
      { status: 400 }
    );
  }

  try {
    /*
     * Build the TfL Journey API URL.
     * The endpoint takes from/to as path segments.
     * mode filters which transport types to include.
     */
    const params = new URLSearchParams({
      mode: "tube,bus,dlr,overground,elizabeth-line,walking",
      timeIs: timeIs,
    });

    /* Add optional departure/arrival time */
    if (dateTime) {
      params.set("dateTime", dateTime);
    }

    /* Add the API key if available */
    if (process.env.TFL_APP_KEY) {
      params.set("app_key", process.env.TFL_APP_KEY);
    }

    const url = `${TFL_API_BASE}/Journey/JourneyResults/${from}/to/${to}?${params}`;

    const response = await fetch(url, {
      /* Cache journey results for 60 seconds */
      next: { revalidate: 60 },
    });

    /* Handle TfL API errors */
    if (!response.ok) {
      return NextResponse.json(
        { error: "TfL API error", status: response.status },
        { status: response.statusText === "Too Many Requests" ? 429 : 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("TfL journey error:", error);
    return NextResponse.json(
      { error: "Failed to plan journey" },
      { status: 500 }
    );
  }
}
