/**
 * useTrackedFlights.ts — Hook for active / upcoming flights
 *
 * Mirrors useTrackedRailJourneys: a "tracked flight" is a specific
 * flight the user is on or plans to get, identified by
 * (flightNumber, travelDate).
 *
 * Differences from the rail version:
 *   - Auto-clear buffer is 60 min (vs 10 for rail), because
 *     disembarking + immigration + bags is slow.
 *   - `seats` is an array so the user can record multiple seats under
 *     a single booking (families, couples, groups).
 *   - Cap is 3 tracked flights (outbound + return + the occasional
 *     short connector) to accommodate a typical multi-leg trip.
 */

"use client";

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type TrackedFlight } from "@/lib/db";

/** Hard cap on concurrent tracked flights. */
const TRACKED_FLIGHT_CAP = 3;

/** Grace period after scheduled arrival before auto-clearing. */
const AUTO_CLEAR_BUFFER_MS = 60 * 60 * 1000;

/**
 * Build the canonical tracked-flight ID.
 * Same flight number + date always collides so re-tracking is a no-op.
 */
function buildTrackedFlightId(parts: {
  flightNumber: string;
  travelDate: string;
}): string {
  return `${parts.flightNumber.toUpperCase()}-${parts.travelDate}`;
}

/**
 * Compute the Unix timestamp at which a tracked flight should expire.
 * Uses the stored scheduledArrivalUtc (ISO Z string) directly so the
 * calculation is correct regardless of the user's local timezone.
 */
function computeExpiryMs(flight: TrackedFlight): number {
  const t = new Date(flight.scheduledArrivalUtc).getTime();
  if (Number.isNaN(t)) {
    /* Unparseable — keep the flight indefinitely so the user can see
       and manually remove it. */
    return Number.POSITIVE_INFINITY;
  }
  return t + AUTO_CLEAR_BUFFER_MS;
}

/**
 * Delete any tracked flight whose arrival UTC + buffer has passed.
 */
async function clearExpired(): Promise<void> {
  const now = Date.now();
  const all = await db.trackedFlights.toArray();
  const stale = all.filter((f) => computeExpiryMs(f) < now);
  if (stale.length === 0) return;
  await db.trackedFlights.bulkDelete(stale.map((f) => f.id));
}

/**
 * Sanitise a free-form seat string. Trims whitespace, uppercases,
 * and drops anything outside the normal "14A" / "12" / "3-A" set.
 * Returns null if nothing useful remains (caller should skip).
 */
function cleanSeat(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9\-]/g, "");
  return cleaned.length > 0 ? cleaned : null;
}

export function useTrackedFlights() {
  /*
   * useLiveQuery keeps the rendered list in sync with IndexedDB.
   * Sorted chronologically by travelDate then scheduledDeparture so
   * the most current flight floats to the top.
   */
  const flights = useLiveQuery<TrackedFlight[], TrackedFlight[]>(
    async () => {
      const all = await db.trackedFlights.toArray();
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
   * Auto-clear expired flights on mount + every 60 seconds. 60s is
   * plenty precise for the "cleared ~1h after arrival" feature.
   */
  useEffect(() => {
    clearExpired();
    const id = setInterval(clearExpired, 60_000);
    return () => clearInterval(id);
  }, []);

  /**
   * Track a new flight. Enforces the cap by evicting the oldest
   * existing entry if adding this one would exceed TRACKED_FLIGHT_CAP.
   * put() makes re-tracking the same flight idempotent.
   */
  async function trackFlight(input: {
    flightNumber: string;
    airline: string;
    airlineCode: string;
    travelDate: string;
    departureIata: string;
    departureName: string;
    departureCity: string | null;
    arrivalIata: string;
    arrivalName: string;
    arrivalCity: string | null;
    scheduledDeparture: string;
    scheduledArrivalUtc: string;
    /** Optional initial seat list — defaults to empty. */
    seats?: string[];
  }): Promise<TrackedFlight> {
    const id = buildTrackedFlightId({
      flightNumber: input.flightNumber,
      travelDate: input.travelDate,
    });
    const now = Date.now();

    /* Evict oldest if we'd exceed the cap AFTER inserting this id. */
    const existing = await db.trackedFlights.orderBy("trackedAt").toArray();
    const wouldBeCount =
      existing.filter((f) => f.id !== id).length + 1;
    if (wouldBeCount > TRACKED_FLIGHT_CAP) {
      const oldestToEvict = existing
        .filter((f) => f.id !== id)
        .slice(0, wouldBeCount - TRACKED_FLIGHT_CAP);
      await db.trackedFlights.bulkDelete(oldestToEvict.map((f) => f.id));
    }

    const record: TrackedFlight = {
      id,
      flightNumber: input.flightNumber.toUpperCase(),
      airline: input.airline,
      airlineCode: input.airlineCode.toUpperCase(),
      travelDate: input.travelDate,
      departureIata: input.departureIata.toUpperCase(),
      departureName: input.departureName,
      departureCity: input.departureCity,
      arrivalIata: input.arrivalIata.toUpperCase(),
      arrivalName: input.arrivalName,
      arrivalCity: input.arrivalCity,
      scheduledDeparture: input.scheduledDeparture,
      scheduledArrivalUtc: input.scheduledArrivalUtc,
      seats: (input.seats ?? [])
        .map(cleanSeat)
        .filter((s): s is string => s !== null),
      trackedAt: now,
    };
    await db.trackedFlights.put(record);
    return record;
  }

  async function removeFlight(id: string): Promise<void> {
    await db.trackedFlights.delete(id);
  }

  async function isTracked(id: string): Promise<boolean> {
    const row = await db.trackedFlights.get(id);
    return !!row;
  }

  /**
   * Replace the seat list on an existing tracked flight. Callers
   * typically pass the full new list rather than individual adds /
   * removes — that keeps the seat-editor UI state the source of
   * truth and avoids stale-index bugs.
   */
  async function updateSeats(id: string, seats: string[]): Promise<void> {
    const current = await db.trackedFlights.get(id);
    if (!current) return;
    const cleaned = seats
      .map(cleanSeat)
      .filter((s): s is string => s !== null);
    await db.trackedFlights.update(id, { seats: cleaned });
  }

  return {
    /** Tracked flights in chronological order. */
    flights: flights || [],
    trackFlight,
    removeFlight,
    updateSeats,
    isTracked,
    buildTrackedFlightId,
  };
}
