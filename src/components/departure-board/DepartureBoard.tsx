/**
 * DepartureBoard.tsx — Full departure board for a station
 *
 * Shows live arrivals grouped by platform/direction,
 * styled exactly like a real TfL dot-matrix departure board.
 *
 * Groups arrivals by their platformName (e.g. "Eastbound - Platform 1")
 * and shows up to 4 arrivals per group.
 *
 * Usage:
 *   <DepartureBoard stopId="940GZZLUMLE" stationName="Mile End" />
 */

"use client";

import { useArrivals } from "@/hooks/useArrivals";
import { useLineStatus } from "@/hooks/useLineStatus";
import { useOffline } from "@/hooks/useOffline";
import { LINE_COLOURS } from "@/lib/constants";
import type { ArrivalPrediction, LineStatus } from "@/lib/tfl-types";
import BoardPanel from "@/components/shared/BoardPanel";
import AmberText from "@/components/shared/AmberText";
import PullToRefresh from "@/components/shared/PullToRefresh";
import BoardSkeleton from "./BoardSkeleton";
import ArrivalRow from "./ArrivalRow";
import OfflineTimetable from "./OfflineTimetable";

interface DepartureBoardProps {
  /** The station's Naptan ID */
  stopId: string;
  /** Display name of the station */
  stationName: string;
}

/** Maximum number of arrivals to show per platform group */
const MAX_ARRIVALS_PER_GROUP = 4;

/**
 * Group arrivals by their platform name.
 *
 * TfL returns a flat list of arrivals. We need to group them
 * so the board shows sections like:
 *   "Eastbound - Platform 1"
 *     EPPING          2 MIN
 *     HAINAULT        5 MIN
 *   "Westbound - Platform 2"
 *     WEST RUISLIP    3 MIN
 */
function groupByPlatform(
  arrivals: ArrivalPrediction[]
): Record<string, ArrivalPrediction[]> {
  const groups: Record<string, ArrivalPrediction[]> = {};

  for (const arrival of arrivals) {
    /* Use platformName as the group key, or "Unknown" if missing */
    const key = arrival.platformName || "Unknown Platform";

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(arrival);
  }

  /*
   * Sort each group by timeToStation (soonest first)
   * and limit to MAX_ARRIVALS_PER_GROUP per group.
   */
  for (const key in groups) {
    groups[key] = groups[key]
      .sort((a, b) => a.timeToStation - b.timeToStation)
      .slice(0, MAX_ARRIVALS_PER_GROUP);
  }

  return groups;
}


/**
 * Clean up destination names from TfL.
 * TfL includes suffixes like "Underground Station", "DLR Station", etc.
 * Real departure boards just show the station name.
 *
 * "Epping Underground Station" => "Epping"
 * "Stratford (London) DLR Station" => "Stratford"
 * "Hainault Underground Station" => "Hainault"
 */
function cleanDestination(name: string | undefined): string {
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
 * Get the status text and colour for a line.
 * Returns null if good service (no need to show anything).
 */
function getLineStatusInfo(
  lineId: string,
  lineStatuses: LineStatus[]
): { text: string; colour: string } | null {
  const status = lineStatuses.find((l) => l.id === lineId);
  if (!status || status.lineStatuses.length === 0) return null;

  const detail = status.lineStatuses[0];
  /* Don't show anything for "Good Service" — only disruptions */
  if (detail.statusSeverity === 10) return null;

  const severity = detail.statusSeverity;
  /* Red for severe (suspended, closed, part-closed), amber for minor/major delays */
  const colour =
    severity <= 5 ? "#ff3b30" : severity <= 8 ? "#ff9500" : "#cc7700";

  return { text: detail.statusSeverityDescription.toUpperCase(), colour };
}

export default function DepartureBoard({
  stopId,
  stationName,
}: DepartureBoardProps) {
  /* Fetch live arrivals with automatic polling every 30 seconds */
  const { arrivals, isLoading, error, refresh, lastUpdated } =
    useArrivals(stopId);
  /* Fetch line statuses for the status indicators */
  const { lines: lineStatuses } = useLineStatus();
  /* Offline flag — drives per-source staleness indicator below */
  const isOffline = useOffline();

  /* ---- Loading state: show skeleton rows instead of blinking text ---- */
  if (isLoading && arrivals.length === 0) {
    return (
      <div className="space-y-3">
        <BoardSkeleton title={stationName} rows={4} />
        <BoardSkeleton title="Loading..." rows={3} />
      </div>
    );
  }

  /* ---- Error state — show offline timetable as fallback ---- */
  if (error && arrivals.length === 0) {
    return <OfflineTimetable stopId={stopId} stationName={stationName} />;
  }

  /* ---- No arrivals — show offline timetable as fallback ---- */
  if (arrivals.length === 0) {
    return <OfflineTimetable stopId={stopId} stationName={stationName} />;
  }

  /* ---- Group arrivals by platform ---- */
  const groups = groupByPlatform(arrivals);
  /* Sort group names alphabetically for consistent display */
  const sortedGroupNames = Object.keys(groups).sort();

  return (
    <PullToRefresh onRefresh={() => refresh()}>
      <div className="space-y-3">
        {sortedGroupNames.map((platformName) => {
          const firstArrival = groups[platformName][0];
          const isBusGroup = firstArrival?.modeName === "bus";
          const groupTitle = isBusGroup
            ? `BUS STOP ${platformName}`
            : platformName;

          /* Check line status for the first arrival's line in this group */
          const lineId = firstArrival?.lineId;
          const statusInfo =
            lineId && !isBusGroup
              ? getLineStatusInfo(lineId, lineStatuses)
              : null;

          return (
            <BoardPanel key={platformName} title={groupTitle}>
              {/* Line status indicator — only shows when disrupted */}
              {statusInfo && (
                <div
                  className="flex items-center gap-2 mb-2 px-1 py-1.5 border-b border-board-border/50"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: statusInfo.colour }}
                  />
                  <span
                    className="font-mono text-[10px] tracking-wider uppercase"
                    style={{ color: statusInfo.colour }}
                  >
                    {statusInfo.text}
                  </span>
                </div>
              )}
              <div role="table" aria-label={`Departures from ${groupTitle}`}>
                {groups[platformName].map((arrival, index) => (
                  <ArrivalRow
                    key={`${arrival.vehicleId}-${arrival.expectedArrival}-${index}`}
                    destination={cleanDestination(arrival.destinationName)}
                    timeToStation={arrival.timeToStation}
                    expectedArrival={arrival.expectedArrival}
                    lineColour={LINE_COLOURS[arrival.lineId]}
                    routeNumber={arrival.lineName}
                    modeName={arrival.modeName}
                    className="board-row-stagger"
                  />
                ))}
              </div>
            </BoardPanel>
          );
        })}

        {/*
         * Footer status line. When online, shows the normal
         * "auto-updating" message. When offline with cached data,
         * flips to "LAST SEEN HH:MM · OFFLINE" so the user knows
         * the board is stale rather than live.
         */}
        <div className="text-center py-1">
          <AmberText variant="dim" size="xs">
            {isOffline && lastUpdated
              ? `LAST SEEN ${new Date(lastUpdated).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })} -- OFFLINE`
              : "AUTO-UPDATING EVERY 30S -- PULL DOWN TO REFRESH"}
          </AmberText>
        </div>
      </div>
    </PullToRefresh>
  );
}
