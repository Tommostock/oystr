/**
 * flights/page.tsx — Flights tab (placeholder)
 *
 * Reserved for future live-flight tracking (Heathrow, Gatwick,
 * London City, Stansted, Luton). Intentionally a static placeholder
 * for now — no hooks, no fetches — so the tab is immediately
 * reachable and works fully offline.
 *
 * Styled to mirror the COMING SOON treatment the Rail tab used
 * before its data provider was wired up, for visual consistency.
 */

"use client";

import { Plane, Mail } from "lucide-react";
import AmberText from "@/components/shared/AmberText";
import BoardPanel from "@/components/shared/BoardPanel";

export default function FlightsPage() {
  return (
    <div className="p-4 space-y-4">
      {/* ---- Page Header ---- */}
      <div className="text-center pt-4 pb-2">
        <AmberText as="h1" size="lg" uppercase className="dot-matrix">
          Flights
        </AmberText>
        <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mt-1">
          LONDON AIRPORT LIVE DEPARTURES
        </div>
      </div>

      {/* ---- Coming Soon board ---- */}
      <BoardPanel title="SERVICE STATUS">
        <div className="py-8 text-center space-y-5">
          {/* Animated plane icon in amber */}
          <div className="flex justify-center">
            <div className="relative">
              <Plane
                size={56}
                strokeWidth={1.25}
                className="text-amber amber-glow"
              />
              {/* Subtle pulse underneath */}
              <div
                className="absolute inset-0 -z-10 blur-xl opacity-40"
                style={{
                  background:
                    "radial-gradient(circle, #ff9500 0%, transparent 70%)",
                }}
                aria-hidden="true"
              />
            </div>
          </div>

          <div>
            <AmberText
              as="p"
              size="2xl"
              uppercase
              className="dot-matrix animate-blink"
            >
              COMING SOON
            </AmberText>
          </div>

          <div className="space-y-3 px-4">
            <p className="font-mono text-xs tracking-wider text-amber uppercase leading-relaxed">
              LIVE DEPARTURES FOR
              <br />
              LONDON HEATHROW
              <br />
              LONDON GATWICK
              <br />
              LONDON CITY
              <br />
              LONDON STANSTED
              <br />
              LONDON LUTON
            </p>

            <div className="border-t border-board-border mx-6 pt-3">
              <p className="font-mono text-[11px] tracking-wider text-amber-faint uppercase leading-relaxed">
                FLIGHT TRACKING
                <br />
                UNDER CONSTRUCTION
              </p>
            </div>
          </div>
        </div>
      </BoardPanel>

      {/* ---- Info panel: what's coming ---- */}
      <BoardPanel title="WHAT TO EXPECT">
        <ul className="space-y-2.5 font-mono text-xs tracking-wider text-amber-dim">
          <li className="flex gap-3">
            <span className="text-amber shrink-0">&gt;</span>
            <span>LIVE DEPARTURE BOARDS FOR LONDON AIRPORTS</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber shrink-0">&gt;</span>
            <span>TRACK A SPECIFIC FLIGHT BY NUMBER</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber shrink-0">&gt;</span>
            <span>GATE, TERMINAL, AND STATUS UPDATES</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber shrink-0">&gt;</span>
            <span>PINNED JOURNEYS ACROSS RAIL AND AIR</span>
          </li>
        </ul>
      </BoardPanel>

      {/* ---- Footer hint ---- */}
      <div className="text-center py-2">
        <div className="inline-flex items-center gap-2 font-mono text-[10px] tracking-wider text-amber-faint uppercase">
          <Mail size={12} strokeWidth={1.5} />
          <span>WATCH THIS SPACE</span>
        </div>
      </div>
    </div>
  );
}
