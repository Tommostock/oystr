/**
 * useSchematicTrainPositions.ts -- Train tracking for the schematic map
 *
 * Same logic as useTrainPositions but works with schematic x,y
 * coordinates instead of geographic lat/lon.
 *
 * Polls /Line/{lineId}/Arrivals every 15 seconds for each active line,
 * parses currentLocation, and resolves to schematic map positions.
 *
 * Usage:
 *   const { trains } = useSchematicTrainPositions(activeLines, nameLookup);
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { parseTrainLocation, interpolatePosition } from "@/lib/parse-location";
import { TRAIN_TRACKING_POLL_INTERVAL } from "@/lib/constants";
import type { ArrivalPrediction } from "@/lib/tfl-types";

/* ========================================
 * TYPES
 * ======================================== */

/** A train's resolved position on the schematic map */
export interface SchematicTrainDot {
  /** Unique vehicle ID */
  vehicleId: string;
  /** Line this train is on */
  lineId: string;
  /** Schematic coordinates [x, y] */
  position: [number, number];
  /** Where the train is heading */
  destination: string;
}

/** Station lookup: name -> schematic coordinates */
export type SchematicStationLookup = Map<
  string,
  { x: number; y: number; naptanId: string }
>;

/* ========================================
 * HELPER: Find a station by name (fuzzy match)
 * ======================================== */

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
  lookup: SchematicStationLookup
): { x: number; y: number } | null {
  if (!name) return null;

  const exact = lookup.get(name);
  if (exact) return exact;

  const normInput = normalise(name);

  for (const [stationName, coords] of lookup) {
    const normStation = normalise(stationName);

    if (normStation === normInput) return coords;
    if (normStation.includes(normInput) || normInput.includes(normStation)) {
      return coords;
    }

    const normInputAlt = normInput.replace(/\./g, "").replace(/&/g, "and");
    const normStationAlt = normStation.replace(/\./g, "").replace(/&/g, "and");
    if (
      normStationAlt.includes(normInputAlt) ||
      normInputAlt.includes(normStationAlt)
    ) {
      return coords;
    }
  }

  return null;
}

/* ========================================
 * HOOK
 * ======================================== */

export function useSchematicTrainPositions(
  activeLines: Set<string>,
  stationLookup: SchematicStationLookup
) {
  const [trains, setTrains] = useState<SchematicTrainDot[]>([]);
  const intervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lookupRef = useRef(stationLookup);
  lookupRef.current = stationLookup;

  /**
   * Fetch arrivals for a line and resolve to schematic positions.
   */
  const fetchTrains = useCallback(async (lineId: string) => {
    const lookup = lookupRef.current;
    if (lookup.size === 0) return;

    try {
      const response = await fetch(
        `/api/tfl/line-arrivals?lineId=${lineId}`
      );
      if (!response.ok) return;

      const arrivals: ArrivalPrediction[] = await response.json();

      /* Group by vehicleId, keep the one with smallest timeToStation */
      const vehicleMap = new Map<string, ArrivalPrediction>();
      for (const arrival of arrivals) {
        if (!arrival.vehicleId) continue;
        const existing = vehicleMap.get(arrival.vehicleId);
        if (!existing || arrival.timeToStation < existing.timeToStation) {
          vehicleMap.set(arrival.vehicleId, arrival);
        }
      }

      /* Resolve each vehicle's position */
      const dots: SchematicTrainDot[] = [];

      for (const [vehicleId, arrival] of vehicleMap) {
        const parsed = parseTrainLocation(arrival.currentLocation);
        let position: [number, number] | null = null;

        switch (parsed.type) {
          case "between": {
            const a = findStation(parsed.stations[0], lookup);
            const b = findStation(parsed.stations[1], lookup);
            if (a && b) {
              position = interpolatePosition([a.x, a.y], [b.x, b.y], 0.5);
            }
            break;
          }
          case "approaching": {
            const target = findStation(parsed.stations[0], lookup);
            const from = findStation(arrival.stationName, lookup);
            if (target && from) {
              position = interpolatePosition(
                [from.x, from.y],
                [target.x, target.y],
                0.8
              );
            } else if (target) {
              position = [target.x + 2, target.y + 2];
            }
            break;
          }
          case "at_platform": {
            const s = findStation(arrival.stationName, lookup);
            if (s) position = [s.x, s.y];
            break;
          }
          case "at": {
            const s = findStation(parsed.stations[0], lookup);
            if (s) position = [s.x, s.y];
            break;
          }
          case "left": {
            const s = findStation(parsed.stations[0], lookup);
            if (s) position = [s.x + 1, s.y + 1];
            break;
          }
        }

        if (position) {
          dots.push({
            vehicleId,
            lineId,
            position,
            destination: arrival.destinationName || "",
          });
        }
      }

      setTrains((prev) => [
        ...prev.filter((t) => t.lineId !== lineId),
        ...dots,
      ]);
    } catch (error) {
      console.error(`Train tracking error for ${lineId}:`, error);
    }
  }, []);

  /* Serialize activeLines for stable dependency */
  const activeLinesKey = Array.from(activeLines).sort().join(",");

  useEffect(() => {
    if (lookupRef.current.size === 0) return;

    const currentActive = new Set(activeLinesKey.split(",").filter(Boolean));

    /* Start polling for new lines */
    for (const lineId of currentActive) {
      if (!intervalsRef.current.has(lineId)) {
        fetchTrains(lineId);
        const interval = setInterval(
          () => fetchTrains(lineId),
          TRAIN_TRACKING_POLL_INTERVAL
        );
        intervalsRef.current.set(lineId, interval);
      }
    }

    /* Stop polling for removed lines */
    for (const [lineId, interval] of intervalsRef.current) {
      if (!currentActive.has(lineId)) {
        clearInterval(interval);
        intervalsRef.current.delete(lineId);
        setTrains((prev) => prev.filter((t) => t.lineId !== lineId));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLinesKey, stationLookup.size]);

  /* Clean up on unmount */
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
