/**
 * SavedRouteCard.tsx — Pinned card for a saved National Rail route
 *
 * Shows a user's saved FROM -> TO route with the next two live departures
 * inline, so they can glance at the Rail page and immediately see when
 * their next train leaves.
 *
 * Layout:
 *   [FROM] --> [TO]                    [X remove]
 *   HH:mm ON TIME           HH:mm EXP HH:mm
 *
 * Tapping the card tells the parent to load the full board for this route.
 */

"use client";

import { Trash2, ArrowRight } from "lucide-react";
import { useRailDepartures } from "@/hooks/useRailDepartures";
import { cn } from "@/lib/utils";
import type { SavedRailJourney } from "@/lib/db";

interface SavedRouteCardProps {
  journey: SavedRailJourney;
  /** Called when the card body is tapped — opens the full board */
  onOpen: (journey: SavedRailJourney) => void;
  /** Called when the user taps the remove (X) button */
  onRemove: (id: string) => void;
}

/**
 * Build a short status label for a single inline departure.
 */
function departureLabel(dep: {
  scheduledDeparture: string;
  estimatedDeparture: string;
  cancelled: boolean;
  delayed: boolean;
}): { time: string; status: string; colour: string } {
  if (dep.cancelled) {
    return {
      time: dep.scheduledDeparture || "--:--",
      status: "CANCELLED",
      colour: "#ff3b30",
    };
  }
  if (dep.delayed && dep.estimatedDeparture) {
    return {
      time: dep.scheduledDeparture,
      status: `EXP ${dep.estimatedDeparture}`,
      colour: "#ff9500",
    };
  }
  if (dep.estimatedDeparture === "On time") {
    return {
      time: dep.scheduledDeparture,
      status: "ON TIME",
      colour: "#34c759",
    };
  }
  return {
    time: dep.scheduledDeparture || "--:--",
    status: (dep.estimatedDeparture || "").toUpperCase(),
    colour: "#ff9500",
  };
}

export default function SavedRouteCard({
  journey,
  onOpen,
  onRemove,
}: SavedRouteCardProps) {
  /* Fetch just 2 rows — enough to show "next two departures" inline */
  const { departures, isLoading, notConfigured } = useRailDepartures({
    fromCrs: journey.fromCrs,
    toCrs: journey.toCrs,
    numRows: 2,
  });

  const nextTwo = departures.slice(0, 2);

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(journey.id);
  };

  return (
    <div
      onClick={() => onOpen(journey)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(journey);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Show ${journey.fromName} to ${journey.toName} departures`}
      className={cn(
        "border border-board-border bg-surface p-3",
        "cursor-pointer hover:border-amber-faint focus:border-amber-faint focus:outline-none",
        "transition-colors duration-200"
      )}
    >
      {/* ---- Route header ---- */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="font-mono text-sm tracking-wider text-amber uppercase truncate">
            {journey.fromName}
          </span>
          <ArrowRight
            size={14}
            className="shrink-0 text-amber-faint"
            strokeWidth={1.5}
          />
          <span className="font-mono text-sm tracking-wider text-amber uppercase truncate">
            {journey.toName}
          </span>
        </div>
        <button
          onClick={handleRemove}
          className="shrink-0 p-1.5 text-amber-faint hover:text-red-500 transition-colors"
          aria-label={`Remove ${journey.fromName} to ${journey.toName} from saved`}
        >
          <Trash2 size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* ---- Inline departures ---- */}
      <div className="mt-2 flex items-center gap-4">
        {notConfigured ? (
          <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
            RAIL SERVICE UNAVAILABLE
          </span>
        ) : isLoading && nextTwo.length === 0 ? (
          <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase animate-blink">
            LOADING...
          </span>
        ) : nextTwo.length === 0 ? (
          <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
            NO DIRECT TRAINS
          </span>
        ) : (
          nextTwo.map((dep, i) => {
            const label = departureLabel(dep);
            return (
              <div key={`${dep.serviceId}-${i}`} className="flex items-baseline gap-1.5">
                <span className="font-board text-base text-amber amber-glow tracking-wider">
                  {label.time}
                </span>
                <span
                  className="font-mono text-[10px] tracking-wider uppercase"
                  style={{ color: label.colour }}
                >
                  {label.status}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
