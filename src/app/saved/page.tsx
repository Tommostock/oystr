/**
 * saved/page.tsx — Saved Stations page
 *
 * Shows all favourite stations saved by the user.
 * Each station is a tappable card that navigates to
 * the departures board for that station.
 *
 * Stations are stored in IndexedDB via Dexie.js,
 * so they persist across sessions and work offline.
 */

"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Star, Trash2 } from "lucide-react";
import { useFavourites } from "@/hooks/useFavourites";
import { db } from "@/lib/db";
import { LINE_COLOURS, LINE_NAMES } from "@/lib/constants";
import BoardPanel from "@/components/shared/BoardPanel";
import AmberText from "@/components/shared/AmberText";
import { cn, cleanStationName } from "@/lib/utils";

export default function SavedPage() {
  const { favourites, removeFavourite } = useFavourites();
  const router = useRouter();

  /*
   * Enrich saved stations that have empty lines.
   * Uses two strategies:
   *   1. Direct StopPoint lookup by naptanId (most reliable)
   *   2. Fallback to search API if the direct lookup fails
   * This fixes stations saved before the lines feature was added.
   *
   * The enrichingRef prevents duplicate API calls when the effect
   * re-triggers after DB updates cause favourites to change.
   */
  const enrichingRef = React.useRef(false);
  useEffect(() => {
    const stationsWithoutLines = favourites.filter(
      (s) => s.lines.length === 0
    );
    if (stationsWithoutLines.length === 0 || enrichingRef.current) return;

    enrichingRef.current = true;

    async function enrichStations() {
      for (const station of stationsWithoutLines) {
        try {
          /*
           * Strategy 1: Direct StopPoint lookup by naptanId.
           * The disruptions endpoint fetches the full StopPoint data
           * which includes line IDs — most reliable since it uses
           * the exact naptanId rather than a name search.
           */
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
              await db.favourites.update(station.naptanId, {
                lines: lineIds,
              });
              continue; /* Success — move to next station */
            }
          }

          /*
           * Strategy 2: Search by cleaned station name.
           * Uses the shared cleanStationName utility.
           */
          const cleanName = cleanStationName(station.name);

          const searchResp = await fetch(
            `/api/tfl/search?query=${encodeURIComponent(cleanName)}`
          );
          if (!searchResp.ok) continue;

          const results = await searchResp.json();

          /* Try exact naptanId match first, then name match, then first result */
          const match =
            results.find(
              (r: { naptanId: string }) => r.naptanId === station.naptanId
            ) ||
            results.find(
              (r: { name: string }) =>
                r.name.toLowerCase().includes(cleanName.toLowerCase())
            ) ||
            results[0];

          if (match?.lines?.length > 0) {
            const lineIds = match.lines.map(
              (l: { id: string } | string) =>
                typeof l === "string" ? l : l.id
            );
            await db.favourites.update(station.naptanId, {
              lines: lineIds,
            });
          }
        } catch {
          /* Silently fail — line dots are not critical */
        }
      }
      enrichingRef.current = false;
    }

    enrichStations();
  }, [favourites]);

  /**
   * Navigate to the home page with the selected station.
   * We use a query parameter to pre-select the station.
   */
  const handleStationClick = (naptanId: string, name: string) => {
    /* Navigate to home with station info in the URL */
    router.push(`/?stopId=${naptanId}&name=${encodeURIComponent(name)}`);
  };

  /**
   * Remove a station from favourites.
   * Stops the click event from bubbling up to the card (which would navigate).
   */
  const handleRemove = async (
    e: React.MouseEvent,
    naptanId: string
  ) => {
    e.stopPropagation();
    await removeFavourite(naptanId);
  };

  return (
    <div className="p-4 space-y-4">
      {/* ---- Page Header ---- */}
      <div className="text-center pt-4 pb-2">
        <AmberText as="h1" size="lg" uppercase className="dot-matrix">
          Saved Stations
        </AmberText>
      </div>

      {/* ---- Empty State ---- */}
      {favourites.length === 0 && (
        <BoardPanel>
          <div className="py-8 text-center space-y-3">
            <Star
              size={32}
              strokeWidth={1}
              className="mx-auto text-amber-faint"
            />
            <AmberText variant="dim" size="sm" className="dot-matrix">
              NO SAVED STATIONS
            </AmberText>
            <p className="font-mono text-xs tracking-wider text-amber-faint">
              SEARCH FOR A STATION AND TAP &quot;SAVE STATION&quot;
              <br />
              TO ADD IT HERE FOR QUICK ACCESS
            </p>
          </div>
        </BoardPanel>
      )}

      {/* ---- Favourite Station Cards ---- */}
      <div className="space-y-2">
        {[...favourites].sort((a, b) => a.name.localeCompare(b.name)).map((station) => (
          <div
            key={station.naptanId}
            onClick={() =>
              handleStationClick(station.naptanId, station.name)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleStationClick(station.naptanId, station.name);
              }
            }}
            tabIndex={0}
            className={cn(
              /* Card styling */
              "border border-board-border bg-surface",
              /* Interactive */
              "cursor-pointer hover:border-amber-faint focus:border-amber-faint focus:outline-none",
              "transition-colors duration-200",
              /* Flex layout */
              "flex items-center gap-3 p-3"
            )}
            role="button"
            aria-label={`View departures for ${station.name}`}
          >
            {/* Station name and line info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm tracking-wider text-amber uppercase truncate">
                  {station.name
                    .replace(/\s*Underground Station$/i, "")
                    .replace(/\s*Station$/i, "")}
                </span>
                {/* All line colour dots in a horizontal row */}
                <div className="flex gap-1 shrink-0">
                  {station.lines.map((lineId) => (
                    <span
                      key={lineId}
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        backgroundColor: LINE_COLOURS[lineId] || "#FF9500",
                      }}
                      title={LINE_NAMES[lineId] || lineId}
                      aria-hidden="true"
                    />
                  ))}
                </div>
              </div>
              <div className="font-mono text-xs tracking-wider text-amber-faint mt-0.5">
                {station.lines
                  .map((lineId) => LINE_NAMES[lineId] || lineId)
                  .join(", ")}
              </div>
            </div>

            {/* Remove button */}
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

      {/* ---- Hint text ---- */}
      {favourites.length > 0 && (
        <div className="text-center py-1">
          <AmberText variant="dim" size="xs">
            TAP A STATION TO VIEW LIVE DEPARTURES
          </AmberText>
        </div>
      )}
    </div>
  );
}
