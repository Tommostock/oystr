/**
 * SaveRailStationButton.tsx — Toggle a National Rail station as a favourite
 *
 * Mirrors SaveStationButton (tube/bus) but writes to savedRailStations
 * instead of favourites. A filled star means the station is pinned
 * and will appear as a card on the Depart tab.
 */

"use client";

import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { useSavedRailStations } from "@/hooks/useSavedRailStations";
import { cn } from "@/lib/utils";

interface SaveRailStationButtonProps {
  station: { crs: string; name: string };
  className?: string;
}

export default function SaveRailStationButton({
  station,
  className,
}: SaveRailStationButtonProps) {
  const { toggleStation, isSaved } = useSavedRailStations();

  const [saved, setSaved] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    isSaved(station.crs).then(setSaved);
  }, [station.crs, isSaved]);

  const handleToggle = async () => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      const nowSaved = await toggleStation({
        crs: station.crs,
        name: station.name,
      });
      setSaved(nowSaved);
    } catch (error) {
      console.error("Failed to toggle rail station favourite:", error);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isToggling}
      className={cn(
        "shrink-0 p-2 transition-colors",
        saved
          ? "text-amber amber-glow hover:text-amber-dim"
          : "text-amber-faint hover:text-amber",
        className
      )}
      aria-label={saved ? `Remove ${station.name} from saved` : `Save ${station.name}`}
      title={saved ? "Remove from saved" : "Save station"}
    >
      <Star
        size={22}
        strokeWidth={1.5}
        fill={saved ? "currentColor" : "none"}
      />
    </button>
  );
}
