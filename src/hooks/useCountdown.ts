/**
 * useCountdown.ts — Real-time countdown between API polls
 *
 * Instead of showing a static "3 MIN" that only updates every 30s,
 * this hook decrements the timeToStation value every second so the
 * display counts down in real-time: 3 MIN → 2 MIN → 1 MIN → DUE.
 *
 * The countdown resets whenever the API provides fresh data
 * (the timeToStation prop changes from the parent).
 *
 * Usage:
 *   const liveSeconds = useCountdown(arrival.timeToStation);
 */

"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Counts down from the given seconds value, decrementing by 1 each second.
 * Resets when the input value changes (new API data arrived).
 * Never goes below 0.
 */
export function useCountdown(serverSeconds: number): number {
  const [seconds, setSeconds] = useState(serverSeconds);
  const lastServerValue = useRef(serverSeconds);

  /* Reset when server sends new data */
  useEffect(() => {
    if (serverSeconds !== lastServerValue.current) {
      setSeconds(serverSeconds);
      lastServerValue.current = serverSeconds;
    }
  }, [serverSeconds]);

  /* Decrement every second */
  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return seconds;
}
