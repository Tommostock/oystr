/**
 * saved/page.tsx — Saved Stations page
 *
 * Shows all of the user's saved favourites, split across three tabs:
 *   - TUBE: tube/rail/DLR/Overground/Elizabeth stations
 *   - BUS : saved bus stops
 *   - RAIL: saved National Rail routes (from -> to pairs)
 *
 * Tapping a TUBE or BUS entry navigates to the departure board for
 * that station. Tapping a RAIL entry navigates to the Rail tab
 * pre-filled with that route's FROM and TO stations.
 *
 * All data is stored in IndexedDB via Dexie.js.
 */

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Trash2, Bus, Train, TrainFront, ArrowRight } from "lucide-react";
import { useFavourites } from "@/hooks/useFavourites";
import { useSavedRailJourneys } from "@/hooks/useSavedRailJourneys";
import { db } from "@/lib/db";
import { LINE_COLOURS, LINE_NAMES } from "@/lib/constants";
import BoardPanel from "@/components/shared/BoardPanel";
import AmberText from "@/components/shared/AmberText";
import { cn, cleanStationName, isBusStop } from "@/lib/utils";

type SavedTab = "tube" | "bus" | "rail";

const TAB_OPTIONS: { id: SavedTab; label: string; icon: React.ElementType }[] = [
  { id: "tube", label: "TUBE", icon: Train },
  { id: "bus", label: "BUS", icon: Bus },
  { id: "rail", label: "RAIL", icon: TrainFront },
];

export default function SavedPage() {
  const { favourites, removeFavourite } = useFavourites();
  const { journeys: railJourneys, removeJourney: removeRailJourney } =
    useSavedRailJourneys();
  const router = useRouter();

  /** Which tab is currently active. Defaults to TUBE for familiarity. */
  const [activeTab, setActiveTab] = useState<SavedTab>("tube");

  /* ---- Existing enrichment logic (unchanged) ---- */
  const enrichingRef = React.useRef(false);
  useEffect(() => {
    const stationsWithoutLines = favourites.filter(
      (s) => s.lines.length === 0 && !isBusStop(s.naptanId, s.modes)
    );
    if (stationsWithoutLines.length === 0 || enrichingRef.current) return;
    enrichingRef.current = true;

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
      enrichingRef.current = false;
    }
    enrichStations();
  }, [favourites]);

  const busEnrichRef = React.useRef(false);
  useEffect(() => {
    const busStopsNeedingEnrichment = favourites.filter(
      (s) =>
        isBusStop(s.naptanId, s.modes) && (!s.stopLetter || s.lines.length === 0)
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
              (l: { id: string } | string) =>
                typeof l === "string" ? l : l.id
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

  /* ---- Filter favourites for tube and bus tabs ---- */
  const tubeFavourites = favourites
    .filter((s) => !isBusStop(s.naptanId, s.modes))
    .sort((a, b) => a.name.localeCompare(b.name));
  const busFavourites = favourites
    .filter((s) => isBusStop(s.naptanId, s.modes))
    .sort((a, b) => a.name.localeCompare(b.name));

  /* ---- Per-tab counts (shown on the toggle chips) ---- */
  const counts: Record<SavedTab, number> = {
    tube: tubeFavourites.length,
    bus: busFavourites.length,
    rail: railJourneys.length,
  };

  /* ---- Handlers ---- */
  const handleStationClick = (naptanId: string, name: string) => {
    router.push(`/?stopId=${naptanId}&name=${encodeURIComponent(name)}`);
  };

  const handleRemove = async (e: React.MouseEvent, naptanId: string) => {
    e.stopPropagation();
    await removeFavourite(naptanId);
  };

  const handleRailClick = () => {
    /* Navigate to the rail tab. Saved rail routes appear there
       natively — tapping them on the rail tab loads the board. */
    router.push("/rail");
  };

  const handleRailRemove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await removeRailJourney(id);
  };

  /* ---- Empty-state copy per tab ---- */
  const emptyCopy: Record<SavedTab, { title: string; body: React.ReactNode }> = {
    tube: {
      title: "NO SAVED STATIONS",
      body: (
        <>
          SEARCH FOR A TUBE, DLR, OVERGROUND,
          <br />
          OR RAIL STATION AND TAP THE STAR TO
          <br />
          SAVE IT HERE
        </>
      ),
    },
    bus: {
      title: "NO SAVED BUS STOPS",
      body: (
        <>
          SEARCH FOR A BUS STOP AND TAP
          <br />
          THE STAR TO SAVE IT HERE
        </>
      ),
    },
    rail: {
      title: "NO SAVED RAIL ROUTES",
      body: (
        <>
          OPEN THE RAIL TAB, PICK FROM AND TO
          <br />
          STATIONS, THEN TAP SAVE ROUTE
        </>
      ),
    },
  };

  const totalSaved =
    favourites.length + railJourneys.length;

  return (
    <div className="p-4 space-y-4">
      {/* ---- Page Header ---- */}
      <div className="text-center pt-4 pb-2">
        <AmberText as="h1" size="lg" uppercase className="dot-matrix">
          Saved Stations
        </AmberText>
      </div>

      {/* ---- Tab toggle: TUBE | BUS | RAIL ---- */}
      <div className="flex gap-1.5">
        {TAB_OPTIONS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const count = counts[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 border transition-colors",
                isActive
                  ? "border-amber text-amber bg-amber/10"
                  : "border-board-border text-amber-faint hover:border-amber-faint hover:text-amber"
              )}
              aria-pressed={isActive}
              aria-label={`Show saved ${tab.label.toLowerCase()} entries`}
            >
              <Icon size={14} strokeWidth={1.5} />
              <span className="font-mono text-[11px] tracking-wider uppercase">
                {tab.label}
              </span>
              {count > 0 && (
                <span className="font-mono text-[10px] tracking-wider text-amber-faint">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ---- Empty state (shown when the currently-active tab is empty) ---- */}
      {counts[activeTab] === 0 && (
        <BoardPanel>
          <div className="py-8 text-center space-y-3">
            <Star
              size={32}
              strokeWidth={1}
              className="mx-auto text-amber-faint"
            />
            <AmberText variant="dim" size="sm" className="dot-matrix">
              {emptyCopy[activeTab].title}
            </AmberText>
            <p className="font-mono text-xs tracking-wider text-amber-faint">
              {emptyCopy[activeTab].body}
            </p>
          </div>
        </BoardPanel>
      )}

      {/* ---- TUBE list ---- */}
      {activeTab === "tube" && (
        <div className="space-y-2">
          {tubeFavourites.map((station) => (
            <div
              key={station.naptanId}
              onClick={() => handleStationClick(station.naptanId, station.name)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleStationClick(station.naptanId, station.name);
                }
              }}
              tabIndex={0}
              className={cn(
                "border border-board-border bg-surface",
                "cursor-pointer hover:border-amber-faint focus:border-amber-faint focus:outline-none",
                "transition-colors duration-200",
                "flex items-center gap-3 p-3"
              )}
              role="button"
              aria-label={`View departures for ${station.name}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm tracking-wider text-amber uppercase truncate">
                    {station.name
                      .replace(/\s*Underground Station$/i, "")
                      .replace(/\s*Station$/i, "")}
                  </span>
                  <div className="flex gap-1 shrink-0">
                    {station.lines
                      .filter((lineId) => LINE_NAMES[lineId])
                      .map((lineId) => (
                        <span
                          key={lineId}
                          className="w-2.5 h-2.5 rounded-full"
                          style={{
                            backgroundColor: LINE_COLOURS[lineId] || "#FF9500",
                          }}
                          title={LINE_NAMES[lineId]}
                          aria-hidden="true"
                        />
                      ))}
                  </div>
                </div>
                <div className="font-mono text-xs tracking-wider text-amber-faint mt-0.5">
                  {station.lines
                    .filter((lineId) => LINE_NAMES[lineId])
                    .map((lineId) => LINE_NAMES[lineId])
                    .join(", ")}
                </div>
              </div>
              <button
                onClick={(e) => handleRemove(e, station.naptanId)}
                className="shrink-0 p-2 text-amber-faint hover:text-red-500 transition-colors"
                aria-label={`Remove ${station.name} from saved`}
              >
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ---- BUS list ---- */}
      {activeTab === "bus" && (
        <div className="space-y-2">
          {busFavourites.map((station) => (
            <div
              key={station.naptanId}
              onClick={() => handleStationClick(station.naptanId, station.name)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleStationClick(station.naptanId, station.name);
                }
              }}
              tabIndex={0}
              className={cn(
                "border border-board-border bg-surface",
                "cursor-pointer hover:border-amber-faint focus:border-amber-faint focus:outline-none",
                "transition-colors duration-200",
                "flex items-center gap-3 p-3"
              )}
              role="button"
              aria-label={`View departures for ${station.name}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {station.stopLetter ? (
                    <span className="shrink-0 w-6 h-6 flex items-center justify-center border border-amber text-amber text-xs font-mono">
                      {station.stopLetter}
                    </span>
                  ) : (
                    <Bus
                      size={16}
                      className="shrink-0 text-amber"
                      strokeWidth={1.5}
                    />
                  )}
                  <span className="font-mono text-sm tracking-wider text-amber uppercase truncate">
                    {station.name}
                  </span>
                </div>
                <div className="font-mono text-xs tracking-wider text-amber-faint mt-0.5">
                  {station.lines.length > 0
                    ? station.lines.join(", ")
                    : station.indicator
                      ? station.indicator.toUpperCase()
                      : "BUS STOP"}
                </div>
              </div>
              <button
                onClick={(e) => handleRemove(e, station.naptanId)}
                className="shrink-0 p-2 text-amber-faint hover:text-red-500 transition-colors"
                aria-label={`Remove ${station.name} from saved`}
              >
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ---- RAIL list ---- */}
      {activeTab === "rail" && (
        <div className="space-y-2">
          {railJourneys.map((journey) => (
            <div
              key={journey.id}
              onClick={handleRailClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleRailClick();
                }
              }}
              tabIndex={0}
              className={cn(
                "border border-board-border bg-surface",
                "cursor-pointer hover:border-amber-faint focus:border-amber-faint focus:outline-none",
                "transition-colors duration-200",
                "flex items-center gap-3 p-3"
              )}
              role="button"
              aria-label={`Open ${journey.fromName} to ${journey.toName} on the rail tab`}
            >
              <TrainFront
                size={16}
                className="shrink-0 text-amber"
                strokeWidth={1.5}
              />
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="font-mono text-sm tracking-wider text-amber uppercase truncate">
                  {journey.fromName}
                </span>
                <ArrowRight
                  size={12}
                  className="shrink-0 text-amber-faint"
                  strokeWidth={1.5}
                />
                <span className="font-mono text-sm tracking-wider text-amber uppercase truncate">
                  {journey.toName}
                </span>
              </div>
              <button
                onClick={(e) => handleRailRemove(e, journey.id)}
                className="shrink-0 p-2 text-amber-faint hover:text-red-500 transition-colors"
                aria-label={`Remove ${journey.fromName} to ${journey.toName}`}
              >
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ---- Hint text (only when we have something to tap) ---- */}
      {totalSaved > 0 && counts[activeTab] > 0 && (
        <div className="text-center py-1">
          <AmberText variant="dim" size="xs">
            {activeTab === "rail"
              ? "TAP A ROUTE TO OPEN ON THE RAIL TAB"
              : "TAP A STATION TO VIEW LIVE DEPARTURES"}
          </AmberText>
        </div>
      )}
    </div>
  );
}
