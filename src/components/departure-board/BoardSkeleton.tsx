/**
 * BoardSkeleton.tsx — Loading skeleton for departure boards
 *
 * Shows placeholder rows shaped like real departure board entries.
 * Animates with a subtle pulse to indicate loading.
 * Much more polished than a simple "LOADING..." text.
 *
 * Usage:
 *   <BoardSkeleton rows={4} />
 */

import BoardPanel from "@/components/shared/BoardPanel";

interface BoardSkeletonProps {
  /** Number of skeleton rows to show (default: 4) */
  rows?: number;
  /** Optional title for the panel */
  title?: string;
}

export default function BoardSkeleton({
  rows = 4,
  title,
}: BoardSkeletonProps) {
  return (
    <BoardPanel title={title}>
      <div className="space-y-1">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 py-2.5 border-b border-board-border/50 last:border-b-0 animate-pulse"
          >
            {/* Line colour dot placeholder */}
            <div className="flex items-center gap-2 shrink-0 w-10">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-faint/30" />
              <div className="w-4 h-4 bg-amber-faint/20 rounded-sm" />
            </div>

            {/* Destination placeholder — varying widths for realism */}
            <div
              className="h-5 bg-amber-faint/20 rounded-sm"
              style={{ width: `${40 + (i * 17) % 35}%` }}
            />

            {/* Time placeholder */}
            <div className="shrink-0 w-16 h-5 bg-amber-faint/20 rounded-sm ml-auto" />
          </div>
        ))}
      </div>
    </BoardPanel>
  );
}
