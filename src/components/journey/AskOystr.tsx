/**
 * AskOystr.tsx — Natural language journey planning input
 *
 * A text input where users can type questions like:
 *   "How do I get to the O2 from here?"
 *   "Best way from Stratford to Kings Cross"
 *   "I need to be at Heathrow by 3pm"
 *
 * The component:
 *   1. Sends the question to /api/gemini/journey
 *   2. Displays Gemini's plain-English summary
 *   3. Passes structured journey results up to the parent
 *
 * If Gemini is unavailable (no API key, rate limited, error),
 * it degrades gracefully — the manual journey planner still works.
 */

"use client";

import { useState, useCallback, useRef } from "react";
import { Sparkles, Send, X } from "lucide-react";
import BoardPanel from "@/components/shared/BoardPanel";
import AmberText from "@/components/shared/AmberText";
import LoadingBoard from "@/components/shared/LoadingBoard";
import type { Journey } from "@/lib/tfl-types";
import { cn } from "@/lib/utils";

/* ========================================
 * PROPS
 * ======================================== */
interface AskOystrProps {
  /** Called when Gemini returns structured journey results */
  onJourneysReceived: (journeys: Journey[]) => void;
  /** Called when Gemini returns a plain-English summary */
  onSummaryReceived: (summary: string) => void;
  /** Called to clear previous results when a new query starts */
  onClear: () => void;
}

/* ========================================
 * LOCATION KEYWORDS
 * If the user's query contains any of these words,
 * we'll request their GPS position before sending.
 * ======================================== */
const LOCATION_KEYWORDS = [
  "here",
  "nearby",
  "current",
  "my location",
  "where i am",
  "closest",
  "nearest",
];

/* ========================================
 * COMPONENT
 * ======================================== */
export default function AskOystr({
  onJourneysReceived,
  onSummaryReceived,
  onClear,
}: AskOystrProps) {
  /* ---- State ---- */
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Ref for the input so we can focus it */
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Get the user's current GPS position.
   * Returns null if geolocation is unavailable or denied.
   */
  const getLocation = useCallback(
    (): Promise<{ lat: number; lon: number } | null> => {
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve(null);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lon: position.coords.longitude,
            });
          },
          () => {
            /* User denied or error — resolve null */
            resolve(null);
          },
          {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 60000,
          }
        );
      });
    },
    []
  );

  /**
   * Submit the natural language query to the Gemini API route.
   */
  const handleSubmit = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setError(null);
    onClear();

    try {
      /* Check if we need the user's location */
      const needsLocation = LOCATION_KEYWORDS.some((kw) =>
        trimmed.toLowerCase().includes(kw)
      );

      let lat: number | undefined;
      let lon: number | undefined;

      if (needsLocation) {
        const coords = await getLocation();
        if (coords) {
          lat = coords.lat;
          lon = coords.lon;
        }
        /* If no coords, the API will ask Gemini to handle "CURRENT_LOCATION" without coords,
           which will return a helpful error message asking the user to specify */
      }

      /* Call the Gemini API route */
      const response = await fetch("/api/gemini/journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, lat, lon }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "SOMETHING WENT WRONG -- TRY AGAIN");
        return;
      }

      /* Pass results up to the parent */
      if (data.summary) {
        onSummaryReceived(data.summary);
      }
      if (data.journeys && data.journeys.length > 0) {
        onJourneysReceived(data.journeys);
      }
    } catch {
      setError("COULD NOT REACH AI ASSISTANT -- USE JOURNEY PLANNER BELOW");
    } finally {
      setIsLoading(false);
    }
  }, [query, isLoading, getLocation, onJourneysReceived, onSummaryReceived, onClear]);

  /**
   * Handle Enter key press to submit.
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  /**
   * Clear the input and error state.
   */
  const handleClear = () => {
    setQuery("");
    setError(null);
    onClear();
    inputRef.current?.focus();
  };

  return (
    <BoardPanel>
      {/* ---- Header ---- */}
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} strokeWidth={1.5} className="text-amber" />
        <AmberText variant="primary" size="xs" uppercase className="tracking-widest">
          Ask Oystr
        </AmberText>
        <div className="flex-1 border-t border-board-border ml-2" />
      </div>

      {/* ---- Input Row ---- */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="How do I get to Kings Cross?"
            className={cn(
              "w-full bg-transparent",
              "border-b border-amber-faint focus:border-amber",
              "text-amber font-mono text-sm tracking-wide",
              "placeholder:text-amber-faint/40",
              "py-2 pr-8 outline-none",
              "transition-colors duration-200",
              "disabled:opacity-40"
            )}
            aria-label="Ask Oystr a travel question"
          />

          {/* Clear button — shown when there's text */}
          {query && !isLoading && (
            <button
              onClick={handleClear}
              className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-amber-faint hover:text-amber transition-colors"
              aria-label="Clear question"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!query.trim() || isLoading}
          className={cn(
            "px-3 py-2",
            "border border-amber",
            "text-amber",
            "hover:bg-amber/10 transition-colors duration-200",
            "disabled:opacity-30 disabled:border-board-border disabled:hover:bg-transparent"
          )}
          aria-label="Submit question"
        >
          <Send size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* ---- Loading State ---- */}
      {isLoading && (
        <div className="mt-3">
          <LoadingBoard message="THINKING..." className="py-4" />
        </div>
      )}

      {/* ---- Error State ---- */}
      {error && !isLoading && (
        <div className="mt-3 py-2">
          <AmberText variant="dim" size="xs" className="dot-matrix leading-relaxed">
            {error.toUpperCase()}
          </AmberText>
        </div>
      )}

      {/* ---- Hint ---- */}
      {!isLoading && !error && !query && (
        <div className="mt-2">
          <AmberText variant="dim" size="xs" className="leading-relaxed">
            Try: &quot;Best way from Stratford to the O2&quot; or &quot;Get me to
            Heathrow by 3pm&quot;
          </AmberText>
        </div>
      )}
    </BoardPanel>
  );
}
