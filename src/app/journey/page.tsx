/**
 * journey/page.tsx — Journey Planner page
 *
 * Allows users to plan journeys between two stations.
 *
 * Features:
 *   - Two station search inputs (From / To)
 *   - Swap button to reverse the journey
 *   - Time selector (Leave now / Depart at / Arrive by)
 *   - Multiple journey results as expandable cards
 *   - Coloured line segments showing each leg
 *   - Save frequent journeys to Dexie.js
 */

"use client";

import { useState, useCallback, useRef } from "react";
import { ArrowDownUp, Home, X } from "lucide-react";
import StationSearch from "@/components/shared/StationSearch";
import BoardPanel from "@/components/shared/BoardPanel";
import AmberText from "@/components/shared/AmberText";
import LoadingBoard from "@/components/shared/LoadingBoard";
import JourneyCard from "@/components/journey/JourneyCard";
import TimeSelector from "@/components/journey/TimeSelector";
import AskOystr from "@/components/journey/AskOystr";
import { useHomeStation } from "@/hooks/useHomeStation";
import type { Journey } from "@/lib/tfl-types";
import { cn } from "@/lib/utils";

/* ========================================
 * TYPES
 * ======================================== */

/** Station info needed for journey planning */
interface StationInfo {
  naptanId: string;
  name: string;
  lat: number;
  lon: number;
}

export default function JourneyPage() {
  /* ---- State ---- */
  const [fromStation, setFromStation] = useState<StationInfo | null>(null);
  const [toStation, setToStation] = useState<StationInfo | null>(null);
  const [timeIs, setTimeIs] = useState<"Departing" | "Arriving">("Departing");
  const [dateTime, setDateTime] = useState<string | null>(null);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  /* Home station from localStorage */
  const { homeStation, setHomeStation, clearHomeStation } = useHomeStation();

  /* Swap animation state */
  const [isSwapping, setIsSwapping] = useState(false);
  const swapTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Plan a journey between the two selected stations.
   */
  const planJourney = useCallback(async () => {
    if (!fromStation || !toStation) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      /*
       * Resolve station IDs for the Journey API.
       *
       * Hub IDs (HUBLST, HUBBAN, etc.) cause the Journey API to
       * route to street locations with walking legs. We resolve
       * them to tube/rail station naptan IDs via our resolve API.
       * Regular naptan IDs (940GZZLU...) work directly.
       */
      const resolveId = async (id: string): Promise<string> => {
        if (!id.startsWith("HUB")) return id;
        try {
          const resp = await fetch(`/api/tfl/resolve-hub?hubId=${id}`);
          if (resp.ok) {
            const data = await resp.json();
            if (data.naptanId) return data.naptanId;
          }
        } catch { /* fall through */ }
        return id;
      };

      const fromValue = await resolveId(fromStation.naptanId);
      const toValue = await resolveId(toStation.naptanId);

      const params = new URLSearchParams({
        from: fromValue,
        to: toValue,
        timeIs: timeIs,
      });

      if (dateTime) {
        params.set("dateTime", dateTime);
      }

      const response = await fetch(`/api/tfl/journey?${params}`);

      if (!response.ok) {
        throw new Error("Failed to plan journey");
      }

      const data = await response.json();
      setJourneys(data.journeys || []);
    } catch (err) {
      console.error("Journey planning error:", err);
      setError("COULD NOT PLAN JOURNEY -- TRY AGAIN");
      setJourneys([]);
    } finally {
      setIsLoading(false);
    }
  }, [fromStation, toStation, timeIs, dateTime]);

  /**
   * Swap the From and To stations with a slide animation.
   */
  const handleSwap = () => {
    /* Trigger animation */
    setIsSwapping(true);

    /* Swap data halfway through the animation */
    if (swapTimerRef.current) clearTimeout(swapTimerRef.current);
    swapTimerRef.current = setTimeout(() => {
      const temp = fromStation;
      setFromStation(toStation);
      setToStation(temp);
      /* Clear previous results since direction changed */
      setJourneys([]);
      setHasSearched(false);
    }, 200);

    /* Remove animation class after it completes */
    setTimeout(() => setIsSwapping(false), 400);
  };

  /**
   * Handle time selection changes.
   */
  const handleTimeChange = (
    newTimeIs: "Departing" | "Arriving",
    newDateTime: string | null
  ) => {
    setTimeIs(newTimeIs);
    setDateTime(newDateTime);
  };

  /**
   * "Directions Home" — get current location and plan a journey home.
   * Uses GPS to find the nearest station, sets it as "from",
   * sets home station as "to", and auto-plans the journey.
   */
  const handleDirectionsHome = useCallback(async () => {
    if (!homeStation) return;
    if (!navigator.geolocation) {
      setError("GEOLOCATION NOT SUPPORTED");
      return;
    }

    setIsLocating(true);
    setError(null);

    try {
      /* Get current position */
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

      /* Find the nearest station */
      const nearbyResp = await fetch(
        `/api/tfl/nearby?lat=${latitude}&lon=${longitude}&radius=1600`
      );

      if (!nearbyResp.ok) throw new Error("Failed to find nearby stations");

      const nearbyStations = await nearbyResp.json();

      /* Pick the first non-bus station, or the first one */
      const nearest = nearbyStations.find(
        (s: { modes: string[] }) => !s.modes.every((m: string) => m === "bus")
      ) || nearbyStations[0];

      if (!nearest) {
        setError("NO STATIONS NEARBY");
        return;
      }

      /* Set from = nearest station, to = home */
      const from: StationInfo = {
        naptanId: nearest.naptanId,
        name: nearest.name,
        lat: nearest.lat,
        lon: nearest.lon,
      };
      const to: StationInfo = {
        naptanId: homeStation.naptanId,
        name: homeStation.name,
        lat: homeStation.lat,
        lon: homeStation.lon,
      };

      setFromStation(from);
      setToStation(to);

      /* Auto-plan the journey */
      setIsLoading(true);
      setHasSearched(true);

      /* Resolve hub IDs to tube station IDs */
      const resolveHub = async (id: string): Promise<string> => {
        if (!id.startsWith("HUB")) return id;
        try {
          const r = await fetch(`/api/tfl/resolve-hub?hubId=${id}`);
          if (r.ok) { const d = await r.json(); if (d.naptanId) return d.naptanId; }
        } catch { /* fall through */ }
        return id;
      };
      const fromValue = await resolveHub(from.naptanId);
      const toValue = await resolveHub(to.naptanId);

      const params = new URLSearchParams({
        from: fromValue,
        to: toValue,
        timeIs: "Departing",
      });

      const response = await fetch(`/api/tfl/journey?${params}`);
      if (!response.ok) throw new Error("Failed to plan journey");

      const data = await response.json();
      setJourneys(data.journeys || []);
    } catch (err) {
      console.error("Directions home error:", err);
      setError("COULD NOT GET DIRECTIONS HOME -- TRY AGAIN");
      setJourneys([]);
    } finally {
      setIsLocating(false);
      setIsLoading(false);
    }
  }, [homeStation]);

  return (
    <div className="p-4 space-y-4">
      {/* ---- Page Header ---- */}
      <div className="text-center pt-4 pb-2">
        <AmberText as="h1" size="lg" uppercase className="dot-matrix">
          Journey Planner
        </AmberText>
      </div>

      {/* ---- AI-Powered Natural Language Input ---- */}
      <AskOystr
        onJourneysReceived={(results) => {
          setJourneys(results);
          setHasSearched(true);
          setError(null);
        }}
        onSummaryReceived={(summary) => setAiSummary(summary)}
        onClear={() => {
          setJourneys([]);
          setAiSummary(null);
          setHasSearched(false);
          setError(null);
        }}
      />

      {/* ---- Directions Home ---- */}
      {homeStation ? (
        <div className="flex gap-2">
          <button
            onClick={handleDirectionsHome}
            disabled={isLocating || isLoading}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3",
              "bg-surface border border-amber",
              "font-mono text-sm tracking-wider text-amber uppercase",
              "hover:bg-amber/10 transition-colors duration-200",
              "disabled:opacity-40 disabled:border-board-border",
              "amber-glow"
            )}
          >
            <Home size={16} strokeWidth={1.5} />
            <span>{isLocating ? "LOCATING..." : "DIRECTIONS HOME"}</span>
          </button>
          <button
            onClick={clearHomeStation}
            className="p-3 bg-surface border border-board-border text-amber-faint hover:text-error hover:border-error/50 transition-colors"
            aria-label="Remove home station"
            title={`Home: ${homeStation.name}`}
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
      ) : (
        <div className="border border-board-border bg-surface p-3">
          <div className="font-mono text-xs tracking-wider text-amber-faint mb-2 uppercase">
            SET YOUR HOME STATION FOR ONE-TAP DIRECTIONS
          </div>
          <StationSearch
            onSelect={(station) =>
              setHomeStation({
                naptanId: station.naptanId,
                name: station.name,
                lat: station.lat,
                lon: station.lon,
              })
            }
            placeholder="Search for your home station..."
          />
        </div>
      )}

      {/* ---- From / To Search Inputs ---- */}
      <BoardPanel>
        <div className="space-y-3">
          {/* From station */}
          <div className={isSwapping ? "swap-animate-down" : ""}>
            <label className="block font-mono text-xs tracking-wider text-amber-faint mb-1 uppercase">
              From
            </label>
            <StationSearch
              onSelect={(station) =>
                setFromStation({
                  naptanId: station.naptanId,
                  name: station.name,
                  lat: station.lat,
                  lon: station.lon,
                })
              }
              value={fromStation?.name || ""}
              placeholder="Departure station..."
            />
          </div>

          {/* Swap button */}
          <div className="flex justify-center">
            <button
              onClick={handleSwap}
              disabled={!fromStation && !toStation}
              className={cn(
                "p-2 border border-board-border",
                "text-amber-faint hover:text-amber hover:border-amber-faint",
                "transition-all duration-200",
                "disabled:opacity-30",
                isSwapping && "rotate-180 text-amber border-amber-faint"
              )}
              aria-label="Swap departure and destination"
            >
              <ArrowDownUp size={16} strokeWidth={1.5} />
            </button>
          </div>

          {/* To station */}
          <div className={isSwapping ? "swap-animate-up" : ""}>
            <label className="block font-mono text-xs tracking-wider text-amber-faint mb-1 uppercase">
              To
            </label>
            <StationSearch
              onSelect={(station) =>
                setToStation({
                  naptanId: station.naptanId,
                  name: station.name,
                  lat: station.lat,
                  lon: station.lon,
                })
              }
              value={toStation?.name || ""}
              placeholder="Destination station..."
            />
          </div>
        </div>
      </BoardPanel>

      {/* ---- Time Selector ---- */}
      <BoardPanel>
        <TimeSelector onTimeChange={handleTimeChange} />
      </BoardPanel>

      {/* ---- Plan Journey Button ---- */}
      <button
        onClick={planJourney}
        disabled={!fromStation || !toStation || isLoading}
        className={cn(
          "w-full py-3 px-4",
          "bg-surface border border-amber",
          "font-mono text-sm tracking-widest text-amber uppercase",
          "hover:bg-amber/10 transition-colors duration-200",
          "disabled:opacity-30 disabled:border-board-border disabled:hover:bg-transparent",
          "amber-glow"
        )}
      >
        {isLoading ? "PLANNING..." : "PLAN JOURNEY"}
      </button>

      {/* ---- Loading State ---- */}
      {isLoading && (
        <BoardPanel>
          <LoadingBoard message="FINDING ROUTES..." />
        </BoardPanel>
      )}

      {/* ---- Error State ---- */}
      {error && !isLoading && (
        <BoardPanel>
          <div className="py-4 text-center">
            <AmberText variant="dim" size="sm" className="dot-matrix">
              {error}
            </AmberText>
          </div>
        </BoardPanel>
      )}

      {/* ---- AI Summary ---- */}
      {aiSummary && !isLoading && (
        <BoardPanel>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <AmberText size="sm" className="leading-relaxed">
                {aiSummary}
              </AmberText>
            </div>
          </div>
        </BoardPanel>
      )}

      {/* ---- Journey Results ---- */}
      {!isLoading && journeys.length > 0 && (
        <div className="space-y-3">
          <AmberText variant="dim" size="xs" className="uppercase">
            {journeys.length} ROUTE{journeys.length !== 1 ? "S" : ""} FOUND
          </AmberText>

          {journeys.map((journey, index) => (
            <JourneyCard key={index} journey={journey} index={index} />
          ))}
        </div>
      )}

      {/* ---- No Results State ---- */}
      {!isLoading && hasSearched && journeys.length === 0 && !error && (
        <BoardPanel>
          <div className="py-4 text-center">
            <AmberText variant="dim" size="sm" className="dot-matrix">
              NO ROUTES FOUND
            </AmberText>
          </div>
        </BoardPanel>
      )}
    </div>
  );
}
