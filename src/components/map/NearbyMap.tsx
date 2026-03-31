/**
 * NearbyMap.tsx — Leaflet map showing user location and nearby stops
 *
 * Displays a dark-themed map centered on the user's live GPS position.
 * Shows tube stations and bus stops as coloured markers. Tapping a
 * marker opens a popup with the next few arrivals.
 *
 * Uses watchPosition for live location tracking and re-fetches
 * nearby stations when the user moves or pans the map.
 *
 * IMPORTANT: This component must be dynamically imported with ssr: false
 * because Leaflet requires window/document to exist.
 */

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polyline,
  CircleMarker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DARK_TILE_URL, LINE_COLOURS } from "@/lib/constants";
import StationPopup from "./StationPopup";
import NearbyDrawer from "./NearbyDrawer";

/* ========================================
 * TYPES
 * ======================================== */

interface NearbyStation {
  naptanId: string;
  name: string;
  lat: number;
  lon: number;
  distance: number;
  modes: string[];
  lines: { id: string; name: string }[];
  stopLetter?: string;
  indicator?: string;
  allNaptanIds?: string[];
}

interface NearbyMapProps {
  /** Initial user position from the page */
  initialPosition: { lat: number; lng: number };
}

/* ========================================
 * CUSTOM MARKER ICONS
 * ======================================== */

/**
 * Create a train icon marker for tube/rail stations.
 * Uses the Lucide Train SVG path — same icon as the Departures tab.
 */
function createStationIcon(colour: string): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
    html: `<div style="
      width: 28px; height: 28px;
      background: #111111; border: 1.5px solid ${colour};
      box-shadow: 0 0 8px ${colour}40;
      display: flex; align-items: center; justify-content: center;
      border-radius: 4px;
    "><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${colour}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 11V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7"/>
      <path d="M4 15h16"/>
      <path d="M4 11h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>
      <path d="m9 21 3 3 3-3"/>
      <circle cx="8" cy="15" r="0.5" fill="${colour}"/>
      <circle cx="16" cy="15" r="0.5" fill="${colour}"/>
    </svg></div>`,
  });
}

/**
 * Create a squared amber marker icon for bus stops.
 * Matches the stop letter badges used in the departure board UI.
 */
function createBusIcon(stopLetter?: string): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -15],
    html: `<div style="
      width: 26px; height: 26px;
      background: #111111; border: 1.5px solid #ff9500;
      box-shadow: 0 0 8px rgba(255, 149, 0, 0.3);
      display: flex; align-items: center; justify-content: center;
      font-family: monospace; font-size: 12px; font-weight: bold;
      color: #ff9500; letter-spacing: 0.05em;
    ">${stopLetter || "B"}</div>`,
  });
}

/**
 * Create a user location icon with optional heading cone.
 * When heading is available, shows a semi-transparent blue cone
 * pointing in the direction the user is facing (like Google Maps).
 */
function createUserIcon(heading: number | null): L.DivIcon {
  const hasCone = heading !== null && !isNaN(heading);
  return L.divIcon({
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `<div style="position:relative; width:40px; height:40px;">
      ${hasCone ? `
      <div style="
        position:absolute; top:0; left:0; width:40px; height:40px;
        transform: rotate(${heading}deg);
        transform-origin: center center;
      ">
        <div style="
          position:absolute; top:2px; left:50%; transform:translateX(-50%);
          width:0; height:0;
          border-left: 12px solid transparent;
          border-right: 12px solid transparent;
          border-bottom: 20px solid rgba(74, 144, 217, 0.25);
        "></div>
      </div>` : ""}
      <div style="
        position:absolute; top:50%; left:50%;
        transform:translate(-50%, -50%);
        width:16px; height:16px; border-radius:50%;
        background:#4A90D9; border:3px solid white;
        box-shadow: 0 0 10px rgba(74, 144, 217, 0.6);
        animation: userPulse 2s ease-in-out infinite;
      "></div>
    </div>
    <style>
      @keyframes userPulse {
        0%, 100% { box-shadow: 0 0 10px rgba(74, 144, 217, 0.6); }
        50% { box-shadow: 0 0 20px rgba(74, 144, 217, 0.9); }
      }
    </style>`,
  });
}

/* ========================================
 * HELPER: Get primary colour for a station
 * ======================================== */
function getStationColour(station: NearbyStation): string {
  /* Use the first line's colour, fall back to amber */
  for (const line of station.lines) {
    const colour = LINE_COLOURS[line.id];
    if (colour) return colour;
  }
  return "#FF9500";
}

/* ========================================
 * HELPER: Distance between two lat/lng points (metres)
 * ======================================== */
function distanceBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/* ========================================
 * SUB-COMPONENT: Follows user location on the map
 * ======================================== */
function LocationFollower({
  position,
  shouldFollow,
}: {
  position: { lat: number; lng: number };
  shouldFollow: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (shouldFollow) {
      map.setView([position.lat, position.lng], map.getZoom(), {
        animate: true,
      });
    }
  }, [position, shouldFollow, map]);

  return null;
}

/* ========================================
 * SUB-COMPONENT: Re-center button
 * ======================================== */
function RecenterButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-20 right-4 z-[1000] w-10 h-10 flex items-center justify-center bg-surface border border-amber text-amber hover:bg-amber/10 transition-colors"
      aria-label="Re-center on my location"
      title="Re-center on my location"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      </svg>
    </button>
  );
}

/* ========================================
 * RADIUS OPTIONS
 * ======================================== */
const RADIUS_OPTIONS = [
  { label: "500m", value: 500 },
  { label: "1km", value: 1000 },
  { label: "1.5km", value: 1500 },
];

/* ========================================
 * MODE FILTER OPTIONS
 * ======================================== */
const MODE_FILTERS = [
  { id: "tube", label: "TUBE" },
  { id: "bus", label: "BUS" },
  { id: "dlr", label: "DLR" },
  { id: "overground", label: "OVRG" },
  { id: "elizabeth-line", label: "ELIZ" },
];

/* ========================================
 * MAIN COMPONENT
 * ======================================== */
export default function NearbyMap({ initialPosition }: NearbyMapProps) {
  /* User's live position */
  const [userPos, setUserPos] = useState(initialPosition);
  /* User's heading in degrees from north (null when stationary) */
  const [heading, setHeading] = useState<number | null>(null);
  /* Whether to auto-follow the user's position */
  const [following, setFollowing] = useState(true);
  /* Nearby stations fetched from API */
  const [stations, setStations] = useState<NearbyStation[]>([]);
  /* Last position we fetched stations for */
  const lastFetchPos = useRef(initialPosition);
  /* Track if component is mounted */
  const mountedRef = useRef(true);
  /* Search radius in metres */
  const [radius, setRadius] = useState(800);
  /* Active mode filters (empty = show all) */
  const [activeModes, setActiveModes] = useState<Set<string>>(new Set());
  /* Whether the filter panel is open */
  const [filtersOpen, setFiltersOpen] = useState(false);
  /* Active route being highlighted on the map */
  const [activeRoute, setActiveRoute] = useState<{
    lineId: string;
    stops: { lat: number; lon: number; name: string }[];
  } | null>(null);
  /* Whether the bottom drawer is expanded */
  const [drawerOpen, setDrawerOpen] = useState(false);

  /* ---- Live location tracking with heading ---- */
  useEffect(() => {
    mountedRef.current = true;

    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!mountedRef.current) return;
        setUserPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        /* heading is degrees clockwise from north, or null when stationary */
        if (pos.coords.heading !== null && !isNaN(pos.coords.heading)) {
          setHeading(pos.coords.heading);
        }
      },
      () => {
        /* Silently fail — we already have initialPosition */
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    );

    return () => {
      mountedRef.current = false;
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  /* ---- Fetch nearby stations ---- */
  const fetchNearby = useCallback(
    async (lat: number, lng: number, r: number) => {
      try {
        const resp = await fetch(
          `/api/tfl/nearby?lat=${lat}&lon=${lng}&radius=${r}`
        );
        if (!resp.ok) return;
        const data: NearbyStation[] = await resp.json();
        if (mountedRef.current) {
          setStations(data.slice(0, 30));
          lastFetchPos.current = { lat, lng };
        }
      } catch {
        /* Silently fail */
      }
    },
    []
  );

  /* Fetch on mount and when radius changes */
  useEffect(() => {
    fetchNearby(userPos.lat, userPos.lng, radius);
  }, [radius, fetchNearby, userPos.lat, userPos.lng]);

  /* Re-fetch when user moves >200m from last fetch point */
  useEffect(() => {
    const dist = distanceBetween(userPos, lastFetchPos.current);
    if (dist > 200) {
      fetchNearby(userPos.lat, userPos.lng, radius);
    }
  }, [userPos, fetchNearby, radius]);

  /* ---- Handle map drag (stop following) ---- */
  const handleMapDrag = useCallback(() => {
    setFollowing(false);
  }, []);

  /* ---- Re-center on user ---- */
  const handleRecenter = useCallback(() => {
    setFollowing(true);
  }, []);

  /* ---- Toggle a mode filter ---- */
  const toggleMode = useCallback((modeId: string) => {
    setActiveModes((prev) => {
      const next = new Set(prev);
      if (next.has(modeId)) {
        next.delete(modeId);
      } else {
        next.add(modeId);
      }
      return next;
    });
  }, []);

  /* ---- Show a bus/tube route on the map ---- */
  const handleShowRoute = useCallback(async (lineId: string) => {
    try {
      const resp = await fetch(`/api/tfl/line-route?lineId=${lineId}`);
      if (!resp.ok) return;
      const stops: { naptanId: string; name: string; lat: number; lon: number }[] = await resp.json();
      if (stops.length > 0) {
        setActiveRoute({ lineId, stops });
      }
    } catch {
      /* Silently fail */
    }
  }, []);

  /* Determine if a station is a bus stop */
  const isBus = (s: NearbyStation) =>
    s.naptanId.startsWith("490") || s.modes?.includes("bus");

  /* Filter stations by active modes */
  const filteredStations = activeModes.size === 0
    ? stations
    : stations.filter((s) =>
        s.modes.some((m) => activeModes.has(m))
      );

  /* Memoize the user icon to avoid re-creating on every render */
  const currentUserIcon = createUserIcon(heading);

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[initialPosition.lat, initialPosition.lng]}
        zoom={15}
        className="w-full h-full"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url={DARK_TILE_URL} />

        {/* User location marker with heading */}
        <Marker position={[userPos.lat, userPos.lng]} icon={currentUserIcon} />

        {/* Accuracy circle (light blue, subtle) */}
        <Circle
          center={[userPos.lat, userPos.lng]}
          radius={50}
          pathOptions={{
            color: "#4A90D9",
            fillColor: "#4A90D9",
            fillOpacity: 0.08,
            weight: 1,
            opacity: 0.3,
          }}
        />

        {/* Station / bus stop markers */}
        {filteredStations.map((station) => (
          <Marker
            key={station.naptanId}
            position={[station.lat, station.lon]}
            icon={
              isBus(station)
                ? createBusIcon(station.stopLetter)
                : createStationIcon(getStationColour(station))
            }
          >
            <Popup className="oystr-popup" maxWidth={280} minWidth={240}>
              <StationPopup station={station} onShowRoute={handleShowRoute} />
            </Popup>
          </Marker>
        ))}

        {/* Active route polyline */}
        {activeRoute && (
          <>
            <Polyline
              positions={activeRoute.stops.map((s) => [s.lat, s.lon] as [number, number])}
              pathOptions={{
                color: "#ff9500",
                weight: 3,
                opacity: 0.7,
                dashArray: "8 6",
              }}
            />
            {/* Small dots for each stop on the route */}
            {activeRoute.stops.map((stop, i) => (
              <CircleMarker
                key={`route-stop-${i}`}
                center={[stop.lat, stop.lon]}
                radius={4}
                pathOptions={{
                  color: "#ff9500",
                  fillColor: "#111111",
                  fillOpacity: 1,
                  weight: 1.5,
                }}
              />
            ))}
          </>
        )}

        {/* Follow user location */}
        <LocationFollower position={userPos} shouldFollow={following} />

        {/* Detect map drag to stop following */}
        <MapDragDetector onDrag={handleMapDrag} />
      </MapContainer>

      {/* ---- Top controls: filter toggle ---- */}
      <button
        onClick={() => setFiltersOpen(!filtersOpen)}
        className="absolute top-4 left-4 z-[1000] w-10 h-10 flex items-center justify-center bg-surface border border-amber text-amber hover:bg-amber/10 transition-colors"
        aria-label="Filter stops"
        title="Filter stops"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
        </svg>
      </button>

      {/* ---- Clear route button (when a route is active) ---- */}
      {activeRoute && (
        <button
          onClick={() => setActiveRoute(null)}
          className="absolute top-4 left-16 z-[1000] h-10 px-3 flex items-center gap-1.5 bg-surface border border-amber text-amber font-mono text-[10px] tracking-wider uppercase hover:bg-amber/10 transition-colors"
          aria-label="Clear route"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          {activeRoute.lineId}
        </button>
      )}

      {/* ---- Filter panel (slides down from top) ---- */}
      {filtersOpen && (
        <div className="absolute top-16 left-4 right-4 z-[1000] bg-surface border border-board-border p-3 space-y-3">
          {/* Mode filters */}
          <div>
            <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mb-2">
              SHOW
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MODE_FILTERS.map((mode) => {
                const isActive = activeModes.size === 0 || activeModes.has(mode.id);
                return (
                  <button
                    key={mode.id}
                    onClick={() => toggleMode(mode.id)}
                    className={`px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase border transition-colors ${
                      isActive
                        ? "border-amber text-amber bg-amber/10"
                        : "border-board-border text-amber-faint"
                    }`}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Radius control */}
          <div>
            <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mb-2">
              RADIUS
            </div>
            <div className="flex gap-1.5">
              {RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRadius(opt.value)}
                  className={`px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase border transition-colors ${
                    radius === opt.value
                      ? "border-amber text-amber bg-amber/10"
                      : "border-board-border text-amber-faint"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- Bottom drawer toggle ---- */}
      <NearbyDrawer
        stations={filteredStations}
        onStationTap={(station) => {
          setFollowing(false);
          /* Scroll map to this station — handled by LocationFollower if we set position */
        }}
      />

      {/* Re-center button */}
      {!following && <RecenterButton onClick={handleRecenter} />}
    </div>
  );
}

/* ========================================
 * SUB-COMPONENT: Detects when user drags the map
 * ======================================== */
function MapDragDetector({ onDrag }: { onDrag: () => void }) {
  const map = useMap();

  useEffect(() => {
    map.on("dragstart", onDrag);
    return () => {
      map.off("dragstart", onDrag);
    };
  }, [map, onDrag]);

  return null;
}
