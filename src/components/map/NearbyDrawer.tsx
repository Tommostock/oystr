/**
 * NearbyDrawer.tsx — Bottom sheet showing nearby stations
 *
 * A collapsible drawer that sits above the bottom nav bar.
 * Collapsed: shows "{N} stops nearby" as a tappable bar.
 * Expanded: scrollable list of nearby stations with next arrival.
 *
 * Tapping a station in the list pans the map to it.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { LINE_COLOURS } from "@/lib/constants";

interface NearbyStation {
  naptanId: string;
  name: string;
  lat: number;
  lon: number;
  distance: number;
  modes: string[];
  lines: { id: string; name: string }[];
  stopLetter?: string;
  allNaptanIds?: string[];
}

interface Arrival {
  lineId: string;
  lineName: string;
  destinationName: string;
  timeToStation: number;
  modeName: string;
}

interface NearbyDrawerProps {
  stations: NearbyStation[];
  onStationTap: (station: NearbyStation) => void;
}

function cleanName(name: string): string {
  return name
    .replace(/\s*Underground Station$/i, "")
    .replace(/\s*DLR Station$/i, "")
    .replace(/\s*Rail Station$/i, "")
    .replace(/\s*Station$/i, "")
    .replace(/\s*\(London\)/i, "")
    .trim();
}

function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)}m`;
  return `${(metres / 1000).toFixed(1)}km`;
}

/**
 * Individual station row in the drawer.
 * Fetches the next arrival lazily when the drawer is open.
 */
function DrawerRow({
  station,
  isExpanded,
  onTap,
}: {
  station: NearbyStation;
  isExpanded: boolean;
  onTap: () => void;
}) {
  const [nextArrival, setNextArrival] = useState<Arrival | null>(null);
  const [fetched, setFetched] = useState(false);
  const isBus =
    station.naptanId.startsWith("490") || station.modes?.includes("bus");

  /* Fetch next arrival when drawer expands (lazy) */
  useEffect(() => {
    if (!isExpanded || fetched) return;
    setFetched(true);

    async function fetchArrival() {
      try {
        const stopId = station.allNaptanIds?.length
          ? station.allNaptanIds.join(",")
          : station.naptanId;
        const resp = await fetch(`/api/tfl/arrivals?stopId=${stopId}`);
        if (!resp.ok) return;
        const data: Arrival[] = await resp.json();
        if (data.length > 0) {
          const sorted = data.sort((a, b) => a.timeToStation - b.timeToStation);
          setNextArrival(sorted[0]);
        }
      } catch {
        /* Silently fail */
      }
    }

    fetchArrival();
  }, [isExpanded, fetched, station.naptanId, station.allNaptanIds]);

  const timeText = nextArrival
    ? nextArrival.timeToStation <= 30
      ? "DUE"
      : `${Math.floor(nextArrival.timeToStation / 60)}m`
    : "--";

  return (
    <button
      onClick={onTap}
      className="w-full flex items-center gap-3 px-3 py-2.5 border-b border-board-border/50 hover:bg-board-border/30 transition-colors text-left"
    >
      {/* Mode indicator */}
      {isBus ? (
        <span className="shrink-0 w-6 h-6 flex items-center justify-center border border-amber text-amber text-[10px] font-mono">
          {station.stopLetter || "B"}
        </span>
      ) : (
        <span
          className="shrink-0 w-2.5 h-2.5 rounded-full"
          style={{
            backgroundColor:
              station.lines.length > 0
                ? LINE_COLOURS[station.lines[0].id] || "#FF9500"
                : "#FF9500",
          }}
        />
      )}

      {/* Station name + distance */}
      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs tracking-wider text-amber uppercase truncate">
          {cleanName(station.name)}
        </div>
        <div className="font-mono text-[9px] tracking-wider text-amber-faint">
          {formatDistance(station.distance)}
          {nextArrival && (
            <span className="ml-2">
              {cleanName(nextArrival.destinationName).substring(0, 15)}
            </span>
          )}
        </div>
      </div>

      {/* Next arrival time */}
      <span
        className={`shrink-0 font-mono text-xs tracking-wider ${
          timeText === "DUE"
            ? "text-amber amber-glow-strong"
            : "text-amber-dim"
        }`}
      >
        {timeText}
      </span>
    </button>
  );
}

export default function NearbyDrawer({
  stations,
  onStationTap,
}: NearbyDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  /* Close drawer when tapping outside */
  useEffect(() => {
    if (!isExpanded) return;
    const handleClick = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    /* Delay to avoid immediately closing from the toggle tap */
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [isExpanded]);

  if (stations.length === 0) return null;

  return (
    <div
      ref={drawerRef}
      className={`absolute left-4 right-4 z-[1000] transition-all duration-300 ease-in-out ${
        isExpanded ? "bottom-16 max-h-[50vh]" : "bottom-16"
      }`}
    >
      {/* Toggle bar — large tappable button above the bottom nav */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-surface border border-board-border hover:border-amber-faint transition-colors"
      >
        <span className="font-mono text-xs tracking-wider text-amber uppercase">
          {stations.length} STOP{stations.length !== 1 ? "S" : ""} NEARBY
        </span>
        {isExpanded ? (
          <ChevronDown size={16} strokeWidth={1.5} className="text-amber" />
        ) : (
          <ChevronUp size={16} strokeWidth={1.5} className="text-amber" />
        )}
      </button>

      {/* Station list (only rendered when expanded) */}
      {isExpanded && (
        <div
          className="bg-surface border border-t-0 border-board-border overflow-y-auto"
          style={{ maxHeight: "calc(50vh - 56px)" }}
        >
          {stations.map((station) => (
            <DrawerRow
              key={station.naptanId}
              station={station}
              isExpanded={isExpanded}
              onTap={() => {
                onStationTap(station);
                setIsExpanded(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
