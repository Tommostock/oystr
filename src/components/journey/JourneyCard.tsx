/**
 * JourneyCard.tsx — A single journey option card
 *
 * Shows one journey option returned by the TfL Journey API.
 * Displays the total time, departure/arrival times,
 * and all journey legs with coloured line indicators.
 *
 * Tappable to expand and see the step-by-step breakdown.
 *
 * Usage:
 *   <JourneyCard journey={journey} />
 */

"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Clock } from "lucide-react";
import type { Journey } from "@/lib/tfl-types";
import JourneyLegDisplay from "./JourneyLegDisplay";
import { LINE_COLOURS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface JourneyCardProps {
  /** The journey data from TfL */
  journey: Journey;
  /** Index for display (1st, 2nd, 3rd option) */
  index: number;
}

/**
 * Format an ISO time string to HH:MM.
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

export default function JourneyCard({ journey, index }: JourneyCardProps) {
  /* Whether the step-by-step breakdown is expanded */
  const [isExpanded, setIsExpanded] = useState(index === 0);

  const departureTime = formatTime(journey.startDateTime);
  const arrivalTime = formatTime(journey.arrivalDateTime);

  return (
    <div className="border border-board-border bg-surface">
      {/* ---- Summary Header (always visible) ---- */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left p-3 flex items-center gap-3 hover:bg-board-border/30 transition-colors"
        aria-expanded={isExpanded}
      >
        {/* Time range */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm tracking-wider text-amber">
              {departureTime}
            </span>
            <span className="font-mono text-xs tracking-wider text-amber-faint">
              --&gt;
            </span>
            <span className="font-mono text-sm tracking-wider text-amber">
              {arrivalTime}
            </span>
          </div>

          {/* Line colour pills — quick visual of which lines are used */}
          <div className="flex items-center gap-1 mt-1.5">
            {journey.legs
              .filter((leg) => leg.mode?.id !== "walking")
              .map((leg, i) => {
                const lineId = leg.routeOptions?.[0]?.lineIdentifier?.id;
                const colour = lineId
                  ? LINE_COLOURS[lineId] || "#FF9500"
                  : "#FF9500";
                return (
                  <div
                    key={i}
                    className="h-1.5 rounded-full"
                    style={{
                      backgroundColor: colour,
                      width: `${Math.max(leg.duration * 2, 12)}px`,
                    }}
                    title={
                      leg.routeOptions?.[0]?.lineIdentifier?.name ||
                      leg.mode?.name
                    }
                    aria-hidden="true"
                  />
                );
              })}
          </div>
        </div>

        {/* Total duration */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Clock size={12} strokeWidth={1.5} className="text-amber-faint" />
          <span className="font-mono text-sm tracking-wider text-amber amber-glow">
            {journey.duration} MIN
          </span>
        </div>

        {/* Expand/collapse chevron */}
        <span className="text-amber-faint shrink-0">
          {isExpanded ? (
            <ChevronUp size={14} strokeWidth={1.5} />
          ) : (
            <ChevronDown size={14} strokeWidth={1.5} />
          )}
        </span>
      </button>

      {/* ---- Expanded Step-by-Step ---- */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-board-border pt-3">
          {journey.legs.map((leg, i) => (
            <JourneyLegDisplay
              key={i}
              leg={leg}
              isLast={i === journey.legs.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
