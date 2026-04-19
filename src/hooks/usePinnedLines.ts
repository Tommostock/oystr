/**
 * usePinnedLines.ts — Hook for managing pinned (starred) lines on the Status tab
 *
 * Users who only care about a couple of lines can pin them so they
 * always float to the top of the status board. Persistence uses
 * localStorage — simple, synchronous, survives reloads, doesn't need
 * a Dexie schema bump for a tiny feature.
 *
 * Usage:
 *   const { pinnedIds, isPinned, togglePin } = usePinnedLines();
 */

"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "oystr-pinned-lines";

/**
 * Read the saved pin list from localStorage.
 * Silently returns an empty array on any error (SSR, disabled
 * storage, malformed JSON).
 */
function readPinned(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Persist the pin list. No-ops silently on any error.
 */
function writePinned(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* Silently ignore quota errors, private-mode, etc. */
  }
}

export function usePinnedLines() {
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  /*
   * Rehydrate from localStorage on mount. We deliberately keep the
   * initial state empty to avoid SSR hydration mismatches — the
   * server has no localStorage, so the first client render must
   * match with an empty array, then we hydrate in an effect.
   */
  useEffect(() => {
    setPinnedIds(readPinned());
  }, []);

  const isPinned = useCallback(
    (lineId: string) => pinnedIds.includes(lineId),
    [pinnedIds]
  );

  const togglePin = useCallback((lineId: string) => {
    setPinnedIds((prev) => {
      const next = prev.includes(lineId)
        ? prev.filter((id) => id !== lineId)
        : [...prev, lineId];
      writePinned(next);
      return next;
    });
  }, []);

  return { pinnedIds, isPinned, togglePin };
}
