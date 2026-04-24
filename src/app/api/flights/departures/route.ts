/**
 * API Route: /api/flights/departures
 *
 * Proxies live departure data from AeroDataBox (via RapidAPI) for a
 * given airport IATA code. Normalises the upstream response into the
 * app's FlightDeparture shape so the client never knows which
 * provider we're using.
 *
 * Query params:
 *   ?iata=LHR       — 3-letter IATA code of the airport (REQUIRED)
 *   ?numRows=15     — number of rows to return (default 15, max 50)
 *
 * Returns:
 *   200 Array<FlightDeparture>               — sorted by scheduled time ASC
 *   400 { error }                            — missing / invalid iata
 *   503 { error, notConfigured: true }       — FLIGHTS_API_KEY not set
 *   502/500 { error }                        — upstream failure
 */

import { NextRequest, NextResponse } from "next/server";
import type { FlightDeparture, FlightStatus } from "@/lib/flight-types";
import { getAirportByIata } from "@/lib/airports";
import { FLIGHT_SERVER_CACHE_SECONDS } from "@/lib/constants";

const FLIGHTS_API_KEY_ENV = "FLIGHTS_API_KEY";
const AERODATABOX_HOST = "aerodatabox.p.rapidapi.com";

/* ----------------------------------------
 * Helpers
 * -------------------------------------- */

/**
 * Format a Date as "YYYY-MM-DDTHH:mm" (UTC) for the AeroDataBox
 * FIDS endpoint from/to path segments.
 */
function formatAeroDateTime(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

/**
 * Extract "HH:mm" from an AeroDataBox local-time string like
 * "2024-04-22 14:30+01:00".  Returns null if the string is missing
 * or doesn't match.
 */
function extractTime(localStr: string | undefined | null): string | null {
  if (!localStr) return null;
  // Match the time part that comes after the date (before the +/- offset)
  const match = localStr.match(/\d{4}-\d{2}-\d{2}[\sT](\d{2}:\d{2})/);
  return match ? match[1] : null;
}

/**
 * Map an AeroDataBox status string to the app's FlightStatus enum.
 */
function mapStatus(raw: string | undefined | null): FlightStatus {
  switch (raw) {
    case "CheckIn":         return "on-time";
    case "Boarding":        return "boarding";
    case "GateClosed":      return "gate-closed";
    case "Departed":        return "departed";
    case "Delayed":         return "delayed";
    case "Expected":        return "expected";
    case "EnRoute":         return "scheduled";
    case "Landed":          return "landed";
    case "Arrived":         return "landed";
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
 *   1. Bundled AIRPORTS record by IATA — our own list has human-
 *      friendly disambiguated names like "London Gatwick" / "Paris
 *      Charles de Gaulle" where the upstream often returns just
 *      "London" or "Paris" (especially for secondary airports).
 *   2. Combined city + name — for airports the bundled list doesn't
 *      cover, we still try to produce something better than just
 *      city alone.
 *   3. Raw city or IATA fallback.
 */
function buildAirportDisplay(
  city: string | undefined | null,
  name: string | undefined | null,
  iata: string | undefined | null
): string {
  // 1. Known IATA → curated name
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

  // 2. Use upstream city + name when they disambiguate each other
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
 * Normalise a single AeroDataBox departure item into a FlightDeparture.
 *
 * AeroDataBox response shape (relevant fields):
 * {
 *   number: "BA292",
 *   status: "Boarding",
 *   airline: { name: "British Airways", iata: "BA" },
 *   aircraft: { model: "Boeing 777", registration: "G-STBK" },
 *   movement: {
 *     airport: { iata: "JFK", municipalityName: "New York", name: "..." },
 *     scheduledTime: { local: "2024-04-22 10:00+01:00", utc: "..." },
 *     revisedTime:   { local: "2024-04-22 10:15+01:00", utc: "..." },
 *     terminal: "5",
 *     gate: "A7"
 *   }
 * }
 */
function normaliseDeparture(item: any): FlightDeparture {
  const movement = item.movement ?? {};
  const destAirport = movement.airport ?? {};
  const airline = item.airline ?? {};
  const aircraft = item.aircraft ?? {};
  const scheduledLocal = extractTime(movement.scheduledTime?.local);
  const revisedLocal   = extractTime(movement.revisedTime?.local);

  const status = mapStatus(item.status);

  // Only surface an estimated time if it differs from scheduled
  const estimatedDeparture =
    revisedLocal && revisedLocal !== scheduledLocal ? revisedLocal : null;

  // Build a disambiguated destination label: "London Gatwick" rather
  // than just "London". For cities with multiple airports (London,
  // Paris, Milan, Rome, NY, Tokyo, ...) the city alone is ambiguous,
  // so combine city + airport shortName where they differ.
  const destination = buildAirportDisplay(
    destAirport.municipalityName,
    destAirport.shortName ?? destAirport.name,
    destAirport.iata
  );

  return {
    id: item.number ?? "UNKNOWN",
    airline: airline.name ?? "Unknown Airline",
    airlineCode: airline.iata ?? "??",
    flightNumber: item.number ?? "UNKNOWN",
    scheduledDeparture: scheduledLocal ?? "N/A",
    estimatedDeparture,
    destinationIata: destAirport.iata ?? "???",
    destination,
    terminal: movement.terminal ?? null,
    gate: movement.gate ?? null,
    status,
    cancelled: status === "cancelled",
    aircraftModel: aircraft.model,
    aircraftRegistration: aircraft.registration,
  };
}

/* ----------------------------------------
 * Upstream fetch
 * -------------------------------------- */

async function fetchUpstreamDepartures(
  iata: string,
  numRows: number,
  apiKey: string
): Promise<FlightDeparture[]> {
  // Use a 6-hour window from now so the board always has upcoming flights
  const now = new Date();
  const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);

  const from = formatAeroDateTime(now);
  const to   = formatAeroDateTime(sixHoursLater);

  const url = new URL(
    `https://${AERODATABOX_HOST}/flights/airports/iata/${iata}/${from}/${to}`
  );
  url.searchParams.set("direction", "Departure");
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
    // Cache server-side for 8 minutes — keeps multiple simultaneous
    // components (e.g. saved-airport card + airport page) sharing a
    // single upstream call most of the time. See FLIGHT_SERVER_CACHE_SECONDS.
    next: { revalidate: FLIGHT_SERVER_CACHE_SECONDS },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AeroDataBox ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const rows: any[] = data.departures ?? [];

  // Sort ascending by scheduled departure (already usually sorted, but defensive)
  rows.sort((a, b) => {
    const ta = a.movement?.scheduledTime?.utc ?? "";
    const tb = b.movement?.scheduledTime?.utc ?? "";
    return ta.localeCompare(tb);
  });

  // Drop flights that have already left — a real FIDS board clears
  // them within a few minutes of departure. Keep Cancelled/Diverted
  // so travellers who arrive late still see the bad news.
  const stillRelevant = rows.filter((r) => {
    const s = r.status;
    return s !== "Departed" && s !== "Landed" && s !== "Arrived";
  });

  return stillRelevant.slice(0, numRows).map(normaliseDeparture);
}

/* ----------------------------------------
 * Route handler
 * -------------------------------------- */

export async function GET(request: NextRequest) {
  const rawIata   = request.nextUrl.searchParams.get("iata");
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
    const departures = await fetchUpstreamDepartures(iata, numRows, apiKey);
    return NextResponse.json(departures);
  } catch (error) {
    console.error("Flight departures error:", error);
    return NextResponse.json(
      { error: "Failed to fetch flight departures" },
      { status: 500 }
    );
  }
}
