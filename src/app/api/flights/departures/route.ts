/**
 * API Route: /api/flights/departures
 *
 * Proxies live flight departure requests to a third-party aviation
 * data provider. Shape-only scaffold for now — the provider is not
 * wired up yet (awaiting the API key).
 *
 * Once a FLIGHTS_API_KEY (or equivalent) is available in env, fill
 * in the upstream fetch inside `fetchUpstreamDepartures` and return
 * the normalised departures array.
 *
 * Query params:
 *   ?iata=LHR       — 3-letter IATA code of the airport (REQUIRED)
 *   ?numRows=15     — optional: number of rows to return (default 15, max 50)
 *
 * Returns:
 *   200 Array<FlightDeparture>               — sorted by scheduled time ASC
 *   400 { error }                            — missing / invalid iata
 *   503 { error, notConfigured: true }       — API key not set yet
 *   502/500 { error }                        — upstream failure
 *
 * The notConfigured response matches the Rail API pattern so the
 * client hook + UI can show "AWAITING API KEY" rather than a
 * generic error while we're still setting up.
 */

import { NextRequest, NextResponse } from "next/server";
import type { FlightDeparture } from "@/lib/flight-types";

/*
 * Env var name for the flights provider key.
 *
 * Kept as a single name so there is ONE place to change when we
 * pick a provider (AeroDataBox, AviationStack, etc). The proxy
 * never needs to know which provider it is — the upstream fetch
 * function below is the only thing that cares.
 */
const FLIGHTS_API_KEY_ENV = "FLIGHTS_API_KEY";

/**
 * Upstream fetch stub.
 *
 * TODO: wire up the real provider once the API key is available.
 * When it is, this function should:
 *   1. Call the provider's "departures at airport X" endpoint
 *   2. Cache the response server-side for 60–120s to respect free-
 *      tier rate limits (use Next's `next: { revalidate: 90 }` or
 *      unstable_cache for a keyed cache)
 *   3. Normalise each upstream flight record into FlightDeparture
 *   4. Sort by scheduled time ascending
 *   5. Return the top `numRows` rows
 *
 * The rest of the route (validation, notConfigured handling, error
 * envelope) is already in place — adding the provider only needs
 * this function body filled in.
 */
async function fetchUpstreamDepartures(
  _iata: string,
  _numRows: number,
  _apiKey: string
): Promise<FlightDeparture[]> {
  /* Deliberately unimplemented until the key lands. */
  throw new Error("UPSTREAM_NOT_IMPLEMENTED");
}

export async function GET(request: NextRequest) {
  const rawIata = request.nextUrl.searchParams.get("iata");
  const numRowsRaw = request.nextUrl.searchParams.get("numRows");

  if (!rawIata) {
    return NextResponse.json(
      { error: "iata query parameter is required" },
      { status: 400 }
    );
  }

  const iata = rawIata.trim().toUpperCase();

  /*
   * Validate the IATA format only — 3 uppercase letters. We
   * deliberately do NOT limit to a known airport list: the Flights
   * tab is designed to work for any airport worldwide (Rome,
   * Edinburgh, JFK, etc.), and the upstream provider is the source
   * of truth for whether a given airport is covered. Cheap regex
   * check still catches typos like "lhrx" or "1HR".
   */
  if (!/^[A-Z]{3}$/.test(iata)) {
    return NextResponse.json(
      { error: `Invalid IATA code: ${iata}` },
      { status: 400 }
    );
  }

  /* Clamp the caller-requested row count to 1-50 (default 15). */
  let numRows = 15;
  if (numRowsRaw) {
    const parsed = parseInt(numRowsRaw, 10);
    if (!Number.isNaN(parsed)) {
      numRows = Math.max(1, Math.min(50, parsed));
    }
  }

  /*
   * Graceful degradation: API key missing in env — return 503 with
   * a notConfigured flag so the UI shows the "awaiting API key"
   * state rather than crashing.
   */
  const apiKey = process.env[FLIGHTS_API_KEY_ENV];
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Flight service not configured",
        notConfigured: true,
      },
      { status: 503 }
    );
  }

  try {
    const departures = await fetchUpstreamDepartures(iata, numRows, apiKey);
    return NextResponse.json(departures);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown upstream error";
    /*
     * During the scaffold phase the stub throws
     * UPSTREAM_NOT_IMPLEMENTED — surface it as notConfigured too,
     * so enabling the feature is a single key-swap + stub-fill.
     */
    if (message === "UPSTREAM_NOT_IMPLEMENTED") {
      return NextResponse.json(
        {
          error: "Flight service not configured",
          notConfigured: true,
        },
        { status: 503 }
      );
    }
    console.error("Flight departures error:", error);
    return NextResponse.json(
      { error: "Failed to fetch flight departures" },
      { status: 500 }
    );
  }
}
