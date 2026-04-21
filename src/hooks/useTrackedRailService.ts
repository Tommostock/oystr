/**
 * useTrackedRailService.ts — Polling hook for a specific tracked rail service
 *
 * Wraps /api/rail/tracked — which finds a service by (fromCrs, toCrs,
 * scheduledDeparture) on the DESTINATION's arrivals board. This works
 * for services both before and after they leave their origin station,
 * so TrackedJourneyCard can show live data throughout a journey —
 * including ones the user boarded hours ago.
 *
 * Returns { departure, isLoading, notConfigured }.
 * Null fromCrs/toCrs/scheduledDeparture disables fetching entirely.
 */

"use client";

import useSWR from "swr";
import { RAIL_DEPARTURES_POLL_INTERVAL } from "@/lib/constants";
import type { RailDeparture } from "@/lib/rail-types";

interface TrackedResponse {
  found: boolean;
  departure?: RailDeparture;
}

async function fetcher(url: string): Promise<TrackedResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    let notConfigured = false;
    try {
      const body = await response.json();
      notConfigured = !!body?.notConfigured;
    } catch {
      /* ignore */
    }
    const err = new Error(`Rail tracked error ${response.status}`);
    (err as Error & { notConfigured?: boolean }).notConfigured = notConfigured;
    throw err;
  }
  return response.json();
}

interface Options {
  fromCrs: string | null | undefined;
  toCrs: string | null | undefined;
  scheduledDeparture: string | null | undefined;
  /**
   * When false, the hook won't poll. Used to skip network on travel
   * days that are still in the future (live data won't exist yet).
   */
  enabled?: boolean;
}

export function useTrackedRailService({
  fromCrs,
  toCrs,
  scheduledDeparture,
  enabled = true,
}: Options) {
  const key =
    enabled && fromCrs && toCrs && scheduledDeparture
      ? `/api/rail/tracked?fromCrs=${fromCrs}&toCrs=${toCrs}&scheduledDeparture=${encodeURIComponent(scheduledDeparture)}`
      : null;

  const { data, error, isLoading, mutate } = useSWR<TrackedResponse>(
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
    departure: data?.found ? data.departure ?? null : null,
    isLoading,
    error: error || null,
    notConfigured,
    refresh: mutate,
  };
}
