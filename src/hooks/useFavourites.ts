/**
 * useFavourites.ts — Hook for managing favourite stations
 *
 * Provides functions to add, remove, and list favourite stations.
 * All data is stored in IndexedDB via Dexie.js, so favourites
 * persist across sessions and work offline.
 *
 * Uses Dexie's useLiveQuery to reactively update the UI
 * whenever the favourites table changes.
 *
 * Usage:
 *   const { favourites, isFavourite, addFavourite, removeFavourite } = useFavourites();
 */

"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type FavouriteStation } from "@/lib/db";

/**
 * Hook to manage favourite stations in IndexedDB.
 *
 * useLiveQuery automatically re-renders the component
 * whenever the underlying Dexie table changes — no need
 * for manual state management or re-fetching.
 */
export function useFavourites() {
  /*
   * Live query: automatically updates when the favourites table changes.
   * Returns all favourites sorted by when they were added (newest first).
   */
  const favourites = useLiveQuery(
    () => db.favourites.orderBy("addedAt").reverse().toArray(),
    [], // dependencies — empty means it only re-runs when the table changes
    [] // default value while loading
  );

  /**
   * Check if a station is already saved as a favourite.
   *
   * @param naptanId - The station's unique TfL ID
   * @returns true if the station is in the favourites table
   */
  async function isFavourite(naptanId: string): Promise<boolean> {
    const existing = await db.favourites.get(naptanId);
    return !!existing;
  }

  /**
   * Add a station to favourites.
   *
   * @param station - Object with station details to save
   */
  async function addFavourite(station: {
    naptanId: string;
    name: string;
    lines: string[];
    lat: number;
    lng: number;
  }): Promise<void> {
    /* Use put() instead of add() — put() overwrites if the key already exists */
    await db.favourites.put({
      naptanId: station.naptanId,
      name: station.name,
      lines: station.lines,
      lat: station.lat,
      lng: station.lng || 0,
      addedAt: Date.now(),
    });
  }

  /**
   * Remove a station from favourites.
   *
   * @param naptanId - The station's unique TfL ID
   */
  async function removeFavourite(naptanId: string): Promise<void> {
    await db.favourites.delete(naptanId);
    /* Also clean up any cached timetables for this station */
    await db.timetables.where("stationId").equals(naptanId).delete();
  }

  /**
   * Toggle a station's favourite status.
   * If it's saved, remove it. If it's not saved, add it.
   *
   * @param station - Object with station details
   * @returns true if the station is now a favourite, false if it was removed
   */
  async function toggleFavourite(station: {
    naptanId: string;
    name: string;
    lines: string[];
    lat: number;
    lng: number;
  }): Promise<boolean> {
    const exists = await isFavourite(station.naptanId);
    if (exists) {
      await removeFavourite(station.naptanId);
      return false;
    } else {
      await addFavourite(station);
      return true;
    }
  }

  return {
    /** Array of favourite stations, newest first */
    favourites: favourites || [],
    /** Check if a station is a favourite */
    isFavourite,
    /** Add a station to favourites */
    addFavourite,
    /** Remove a station from favourites */
    removeFavourite,
    /** Toggle a station's favourite status */
    toggleFavourite,
  };
}
