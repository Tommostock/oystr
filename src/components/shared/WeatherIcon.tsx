/**
 * WeatherIcon.tsx — Small weather symbol for a station's location
 *
 * Fetches current weather from Open-Meteo (free, no API key needed)
 * using the station's lat/lon coordinates. Shows a tiny weather
 * symbol as a superscript next to the station name.
 *
 * Weather codes from Open-Meteo WMO standard:
 *   0      = Clear sky
 *   1-3    = Partly cloudy / overcast
 *   45, 48 = Fog
 *   51-57  = Drizzle
 *   61-67  = Rain
 *   71-77  = Snow
 *   80-82  = Rain showers
 *   85-86  = Snow showers
 *   95-99  = Thunderstorm
 *
 * Usage:
 *   <WeatherIcon lat={51.5074} lon={-0.1278} />
 */

"use client";

import { useState, useEffect } from "react";
import {
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  CloudDrizzle,
} from "lucide-react";

interface WeatherIconProps {
  /** Station latitude */
  lat: number;
  /** Station longitude */
  lon: number;
}

/**
 * Map WMO weather code to a Lucide icon component and colour.
 */
function getWeatherDisplay(code: number): {
  Icon: typeof Sun;
  colour: string;
  label: string;
} {
  /* Clear */
  if (code === 0) return { Icon: Sun, colour: "#FBBF24", label: "Clear" };

  /* Partly cloudy */
  if (code <= 2) return { Icon: CloudSun, colour: "#9CA3AF", label: "Partly cloudy" };

  /* Overcast */
  if (code === 3) return { Icon: Cloud, colour: "#6B7280", label: "Overcast" };

  /* Fog */
  if (code === 45 || code === 48) return { Icon: CloudFog, colour: "#9CA3AF", label: "Fog" };

  /* Drizzle */
  if (code >= 51 && code <= 57) return { Icon: CloudDrizzle, colour: "#60A5FA", label: "Drizzle" };

  /* Rain */
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return { Icon: CloudRain, colour: "#3B82F6", label: "Rain" };

  /* Snow */
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86))
    return { Icon: CloudSnow, colour: "#E5E7EB", label: "Snow" };

  /* Thunderstorm */
  if (code >= 95) return { Icon: CloudLightning, colour: "#F59E0B", label: "Thunderstorm" };

  /* Fallback */
  return { Icon: Cloud, colour: "#6B7280", label: "Cloudy" };
}

export default function WeatherIcon({ lat, lon }: WeatherIconProps) {
  const [weatherCode, setWeatherCode] = useState<number | null>(null);

  useEffect(() => {
    /* Skip if no valid coordinates */
    if (!lat || !lon || lat === 0) return;

    async function fetchWeather() {
      try {
        /*
         * Open-Meteo API — free, no key needed, generous rate limits.
         * We only need the current weather code.
         */
        const resp = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code&timezone=Europe%2FLondon`
        );
        if (!resp.ok) return;

        const data = await resp.json();
        const code = data.current?.weather_code;
        if (typeof code === "number") {
          setWeatherCode(code);
        }
      } catch {
        /* Silently fail — weather is not critical */
      }
    }

    fetchWeather();

    /* Refresh weather every 15 minutes */
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [lat, lon]);

  /* Don't render until we have data */
  if (weatherCode === null) return null;

  const { Icon, colour, label } = getWeatherDisplay(weatherCode);

  return (
    <span
      className="inline-flex items-center shrink-0 ml-1 -mt-2"
      title={label}
      aria-label={`Weather: ${label}`}
    >
      <Icon size={12} strokeWidth={1.5} style={{ color: colour }} />
    </span>
  );
}
