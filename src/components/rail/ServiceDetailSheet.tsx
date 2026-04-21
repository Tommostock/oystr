/**
 * ServiceDetailSheet.tsx — Centered popup showing calling points for a service
 *
 * When the user taps a row on the rail departure board, this popup opens
 * over the page and shows the full journey: the origin station first,
 * then every subsequent calling point. The user's destination (if they
 * picked one) is highlighted with a brighter amber row.
 *
 * Data flow: the RDM "Live Arrival and Departure Boards" product's
 * GetArrDepBoardWithDetails endpoint bundles calling points into the
 * initial board response, so this popup just receives the pre-loaded
 * RailDeparture object as a prop — no extra network call required.
 *
 * Layout:
 *   STATION NAME              SCHED  EXP  (marker if user's dest)
 */

"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import AmberText from "@/components/shared/AmberText";
import { shortOperatorName } from "@/lib/rail-operators";
import type { RailDeparture, CallingPoint } from "@/lib/rail-types";

interface ServiceDetailSheetProps {
  /** The full departure to show — null closes the sheet */
  departure: RailDeparture | null;
  /** User's destination CRS (if any) — used to highlight the relevant row */
  highlightCrs?: string | null;
  /**
   * Name + CRS of the FROM station the board is currently showing.
   * Used to prepend a synthetic "origin" row so the popup shows the
   * full journey — origin first, then every subsequent calling point.
   */
  fromName?: string | null;
  fromCrs?: string | null;
  /** Called when the user dismisses the sheet */
  onClose: () => void;
}

/**
 * Format a calling point's time + status into a short label.
 *   "On time" -> "ON TIME"
 *   HH:mm     -> HH:mm
 *   cancelled -> "CXL"
 */
function formatTime(
  scheduled: string,
  estimated: string,
  cancelled: boolean
): { sched: string; status: string; colour: string } {
  if (cancelled) {
    return { sched: scheduled || "--:--", status: "CXL", colour: "#ff3b30" };
  }
  if (estimated === "On time") {
    return {
      sched: scheduled,
      status: "ON TIME",
      colour: "#34c759",
    };
  }
  if (estimated && estimated !== scheduled) {
    return {
      sched: scheduled,
      status: `EXP ${estimated}`,
      colour: "#ff9500",
    };
  }
  return { sched: scheduled, status: "", colour: "#ff9500" };
}

export default function ServiceDetailSheet({
  departure,
  highlightCrs,
  fromName,
  fromCrs,
  onClose,
}: ServiceDetailSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  /* Close on Escape key */
  useEffect(() => {
    if (!departure) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [departure, onClose]);

  /*
   * Focus trap: when the sheet opens, move keyboard focus to the
   * close button, and keep Tab cycling within the sheet's interactive
   * elements. Screen-reader users can't accidentally tab out to the
   * background page while the modal is open.
   */
  useEffect(() => {
    if (!departure) return;

    /* Remember what had focus before we opened so we can restore it */
    const previouslyFocused = document.activeElement as HTMLElement | null;

    /* Focus the close button on open */
    closeButtonRef.current?.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !sheetRef.current) return;
      const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleTab);
    return () => {
      document.removeEventListener("keydown", handleTab);
      /* Restore focus to whatever was focused before the sheet opened */
      previouslyFocused?.focus?.();
    };
  }, [departure]);

  /* Don't render at all when closed */
  if (!departure) return null;

  const highlightUpper = highlightCrs?.toUpperCase();

  /*
   * Prepend a synthetic "origin" row so the user sees their boarding
   * station at the top of the list (e.g. KINGS CROSS before the first
   * calling point). The origin's time/status come straight from the
   * departure itself.
   *
   * We build a single `rows` array so the render loop handles origin
   * and calling points uniformly — same styling, same highlight logic.
   */
  const originRow: CallingPoint | null = fromName
    ? {
        crs: (fromCrs || "").toUpperCase(),
        name: fromName,
        scheduledTime: departure.scheduledDeparture,
        estimatedTime: departure.estimatedDeparture,
        cancelled: departure.cancelled,
      }
    : null;

  const rows: CallingPoint[] = originRow
    ? [originRow, ...departure.callingPoints]
    : departure.callingPoints;

  const hasRows = rows.length > 0;

  return (
    <>
      {/*
       * Backdrop — taps dismiss the popup. Uses flex layout so the
       * popup child can be centered horizontally AND vertically.
       * Clicking the backdrop triggers onClose; clicking inside the
       * popup stops propagation so the popup stays open while the
       * user interacts with it or scrolls the calling-points list.
       */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[9998] bg-black/70 flex items-center justify-center p-4 pb-[calc(56px+1rem)]"
        role="presentation"
      >
        {/*
         * Popup container — centered modal, not a bottom sheet. Using
         * flex-col with a bounded max-height and an inner scroll region
         * means the user can scroll the calling points without the
         * whole page scrolling behind, and without the popup dismissing.
         * overscroll-contain on the inner scroller prevents scroll
         * chaining out of the popup on mobile.
         */}
        <div
          ref={sheetRef}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Train calling points"
          className={cn(
            /*
             * Compact centered popup. max-w-sm + mx-auto keeps comfortable
             * horizontal margins on iPhone screens. Intentionally
             * auto-height — the internal scroll body is capped to
             * ~6 rows, so the popup sizes to content up to that cap
             * and the user scrolls within it for more stops.
             */
            "relative w-full max-w-sm",
            "bg-board-bg border border-board-border",
            "flex flex-col"
          )}
        >
        {/* Header — pinned to top of popup */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-board-border shrink-0">
          <div className="flex-1 min-w-0">
            <AmberText variant="secondary" size="xs" uppercase>
              CALLING AT
            </AmberText>
            <div className="font-board text-lg text-amber amber-glow tracking-wider uppercase truncate mt-0.5">
              {departure.scheduledDeparture} {departure.destination}
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="shrink-0 p-2 text-amber-faint hover:text-amber transition-colors"
            aria-label="Close calling points"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Operator + length + platform info — pinned just under the header. */}
        {(departure.operator || !!departure.length || departure.platform) && (
          <div className="flex items-center gap-4 px-4 py-2 border-b border-board-border shrink-0">
            {departure.operator && (
              <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
                {shortOperatorName(departure.operator)}
              </span>
            )}
            {!!departure.length && departure.length > 0 && (
              <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
                {departure.length} COACHES
              </span>
            )}
            {departure.platform && (
              <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase ml-auto">
                PLATFORM {departure.platform}
              </span>
            )}
          </div>
        )}

        {/*
         * Scrollable body.
         *
         * Capped to roughly six calling-point rows (~22rem) so the
         * popup stays compact within iPhone margins — if the service
         * calls at more than six stations the user scrolls within the
         * popup to see the rest. overscroll-contain prevents scroll
         * chaining to the page underneath, so dragging never scrolls
         * the rail page behind or dismisses the modal.
         */}
        <div
          className="overflow-y-auto overscroll-contain px-4 py-1 max-h-[22rem]"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {!hasRows && (
            <div className="py-6 text-center">
              <AmberText variant="dim" size="sm" uppercase>
                NO INTERMEDIATE STOPS LISTED
              </AmberText>
            </div>
          )}

          {hasRows && (
            <div role="list">
              {rows.map((cp, i) => {
                const isDest = highlightUpper && cp.crs === highlightUpper;
                const t = formatTime(
                  cp.scheduledTime,
                  cp.estimatedTime,
                  cp.cancelled
                );
                return (
                  <div
                    key={`${cp.crs}-${i}`}
                    role="listitem"
                    className={cn(
                      "flex items-center gap-3 py-2 border-b border-board-border/50 last:border-b-0",
                      isDest && "bg-amber/10 -mx-4 px-4"
                    )}
                  >
                    {/* Station name */}
                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(
                          "font-mono text-sm tracking-wider uppercase truncate",
                          isDest
                            ? "text-amber amber-glow font-semibold"
                            : "text-amber"
                        )}
                      >
                        {cp.name}
                      </div>
                      {isDest && (
                        <div className="font-mono text-[10px] tracking-wider text-amber amber-glow uppercase mt-0.5">
                          YOUR DESTINATION
                        </div>
                      )}
                    </div>

                    {/* Times */}
                    <div className="shrink-0 text-right">
                      <div className="font-board text-base text-amber amber-glow tracking-wider">
                        {t.sched || "--:--"}
                      </div>
                      {t.status && (
                        <div
                          className="font-mono text-[10px] tracking-wider uppercase"
                          style={{ color: t.colour }}
                        >
                          {t.status}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </div>
      </div>
    </>
  );
}
