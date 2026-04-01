/**
 * API Route: /api/tfl/timetable
 *
 * Fetches the scheduled timetable for a station on a specific line.
 * Returns simplified departure times grouped by direction.
 *
 * This data is static (doesn't change day-to-day) so it's cached
 * aggressively. Used for offline mode — when live arrivals are
 * unavailable, we show the scheduled timetable instead.
 *
 * Query params:
 *   ?lineId=central&stationId=940GZZLUMLE
 *
 * Returns:
 *   { routes: [{ direction, stops: [{ name, departures: ["06:15", ...] }] }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { TFL_API_BASE } from "@/lib/constants";

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

interface TimetableStop {
  /** Station/stop name */
  name: string;
  /** Departure times as "HH:MM" strings */
  departures: string[];
}

interface TimetableRoute {
  /** Direction name (e.g. "Inbound", "Outbound") */
  direction: string;
  /** Destination name */
  destination: string;
  /** Departure times from this station */
  departures: string[];
}

export async function GET(request: NextRequest) {
  const lineId = request.nextUrl.searchParams.get("lineId");
  const stationId = request.nextUrl.searchParams.get("stationId");

  if (!lineId || !stationId) {
    return NextResponse.json(
      { error: "lineId and stationId parameters are required" },
      { status: 400 }
    );
  }

  try {
    const params = buildParams();
    const url = `${TFL_API_BASE}/Line/${lineId}/Timetable/${stationId}?${params}`;

    const resp = await fetch(url, {
      next: { revalidate: 86400 }, /* Cache for 24 hours — timetables rarely change */
    });

    if (!resp.ok) {
      return NextResponse.json(
        { error: "Failed to fetch timetable" },
        { status: resp.status }
      );
    }

    const data = await resp.json();

    /*
     * TfL timetable response structure:
     * { timetable: { routes: [{ stationIntervals: [{ intervals: [...] }], schedules: [...] }] } }
     *
     * We simplify this into direction-based departure times.
     */
    const routes: TimetableRoute[] = [];

    if (data.timetable?.routes) {
      for (const route of data.timetable.routes) {
        const schedules = route.schedules || [];

        for (const schedule of schedules) {
          const direction = route.direction || "Unknown";
          const destination = route.destinationName || "Unknown";
          const knownJourneys = schedule.knownJourneys || [];

          /* Extract departure times */
          const departures: string[] = knownJourneys
            .map((j: { hour: string; minute: string }) => {
              const h = (j.hour || "0").padStart(2, "0");
              const m = (j.minute || "0").padStart(2, "0");
              return `${h}:${m}`;
            })
            .sort();

          if (departures.length > 0) {
            routes.push({ direction, destination, departures });
          }
        }
      }
    }

    return NextResponse.json({ routes });
  } catch (error) {
    console.error("TfL timetable error:", error);
    return NextResponse.json(
      { error: "Failed to fetch timetable" },
      { status: 500 }
    );
  }
}
