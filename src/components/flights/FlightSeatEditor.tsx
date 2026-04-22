/**
 * FlightSeatEditor.tsx — Multi-seat editor modal for tracked flights
 *
 * Mirrors the rail SeatEditor's look and feel but accepts a *list* of
 * seat numbers, because flights are often booked for more than one
 * person (family, couple, colleagues on a single booking).
 *
 * UX:
 *   - Always starts with at least one seat row (empty if no prior data).
 *   - "+ ADD SEAT" button appends a blank row (no hard cap — if you
 *     book 20 seats, knock yourself out).
 *   - Each row has a trash icon to remove itself, except the last row
 *     when there's only one seat (to avoid showing an empty UI).
 *   - CLEAR wipes all seats and closes; SAVE commits the non-empty
 *     entries via the onSave callback.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { X, Check, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import AmberText from "@/components/shared/AmberText";

interface FlightSeatEditorProps {
  /** Modal is visible iff this is true */
  open: boolean;
  /** Initial seat list (e.g. ["14A", "14B"]) */
  initialSeats?: string[];
  /** Called when the user saves. Pass an empty array to clear. */
  onSave: (seats: string[]) => void | Promise<void>;
  /** Called when the user closes without saving */
  onClose: () => void;
}

export default function FlightSeatEditor({
  open,
  initialSeats,
  onSave,
  onClose,
}: FlightSeatEditorProps) {
  /*
   * Local edit state is an array of strings so the user can type
   * freely without us fighting their input. We normalise (uppercase,
   * trim) on save, not on every keystroke.
   */
  const [seats, setSeats] = useState<string[]>([]);
  const firstInputRef = useRef<HTMLInputElement>(null);

  /*
   * Resync when the modal opens. Always ensure at least one row is
   * visible so the UI has something to render.
   */
  useEffect(() => {
    if (open) {
      const initial = initialSeats && initialSeats.length > 0
        ? [...initialSeats]
        : [""];
      setSeats(initial);
      const id = setTimeout(() => firstInputRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [open, initialSeats]);

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

  const updateSeat = (index: number, value: string) => {
    setSeats((prev) => {
      const next = [...prev];
      next[index] = value.toUpperCase();
      return next;
    });
  };

  const addSeat = () => {
    setSeats((prev) => [...prev, ""]);
    /* Focus the new row after it mounts */
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>(
        '[data-seat-input="true"]'
      );
      inputs[inputs.length - 1]?.focus();
    }, 30);
  };

  const removeSeat = (index: number) => {
    setSeats((prev) => {
      if (prev.length <= 1) return [""]; // always keep one row visible
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSave = async () => {
    // Drop empty strings — the hook normalises further but this
    // is what determines whether the user has "any seats at all"
    const cleaned = seats
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    await onSave(cleaned);
    onClose();
  };

  const handleClear = async () => {
    await onSave([]);
    onClose();
  };

  const hasAnyInitial =
    initialSeats && initialSeats.some((s) => s && s.trim().length > 0);

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
        aria-label="Edit flight seats"
        className={cn(
          "relative w-full max-w-xs",
          "bg-board-bg border border-amber amber-glow",
          "flex flex-col max-h-[80vh]"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-board-border">
          <AmberText variant="secondary" size="xs" uppercase>
            SEATS
          </AmberText>
          <button
            onClick={onClose}
            className="p-1 text-amber-faint hover:text-amber transition-colors"
            aria-label="Close seat editor"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body — scrollable so lots of seats still fit on mobile */}
        <div className="p-4 space-y-3 overflow-y-auto">
          {seats.map((value, index) => {
            const label = seats.length > 1 ? `SEAT ${index + 1}` : "SEAT";
            const inputId = `flight-seat-editor-${index}`;
            return (
              <div key={index}>
                <label
                  htmlFor={inputId}
                  className="block font-mono text-[10px] tracking-wider text-amber-faint mb-1 uppercase"
                >
                  {label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    ref={index === 0 ? firstInputRef : undefined}
                    id={inputId}
                    data-seat-input="true"
                    type="text"
                    value={value}
                    onChange={(e) => updateSeat(index, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave();
                    }}
                    placeholder="e.g. 14A"
                    maxLength={5}
                    aria-label={`${label} number`}
                    className={cn(
                      "flex-1 bg-transparent border-b border-amber-faint",
                      "px-1 py-1.5 font-board text-lg text-amber amber-glow",
                      "tracking-wider uppercase",
                      "focus:outline-none focus:border-amber"
                    )}
                  />
                  {seats.length > 1 && (
                    <button
                      onClick={() => removeSeat(index)}
                      className="shrink-0 p-1 text-amber-faint hover:text-red-500 transition-colors"
                      aria-label={`Remove ${label}`}
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add-seat button */}
          <button
            onClick={addSeat}
            className={cn(
              "w-full flex items-center justify-center gap-1.5 py-2 mt-2",
              "border border-dashed border-amber-faint text-amber-faint",
              "hover:border-amber hover:text-amber transition-colors",
              "font-mono text-[10px] tracking-wider uppercase"
            )}
            aria-label="Add another seat"
          >
            <Plus size={12} strokeWidth={2} />
            ADD SEAT
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 p-3 border-t border-board-border">
          {hasAnyInitial && (
            <button
              onClick={handleClear}
              className="px-3 py-2 border border-board-border text-amber-faint hover:text-red-500 hover:border-red-500 font-mono text-[10px] tracking-wider uppercase transition-colors"
              aria-label="Clear all seats"
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
            aria-label="Save seats"
          >
            <Check size={12} strokeWidth={2} />
            SAVE
          </button>
        </div>
      </div>
    </div>
  );
}
