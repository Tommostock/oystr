/**
 * API Route: /api/flights/flight/[number]
 *
 * Looks up a specific flight by flight number (e.g. "BA175", "LH 400")
 * using the AeroDataBox flight-by-number endpoint. Returns a single
 * normalised FlightDetail record containing the full origin and
 * destination, aircraft, codeshare status, and optional live location.
 *
 * AeroDataBox may return multiple records for the same flight number
 * (yesterday / today / tomorrow) — this route picks the most relevant
 * one to "now" (today's instance, or the next future instance if none
 * for today).
 *
 * Path params:
 *   /flight/[number]  — flight number (URL-encoded), e.g. "BA%20175"
 *                       Accepts "BA175", "BA 175", "ba175" — the
 *                       route normalises the casing and spacing.
 *
 * Returns:
 *   200 FlightDetail                         — single normalised record
 *   400 { error }                            — malformed flight number
 *   404 { error, notFound: true }            — flight number not found
 *   503 { error, notConfigured: true }       — FLIGHTS_API_KEY not set
 *   502/500 { error }                        — upstream failure
 */

import { NextRequest, NextResponse } from "next/server";
import type {
  FlightDetail,
  FlightDetailLeg,
  FlightStatus,
  FlightLiveLocation,
} from "@/lib/flight-types";
import { getAirportByIata } from "@/lib/airports";

const FLIGHTS_API_KEY_ENV = "FLIGHTS_API_KEY";
const AERODATABOX_HOST = "aerodatabox.p.rapidapi.com";

/* ----------------------------------------
 * Helpers
 * -------------------------------------- */

/**
 * Normalise flight-number input to the canonical form used when
 * calling AeroDataBox: uppercase, single space between the airline
 * prefix and the numeric part (e.g. "ba175" -> "BA 175").
 *
 * Returns null if the input doesn't match the "AA[A] 1-4 digits"
 * pattern — lets the route return a clean 400 instead of forwarding
 * garbage to the upstream provider.
 */
function normaliseFlightNumber(raw: string): string | null {
  const squashed = raw.replace(/\s+/g, "").toUpperCase();
  /*
   * Airline prefix patterns (in priority order — the regex engine
   * tries them left to right so the specific ones come first):
   *   [A-Z]{2,3}   — classic 2-3 letter codes (BA, LH, VIR)
   *   [A-Z][0-9]   — letter+digit codes (U2 easyJet, B6 JetBlue, W6 Wizz)
   *   [0-9][A-Z]   — digit+letter codes (3U Sichuan, 5J Cebu)
   * Followed by a 1-4 digit flight number.
   */
  const match = squashed.match(
    /^([A-Z]{2,3}|[A-Z][0-9]|[0-9][A-Z])(\d{1,4})$/
  );
  if (!match) return null;
  return `${match[1]} ${match[2]}`;
}

/**
 * Extract "HH:mm" from an AeroDataBox local-time string like
 * "2026-04-22 10:15+01:00".
 */
function extractTime(localStr: string | undefined | null): string | null {
  if (!localStr) return null;
  const match = localStr.match(/\d{4}-\d{2}-\d{2}[\sT](\d{2}:\d{2})/);
  return match ? match[1] : null;
}

/**
 * Extract "YYYY-MM-DD" from a local time string.
 */
function extractDate(localStr: string | undefined | null): string | null {
  if (!localStr) return null;
  const match = localStr.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/**
 * Map an AeroDataBox status string to the app's FlightStatus enum.
 * Covers both departure-side and arrival-side statuses in one table.
 */
function mapStatus(raw: string | undefined | null): FlightStatus {
  switch (raw) {
    case "CheckIn":           return "on-time";
    case "Boarding":          return "boarding";
    case "GateClosed":        return "gate-closed";
    case "Departed":          return "departed";
    case "Delayed":           return "delayed";
    case "Expected":          return "expected";
    case "EnRoute":           return "scheduled";
    case "Approaching":       return "expected";
    case "Landed":
    case "Arrived":           return "landed";
    case "Cancelled":
    case "CanceledUncertain": return "cancelled";
    case "Diverted":          return "diverted";
    default:                  return "unknown";
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Normalise one leg (departure or arrival) of an AeroDataBox flight
 * response into our FlightDetailLeg shape.
 *
 * AeroDataBox exposes several "time" fields on each leg, in order of
 * freshness: actualTime -> runwayTime -> predictedTime -> revisedTime
 * -> scheduledTime. We pick the most recent update for `estimatedTime`
 * and `actualTime` so the UI can show the best known information.
 */
function normaliseLeg(leg: any): FlightDetailLeg {
  const airport = leg.airport ?? {};
  const scheduledLocal = leg.scheduledTime?.local;
  const scheduledUtcRaw: string | undefined = leg.scheduledTime?.utc;
  const actualLocal    = leg.actualTime?.local ?? leg.runwayTime?.local ?? null;
  const predictedLocal = leg.predictedTime?.local ?? leg.revisedTime?.local ?? null;

  const scheduledTime = extractTime(scheduledLocal) ?? "N/A";
  const scheduledDate = extractDate(scheduledLocal) ?? "";
  const actualTime    = extractTime(actualLocal);
  const predictedTime = extractTime(predictedLocal);

  // Only surface a non-scheduled time if it actually differs
  const estimatedTime =
    predictedTime && predictedTime !== scheduledTime ? predictedTime : null;

  /*
   * AeroDataBox formats UTC as "2026-04-22 17:05Z" — rewrite the
   * space to 'T' so it's a valid ISO 8601 string that Date can parse
   * anywhere (and that we can compare with other UTC values safely).
   */
  const scheduledTimeUtc = scheduledUtcRaw
    ? scheduledUtcRaw.replace(" ", "T").replace(/Z$/, "Z")
    : null;

  /*
   * Prefer the bundled airport record's human-friendly name for the
   * ~150 most-trafficked airports — AeroDataBox often returns just
   * "London" for LTN, "Paris" for CDG/ORY, etc., which defeats the
   * disambiguation we want at the detail-page level.
   */
  const iata = airport.iata ?? "???";
  const bundled = iata ? getAirportByIata(iata) : null;
  const displayName =
    bundled?.name ??
    airport.shortName ??
    airport.name ??
    iata ??
    "Unknown";
  const displayCity =
    bundled?.city ?? airport.municipalityName ?? null;

  return {
    airport: {
      iata,
      name: displayName,
      city: displayCity,
      countryCode: airport.countryCode ?? null,
      timeZone: airport.timeZone ?? null,
      lat: typeof airport.location?.lat === "number" ? airport.location.lat : null,
      lon: typeof airport.location?.lon === "number" ? airport.location.lon : null,
    },
    scheduledTime,
    scheduledDate,
    scheduledTimeUtc,
    estimatedTime,
    actualTime,
    terminal: leg.terminal ?? null,
    gate: leg.gate ?? null,
    checkInDesk: leg.checkInDesk ?? null,
    baggageBelt: leg.baggageBelt ?? null,
  };
}

/**
 * Normalise a live aircraft location block, if present. Returns null
 * if the flight is not currently airborne (the provider omits the
 * location object in that case).
 */
function normaliseLocation(loc: any): FlightLiveLocation | null {
  if (!loc || typeof loc.lat !== "number" || typeof loc.lon !== "number") {
    return null;
  }
  return {
    lat: loc.lat,
    lon: loc.lon,
    altitudeFeet: loc.altitude?.feet ?? null,
    groundSpeedKts: loc.groundSpeed?.kt ?? loc.groundSpeed?.knots ?? null,
    trueTrack: loc.trueTrack?.deg ?? null,
    reportedAtUtc: loc.reportedAtUtc ?? "",
  };
}

/**
 * Compute block-time duration in minutes between two UTC timestamps.
 * Returns null if either timestamp is missing / malformed.
 */
function computeDurationMinutes(
  depUtc: string | undefined,
  arrUtc: string | undefined
): number | null {
  if (!depUtc || !arrUtc) return null;
  // AeroDataBox UTC format: "2026-04-22 09:15Z"
  const toIso = (s: string) => s.replace(" ", "T");
  const d = new Date(toIso(depUtc));
  const a = new Date(toIso(arrUtc));
  if (Number.isNaN(d.getTime()) || Number.isNaN(a.getTime())) return null;
  const mins = Math.round((a.getTime() - d.getTime()) / 60000);
  return mins > 0 ? mins : null;
}

/**
 * Pick the most relevant flight record from AeroDataBox's array
 * response. The provider may return several entries for the same
 * flight number (e.g. yesterday's, today's, tomorrow's operations).
 *
 * Strategy:
 *   1. Prefer the record whose scheduled departure UTC is within
 *      [now - 12h, now + 36h] — "today-ish".
 *   2. Among those, prefer the one closest to now.
 *   3. If nothing qualifies, return the last record (usually the
 *      next future operation).
 */
function pickMostRelevant(records: any[]): any | null {
  if (!records || records.length === 0) return null;

  const now = Date.now();
  const nearWindow = 12 * 60 * 60 * 1000; // 12h back
  const farWindow  = 36 * 60 * 60 * 1000; // 36h forward

  const scored = records.map((r) => {
    const depUtc = r.departure?.scheduledTime?.utc;
    if (!depUtc) return { r, diff: Number.POSITIVE_INFINITY };
    const ts = new Date(depUtc.replace(" ", "T")).getTime();
    const diff = Math.abs(ts - now);
    const inWindow = ts >= now - nearWindow && ts <= now + farWindow;
    return { r, diff, inWindow };
  });

  const inWindow = scored.filter((s) => s.inWindow);
  if (inWindow.length > 0) {
    inWindow.sort((a, b) => a.diff - b.diff);
    return inWindow[0].r;
  }

  // Fall back to the record with the smallest absolute time-to-now
  scored.sort((a, b) => a.diff - b.diff);
  return scored[0]?.r ?? null;
}

/**
 * Convert a raw AeroDataBox flight record into our FlightDetail shape.
 */
function normaliseFlight(record: any, displayNumber: string): FlightDetail {
  const departure = normaliseLeg(record.departure ?? {});
  const arrival   = normaliseLeg(record.arrival ?? {});
  const airline   = record.airline ?? {};
  const aircraft  = record.aircraft ?? {};

  const status = mapStatus(record.status);
  const distanceKm = record.greatCircleDistance?.km ?? null;
  const durationMinutes = computeDurationMinutes(
    record.departure?.scheduledTime?.utc,
    record.arrival?.scheduledTime?.utc
  );

  return {
    flightNumber: record.number ?? displayNumber,
    airline: airline.name ?? "Unknown Airline",
    airlineCode: airline.iata ?? "??",
    callSign: record.callSign ?? null,
    status,
    cancelled: status === "cancelled",
    isCodeshare: record.codeshareStatus === "IsCodeshared",
    departure,
    arrival,
    aircraftModel: aircraft.model ?? null,
    aircraftRegistration: aircraft.reg ?? null,
    distanceKm,
    durationMinutes,
    liveLocation: normaliseLocation(record.location),
    lastUpdatedUtc: record.lastUpdatedUtc ?? null,
  };
}

/* ----------------------------------------
 * Upstream fetch
 * -------------------------------------- */

async function fetchUpstreamFlight(
  flightNumber: string,
  apiKey: string
): Promise<FlightDetail | null> {
  // The `{number}` path segment can contain a space — encode it.
  const urlNumber = encodeURIComponent(flightNumber);
  const url = `https://${AERODATABOX_HOST}/flights/number/${urlNumber}?withAircraftImage=false&withLocation=true`;

  const res = await fetch(url, {
    headers: {
      "x-rapidapi-host": AERODATABOX_HOST,
      "x-rapidapi-key": apiKey,
      Accept: "application/json",
    },
    // Disable Next.js's fetch cache — it happily caches 204s from
    // transient upstream blips and then serves them forever. We do
    // our own dedup at the SWR layer instead.
    cache: "no-store",
  });

  // 204 No Content (AeroDataBox signals "no data" this way for some
  // flight numbers) and 404 both mean "not found" to our consumers.
  if (res.status === 204 || res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AeroDataBox ${res.status}: ${body.slice(0, 200)}`);
  }

  // Parse text first so an empty 200 response surfaces a clear error
  const text = await res.text();
  if (!text) {
    return null;
  }
  const data = JSON.parse(text);
  // The endpoint returns an array
  const records: any[] = Array.isArray(data) ? data : [];
  if (records.length === 0) return null;

  const record = pickMostRelevant(records);
  if (!record) return null;

  return normaliseFlight(record, flightNumber);
}

/* ----------------------------------------
 * Route handler
 * -------------------------------------- */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  const { number: rawNumber } = await params;

  const decoded = decodeURIComponent(rawNumber);
  const normalised = normaliseFlightNumber(decoded);

  if (!normalised) {
    return NextResponse.json(
      {
        error:
          "Invalid flight number format. Expected e.g. BA175, LH 400 (2-3 letter airline + 1-4 digit number).",
      },
      { status: 400 }
    );
  }

  const apiKey = process.env[FLIGHTS_API_KEY_ENV];
  if (!apiKey) {
    return NextResponse.json(
      { error: "Flight service not configured", notConfigured: true },
      { status: 503 }
    );
  }

  try {
    const flight = await fetchUpstreamFlight(normalised, apiKey);
    if (!flight) {
      return NextResponse.json(
        {
          error: `No current or upcoming flight found for ${normalised}`,
          notFound: true,
        },
        { status: 404 }
      );
    }
    return NextResponse.json(flight);
  } catch (error) {
    console.error("Flight detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch flight detail" },
      { status: 500 }
    );
  }
}
