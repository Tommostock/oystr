/**
 * StrikesPanel.tsx — Collapsible strikes panel for the Status page
 *
 * A single collapsible panel that shows planned strike action.
 * Only renders when there are upcoming strikes — completely
 * hidden otherwise (no "no strikes" message).
 *
 * Tapping the header expands/collapses the strike details.
 *
 * Usage:
 *   <StrikesPanel />
 */

"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { useStrikes } from "@/hooks/useStrikes";
import { LINE_COLOURS } from "@/lib/constants";
import type { StrikeInfo } from "@/lib/tfl-types";
import { cn } from "@/lib/utils";

/**
 * Map a line display name to its TfL line ID for colour lookup.
 */
function getLineColour(lineName: string): string {
  const id = lineName
    .toLowerCase()
    .replace(/ & /g, "-")
    .replace(/\s+/g, "-");
  return LINE_COLOURS[id] || "#FF9500";
}

/**
 * Format a date as "WED 23 APR" — uppercase dot-matrix style.
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
 */
function formatDateRange(fromDate: string, toDate: string): string {
  if (!fromDate && !toDate) return "";
  const from = formatStrikeDate(fromDate);
  const to = formatStrikeDate(toDate);
  if (!from) return to;
  if (!to) return from;
  if (from === to) return from;
  return `${from} - ${to}`;
}

/**
 * Parse the TfL strike description into a structured form.
 *
 * Strike descriptions are long paragraphs that typically contain
 * several "from HHMM <Weekday> <DD> until HHMM <Weekday> <DD> <Month>"
 * date ranges separated by commas. We extract these as a bullet list
 * so they're scannable, and show any surrounding text as intro/outro
 * paragraphs.
 */
function parseStrikeDescription(description: string): {
  intro: string;
  dateRanges: string[];
  outro: string;
} {
  if (!description) return { intro: "", dateRanges: [], outro: "" };

  /*
   * Pattern matches: "from 1200 Tuesday 21 until 1159 Wednesday 22 April"
   * - "from" followed by 4 digits (time)
   * - a weekday (word chars)
   * - a day number
   * - "until" followed by time, weekday, day, month
   * Case-insensitive to be safe.
   */
  const rangePattern =
    /from\s+\d{3,4}\s+\w+\s+\d{1,2}\s+until\s+\d{3,4}\s+\w+\s+\d{1,2}(?:\s+\w+)?/gi;

  const matches: { text: string; index: number; length: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = rangePattern.exec(description)) !== null) {
    matches.push({ text: m[0], index: m.index, length: m[0].length });
  }

  if (matches.length === 0) {
    return { intro: description, dateRanges: [], outro: "" };
  }

  const firstIdx = matches[0].index;
  const lastEnd = matches[matches.length - 1].index + matches[matches.length - 1].length;

  /* Trim trailing ":" / "," / whitespace off intro, and leading ".," off outro */
  const intro = description.substring(0, firstIdx).replace(/[:,\s]+$/, "").trim();
  const outro = description.substring(lastEnd).replace(/^[.,\s]+/, "").trim();

  /* Capitalise each range's leading "from" for consistency at bullet start */
  const dateRanges = matches.map((x) =>
    x.text.replace(/^from/i, "From")
  );

  return { intro, dateRanges, outro };
}

/**
 * Get countdown text relative to today.
 */
function getCountdownLabel(fromDate: string, toDate: string): {
  label: string;
  urgency: "now" | "imminent" | "upcoming";
} {
  if (!fromDate && !toDate) return { label: "", urgency: "upcoming" };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const from = fromDate ? new Date(fromDate) : null;
  const to = toDate ? new Date(toDate) : null;
  const fromDay = from ? new Date(from.getFullYear(), from.getMonth(), from.getDate()) : null;
  const toDay = to ? new Date(to.getFullYear(), to.getMonth(), to.getDate()) : null;

  /* Currently happening */
  if (fromDay && toDay && fromDay <= today && toDay >= today) {
    return { label: "HAPPENING NOW", urgency: "now" };
  }
  if (fromDay && !toDay && fromDay <= today) {
    return { label: "HAPPENING NOW", urgency: "now" };
  }

  /* Future */
  if (fromDay && fromDay > today) {
    const diffMs = fromDay.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return { label: "TODAY", urgency: "now" };
    if (diffDays === 1) return { label: "TOMORROW", urgency: "imminent" };
    return { label: `IN ${diffDays} DAYS`, urgency: "upcoming" };
  }

  if (fromDay && fromDay.getTime() === today.getTime()) {
    return { label: "TODAY", urgency: "now" };
  }

  return { label: "", urgency: "upcoming" };
}

/**
 * Single strike entry inside the expanded panel.
 */
function StrikeEntry({ strike }: { strike: StrikeInfo }) {
  const dateRange = formatDateRange(strike.fromDate, strike.toDate);
  const countdown = getCountdownLabel(strike.fromDate, strike.toDate);

  return (
    <div className="border-t border-board-border pt-3 space-y-2">
      {/* Date and countdown */}
      {(dateRange || countdown.label) && (
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-amber shrink-0" />
          {dateRange && (
            <span className="font-mono text-sm tracking-wider text-amber amber-glow uppercase flex-1">
              {dateRange}
            </span>
          )}
          {countdown.label && (
            <span
              className={cn(
                "font-mono text-xs tracking-wider uppercase shrink-0 px-2 py-0.5 border",
                countdown.urgency === "now"
                  ? "text-red-500 border-red-500/40 bg-red-500/10"
                  : countdown.urgency === "imminent"
                    ? "text-amber border-amber/40 bg-amber/10"
                    : "text-amber-dim border-amber-dim/40"
              )}
            >
              {countdown.label}
            </span>
          )}
        </div>
      )}

      {/* Affected lines */}
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

      {/* Description — the paragraph is parsed into intro text, a
          bulleted list of date ranges, and any outro text. This makes
          multi-date strikes scannable instead of wall-of-text. */}
      {(() => {
        const parsed = parseStrikeDescription(strike.description);
        const hasBullets = parsed.dateRanges.length > 0;
        if (!hasBullets) {
          return (
            <p className="font-mono text-sm tracking-wider text-amber amber-glow leading-relaxed">
              {strike.description}
            </p>
          );
        }
        return (
          <div className="space-y-2">
            {parsed.intro && (
              <p className="font-mono text-sm tracking-wider text-amber amber-glow leading-relaxed">
                {parsed.intro}
              </p>
            )}
            <ul className="space-y-1.5 pl-1" role="list">
              {parsed.dateRanges.map((range, i) => (
                <li
                  key={i}
                  className="flex gap-2 font-mono text-sm tracking-wider text-amber amber-glow leading-relaxed"
                >
                  <span className="text-amber-faint shrink-0">&gt;</span>
                  <span>{range}</span>
                </li>
              ))}
            </ul>
            {parsed.outro && (
              <p className="font-mono text-sm tracking-wider text-amber amber-glow leading-relaxed">
                {parsed.outro}
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}

/**
 * Main StrikesPanel component.
 * Only renders when strikes are planned.
 * Fully collapsible — tapping the header toggles details.
 */
export default function StrikesPanel() {
  const { strikes, isLoading } = useStrikes();
  const [isExpanded, setIsExpanded] = useState(false);

  /* Hidden when loading or no strikes */
  if (isLoading || strikes.length === 0) return null;

  /* Find nearest countdown for the header */
  const nextCountdown = getCountdownLabel(
    strikes[0]?.fromDate || "",
    strikes[0]?.toDate || ""
  );

  return (
    <div
      className={cn(
        "border bg-surface transition-colors duration-200",
        isExpanded ? "border-red-500/30" : "border-red-500/20",
        "cursor-pointer"
      )}
      onClick={() => setIsExpanded(!isExpanded)}
      role="button"
      aria-expanded={isExpanded}
    >
      {/* ---- Collapsible Header ---- */}
      <div className="flex items-center gap-2 p-3">
        <AlertTriangle size={14} className="text-red-500 shrink-0" />
        <span className="font-mono text-sm tracking-wider text-red-500 uppercase flex-1">
          PLANNED STRIKE ACTION
        </span>
        {nextCountdown.label && (
          <span
            className={cn(
              "font-mono text-xs tracking-wider uppercase shrink-0 px-2 py-0.5 border",
              nextCountdown.urgency === "now"
                ? "text-red-500 border-red-500/40 bg-red-500/10"
                : nextCountdown.urgency === "imminent"
                  ? "text-amber border-amber/40 bg-amber/10"
                  : "text-amber-dim border-amber-dim/40"
            )}
          >
            {nextCountdown.label}
          </span>
        )}
        <span className="text-amber-faint shrink-0">
          {isExpanded ? (
            <ChevronUp size={14} strokeWidth={1.5} />
          ) : (
            <ChevronDown size={14} strokeWidth={1.5} />
          )}
        </span>
      </div>

      {/* ---- Expanded Details ---- */}
      {isExpanded && (
        <div
          className="px-3 pb-3 space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
          {strikes.map((strike) => (
            <StrikeEntry key={strike.id} strike={strike} />
          ))}
        </div>
      )}
    </div>
  );
}
