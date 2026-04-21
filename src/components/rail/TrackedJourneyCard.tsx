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

import { useEffect, useMemo } from "react";
import { Trash2, ArrowRight, Armchair, Pencil } from "lucide-react";
import { cn, cleanStationName } from "@/lib/utils";
import { shortOperatorName } from "@/lib/rail-operators";
import { useTrackedRailService } from "@/hooks/useTrackedRailService";
import type { TrackedRailJourney } from "@/lib/db";
import type { RailDeparture, CallingPoint } from "@/lib/rail-types";

interface TrackedJourneyCardProps {
  journey: TrackedRailJourney;
  /** Called when the user taps the card — passes the matched live
      RailDeparture (or null if live data isn't available yet/ever). */
  onOpen: (journey: TrackedRailJourney, live: RailDeparture | null) => void;
  onRemove: (id: string) => void;
  /** Called when the user taps EDIT SEAT / + SEAT */
  onEditSeat: (id: string) => void;
  /**
   * Called when live data first resolves a more accurate destination
   * ETA than what was stored when the user tracked. Used to correct
   * the auto-clear timing for journeys planned days in advance.
   */
  onEtaResolved?: (
    id: string,
    destinationEta: string,
    serviceId?: string
  ) => void;
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
  onEditSeat,
  onEtaResolved,
}: TrackedJourneyCardProps) {
  const today = localDateString();
  const isToday = journey.travelDate === today;

  /*
   * Live data for the tracked service. Uses a destination-arrivals
   * lookup so journeys still resolve AFTER the train has left its
   * origin station — vital for the "I'm on this train already" case.
   */
  const { departure: liveDeparture } = useTrackedRailService({
    fromCrs: journey.fromCrs,
    toCrs: journey.toCrs,
    scheduledDeparture: journey.scheduledDeparture,
    /* Don't burn API calls on future-dated journeys — the RDM arrival
       board only includes services within a short upcoming window. */
    enabled: isToday,
  });

  /*
   * Has the train already left its origin? True when today's clock
   * has passed the scheduled departure time. Used to flip the status
   * badge to "EN ROUTE" so the user sees at a glance that the journey
   * is in progress — different from a pre-departure "ON TIME" status.
   */
  const hasDeparted = useMemo(() => {
    if (!isToday) return false;
    const now = new Date();
    const dep = localDateTime(journey.travelDate, journey.scheduledDeparture);
    return !!dep && now.getTime() >= dep.getTime();
  }, [isToday, journey.travelDate, journey.scheduledDeparture]);

  /* Status text + colour for live data; falls back to scheduled state. */
  const status = useMemo(() => {
    if (!liveDeparture) {
      return {
        label: isToday ? "SCHEDULED" : formatTravelDate(journey.travelDate),
        colour: "#cc7700",
      };
    }
    if (liveDeparture.cancelled) {
      return { label: "CANCELLED", colour: "#ff3b30" };
    }
    /* In-progress: once the train has left, show EN ROUTE regardless
       of whether the origin departure was on time or slightly delayed. */
    if (hasDeparted) {
      return { label: "EN ROUTE", colour: "#34c759" };
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
  }, [liveDeparture, isToday, hasDeparted, journey.travelDate]);

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

  /*
   * Once live data resolves the destination's actual scheduled time,
   * sync that back to Dexie. Matters for journeys planned days in
   * advance where the user didn't know the arrival time — keeping the
   * stored destinationEta accurate means auto-clear kicks in 10 min
   * after the real arrival instead of at end-of-day.
   */
  const liveDestinationScheduled = destCallingPoint?.scheduledTime ?? null;
  const liveServiceId = liveDeparture?.serviceId ?? undefined;
  useEffect(() => {
    if (!onEtaResolved) return;
    if (!liveDestinationScheduled) return;
    /* Skip if the stored value already matches what live data says. */
    if (liveDestinationScheduled === journey.destinationEta) return;
    onEtaResolved(journey.id, liveDestinationScheduled, liveServiceId);
  }, [
    journey.id,
    journey.destinationEta,
    liveDestinationScheduled,
    liveServiceId,
    onEtaResolved,
  ]);

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(journey.id);
  };

  const handleEditSeat = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditSeat(journey.id);
  };

  const hasSeat = !!(journey.seatCoach || journey.seatNumber);

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
      {/* Top row: TRACKING label + travel-date chip + operator + remove button */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-mono text-[10px] tracking-wider text-amber uppercase">
          {hasDeparted ? "ON BOARD" : "TRACKING"}
        </span>
        <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
          {formatTravelDate(journey.travelDate)}
        </span>
        {liveDeparture?.operator && (
          <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
            · {shortOperatorName(liveDeparture.operator)}
          </span>
        )}
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

      {/*
       * Seat reservation pill — always visible (so the user can add
       * one even before travel day). When no seat is saved, reads
       * "+ SEAT" as an affordance to tap to enter one.
       */}
      <div className="mt-1.5">
        <button
          onClick={handleEditSeat}
          aria-label={
            hasSeat ? "Edit seat reservation" : "Add seat reservation"
          }
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1 border transition-colors",
            "font-mono text-[10px] tracking-wider uppercase",
            hasSeat
              ? "border-amber text-amber hover:bg-amber/10"
              : "border-board-border text-amber-faint hover:border-amber-faint hover:text-amber"
          )}
        >
          {hasSeat ? (
            <>
              <Armchair size={11} strokeWidth={1.5} />
              <span>
                {journey.seatCoach && `COACH ${journey.seatCoach}`}
                {journey.seatCoach && journey.seatNumber && " · "}
                {journey.seatNumber && `SEAT ${journey.seatNumber}`}
              </span>
              <Pencil size={10} strokeWidth={1.5} className="opacity-70" />
            </>
          ) : (
            <>
              <Armchair size={11} strokeWidth={1.5} />
              <span>+ SEAT</span>
            </>
          )}
        </button>
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
