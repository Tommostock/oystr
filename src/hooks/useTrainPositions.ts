/**
 * useTrainPositions.ts — Hook for live train tracking on the map
 *
 * Polls /Line/{lineId}/Arrivals every 15 seconds for each active line.
 * Parses the currentLocation of each vehicle, looks up station coordinates,
 * and returns an array of train positions to render on the map.
 *
 * Groups by vehicleId to avoid duplicate dots.
 * Only fetches data for lines the user has toggled on.
 *
 * Usage:
 *   const { trains } = useTrainPositions(activeLines, stationLookup);
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { parseTrainLocation, interpolatePosition } from "@/lib/parse-location";
import { TRAIN_TRACKING_POLL_INTERVAL } from "@/lib/constants";
import type { ArrivalPrediction } from "@/lib/tfl-types";

/* ========================================
 * TYPES
 * ======================================== */

/** A train's resolved position on the map */
export interface TrainDotData {
  /** Unique vehicle ID */
  vehicleId: string;
  /** Line this train is on */
  lineId: string;
  /** Map coordinates [lat, lng] */
  position: [number, number];
  /** Where the train is heading */
  destination: string;
}

/** Station lookup: name -> coordinates */
export type StationLookup = Map<
  string,
  { lat: number; lon: number; naptanId: string }
>;

/* ========================================
 * HELPER: Find a station in the lookup by partial name match
 * TfL's currentLocation uses short names like "Mile End"
 * but our lookup has full names like "Mile End Underground Station".
 * We need fuzzy matching.
 * ======================================== */

/**
 * Strip common suffixes from station names for comparison.
 * "Mile End Underground Station" -> "mile end"
 * "Kings Cross St. Pancras" -> "kings cross st. pancras"
 */
function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*underground station$/i, "")
    .replace(/\s*dlr station$/i, "")
    .replace(/\s*rail station$/i, "")
    .replace(/\s*station$/i, "")
    .replace(/\s*\(london\)/i, "")
    .trim();
}

function findStation(
  name: string,
  lookup: StationLookup
): { lat: number; lon: number } | null {
  if (!name) return null;

  /* Try exact match first */
  const exact = lookup.get(name);
  if (exact) return exact;

  const normInput = normalise(name);

  /* Try normalised matching — compare cleaned versions of both names */
  for (const [stationName, coords] of lookup) {
    const normStation = normalise(stationName);

    /* Exact normalised match */
    if (normStation === normInput) return coords;

    /* One contains the other (handles partial names and abbreviations) */
    if (normStation.includes(normInput) || normInput.includes(normStation)) {
      return coords;
    }

    /* Handle "St." vs "St" and "&" vs "and" variations */
    const normInputAlt = normInput.replace(/\./g, "").replace(/&/g, "and");
    const normStationAlt = normStation.replace(/\./g, "").replace(/&/g, "and");
    if (normStationAlt.includes(normInputAlt) || normInputAlt.includes(normStationAlt)) {
      return coords;
    }
  }

  return null;
}

/* ========================================
 * HOOK
 * ======================================== */

export function useTrainPositions(
  activeLines: Set<string>,
  stationLookup: StationLookup
) {
  const [trains, setTrains] = useState<TrainDotData[]>([]);
  const intervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const activeLinesRef = useRef<Set<string>>(new Set());
  /* Use a ref for the lookup so fetchTrains doesn't re-create on every station update */
  const lookupRef = useRef<StationLookup>(stationLookup);
  lookupRef.current = stationLookup;

  /**
   * Fetch arrivals for a line, parse locations, and resolve to coordinates.
   */
  const fetchTrains = useCallback(
    async (lineId: string) => {
      const lookup = lookupRef.current;
      if (lookup.size === 0) return;

      try {
        const response = await fetch(
          `/api/tfl/line-arrivals?lineId=${lineId}`
        );
        if (!response.ok) return;

        const arrivals: ArrivalPrediction[] = await response.json();

        /*
         * Group arrivals by vehicleId.
         * Each vehicle appears multiple times (once per station it will visit).
         * We pick the entry with the smallest timeToStation (the next stop)
         * because that's the most accurate position indicator.
         */
        const vehicleMap = new Map<string, ArrivalPrediction>();
        for (const arrival of arrivals) {
          if (!arrival.vehicleId) continue;
          const existing = vehicleMap.get(arrival.vehicleId);
          if (!existing || arrival.timeToStation < existing.timeToStation) {
            vehicleMap.set(arrival.vehicleId, arrival);
          }
        }

        /* Resolve each vehicle's position to map coordinates */
        const trainDots: TrainDotData[] = [];

        for (const [vehicleId, arrival] of vehicleMap) {
          const parsed = parseTrainLocation(arrival.currentLocation);
          let position: [number, number] | null = null;

          switch (parsed.type) {
            case "between": {
              /* Midpoint between two stations */
              const stationA = findStation(parsed.stations[0], lookup);
              const stationB = findStation(parsed.stations[1], lookup);
              if (stationA && stationB) {
                position = interpolatePosition(
                  [stationA.lat, stationA.lon],
                  [stationB.lat, stationB.lon],
                  0.5
                );
              }
              break;
            }

            case "approaching": {
              /* 80% of the way to the station */
              const target = findStation(parsed.stations[0], lookup);
              const stationNaptan = findStation(arrival.stationName, lookup);
              if (target && stationNaptan) {
                position = interpolatePosition(
                  [stationNaptan.lat, stationNaptan.lon],
                  [target.lat, target.lon],
                  0.8
                );
              } else if (target) {
                position = [target.lat + 0.001, target.lon + 0.001];
              }
              break;
            }

            case "at_platform": {
              const atStation = findStation(arrival.stationName, lookup);
              if (atStation) {
                position = [atStation.lat, atStation.lon];
              }
              break;
            }

            case "at": {
              const namedStation = findStation(parsed.stations[0], lookup);
              if (namedStation) {
                position = [namedStation.lat, namedStation.lon];
              }
              break;
            }

            case "left": {
              const leftStation = findStation(parsed.stations[0], lookup);
              if (leftStation) {
                position = [leftStation.lat + 0.0005, leftStation.lon + 0.0005];
              }
              break;
            }

            default:
              /* Unknown location — skip */
              break;
          }

          if (position) {
            trainDots.push({
              vehicleId,
              lineId,
              position,
              destination: arrival.destinationName || "",
            });
          }
        }

        /* Update trains state — replace this line's trains, keep others */
        setTrains((prev) => [
          ...prev.filter((t) => t.lineId !== lineId),
          ...trainDots,
        ]);
      } catch (error) {
        console.error(`Train tracking error for ${lineId}:`, error);
      }
    },
    [] /* No deps — uses lookupRef.current which is always up to date */
  );

  /**
   * Manage polling intervals for each active line.
   * Start polling when a line is toggled on, stop when toggled off.
   * Wait until we have station data before starting (needed for coordinate lookups).
   */
  /*
   * Serialize activeLines to a string so React can do a proper
   * value comparison instead of reference comparison on the Set.
   */
  const activeLinesKey = Array.from(activeLines).sort().join(",");

  useEffect(() => {
    /* Don't start tracking until we have station coordinates to look up */
    if (lookupRef.current.size === 0) return;

    const currentActive = new Set(activeLinesKey.split(",").filter(Boolean));

    /* Start polling for any active line that doesn't have an interval yet */
    for (const lineId of currentActive) {
      if (!intervalsRef.current.has(lineId)) {
        /* Fetch immediately */
        fetchTrains(lineId);
        /* Then poll every 15 seconds */
        const interval = setInterval(
          () => fetchTrains(lineId),
          TRAIN_TRACKING_POLL_INTERVAL
        );
        intervalsRef.current.set(lineId, interval);
      }
    }

    /* Stop polling for deactivated lines */
    for (const [lineId, interval] of intervalsRef.current) {
      if (!currentActive.has(lineId)) {
        clearInterval(interval);
        intervalsRef.current.delete(lineId);
        /* Remove this line's train dots */
        setTrains((prev) => prev.filter((t) => t.lineId !== lineId));
      }
    }

    activeLinesRef.current = currentActive;

    /*
     * NO cleanup function that clears all intervals.
     * Intervals are managed incrementally above (started/stopped per line).
     * Only clean up everything on full unmount via a separate effect below.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLinesKey, stationLookup.size]);

  /* Clean up all intervals on unmount only */
  useEffect(() => {
    return () => {
      for (const interval of intervalsRef.current.values()) {
        clearInterval(interval);
      }
      intervalsRef.current.clear();
    };
  }, []);

  return { trains };
}
