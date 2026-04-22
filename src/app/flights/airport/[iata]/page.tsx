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
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import PageHeader from "@/components/shared/PageHeader";
import PullToRefresh from "@/components/shared/PullToRefresh";
import FlightDepartureBoard from "@/components/flights/FlightDepartureBoard";
import FlightArrivalsBoard from "@/components/flights/FlightArrivalsBoard";
import SaveAirportButton from "@/components/flights/SaveAirportButton";
import { getAirportByIata, formatAirportFullName } from "@/lib/airports";
import type { FlightArrival, FlightDeparture } from "@/lib/flight-types";

type BoardDirection = "departures" | "arrivals";

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
   * Board direction toggle. Defaults to DEPARTURES so the first
   * glance shows outbound flights — this is the most common use
   * (checking your own flight's status before heading to the
   * airport). Arrivals become one tap away.
   */
  const [direction, setDirection] = useState<BoardDirection>("departures");

  /*
   * Row-tap handler — navigates to the flight detail page so the
   * user can see full origin/destination, aircraft, and live
   * position. The row's flight number is URL-encoded so the space
   * between airline code and number survives the route segment.
   */
  const router = useRouter();
  const handleFlightTap = useCallback(
    (flight: FlightDeparture | FlightArrival) => {
      const fn = flight.flightNumber?.trim();
      if (!fn) return;
      router.push(`/flights/flight/${encodeURIComponent(fn)}`);
    },
    [router]
  );

  /*
   * Pull-to-refresh invalidates every /api/flights/ SWR key at once
   * so both departures and arrivals refresh even if only one is
   * on-screen — cheaper than checking which direction is active.
   */
  const handlePullRefresh = useCallback(async () => {
    await mutate(
      (key) =>
        typeof key === "string" && key.startsWith("/api/flights/"),
      undefined,
      { revalidate: true }
    );
  }, []);

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
      <div className="p-4 space-y-4">
        <PageHeader
          title="Airport"
          subtitle="LIVE DEPARTURES"
          back={{
            href: "/flights",
            label: "FLIGHTS",
            ariaLabel: "Back to Flights",
          }}
        />

        {/* ---- Airport header card — mirrors the rail station page ---- */}
        {(() => {
          /*
           * Prominent disambiguated name ("London Gatwick") — critical
           * for cities with multiple airports so the user can confirm
           * they've opened the right one at a glance. Secondary line
           * shows the country only, since the airport name already
           * encodes the city.
           */
          const fullName = formatAirportFullName({ name, city });
          return (
            <div className="border border-board-border bg-surface p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 min-w-0 flex-1">
                  <h2 className="font-board text-2xl tracking-wider text-amber uppercase amber-glow break-words">
                    {fullName.toUpperCase()}
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
                {country || "LIVE AIRPORT BOARD"}
              </p>
            </div>
          );
        })()}

        {/* ---- Direction toggle ---- */}
        <div
          role="tablist"
          aria-label="Board direction"
          className="grid grid-cols-2 gap-1.5"
        >
          {(
            [
              { id: "departures" as const, label: "DEPARTURES" },
              { id: "arrivals" as const, label: "ARRIVALS" },
            ] as const
          ).map((opt) => {
            const isActive = direction === opt.id;
            return (
              <button
                key={opt.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setDirection(opt.id)}
                className={
                  "py-2 font-mono text-[11px] tracking-wider uppercase border transition-colors " +
                  (isActive
                    ? "border-amber text-amber bg-amber/10 amber-glow"
                    : "border-board-border text-amber-faint hover:border-amber-faint hover:text-amber")
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* ---- Active board ---- */}
        {direction === "departures" ? (
          <FlightDepartureBoard
            iata={iata}
            airportName={city || name}
            maxRows={15}
            onFlightTap={handleFlightTap}
          />
        ) : (
          <FlightArrivalsBoard
            iata={iata}
            airportName={city || name}
            maxRows={15}
            onFlightTap={handleFlightTap}
          />
        )}
      </div>
    </PullToRefresh>
  );
}
