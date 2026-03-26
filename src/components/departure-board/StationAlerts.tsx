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
import { AlertTriangle, Accessibility, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface StationAlertsProps {
  stopId: string;
}

export default function StationAlerts({ stopId }: StationAlertsProps) {
  const [disruptions, setDisruptions] = useState<Disruption[]>([]);
  const [facilities, setFacilities] = useState<Facilities | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const resp = await fetch(`/api/tfl/disruptions?stopId=${stopId}`);
        if (resp.ok) {
          const data = await resp.json();
          setDisruptions(data.disruptions || []);
          setFacilities(data.facilities || null);
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
    setIsExpanded(false);
    fetchAlerts();
  }, [stopId]);

  /* Don't render while loading or if no data */
  if (isLoading) return null;
  if (disruptions.length === 0 && !facilities) return null;

  const hasDisruptions = disruptions.length > 0;

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
        </div>
      )}
    </div>
  );
}
