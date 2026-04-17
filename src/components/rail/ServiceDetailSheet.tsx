/**
 * ServiceDetailSheet.tsx — Bottom sheet showing calling points for a service
 *
 * When the user taps a row on the rail departure board, this sheet slides
 * up from the bottom and shows every station the train calls at after
 * the FROM station. The user's destination (if they picked one) is
 * highlighted with a brighter amber row.
 *
 * Fetches /api/rail/service?serviceId=X when opened.
 *
 * Layout:
 *   STATION NAME              SCHED  EXP  PLATFORM  (marker if user's dest)
 */

"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import AmberText from "@/components/shared/AmberText";
import type { RailServiceDetails } from "@/lib/rail-types";

interface ServiceDetailSheetProps {
  /** Service ID to fetch — null closes the sheet */
  serviceId: string | null;
  /** User's destination CRS (if any) — used to highlight the relevant row */
  highlightCrs?: string | null;
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
  serviceId,
  highlightCrs,
  onClose,
}: ServiceDetailSheetProps) {
  const [details, setDetails] = useState<RailServiceDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Fetch details whenever serviceId changes (and is non-null) */
  useEffect(() => {
    if (!serviceId) {
      setDetails(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetails(null);

    fetch(`/api/rail/service?serviceId=${encodeURIComponent(serviceId)}`)
      .then(async (resp) => {
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        return resp.json();
      })
      .then((data: RailServiceDetails) => {
        if (!cancelled) setDetails(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to load service details");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  /* Close on Escape key */
  useEffect(() => {
    if (!serviceId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [serviceId, onClose]);

  /* Don't render at all when closed — lets Next.js keep the DOM clean */
  if (!serviceId) return null;

  const highlightUpper = highlightCrs?.toUpperCase();

  return (
    <>
      {/* Backdrop — taps dismiss the sheet */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[9998] bg-black/50"
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Train calling points"
        className={cn(
          "fixed left-0 right-0 bottom-0 z-[9999]",
          "bg-board-bg border-t border-board-border",
          "max-h-[80vh] overflow-y-auto",
          "pb-[env(safe-area-inset-bottom)]"
        )}
      >
        {/* Drag handle (visual only — we use tap-to-close for simplicity) */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-board-border rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-board-border">
          <div className="flex-1 min-w-0">
            <AmberText variant="secondary" size="xs" uppercase>
              CALLING AT
            </AmberText>
            {details && (
              <div className="font-board text-lg text-amber amber-glow tracking-wider uppercase truncate mt-0.5">
                {details.scheduledDeparture} {details.destination}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-2 text-amber-faint hover:text-amber transition-colors"
            aria-label="Close calling points"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          {loading && (
            <div className="py-8 text-center">
              <span className="font-mono text-xs tracking-wider text-amber amber-glow animate-blink">
                LOADING CALLING POINTS...
              </span>
            </div>
          )}

          {error && !loading && (
            <div className="py-8 text-center space-y-1">
              <AmberText variant="secondary" size="sm" uppercase>
                UNABLE TO LOAD
              </AmberText>
              <p className="font-mono text-xs tracking-wider text-amber-faint">
                CHECK CONNECTION AND TRY AGAIN
              </p>
            </div>
          )}

          {details && details.callingPoints.length === 0 && !loading && (
            <div className="py-6 text-center">
              <AmberText variant="dim" size="sm" uppercase>
                NO INTERMEDIATE STOPS LISTED
              </AmberText>
            </div>
          )}

          {details && details.callingPoints.length > 0 && (
            <>
              {/* Operator + length info */}
              <div className="flex items-center gap-4 py-2 border-b border-board-border mb-1">
                {details.operator && (
                  <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
                    {details.operator}
                  </span>
                )}
                {details.length && (
                  <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
                    {details.length} COACHES
                  </span>
                )}
                {details.platform && (
                  <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase ml-auto">
                    PLATFORM {details.platform}
                  </span>
                )}
              </div>

              {/* Calling points */}
              <div role="list">
                {details.callingPoints.map((cp, i) => {
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
            </>
          )}
        </div>
      </div>
    </>
  );
}
