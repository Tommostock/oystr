/**
 * useFlightDepartures.ts — Polling hook for live airport departure boards
 *
 * Wraps /api/flights/departures with SWR. Mirrors useRailDepartures so
 * the Flights tab behaves consistently: auto-refresh, graceful handling
 * of the "API key not set yet" state via a `notConfigured` flag, and
 * deduping across components that ask for the same airport.
 *
 * Polls every FLIGHT_DEPARTURES_POLL_INTERVAL (10 min) — deliberately
 * slow to stay inside the AeroDataBox free-tier 150 requests/month
 * quota. Tab-focus + background-tab re-fetching are disabled for the
 * same reason. See constants.ts for the full rationale.
 */

"use client";

import useSWR from "swr";
import { FLIGHT_DEPARTURES_POLL_INTERVAL } from "@/lib/constants";
import {
  recordFlightRequest,
  isQuotaExhausted,
} from "@/lib/flight-quota";
import type { FlightDeparture } from "@/lib/flight-types";

/**
 * SWR fetcher that distinguishes a "not configured" 503 from other
 * errors by reading the JSON body's `notConfigured` flag. The caller
 * can branch on that flag to show a friendly setup message instead
 * of generic error chrome.
 */
async function fetcher(url: string): Promise<FlightDeparture[]> {
  /*
   * Hard-stop at the local quota counter's limit — we'd rather
   * surface a "quota exhausted" error than burn the single remaining
   * request that keeps other features (tracked flight, airport
   * lookup) working. The counter is best-effort (localStorage,
   * incremented on every success) but it beats learning the hard
   * way when AeroDataBox returns 429 or a zero-balance email arrives.
   */
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
      /* Silently ignore body-parse failures */
    }
    const err = new Error(`Flights API error ${response.status}`);
    (err as Error & { notConfigured?: boolean }).notConfigured = notConfigured;
    throw err;
  }
  // Count successful fetches only — errors don't consume the AeroDataBox
  // quota (well, technically they do, but counting them makes our
  // estimate drift high and stops polling prematurely).
  recordFlightRequest();
  return response.json();
}

interface UseFlightDeparturesOptions {
  /** 3-letter IATA code (e.g. "LHR"). Null/undefined disables fetching. */
  iata: string | null | undefined;
  /** Number of rows to request (default 15). */
  numRows?: number;
  /**
   * When true, don't poll on an interval — fetch once per mount and
   * only refresh on an explicit `refresh()` call (e.g. pull-to-
   * refresh). Used by SavedAirportLiveCard which would otherwise
   * burn quota updating cards the user isn't looking at.
   */
  pollingDisabled?: boolean;
}

export function useFlightDepartures({
  iata,
  numRows = 15,
  pollingDisabled = false,
}: UseFlightDeparturesOptions) {
  const key = iata
    ? `/api/flights/departures?iata=${iata.toUpperCase()}&numRows=${numRows}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<FlightDeparture[]>(
    key,
    fetcher,
    {
      refreshInterval: pollingDisabled ? 0 : FLIGHT_DEPARTURES_POLL_INTERVAL,
      errorRetryCount: 2,
      /*
       * Explicitly avoid the default revalidate-on-* triggers — each
       * one is a potential extra API call that adds up fast against
       * our 150/mo budget. Dedup window is long so rapid re-mounts
       * (e.g. navigating away + back) share a single response.
       */
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      dedupingInterval: 5 * 60_000, // 5 min
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
