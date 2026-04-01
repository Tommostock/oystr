/**
 * page.tsx — Home page (Departures Board)
 *
 * The main page of Oystr. Users search for a station,
 * then see a live departure board showing incoming trains/buses.
 *
 * Flow:
 *   1. User types in the search bar
 *   2. Autocomplete dropdown shows matching stations
 *   3. User selects a station
 *   4. Departure board appears with live arrival data
 *   5. Data auto-refreshes every 30 seconds
 *   6. User can save the station for offline and quick access
 *
 * Also supports arriving via URL params from the Saved page:
 *   /?stopId=940GZZLUMLE&name=Mile End
 */

"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { RotateCcw, List, HelpCircle } from "lucide-react";
import StationSearch from "@/components/shared/StationSearch";
import NearMeButton from "@/components/shared/NearMeButton";
import DepartureBoard from "@/components/departure-board/DepartureBoard";
import QuickViewWidget from "@/components/departure-board/QuickViewWidget";
import SaveStationButton from "@/components/departure-board/SaveStationButton";
import StationAlerts from "@/components/departure-board/StationAlerts";
import PeakIndicator from "@/components/shared/PeakIndicator";
import CrowdingIndicator from "@/components/shared/CrowdingIndicator";
import WeatherIcon from "@/components/shared/WeatherIcon";
import { getStationFact } from "@/lib/station-facts";
import { LINE_NAMES, LINE_COLOURS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import NightTubeIndicator from "@/components/shared/NightTubeIndicator";
import SavedStationDisruptions from "@/components/shared/SavedStationDisruptions";
import BoardPanel from "@/components/shared/BoardPanel";
import AmberText from "@/components/shared/AmberText";

/** Shape of a selected station (from the search results) */
interface SelectedStation {
  naptanId: string;
  name: string;
  lat: number;
  lon: number;
  modes: string[];
  lines: { id: string; name: string }[];
  zone?: string;
  address?: string;
  /** Bus stop letter (e.g. "H") — only for bus stops */
  stopLetter?: string;
  /** Bus stop indicator text (e.g. "Stop H") — only for bus stops */
  indicator?: string;
  /** All naptan IDs for consolidated stations (tube + Elizabeth line + rail) */
  allNaptanIds?: string[];
}

/**
 * Get a greeting based on the current time of day.
 * Used in the app header for a personal touch.
 */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Good Night";
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  if (hour < 21) return "Good Evening";
  return "Good Night";
}

/**
 * Inner component that reads URL search params.
 * Wrapped in Suspense because useSearchParams requires it in Next.js 15.
 */
function HomeContent() {
  /* The station the user has selected (null = none selected yet) */
  const [selectedStation, setSelectedStation] =
    useState<SelectedStation | null>(null);

  /* About popup state */
  const [showAbout, setShowAbout] = useState(false);
  const aboutRef = useRef<HTMLDivElement>(null);

  /* Close About popup when clicking outside */
  useEffect(() => {
    if (!showAbout) return;
    const handleClick = (e: MouseEvent) => {
      if (aboutRef.current && !aboutRef.current.contains(e.target as Node)) {
        setShowAbout(false);
      }
    };
    /* Delay to prevent immediate close from the button click */
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [showAbout]);

  /* Read URL params (used when navigating from Stations / Saved page) */
  const searchParams = useSearchParams();
  const urlStopId = searchParams.get("stopId");
  const urlName = searchParams.get("name");

  /*
   * If we arrive with ?stopId=X&name=Y in the URL,
   * pre-select that station so the departure board loads immediately.
   * We depend on the actual string values (not the searchParams object)
   * so this fires reliably on every station change, even when Next.js
   * serves a cached version of the page.
   */
  useEffect(() => {
    if (urlStopId && urlName) {
      setSelectedStation({
        naptanId: urlStopId,
        name: urlName,
        lat: 0,
        lon: 0,
        modes: [],
        lines: [],
      });
    }
  }, [urlStopId, urlName]);

  /*
   * When a station is selected without full details (e.g. from Saved page
   * or Near Me), fetch the zone and coordinates from TfL so the weather
   * icon and zone badge can display.
   */
  const selectedNaptanId = selectedStation?.naptanId;
  const selectedName = selectedStation?.name;
  const selectedLat = selectedStation?.lat;
  const selectedZone = selectedStation?.zone;

  useEffect(() => {
    if (!selectedNaptanId || !selectedName) return;
    if (selectedLat !== 0 && selectedZone) return;

    async function enrichStation() {
      try {
        const resp = await fetch(
          `/api/tfl/search?query=${encodeURIComponent(selectedName!)}`
        );
        if (!resp.ok) return;
        const results = await resp.json();
        /*
         * Prefer an exact naptanId match. Fall back to a name match,
         * but only for non-bus results to avoid picking up a bus stop
         * and overwriting tube station data with bus modes/lines.
         */
        const match =
          results.find(
            (r: { naptanId: string }) => r.naptanId === selectedNaptanId
          ) ||
          results.find(
            (r: { naptanId: string; name: string }) =>
              !r.naptanId.startsWith("490") &&
              r.name.toLowerCase().includes(selectedName!.toLowerCase())
          );
        if (match) {
          setSelectedStation((prev) =>
            prev
              ? {
                  ...prev,
                  lat: match.lat || prev.lat,
                  lon: match.lon || prev.lon,
                  zone: match.zone || prev.zone,
                  /* Only update modes/lines if station has none yet */
                  modes: prev.modes.length > 0 ? prev.modes : (match.modes || []),
                  lines: prev.lines.length > 0 ? prev.lines : (match.lines || []),
                }
              : prev
          );
        }
      } catch {
        /* Silently fail — zone/weather are not critical */
      }
    }

    enrichStation();
  }, [selectedNaptanId, selectedName, selectedLat, selectedZone]);

  /*
   * Fetch line data from the disruptions/StopPoint endpoint.
   * The search API often returns empty lines, but the StopPoint
   * endpoint reliably returns which lines serve a station.
   * Only runs when we have a station selected with no lines.
   */
  const selectedLines = selectedStation?.lines;
  useEffect(() => {
    if (!selectedNaptanId) return;
    if (selectedLines && selectedLines.length > 0) return;

    async function fetchLines() {
      try {
        const resp = await fetch(
          `/api/tfl/disruptions?stopId=${selectedNaptanId}`
        );
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.lines?.length > 0) {
          setSelectedStation((prev) =>
            prev && prev.lines.length === 0
              ? { ...prev, lines: data.lines }
              : prev
          );
        }
      } catch {
        /* Silently fail — line display is not critical */
      }
    }

    fetchLines();
  }, [selectedNaptanId, selectedLines]);

  /*
   * Fetch the station address from the disruptions endpoint.
   * The address comes from TfL StopPoint data and is shown
   * below the station name in the header.
   */
  const selectedAddress = selectedStation?.address;
  useEffect(() => {
    if (!selectedNaptanId || selectedAddress) return;

    async function fetchAddress() {
      try {
        const resp = await fetch(
          `/api/tfl/disruptions?stopId=${selectedNaptanId}`
        );
        if (!resp.ok) return;
        const data = await resp.json();
        setSelectedStation((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            address: data.facilities?.address || prev.address,
          };
        });
      } catch {
        /* Silently fail — address is not critical */
      }
    }

    fetchAddress();
  }, [selectedNaptanId, selectedAddress]);

  return (
    <div className="p-4 space-y-4">
      {/* ---- App Header with home reset button ---- */}
      <div className="relative flex items-center justify-center pt-4 pb-2">
        {/* Home/reset button — always visible, clears selection and returns to start */}
        {selectedStation && (
          <button
            onClick={() => setSelectedStation(null)}
            className="absolute left-0 flex items-center gap-1.5 text-amber-faint hover:text-amber transition-colors font-mono text-xs tracking-wider"
            aria-label="Back to home"
          >
            <RotateCcw size={14} strokeWidth={1.5} />
            <span>RESET</span>
          </button>
        )}

        <div className="flex flex-col items-center">
          <AmberText
            as="h1"
            size="2xl"
            uppercase
            className="amber-glow-strong dot-matrix"
          >
            Oystr
          </AmberText>
          {/* Greeting or subtitle depending on state */}
          <span className="font-mono text-[9px] tracking-[0.25em] text-amber-faint uppercase mt-0.5">
            {selectedStation ? "Your London Transport Companion" : getGreeting()}
          </span>
        </div>

        {/* About button — top right */}
        <button
          onClick={() => setShowAbout(true)}
          className="absolute right-0 w-9 h-9 flex items-center justify-center border border-board-border text-amber-faint hover:text-amber hover:border-amber-faint transition-colors"
          aria-label="About Oystr"
        >
          <HelpCircle size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* ---- About Popup ---- */}
      {showAbout && (
        <div className="fixed inset-0 z-[8500] flex items-center justify-center bg-black/70">
          <div
            ref={aboutRef}
            className="mx-6 max-w-sm w-full bg-surface border border-amber/30 p-6 space-y-4"
          >
            <div className="text-center">
              <div
                className="font-board text-3xl tracking-[0.15em] text-amber uppercase"
                style={{ textShadow: "0 0 12px rgba(255, 149, 0, 0.5)" }}
              >
                OYSTR
              </div>
              <div className="font-mono text-[10px] tracking-wider text-amber-faint mt-1 uppercase">
                VERSION 1.0.0
              </div>
            </div>

            <div className="border-t border-board-border pt-4">
              <h3 className="font-mono text-xs tracking-wider text-amber uppercase mb-2">
                ABOUT OYSTR
              </h3>
              <p className="font-mono text-[11px] leading-relaxed text-amber-dim">
                Your London transport companion. Live departure times, journey planning,
                nearby station maps, and line status updates -- all styled like the
                iconic amber dot-matrix boards found across the TfL network.
              </p>
            </div>

            <div className="border-t border-board-border pt-3 space-y-1.5">
              <div className="flex justify-between font-mono text-[10px] tracking-wider">
                <span className="text-amber-faint">DATA SOURCE</span>
                <span className="text-amber-dim">TFL UNIFIED API</span>
              </div>
              <div className="flex justify-between font-mono text-[10px] tracking-wider">
                <span className="text-amber-faint">FRAMEWORK</span>
                <span className="text-amber-dim">NEXT.JS + VERCEL</span>
              </div>
              <div className="flex justify-between font-mono text-[10px] tracking-wider">
                <span className="text-amber-faint">DEVELOPER</span>
                <span className="text-amber-dim">TOM</span>
              </div>
            </div>

            <button
              onClick={() => setShowAbout(false)}
              className="w-full py-2.5 border border-amber text-amber font-mono text-xs tracking-wider uppercase hover:bg-amber/10 transition-colors"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* ---- Station Search + Near Me ---- */}
      <div className="flex items-start gap-2">
        <StationSearch
          onSelect={(station) => setSelectedStation(station)}
          placeholder="Search for a station..."
          className="flex-1"
        />
        {/* Near Me button — compact icon next to search */}
        {!selectedStation && (
          <NearMeButton
            onStationFound={(station) =>
              setSelectedStation({
                naptanId: station.naptanId,
                name: station.name,
                lat: station.lat,
                lon: station.lon,
                modes: station.modes,
                lines: station.lines,
                allNaptanIds: station.allNaptanIds,
              })
            }
          />
        )}
      </div>

      {/* ---- Browse All Stations button ---- */}
      {!selectedStation && (
        <Link
          href="/stations"
          className={cn(
            "flex items-center justify-center gap-2 w-full py-2.5",
            "border border-amber-faint text-amber-faint",
            "hover:border-amber hover:text-amber",
            "font-mono text-xs tracking-wider uppercase",
            "transition-colors duration-200"
          )}
        >
          <List size={14} strokeWidth={1.5} />
          <span>BROWSE ALL STATIONS</span>
        </Link>
      )}

      {/* ---- Departure Board or Empty State ---- */}
      {selectedStation ? (
        <div className="space-y-3">
          {/* Selected station header */}
          <div className="border border-board-border bg-surface p-3 space-y-2">
            {/* Row 1: Station name + weather + zone + save icon */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-2 min-w-0">
                <div className="flex items-start">
                  <h2 className="font-board text-2xl tracking-wider text-amber uppercase amber-glow truncate">
                    {selectedStation.name
                      .replace(/\s*Underground Station$/i, "")
                      .replace(/\s*DLR Station$/i, "")
                      .replace(/\s*Rail Station$/i, "")
                      .replace(/\s*Station$/i, "")
                      .replace(/\s*\(London\)/i, "")}
                  </h2>
                  {/* Weather icon as superscript */}
                  <WeatherIcon lat={selectedStation.lat} lon={selectedStation.lon} />
                </div>
                {selectedStation.zone && (
                  <span className="shrink-0 font-mono text-xs tracking-wider text-amber amber-glow">
                    Zone {selectedStation.zone}
                  </span>
                )}
              </div>
              <SaveStationButton station={selectedStation} />
            </div>
            {/* Station address (compact, below the name) */}
            {selectedStation.address && (
              <p className="font-mono text-[10px] tracking-wider text-amber-faint leading-tight">
                {selectedStation.address}
              </p>
            )}
            {/* Station name origin fact (only if available) */}
            {getStationFact(selectedStation.name) && (
              <p className="font-mono text-[10px] tracking-wider text-amber amber-glow leading-relaxed">
                {getStationFact(selectedStation.name)}
              </p>
            )}
            {/* Lines / bus routes serving this station */}
            {selectedStation.lines.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedStation.naptanId?.startsWith("490") ? (
                  /* Bus: show route numbers as bordered badges */
                  selectedStation.lines.map((line) => (
                    <span
                      key={line.id}
                      className="border border-amber-faint text-amber font-mono text-[10px] tracking-wider px-1.5 py-0.5"
                    >
                      {line.id}
                    </span>
                  ))
                ) : (
                  /* Tube/rail: show colour dots + names, only for known TfL lines */
                  selectedStation.lines
                    .filter((line) => LINE_NAMES[line.id])
                    .map((line) => (
                    <span
                      key={line.id}
                      className="flex items-center gap-1"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: LINE_COLOURS[line.id] || "#FF9500" }}
                      />
                      <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
                        {LINE_NAMES[line.id]}
                      </span>
                    </span>
                  ))
                )}
              </div>
            )}
            {/* Row 2: indicators (compact) */}
            <div className="flex items-center gap-2">
              <CrowdingIndicator />
              <PeakIndicator />
            </div>
          </div>

          {/* Night Tube indicator (only shows Fri/Sat nights) */}
          <NightTubeIndicator />

          {/* Accessibility and disruption alerts */}
          <StationAlerts stopId={selectedStation.naptanId} />

          {/* Live departure board for the selected station */}
          <DepartureBoard
            stopId={
              selectedStation.allNaptanIds && selectedStation.allNaptanIds.length > 1
                ? selectedStation.allNaptanIds.join(",")
                : selectedStation.naptanId
            }
            stationName={selectedStation.name}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Disruption banner for saved station lines */}
          <SavedStationDisruptions />

          {/* Quick-view widget for saved stations */}
          <QuickViewWidget
            onStationSelect={(station) =>
              setSelectedStation({
                naptanId: station.naptanId,
                name: station.name,
                lat: 0,
                lon: 0,
                modes: [],
                lines: [],
              })
            }
          />

          {/* Placeholder when no station is selected */}
          <BoardPanel>
            <div className="py-8 text-center">
              <AmberText variant="dim" size="sm" className="dot-matrix">
                SELECT A STATION TO VIEW LIVE DEPARTURES
              </AmberText>
            </div>
          </BoardPanel>
        </div>
      )}
    </div>
  );
}

/**
 * Home page wrapper.
 * Suspense boundary is required because useSearchParams
 * needs to be wrapped in Suspense in Next.js 15.
 */
export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-center pt-12">
          <AmberText variant="dim" size="sm" className="dot-matrix animate-blink">
            LOADING...
          </AmberText>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
