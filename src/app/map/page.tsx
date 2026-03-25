/**
 * map/page.tsx — Tube Map placeholder
 *
 * Will be replaced with the full interactive Leaflet map
 * showing stations, lines, and live train positions.
 */

import BoardPanel from "@/components/shared/BoardPanel";
import AmberText from "@/components/shared/AmberText";

export default function MapPage() {
  return (
    <div className="p-4">
      <BoardPanel title="Tube Map">
        <div className="py-12 text-center">
          <AmberText variant="dim" size="sm" className="dot-matrix">
            Interactive map coming soon
          </AmberText>
        </div>
      </BoardPanel>
    </div>
  );
}
