/**
 * TubeMap.tsx — Interactive tube map using Leaflet
 *
 * Shows all tube stations plotted at their real geographic coordinates
 * on a dark-themed map. Lines are drawn between stations using
 * official TfL line colours.
 *
 * Features:
 *   - Dark CartoDB tiles for the retro aesthetic
 *   - Circle markers for each station
 *   - Polylines connecting stations on each line
 *   - Live train dots: pulsing circles showing real-time train positions
 *   - Tap a station to see live departures in a bottom sheet
 *   - Line toggle buttons to show/hide lines
 *
 * Leaflet is loaded client-side only (no SSR) because it needs `window`.
 */

"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { LINE_COLOURS } from "@/lib/constants";
import type { RouteSequenceResponse } from "@/lib/tfl-types";
import {
  useTrainPositions,
  type StationLookup,
} from "@/hooks/useTrainPositions";
import AmberText from "@/components/shared/AmberText";

/* ========================================
 * TYPES
 * ======================================== */

/** A station with coordinates, extracted from route data */
interface MapStation {
  naptanId: string;
  name: string;
  lat: number;
  lon: number;
  lines: Set<string>;
}

/** A line's route as an array of [lat, lng] coordinate pairs */
interface LineRoute {
  lineId: string;
  branches: [number, number][][];
}

interface TubeMapProps {
  /** Set of line IDs to display */
  activeLines: Set<string>;
  /** Called when a station marker is tapped */
  onStationSelect: (station: { naptanId: string; name: string }) => void;
}

/* ========================================
 * MAP CONFIGURATION
 * ======================================== */

/** London center coordinates */
const LONDON_CENTER: [number, number] = [51.505, -0.09];
const DEFAULT_ZOOM = 12;

/** Dark map tiles from CartoDB */
const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

/* Lines to load on the map (tube + elizabeth + dlr) */
const MAP_LINE_IDS = [
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
];

/* ========================================
 * HELPER: Invalidate map size on mount
 * ======================================== */
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
  }, [map]);
  return null;
}

/* ========================================
 * MAIN COMPONENT
 * ======================================== */
export default function TubeMap({
  activeLines,
  onStationSelect,
}: TubeMapProps) {
  /* All stations across all lines, keyed by naptanId */
  const [stations, setStations] = useState<Map<string, MapStation>>(new Map());
  /* Route polylines for each line */
  const [routes, setRoutes] = useState<LineRoute[]>([]);
  /* Loading state */
  const [isLoading, setIsLoading] = useState(true);
  /* Track which lines have been fetched */
  const fetchedLines = useRef<Set<string>>(new Set());

  /**
   * Build a station lookup map for the train tracking hook.
   * Maps station names to their coordinates for position resolution.
   */
  const stationLookup: StationLookup = useMemo(() => {
    const lookup: StationLookup = new Map();
    for (const [, station] of stations) {
      lookup.set(station.name, {
        lat: station.lat,
        lon: station.lon,
        naptanId: station.naptanId,
      });
    }
    return lookup;
  }, [stations]);

  /*
   * Live train positions — polls every 15 seconds for active lines.
   * Only starts fetching once we have station data for coordinate lookups.
   */
  const { trains } = useTrainPositions(activeLines, stationLookup);

  /**
   * Fetch route data for a single line.
   */
  const fetchLineRoute = useCallback(
    async (lineId: string) => {
      if (fetchedLines.current.has(lineId)) return;
      fetchedLines.current.add(lineId);

      try {
        const response = await fetch(`/api/tfl/routes?lineId=${lineId}`);
        if (!response.ok) return;

        const data: RouteSequenceResponse = await response.json();

        const newStations = new Map<string, MapStation>();
        const branches: [number, number][][] = [];

        for (const seq of data.stopPointSequences || []) {
          const branchCoords: [number, number][] = [];

          for (const stop of seq.stopPoint || []) {
            const existing = stations.get(stop.naptanId) ||
              newStations.get(stop.naptanId) || {
                naptanId: stop.naptanId,
                name: stop.name,
                lat: stop.lat,
                lon: stop.lon,
                lines: new Set<string>(),
              };

            existing.lines.add(lineId);
            newStations.set(stop.naptanId, existing);
            branchCoords.push([stop.lat, stop.lon]);
          }

          if (branchCoords.length > 0) {
            branches.push(branchCoords);
          }
        }

        setStations((prev) => {
          const merged = new Map(prev);
          newStations.forEach((station, id) => {
            const existing = merged.get(id);
            if (existing) {
              station.lines.forEach((l) => existing.lines.add(l));
              merged.set(id, existing);
            } else {
              merged.set(id, station);
            }
          });
          return merged;
        });

        setRoutes((prev) => [
          ...prev.filter((r) => r.lineId !== lineId),
          { lineId, branches },
        ]);
      } catch (error) {
        console.error(`Failed to fetch route for ${lineId}:`, error);
      }
    },
    [stations]
  );

  /**
   * Fetch all active line routes on mount and when active lines change.
   */
  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      const promises = MAP_LINE_IDS.filter((id) => activeLines.has(id)).map(
        (id) => fetchLineRoute(id)
      );
      await Promise.all(promises);
      setIsLoading(false);
    };
    fetchAll();
  }, [activeLines, fetchLineRoute]);

  /* Convert stations Map to array for rendering */
  const stationArray = Array.from(stations.values());

  /* Filter stations to only show those on active lines */
  const visibleStations = stationArray.filter((station) => {
    for (const lineId of station.lines) {
      if (activeLines.has(lineId)) return true;
    }
    return false;
  });

  /* Filter routes to only show active lines */
  const visibleRoutes = routes.filter((route) =>
    activeLines.has(route.lineId)
  );

  return (
    <div className="relative w-full h-full">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-board-bg/90 px-3 py-1 border border-board-border">
          <AmberText variant="dim" size="xs" className="animate-blink">
            LOADING MAP DATA...
          </AmberText>
        </div>
      )}

      {/* Train count indicator */}
      {trains.length > 0 && (
        <div className="absolute top-2 right-2 z-[1000] bg-board-bg/90 px-2 py-1 border border-board-border">
          <AmberText variant="dim" size="xs">
            {trains.length} TRAINS LIVE
          </AmberText>
        </div>
      )}

      <MapContainer
        center={LONDON_CENTER}
        zoom={DEFAULT_ZOOM}
        className="w-full h-full"
        zoomControl={false}
        attributionControl={true}
        style={{ background: "#0a0a0a" }}
      >
        <MapResizer />

        {/* ---- Dark tile layer ---- */}
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />

        {/* ---- Line polylines ---- */}
        {visibleRoutes.flatMap((route) =>
          route.branches.map((branch, branchIdx) => (
            <Polyline
              key={`line-${route.lineId}-branch-${branchIdx}`}
              positions={branch}
              pathOptions={{
                color: LINE_COLOURS[route.lineId] || "#FF9500",
                weight: 3,
                opacity: 0.8,
              }}
            />
          ))
        )}

        {/* ---- Station markers ---- */}
        {visibleStations.map((station) => (
          <CircleMarker
            key={`station-${station.naptanId}`}
            center={[station.lat, station.lon]}
            radius={4}
            pathOptions={{
              color: "#FF9500",
              fillColor: "#0a0a0a",
              fillOpacity: 1,
              weight: 1.5,
            }}
            eventHandlers={{
              click: () =>
                onStationSelect({
                  naptanId: station.naptanId,
                  name: station.name,
                }),
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -8]}
              className="station-tooltip"
            >
              <span className="font-mono text-[10px] tracking-wider uppercase">
                {station.name
                  .replace(/\s*Underground Station$/i, "")
                  .replace(/\s*DLR Station$/i, "")
                  .replace(/\s*Station$/i, "")}
              </span>
            </Tooltip>
          </CircleMarker>
        ))}

        {/* ---- Live train dots (larger and brighter than station markers) ---- */}
        {trains.map((train) => (
          <CircleMarker
            key={`train-${train.vehicleId}`}
            center={train.position}
            radius={6}
            pathOptions={{
              color: "#ffffff",
              fillColor: LINE_COLOURS[train.lineId] || "#FF9500",
              fillOpacity: 1,
              weight: 2,
              opacity: 0.8,
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -8]}
              className="station-tooltip"
            >
              <span className="font-mono text-[10px] tracking-wider uppercase">
                {train.destination
                  .replace(/\s*Underground Station$/i, "")
                  .replace(/\s*Station$/i, "")}
              </span>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
