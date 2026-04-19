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

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Star, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Try to extract an "expected to clear / resume / return" time from a
 * disruption reason string. TfL often writes things like:
 *   "Severe delays. Expected to clear by 14:30."
 *   "Service resumes at around 09:00."
 *
 * Returns a Date for today at that time, or null if no time could be
 * parsed. If the parsed time is earlier than 'now' we bump to tomorrow
 * (covers late-night parses rolling over midnight).
 */
function parseExpectedClear(reason: string): Date | null {
  if (!reason) return null;
  /*
   * Match 3-4 digit 24h time (e.g. 14:30 or 0930) near any of the
   * common "back"/"clear"/"resume" phrasings. Kept loose because TfL
   * text varies — we just want something plausible.
   */
  const match = reason.match(
    /(?:expected|back|clear|resume[ds]?|restored?|running|return)\s+(?:to\s+(?:be\s+)?(?:clear|resume|return|normal|running)\s+)?(?:by|at|around|approximately|approx\.?|from)?\s*(\d{1,2}):?(\d{2})/i
  );
  if (!match) return null;

  const hh = parseInt(match[1], 10);
  const mm = parseInt(match[2], 10);
  if (isNaN(hh) || isNaN(mm) || hh > 23 || mm > 59) return null;

  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  /* If parsed time has already passed today, assume tomorrow */
  if (d.getTime() < Date.now() - 5 * 60 * 1000) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/** Format a minutes-from-now count into "IN 12 MIN" or "IN 2H 15M". */
function formatMinutesUntil(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60_000));
  if (mins < 60) return `IN ${mins} MIN`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `IN ${h}H` : `IN ${h}H ${m}M`;
}

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
  /** When true, render the small NIGHT TUBE badge next to the line name */
  isNightTube?: boolean;
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
  isNightTube = false,
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

        {/* Line name + optional Night Tube badge */}
        <span className="flex-1 font-mono text-sm tracking-wider text-amber uppercase flex items-center gap-2 min-w-0">
          <span className="truncate">{lineName}</span>
          {isNightTube && (
            /* Small pill only shown when the Night Tube window is
               currently active AND this line runs during that window. */
            <span className="shrink-0 font-mono text-[9px] tracking-wider uppercase px-1.5 py-0.5 border border-amber/40 text-amber bg-amber/10">
              NIGHT
            </span>
          )}
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

      {/* ---- Expanded Detail: disruption reason + expected-clear countdown ---- */}
      {isExpanded && hasDetail && (
        <ExpandedDetail reason={reason} />
      )}
    </div>
  );
}

/**
 * ExpandedDetail — renders a disruption reason with an optional
 * live-updating "expected back by HH:MM (IN X MIN)" pill when the
 * reason text mentions a clear/resume time.
 */
function ExpandedDetail({ reason }: { reason: string }) {
  const [now, setNow] = useState<number>(() => Date.now());

  const expectedClear = parseExpectedClear(reason);

  /* Tick every 30s so the countdown stays fresh. Only runs while
     expected-clear has been parsed — no work otherwise. */
  useEffect(() => {
    if (!expectedClear) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [expectedClear]);

  const msUntil = expectedClear ? expectedClear.getTime() - now : 0;
  const showCountdown = expectedClear && msUntil > 0 && msUntil < 6 * 60 * 60 * 1000;

  return (
    <div className="px-3 pb-3 pt-0 border-t border-board-border">
      {showCountdown && (
        <div className="flex items-center gap-1.5 mt-2">
          <Clock
            size={12}
            strokeWidth={1.5}
            className="text-amber shrink-0"
          />
          <span className="font-mono text-[10px] tracking-wider text-amber amber-glow uppercase">
            EXPECTED BACK BY{" "}
            {expectedClear!.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}{" "}
            -- {formatMinutesUntil(msUntil)}
          </span>
        </div>
      )}
      <p className="font-mono text-sm tracking-wider text-amber amber-glow leading-relaxed mt-2">
        {reason}
      </p>
    </div>
  );
}
