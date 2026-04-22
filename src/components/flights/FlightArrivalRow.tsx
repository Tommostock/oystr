/**
 * FlightArrivalRow.tsx — Single row on the flight ARRIVALS board
 *
 * Dot-matrix board row for one inbound flight. Mirrors
 * FlightDepartureRow but swaps destination for origin and surfaces
 * the baggage-reclaim belt, which is the headline arrivals-only
 * piece of info (it's the first thing you want to know when you
 * step off the plane).
 *
 * Layout:
 *   [gate]  ORIGIN                    HH:mm
 *           AIRLINE · FLIGHT#         LANDED / EXP HH:mm / BELT 5
 */

"use client";

import { cn } from "@/lib/utils";
import type { FlightArrival, FlightStatus } from "@/lib/flight-types";

interface FlightArrivalRowProps {
  arrival: FlightArrival;
  onClick?: (arrival: FlightArrival) => void;
  className?: string;
}

/** Status label + colour for an arriving flight. */
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
    case "landed":
      return { text: "LANDED", colour: "#34c759" };
    case "on-time":
      return { text: "ON TIME", colour: "#34c759" };
    case "expected":
      return { text: "EXPECTED", colour: "#cc7700" };
    case "delayed":
      return {
        text:
          estimated && estimated !== scheduled ? `EXP ${estimated}` : "DELAYED",
        colour: "#ff9500",
      };
    case "scheduled":
    case "unknown":
    default:
      return { text: "SCHEDULED", colour: "#cc7700" };
  }
}

export default function FlightArrivalRow({
  arrival,
  onClick,
  className,
}: FlightArrivalRowProps) {
  const status = getStatusLabel(
    arrival.status,
    arrival.estimatedArrival,
    arrival.scheduledArrival
  );

  /*
   * Left-most column shows either the arrival gate (where the
   * aircraft will park — useful while the flight's still inbound)
   * or a "TBA" placeholder, same idiom as the departures board.
   */
  const gateKnown = !!arrival.gate?.trim();
  const gate = arrival.gate?.trim() || "TBA";
  const clickable = !!onClick;
  const beltKnown = !!arrival.baggageBelt?.trim();

  const content = (
    <div
      className={cn(
        "flex items-start gap-3 py-2.5",
        "border-b border-board-border/50 last:border-b-0",
        clickable && "cursor-pointer hover:bg-board-border/30 transition-colors",
        className
      )}
      role="row"
      aria-label={`Arrival from ${arrival.origin}, flight ${arrival.flightNumber}, ${status.text.toLowerCase()}`}
    >
      {/* ---- Gate column. ---- */}
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

      {/* ---- Origin + airline / flight number ---- */}
      <div className="flex-1 min-w-0">
        <div className="font-board text-xl text-amber amber-glow tracking-wider uppercase truncate">
          {arrival.origin || "UNKNOWN"}
        </div>
        <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mt-0.5 truncate">
          {arrival.airlineCode
            ? `${arrival.airlineCode} · ${arrival.flightNumber}`
            : arrival.flightNumber}
          {arrival.terminal && (
            <span className="ml-2 text-amber-dim">T{arrival.terminal}</span>
          )}
        </div>
      </div>

      {/* ---- Scheduled time + status + optional belt ---- */}
      <div className="shrink-0 text-right min-w-[5rem] pt-0.5">
        <div className="font-board text-xl text-amber amber-glow tracking-wider">
          {arrival.scheduledArrival || "--:--"}
        </div>
        <div
          className="font-mono text-[10px] tracking-wider mt-0.5 uppercase"
          style={{ color: status.colour }}
        >
          {status.text || " "}
        </div>
        {beltKnown && (
          <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mt-0.5">
            BELT {arrival.baggageBelt}
          </div>
        )}
      </div>
    </div>
  );

  if (clickable) {
    return (
      <button
        onClick={() => onClick!(arrival)}
        className="w-full text-left"
        aria-label={`View details for ${arrival.flightNumber} from ${arrival.origin}`}
      >
        {content}
      </button>
    );
  }

  return content;
}
