/**
 * TrackedJourneyCard.tsx — Pinned card for the user's active / upcoming rail journey
 *
 * Shows a single tracked journey (e.g. "I'm on the 08:40 KGX -> LDS").
 * On the travel day, polls live departures to show real-time status,
 * platform, next stop, and live destination ETA. On a future date,
 * shows only the scheduled info with a "TRAVELS Fri 24 Apr" note.
 *
 * Tapping the card reopens the calling-points popup for this service.
 */

"use client";

import { useMemo } from "react";
import { Trash2, ArrowRight } from "lucide-react";
import { cn, cleanStationName } from "@/lib/utils";
import { useRailDepartures } from "@/hooks/useRailDepartures";
import type { TrackedRailJourney } from "@/lib/db";
import type { RailDeparture, CallingPoint } from "@/lib/rail-types";

interface TrackedJourneyCardProps {
  journey: TrackedRailJourney;
  /** Called when the user taps the card — passes the matched live
      RailDeparture (or null if live data isn't available yet/ever). */
  onOpen: (journey: TrackedRailJourney, live: RailDeparture | null) => void;
  onRemove: (id: string) => void;
}

/** Local YYYY-MM-DD for "today". Avoids the UTC shift from toISOString(). */
function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse "HH:mm" on a given YYYY-MM-DD in local time to a Date. */
function localDateTime(dateStr: string, hhmm: string): Date | null {
  const iso = `${dateStr}T${hhmm}:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Given the calling points and current time, return the next upcoming
 * stop — the first one whose estimated/scheduled time hasn't passed.
 */
function findNextStop(
  callingPoints: CallingPoint[],
  travelDate: string,
  now: Date = new Date()
): CallingPoint | null {
  for (const cp of callingPoints) {
    const when = localDateTime(
      travelDate,
      cp.estimatedTime && cp.estimatedTime !== "On time"
        ? cp.estimatedTime
        : cp.scheduledTime
    );
    if (when && when.getTime() >= now.getTime()) return cp;
  }
  return null;
}

/**
 * Derive a short display string for a travel date, relative to today.
 *   today       -> "TODAY"
 *   tomorrow    -> "TOMORROW"
 *   anything else -> "FRI 24 APR"
 */
function formatTravelDate(travelDate: string): string {
  const today = localDateString();
  if (travelDate === today) return "TODAY";

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (travelDate === localDateString(tomorrow)) return "TOMORROW";

  const parsed = localDateTime(travelDate, "00:00");
  if (!parsed) return travelDate;
  return parsed
    .toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    })
    .toUpperCase();
}

export default function TrackedJourneyCard({
  journey,
  onOpen,
  onRemove,
}: TrackedJourneyCardProps) {
  const today = localDateString();
  const isToday = journey.travelDate === today;

  /*
   * Only poll live data on the travel day itself — RDM only returns
   * live departures for services imminently running, so querying for
   * future dates would waste bandwidth and always come back empty.
   */
  const { departures } = useRailDepartures({
    fromCrs: isToday ? journey.fromCrs : null,
    toCrs: isToday ? journey.toCrs : null,
    numRows: 15,
  });

  /* Find the live RailDeparture matching our tracked service. */
  const liveDeparture = useMemo<RailDeparture | null>(() => {
    if (!isToday || departures.length === 0) return null;
    const match = departures.find(
      (d) => d.scheduledDeparture === journey.scheduledDeparture
    );
    return match ?? null;
  }, [isToday, departures, journey.scheduledDeparture]);

  /* Status text + colour for live data; falls back to scheduled state. */
  const status = useMemo(() => {
    if (!liveDeparture) {
      return { label: isToday ? "SCHEDULED" : formatTravelDate(journey.travelDate), colour: "#cc7700" };
    }
    if (liveDeparture.cancelled) {
      return { label: "CANCELLED", colour: "#ff3b30" };
    }
    if (liveDeparture.estimatedDeparture === "On time") {
      return { label: "ON TIME", colour: "#34c759" };
    }
    if (
      liveDeparture.delayed &&
      liveDeparture.estimatedDeparture &&
      liveDeparture.estimatedDeparture !== liveDeparture.scheduledDeparture
    ) {
      return {
        label: `EXP ${liveDeparture.estimatedDeparture}`,
        colour: "#ff9500",
      };
    }
    return {
      label: liveDeparture.estimatedDeparture.toUpperCase() || "SCHEDULED",
      colour: "#ff9500",
    };
  }, [liveDeparture, isToday, journey.travelDate]);

  /* Next stop + destination ETA from the live calling points. */
  const nextStop = useMemo(() => {
    if (!liveDeparture) return null;
    return findNextStop(liveDeparture.callingPoints, journey.travelDate);
  }, [liveDeparture, journey.travelDate]);

  const destCallingPoint = useMemo(() => {
    if (!liveDeparture) return null;
    return (
      liveDeparture.callingPoints.find(
        (cp) => cp.crs === journey.toCrs.toUpperCase()
      ) ?? null
    );
  }, [liveDeparture, journey.toCrs]);

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(journey.id);
  };

  return (
    <div
      onClick={() => onOpen(journey, liveDeparture)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(journey, liveDeparture);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Tracked journey: ${journey.fromName} to ${journey.toName}`}
      className={cn(
        /*
         * Amber-outlined pinned card to stand out above the saved-routes
         * strip. Glow effect only on the active-today state to read as
         * "this is happening now". Future-dated journeys keep the
         * dim border so they don't shout.
         */
        "relative border bg-surface p-3 transition-colors cursor-pointer",
        "focus:outline-none",
        liveDeparture
          ? "border-amber amber-glow"
          : "border-amber-faint hover:border-amber focus:border-amber"
      )}
    >
      {/* Top row: TRACKING label + travel-date chip + remove button */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-mono text-[10px] tracking-wider text-amber uppercase">
          {liveDeparture ? "ON BOARD" : "TRACKING"}
        </span>
        <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
          {formatTravelDate(journey.travelDate)}
        </span>
        <button
          onClick={handleRemove}
          className="ml-auto shrink-0 p-1 text-amber-faint hover:text-red-500 transition-colors"
          aria-label={`Remove tracked journey ${journey.fromName} to ${journey.toName}`}
        >
          <Trash2 size={12} strokeWidth={1.5} />
        </button>
      </div>

      {/* Route header */}
      <div className="flex items-center gap-2 mb-2 min-w-0">
        <span className="font-mono text-sm tracking-wider text-amber uppercase truncate">
          {cleanStationName(journey.fromName)}
        </span>
        <ArrowRight
          size={14}
          className="shrink-0 text-amber-faint"
          strokeWidth={1.5}
        />
        <span className="font-mono text-sm tracking-wider text-amber uppercase truncate">
          {cleanStationName(journey.toName)}
        </span>
      </div>

      {/* Departure time + live status */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-board text-2xl text-amber amber-glow tracking-wider">
          {journey.scheduledDeparture}
        </span>
        <span
          className="font-mono text-[11px] tracking-wider uppercase"
          style={{ color: status.colour }}
        >
          {status.label}
        </span>
        {liveDeparture?.platform && (
          <span className="ml-auto font-mono text-[10px] tracking-wider text-amber-faint uppercase">
            PL {liveDeparture.platform}
          </span>
        )}
      </div>

      {/* Live detail rows — only when live data is available. */}
      {liveDeparture && (
        <div className="mt-2 pt-2 border-t border-board-border/60 space-y-1">
          {nextStop && (
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase w-16 shrink-0">
                NEXT
              </span>
              <span className="font-mono text-xs tracking-wider text-amber uppercase truncate flex-1">
                {nextStop.name}
              </span>
              <span className="font-board text-sm text-amber amber-glow tracking-wider">
                {nextStop.estimatedTime && nextStop.estimatedTime !== "On time"
                  ? nextStop.estimatedTime
                  : nextStop.scheduledTime}
              </span>
            </div>
          )}
          {destCallingPoint && (
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase w-16 shrink-0">
                ARRIVE
              </span>
              <span className="font-mono text-xs tracking-wider text-amber uppercase truncate flex-1">
                {cleanStationName(journey.toName)}
              </span>
              <span
                className="font-board text-sm tracking-wider amber-glow"
                style={{
                  color: destCallingPoint.cancelled ? "#ff3b30" : "#ff9500",
                }}
              >
                {destCallingPoint.cancelled
                  ? "CXL"
                  : destCallingPoint.estimatedTime &&
                      destCallingPoint.estimatedTime !== "On time"
                    ? destCallingPoint.estimatedTime
                    : destCallingPoint.scheduledTime}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
