/**
 * stations/page.tsx — Station A-Z Directory
 *
 * A scrollable alphabetical list of all tube, DLR, Overground,
 * and Elizabeth line stations. Shows zone and line colour dots
 * for each station. Tap a station to view its live departures.
 *
 * Includes a letter jump bar on the right for quick navigation.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { LINE_COLOURS, LINE_NAMES } from "@/lib/constants";
import PageHeader from "@/components/shared/PageHeader";
import LoadingBoard from "@/components/shared/LoadingBoard";
import { cn } from "@/lib/utils";

interface Station {
  naptanId: string;
  name: string;
  zone: string;
  lines: string[];
  modes: string[];
}

/** All letters for the jump bar */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function StationsPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const router = useRouter();

  /* Fetch all stations on mount */
  useEffect(() => {
    async function fetchStations() {
      try {
        const resp = await fetch("/api/tfl/stations");
        if (resp.ok) {
          const data: Station[] = await resp.json();
          setStations(data);
        }
      } catch {
        /* Silent fail */
      } finally {
        setIsLoading(false);
      }
    }
    fetchStations();
  }, []);

  /* Filter stations by search text */
  const filtered = filter
    ? stations.filter((s) =>
        s.name.toLowerCase().includes(filter.toLowerCase())
      )
    : stations;

  /* Group by first letter */
  const grouped = new Map<string, Station[]>();
  for (const station of filtered) {
    const letter = station.name[0]?.toUpperCase() || "#";
    if (!grouped.has(letter)) grouped.set(letter, []);
    grouped.get(letter)!.push(station);
  }

  /* Jump to a letter section */
  const scrollToLetter = (letter: string) => {
    const el = sectionRefs.current.get(letter);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* Navigate to departures for a station */
  const handleStationClick = (station: Station) => {
    router.push(
      `/?stopId=${station.naptanId}&name=${encodeURIComponent(station.name)}`
    );
  };

  if (isLoading) {
    return (
      <div className="p-4 pt-8">
        <LoadingBoard message="LOADING STATIONS..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ---- Header ---- */}
      <div className="p-4 pb-2">
        <PageHeader title="Station A-Z" subtitle="BROWSE EVERY TUBE STATION" />

        {/* Search filter */}
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="FILTER STATIONS..."
          aria-label="Filter stations by name"
          className={cn(
            "w-full py-2.5 px-3",
            "bg-surface text-amber",
            "border-b-2 border-amber-faint focus:border-amber",
            "border-t-0 border-l-0 border-r-0",
            "font-mono text-sm tracking-wider",
            "placeholder:text-amber-faint placeholder:uppercase",
            "outline-none transition-colors duration-200"
          )}
        />

        <div className="font-mono text-xs tracking-wider text-amber-faint mt-2">
          {filtered.length} STATION{filtered.length !== 1 ? "S" : ""}
        </div>
      </div>

      {/* ---- Station list with letter jump bar ---- */}
      <div className="flex flex-1 overflow-hidden">
        {/* Scrollable station list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {Array.from(grouped.entries()).map(([letter, stationsInGroup]) => (
            <div
              key={letter}
              ref={(el) => {
                if (el) sectionRefs.current.set(letter, el);
              }}
            >
              {/* Letter header */}
              <div className="sticky top-0 bg-board-bg py-1.5 z-10 border-b border-board-border">
                <span className="font-board text-xl tracking-wider text-amber amber-glow">
                  {letter}
                </span>
              </div>

              {/* Stations in this letter group */}
              {stationsInGroup.map((station) => (
                <button
                  key={station.naptanId}
                  onClick={() => handleStationClick(station)}
                  className="w-full text-left flex items-center gap-3 py-2.5 border-b border-board-border/30 hover:bg-surface transition-colors"
                >
                  {/* Station name */}
                  <span className="font-mono text-sm tracking-wider text-amber uppercase truncate flex-1">
                    {station.name}
                  </span>

                  {/* Line colour dots */}
                  <div className="flex gap-0.5 shrink-0">
                    {station.lines.slice(0, 6).map((lineId) => (
                      <span
                        key={lineId}
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: LINE_COLOURS[lineId] || "#FF9500",
                        }}
                        title={LINE_NAMES[lineId] || lineId}
                      />
                    ))}
                  </div>

                  {/* Zone badge */}
                  {station.zone && (
                    <span className="shrink-0 font-mono text-xs tracking-wider text-amber amber-glow">
                      Z{station.zone}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Letter jump bar (right side) */}
        <div className="flex flex-col justify-center py-2 px-1 shrink-0">
          {ALPHABET.map((letter) => {
            const hasStations = grouped.has(letter);
            return (
              <button
                key={letter}
                onClick={() => scrollToLetter(letter)}
                disabled={!hasStations}
                className={cn(
                  "font-mono text-[9px] leading-tight py-px",
                  hasStations
                    ? "text-amber hover:text-amber-dim"
                    : "text-amber-faint/30"
                )}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
