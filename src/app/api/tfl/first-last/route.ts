/**
 * API Route: /api/tfl/first-last
 *
 * Returns the first and last train times for a station.
 * Queries TfL's timetable endpoint for each line serving the station
 * and returns the earliest first train and latest last train.
 *
 * Query params:
 *   ?stopId=940GZZLUEPK
 *
 * Returns:
 *   { firstTrain: "05:12", lastTrain: "00:29", lines: [...] }
 */

import { NextRequest, NextResponse } from "next/server";
import { TFL_API_BASE } from "@/lib/constants";

function buildParams(): URLSearchParams {
  const params = new URLSearchParams();
  if (process.env.TFL_APP_KEY) {
    params.set("app_key", process.env.TFL_APP_KEY);
  }
  return params;
}

/**
 * Format hour:minute from timetable data.
 * TfL uses 25:29 for 01:29 the next day — we convert to 24h format.
 */
function formatTime(hour: number, minute: number): string {
  const h = hour >= 24 ? hour - 24 : hour;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Convert hour:minute to minutes since midnight for comparison.
 * Hours >= 24 are treated as next day (e.g. 25:30 = 1530 minutes).
 */
function toMinutes(hour: number, minute: number): number {
  return hour * 60 + minute;
}

interface TrainTime {
  lineId: string;
  lineName: string;
  direction: string;
  time: string;
  rawMinutes: number;
}

export async function GET(request: NextRequest) {
  const stopId = request.nextUrl.searchParams.get("stopId");

  if (!stopId) {
    return NextResponse.json(
      { error: "stopId is required" },
      { status: 400 }
    );
  }

  try {
    const params = buildParams();

    /* First, get which lines serve this station */
    const stationResp = await fetch(
      `${TFL_API_BASE}/StopPoint/${stopId}?${params}`,
      { next: { revalidate: 86400 } }
    );

    if (!stationResp.ok) {
      return NextResponse.json({ error: "Station not found" }, { status: 404 });
    }

    const stationData = await stationResp.json();
    const lineIds: string[] = (stationData.lines || [])
      .map((l: { id: string }) => l.id)
      .filter((id: string) => !id.startsWith("london-overground"));

    if (lineIds.length === 0) {
      return NextResponse.json({ firstTrains: [], lastTrains: [] });
    }

    /* Query timetables for each line (max 4 to avoid too many API calls) */
    const allFirstTrains: TrainTime[] = [];
    const allLastTrains: TrainTime[] = [];

    /* Determine which day's schedule to use */
    const now = new Date();
    const day = now.getDay(); /* 0=Sun */

    await Promise.all(
      lineIds.slice(0, 4).map(async (lineId) => {
        try {
          const resp = await fetch(
            `${TFL_API_BASE}/Line/${lineId}/Timetable/${stopId}?${params}`,
            { next: { revalidate: 3600 } }
          );

          if (!resp.ok) return;
          const data = await resp.json();

          const routes = data.timetable?.routes || [];
          for (const route of routes) {
            /* Pick the right schedule for today */
            const schedules = route.schedules || [];
            let schedule = schedules[0]; /* Default to first */

            for (const s of schedules) {
              const name = (s.name || "").toLowerCase();
              if (day >= 1 && day <= 5 && name.includes("friday")) {
                schedule = s;
                break;
              }
              if (day === 6 && name.includes("saturday")) {
                schedule = s;
                break;
              }
              if (day === 0 && name.includes("sunday")) {
                schedule = s;
                break;
              }
            }

            const journeys = schedule?.knownJourneys || [];
            if (journeys.length === 0) continue;

            /* Get destination name from route intervals */
            const intervals = route.stationIntervals || [];
            const lastInterval = intervals[intervals.length - 1];
            const destStops = lastInterval?.intervals || [];
            const destName = destStops[destStops.length - 1]?.stopId || lineId;
            const direction = destName
              .replace(/940GZZLU/i, "")
              .replace(/910G/i, "");

            const first = journeys[0];
            const last = journeys[journeys.length - 1];

            allFirstTrains.push({
              lineId,
              lineName: lineId,
              direction,
              time: formatTime(first.hour, first.minute),
              rawMinutes: toMinutes(first.hour, first.minute),
            });

            allLastTrains.push({
              lineId,
              lineName: lineId,
              direction,
              time: formatTime(last.hour, last.minute),
              rawMinutes: toMinutes(last.hour, last.minute),
            });
          }
        } catch {
          /* Skip lines that fail */
        }
      })
    );

    /* Sort: first trains by earliest, last trains by latest */
    allFirstTrains.sort((a, b) => a.rawMinutes - b.rawMinutes);
    allLastTrains.sort((a, b) => b.rawMinutes - a.rawMinutes);

    return NextResponse.json({
      firstTrains: allFirstTrains.slice(0, 4),
      lastTrains: allLastTrains.slice(0, 4),
    });
  } catch (error) {
    console.error("First/last train error:", error);
    return NextResponse.json(
      { error: "Failed to fetch timetable" },
      { status: 500 }
    );
  }
}
