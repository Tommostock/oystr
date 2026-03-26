/**
 * PullToRefresh.tsx — Pull-to-refresh wrapper for mobile
 *
 * Wraps content in a container that detects pull-down gestures.
 * When the user pulls down far enough and releases, it calls
 * the onRefresh callback (which typically triggers an SWR mutate).
 *
 * Shows a "REFRESHING..." indicator while the refresh is happening.
 *
 * Usage:
 *   <PullToRefresh onRefresh={async () => await mutate()}>
 *     <DepartureBoard ... />
 *   </PullToRefresh>
 */

"use client";

import { useState, useRef, useCallback } from "react";

interface PullToRefreshProps {
  /** Called when the user completes a pull-to-refresh gesture */
  onRefresh: () => Promise<unknown>;
  /** The content to wrap */
  children: React.ReactNode;
}

/** Minimum pull distance (in pixels) to trigger a refresh */
const PULL_THRESHOLD = 60;

export default function PullToRefresh({
  onRefresh,
  children,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    /* Only track pulls when scrolled to the top */
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    /* Only allow pulling down (positive dy), with resistance */
    if (dy > 0 && touchStartY.current > 0) {
      setPullDistance(Math.min(dy * 0.4, PULL_THRESHOLD * 1.5));
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD * 0.5);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
    touchStartY.current = 0;
  }, [pullDistance, isRefreshing, onRefresh]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden transition-all duration-150"
          style={{ height: pullDistance || (isRefreshing ? 32 : 0) }}
        >
          <span className="font-mono text-xs tracking-wider text-amber-faint animate-blink">
            {isRefreshing ? "REFRESHING..." : pullDistance >= PULL_THRESHOLD ? "RELEASE TO REFRESH" : "PULL TO REFRESH"}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
