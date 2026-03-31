/**
 * constants.ts — Shared constants for Oystr
 *
 * Contains tube line colours, names, and IDs.
 * These match the official TfL branding colours exactly.
 */

/* ========================================
 * TUBE LINE DEFINITIONS
 * Each line has an id (used in TfL API calls),
 * a display name, and an official hex colour.
 * ======================================== */

/** Official TfL line colours — used for map lines, status indicators, etc. */
export const LINE_COLOURS: Record<string, string> = {
  bakerloo: "#B36305",
  central: "#E32017",
  circle: "#FFD300",
  district: "#00782A",
  "hammersmith-city": "#F3A9BB",
  jubilee: "#A0A5A9",
  metropolitan: "#9B0056",
  northern: "#2A2A2A", /* Lightened from #000 to be visible on dark background */
  piccadilly: "#003688",
  victoria: "#0098D4",
  "waterloo-city": "#95CDBA",
  elizabeth: "#6950A1",
  dlr: "#00A4A7",
  "london-overground": "#EE7C0E",
  tram: "#84B817",
  /*
   * London Overground sub-lines (introduced 2024).
   * TfL split "London Overground" into 6 named lines,
   * each with its own official colour.
   */
  liberty: "#6364AD",
  lioness: "#F5A300",
  mildmay: "#0077B6",
  suffragette: "#5BBF21",
  weaver: "#C43FA2",
  windrush: "#E1251B",
};

/** Display names for each line */
export const LINE_NAMES: Record<string, string> = {
  bakerloo: "Bakerloo",
  central: "Central",
  circle: "Circle",
  district: "District",
  "hammersmith-city": "Hammersmith & City",
  jubilee: "Jubilee",
  metropolitan: "Metropolitan",
  northern: "Northern",
  piccadilly: "Piccadilly",
  victoria: "Victoria",
  "waterloo-city": "Waterloo & City",
  elizabeth: "Elizabeth line",
  dlr: "DLR",
  "london-overground": "London Overground",
  tram: "Tram",
  /* London Overground sub-lines */
  liberty: "Liberty",
  lioness: "Lioness",
  mildmay: "Mildmay",
  suffragette: "Suffragette",
  weaver: "Weaver",
  windrush: "Windrush",
};


/* ========================================
 * TFL API CONFIGURATION
 * Base URL for all TfL API calls.
 * Actual API calls go through our Next.js API routes,
 * but this is used server-side in those routes.
 * ======================================== */
export const TFL_API_BASE = "https://api.tfl.gov.uk";

/* ========================================
 * POLLING INTERVALS (in milliseconds)
 * How often we refresh live data from TfL.
 * ======================================== */
export const ARRIVALS_POLL_INTERVAL = 30_000; // 30 seconds
export const LINE_STATUS_POLL_INTERVAL = 60_000; // 60 seconds

/* ========================================
 * NAVIGATION TABS
 * Used by the BottomNav component.
 * ======================================== */
export const NAV_TABS = [
  { href: "/", label: "Departures", icon: "train" },
  { href: "/journey", label: "Journey", icon: "route" },
  { href: "/status", label: "Status", icon: "activity" },
  { href: "/saved", label: "Saved", icon: "star" },
] as const;
