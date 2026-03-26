import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Clean up TfL station/stop names by removing common suffixes.
 * Used across the app wherever station names are displayed.
 *
 * "Epping Underground Station" => "Epping"
 * "Stratford (London) DLR Station" => "Stratford"
 */
export function cleanStationName(name: string): string {
  if (!name) return "";
  return name
    .replace(/\s*Underground Station$/i, "")
    .replace(/\s*DLR Station$/i, "")
    .replace(/\s*Rail Station$/i, "")
    .replace(/\s*\(London\)/i, "")
    .replace(/\s*Station$/i, "")
    .trim();
}

/**
 * Build TfL API query params with the API key if available.
 * Used by all server-side API routes.
 */
export function buildTflParams(): URLSearchParams {
  const params = new URLSearchParams();
  if (process.env.TFL_APP_KEY) {
    params.set("app_key", process.env.TFL_APP_KEY);
  }
  return params;
}
