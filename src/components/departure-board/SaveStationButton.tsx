/**
 * SaveStationButton.tsx — Save/unsave a TfL station (tube/bus)
 *
 * Thin wrapper: reads saved state from useFavourites, delegates
 * the visual to the shared StarToggle primitive so every save
 * button across the app renders identically.
 */

"use client";

import { useEffect, useState } from "react";
import { useFavourites } from "@/hooks/useFavourites";
import StarToggle from "@/components/shared/StarToggle";

interface SaveStationButtonProps {
  station: {
    naptanId: string;
    name: string;
    lat: number;
    lon: number;
    lines: { id: string; name: string }[];
    modes?: string[];
    stopLetter?: string;
    indicator?: string;
  };
  className?: string;
}

export default function SaveStationButton({
  station,
  className,
}: SaveStationButtonProps) {
  const { toggleFavourite, isFavourite } = useFavourites();
  const [saved, setSaved] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    isFavourite(station.naptanId).then(setSaved);
  }, [station.naptanId, isFavourite]);

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
        modes: station.modes,
        stopLetter: station.stopLetter,
        indicator: station.indicator,
      });
      setSaved(nowSaved);
    } catch (error) {
      console.error("Failed to toggle favourite:", error);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <StarToggle
      saved={saved}
      onToggle={handleToggle}
      disabled={isToggling}
      label={station.name}
      size={20}
      className={className}
    />
  );
}
