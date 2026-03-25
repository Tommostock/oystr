/**
 * LineStatusCard.tsx — Status card for a single line
 *
 * Shows a line's name, colour indicator, and current status.
 * Tappable to expand and see the disruption reason.
 *
 * Visual design:
 *   - Small coloured bar on the left (the official line colour)
 *   - Line name in amber text
 *   - Status text: green for "Good Service", amber/red for disruptions
 *   - Expandable detail section for disruption reasons
 *
 * Usage:
 *   <LineStatusCard
 *     lineId="central"
 *     lineName="Central"
 *     colour="#E32017"
 *     status="Good Service"
 *     reason=""
 *   />
 */

"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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
}

/**
 * Get the CSS class for status text based on severity level.
 *
 * TfL severity levels:
 *   10 = Good Service (green)
 *   9  = Minor Delays (amber)
 *   6  = Severe Delays (red)
 *   5  = Part Closure (red)
 *   4  = Planned Closure (amber)
 *   1  = Service Closed (red)
 *   0  = Special Service (amber)
 */
function getStatusColour(severity: number): string {
  if (severity === 10) return "text-green-500"; /* Good Service */
  if (severity >= 7) return "text-amber"; /* Minor issues */
  return "text-red-500"; /* Severe issues */
}

export default function LineStatusCard({
  lineId,
  lineName,
  colour,
  status,
  severity,
  reason,
}: LineStatusCardProps) {
  /* Whether the disruption detail is expanded */
  const [isExpanded, setIsExpanded] = useState(false);

  /* Only show the expand button if there's a disruption reason to show */
  const hasDetail = reason && reason.length > 0;

  /* Is this line running normally? */
  const isGoodService = severity === 10;

  return (
    <div
      className={cn(
        /* Card container */
        "border border-board-border bg-surface",
        /* Hover effect only if expandable */
        hasDetail && "cursor-pointer hover:border-amber-faint",
        "transition-colors duration-200"
      )}
      onClick={() => hasDetail && setIsExpanded(!isExpanded)}
      role={hasDetail ? "button" : undefined}
      aria-expanded={hasDetail ? isExpanded : undefined}
      aria-label={`${lineName}: ${status}`}
    >
      {/* ---- Main Row: colour bar + name + status ---- */}
      <div className="flex items-center gap-3 p-3">
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
          <p className="font-mono text-xs tracking-wider text-amber-faint leading-relaxed mt-2">
            {reason}
          </p>
        </div>
      )}
    </div>
  );
}
