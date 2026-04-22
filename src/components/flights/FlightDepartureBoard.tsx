/**
 * FlightDepartureBoard.tsx — Live departure board for an airport
 *
 * Fetches live flights from /api/flights/departures via the
 * useFlightDepartures hook, rendered in the dot-matrix BoardPanel
 * style shared with the Rail tab.
 *
 * Loading / error / empty / not-configured states all delegate to
 * the shared BoardState primitive so the behaviour matches every
 * other board in the app.
 */

"use client";

import { useFlightDepartures } from "@/hooks/useFlightDepartures";
import BoardPanel from "@/components/shared/BoardPanel";
import BoardState from "@/components/shared/BoardState";
import FlightDepartureRow from "./FlightDepartureRow";
import type { FlightDeparture } from "@/lib/flight-types";

interface FlightDepartureBoardProps {
  /** 3-letter IATA of the airport to show */
  iata: string;
  /** Display name of the airport — shown in the panel title */
  airportName: string;
  /** Max rows to request + display (default 15) */
  maxRows?: number;
  /** Called when a row is tapped (future: open flight detail) */
  onFlightTap?: (departure: FlightDeparture) => void;
}

export default function FlightDepartureBoard({
  iata,
  airportName,
  maxRows = 15,
  onFlightTap,
}: FlightDepartureBoardProps) {
  const { departures, isLoading, error, notConfigured, refresh } =
    useFlightDepartures({ iata, numRows: maxRows });

  const title = `${airportName.toUpperCase()} -- DEPARTURES`;

  if (notConfigured) {
    return (
      <BoardPanel title={title}>
        <BoardState
          variant="notConfigured"
          message="AWAITING API KEY"
          hint={
            <>
              LIVE FLIGHT DATA APPEARS
              <br />
              ONCE THE PROVIDER IS CONNECTED
            </>
          }
        />
      </BoardPanel>
    );
  }

  if (isLoading && departures.length === 0) {
    return (
      <BoardPanel title={title}>
        <BoardState variant="loading" message="FETCHING FLIGHTS..." />
      </BoardPanel>
    );
  }

  if (error && departures.length === 0) {
    return (
      <BoardPanel title={title}>
        <BoardState
          variant="error"
          message="COULD NOT LOAD FLIGHTS"
          onRetry={() => refresh()}
        />
      </BoardPanel>
    );
  }

  if (departures.length === 0) {
    return (
      <BoardPanel title={title}>
        <BoardState variant="empty" message="NO DEPARTURES LISTED" />
      </BoardPanel>
    );
  }

  return (
    <BoardPanel title={title}>
      <div role="table" aria-label={`${airportName} departures`}>
        {departures.slice(0, maxRows).map((dep) => (
          <FlightDepartureRow
            key={dep.id}
            departure={dep}
            onClick={onFlightTap}
          />
        ))}
      </div>
    </BoardPanel>
  );
}
