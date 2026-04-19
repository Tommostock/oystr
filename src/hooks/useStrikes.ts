/**
 * useStrikes.ts — Polling hook for strike / industrial action data
 *
 * Fetches upcoming and current strike information from our API route,
 * and automatically re-fetches every 5 minutes (strikes don't change
 * as frequently as live arrivals).
 *
 * Uses SWR for stale-while-revalidate caching.
 *
 * Usage:
 *   const { strikes, isLoading, error } = useStrikes();
 */

"use client";

import useSWR from "swr";
import type { StrikeInfo } from "@/lib/tfl-types";

/**
 * Poll every 30 minutes. Strikes are announced / updated once or twice
 * a day at most — 5 minutes was unnecessarily aggressive and burned
 * through our TfL rate limit when several tabs were open. 30min is
 * a good balance between "fresh" and "quiet".
 */
const STRIKES_POLL_INTERVAL = 30 * 60_000;

/**
 * Simple fetch wrapper that throws on error.
 */
async function fetcher(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

/**
 * Hook to fetch and poll strike / industrial action data.
 */
export function useStrikes() {
  const { data, error, isLoading, mutate } = useSWR<StrikeInfo[]>(
    "/api/tfl/strikes",
    fetcher,
    {
      refreshInterval: STRIKES_POLL_INTERVAL,
      errorRetryCount: 3,
      /*
       * Strikes data doesn't change because the user tabbed away and
       * back. revalidateOnFocus would cause redundant TfL calls —
       * we let refreshInterval handle freshness.
       */
      revalidateOnFocus: false,
      /* Dedupe within 15 minutes — page nav won't re-hit the API */
      dedupingInterval: 15 * 60_000,
    }
  );

  return {
    /** Array of strike information objects */
    strikes: data || [],
    /** True during the initial load (no cached data yet) */
    isLoading,
    /** Error object if the fetch failed */
    error,
    /** Call this to manually trigger a refresh */
    refresh: mutate,
  };
}
