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

/** Poll every 5 minutes — strike info doesn't change rapidly */
const STRIKES_POLL_INTERVAL = 300_000;

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
      /* Re-fetch every 5 minutes */
      refreshInterval: STRIKES_POLL_INTERVAL,
      /* Don't retry too aggressively on errors */
      errorRetryCount: 3,
      /* Keep showing old data while fetching new data */
      revalidateOnFocus: true,
      /* Deduplicate requests within 60 seconds */
      dedupingInterval: 60_000,
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
