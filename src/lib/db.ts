/**
 * db.ts — Dexie.js Database for Oystr
 *
 * Dexie is a friendly wrapper around IndexedDB (the browser's built-in database).
 * We use it to store favourite stations, cached timetables, and other data
 * so the app can work offline.
 *
 * IndexedDB persists data even when you close the browser — it's like
 * localStorage but much more powerful (can store large objects, has indexes, etc.)
 */

import Dexie, { type Table } from "dexie";

/* ========================================
 * DATABASE TABLE TYPES
 * Each interface describes one row in a table.
 * ======================================== */

/** A station the user has saved as a favourite */
export interface FavouriteStation {
  /** Unique TfL station ID (e.g. "940GZZLUMLE" for Mile End) */
  naptanId: string;
  /** Station display name */
  name: string;
  /** IDs of lines serving this station (e.g. ["central", "district"]) */
  lines: string[];
  /** Latitude coordinate for map display */
  lat: number;
  /** Longitude coordinate for map display */
  lng: number;
  /** When the user saved this station (Unix timestamp) */
  addedAt: number;
}

/** A cached timetable for offline use */
export interface CachedTimetable {
  /** Composite key: "{lineId}_{stationId}" */
  id: string;
  /** Which line this timetable is for */
  lineId: string;
  /** Which station this timetable is for */
  stationId: string;
  /** The raw timetable data from TfL */
  data: object;
  /** When this was last downloaded (Unix timestamp) */
  cachedAt: number;
}

/** Cached line status for offline fallback */
export interface CachedLineStatus {
  /** Line ID, e.g. "central" */
  lineId: string;
  /** Status text, e.g. "Good Service" */
  status: string;
  /** Reason for disruption (empty string if good service) */
  reason: string;
  /** When this was last updated (Unix timestamp) */
  cachedAt: number;
}

/** A journey the user has saved for quick access */
export interface SavedJourney {
  /** Unique ID for this saved journey */
  id: string;
  /** Starting station Naptan ID */
  fromId: string;
  /** Starting station display name */
  fromName: string;
  /** Destination station Naptan ID */
  toId: string;
  /** Destination station display name */
  toName: string;
  /** When the user saved this journey (Unix timestamp) */
  savedAt: number;
}

/** Cached station data (coordinates, lines, etc.) */
export interface StationData {
  /** Unique TfL station ID */
  naptanId: string;
  /** Station display name */
  name: string;
  /** Latitude coordinate */
  lat: number;
  /** Longitude coordinate */
  lng: number;
  /** IDs of lines serving this station */
  lines: string[];
  /** Zone info (e.g. "2" or "1+2") */
  zone: string;
  /** Transport modes (e.g. ["tube", "dlr"]) */
  modes: string[];
}

/* ========================================
 * DATABASE CLASS
 * Extends Dexie to define our tables and schema.
 * The schema string defines which fields are indexed
 * (searchable). Only indexed fields appear in the schema —
 * all other fields are still stored, just not indexed.
 * ======================================== */
class OystrDatabase extends Dexie {
  /** Table of favourite stations */
  favourites!: Table<FavouriteStation>;
  /** Table of cached timetables */
  timetables!: Table<CachedTimetable>;
  /** Table of cached line statuses */
  lineStatuses!: Table<CachedLineStatus>;
  /** Table of saved journeys */
  savedJourneys!: Table<SavedJourney>;
  /** Table of all station data (for map and search) */
  stations!: Table<StationData>;

  constructor() {
    /* 'oystr' is the database name in the browser */
    super("oystr");

    /*
     * Define the database schema.
     * The first field is the primary key.
     * Fields prefixed with * are multi-entry indexes (arrays).
     * Other listed fields are regular indexes for fast lookups.
     */
    this.version(1).stores({
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
 *
 * Example usage:
 *   import { db } from '@/lib/db';
 *   const favourites = await db.favourites.toArray();
 */
export const db = new OystrDatabase();
