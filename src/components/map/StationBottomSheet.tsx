/**
 * StationBottomSheet.tsx — Bottom sheet showing station departures
 *
 * Appears when a user taps a station marker on the map.
 * Shows live departures for that station in a compact format.
 * Can be dismissed by tapping the close button.
 *
 * Usage:
 *   <StationBottomSheet
 *     station={{ naptanId: "940GZZLUMLE", name: "Mile End" }}
 *     onClose={() => setSelectedStation(null)}
 *   />
 */

"use client";

import { X } from "lucide-react";
import { useArrivals } from "@/hooks/useArrivals";
import { LINE_COLOURS } from "@/lib/constants";
import AmberText from "@/components/shared/AmberText";
import { cn } from "@/lib/utils";

interface StationBottomSheetProps {
  /** The selected station */
  station: {
    naptanId: string;
    name: string;
  };
  /** Called when the sheet is dismissed */
  onClose: () => void;
}

/**
 * Clean destination names (same logic as DepartureBoard).
 */
function cleanDest(name: string | undefined): string {
  if (!name) return "UNKNOWN";
  return name
    .replace(/\s*Underground Station$/i, "")
    .replace(/\s*DLR Station$/i, "")
    .replace(/\s*Rail Station$/i, "")
    .replace(/\s*\(London\)/i, "")
    .replace(/\s*Station$/i, "")
    .trim();
}

/**
 * Format seconds to minutes display.
 */
function formatTime(seconds: number): string {
  if (seconds <= 30) return "DUE";
  return `${Math.floor(seconds / 60)} MIN`;
}

export default function StationBottomSheet({
  station,
  onClose,
}: StationBottomSheetProps) {
  const { arrivals, isLoading } = useArrivals(station.naptanId);

  /* Show max 8 arrivals in the compact view */
  const displayArrivals = arrivals.slice(0, 8);

  return (
    <div
      className={cn(
        /* Fixed to bottom of screen */
        "absolute bottom-0 left-0 right-0 z-[1000]",
        /* Dark panel with amber border */
        "bg-board-bg border-t border-amber",
        /* Max height with scrolling */
        "max-h-[50vh] overflow-y-auto"
      )}
    >
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between p-3 border-b border-board-border sticky top-0 bg-board-bg z-10">
        <AmberText size="sm" uppercase className="amber-glow truncate flex-1">
          {station.name
            .replace(/\s*Underground Station$/i, "")
            .replace(/\s*Station$/i, "")}
        </AmberText>
        <button
          onClick={onClose}
          className="p-1 text-amber-faint hover:text-amber transition-colors shrink-0 ml-2"
          aria-label="Close"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* ---- Content ---- */}
      <div className="p-3">
        {isLoading && (
          <div className="py-3 text-center">
            <AmberText variant="dim" size="xs" className="animate-blink">
              LOADING...
            </AmberText>
          </div>
        )}

        {!isLoading && displayArrivals.length === 0 && (
          <div className="py-3 text-center">
            <AmberText variant="dim" size="xs">
              NO ARRIVALS DATA
            </AmberText>
          </div>
        )}

        {displayArrivals.map((arrival, i) => (
          <div
            key={`${arrival.vehicleId}-${i}`}
            className="flex items-center gap-2 py-1.5 border-b border-board-border/30 last:border-b-0"
          >
            {/* Line colour dot */}
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                backgroundColor: LINE_COLOURS[arrival.lineId] || "#FF9500",
              }}
              aria-hidden="true"
            />

            {/* Destination */}
            <span className="flex-1 font-mono text-xs tracking-wider text-amber uppercase truncate">
              {cleanDest(arrival.destinationName)}
            </span>

            {/* Time */}
            <span
              className={cn(
                "font-mono text-xs tracking-wider shrink-0",
                arrival.timeToStation <= 30
                  ? "text-amber animate-blink"
                  : "text-amber-faint"
              )}
            >
              {formatTime(arrival.timeToStation)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
