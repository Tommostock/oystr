/**
 * LineStatusCard.tsx — Status card for a single line
 *
 * Shows a line's name, colour indicator, and current status.
 * Tappable to expand and see the disruption reason.
 *
 * Visual design:
 *   - Optional pin button on the left (filled star when pinned)
 *   - Small coloured bar showing the official line colour
 *   - Line name in amber text
 *   - Status text: green for "Good Service", amber/red for disruptions
 *   - Expandable detail section for disruption reasons
 */

"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface LineStatusCardProps {
  /** TfL line ID */
  lineId: string;
  /** Display name of the line */
  lineName: string;
  /** Official hex colour for the line */
  colour: string;
  /** Current status text, e.g. "Good Service" or "Minor Delays" */
  status: string;
  /** Severity level (10 = good, lower = worse) */
  severity: number;
  /** Reason for disruption (empty string when good service) */
  reason: string;
  /** Whether this line is currently pinned by the user */
  isPinned?: boolean;
  /** Called when the user toggles the pin — swallows the row-tap event */
  onTogglePin?: (lineId: string) => void;
}

/**
 * Get the CSS class for status text based on severity level.
 */
function getStatusColour(severity: number): string {
  if (severity === 10) return "text-green-500";
  if (severity >= 7) return "text-amber";
  return "text-red-500";
}

export default function LineStatusCard({
  lineId,
  lineName,
  colour,
  status,
  severity,
  reason,
  isPinned = false,
  onTogglePin,
}: LineStatusCardProps) {
  /* Whether the disruption detail is expanded */
  const [isExpanded, setIsExpanded] = useState(false);

  /* Only show the expand button if there's a disruption reason to show */
  const hasDetail = reason && reason.length > 0;

  const handlePinClick = (e: React.MouseEvent) => {
    /* Pin tap must NOT bubble up to the row click that would otherwise
       toggle the expansion. */
    e.stopPropagation();
    onTogglePin?.(lineId);
  };

  return (
    <div
      className={cn(
        "border border-board-border bg-surface",
        hasDetail && "cursor-pointer hover:border-amber-faint",
        "transition-colors duration-200"
      )}
      onClick={() => hasDetail && setIsExpanded(!isExpanded)}
      role={hasDetail ? "button" : undefined}
      aria-expanded={hasDetail ? isExpanded : undefined}
      aria-label={`${lineName}: ${status}`}
    >
      {/* ---- Main Row: pin + colour bar + name + status + chevron ---- */}
      <div className="flex items-center gap-2 p-3">
        {/* Pin toggle. Filled star when pinned, outline when not. */}
        {onTogglePin && (
          <button
            onClick={handlePinClick}
            className={cn(
              "shrink-0 p-1 transition-colors",
              isPinned
                ? "text-amber amber-glow"
                : "text-amber-faint/60 hover:text-amber-faint"
            )}
            aria-label={isPinned ? `Unpin ${lineName}` : `Pin ${lineName} to top`}
            title={isPinned ? "Unpin" : "Pin to top"}
          >
            <Star
              size={14}
              strokeWidth={1.5}
              fill={isPinned ? "currentColor" : "none"}
            />
          </button>
        )}

        {/* Line colour indicator bar */}
        <div
          className="w-1.5 h-8 rounded-full shrink-0"
          style={{ backgroundColor: colour }}
          aria-hidden="true"
        />

        {/* Line name */}
        <span className="flex-1 font-mono text-sm tracking-wider text-amber uppercase">
          {lineName}
        </span>

        {/* Status text */}
        <span
          className={cn(
            "font-mono text-xs tracking-wider uppercase shrink-0",
            getStatusColour(severity)
          )}
        >
          {status}
        </span>

        {/* Expand/collapse chevron (only if there's detail to show) */}
        {hasDetail && (
          <span className="text-amber-faint shrink-0">
            {isExpanded ? (
              <ChevronUp size={14} strokeWidth={1.5} />
            ) : (
              <ChevronDown size={14} strokeWidth={1.5} />
            )}
          </span>
        )}
      </div>

      {/* ---- Expanded Detail: disruption reason ---- */}
      {isExpanded && hasDetail && (
        <div className="px-3 pb-3 pt-0 border-t border-board-border">
          <p className="font-mono text-sm tracking-wider text-amber amber-glow leading-relaxed mt-2">
            {reason}
          </p>
        </div>
      )}
    </div>
  );
}
