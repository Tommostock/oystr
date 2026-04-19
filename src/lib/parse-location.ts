/**
 * parse-location.ts — Resolve TfL's `currentLocation` strings into map positions
 *
 * TfL's Arrivals endpoint returns a free-text `currentLocation` field
 * for each vehicle — e.g.:
 *   "Between Mile End and Stratford"
 *   "Approaching Bank"
 *   "At Platform"
 *   "Left Bank"
 *   "At Stratford"
 *
 * To place a vehicle on the map we need to convert these strings into
 * {lat, lon} coordinates. We do that by matching the station names in
 * the string against a route-sequence array (ordered list of stops
 * with coordinates) from the /Line/{id}/Route/Sequence endpoint.
 *
 * Returns null when no position can be confidently inferred — callers
 * should just not render a marker in that case rather than guess.
 */

export interface RouteStop {
  /** CRS or Naptan code — unused here but preserved for round-trips */
  naptanId: string;
  /** Station display name — matched against currentLocation text */
  name: string;
  lat: number;
  lon: number;
}

export interface ResolvedPosition {
  lat: number;
  lon: number;
  /** Which pattern matched — useful for debugging/classification */
  kind: "between" | "at" | "approaching" | "left";
}

/**
 * Find a stop in `route` whose name matches `needle` (case-insensitive,
 * whitespace-trimmed). Matching is substring-based so "Bank" matches
 * "Bank Underground Station", and "Mile End" matches "Mile End Station".
 */
function findStop(route: RouteStop[], needle: string): RouteStop | null {
  const needleLower = needle.trim().toLowerCase();
  if (!needleLower) return null;
  /* Prefer exact name-prefix match, fall back to substring contain */
  const exact = route.find(
    (s) => s.name.toLowerCase() === needleLower
  );
  if (exact) return exact;
  const prefix = route.find((s) =>
    s.name.toLowerCase().startsWith(needleLower)
  );
  if (prefix) return prefix;
  return route.find((s) =>
    s.name.toLowerCase().includes(needleLower)
  ) || null;
}

/** Linear interpolate two lat/lon points by `t` in [0,1]. */
function lerp(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
  t: number
): { lat: number; lon: number } {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lon: a.lon + (b.lon - a.lon) * t,
  };
}

/**
 * Parse a TfL `currentLocation` string against a known route sequence.
 * Returns a map position + classification, or null if unparseable.
 *
 * Examples handled:
 *   "Between Mile End and Stratford"   → midpoint of the two stops
 *   "Approaching Bank"                 → 80% of the way from prev stop
 *   "Left Bank"                        → 20% past Bank toward the next
 *   "At Stratford" / "At Platform"     → on the stop (or null if unknown)
 */
export function parseCurrentLocation(
  currentLocation: string,
  route: RouteStop[]
): ResolvedPosition | null {
  if (!currentLocation || route.length === 0) return null;
  const text = currentLocation.trim();

  /* "Between X and Y" — midpoint */
  const betweenMatch = text.match(/^between\s+(.+?)\s+and\s+(.+)$/i);
  if (betweenMatch) {
    const a = findStop(route, betweenMatch[1]);
    const b = findStop(route, betweenMatch[2]);
    if (a && b) {
      const mid = lerp(a, b, 0.5);
      return { ...mid, kind: "between" };
    }
  }

  /* "Approaching X" — 80% toward X from the prior stop on the route */
  const approachingMatch = text.match(/^approaching\s+(.+)$/i);
  if (approachingMatch) {
    const x = findStop(route, approachingMatch[1]);
    if (x) {
      const idx = route.indexOf(x);
      const prev = idx > 0 ? route[idx - 1] : null;
      if (prev) {
        const p = lerp(prev, x, 0.8);
        return { ...p, kind: "approaching" };
      }
      /* First stop on the route — no previous to interpolate from */
      return { lat: x.lat, lon: x.lon, kind: "approaching" };
    }
  }

  /* "Left X" — 20% past X toward the next stop on the route */
  const leftMatch = text.match(/^left\s+(.+)$/i);
  if (leftMatch) {
    const x = findStop(route, leftMatch[1]);
    if (x) {
      const idx = route.indexOf(x);
      const next = idx >= 0 && idx < route.length - 1 ? route[idx + 1] : null;
      if (next) {
        const p = lerp(x, next, 0.2);
        return { ...p, kind: "left" };
      }
      return { lat: x.lat, lon: x.lon, kind: "left" };
    }
  }

  /* "At X" — directly on the stop. "At Platform" alone carries no
     position info without more context, so we only match when a
     concrete station name follows. */
  const atMatch = text.match(/^at\s+(.+)$/i);
  if (atMatch) {
    const label = atMatch[1].trim();
    if (label.toLowerCase() === "platform") return null;
    const x = findStop(route, label);
    if (x) return { lat: x.lat, lon: x.lon, kind: "at" };
  }

  return null;
}
