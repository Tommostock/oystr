/**
 * useCountdown.ts — Real-time countdown from an absolute timestamp
 *
 * Calculates seconds remaining from an ISO timestamp (expectedArrival)
 * rather than relying on the relative timeToStation value from TfL.
 *
 * Why: timeToStation is calculated when TfL generates the response.
 * By the time it passes through server-side caching (up to 30s) and
 * client polling (up to 30s), the value can be ~60s stale. Using the
 * absolute expectedArrival timestamp and the device clock means the
 * countdown is always accurate regardless of caching delays.
 *
 * Falls back to timeToStation countdown if expectedArrival is missing.
 *
 * Usage:
 *   const liveSeconds = useCountdown(arrival.expectedArrival, arrival.timeToStation);
 */

"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Calculate seconds remaining from an ISO timestamp.
 * Returns 0 if the time has passed.
 */
function secondsUntil(isoTimestamp: string): number {
  const target = new Date(isoTimestamp).getTime();
  const now = Date.now();
  return Math.max(0, Math.round((target - now) / 1000));
}

/**
 * Counts down to an absolute arrival time, recalculating every second.
 * Falls back to decrementing timeToStation if no timestamp provided.
 *
 * @param expectedArrival - ISO timestamp of expected arrival (e.g. "2026-03-31T14:32:00Z")
 * @param fallbackSeconds - timeToStation in seconds, used if expectedArrival is missing
 */
export function useCountdown(
  expectedArrival: string | undefined,
  fallbackSeconds: number
): number {
  const getSeconds = useCallback(() => {
    if (expectedArrival) {
      return secondsUntil(expectedArrival);
    }
    return fallbackSeconds;
  }, [expectedArrival, fallbackSeconds]);

  const [seconds, setSeconds] = useState(getSeconds);

  /* Recalculate every second from the absolute timestamp */
  useEffect(() => {
    /* Set immediately in case props changed */
    setSeconds(getSeconds());

    const interval = setInterval(() => {
      setSeconds(getSeconds());
    }, 1000);

    return () => clearInterval(interval);
  }, [getSeconds]);

  return seconds;
}
