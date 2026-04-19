/**
 * widget/status/page.tsx — Network status "widget" view
 *
 * A stripped-down line-status summary designed to be added to the
 * iOS / Android home screen as a bookmark, or pulled into a Scriptable
 * widget. Inspired by the TfL Go status widget but styled as a
 * dot-matrix board.
 *
 * Shows:
 *   - Big headline: "GOOD SERVICE" / "MINOR DELAYS" / "DISRUPTION"
 *   - Count of lines affected
 *   - Up to 4 specific disrupted lines with their status
 *   - Footer row with last-update time + a coloured dot per line
 *     (red dot = disrupted, line colour = good service)
 *
 * This view auto-refreshes every 60s while the page is visible.
 * iOS home-screen widgets can only refresh every ~15-60min, but
 * line status changes slowly enough that this is fine.
 *
 * URL pattern:
 *   /widget/status              → all lines (default)
 *   /widget/status?rows=2       → fewer disrupted line rows
 *   /widget/status?rows=6       → more disrupted line rows
 */

"use client";

import { use } from "react";
import { AlertTriangle } from "lucide-react";
import { useLineStatus } from "@/hooks/useLineStatus";
import { LINE_COLOURS, LINE_NAMES } from "@/lib/constants";
import type { LineStatus } from "@/lib/tfl-types";
import { cn } from "@/lib/utils";

type WidgetStatusPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Pick the worst severity across all lines.
 *   10        = Good Service
 *   7-9       = Minor delays / part-suspended
 *   0-6       = Severe delays / closures
 */
function worstSeverity(lines: LineStatus[]): number {
  let worst = 10;
  for (const line of lines) {
    const sev = line.lineStatuses?.[0]?.statusSeverity ?? 10;
    if (sev < worst) worst = sev;
  }
  return worst;
}

/**
 * One-word headline summarising the network state.
 */
function headlineFor(severity: number): string {
  if (severity === 10) return "GOOD SERVICE";
  if (severity >= 7) return "MINOR DELAYS";
  if (severity >= 3) return "DISRUPTION";
  return "MAJOR DISRUPTION";
}

/** Colour class for the headline text, matching the existing line cards. */
function headlineColourClass(severity: number): string {
  if (severity === 10) return "text-green-500";
  if (severity >= 7) return "text-amber amber-glow";
  return "text-red-500";
}

/** Short display name for compact rows (e.g. "Hammersmith & City" → "H'SMITH & CITY"). */
function shortName(lineId: string, fallback: string): string {
  const lookup: Record<string, string> = {
    "hammersmith-city": "H'SMITH & CITY",
    "waterloo-city": "WATERLOO & CITY",
    "london-overground": "OVERGROUND",
    "elizabeth": "ELIZABETH",
  };
  return (lookup[lineId] || LINE_NAMES[lineId] || fallback).toUpperCase();
}

function formatHHMM(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function WidgetStatusPage({ searchParams }: WidgetStatusPageProps) {
  const qp = use(searchParams);
  const rowsRaw = typeof qp.rows === "string" ? qp.rows : undefined;
  const maxRows = rowsRaw
    ? Math.max(0, Math.min(8, parseInt(rowsRaw, 10) || 4))
    : 4;

  const { lines, isLoading, error } = useLineStatus();

  /* ---- Loading ---- */
  if (isLoading && lines.length === 0) {
    return (
      <main className="min-h-[100dvh] bg-board-bg p-3 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <span className="font-mono text-xs tracking-wider text-amber animate-blink">
            LOADING...
          </span>
        </div>
      </main>
    );
  }

  /* ---- Error (no data at all) ---- */
  if (error && lines.length === 0) {
    return (
      <main className="min-h-[100dvh] bg-board-bg p-3 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <span className="font-mono text-xs tracking-wider text-red-500">
            UNAVAILABLE
          </span>
        </div>
      </main>
    );
  }

  const severity = worstSeverity(lines);
  const headline = headlineFor(severity);
  const disrupted = lines.filter(
    (l) => (l.lineStatuses?.[0]?.statusSeverity ?? 10) !== 10
  );
  /* Worst-first so the most important disruption is always visible. */
  const disruptedSorted = [...disrupted].sort(
    (a, b) =>
      (a.lineStatuses?.[0]?.statusSeverity ?? 10) -
      (b.lineStatuses?.[0]?.statusSeverity ?? 10)
  );
  const disruptedRows = disruptedSorted.slice(0, maxRows);
  const overflow = disrupted.length - disruptedRows.length;

  /* Sort the dot row alphabetically so the visual is stable between
     refreshes (otherwise dots would shuffle as severity changes). */
  const dotLines = [...lines].sort((a, b) =>
    (LINE_NAMES[a.id] || a.name).localeCompare(LINE_NAMES[b.id] || b.name)
  );

  return (
    <main className="min-h-[100dvh] bg-board-bg p-3 flex flex-col">
      <Header />

      {/* ---- Headline ---- */}
      <div className="mt-2">
        <div
          className={cn(
            "font-board text-2xl tracking-wider uppercase",
            headlineColourClass(severity)
          )}
        >
          {headline}
        </div>
        <div className="font-mono text-[11px] tracking-wider text-amber-faint uppercase mt-0.5">
          {disrupted.length === 0
            ? `ALL ${lines.length} LINES`
            : `${disrupted.length} OF ${lines.length} LINES AFFECTED`}
        </div>
      </div>

      {/* ---- Disrupted line list (only when there's something to show) ---- */}
      {disruptedRows.length > 0 && maxRows > 0 && (
        <div className="mt-3 space-y-1">
          {disruptedRows.map((line) => {
            const detail = line.lineStatuses?.[0];
            const sev = detail?.statusSeverity ?? 10;
            const status = detail?.statusSeverityDescription || "";
            const colour = LINE_COLOURS[line.id] || "#FF9500";
            return (
              <div
                key={line.id}
                className="flex items-center gap-2 font-mono text-[11px] tracking-wider uppercase"
              >
                <span
                  className="w-1 h-3 shrink-0"
                  style={{ backgroundColor: colour }}
                  aria-hidden="true"
                />
                <span className="text-amber truncate flex-1">
                  {shortName(line.id, line.name)}
                </span>
                <span
                  className={cn(
                    "shrink-0",
                    sev >= 7 ? "text-amber" : "text-red-500"
                  )}
                >
                  {status.toUpperCase()}
                </span>
              </div>
            );
          })}
          {overflow > 0 && (
            <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase pt-0.5">
              +{overflow} MORE
            </div>
          )}
        </div>
      )}

      {/* ---- Footer: time + per-line dots + alert badge ---- */}
      <div className="mt-auto pt-3 border-t border-board-border flex items-end gap-2">
        <div className="flex flex-col">
          <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
            OYSTR
          </span>
          <span className="font-mono text-xs tracking-wider text-amber amber-glow">
            {formatHHMM(new Date())}
          </span>
        </div>

        <div className="flex-1 flex flex-wrap gap-1 justify-end items-center">
          {dotLines.map((line) => {
            const sev = line.lineStatuses?.[0]?.statusSeverity ?? 10;
            const isDisrupted = sev !== 10;
            const colour = LINE_COLOURS[line.id] || "#FF9500";
            return (
              <span
                key={line.id}
                title={`${LINE_NAMES[line.id] || line.name}: ${
                  line.lineStatuses?.[0]?.statusSeverityDescription || ""
                }`}
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: isDisrupted ? "#ff3b30" : colour,
                }}
                aria-hidden="true"
              />
            );
          })}
        </div>

        {disrupted.length > 0 && (
          <AlertTriangle
            size={14}
            strokeWidth={1.75}
            className="text-red-500 shrink-0"
            aria-label={`${disrupted.length} lines disrupted`}
          />
        )}
      </div>
    </main>
  );
}

/** Tiny header bar — mirrors the departures widget so they feel related. */
function Header() {
  return (
    <div className="border-b border-board-border pb-2 flex items-center justify-between">
      <span className="font-board text-sm text-amber amber-glow tracking-wider uppercase">
        Status
      </span>
      <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
        Network
      </span>
    </div>
  );
}
