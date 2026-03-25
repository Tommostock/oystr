/**
 * page.tsx — Home page (Departures Board)
 *
 * The main page of Oystr. Users search for a station,
 * then see a live departure board showing incoming trains/buses.
 *
 * Flow:
 *   1. User types in the search bar
 *   2. Autocomplete dropdown shows matching stations
 *   3. User selects a station
 *   4. Departure board appears with live arrival data
 *   5. Data auto-refreshes every 30 seconds
 *   6. User can save the station for offline and quick access
 *
 * Also supports arriving via URL params from the Saved page:
 *   /?stopId=940GZZLUMLE&name=Mile End
 */

"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import StationSearch from "@/components/shared/StationSearch";
import DepartureBoard from "@/components/departure-board/DepartureBoard";
import SaveStationButton from "@/components/departure-board/SaveStationButton";
import BoardPanel from "@/components/shared/BoardPanel";
import AmberText from "@/components/shared/AmberText";

/** Shape of a selected station (from the search results) */
interface SelectedStation {
  naptanId: string;
  name: string;
  lat: number;
  lon: number;
  modes: string[];
  lines: { id: string; name: string }[];
}

/**
 * Inner component that reads URL search params.
 * Wrapped in Suspense because useSearchParams requires it in Next.js 15.
 */
function HomeContent() {
  /* The station the user has selected (null = none selected yet) */
  const [selectedStation, setSelectedStation] =
    useState<SelectedStation | null>(null);

  /* Read URL params (used when navigating from the Saved page) */
  const searchParams = useSearchParams();

  /*
   * If we arrive with ?stopId=X&name=Y in the URL,
   * pre-select that station so the departure board loads immediately.
   */
  useEffect(() => {
    const stopId = searchParams.get("stopId");
    const name = searchParams.get("name");

    if (stopId && name) {
      setSelectedStation({
        naptanId: stopId,
        name: name,
        lat: 0,
        lon: 0,
        modes: [],
        lines: [],
      });
    }
  }, [searchParams]);

  return (
    <div className="p-4 space-y-4">
      {/* ---- App Header ---- */}
      <div className="text-center pt-4 pb-2">
        <AmberText
          as="h1"
          size="2xl"
          uppercase
          className="amber-glow-strong dot-matrix"
        >
          Oystr
        </AmberText>
      </div>

      {/* ---- Station Search ---- */}
      <StationSearch
        onSelect={(station) => setSelectedStation(station)}
        placeholder="Search for a station..."
      />

      {/* ---- Departure Board or Empty State ---- */}
      {selectedStation ? (
        <div className="space-y-3">
          {/* Save station button — sits between search and board */}
          <div className="flex justify-end">
            <SaveStationButton station={selectedStation} />
          </div>

          {/* Live departure board for the selected station */}
          <DepartureBoard
            stopId={selectedStation.naptanId}
            stationName={selectedStation.name}
          />
        </div>
      ) : (
        /* Show a placeholder when no station is selected */
        <BoardPanel>
          <div className="py-8 text-center">
            <AmberText variant="dim" size="sm" className="dot-matrix">
              SELECT A STATION TO VIEW LIVE DEPARTURES
            </AmberText>
          </div>
        </BoardPanel>
      )}
    </div>
  );
}

/**
 * Home page wrapper.
 * Suspense boundary is required because useSearchParams
 * needs to be wrapped in Suspense in Next.js 15.
 */
export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-center pt-12">
          <AmberText variant="dim" size="sm" className="dot-matrix animate-blink">
            LOADING...
          </AmberText>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
