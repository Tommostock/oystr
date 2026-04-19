/**
 * LastTrainBanner.tsx — Evening warning for a station's last train
 *
 * Only renders during late-evening hours and when the station has
 * a last-train fetch succeed. Shows the soonest-departing last train
 * with a live countdown so the user doesn't accidentally miss it.
 *
 * Uses useLastTrains under the hood which short-circuits outside of
 * the active window — so mounting this component cheaply outside
 * evening hours is safe (it just returns null).
 */

"use client";

import { MoonStar } from "lucide-react";
import { useLastTrains } from "@/hooks/useLastTrains";

interface LastTrainBannerProps {
  /** The station's NaPTAN ID to fetch last-train data for */
  stopId: string;
}

export default function LastTrainBanner({ stopId }: LastTrainBannerProps) {
  const { soonest, minsUntil } = useLastTrains(stopId);

  if (!soonest || minsUntil === null) return null;

  /* Heightened urgency when under 15 min. Colour nudges from amber to red. */
  const isImminent = minsUntil <= 15;

  return (
    <div
      className={`flex items-start gap-2 p-3 border ${
        isImminent
          ? "border-red-500/40 bg-red-500/10"
          : "border-amber/40 bg-amber/10"
      }`}
      role="status"
      aria-label={`Last train ${soonest.direction} at ${soonest.time}, in ${minsUntil} minutes`}
    >
      <MoonStar
        size={14}
        strokeWidth={1.5}
        className={`shrink-0 mt-0.5 ${
          isImminent ? "text-red-500" : "text-amber"
        }`}
      />
      <div className="flex-1 min-w-0">
        <div
          className={`font-mono text-xs tracking-wider uppercase ${
            isImminent
              ? "text-red-500 amber-glow"
              : "text-amber amber-glow"
          }`}
        >
          LAST TRAIN {soonest.direction.toUpperCase()}
        </div>
        <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mt-0.5">
          {soonest.time} -- IN {minsUntil} MIN
        </div>
      </div>
    </div>
  );
}
