/**
 * useFlightQuota.ts — Reactive read of the local flight-quota counter
 *
 * Reads the localStorage-backed counter (see lib/flight-quota.ts) and
 * re-checks periodically so any request made elsewhere in the app
 * bubbles up to components that want to show banners. Kept to a
 * coarse 30-second poll because the counter only moves when a flight
 * hook fires — there's no value in sub-second precision.
 */

"use client";

import { useEffect, useState } from "react";
import {
  getQuota,
  QUOTA_LIMIT,
  QUOTA_WARN,
  QUOTA_HARD_STOP,
} from "@/lib/flight-quota";

export interface FlightQuotaState {
  count: number;
  limit: number;
  warnThreshold: number;
  stopThreshold: number;
  warning: boolean;
  exhausted: boolean;
  monthKey: string;
}

export function useFlightQuota(): FlightQuotaState {
  const [snap, setSnap] = useState<FlightQuotaState>(() => {
    const q = getQuota();
    return {
      count: q.count,
      limit: QUOTA_LIMIT,
      warnThreshold: QUOTA_WARN,
      stopThreshold: QUOTA_HARD_STOP,
      warning: q.count >= QUOTA_WARN,
      exhausted: q.count >= QUOTA_HARD_STOP,
      monthKey: q.monthKey,
    };
  });

  useEffect(() => {
    const tick = () => {
      const q = getQuota();
      setSnap({
        count: q.count,
        limit: QUOTA_LIMIT,
        warnThreshold: QUOTA_WARN,
        stopThreshold: QUOTA_HARD_STOP,
        warning: q.count >= QUOTA_WARN,
        exhausted: q.count >= QUOTA_HARD_STOP,
        monthKey: q.monthKey,
      });
    };
    tick();
    const id = setInterval(tick, 30_000);
    // Also re-check when the tab becomes visible — a request might
    // have fired in another tab on the same origin while hidden.
    const onVis = () => tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return snap;
}
