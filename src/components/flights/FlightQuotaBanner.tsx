/**
 * FlightQuotaBanner.tsx — Warning / exhausted banner for flight API
 *
 * The AeroDataBox free tier is 150 requests/month. We track our
 * usage locally (best-effort, localStorage-backed) and surface a
 * banner once we cross the warn or stop threshold so the user
 * isn't surprised by a silent dead API.
 *
 * Only visible once the counter is past the warn threshold, so it
 * doesn't add clutter during normal use.
 */

"use client";

import { AlertTriangle } from "lucide-react";
import { useFlightQuota } from "@/hooks/useFlightQuota";

export default function FlightQuotaBanner() {
  const quota = useFlightQuota();

  if (!quota.warning) return null;

  const remaining = Math.max(0, quota.limit - quota.count);
  const isExhausted = quota.exhausted;

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        "flex items-start gap-2 px-3 py-2 border font-mono text-[10px] tracking-wider uppercase " +
        (isExhausted
          ? "border-bad text-bad bg-bad/10"
          : "border-amber text-amber bg-amber/10 amber-glow")
      }
    >
      <AlertTriangle
        size={14}
        strokeWidth={1.5}
        className="shrink-0 mt-0.5"
      />
      <div className="flex-1 leading-relaxed">
        {isExhausted ? (
          <>
            <div>FLIGHT API QUOTA EXHAUSTED</div>
            <div className="text-amber-faint normal-case mt-1">
              Used {quota.count} / {quota.limit} this month. Live flight
              data is paused until the monthly reset. Saved cards show
              the last snapshot; pull-to-refresh will not fetch.
            </div>
          </>
        ) : (
          <>
            <div>
              FLIGHT API NEAR LIMIT · {remaining} REQUESTS LEFT
            </div>
            <div className="text-amber-faint normal-case mt-1">
              Used {quota.count} / {quota.limit} this month. Background
              polling is slowing to conserve the remainder.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
