/**
 * AirportTransportPanel.tsx — "GETTING HERE" panel on an airport page
 *
 * Shows the curated ground-transport options for a given airport
 * (tube / Elizabeth line / DLR / National Rail). Each row links back
 * into Oystr's own boards so the user can see live departures for
 * the relevant feeder station — e.g. "Heathrow Express" opens the
 * Paddington rail board.
 *
 * Rendered only for airports we have curated data for (the 5 main
 * London ones). The caller suppresses the panel entirely when
 * `getTransportOptions(iata)` returns null.
 */

"use client";

import Link from "next/link";
import { ArrowRight, TrainFront, Zap } from "lucide-react";
import BoardPanel from "@/components/shared/BoardPanel";
import { getTransportOptions, type AirportTransportOption } from "@/lib/airport-transport";

interface AirportTransportPanelProps {
  iata: string;
}

/**
 * Pick an icon + colour class for the transport mode's kind. Matches
 * the app's semantic palette so tube-derived modes read the same
 * way they do in the rest of the app.
 */
function iconFor(kind: AirportTransportOption["kind"]) {
  switch (kind) {
    case "elizabeth":
      // Elizabeth line colour (#6950A1)
      return (
        <Zap size={12} strokeWidth={1.5} style={{ color: "#6950A1" }} />
      );
    case "piccadilly":
      // Piccadilly line colour (#003688) — a little too dark for contrast,
      // so we tint brighter for the icon only.
      return (
        <Zap size={12} strokeWidth={1.5} style={{ color: "#3d6fb0" }} />
      );
    case "dlr":
      // DLR teal (#00A4A7)
      return (
        <Zap size={12} strokeWidth={1.5} style={{ color: "#00A4A7" }} />
      );
    case "rail":
    default:
      return <TrainFront size={12} strokeWidth={1.5} className="text-amber" />;
  }
}

export default function AirportTransportPanel({
  iata,
}: AirportTransportPanelProps) {
  const options = getTransportOptions(iata);
  if (!options || options.length === 0) return null;

  return (
    <BoardPanel title="GETTING HERE">
      <div className="divide-y divide-board-border">
        {options.map((opt, i) => (
          <Link
            key={`${opt.mode}-${i}`}
            href={opt.href}
            className="flex items-start gap-3 px-3 py-2.5 hover:bg-board-border/30 transition-colors"
            aria-label={`${opt.mode} ${opt.from}`}
          >
            <div className="shrink-0 pt-1">{iconFor(opt.kind)}</div>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-board text-sm tracking-wider text-amber amber-glow uppercase">
                  {opt.mode}
                </span>
                <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
                  {opt.duration}
                </span>
              </div>
              <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mt-0.5 truncate">
                {opt.from}
              </div>
              {opt.note && (
                <div className="font-mono text-[9px] tracking-wider text-amber-faint/70 uppercase mt-0.5 truncate">
                  {opt.note}
                </div>
              )}
            </div>

            <ArrowRight
              size={14}
              strokeWidth={1.5}
              className="shrink-0 text-amber-faint self-center"
            />
          </Link>
        ))}
      </div>
    </BoardPanel>
  );
}
