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

import { useState, useCallback, useEffect } from "react";
import {
  ArrowDownUp,
  Home,
  X,
  Star,
  Check,
  RefreshCw,
  Clock,
  Trash2,
} from "lucide-react";
import StationSearch from "@/components/shared/StationSearch";
import BoardPanel from "@/components/shared/BoardPanel";
import AmberText from "@/components/shared/AmberText";
import LoadingBoard from "@/components/shared/LoadingBoard";
import JourneyCard from "@/components/journey/JourneyCard";
import TimeSelector from "@/components/journey/TimeSelector";
import { useHomeStation } from "@/hooks/useHomeStation";
import { useSavedJourneys } from "@/hooks/useSavedJourneys";
import { useRecentJourneys } from "@/hooks/useRecentJourneys";
import type { Journey } from "@/lib/tfl-types";
import { cn, cleanStationName } from "@/lib/utils";

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

  /* Home station from localStorage */
  const { homeStation, setHomeStation, clearHomeStation } = useHomeStation();

  /* Saved journeys (Dexie) and recent-searches list (localStorage) */
  const {
    journeys: savedJourneys,
    saveJourney,
    removeJourney,
    isSaved,
  } = useSavedJourneys();
  const { recents, addRecent } = useRecentJourneys();

  /* Transient visual confirmation after saving the current journey */
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 1500);
    return () => clearTimeout(t);
  }, [justSaved]);

  /* Tracks whether the current FROM/TO pair is already in saved journeys */
  const [currentIsSaved, setCurrentIsSaved] = useState(false);
  useEffect(() => {
    if (!fromStation || !toStation) {
      setCurrentIsSaved(false);
      return;
    }
    let cancelled = false;
    isSaved(fromStation.naptanId, toStation.naptanId).then((v) => {
      if (!cancelled) setCurrentIsSaved(v);
    });
    return () => {
      cancelled = true;
    };
  }, [fromStation, toStation, isSaved, savedJourneys]);

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

      /* Record this search in the recent-journeys list so the user
         can jump back to it next time without re-typing. */
      if (data.journeys && data.journeys.length > 0 && fromStation && toStation) {
        addRecent({
          fromNaptanId: fromStation.naptanId,
          fromName: fromStation.name,
          fromLat: fromStation.lat,
          fromLon: fromStation.lon,
          toNaptanId: toStation.naptanId,
          toName: toStation.name,
          toLat: toStation.lat,
          toLon: toStation.lon,
        });
      }
    } catch (err) {
      console.error("Journey planning error:", err);
      setError("COULD NOT PLAN JOURNEY -- TRY AGAIN");
      setJourneys([]);
    } finally {
      setIsLoading(false);
    }
  }, [fromStation, toStation, timeIs, dateTime, addRecent]);

  /**
   * Fill the FROM input with the user's home station (no GPS required).
   * Complements the existing "DIRECTIONS HOME" button which uses GPS
   * to pick the nearest station. This is for the opposite direction —
   * "leaving from home" — which doesn't need GPS.
   */
  const handleFillFromHome = useCallback(() => {
    if (!homeStation) return;
    setFromStation({
      naptanId: homeStation.naptanId,
      name: homeStation.name,
      lat: homeStation.lat,
      lon: homeStation.lon,
    });
  }, [homeStation]);

  /**
   * Open a saved or recent journey — populates both FROM and TO.
   * Intentionally doesn't auto-plan so the user can still tweak time.
   */
  const openSavedPair = useCallback(
    (entry: {
      fromNaptanId: string;
      fromName: string;
      fromLat: number;
      fromLon: number;
      toNaptanId: string;
      toName: string;
      toLat: number;
      toLon: number;
    }) => {
      setFromStation({
        naptanId: entry.fromNaptanId,
        name: entry.fromName,
        lat: entry.fromLat,
        lon: entry.fromLon,
      });
      setToStation({
        naptanId: entry.toNaptanId,
        name: entry.toName,
        lat: entry.toLat,
        lon: entry.toLon,
      });
      setJourneys([]);
      setHasSearched(false);
      setError(null);
    },
    []
  );

  /** Save the current FROM/TO pair to saved journeys. */
  const handleSaveCurrentJourney = useCallback(async () => {
    if (!fromStation || !toStation) return;
    await saveJourney({
      fromNaptanId: fromStation.naptanId,
      fromName: fromStation.name,
      fromLat: fromStation.lat,
      fromLon: fromStation.lon,
      toNaptanId: toStation.naptanId,
      toName: toStation.name,
      toLat: toStation.lat,
      toLon: toStation.lon,
    });
    setJustSaved(true);
  }, [fromStation, toStation, saveJourney]);

  /**
   * Swap the From and To stations.
   */
  const handleSwap = () => {
    const temp = fromStation;
    setFromStation(toStation);
    setToStation(temp);
    /* Clear previous results since direction changed */
    setJourneys([]);
    setHasSearched(false);
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
          Tube
        </AmberText>
        <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mt-1">
          LONDON TRANSPORT
        </div>
      </div>

      {/*
       * Saved journeys.
       *
       * Rendered as a horizontal scroll strip (not a stacked list) so
       * up to 5 saved journeys are browsable in a single on-screen
       * row without pushing the main search form off the page. Each
       * chip uses cleanStationName() to strip "Underground Station"
       * / "Rail Station" / "DLR Station" suffixes — otherwise long
       * station pairs overflow horizontally even within a chip.
       *
       * Horizontal scroll uses snap-x for nicer touch UX.
       */}
      {savedJourneys.length > 0 && (
        <div className="space-y-1.5">
          <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase px-1">
            SAVED JOURNEYS
          </div>
          <div
            className="flex gap-2 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-1"
            style={{ scrollbarWidth: "none" }}
          >
            {savedJourneys.slice(0, 5).map((j) => (
              <div
                key={j.id}
                onClick={() => openSavedPair(j)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openSavedPair(j);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Open ${j.fromName} to ${j.toName}`}
                className="shrink-0 snap-start border border-board-border bg-surface p-2.5 cursor-pointer hover:border-amber-faint focus:border-amber-faint focus:outline-none transition-colors flex items-center gap-1.5 min-w-0"
              >
                <Star
                  size={11}
                  strokeWidth={1.5}
                  fill="currentColor"
                  className="text-amber shrink-0"
                />
                <span className="font-mono text-[11px] tracking-wider text-amber uppercase whitespace-nowrap">
                  {cleanStationName(j.fromName)} -&gt; {cleanStationName(j.toName)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeJourney(j.id);
                  }}
                  className="shrink-0 ml-1 p-1 text-amber-faint hover:text-red-500 transition-colors"
                  aria-label={`Remove ${j.fromName} to ${j.toName}`}
                >
                  <Trash2 size={11} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/*
       * Recent journeys (localStorage, capped at 5).
       *
       * Same horizontal scroll pattern as saved journeys so the
       * two lists read as parallel strips. Condensed names via
       * cleanStationName() to keep chips compact.
       */}
      {recents.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 px-1">
            <Clock
              size={10}
              strokeWidth={1.5}
              className="text-amber-faint shrink-0"
            />
            <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
              RECENT
            </span>
          </div>
          <div
            className="flex gap-2 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-1"
            style={{ scrollbarWidth: "none" }}
          >
            {recents.slice(0, 5).map((r, i) => (
              <button
                key={`${r.fromNaptanId}-${r.toNaptanId}-${i}`}
                onClick={() => openSavedPair(r)}
                className="shrink-0 snap-start border border-board-border bg-surface/60 px-2.5 py-1.5 text-left hover:border-amber-faint transition-colors"
                aria-label={`Re-run ${r.fromName} to ${r.toName}`}
              >
                <span className="font-mono text-[11px] tracking-wider text-amber-faint uppercase whitespace-nowrap">
                  {cleanStationName(r.fromName)} -&gt; {cleanStationName(r.toName)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---- Directions Home / Home station setup ---- */}
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
          {/* FROM HOME fills the FROM input without needing GPS — pairs
              nicely with "DIRECTIONS HOME" which does the opposite. */}
          <button
            onClick={handleFillFromHome}
            className="px-3 py-3 bg-surface border border-board-border text-amber-faint hover:text-amber hover:border-amber-faint transition-colors font-mono text-xs tracking-wider uppercase"
            aria-label={`Use ${homeStation.name} as departure`}
            title={`Use ${homeStation.name} as departure`}
          >
            FROM HOME
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
          <div>
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
                "transition-colors duration-200",
                "disabled:opacity-30"
              )}
              aria-label="Swap departure and destination"
            >
              <ArrowDownUp size={16} strokeWidth={1.5} />
            </button>
          </div>

          {/* To station */}
          <div>
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

      {/* ---- Error State — with a RETRY button ---- */}
      {error && !isLoading && (
        <BoardPanel>
          <div className="py-4 text-center space-y-3">
            <AmberText variant="dim" size="sm" className="dot-matrix">
              {error}
            </AmberText>
            <button
              onClick={planJourney}
              disabled={!fromStation || !toStation}
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-amber text-amber hover:bg-amber hover:text-board-bg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Retry planning journey"
            >
              <RefreshCw size={12} strokeWidth={1.5} />
              <span className="font-mono text-[10px] tracking-wider uppercase">
                RETRY
              </span>
            </button>
          </div>
        </BoardPanel>
      )}

      {/* ---- Journey Results ---- */}
      {!isLoading && journeys.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <AmberText variant="dim" size="xs" className="uppercase">
              {journeys.length} ROUTE{journeys.length !== 1 ? "S" : ""} FOUND
            </AmberText>
            {/* Save-journey button, shown once results land so the user
                has a natural "I use this often" moment to click it. */}
            {fromStation && toStation && (
              <button
                onClick={handleSaveCurrentJourney}
                disabled={currentIsSaved && !justSaved}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 border font-mono text-[10px] tracking-wider uppercase transition-all duration-200",
                  justSaved
                    ? "border-amber bg-amber text-board-bg amber-glow"
                    : currentIsSaved
                      ? "border-amber text-amber"
                      : "border-amber-faint text-amber-faint hover:border-amber hover:text-amber"
                )}
                aria-label={
                  currentIsSaved ? "Journey saved" : "Save this journey"
                }
              >
                {justSaved ? (
                  <>
                    <Check size={11} strokeWidth={2} />
                    SAVED!
                  </>
                ) : currentIsSaved ? (
                  <>
                    <Star size={11} strokeWidth={1.5} fill="currentColor" />
                    SAVED
                  </>
                ) : (
                  <>
                    <Star size={11} strokeWidth={1.5} />
                    SAVE JOURNEY
                  </>
                )}
              </button>
            )}
          </div>

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
