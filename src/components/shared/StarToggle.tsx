/**
 * StarToggle.tsx — Save/unsave star button primitive
 *
 * The amber Star toggle used on every "save this" affordance in the
 * app — tube station header, rail station header, airport header.
 * Before this existed, three near-identical components
 * (SaveStationButton, SaveRailStationButton, SaveAirportButton) each
 * re-rolled the same icon, spacing, aria labels, and glow colours.
 *
 * This component owns the visual; callers own the data (which hook
 * to read, what to toggle). Each kind-specific button is now a thin
 * wrapper that reads its hook and delegates the rendering here.
 */

"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarToggleProps {
  /** Whether the item is currently pinned. Drives the fill + glow. */
  saved: boolean;
  /** Called when the user taps. May be async — parent handles await. */
  onToggle: () => void | Promise<void>;
  /** Display name — used to build helpful aria labels. */
  label: string;
  /** Disables the button while an in-flight toggle completes. */
  disabled?: boolean;
  /** Visual size of the star icon (default 22px). */
  size?: number;
  /** Extra classes forwarded to the button. */
  className?: string;
}

export default function StarToggle({
  saved,
  onToggle,
  label,
  disabled = false,
  size = 22,
  className,
}: StarToggleProps) {
  return (
    <button
      onClick={() => onToggle()}
      disabled={disabled}
      className={cn(
        "shrink-0 p-2 transition-colors",
        saved
          ? "text-amber amber-glow hover:text-amber-dim"
          : "text-amber-faint hover:text-amber",
        className
      )}
      aria-label={saved ? `Remove ${label} from saved` : `Save ${label}`}
      title={saved ? "Remove from saved" : "Save"}
    >
      <Star size={size} strokeWidth={1.5} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}
