/**
 * TrackedFlightCard.tsx — Pinned card for a tracked flight
 *
 * Shows a single tracked flight (e.g. "I'm on BA175 on 22 Apr").
 * On the travel day, polls live flight-detail data to show real
 * status / terminal / gate. On a future date, shows only what was
 * stored at tracking time + "TRAVELS FRI 24 APR" label.
 *
 * Tapping the card navigates to /flights/flight/[number] for the
 * full live view; a small seat icon opens the multi-seat editor;
 * a trash icon removes the tracked flight from IndexedDB.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Trash2,
  ArrowRight,
  Armchair,
  Pencil,
  Calendar,
  Clock,
  Map,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFlightDetail } from "@/hooks/useFlightDetail";
import { formatAirportFullName } from "@/lib/airports";
import { getTransportOptions } from "@/lib/airport-transport";
import type { TrackedFlight } from "@/lib/db";
import type { FlightStatus } from "@/lib/flight-types";

interface TrackedFlightCardProps {
  flight: TrackedFlight;
  /** Called when the trash icon is tapped */
  onRemove: (id: string) => void;
  /** Called when EDIT SEATS / + SEATS is tapped */
  onEditSeats: (id: string) => void;
}

/** Local YYYY-MM-DD for "today" (avoids UTC shift from toISOString). */
function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Short relative-date label:
 *   today       -> "TODAY"
 *   tomorrow    -> "TOMORROW"
 *   other       -> "FRI 24 APR"
 */
function formatTravelDate(travelDate: string): string {
  const today = localDateString();
  if (travelDate === today) return "TODAY";

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (travelDate === localDateString(tomorrow)) return "TOMORROW";

  const parsed = new Date(`${travelDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return travelDate;
  return parsed
    .toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    })
    .toUpperCase();
}

/**
 * Always-show date label that combines the absolute date with a
 * "TODAY" / "TOMORROW" prefix when relevant, so the user sees both
 * at a glance (e.g. "WED 22 APR · TODAY").
 */
function formatTravelDateLong(travelDate: string): string {
  const parsed = new Date(`${travelDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return travelDate;
  const absolute = parsed
    .toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    })
    .toUpperCase();

  const today = localDateString();
  if (travelDate === today) return `${absolute} -- TODAY`;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (travelDate === localDateString(tomorrow)) return `${absolute} -- TOMORROW`;

  return absolute;
}

/** Colour class for the status chip — matches the detail page. */
function statusChipClasses(status: FlightStatus): string {
  switch (status) {
    case "on-time":
    case "boarding":
    case "landed":
      return "border-good text-good";
    case "cancelled":
    case "diverted":
    case "gate-closed":
      return "border-bad text-bad";
    case "delayed":
      return "border-amber text-amber amber-glow";
    default:
      return "border-amber-faint text-amber-faint";
  }
}

function prettyStatus(status: FlightStatus): string {
  switch (status) {
    case "on-time":     return "ON TIME";
    case "gate-closed": return "GATE CLOSED";
    case "unknown":     return "SCHEDULED";
    default:            return status.toUpperCase();
  }
}

/* ========================================
 * COUNTDOWN
 * Drives the urgency messaging on the card. Defaults:
 *   gate closes ~15 min before departure
 *   boarding starts ~45 min before departure
 *   check-in recommended ~2 h before international, ~90 min domestic
 *
 * We don't know whether the flight is international from a tracked
 * record alone, so the boarding/gate-close markers are kept as a
 * generic heuristic that's conservative enough for most scenarios.
 *
 * Returns an object with a label (one short string) and an optional
 * urgency level — the caller can colour the chip accordingly.
 * ======================================== */
function computeCountdown(
  travelDate: string,
  scheduledDeparture: string,
  liveDepartureLocal: string | null | undefined,
  nowMs: number
): { label: string; urgency: "calm" | "soon" | "urgent" | "none" } {
  // Prefer the live (estimated/actual) time if different from scheduled.
  const hhmm = liveDepartureLocal || scheduledDeparture;
  if (!travelDate || !hhmm) return { label: "", urgency: "none" };

  const target = new Date(`${travelDate}T${hhmm}:00`);
  if (Number.isNaN(target.getTime())) return { label: "", urgency: "none" };

  const deltaMs = target.getTime() - nowMs;
  const deltaMin = Math.round(deltaMs / 60_000);

  if (deltaMin <= -60) return { label: "", urgency: "none" };
  if (deltaMin <= 0) return { label: "DEPARTED", urgency: "none" };

  // Gate closes ~15 min before departure
  if (deltaMin <= 15) {
    return { label: `GATE CLOSES IN ${deltaMin} MIN`, urgency: "urgent" };
  }
  // Boarding ~45 min before departure
  if (deltaMin <= 45) {
    const boardMin = deltaMin - 15;
    return { label: `BOARDS IN ${boardMin} MIN`, urgency: "urgent" };
  }
  if (deltaMin <= 120) {
    return { label: `BOARDS IN ${deltaMin - 45} MIN`, urgency: "soon" };
  }

  // Beyond 2h — friendly hours/minutes countdown.
  if (deltaMin < 60 * 24) {
    const h = Math.floor(deltaMin / 60);
    const m = deltaMin % 60;
    const label = m === 0 ? `DEPARTS IN ${h}H` : `DEPARTS IN ${h}H ${m}M`;
    return { label, urgency: "calm" };
  }

  // Days away — show days.
  const days = Math.ceil(deltaMin / (60 * 24));
  return {
    label: days === 1 ? "DEPARTS TOMORROW" : `DEPARTS IN ${days} DAYS`,
    urgency: "calm",
  };
}

function countdownChipClasses(
  urgency: "calm" | "soon" | "urgent" | "none"
): string {
  switch (urgency) {
    case "urgent":
      return "border-bad text-bad bg-bad/10";
    case "soon":
      return "border-amber text-amber amber-glow bg-amber/10";
    case "calm":
      return "border-amber-faint text-amber";
    default:
      return "hidden";
  }
}

/** Reactive now() that ticks every 30 s so countdown chips stay live. */
function useNowTicker(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function TrackedFlightCard({
  flight,
  onRemove,
  onEditSeats,
}: TrackedFlightCardProps) {
  const router = useRouter();

  /*
   * Only fetch live data when the travel day matches — calling the
   * flight-by-number endpoint days early burns through the free-tier
   * quota and the provider rarely has useful data that far out.
   */
  const today = localDateString();
  const shouldFetchLive = flight.travelDate === today;

  const { flight: live } = useFlightDetail({
    flightNumber: shouldFetchLive ? flight.flightNumber : null,
  });

  const isFuture = flight.travelDate > today;
  const isPast = flight.travelDate < today;

  /*
   * Use the disambiguated full airport name so London Gatwick vs
   * London Heathrow (and similar) are never guessable — critical
   * because every major city has multiple airports and "LONDON"
   * alone tells you nothing useful.
   */
  const fromFullName = formatAirportFullName({
    name: flight.departureName,
    city: flight.departureCity,
  });
  const toFullName = formatAirportFullName({
    name: flight.arrivalName,
    city: flight.arrivalCity,
  });

  /*
   * Prefer the live departure time over the one we stored at
   * tracking time, so a last-minute schedule change gets reflected.
   */
  const displayDepTime =
    live?.departure.estimatedTime ||
    live?.departure.actualTime ||
    flight.scheduledDeparture;
  const scheduledDep = live?.departure.scheduledTime ?? flight.scheduledDeparture;

  const terminal = live?.departure.terminal ?? null;
  const gate = live?.departure.gate ?? null;

  /*
   * Status chip: prefer the live status when we have it, otherwise
   * show "SCHEDULED" as a placeholder. The travel-date is now always
   * visible in its own row above, so the chip doesn't need to carry
   * that information any more.
   */
  const status = live?.status;
  const statusLabel = status ? prettyStatus(status) : "SCHEDULED";
  const statusClasses = status
    ? statusChipClasses(status)
    : "border-amber-faint text-amber-faint";

  /*
   * Gate / boarding / departure countdown. Ticks every 30s so the
   * user doesn't need to refresh to watch the time shrink. Skipped
   * entirely on past / far-future flights (urgency === "none").
   */
  const now = useNowTicker(30_000);
  const countdown = computeCountdown(
    flight.travelDate,
    flight.scheduledDeparture,
    live?.departure.estimatedTime ?? null,
    now
  );

  const seats = flight.seats ?? [];
  const hasSeats = seats.length > 0;

  const handleCardClick = () => {
    router.push(`/flights/flight/${encodeURIComponent(flight.flightNumber)}`);
  };

  return (
    <div
      className={cn(
        "relative border bg-surface p-3 space-y-2.5 transition-colors",
        "border-amber amber-glow",
        isPast && "opacity-60"
      )}
    >
      {/* ---- Date header (always visible) ---- */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Calendar
            size={10}
            strokeWidth={1.5}
            className="text-amber-faint shrink-0"
          />
          <span className="font-mono text-[9px] tracking-widest text-amber-faint uppercase truncate">
            {formatTravelDateLong(flight.travelDate)}
          </span>
        </div>
        <button
          onClick={() => onRemove(flight.id)}
          className="shrink-0 p-1 text-amber-faint hover:text-red-500 transition-colors"
          aria-label={`Remove ${flight.flightNumber} from tracked flights`}
        >
          <Trash2 size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* ---- Flight number + airline ---- */}
      <button
        onClick={handleCardClick}
        className="text-left min-w-0 w-full block"
        aria-label={`Open ${flight.flightNumber} detail`}
      >
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-board text-xl tracking-wider text-amber amber-glow">
            {flight.flightNumber}
          </span>
          <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase truncate">
            {flight.airline}
          </span>
        </div>
      </button>

      {/* ---- Route: FROM --> TO (with full disambiguated airport names) ---- */}
      <button
        onClick={handleCardClick}
        className="w-full flex items-center gap-2 text-left"
        aria-label={`Open ${flight.flightNumber} detail`}
      >
        <div className="min-w-0 flex-1">
          <div className="font-board text-lg tracking-wider text-amber uppercase truncate">
            {flight.departureIata}
          </div>
          <div
            className="font-mono text-[9px] tracking-wider text-amber-faint uppercase truncate"
            title={fromFullName}
          >
            {fromFullName}
          </div>
        </div>
        <ArrowRight
          size={14}
          strokeWidth={1.5}
          className="text-amber-faint shrink-0"
        />
        <div className="min-w-0 flex-1 text-right">
          <div className="font-board text-lg tracking-wider text-amber uppercase truncate">
            {flight.arrivalIata}
          </div>
          <div
            className="font-mono text-[9px] tracking-wider text-amber-faint uppercase truncate"
            title={toFullName}
          >
            {toFullName}
          </div>
        </div>
      </button>

      {/* ---- Time + status chip ---- */}
      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-board-border">
        <span className="font-board text-base tracking-wider text-amber amber-glow">
          {displayDepTime}
        </span>
        {displayDepTime !== scheduledDep && (
          <span className="font-mono text-[9px] tracking-wider text-amber-faint uppercase">
            SCH {scheduledDep}
          </span>
        )}
        <span
          className={cn(
            "ml-auto inline-block px-1.5 py-0.5 font-mono text-[9px] tracking-widest uppercase border",
            statusClasses
          )}
        >
          {statusLabel}
        </span>
      </div>

      {/* ---- Terminal / gate (only when known, and on travel day) ---- */}
      {(terminal || gate) && (
        <div className="flex items-center gap-3 font-mono text-[10px] tracking-wider text-amber-faint uppercase">
          {terminal && (
            <span>
              TERM <span className="text-amber">{terminal}</span>
            </span>
          )}
          {gate && (
            <span>
              GATE <span className="text-amber">{gate}</span>
            </span>
          )}
        </div>
      )}

      {/* ---- Countdown chip: "DEPARTS IN 3H 15M" -> "BOARDS IN 45 MIN"
               -> "GATE CLOSES IN 10 MIN" as the departure approaches. ---- */}
      {countdown.urgency !== "none" && (
        <div
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1 border font-mono text-[10px] tracking-widest uppercase w-fit",
            countdownChipClasses(countdown.urgency)
          )}
        >
          <Clock size={10} strokeWidth={1.5} />
          {countdown.label}
        </div>
      )}

      {/* ---- Seats row: always rendered so editing is one tap away ---- */}
      <div className="flex items-center gap-2 pt-1 border-t border-board-border">
        <Armchair
          size={12}
          strokeWidth={1.5}
          className="text-amber-faint shrink-0"
        />
        <div className="flex-1 min-w-0">
          {hasSeats ? (
            <div className="flex flex-wrap gap-1">
              {seats.map((seat, i) => (
                <span
                  key={`${seat}-${i}`}
                  className="inline-block px-1.5 py-0.5 font-board text-xs tracking-wider text-amber border border-amber-faint uppercase"
                >
                  {seat}
                </span>
              ))}
            </div>
          ) : (
            <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
              NO SEATS ENTERED
            </span>
          )}
        </div>
        <button
          onClick={() => onEditSeats(flight.id)}
          className="shrink-0 flex items-center gap-1 px-2 py-1 font-mono text-[9px] tracking-wider text-amber-faint hover:text-amber border border-board-border hover:border-amber-faint uppercase transition-colors"
          aria-label={hasSeats ? `Edit seats for ${flight.flightNumber}` : `Add seats for ${flight.flightNumber}`}
        >
          {hasSeats ? (
            <>
              <Pencil size={9} strokeWidth={1.5} />
              EDIT
            </>
          ) : (
            <>
              <Pencil size={9} strokeWidth={1.5} />
              ADD
            </>
          )}
        </button>
      </div>

      {/* ---- How-to-get-there link — only when we have curated
               transport data for the departure airport (the 5 main
               London ones for now). Links to the airport page's
               GETTING HERE panel. ---- */}
      {getTransportOptions(flight.departureIata) && (
        <Link
          href={`/flights/airport/${flight.departureIata}#getting-here`}
          className="flex items-center justify-between gap-2 px-2 py-1.5 border border-board-border hover:border-amber-faint text-amber-faint hover:text-amber transition-colors font-mono text-[10px] tracking-widest uppercase"
          aria-label={`How to get to ${flight.departureIata}`}
        >
          <span className="flex items-center gap-1.5">
            <Map size={11} strokeWidth={1.5} />
            HOW TO GET TO {flight.departureIata}
          </span>
          <ArrowRight size={10} strokeWidth={1.5} />
        </Link>
      )}
    </div>
  );
}
