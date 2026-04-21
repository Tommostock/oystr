/**
 * SeatEditor.tsx — Small modal for editing coach + seat on a tracked journey
 *
 * Opens when the user taps EDIT SEAT / + SEAT on a TrackedJourneyCard.
 * Centered amber-bordered modal consistent with ServiceDetailSheet.
 * Closes on backdrop tap or Escape; saving commits via the onSave
 * callback and closes.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import AmberText from "@/components/shared/AmberText";

interface SeatEditorProps {
  /** Modal is visible iff this is true */
  open: boolean;
  /** Initial coach value (e.g. "B") */
  initialCoach?: string;
  /** Initial seat number value (e.g. "42") */
  initialSeat?: string;
  /** Called when the user saves. Pass empty strings to clear. */
  onSave: (coach: string, seat: string) => void | Promise<void>;
  /** Called when the user closes without saving */
  onClose: () => void;
}

export default function SeatEditor({
  open,
  initialCoach,
  initialSeat,
  onSave,
  onClose,
}: SeatEditorProps) {
  const [coach, setCoach] = useState(initialCoach ?? "");
  const [seat, setSeat] = useState(initialSeat ?? "");
  const coachRef = useRef<HTMLInputElement>(null);

  /*
   * Resync local state when the modal reopens on a different journey,
   * or when the underlying journey's seat fields change.
   */
  useEffect(() => {
    if (open) {
      setCoach(initialCoach ?? "");
      setSeat(initialSeat ?? "");
      /* tiny delay so the input exists in the DOM before we focus */
      const id = setTimeout(() => coachRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [open, initialCoach, initialSeat]);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = async () => {
    await onSave(coach, seat);
    onClose();
  };

  const handleClear = async () => {
    await onSave("", "");
    onClose();
  };

  return (
    <div
      onClick={onClose}
      role="presentation"
      className="fixed inset-0 z-[9998] bg-black/70 flex items-center justify-center p-4 pb-[calc(56px+1rem)]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Edit seat reservation"
        className={cn(
          "relative w-full max-w-xs",
          "bg-board-bg border border-amber amber-glow",
          "flex flex-col"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-board-border">
          <AmberText variant="secondary" size="xs" uppercase>
            SEAT RESERVATION
          </AmberText>
          <button
            onClick={onClose}
            className="p-1 text-amber-faint hover:text-amber transition-colors"
            aria-label="Close seat editor"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <div>
            <label
              htmlFor="seat-editor-coach"
              className="block font-mono text-[10px] tracking-wider text-amber-faint mb-1 uppercase"
            >
              Coach
            </label>
            <input
              ref={coachRef}
              id="seat-editor-coach"
              type="text"
              value={coach}
              onChange={(e) => setCoach(e.target.value.toUpperCase())}
              placeholder="e.g. B"
              maxLength={3}
              className={cn(
                "w-full bg-transparent border-b border-amber-faint",
                "px-1 py-1.5 font-board text-lg text-amber amber-glow",
                "tracking-wider uppercase",
                "focus:outline-none focus:border-amber"
              )}
            />
          </div>
          <div>
            <label
              htmlFor="seat-editor-number"
              className="block font-mono text-[10px] tracking-wider text-amber-faint mb-1 uppercase"
            >
              Seat
            </label>
            <input
              id="seat-editor-number"
              type="text"
              value={seat}
              onChange={(e) => setSeat(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              placeholder="e.g. 42"
              maxLength={4}
              className={cn(
                "w-full bg-transparent border-b border-amber-faint",
                "px-1 py-1.5 font-board text-lg text-amber amber-glow",
                "tracking-wider uppercase",
                "focus:outline-none focus:border-amber"
              )}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 p-3 border-t border-board-border">
          {(initialCoach || initialSeat) && (
            <button
              onClick={handleClear}
              className="px-3 py-2 border border-board-border text-amber-faint hover:text-red-500 hover:border-red-500 font-mono text-[10px] tracking-wider uppercase transition-colors"
              aria-label="Clear seat reservation"
            >
              CLEAR
            </button>
          )}
          <button
            onClick={handleSave}
            className={cn(
              "ml-auto flex items-center gap-1.5 px-3 py-2",
              "bg-surface border border-amber text-amber",
              "hover:bg-amber/10 transition-colors",
              "font-mono text-[10px] tracking-wider uppercase",
              "amber-glow"
            )}
            aria-label="Save seat reservation"
          >
            <Check size={12} strokeWidth={2} />
            SAVE
          </button>
        </div>
      </div>
    </div>
  );
}
