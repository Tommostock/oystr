/**
 * FlightSearch.tsx — Flight-number search input
 *
 * Lets the user look up a single flight by number (e.g. "BA175") and
 * jump straight to the flight detail page. Sits on /flights alongside
 * the airport quick-picks and airport autocomplete.
 *
 * Input accepts any casing and any spacing — "ba175", "BA 175",
 * "ba-175" all work. The component normalises to "BA 175" and routes
 * to `/flights/flight/BA%20175`.
 *
 * Validation is intentionally lightweight: we only block submission
 * if the input doesn't match the "2-3 letter airline + 1-4 digit
 * number" pattern. Finer-grained errors (flight not found, API key
 * missing) are surfaced by the detail page once it loads.
 */

"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plane, ArrowRight } from "lucide-react";

/**
 * Normalise user input to the canonical form the API expects.
 * Returns null if the input can't possibly be a valid flight number.
 */
function normaliseFlightNumber(raw: string): string | null {
  const squashed = raw.replace(/[\s-]+/g, "").toUpperCase();
  /*
   * Matches classic 2-3 letter codes, letter+digit codes (U2, B6, W6),
   * and digit+letter codes (3U, 5J) — keeps easyJet / JetBlue / Wizz /
   * Sichuan / Cebu users happy without letting gibberish through.
   */
  const match = squashed.match(
    /^([A-Z]{2,3}|[A-Z][0-9]|[0-9][A-Z])(\d{1,4})$/
  );
  if (!match) return null;
  return `${match[1]} ${match[2]}`;
}

export default function FlightSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Enter a flight number, e.g. BA175");
      return;
    }
    const normalised = normaliseFlightNumber(trimmed);
    if (!normalised) {
      setError("Use an airline code + number, e.g. BA175 or LH 400");
      return;
    }
    setError(null);
    router.push(`/flights/flight/${encodeURIComponent(normalised)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-1.5">
      <div
        className={
          "flex items-center gap-2 border bg-surface px-3 py-2 transition-colors " +
          (error
            ? "border-bad"
            : "border-board-border focus-within:border-amber")
        }
      >
        <Plane
          size={14}
          strokeWidth={1.5}
          className="text-amber-faint shrink-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="BA175"
          aria-label="Flight number"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="flex-1 bg-transparent outline-none font-board text-base tracking-wider text-amber uppercase placeholder:text-amber-faint placeholder:normal-case"
        />
        <button
          type="submit"
          aria-label="Search flight"
          className="shrink-0 p-1 text-amber-faint hover:text-amber transition-colors"
        >
          <ArrowRight size={16} strokeWidth={1.5} />
        </button>
      </div>
      {error && (
        <p className="font-mono text-[10px] tracking-wider text-bad uppercase px-1">
          {error}
        </p>
      )}
    </form>
  );
}
