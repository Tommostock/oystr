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
import { LINE_COLOURS, LINE_NAMES, ALL_LINE_IDS } from "@/lib/constants";
import type { LineStatus } from "@/lib/tfl-types";
import BoardPanel from "@/components/shared/BoardPanel";
import AmberText from "@/components/shared/AmberText";
import LoadingBoard from "@/components/shared/LoadingBoard";
import LineStatusCard from "@/components/line-status/LineStatusCard";

/**
 * Sort lines into our preferred display order.
 * We use ALL_LINE_IDS from constants.ts to define the order,
 * so lines always appear in a consistent sequence.
 */
function sortLines(lines: LineStatus[]): LineStatus[] {
  /* Create a map of lineId -> index for quick lookup */
  const orderMap = new Map<string, number>();
  ALL_LINE_IDS.forEach((id, index) => orderMap.set(id, index));

  return [...lines].sort((a, b) => {
    const aOrder = orderMap.get(a.id) ?? 999;
    const bOrder = orderMap.get(b.id) ?? 999;
    return aOrder - bOrder;
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
