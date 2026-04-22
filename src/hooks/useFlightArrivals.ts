/**
 * useFlightArrivals.ts — Polling hook for live airport arrival boards
 *
 * Mirror of useFlightDepartures for inbound flights. Shares the same
 * 2-minute poll interval to keep free-tier request budgets in check.
 */

"use client";

import useSWR from "swr";
import { FLIGHT_DEPARTURES_POLL_INTERVAL } from "@/lib/constants";
import type { FlightArrival } from "@/lib/flight-types";

async function fetcher(url: string): Promise<FlightArrival[]> {
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
  return response.json();
}

interface UseFlightArrivalsOptions {
  iata: string | null | undefined;
  numRows?: number;
}

export function useFlightArrivals({
  iata,
  numRows = 15,
}: UseFlightArrivalsOptions) {
  const key = iata
    ? `/api/flights/arrivals?iata=${iata.toUpperCase()}&numRows=${numRows}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<FlightArrival[]>(
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
    arrivals: data || [],
    isLoading,
    error: error || null,
    notConfigured,
    refresh: mutate,
  };
}
