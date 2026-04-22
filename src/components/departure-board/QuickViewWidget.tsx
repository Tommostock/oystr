/**
 * QuickViewWidget.tsx — Mini departure summaries for saved stations
 *
 * Shows a compact view of the next 2 arrivals for each saved station
 * on the home page. Users can see at a glance when the next train
 * is coming at their favourite stations without needing to tap in.
 *
 * Each card is tappable to load the full departure board.
 *
 * Usage:
 *   <QuickViewWidget onStationSelect={(station) => setSelected(station)} />
 */

"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { TrainFront } from "lucide-react";
import { useFavourites } from "@/hooks/useFavourites";
import { useSavedRailStations } from "@/hooks/useSavedRailStations";
import { useSavedAirports } from "@/hooks/useSavedAirports";
import { useRailDepartures } from "@/hooks/useRailDepartures";
import { useFlightDepartures } from "@/hooks/useFlightDepartures";
import { useArrivals } from "@/hooks/useArrivals";
import { LINE_COLOURS } from "@/lib/constants";
import { cn, cleanStationName, isBusStop } from "@/lib/utils";
import { useCountdown } from "@/hooks/useCountdown";
import {
  db,
  type SavedRailStation,
  type SavedAirport,
} from "@/lib/db";
import { Plane } from "lucide-react";

interface QuickViewWidgetProps {
  /** Called when a station card is tapped */
  onStationSelect: (station: { naptanId: string; name: string }) => void;
}

/**
 * Single saved station card showing next 2 arrivals.
 */
function QuickViewCard({
  naptanId,
  name,
  lines,
  stopLetter,
  modes,
  onSelect,
}: {
  naptanId: string;
  name: string;
  lines: string[];
  stopLetter?: string;
  modes?: string[];
  onSelect: () => void;
}) {
  /*
   * Use the strict isBusStop check — multi-modal stations like London City
   * Airport (DLR + nearby bus) should show their line colour dot, not "BUS".
   */
  const isBus = isBusStop(naptanId, modes);
  const { arrivals, isLoading } = useArrivals(naptanId);
  /* Show the next 2 arrivals */
  const next2 = arrivals.slice(0, 2);

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left border border-board-border bg-surface",
        "p-3 transition-colors duration-200",
        "hover:border-amber-faint cursor-pointer"
      )}
    >
      {/* Station name with line dots or bus stop letter */}
      <div className="flex items-center gap-2 mb-2">
        {isBus ? (
          stopLetter ? (
            <span className="shrink-0 w-5 h-5 flex items-center justify-center border border-amber text-amber text-[10px] font-mono">
              {stopLetter}
            </span>
          ) : (
            <span className="shrink-0 text-amber text-[10px] font-mono">BUS</span>
          )
        ) : (
          <div className="flex gap-0.5">
            {lines.slice(0, 3).map((lineId) => (
              <span
                key={lineId}
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: LINE_COLOURS[lineId] || "#FF9500" }}
              />
            ))}
          </div>
        )}
        <span className="font-mono text-xs tracking-wider text-amber uppercase truncate">
          {name
            .replace(/\s*Underground Station$/i, "")
            .replace(/\s*Station$/i, "")}
        </span>
      </div>

      {/* Next arrivals */}
      {isLoading && next2.length === 0 ? (
        <div className="font-mono text-xs tracking-wider text-amber-faint animate-pulse">
          LOADING...
        </div>
      ) : next2.length === 0 ? (
        <div className="font-mono text-xs tracking-wider text-amber-faint">
          NO DATA
        </div>
      ) : (
        <div className="space-y-1">
          {next2.map((arrival, i) => (
            <QuickArrivalRow
              key={`${arrival.vehicleId}-${i}`}
              destination={
                (arrival.destinationName || "")
                  .replace(/\s*Underground Station$/i, "")
                  .replace(/\s*DLR Station$/i, "")
                  .replace(/\s*Station$/i, "")
                  .replace(/\s*\(London\)/i, "")
              }
              timeToStation={arrival.timeToStation}
              expectedArrival={arrival.expectedArrival}
              lineColour={LINE_COLOURS[arrival.lineId]}
              routeNumber={arrival.modeName === "bus" ? arrival.lineName : undefined}
            />
          ))}
        </div>
      )}
    </button>
  );
}

/**
 * Saved National Rail STATION card — shows the station name + CRS
 * code with its next 2 live departures (no TO filter — just the
 * station's raw board). Tapping opens /rail/station/[crs] so the
 * user can see the full board and tap through to calling points.
 */
function QuickRailStationCard({
  station,
  onOpen,
}: {
  station: SavedRailStation;
  onOpen: (s: SavedRailStation) => void;
}) {
  const { departures, isLoading, notConfigured } = useRailDepartures({
    fromCrs: station.crs,
    numRows: 2,
  });
  const nextTwo = departures.slice(0, 2);

  return (
    <button
      onClick={() => onOpen(station)}
      className={cn(
        "w-full text-left border border-board-border bg-surface",
        "p-3 transition-colors duration-200",
        "hover:border-amber-faint cursor-pointer"
      )}
      aria-label={`Open ${station.name} rail station`}
    >
      <div className="flex items-center gap-1.5 mb-2 min-w-0">
        <TrainFront
          size={12}
          strokeWidth={1.5}
          className="shrink-0 text-amber"
        />
        <span className="font-mono text-xs tracking-wider text-amber uppercase truncate flex-1">
          {cleanStationName(station.name)}
        </span>
        <span className="shrink-0 font-mono text-[10px] tracking-wider text-amber-faint border border-board-border px-1">
          {station.crs}
        </span>
      </div>

      {notConfigured ? (
        <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
          RAIL UNAVAILABLE
        </div>
      ) : isLoading && nextTwo.length === 0 ? (
        <div className="font-mono text-xs tracking-wider text-amber-faint animate-pulse">
          LOADING...
        </div>
      ) : nextTwo.length === 0 ? (
        <div className="font-mono text-xs tracking-wider text-amber-faint">
          NO DEPARTURES
        </div>
      ) : (
        <div className="space-y-1">
          {nextTwo.map((dep, i) => {
            const status = dep.cancelled
              ? { label: "CXL", colour: "#ff3b30" }
              : dep.estimatedDeparture === "On time"
                ? { label: "ON TIME", colour: "#34c759" }
                : dep.delayed && dep.estimatedDeparture
                  ? {
                      label: `EXP ${dep.estimatedDeparture}`,
                      colour: "#ff9500",
                    }
                  : {
                      label: (dep.estimatedDeparture || "").toUpperCase(),
                      colour: "#ff9500",
                    };
            return (
              <div
                key={`${dep.serviceId}-${i}`}
                className="flex items-center gap-1.5 text-xs font-mono tracking-wider"
              >
                <span className="text-amber shrink-0">
                  {dep.scheduledDeparture}
                </span>
                <span className="text-amber-faint truncate flex-1 uppercase">
                  {cleanStationName(dep.destination)}
                </span>
                <span
                  className="shrink-0 text-[10px]"
                  style={{ color: status.colour }}
                >
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </button>
  );
}

/**
 * Saved AIRPORT card — shows the airport name + IATA with its next 2
 * live departures. Tapping opens /flights/airport/[iata].
 *
 * Gracefully handles the pre-API-key state: the underlying
 * useFlightDepartures hook surfaces a notConfigured flag, which the
 * card renders as "AWAITING FLIGHTS" so pinning an airport still
 * works even before the provider is wired up.
 */
function QuickAirportCard({
  airport,
  onOpen,
}: {
  airport: SavedAirport;
  onOpen: (a: SavedAirport) => void;
}) {
  const { departures, isLoading, notConfigured } = useFlightDepartures({
    iata: airport.iata,
    numRows: 2,
  });
  const nextTwo = departures.slice(0, 2);

  return (
    <button
      onClick={() => onOpen(airport)}
      className={cn(
        "w-full text-left border border-board-border bg-surface",
        "p-3 transition-colors duration-200",
        "hover:border-amber-faint cursor-pointer"
      )}
      aria-label={`Open ${airport.name} airport`}
    >
      <div className="flex items-center gap-1.5 mb-2 min-w-0">
        <Plane
          size={12}
          strokeWidth={1.5}
          className="shrink-0 text-amber"
        />
        <span className="font-mono text-xs tracking-wider text-amber uppercase truncate flex-1">
          {airport.city || airport.name}
        </span>
        <span className="shrink-0 font-mono text-[10px] tracking-wider text-amber-faint border border-board-border px-1">
          {airport.iata}
        </span>
      </div>

      {notConfigured ? (
        <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
          AWAITING FLIGHTS
        </div>
      ) : isLoading && nextTwo.length === 0 ? (
        <div className="font-mono text-xs tracking-wider text-amber-faint animate-pulse">
          LOADING...
        </div>
      ) : nextTwo.length === 0 ? (
        <div className="font-mono text-xs tracking-wider text-amber-faint">
          NO DEPARTURES
        </div>
      ) : (
        <div className="space-y-1">
          {nextTwo.map((dep, i) => {
            const status = dep.cancelled
              ? { label: "CXL", colour: "#ff3b30" }
              : dep.status === "on-time" || dep.status === "boarding"
                ? { label: dep.status === "boarding" ? "BOARD" : "ON TIME", colour: "#34c759" }
                : dep.status === "delayed" && dep.estimatedDeparture
                  ? {
                      label: `EXP ${dep.estimatedDeparture}`,
                      colour: "#ff9500",
                    }
                  : dep.status === "departed"
                    ? { label: "DEP", colour: "#cc7700" }
                    : { label: "SCHED", colour: "#ff9500" };
            return (
              <div
                key={`${dep.id}-${i}`}
                className="flex items-center gap-1.5 text-xs font-mono tracking-wider"
              >
                <span className="text-amber shrink-0">
                  {dep.scheduledDeparture}
                </span>
                <span className="text-amber-faint truncate flex-1 uppercase">
                  {dep.destination}
                </span>
                <span
                  className="shrink-0 text-[10px]"
                  style={{ color: status.colour }}
                >
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </button>
  );
}

/**
 * Compact arrival row for the quick-view widget.
 */
function QuickArrivalRow({
  destination,
  timeToStation,
  expectedArrival,
  lineColour,
  routeNumber,
}: {
  destination: string;
  timeToStation: number;
  expectedArrival?: string;
  lineColour?: string;
  routeNumber?: string;
}) {
  const liveSeconds = useCountdown(expectedArrival, timeToStation);
  const isDue = liveSeconds <= 30;
  const timeText = isDue ? "DUE" : `${Math.floor(liveSeconds / 60)}m`;

  return (
    <div className="flex items-center gap-2 text-xs font-mono tracking-wider">
      {routeNumber ? (
        <span className="text-amber border border-amber-faint px-1 text-[10px]">
          {routeNumber}
        </span>
      ) : lineColour ? (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: lineColour }}
        />
      ) : null}
      <span className="text-amber truncate flex-1 uppercase">
        {destination}
      </span>
      <span
        className={cn(
          "shrink-0",
          isDue ? "text-amber amber-glow-strong" : "text-amber-dim"
        )}
      >
        {timeText}
      </span>
    </div>
  );
}

export default function QuickViewWidget({
  onStationSelect,
}: QuickViewWidgetProps) {
  const { favourites } = useFavourites();
  const { stations: railStations } = useSavedRailStations();
  const { airports: savedAirports } = useSavedAirports();
  const router = useRouter();

  /*
   * Enrich bus stops missing their stop letter.
   * Searches TfL for each bus stop and backfills stopLetter/indicator
   * into IndexedDB. Only runs once per session (ref guard).
   * The live query in useFavourites auto-updates the UI when DB changes.
   */
  const busEnrichRef = useRef(false);
  useEffect(() => {
    const busStopsNeedingEnrichment = favourites.filter(
      (s) =>
        (s.naptanId.startsWith("490") || s.modes?.includes("bus")) &&
        (!s.stopLetter || s.lines.length === 0)
    );
    if (busStopsNeedingEnrichment.length === 0 || busEnrichRef.current) return;

    busEnrichRef.current = true;

    async function enrichBusStops() {
      for (const station of busStopsNeedingEnrichment) {
        try {
          const resp = await fetch(
            `/api/tfl/search?query=${encodeURIComponent(
              cleanStationName(station.name)
            )}`
          );
          if (!resp.ok) continue;

          const results = await resp.json();
          const match = results.find(
            (r: { naptanId: string }) => r.naptanId === station.naptanId
          );

          if (match) {
            const lineIds = (match.lines || []).map(
              (l: { id: string } | string) => typeof l === "string" ? l : l.id
            );
            await db.favourites.update(station.naptanId, {
              stopLetter: match.stopLetter || station.stopLetter || undefined,
              indicator: match.indicator || station.indicator || undefined,
              modes: match.modes?.length ? match.modes : ["bus"],
              lines: lineIds.length > 0 ? lineIds : station.lines,
            });
          }
        } catch {
          /* Silently fail */
        }
      }
      busEnrichRef.current = false;
    }

    enrichBusStops();
  }, [favourites]);

  /*
   * Enrich tube / DLR / rail stations missing their line IDs.
   *
   * Moved here from the old Saved page so saved non-bus stations
   * continue to pick up their line-colour dots after that page was
   * removed. Runs at most once per mount and skips anything that
   * already has lines or is a bus stop (handled above).
   */
  const stationEnrichRef = useRef(false);
  useEffect(() => {
    const stationsWithoutLines = favourites.filter(
      (s) => s.lines.length === 0 && !isBusStop(s.naptanId, s.modes)
    );
    if (stationsWithoutLines.length === 0 || stationEnrichRef.current) return;
    stationEnrichRef.current = true;

    async function enrichStations() {
      for (const station of stationsWithoutLines) {
        try {
          const directResp = await fetch(
            `/api/tfl/disruptions?stopId=${station.naptanId}`
          );
          if (directResp.ok) {
            const directData = await directResp.json();
            if (directData.lines?.length > 0) {
              const lineIds = directData.lines.map(
                (l: { id: string } | string) =>
                  typeof l === "string" ? l : l.id
              );
              await db.favourites.update(station.naptanId, { lines: lineIds });
              continue;
            }
          }
          const cleanName = cleanStationName(station.name);
          const searchResp = await fetch(
            `/api/tfl/search?query=${encodeURIComponent(cleanName)}`
          );
          if (!searchResp.ok) continue;
          const results = await searchResp.json();
          const match =
            results.find(
              (r: { naptanId: string }) => r.naptanId === station.naptanId
            ) ||
            results.find((r: { name: string }) =>
              r.name.toLowerCase().includes(cleanName.toLowerCase())
            ) ||
            results[0];
          if (match?.lines?.length > 0) {
            const lineIds = match.lines.map(
              (l: { id: string } | string) =>
                typeof l === "string" ? l : l.id
            );
            await db.favourites.update(station.naptanId, { lines: lineIds });
          }
        } catch {
          /* Silently fail — line dots are not critical */
        }
      }
      stationEnrichRef.current = false;
    }
    enrichStations();
  }, [favourites]);

  /* Open a saved rail station's focused page. */
  const handleRailStationOpen = (s: SavedRailStation) => {
    router.push(`/rail/station/${encodeURIComponent(s.crs)}`);
  };

  /* Open a saved airport's focused page. */
  const handleAirportOpen = (a: SavedAirport) => {
    router.push(`/flights/airport/${encodeURIComponent(a.iata)}`);
  };

  const hasAnySaved =
    favourites.length > 0 ||
    railStations.length > 0 ||
    savedAirports.length > 0;
  if (!hasAnySaved) return null;

  const sortedFavourites = [...favourites].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-2">
      <div className="font-mono text-xs tracking-wider text-amber-faint uppercase px-1">
        SAVED STATIONS
      </div>
      <div className="grid grid-cols-2 gap-2">
        {sortedFavourites.map((station) => (
          <QuickViewCard
            key={station.naptanId}
            naptanId={station.naptanId}
            name={station.name}
            lines={station.lines}
            stopLetter={station.stopLetter}
            modes={station.modes}
            onSelect={() =>
              onStationSelect({
                naptanId: station.naptanId,
                name: station.name,
              })
            }
          />
        ))}
        {railStations.map((station) => (
          <QuickRailStationCard
            key={`rail-station-${station.crs}`}
            station={station}
            onOpen={handleRailStationOpen}
          />
        ))}
        {savedAirports.map((airport) => (
          <QuickAirportCard
            key={`airport-${airport.iata}`}
            airport={airport}
            onOpen={handleAirportOpen}
          />
        ))}
      </div>
    </div>
  );
}
