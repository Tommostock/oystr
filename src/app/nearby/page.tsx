/**
 * nearby/page.tsx — Nearby Stops Map
 *
 * Full-screen map showing the user's live location and nearby
 * tube stations and bus stops. Uses Leaflet with dark CartoDB tiles.
 *
 * The NearbyMap component is dynamically imported with ssr: false
 * because Leaflet requires browser APIs (window, document) that
 * don't exist during server-side rendering.
 *
 * Flow:
 *   1. Request geolocation permission
 *   2. Get initial position
 *   3. Render map centered on user
 *   4. Fetch and display nearby stations
 */

"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import AmberText from "@/components/shared/AmberText";

/*
 * Dynamic import with SSR disabled.
 * Leaflet accesses window/document on import, so it cannot
 * be included in the server-side bundle.
 */
const NearbyMap = dynamic(() => import("@/components/map/NearbyMap"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-board-bg">
      <AmberText variant="dim" size="sm" className="dot-matrix animate-blink">
        LOADING MAP...
      </AmberText>
    </div>
  ),
});

type Status = "loading" | "ready" | "denied" | "unavailable" | "unsupported";

export default function NearbyPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [position, setPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  /* Request geolocation on mount */
  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus("unsupported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setStatus("ready");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("denied");
        } else {
          setStatus("unavailable");
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, []);

  /* Full-height layout minus the bottom nav (h-14 + safe area) */
  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100dvh-3.5rem)] bg-board-bg">
        <MapPin size={32} strokeWidth={1} className="text-amber-faint mb-3" />
        <AmberText variant="dim" size="sm" className="dot-matrix animate-blink">
          LOCATING...
        </AmberText>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100dvh-3.5rem)] bg-board-bg px-8 text-center space-y-3">
        <MapPin size={32} strokeWidth={1} className="text-amber-faint" />
        <AmberText variant="dim" size="sm" className="dot-matrix">
          LOCATION ACCESS DENIED
        </AmberText>
        <p className="font-mono text-xs tracking-wider text-amber-faint">
          ENABLE LOCATION IN YOUR BROWSER SETTINGS TO USE THE NEARBY MAP
        </p>
      </div>
    );
  }

  if (status === "unavailable" || status === "unsupported") {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100dvh-3.5rem)] bg-board-bg px-8 text-center space-y-3">
        <MapPin size={32} strokeWidth={1} className="text-amber-faint" />
        <AmberText variant="dim" size="sm" className="dot-matrix">
          LOCATION UNAVAILABLE
        </AmberText>
        <p className="font-mono text-xs tracking-wider text-amber-faint">
          COULD NOT DETERMINE YOUR POSITION
        </p>
      </div>
    );
  }

  return (
    <div className="h-full bg-board-bg">
      {position && <NearbyMap initialPosition={position} />}
    </div>
  );
}
