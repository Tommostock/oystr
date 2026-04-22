/**
 * FlightArrivalsBoard.tsx — Live ARRIVALS board for an airport
 *
 * Mirror of FlightDepartureBoard but wired to useFlightArrivals.
 * State chrome is delegated to the shared BoardState primitive.
 */

"use client";

import { useFlightArrivals } from "@/hooks/useFlightArrivals";
import BoardPanel from "@/components/shared/BoardPanel";
import BoardState from "@/components/shared/BoardState";
import FlightArrivalRow from "./FlightArrivalRow";
import type { FlightArrival } from "@/lib/flight-types";

interface FlightArrivalsBoardProps {
  iata: string;
  airportName: string;
  maxRows?: number;
  onFlightTap?: (arrival: FlightArrival) => void;
}

export default function FlightArrivalsBoard({
  iata,
  airportName,
  maxRows = 15,
  onFlightTap,
}: FlightArrivalsBoardProps) {
  const { arrivals, isLoading, error, notConfigured, refresh } =
    useFlightArrivals({ iata, numRows: maxRows });

  const title = `${airportName.toUpperCase()} -- ARRIVALS`;

  if (notConfigured) {
    return (
      <BoardPanel title={title}>
        <BoardState
          variant="notConfigured"
          message="AWAITING API KEY"
          hint={
            <>
              LIVE ARRIVALS APPEAR
              <br />
              ONCE THE PROVIDER IS CONNECTED
            </>
          }
        />
      </BoardPanel>
    );
  }

  if (isLoading && arrivals.length === 0) {
    return (
      <BoardPanel title={title}>
        <BoardState variant="loading" message="FETCHING ARRIVALS..." />
      </BoardPanel>
    );
  }

  if (error && arrivals.length === 0) {
    return (
      <BoardPanel title={title}>
        <BoardState
          variant="error"
          message="COULD NOT LOAD ARRIVALS"
          onRetry={() => refresh()}
        />
      </BoardPanel>
    );
  }

  if (arrivals.length === 0) {
    return (
      <BoardPanel title={title}>
        <BoardState variant="empty" message="NO ARRIVALS LISTED" />
      </BoardPanel>
    );
  }

  return (
    <BoardPanel title={title}>
      <div role="table" aria-label={`${airportName} arrivals`}>
        {arrivals.slice(0, maxRows).map((arr) => (
          <FlightArrivalRow key={arr.id} arrival={arr} onClick={onFlightTap} />
        ))}
      </div>
    </BoardPanel>
  );
}
