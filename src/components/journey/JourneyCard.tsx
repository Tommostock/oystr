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
import { ChevronDown, ChevronUp, Clock, Share2 } from "lucide-react";
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

        {/* Duration and fare */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1.5">
            <Clock size={12} strokeWidth={1.5} className="text-amber-faint" />
            <span className="font-mono text-sm tracking-wider text-amber amber-glow">
              {journey.duration} MIN
            </span>
          </div>
          {/* Oyster fare — single adult pay-as-you-go */}
          {journey.fare && (
            <span className="font-mono text-xs tracking-wider text-good">
              {"\u00A3"}{(journey.fare.totalCost / 100).toFixed(2)}
            </span>
          )}
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

          {/* Fare breakdown */}
          {journey.fare && journey.fare.fares.length > 0 && (
            <div className="mt-3 pt-2 border-t border-board-border/50">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs tracking-wider text-amber-faint uppercase">
                  OYSTER / CONTACTLESS FARE
                </span>
                <span className="font-mono text-sm tracking-wider text-good amber-glow">
                  {"\u00A3"}{(journey.fare.totalCost / 100).toFixed(2)}
                </span>
              </div>
              {journey.fare.fares[0] && (
                <div className="flex gap-4 mt-1">
                  <span className="font-mono text-xs tracking-wider text-amber-faint">
                    PEAK: {"\u00A3"}{(journey.fare.fares[0].peak / 100).toFixed(2)}
                  </span>
                  <span className="font-mono text-xs tracking-wider text-amber-faint">
                    OFF-PEAK: {"\u00A3"}{(journey.fare.fares[0].offPeak / 100).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Share button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              const steps = journey.legs
                .map((leg) => {
                  const line = leg.routeOptions?.[0]?.lineIdentifier?.name;
                  const mode = leg.mode?.name;
                  const from = leg.departurePoint?.commonName?.replace(/ Underground Station$/i, "").replace(/ Station$/i, "") || "";
                  const to = leg.arrivalPoint?.commonName?.replace(/ Underground Station$/i, "").replace(/ Station$/i, "") || "";
                  if (mode === "walking") return `Walk from ${from} to ${to} (${leg.duration} min)`;
                  return `${line || mode} from ${from} to ${to} (${leg.duration} min)`;
                })
                .join("\n");
              const fare = journey.fare ? ` -- \u00A3${(journey.fare.totalCost / 100).toFixed(2)}` : "";
              const text = `Journey: ${journey.duration} min${fare}\n\n${steps}\n\nPlanned with Oystr`;

              if (navigator.share) {
                navigator.share({ text }).catch(() => {});
              } else {
                navigator.clipboard.writeText(text).then(() => {
                  alert("Journey copied to clipboard");
                });
              }
            }}
            className="mt-3 pt-2 border-t border-board-border/50 w-full flex items-center justify-center gap-2 py-2 font-mono text-xs tracking-wider text-amber-faint hover:text-amber transition-colors"
          >
            <Share2 size={12} strokeWidth={1.5} />
            <span>SHARE JOURNEY</span>
          </button>
        </div>
      )}
    </div>
  );
}
