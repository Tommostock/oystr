/**
 * FlightArrivalsBoard.tsx — Live ARRIVALS board for an airport
 *
 * Mirror of FlightDepartureBoard but wired to useFlightArrivals.
 * Handles the same set of states: awaiting-key, loading, error,
 * empty, populated.
 */

"use client";

import { RefreshCw } from "lucide-react";
import { useFlightArrivals } from "@/hooks/useFlightArrivals";
import BoardPanel from "@/components/shared/BoardPanel";
import AmberText from "@/components/shared/AmberText";
import LoadingBoard from "@/components/shared/LoadingBoard";
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
        <div className="py-6 text-center space-y-3">
          <AmberText variant="dim" size="sm" className="dot-matrix">
            AWAITING API KEY
          </AmberText>
          <p className="font-mono text-[11px] tracking-wider text-amber-faint leading-relaxed uppercase">
            LIVE ARRIVALS APPEAR
            <br />
            ONCE THE PROVIDER IS CONNECTED
          </p>
        </div>
      </BoardPanel>
    );
  }

  if (isLoading && arrivals.length === 0) {
    return (
      <BoardPanel title={title}>
        <LoadingBoard message="FETCHING ARRIVALS..." />
      </BoardPanel>
    );
  }

  if (error && arrivals.length === 0) {
    return (
      <BoardPanel title={title}>
        <div className="py-4 text-center space-y-3">
          <AmberText variant="dim" size="sm" className="dot-matrix">
            COULD NOT LOAD ARRIVALS
          </AmberText>
          <button
            onClick={() => refresh()}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-amber text-amber hover:bg-amber hover:text-board-bg transition-colors"
            aria-label="Retry loading arrivals"
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

  if (arrivals.length === 0) {
    return (
      <BoardPanel title={title}>
        <div className="py-6 text-center">
          <AmberText variant="dim" size="sm" uppercase>
            NO ARRIVALS LISTED
          </AmberText>
        </div>
      </BoardPanel>
    );
  }

  return (
    <BoardPanel title={title}>
      <div role="table" aria-label={`${airportName} arrivals`}>
        {arrivals.slice(0, maxRows).map((arr) => (
          <FlightArrivalRow
            key={arr.id}
            arrival={arr}
            onClick={onFlightTap}
          />
        ))}
      </div>
    </BoardPanel>
  );
}
