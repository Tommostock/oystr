/**
 * TodaysFlightHero.tsx — Giant prominent panel for "the flight you
 * are actually flying TODAY".
 *
 * When a tracked flight has travelDate === today, render this at the
 * very top of /flights instead of forcing the user to scan the MY
 * FLIGHTS card list for the one that matters most right now. Live
 * data (terminal, gate, delay) is polled from the flight-by-number
 * endpoint via useFlightDetail.
 *
 * Only visible on travel day — renders null otherwise. The caller
 * filters its MY FLIGHTS list to skip the same record so there's no
 * duplication.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  Plane,
  ArrowRight,
  Armchair,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFlightDetail } from "@/hooks/useFlightDetail";
import { formatAirportFullName } from "@/lib/airports";
import { getTransportOptions } from "@/lib/airport-transport";
import type { TrackedFlight } from "@/lib/db";
import type { FlightStatus } from "@/lib/flight-types";

interface TodaysFlightHeroProps {
  flight: TrackedFlight;
}

/* ---------- Status + countdown helpers (same convention as
 * TrackedFlightCard so behaviour is consistent across the tab). */

function statusChipClasses(status: FlightStatus | undefined): string {
  switch (status) {
    case "on-time":
    case "boarding":
    case "landed":
      return "border-good text-good bg-good/10";
    case "cancelled":
    case "diverted":
    case "gate-closed":
      return "border-bad text-bad bg-bad/10";
    case "delayed":
      return "border-amber text-amber bg-amber/15 amber-glow";
    default:
      return "border-amber-faint text-amber-faint";
  }
}

function prettyStatus(status: FlightStatus | undefined): string {
  if (!status) return "SCHEDULED";
  switch (status) {
    case "on-time":     return "ON TIME";
    case "gate-closed": return "GATE CLOSED";
    case "unknown":     return "SCHEDULED";
    default:            return status.toUpperCase();
  }
}

/**
 * Countdown copy that adapts to how close the flight is. Returns
 * both the label and an urgency flag so the hero can change its
 * border colour as time runs out.
 */
function computeCountdown(
  travelDate: string,
  scheduledDeparture: string,
  liveDepartureLocal: string | null | undefined,
  nowMs: number
): { label: string; urgency: "calm" | "soon" | "urgent" | "gone" } {
  const hhmm = liveDepartureLocal || scheduledDeparture;
  if (!travelDate || !hhmm) return { label: "", urgency: "calm" };
  const target = new Date(`${travelDate}T${hhmm}:00`);
  if (Number.isNaN(target.getTime())) return { label: "", urgency: "calm" };

  const deltaMin = Math.round((target.getTime() - nowMs) / 60_000);

  if (deltaMin <= -60) return { label: "DEPARTED", urgency: "gone" };
  if (deltaMin <= 0) return { label: "DEPARTED", urgency: "gone" };
  if (deltaMin <= 15)
    return { label: `GATE CLOSES IN ${deltaMin} MIN`, urgency: "urgent" };
  if (deltaMin <= 45)
    return { label: `BOARDS IN ${deltaMin - 15} MIN`, urgency: "urgent" };
  if (deltaMin <= 120)
    return { label: `BOARDS IN ${deltaMin - 45} MIN`, urgency: "soon" };
  const h = Math.floor(deltaMin / 60);
  const m = deltaMin % 60;
  return {
    label: m === 0 ? `DEPARTS IN ${h}H` : `DEPARTS IN ${h}H ${m}M`,
    urgency: "calm",
  };
}

function useNowTicker(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function TodaysFlightHero({ flight }: TodaysFlightHeroProps) {
  const router = useRouter();

  /* Poll live detail for the hero so terminal / gate / delay are
     always current — this is the single most important piece of
     UI on travel day. */
  const { flight: live } = useFlightDetail({
    flightNumber: flight.flightNumber,
  });

  const now = useNowTicker(30_000);

  const fromFullName = formatAirportFullName({
    name: flight.departureName,
    city: flight.departureCity,
  });
  const toFullName = formatAirportFullName({
    name: flight.arrivalName,
    city: flight.arrivalCity,
  });

  const displayDepTime =
    live?.departure.estimatedTime ||
    live?.departure.actualTime ||
    flight.scheduledDeparture;
  const scheduledDep =
    live?.departure.scheduledTime ?? flight.scheduledDeparture;

  const terminal = live?.departure.terminal ?? null;
  const gate = live?.departure.gate ?? null;
  const checkIn = live?.departure.checkInDesk ?? null;

  const status = live?.status;
  const countdown = computeCountdown(
    flight.travelDate,
    flight.scheduledDeparture,
    live?.departure.estimatedTime ?? null,
    now
  );

  const urgencyBorder =
    countdown.urgency === "urgent"
      ? "border-bad"
      : countdown.urgency === "soon"
      ? "border-amber"
      : "border-amber";

  const hasTransport = !!getTransportOptions(flight.departureIata);
  const seats = flight.seats ?? [];

  return (
    <div
      className={cn(
        "relative border-2 bg-surface p-4 space-y-3 amber-glow",
        urgencyBorder
      )}
    >
      {/* Top stripe — "TODAY" label + live status */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-mono text-[10px] tracking-widest text-amber-faint uppercase flex items-center gap-1.5">
          <Plane size={10} strokeWidth={1.5} />
          TODAY'S FLIGHT
        </span>
        <span
          className={cn(
            "inline-block px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase border",
            statusChipClasses(status)
          )}
        >
          {prettyStatus(status)}
        </span>
      </div>

      {/* Flight number + airline */}
      <button
        onClick={() =>
          router.push(
            `/flights/flight/${encodeURIComponent(flight.flightNumber)}`
          )
        }
        className="w-full text-left"
        aria-label={`Open ${flight.flightNumber} detail`}
      >
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-board text-3xl tracking-wider text-amber amber-glow">
            {flight.flightNumber}
          </span>
          <span className="font-mono text-xs tracking-wider text-amber uppercase truncate">
            {flight.airline}
          </span>
        </div>
      </button>

      {/* Route: big IATA + full airport names */}
      <button
        onClick={() =>
          router.push(
            `/flights/flight/${encodeURIComponent(flight.flightNumber)}`
          )
        }
        className="w-full flex items-center gap-3 text-left"
        aria-label="Open flight detail"
      >
        <div className="min-w-0 flex-1">
          <div className="font-board text-3xl tracking-wider text-amber amber-glow uppercase">
            {flight.departureIata}
          </div>
          <div
            className="font-mono text-[10px] tracking-wider text-amber-faint uppercase truncate"
            title={fromFullName}
          >
            {fromFullName}
          </div>
        </div>
        <ArrowRight
          size={18}
          strokeWidth={1.5}
          className="text-amber-faint shrink-0"
        />
        <div className="min-w-0 flex-1 text-right">
          <div className="font-board text-3xl tracking-wider text-amber amber-glow uppercase">
            {flight.arrivalIata}
          </div>
          <div
            className="font-mono text-[10px] tracking-wider text-amber-faint uppercase truncate"
            title={toFullName}
          >
            {toFullName}
          </div>
        </div>
      </button>

      {/* Departure time + countdown */}
      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-board-border">
        <span className="font-board text-2xl tracking-wider text-amber amber-glow">
          {displayDepTime}
        </span>
        {displayDepTime !== scheduledDep && (
          <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
            SCH {scheduledDep}
          </span>
        )}
        {countdown.label && (
          <span
            className={cn(
              "ml-auto inline-flex items-center gap-1.5 px-2 py-1 border font-mono text-[11px] tracking-widest uppercase",
              countdown.urgency === "urgent"
                ? "border-bad text-bad bg-bad/10"
                : countdown.urgency === "soon"
                ? "border-amber text-amber bg-amber/10 amber-glow"
                : countdown.urgency === "gone"
                ? "border-board-border text-amber-faint"
                : "border-amber-faint text-amber"
            )}
          >
            <Clock size={11} strokeWidth={1.5} />
            {countdown.label}
          </span>
        )}
      </div>

      {/* Terminal / gate / check-in grid — surface the walk-up info */}
      {(terminal || gate || checkIn) && (
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-board-border">
          <HeroFact label="TERMINAL" value={terminal} />
          <HeroFact label="GATE" value={gate} />
          <HeroFact label="CHECK-IN" value={checkIn} />
        </div>
      )}

      {/* Footer chips: seats + how-to-get-there */}
      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-board-border">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-amber-faint uppercase">
          <Armchair size={11} strokeWidth={1.5} />
          {seats.length > 0 ? seats.join(" ") : "NO SEATS"}
        </span>

        {hasTransport && (
          <Link
            href={`/flights/airport/${flight.departureIata}#getting-here`}
            className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 border border-amber-faint text-amber hover:bg-amber/10 font-mono text-[10px] tracking-widest uppercase transition-colors"
          >
            <MapPin size={11} strokeWidth={1.5} />
            GET TO {flight.departureIata}
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * Small labelled fact cell — used in the terminal/gate/check-in
 * grid above. Shows "TBA" (dim) when the provider hasn't assigned
 * the field yet.
 */
function HeroFact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="text-center">
      <div className="font-mono text-[9px] tracking-widest text-amber-faint uppercase">
        {label}
      </div>
      <div className="font-board text-xl tracking-wider text-amber amber-glow uppercase mt-0.5">
        {value || <span className="text-amber-faint">TBA</span>}
      </div>
    </div>
  );
}
