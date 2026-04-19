/**
 * useSavedJourneys.ts — Hook for managing saved TfL journeys
 *
 * Parallels useSavedRailJourneys but for TfL (London transport)
 * journeys keyed by naptanId rather than CRS code. Stored in the
 * savedJourneys Dexie table (which has existed in the schema since
 * v1 but was previously unused).
 *
 * Usage:
 *   const { journeys, isSaved, saveJourney, removeJourney, toggle } =
 *     useSavedJourneys();
 */

"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type SavedJourney } from "@/lib/db";

function buildId(fromId: string, toId: string): string {
  return `${fromId}-${toId}`;
}

export function useSavedJourneys() {
  const journeys = useLiveQuery<SavedJourney[], SavedJourney[]>(
    () => db.savedJourneys.orderBy("savedAt").reverse().toArray(),
    [],
    []
  );

  async function isSaved(fromId: string, toId: string): Promise<boolean> {
    const existing = await db.savedJourneys.get(buildId(fromId, toId));
    return !!existing;
  }

  async function saveJourney(journey: {
    fromNaptanId: string;
    fromName: string;
    fromLat: number;
    fromLon: number;
    toNaptanId: string;
    toName: string;
    toLat: number;
    toLon: number;
  }): Promise<void> {
    const id = buildId(journey.fromNaptanId, journey.toNaptanId);
    await db.savedJourneys.put({
      id,
      ...journey,
      savedAt: Date.now(),
    });
  }

  async function removeJourney(id: string): Promise<void> {
    await db.savedJourneys.delete(id);
  }

  async function toggleJourney(journey: {
    fromNaptanId: string;
    fromName: string;
    fromLat: number;
    fromLon: number;
    toNaptanId: string;
    toName: string;
    toLat: number;
    toLon: number;
  }): Promise<boolean> {
    const id = buildId(journey.fromNaptanId, journey.toNaptanId);
    const existing = await db.savedJourneys.get(id);
    if (existing) {
      await removeJourney(id);
      return false;
    } else {
      await saveJourney(journey);
      return true;
    }
  }

  return {
    journeys: journeys || [],
    isSaved,
    saveJourney,
    removeJourney,
    toggleJourney,
    buildId,
  };
}
