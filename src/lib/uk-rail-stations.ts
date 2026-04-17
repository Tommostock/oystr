/**
 * uk-rail-stations.ts — Bundled list of UK National Rail stations
 *
 * The Rail Data Marketplace LDBWS API uses 3-letter CRS codes
 * (e.g. "KGX" for London Kings Cross, "LDS" for Leeds).
 *
 * There are ~2,570 National Rail stations in total. This file bundles
 * the major passenger stations — enough to cover most intercity journeys.
 * Smaller/suburban stations can be added later by extending this array.
 *
 * The list is used for:
 *   1. Station search autocomplete (offline — no network required)
 *   2. Displaying station names when only a CRS code is stored
 *
 * Data source: National Rail public CRS list. Every code has been
 * cross-checked against the official station reference.
 */

import type { UKRailStation } from "./rail-types";

/* ========================================
 * STATION LIST
 * Alphabetical by name. All CRS codes manually verified.
 * ======================================== */
export const UK_RAIL_STATIONS: UKRailStation[] = [
  { crs: "ABD", name: "Aberdeen" },
  { crs: "ABW", name: "Abbey Wood" },
  { crs: "AYR", name: "Ayr" },
  { crs: "BAN", name: "Banbury" },
  { crs: "BSK", name: "Basingstoke" },
  { crs: "BTH", name: "Bath Spa" },
  { crs: "BDM", name: "Bedford" },
  { crs: "BHM", name: "Birmingham New Street" },
  { crs: "BMO", name: "Birmingham Moor Street" },
  { crs: "BSW", name: "Birmingham Snow Hill" },
  { crs: "BPN", name: "Blackpool North" },
  { crs: "BMH", name: "Bournemouth" },
  { crs: "BFR", name: "London Blackfriars" },
  { crs: "BTN", name: "Brighton" },
  { crs: "BRI", name: "Bristol Temple Meads" },
  { crs: "BPW", name: "Bristol Parkway" },
  { crs: "CBG", name: "Cambridge" },
  { crs: "CST", name: "London Cannon Street" },
  { crs: "CDF", name: "Cardiff Central" },
  { crs: "CAR", name: "Carlisle" },
  { crs: "CTM", name: "Chatham" },
  { crs: "CHM", name: "Chelmsford" },
  { crs: "CHX", name: "London Charing Cross" },
  { crs: "CTR", name: "Chester" },
  { crs: "COL", name: "Colchester" },
  { crs: "COV", name: "Coventry" },
  { crs: "CRE", name: "Crewe" },
  { crs: "CTK", name: "London City Thameslink" },
  { crs: "DBY", name: "Derby" },
  { crs: "DID", name: "Didcot Parkway" },
  { crs: "DON", name: "Doncaster" },
  { crs: "DCH", name: "Dorchester South" },
  { crs: "DHM", name: "Durham" },
  { crs: "EAL", name: "Ealing Broadway" },
  { crs: "EBN", name: "Eastbourne" },
  { crs: "EDB", name: "Edinburgh" },
  { crs: "EUS", name: "London Euston" },
  { crs: "EXD", name: "Exeter St Davids" },
  { crs: "FAV", name: "Faversham" },
  { crs: "FST", name: "London Fenchurch Street" },
  { crs: "FKC", name: "Folkestone Central" },
  { crs: "FKW", name: "Folkestone West" },
  { crs: "GLC", name: "Glasgow Central" },
  { crs: "GLQ", name: "Glasgow Queen Street" },
  { crs: "GCR", name: "Gloucester" },
  { crs: "GRA", name: "Grantham" },
  { crs: "GRV", name: "Gravesend" },
  { crs: "GTW", name: "Gatwick Airport" },
  { crs: "GLD", name: "Guildford" },
  { crs: "HGS", name: "Hastings" },
  { crs: "HRW", name: "Harrow & Wealdstone" },
  { crs: "HAT", name: "Hatfield" },
  { crs: "HFD", name: "Hereford" },
  { crs: "HGT", name: "Harrogate" },
  { crs: "HRH", name: "Horsham" },
  { crs: "HUD", name: "Huddersfield" },
  { crs: "HUL", name: "Hull" },
  { crs: "IPS", name: "Ipswich" },
  { crs: "INV", name: "Inverness" },
  { crs: "KGX", name: "London Kings Cross" },
  { crs: "LAN", name: "Lancaster" },
  { crs: "LDS", name: "Leeds" },
  { crs: "LEI", name: "Leicester" },
  { crs: "LCN", name: "Lincoln" },
  { crs: "LST", name: "London Liverpool Street" },
  { crs: "LBG", name: "London Bridge" },
  { crs: "LIV", name: "Liverpool Lime Street" },
  { crs: "LUT", name: "Luton" },
  { crs: "MAN", name: "Manchester Piccadilly" },
  { crs: "MCV", name: "Manchester Victoria" },
  { crs: "MCO", name: "Manchester Oxford Road" },
  { crs: "MDE", name: "Maidstone East" },
  { crs: "MDW", name: "Maidstone West" },
  { crs: "MYB", name: "London Marylebone" },
  { crs: "MKC", name: "Milton Keynes Central" },
  { crs: "MAR", name: "Margate" },
  { crs: "NCL", name: "Newcastle" },
  { crs: "NRW", name: "Norwich" },
  { crs: "NMP", name: "Northampton" },
  { crs: "NOT", name: "Nottingham" },
  { crs: "OBN", name: "Oban" },
  { crs: "OXF", name: "Oxford" },
  { crs: "PAD", name: "London Paddington" },
  { crs: "PBO", name: "Peterborough" },
  { crs: "PNZ", name: "Penzance" },
  { crs: "PLY", name: "Plymouth" },
  { crs: "PMS", name: "Portsmouth & Southsea" },
  { crs: "PMH", name: "Portsmouth Harbour" },
  { crs: "PRE", name: "Preston" },
  { crs: "RDG", name: "Reading" },
  { crs: "RMD", name: "Richmond (London)" },
  { crs: "RUG", name: "Rugby" },
  { crs: "SAL", name: "Salisbury" },
  { crs: "SHF", name: "Sheffield" },
  { crs: "SAC", name: "St Albans City" },
  { crs: "STP", name: "London St Pancras International" },
  { crs: "STA", name: "Stafford" },
  { crs: "SNS", name: "Staines" },
  { crs: "SHR", name: "Shrewsbury" },
  { crs: "SOU", name: "Southampton Central" },
  { crs: "SOA", name: "Southampton Airport Parkway" },
  { crs: "SRA", name: "Stratford (London)" },
  { crs: "SVG", name: "Stevenage" },
  { crs: "SWA", name: "Swansea" },
  { crs: "SWI", name: "Swindon" },
  { crs: "TAU", name: "Taunton" },
  { crs: "TFC", name: "Telford Central" },
  { crs: "TON", name: "Tonbridge" },
  { crs: "TRU", name: "Truro" },
  { crs: "TBW", name: "Tunbridge Wells" },
  { crs: "VIC", name: "London Victoria" },
  { crs: "WAT", name: "London Waterloo" },
  { crs: "WAE", name: "London Waterloo East" },
  { crs: "WKF", name: "Wakefield Westgate" },
  { crs: "WRW", name: "Warwick" },
  { crs: "WRP", name: "Warwick Parkway" },
  { crs: "WEY", name: "Weymouth" },
  { crs: "WIM", name: "Wimbledon" },
  { crs: "WIN", name: "Winchester" },
  { crs: "WOK", name: "Woking" },
  { crs: "WOS", name: "Worcester Shrub Hill" },
  { crs: "WOF", name: "Worcester Foregate Street" },
  { crs: "WVH", name: "Wolverhampton" },
  { crs: "WRX", name: "Wrexham General" },
  { crs: "YRK", name: "York" },
];

/* ========================================
 * STATION LOOKUP
 * Build a CRS -> name map once at module load.
 * ======================================== */
const crsToNameMap: Record<string, string> = {};
for (const station of UK_RAIL_STATIONS) {
  crsToNameMap[station.crs.toUpperCase()] = station.name;
}

/**
 * Get the display name for a CRS code.
 * Returns the CRS code itself if not found (graceful fallback).
 */
export function getStationName(crs: string): string {
  return crsToNameMap[crs.toUpperCase()] || crs;
}

/* ========================================
 * SEARCH
 * Filter stations by name or CRS code match.
 * Case-insensitive. Sorted by relevance:
 *   1. Exact CRS code match (highest)
 *   2. Name starts with query
 *   3. Name contains query
 * Capped at 20 results.
 * ======================================== */
export function searchStations(query: string): UKRailStation[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];

  const qUpper = q.toUpperCase();
  const exactCrs: UKRailStation[] = [];
  const startsWith: UKRailStation[] = [];
  const contains: UKRailStation[] = [];

  for (const station of UK_RAIL_STATIONS) {
    const nameLower = station.name.toLowerCase();

    if (station.crs === qUpper) {
      exactCrs.push(station);
    } else if (nameLower.startsWith(q)) {
      startsWith.push(station);
    } else if (nameLower.includes(q)) {
      contains.push(station);
    }
  }

  /* Sort alphabetically within each bucket */
  const byName = (a: UKRailStation, b: UKRailStation) =>
    a.name.localeCompare(b.name);
  startsWith.sort(byName);
  contains.sort(byName);

  return [...exactCrs, ...startsWith, ...contains].slice(0, 20);
}
