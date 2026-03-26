/**
 * BoardPanel.tsx — Dot-matrix board panel wrapper
 *
 * This component creates the recessed panel look of a real
 * TfL dot-matrix departure board. It has:
 *   - Dark surface background (#111111)
 *   - Thin border (#1a1a1a)
 *   - No rounded corners (sharp edges)
 *   - Inset shadow for a recessed look
 *   - Optional scanline overlay
 *   - Optional amber header text
 *
 * Usage:
 *   <BoardPanel title="DEPARTURES">
 *     <ArrivalRow ... />
 *   </BoardPanel>
 */

import { cn } from "@/lib/utils";
import AmberText from "./AmberText";

/* ========================================
 * PROPS
 * ======================================== */
interface BoardPanelProps {
  /** Content inside the panel */
  children: React.ReactNode;
  /** Optional title shown at the top in amber text */
  title?: string;
  /** Additional CSS classes for the outer container */
  className?: string;
  /** If true, adds the scanline overlay effect (default: true) */
  scanlines?: boolean;
}

/* ========================================
 * COMPONENT
 * ======================================== */
export default function BoardPanel({
  children,
  title,
  className,
  scanlines = true,
}: BoardPanelProps) {
  return (
    <div
      className={cn(
        /* Core board panel styles */
        "board-panel",
        /* Add scanline overlay if enabled */
        scanlines && "scanline",
        /* Padding inside the panel */
        "p-4",
        /* Any extra classes */
        className
      )}
    >
      {/* Optional title bar at the top */}
      {title && (
        <div className="mb-3 border-b border-board-border pb-2">
          <AmberText
            variant="secondary"
            size="sm"
            uppercase
            className="font-board"
          >
            {title}
          </AmberText>
        </div>
      )}

      {/* Panel content */}
      {children}
    </div>
  );
}
