/**
 * resolve-station.ts — Resolve station names to naptan IDs
 *
 * When Gemini extracts a station name from natural language (e.g. "Kings Cross"),
 * we need to convert it to a naptan ID that the TfL Journey API accepts.
 *
 * This helper calls our own /api/tfl/search endpoint internally (server-side)
 * and returns the best match.
 *
 * Also handles the special "CURRENT_LOCATION" sentinel by calling
 * the nearby stations endpoint with the user's coordinates.
 */

import { TFL_API_BASE } from "@/lib/constants";

/** The result of resolving a station name */
export interface ResolvedStation {
  naptanId: string;
  name: string;
  lat: number;
  lon: number;
}

/**
 * Resolve a station name string to a naptan ID.
 *
 * @param name - Station name from Gemini (e.g. "Kings Cross", "the O2")
 *               or "CURRENT_LOCATION" if the user said "from here"
 * @param lat - User's latitude (needed if name is "CURRENT_LOCATION")
 * @param lon - User's longitude (needed if name is "CURRENT_LOCATION")
 * @returns The resolved station, or null if not found
 */
export async function resolveStation(
  name: string,
  lat?: number,
  lon?: number
): Promise<ResolvedStation | null> {
  /* Handle "from here" — use nearby stations endpoint */
  if (name === "CURRENT_LOCATION") {
    return resolveFromLocation(lat, lon);
  }

  /* Search the TfL API for the station name */
  return resolveFromSearch(name);
}

/**
 * Find the nearest station to the user's coordinates.
 */
async function resolveFromLocation(
  lat?: number,
  lon?: number
): Promise<ResolvedStation | null> {
  if (!lat || !lon) return null;

  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
      radius: "500",
      stopTypes: "NaptanMetroStation,NaptanRailStation",
      modes: "tube,dlr,overground,elizabeth-line",
    });

    if (process.env.TFL_APP_KEY) {
      params.set("app_key", process.env.TFL_APP_KEY);
    }

    const response = await fetch(`${TFL_API_BASE}/StopPoint?${params}`, {
      next: { revalidate: 300 },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const stops = data.stopPoints || [];

    if (stops.length === 0) return null;

    /* Pick the closest station (they come sorted by distance) */
    const closest = stops[0];
    return {
      naptanId: closest.naptanId,
      name: closest.commonName
        .replace(/ Underground Station$/i, "")
        .replace(/ DLR Station$/i, "")
        .replace(/ Rail Station$/i, "")
        .replace(/ Station$/i, "")
        .trim(),
      lat: closest.lat,
      lon: closest.lon,
    };
  } catch {
    return null;
  }
}

/**
 * Search for a station by name using the TfL search API.
 *
 * If the best match is a hub ID (e.g. HUBKGX for King's Cross),
 * we resolve it to a proper tube/rail naptan ID so the Journey
 * API doesn't choke on it.
 */
async function resolveFromSearch(
  name: string
): Promise<ResolvedStation | null> {
  try {
    const params = new URLSearchParams({
      query: name.trim(),
      modes: "tube,bus,dlr,overground,elizabeth-line",
      maxResults: "3",
    });

    if (process.env.TFL_APP_KEY) {
      params.set("app_key", process.env.TFL_APP_KEY);
    }

    const response = await fetch(`${TFL_API_BASE}/StopPoint/Search?${params}`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const matches = data.matches || [];

    if (matches.length === 0) return null;

    /* Return the first (best) match */
    const best = matches[0];
    let naptanId = best.id;

    /*
     * Hub IDs (HUBKGX, HUBLST, HUBBAN, etc.) cause the Journey API
     * to return disambiguation errors or route to street locations.
     * We need to resolve them to the actual tube/rail station ID.
     */
    if (naptanId.startsWith("HUB")) {
      const resolved = await resolveHubId(naptanId);
      if (resolved) {
        return resolved;
      }
    }

    return {
      naptanId,
      name: best.name,
      lat: best.lat,
      lon: best.lon,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve a hub ID (e.g. HUBKGX) to a tube/rail station naptan ID.
 *
 * Hub children are fetched from the TfL StopPoint API and we pick
 * the tube station first, then rail, then any child.
 */
async function resolveHubId(hubId: string): Promise<ResolvedStation | null> {
  try {
    const params = new URLSearchParams();
    if (process.env.TFL_APP_KEY) {
      params.set("app_key", process.env.TFL_APP_KEY);
    }

    const response = await fetch(
      `${TFL_API_BASE}/StopPoint/${hubId}?${params}`,
      { next: { revalidate: 86400 } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const children = data.children || [];

    /* Prefer tube stations (940GZZLU...) */
    const tubeChild = children.find(
      (c: { naptanId: string; stopType: string }) =>
        c.stopType === "NaptanMetroStation" ||
        c.naptanId?.startsWith("940GZZLU")
    );

    if (tubeChild) {
      return {
        naptanId: tubeChild.naptanId,
        name: (tubeChild.commonName || data.commonName || "")
          .replace(/ Underground Station$/i, "")
          .replace(/ Station$/i, "")
          .trim(),
        lat: tubeChild.lat ?? data.lat,
        lon: tubeChild.lon ?? data.lon,
      };
    }

    /* Then rail stations (910G...) */
    const railChild = children.find(
      (c: { naptanId: string; stopType: string }) =>
        c.stopType === "NaptanRailStation" ||
        c.naptanId?.startsWith("910G")
    );

    if (railChild) {
      return {
        naptanId: railChild.naptanId,
        name: (railChild.commonName || data.commonName || "")
          .replace(/ Rail Station$/i, "")
          .replace(/ Station$/i, "")
          .trim(),
        lat: railChild.lat ?? data.lat,
        lon: railChild.lon ?? data.lon,
      };
    }

    /* Any child as fallback */
    if (children.length > 0 && children[0].naptanId) {
      return {
        naptanId: children[0].naptanId,
        name: (children[0].commonName || data.commonName || "")
          .replace(/ Underground Station$/i, "")
          .replace(/ Station$/i, "")
          .trim(),
        lat: children[0].lat ?? data.lat,
        lon: children[0].lon ?? data.lon,
      };
    }

    /* Last resort: hub's own icsCode */
    if (data.icsCode) {
      return {
        naptanId: data.icsCode,
        name: (data.commonName || "")
          .replace(/ Underground Station$/i, "")
          .replace(/ Station$/i, "")
          .trim(),
        lat: data.lat,
        lon: data.lon,
      };
    }

    return null;
  } catch {
    return null;
  }
}
