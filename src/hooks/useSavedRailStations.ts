/**
 * useSavedRailStations.ts — Hook for pinned National Rail stations
 *
 * Parallel to useFavourites (which handles tube/bus stops) but keyed
 * by CRS code. A saved rail station shows up as a card on Depart and
 * gives the user one tap to open /rail/station/[crs] with the live
 * departure board.
 *
 * Separate from useSavedRailJourneys, which stores FROM -> TO route
 * pairs — the two concepts are kept distinct so the user can save
 * Leeds as a station AND save KGX -> LDS as a route independently.
 */

"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type SavedRailStation } from "@/lib/db";

export function useSavedRailStations() {
  const stations = useLiveQuery<SavedRailStation[], SavedRailStation[]>(
    () => db.savedRailStations.orderBy("addedAt").reverse().toArray(),
    [],
    []
  );

  async function isSaved(crs: string): Promise<boolean> {
    const existing = await db.savedRailStations.get(crs.toUpperCase());
    return !!existing;
  }

  async function addStation(input: { crs: string; name: string }): Promise<void> {
    await db.savedRailStations.put({
      crs: input.crs.toUpperCase(),
      name: input.name,
      addedAt: Date.now(),
    });
  }

  async function removeStation(crs: string): Promise<void> {
    await db.savedRailStations.delete(crs.toUpperCase());
  }

  async function toggleStation(input: {
    crs: string;
    name: string;
  }): Promise<boolean> {
    const existing = await db.savedRailStations.get(input.crs.toUpperCase());
    if (existing) {
      await removeStation(input.crs);
      return false;
    }
    await addStation(input);
    return true;
  }

  return {
    stations: stations || [],
    isSaved,
    addStation,
    removeStation,
    toggleStation,
  };
}
