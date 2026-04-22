/**
 * API Route: /api/flights/arrivals
 *
 * Proxies live arrival data from AeroDataBox (via RapidAPI) for a
 * given airport IATA code. Normalises the upstream response into the
 * app's FlightArrival shape.
 *
 * Query params:
 *   ?iata=LHR       — 3-letter IATA code of the airport (REQUIRED)
 *   ?numRows=15     — number of rows to return (default 15, max 50)
 *
 * Returns:
 *   200 Array<FlightArrival>
 *   400 { error }                            — missing / invalid iata
 *   503 { error, notConfigured: true }       — FLIGHTS_API_KEY not set
 *   502/500 { error }                        — upstream failure
 */

import { NextRequest, NextResponse } from "next/server";
import type { FlightArrival, FlightStatus } from "@/lib/flight-types";
import { getAirportByIata } from "@/lib/airports";

const FLIGHTS_API_KEY_ENV = "FLIGHTS_API_KEY";
const AERODATABOX_HOST = "aerodatabox.p.rapidapi.com";

/* ----------------------------------------
 * Helpers (mirrors departures route)
 * -------------------------------------- */

function formatAeroDateTime(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

function extractTime(localStr: string | undefined | null): string | null {
  if (!localStr) return null;
  const match = localStr.match(/\d{4}-\d{2}-\d{2}[\sT](\d{2}:\d{2})/);
  return match ? match[1] : null;
}

function mapStatus(raw: string | undefined | null): FlightStatus {
  switch (raw) {
    case "Expected":        return "expected";
    case "EnRoute":         return "scheduled";
    case "Approaching":     return "expected";
    case "Landed":          return "landed";
    case "Arrived":         return "landed";
    case "Boarding":        return "boarding";
    case "GateClosed":      return "gate-closed";
    case "Departed":        return "departed";
    case "Delayed":         return "delayed";
    case "CheckIn":         return "on-time";
    case "Cancelled":
    case "CanceledUncertain": return "cancelled";
    case "Diverted":        return "diverted";
    default:                return "scheduled";
  }
}

/**
 * Build the best disambiguated airport display string for a board row.
 *
 * Order of preference:
 *   1. Curated bundled-list name — "London Gatwick" / "Paris Charles
 *      de Gaulle" — for the ~150 airports we care about most.
 *   2. Combined upstream city + name.
 *   3. Raw city / IATA fallback.
 */
function buildAirportDisplay(
  city: string | undefined | null,
  name: string | undefined | null,
  iata: string | undefined | null
): string {
  if (iata) {
    const bundled = getAirportByIata(iata);
    if (bundled) {
      const c = bundled.city?.trim();
      const n = bundled.name.trim();
      if (!c || c.toLowerCase() === n.toLowerCase()) return n;
      if (n.toLowerCase().startsWith(c.toLowerCase())) return n;
      return `${c} ${n}`;
    }
  }
  const c = city?.trim();
  const n = name?.trim();
  if (c && n) {
    if (c.toLowerCase() === n.toLowerCase()) return c;
    if (n.toLowerCase().startsWith(c.toLowerCase())) return n;
    return `${c} ${n}`;
  }
  return c || n || iata || "Unknown";
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Normalise a single AeroDataBox arrival item into a FlightArrival.
 *
 * For arrivals the `movement` block describes the ORIGIN airport
 * (where the flight is coming FROM), not the destination.
 */
function normaliseArrival(item: any): FlightArrival {
  const movement = item.movement ?? {};
  const originAirport = movement.airport ?? {};
  const airline = item.airline ?? {};
  const aircraft = item.aircraft ?? {};
  const scheduledLocal = extractTime(movement.scheduledTime?.local);
  const revisedLocal   = extractTime(movement.revisedTime?.local);

  const status = mapStatus(item.status);

  const estimatedArrival =
    revisedLocal && revisedLocal !== scheduledLocal ? revisedLocal : null;

  const origin = buildAirportDisplay(
    originAirport.municipalityName,
    originAirport.shortName ?? originAirport.name,
    originAirport.iata
  );

  return {
    id: item.number ?? "UNKNOWN",
    airline: airline.name ?? "Unknown Airline",
    airlineCode: airline.iata ?? "??",
    flightNumber: item.number ?? "UNKNOWN",
    scheduledArrival: scheduledLocal ?? "N/A",
    estimatedArrival,
    originIata: originAirport.iata ?? "???",
    origin,
    terminal: movement.terminal ?? null,
    gate: movement.gate ?? null,
    // AeroDataBox does not expose baggage belt on the FIDS endpoint
    baggageBelt: null,
    status,
    cancelled: status === "cancelled",
    aircraftModel: aircraft.model,
    aircraftRegistration: aircraft.registration,
  };
}

/* ----------------------------------------
 * Upstream fetch
 * -------------------------------------- */

async function fetchUpstreamArrivals(
  iata: string,
  numRows: number,
  apiKey: string
): Promise<FlightArrival[]> {
  const now = new Date();
  const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);

  const from = formatAeroDateTime(now);
  const to   = formatAeroDateTime(sixHoursLater);

  const url = new URL(
    `https://${AERODATABOX_HOST}/flights/airports/iata/${iata}/${from}/${to}`
  );
  url.searchParams.set("direction", "Arrival");
  // Only show the operating airline's row to avoid duplicate
  // codeshare entries (one flight can appear under 3-4 airline codes)
  url.searchParams.set("withCodeshared", "false");
  url.searchParams.set("withCargo", "false");
  url.searchParams.set("withPrivate", "false");
  url.searchParams.set("withLocation", "false");

  const res = await fetch(url.toString(), {
    headers: {
      "x-rapidapi-host": AERODATABOX_HOST,
      "x-rapidapi-key": apiKey,
    },
    next: { revalidate: 90 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AeroDataBox ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const rows: any[] = data.arrivals ?? [];

  rows.sort((a, b) => {
    const ta = a.movement?.scheduledTime?.utc ?? "";
    const tb = b.movement?.scheduledTime?.utc ?? "";
    return ta.localeCompare(tb);
  });

  // Drop flights that have already landed/arrived — a real FIDS
  // board clears them within a few minutes. Keep Cancelled/Diverted
  // so travellers who are meeting someone still see the bad news.
  const stillRelevant = rows.filter((r) => {
    const s = r.status;
    return s !== "Landed" && s !== "Arrived" && s !== "Departed";
  });

  return stillRelevant.slice(0, numRows).map(normaliseArrival);
}

/* ----------------------------------------
 * Route handler
 * -------------------------------------- */

export async function GET(request: NextRequest) {
  const rawIata    = request.nextUrl.searchParams.get("iata");
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
      { error: "Flight service not configured", notConfigured: true },
      { status: 503 }
    );
  }

  try {
    const arrivals = await fetchUpstreamArrivals(iata, numRows, apiKey);
    return NextResponse.json(arrivals);
  } catch (error) {
    console.error("Flight arrivals error:", error);
    return NextResponse.json(
      { error: "Failed to fetch flight arrivals" },
      { status: 500 }
    );
  }
}
