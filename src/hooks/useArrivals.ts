/**
 * useArrivals.ts — Polling hook for live arrival data
 *
 * Fetches arrival predictions for a station from our API route,
 * and automatically re-fetches every 30 seconds to keep the
 * departure board up to date.
 *
 * Uses SWR (stale-while-revalidate) which means:
 *   1. Show cached data immediately (stale)
 *   2. Fetch fresh data in the background (revalidate)
 *   3. Update the UI when fresh data arrives
 *
 * Usage:
 *   const { arrivals, isLoading, error } = useArrivals("940GZZLUMLE");
 */

"use client";

import useSWR from "swr";
import { ARRIVALS_POLL_INTERVAL } from "@/lib/constants";
import type { ArrivalPrediction } from "@/lib/tfl-types";

/**
 * Simple fetch wrapper that throws on error.
 * SWR uses this to know when a request has failed.
 */
async function fetcher(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

/**
 * Hook to fetch and poll live arrivals for a station.
 *
 * @param stopId - The station's Naptan ID (e.g. "940GZZLUMLE")
 *                 Pass null/undefined to disable fetching.
 */
export function useArrivals(stopId: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR<ArrivalPrediction[]>(
    /* Only fetch if we have a station ID — SWR skips null keys */
    stopId ? `/api/tfl/arrivals?stopId=${stopId}` : null,
    fetcher,
    {
      /* Re-fetch every 30 seconds to keep data fresh */
      refreshInterval: ARRIVALS_POLL_INTERVAL,
      /* Don't retry too aggressively on errors */
      errorRetryCount: 3,
      /* Keep showing old data while fetching new data */
      revalidateOnFocus: true,
      /* Deduplicate requests within 10 seconds */
      dedupingInterval: 10_000,
    }
  );

  return {
    /** Array of arrival predictions, sorted by time */
    arrivals: data || [],
    /** True during the initial load (no cached data yet) */
    isLoading,
    /** Error object if the fetch failed */
    error,
    /** Call this to manually trigger a refresh */
    refresh: mutate,
  };
}
