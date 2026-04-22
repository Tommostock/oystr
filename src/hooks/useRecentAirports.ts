/**
 * useRecentAirports.ts — Recently viewed airports, backed by localStorage
 *
 * Stores the last few airports the user has opened on the Flights
 * tab so they can re-select without re-searching. Capped at 5 so
 * the chip strip stays compact on mobile.
 *
 * localStorage rather than Dexie because recents are tiny,
 * ephemeral, and don't benefit from indexes.
 */

"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "oystr-recent-airports";
const MAX_RECENTS = 5;

export interface RecentAirport {
  iata: string;
  name: string;
  addedAt: number;
}

function readFromStorage(): RecentAirport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RecentAirport =>
        e &&
        typeof e.iata === "string" &&
        typeof e.name === "string" &&
        typeof e.addedAt === "number"
    );
  } catch {
    return [];
  }
}

export function useRecentAirports() {
  const [recents, setRecents] = useState<RecentAirport[]>([]);

  /* Load once on mount. */
  useEffect(() => {
    setRecents(readFromStorage());
  }, []);

  /**
   * Record that the user has viewed an airport.
   * - Deduped by IATA (re-selecting bumps it to the top)
   * - Capped at MAX_RECENTS
   * - Persisted synchronously so the chip appears on the very
   *   next render even mid-navigation.
   */
  const addRecent = useCallback((entry: { iata: string; name: string }) => {
    const iata = entry.iata.toUpperCase();
    setRecents((prev) => {
      const filtered = prev.filter((r) => r.iata !== iata);
      const next: RecentAirport[] = [
        { iata, name: entry.name, addedAt: Date.now() },
        ...filtered,
      ].slice(0, MAX_RECENTS);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* Silently ignore quota errors — recents aren't critical */
        }
      }
      return next;
    });
  }, []);

  const removeRecent = useCallback((iata: string) => {
    const target = iata.toUpperCase();
    setRecents((prev) => {
      const next = prev.filter((r) => r.iata !== target);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }, []);

  return { recents, addRecent, removeRecent };
}
