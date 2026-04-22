/**
 * SaveRailStationButton.tsx — Save/unsave a National Rail station
 *
 * Thin wrapper: reads saved state from useSavedRailStations, delegates
 * the visual to the shared StarToggle primitive.
 */

"use client";

import { useEffect, useState } from "react";
import { useSavedRailStations } from "@/hooks/useSavedRailStations";
import StarToggle from "@/components/shared/StarToggle";

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
    <StarToggle
      saved={saved}
      onToggle={handleToggle}
      disabled={isToggling}
      label={station.name}
      className={className}
    />
  );
}
