/**
 * PlanJourneyPanel.tsx — Plan and track a future-dated rail journey
 *
 * A collapsible panel on the Rail tab for journeys you're getting
 * days (or hours) in advance. Stores the planned journey in the
 * trackedRailJourneys table, where the TrackedJourneyCard picks it
 * up — rendering scheduled-only until travel day, then switching to
 * live mode automatically via the live departures hook.
 *
 * Minimal required fields: FROM, TO, travel date, scheduled departure.
 * Optional: scheduled arrival (improves auto-clear accuracy ahead of
 * travel day), seat reservation (coach + seat number).
 */

"use client";

import { useState } from "react";
import { CalendarPlus, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import AmberText from "@/components/shared/AmberText";
import BoardPanel from "@/components/shared/BoardPanel";
import RailStationSearch from "@/components/rail/RailStationSearch";
import type { UKRailStation } from "@/lib/rail-types";

/** Today's date in YYYY-MM-DD (local time) — used for the date-picker min. */
function todayLocalIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface PlanJourneyPanelProps {
  /** Quick chips shared with NEW ROUTE (KGX, LST, PAD, etc.) */
  quickChips: { crs: string; label: string; name: string }[];
  /**
   * Called when the user submits the form. Returns a promise so the
   * panel can show a transient success state before collapsing.
   */
  onPlan: (input: {
    fromCrs: string;
    fromName: string;
    toCrs: string;
    toName: string;
    travelDate: string;
    scheduledDeparture: string;
    seatCoach: string;
    seatNumber: string;
  }) => Promise<void>;
}

export default function PlanJourneyPanel({
  quickChips,
  onPlan,
}: PlanJourneyPanelProps) {
  /* The panel is collapsed by default so it doesn't clutter the page. */
  const [expanded, setExpanded] = useState(false);

  const [from, setFrom] = useState<{ crs: string; name: string } | null>(null);
  const [to, setTo] = useState<{ crs: string; name: string } | null>(null);
  const [travelDate, setTravelDate] = useState<string>(todayLocalIso());
  const [scheduledDeparture, setScheduledDeparture] = useState<string>("");
  const [seatCoach, setSeatCoach] = useState<string>("");
  const [seatNumber, setSeatNumber] = useState<string>("");
  const [justPlanned, setJustPlanned] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const canSubmit =
    !!from &&
    !!to &&
    !!travelDate &&
    !!scheduledDeparture &&
    /^\d{2}:\d{2}$/.test(scheduledDeparture);

  const reset = () => {
    setFrom(null);
    setTo(null);
    setTravelDate(todayLocalIso());
    setScheduledDeparture("");
    setSeatCoach("");
    setSeatNumber("");
  };

  const handleSubmit = async () => {
    if (!canSubmit || !from || !to) return;
    setSubmitting(true);
    try {
      await onPlan({
        fromCrs: from.crs,
        fromName: from.name,
        toCrs: to.crs,
        toName: to.name,
        travelDate,
        scheduledDeparture,
        seatCoach,
        seatNumber,
      });
      setJustPlanned(true);
      /* Reset + collapse after a short confirmation flash. */
      setTimeout(() => {
        setJustPlanned(false);
        reset();
        setExpanded(false);
      }, 1200);
    } finally {
      setSubmitting(false);
    }
  };

  /*
   * Collapsed state: a thin clickable bar inviting the user to expand.
   * Keeps the rail page compact when this feature isn't in use.
   */
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 border border-board-border text-amber-faint hover:border-amber-faint hover:text-amber transition-colors font-mono text-[11px] tracking-wider uppercase"
        aria-label="Open plan a future journey form"
      >
        <CalendarPlus size={14} strokeWidth={1.5} />
        <span>PLAN A FUTURE JOURNEY</span>
        <ChevronDown size={12} strokeWidth={1.5} className="opacity-70" />
      </button>
    );
  }

  return (
    <BoardPanel title="PLAN A JOURNEY">
      <div className="space-y-3">
        <p className="font-mono text-[10px] tracking-wider text-amber-faint uppercase leading-relaxed">
          PIN A SERVICE FOR A FUTURE DATE. LIVE STATUS
          <br />
          APPEARS AUTOMATICALLY ON TRAVEL DAY.
        </p>

        {/* Quick chips for FROM */}
        <div>
          <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mb-1.5">
            QUICK FROM
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickChips.map((c) => {
              const isActive = from?.crs === c.crs;
              return (
                <button
                  key={`plan-qf-${c.crs}`}
                  onClick={() => setFrom({ crs: c.crs, name: c.name })}
                  aria-label={`Set from to ${c.name}`}
                  className={cn(
                    "px-2.5 py-1 border font-mono text-[10px] tracking-wider uppercase transition-colors",
                    isActive
                      ? "border-amber text-amber bg-amber/10"
                      : "border-board-border text-amber-faint hover:border-amber-faint hover:text-amber"
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <RailStationSearch
          label="FROM"
          placeholder="Or search any UK station..."
          value={from?.name || ""}
          onSelect={(s: UKRailStation) => setFrom({ crs: s.crs, name: s.name })}
          onClear={() => setFrom(null)}
        />

        {/* Quick chips for TO */}
        <div>
          <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mb-1.5">
            QUICK TO
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickChips.map((c) => {
              const isActive = to?.crs === c.crs;
              return (
                <button
                  key={`plan-qt-${c.crs}`}
                  onClick={() => setTo({ crs: c.crs, name: c.name })}
                  aria-label={`Set to ${c.name}`}
                  className={cn(
                    "px-2.5 py-1 border font-mono text-[10px] tracking-wider uppercase transition-colors",
                    isActive
                      ? "border-amber text-amber bg-amber/10"
                      : "border-board-border text-amber-faint hover:border-amber-faint hover:text-amber"
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <RailStationSearch
          label="TO"
          placeholder="Or search any UK station..."
          value={to?.name || ""}
          onSelect={(s: UKRailStation) => setTo({ crs: s.crs, name: s.name })}
          onClear={() => setTo(null)}
        />

        {/* Date + times. Native inputs styled to match the dot-matrix theme. */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label
              htmlFor="plan-date"
              className="block font-mono text-[10px] tracking-wider text-amber-faint mb-1 uppercase"
            >
              Travel date
            </label>
            <input
              id="plan-date"
              type="date"
              min={todayLocalIso()}
              value={travelDate}
              onChange={(e) => setTravelDate(e.target.value)}
              className={cn(
                "w-full bg-transparent border-b border-amber-faint",
                "px-1 py-1.5 font-board text-base text-amber amber-glow",
                "tracking-wider uppercase",
                "focus:outline-none focus:border-amber"
              )}
            />
          </div>
          <div>
            <label
              htmlFor="plan-dep"
              className="block font-mono text-[10px] tracking-wider text-amber-faint mb-1 uppercase"
            >
              Departs
            </label>
            <input
              id="plan-dep"
              type="time"
              value={scheduledDeparture}
              onChange={(e) => setScheduledDeparture(e.target.value)}
              className={cn(
                "w-full bg-transparent border-b border-amber-faint",
                "px-1 py-1.5 font-board text-base text-amber amber-glow",
                "tracking-wider uppercase",
                "focus:outline-none focus:border-amber"
              )}
            />
          </div>
        </div>

        {/* Seat reservation (optional) */}
        <div>
          <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mb-1.5">
            SEAT RESERVATION (OPTIONAL)
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={seatCoach}
              onChange={(e) => setSeatCoach(e.target.value.toUpperCase())}
              placeholder="COACH"
              maxLength={3}
              className={cn(
                "w-full bg-transparent border-b border-amber-faint",
                "px-1 py-1.5 font-board text-base text-amber amber-glow",
                "tracking-wider uppercase placeholder:text-amber-faint placeholder:opacity-50",
                "focus:outline-none focus:border-amber"
              )}
              aria-label="Coach"
            />
            <input
              type="text"
              value={seatNumber}
              onChange={(e) => setSeatNumber(e.target.value.toUpperCase())}
              placeholder="SEAT"
              maxLength={4}
              className={cn(
                "w-full bg-transparent border-b border-amber-faint",
                "px-1 py-1.5 font-board text-base text-amber amber-glow",
                "tracking-wider uppercase placeholder:text-amber-faint placeholder:opacity-50",
                "focus:outline-none focus:border-amber"
              )}
              aria-label="Seat number"
            />
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => {
              reset();
              setExpanded(false);
            }}
            className="flex-1 py-2 border border-board-border text-amber-faint hover:border-amber-faint hover:text-amber transition-colors font-mono text-[10px] tracking-wider uppercase"
          >
            CANCEL
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting || justPlanned}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 border transition-colors",
              "font-mono text-[10px] tracking-wider uppercase",
              justPlanned
                ? "bg-amber text-board-bg border-amber amber-glow"
                : "bg-surface border-amber text-amber hover:bg-amber/10 amber-glow disabled:opacity-40 disabled:border-board-border disabled:text-amber-faint disabled:cursor-not-allowed"
            )}
            aria-label="Track this planned journey"
          >
            {justPlanned ? (
              <>
                <Check size={12} strokeWidth={2} />
                <span>PLANNED!</span>
              </>
            ) : (
              <>
                <CalendarPlus size={12} strokeWidth={1.5} />
                <span>TRACK JOURNEY</span>
              </>
            )}
          </button>
        </div>

        {!canSubmit && (
          <AmberText variant="dim" size="xs" uppercase className="block text-center pt-1">
            PICK FROM, TO, DATE, AND DEPARTURE TIME
          </AmberText>
        )}
      </div>
    </BoardPanel>
  );
}
