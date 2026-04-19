/**
 * RailDepartureBoard.tsx — Live National Rail departure board
 *
 * Fetches live departures from /api/rail/departures for a FROM station,
 * optionally filtered to trains calling at a TO station. Polls every 30s.
 *
 * Tapping a row opens the ServiceDetailSheet (controlled by the parent
 * via onServiceTap).
 *
 * Renders one BoardPanel with up to `maxRows` rows, wrapped in a
 * pull-to-refresh handler. Shows friendly states for:
 *   - Loading (dot-matrix indicator)
 *   - API key not configured (helpful setup message)
 *   - Error (fallback message + retry button)
 *   - No departures at all (empty state)
 *   - No direct trains when a destination is set (explains a change may be required)
 */

"use client";

import { RefreshCw } from "lucide-react";
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
  const { departures, isLoading, error, notConfigured, refresh } =
    useRailDepartures({
      fromCrs,
      toCrs,
      numRows: maxRows,
    });
  /*
   * Note: pull-to-refresh is now handled at the page level via SWR's
   * global mutate (so pulling from the top of the whole Rail page
   * refreshes everything). This component no longer needs its own
   * PullToRefresh wrapper.
   */

  const title = toName
    ? `${fromName.toUpperCase()} --> ${toName.toUpperCase()}`
    : fromName.toUpperCase();

  /* ---- Not configured: friendly setup prompt ---- */
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

  /* ---- Error state — offer an explicit RETRY ---- */
  if (error && departures.length === 0) {
    return (
      <BoardPanel title={title}>
        <div className="py-6 text-center space-y-3">
          <AmberText variant="secondary" size="sm" uppercase>
            UNABLE TO FETCH DEPARTURES
          </AmberText>
          <p className="font-mono text-xs tracking-wider text-amber-faint">
            CHECK YOUR CONNECTION AND TRY AGAIN
          </p>
          <button
            onClick={() => refresh()}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-amber text-amber hover:bg-amber hover:text-board-bg transition-colors"
            aria-label="Retry fetching departures"
          >
            <RefreshCw size={12} strokeWidth={1.5} />
            <span className="font-mono text-[10px] tracking-wider uppercase">
              RETRY
            </span>
          </button>
        </div>
      </BoardPanel>
    );
  }

  /* ---- No departures found ---- */
  if (departures.length === 0) {
    return (
      <BoardPanel title={title}>
        <div className="py-6 text-center">
          {toName ? (
            <>
              <AmberText variant="secondary" size="sm" uppercase>
                NO DIRECT TRAINS FOUND
              </AmberText>
              <p className="font-mono text-xs tracking-wider text-amber-faint mt-3 leading-relaxed">
                NO DIRECT SERVICES FROM
                <br />
                {fromName.toUpperCase()} TO {toName.toUpperCase()}
                <br />
                IN THE NEXT HOUR.
                <br />
                <br />
                YOUR JOURNEY MAY REQUIRE A CHANGE --
                <br />
                CLEAR THE DESTINATION TO SEE
                <br />
                ALL DEPARTURES FROM HERE.
              </p>
            </>
          ) : (
            <AmberText variant="secondary" size="sm" uppercase>
              NO DEPARTURES SCHEDULED
            </AmberText>
          )}
        </div>
      </BoardPanel>
    );
  }

  /* ---- Normal render (pull-to-refresh lives at the page level) ---- */
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
          AUTO-UPDATING EVERY 30S -- PULL DOWN TO REFRESH
        </AmberText>
      </div>
    </div>
  );
}
