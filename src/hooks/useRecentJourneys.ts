/**
 * useRecentJourneys.ts — Track the last few TfL journey searches
 *
 * Stores the most recent 5 journey searches in localStorage via the
 * useLocalStorage SSR-safe wrapper. The user can re-run a previous
 * search with one tap instead of re-entering FROM + TO.
 *
 * Deliberately separate from saved journeys — "recent" is ephemeral
 * convenience, "saved" is persistent commitment.
 *
 * Usage:
 *   const { recents, addRecent, clearRecents } = useRecentJourneys();
 */

"use client";

import { useCallback } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

const STORAGE_KEY = "oystr-recent-journeys";
const MAX_RECENTS = 5;

export interface RecentJourney {
  fromNaptanId: string;
  fromName: string;
  fromLat: number;
  fromLon: number;
  toNaptanId: string;
  toName: string;
  toLat: number;
  toLon: number;
  /** Unix ms — used for sorting + stamp display */
  at: number;
}

const DEFAULT: RecentJourney[] = [];

export function useRecentJourneys() {
  const [recents, setRecents] = useLocalStorage<RecentJourney[]>(
    STORAGE_KEY,
    DEFAULT
  );

  /**
   * Add (or bump to top) a journey to the recent list. Dedupes by
   * from->to pair, keeps newest first, caps at MAX_RECENTS.
   */
  const addRecent = useCallback(
    (entry: Omit<RecentJourney, "at">) => {
      setRecents((prev) => {
        const filtered = prev.filter(
          (r) =>
            !(
              r.fromNaptanId === entry.fromNaptanId &&
              r.toNaptanId === entry.toNaptanId
            )
        );
        return [{ ...entry, at: Date.now() }, ...filtered].slice(
          0,
          MAX_RECENTS
        );
      });
    },
    [setRecents]
  );

  const clearRecents = useCallback(() => {
    setRecents([]);
  }, [setRecents]);

  return { recents, addRecent, clearRecents };
}
