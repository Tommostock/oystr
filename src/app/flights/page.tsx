/**
 * flights/page.tsx — Flights tab
 *
 * London airport departure boards. Mirrors the Rail tab's structure:
 *   1. Page header + subtitle
 *   2. Quick-pick airport chips (LHR / LGW / LCY / STN / LTN)
 *   3. Live departure board for the selected airport
 *
 * Data for the board comes via /api/flights/departures. That route
 * returns a notConfigured response while no API key is in env, and
 * the board component shows an "AWAITING API KEY" state in that
 * case — so this page is fully navigable even before the provider
 * is wired up. Flipping the switch later is a matter of dropping
 * FLIGHTS_API_KEY into .env.local and filling in the upstream
 * stub in the API route.
 */

"use client";

import { useState, useCallback } from "react";
import { mutate } from "swr";
import AmberText from "@/components/shared/AmberText";
import PullToRefresh from "@/components/shared/PullToRefresh";
import FlightDepartureBoard from "@/components/flights/FlightDepartureBoard";
import { LONDON_AIRPORTS } from "@/lib/london-airports";

export default function FlightsPage() {
  /* Default to Heathrow since it's the highest-traffic London airport. */
  const [selectedIata, setSelectedIata] = useState<string>(
    LONDON_AIRPORTS[0].iata
  );

  const selectedAirport =
    LONDON_AIRPORTS.find((a) => a.iata === selectedIata) ?? LONDON_AIRPORTS[0];

  /*
   * Pull-to-refresh invalidates every /api/flights/departures SWR
   * key in one sweep. Covers the currently-visible board and any
   * others that happen to be cached.
   */
  const handlePullRefresh = useCallback(async () => {
    await mutate(
      (key) =>
        typeof key === "string" && key.startsWith("/api/flights/departures"),
      undefined,
      { revalidate: true }
    );
  }, []);

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
      <div className="p-4 space-y-4">
        {/* ---- Page Header ---- */}
        <div className="text-center pt-4 pb-2">
          <AmberText as="h1" size="lg" uppercase className="dot-matrix">
            Flights
          </AmberText>
          <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mt-1">
            LONDON AIRPORT LIVE DEPARTURES
          </div>
        </div>

        {/* ---- Airport picker chips ---- */}
        <div>
          <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mb-1.5 px-1">
            AIRPORT
          </div>
          <div className="flex flex-wrap gap-1.5">
            {LONDON_AIRPORTS.map((airport) => {
              const isActive = airport.iata === selectedIata;
              return (
                <button
                  key={airport.iata}
                  onClick={() => setSelectedIata(airport.iata)}
                  aria-label={`Show departures from ${airport.name}`}
                  aria-pressed={isActive}
                  title={airport.name}
                  className={`px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase border transition-colors ${
                    isActive
                      ? "border-amber text-amber bg-amber/10"
                      : "border-board-border text-amber-faint hover:border-amber-faint hover:text-amber"
                  }`}
                >
                  {airport.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ---- Live departure board ---- */}
        <FlightDepartureBoard
          iata={selectedAirport.iata}
          airportName={selectedAirport.name}
          maxRows={15}
        />
      </div>
    </PullToRefresh>
  );
}
