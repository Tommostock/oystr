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
 * API ERROR SHAPE
 * Matches the Rail API's notConfigured pattern so the hook + UI
 * can show a friendly "awaiting API key" message instead of
 * generic errors while the environment is being set up.
 * ======================================== */
export interface FlightApiError {
  error: string;
  /** True when the server is missing FLIGHTS_API_KEY */
  notConfigured?: boolean;
}
