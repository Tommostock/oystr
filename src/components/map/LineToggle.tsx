/**
 * LineToggle.tsx — Toggle buttons for showing/hiding lines on the map
 *
 * A horizontal scrollable row of buttons, one for each tube line.
 * Each button shows the line's colour and name.
 * Tapping toggles that line's visibility on the map.
 *
 * Usage:
 *   <LineToggle
 *     activeLines={["central", "victoria"]}
 *     onToggle={(lineId) => toggleLine(lineId)}
 *   />
 */

import { LINE_COLOURS, LINE_NAMES, ALL_LINE_IDS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface LineToggleProps {
  /** Set of currently active (visible) line IDs */
  activeLines: Set<string>;
  /** Called when a line button is tapped */
  onToggle: (lineId: string) => void;
}

/** Only show tube lines + elizabeth + dlr on the map (not overground sub-lines or tram) */
const MAP_LINES = ALL_LINE_IDS.filter(
  (id) =>
    ![
      "liberty",
      "lioness",
      "mildmay",
      "suffragette",
      "weaver",
      "windrush",
      "tram",
    ].includes(id)
);

export default function LineToggle({ activeLines, onToggle }: LineToggleProps) {
  return (
    <div
      className={cn(
        /* Horizontal scroll container */
        "flex gap-1.5 overflow-x-auto",
        /* Hide scrollbar but keep scrolling */
        "scrollbar-hide",
        /* Padding for the scroll area */
        "px-2 py-2"
      )}
    >
      {MAP_LINES.map((lineId) => {
        const isActive = activeLines.has(lineId);
        const colour = LINE_COLOURS[lineId] || "#FF9500";

        return (
          <button
            key={lineId}
            onClick={() => onToggle(lineId)}
            className={cn(
              /* Base button style */
              "shrink-0 px-2.5 py-1.5",
              "font-mono text-[10px] tracking-wider uppercase",
              "border rounded-sm transition-all duration-200",
              /* Active vs inactive */
              isActive
                ? "border-current text-white"
                : "border-board-border text-amber-faint opacity-50 hover:opacity-75"
            )}
            style={
              isActive
                ? { backgroundColor: colour, borderColor: colour }
                : undefined
            }
            aria-pressed={isActive}
            aria-label={`${isActive ? "Hide" : "Show"} ${LINE_NAMES[lineId]} line`}
          >
            {LINE_NAMES[lineId] || lineId}
          </button>
        );
      })}
    </div>
  );
}
