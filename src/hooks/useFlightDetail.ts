/**
 * useFlightDetail.ts — Polling hook for a single flight by number
 *
 * Wraps /api/flights/flight/[number] with SWR. Mirrors the other
 * flight hooks so the detail page behaves consistently: slow
 * auto-refresh (10 min), graceful handling of the "API key not set"
 * 503, and a dedicated `notFound` flag for when the flight number
 * is well-formed but has no record.
 *
 * The SWR config is deliberately budget-conscious (no focus /
 * reconnect revalidate, paused when tab hidden, 5-min dedup) so
 * the AeroDataBox free-tier 150-req/mo quota isn't shredded by
 * routine navigation.
 */

"use client";

import useSWR from "swr";
import { FLIGHT_DEPARTURES_POLL_INTERVAL } from "@/lib/constants";
import {
  recordFlightRequest,
  isQuotaExhausted,
} from "@/lib/flight-quota";
import type { FlightDetail } from "@/lib/flight-types";

type FlightDetailError = Error & {
  notConfigured?: boolean;
  notFound?: boolean;
  quotaExhausted?: boolean;
  status?: number;
};

/**
 * Fetcher that extracts both `notConfigured` (503) and `notFound`
 * (404) flags from the JSON body so the caller can show the right
 * empty-state chrome. Also short-circuits when the local quota
 * counter has hit its hard-stop so we don't waste the last few
 * monthly requests on background polls.
 */
async function fetcher(url: string): Promise<FlightDetail> {
  if (isQuotaExhausted()) {
    const err = new Error("Flights monthly quota exhausted") as FlightDetailError;
    err.quotaExhausted = true;
    throw err;
  }
  const response = await fetch(url);
  if (!response.ok) {
    let notConfigured = false;
    let notFound = false;
    try {
      const body = await response.json();
      notConfigured = !!body?.notConfigured;
      notFound = !!body?.notFound;
    } catch {
      /* Silently ignore body-parse failures */
    }
    const err = new Error(`Flight detail error ${response.status}`) as FlightDetailError;
    err.notConfigured = notConfigured;
    err.notFound = notFound;
    err.status = response.status;
    throw err;
  }
  recordFlightRequest();
  return response.json();
}

interface UseFlightDetailOptions {
  /** Flight number, e.g. "BA175". Null/undefined disables fetching. */
  flightNumber: string | null | undefined;
  /**
   * When true, fetch once per mount and don't poll. Callers with
   * their own "is it worth polling right now?" logic (e.g. the
   * TodaysFlightHero, which only polls within 4h of departure)
   * toggle this to pause the interval without unmounting the hook.
   */
  pollingDisabled?: boolean;
}

export function useFlightDetail({
  flightNumber,
  pollingDisabled = false,
}: UseFlightDetailOptions) {
  const key = flightNumber
    ? `/api/flights/flight/${encodeURIComponent(flightNumber.trim().toUpperCase())}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<FlightDetail>(
    key,
    fetcher,
    {
      refreshInterval: pollingDisabled ? 0 : FLIGHT_DEPARTURES_POLL_INTERVAL,
      errorRetryCount: 2,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      dedupingInterval: 5 * 60_000,
      /*
       * Don't retry on a 404 — the flight number was well-formed
       * but doesn't exist. Retrying wastes free-tier quota.
       */
      shouldRetryOnError: (err: FlightDetailError) =>
        !err?.notFound && !err?.notConfigured,
    }
  );

  const typedError = error as FlightDetailError | undefined;

  return {
    flight: data ?? null,
    isLoading,
    error: typedError ?? null,
    notConfigured: !!typedError?.notConfigured,
    notFound: !!typedError?.notFound,
    quotaExhausted: !!typedError?.quotaExhausted,
    refresh: mutate,
  };
}
