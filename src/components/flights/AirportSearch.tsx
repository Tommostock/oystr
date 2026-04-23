/**
 * AirportSearch.tsx — Autocomplete input for airports worldwide
 *
 * Searches the bundled AIRPORTS list (no network needed) by name,
 * city, or IATA code. Styled to match RailStationSearch — amber
 * underline input, dropdown list, click-outside to dismiss.
 *
 * Ranked by exact IATA match, then starts-with on name or city,
 * then contains. See searchAirports() for the full ordering.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X, Plane } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchAirports } from "@/lib/airports";
import type { Airport } from "@/lib/flight-types";

interface AirportSearchProps {
  /** Called when the user picks a result. */
  onSelect: (airport: Airport) => void;
  /** Controlled input value (e.g. to display the currently selected airport). */
  value?: string;
  placeholder?: string;
  className?: string;
}

export default function AirportSearch({
  onSelect,
  value,
  placeholder = "Search any airport...",
  className,
}: AirportSearchProps) {
  const [query, setQuery] = useState(value ?? "");
  const [results, setResults] = useState<Airport[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  /* Sync controlled value in. */
  useEffect(() => {
    if (value !== undefined) setQuery(value);
  }, [value]);

  /*
   * Bundled search is instant — no need to debounce or hit the
   * network. Runs whenever query changes.
   */
  const runSearch = useCallback((q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    const hits = searchAirports(q);
    setResults(hits);
    setIsOpen(hits.length > 0);
  }, []);

  const handleInputChange = (v: string) => {
    setQuery(v);
    runSearch(v);
  };

  const handleSelect = (airport: Airport) => {
    setQuery(`${airport.name}${airport.city ? ` -- ${airport.city}` : ""}`);
    setIsOpen(false);
    onSelect(airport);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  /* Close dropdown on outside click. */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative flex items-center">
        <Search
          size={16}
          className="absolute left-3 text-amber-faint"
          strokeWidth={1.5}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className={cn(
            "w-full pl-10 pr-10 py-3",
            "bg-surface text-amber",
            "border-b-2 border-amber-faint focus:border-amber",
            "border-t-0 border-l-0 border-r-0",
            /* 16px minimum — prevents iOS Safari auto-zoom on focus. */
            "font-mono text-base tracking-wider",
            "placeholder:text-amber-faint placeholder:uppercase",
            "outline-none transition-colors duration-200"
          )}
          aria-label="Search for an airport"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          role="combobox"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 text-amber-faint hover:text-amber transition-colors"
            aria-label="Clear airport search"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul
          className={cn(
            "absolute z-50 w-full mt-1",
            "bg-surface border border-board-border",
            "max-h-72 overflow-y-auto"
          )}
          role="listbox"
        >
          {results.map((airport) => (
            <li key={airport.iata}>
              <button
                onClick={() => handleSelect(airport)}
                className={cn(
                  "w-full text-left px-4 py-3",
                  "text-amber hover:bg-board-border",
                  "font-mono text-sm tracking-wider",
                  "border-b border-board-border last:border-b-0",
                  "transition-colors duration-150"
                )}
                role="option"
              >
                <div className="flex items-center gap-2 uppercase">
                  <Plane
                    size={14}
                    strokeWidth={1.5}
                    className="shrink-0 text-amber"
                    aria-hidden="true"
                  />
                  <span className="truncate flex-1">
                    {airport.city ? `${airport.city} -- ` : ""}
                    {airport.name}
                  </span>
                  <span className="shrink-0 border border-amber-faint text-amber-faint text-xs font-mono px-1.5 py-0.5">
                    {airport.iata}
                  </span>
                </div>
                {airport.country && (
                  <div className="text-amber-faint text-xs mt-1 uppercase">
                    {airport.country}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {isOpen && results.length === 0 && query.trim().length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-surface border border-board-border px-4 py-3">
          <span className="text-amber-faint font-mono text-sm tracking-wider">
            NO AIRPORTS FOUND
          </span>
        </div>
      )}
    </div>
  );
}
