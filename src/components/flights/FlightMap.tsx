/**
 * FlightMap.tsx — Map showing the great-circle route between two
 * airports, with an optional live aircraft position when airborne.
 *
 * Built on Leaflet with the same CartoDB dark-matter tiles as the
 * Nearby map so the visual matches the rest of the app.
 *
 * Behaviour:
 *   - Origin + destination airport markers (amber dots with IATA label)
 *   - Dashed amber great-circle polyline between them
 *   - Live aircraft marker (rotating plane icon) — only when the
 *     flight has a `liveLocation` from the provider
 *   - Bounds auto-fit to include both airports + aircraft
 *
 * This component is dynamically imported (ssr: false) by the flight
 * detail page — Leaflet touches `window` on import, which breaks
 * Next.js server rendering if loaded eagerly.
 */

"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type {
  FlightDetailAirport,
  FlightLiveLocation,
} from "@/lib/flight-types";

/* Same dark tile URL as NearbyMap — keeps the app visually unified. */
const DARK_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const DARK_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/* Amber colour from the dot-matrix palette. */
const AMBER = "#ff9500";
const AMBER_FAINT = "#664400";

interface FlightMapProps {
  origin: FlightDetailAirport;
  destination: FlightDetailAirport;
  /** Live GPS position, only present when airborne. */
  liveLocation?: FlightLiveLocation | null;
}

/* ========================================
 * GREAT-CIRCLE INTERPOLATION
 * Builds a polyline of N intermediate points along the great circle
 * between two lat/lon points. Interpolated with the standard slerp
 * formula on the unit sphere; handles antipodal-ish pairs without
 * blowing up thanks to the sin(theta) == 0 guard.
 * ======================================== */
function greatCirclePoints(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  steps = 48
): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const lat1 = toRad(from.lat);
  const lon1 = toRad(from.lon);
  const lat2 = toRad(to.lat);
  const lon2 = toRad(to.lon);

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
      )
    );

  const points: [number, number][] = [];
  // Degenerate case: same point.
  if (d === 0) {
    for (let i = 0; i <= steps; i++) points.push([from.lat, from.lon]);
    return points;
  }

  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const a = Math.sin((1 - f) * d) / Math.sin(d);
    const b = Math.sin(f * d) / Math.sin(d);

    const x =
      a * Math.cos(lat1) * Math.cos(lon1) +
      b * Math.cos(lat2) * Math.cos(lon2);
    const y =
      a * Math.cos(lat1) * Math.sin(lon1) +
      b * Math.cos(lat2) * Math.sin(lon2);
    const z = a * Math.sin(lat1) + b * Math.sin(lat2);

    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lon = Math.atan2(y, x);

    points.push([toDeg(lat), toDeg(lon)]);
  }
  return points;
}

/* ========================================
 * ICONS
 * ======================================== */

/**
 * Airport marker — small amber square with IATA code label under it.
 * Label sits outside the marker so it doesn't obscure the dot.
 */
function createAirportIcon(iata: string): L.DivIcon {
  return L.divIcon({
    className: "flight-airport-marker",
    html: `
      <div style="
        position: relative;
        width: 14px;
        height: 14px;
      ">
        <div style="
          width: 14px;
          height: 14px;
          background: ${AMBER};
          border: 2px solid #0a0a0a;
          box-shadow: 0 0 8px rgba(255, 149, 0, 0.6);
          box-sizing: border-box;
        "></div>
        <div style="
          position: absolute;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          font-family: var(--font-share-tech-mono), monospace;
          font-size: 10px;
          letter-spacing: 0.08em;
          color: ${AMBER};
          text-shadow: 0 0 4px rgba(255, 149, 0, 0.6), 0 0 2px #0a0a0a;
          white-space: nowrap;
        ">${iata}</div>
      </div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

/**
 * Aircraft icon — SVG plane pointing "up" by default, rotated to
 * match `trueTrack` (compass bearing in degrees; 0 = north).
 * A pulsing amber glow makes it stand out at any zoom level.
 */
function createAircraftIcon(heading: number | null): L.DivIcon {
  const rotation = typeof heading === "number" ? heading : 0;
  return L.divIcon({
    className: "flight-aircraft-marker",
    html: `
      <div style="
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(${rotation}deg);
        filter: drop-shadow(0 0 6px rgba(255, 149, 0, 0.9));
      ">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="${AMBER}" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z"/>
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/* ========================================
 * BOUNDS FITTER
 * useMap() only works inside a child of MapContainer, so this
 * little helper lives as a sub-component that returns null.
 * ======================================== */
function FitBoundsOnUpdate({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  const lastBoundsKey = useRef("");
  useEffect(() => {
    const key = JSON.stringify(bounds);
    if (key === lastBoundsKey.current) return;
    lastBoundsKey.current = key;
    map.fitBounds(bounds, { padding: [40, 40], animate: true });
  }, [bounds, map]);
  return null;
}

/* ========================================
 * MAIN COMPONENT
 * ======================================== */
export default function FlightMap({
  origin,
  destination,
  liveLocation,
}: FlightMapProps) {
  // Both coords are required for the map to be useful.
  if (
    origin.lat == null ||
    origin.lon == null ||
    destination.lat == null ||
    destination.lon == null
  ) {
    return null;
  }

  const originIcon = useMemo(() => createAirportIcon(origin.iata), [origin.iata]);
  const destIcon = useMemo(
    () => createAirportIcon(destination.iata),
    [destination.iata]
  );
  const aircraftIcon = useMemo(
    () => createAircraftIcon(liveLocation?.trueTrack ?? null),
    [liveLocation?.trueTrack]
  );

  const pathPoints = useMemo(
    () =>
      greatCirclePoints(
        { lat: origin.lat as number, lon: origin.lon as number },
        { lat: destination.lat as number, lon: destination.lon as number }
      ),
    [origin.lat, origin.lon, destination.lat, destination.lon]
  );

  // Split the path into "flown" and "remaining" segments when we
  // have a live position. Rough heuristic: use the closest waypoint
  // on the precomputed path. Good enough for a visual distinction.
  const { flown, remaining } = useMemo(() => {
    if (!liveLocation) {
      return { flown: null, remaining: pathPoints };
    }
    let closestIdx = 0;
    let closestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < pathPoints.length; i++) {
      const [lat, lon] = pathPoints[i];
      const dLat = lat - liveLocation.lat;
      const dLon = lon - liveLocation.lon;
      const sq = dLat * dLat + dLon * dLon;
      if (sq < closestDist) {
        closestDist = sq;
        closestIdx = i;
      }
    }
    return {
      flown: pathPoints.slice(0, closestIdx + 1),
      remaining: pathPoints.slice(closestIdx),
    };
  }, [pathPoints, liveLocation]);

  // Bounds include both airports + aircraft when airborne.
  const bounds: L.LatLngBoundsExpression = useMemo(() => {
    const pts: [number, number][] = [
      [origin.lat as number, origin.lon as number],
      [destination.lat as number, destination.lon as number],
    ];
    if (liveLocation) pts.push([liveLocation.lat, liveLocation.lon]);
    return pts;
  }, [origin.lat, origin.lon, destination.lat, destination.lon, liveLocation]);

  return (
    <div className="w-full h-[280px] border border-board-border bg-surface overflow-hidden">
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [40, 40] }}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={false}
        worldCopyJump={true}
        style={{ height: "100%", width: "100%", background: "#0a0a0a" }}
      >
        <TileLayer url={DARK_TILE_URL} attribution={DARK_ATTRIBUTION} />

        {/* Remaining (or full) path — solid amber */}
        <Polyline
          positions={remaining}
          pathOptions={{
            color: AMBER,
            weight: 2,
            opacity: 0.9,
            dashArray: "6 6",
          }}
        />

        {/* Flown portion — dim amber solid, no dashes */}
        {flown && flown.length > 1 && (
          <Polyline
            positions={flown}
            pathOptions={{
              color: AMBER_FAINT,
              weight: 2,
              opacity: 0.9,
            }}
          />
        )}

        <Marker
          position={[origin.lat as number, origin.lon as number]}
          icon={originIcon}
        />
        <Marker
          position={[destination.lat as number, destination.lon as number]}
          icon={destIcon}
        />
        {liveLocation && (
          <Marker
            position={[liveLocation.lat, liveLocation.lon]}
            icon={aircraftIcon}
          />
        )}

        <FitBoundsOnUpdate bounds={bounds} />
      </MapContainer>
    </div>
  );
}
