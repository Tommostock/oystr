/**
 * useTrackedRailJourneys.ts — Hook for active / upcoming rail journeys
 *
 * A "tracked journey" is a specific service the user is on or plans to
 * get — identified by (fromCrs, toCrs, travelDate, scheduledDeparture).
 * Unlike SavedRailJourney (a generic route), tracking is dated.
 *
 * Behaviour:
 *   - Capped at 2 active journeys (outbound + return). Adding a third
 *     evicts the oldest by trackedAt.
 *   - Auto-clears once the destination arrival time + 10 min elapses,
 *     on mount and every 60 seconds thereafter.
 *   - Uses Dexie's useLiveQuery so the rail page re-renders whenever
 *     the tracked-journeys table changes.
 */

"use client";

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type TrackedRailJourney } from "@/lib/db";

/** Hard cap on concurrent tracked journeys. */
const TRACKED_JOURNEY_CAP = 2;

/** Grace period after scheduled arrival before auto-clearing. */
const AUTO_CLEAR_BUFFER_MS = 10 * 60 * 1000;

/**
 * Build the canonical tracked-journey ID.
 * Same FROM/TO/date/time always collides so re-tracking is a no-op.
 */
function buildTrackedId(parts: {
  fromCrs: string;
  toCrs: string;
  travelDate: string;
  scheduledDeparture: string;
}): string {
  return [
    parts.fromCrs.toUpperCase(),
    parts.toCrs.toUpperCase(),
    parts.travelDate,
    parts.scheduledDeparture,
  ].join("-");
}

/**
 * Compute the Unix timestamp at which a tracked journey should expire.
 *
 * Uses local time because RDM returns HH:mm in UK local time and the
 * user's device clock is almost certainly on UK time while using this
 * app. A simple new Date("YYYY-MM-DDTHH:mm:00") construction treats
 * the string as local time — which is what we want.
 */
function computeExpiryMs(journey: TrackedRailJourney): number {
  const iso = `${journey.travelDate}T${journey.destinationEta}:00`;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) {
    /* If the date is unparseable (shouldn't happen), keep the journey
       indefinitely so the user can see and manually remove it. */
    return Number.POSITIVE_INFINITY;
  }
  return t + AUTO_CLEAR_BUFFER_MS;
}

/**
 * Delete any tracked journey whose destination ETA + buffer has passed.
 * Called on mount and on a polling interval so stale journeys drop off
 * the rail page without user intervention.
 */
async function clearExpired(): Promise<void> {
  const now = Date.now();
  const all = await db.trackedRailJourneys.toArray();
  const stale = all.filter((j) => computeExpiryMs(j) < now);
  if (stale.length === 0) return;
  await db.trackedRailJourneys.bulkDelete(stale.map((j) => j.id));
}

export function useTrackedRailJourneys() {
  /*
   * useLiveQuery keeps the rendered list in sync with IndexedDB.
   * Sorted so the "most current" journey floats to the top — today's
   * services (in scheduled-time order) first, then future dates in
   * chronological order. That puts an in-progress train above a
   * planned-for-next-week trip, which is what the user expects.
   *
   * orderBy only supports a single index, so we read all and sort
   * in JS on the compound (travelDate, scheduledDeparture) key.
   */
  const journeys = useLiveQuery<TrackedRailJourney[], TrackedRailJourney[]>(
    async () => {
      const all = await db.trackedRailJourneys.toArray();
      return all.sort((a, b) => {
        if (a.travelDate !== b.travelDate) {
          return a.travelDate.localeCompare(b.travelDate);
        }
        return a.scheduledDeparture.localeCompare(b.scheduledDeparture);
      });
    },
    [],
    []
  );

  /*
   * Auto-clear expired journeys on mount + every 60 seconds. 60s is
   * plenty of precision for a "cleared ~10 min after arrival" feature
   * and avoids needless churn.
   */
  useEffect(() => {
    clearExpired();
    const id = setInterval(clearExpired, 60_000);
    return () => clearInterval(id);
  }, []);

  /**
   * Track a new journey. Enforces the cap by evicting the oldest
   * existing entry if adding this one would exceed TRACKED_JOURNEY_CAP.
   * put() makes re-tracking the same service idempotent.
   */
  async function trackJourney(input: {
    fromCrs: string;
    fromName: string;
    toCrs: string;
    toName: string;
    travelDate: string;
    scheduledDeparture: string;
    destinationEta: string;
    serviceId?: string;
    seatCoach?: string;
    seatNumber?: string;
  }): Promise<TrackedRailJourney> {
    const id = buildTrackedId(input);
    const now = Date.now();

    /* Evict oldest if we'd exceed the cap AFTER inserting this id. */
    const existing = await db.trackedRailJourneys.orderBy("trackedAt").toArray();
    const wouldBeCount =
      existing.filter((j) => j.id !== id).length + 1;
    if (wouldBeCount > TRACKED_JOURNEY_CAP) {
      const oldestToEvict = existing
        .filter((j) => j.id !== id)
        .slice(0, wouldBeCount - TRACKED_JOURNEY_CAP);
      await db.trackedRailJourneys.bulkDelete(oldestToEvict.map((j) => j.id));
    }

    const record: TrackedRailJourney = {
      id,
      fromCrs: input.fromCrs.toUpperCase(),
      fromName: input.fromName,
      toCrs: input.toCrs.toUpperCase(),
      toName: input.toName,
      travelDate: input.travelDate,
      scheduledDeparture: input.scheduledDeparture,
      destinationEta: input.destinationEta,
      serviceId: input.serviceId,
      seatCoach: input.seatCoach?.trim() || undefined,
      seatNumber: input.seatNumber?.trim() || undefined,
      trackedAt: now,
    };
    await db.trackedRailJourneys.put(record);
    return record;
  }

  async function removeJourney(id: string): Promise<void> {
    await db.trackedRailJourneys.delete(id);
  }

  async function isTracked(id: string): Promise<boolean> {
    const row = await db.trackedRailJourneys.get(id);
    return !!row;
  }

  /**
   * Patch specific fields on an existing tracked journey.
   * Used for:
   *   - editing seat info after the fact
   *   - refreshing the stored destinationEta once live data arrives
   *     on the travel day (so auto-clear becomes accurate)
   */
  async function updateJourney(
    id: string,
    patch: Partial<
      Pick<
        TrackedRailJourney,
        "destinationEta" | "seatCoach" | "seatNumber" | "serviceId"
      >
    >
  ): Promise<void> {
    const current = await db.trackedRailJourneys.get(id);
    if (!current) return;
    /* Normalise empty strings to undefined for optional string fields. */
    const normalised: Partial<TrackedRailJourney> = { ...patch };
    if ("seatCoach" in patch) {
      normalised.seatCoach = patch.seatCoach?.trim() || undefined;
    }
    if ("seatNumber" in patch) {
      normalised.seatNumber = patch.seatNumber?.trim() || undefined;
    }
    await db.trackedRailJourneys.update(id, normalised);
  }

  return {
    /** Tracked journeys, oldest first (display order left-to-right). */
    journeys: journeys || [],
    trackJourney,
    removeJourney,
    updateJourney,
    isTracked,
    buildTrackedId,
  };
}
