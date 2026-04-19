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
 * Determine if a stop is exclusively a bus stop.
 *
 * In TfL's NaPTAN system, pure bus stops always have a naptanId
 * starting with "490". Multi-modal stations like "London City Airport"
 * (DLR station with nearby bus connections) may include "bus" in their
 * modes array but should NOT be treated as bus stops for display —
 * they should show the line colour dot of their primary mode (DLR, tube, etc.).
 *
 * This is the canonical check for bus classification across the app.
 */
export function isBusStop(naptanId: string, modes?: string[]): boolean {
  if (!naptanId) return false;
  /* Pure bus stops in NaPTAN always start with "490" */
  if (naptanId.startsWith("490")) return true;
  /*
   * Rail (including DLR and National Rail) NaPTAN codes always start
   * with "910". Tube codes start with "940". If the naptanId says
   * rail or tube, it is NOT a bus stop regardless of what the stored
   * modes array says — the modes may be stale (e.g. a station saved
   * before multi-modal enrichment landed, where TfL only returned
   * "bus" amongst the modes). London City Airport DLR is the classic
   * example — a 910-prefix DLR station that used to display with a
   * bus icon on the saved page.
   */
  if (naptanId.startsWith("910")) return false;
  if (naptanId.startsWith("940")) return false;
  /* Fallback: if mode info is available AND it's ONLY bus, treat as bus */
  if (modes && modes.length > 0 && modes.every((m) => m === "bus")) return true;
  return false;
}
