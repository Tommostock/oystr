/**
 * map/page.tsx -- Tube Map page
 *
 * Displays the official TfL tube map as a zoomable, pannable image.
 * Uses the Wikimedia Commons CC-BY-SA-4.0 schematic SVG with
 * CSS filters to invert it to dark mode.
 *
 * Features:
 *   - Pinch/scroll to zoom
 *   - Drag to pan
 *   - Double-tap to reset
 *   - Search button to find and view station departures
 */

"use client";

import { useState, useCallback } from "react";
import TubeMapImage from "@/components/map/TubeMapImage";
import StationSearch from "@/components/shared/StationSearch";
import StationBottomSheet from "@/components/map/StationBottomSheet";
import { Search, X } from "lucide-react";

/** Shape of a selected station for the bottom sheet */
interface SelectedStation {
  naptanId: string;
  name: string;
}

export default function MapPage() {
  /* The station the user selected (shown in bottom sheet) */
  const [selectedStation, setSelectedStation] =
    useState<SelectedStation | null>(null);

  /* Whether the search overlay is visible */
  const [showSearch, setShowSearch] = useState(false);

  /**
   * Handle station selection from search.
   */
  const handleStationSelect = useCallback(
    (station: { naptanId: string; name: string }) => {
      setSelectedStation(station);
      setShowSearch(false);
    },
    []
  );

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ top: 0, bottom: "4rem" }}
    >
      {/* ---- Search bar / toggle at top ---- */}
      <div className="shrink-0 bg-board-bg border-b border-board-border z-[500]">
        {showSearch ? (
          <div className="flex items-center gap-2 p-2">
            <div className="flex-1">
              <StationSearch
                onSelect={handleStationSelect}
                placeholder="Search station for departures..."
              />
            </div>
            <button
              onClick={() => setShowSearch(false)}
              className="text-amber-faint hover:text-amber p-2 transition-colors"
              aria-label="Close search"
            >
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSearch(true)}
            className="w-full flex items-center gap-3 px-4 py-3 text-amber-faint hover:text-amber font-mono text-sm tracking-wider transition-colors"
          >
            <Search size={16} strokeWidth={1.5} />
            <span>SEARCH STATION FOR DEPARTURES</span>
          </button>
        )}
      </div>

      {/* ---- Map container (fills remaining space) ---- */}
      <div className="flex-1 relative overflow-hidden">
        <TubeMapImage />

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
