# SPEC.md — Oystr Technical Specification

## 1. Product Summary

Oystr is a Progressive Web App that provides London transport information styled as an amber dot-matrix departure board. It serves as a better, offline-capable alternative to the official TfL app.

**Target user**: London commuter who wants fast, reliable departure info — especially in underground stations with poor signal.

**Core value proposition**: Works offline with cached timetables for your saved stations, something the official TfL app cannot do.

## 2. TfL API Integration Details

### 2.1 Registration

Register at https://api-portal.tfl.gov.uk for a free app_id and app_key. Without keys, you get 50 req/min. With keys, 500 req/min. Both are free.

### 2.2 Server-Side Proxy Pattern

Every TfL API call must go through a Next.js API route. Example pattern:

```typescript
// src/app/api/tfl/arrivals/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const stopId = request.nextUrl.searchParams.get('stopId');

  if (!stopId) {
    return NextResponse.json({ error: 'stopId required' }, { status: 400 });
  }

  const params = new URLSearchParams({
    app_id: process.env.TFL_APP_ID || '',
    app_key: process.env.TFL_APP_KEY || '',
  });

  const response = await fetch(
    `https://api.tfl.gov.uk/StopPoint/${stopId}/Arrivals?${params}`,
    { next: { revalidate: 30 } } // Cache for 30 seconds server-side
  );

  const data = await response.json();
  return NextResponse.json(data);
}
```

### 2.3 Key API Patterns

**Station Search (autocomplete)**:
```
GET /StopPoint/Search/{query}?modes=tube,bus,dlr,overground,elizabeth-line&maxResults=10
```

**Arrivals by station**:
```
GET /StopPoint/{naptanId}/Arrivals
```
Returns array of arrival predictions. Sort by `timeToStation` ascending.

**Arrivals by line (for train tracking)**:
```
GET /Line/{lineId}/Arrivals
```
Returns ALL active trains on a line with `currentLocation`.

**Journey planning**:
```
GET /Journey/JourneyResults/{fromId}/to/{toId}?mode=tube,bus,dlr,overground,walking&timeIs=Departing
```

**Timetable (for offline cache)**:
```
GET /Line/{lineId}/Timetable/{fromStopPointId}
```
Returns full scheduled timetable. Cache this in IndexedDB.

**Line status**:
```
GET /Line/Mode/tube,overground,dlr,elizabeth-line,tram/Status
```

**Stop points for a line (station coordinates)**:
```
GET /Line/{lineId}/StopPoints
```
Returns lat/lng for every station on a line.

**Route sequence (ordered station list)**:
```
GET /Line/{lineId}/Route/Sequence/outbound
```
Returns stations in order — needed for drawing lines on the map.

### 2.4 currentLocation Parser

The `currentLocation` field in arrival responses contains freeform text. Here are the known patterns and how to handle them:

| Pattern | Example | Map Position |
|---|---|---|
| Between X and Y | "Between Mile End and Stratford" | Midpoint of X and Y |
| Approaching X | "Approaching Bank" | 80% of the way to X from previous station |
| At Platform | "At Platform" | At the station (use the station the prediction is for) |
| Left X | "Left Bethnal Green" | 20% past X towards next station |
| At X | "At Holborn" | At station X |
| Unknown/empty | "" | Do not show on map |

Build a parser function:
```typescript
// Returns { type: 'between' | 'approaching' | 'at' | 'left' | 'unknown', stations: string[] }
function parseTrainLocation(currentLocation: string): TrainPosition
```

## 3. Dexie.js Database Schema

```typescript
import Dexie, { Table } from 'dexie';

interface FavouriteStation {
  naptanId: string;
  name: string;
  lines: string[];       // line IDs serving this station
  lat: number;
  lng: number;
  addedAt: number;       // timestamp
}

interface CachedTimetable {
  id: string;             // "{lineId}_{stationId}"
  lineId: string;
  stationId: string;
  data: object;           // raw timetable response
  cachedAt: number;       // timestamp
}

interface CachedLineStatus {
  lineId: string;
  status: string;
  reason: string;
  cachedAt: number;
}

interface SavedJourney {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  savedAt: number;
}

interface StationData {
  naptanId: string;
  name: string;
  lat: number;
  lng: number;
  lines: string[];
  zone: string;
  modes: string[];
}

class OystrDatabase extends Dexie {
  favourites!: Table<FavouriteStation>;
  timetables!: Table<CachedTimetable>;
  lineStatuses!: Table<CachedLineStatus>;
  savedJourneys!: Table<SavedJourney>;
  stations!: Table<StationData>;

  constructor() {
    super('oystr');
    this.version(1).stores({
      favourites: 'naptanId, name',
      timetables: 'id, lineId, stationId, cachedAt',
      lineStatuses: 'lineId, cachedAt',
      savedJourneys: 'id, savedAt',
      stations: 'naptanId, name, *lines',
    });
  }
}

export const db = new OystrDatabase();
```

## 4. Offline Strategy Details

### 4.1 What Gets Cached

| Data | Storage | Refresh Frequency | Size Estimate |
|---|---|---|---|
| App shell (HTML/CSS/JS/fonts) | Service Worker Cache | On deploy | ~2MB |
| All station metadata | IndexedDB (stations table) | Weekly | ~500KB |
| Timetables for favourite stations | IndexedDB (timetables table) | Daily | ~50KB per station |
| Last known line status | IndexedDB (lineStatuses table) | Every 60s when online | ~5KB |
| Saved stations list | IndexedDB (favourites table) | User-driven | ~1KB |
| Saved journeys | IndexedDB (savedJourneys table) | User-driven | ~2KB |

### 4.2 Offline Detection

```typescript
// hooks/useOffline.ts
function useOffline(): boolean {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOffline;
}
```

### 4.3 Fallback Logic

When offline and the user views a saved station:

1. Check IndexedDB for cached timetable
2. Calculate next departures from the timetable based on current time and day of week
3. Display with amber banner: "OFFLINE -- SHOWING SCHEDULED TIMES"
4. Do not show "X mins" countdown — show absolute times instead (e.g., "14:32", "14:35") since we cannot guarantee the scheduled times are accurate to the minute

When offline and the user views a non-saved station:

1. Show message: "STATION DATA NOT CACHED -- SAVE THIS STATION WHEN ONLINE TO VIEW OFFLINE"

## 5. Tube Map Implementation

### 5.1 Approach

Use Leaflet with a dark-themed tile layer. Do NOT use the official TfL tube map SVG (licensing restrictions). Instead, build a geographic map with stations plotted at their real lat/lng coordinates and lines drawn between them.

**Tile layer** (dark theme, free):
```
https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png
```
Attribution: OpenStreetMap contributors, CARTO

### 5.2 Building the Map Data

On first app load (or periodically), fetch station coordinates and line routes:

1. For each tube line, call `/Line/{lineId}/Route/Sequence/outbound` to get ordered station list with coordinates
2. Store all station data in IndexedDB
3. Draw polylines between stations using the official line colour
4. Place circle markers at each station

### 5.3 Train Tracking on Map

1. User selects one or more lines to track
2. App polls `/Line/{lineId}/Arrivals` every 15 seconds
3. Parse `currentLocation` for each vehicle
4. Group by `vehicleId` to avoid duplicates
5. Position a pulsing dot on the map:
   - Look up coordinates of the stations mentioned in `currentLocation`
   - Interpolate position based on the pattern type (between = midpoint, approaching = near destination, etc.)
6. Animate dot positions smoothly when they update

### 5.4 Performance Notes

- Only fetch train positions for lines the user has toggled on
- Use Leaflet's `CircleMarker` for train dots (more performant than custom icons)
- Cluster nearby stations at low zoom levels if performance is an issue
- The Central line alone can have 50+ active trains — this is fine for Leaflet

## 6. Journey Planner Details

### 6.1 Search Input

- Two search fields: "From" and "To"
- Both use the same autocomplete component (StationSearch)
- Swap button to reverse the journey
- Time selector: "Leave now" (default), "Depart at [time]", "Arrive by [time]"
- Mode filter: Tube, Bus, DLR, Overground, Walking (all on by default)

### 6.2 Results Display

The TfL API returns multiple journey options. Display each as a card:

```
[14:32 --> 14:57]  25 min
|
o Mile End
| --- Central line (Westbound) --- 8 min
o Holborn
| --- Walk --- 3 min
o Holborn (Piccadilly)
| --- Piccadilly line (Southbound) --- 6 min  
o Leicester Square
|
o Leicester Square
```

Use coloured line segments matching the official line colours. Walking segments use a dashed line in dim amber.

### 6.3 Journey Saving

Users can save frequent journeys. Saved journeys appear on the Saved tab with a one-tap "Plan now" button that pre-fills the journey planner.

## 7. PWA Configuration

### 7.1 Manifest

```json
{
  "name": "Oystr - London Transport",
  "short_name": "Oystr",
  "description": "Live London transport departures, journey planning, and offline timetables",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### 7.2 Service Worker Strategy

- **App shell**: Cache First (the app loads instantly from cache)
- **API responses**: Network First with cache fallback (try live data, fall back to cached)
- **Static assets (fonts, icons)**: Cache First
- **Tile images (map)**: Cache First with expiry (cache map tiles the user has viewed)

## 8. Responsive Breakpoints

| Breakpoint | Target |
|---|---|
| 0-390px | Small phones (iPhone SE) |
| 390-430px | Standard phones (iPhone 14/15) — PRIMARY target |
| 430-768px | Large phones / small tablets |
| 768px+ | Tablet / desktop (nice to have, not priority) |

## 9. Accessibility

- All interactive elements must have appropriate ARIA labels
- Colour is never the only indicator (always pair with text labels)
- The amber-on-black colour scheme has good contrast ratio (check specific values)
- Focus states should use amber outline
- Screen reader: arrival times should read as "Central line to Epping, 3 minutes" not raw data

## 10. Performance Targets

- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- Offline load: < 0.5s (from service worker cache)
- Arrivals data refresh: Every 30 seconds
- Line status refresh: Every 60 seconds
- Map train positions refresh: Every 15 seconds
- All API calls through server-side routes with Next.js caching

## 11. Error Handling

- TfL API down: Show last cached data with "TFL DATA UNAVAILABLE" banner
- No search results: "NO STATIONS FOUND" in amber text
- Rate limited: Back off and show cached data, retry after 60s
- Geolocation denied: Hide "Nearby" feature, no error shown
- Invalid journey: "NO ROUTES FOUND" with suggestion to try different stations
