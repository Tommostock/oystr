/**
 * useOffline.ts — Online/offline detection hook
 *
 * Returns true when the browser is offline, false when online.
 * Listens for the browser's built-in 'online' and 'offline' events
 * so the UI updates immediately when connectivity changes.
 *
 * Usage:
 *   const isOffline = useOffline();
 *   if (isOffline) { show cached data }
 */

"use client";

import { useState, useEffect } from "react";

export function useOffline(): boolean {
  /*
   * Start with the current online status.
   * navigator.onLine is a built-in browser property.
   * We default to false (online) during server-side rendering
   * since there's no navigator on the server.
   */
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    /* Set the initial state now that we're in the browser */
    setIsOffline(!navigator.onLine);

    /* Event handlers for when connectivity changes */
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    /* Listen for the browser's connectivity events */
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    /* Clean up event listeners when the component unmounts */
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOffline;
}
