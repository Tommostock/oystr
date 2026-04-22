/**
 * SaveAirportButton.tsx — Save/unsave an airport
 *
 * Thin wrapper: reads saved state from useSavedAirports, delegates
 * the visual to the shared StarToggle primitive.
 */

"use client";

import { useEffect, useState } from "react";
import { useSavedAirports } from "@/hooks/useSavedAirports";
import StarToggle from "@/components/shared/StarToggle";

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
    <StarToggle
      saved={saved}
      onToggle={handleToggle}
      disabled={isToggling}
      label={airport.name}
      className={className}
    />
  );
}
