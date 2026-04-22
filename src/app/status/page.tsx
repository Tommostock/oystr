/**
 * status/page.tsx — Line Status page
 *
 * Shows the current status of all TfL lines:
 * Tube, DLR, Overground, Elizabeth line, and Tram.
 *
 * "Good Service" lines show green text.
 * Disrupted lines show amber/red text and can be tapped
 * to expand and see the disruption reason.
 *
 * Users can pin favourite lines so they float to the top.
 *
 * Auto-refreshes every 60 seconds; pull-to-refresh supported.
 * Styled like a dot-matrix information board at station entrances.
 */

"use client";

import { useEffect, useState } from "react";
import { Moon, RefreshCw } from "lucide-react";
import { useLineStatus } from "@/hooks/useLineStatus";
import { usePinnedLines } from "@/hooks/usePinnedLines";
import {
  LINE_COLOURS,
  LINE_NAMES,
  NIGHT_TUBE_LINES,
  isNightTubeActive,
} from "@/lib/constants";
import type { LineStatus } from "@/lib/tfl-types";
import BoardPanel from "@/components/shared/BoardPanel";
import AmberText from "@/components/shared/AmberText";
import PageHeader from "@/components/shared/PageHeader";
import LoadingBoard from "@/components/shared/LoadingBoard";
import PullToRefresh from "@/components/shared/PullToRefresh";
import LineStatusCard from "@/components/line-status/LineStatusCard";
import StrikesPanel from "@/components/status/StrikesPanel";

/**
 * TfL severity → preferred display-order priority.
 * Lower number = higher up the list.
 * See the old implementation comment for full severity reference.
 */
function getSortPriority(severity: number): number {
  switch (severity) {
    case 1: case 2: case 16: case 20: return 0;  /* Closed / Suspended / Not running */
    case 3: case 5: case 11: return 1;           /* Part closures */
    case 6: case 7: return 2;                    /* Severe delays / reduced service */
    case 9: return 3;                            /* Minor delays */
    case 10: return 5;                           /* Good Service (bottom) */
    default: return 4;                           /* Anything else */
  }
}

function sortLines(lines: LineStatus[], pinnedIds: string[]): LineStatus[] {
  const pinnedSet = new Set(pinnedIds);
  return [...lines].sort((a, b) => {
    const aPinned = pinnedSet.has(a.id);
    const bPinned = pinnedSet.has(b.id);

    /* Pinned lines always win over unpinned — they float to the top
       as a single alphabetical group. Pinned lines are sorted
       alphabetically amongst themselves (easier to locate than by
       pin-order). */
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;

    const aName = LINE_NAMES[a.id] || a.name;
    const bName = LINE_NAMES[b.id] || b.name;
    if (aPinned && bPinned) {
      return aName.localeCompare(bName);
    }

    /* Both unpinned: severity group, then alphabetical within group */
    const aSeverity = a.lineStatuses?.[0]?.statusSeverity ?? 10;
    const bSeverity = b.lineStatuses?.[0]?.statusSeverity ?? 10;
    const aPriority = getSortPriority(aSeverity);
    const bPriority = getSortPriority(bSeverity);
    if (aPriority !== bPriority) return aPriority - bPriority;

    return aName.localeCompare(bName);
  });
}

/** Count lines by good vs disrupted. */
function getStatusSummary(lines: LineStatus[]) {
  let goodService = 0;
  let disrupted = 0;
  for (const line of lines) {
    const severity = line.lineStatuses?.[0]?.statusSeverity ?? 10;
    if (severity === 10) goodService++;
    else disrupted++;
  }
  return { goodService, disrupted };
}

/**
 * Format a timestamp like "14:32" (local time, 24h).
 * Returns empty string for null/undefined so callers can fall back.
 */
function formatHHMM(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function StatusPage() {
  const { lines, isLoading, error, refresh } = useLineStatus();
  const { pinnedIds, isPinned, togglePin } = usePinnedLines();

  /*
   * Track the timestamp of the last successful line-status fetch.
   * We piggy-back on SWR by updating whenever `lines` changes from a
   * non-empty fetch. Avoids needing a custom hook extension.
   */
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  useEffect(() => {
    if (lines.length > 0) setLastUpdated(new Date());
  }, [lines]);

  /*
   * Night Tube window check. Re-evaluated on mount — the window is
   * wide enough (6+ hours) that users don't typically keep the page
   * open across the boundary. A re-check per render is plenty.
   */
  const nightTubeActive = isNightTubeActive();
  const nightTubeSet = new Set(NIGHT_TUBE_LINES);

  /* ---- Loading state ---- */
  if (isLoading && lines.length === 0) {
    return (
      <div className="p-4 space-y-4">
        <PageHeader title="Line Status" subtitle="LONDON TUBE NETWORK STATUS" />
        <BoardPanel>
          <LoadingBoard message="FETCHING LINE STATUS..." />
        </BoardPanel>
      </div>
    );
  }

  /* ---- Error state with RETRY button ---- */
  if (error && lines.length === 0) {
    return (
      <div className="p-4 space-y-4">
        <PageHeader title="Line Status" subtitle="LONDON TUBE NETWORK STATUS" />
        <BoardPanel>
          <div className="py-6 text-center space-y-3">
            <AmberText variant="dim" size="sm" className="dot-matrix">
              TFL DATA UNAVAILABLE
            </AmberText>
            <p className="font-mono text-xs tracking-wider text-amber-faint">
              CHECK YOUR CONNECTION AND TRY AGAIN
            </p>
            <button
              onClick={() => refresh()}
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-amber text-amber hover:bg-amber hover:text-board-bg transition-colors"
              aria-label="Retry fetching line status"
            >
              <RefreshCw size={12} strokeWidth={1.5} />
              <span className="font-mono text-[10px] tracking-wider uppercase">
                RETRY
              </span>
            </button>
          </div>
        </BoardPanel>
      </div>
    );
  }

  const sortedLines = sortLines(lines, pinnedIds);
  const { goodService, disrupted } = getStatusSummary(lines);

  return (
    <PullToRefresh onRefresh={() => refresh()}>
      <div className="p-4 space-y-4">
        {/* ---- Page Header ---- */}
        <PageHeader title="Line Status" subtitle="LONDON TUBE NETWORK STATUS" />

        {/* ---- Status Summary + timestamp ---- */}
        <BoardPanel>
          <div className="flex justify-between items-center py-1">
            <AmberText variant="dim" size="xs">
              {lines.length} LINES
            </AmberText>
            <div className="flex gap-4">
              <span className="font-mono text-xs tracking-wider text-green-500">
                {goodService} OK
              </span>
              {disrupted > 0 && (
                <span className="font-mono text-xs tracking-wider text-red-500">
                  {disrupted} DISRUPTED
                </span>
              )}
            </div>
          </div>
          {lastUpdated && (
            <div className="mt-1.5 pt-1.5 border-t border-board-border">
              <AmberText variant="dim" size="xs">
                AS OF {formatHHMM(lastUpdated)} -- AUTO-UPDATES EVERY 60S
              </AmberText>
            </div>
          )}
        </BoardPanel>

        {/* ---- Night Tube banner (only during Fri/Sat night window) ---- */}
        {nightTubeActive && (
          <div className="flex items-center gap-2 p-3 border border-amber/40 bg-amber/10">
            <Moon size={14} strokeWidth={1.5} className="text-amber shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-mono text-xs tracking-wider text-amber amber-glow uppercase">
                NIGHT TUBE ACTIVE
              </span>
              <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mt-0.5">
                CENTRAL, JUBILEE, NORTHERN, PICCADILLY, VICTORIA
              </div>
            </div>
          </div>
        )}

        {/* ---- Strikes / Industrial Action ---- */}
        <StrikesPanel />

        {/* ---- Line Status Cards ---- */}
        <div className="space-y-2">
          {sortedLines.map((line) => {
            const primaryStatus = line.lineStatuses?.[0];
            const status = primaryStatus?.statusSeverityDescription || "Unknown";
            const severity = primaryStatus?.statusSeverity ?? 10;
            const reason = primaryStatus?.reason || "";

            return (
              <LineStatusCard
                key={line.id}
                lineId={line.id}
                lineName={LINE_NAMES[line.id] || line.name}
                colour={LINE_COLOURS[line.id] || "#FF9500"}
                status={status}
                severity={severity}
                reason={reason}
                isPinned={isPinned(line.id)}
                onTogglePin={togglePin}
                isNightTube={nightTubeActive && nightTubeSet.has(line.id)}
              />
            );
          })}
        </div>

        <div className="text-center py-1">
          <AmberText variant="dim" size="xs">
            PULL DOWN TO REFRESH
          </AmberText>
        </div>
      </div>
    </PullToRefresh>
  );
}
