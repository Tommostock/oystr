/**
 * saved/page.tsx — Saved Stations page
 *
 * Shows all favourite stations saved by the user.
 * Each station is a tappable card that navigates to
 * the departures board for that station.
 *
 * Stations are stored in IndexedDB via Dexie.js,
 * so they persist across sessions and work offline.
 */

"use client";

import { useRouter } from "next/navigation";
import { Star, Trash2 } from "lucide-react";
import { useFavourites } from "@/hooks/useFavourites";
import { LINE_COLOURS, LINE_NAMES } from "@/lib/constants";
import BoardPanel from "@/components/shared/BoardPanel";
import AmberText from "@/components/shared/AmberText";
import { cn } from "@/lib/utils";

export default function SavedPage() {
  const { favourites, removeFavourite } = useFavourites();
  const router = useRouter();

  /**
   * Navigate to the home page with the selected station.
   * We use a query parameter to pre-select the station.
   */
  const handleStationClick = (naptanId: string, name: string) => {
    /* Navigate to home with station info in the URL */
    router.push(`/?stopId=${naptanId}&name=${encodeURIComponent(name)}`);
  };

  /**
   * Remove a station from favourites.
   * Stops the click event from bubbling up to the card (which would navigate).
   */
  const handleRemove = async (
    e: React.MouseEvent,
    naptanId: string
  ) => {
    e.stopPropagation();
    await removeFavourite(naptanId);
  };

  return (
    <div className="p-4 space-y-4">
      {/* ---- Page Header ---- */}
      <div className="text-center pt-4 pb-2">
        <AmberText as="h1" size="lg" uppercase className="dot-matrix">
          Saved Stations
        </AmberText>
      </div>

      {/* ---- Empty State ---- */}
      {favourites.length === 0 && (
        <BoardPanel>
          <div className="py-8 text-center space-y-3">
            <Star
              size={32}
              strokeWidth={1}
              className="mx-auto text-amber-faint"
            />
            <AmberText variant="dim" size="sm" className="dot-matrix">
              NO SAVED STATIONS
            </AmberText>
            <p className="font-mono text-xs tracking-wider text-amber-faint">
              SEARCH FOR A STATION AND TAP &quot;SAVE STATION&quot;
              <br />
              TO ADD IT HERE FOR QUICK ACCESS
            </p>
          </div>
        </BoardPanel>
      )}

      {/* ---- Favourite Station Cards ---- */}
      <div className="space-y-2">
        {favourites.map((station) => (
          <div
            key={station.naptanId}
            onClick={() =>
              handleStationClick(station.naptanId, station.name)
            }
            className={cn(
              /* Card styling */
              "border border-board-border bg-surface",
              /* Interactive */
              "cursor-pointer hover:border-amber-faint",
              "transition-colors duration-200",
              /* Flex layout */
              "flex items-center gap-3 p-3"
            )}
            role="button"
            aria-label={`View departures for ${station.name}`}
          >
            {/* Line colour dots */}
            <div className="flex flex-col gap-1 shrink-0">
              {station.lines.slice(0, 3).map((lineId) => (
                <span
                  key={lineId}
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: LINE_COLOURS[lineId] || "#FF9500",
                  }}
                  title={LINE_NAMES[lineId] || lineId}
                  aria-hidden="true"
                />
              ))}
            </div>

            {/* Station name and line info */}
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm tracking-wider text-amber uppercase truncate">
                {station.name
                  .replace(/\s*Underground Station$/i, "")
                  .replace(/\s*Station$/i, "")}
              </div>
              <div className="font-mono text-xs tracking-wider text-amber-faint mt-0.5">
                {station.lines
                  .map((lineId) => LINE_NAMES[lineId] || lineId)
                  .join(", ")}
              </div>
            </div>

            {/* Remove button */}
            <button
              onClick={(e) => handleRemove(e, station.naptanId)}
              className="shrink-0 p-2 text-amber-faint hover:text-red-500 transition-colors"
              aria-label={`Remove ${station.name} from saved`}
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>

      {/* ---- Hint text ---- */}
      {favourites.length > 0 && (
        <div className="text-center py-1">
          <AmberText variant="dim" size="xs">
            TAP A STATION TO VIEW LIVE DEPARTURES
          </AmberText>
        </div>
      )}
    </div>
  );
}
