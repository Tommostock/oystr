/**
 * API Route: /api/tfl/nearby
 *
 * Returns the nearest stations to a given latitude/longitude.
 * Uses the TfL StopPoint API to find stops within a radius.
 *
 * Query params:
 *   ?lat=51.5074&lon=-0.1278   — the user's coordinates
 *   ?radius=500                — optional search radius in metres (default 500)
 *
 * Returns:
 *   Array of nearby stations sorted by distance, with their
 *   IDs, names, modes, and distance in metres.
 */

import { NextRequest, NextResponse } from "next/server";
import { TFL_API_BASE } from "@/lib/constants";
import { consolidateStations } from "@/lib/consolidate-stations";

export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get("lat");
  const lon = request.nextUrl.searchParams.get("lon");
  const radius = request.nextUrl.searchParams.get("radius") || "500";

  /* Validate coordinates */
  if (!lat || !lon) {
    return NextResponse.json(
      { error: "lat and lon query parameters are required" },
      { status: 400 }
    );
  }

  try {
    /*
     * Build the TfL API URL for nearby stops. Includes bus stops and
     * National Rail stations; national-rail mode surfaces non-TfL rail
     * terminals (e.g. Leeds, Manchester Piccadilly) so the Nearby map
     * can show them alongside tube/DLR/Overground.
     */
    const params = new URLSearchParams({
      lat,
      lon,
      radius,
      stopTypes: "NaptanMetroStation,NaptanRailStation,NaptanPublicBusCoachTram",
      modes: "tube,dlr,overground,elizabeth-line,bus,national-rail",
    });

    if (process.env.TFL_APP_KEY) {
      params.set("app_key", process.env.TFL_APP_KEY);
    }

    const response = await fetch(
      `${TFL_API_BASE}/StopPoint?${params}`,
      { next: { revalidate: 300 } } /* Cache for 5 minutes */
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "TfL API error", status: response.status },
        { status: 502 }
      );
    }

    const data = await response.json();

    /*
     * Transform and sort by distance.
     * TfL returns stopPoints with a distance field (in metres).
     */
    const stations = (data.stopPoints || [])
      .map(
        (stop: {
          naptanId: string;
          commonName: string;
          lat: number;
          lon: number;
          distance: number;
          modes: string[];
          lines: { id: string; name: string }[];
          stopLetter?: string;
          indicator?: string;
        }) => ({
          naptanId: stop.naptanId,
          name: stop.commonName
            .replace(/ Underground Station$/i, "")
            .replace(/ DLR Station$/i, "")
            .replace(/ Rail Station$/i, "")
            .replace(/ Station$/i, "")
            .trim(),
          lat: stop.lat,
          lon: stop.lon,
          distance: Math.round(stop.distance),
          modes: stop.modes || [],
          lines: stop.lines || [],
          /* Include bus stop letter if available (e.g. "H") */
          stopLetter: stop.stopLetter || undefined,
          indicator: stop.indicator || undefined,
        })
      )
      .sort(
        (a: { distance: number; modes: string[] }, b: { distance: number; modes: string[] }) => {
          /* Tube/rail stations first, bus stops after */
          const aIsBus = a.modes.length === 1 && a.modes[0] === "bus";
          const bIsBus = b.modes.length === 1 && b.modes[0] === "bus";
          if (aIsBus !== bIsBus) return aIsBus ? 1 : -1;
          /* Within each group, sort by distance */
          return a.distance - b.distance;
        }
      )
      .slice(0, 25); /* Fetch more before consolidation so we don't lose entries */

    /*
     * Consolidate duplicate station entries (e.g. Liverpool Street appears
     * as separate tube, Elizabeth line, and rail entries). Merges non-bus
     * stations with the same name into one entry with all lines combined.
     */
    const consolidated = consolidateStations(stations).slice(0, 15);

    return NextResponse.json(consolidated);
  } catch (error) {
    console.error("TfL nearby error:", error);
    return NextResponse.json(
      { error: "Failed to fetch nearby stations" },
      { status: 500 }
    );
  }
}
