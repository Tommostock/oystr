/**
 * useLineStatus.ts — Polling hook for line status data
 *
 * Fetches the current status of all TfL lines from our API route,
 * and automatically re-fetches every 60 seconds.
 *
 * Uses SWR for stale-while-revalidate caching.
 *
 * Usage:
 *   const { lines, isLoading, error } = useLineStatus();
 */

"use client";

import useSWR from "swr";
import { LINE_STATUS_POLL_INTERVAL } from "@/lib/constants";
import type { LineStatus } from "@/lib/tfl-types";

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
 * Hook to fetch and poll live line status data.
 */
export function useLineStatus() {
  const { data, error, isLoading, mutate } = useSWR<LineStatus[]>(
    "/api/tfl/status",
    fetcher,
    {
      refreshInterval: LINE_STATUS_POLL_INTERVAL,
      errorRetryCount: 3,
      /*
       * Line status changes slowly (TfL itself only refreshes every
       * ~60s) so a focus-triggered refetch just burns the rate limit.
       * Stick with the poll cadence — throttle focus refetches
       * aggressively as a compromise.
       */
      revalidateOnFocus: false,
      focusThrottleInterval: 60_000,
      /* Dedupe within 60s so rapid tab switches don't re-hit the API */
      dedupingInterval: 60_000,
    }
  );

  return {
    /** Array of line status objects */
    lines: data || [],
    /** True during the initial load (no cached data yet) */
    isLoading,
    /** Error object if the fetch failed */
    error,
    /** Call this to manually trigger a refresh */
    refresh: mutate,
  };
}
