/**
 * useOffline.ts — Online/offline detection hook
 *
 * Returns true when the browser is offline, false when online.
 * Uses useSyncExternalStore subscribed to the browser's built-in
 * "online" / "offline" events so the UI updates immediately when
 * connectivity changes.
 *
 * Migrated off the older useState+useEffect-reads-navigator.onLine
 * pattern because it triggered the react-hooks/set-state-in-effect
 * lint rule (cascading renders on mount). useSyncExternalStore is
 * the React-team-recommended way to subscribe to browser APIs.
 *
 * Usage:
 *   const isOffline = useOffline();
 *   if (isOffline) { show cached data }
 */

"use client";

import { useSyncExternalStore } from "react";

/** Client snapshot — true when navigator says we're offline. */
function getSnapshot(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

/** Server snapshot — default to online during SSR (no navigator). */
function getServerSnapshot(): boolean {
  return false;
}

/** Subscribe to the browser's connectivity events. */
function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

export function useOffline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
