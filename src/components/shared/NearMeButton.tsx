/**
 * NearMeButton.tsx -- "Near Me" button for finding nearby stations
 *
 * Uses the browser's Geolocation API to detect the user's position,
 * then queries the TfL API for the nearest station and selects it
 * automatically to show live departures.
 *
 * States:
 *   - Idle: shows "NEAR ME" button
 *   - Locating: shows "LOCATING..." with blink animation
 *   - Error: shows error message briefly, then returns to idle
 *
 * Usage:
 *   <NearMeButton onStationFound={(station) => setSelected(station)} />
 */

"use client";

import { useState, useCallback } from "react";
import { LocateFixed } from "lucide-react";
import { cn } from "@/lib/utils";

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
  /** Called when the nearest station is found */
  onStationFound: (station: NearbyStation) => void;
  /** Additional CSS classes */
  className?: string;
}

export default function NearMeButton({
  onStationFound,
  className,
}: NearMeButtonProps) {
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleClick = useCallback(async () => {
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
            maximumAge: 60000, /* Accept cached position up to 1 min old */
          });
        }
      );

      const { latitude, longitude } = position.coords;

      /* Query our API for nearby stations */
      const response = await fetch(
        `/api/tfl/nearby?lat=${latitude}&lon=${longitude}&radius=1000`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch nearby stations");
      }

      const stations: NearbyStation[] = await response.json();

      if (stations.length === 0) {
        setStatus("error");
        setErrorMsg("NO STATIONS NEARBY");
        setTimeout(() => setStatus("idle"), 3000);
        return;
      }

      /* Select the nearest station */
      onStationFound(stations[0]);
      setStatus("idle");
    } catch (error) {
      setStatus("error");

      /* Handle specific geolocation errors */
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
  }, [onStationFound]);

  return (
    <button
      onClick={handleClick}
      disabled={status === "locating"}
      className={cn(
        /* Base styling */
        "flex items-center gap-2 px-4 py-2.5",
        "font-mono text-sm tracking-wider uppercase",
        "border transition-colors duration-200",
        /* State-dependent styling */
        status === "idle" &&
          "border-amber text-amber hover:bg-amber/10 cursor-pointer",
        status === "locating" &&
          "border-amber-faint text-amber-faint animate-blink cursor-wait",
        status === "error" &&
          "border-error text-error cursor-default",
        className
      )}
      aria-label={
        status === "locating"
          ? "Finding your nearest station..."
          : "Find stations near me"
      }
    >
      <LocateFixed size={16} strokeWidth={1.5} />
      <span>
        {status === "idle" && "NEAR ME"}
        {status === "locating" && "LOCATING..."}
        {status === "error" && errorMsg}
      </span>
    </button>
  );
}
