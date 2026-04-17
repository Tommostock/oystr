/**
 * useSavedRailJourneys.ts — Hook for managing saved National Rail routes
 *
 * Stores long-distance rail routes (e.g. London Kings Cross -> Leeds)
 * in IndexedDB via Dexie.js. Persists across sessions and works offline.
 *
 * Uses Dexie's useLiveQuery to automatically update the UI whenever
 * the savedRailJourneys table changes — mirrors the pattern used by
 * useFavourites for TfL stations.
 *
 * Usage:
 *   const { journeys, isSaved, addJourney, removeJourney, toggleJourney } =
 *     useSavedRailJourneys();
 */

"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type SavedRailJourney } from "@/lib/db";

/**
 * Build the canonical journey ID from FROM + TO CRS codes.
 * Used as the primary key so saving the same route twice is a no-op.
 */
function buildJourneyId(fromCrs: string, toCrs: string): string {
  return `${fromCrs.toUpperCase()}-${toCrs.toUpperCase()}`;
}

/**
 * Hook for saved rail journeys (from -> to pairs).
 *
 * useLiveQuery re-runs and re-renders the component whenever
 * the underlying Dexie table changes — no manual state required.
 */
export function useSavedRailJourneys() {
  const journeys = useLiveQuery<SavedRailJourney[], SavedRailJourney[]>(
    () => db.savedRailJourneys.orderBy("addedAt").reverse().toArray(),
    [],
    []
  );

  /**
   * Check if a specific FROM -> TO route is already saved.
   */
  async function isSaved(fromCrs: string, toCrs: string): Promise<boolean> {
    const existing = await db.savedRailJourneys.get(
      buildJourneyId(fromCrs, toCrs)
    );
    return !!existing;
  }

  /**
   * Add a rail journey to saved routes.
   * Uses put() so re-saving updates the timestamp rather than failing.
   */
  async function addJourney(journey: {
    fromCrs: string;
    fromName: string;
    toCrs: string;
    toName: string;
  }): Promise<void> {
    const id = buildJourneyId(journey.fromCrs, journey.toCrs);
    await db.savedRailJourneys.put({
      id,
      fromCrs: journey.fromCrs.toUpperCase(),
      fromName: journey.fromName,
      toCrs: journey.toCrs.toUpperCase(),
      toName: journey.toName,
      addedAt: Date.now(),
    });
  }

  /**
   * Remove a saved journey by its ID.
   */
  async function removeJourney(id: string): Promise<void> {
    await db.savedRailJourneys.delete(id);
  }

  /**
   * Toggle saved status for a route.
   * Returns true if the route is now saved, false if it was removed.
   */
  async function toggleJourney(journey: {
    fromCrs: string;
    fromName: string;
    toCrs: string;
    toName: string;
  }): Promise<boolean> {
    const id = buildJourneyId(journey.fromCrs, journey.toCrs);
    const exists = await db.savedRailJourneys.get(id);
    if (exists) {
      await removeJourney(id);
      return false;
    } else {
      await addJourney(journey);
      return true;
    }
  }

  return {
    /** Array of saved journeys, newest first */
    journeys: journeys || [],
    /** Check if a FROM -> TO route is already saved */
    isSaved,
    /** Add a route to saved */
    addJourney,
    /** Remove a saved route by ID */
    removeJourney,
    /** Toggle a route between saved/unsaved */
    toggleJourney,
    /** Helper to build the canonical journey ID */
    buildJourneyId,
  };
}
