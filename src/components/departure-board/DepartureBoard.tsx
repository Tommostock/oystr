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
import { LINE_COLOURS } from "@/lib/constants";
import type { ArrivalPrediction } from "@/lib/tfl-types";
import BoardPanel from "@/components/shared/BoardPanel";
import AmberText from "@/components/shared/AmberText";
import LoadingBoard from "@/components/shared/LoadingBoard";
import ArrivalRow from "./ArrivalRow";

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
 * Extract a short platform label from the full platform name.
 * "Eastbound - Platform 1" => "1"
 * "Platform 3" => "3"
 * "Northbound" => ""
 */
function extractPlatformNumber(platformName: string): string {
  const match = platformName.match(/Platform\s+(\d+)/i);
  return match ? match[1] : "";
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

export default function DepartureBoard({
  stopId,
  stationName,
}: DepartureBoardProps) {
  /* Fetch live arrivals with automatic polling every 30 seconds */
  const { arrivals, isLoading, error } = useArrivals(stopId);

  /* ---- Loading state ---- */
  if (isLoading && arrivals.length === 0) {
    return (
      <BoardPanel title={stationName}>
        <LoadingBoard message="FETCHING ARRIVALS..." />
      </BoardPanel>
    );
  }

  /* ---- Error state ---- */
  if (error && arrivals.length === 0) {
    return (
      <BoardPanel title={stationName}>
        <div className="py-6 text-center">
          <AmberText variant="dim" size="sm" className="dot-matrix">
            TFL DATA UNAVAILABLE
          </AmberText>
        </div>
      </BoardPanel>
    );
  }

  /* ---- No arrivals ---- */
  if (arrivals.length === 0) {
    return (
      <BoardPanel title={stationName}>
        <div className="py-6 text-center">
          <AmberText variant="dim" size="sm" className="dot-matrix">
            NO ARRIVALS DATA AVAILABLE
          </AmberText>
        </div>
      </BoardPanel>
    );
  }

  /* ---- Group arrivals by platform ---- */
  const groups = groupByPlatform(arrivals);
  /* Sort group names alphabetically for consistent display */
  const sortedGroupNames = Object.keys(groups).sort();

  return (
    <div className="space-y-3">
      {sortedGroupNames.map((platformName) => {
        /*
         * Check if this group contains bus arrivals.
         * If so, use "BUS STOP X" as the header instead of the raw letter.
         * Detect from the first arrival's modeName.
         */
        const firstArrival = groups[platformName][0];
        const isBusGroup = firstArrival?.modeName === "bus";
        const groupTitle = isBusGroup
          ? `BUS STOP ${platformName}`
          : platformName;

        return (
          <BoardPanel key={platformName} title={groupTitle}>
            <div role="table" aria-label={`Departures from ${groupTitle}`}>
              {groups[platformName].map((arrival, index) => (
                <ArrivalRow
                  key={`${arrival.vehicleId}-${arrival.expectedArrival}-${index}`}
                  platform={extractPlatformNumber(platformName)}
                  destination={cleanDestination(arrival.destinationName)}
                  timeToStation={arrival.timeToStation}
                  lineColour={LINE_COLOURS[arrival.lineId]}
                  routeNumber={arrival.lineName}
                  modeName={arrival.modeName}
                />
              ))}
            </div>
          </BoardPanel>
        );
      })}

      {/* ---- Last updated indicator ---- */}
      <div className="text-center py-1">
        <AmberText variant="dim" size="xs">
          AUTO-UPDATING EVERY 30S
        </AmberText>
      </div>
    </div>
  );
}
