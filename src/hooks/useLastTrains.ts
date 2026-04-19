/**
 * useLastTrains.ts — Evening-time last-train warnings
 *
 * Fetches last-train times for a given station and returns the
 * next-departing last train along with a countdown. Only active
 * during late-evening hours (default 22:00–02:00) — the rest of
 * the day the hook short-circuits and returns no data, so we
 * don't hammer the TfL timetable endpoint for nothing.
 *
 * Keyed on naptanId so the home page can use it for the home station
 * and the saved-station list can use it per-station.
 *
 * Usage:
 *   const { soonest, loading } = useLastTrains(naptanId);
 *
 * Return shape:
 *   soonest    — the last train that departs soonest (next in time),
 *                or null when outside evening hours / no data / error.
 *   minsUntil  — minutes from now until that train leaves, or null.
 */

"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";

/* Window in which we actively fetch + show last-train warnings. */
const ACTIVE_START_HOUR = 22; /* 22:00 */
const ACTIVE_END_HOUR = 2;    /* 02:00 (next day) */

export interface LastTrain {
  lineId: string;
  direction: string;
  time: string;          /* "23:45" */
  rawMinutes: number;    /* minutes since midnight; may be >= 24*60 */
}

interface LastTrainsResponse {
  firstTrains?: LastTrain[];
  lastTrains?: LastTrain[];
}

/** Is the given time inside the active evening window? */
function isEveningActive(date = new Date()): boolean {
  const h = date.getHours();
  return h >= ACTIVE_START_HOUR || h < ACTIVE_END_HOUR;
}

async function fetcher(url: string): Promise<LastTrainsResponse> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

/**
 * Convert rawMinutes (minutes since midnight, possibly >= 1440) to a
 * concrete Date by anchoring to today. Values >= 1440 roll into
 * tomorrow morning.
 */
function rawMinutesToDate(raw: number, anchor = new Date()): Date {
  const d = new Date(anchor);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(raw);
  return d;
}

export function useLastTrains(naptanId: string | null | undefined) {
  /*
   * SWR key is null outside evening hours so the fetch is skipped.
   * Once the window opens (at 22:00), mounting/remounting the page
   * will pick up the data — we don't aggressively re-check the clock.
   */
  const active = isEveningActive();
  const key =
    active && naptanId ? `/api/tfl/first-last?stopId=${naptanId}` : null;

  const { data, isLoading } = useSWR<LastTrainsResponse>(key, fetcher, {
    /* Timetables don't change within a session — cache for 30 min */
    dedupingInterval: 30 * 60_000,
    revalidateOnFocus: false,
  });

  /*
   * Tick once a minute to update the countdown. Only runs during the
   * active window to save cycles.
   */
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [active]);

  if (!active || !data) {
    return { soonest: null, minsUntil: null, loading: isLoading };
  }

  /*
   * Pick the soonest-departing last train that hasn't already left.
   * lastTrains from the API is sorted latest-first (by rawMinutes
   * descending). We re-sort ascending by absolute departure timestamp
   * and pick the first future one.
   */
  const candidates = (data.lastTrains || [])
    .map((t) => ({ ...t, when: rawMinutesToDate(t.rawMinutes).getTime() }))
    .filter((t) => t.when > now)
    .sort((a, b) => a.when - b.when);

  const soonest = candidates[0] || null;
  const minsUntil = soonest
    ? Math.max(0, Math.round((soonest.when - now) / 60_000))
    : null;

  return { soonest, minsUntil, loading: isLoading };
}
