/**
 * map/page.tsx — Interactive Tube Map page
 *
 * Full-screen Leaflet map showing tube stations and lines.
 * Features:
 *   - Dark CartoDB tiles
 *   - Station markers at real coordinates
 *   - Coloured polylines between stations
 *   - Tap a station for live departures (bottom sheet)
 *   - Line toggle buttons to show/hide lines
 *
 * Leaflet is dynamically imported (no SSR) because it requires `window`.
 */

"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import LineToggle from "@/components/map/LineToggle";
import StationBottomSheet from "@/components/map/StationBottomSheet";

/*
 * Dynamically import TubeMap with SSR disabled.
 * Leaflet uses `window` and `document` which don't exist on the server.
 * This ensures the map component only loads in the browser.
 */
const TubeMap = dynamic(() => import("@/components/map/TubeMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-board-bg">
      <span className="font-mono text-sm tracking-wider text-amber-faint animate-blink">
        LOADING MAP...
      </span>
    </div>
  ),
});

/** Shape of a selected station for the bottom sheet */
interface SelectedStation {
  naptanId: string;
  name: string;
}

export default function MapPage() {
  /*
   * Track which lines are visible on the map.
   * Start with a few popular lines to avoid overwhelming the API on load.
   */
  const [activeLines, setActiveLines] = useState<Set<string>>(
    new Set([
      "central",
      "victoria",
      "jubilee",
      "northern",
      "piccadilly",
      "elizabeth",
    ])
  );

  /* The station the user tapped (shown in bottom sheet) */
  const [selectedStation, setSelectedStation] =
    useState<SelectedStation | null>(null);

  /**
   * Toggle a line on/off.
   */
  const handleToggle = useCallback((lineId: string) => {
    setActiveLines((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) {
        next.delete(lineId);
      } else {
        next.add(lineId);
      }
      return next;
    });
  }, []);

  /**
   * Handle station marker tap.
   */
  const handleStationSelect = useCallback((station: SelectedStation) => {
    setSelectedStation(station);
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col" style={{ top: 0, bottom: "4rem" }}>
      {/* ---- Line toggle buttons (scrollable) ---- */}
      <div className="shrink-0 bg-board-bg border-b border-board-border z-[500]">
        <LineToggle activeLines={activeLines} onToggle={handleToggle} />
      </div>

      {/* ---- Map container (fills remaining space) ---- */}
      <div className="flex-1 relative">
        <TubeMap
          activeLines={activeLines}
          onStationSelect={handleStationSelect}
        />

        {/* ---- Station bottom sheet ---- */}
        {selectedStation && (
          <StationBottomSheet
            station={selectedStation}
            onClose={() => setSelectedStation(null)}
          />
        )}
      </div>
    </div>
  );
}
