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

import { useState, useCallback } from "react";
import { ArrowDownUp } from "lucide-react";
import StationSearch from "@/components/shared/StationSearch";
import BoardPanel from "@/components/shared/BoardPanel";
import AmberText from "@/components/shared/AmberText";
import LoadingBoard from "@/components/shared/LoadingBoard";
import JourneyCard from "@/components/journey/JourneyCard";
import TimeSelector from "@/components/journey/TimeSelector";
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
       * Build the API URL.
       *
       * Use the station's naptanId when available — this tells TfL the
       * journey starts/ends AT the station, so it won't add unnecessary
       * walking legs from a nearby street address.
       *
       * Only fall back to lat,lon coordinates if there's no naptanId
       * (which shouldn't happen, but just in case).
       */
      /*
       * For hub IDs (HUBLST, HUBBAN, etc.), use lat,lon coordinates
       * instead of the ID. The Journey API returns 300 disambiguation
       * errors for hub IDs but handles coordinates correctly.
       * Regular naptan IDs (940GZZLU...) work fine directly.
       */
      const fromValue = fromStation.naptanId.startsWith("HUB")
        ? `${fromStation.lat},${fromStation.lon}`
        : fromStation.naptanId;
      const toValue = toStation.naptanId.startsWith("HUB")
        ? `${toStation.lat},${toStation.lon}`
        : toStation.naptanId;

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

  return (
    <div className="p-4 space-y-4">
      {/* ---- Page Header ---- */}
      <div className="text-center pt-4 pb-2">
        <AmberText as="h1" size="lg" uppercase className="dot-matrix">
          Journey Planner
        </AmberText>
      </div>

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
