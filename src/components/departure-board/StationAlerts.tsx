/**
 * StationAlerts.tsx — Accessibility and disruption alerts for a station
 *
 * Shows a compact alert panel below the station name with:
 *   - Active disruptions (planned works, closures, etc.)
 *   - Accessibility info (step-free access, lift/escalator counts)
 *
 * Only renders if there are disruptions or accessibility data.
 * Fetches data on mount and caches for 5 minutes.
 *
 * Usage:
 *   <StationAlerts stopId="940GZZLUKSX" />
 */

"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Accessibility, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { LINE_NAMES } from "@/lib/constants";

interface Disruption {
  description: string;
  type: string;
  appearance: string;
  mode: string;
}

interface Facilities {
  lifts: number;
  escalators: number;
  stepFree: boolean;
  address: string;
  gates: number;
}

interface TrainTime {
  lineId: string;
  lineName: string;
  direction: string;
  time: string;
}

interface StationAlertsProps {
  stopId: string;
}

export default function StationAlerts({ stopId }: StationAlertsProps) {
  const [disruptions, setDisruptions] = useState<Disruption[]>([]);
  const [facilities, setFacilities] = useState<Facilities | null>(null);
  const [firstTrains, setFirstTrains] = useState<TrainTime[]>([]);
  const [lastTrains, setLastTrains] = useState<TrainTime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        /* Fetch disruptions and first/last trains in parallel */
        const [alertsResp, timetableResp] = await Promise.all([
          fetch(`/api/tfl/disruptions?stopId=${stopId}`),
          fetch(`/api/tfl/first-last?stopId=${stopId}`),
        ]);

        if (alertsResp.ok) {
          const data = await alertsResp.json();
          setDisruptions(data.disruptions || []);
          setFacilities(data.facilities || null);
        }

        if (timetableResp.ok) {
          const data = await timetableResp.json();
          setFirstTrains(data.firstTrains || []);
          setLastTrains(data.lastTrains || []);
        }
      } catch {
        /* Silently fail — alerts are not critical */
      } finally {
        setIsLoading(false);
      }
    }

    setIsLoading(true);
    setDisruptions([]);
    setFacilities(null);
    setFirstTrains([]);
    setLastTrains([]);
    setIsExpanded(false);
    fetchAlerts();
  }, [stopId]);

  /* Don't render while loading or if no data at all */
  if (isLoading) return null;
  if (disruptions.length === 0 && !facilities && firstTrains.length === 0) return null;

  const hasDisruptions = disruptions.length > 0;
  const hasTrainTimes = firstTrains.length > 0 || lastTrains.length > 0;

  return (
    <div className="border border-board-border bg-surface">
      {/* ---- Header row (always visible) ---- */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2.5 hover:bg-board-border/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {/* Disruption warning or accessibility icon */}
          {hasDisruptions ? (
            <AlertTriangle
              size={14}
              strokeWidth={1.5}
              className="text-amber shrink-0"
            />
          ) : (
            <Accessibility
              size={14}
              strokeWidth={1.5}
              className="text-good shrink-0"
            />
          )}

          {/* Summary text */}
          <span
            className={cn(
              "font-mono text-xs tracking-wider uppercase",
              hasDisruptions ? "text-amber" : "text-amber-faint"
            )}
          >
            {hasDisruptions
              ? `${disruptions.length} ALERT${disruptions.length > 1 ? "S" : ""}`
              : ""}
            {hasDisruptions && facilities ? " / " : ""}
            {facilities && (
              <>
                {facilities.stepFree ? "STEP-FREE" : "NO STEP-FREE"}
                {facilities.lifts > 0 && ` / ${facilities.lifts} LIFT${facilities.lifts > 1 ? "S" : ""}`}
                {facilities.escalators > 0 && ` / ${facilities.escalators} ESC`}
              </>
            )}
            {hasTrainTimes && (
              <>
                {(hasDisruptions || facilities) ? " / " : ""}
                FIRST/LAST TRAINS
              </>
            )}
          </span>
        </div>

        <span className="text-amber-faint shrink-0">
          {isExpanded ? (
            <ChevronUp size={12} strokeWidth={1.5} />
          ) : (
            <ChevronDown size={12} strokeWidth={1.5} />
          )}
        </span>
      </button>

      {/* ---- Expanded details ---- */}
      {isExpanded && (
        <div className="px-2.5 pb-2.5 border-t border-board-border/50 pt-2 space-y-2">
          {/* Disruptions */}
          {disruptions.map((disruption, i) => (
            <div key={i} className="flex gap-2">
              <AlertTriangle
                size={12}
                strokeWidth={1.5}
                className={cn(
                  "shrink-0 mt-0.5",
                  disruption.appearance === "PlannedWork"
                    ? "text-amber"
                    : "text-error"
                )}
              />
              <p className="font-mono text-xs tracking-wider text-amber-dim leading-relaxed">
                {disruption.description}
              </p>
            </div>
          ))}

          {/* Facilities */}
          {facilities && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-3">
                <Accessibility
                  size={12}
                  strokeWidth={1.5}
                  className={cn(
                    "shrink-0",
                    facilities.stepFree ? "text-good" : "text-amber-faint"
                  )}
                />
                <span className="font-mono text-xs tracking-wider text-amber-faint">
                  {facilities.stepFree
                    ? "STEP-FREE ACCESS AVAILABLE"
                    : "NO STEP-FREE ACCESS"}
                  {facilities.lifts > 0 &&
                    ` -- ${facilities.lifts} LIFT${facilities.lifts > 1 ? "S" : ""}`}
                  {facilities.escalators > 0 &&
                    ` -- ${facilities.escalators} ESCALATOR${facilities.escalators > 1 ? "S" : ""}`}
                  {facilities.gates > 0 &&
                    ` -- ${facilities.gates} GATE${facilities.gates > 1 ? "S" : ""}`}
                </span>
              </div>
              {/* Station address */}
              {facilities.address && (
                <div className="font-mono text-xs tracking-wider text-amber-faint pl-5">
                  {facilities.address}
                </div>
              )}
            </div>
          )}

          {/* First and last trains */}
          {hasTrainTimes && (
            <div className="pt-2 border-t border-board-border/30 space-y-2">
              {firstTrains.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Clock size={10} strokeWidth={1.5} className="text-good shrink-0" />
                    <span className="font-mono text-[10px] tracking-wider text-good uppercase">
                      FIRST TRAINS
                    </span>
                  </div>
                  {firstTrains.map((t, i) => (
                    <div key={`first-${i}`} className="flex items-center justify-between pl-4 gap-2">
                      <span className="font-mono text-xs tracking-wider text-amber-faint uppercase truncate">
                        {LINE_NAMES[t.lineId] || t.lineId}
                        {t.direction && (
                          <span className="text-[10px] text-amber-faint/60 ml-1">
                            {t.direction}
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-xs tracking-wider text-amber amber-glow shrink-0">
                        {t.time}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {lastTrains.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Clock size={10} strokeWidth={1.5} className="text-amber shrink-0" />
                    <span className="font-mono text-[10px] tracking-wider text-amber uppercase">
                      LAST TRAINS
                    </span>
                  </div>
                  {lastTrains.map((t, i) => (
                    <div key={`last-${i}`} className="flex items-center justify-between pl-4 gap-2">
                      <span className="font-mono text-xs tracking-wider text-amber-faint uppercase truncate">
                        {LINE_NAMES[t.lineId] || t.lineId}
                        {t.direction && (
                          <span className="text-[10px] text-amber-faint/60 ml-1">
                            {t.direction}
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-xs tracking-wider text-amber amber-glow shrink-0">
                        {t.time}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
