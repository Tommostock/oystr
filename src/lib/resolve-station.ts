/**
 * resolve-station.ts — Resolve station names, addresses, and places to naptan IDs
 *
 * Handles multiple types of location input:
 *   - Station names: "Kings Cross" → search TfL → naptan ID
 *   - Hub IDs: "HUBKGX" → resolve to tube/rail child station
 *   - Addresses: "10 Gresham Street" → geocode with Nominatim → nearest station
 *   - Places: "the O2" → geocode → nearest station
 *   - "CURRENT_LOCATION" → use GPS coords → nearest station
 *
 * Geocoding uses OpenStreetMap Nominatim (free, no API key, 1 req/sec limit).
 */

import { TFL_API_BASE } from "@/lib/constants";

/** The result of resolving a station name */
export interface ResolvedStation {
  naptanId: string;
  name: string;
  lat: number;
  lon: number;
}

/** Geocoded location from Nominatim */
interface GeocodedLocation {
  lat: number;
  lon: number;
  displayName: string;
}

/**
 * Resolve a location string to a naptan ID.
 *
 * Tries multiple strategies in order:
 *   1. "CURRENT_LOCATION" → use GPS coords → nearest station
 *   2. TfL station search → direct match
 *   3. Geocode with Nominatim → find nearest station to those coords
 *
 * @param name - Station name, address, or place from Gemini
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

  /* Try TfL station search first — works for station names */
  const stationResult = await resolveFromSearch(name);
  if (stationResult) return stationResult;

  /*
   * If TfL search fails, try geocoding the name as an address/place.
   * This handles things like "10 Gresham Street" or "the O2 Arena".
   */
  return resolveFromGeocode(name);
}

/**
 * Resolve a place name or address by geocoding it, then finding
 * the nearest TfL station to those coordinates.
 *
 * Uses OpenStreetMap Nominatim (free, no API key required).
 * Rate limit: 1 request per second — fine for our use case.
 */
async function resolveFromGeocode(
  query: string
): Promise<ResolvedStation | null> {
  try {
    /* Geocode the address/place to lat/lon */
    const location = await geocodeWithNominatim(query + ", London, UK");
    if (!location) return null;

    /* Find the nearest TfL station to those coordinates */
    return resolveFromLocation(location.lat, location.lon);
  } catch {
    return null;
  }
}

/**
 * Geocode an address or place name using OpenStreetMap Nominatim.
 *
 * Nominatim is free and requires no API key.
 * It does require a User-Agent header to identify the app.
 *
 * @param query - The address or place to geocode (e.g. "10 Gresham Street, London")
 * @returns Lat/lon coordinates and display name, or null if not found
 */
export async function geocodeWithNominatim(
  query: string
): Promise<GeocodedLocation | null> {
  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      limit: "1",
      /* Bias results towards London */
      viewbox: "-0.5103,51.2868,0.3340,51.6919",
      bounded: "1",
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          /* Nominatim requires a User-Agent identifying the app */
          "User-Agent": "Oystr-London-Transport-PWA/1.0",
        },
        next: { revalidate: 86400 }, /* Cache for 24 hours — addresses don't move */
      }
    );

    if (!response.ok) return null;

    const results = await response.json();
    if (!results || results.length === 0) return null;

    const best = results[0];
    return {
      lat: parseFloat(best.lat),
      lon: parseFloat(best.lon),
      displayName: best.display_name || query,
    };
  } catch {
    return null;
  }
}

/**
 * Find the nearest station to the user's coordinates.
 */
export async function resolveFromLocation(
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
