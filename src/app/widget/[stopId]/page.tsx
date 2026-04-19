/**
 * widget/[stopId]/page.tsx — Minimal "widget" view
 *
 * A stripped-down departures view designed to be:
 *   - Added to the iOS / Android home screen as a bookmark
 *   - Embedded in an iOS Shortcut (View in Rich Menu widget)
 *   - Opened in a small PWA window
 *
 * Shows only the next ~5 arrivals for a given station NaPTAN ID.
 * No bottom nav, no header, no search. Just the board.
 *
 * URL pattern:
 *   /widget/940GZZLUMLE                 → default (5 arrivals)
 *   /widget/940GZZLUMLE?rows=3          → custom row count
 *   /widget/940GZZLUMLE?name=Mile%20End → custom display name
 *
 * All TfL-standard NaPTAN IDs work. Hub IDs (HUBBAN, etc.) work too
 * via the same arrivals proxy.
 */

"use client";

import { use } from "react";
import { useArrivals } from "@/hooks/useArrivals";
import { LINE_COLOURS } from "@/lib/constants";
import ArrivalRow from "@/components/departure-board/ArrivalRow";

type WidgetPageProps = {
  params: Promise<{ stopId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Clean up a TfL destination name.
 */
function cleanName(name: string | undefined): string {
  if (!name) return "UNKNOWN";
  return name
    .replace(/\s*Underground Station$/i, "")
    .replace(/\s*DLR Station$/i, "")
    .replace(/\s*Rail Station$/i, "")
    .replace(/\s*\(London\)/i, "")
    .replace(/\s*Station$/i, "")
    .trim();
}

export default function WidgetPage({ params, searchParams }: WidgetPageProps) {
  /*
   * Next.js 15+ uses Promise-based params/searchParams on the
   * server — we use React.use() to unwrap on the client.
   */
  const { stopId } = use(params);
  const qp = use(searchParams);
  const rowsRaw = typeof qp.rows === "string" ? qp.rows : undefined;
  const nameRaw = typeof qp.name === "string" ? qp.name : undefined;
  const maxRows = rowsRaw ? Math.max(1, Math.min(8, parseInt(rowsRaw, 10) || 5)) : 5;

  const { arrivals, isLoading, error } = useArrivals(stopId);

  /*
   * Sort the flat arrivals list by time and take the soonest `maxRows`.
   * Widget view is intentionally flat — no platform grouping — because
   * in a small widget the direction labels take too much space.
   */
  const sorted = [...arrivals]
    .sort((a, b) => a.timeToStation - b.timeToStation)
    .slice(0, maxRows);

  const stationName = nameRaw || arrivals[0]?.stationName || "";

  return (
    <main className="min-h-[100dvh] bg-board-bg p-3">
      {/* Minimal header — station name only, no navigation chrome. */}
      {stationName && (
        <div className="border-b border-board-border pb-2 mb-2">
          <div className="font-board text-sm text-amber amber-glow tracking-wider uppercase truncate">
            {cleanName(stationName)}
          </div>
        </div>
      )}

      {/* Loading / error / empty states are compact one-liners to
          suit a small viewport. */}
      {isLoading && sorted.length === 0 && (
        <div className="py-4 text-center">
          <span className="font-mono text-xs tracking-wider text-amber animate-blink">
            LOADING...
          </span>
        </div>
      )}

      {!isLoading && error && sorted.length === 0 && (
        <div className="py-4 text-center">
          <span className="font-mono text-xs tracking-wider text-red-500">
            UNAVAILABLE
          </span>
        </div>
      )}

      {!isLoading && !error && sorted.length === 0 && (
        <div className="py-4 text-center">
          <span className="font-mono text-xs tracking-wider text-amber-faint">
            NO DEPARTURES
          </span>
        </div>
      )}

      {/* Arrival rows — reuses the shared ArrivalRow so the widget
          looks and feels like a slice of the main board. */}
      <div role="table" aria-label={`Departures from ${cleanName(stationName)}`}>
        {sorted.map((arrival, i) => (
          <ArrivalRow
            key={`${arrival.vehicleId}-${arrival.expectedArrival}-${i}`}
            destination={cleanName(arrival.destinationName)}
            timeToStation={arrival.timeToStation}
            expectedArrival={arrival.expectedArrival}
            lineColour={LINE_COLOURS[arrival.lineId]}
            routeNumber={arrival.lineName}
            modeName={arrival.modeName}
          />
        ))}
      </div>
    </main>
  );
}
