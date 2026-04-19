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
import { isBusStop } from "@/lib/utils";
import { parseCurrentLocation } from "@/lib/parse-location";
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
 * Create a small pulsing vehicle icon for a live bus / tube.
 * Sized + coloured to stand out from the station markers.
 */
function createVehicleIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: `<div style="
      width: 14px; height: 14px;
      border-radius: 50%;
      background: #ff9500;
      border: 2px solid #0a0a0a;
      box-shadow: 0 0 8px rgba(255, 149, 0, 0.8);
      animation: vehicle-pulse 1.5s ease-in-out infinite;
    "></div>
    <style>
      @keyframes vehicle-pulse {
        0%, 100% { transform: scale(1); box-shadow: 0 0 8px rgba(255, 149, 0, 0.8); }
        50% { transform: scale(1.15); box-shadow: 0 0 14px rgba(255, 149, 0, 1); }
      }
    </style>`,
  });
}

/**
 * Create the user location icon.
 * When heading is available (phone GPS + moving), shows a directional cone
 * pointing the way the user faces, like Google Maps' blue cone.
 * When heading is null (stationary or desktop), just shows the amber dot.
 *
 * heading: degrees clockwise from north (0 = north, 90 = east, etc.)
 */
function createUserIcon(heading: number | null): L.DivIcon {
  const hasCone = heading !== null && heading !== undefined;

  const coneHtml = hasCone
    ? `<svg style="position:absolute;top:0;left:0;pointer-events:none"
          width="40" height="40" viewBox="0 0 40 40">
         <polygon points="20,20 13,2 27,2"
           fill="rgba(255,149,0,0.22)"
           stroke="rgba(255,149,0,0.55)"
           stroke-width="1"
           stroke-linejoin="round"/>
       </svg>`
    : "";

  return L.divIcon({
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `<div style="
      position:relative; width:40px; height:40px;
      ${hasCone ? `transform:rotate(${heading}deg);` : ""}
    ">
      ${coneHtml}
      <div style="
        position:absolute; left:9px; top:9px;
        width:22px; height:22px; border-radius:50%;
        background:#ff9500; border:3px solid #0a0a0a;
        box-shadow:0 0 12px rgba(255,149,0,0.6);
      "></div>
    </div>`,
  });
}

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
  /* User's live position, with optional heading (degrees clockwise from north) */
  const [userPos, setUserPos] = useState<{
    lat: number;
    lng: number;
    heading: number | null;
  }>({ ...initialPosition, heading: null });
  /* Whether to auto-follow the user's position */
  const [following, setFollowing] = useState(true);
  /* Nearby stations fetched from API */
  const [stations, setStations] = useState<NearbyStation[]>([]);
  /* Last position we fetched stations for (lat/lng only, no heading needed) */
  const lastFetchPos = useRef<{ lat: number; lng: number }>(initialPosition);
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
    stops: { naptanId: string; lat: number; lon: number; name: string }[];
  } | null>(null);
  /*
   * Live vehicles on the active route. Empty when no route is active.
   * Each vehicle has a resolved {lat, lon} computed from its
   * `currentLocation` string against the route sequence.
   */
  const [vehicles, setVehicles] = useState<
    {
      vehicleId: string;
      lat: number;
      lon: number;
      destinationName: string;
      currentLocation: string;
    }[]
  >([]);
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
          /*
           * heading is degrees clockwise from north.
           * Returns null when stationary or on desktop.
           * Only available on mobile with real GPS movement.
           */
          heading: pos.coords.heading ?? null,
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
  const handleToggleRoute = useCallback(async (lineId: string) => {
    if (activeRoute?.lineId === lineId) {
      setActiveRoute(null);
      setVehicles([]);
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

  /*
   * Live vehicle tracking for the active route.
   *
   * Polls /api/tfl/line-arrivals every 30s while a route is active.
   * Each arrival's `currentLocation` string ("Between X and Y",
   * "Approaching Y", etc.) is resolved to a {lat, lon} via the
   * route's ordered stop list. Vehicles that can't be positioned
   * (unknown stop names, ambiguous text) are dropped rather than
   * guessed at the wrong location.
   *
   * Stops polling when the route is cleared OR the component unmounts.
   */
  useEffect(() => {
    if (!activeRoute) {
      setVehicles([]);
      return;
    }

    let cancelled = false;

    async function fetchVehicles() {
      if (!activeRoute) return;
      try {
        const resp = await fetch(
          `/api/tfl/line-arrivals?lineId=${activeRoute.lineId}`
        );
        if (!resp.ok) return;
        const data: {
          vehicleId: string;
          destinationName: string;
          currentLocation: string;
        }[] = await resp.json();

        const resolved = data
          .map((v) => {
            const pos = parseCurrentLocation(
              v.currentLocation,
              activeRoute.stops
            );
            if (!pos) return null;
            return {
              vehicleId: v.vehicleId,
              lat: pos.lat,
              lon: pos.lon,
              destinationName: v.destinationName,
              currentLocation: v.currentLocation,
            };
          })
          .filter((v): v is NonNullable<typeof v> => v !== null);

        if (!cancelled) setVehicles(resolved);
      } catch {
        /* Silently ignore — next poll will retry */
      }
    }

    fetchVehicles();
    const id = window.setInterval(fetchVehicles, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
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

  /* Determine if a station is a bus stop (strict — excludes multi-modal stations) */
  const isBus = (s: NearbyStation) => isBusStop(s.naptanId, s.modes);

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

        {/* User location marker — shows heading cone when GPS heading is available */}
        <Marker
          position={[userPos.lat, userPos.lng]}
          icon={createUserIcon(userPos.heading)}
        />

        {/* Search radius circle — faint amber glow showing pickup area */}
        <Circle
          center={[userPos.lat, userPos.lng]}
          radius={radius}
          pathOptions={{
            color: "#ff9500",
            fillColor: "#ff9500",
            fillOpacity: 0.04,
            weight: 1.5,
            opacity: 0.25,
            dashArray: "6 4",
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
            {/*
             * Live vehicle markers. Each bus / tube currently somewhere
             * on the route, positioned by parsing its currentLocation
             * string. Pulses gently so the user can tell it's live
             * data vs the static stop dots.
             */}
            {vehicles.map((v) => (
              <Marker
                key={`vehicle-${v.vehicleId}`}
                position={[v.lat, v.lon]}
                icon={createVehicleIcon()}
              >
                <Popup className="oystr-popup" maxWidth={220} minWidth={180}>
                  <div className="font-mono text-xs tracking-wider text-amber uppercase">
                    <div className="text-amber amber-glow">
                      TO {v.destinationName.toUpperCase()}
                    </div>
                    <div className="text-amber-faint text-[10px] mt-1">
                      {v.currentLocation}
                    </div>
                  </div>
                </Popup>
              </Marker>
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
