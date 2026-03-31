/**
 * ArrivalRow.tsx — Single arrival row on the departure board
 *
 * Displays one train/bus arrival in the classic TfL dot-matrix style.
 *
 * For tube/DLR/rail:
 *   [colour dot] [platform#] | DESTINATION | X MIN
 *
 * For buses:
 *   [route#] | DESTINATION | X MIN
 *
 * This is the core visual element of the app.
 * It must look exactly like the amber LED text on a real board.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useCountdown } from "@/hooks/useCountdown";

interface ArrivalRowProps {
  /** Destination station name */
  destination: string;
  /** Seconds until arrival — fallback if expectedArrival is missing */
  timeToStation: number;
  /** ISO timestamp of expected arrival — used for accurate countdown */
  expectedArrival?: string;
  /** Optional line colour for a small indicator dot */
  lineColour?: string;
  /** Bus route number (e.g. "98") — only for buses */
  routeNumber?: string;
  /** Transport mode (e.g. "bus", "tube") — used for bus-specific display */
  modeName?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Convert seconds to a human-readable time string.
 * - 0-30 seconds = "DUE" (train/bus is arriving now)
 * - 31-90 seconds = "1 MIN"
 * - 91+ seconds = "X MIN" (rounded down to nearest minute)
 */
function formatTime(seconds: number): string {
  if (seconds <= 30) return "DUE";
  const minutes = Math.floor(seconds / 60);
  return `${minutes} MIN`;
}

export default function ArrivalRow({
  destination,
  timeToStation,
  expectedArrival,
  lineColour,
  routeNumber,
  modeName,
  className,
}: ArrivalRowProps) {
  /* Live countdown — calculates from absolute timestamp for accuracy */
  const liveSeconds = useCountdown(expectedArrival, timeToStation);
  const timeText = formatTime(liveSeconds);
  /* "DUE" vehicles get a stronger glow to draw attention */
  const isDue = liveSeconds <= 30;
  /* Check if this is a bus arrival */
  const isBus = modeName === "bus";

  /*
   * Scroll animation — trigger when destination text changes.
   * Tracks the previous destination and adds a CSS animation class
   * when it changes, creating a dot-matrix scroll-in effect.
   */
  const [animating, setAnimating] = useState(false);
  const prevDestination = useRef(destination);

  useEffect(() => {
    if (destination !== prevDestination.current) {
      prevDestination.current = destination;
      setAnimating(true);
      const timer = setTimeout(() => setAnimating(false), 350);
      return () => clearTimeout(timer);
    }
  }, [destination]);

  return (
    <div
      className={cn(
        /* Horizontal layout: identifier | destination | time */
        "flex items-center gap-3 py-2.5",
        /* Bottom border to separate rows */
        "border-b border-board-border/50 last:border-b-0",
        className
      )}
      role="row"
      aria-label={`${isBus ? `Route ${routeNumber} to` : ""} ${destination}, ${timeText === "DUE" ? "due now" : timeText.toLowerCase()}`}
    >
      {/* ---- Left column: route number (bus) or platform (tube) ---- */}
      {isBus && routeNumber ? (
        /* Bus: show route number in a bordered box */
        <div className="shrink-0 w-12">
          <span
            className={cn(
              "inline-flex items-center justify-center",
              "min-w-[2.5rem] px-1.5 py-0.5",
              "border border-amber text-amber",
              "font-board text-lg tracking-wider"
            )}
          >
            {routeNumber}
          </span>
        </div>
      ) : (
        /* Tube/DLR: show line colour dot only */
        <div className="flex items-center shrink-0 w-5">
          {lineColour && (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: lineColour }}
              aria-hidden="true"
            />
          )}
        </div>
      )}

      {/* ---- Destination name (scrolls in like a real board) ---- */}
      <div className="flex-1 board-scroll-clip">
        <span
          className={cn(
            /* Take up remaining space, truncate if too long */
            "block truncate",
            /* Uppercase VT323 text — the classic departure board look */
            "text-amber font-board text-xl tracking-wider uppercase",
            /* Amber glow on the text */
            "amber-glow",
            /* Scroll animation when destination changes */
            animating && "board-scroll-in"
          )}
        >
          {destination}
        </span>
      </div>

      {/* ---- Time until arrival (scrolls in when value changes) ---- */}
      <div className="shrink-0 text-right min-w-[5rem] board-scroll-clip">
        <span
          className={cn(
            "block",
            /* VT323 departure board font */
            "font-board text-xl tracking-wider",
            /* DUE vehicles get bright glow, others are standard amber */
            isDue
              ? "text-amber amber-glow-strong animate-blink"
              : "text-amber amber-glow"
          )}
        >
          {timeText}
        </span>
      </div>
    </div>
  );
}
