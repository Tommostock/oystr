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
  Moon,
  Cloud,
  CloudSun,
  CloudMoon,
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
/** Amber colour matching the app's glow theme */
const AMBER = "#ff9500";

/**
 * Map WMO weather code to a Lucide icon component.
 * isDay = false swaps sun-based icons for moon equivalents:
 *   Sun -> Moon, CloudSun -> CloudMoon
 * Rain, snow, drizzle, fog, and thunderstorm stay the same
 * since they don't show the sun anyway.
 */
function getWeatherDisplay(
  code: number,
  isDay: boolean
): {
  Icon: typeof Sun;
  label: string;
} {
  /* Clear */
  if (code === 0)
    return { Icon: isDay ? Sun : Moon, label: isDay ? "Clear" : "Clear night" };

  /* Partly cloudy */
  if (code <= 2)
    return {
      Icon: isDay ? CloudSun : CloudMoon,
      label: isDay ? "Partly cloudy" : "Partly cloudy night",
    };

  /* Overcast */
  if (code === 3) return { Icon: Cloud, label: "Overcast" };

  /* Fog */
  if (code === 45 || code === 48) return { Icon: CloudFog, label: "Fog" };

  /* Drizzle */
  if (code >= 51 && code <= 57) return { Icon: CloudDrizzle, label: "Drizzle" };

  /* Rain */
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return { Icon: CloudRain, label: "Rain" };

  /* Snow */
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86))
    return { Icon: CloudSnow, label: "Snow" };

  /* Thunderstorm */
  if (code >= 95) return { Icon: CloudLightning, label: "Thunderstorm" };

  /* Fallback */
  return { Icon: Cloud, label: "Cloudy" };
}

export default function WeatherIcon({ lat, lon }: WeatherIconProps) {
  const [weatherCode, setWeatherCode] = useState<number | null>(null);
  /* Track whether it's daytime (1) or nighttime (0) from Open-Meteo */
  const [isDay, setIsDay] = useState(true);

  useEffect(() => {
    /* Skip if no valid coordinates */
    if (!lat || !lon || lat === 0) return;

    async function fetchWeather() {
      try {
        /*
         * Open-Meteo API — free, no key needed, generous rate limits.
         * We fetch weather_code and is_day so we can swap sun for moon
         * icons after sunset.
         */
        const resp = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,is_day&timezone=Europe%2FLondon`
        );
        if (!resp.ok) return;

        const data = await resp.json();
        const code = data.current?.weather_code;
        if (typeof code === "number") {
          setWeatherCode(code);
        }
        /* is_day: 1 = daytime, 0 = nighttime */
        if (typeof data.current?.is_day === "number") {
          setIsDay(data.current.is_day === 1);
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

  const { Icon, label } = getWeatherDisplay(weatherCode, isDay);

  return (
    <span
      className="inline-flex items-center shrink-0 ml-1 -mt-2 amber-glow"
      title={label}
      aria-label={`Weather: ${label}`}
    >
      <Icon size={12} strokeWidth={1.5} style={{ color: AMBER }} />
    </span>
  );
}
