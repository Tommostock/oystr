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
 * NIGHT TUBE
 *
 * Five Tube lines plus part of the Overground run a full 24h service
 * on Friday and Saturday nights. The eligible lines are set by TfL
 * and change rarely — keeping them in a constant means the UI can
 * cheaply flag a line as "NIGHT TUBE" during the active window.
 *
 * Night Tube runs roughly 00:30 Sat → 05:30 Sat, and 00:30 Sun → 05:30 Sun
 * (i.e. Fri and Sat nights in everyday speech).
 * ======================================== */
export const NIGHT_TUBE_LINES: string[] = [
  "central",
  "jubilee",
  "northern",
  "piccadilly",
  "victoria",
];

/**
 * Is Night Tube currently active?
 *
 * Active window covers both the "late Friday into Saturday" and
 * "late Saturday into Sunday" periods. Defined loosely as:
 *   - After 23:00 on Fri / Sat, OR
 *   - Before 06:00 on Sat / Sun.
 *
 * Accepts an optional Date for testability; defaults to now.
 */
export function isNightTubeActive(date: Date = new Date()): boolean {
  const day = date.getDay(); /* 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat */
  const hour = date.getHours();
  /* Late Fri or late Sat: after 23:00 */
  if ((day === 5 || day === 6) && hour >= 23) return true;
  /* Early Sat or early Sun: before 06:00 */
  if ((day === 6 || day === 0) && hour < 6) return true;
  return false;
}

/* ========================================
 * NATIONAL RAIL (RDM) API CONFIGURATION
 * Base URL for the Rail Data Marketplace LDBWS REST API.
 * Used by /api/rail/* routes for live National Rail departures.
 *
 * Product: "Live Arrival and Departure Boards" by Rail Delivery Group.
 * We use the GetArrDepBoardWithDetails endpoint which returns
 * arrivals + departures + full calling-point lists for every train
 * in a single response. This means no separate Service Details
 * subscription is needed for the "tap a train to see its route"
 * feature — the calling points are bundled inline.
 *
 * Requires a free API key from https://raildata.org.uk — sign up,
 * then subscribe to "Live Arrival and Departure Boards".
 * Set the consumer key as RDM_API_KEY in .env.local.
 * ======================================== */
export const RDM_API_BASE =
  "https://api1.raildata.org.uk/1010-live-arrival-and-departure-boards-arr-and-dep1_1/LDBWS/api/20220120";

/* ========================================
 * POLLING INTERVALS (in milliseconds)
 * How often we refresh live data from TfL / National Rail.
 * ======================================== */
export const ARRIVALS_POLL_INTERVAL = 30_000; // 30 seconds
export const LINE_STATUS_POLL_INTERVAL = 60_000; // 60 seconds
export const RAIL_DEPARTURES_POLL_INTERVAL = 30_000; // 30 seconds

/* ========================================
 * NAVIGATION TABS
 * Used by the BottomNav component.
 * RAIL sits between JOURNEY and STATUS — long-distance is conceptually
 * closer to journey planning than to live London status.
 * ======================================== */
export const NAV_TABS = [
  { href: "/", label: "Terminal", icon: "train" },
  { href: "/nearby", label: "Nearby", icon: "map-pin" },
  { href: "/journey", label: "Tube", icon: "route" },
  { href: "/rail", label: "Rail", icon: "train-front" },
  { href: "/status", label: "Status", icon: "activity" },
  { href: "/flights", label: "Flights", icon: "plane" },
] as const;

/* ========================================
 * MAP TILE URL
 * CartoDB dark_matter — free, no API key required.
 * Matches the app's dark dot-matrix theme.
 * ======================================== */
export const DARK_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
