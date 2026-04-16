/**
 * StrikesPanel.tsx — Upcoming strikes / industrial action panel
 *
 * Displays any current or upcoming strike information fetched
 * from TfL's disruption data. Shows affected lines, description,
 * and last updated time.
 *
 * Styled to match the dot-matrix board aesthetic with a red
 * warning header to draw attention.
 *
 * If there are no strikes, shows a reassuring "NO STRIKES" message.
 *
 * Usage:
 *   <StrikesPanel />
 */

"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
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
  /* Convert display name to the ID format used in LINE_COLOURS */
  const id = lineName
    .toLowerCase()
    .replace(/ & /g, "-")
    .replace(/\s+/g, "-");

  return LINE_COLOURS[id] || "#FF9500"; // Fallback to amber
}

/**
 * Format an ISO date string to a readable relative or absolute time.
 */
function formatUpdatedTime(isoString: string): string {
  if (!isoString) return "";

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return "JUST NOW";
  if (diffMins < 60) return `${diffMins} MIN AGO`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}H AGO`;

  /* For older dates, show the date */
  return date
    .toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    })
    .toUpperCase();
}

/**
 * Single strike card showing one disruption.
 */
function StrikeCard({ strike }: { strike: StrikeInfo }) {
  const [isExpanded, setIsExpanded] = useState(false);

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
        {/* Header row: warning icon + category + expand chevron */}
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-500 shrink-0" />
          <span className="font-mono text-xs tracking-wider text-red-500 uppercase flex-1">
            {strike.category === "PlannedWork"
              ? "PLANNED STRIKE ACTION"
              : "STRIKE ACTION"}
          </span>
          {strike.lastUpdated && (
            <span className="font-mono text-xs tracking-wider text-amber-faint shrink-0">
              {formatUpdatedTime(strike.lastUpdated)}
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

  /* Don't show anything while loading initially — the line status
     section below already has its own loading state */
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

  /* If there was an error fetching, show a subtle message */
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
            NO CURRENT STRIKE ACTION
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
