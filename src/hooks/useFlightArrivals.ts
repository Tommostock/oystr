/**
 * useFlightArrivals.ts — Polling hook for live airport arrival boards
 *
 * Mirror of useFlightDepartures for inbound flights. Shares the same
 * aggressive-quota-hygiene SWR config (10-minute poll, no focus
 * revalidate, paused when tab is hidden, 5-min dedup) so the free-
 * tier AeroDataBox budget isn't drained by background tabs.
 */

"use client";

import useSWR from "swr";
import { FLIGHT_DEPARTURES_POLL_INTERVAL } from "@/lib/constants";
import {
  recordFlightRequest,
  isQuotaExhausted,
} from "@/lib/flight-quota";
import type { FlightArrival } from "@/lib/flight-types";

async function fetcher(url: string): Promise<FlightArrival[]> {
  if (isQuotaExhausted()) {
    const err = new Error("Flights monthly quota exhausted") as Error & {
      quotaExhausted?: boolean;
    };
    err.quotaExhausted = true;
    throw err;
  }
  const response = await fetch(url);
  if (!response.ok) {
    let notConfigured = false;
    try {
      const body = await response.json();
      notConfigured = !!body?.notConfigured;
    } catch {
      /* ignore body-parse failures */
    }
    const err = new Error(`Flights API error ${response.status}`);
    (err as Error & { notConfigured?: boolean }).notConfigured = notConfigured;
    throw err;
  }
  recordFlightRequest();
  return response.json();
}

interface UseFlightArrivalsOptions {
  iata: string | null | undefined;
  numRows?: number;
  /** When true, fetch once and never auto-refresh. */
  pollingDisabled?: boolean;
}

export function useFlightArrivals({
  iata,
  numRows = 15,
  pollingDisabled = false,
}: UseFlightArrivalsOptions) {
  const key = iata
    ? `/api/flights/arrivals?iata=${iata.toUpperCase()}&numRows=${numRows}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<FlightArrival[]>(
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
    }
  );

  const notConfigured =
    !!(error as Error & { notConfigured?: boolean })?.notConfigured;

  return {
    arrivals: data || [],
    isLoading,
    error: error || null,
    notConfigured,
    refresh: mutate,
  };
}
