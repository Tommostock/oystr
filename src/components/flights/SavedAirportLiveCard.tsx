/**
 * SavedAirportLiveCard.tsx — Live status card for a saved airport
 *
 * Rendered on the Flights landing page for each airport the user has
 * pinned via the Save button on /flights/airport/[iata]. Shows:
 *   - IATA code + full disambiguated airport name
 *   - Live summary from the departures board (delayed / cancelled
 *     counts over the upcoming N flights)
 *   - Next 2 departures inline so you can tell if things are moving
 *
 * Polls via useFlightDepartures (2-min SWR — same as the board) and
 * dedups across cards that happen to request the same airport.
 */

"use client";

import Link from "next/link";
import { Plane, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFlightDepartures } from "@/hooks/useFlightDepartures";
import { formatAirportFullName } from "@/lib/airports";
import type { SavedAirport } from "@/lib/db";
import type { FlightDeparture } from "@/lib/flight-types";

interface SavedAirportLiveCardProps {
  airport: SavedAirport;
}

/**
 * Summarise the board. Counts only matter when there's live data;
 * during loading / error we show a placeholder.
 */
function summariseBoard(departures: FlightDeparture[]) {
  let delayed = 0;
  let cancelled = 0;
  for (const d of departures) {
    if (d.cancelled || d.status === "cancelled") cancelled++;
    else if (
      d.status === "delayed" ||
      (d.estimatedDeparture && d.estimatedDeparture !== d.scheduledDeparture)
    ) {
      delayed++;
    }
  }
  return { delayed, cancelled, total: departures.length };
}

export default function SavedAirportLiveCard({
  airport,
}: SavedAirportLiveCardProps) {
  /*
   * Request 15 rows, once per mount — the AeroDataBox free tier is
   * only 150 req/mo, and each saved airport card would otherwise
   * poll every 10 min while /flights is open, multiplying with every
   * saved airport the user pins. Fetching once gives a snapshot; the
   * user can tap through to the full airport page for live data.
   */
  const { departures, isLoading, error, notConfigured } =
    useFlightDepartures({
      iata: airport.iata,
      numRows: 15,
      pollingDisabled: true,
    });

  const fullName = formatAirportFullName({
    name: airport.name,
    city: airport.city ?? null,
  });

  const { delayed, cancelled, total } = summariseBoard(departures);

  // Pick two upcoming departures (not yet departed/landed) to show
  // inline so the card reads as "something is happening now".
  const upcoming = departures
    .filter((d) => d.status !== "departed" && d.status !== "landed")
    .slice(0, 2);

  const href = `/flights/airport/${airport.iata}`;

  return (
    <Link
      href={href}
      className={cn(
        "block border border-board-border bg-surface p-3 space-y-2",
        "hover:border-amber-faint transition-colors"
      )}
      aria-label={`Open ${airport.iata} live departures`}
    >
      {/* Top row: IATA + full name + chevron */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-board text-xl tracking-wider text-amber amber-glow">
              {airport.iata}
            </span>
            <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase truncate">
              {fullName}
            </span>
          </div>
        </div>
        <ArrowRight
          size={14}
          strokeWidth={1.5}
          className="text-amber-faint shrink-0 mt-1.5"
        />
      </div>

      {/* Live summary — counts of delayed + cancelled from the board */}
      <div className="flex items-center gap-3 font-mono text-[10px] tracking-wider uppercase">
        {notConfigured ? (
          <span className="text-amber-faint">AWAITING API KEY</span>
        ) : isLoading && total === 0 ? (
          <span className="text-amber-faint">LOADING...</span>
        ) : error && total === 0 ? (
          <span className="text-bad">COULD NOT LOAD</span>
        ) : total === 0 ? (
          <span className="text-amber-faint">NO DEPARTURES LISTED</span>
        ) : (
          <>
            <span className="text-amber-faint">
              {total} UPCOMING
            </span>
            {delayed > 0 && (
              <span className="text-amber amber-glow">
                {delayed} DELAYED
              </span>
            )}
            {cancelled > 0 && (
              <span className="text-bad">{cancelled} CANCELLED</span>
            )}
            {delayed === 0 && cancelled === 0 && (
              <span className="text-good">ON TIME</span>
            )}
          </>
        )}
      </div>

      {/* Next 2 departures — makes the card feel dynamic even when
          delayed/cancelled counts are zero. */}
      {upcoming.length > 0 && (
        <div className="divide-y divide-board-border/50 border-t border-board-border pt-1">
          {upcoming.map((d) => (
            <div
              key={d.id}
              className="flex items-baseline gap-2 py-1"
            >
              <span className="font-board text-sm tracking-wider text-amber">
                {d.estimatedDeparture || d.scheduledDeparture}
              </span>
              <span className="font-mono text-[10px] tracking-wider text-amber uppercase truncate flex-1">
                {d.destination}
              </span>
              <span className="font-mono text-[9px] tracking-wider text-amber-faint uppercase shrink-0">
                {d.airlineCode} {d.flightNumber.replace(/^[A-Z0-9]{2,3}\s/, "")}
              </span>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}
