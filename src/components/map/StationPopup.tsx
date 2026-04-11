/**
 * StationPopup.tsx — Popup card for station markers on the map
 *
 * When a user taps a station marker on the nearby map, this popup
 * shows the station name and the next 2-3 arrivals. Fetches live
 * arrival data on mount. Includes a link to the full departure board.
 *
 * Styled with the dot-matrix amber theme to match the rest of the app.
 */

"use client";

import { useEffect, useState } from "react";
import { LINE_COLOURS } from "@/lib/constants";
import { useFavourites } from "@/hooks/useFavourites";
import { isBusStop } from "@/lib/utils";

interface Arrival {
  lineId: string;
  lineName: string;
  destinationName: string;
  timeToStation: number;
  modeName: string;
}

interface Station {
  naptanId: string;
  name: string;
  lat: number;
  lon: number;
  modes: string[];
  lines: { id: string; name: string }[];
  stopLetter?: string;
  indicator?: string;
  allNaptanIds?: string[];
}

interface StationPopupProps {
  station: Station;
  /** Called when user taps a route number to show/hide it on the map */
  onShowRoute?: (lineId: string) => void;
  /** The currently active route ID (for highlighting the active button) */
  activeRouteId?: string;
}

/**
 * Clean station name for display by removing common suffixes.
 */
function cleanName(name: string): string {
  return name
    .replace(/\s*Underground Station$/i, "")
    .replace(/\s*DLR Station$/i, "")
    .replace(/\s*Rail Station$/i, "")
    .replace(/\s*Station$/i, "")
    .replace(/\s*\(London\)/i, "")
    .trim();
}

export default function StationPopup({ station, onShowRoute, activeRouteId }: StationPopupProps) {
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [loading, setLoading] = useState(true);
  const { toggleFavourite, isFavourite } = useFavourites();
  const [saved, setSaved] = useState(false);

  const isBus = isBusStop(station.naptanId, station.modes);

  /* Check if station is already saved */
  useEffect(() => {
    isFavourite(station.naptanId).then(setSaved);
  }, [station.naptanId, isFavourite]);

  /* Fetch arrivals when popup opens */
  useEffect(() => {
    let cancelled = false;

    async function fetchArrivals() {
      try {
        /* For consolidated stations, fetch from the primary naptanId */
        const stopId = station.allNaptanIds?.length
          ? station.allNaptanIds.join(",")
          : station.naptanId;

        const resp = await fetch(`/api/tfl/arrivals?stopId=${stopId}`);
        if (!resp.ok || cancelled) return;

        const data: Arrival[] = await resp.json();
        if (!cancelled) {
          /* Sort by time and take first 3 */
          const sorted = data
            .sort((a, b) => a.timeToStation - b.timeToStation)
            .slice(0, 3);
          setArrivals(sorted);
        }
      } catch {
        /* Silently fail */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchArrivals();
    return () => {
      cancelled = true;
    };
  }, [station.naptanId, station.allNaptanIds]);

  /**
   * Format time to station for display.
   */
  function formatTime(seconds: number): string {
    if (seconds <= 30) return "DUE";
    const mins = Math.floor(seconds / 60);
    return `${mins} MIN`;
  }

  return (
    <div
      className="font-mono"
      style={{
        background: "#111111",
        color: "#ff9500",
        padding: "10px",
        minWidth: "200px",
      }}
    >
      {/* Station name */}
      <div
        style={{
          fontSize: "13px",
          fontWeight: "bold",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: "8px",
          textShadow: "0 0 8px rgba(255, 149, 0, 0.4)",
        }}
      >
        {isBus && station.stopLetter && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "20px",
              height: "20px",
              border: "1px solid #ff9500",
              marginRight: "6px",
              fontSize: "11px",
            }}
          >
            {station.stopLetter}
          </span>
        )}
        {cleanName(station.name)}
      </div>

      {/* Arrivals */}
      {loading ? (
        <div
          style={{
            fontSize: "11px",
            letterSpacing: "0.1em",
            color: "#664400",
            animation: "blink 1s step-end infinite",
          }}
        >
          LOADING...
        </div>
      ) : arrivals.length === 0 ? (
        <div
          style={{
            fontSize: "11px",
            letterSpacing: "0.1em",
            color: "#664400",
          }}
        >
          NO ARRIVALS
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {arrivals.map((arrival, i) => (
            <div
              key={`${arrival.lineId}-${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                letterSpacing: "0.08em",
              }}
            >
              {/* Line indicator */}
              {arrival.modeName === "bus" ? (
                <span
                  style={{
                    border: "1px solid #cc7700",
                    padding: "0 4px",
                    fontSize: "10px",
                    color: "#ff9500",
                    flexShrink: 0,
                  }}
                >
                  {arrival.lineName}
                </span>
              ) : (
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: LINE_COLOURS[arrival.lineId] || "#FF9500",
                    flexShrink: 0,
                  }}
                />
              )}
              {/* Destination */}
              <span
                style={{
                  flex: 1,
                  textTransform: "uppercase",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "#ff9500",
                }}
              >
                {cleanName(arrival.destinationName)}
              </span>
              {/* Time */}
              <span
                style={{
                  flexShrink: 0,
                  color:
                    arrival.timeToStation <= 30 ? "#ff9500" : "#cc7700",
                  textShadow:
                    arrival.timeToStation <= 30
                      ? "0 0 8px rgba(255, 149, 0, 0.6)"
                      : "none",
                }}
              >
                {formatTime(arrival.timeToStation)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Route buttons for bus stops */}
      {isBus && station.lines.length > 0 && onShowRoute && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            marginTop: "8px",
            paddingTop: "8px",
            borderTop: "1px solid #1a1a1a",
          }}
        >
          <span
            style={{
              fontSize: "9px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#664400",
            }}
          >
            SHOW ROUTE ON MAP
          </span>
          {station.lines.map((line) => {
            const isActive = activeRouteId === line.id;
            return (
              <button
                key={line.id}
                onClick={() => onShowRoute(line.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  padding: "10px 12px",
                  border: isActive ? "1.5px solid #ff9500" : "1.5px solid #cc7700",
                  background: isActive ? "rgba(255, 149, 0, 0.15)" : "rgba(255, 149, 0, 0.05)",
                  color: "#ff9500",
                  fontFamily: "monospace",
                  fontSize: "13px",
                  fontWeight: "bold",
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                  textShadow: isActive ? "0 0 10px rgba(255, 149, 0, 0.6)" : "none",
                }}
              >
                {isActive ? "HIDE ROUTE " : "ROUTE "}{line.id}
              </button>
            );
          })}
        </div>
      )}

      {/* Action buttons */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginTop: "8px",
          paddingTop: "6px",
          borderTop: "1px solid #1a1a1a",
        }}
      >
        <a
          href={`/?stopId=${station.naptanId}&name=${encodeURIComponent(station.name)}`}
          style={{
            flex: 1,
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#cc7700",
            textDecoration: "none",
          }}
        >
          VIEW FULL BOARD
        </a>
        <button
          onClick={async () => {
            const nowSaved = await toggleFavourite({
              naptanId: station.naptanId,
              name: station.name,
              lines: station.lines.map((l) => l.id),
              lat: station.lat,
              lng: station.lon,
              modes: station.modes,
              stopLetter: station.stopLetter,
              indicator: station.indicator,
            });
            setSaved(nowSaved);
          }}
          style={{
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: saved ? "#ff9500" : "#664400",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "monospace",
            textShadow: saved ? "0 0 8px rgba(255, 149, 0, 0.4)" : "none",
          }}
        >
          {saved ? "SAVED" : "SAVE"}
        </button>
      </div>
    </div>
  );
}
