/**
 * RailDepartureBoard.tsx — Live National Rail departure board
 *
 * Fetches live departures from /api/rail/departures for a FROM station,
 * optionally filtered to trains calling at a TO station. Polls every 30s.
 *
 * Tapping a row opens the ServiceDetailSheet (controlled by the parent
 * via onServiceTap).
 *
 * Renders one BoardPanel with up to `maxRows` rows. Shows friendly states for:
 *   - Loading (skeleton)
 *   - API key not configured (helpful message)
 *   - Error (fallback message, retry hint)
 *   - No departures (empty state)
 */

"use client";

import { useRailDepartures } from "@/hooks/useRailDepartures";
import BoardPanel from "@/components/shared/BoardPanel";
import AmberText from "@/components/shared/AmberText";
import LoadingBoard from "@/components/shared/LoadingBoard";
import RailArrivalRow from "./RailArrivalRow";
import type { RailDeparture } from "@/lib/rail-types";

interface RailDepartureBoardProps {
  /** Origin station CRS code */
  fromCrs: string;
  /** Origin station display name — shown in the panel title */
  fromName: string;
  /** Optional destination CRS filter */
  toCrs?: string | null;
  /** Optional destination name — appended to panel title when filtered */
  toName?: string | null;
  /** Max rows to request + display (default 10) */
  maxRows?: number;
  /**
   * Called when a row is tapped — receives the full departure so the
   * parent can open the ServiceDetailSheet using the bundled
   * calling points (no second API call needed).
   */
  onServiceTap?: (departure: RailDeparture) => void;
}

export default function RailDepartureBoard({
  fromCrs,
  fromName,
  toCrs,
  toName,
  maxRows = 10,
  onServiceTap,
}: RailDepartureBoardProps) {
  const { departures, isLoading, error, notConfigured } = useRailDepartures({
    fromCrs,
    toCrs,
    numRows: maxRows,
  });

  const title = toName
    ? `${fromName.toUpperCase()} --> ${toName.toUpperCase()}`
    : fromName.toUpperCase();

  /* ---- Not configured: friendly message ---- */
  if (notConfigured) {
    return (
      <BoardPanel title={title}>
        <div className="py-6 text-center space-y-2">
          <AmberText variant="secondary" size="sm" uppercase>
            RAIL SERVICE UNAVAILABLE
          </AmberText>
          <p className="font-mono text-xs tracking-wider text-amber-faint">
            RDM API KEY NOT CONFIGURED.
            <br />
            SUBSCRIBE TO &quot;LIVE ARRIVAL AND
            <br />
            DEPARTURE BOARDS&quot; AT raildata.org.uk
          </p>
        </div>
      </BoardPanel>
    );
  }

  /* ---- Loading (no cached data yet) ---- */
  if (isLoading && departures.length === 0) {
    return (
      <BoardPanel title={title}>
        <LoadingBoard message="LOADING DEPARTURES..." />
      </BoardPanel>
    );
  }

  /* ---- Error state ---- */
  if (error && departures.length === 0) {
    return (
      <BoardPanel title={title}>
        <div className="py-6 text-center space-y-2">
          <AmberText variant="secondary" size="sm" uppercase>
            UNABLE TO FETCH DEPARTURES
          </AmberText>
          <p className="font-mono text-xs tracking-wider text-amber-faint">
            CHECK YOUR CONNECTION AND TRY AGAIN
          </p>
        </div>
      </BoardPanel>
    );
  }

  /* ---- No departures ---- */
  if (departures.length === 0) {
    return (
      <BoardPanel title={title}>
        <div className="py-6 text-center">
          <AmberText variant="secondary" size="sm" uppercase>
            {toName
              ? "NO DIRECT TRAINS FOUND"
              : "NO DEPARTURES SCHEDULED"}
          </AmberText>
          {toName && (
            <p className="font-mono text-xs tracking-wider text-amber-faint mt-2">
              TRY WITHOUT THE DESTINATION FILTER
              <br />
              -- A CHANGE MAY BE REQUIRED
            </p>
          )}
        </div>
      </BoardPanel>
    );
  }

  /* ---- Normal render ---- */
  return (
    <div className="space-y-3">
      <BoardPanel title={title}>
        <div role="table" aria-label={`Departures from ${fromName}`}>
          {departures.map((dep, i) => (
            <RailArrivalRow
              key={`${dep.serviceId}-${i}`}
              departure={dep}
              onClick={onServiceTap}
            />
          ))}
        </div>
      </BoardPanel>
      <div className="text-center py-1">
        <AmberText variant="dim" size="xs">
          AUTO-UPDATING EVERY 30S
        </AmberText>
      </div>
    </div>
  );
}
