/**
 * useHomeStation.ts — Manages the user's saved home station
 *
 * Stores and retrieves the home station from localStorage via the
 * useLocalStorage SSR-safe wrapper. Used by the "Directions Home"
 * feature on the Journey page.
 *
 * Usage:
 *   const { homeStation, setHomeStation, clearHomeStation } = useHomeStation();
 */

"use client";

import { useCallback } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

const STORAGE_KEY = "oystr-home-station";

export interface HomeStation {
  naptanId: string;
  name: string;
  lat: number;
  lon: number;
}

export function useHomeStation() {
  const [homeStation, setStored] = useLocalStorage<HomeStation | null>(
    STORAGE_KEY,
    null
  );

  const setHomeStation = useCallback(
    (station: HomeStation) => setStored(station),
    [setStored]
  );

  const clearHomeStation = useCallback(() => setStored(null), [setStored]);

  return { homeStation, setHomeStation, clearHomeStation };
}
