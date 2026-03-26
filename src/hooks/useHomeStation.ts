/**
 * useHomeStation.ts — Manages the user's saved home station
 *
 * Stores and retrieves the home station from localStorage.
 * Used by the "Directions Home" feature on the Journey page.
 *
 * Usage:
 *   const { homeStation, setHomeStation, clearHomeStation } = useHomeStation();
 */

"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "oystr-home-station";

export interface HomeStation {
  naptanId: string;
  name: string;
  lat: number;
  lon: number;
}

export function useHomeStation() {
  const [homeStation, setHomeStationState] = useState<HomeStation | null>(null);

  /* Load from localStorage on mount */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHomeStationState(JSON.parse(stored));
      }
    } catch {
      /* Silently fail if localStorage is unavailable */
    }
  }, []);

  /* Save a home station */
  const setHomeStation = useCallback((station: HomeStation) => {
    setHomeStationState(station);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(station));
    } catch {
      /* Silently fail */
    }
  }, []);

  /* Clear the home station */
  const clearHomeStation = useCallback(() => {
    setHomeStationState(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* Silently fail */
    }
  }, []);

  return { homeStation, setHomeStation, clearHomeStation };
}
