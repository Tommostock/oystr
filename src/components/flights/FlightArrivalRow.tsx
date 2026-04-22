/**
 * FlightArrivalRow.tsx — Single row on the flight departure board
 *
 * Dot-matrix board row for one flight leaving an airport. Modelled on
 * RailArrivalRow so the Flights tab reads consistently with Rail.
 *
 * Layout:
 *   [gate]  DESTINATION               HH:mm
 *           AIRLINE · FLIGHT#          ON TIME / EXP HH:mm / CANCELLED
 *
 * Status colours:
 *   ON TIME / BOARDING   -> green
 *   DELAYED / EXP time   -> amber (default)
 *   CANCELLED / DIVERTED -> red
 */

"use client";

import { cn } from "@/lib/utils";
import type { FlightDeparture, FlightStatus } from "@/lib/flight-types";

interface FlightArrivalRowProps {
  departure: FlightDeparture;
  onClick?: (departure: FlightDeparture) => void;
  className?: string;
}

/** Map the normalised status to a short board label + colour. */
function getStatusLabel(
  status: FlightStatus,
  estimated: string | null,
  scheduled: string
): { text: string; colour: string } {
  switch (status) {
    case "cancelled":
      return { text: "CANCELLED", colour: "#ff3b30" };
    case "diverted":
      return { text: "DIVERTED", colour: "#ff3b30" };
    case "boarding":
      return { text: "BOARDING", colour: "#34c759" };
    case "gate-closed":
      return { text: "GATE CLOSED", colour: "#ff3b30" };
    case "on-time":
      return { text: "ON TIME", colour: "#34c759" };
    case "departed":
      return { text: "DEPARTED", colour: "#cc7700" };
    case "delayed":
      return {
        text: estimated && estimated !== scheduled ? `EXP ${estimated}` : "DELAYED",
        colour: "#ff9500",
      };
    case "scheduled":
    case "unknown":
    default:
      return { text: "SCHEDULED", colour: "#cc7700" };
  }
}

export default function FlightArrivalRow({
  departure,
  onClick,
  className,
}: FlightArrivalRowProps) {
  const status = getStatusLabel(
    departure.status,
    departure.estimatedDeparture,
    departure.scheduledDeparture
  );

  /* Gate can be null until ~45min before departure. Same display
     idiom as the Rail board's "TBA" for unknown platforms. */
  const gateKnown = !!departure.gate?.trim();
  const gate = departure.gate?.trim() || "TBA";
  const clickable = !!onClick;

  const content = (
    <div
      className={cn(
        "flex items-start gap-3 py-2.5",
        "border-b border-board-border/50 last:border-b-0",
        clickable && "cursor-pointer hover:bg-board-border/30 transition-colors",
        className
      )}
      role="row"
      aria-label={`${departure.destination} flight ${departure.flightNumber} at ${departure.scheduledDeparture}, ${status.text.toLowerCase()}`}
    >
      {/* ---- Gate column. "TBA" stays small + dim so it reads as metadata. ---- */}
      <div className="shrink-0 w-12 text-center pt-0.5">
        {gateKnown ? (
          <span className="font-board text-xl text-amber amber-glow tracking-wider">
            {gate}
          </span>
        ) : (
          <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
            TBA
          </span>
        )}
      </div>

      {/* ---- Destination + airline/flight number ---- */}
      <div className="flex-1 min-w-0">
        <div className="font-board text-xl text-amber amber-glow tracking-wider uppercase truncate">
          {departure.destination || "UNKNOWN"}
        </div>
        <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mt-0.5 truncate">
          {departure.airlineCode
            ? `${departure.airlineCode} · ${departure.flightNumber}`
            : departure.flightNumber}
          {departure.terminal && (
            <span className="ml-2 text-amber-dim">T{departure.terminal}</span>
          )}
        </div>
      </div>

      {/* ---- Scheduled time + status ---- */}
      <div className="shrink-0 text-right min-w-[5rem] pt-0.5">
        <div className="font-board text-xl text-amber amber-glow tracking-wider">
          {departure.scheduledDeparture || "--:--"}
        </div>
        <div
          className="font-mono text-[10px] tracking-wider mt-0.5 uppercase"
          style={{ color: status.colour }}
        >
          {status.text || " "}
        </div>
      </div>
    </div>
  );

  if (clickable) {
    return (
      <button
        onClick={() => onClick!(departure)}
        className="w-full text-left"
        aria-label={`View details for ${departure.flightNumber} to ${departure.destination}`}
      >
        {content}
      </button>
    );
  }

  return content;
}
