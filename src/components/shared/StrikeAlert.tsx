/**
 * StrikeAlert.tsx — Strike notification button + detail overlay
 *
 * A warning button that only appears when there is planned
 * strike action. Tapping it opens a full overlay with details
 * about the upcoming strikes: dates, affected lines, and
 * the TfL description.
 *
 * Designed to sit on the home page beneath "Browse All Stations".
 * Hidden when no strikes are planned.
 *
 * Usage:
 *   <StrikeAlert />
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { AlertTriangle, X, Calendar } from "lucide-react";
import { useStrikes } from "@/hooks/useStrikes";
import { LINE_COLOURS } from "@/lib/constants";
import type { StrikeInfo } from "@/lib/tfl-types";
import { cn } from "@/lib/utils";

/**
 * Map a line display name to its TfL line ID for colour lookup.
 */
function getLineColour(lineName: string): string {
  const id = lineName
    .toLowerCase()
    .replace(/ & /g, "-")
    .replace(/\s+/g, "-");
  return LINE_COLOURS[id] || "#FF9500";
}

/**
 * Format a date as "TUE 21 APR" — uppercase dot-matrix style.
 */
function formatStrikeDate(isoString: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  const day = date.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase();
  const dayNum = date.getDate();
  const month = date.toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
  return `${day} ${dayNum} ${month}`;
}

/**
 * Format a date range for display.
 */
function formatDateRange(fromDate: string, toDate: string): string {
  if (!fromDate && !toDate) return "";
  const from = formatStrikeDate(fromDate);
  const to = formatStrikeDate(toDate);
  if (!from) return to;
  if (!to) return from;
  if (from === to) return from;
  return `${from} - ${to}`;
}

/**
 * Get countdown text: "TODAY", "TOMORROW", "IN 3 DAYS", etc.
 */
function getCountdown(fromDate: string): {
  label: string;
  urgency: "now" | "imminent" | "upcoming";
} {
  if (!fromDate) return { label: "", urgency: "upcoming" };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const from = new Date(fromDate);
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  if (fromDay <= today) return { label: "TODAY", urgency: "now" };

  const diffMs = fromDay.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return { label: "TOMORROW", urgency: "imminent" };
  return { label: `IN ${diffDays} DAYS`, urgency: "upcoming" };
}

/**
 * Single strike detail card inside the overlay.
 */
function StrikeDetail({ strike }: { strike: StrikeInfo }) {
  const dateRange = formatDateRange(strike.fromDate, strike.toDate);
  const countdown = getCountdown(strike.fromDate);

  return (
    <div className="border border-board-border bg-surface p-3 space-y-2">
      {/* Date and countdown */}
      {(dateRange || countdown.label) && (
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-amber shrink-0" />
          {dateRange && (
            <span className="font-mono text-sm tracking-wider text-amber amber-glow uppercase flex-1">
              {dateRange}
            </span>
          )}
          {countdown.label && (
            <span
              className={cn(
                "font-mono text-xs tracking-wider uppercase shrink-0 px-2 py-0.5 border",
                countdown.urgency === "now"
                  ? "text-red-500 border-red-500/40 bg-red-500/10"
                  : countdown.urgency === "imminent"
                    ? "text-amber border-amber/40 bg-amber/10"
                    : "text-amber-dim border-amber-dim/40"
              )}
            >
              {countdown.label}
            </span>
          )}
        </div>
      )}

      {/* Affected lines */}
      {strike.affectedLines.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {strike.affectedLines.map((line) => (
            <span
              key={line}
              className="font-mono text-xs tracking-wider px-2 py-0.5 border"
              style={{
                color: getLineColour(line),
                borderColor: getLineColour(line) + "40",
                backgroundColor: getLineColour(line) + "10",
              }}
            >
              {line.toUpperCase()}
            </span>
          ))}
        </div>
      )}

      {/* Description */}
      <p className="font-mono text-xs tracking-wider text-amber amber-glow leading-relaxed">
        {strike.description}
      </p>
    </div>
  );
}

/**
 * Main StrikeAlert component.
 * Shows a notification button when strikes are planned.
 * Tapping opens a detail overlay.
 */
export default function StrikeAlert() {
  const { strikes, isLoading } = useStrikes();
  const [showOverlay, setShowOverlay] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  /* Close overlay when tapping outside */
  useEffect(() => {
    if (!showOverlay) return;
    const handleClick = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        setShowOverlay(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [showOverlay]);

  /* Don't render anything if loading or no strikes */
  if (isLoading || strikes.length === 0) return null;

  /* Find the nearest upcoming strike date for the button text */
  const nextCountdown = getCountdown(strikes[0]?.fromDate || "");

  return (
    <>
      {/* ---- Notification Button ---- */}
      <button
        onClick={() => setShowOverlay(true)}
        className={cn(
          "flex items-center gap-2.5 w-full py-2.5 px-3",
          "border border-red-500/40 bg-red-500/5",
          "hover:border-red-500/60 hover:bg-red-500/10",
          "font-mono text-xs tracking-wider uppercase",
          "transition-colors duration-200"
        )}
      >
        <AlertTriangle size={14} className="text-red-500 shrink-0" />
        <span className="text-red-500 flex-1 text-left">
          STRIKE ACTION PLANNED
        </span>
        {nextCountdown.label && (
          <span
            className={cn(
              "shrink-0 px-2 py-0.5 border",
              nextCountdown.urgency === "now"
                ? "text-red-500 border-red-500/40 bg-red-500/10"
                : nextCountdown.urgency === "imminent"
                  ? "text-amber border-amber/40 bg-amber/10"
                  : "text-amber-dim border-amber-dim/40"
            )}
          >
            {nextCountdown.label}
          </span>
        )}
      </button>

      {/* ---- Detail Overlay ---- */}
      {showOverlay && (
        <div className="fixed inset-0 z-[8500] flex items-center justify-center bg-black/80">
          <div
            ref={overlayRef}
            className="mx-4 max-w-md w-full max-h-[80vh] flex flex-col bg-[#0a0a0a] border border-red-500/30"
          >
            {/* Overlay header */}
            <div className="flex items-center gap-2 p-4 border-b border-board-border shrink-0">
              <AlertTriangle size={16} className="text-red-500 shrink-0" />
              <span className="font-mono text-sm tracking-wider text-red-500 uppercase flex-1">
                STRIKE ACTION
              </span>
              <span className="font-mono text-xs tracking-wider text-amber-faint mr-2">
                {strikes.length} {strikes.length === 1 ? "NOTICE" : "NOTICES"}
              </span>
              <button
                onClick={() => setShowOverlay(false)}
                className="w-8 h-8 flex items-center justify-center text-amber-faint hover:text-amber transition-colors"
                aria-label="Close"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {/* Scrollable strike list */}
            <div className="overflow-y-auto p-4 space-y-3">
              {strikes.map((strike) => (
                <StrikeDetail key={strike.id} strike={strike} />
              ))}
            </div>

            {/* Close button at bottom */}
            <div className="p-4 border-t border-board-border shrink-0">
              <button
                onClick={() => setShowOverlay(false)}
                className="w-full py-2.5 border border-amber text-amber font-mono text-xs tracking-wider uppercase hover:bg-amber/10 transition-colors"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
