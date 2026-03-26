/**
 * NearMeButton.tsx -- "Near Me" button showing nearby stations
 *
 * Uses the browser's Geolocation API to detect the user's position,
 * then queries the TfL API for stations within 1 mile (~1600m).
 * Shows a dropdown list so the user can pick which station to view.
 *
 * States:
 *   - Idle: shows "NEAR ME" button
 *   - Locating: shows "LOCATING..." with blink animation
 *   - Results: shows list of nearby stations
 *   - Error: shows error message briefly, then returns to idle
 *
 * Usage:
 *   <NearMeButton onStationFound={(station) => setSelected(station)} />
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { LocateFixed, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LINE_COLOURS } from "@/lib/constants";

interface NearbyStation {
  naptanId: string;
  name: string;
  lat: number;
  lon: number;
  distance: number;
  modes: string[];
  lines: { id: string; name: string }[];
}

interface NearMeButtonProps {
  /** Called when the user selects a station from the list */
  onStationFound: (station: NearbyStation) => void;
  /** Additional CSS classes */
  className?: string;
}

export default function NearMeButton({
  onStationFound,
  className,
}: NearMeButtonProps) {
  const [status, setStatus] = useState<
    "idle" | "locating" | "results" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [nearbyStations, setNearbyStations] = useState<NearbyStation[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  /* Close the list when clicking outside */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        if (status === "results") setStatus("idle");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [status]);

  const handleClick = useCallback(async () => {
    /* If already showing results, close them */
    if (status === "results") {
      setStatus("idle");
      return;
    }

    /* Check if geolocation is available */
    if (!navigator.geolocation) {
      setStatus("error");
      setErrorMsg("GEOLOCATION NOT SUPPORTED");
      setTimeout(() => setStatus("idle"), 3000);
      return;
    }

    setStatus("locating");

    try {
      /* Get the user's position */
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 60000,
          });
        }
      );

      const { latitude, longitude } = position.coords;

      /* Query API for nearby stations within ~1 mile (1600m) */
      const response = await fetch(
        `/api/tfl/nearby?lat=${latitude}&lon=${longitude}&radius=1600`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch nearby stations");
      }

      const stations: NearbyStation[] = await response.json();

      if (stations.length === 0) {
        setStatus("error");
        setErrorMsg("NO STATIONS WITHIN 1 MILE");
        setTimeout(() => setStatus("idle"), 3000);
        return;
      }

      setNearbyStations(stations);
      setStatus("results");
    } catch (error) {
      setStatus("error");

      if (error instanceof GeolocationPositionError) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setErrorMsg("LOCATION ACCESS DENIED");
            break;
          case error.POSITION_UNAVAILABLE:
            setErrorMsg("LOCATION UNAVAILABLE");
            break;
          case error.TIMEOUT:
            setErrorMsg("LOCATION TIMED OUT");
            break;
          default:
            setErrorMsg("LOCATION ERROR");
        }
      } else {
        setErrorMsg("FAILED TO FIND STATIONS");
      }

      setTimeout(() => setStatus("idle"), 3000);
    }
  }, [status]);

  /**
   * Format distance for display.
   * Under 1000m: show in metres. Over 1000m: show in km.
   */
  const formatDistance = (metres: number): string => {
    if (metres < 1000) return `${Math.round(metres)}m`;
    return `${(metres / 1000).toFixed(1)}km`;
  };

  /**
   * Clean station name for display.
   */
  const cleanName = (name: string): string =>
    name
      .replace(/\s*Underground Station$/i, "")
      .replace(/\s*DLR Station$/i, "")
      .replace(/\s*Rail Station$/i, "")
      .replace(/\s*Station$/i, "")
      .replace(/\s*\(London\)/i, "")
      .trim();

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* ---- Button ---- */}
      <button
        onClick={handleClick}
        disabled={status === "locating"}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5",
          "font-mono text-sm tracking-wider uppercase",
          "border transition-colors duration-200",
          status === "idle" &&
            "border-amber text-amber hover:bg-amber/10 cursor-pointer",
          status === "locating" &&
            "border-amber-faint text-amber-faint animate-blink cursor-wait",
          status === "results" &&
            "border-amber text-amber bg-amber/10 cursor-pointer",
          status === "error" &&
            "border-error text-error cursor-default"
        )}
        aria-label={
          status === "locating"
            ? "Finding nearby stations..."
            : "Find stations near me"
        }
      >
        <LocateFixed size={16} strokeWidth={1.5} />
        <span>
          {status === "idle" && "NEAR ME"}
          {status === "locating" && "LOCATING..."}
          {status === "results" && "NEAR ME"}
          {status === "error" && errorMsg}
        </span>
        {status === "results" && (
          <X size={14} strokeWidth={1.5} className="ml-1" />
        )}
      </button>

      {/* ---- Nearby stations list ---- */}
      {status === "results" && nearbyStations.length > 0 && (
        <div className="absolute z-50 w-72 mt-2 left-1/2 -translate-x-1/2 bg-surface border border-board-border max-h-80 overflow-y-auto">
          <div className="px-3 py-2 border-b border-board-border">
            <span className="font-mono text-xs tracking-wider text-amber-faint">
              {nearbyStations.length} STATIONS WITHIN 1 MILE
            </span>
          </div>
          {nearbyStations.map((station) => (
            <button
              key={station.naptanId}
              onClick={() => {
                onStationFound(station);
                setStatus("idle");
              }}
              className={cn(
                "w-full text-left px-3 py-2.5",
                "hover:bg-board-border transition-colors duration-150",
                "border-b border-board-border/50 last:border-b-0"
              )}
            >
              <div className="flex items-center gap-2">
                {/* Line colour dots */}
                <div className="flex gap-0.5 shrink-0">
                  {station.lines.slice(0, 3).map((line) => (
                    <span
                      key={line.id}
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor:
                          LINE_COLOURS[line.id] || "#FF9500",
                      }}
                    />
                  ))}
                </div>
                {/* Station name */}
                <span className="font-mono text-sm tracking-wider text-amber uppercase truncate flex-1">
                  {cleanName(station.name)}
                </span>
                {/* Distance */}
                <span className="font-mono text-xs tracking-wider text-amber-faint shrink-0">
                  {formatDistance(station.distance)}
                </span>
              </div>
              {/* Modes */}
              <div className="font-mono text-xs tracking-wider text-amber-faint mt-0.5 uppercase pl-6">
                {station.modes.join(" / ")}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
