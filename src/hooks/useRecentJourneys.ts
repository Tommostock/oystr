/**
 * useRecentJourneys.ts — Track the last few TfL journey searches
 *
 * Stores the most recent 3 journey searches in localStorage so the
 * user can re-run a previous search with one tap instead of
 * re-entering FROM + TO every time. Deliberately kept separate from
 * saved journeys — "recent" is ephemeral convenience, "saved" is
 * persistent commitment.
 *
 * Usage:
 *   const { recents, addRecent, clearRecents } = useRecentJourneys();
 */

"use client";

import { useCallback, useEffect, useState } from "react";

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

function read(): RecentJourney[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: RecentJourney[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export function useRecentJourneys() {
  const [recents, setRecents] = useState<RecentJourney[]>([]);

  /* Hydrate from localStorage on mount (avoids SSR mismatch). */
  useEffect(() => {
    setRecents(read());
  }, []);

  /**
   * Add (or bump to top) a journey to the recent list.
   * Dedupes by from->to pair, keeps newest first, caps at MAX_RECENTS.
   */
  const addRecent = useCallback((entry: Omit<RecentJourney, "at">) => {
    setRecents((prev) => {
      const filtered = prev.filter(
        (r) =>
          !(
            r.fromNaptanId === entry.fromNaptanId &&
            r.toNaptanId === entry.toNaptanId
          )
      );
      const next = [{ ...entry, at: Date.now() }, ...filtered].slice(
        0,
        MAX_RECENTS
      );
      write(next);
      return next;
    });
  }, []);

  const clearRecents = useCallback(() => {
    write([]);
    setRecents([]);
  }, []);

  return { recents, addRecent, clearRecents };
}
