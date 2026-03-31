/**
 * QuickViewWidget.tsx — Mini departure summaries for saved stations
 *
 * Shows a compact view of the next 2 arrivals for each saved station
 * on the home page. Users can see at a glance when the next train
 * is coming at their favourite stations without needing to tap in.
 *
 * Each card is tappable to load the full departure board.
 *
 * Usage:
 *   <QuickViewWidget onStationSelect={(station) => setSelected(station)} />
 */

"use client";

import { useEffect, useRef } from "react";
import { useFavourites } from "@/hooks/useFavourites";
import { useArrivals } from "@/hooks/useArrivals";
import { LINE_COLOURS } from "@/lib/constants";
import { cn, cleanStationName } from "@/lib/utils";
import { useCountdown } from "@/hooks/useCountdown";
import { db } from "@/lib/db";

interface QuickViewWidgetProps {
  /** Called when a station card is tapped */
  onStationSelect: (station: { naptanId: string; name: string }) => void;
}

/**
 * Single saved station card showing next 2 arrivals.
 */
function QuickViewCard({
  naptanId,
  name,
  lines,
  stopLetter,
  modes,
  onSelect,
}: {
  naptanId: string;
  name: string;
  lines: string[];
  stopLetter?: string;
  modes?: string[];
  onSelect: () => void;
}) {
  const isBus = modes?.includes("bus") || naptanId.startsWith("490");
  const { arrivals, isLoading } = useArrivals(naptanId);
  /* Show the next 2 arrivals */
  const next2 = arrivals.slice(0, 2);

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left border border-board-border bg-surface",
        "p-3 transition-colors duration-200",
        "hover:border-amber-faint cursor-pointer"
      )}
    >
      {/* Station name with line dots or bus stop letter */}
      <div className="flex items-center gap-2 mb-2">
        {isBus ? (
          stopLetter ? (
            <span className="shrink-0 w-5 h-5 flex items-center justify-center border border-amber text-amber text-[10px] font-mono">
              {stopLetter}
            </span>
          ) : (
            <span className="shrink-0 text-amber text-[10px] font-mono">BUS</span>
          )
        ) : (
          <div className="flex gap-0.5">
            {lines.slice(0, 3).map((lineId) => (
              <span
                key={lineId}
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: LINE_COLOURS[lineId] || "#FF9500" }}
              />
            ))}
          </div>
        )}
        <span className="font-mono text-xs tracking-wider text-amber uppercase truncate">
          {name
            .replace(/\s*Underground Station$/i, "")
            .replace(/\s*Station$/i, "")}
        </span>
      </div>

      {/* Next arrivals */}
      {isLoading && next2.length === 0 ? (
        <div className="font-mono text-xs tracking-wider text-amber-faint animate-pulse">
          LOADING...
        </div>
      ) : next2.length === 0 ? (
        <div className="font-mono text-xs tracking-wider text-amber-faint">
          NO DATA
        </div>
      ) : (
        <div className="space-y-1">
          {next2.map((arrival, i) => (
            <QuickArrivalRow
              key={`${arrival.vehicleId}-${i}`}
              destination={
                (arrival.destinationName || "")
                  .replace(/\s*Underground Station$/i, "")
                  .replace(/\s*DLR Station$/i, "")
                  .replace(/\s*Station$/i, "")
                  .replace(/\s*\(London\)/i, "")
              }
              timeToStation={arrival.timeToStation}
              expectedArrival={arrival.expectedArrival}
              lineColour={LINE_COLOURS[arrival.lineId]}
              routeNumber={arrival.modeName === "bus" ? arrival.lineName : undefined}
            />
          ))}
        </div>
      )}
    </button>
  );
}

/**
 * Compact arrival row for the quick-view widget.
 */
function QuickArrivalRow({
  destination,
  timeToStation,
  expectedArrival,
  lineColour,
  routeNumber,
}: {
  destination: string;
  timeToStation: number;
  expectedArrival?: string;
  lineColour?: string;
  routeNumber?: string;
}) {
  const liveSeconds = useCountdown(expectedArrival, timeToStation);
  const isDue = liveSeconds <= 30;
  const timeText = isDue ? "DUE" : `${Math.floor(liveSeconds / 60)}m`;

  return (
    <div className="flex items-center gap-2 text-xs font-mono tracking-wider">
      {routeNumber ? (
        <span className="text-amber border border-amber-faint px-1 text-[10px]">
          {routeNumber}
        </span>
      ) : lineColour ? (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: lineColour }}
        />
      ) : null}
      <span className="text-amber truncate flex-1 uppercase">
        {destination}
      </span>
      <span
        className={cn(
          "shrink-0",
          isDue ? "text-amber amber-glow-strong" : "text-amber-dim"
        )}
      >
        {timeText}
      </span>
    </div>
  );
}

export default function QuickViewWidget({
  onStationSelect,
}: QuickViewWidgetProps) {
  const { favourites } = useFavourites();

  /*
   * Enrich bus stops missing their stop letter.
   * Searches TfL for each bus stop and backfills stopLetter/indicator
   * into IndexedDB. Only runs once per session (ref guard).
   * The live query in useFavourites auto-updates the UI when DB changes.
   */
  const busEnrichRef = useRef(false);
  useEffect(() => {
    const busStopsNeedingEnrichment = favourites.filter(
      (s) =>
        (s.naptanId.startsWith("490") || s.modes?.includes("bus")) &&
        (!s.stopLetter || s.lines.length === 0)
    );
    if (busStopsNeedingEnrichment.length === 0 || busEnrichRef.current) return;

    busEnrichRef.current = true;

    async function enrichBusStops() {
      for (const station of busStopsNeedingEnrichment) {
        try {
          const resp = await fetch(
            `/api/tfl/search?query=${encodeURIComponent(
              cleanStationName(station.name)
            )}`
          );
          if (!resp.ok) continue;

          const results = await resp.json();
          const match = results.find(
            (r: { naptanId: string }) => r.naptanId === station.naptanId
          );

          if (match) {
            const lineIds = (match.lines || []).map(
              (l: { id: string } | string) => typeof l === "string" ? l : l.id
            );
            await db.favourites.update(station.naptanId, {
              stopLetter: match.stopLetter || station.stopLetter || undefined,
              indicator: match.indicator || station.indicator || undefined,
              modes: match.modes?.length ? match.modes : ["bus"],
              lines: lineIds.length > 0 ? lineIds : station.lines,
            });
          }
        } catch {
          /* Silently fail */
        }
      }
      busEnrichRef.current = false;
    }

    enrichBusStops();
  }, [favourites]);

  /* Don't render if no saved stations */
  if (favourites.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="font-mono text-xs tracking-wider text-amber-faint uppercase px-1">
        SAVED STATIONS
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[...favourites].sort((a, b) => a.name.localeCompare(b.name)).map((station) => (
          <QuickViewCard
            key={station.naptanId}
            naptanId={station.naptanId}
            name={station.name}
            lines={station.lines}
            stopLetter={station.stopLetter}
            modes={station.modes}
            onSelect={() =>
              onStationSelect({
                naptanId: station.naptanId,
                name: station.name,
              })
            }
          />
        ))}
      </div>
    </div>
  );
}
