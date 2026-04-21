/**
 * db.ts — Dexie.js Database for Oystr
 *
 * Dexie is a friendly wrapper around IndexedDB (the browser's built-in database).
 * We use it to store favourite stations and cached data so the app can work offline.
 *
 * IndexedDB persists data even when you close the browser — it's like
 * localStorage but much more powerful (can store large objects, has indexes, etc.)
 */

import Dexie, { type Table } from "dexie";

/* ========================================
 * DATABASE TABLE TYPES
 * ======================================== */

/** A station the user has saved as a favourite */
export interface FavouriteStation {
  /** Unique TfL station ID (e.g. "940GZZLUMLE" for Mile End) */
  naptanId: string;
  /** Station display name */
  name: string;
  /** IDs of lines serving this station (e.g. ["central", "district"]) */
  lines: string[];
  /** Latitude coordinate */
  lat: number;
  /** Longitude coordinate */
  lng: number;
  /** When the user saved this station (Unix timestamp) */
  addedAt: number;
  /** Transport modes (e.g. ["tube", "dlr"] or ["bus"]) */
  modes?: string[];
  /** Bus stop letter (e.g. "H") — only for bus stops */
  stopLetter?: string;
  /** Bus stop indicator text (e.g. "Stop H") — only for bus stops */
  indicator?: string;
}

/** A cached timetable for offline use */
export interface CachedTimetable {
  id: string;
  lineId: string;
  stationId: string;
  data: object;
  cachedAt: number;
}

/**
 * A saved TfL journey (FROM -> TO station pair) on the Plan tab.
 * Stored in the pre-existing `savedJourneys` Dexie table (v1+).
 */
export interface SavedJourney {
  /** Unique key — always "${fromNaptanId}-${toNaptanId}" (idempotent saves) */
  id: string;
  /** Origin station naptan ID */
  fromNaptanId: string;
  /** Origin station display name */
  fromName: string;
  /** Origin lat (used to preserve location info when navigating back) */
  fromLat: number;
  /** Origin lon */
  fromLon: number;
  /** Destination naptan ID */
  toNaptanId: string;
  /** Destination display name */
  toName: string;
  /** Destination lat */
  toLat: number;
  /** Destination lon */
  toLon: number;
  /** Unix timestamp */
  savedAt: number;
}

/** A saved National Rail journey (long-distance intercity route) */
export interface SavedRailJourney {
  /** Unique key — always "${fromCrs}-${toCrs}" so saving twice is idempotent */
  id: string;
  /** Origin station CRS code (e.g. "KGX") */
  fromCrs: string;
  /** Origin station display name (e.g. "London Kings Cross") */
  fromName: string;
  /** Destination station CRS code (e.g. "LDS") */
  toCrs: string;
  /** Destination station display name (e.g. "Leeds") */
  toName: string;
  /** Unix timestamp when the user saved this route */
  addedAt: number;
}

/**
 * A specific rail service the user is actively travelling on (or plans
 * to travel on). Unlike SavedRailJourney (a generic route), a
 * TrackedRailJourney is tied to a single date + scheduled departure —
 * essentially "I'm on the 08:40 KGX-LDS on 21 April".
 *
 * Auto-clears ~10 minutes after scheduled arrival at the user's
 * destination (see useTrackedRailJourneys).
 */
export interface TrackedRailJourney {
  /** Unique key — "${fromCrs}-${toCrs}-${travelDate}-${scheduledDeparture}" */
  id: string;
  /** Origin station CRS code (e.g. "KGX") */
  fromCrs: string;
  /** Origin station display name */
  fromName: string;
  /** Destination station CRS code (e.g. "LDS") */
  toCrs: string;
  /** Destination station display name */
  toName: string;
  /** Date of travel in YYYY-MM-DD (local/UK time) */
  travelDate: string;
  /** Scheduled departure from origin in HH:mm */
  scheduledDeparture: string;
  /**
   * Scheduled/estimated arrival at the user's destination in HH:mm at
   * the moment the journey was tracked. Used purely for auto-clear:
   * the card itself re-fetches live data on travel day.
   */
  destinationEta: string;
  /**
   * RDM service ID at the time of tracking. Service IDs rotate daily,
   * so this is only reliable on the travel date itself; on other days
   * we match by from/to/scheduledDeparture instead.
   */
  serviceId?: string;
  /** Unix timestamp when the user tracked this journey */
  trackedAt: number;
}

/* ========================================
 * DATABASE CLASS
 * ======================================== */
class OystrDatabase extends Dexie {
  favourites!: Table<FavouriteStation>;
  timetables!: Table<CachedTimetable>;
  savedRailJourneys!: Table<SavedRailJourney>;
  trackedRailJourneys!: Table<TrackedRailJourney>;
  /*
   * The savedJourneys table has existed in the schema since v1 but
   * wasn't typed or used until Plan-tab saved journeys shipped.
   */
  savedJourneys!: Table<SavedJourney>;

  constructor() {
    super("oystr");

    /*
     * Schema version 1 (original).
     * Kept for Dexie upgrade path — users with v1 DBs
     * will automatically migrate to v2/v3.
     */
    this.version(1).stores({
      favourites: "naptanId, name, addedAt",
      timetables: "id, lineId, stationId, cachedAt",
      lineStatuses: "lineId, cachedAt",
      savedJourneys: "id, savedAt",
      stations: "naptanId, name, *lines",
    });

    /*
     * Schema version 2: adds bus stop support.
     * New optional fields (modes, stopLetter, indicator) don't need
     * index changes — Dexie handles added non-indexed fields automatically.
     * Existing favourites will simply have these fields as undefined.
     */
    this.version(2).stores({
      favourites: "naptanId, name, addedAt",
      timetables: "id, lineId, stationId, cachedAt",
      lineStatuses: "lineId, cachedAt",
      savedJourneys: "id, savedAt",
      stations: "naptanId, name, *lines",
    });

    /*
     * Schema version 3: adds National Rail support.
     * New `savedRailJourneys` table stores long-distance routes
     * (e.g. London Kings Cross -> Leeds). Keyed by "${fromCrs}-${toCrs}"
     * so saving the same route twice is a no-op.
     */
    this.version(3).stores({
      favourites: "naptanId, name, addedAt",
      timetables: "id, lineId, stationId, cachedAt",
      lineStatuses: "lineId, cachedAt",
      savedJourneys: "id, savedAt",
      stations: "naptanId, name, *lines",
      savedRailJourneys: "id, fromCrs, toCrs, addedAt",
    });

    /*
     * Schema version 4: adds active-journey tracking.
     * trackedRailJourneys stores specific services the user is on or
     * plans to get (scoped to a date + scheduled departure time).
     * Auto-cleared after the destination arrival time elapses.
     */
    this.version(4).stores({
      favourites: "naptanId, name, addedAt",
      timetables: "id, lineId, stationId, cachedAt",
      lineStatuses: "lineId, cachedAt",
      savedJourneys: "id, savedAt",
      stations: "naptanId, name, *lines",
      savedRailJourneys: "id, fromCrs, toCrs, addedAt",
      trackedRailJourneys: "id, travelDate, trackedAt",
    });
  }
}

/**
 * The single database instance used throughout the app.
 * Import this in any component that needs to read/write data.
 */
export const db = new OystrDatabase();
