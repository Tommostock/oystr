/**
 * rail-operators.ts — Short display names for UK Train Operating Companies
 *
 * The RDM API returns full operator names like "London North Eastern Railway"
 * which are too long to fit comfortably on mobile departure board rows
 * (28+ characters). This file maps the known full names to their
 * commonly-used short forms (brand names, acronyms) that match what you
 * see on real UK station boards.
 *
 * Mappings are keyed by lowercase-trimmed name for case-insensitive matching.
 * If no match is found, the full name is returned unchanged — so this
 * degrades gracefully if new operators appear or names change.
 */

const OPERATOR_SHORT_NAMES: Record<string, string> = {
  "london north eastern railway": "LNER",
  "great western railway": "GWR",
  "avanti west coast": "AVANTI",
  "east midlands railway": "EMR",
  "crosscountry": "XCOUNTRY",
  "south western railway": "SWR",
  "southeastern": "SOUTHEASTERN",
  "southern": "SOUTHERN",
  "thameslink": "THAMESLINK",
  "great northern": "GREAT NORTHERN",
  "transport for wales": "TFW",
  "scotrail": "SCOTRAIL",
  "hull trains": "HULL TRAINS",
  "grand central": "GRAND CENTRAL",
  "lumo": "LUMO",
  "chiltern railways": "CHILTERN",
  "northern": "NORTHERN",
  "transpennine express": "TPE",
  "caledonian sleeper": "SLEEPER",
  "heathrow express": "HEATHROW EXP",
  "merseyrail": "MERSEYRAIL",
  "c2c": "C2C",
  "elizabeth line": "ELIZABETH",
  "london overground": "OVERGROUND",
  "greater anglia": "ANGLIA",
  "gatwick express": "GATWICK EXP",
  "west midlands trains": "WMT",
  "west midlands railway": "WMR",
  "london northwestern railway": "LNWR",
};

/**
 * Convert a full TOC name to its short display form.
 * Falls back to the original name if not in the mapping.
 */
export function shortOperatorName(fullName: string): string {
  if (!fullName) return "";
  const key = fullName.trim().toLowerCase();
  return OPERATOR_SHORT_NAMES[key] || fullName;
}
