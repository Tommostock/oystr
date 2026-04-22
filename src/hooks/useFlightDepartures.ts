/**
 * useFlightDepartures.ts — Polling hook for live airport departure boards
 *
 * Wraps /api/flights/departures with SWR. Mirrors useRailDepartures so
 * the Flights tab behaves consistently: auto-refresh, graceful handling
 * of the "API key not set yet" state via a `notConfigured` flag, and
 * deduping across components that ask for the same airport.
 *
 * Polls every FLIGHT_DEPARTURES_POLL_INTERVAL (2 min) — deliberately
 * slower than rail to stay inside free-tier monthly quotas.
 */

"use client";

import useSWR from "swr";
import { FLIGHT_DEPARTURES_POLL_INTERVAL } from "@/lib/constants";
import type { FlightDeparture } from "@/lib/flight-types";

/**
 * SWR fetcher that distinguishes a "not configured" 503 from other
 * errors by reading the JSON body's `notConfigured` flag. The caller
 * can branch on that flag to show a friendly setup message instead
 * of generic error chrome.
 */
async function fetcher(url: string): Promise<FlightDeparture[]> {
  const response = await fetch(url);
  if (!response.ok) {
    let notConfigured = false;
    try {
      const body = await response.json();
      notConfigured = !!body?.notConfigured;
    } catch {
      /* Silently ignore body-parse failures */
    }
    const err = new Error(`Flights API error ${response.status}`);
    (err as Error & { notConfigured?: boolean }).notConfigured = notConfigured;
    throw err;
  }
  return response.json();
}

interface UseFlightDeparturesOptions {
  /** 3-letter IATA code (e.g. "LHR"). Null/undefined disables fetching. */
  iata: string | null | undefined;
  /** Number of rows to request (default 15). */
  numRows?: number;
}

export function useFlightDepartures({
  iata,
  numRows = 15,
}: UseFlightDeparturesOptions) {
  const key = iata
    ? `/api/flights/departures?iata=${iata.toUpperCase()}&numRows=${numRows}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<FlightDeparture[]>(
    key,
    fetcher,
    {
      refreshInterval: FLIGHT_DEPARTURES_POLL_INTERVAL,
      errorRetryCount: 3,
      revalidateOnFocus: true,
      dedupingInterval: 30_000,
    }
  );

  const notConfigured =
    !!(error as Error & { notConfigured?: boolean })?.notConfigured;

  return {
    departures: data || [],
    isLoading,
    error: error || null,
    notConfigured,
    refresh: mutate,
  };
}
