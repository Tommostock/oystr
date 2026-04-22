/**
 * API Route: /api/flights/arrivals
 *
 * Proxy for inbound flights to a given airport. Shape-only scaffold;
 * the upstream provider is not wired up yet (awaiting the API key).
 *
 * Once FLIGHTS_API_KEY is in env, fill in fetchUpstreamArrivals()
 * to call the provider's arrivals endpoint and return normalised
 * FlightArrival[] rows — exactly how the departures route works.
 *
 * Query params:
 *   ?iata=LHR       — 3-letter IATA (REQUIRED)
 *   ?numRows=15     — optional, default 15, max 50
 *
 * Returns:
 *   200 Array<FlightArrival>
 *   400 { error }                            — missing / invalid iata
 *   503 { error, notConfigured: true }       — API key not set
 *   502/500 { error }                        — upstream failure
 */

import { NextRequest, NextResponse } from "next/server";
import type { FlightArrival } from "@/lib/flight-types";

const FLIGHTS_API_KEY_ENV = "FLIGHTS_API_KEY";

/**
 * Upstream fetch stub — mirrors the departures stub.
 *
 * TODO when the provider is chosen + key lands:
 *   1. Call the provider's arrivals endpoint for `iata`
 *   2. Cache server-side for 60-120s (free-tier hygiene)
 *   3. Normalise each upstream record into FlightArrival — map
 *      status strings like "Expected" / "Landed" / "Delayed" /
 *      "Cancelled" / "Diverted" onto our FlightStatus enum
 *   4. Sort by scheduled arrival ascending
 *   5. Return the top `numRows` rows
 */
async function fetchUpstreamArrivals(
  _iata: string,
  _numRows: number,
  _apiKey: string
): Promise<FlightArrival[]> {
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

  if (!/^[A-Z]{3}$/.test(iata)) {
    return NextResponse.json(
      { error: `Invalid IATA code: ${iata}` },
      { status: 400 }
    );
  }

  let numRows = 15;
  if (numRowsRaw) {
    const parsed = parseInt(numRowsRaw, 10);
    if (!Number.isNaN(parsed)) {
      numRows = Math.max(1, Math.min(50, parsed));
    }
  }

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
    const arrivals = await fetchUpstreamArrivals(iata, numRows, apiKey);
    return NextResponse.json(arrivals);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown upstream error";
    if (message === "UPSTREAM_NOT_IMPLEMENTED") {
      return NextResponse.json(
        {
          error: "Flight service not configured",
          notConfigured: true,
        },
        { status: 503 }
      );
    }
    console.error("Flight arrivals error:", error);
    return NextResponse.json(
      { error: "Failed to fetch flight arrivals" },
      { status: 500 }
    );
  }
}
