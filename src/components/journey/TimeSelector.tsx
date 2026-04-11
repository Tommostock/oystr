/**
 * TimeSelector.tsx — Journey time picker
 *
 * Lets the user choose between:
 *   - "Leave now" (default — uses current time)
 *   - "Depart at" (specific departure time)
 *   - "Arrive by" (specific arrival time)
 *
 * Returns the selected mode and time for the journey API call.
 *
 * Usage:
 *   <TimeSelector
 *     onTimeChange={(timeIs, dateTime) => { ... }}
 *   />
 */

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** The three time modes */
type TimeMode = "now" | "depart" | "arrive";

interface TimeSelectorProps {
  /** Called when the time selection changes */
  onTimeChange: (timeIs: "Departing" | "Arriving", dateTime: string | null) => void;
}

/**
 * Format a Date to the TfL API's expected format: YYYYMMDDHHmm
 */
function formatForApi(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}${m}${d}${h}${min}`;
}

/**
 * Get the current time as a string for the time input (HH:MM).
 */
function getCurrentTimeString(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export default function TimeSelector({ onTimeChange }: TimeSelectorProps) {
  const [mode, setMode] = useState<TimeMode>("now");
  const [time, setTime] = useState(getCurrentTimeString());

  /**
   * Handle mode button clicks.
   */
  const handleModeChange = (newMode: TimeMode) => {
    setMode(newMode);

    if (newMode === "now") {
      /* "Leave now" — no specific time, use Departing */
      onTimeChange("Departing", null);
    } else if (newMode === "depart") {
      /* "Depart at" — use the selected time */
      const dateTime = buildDateTime(time);
      onTimeChange("Departing", dateTime);
    } else {
      /* "Arrive by" — use the selected time */
      const dateTime = buildDateTime(time);
      onTimeChange("Arriving", dateTime);
    }
  };

  /**
   * Handle time input changes.
   */
  const handleTimeChange = (newTime: string) => {
    setTime(newTime);
    const dateTime = buildDateTime(newTime);
    onTimeChange(mode === "arrive" ? "Arriving" : "Departing", dateTime);
  };

  /**
   * Build a full datetime string from a time (HH:MM).
   * Uses today's date combined with the selected time.
   */
  function buildDateTime(timeStr: string): string {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return formatForApi(date);
  }

  return (
    <div className="space-y-2">
      {/* ---- Mode buttons ---- */}
      <div className="flex gap-1">
        {([
          { key: "now", label: "LEAVE NOW" },
          { key: "depart", label: "DEPART AT" },
          { key: "arrive", label: "ARRIVE BY" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleModeChange(key)}
            className={cn(
              /* Base button style */
              "flex-1 py-2 px-2",
              "font-mono text-xs tracking-wider uppercase",
              "border transition-colors duration-200",
              /* Active vs inactive styling */
              mode === key
                ? "border-amber text-amber bg-amber/10"
                : "border-board-border text-amber-faint hover:border-amber-faint"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ---- Time input (shown when depart/arrive is selected) ---- */}
      {mode !== "now" && (
        <input
          type="time"
          value={time}
          onChange={(e) => handleTimeChange(e.target.value)}
          className={cn(
            "w-full py-2 px-3",
            "bg-surface text-amber",
            "border border-board-border focus:border-amber",
            "font-mono text-sm tracking-wider",
            "outline-none transition-colors duration-200",
            /*
             * iOS Safari adds default padding/width to input[type="time"]
             * which causes it to render wider than its container.
             * appearance-none strips the default UA styling and
             * min-w-0 prevents the implicit content-based min width.
             */
            "appearance-none min-w-0 block",
            /* Custom styling for the time picker */
            "[color-scheme:dark]"
          )}
          style={{ boxSizing: "border-box" }}
        />
      )}
    </div>
  );
}
