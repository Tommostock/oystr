/**
 * SaveStationButton.tsx — Button to save/unsave a station
 *
 * Toggles a station's favourite status in IndexedDB.
 * Shows a filled star when saved, outline star when not.
 *
 * Usage:
 *   <SaveStationButton
 *     station={{ naptanId: "940GZZLUMLE", name: "Mile End", ... }}
 *   />
 */

"use client";

import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { useFavourites } from "@/hooks/useFavourites";
import { cn } from "@/lib/utils";

interface SaveStationButtonProps {
  /** Station details to save */
  station: {
    naptanId: string;
    name: string;
    lat: number;
    lon: number;
    lines: { id: string; name: string }[];
  };
  /** Additional CSS classes */
  className?: string;
}

export default function SaveStationButton({
  station,
  className,
}: SaveStationButtonProps) {
  const { toggleFavourite, isFavourite } = useFavourites();

  /* Track whether this station is currently saved */
  const [saved, setSaved] = useState(false);
  /* Prevent double-clicks */
  const [isToggling, setIsToggling] = useState(false);

  /*
   * Check if the station is already a favourite on mount
   * and whenever the station changes.
   */
  useEffect(() => {
    isFavourite(station.naptanId).then(setSaved);
  }, [station.naptanId, isFavourite]);

  /**
   * Handle the save/unsave toggle.
   */
  const handleToggle = async () => {
    if (isToggling) return;
    setIsToggling(true);

    try {
      const nowSaved = await toggleFavourite({
        naptanId: station.naptanId,
        name: station.name,
        lines: station.lines.map((l) => l.id),
        lat: station.lat,
        lng: station.lon,
      });
      setSaved(nowSaved);
    } catch (error) {
      console.error("Failed to toggle favourite:", error);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isToggling}
      className={cn(
        /* Compact icon-only button */
        "p-2 shrink-0",
        /* Hover effect */
        "hover:bg-surface transition-colors duration-200",
        /* Disabled state */
        "disabled:opacity-50",
        className
      )}
      aria-label={saved ? "Remove from saved stations" : "Save this station"}
    >
      <Star
        size={20}
        strokeWidth={1.5}
        className={cn(
          saved ? "text-amber fill-amber" : "text-amber-faint"
        )}
      />
    </button>
  );
}
