/**
 * OfflineTimetable.tsx — Shows cached scheduled timetable
 *
 * When the app is offline and live arrivals are unavailable,
 * this component displays the cached scheduled timetable from
 * IndexedDB. Shows departure times grouped by direction.
 *
 * The timetable is cached when the user saves a station.
 * Includes a clear "SCHEDULED TIMES" banner so users know
 * this is not live data.
 */

"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/db";
import BoardPanel from "@/components/shared/BoardPanel";
import AmberText from "@/components/shared/AmberText";

interface TimetableRoute {
  direction: string;
  destination: string;
  departures: string[];
}

interface OfflineTimetableProps {
  /** The station's Naptan ID */
  stopId: string;
  /** Display name of the station */
  stationName: string;
}

/**
 * Get the next few departure times from now.
 * Filters the timetable to only show upcoming departures.
 */
function getUpcomingDepartures(departures: string[], count: number): string[] {
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  const upcoming = departures.filter((t) => t >= currentTime);

  /* If few upcoming today, wrap around to include early morning */
  if (upcoming.length < count) {
    return [...upcoming, ...departures.slice(0, count - upcoming.length)];
  }

  return upcoming.slice(0, count);
}

export default function OfflineTimetable({
  stopId,
  stationName,
}: OfflineTimetableProps) {
  const [routes, setRoutes] = useState<TimetableRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [cachedAt, setCachedAt] = useState<number | null>(null);

  useEffect(() => {
    async function loadCached() {
      try {
        const entries = await db.timetables
          .where("stationId")
          .equals(stopId)
          .toArray();

        if (entries.length === 0) {
          setLoading(false);
          return;
        }

        /* Combine all cached timetable routes */
        const allRoutes: TimetableRoute[] = [];
        let latestCache = 0;

        for (const entry of entries) {
          const data = entry.data as { routes?: TimetableRoute[] };
          if (data.routes) {
            allRoutes.push(...data.routes);
          }
          if (entry.cachedAt > latestCache) {
            latestCache = entry.cachedAt;
          }
        }

        setRoutes(allRoutes);
        setCachedAt(latestCache);
      } catch {
        /* IndexedDB error — show nothing */
      } finally {
        setLoading(false);
      }
    }

    loadCached();
  }, [stopId]);

  if (loading) {
    return (
      <BoardPanel title={stationName}>
        <div className="py-4 text-center">
          <AmberText variant="dim" size="sm" className="dot-matrix animate-blink">
            LOADING CACHED TIMETABLE...
          </AmberText>
        </div>
      </BoardPanel>
    );
  }

  if (routes.length === 0) {
    return (
      <BoardPanel title={stationName}>
        <div className="py-4 text-center">
          <AmberText variant="dim" size="sm" className="dot-matrix">
            NO CACHED TIMETABLE AVAILABLE
          </AmberText>
          <AmberText variant="dim" size="xs" className="mt-2 block">
            SAVE THIS STATION TO CACHE TIMETABLE FOR OFFLINE USE
          </AmberText>
        </div>
      </BoardPanel>
    );
  }

  /* Format the cache age */
  const cacheAge = cachedAt
    ? Math.round((Date.now() - cachedAt) / (1000 * 60 * 60))
    : null;

  return (
    <div className="space-y-3">
      {/* SCHEDULED TIMES banner */}
      <div className="w-full py-2 px-4 bg-amber/10 border border-amber/30">
        <AmberText size="xs" className="dot-matrix text-center block">
          OFFLINE -- SHOWING SCHEDULED TIMES
        </AmberText>
        {cacheAge !== null && (
          <AmberText variant="dim" size="xs" className="text-center block mt-0.5">
            CACHED {cacheAge < 1 ? "LESS THAN 1 HOUR" : `${cacheAge}H`} AGO
          </AmberText>
        )}
      </div>

      {routes.map((route, i) => {
        const upcoming = getUpcomingDepartures(route.departures, 6);

        return (
          <BoardPanel
            key={`${route.direction}-${route.destination}-${i}`}
            title={`${route.direction} -- ${route.destination}`}
          >
            <div className="space-y-1.5">
              {upcoming.map((time, j) => (
                <div
                  key={`${time}-${j}`}
                  className="flex items-center justify-between py-1.5 border-b border-board-border/50 last:border-b-0 board-row-stagger"
                >
                  <span className="font-board text-xl tracking-wider text-amber amber-glow uppercase">
                    {route.destination}
                  </span>
                  <span className="font-board text-xl tracking-wider text-amber-dim shrink-0">
                    {time}
                  </span>
                </div>
              ))}

              {upcoming.length === 0 && (
                <AmberText variant="dim" size="sm" className="py-2 text-center block dot-matrix">
                  NO SCHEDULED DEPARTURES
                </AmberText>
              )}
            </div>
          </BoardPanel>
        );
      })}
    </div>
  );
}
