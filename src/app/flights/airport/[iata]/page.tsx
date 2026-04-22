/**
 * flights/airport/[iata]/page.tsx — Focused airport view
 *
 * Mirrors /rail/station/[crs]: a big amber station-style header with
 * the airport name, an IATA + city/country badge, a Save button, and
 * the live departure board underneath.
 *
 * Entry points:
 *   - Tapping a London / recent chip on the Flights tab
 *   - Tapping an airport result in the Terminal search dropdown
 *   - Tapping a saved-airport card on the Terminal hub
 */

"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { mutate } from "swr";
import AmberText from "@/components/shared/AmberText";
import PullToRefresh from "@/components/shared/PullToRefresh";
import FlightDepartureBoard from "@/components/flights/FlightDepartureBoard";
import SaveAirportButton from "@/components/flights/SaveAirportButton";
import { getAirportByIata } from "@/lib/airports";
import type { FlightDeparture } from "@/lib/flight-types";

interface PageProps {
  /* Next.js 15 passes dynamic params as a Promise in client pages. */
  params: Promise<{ iata: string }>;
}

export default function AirportPage({ params }: PageProps) {
  const { iata: rawIata } = use(params);
  const iata = rawIata.toUpperCase();

  /*
   * Resolve the airport from the bundled list. Unknown IATA codes
   * still render — we fall back to showing just the code — so a
   * typo in the URL degrades gracefully instead of 404ing.
   */
  const airport = getAirportByIata(iata);
  const name = airport?.name ?? iata;
  const city = airport?.city;
  const country = airport?.country;

  /*
   * Placeholder state for when a tap-to-expand flight-detail popup
   * arrives later. The board already surfaces onFlightTap — we keep
   * the handler scaffolded so wiring the popup is a one-line swap.
   */
  const [, setExpandedFlight] = useState<FlightDeparture | null>(null);

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
        {/* ---- Top bar with back link ---- */}
        <div className="relative flex items-center justify-center pt-4 pb-2">
          <Link
            href="/flights"
            className="absolute left-0 flex items-center gap-1.5 text-amber-faint hover:text-amber transition-colors font-mono text-xs tracking-wider"
            aria-label="Back to Flights"
          >
            <RotateCcw size={14} strokeWidth={1.5} />
            <span>FLIGHTS</span>
          </Link>
          <div className="flex flex-col items-center">
            <AmberText
              as="h1"
              size="lg"
              uppercase
              className="dot-matrix amber-glow"
            >
              Airport
            </AmberText>
            <span className="font-mono text-[9px] tracking-[0.25em] text-amber-faint uppercase mt-0.5">
              LIVE DEPARTURES
            </span>
          </div>
        </div>

        {/* ---- Airport header card — mirrors the rail station page ---- */}
        <div className="border border-board-border bg-surface p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 min-w-0 flex-1">
              <h2 className="font-board text-2xl tracking-wider text-amber uppercase amber-glow break-words">
                {(city || name).toUpperCase()}
              </h2>
              <span className="shrink-0 border border-amber-faint text-amber font-mono text-xs tracking-wider px-1.5 py-0.5">
                {iata}
              </span>
            </div>
            <SaveAirportButton
              airport={{ iata, name, city, country }}
            />
          </div>
          <p className="font-mono text-[10px] tracking-wider text-amber-faint uppercase truncate">
            {[name !== city ? name : null, country]
              .filter(Boolean)
              .join(" -- ") || "LIVE AIRPORT BOARD"}
          </p>
        </div>

        {/* ---- Live departure board ---- */}
        <FlightDepartureBoard
          iata={iata}
          airportName={city || name}
          maxRows={15}
          onFlightTap={setExpandedFlight}
        />
      </div>
    </PullToRefresh>
  );
}
