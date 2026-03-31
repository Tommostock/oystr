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

/** Simple blue dot for user location (no heading indicator) */
const userIcon = L.divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<div style="
    width: 22px; height: 22px; border-radius: 50%;
    background: #4A90D9; border: 3px solid white;
    box-shadow: 0 0 12px rgba(74, 144, 217, 0.6);
  "></div>`,
});

/* ========================================
 * HELPER: Get primary colour for a station
 * ======================================== */
function getStationColour(station: NearbyStation): string {
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
 * SUB-COMPONENT: Flies the map to a specific location
 * ======================================== */
function FlyToStation({
  target,
  onArrived,
}: {
  target: { lat: number; lng: number } | null;
  onArrived: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], 17, { duration: 0.8 });
    const timer = setTimeout(onArrived, 900);
    return () => clearTimeout(timer);
  }, [target, map, onArrived]);

  return null;
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
 * Elizabeth line consolidated into Tube
 * ======================================== */
const MODE_FILTERS = [
  { id: "tube", label: "TUBE" },
  { id: "bus", label: "BUS" },
  { id: "dlr", label: "DLR" },
  { id: "overground", label: "OVRG" },
];

/* ========================================
 * MAIN COMPONENT
 * ======================================== */
export default function NearbyMap({ initialPosition }: NearbyMapProps) {
  /* User's live position */
  const [userPos, setUserPos] = useState(initialPosition);
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
  /* Station to fly to (set by drawer tap) */
  const [flyTarget, setFlyTarget] = useState<{
    lat: number;
    lng: number;
    naptanId: string;
  } | null>(null);
  /* Refs to marker popups so we can open them programmatically */
  const markerRefs = useRef<Map<string, L.Marker>>(new Map());

  /* ---- Live location tracking ---- */
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

  /* ---- Show/hide a bus/tube route on the map (toggle) ---- */
  const handleShowRoute = useCallback(async (lineId: string) => {
    /* If the same route is already shown, toggle it off */
    setActiveRoute((prev) => {
      if (prev && prev.lineId === lineId) return null;
      return prev;
    });

    /* If toggling off, we already set null above */
    setActiveRoute((prev) => {
      if (prev === null) {
        /* Fetch the route */
        fetch(`/api/tfl/line-route?lineId=${lineId}`)
          .then((r) => r.ok ? r.json() : [])
          .then((stops: { naptanId: string; name: string; lat: number; lon: number }[]) => {
            if (stops.length > 0) {
              setActiveRoute({ lineId, stops });
            }
          })
          .catch(() => {});
        return prev; /* will be updated by the then() */
      }
      return prev;
    });
  }, []);

  /* Simpler route toggle approach */
  const handleToggleRoute = useCallback(async (lineId: string) => {
    if (activeRoute?.lineId === lineId) {
      setActiveRoute(null);
      return;
    }
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
  }, [activeRoute]);

  /* ---- Handle drawer station tap: fly to it and open popup ---- */
  const handleDrawerStationTap = useCallback((station: NearbyStation) => {
    setFollowing(false);
    setFlyTarget({ lat: station.lat, lng: station.lon, naptanId: station.naptanId });
  }, []);

  /* After flying to station, open its popup */
  const handleFlyArrived = useCallback(() => {
    if (!flyTarget) return;
    const marker = markerRefs.current.get(flyTarget.naptanId);
    if (marker) {
      marker.openPopup();
    }
    setFlyTarget(null);
  }, [flyTarget]);

  /* Determine if a station is a bus stop */
  const isBus = (s: NearbyStation) =>
    s.naptanId.startsWith("490") || s.modes?.includes("bus");

  /*
   * Filter stations by active modes.
   * Elizabeth line is consolidated into Tube — treat "elizabeth-line"
   * as matching when "tube" filter is active.
   */
  const filteredStations = activeModes.size === 0
    ? stations
    : stations.filter((s) =>
        s.modes.some((m) => {
          if (activeModes.has(m)) return true;
          /* elizabeth-line matches tube filter */
          if (m === "elizabeth-line" && activeModes.has("tube")) return true;
          return false;
        })
      );

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

        {/* User location marker */}
        <Marker position={[userPos.lat, userPos.lng]} icon={userIcon} />

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
            ref={(ref) => {
              if (ref) markerRefs.current.set(station.naptanId, ref);
            }}
          >
            <Popup className="oystr-popup" maxWidth={280} minWidth={240}>
              <StationPopup
                station={station}
                onShowRoute={handleToggleRoute}
                activeRouteId={activeRoute?.lineId}
              />
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

        {/* Fly to station from drawer */}
        <FlyToStation target={flyTarget} onArrived={handleFlyArrived} />

        {/* Detect map drag to stop following */}
        <MapDragDetector onDrag={handleMapDrag} />
      </MapContainer>

      {/* ---- Top controls row: filter + re-center ---- */}
      <div className="absolute top-4 left-4 z-[1000] flex gap-2">
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="w-10 h-10 flex items-center justify-center bg-surface border border-amber text-amber hover:bg-amber/10 transition-colors"
          aria-label="Filter stops"
          title="Filter stops"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
          </svg>
        </button>

        <button
          onClick={handleRecenter}
          className="w-10 h-10 flex items-center justify-center bg-surface border border-amber text-amber hover:bg-amber/10 transition-colors"
          aria-label="Re-center on my location"
          title="Re-center on my location"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
      </div>

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

      {/* ---- Bottom drawer ---- */}
      <NearbyDrawer
        stations={filteredStations}
        onStationTap={handleDrawerStationTap}
      />
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
