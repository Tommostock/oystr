/**
 * usePrefetchSaved.ts — Warm SWR cache for saved stations on app load
 *
 * When the user has saved stations, we pre-fetch each one's arrivals
 * in the background shortly after the app mounts. Two wins:
 *
 *   1. Tapping a saved station feels instant — SWR already has the
 *      cached data from this background prefetch.
 *   2. The initial network burst is staggered (100ms between each)
 *      to avoid hammering our TfL proxy all at once.
 *
 * Only runs once per mount. Silently no-ops if nothing is saved.
 */

"use client";

import { useEffect } from "react";
import { preload } from "swr";
import { useFavourites } from "@/hooks/useFavourites";

/**
 * Shared SWR fetcher — matches the fetcher used in useArrivals so
 * the preloaded data ends up at the same key.
 */
async function fetcher(url: string) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export function usePrefetchSaved() {
  const { favourites } = useFavourites();

  useEffect(() => {
    if (favourites.length === 0) return;

    /*
     * Stagger prefetches by 100ms. Avoids a burst of simultaneous
     * requests on app open — the TfL proxy handles them better
     * spread out, and our rate limit stays comfortable.
     */
    const timers: number[] = [];
    favourites.forEach((fav, i) => {
      const t = window.setTimeout(() => {
        preload(`/api/tfl/arrivals?stopId=${fav.naptanId}`, fetcher);
      }, i * 100);
      timers.push(t);
    });

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
    /* We deliberately re-run when favourites change — new saves get
       prefetched automatically. */
  }, [favourites]);
}
