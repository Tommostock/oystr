/**
 * SaveAirportButton.tsx — Toggle an airport as a favourite
 *
 * Mirrors SaveRailStationButton. Writes to savedAirports so a tap
 * here pins the airport on the Terminal tab's quick-view grid.
 */

"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useSavedAirports } from "@/hooks/useSavedAirports";
import { cn } from "@/lib/utils";

interface SaveAirportButtonProps {
  airport: { iata: string; name: string; city?: string; country?: string };
  className?: string;
}

export default function SaveAirportButton({
  airport,
  className,
}: SaveAirportButtonProps) {
  const { toggleAirport, isSaved } = useSavedAirports();
  const [saved, setSaved] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    isSaved(airport.iata).then(setSaved);
  }, [airport.iata, isSaved]);

  const handleToggle = async () => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      const nowSaved = await toggleAirport({
        iata: airport.iata,
        name: airport.name,
        city: airport.city,
        country: airport.country,
      });
      setSaved(nowSaved);
    } catch (error) {
      console.error("Failed to toggle airport favourite:", error);
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
      aria-label={saved ? `Remove ${airport.name} from saved` : `Save ${airport.name}`}
      title={saved ? "Remove from saved" : "Save airport"}
    >
      <Star size={22} strokeWidth={1.5} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}
