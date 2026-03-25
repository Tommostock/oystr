/**
 * LoadingBoard.tsx — Dot-matrix loading animation
 *
 * Shows a blinking "LOADING..." message in amber monospace text,
 * just like a real departure board booting up or refreshing data.
 *
 * Usage:
 *   <LoadingBoard />
 *   <LoadingBoard message="FETCHING ARRIVALS" />
 */

import { cn } from "@/lib/utils";

interface LoadingBoardProps {
  /** Custom loading message (default: "LOADING...") */
  message?: string;
  /** Additional CSS classes */
  className?: string;
}

export default function LoadingBoard({
  message = "LOADING...",
  className,
}: LoadingBoardProps) {
  return (
    <div
      className={cn(
        /* Center the text in the container */
        "flex items-center justify-center py-8",
        className
      )}
    >
      <span
        className={cn(
          /* Amber text with glow, dot-matrix style */
          "text-amber amber-glow dot-matrix",
          /* Blink animation — like a cursor on a real board */
          "animate-blink",
          /* Font sizing */
          "text-sm tracking-widest"
        )}
        aria-label="Loading"
        role="status"
      >
        {message}
      </span>
    </div>
  );
}
