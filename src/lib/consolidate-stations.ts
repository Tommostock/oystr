/**
 * consolidate-stations.ts — Merge duplicate station entries
 *
 * TfL returns separate stop points for the same station complex.
 * For example, Liverpool Street appears as:
 *   - "Liverpool Street" (tube, naptanId: 940GZZLULVT)
 *   - "Liverpool Street" (Elizabeth line, naptanId: 910GLVST)
 *   - "London Liverpool Street" (Overground/National Rail)
 *
 * This utility merges these into a single entry with all lines
 * combined, while keeping bus stops as separate entries (since
 * each bus stop letter represents a physically different location).
 */

/** Minimal shape that both nearby and search results share */
export interface ConsolidatableStation {
  naptanId: string;
  name: string;
  lat: number;
  lon: number;
  modes: string[];
  lines: { id: string; name: string }[];
  distance?: number;
  zone?: string;
  stopLetter?: string;
  indicator?: string;
}

/**
 * Normalize a station name for grouping purposes.
 *
 * Strips common suffixes and the "London " prefix that TfL uses
 * for National Rail versions of stations (e.g. "London Paddington"
 * vs "Paddington"). "London Bridge" is safe because there is no
 * separate "Bridge" station — the prefix only matters when both
 * "X" and "London X" exist in the same result set.
 */
function normalizeNameForGrouping(name: string): string {
  return name
    .replace(/\s*Underground Station$/i, "")
    .replace(/\s*DLR Station$/i, "")
    .replace(/\s*Rail Station$/i, "")
    .replace(/\s*Station$/i, "")
    .replace(/\s*\(London\)/i, "")
    .replace(/^London\s+/i, "")
    .trim()
    .toLowerCase();
}

/**
 * Check if a station is a bus stop.
 * Bus stops have IDs starting with "490" or only the "bus" mode.
 */
function isBusStop(station: ConsolidatableStation): boolean {
  return (
    station.naptanId.startsWith("490") ||
    (station.modes.length === 1 && station.modes[0] === "bus") ||
    !!station.stopLetter
  );
}

/**
 * Consolidate duplicate station entries into single entries.
 *
 * Non-bus stations with the same normalized name are merged:
 *   - Lines are combined (deduplicated by ID)
 *   - Modes are combined (deduplicated)
 *   - The closest distance is kept (for nearby results)
 *   - All naptan IDs are collected into allNaptanIds
 *   - The shortest clean name is used for display
 *
 * Bus stops are never merged — each stop letter is a different
 * physical location that the user needs to distinguish.
 */
export function consolidateStations<T extends ConsolidatableStation>(
  stations: T[]
): (T & { allNaptanIds: string[] })[] {
  const busStops: (T & { allNaptanIds: string[] })[] = [];
  /* Map from normalized name to group of stations */
  const groups = new Map<string, T[]>();

  for (const station of stations) {
    if (isBusStop(station)) {
      busStops.push({ ...station, allNaptanIds: [station.naptanId] });
      continue;
    }

    const key = normalizeNameForGrouping(station.name);
    const existing = groups.get(key);
    if (existing) {
      existing.push(station);
    } else {
      groups.set(key, [station]);
    }
  }

  /* Merge each group into a single station entry */
  const merged: (T & { allNaptanIds: string[] })[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      merged.push({ ...group[0], allNaptanIds: [group[0].naptanId] });
      continue;
    }

    /*
     * Pick the "best" station as the base:
     * - Prefer the one with the shortest cleaned name (usually the tube entry)
     * - If equal, prefer the closest one (smallest distance)
     */
    const sorted = [...group].sort((a, b) => {
      const aName = a.name.replace(/^London\s+/i, "").length;
      const bName = b.name.replace(/^London\s+/i, "").length;
      if (aName !== bName) return aName - bName;
      return (a.distance ?? Infinity) - (b.distance ?? Infinity);
    });

    const base = sorted[0];

    /* Collect all naptan IDs */
    const allNaptanIds = group.map((s) => s.naptanId);

    /* Merge all lines, deduplicating by line ID */
    const seenLineIds = new Set<string>();
    const allLines: { id: string; name: string }[] = [];
    for (const station of group) {
      for (const line of station.lines) {
        if (!seenLineIds.has(line.id)) {
          seenLineIds.add(line.id);
          allLines.push(line);
        }
      }
    }

    /* Merge all modes, deduplicating */
    const allModes = Array.from(
      new Set(group.flatMap((s) => s.modes))
    );

    /* Use the smallest distance (closest entry) */
    const minDistance =
      group[0].distance !== undefined
        ? Math.min(...group.map((s) => s.distance ?? Infinity))
        : undefined;

    /* Use the first zone found */
    const zone = group.find((s) => s.zone)?.zone;

    merged.push({
      ...base,
      allNaptanIds,
      lines: allLines,
      modes: allModes,
      ...(minDistance !== undefined ? { distance: minDistance } : {}),
      ...(zone ? { zone } : {}),
    });
  }

  /*
   * Reconstruct the original ordering.
   * For nearby results: sort by bus/non-bus then distance.
   * For search results: keep merged entries in their original position.
   * We use the position of the first member of each group.
   */
  const result: (T & { allNaptanIds: string[] })[] = [];
  const usedGroups = new Set<string>();

  for (const station of stations) {
    if (isBusStop(station)) {
      const busMatch = busStops.find((b) => b.naptanId === station.naptanId);
      if (busMatch) {
        result.push(busMatch);
        busStops.splice(busStops.indexOf(busMatch), 1);
      }
    } else {
      const key = normalizeNameForGrouping(station.name);
      if (!usedGroups.has(key)) {
        usedGroups.add(key);
        const mergedStation = merged.find(
          (m) => normalizeNameForGrouping(m.name) === key
        );
        if (mergedStation) {
          result.push(mergedStation);
        }
      }
    }
  }

  return result;
}
