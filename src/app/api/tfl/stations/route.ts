/**
 * API Route: /api/tfl/stations
 *
 * Returns an alphabetical list of all tube, DLR, Overground,
 * and Elizabeth line stations with their zones and lines.
 * Fetches each line separately to avoid TfL API limits,
 * then deduplicates and merges.
 * Cached aggressively (1 hour) since station data rarely changes.
 *
 * Returns:
 *   Array of { naptanId, name, zone, lines[], modes[] }
 */

import { NextResponse } from "next/server";
import { TFL_API_BASE } from "@/lib/constants";

const LINE_IDS = [
  "bakerloo", "central", "circle", "district", "hammersmith-city",
  "jubilee", "metropolitan", "northern", "piccadilly", "victoria",
  "waterloo-city", "elizabeth", "dlr",
];

export async function GET() {
  try {
    const params = new URLSearchParams();
    if (process.env.TFL_APP_KEY) {
      params.set("app_key", process.env.TFL_APP_KEY);
    }

    /* Deduplicate stations across all lines */
    const stationMap = new Map<
      string,
      {
        naptanId: string;
        name: string;
        zone: string;
        lines: string[];
        modes: string[];
      }
    >();

    /*
     * Fetch stops for each line separately.
     * TfL rejects requests with too many lines at once.
     * We run them in parallel batches of 4 for speed.
     */
    for (let i = 0; i < LINE_IDS.length; i += 4) {
      const batch = LINE_IDS.slice(i, i + 4);

      const results = await Promise.all(
        batch.map(async (lineId) => {
          try {
            const response = await fetch(
              `${TFL_API_BASE}/Line/${lineId}/StopPoints?${params}`,
              { next: { revalidate: 3600 } }
            );
            if (!response.ok) return [];
            return response.json();
          } catch {
            return [];
          }
        })
      );

      for (let j = 0; j < batch.length; j++) {
        const lineId = batch[j];
        const stops = Array.isArray(results[j]) ? results[j] : [];

        for (const stop of stops) {
          const id = stop.stationNaptan || stop.naptanId;
          if (!id) continue;

          if (!stationMap.has(id)) {
            stationMap.set(id, {
              naptanId: id,
              name: (stop.commonName || stop.name || "")
                .replace(/ Underground Station$/i, "")
                .replace(/ DLR Station$/i, "")
                .replace(/ Rail Station$/i, "")
                .replace(/ Station$/i, "")
                .replace(/ \(London\)/i, "")
                .trim(),
              zone: stop.zone || "",
              lines: [],
              modes: stop.modes || [],
            });
          }

          /* Add this line to the station */
          const station = stationMap.get(id)!;
          if (!station.lines.includes(lineId)) {
            station.lines.push(lineId);
          }
        }
      }
    }

    /*
     * Consolidate stations that share the same name.
     * Some interchanges like Bank have multiple naptanIds
     * (one per "side" of the station). We merge them so
     * "Bank" appears once with all its lines combined.
     */
    const nameMap = new Map<
      string,
      {
        naptanId: string;
        name: string;
        zone: string;
        lines: string[];
        modes: string[];
        allNaptanIds: string[];
      }
    >();

    for (const station of stationMap.values()) {
      if (station.name.length === 0) continue;

      const key = station.name.toLowerCase();
      if (nameMap.has(key)) {
        /* Merge into existing entry */
        const existing = nameMap.get(key)!;
        existing.allNaptanIds.push(station.naptanId);
        for (const line of station.lines) {
          if (!existing.lines.includes(line)) {
            existing.lines.push(line);
          }
        }
        for (const mode of station.modes) {
          if (!existing.modes.includes(mode)) {
            existing.modes.push(mode);
          }
        }
        /* Keep the zone from whichever entry has one */
        if (!existing.zone && station.zone) {
          existing.zone = station.zone;
        }
      } else {
        nameMap.set(key, {
          ...station,
          allNaptanIds: [station.naptanId],
        });
      }
    }

    /* Sort alphabetically */
    const stations = Array.from(nameMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(stations);
  } catch (error) {
    console.error("TfL stations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stations" },
      { status: 500 }
    );
  }
}
