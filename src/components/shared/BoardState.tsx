/**
 * BoardState.tsx — Shared loading / error / empty / not-configured
 * body for any BoardPanel-wrapped content.
 *
 * Before this primitive, every board component (rail departures,
 * flight departures, flight arrivals, tube arrivals) re-rolled its
 * own centred "LOADING...", "NO ARRIVALS LISTED", "COULD NOT LOAD
 * FLIGHTS", and "AWAITING API KEY" blocks — all with subtly
 * different spacing and typography. This consolidates them so the
 * behaviour is consistent and adding a new board is cheap.
 *
 * Designed to render INSIDE a BoardPanel so the caller controls the
 * panel title. Returns a centred block with the dot-matrix amber
 * styling used across the app.
 */

"use client";

import { RefreshCw } from "lucide-react";
import AmberText from "./AmberText";
import LoadingBoard from "./LoadingBoard";

export type BoardStateVariant =
  | "loading"
  | "error"
  | "empty"
  | "notConfigured";

interface BoardStateProps {
  variant: BoardStateVariant;
  /** The main piece of state text (e.g. "NO ARRIVALS LISTED"). */
  message: string;
  /** Optional smaller helper text shown underneath. */
  hint?: React.ReactNode;
  /**
   * Only honoured for variant="error". Renders a RETRY button that
   * calls back into the caller; if omitted, the error shows without
   * a retry affordance.
   */
  onRetry?: () => void;
}

export default function BoardState({
  variant,
  message,
  hint,
  onRetry,
}: BoardStateProps) {
  if (variant === "loading") {
    return <LoadingBoard message={message} />;
  }

  if (variant === "error") {
    return (
      <div className="py-4 text-center space-y-3">
        <AmberText variant="dim" size="sm" className="dot-matrix">
          {message}
        </AmberText>
        {hint && (
          <p className="font-mono text-[11px] tracking-wider text-amber-faint leading-relaxed uppercase">
            {hint}
          </p>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-amber text-amber hover:bg-amber hover:text-board-bg transition-colors"
            aria-label="Retry"
          >
            <RefreshCw size={12} strokeWidth={1.5} />
            <span className="font-mono text-[10px] tracking-wider uppercase">
              RETRY
            </span>
          </button>
        )}
      </div>
    );
  }

  /* empty + notConfigured share the same shape — a centred title
     with optional helper text underneath. Only the default copy
     differs per variant at the call-site. */
  return (
    <div className="py-6 text-center space-y-3">
      <AmberText variant="dim" size="sm" uppercase className="dot-matrix">
        {message}
      </AmberText>
      {hint && (
        <p className="font-mono text-[11px] tracking-wider text-amber-faint leading-relaxed uppercase">
          {hint}
        </p>
      )}
    </div>
  );
}
