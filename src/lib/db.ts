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

/* ========================================
 * DATABASE CLASS
 * ======================================== */
class OystrDatabase extends Dexie {
  favourites!: Table<FavouriteStation>;
  timetables!: Table<CachedTimetable>;

  constructor() {
    super("oystr");

    /*
     * Schema version 1 (original).
     * Kept for Dexie upgrade path — users with v1 DBs
     * will automatically migrate to v2.
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
  }
}

/**
 * The single database instance used throughout the app.
 * Import this in any component that needs to read/write data.
 */
export const db = new OystrDatabase();
