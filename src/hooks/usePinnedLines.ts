/**
 * usePinnedLines.ts — Starred lines on the Status tab
 *
 * Persists a simple array of line IDs in localStorage via the
 * useLocalStorage SSR-safe wrapper. Users pin favourite lines so
 * they float to the top of the status board.
 *
 * Usage:
 *   const { pinnedIds, isPinned, togglePin } = usePinnedLines();
 */

"use client";

import { useCallback } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

const STORAGE_KEY = "oystr-pinned-lines";
const DEFAULT: string[] = [];

export function usePinnedLines() {
  const [pinnedIds, setPinnedIds] = useLocalStorage<string[]>(
    STORAGE_KEY,
    DEFAULT
  );

  const isPinned = useCallback(
    (lineId: string) => pinnedIds.includes(lineId),
    [pinnedIds]
  );

  const togglePin = useCallback(
    (lineId: string) => {
      setPinnedIds((prev) =>
        prev.includes(lineId)
          ? prev.filter((id) => id !== lineId)
          : [...prev, lineId]
      );
    },
    [setPinnedIds]
  );

  return { pinnedIds, isPinned, togglePin };
}
