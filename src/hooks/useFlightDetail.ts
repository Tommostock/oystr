/**
 * useFlightDetail.ts — Polling hook for a single flight by number
 *
 * Wraps /api/flights/flight/[number] with SWR. Mirrors the other
 * flight hooks so the detail page behaves consistently: auto-refresh
 * (slow — 2 min, same as boards to respect free-tier quota), graceful
 * handling of the "API key not set" 503, and a dedicated `notFound`
 * flag for when the flight number is well-formed but has no record.
 */

"use client";

import useSWR from "swr";
import { FLIGHT_DEPARTURES_POLL_INTERVAL } from "@/lib/constants";
import type { FlightDetail } from "@/lib/flight-types";

type FlightDetailError = Error & {
  notConfigured?: boolean;
  notFound?: boolean;
  status?: number;
};

/**
 * Fetcher that extracts both `notConfigured` (503) and `notFound`
 * (404) flags from the JSON body so the caller can show the right
 * empty-state chrome.
 */
async function fetcher(url: string): Promise<FlightDetail> {
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
  return response.json();
}

interface UseFlightDetailOptions {
  /** Flight number, e.g. "BA175". Null/undefined disables fetching. */
  flightNumber: string | null | undefined;
}

export function useFlightDetail({ flightNumber }: UseFlightDetailOptions) {
  const key = flightNumber
    ? `/api/flights/flight/${encodeURIComponent(flightNumber.trim().toUpperCase())}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<FlightDetail>(
    key,
    fetcher,
    {
      refreshInterval: FLIGHT_DEPARTURES_POLL_INTERVAL,
      errorRetryCount: 2,
      revalidateOnFocus: true,
      dedupingInterval: 30_000,
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
    refresh: mutate,
  };
}
