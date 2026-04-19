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
 *
 * Fallback: when location is denied/unavailable, offers a RETRY
 * button and a manual-entry option that jumps to the home search
 * — so the tab is never a dead-end.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { MapPin, RefreshCw, Search } from "lucide-react";
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
  const router = useRouter();

  /**
   * Request the user's geolocation. Exported as a callback so the
   * RETRY button in the denied/unavailable states can call it again
   * without forcing the user to reload the page.
   */
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    setStatus("loading");
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

  /* Kick off the initial location request on mount. */
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  /**
   * Shared chrome (title strip + content) for all non-ready states.
   * Consistent header with the rest of the app tabs — previously
   * Nearby had no title at all when the map was loaded.
   */
  const headerStrip = (
    <div className="text-center pt-4 pb-2">
      <AmberText as="h1" size="lg" uppercase className="dot-matrix">
        Nearby
      </AmberText>
      <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mt-1">
        LIVE MAP OF STATIONS AROUND YOU
      </div>
    </div>
  );

  /* ---- Loading state ---- */
  if (status === "loading") {
    return (
      <div className="p-4">
        {headerStrip}
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <MapPin size={32} strokeWidth={1} className="text-amber-faint" />
          <AmberText variant="dim" size="sm" className="dot-matrix animate-blink">
            LOCATING...
          </AmberText>
        </div>
      </div>
    );
  }

  /* ---- Permission denied / unavailable / unsupported — all share
         the same fallback layout with RETRY + MANUAL SEARCH. ---- */
  if (status === "denied" || status === "unavailable" || status === "unsupported") {
    const title =
      status === "denied" ? "LOCATION ACCESS DENIED" : "LOCATION UNAVAILABLE";
    const hint =
      status === "denied"
        ? "We couldn't access your location. You can retry the permission request or search for a station manually."
        : status === "unsupported"
          ? "This browser doesn't support geolocation. You can still search for a station manually."
          : "We couldn't determine your position. Check your connection and try again, or search manually.";

    return (
      <div className="p-4">
        {headerStrip}
        <div className="flex flex-col items-center justify-center py-8 px-6 text-center space-y-4">
          <MapPin size={32} strokeWidth={1} className="text-amber-faint" />
          <AmberText variant="dim" size="sm" className="dot-matrix">
            {title}
          </AmberText>
          <p className="font-mono text-xs tracking-wider text-amber-faint leading-relaxed max-w-xs">
            {hint.toUpperCase()}
          </p>
          <div className="flex flex-col gap-2 w-full max-w-xs pt-2">
            {status !== "unsupported" && (
              <button
                onClick={requestLocation}
                className="inline-flex items-center justify-center gap-2 py-2 border border-amber text-amber hover:bg-amber hover:text-board-bg transition-colors"
                aria-label="Retry location request"
              >
                <RefreshCw size={14} strokeWidth={1.5} />
                <span className="font-mono text-[10px] tracking-wider uppercase">
                  RETRY PERMISSION
                </span>
              </button>
            )}
            <button
              onClick={() => router.push("/")}
              className="inline-flex items-center justify-center gap-2 py-2 border border-amber-faint text-amber-faint hover:border-amber hover:text-amber transition-colors"
              aria-label="Search for a station manually"
            >
              <Search size={14} strokeWidth={1.5} />
              <span className="font-mono text-[10px] tracking-wider uppercase">
                SEARCH MANUALLY
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---- Ready state: compact title strip + map filling the remaining height ---- */
  return (
    <div className="bg-board-bg flex flex-col"
         style={{ height: "calc(100dvh - 3.5rem - env(safe-area-inset-bottom, 0px) - 0.5rem)" }}
    >
      {/* Title strip — matches the other tabs' header pattern but
          kept compact so the map still gets the vast majority of
          the viewport. */}
      <div className="shrink-0 text-center py-2 border-b border-board-border">
        <AmberText as="h1" size="base" uppercase className="dot-matrix">
          Nearby
        </AmberText>
        <div className="font-mono text-[9px] tracking-wider text-amber-faint uppercase mt-0.5">
          LIVE MAP OF STATIONS AROUND YOU
        </div>
      </div>
      <div className="flex-1 relative">
        {position && <NearbyMap initialPosition={position} />}
      </div>
    </div>
  );
}
