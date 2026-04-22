/**
 * london-airports.ts — Bundled list of London airports
 *
 * Small static list (5 airports) used for the airport-picker chips
 * on the Flights tab. Unlike the UK rail list we don't need a big
 * search index — there are only a handful of airports serving London
 * and nearly all traffic is through these five.
 */

import type { Airport } from "./flight-types";

/* ========================================
 * LONDON AIRPORTS
 * Ordered by passenger throughput (Heathrow highest). Southend
 * has been intentionally left out — traffic there is sporadic.
 * ======================================== */
export const LONDON_AIRPORTS: Airport[] = [
  { iata: "LHR", name: "London Heathrow", label: "LHR" },
  { iata: "LGW", name: "London Gatwick", label: "LGW" },
  { iata: "LCY", name: "London City", label: "LCY" },
  { iata: "STN", name: "London Stansted", label: "STN" },
  { iata: "LTN", name: "London Luton", label: "LTN" },
];

/** Lookup an airport record by IATA code (case-insensitive). */
export function getAirportByIata(iata: string): Airport | null {
  const target = iata.trim().toUpperCase();
  return LONDON_AIRPORTS.find((a) => a.iata === target) ?? null;
}
