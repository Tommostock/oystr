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
import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { Clock, Trash2, Plane, Star } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import AirportSearch from "@/components/flights/AirportSearch";
import FlightSearch from "@/components/flights/FlightSearch";
import TrackedFlightCard from "@/components/flights/TrackedFlightCard";
import FlightSeatEditor from "@/components/flights/FlightSeatEditor";
import TodaysFlightHero from "@/components/flights/TodaysFlightHero";
import SavedAirportLiveCard from "@/components/flights/SavedAirportLiveCard";
import FlightQuotaBanner from "@/components/flights/FlightQuotaBanner";
import { LONDON_AIRPORTS } from "@/lib/airports";
import { useRecentAirports } from "@/hooks/useRecentAirports";
import { useTrackedFlights } from "@/hooks/useTrackedFlights";
import { db } from "@/lib/db";

/** Local YYYY-MM-DD — avoids the UTC shift toISOString() would cause. */
function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function FlightsPage() {
  const router = useRouter();
  const { recents, addRecent, removeRecent } = useRecentAirports();
  const { flights: trackedFlights, removeFlight, updateSeats } =
    useTrackedFlights();

  /*
   * Saved airports table — reactive via useLiveQuery so adding /
   * removing a saved airport elsewhere in the app updates this
   * section immediately without needing a manual refresh.
   */
  const savedAirports = useLiveQuery(
    async () => {
      const all = await db.savedAirports.toArray();
      return all.sort((a, b) => b.addedAt - a.addedAt);
    },
    [],
    []
  );

  /*
   * Pick the single "today's flight" for the hero panel — the
   * earliest departing tracked flight whose travelDate is today.
   * If the user has multiple flights today we still only hero the
   * earliest one; the others keep their normal TrackedFlightCard.
   */
  const today = localDateString();
  const todaysFlight = trackedFlights.find((f) => f.travelDate === today) ?? null;

  /*
   * MY FLIGHTS card list — everything except the one we already
   * hero'd, to avoid duplication at the top of the page.
   */
  const otherTrackedFlights = todaysFlight
    ? trackedFlights.filter((f) => f.id !== todaysFlight.id)
    : trackedFlights;

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

      {/* ---- Quota banner — only visible when near / past free-tier limit ---- */}
      <FlightQuotaBanner />

      {/* ---- TODAY'S FLIGHT hero — giant panel with live terminal,
               gate, check-in, and countdown. Only shown when there's
               a tracked flight departing today. ---- */}
      {todaysFlight && <TodaysFlightHero flight={todaysFlight} />}

      {/* ---- MY FLIGHTS — the remaining tracked flights (excluding
               the one already shown in the hero) ---- */}
      {otherTrackedFlights.length > 0 && (
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
            {otherTrackedFlights.map((f) => (
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

      {/* ---- Saved airports with live status — only when any exist ---- */}
      {savedAirports && savedAirports.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5 px-1">
            <Star
              size={10}
              strokeWidth={1.5}
              className="text-amber-faint shrink-0"
            />
            <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
              SAVED AIRPORTS
            </span>
          </div>
          <div className="space-y-2">
            {savedAirports.map((a) => (
              <SavedAirportLiveCard key={a.iata} airport={a} />
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
