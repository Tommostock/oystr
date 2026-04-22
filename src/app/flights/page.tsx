/**
 * flights/page.tsx — Flights tab (airport picker)
 *
 * Landing screen for Flights. Offers three ways to reach an airport:
 *   1. London quick-pick chips (LHR / LGW / LCY / STN / LTN)
 *   2. Recently-viewed chips (up to 5, localStorage-backed)
 *   3. Full search box across the bundled international airport list
 *
 * Any of those selections navigates to /flights/airport/[iata] —
 * the focused airport page that owns the save button + live board.
 * This page itself doesn't render a board; it's just the picker.
 */

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Trash2, Plane } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import AirportSearch from "@/components/flights/AirportSearch";
import FlightSearch from "@/components/flights/FlightSearch";
import TrackedFlightCard from "@/components/flights/TrackedFlightCard";
import FlightSeatEditor from "@/components/flights/FlightSeatEditor";
import { LONDON_AIRPORTS } from "@/lib/airports";
import { useRecentAirports } from "@/hooks/useRecentAirports";
import { useTrackedFlights } from "@/hooks/useTrackedFlights";

export default function FlightsPage() {
  const router = useRouter();
  const { recents, addRecent, removeRecent } = useRecentAirports();
  const { flights: trackedFlights, removeFlight, updateSeats } =
    useTrackedFlights();

  /*
   * Which tracked flight currently has its seat editor open (null
   * when closed). Kept as an ID rather than a full record so the
   * editor updates automatically when IndexedDB re-hydrates after
   * save.
   */
  const [editingSeatsId, setEditingSeatsId] = useState<string | null>(null);
  const editingFlight = trackedFlights.find((f) => f.id === editingSeatsId) ?? null;

  /**
   * Common handler for every selection path. Records the airport as
   * a recent (so it shows up in the chip strip next time) and
   * navigates to the focused airport page.
   *
   * London quick-picks skip the recent record — they're already
   * pinned, so duplicating them as recents adds noise.
   */
  const goToAirport = useCallback(
    (
      airport: { iata: string; name: string },
      options?: { skipRecent?: boolean }
    ) => {
      if (!options?.skipRecent) {
        addRecent({ iata: airport.iata, name: airport.name });
      }
      router.push(`/flights/airport/${encodeURIComponent(airport.iata)}`);
    },
    [addRecent, router]
  );

  return (
    <div className="p-4 space-y-4">
      <PageHeader title="Flights" subtitle="LIVE DEPARTURES WORLDWIDE" />

      {/* ---- Tracked flights — only rendered when the user has any ---- */}
      {trackedFlights.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5 px-1">
            <Plane
              size={10}
              strokeWidth={1.5}
              className="text-amber-faint shrink-0"
            />
            <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
              MY FLIGHTS
            </span>
          </div>
          <div className="space-y-2">
            {trackedFlights.map((f) => (
              <TrackedFlightCard
                key={f.id}
                flight={f}
                onRemove={(id) => removeFlight(id)}
                onEditSeats={(id) => setEditingSeatsId(id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ---- London quick-pick chips ---- */}
      <div>
        <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mb-1.5 px-1">
          LONDON
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LONDON_AIRPORTS.map((airport) => (
            <button
              key={airport.iata}
              onClick={() =>
                goToAirport(
                  { iata: airport.iata, name: airport.name },
                  { skipRecent: true }
                )
              }
              aria-label={`Open ${airport.name} departures`}
              title={airport.name}
              className="px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase border border-board-border text-amber-faint hover:border-amber-faint hover:text-amber transition-colors"
            >
              {airport.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Recent chips — only when present ---- */}
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
            {recents.map((r) => (
              <div
                key={r.iata}
                className="shrink-0 snap-start flex items-center gap-1.5 border border-board-border px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase text-amber-faint hover:border-amber-faint hover:text-amber transition-colors"
              >
                <button
                  onClick={() =>
                    goToAirport(
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
            ))}
          </div>
        </div>
      )}

      {/* ---- Airport search ---- */}
      <div>
        <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mb-1.5 px-1">
          ANY AIRPORT
        </div>
        <AirportSearch
          onSelect={(airport) =>
            goToAirport({ iata: airport.iata, name: airport.name })
          }
        />
      </div>

      {/* ---- Flight number search ---- */}
      <div>
        <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mb-1.5 px-1">
          FIND A FLIGHT
        </div>
        <FlightSearch />
      </div>

      {/* ---- Seat editor — lives here so the modal state survives
               tracked-list re-renders as IndexedDB streams updates ---- */}
      <FlightSeatEditor
        open={editingFlight !== null}
        initialSeats={editingFlight?.seats ?? []}
        onSave={async (seats) => {
          if (editingSeatsId) {
            await updateSeats(editingSeatsId, seats);
          }
        }}
        onClose={() => setEditingSeatsId(null)}
      />
    </div>
  );
}
