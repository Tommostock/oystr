/**
 * rail/station/[crs]/page.tsx — Focused National Rail station view
 *
 * Styled to match the Depart page's tube station view: big amber
 * station name header with a Save button and CRS badge, followed by
 * the live departure board and the usual calling-points popup.
 *
 * Entry points:
 *   - Tapping a National Rail result in the Depart search dropdown
 *   - Tapping a saved rail station card on Depart
 *
 * This is distinct from the main /rail route, which is the multi-panel
 * "plan, track and save routes" surface. That page stays as-is; this
 * one is just "here is a station, here are its departures".
 */

"use client";

import { use, useState, useCallback } from "react";
import { mutate } from "swr";
import PageHeader from "@/components/shared/PageHeader";
import PullToRefresh from "@/components/shared/PullToRefresh";
import RailDepartureBoard from "@/components/rail/RailDepartureBoard";
import ServiceDetailSheet from "@/components/rail/ServiceDetailSheet";
import SaveRailStationButton from "@/components/rail/SaveRailStationButton";
import { getStationName } from "@/lib/uk-rail-stations";
import type { RailDeparture } from "@/lib/rail-types";

interface PageProps {
  /*
   * In Next.js 15 dynamic route params are a promise; `use()` unwraps
   * it inside this client component without requiring async/await.
   */
  params: Promise<{ crs: string }>;
}

export default function RailStationPage({ params }: PageProps) {
  const { crs: rawCrs } = use(params);
  const crs = rawCrs.toUpperCase();

  /*
   * We look up the display name from the bundled UK rail list. If the
   * CRS isn't in the list (rare — mostly small regional stops) we fall
   * back to the CRS itself so the header still renders.
   */
  const stationName = getStationName(crs);
  const resolvedName = stationName === crs ? crs : stationName;

  /* Open a specific service's calling points in the popup. */
  const [expandedDeparture, setExpandedDeparture] =
    useState<RailDeparture | null>(null);

  /* Pull-to-refresh invalidates all rail-departures SWR keys. */
  const handlePullRefresh = useCallback(async () => {
    await mutate(
      (key) =>
        typeof key === "string" && key.startsWith("/api/rail/departures"),
      undefined,
      { revalidate: true }
    );
  }, []);

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
      <div className="p-4 space-y-4">
        <PageHeader
          title="National Rail"
          subtitle="LIVE DEPARTURES"
          back={{ href: "/", label: "TERMINAL", ariaLabel: "Back to Terminal" }}
        />

        {/* ---- Station header card — mirrors the tube station panel on Depart ---- */}
        <div className="border border-board-border bg-surface p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 min-w-0 flex-1">
              <h2 className="font-board text-2xl tracking-wider text-amber uppercase amber-glow break-words">
                {resolvedName
                  .replace(/\s*Rail Station$/i, "")
                  .replace(/\s*\(London\)/i, "")}
              </h2>
              <span className="shrink-0 border border-amber-faint text-amber font-mono text-xs tracking-wider px-1.5 py-0.5">
                {crs}
              </span>
            </div>
            <SaveRailStationButton station={{ crs, name: resolvedName }} />
          </div>
          <p className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
            NATIONAL RAIL -- LIVE BOARD
          </p>
        </div>

        {/* ---- Live departures board ---- */}
        <RailDepartureBoard
          fromCrs={crs}
          fromName={resolvedName}
          maxRows={10}
          onServiceTap={setExpandedDeparture}
        />

        {/* ---- Service detail popup ---- */}
        <ServiceDetailSheet
          departure={expandedDeparture}
          fromCrs={crs}
          fromName={resolvedName}
          onClose={() => setExpandedDeparture(null)}
        />
      </div>
    </PullToRefresh>
  );
}
