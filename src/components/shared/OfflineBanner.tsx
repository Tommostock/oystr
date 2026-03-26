/**
 * OfflineBanner.tsx — Offline status indicator
 *
 * Shows a persistent amber banner at the top of the screen
 * when the user has no internet connection.
 * Styled like the dot-matrix message boards above platforms.
 *
 * This component is only rendered when offline — it checks
 * the browser's online/offline status using the useOffline hook.
 *
 * Usage:
 *   <OfflineBanner />
 *   (Place in layout.tsx — it handles its own visibility)
 */

"use client";

import { useOffline } from "@/hooks/useOffline";
import { cn } from "@/lib/utils";

export default function OfflineBanner() {
  /* Check if the browser is offline */
  const isOffline = useOffline();

  /* Don't render anything if we're online */
  if (!isOffline) return null;

  return (
    <div
      className={cn(
        /* Full width, dark background, amber text */
        "w-full bg-surface border-b border-board-border",
        /* Padding and centered text */
        "px-4 py-2 text-center",
        /* Fixed to top so it's always visible */
        "sticky top-0 z-40"
      )}
      role="alert"
      aria-live="polite"
    >
      <span className="text-amber amber-glow dot-matrix text-xs tracking-widest">
        NO CONNECTION -- LIVE DATA UNAVAILABLE
      </span>
    </div>
  );
}
