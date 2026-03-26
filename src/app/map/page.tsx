/**
 * map/page.tsx -- Schematic Tube Map page
 *
 * Full-screen SVG schematic tube map in the Harry Beck style.
 * Features:
 *   - All 13 tube/DLR/Elizabeth lines with official colours
 *   - Clickable station markers with departures bottom sheet
 *   - Line toggle buttons to show/hide lines
 *   - Zoom and pan support
 *   - Live train position dots
 *
 * No external map library needed -- pure SVG rendering.
 */

"use client";

import { useState, useCallback } from "react";
import SchematicMap from "@/components/map/SchematicMap";
import LineToggle from "@/components/map/LineToggle";
import StationBottomSheet from "@/components/map/StationBottomSheet";

/** Shape of a selected station for the bottom sheet */
interface SelectedStation {
  naptanId: string;
  name: string;
}

export default function MapPage() {
  /*
   * Track which lines are visible on the map.
   * Start with all lines visible.
   */
  const [activeLines, setActiveLines] = useState<Set<string>>(
    new Set([
      "bakerloo",
      "central",
      "circle",
      "district",
      "hammersmith-city",
      "jubilee",
      "metropolitan",
      "northern",
      "piccadilly",
      "victoria",
      "waterloo-city",
      "elizabeth",
      "dlr",
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
      <div className="flex-1 relative overflow-hidden">
        <SchematicMap
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
