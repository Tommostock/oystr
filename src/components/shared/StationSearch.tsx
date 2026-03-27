/**
 * StationSearch.tsx — Station search with autocomplete dropdown
 *
 * A search input that queries the TfL API as the user types.
 * Shows a dropdown list of matching stations.
 * When a station is selected, it calls the onSelect callback.
 *
 * Styled like a dot-matrix terminal input:
 *   - Dark background
 *   - Amber text
 *   - Amber underline border (not full border)
 *   - Wide letter-spacing
 *
 * Usage:
 *   <StationSearch
 *     onSelect={(station) => setSelectedStation(station)}
 *     placeholder="Search for a station..."
 *   />
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ========================================
 * TYPES
 * ======================================== */

/** Shape of a station result from our search API */
interface SearchResult {
  naptanId: string;
  name: string;
  lat: number;
  lon: number;
  modes: string[];
  lines: { id: string; name: string }[];
  /** TfL fare zone (e.g. "1", "2/3") */
  zone?: string;
  /** Bus stop letter (e.g. "H") — only for bus stops */
  stopLetter?: string;
  /** Bus stop indicator text (e.g. "Stop H") — only for bus stops */
  indicator?: string;
}

interface StationSearchProps {
  /** Called when the user selects a station from the dropdown */
  onSelect: (station: SearchResult) => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Controlled value — sets the input text from the parent (e.g. after swap) */
  value?: string;
  /** Additional CSS classes */
  className?: string;
}

/* ========================================
 * COMPONENT
 * ======================================== */
export default function StationSearch({
  onSelect,
  placeholder = "Search for a station...",
  value,
  className,
}: StationSearchProps) {
  /* The current text in the search input */
  const [query, setQuery] = useState(value || "");
  /* The list of matching stations from the API */
  const [results, setResults] = useState<SearchResult[]>([]);
  /* Whether the dropdown is visible */
  const [isOpen, setIsOpen] = useState(false);
  /* Whether we're waiting for API results */
  const [isSearching, setIsSearching] = useState(false);

  /*
   * Sync the input text when the parent changes the value prop.
   * This happens when the journey planner swaps From/To stations.
   */
  useEffect(() => {
    if (value !== undefined) {
      setQuery(value);
    }
  }, [value]);

  /* Ref to the container div — used to detect clicks outside */
  const containerRef = useRef<HTMLDivElement>(null);
  /* Ref to track the debounce timer */
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Search the TfL API for stations matching the query.
   * Debounced to avoid making too many API calls while typing.
   */
  const searchStations = useCallback(async (searchQuery: string) => {
    /* Don't search if the query is too short */
    if (searchQuery.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch(
        `/api/tfl/search?query=${encodeURIComponent(searchQuery.trim())}`
      );

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data: SearchResult[] = await response.json();
      setResults(data);
      setIsOpen(data.length > 0);
    } catch (error) {
      console.error("Station search error:", error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  /**
   * Handle input changes with debouncing.
   * Waits 300ms after the user stops typing before searching.
   * This prevents making an API call for every single keystroke.
   */
  const handleInputChange = (value: string) => {
    setQuery(value);

    /* Clear any pending search */
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    /* Schedule a new search after 300ms of no typing */
    debounceRef.current = setTimeout(() => {
      searchStations(value);
    }, 300);
  };

  /**
   * Handle selecting a station from the dropdown.
   */
  const handleSelect = (station: SearchResult) => {
    /* Update the input to show the selected station name */
    setQuery(station.name);
    /* Close the dropdown */
    setIsOpen(false);
    /* Tell the parent component about the selection */
    onSelect(station);
  };

  /**
   * Clear the search input and results.
   */
  const handleClear = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  /**
   * Close the dropdown when clicking outside the component.
   */
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

  /* Clean up the debounce timer on unmount */
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* ---- Search Input ---- */}
      <div className="relative flex items-center">
        {/* Search icon on the left */}
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
            /* Full width with padding for icons */
            "w-full pl-10 pr-10 py-3",
            /* Dark background, amber text */
            "bg-surface text-amber",
            /* Only bottom border (amber underline style) */
            "border-b-2 border-amber-faint focus:border-amber",
            "border-t-0 border-l-0 border-r-0",
            /* Mono font with wide spacing, like a terminal */
            "font-mono text-sm tracking-wider",
            /* Placeholder styling */
            "placeholder:text-amber-faint placeholder:uppercase",
            /* Remove default focus outline, we use the border instead */
            "outline-none",
            /* Smooth transition on border colour */
            "transition-colors duration-200"
          )}
          aria-label="Search for a station"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          role="combobox"
        />

        {/* Clear button — only shown when there's text */}
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

      {/* ---- Searching indicator ---- */}
      {isSearching && (
        <div className="mt-1 text-amber-faint text-xs font-mono tracking-wider animate-blink">
          SEARCHING...
        </div>
      )}

      {/* ---- Autocomplete Dropdown ---- */}
      {isOpen && results.length > 0 && (
        <ul
          className={cn(
            /* Position below the input */
            "absolute z-50 w-full mt-1",
            /* Dark panel styling */
            "bg-surface border border-board-border",
            /* Scrollable if many results */
            "max-h-64 overflow-y-auto"
          )}
          role="listbox"
        >
          {results.map((station) => (
            <li key={station.naptanId}>
              <button
                onClick={() => handleSelect(station)}
                className={cn(
                  /* Full width button */
                  "w-full text-left px-4 py-3",
                  /* Amber text with hover highlight */
                  "text-amber hover:bg-board-border",
                  /* Mono font styling */
                  "font-mono text-sm tracking-wider",
                  /* Divider between items */
                  "border-b border-board-border last:border-b-0",
                  /* Smooth hover transition */
                  "transition-colors duration-150"
                )}
                role="option"
              >
                {/* Station name with optional stop letter badge and zone */}
                <div className="flex items-center gap-2 uppercase">
                  {/* Bus stop letter badge — e.g. [H] */}
                  {station.stopLetter && (
                    <span className="shrink-0 w-6 h-6 flex items-center justify-center border border-amber text-amber text-xs font-mono">
                      {station.stopLetter}
                    </span>
                  )}
                  <span className="truncate flex-1">{station.name}</span>
                  {/* Zone badge — e.g. "Z1" or "Z2/3" */}
                  {station.zone && (
                    <span className="shrink-0 text-amber amber-glow text-xs font-mono">
                      Z{station.zone}
                    </span>
                  )}
                </div>
                {/* Transport modes and indicator as small labels underneath */}
                <div className="text-amber-faint text-xs mt-1 uppercase">
                  {station.indicator
                    ? `${(station.modes || []).join(" / ")} -- ${station.indicator}`
                    : (station.modes || []).join(" / ")}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ---- No results message ---- */}
      {isOpen && results.length === 0 && !isSearching && query.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-surface border border-board-border px-4 py-3">
          <span className="text-amber-faint font-mono text-sm tracking-wider">
            NO STATIONS FOUND
          </span>
        </div>
      )}
    </div>
  );
}
