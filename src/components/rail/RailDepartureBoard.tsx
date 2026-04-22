/**
 * RailDepartureBoard.tsx — Live National Rail departure board
 *
 * Fetches live departures from /api/rail/departures for a FROM station,
 * optionally filtered to trains calling at a TO station. Polls every 30s.
 *
 * Tapping a row opens the ServiceDetailSheet (controlled by the parent
 * via onServiceTap).
 *
 * Loading / error / empty / not-configured states are delegated to the
 * shared BoardState primitive for consistency with the rest of the app.
 */

"use client";

import { useRailDepartures } from "@/hooks/useRailDepartures";
import BoardPanel from "@/components/shared/BoardPanel";
import BoardState from "@/components/shared/BoardState";
import AmberText from "@/components/shared/AmberText";
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

  const title = toName
    ? `${fromName.toUpperCase()} --> ${toName.toUpperCase()}`
    : fromName.toUpperCase();

  if (notConfigured) {
    return (
      <BoardPanel title={title}>
        <BoardState
          variant="notConfigured"
          message="RAIL SERVICE UNAVAILABLE"
          hint={
            <>
              RDM API KEY NOT CONFIGURED.
              <br />
              SUBSCRIBE TO &quot;LIVE ARRIVAL AND
              <br />
              DEPARTURE BOARDS&quot; AT raildata.org.uk
            </>
          }
        />
      </BoardPanel>
    );
  }

  if (isLoading && departures.length === 0) {
    return (
      <BoardPanel title={title}>
        <BoardState variant="loading" message="LOADING DEPARTURES..." />
      </BoardPanel>
    );
  }

  if (error && departures.length === 0) {
    return (
      <BoardPanel title={title}>
        <BoardState
          variant="error"
          message="UNABLE TO FETCH DEPARTURES"
          hint="CHECK YOUR CONNECTION AND TRY AGAIN"
          onRetry={() => refresh()}
        />
      </BoardPanel>
    );
  }

  if (departures.length === 0) {
    return (
      <BoardPanel title={title}>
        {toName ? (
          <BoardState
            variant="empty"
            message="NO DIRECT TRAINS FOUND"
            hint={
              <>
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
              </>
            }
          />
        ) : (
          <BoardState variant="empty" message="NO DEPARTURES SCHEDULED" />
        )}
      </BoardPanel>
    );
  }

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
