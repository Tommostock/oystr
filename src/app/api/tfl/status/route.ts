/**
 * API Route: /api/tfl/status
 *
 * Proxies line status requests to the TfL API.
 * Returns the current status of all tube, DLR, Overground,
 * Elizabeth line, and Tram services.
 *
 * Returns:
 *   Array of line objects with their current status and any disruption reasons.
 */

import { NextResponse } from "next/server";
import { TFL_API_BASE } from "@/lib/constants";

export async function GET() {
  try {
    /*
     * Build the TfL API URL.
     * This single endpoint returns status for ALL lines of the specified modes.
     * Modes: tube, overground, dlr, elizabeth-line, tram
     */
    const params = new URLSearchParams();

    /* Add the API key if available */
    if (process.env.TFL_APP_KEY) {
      params.set("app_key", process.env.TFL_APP_KEY);
    }

    const response = await fetch(
      `${TFL_API_BASE}/Line/Mode/tube,overground,dlr,elizabeth-line,tram/Status?${params}`,
      {
        /* Cache for 60 seconds — line status doesn't change that frequently */
        next: { revalidate: 60 },
      }
    );

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
    console.error("TfL status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch line status" },
      { status: 500 }
    );
  }
}
