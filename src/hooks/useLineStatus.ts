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
      /* Re-fetch every 60 seconds */
      refreshInterval: LINE_STATUS_POLL_INTERVAL,
      /* Don't retry too aggressively on errors */
      errorRetryCount: 3,
      /* Keep showing old data while fetching new data */
      revalidateOnFocus: true,
      /* Deduplicate requests within 30 seconds */
      dedupingInterval: 30_000,
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
