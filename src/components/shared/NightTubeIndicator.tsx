/**
 * NightTubeIndicator.tsx — Shows if Night Tube is running
 *
 * Night Tube operates on Friday and Saturday nights on these lines:
 *   - Central
 *   - Jubilee
 *   - Northern
 *   - Piccadilly
 *   - Victoria
 *
 * Shows a moon icon with "NIGHT TUBE" text when active.
 * Only renders on Friday nights (after 23:00) through Saturday ~05:00,
 * and Saturday nights (after 23:00) through Sunday ~05:00.
 *
 * Usage:
 *   <NightTubeIndicator />
 */

"use client";

import { useState, useEffect } from "react";
import { Moon } from "lucide-react";

/** Lines that run Night Tube service */
const NIGHT_TUBE_LINES = [
  "Central",
  "Jubilee",
  "Northern",
  "Piccadilly",
  "Victoria",
];

/**
 * Check if Night Tube is currently running.
 * Runs Friday 23:00 → Saturday 05:00 and Saturday 23:00 → Sunday 05:00.
 */
function isNightTubeTime(): boolean {
  const now = new Date();
  const day = now.getDay(); /* 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat */
  const hour = now.getHours();

  /* Friday night (23:00+) */
  if (day === 5 && hour >= 23) return true;
  /* Saturday early morning (before 05:00 — continuation of Friday night) */
  if (day === 6 && hour < 5) return true;
  /* Saturday night (23:00+) */
  if (day === 6 && hour >= 23) return true;
  /* Sunday early morning (before 05:00 — continuation of Saturday night) */
  if (day === 0 && hour < 5) return true;

  return false;
}

export default function NightTubeIndicator() {
  const [active, setActive] = useState(isNightTubeTime());

  useEffect(() => {
    const interval = setInterval(() => setActive(isNightTubeTime()), 60_000);
    return () => clearInterval(interval);
  }, []);

  /* Only render when Night Tube is active */
  if (!active) return null;

  return (
    <div className="border border-board-border bg-surface p-2.5">
      <div className="flex items-center gap-2">
        <Moon size={14} strokeWidth={1.5} className="text-blue-400 shrink-0" />
        <span className="font-mono text-xs tracking-wider text-blue-400 uppercase">
          NIGHT TUBE RUNNING
        </span>
      </div>
      <div className="font-mono text-xs tracking-wider text-amber-faint mt-1 pl-5">
        {NIGHT_TUBE_LINES.join(" / ")}
      </div>
    </div>
  );
}
