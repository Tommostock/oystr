/**
 * FlightDepartureBoard.tsx — Live departure board for an airport
 *
 * Fetches live flights from /api/flights/departures via the
 * useFlightDepartures hook, rendered in the dot-matrix BoardPanel
 * style shared with the Rail tab.
 *
 * Handles the usual set of states:
 *   - Loading (dot-matrix indicator)
 *   - Not configured (no API key yet — friendly "AWAITING API KEY" message)
 *   - Error (fallback + retry)
 *   - Empty (no departures listed)
 *   - Populated (up to `maxRows` flight rows)
 */

"use client";

import { RefreshCw } from "lucide-react";
import { useFlightDepartures } from "@/hooks/useFlightDepartures";
import BoardPanel from "@/components/shared/BoardPanel";
import AmberText from "@/components/shared/AmberText";
import LoadingBoard from "@/components/shared/LoadingBoard";
import FlightArrivalRow from "./FlightArrivalRow";
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

  /* ---- Not configured: API key missing, explain + reassure ---- */
  if (notConfigured) {
    return (
      <BoardPanel title={title}>
        <div className="py-6 text-center space-y-3">
          <AmberText variant="dim" size="sm" className="dot-matrix">
            AWAITING API KEY
          </AmberText>
          <p className="font-mono text-[11px] tracking-wider text-amber-faint leading-relaxed uppercase">
            LIVE FLIGHT DATA APPEARS
            <br />
            ONCE THE PROVIDER IS CONNECTED
          </p>
        </div>
      </BoardPanel>
    );
  }

  /* ---- Loading ---- */
  if (isLoading && departures.length === 0) {
    return (
      <BoardPanel title={title}>
        <LoadingBoard message="FETCHING FLIGHTS..." />
      </BoardPanel>
    );
  }

  /* ---- Error ---- */
  if (error && departures.length === 0) {
    return (
      <BoardPanel title={title}>
        <div className="py-4 text-center space-y-3">
          <AmberText variant="dim" size="sm" className="dot-matrix">
            COULD NOT LOAD FLIGHTS
          </AmberText>
          <button
            onClick={() => refresh()}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-amber text-amber hover:bg-amber hover:text-board-bg transition-colors"
            aria-label="Retry loading flights"
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

  /* ---- Empty ---- */
  if (departures.length === 0) {
    return (
      <BoardPanel title={title}>
        <div className="py-6 text-center">
          <AmberText variant="dim" size="sm" uppercase>
            NO DEPARTURES LISTED
          </AmberText>
        </div>
      </BoardPanel>
    );
  }

  /* ---- Populated ---- */
  return (
    <BoardPanel title={title}>
      <div role="table" aria-label={`${airportName} departures`}>
        {departures.slice(0, maxRows).map((dep) => (
          <FlightArrivalRow
            key={dep.id}
            departure={dep}
            onClick={onFlightTap}
          />
        ))}
      </div>
    </BoardPanel>
  );
}
