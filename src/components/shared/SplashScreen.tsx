/**
 * SplashScreen.tsx — Branded loading screen
 *
 * Shows an amber "OYSTR" logo with a blinking cursor animation
 * while the app loads. Simulates a real dot-matrix board powering on.
 *
 * Automatically fades out after a brief delay to reveal the app.
 * Only shows on the very first render (not on subsequent navigations).
 */

"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const pathname = usePathname();

  /*
   * Widget embeds should skip the splash — they live inside an iOS
   * home-screen widget / bookmark and the blinking "OYSTR" logo
   * would be confusing in that tiny context. Bailing here means the
   * splash never mounts state/timers on widget routes.
   */
  const isWidget = pathname?.startsWith("/widget") ?? false;

  useEffect(() => {
    if (isWidget) {
      setVisible(false);
      return;
    }
    /* Don't show splash if user has already seen it this session */
    if (sessionStorage.getItem("oystr-splash-seen")) {
      setVisible(false);
      return;
    }

    /* Start fade-out after 1.5 seconds */
    const fadeTimer = setTimeout(() => setFadeOut(true), 1500);

    /* Remove from DOM after fade animation completes */
    const removeTimer = setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem("oystr-splash-seen", "true");
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [isWidget]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-board-bg"
      style={{
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 0.5s ease-out",
      }}
    >
      {/* Scanline overlay for authenticity */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 3px)",
          opacity: 0.06,
        }}
      />

      {/* Logo text */}
      <div
        className="font-board text-6xl tracking-[0.2em] uppercase text-amber"
        style={{
          textShadow: "0 0 20px rgba(255, 149, 0, 0.6), 0 0 40px rgba(255, 149, 0, 0.3)",
          animation: "splash-glow 1.5s ease-in-out",
        }}
      >
        OYSTR
      </div>

      {/* Subtitle */}
      <div
        className="mt-3 font-mono text-xs tracking-[0.15em] text-amber-dim uppercase"
        style={{
          animation: "splash-subtitle 1.5s ease-in-out",
        }}
      >
        LONDON TRANSPORT
      </div>

      {/* Blinking cursor — simulates board boot-up */}
      <div className="mt-8 font-mono text-sm tracking-wider text-amber-faint animate-blink">
        INITIALISING...
      </div>
    </div>
  );
}
