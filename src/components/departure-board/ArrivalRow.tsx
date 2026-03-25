/**
 * ArrivalRow.tsx — Single arrival row on the departure board
 *
 * Displays one train/bus arrival in the classic TfL dot-matrix style:
 *   Platform number | DESTINATION (uppercase) | X min
 *
 * This is the core visual element of the app.
 * It must look exactly like the amber LED text on a real board.
 *
 * Usage:
 *   <ArrivalRow
 *     platform="1"
 *     destination="Epping"
 *     timeToStation={180}
 *   />
 */

import { cn } from "@/lib/utils";

interface ArrivalRowProps {
  /** Platform number or name (e.g. "1" or "Eastbound") */
  platform: string;
  /** Destination station name */
  destination: string;
  /** Seconds until arrival — we convert to minutes for display */
  timeToStation: number;
  /** Optional line colour for a small indicator dot */
  lineColour?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Convert seconds to a human-readable time string.
 * - 0-30 seconds = "DUE" (train is arriving now)
 * - 31-90 seconds = "1 MIN"
 * - 91+ seconds = "X MIN" (rounded down to nearest minute)
 */
function formatTime(seconds: number): string {
  if (seconds <= 30) return "DUE";
  const minutes = Math.floor(seconds / 60);
  return `${minutes} MIN`;
}

export default function ArrivalRow({
  platform,
  destination,
  timeToStation,
  lineColour,
  className,
}: ArrivalRowProps) {
  const timeText = formatTime(timeToStation);
  /* "DUE" trains get a stronger glow to draw attention */
  const isDue = timeToStation <= 30;

  return (
    <div
      className={cn(
        /* Horizontal layout: platform | destination | time */
        "flex items-center gap-3 py-1.5",
        /* Bottom border to separate rows */
        "border-b border-board-border/50 last:border-b-0",
        className
      )}
      role="row"
      aria-label={`${destination}, ${timeText === "DUE" ? "due now" : timeText.toLowerCase()}`}
    >
      {/* ---- Platform number ---- */}
      <div className="flex items-center gap-2 shrink-0 w-8">
        {/* Optional line colour dot */}
        {lineColour && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: lineColour }}
            aria-hidden="true"
          />
        )}
        <span className="text-amber-faint font-mono text-sm tracking-wider">
          {platform}
        </span>
      </div>

      {/* ---- Destination name ---- */}
      <span
        className={cn(
          /* Take up remaining space, truncate if too long */
          "flex-1 truncate",
          /* Uppercase mono text — the classic board look */
          "text-amber font-mono text-sm tracking-wider uppercase",
          /* Amber glow on the text */
          "amber-glow"
        )}
      >
        {destination}
      </span>

      {/* ---- Time until arrival ---- */}
      <span
        className={cn(
          /* Fixed width on the right side */
          "shrink-0 text-right min-w-[4.5rem]",
          /* Mono font */
          "font-mono text-sm tracking-wider",
          /* DUE trains get bright glow, others are standard amber */
          isDue
            ? "text-amber amber-glow-strong animate-blink"
            : "text-amber amber-glow"
        )}
      >
        {timeText}
      </span>
    </div>
  );
}
