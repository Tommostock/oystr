/**
 * useSavedAirports.ts — Hook for pinned airports
 *
 * Parallel to useSavedRailStations but keyed by IATA code. A saved
 * airport surfaces as a quick-view card on the Terminal tab and
 * opens /flights/airport/[iata] on tap.
 */

"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type SavedAirport } from "@/lib/db";

export function useSavedAirports() {
  const airports = useLiveQuery<SavedAirport[], SavedAirport[]>(
    () => db.savedAirports.orderBy("addedAt").reverse().toArray(),
    [],
    []
  );

  async function isSaved(iata: string): Promise<boolean> {
    const existing = await db.savedAirports.get(iata.toUpperCase());
    return !!existing;
  }

  async function addAirport(input: {
    iata: string;
    name: string;
    city?: string;
    country?: string;
  }): Promise<void> {
    await db.savedAirports.put({
      iata: input.iata.toUpperCase(),
      name: input.name,
      city: input.city,
      country: input.country,
      addedAt: Date.now(),
    });
  }

  async function removeAirport(iata: string): Promise<void> {
    await db.savedAirports.delete(iata.toUpperCase());
  }

  async function toggleAirport(input: {
    iata: string;
    name: string;
    city?: string;
    country?: string;
  }): Promise<boolean> {
    const existing = await db.savedAirports.get(input.iata.toUpperCase());
    if (existing) {
      await removeAirport(input.iata);
      return false;
    }
    await addAirport(input);
    return true;
  }

  return {
    airports: airports || [],
    isSaved,
    addAirport,
    removeAirport,
    toggleAirport,
  };
}
