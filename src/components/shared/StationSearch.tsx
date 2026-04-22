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
import { Search, X, TrainFront, Plane } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchStations as searchRailStations } from "@/lib/uk-rail-stations";
import { searchAirports } from "@/lib/airports";

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
  /** All naptan IDs for consolidated stations (tube + Elizabeth line + rail) */
  allNaptanIds?: string[];
}

/**
 * A National Rail station match from the bundled UK rail list.
 * Only `crs` and `name` are known — the rest of the SearchResult
 * fields are left empty. Flagged with isRail=true so the dropdown
 * can render it differently and route taps to the Rail tab.
 */
interface RailSearchResult extends SearchResult {
  isRail: true;
  crs: string;
}

/**
 * An airport match from the bundled international airport list.
 * Flagged so the dropdown renders with a plane icon and taps
 * route to /flights/airport/[iata].
 */
interface AirportSearchResult extends SearchResult {
  isAirport: true;
  iata: string;
  city?: string;
  country?: string;
}

/** Union: TfL result, UK rail result, or airport result. */
type AnySearchResult =
  | SearchResult
  | RailSearchResult
  | AirportSearchResult;

function isRailResult(r: AnySearchResult): r is RailSearchResult {
  return "isRail" in r && r.isRail === true;
}

function isAirportResult(r: AnySearchResult): r is AirportSearchResult {
  return "isAirport" in r && r.isAirport === true;
}

interface StationSearchProps {
  /** Called when the user selects a TfL station from the dropdown */
  onSelect: (station: SearchResult) => void;
  /**
   * Called when the user selects a National Rail station. Only fires
   * if `includeRail` is true; otherwise rail results aren't surfaced.
   * When omitted, the default behaviour (opening the Rail tab with
   * the chosen station as FROM) is used.
   */
  onRailStationSelect?: (station: { crs: string; name: string }) => void;
  /**
   * Called when the user selects an airport. Only fires if
   * `includeAirports` is true. Typically routes to
   * /flights/airport/[iata].
   */
  onAirportSelect?: (airport: {
    iata: string;
    name: string;
    city?: string;
    country?: string;
  }) => void;
  /** Include bundled UK National Rail stations in the dropdown. */
  includeRail?: boolean;
  /** Include bundled international airports in the dropdown. */
  includeAirports?: boolean;
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
  onRailStationSelect,
  onAirportSelect,
  includeRail = false,
  includeAirports = false,
  placeholder = "Search for a station...",
  value,
  className,
}: StationSearchProps) {
  /* The current text in the search input */
  const [query, setQuery] = useState(value || "");
  /* The list of matching stations (TfL + optional rail) */
  const [results, setResults] = useState<AnySearchResult[]>([]);
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
   * Search the TfL API for stations matching the query, and (when
   * includeRail is on) merge in bundled UK National Rail stations
   * from the offline list so users can find e.g. Leeds or Edinburgh
   * without leaving the Depart tab.
   *
   * Rail entries are deduped against TfL by exact name match so
   * London terminals that appear on both boards (Kings Cross etc.)
   * don't show twice.
   */
  const searchStations = useCallback(
    async (searchQuery: string) => {
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

        const tflResults: SearchResult[] = await response.json();
        let merged: AnySearchResult[] = tflResults;

        if (includeRail) {
          const tflNames = new Set(
            tflResults.map((r) => r.name.toLowerCase().trim())
          );
          const railMatches = searchRailStations(searchQuery)
            .filter((r) => !tflNames.has(r.name.toLowerCase().trim()))
            .slice(0, 8)
            .map<RailSearchResult>((r) => ({
              /* Synthesize a SearchResult shape; crs acts as the unique key */
              naptanId: `rail:${r.crs}`,
              name: r.name,
              lat: 0,
              lon: 0,
              modes: ["national-rail"],
              lines: [],
              isRail: true,
              crs: r.crs,
            }));
          merged = [...merged, ...railMatches];
        }

        if (includeAirports) {
          const airportMatches = searchAirports(searchQuery)
            .slice(0, 6)
            .map<AirportSearchResult>((a) => ({
              naptanId: `airport:${a.iata}`,
              name: a.name,
              lat: 0,
              lon: 0,
              modes: ["airport"],
              lines: [],
              isAirport: true,
              iata: a.iata,
              city: a.city,
              country: a.country,
            }));
          merged = [...merged, ...airportMatches];
        }

        setResults(merged);
        setIsOpen(merged.length > 0);
      } catch (error) {
        console.error("Station search error:", error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [includeRail, includeAirports]
  );

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
   * Routes rail-only picks through onRailStationSelect (if provided)
   * so the parent can navigate to the Rail tab with the chosen CRS.
   */
  const handleSelect = (station: AnySearchResult) => {
    /* Update the input to show the selected station name */
    setQuery(station.name);
    /* Close the dropdown */
    setIsOpen(false);
    if (isRailResult(station)) {
      if (onRailStationSelect) {
        onRailStationSelect({ crs: station.crs, name: station.name });
      }
      /* If no rail handler is wired, silently swallow the tap —
         the caller opted into includeRail without wiring the handler. */
      return;
    }
    if (isAirportResult(station)) {
      if (onAirportSelect) {
        onAirportSelect({
          iata: station.iata,
          name: station.name,
          city: station.city,
          country: station.country,
        });
      }
      return;
    }
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
          {results.map((station) => {
            const rail = isRailResult(station);
            const airport = isAirportResult(station);
            return (
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
                  {/* Station name with optional stop letter badge and zone/rail/airport marker */}
                  <div className="flex items-center gap-2 uppercase">
                    {rail && (
                      <TrainFront
                        size={14}
                        strokeWidth={1.5}
                        className="shrink-0 text-amber"
                        aria-hidden="true"
                      />
                    )}
                    {airport && (
                      <Plane
                        size={14}
                        strokeWidth={1.5}
                        className="shrink-0 text-amber"
                        aria-hidden="true"
                      />
                    )}
                    {/* Bus stop letter badge — e.g. [H] */}
                    {!rail && !airport && station.stopLetter && (
                      <span className="shrink-0 w-6 h-6 flex items-center justify-center border border-amber text-amber text-xs font-mono">
                        {station.stopLetter}
                      </span>
                    )}
                    <span className="truncate flex-1">
                      {airport && station.city
                        ? `${station.city} -- ${station.name}`
                        : station.name}
                    </span>
                    {/* Right-side badge: CRS / IATA / zone */}
                    {rail ? (
                      <span className="shrink-0 border border-amber-faint text-amber-faint text-xs font-mono px-1.5 py-0.5">
                        {station.crs}
                      </span>
                    ) : airport ? (
                      <span className="shrink-0 border border-amber-faint text-amber-faint text-xs font-mono px-1.5 py-0.5">
                        {station.iata}
                      </span>
                    ) : station.zone ? (
                      <span className="shrink-0 text-amber amber-glow text-xs font-mono">
                        Z{station.zone}
                      </span>
                    ) : null}
                  </div>
                  {/* Mode line */}
                  <div className="text-amber-faint text-xs mt-1 uppercase">
                    {rail
                      ? "NATIONAL RAIL"
                      : airport
                        ? station.country
                          ? `AIRPORT -- ${station.country.toUpperCase()}`
                          : "AIRPORT"
                        : station.indicator
                          ? `${(station.modes || []).join(" / ")} -- ${station.indicator}`
                          : (station.modes || []).join(" / ")}
                  </div>
                </button>
              </li>
            );
          })}
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
