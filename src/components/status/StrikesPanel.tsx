/**
 * StrikesPanel.tsx — Upcoming strikes / industrial action panel
 *
 * Displays any current or upcoming strike information fetched
 * from TfL's disruption data. Shows:
 *   - Strike dates prominently (e.g. "WED 23 APR")
 *   - Days until the strike ("IN 3 DAYS", "TODAY", "TOMORROW")
 *   - Affected lines with colour-coded pills
 *   - Full description (expandable)
 *
 * Strikes are shown from 7 days before through to the strike date.
 * If there are no strikes, shows a reassuring "NO STRIKES" message.
 *
 * Styled to match the dot-matrix board aesthetic with a red
 * warning header to draw attention.
 *
 * Usage:
 *   <StrikesPanel />
 */

"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { useStrikes } from "@/hooks/useStrikes";
import { LINE_COLOURS } from "@/lib/constants";
import BoardPanel from "@/components/shared/BoardPanel";
import AmberText from "@/components/shared/AmberText";
import type { StrikeInfo } from "@/lib/tfl-types";

/**
 * Map a line display name to its TfL line ID for colour lookup.
 * TfL returns display names like "Central" but our colour map uses
 * IDs like "central". This handles the conversion.
 */
function getLineColour(lineName: string): string {
  const id = lineName
    .toLowerCase()
    .replace(/ & /g, "-")
    .replace(/\s+/g, "-");

  return LINE_COLOURS[id] || "#FF9500";
}

/**
 * Format a date as "WED 23 APR" — the uppercase dot-matrix style.
 */
function formatStrikeDate(isoString: string): string {
  if (!isoString) return "";

  const date = new Date(isoString);
  const day = date.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase();
  const dayNum = date.getDate();
  const month = date.toLocaleDateString("en-GB", { month: "short" }).toUpperCase();

  return `${day} ${dayNum} ${month}`;
}

/**
 * Format a date range for display.
 * Single day: "WED 23 APR"
 * Multi-day:  "WED 23 APR - THU 24 APR"
 */
function formatDateRange(fromDate: string, toDate: string): string {
  if (!fromDate && !toDate) return "";

  const from = formatStrikeDate(fromDate);
  const to = formatStrikeDate(toDate);

  if (!from) return to;
  if (!to) return from;

  /* If same day, just show once */
  if (from === to) return from;

  return `${from} - ${to}`;
}

/**
 * Get a countdown label relative to today.
 * Returns "TODAY", "TOMORROW", "IN 2 DAYS", etc.
 * For ongoing strikes: "NOW" or "ONGOING".
 */
function getCountdownLabel(fromDate: string, toDate: string): {
  label: string;
  urgency: "now" | "imminent" | "upcoming";
} {
  if (!fromDate && !toDate) {
    return { label: "", urgency: "upcoming" };
  }

  const now = new Date();
  /* Strip time for day-level comparison */
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const from = fromDate ? new Date(fromDate) : null;
  const to = toDate ? new Date(toDate) : null;

  const fromDay = from
    ? new Date(from.getFullYear(), from.getMonth(), from.getDate())
    : null;
  const toDay = to
    ? new Date(to.getFullYear(), to.getMonth(), to.getDate())
    : null;

  /* Strike is currently happening */
  if (fromDay && toDay && fromDay <= today && toDay >= today) {
    return { label: "HAPPENING NOW", urgency: "now" };
  }
  if (fromDay && !toDay && fromDay <= today) {
    return { label: "HAPPENING NOW", urgency: "now" };
  }
  if (!fromDay && toDay && toDay >= today) {
    return { label: "ONGOING", urgency: "now" };
  }

  /* Strike is in the future — count days until start */
  if (fromDay && fromDay > today) {
    const diffMs = fromDay.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { label: "TODAY", urgency: "now" };
    if (diffDays === 1) return { label: "TOMORROW", urgency: "imminent" };
    return { label: `IN ${diffDays} DAYS`, urgency: "upcoming" };
  }

  /* Strike today (from is today) */
  if (fromDay && fromDay.getTime() === today.getTime()) {
    return { label: "TODAY", urgency: "now" };
  }

  return { label: "", urgency: "upcoming" };
}

/**
 * Single strike card showing one disruption with dates.
 */
function StrikeCard({ strike }: { strike: StrikeInfo }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const dateRange = formatDateRange(strike.fromDate, strike.toDate);
  const countdown = getCountdownLabel(strike.fromDate, strike.toDate);

  /* Truncate long descriptions for the collapsed view */
  const maxPreviewLength = 150;
  const isLong = strike.description.length > maxPreviewLength;
  const preview = isLong
    ? strike.description.slice(0, maxPreviewLength) + "..."
    : strike.description;

  return (
    <div
      className="border border-board-border bg-surface cursor-pointer hover:border-red-500/30 transition-colors duration-200"
      onClick={() => setIsExpanded(!isExpanded)}
      role="button"
      aria-expanded={isExpanded}
    >
      <div className="p-3 space-y-2">
        {/* Header row: warning icon + type label + expand chevron */}
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-500 shrink-0" />
          <span className="font-mono text-xs tracking-wider text-red-500 uppercase flex-1">
            {strike.category === "PlannedWork"
              ? "PLANNED STRIKE ACTION"
              : "STRIKE ACTION"}
          </span>
          <span className="text-amber-faint shrink-0">
            {isExpanded ? (
              <ChevronUp size={14} strokeWidth={1.5} />
            ) : (
              <ChevronDown size={14} strokeWidth={1.5} />
            )}
          </span>
        </div>

        {/* Strike date and countdown — prominent display */}
        {(dateRange || countdown.label) && (
          <div className="flex items-center gap-2 py-1 border-t border-b border-board-border">
            <Calendar size={14} className="text-amber shrink-0" />
            {dateRange && (
              <span className="font-mono text-sm tracking-wider text-amber amber-glow uppercase flex-1">
                {dateRange}
              </span>
            )}
            {countdown.label && (
              <span
                className={`font-mono text-xs tracking-wider uppercase shrink-0 px-2 py-0.5 border ${
                  countdown.urgency === "now"
                    ? "text-red-500 border-red-500/40 bg-red-500/10"
                    : countdown.urgency === "imminent"
                      ? "text-amber border-amber/40 bg-amber/10"
                      : "text-amber-dim border-amber-dim/40"
                }`}
              >
                {countdown.label}
              </span>
            )}
          </div>
        )}

        {/* Affected lines as coloured pills */}
        {strike.affectedLines.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {strike.affectedLines.map((line) => (
              <span
                key={line}
                className="font-mono text-xs tracking-wider px-2 py-0.5 border"
                style={{
                  color: getLineColour(line),
                  borderColor: getLineColour(line) + "40",
                  backgroundColor: getLineColour(line) + "10",
                }}
              >
                {line.toUpperCase()}
              </span>
            ))}
          </div>
        )}

        {/* Description text — truncated when collapsed, full when expanded */}
        <p className="font-mono text-sm tracking-wider text-amber amber-glow leading-relaxed">
          {isExpanded ? strike.description : preview}
        </p>
      </div>
    </div>
  );
}

/**
 * Main StrikesPanel component.
 * Fetches strike data and renders it in a board panel.
 */
export default function StrikesPanel() {
  const { strikes, isLoading, error } = useStrikes();

  /* Loading state */
  if (isLoading && strikes.length === 0) {
    return (
      <BoardPanel>
        <div className="flex items-center gap-2 py-1">
          <AlertTriangle size={14} className="text-amber-faint" />
          <AmberText variant="dim" size="sm" uppercase>
            CHECKING FOR STRIKES...
          </AmberText>
        </div>
      </BoardPanel>
    );
  }

  /* Error state */
  if (error && strikes.length === 0) {
    return (
      <BoardPanel>
        <div className="flex items-center gap-2 py-1">
          <AlertTriangle size={14} className="text-amber-faint" />
          <AmberText variant="dim" size="sm" uppercase>
            STRIKE DATA UNAVAILABLE
          </AmberText>
        </div>
      </BoardPanel>
    );
  }

  /* No strikes — show a reassuring message */
  if (strikes.length === 0) {
    return (
      <BoardPanel>
        <div className="flex items-center gap-2 py-1">
          <span className="font-mono text-xs tracking-wider text-green-500">
            NO PLANNED STRIKE ACTION IN THE NEXT 7 DAYS
          </span>
        </div>
      </BoardPanel>
    );
  }

  /* Strikes found — show them */
  return (
    <div className="space-y-2">
      {/* Header */}
      <BoardPanel>
        <div className="flex items-center gap-2 py-1">
          <AlertTriangle size={14} className="text-red-500" />
          <span className="font-mono text-sm tracking-wider text-red-500 uppercase flex-1">
            STRIKE ACTION
          </span>
          <span className="font-mono text-xs tracking-wider text-amber-faint">
            {strikes.length} {strikes.length === 1 ? "NOTICE" : "NOTICES"}
          </span>
        </div>
      </BoardPanel>

      {/* Strike cards */}
      {strikes.map((strike) => (
        <StrikeCard key={strike.id} strike={strike} />
      ))}
    </div>
  );
}
