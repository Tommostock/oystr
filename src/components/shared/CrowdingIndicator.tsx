/**
 * CrowdingIndicator.tsx — Estimated crowding level based on time
 *
 * TfL's real-time crowding API isn't available for most stations,
 * so we estimate based on time of day and day of week:
 *
 *   - Rush hour (Mon-Fri 07:30-09:30, 17:00-19:00): BUSY
 *   - Shoulder (Mon-Fri 06:30-07:30, 09:30-10:30, 16:00-17:00, 19:00-20:00): MODERATE
 *   - Weekend daytime (10:00-18:00): MODERATE
 *   - Everything else: QUIET
 *
 * Usage:
 *   <CrowdingIndicator />
 */

"use client";

import { useState, useEffect } from "react";
import { Users } from "lucide-react";

type CrowdLevel = "QUIET" | "MODERATE" | "BUSY";

function estimateCrowding(): CrowdLevel {
  const now = new Date();
  const day = now.getDay();
  const h = now.getHours();
  const m = now.getMinutes();
  const t = h * 100 + m;
  const isWeekday = day >= 1 && day <= 5;

  if (isWeekday) {
    /* Rush hour */
    if ((t >= 730 && t < 930) || (t >= 1700 && t < 1900)) return "BUSY";
    /* Shoulder periods */
    if ((t >= 630 && t < 730) || (t >= 930 && t < 1030) ||
        (t >= 1600 && t < 1700) || (t >= 1900 && t < 2000)) return "MODERATE";
  } else {
    /* Weekend daytime */
    if (t >= 1000 && t < 1800) return "MODERATE";
  }

  return "QUIET";
}

const crowdConfig = {
  QUIET: { color: "text-good", bg: "bg-good/10", border: "border-good/30" },
  MODERATE: { color: "text-amber", bg: "bg-amber/10", border: "border-amber/30" },
  BUSY: { color: "text-error", bg: "bg-error/10", border: "border-error/30" },
};

export default function CrowdingIndicator() {
  const [level, setLevel] = useState<CrowdLevel>(estimateCrowding());

  useEffect(() => {
    const interval = setInterval(() => setLevel(estimateCrowding()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const config = crowdConfig[level];

  return (
    <div className={`flex items-center gap-1.5 font-mono text-xs tracking-wider px-2 py-0.5 border ${config.color} ${config.border} ${config.bg}`}>
      <Users size={10} strokeWidth={1.5} />
      <span>{level}</span>
    </div>
  );
}
