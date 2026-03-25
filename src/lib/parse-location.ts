/**
 * parse-location.ts — Parser for TfL's currentLocation strings
 *
 * The TfL Arrivals API returns a freeform text field called `currentLocation`
 * that describes where a train currently is. This parser extracts structured
 * data from that text so we can position train dots on the map.
 *
 * Known patterns:
 *   "Between Mile End and Stratford"     -> { type: "between", stations: ["Mile End", "Stratford"] }
 *   "Approaching Bank"                   -> { type: "approaching", stations: ["Bank"] }
 *   "At Platform"                        -> { type: "at_platform", stations: [] }
 *   "Left Bethnal Green"                 -> { type: "left", stations: ["Bethnal Green"] }
 *   "At Holborn"                         -> { type: "at", stations: ["Holborn"] }
 *   ""                                   -> { type: "unknown", stations: [] }
 *
 * Usage:
 *   const position = parseTrainLocation("Between Mile End and Stratford");
 *   // { type: "between", stations: ["Mile End", "Stratford"] }
 */

/* ========================================
 * TYPES
 * ======================================== */

/** The type of train position detected */
export type LocationType =
  | "between"
  | "approaching"
  | "at_platform"
  | "at"
  | "left"
  | "unknown";

/** Parsed train position with type and station name(s) */
export interface TrainPosition {
  /** What kind of position this is */
  type: LocationType;
  /** Station name(s) mentioned in the location string */
  stations: string[];
}

/* ========================================
 * PARSER
 * ======================================== */

/**
 * Parse a TfL currentLocation string into a structured position.
 *
 * @param currentLocation - The raw text from the TfL API
 * @returns Parsed position with type and station names
 */
export function parseTrainLocation(currentLocation: string): TrainPosition {
  /* Handle empty or missing values */
  if (!currentLocation || currentLocation.trim() === "") {
    return { type: "unknown", stations: [] };
  }

  const text = currentLocation.trim();

  /*
   * Pattern: "Between X and Y"
   * The train is somewhere between two stations.
   * We'll position it at the midpoint.
   */
  const betweenMatch = text.match(/^Between\s+(.+?)\s+and\s+(.+)$/i);
  if (betweenMatch) {
    return {
      type: "between",
      stations: [betweenMatch[1].trim(), betweenMatch[2].trim()],
    };
  }

  /*
   * Pattern: "Approaching X"
   * The train is close to arriving at station X.
   * We'll position it ~80% of the way to X.
   */
  const approachingMatch = text.match(/^Approaching\s+(.+)$/i);
  if (approachingMatch) {
    return {
      type: "approaching",
      stations: [approachingMatch[1].trim()],
    };
  }

  /*
   * Pattern: "At Platform" (no station name, just "At Platform")
   * The train is at the platform of the station this prediction is for.
   * We'll use the station from the arrival prediction itself.
   */
  if (/^At\s+Platform$/i.test(text)) {
    return { type: "at_platform", stations: [] };
  }

  /*
   * Pattern: "Left X" or "Left X Platform Y"
   * The train has just left station X.
   * We'll position it ~20% past X towards the next station.
   * Strip any "Platform N" suffix.
   */
  const leftMatch = text.match(/^Left\s+(.+?)(?:\s+Platform\s+\d+)?$/i);
  if (leftMatch) {
    return {
      type: "left",
      stations: [leftMatch[1].trim()],
    };
  }

  /*
   * Pattern: "At X" or "At X Platform Y"
   * The train is at station X (doors may be open).
   * Position directly on station X.
   * Strip any "Platform N" suffix.
   */
  const atMatch = text.match(/^At\s+(.+?)(?:\s+Platform\s+\d+)?$/i);
  if (atMatch) {
    return {
      type: "at",
      stations: [atMatch[1].trim()],
    };
  }

  /*
   * Pattern: "X Area" (e.g. "Brixton Area")
   * The train is in the general area of station X.
   * Position at station X.
   */
  const areaMatch = text.match(/^(.+?)\s+Area$/i);
  if (areaMatch) {
    return {
      type: "at",
      stations: [areaMatch[1].trim()],
    };
  }

  /*
   * Pattern: "Departed X" (e.g. "Departed Brixton")
   * Same as "Left X".
   */
  const departedMatch = text.match(/^Departed\s+(.+?)(?:\s+Platform\s+\d+)?$/i);
  if (departedMatch) {
    return {
      type: "left",
      stations: [departedMatch[1].trim()],
    };
  }

  /* Fallback: unrecognised pattern */
  return { type: "unknown", stations: [] };
}

/* ========================================
 * COORDINATE INTERPOLATION
 * ======================================== */

/**
 * Interpolate a position between two coordinates.
 *
 * @param from - Starting [lat, lng]
 * @param to - Ending [lat, lng]
 * @param fraction - How far between (0 = at from, 1 = at to, 0.5 = midpoint)
 * @returns Interpolated [lat, lng]
 */
export function interpolatePosition(
  from: [number, number],
  to: [number, number],
  fraction: number
): [number, number] {
  return [
    from[0] + (to[0] - from[0]) * fraction,
    from[1] + (to[1] - from[1]) * fraction,
  ];
}
