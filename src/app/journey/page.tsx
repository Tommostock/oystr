/**
 * journey/page.tsx — Journey Planner placeholder
 *
 * Will be replaced with the full journey planner:
 * From/To search inputs, time selector, and journey results.
 */

import BoardPanel from "@/components/shared/BoardPanel";
import AmberText from "@/components/shared/AmberText";

export default function JourneyPage() {
  return (
    <div className="p-4">
      <BoardPanel title="Journey Planner">
        <div className="py-12 text-center">
          <AmberText variant="dim" size="sm" className="dot-matrix">
            Journey planner coming soon
          </AmberText>
        </div>
      </BoardPanel>
    </div>
  );
}
