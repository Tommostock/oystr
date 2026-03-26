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
 * Auto-refreshes every 60 seconds.
 * Styled like a dot-matrix information board at station entrances.
 */

"use client";

import { useLineStatus } from "@/hooks/useLineStatus";
import { LINE_COLOURS, LINE_NAMES } from "@/lib/constants";
import type { LineStatus } from "@/lib/tfl-types";
import BoardPanel from "@/components/shared/BoardPanel";
import AmberText from "@/components/shared/AmberText";
import LoadingBoard from "@/components/shared/LoadingBoard";
import LineStatusCard from "@/components/line-status/LineStatusCard";

/**
 * Sort lines by severity, then alphabetically within each group.
 *
 * TfL severity values (lower = worse):
 *   0  = "Special Service"
 *   1  = "Closed"
 *   2  = "Suspended"
 *   3  = "Part Suspended"
 *   4  = "Planned Closure"
 *   5  = "Part Closure"
 *   6  = "Severe Delays"
 *   7  = "Reduced Service"
 *   8  = "Bus Service"
 *   9  = "Minor Delays"
 *   10 = "Good Service"
 *   11 = "Part Closed"
 *   12 = "Exit Only"
 *   13 = "No Step Free Access"
 *   14 = "Change of Frequency"
 *   15 = "Diverted"
 *   16 = "Not Running"
 *   17 = "Issues Reported"
 *   18 = "No Issues"
 *   19 = "Information"
 *   20 = "Service Closed"
 *
 * Display order (worst disruptions first):
 *   1. Closed / Suspended / Not Running     (severity 1, 2, 16, 20)
 *   2. Part Suspended / Part Closed         (severity 3, 5, 11)
 *   3. Severe Delays / Reduced Service      (severity 6, 7)
 *   4. Minor Delays                         (severity 9)
 *   5. Other non-good statuses              (everything else != 10)
 *   6. Good Service                         (severity 10)
 *
 * Within each group, lines are sorted alphabetically by name.
 */
function getSortPriority(severity: number): number {
  switch (severity) {
    case 1:   // Closed
    case 2:   // Suspended
    case 16:  // Not Running
    case 20:  // Service Closed
      return 0;
    case 3:   // Part Suspended
    case 5:   // Part Closure
    case 11:  // Part Closed
      return 1;
    case 6:   // Severe Delays
    case 7:   // Reduced Service
      return 2;
    case 9:   // Minor Delays
      return 3;
    case 10:  // Good Service
      return 5;
    default:  // Everything else (special service, planned closure, etc.)
      return 4;
  }
}

function sortLines(lines: LineStatus[]): LineStatus[] {
  return [...lines].sort((a, b) => {
    const aSeverity = a.lineStatuses?.[0]?.statusSeverity ?? 10;
    const bSeverity = b.lineStatuses?.[0]?.statusSeverity ?? 10;
    const aPriority = getSortPriority(aSeverity);
    const bPriority = getSortPriority(bSeverity);

    /* Sort by severity group first (worst at top) */
    if (aPriority !== bPriority) return aPriority - bPriority;

    /* Within the same group, sort alphabetically by line name */
    const aName = LINE_NAMES[a.id] || a.name;
    const bName = LINE_NAMES[b.id] || b.name;
    return aName.localeCompare(bName);
  });
}

/**
 * Count how many lines have good service vs disruptions.
 */
function getStatusSummary(lines: LineStatus[]) {
  let goodService = 0;
  let disrupted = 0;

  for (const line of lines) {
    const severity = line.lineStatuses?.[0]?.statusSeverity ?? 10;
    if (severity === 10) {
      goodService++;
    } else {
      disrupted++;
    }
  }

  return { goodService, disrupted };
}

export default function StatusPage() {
  /* Fetch live line status with automatic polling every 60 seconds */
  const { lines, isLoading, error } = useLineStatus();

  /* ---- Loading state ---- */
  if (isLoading && lines.length === 0) {
    return (
      <div className="p-4 space-y-4">
        <div className="text-center pt-4 pb-2">
          <AmberText as="h1" size="lg" uppercase className="dot-matrix">
            Line Status
          </AmberText>
        </div>
        <BoardPanel>
          <LoadingBoard message="FETCHING LINE STATUS..." />
        </BoardPanel>
      </div>
    );
  }

  /* ---- Error state ---- */
  if (error && lines.length === 0) {
    return (
      <div className="p-4 space-y-4">
        <div className="text-center pt-4 pb-2">
          <AmberText as="h1" size="lg" uppercase className="dot-matrix">
            Line Status
          </AmberText>
        </div>
        <BoardPanel>
          <div className="py-6 text-center">
            <AmberText variant="dim" size="sm" className="dot-matrix">
              TFL DATA UNAVAILABLE
            </AmberText>
          </div>
        </BoardPanel>
      </div>
    );
  }

  /* Sort lines into our preferred display order */
  const sortedLines = sortLines(lines);
  const { goodService, disrupted } = getStatusSummary(lines);

  return (
    <div className="p-4 space-y-4">
      {/* ---- Page Header ---- */}
      <div className="text-center pt-4 pb-2">
        <AmberText as="h1" size="lg" uppercase className="dot-matrix">
          Line Status
        </AmberText>
      </div>

      {/* ---- Status Summary ---- */}
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
      </BoardPanel>

      {/* ---- Line Status Cards ---- */}
      <div className="space-y-2">
        {sortedLines.map((line) => {
          /* Get the first (primary) status for this line */
          const primaryStatus = line.lineStatuses?.[0];
          const status =
            primaryStatus?.statusSeverityDescription || "Unknown";
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
            />
          );
        })}
      </div>

      {/* ---- Last updated indicator ---- */}
      <div className="text-center py-1">
        <AmberText variant="dim" size="xs">
          AUTO-UPDATING EVERY 60S
        </AmberText>
      </div>
    </div>
  );
}
