/**
 * flight-types.ts — TypeScript types for live flight data
 *
 * Modelled on rail-types.ts so the Flights tab can mirror the Rail
 * tab's shape-per-departure pattern. Fields are normalised on the
 * server so the client shape stays clean even if we swap data
 * providers down the line (AeroDataBox / AviationStack / etc).
 *
 * Units + conventions:
 *   - All HH:mm times are LOCAL to the departure airport
 *   - iata codes are uppercase 3-letter (e.g. "LHR")
 *   - status is a small closed enum so the UI can pick a colour
 */

/* ========================================
 * AIRPORT
 * Static metadata for an airport. The bundled global list lives in
 * airports.ts and is used for chip picks + the search autocomplete.
 * ======================================== */
export interface Airport {
  /** 3-letter IATA code (e.g. "LHR", "FCO", "EDI") */
  iata: string;
  /** Display name (e.g. "Heathrow", "Fiumicino") */
  name: string;
  /** Short chip label (e.g. "LHR", "FCO") */
  label: string;
  /** City the airport serves (e.g. "London", "Rome", "Edinburgh") */
  city?: string;
  /** Country (e.g. "United Kingdom", "Italy") */
  country?: string;
}

/* ========================================
 * FLIGHT STATUS
 * Shared between departures and arrivals. Some statuses only make
 * sense for one direction ("boarding" for departures, "landed" for
 * arrivals) — consumers just render whichever is present.
 * ======================================== */
export type FlightStatus =
  | "scheduled"
  | "on-time"
  | "boarding"
  | "gate-closed"
  | "delayed"
  | "departed"
  | "expected"
  | "landed"
  | "cancelled"
  | "diverted"
  | "unknown";

/* ========================================
 * FLIGHT DEPARTURE (normalised)
 * One departure row on the live board.
 * ======================================== */
export interface FlightDeparture {
  /** Provider-specific unique id for this flight instance */
  id: string;
  /** Operating airline name (e.g. "British Airways") */
  airline: string;
  /** Short airline code (e.g. "BA") — shown as a compact badge */
  airlineCode: string;
  /** Flight number including airline prefix (e.g. "BA292") */
  flightNumber: string;
  /** Scheduled departure time in HH:mm (local to airport) */
  scheduledDeparture: string;
  /** Estimated/actual departure time in HH:mm if different from scheduled */
  estimatedDeparture: string | null;
  /** Destination airport IATA (e.g. "JFK") */
  destinationIata: string;
  /** Destination airport / city name for display (e.g. "New York JFK") */
  destination: string;
  /** Terminal (e.g. "5") — null when not yet assigned */
  terminal: string | null;
  /** Gate (e.g. "A7") — null until assigned, usually ~45min before */
  gate: string | null;
  /** Normalised status — drives the colour of the row */
  status: FlightStatus;
  /** Whether the flight is cancelled (mirrors status for quick checks) */
  cancelled: boolean;
  /** Optional aircraft model + registration, when available */
  aircraftModel?: string;
  aircraftRegistration?: string;
}

/* ========================================
 * FLIGHT ARRIVAL (normalised)
 * One arrival row on the live board — flights heading INTO the
 * currently-viewed airport. Mirrors FlightDeparture but swaps
 * destination for origin and adds a baggage-belt field since
 * that's the one arrivals-specific piece of information real-
 * world travellers care most about after landing.
 * ======================================== */
export interface FlightArrival {
  id: string;
  airline: string;
  airlineCode: string;
  flightNumber: string;
  /** Scheduled arrival time in HH:mm (local to arrival airport) */
  scheduledArrival: string;
  /** Estimated/actual arrival time in HH:mm if different from scheduled */
  estimatedArrival: string | null;
  /** Origin airport IATA (e.g. "CDG") */
  originIata: string;
  /** Origin airport / city display name (e.g. "Paris Charles de Gaulle") */
  origin: string;
  /** Arrival terminal */
  terminal: string | null;
  /** Arrival gate (where the aircraft parks) */
  gate: string | null;
  /** Baggage reclaim belt (e.g. "5") — null until assigned */
  baggageBelt: string | null;
  status: FlightStatus;
  cancelled: boolean;
  aircraftModel?: string;
  aircraftRegistration?: string;
}

/* ========================================
 * FLIGHT DETAIL (normalised)
 *
 * Full flight record for a single flight number (e.g. "BA9279").
 * Richer than FlightDeparture / FlightArrival: contains both the
 * departure and arrival airports + times in one object, plus
 * aircraft info and optional live-position data.
 *
 * The flight-by-number endpoint can return multiple records for
 * the same flight number (yesterday / today / tomorrow), so the
 * API route picks the most recent one relevant to "now" and
 * normalises it into this shape.
 * ======================================== */
export interface FlightDetailAirport {
  /** 3-letter IATA (e.g. "LHR") */
  iata: string;
  /** Display name (e.g. "London Heathrow") */
  name: string;
  /** City the airport serves (e.g. "London") */
  city: string | null;
  /** 2-letter country code (e.g. "GB") */
  countryCode: string | null;
  /** IANA timezone (e.g. "Europe/London") — useful for showing local times */
  timeZone: string | null;
}

export interface FlightDetailLeg {
  airport: FlightDetailAirport;
  /** Scheduled time in HH:mm (local to this airport) */
  scheduledTime: string;
  /** Scheduled date in YYYY-MM-DD (local to this airport) */
  scheduledDate: string;
  /**
   * Scheduled time as an ISO UTC timestamp (e.g. "2026-04-22T17:05:00Z").
   * Needed because the local HH:mm above can't be converted back to UTC
   * without knowing the airport's timezone — which is especially fiddly
   * for airports that observe DST shifts.
   */
  scheduledTimeUtc: string | null;
  /** Estimated/predicted time if different from scheduled */
  estimatedTime: string | null;
  /** Actual time if the event has happened */
  actualTime: string | null;
  /** Terminal — null until assigned */
  terminal: string | null;
  /** Gate — null until assigned */
  gate: string | null;
  /** Check-in desk (departure only) — null where not applicable */
  checkInDesk: string | null;
  /** Baggage reclaim belt (arrival only) — null until assigned */
  baggageBelt: string | null;
}

export interface FlightLiveLocation {
  lat: number;
  lon: number;
  altitudeFeet: number | null;
  groundSpeedKts: number | null;
  /** Compass heading in degrees (0 = north) */
  trueTrack: number | null;
  /** ISO UTC timestamp when the position was reported */
  reportedAtUtc: string;
}

export interface FlightDetail {
  /** The flight number the user searched for (normalised, e.g. "BA 9279") */
  flightNumber: string;
  /** Operating airline name (e.g. "British Airways") */
  airline: string;
  /** Short airline code (e.g. "BA") */
  airlineCode: string;
  /** Radio call sign if available (e.g. "SPEEDBIRD 175") */
  callSign: string | null;
  /** Normalised status — drives the colour of the status chip */
  status: FlightStatus;
  /** Convenience flag mirroring status === "cancelled" */
  cancelled: boolean;
  /** True when this record is a codeshare (rare — we default to operator) */
  isCodeshare: boolean;

  /** Departure leg — always present */
  departure: FlightDetailLeg;
  /** Arrival leg — always present */
  arrival: FlightDetailLeg;

  /** Aircraft info where known */
  aircraftModel: string | null;
  aircraftRegistration: string | null;

  /** Great-circle distance between the two airports in kilometres */
  distanceKm: number | null;
  /** Scheduled block time in minutes (dep → arr) */
  durationMinutes: number | null;

  /** Live aircraft position — only present when the flight is airborne */
  liveLocation: FlightLiveLocation | null;

  /** ISO UTC of the last provider update — useful for "AS OF ..." footer */
  lastUpdatedUtc: string | null;
}

/* ========================================
 * API ERROR SHAPE
 * Matches the Rail API's notConfigured pattern so the hook + UI
 * can show a friendly "awaiting API key" message instead of
 * generic errors while the environment is being set up.
 * ======================================== */
export interface FlightApiError {
  error: string;
  /** True when the server is missing FLIGHTS_API_KEY */
  notConfigured?: boolean;
  /** True when the flight number is correctly formatted but not found */
  notFound?: boolean;
}
