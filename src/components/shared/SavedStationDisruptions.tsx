/**
 * SavedStationDisruptions.tsx — Disruption banner for saved stations
 *
 * Checks the line status API for any disruptions affecting the
 * user's saved stations. Shows a compact warning banner at the
 * top of the home page if any saved station's lines have issues.
 *
 * Only shows when there ARE disruptions — invisible otherwise.
 *
 * Usage:
 *   <SavedStationDisruptions />
 */

"use client";

import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useFavourites } from "@/hooks/useFavourites";
import { LINE_NAMES } from "@/lib/constants";

interface LineDisruption {
  lineId: string;
  lineName: string;
  status: string;
  reason: string;
}

export default function SavedStationDisruptions() {
  const { favourites } = useFavourites();
  const [disruptions, setDisruptions] = useState<LineDisruption[]>([]);

  useEffect(() => {
    if (favourites.length === 0) return;

    async function checkDisruptions() {
      try {
        const resp = await fetch("/api/tfl/status");
        if (!resp.ok) return;

        const statuses = await resp.json();

        /* Get all unique line IDs from saved stations */
        const savedLineIds = new Set<string>();
        for (const station of favourites) {
          for (const lineId of station.lines) {
            savedLineIds.add(lineId);
          }
        }

        /* Find disruptions on saved lines */
        const affected: LineDisruption[] = [];
        for (const line of statuses) {
          if (!savedLineIds.has(line.id)) continue;

          const status = line.lineStatuses?.[0];
          if (
            status &&
            status.statusSeverity !== 10 /* 10 = Good Service */
          ) {
            affected.push({
              lineId: line.id,
              lineName: LINE_NAMES[line.id] || line.name,
              status: status.statusSeverityDescription || "Disrupted",
              reason: status.reason || "",
            });
          }
        }

        setDisruptions(affected);
      } catch {
        /* Silently fail */
      }
    }

    checkDisruptions();
    /* Re-check every 2 minutes */
    const interval = setInterval(checkDisruptions, 120_000);
    return () => clearInterval(interval);
  }, [favourites]);

  if (disruptions.length === 0) return null;

  return (
    <div className="border border-amber/30 bg-amber/5 p-2.5">
      <div className="flex items-center gap-2 mb-1.5">
        <AlertTriangle size={14} strokeWidth={1.5} className="text-amber shrink-0" />
        <span className="font-mono text-xs tracking-wider text-amber uppercase">
          {disruptions.length} LINE{disruptions.length > 1 ? "S" : ""} AFFECTED
        </span>
      </div>
      <div className="space-y-1">
        {disruptions.map((d) => (
          <div key={d.lineId} className="font-mono text-xs tracking-wider text-amber-dim pl-5">
            {d.lineName.toUpperCase()}: {d.status.toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
}
