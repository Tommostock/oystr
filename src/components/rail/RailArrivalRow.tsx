/**
 * RailArrivalRow.tsx — Single row on the National Rail departure board
 *
 * Shows one train leaving the FROM station, in TfL dot-matrix style.
 *
 * Layout:
 *   [platform]  DESTINATION           HH:mm
 *               OPERATOR              ON TIME / EXP HH:mm / CANCELLED
 *
 * Status colours:
 *   ON TIME   -> green  #34c759
 *   DELAYED   -> amber  #ff9500  (default amber, no special colour)
 *   CANCELLED -> red    #ff3b30
 */

"use client";

import { cn } from "@/lib/utils";
import type { RailDeparture } from "@/lib/rail-types";

interface RailArrivalRowProps {
  /** The departure to render */
  departure: RailDeparture;
  /** Called when the row is tapped — opens the ServiceDetailSheet */
  onClick?: (serviceId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Derive the status text + colour from the departure's fields.
 *   - Cancelled     -> "CANCELLED" in red
 *   - Delayed       -> "EXP HH:mm" in amber (estimated)
 *   - On time       -> "ON TIME" in green
 *   - Unknown/empty -> estimated text verbatim or blank
 */
function getStatus(
  departure: RailDeparture
): { text: string; colour: string } {
  if (departure.cancelled) {
    return { text: "CANCELLED", colour: "#ff3b30" };
  }
  const etd = departure.estimatedDeparture;
  if (etd === "On time") {
    return { text: "ON TIME", colour: "#34c759" };
  }
  if (departure.delayed && etd) {
    return { text: `EXP ${etd}`, colour: "#ff9500" };
  }
  return { text: etd.toUpperCase(), colour: "#ff9500" };
}

export default function RailArrivalRow({
  departure,
  onClick,
  className,
}: RailArrivalRowProps) {
  const status = getStatus(departure);
  const platform = departure.platform?.trim() || "-";
  const clickable = !!onClick && !!departure.serviceId;

  const content = (
    <div
      className={cn(
        /* Horizontal layout: platform | dest/operator stack | time/status stack */
        "flex items-center gap-3 py-2.5",
        "border-b border-board-border/50 last:border-b-0",
        clickable && "cursor-pointer hover:bg-board-border/30 transition-colors",
        className
      )}
      role="row"
      aria-label={`${departure.destination} at ${departure.scheduledDeparture}, ${status.text.toLowerCase()}`}
    >
      {/* ---- Platform ---- */}
      <div className="shrink-0 w-12 text-center">
        <span className="font-board text-xl text-amber amber-glow tracking-wider">
          {platform}
        </span>
      </div>

      {/* ---- Destination + operator ---- */}
      <div className="flex-1 min-w-0">
        <div className="font-board text-xl text-amber amber-glow tracking-wider uppercase truncate">
          {departure.destination || "UNKNOWN"}
        </div>
        {departure.operator && (
          <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mt-0.5">
            {departure.operator}
          </div>
        )}
      </div>

      {/* ---- Scheduled time + status ---- */}
      <div className="shrink-0 text-right min-w-[5rem]">
        <div className="font-board text-xl text-amber amber-glow tracking-wider">
          {departure.scheduledDeparture || "--:--"}
        </div>
        <div
          className="font-mono text-[10px] tracking-wider mt-0.5 uppercase"
          style={{ color: status.colour }}
        >
          {status.text || "\u00A0"}
        </div>
      </div>
    </div>
  );

  if (clickable) {
    return (
      <button
        onClick={() => onClick!(departure.serviceId)}
        className="w-full text-left"
        aria-label={`View calling points for ${departure.scheduledDeparture} to ${departure.destination}`}
      >
        {content}
      </button>
    );
  }

  return content;
}
