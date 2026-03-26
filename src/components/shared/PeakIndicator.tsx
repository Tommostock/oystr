/**
 * PeakIndicator.tsx — Shows if current time is peak or off-peak
 *
 * TfL peak hours (Mon-Fri, excluding bank holidays):
 *   Morning peak: 06:30 - 09:30
 *   Evening peak: 16:00 - 19:00
 *
 * Everything else is off-peak (including weekends).
 * Updates every minute to stay accurate.
 *
 * Usage:
 *   <PeakIndicator />
 */

"use client";

import { useState, useEffect } from "react";

/**
 * Check if the current time is within TfL peak hours.
 * Peak = Mon-Fri, 06:30-09:30 or 16:00-19:00.
 */
function isPeakTime(): boolean {
  const now = new Date();
  const day = now.getDay(); /* 0=Sun, 6=Sat */
  const hours = now.getHours();
  const mins = now.getMinutes();
  const timeNum = hours * 100 + mins; /* e.g. 0930, 1600 */

  /* Weekends are always off-peak */
  if (day === 0 || day === 6) return false;

  /* Morning peak: 06:30 - 09:30 */
  if (timeNum >= 630 && timeNum < 930) return true;

  /* Evening peak: 16:00 - 19:00 */
  if (timeNum >= 1600 && timeNum < 1900) return true;

  return false;
}

export default function PeakIndicator() {
  const [peak, setPeak] = useState(isPeakTime());

  /* Re-check every 60 seconds */
  useEffect(() => {
    const interval = setInterval(() => setPeak(isPeakTime()), 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className={`font-mono text-xs tracking-wider px-2 py-0.5 border ${
        peak
          ? "text-amber border-amber bg-amber/10"
          : "text-good border-good/50 bg-good/5"
      }`}
    >
      {peak ? "PEAK" : "OFF-PEAK"}
    </span>
  );
}
