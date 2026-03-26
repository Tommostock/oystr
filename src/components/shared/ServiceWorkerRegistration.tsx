/**
 * ServiceWorkerRegistration.tsx — Registers the service worker
 *
 * Registers /sw.js on mount for offline caching support.
 * Only registers in production (or when running from a server).
 * This is a client component that renders nothing — it just
 * runs the registration side effect.
 */

"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("SW registered:", reg.scope);
        })
        .catch((err) => {
          console.log("SW registration failed:", err);
        });
    }
  }, []);

  /* This component renders nothing — it's just a side effect */
  return null;
}
