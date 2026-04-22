/**
 * flights/page.tsx — Flights tab
 *
 * Live departure boards for any airport worldwide. Layout:
 *   1. Page header + subtitle
 *   2. London quick-pick chips (always visible — LHR / LGW / LCY / STN / LTN)
 *   3. Recent-airports chips (up to 5, localStorage-backed)
 *   4. Full search box — any name / city / IATA across the bundled list
 *   5. Live departure board for the selected airport
 *
 * The board is powered by /api/flights/departures, which returns a
 * notConfigured response while FLIGHTS_API_KEY is absent. The board
 * component surfaces that as an "AWAITING API KEY" message so this
 * page is fully navigable even before the provider is wired up.
 */

"use client";

import { useCallback, useState } from "react";
import { Clock, Trash2 } from "lucide-react";
import { mutate } from "swr";
import AmberText from "@/components/shared/AmberText";
import PullToRefresh from "@/components/shared/PullToRefresh";
import FlightDepartureBoard from "@/components/flights/FlightDepartureBoard";
import AirportSearch from "@/components/flights/AirportSearch";
import {
  LONDON_AIRPORTS,
  getAirportByIata,
} from "@/lib/airports";
import { useRecentAirports } from "@/hooks/useRecentAirports";

interface SelectedAirport {
  iata: string;
  name: string;
}

export default function FlightsPage() {
  /* Default to Heathrow — highest traffic London airport. */
  const [selected, setSelected] = useState<SelectedAirport>(() => ({
    iata: LONDON_AIRPORTS[0].iata,
    name: LONDON_AIRPORTS[0].name,
  }));

  const { recents, addRecent, removeRecent } = useRecentAirports();

  /*
   * Any time the selection changes (chip tap or search pick) we
   * commit it to localStorage so the chip strip reflects it on the
   * next render. London quick-picks are intentionally NOT added to
   * recents — they're already pinned and don't need duplicating.
   */
  const handleSelect = useCallback(
    (airport: SelectedAirport, options?: { skipRecent?: boolean }) => {
      setSelected(airport);
      if (!options?.skipRecent) {
        addRecent({ iata: airport.iata, name: airport.name });
      }
    },
    [addRecent]
  );

  const handlePullRefresh = useCallback(async () => {
    await mutate(
      (key) =>
        typeof key === "string" && key.startsWith("/api/flights/departures"),
      undefined,
      { revalidate: true }
    );
  }, []);

  const isLondonPick = LONDON_AIRPORTS.some((a) => a.iata === selected.iata);

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
      <div className="p-4 space-y-4">
        {/* ---- Page Header ---- */}
        <div className="text-center pt-4 pb-2">
          <AmberText as="h1" size="lg" uppercase className="dot-matrix">
            Flights
          </AmberText>
          <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mt-1">
            LIVE DEPARTURES WORLDWIDE
          </div>
        </div>

        {/* ---- London quick-pick chips ---- */}
        <div>
          <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mb-1.5 px-1">
            LONDON
          </div>
          <div className="flex flex-wrap gap-1.5">
            {LONDON_AIRPORTS.map((airport) => {
              const isActive = airport.iata === selected.iata;
              return (
                <button
                  key={airport.iata}
                  onClick={() =>
                    handleSelect(
                      { iata: airport.iata, name: airport.name },
                      { skipRecent: true }
                    )
                  }
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

        {/*
         * Recent airports — mirrors the RECENT strip on the Plan tab.
         * Only renders when there's something to show, so the page
         * stays clean on first load.
         */}
        {recents.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5 px-1">
              <Clock
                size={10}
                strokeWidth={1.5}
                className="text-amber-faint shrink-0"
              />
              <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
                RECENT
              </span>
            </div>
            <div
              className="flex gap-2 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-1"
              style={{ scrollbarWidth: "none" }}
            >
              {recents.map((r) => {
                const isActive = r.iata === selected.iata;
                return (
                  <div
                    key={r.iata}
                    className={`shrink-0 snap-start flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase transition-colors ${
                      isActive
                        ? "border-amber text-amber bg-amber/10"
                        : "border-board-border text-amber-faint hover:border-amber-faint hover:text-amber"
                    }`}
                  >
                    <button
                      onClick={() =>
                        handleSelect(
                          { iata: r.iata, name: r.name },
                          { skipRecent: true }
                        )
                      }
                      className="whitespace-nowrap"
                      aria-label={`Re-open ${r.name}`}
                    >
                      {r.iata} -- {r.name}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecent(r.iata);
                      }}
                      className="shrink-0 text-amber-faint hover:text-red-500 transition-colors"
                      aria-label={`Remove ${r.name} from recents`}
                    >
                      <Trash2 size={10} strokeWidth={1.5} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---- Airport search ---- */}
        <div>
          <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mb-1.5 px-1">
            ANY AIRPORT
          </div>
          <AirportSearch
            /*
             * Clear the input when the selection has switched to a
             * chip-based pick (London or recent) so the search field
             * doesn't linger with a stale airport name. When the user
             * picks via search, the input updates internally.
             */
            value={isLondonPick ? "" : undefined}
            onSelect={(airport) =>
              handleSelect({ iata: airport.iata, name: airport.name })
            }
          />
        </div>

        {/* ---- Live departure board ---- */}
        <FlightDepartureBoard
          iata={selected.iata}
          airportName={
            getAirportByIata(selected.iata)?.name ?? selected.name
          }
          maxRows={15}
        />
      </div>
    </PullToRefresh>
  );
}
