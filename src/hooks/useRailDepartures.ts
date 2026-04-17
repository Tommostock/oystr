/**
 * useRailDepartures.ts — Polling hook for live National Rail departures
 *
 * Fetches live rail departures from our /api/rail/departures proxy route
 * and automatically re-fetches every 30 seconds.
 *
 * Mirrors the useArrivals hook pattern (SWR-based) so behaviour is
 * consistent across TfL and National Rail data.
 *
 * Usage:
 *   const { departures, isLoading, error, notConfigured } =
 *     useRailDepartures({ fromCrs: "KGX", toCrs: "LDS", numRows: 10 });
 */

"use client";

import useSWR from "swr";
import { RAIL_DEPARTURES_POLL_INTERVAL } from "@/lib/constants";
import type { RailDeparture } from "@/lib/rail-types";

/**
 * SWR fetcher that distinguishes a "not configured" 503 from other errors
 * by parsing the JSON body. Lets the UI show a friendly message when
 * RDM_API_KEY is missing in the environment.
 */
async function fetcher(url: string): Promise<RailDeparture[]> {
  const response = await fetch(url);

  if (!response.ok) {
    /* Try to parse the error body so we can surface notConfigured */
    let notConfigured = false;
    try {
      const body = await response.json();
      notConfigured = !!body?.notConfigured;
    } catch {
      /* Ignore parse errors */
    }
    const err = new Error(`Rail API error ${response.status}`);
    /* Tag the error so consumers can branch on it */
    (err as Error & { notConfigured?: boolean }).notConfigured = notConfigured;
    throw err;
  }

  return response.json();
}

interface UseRailDeparturesOptions {
  /** Origin CRS code (e.g. "KGX"). Pass null/undefined to disable fetching. */
  fromCrs: string | null | undefined;
  /** Optional destination CRS filter (e.g. "LDS") */
  toCrs?: string | null;
  /** Number of rows to request (default 10) */
  numRows?: number;
}

/**
 * Hook to fetch + poll live rail departures.
 *
 * When `fromCrs` is null/undefined the hook returns an empty state
 * without making a network request.
 */
export function useRailDepartures({
  fromCrs,
  toCrs,
  numRows = 10,
}: UseRailDeparturesOptions) {
  /* Build the SWR key — null disables fetching entirely */
  const key = fromCrs
    ? `/api/rail/departures?crs=${fromCrs}${
        toCrs ? `&filterCrs=${toCrs}` : ""
      }&numRows=${numRows}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<RailDeparture[]>(
    key,
    fetcher,
    {
      refreshInterval: RAIL_DEPARTURES_POLL_INTERVAL,
      errorRetryCount: 3,
      revalidateOnFocus: true,
      dedupingInterval: 10_000,
    }
  );

  const notConfigured =
    !!(error as Error & { notConfigured?: boolean })?.notConfigured;

  return {
    /** Array of departures, sorted by scheduled departure time */
    departures: data || [],
    /** True during the initial load (no cached data yet) */
    isLoading,
    /** Error object if the fetch failed (null on success) */
    error: error || null,
    /** True when the server returned 503 with notConfigured flag */
    notConfigured,
    /** Call to manually refresh */
    refresh: mutate,
  };
}
