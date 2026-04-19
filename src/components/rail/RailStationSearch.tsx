/**
 * RailStationSearch.tsx — Autocomplete for UK National Rail stations
 *
 * Searches the bundled UK_RAIL_STATIONS list (no network required).
 * Styled to match the TfL StationSearch component — same amber
 * underline input, dropdown list, keyboard navigation.
 *
 * Differs from TfL StationSearch in:
 *   - Data is local (instant, offline-friendly) — no debounce needed
 *   - Shows CRS code badge next to each station name
 *   - Returns {crs, name} pairs instead of full naptan/line data
 *
 * Usage:
 *   <RailStationSearch
 *     label="FROM"
 *     onSelect={(s) => setFrom(s)}
 *     value={fromStation?.name}
 *   />
 */

"use client";

import { useState, useEffect, useRef, useCallback, useId } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchStations } from "@/lib/uk-rail-stations";
import type { UKRailStation } from "@/lib/rail-types";

/* ========================================
 * PROPS
 * ======================================== */
interface RailStationSearchProps {
  /** Label shown above the input (e.g. "FROM", "TO") */
  label?: string;
  /** Called when the user selects a station */
  onSelect: (station: UKRailStation) => void;
  /**
   * Called when the user clicks the clear (X) button.
   * Use this to null-out the parent's selected-station state so that
   * clearing the input also cancels any downstream filtering.
   */
  onClear?: () => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Controlled value — sets the input text from the parent */
  value?: string;
  /** Additional CSS classes */
  className?: string;
}

/* ========================================
 * COMPONENT
 * ======================================== */
export default function RailStationSearch({
  label,
  onSelect,
  onClear,
  placeholder = "Search UK rail station...",
  value,
  className,
}: RailStationSearchProps) {
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState<UKRailStation[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  /*
   * Unique listbox id for this component instance, so that when the
   * page renders multiple RailStationSearch instances (FROM and TO)
   * each input's aria-controls points at its own dropdown. React's
   * useId guarantees HTML-id uniqueness even under SSR.
   */
  const listboxId = useId();

  /* Sync when parent changes the value prop (e.g. on route swap) */
  useEffect(() => {
    if (value !== undefined) {
      setQuery(value);
    }
  }, [value]);

  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Filter stations as the user types. Runs on every keystroke —
   * no debounce needed because the search is local and instant.
   */
  const runSearch = useCallback((searchQuery: string) => {
    if (searchQuery.trim().length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    const matches = searchStations(searchQuery);
    setResults(matches);
    setIsOpen(matches.length > 0);
    setHighlightedIndex(matches.length > 0 ? 0 : -1);
  }, []);

  const handleInputChange = (newValue: string) => {
    setQuery(newValue);
    runSearch(newValue);
  };

  const handleSelect = (station: UKRailStation) => {
    setQuery(station.name);
    setIsOpen(false);
    setHighlightedIndex(-1);
    onSelect(station);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
    /* Notify the parent so it can clear its selected-station state —
       otherwise clearing the input would leave the downstream filter
       or board still bound to a station the user has dismissed. */
    onClear?.();
  };

  /* Keyboard navigation: arrow keys + enter + escape */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && results[highlightedIndex]) {
        handleSelect(results[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  /* Close dropdown on outside click */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {label && (
        <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mb-1.5">
          {label}
        </div>
      )}

      {/* ---- Search Input ---- */}
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
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "w-full pl-10 pr-10 py-3",
            "bg-surface text-amber",
            "border-b-2 border-amber-faint focus:border-amber",
            "border-t-0 border-l-0 border-r-0",
            "font-mono text-sm tracking-wider",
            "placeholder:text-amber-faint placeholder:uppercase",
            "outline-none",
            "transition-colors duration-200"
          )}
          aria-label={label ? `${label} rail station` : "Search rail station"}
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          role="combobox"
        />

        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 text-amber-faint hover:text-amber transition-colors"
            aria-label="Clear search"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* ---- Autocomplete Dropdown ---- */}
      {isOpen && results.length > 0 && (
        <ul
          id={listboxId}
          className={cn(
            "absolute z-50 w-full mt-1",
            "bg-surface border border-board-border",
            "max-h-64 overflow-y-auto"
          )}
          role="listbox"
        >
          {results.map((station, index) => (
            <li key={station.crs}>
              <button
                onClick={() => handleSelect(station)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={cn(
                  "w-full text-left px-4 py-3",
                  "font-mono text-sm tracking-wider",
                  "border-b border-board-border last:border-b-0",
                  "transition-colors duration-150",
                  highlightedIndex === index
                    ? "bg-board-border text-amber"
                    : "text-amber hover:bg-board-border"
                )}
                role="option"
                aria-selected={highlightedIndex === index}
              >
                <div className="flex items-center gap-2 uppercase">
                  <span className="truncate flex-1">{station.name}</span>
                  {/* CRS code pill on the right */}
                  <span className="shrink-0 font-mono text-[10px] tracking-wider text-amber-faint border border-amber-faint px-1.5 py-0.5">
                    {station.crs}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ---- No results message ---- */}
      {isOpen && results.length === 0 && query.length >= 1 && (
        <div className="absolute z-50 w-full mt-1 bg-surface border border-board-border px-4 py-3">
          <span className="text-amber-faint font-mono text-sm tracking-wider">
            NO STATIONS FOUND
          </span>
        </div>
      )}
    </div>
  );
}
