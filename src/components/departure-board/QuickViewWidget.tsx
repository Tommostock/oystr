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

import { useFavourites } from "@/hooks/useFavourites";
import { useArrivals } from "@/hooks/useArrivals";
import { LINE_COLOURS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useCountdown } from "@/hooks/useCountdown";

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
  onSelect,
}: {
  naptanId: string;
  name: string;
  lines: string[];
  onSelect: () => void;
}) {
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
      {/* Station name with line dots */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex gap-0.5">
          {lines.slice(0, 3).map((lineId) => (
            <span
              key={lineId}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: LINE_COLOURS[lineId] || "#FF9500" }}
            />
          ))}
        </div>
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
  lineColour,
  routeNumber,
}: {
  destination: string;
  timeToStation: number;
  lineColour?: string;
  routeNumber?: string;
}) {
  const liveSeconds = useCountdown(timeToStation);
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

  /* Don't render if no saved stations */
  if (favourites.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="font-mono text-xs tracking-wider text-amber-faint uppercase px-1">
        SAVED STATIONS
      </div>
      <div className="grid grid-cols-2 gap-2">
        {favourites.slice(0, 4).map((station) => (
          <QuickViewCard
            key={station.naptanId}
            naptanId={station.naptanId}
            name={station.name}
            lines={station.lines}
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
