/**
 * JourneyLegDisplay.tsx — Single leg of a journey
 *
 * Shows one segment of a journey with:
 *   - Coloured line indicator (or dashed for walking)
 *   - Departure station name
 *   - Line name and direction
 *   - Duration
 *
 * Visual design matches the spec:
 *   o Station Name
 *   | --- Line Name (Direction) --- X min
 *   o Next Station
 *
 * Usage:
 *   <JourneyLegDisplay leg={journeyLeg} isLast={false} />
 */

"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { LINE_COLOURS } from "@/lib/constants";
import type { JourneyLeg } from "@/lib/tfl-types";
import { cn } from "@/lib/utils";

interface JourneyLegDisplayProps {
  /** The journey leg data from TfL */
  leg: JourneyLeg;
  /** Whether this is the last leg (shows arrival station) */
  isLast: boolean;
}

/**
 * Clean station names by removing common suffixes.
 */
function cleanStationName(name: string): string {
  return name
    .replace(/\s*Underground Station$/i, "")
    .replace(/\s*DLR Station$/i, "")
    .replace(/\s*Rail Station$/i, "")
    .replace(/\s*\(London\)/i, "")
    .replace(/\s*Station$/i, "")
    .trim();
}

/**
 * Get the colour for a journey leg.
 * Uses official line colours for tube/rail, dim amber for walking.
 */
function getLegColour(leg: JourneyLeg): string {
  /* Walking legs get dim amber */
  if (leg.mode?.id === "walking") return "#7A6530";

  /* Try to get the line colour from our constants */
  const lineId = leg.routeOptions?.[0]?.lineIdentifier?.id;
  if (lineId && LINE_COLOURS[lineId]) {
    return LINE_COLOURS[lineId];
  }

  /* Fallback to amber */
  return "#FF9500";
}

/**
 * Format a time string from an ISO timestamp.
 * "2026-03-25T14:32:00" => "14:32"
 */
function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "--:--";
  }
}

export default function JourneyLegDisplay({
  leg,
  isLast,
}: JourneyLegDisplayProps) {
  const colour = getLegColour(leg);
  const isWalking = leg.mode?.id === "walking";
  const lineName =
    leg.routeOptions?.[0]?.lineIdentifier?.name || leg.mode?.name || "";

  /*
   * Intermediate stops (stations passed through).
   * Exclude the last stop — that's the arrival station which is
   * already shown as the next leg's departure or as the final destination.
   */
  const allStops = leg.path?.stopPoints || [];
  const stops = allStops.length > 1 ? allStops.slice(0, -1) : allStops;
  const hasStops = stops.length > 0 && !isWalking;
  const [showStops, setShowStops] = useState(false);

  return (
    <div className="flex gap-3">
      {/* ---- Vertical line with station dots ---- */}
      <div className="flex flex-col items-center w-4 shrink-0">
        {/* Departure station dot */}
        <div
          className="w-3 h-3 rounded-full border-2 shrink-0"
          style={{ borderColor: colour, backgroundColor: "transparent" }}
          aria-hidden="true"
        />

        {/* Connecting line (solid for transit, dashed for walking) */}
        <div
          className={cn("w-0.5 flex-1 min-h-[2rem]", isWalking && "opacity-50")}
          style={{
            backgroundColor: isWalking ? undefined : colour,
            borderLeft: isWalking
              ? `2px dashed ${colour}`
              : undefined,
          }}
          aria-hidden="true"
        />

        {/* Arrival station dot (only on last leg) */}
        {isLast && (
          <div
            className="w-3 h-3 rounded-full border-2 shrink-0"
            style={{ borderColor: colour, backgroundColor: colour }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* ---- Leg details ---- */}
      <div className="flex-1 pb-3 min-w-0">
        {/* Departure station */}
        <div className="font-mono text-sm tracking-wider text-amber uppercase">
          {cleanStationName(leg.departurePoint?.commonName || "")}
        </div>

        {/* Line info and duration */}
        <div className="flex items-center gap-2 mt-1 mb-1">
          {/* Small coloured line indicator */}
          <div
            className={cn(
              "h-0.5 w-6 shrink-0",
              isWalking && "border-t border-dashed"
            )}
            style={{
              backgroundColor: isWalking ? undefined : colour,
              borderColor: isWalking ? colour : undefined,
            }}
            aria-hidden="true"
          />

          {/* Line name */}
          <span className="font-mono text-sm tracking-wider text-amber amber-glow uppercase truncate">
            {isWalking ? "Walk" : lineName}
          </span>

          {/* Duration */}
          <span className="font-mono text-sm tracking-wider text-amber amber-glow shrink-0">
            {leg.duration} MIN
          </span>

          {/* Expand stops button */}
          {hasStops && (
            <button
              onClick={() => setShowStops(!showStops)}
              className="flex items-center gap-1 text-amber-faint hover:text-amber transition-colors shrink-0 ml-1"
              aria-label={showStops ? "Hide stops" : `Show ${stops.length} stops`}
            >
              <span className="font-mono text-[10px] tracking-wider">
                {stops.length} STOPS
              </span>
              {showStops ? (
                <ChevronUp size={10} strokeWidth={1.5} />
              ) : (
                <ChevronDown size={10} strokeWidth={1.5} />
              )}
            </button>
          )}
        </div>

        {/* Intermediate stops (expandable) */}
        {showStops && hasStops && (
          <div className="ml-8 mb-2 space-y-0.5">
            {stops.map((stop, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="w-1 h-1 rounded-full shrink-0"
                  style={{ backgroundColor: colour }}
                  aria-hidden="true"
                />
                <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
                  {cleanStationName(stop.name)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Arrival station (shown on last leg) */}
        {isLast && (
          <div className="font-mono text-sm tracking-wider text-amber uppercase mt-1">
            {cleanStationName(leg.arrivalPoint?.commonName || "")}
          </div>
        )}
      </div>

      {/* ---- Departure time ---- */}
      <div className="shrink-0">
        <span className="font-mono text-sm tracking-wider text-amber amber-glow">
          {formatTime(leg.departureTime)}
        </span>
      </div>
    </div>
  );
}
