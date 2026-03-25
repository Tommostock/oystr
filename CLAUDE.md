# CLAUDE.md — Oystr

## Project Overview

**Oystr** is a London transport PWA that replicates and improves upon the TfL app experience, styled to look like the iconic amber dot-matrix LED departure boards found at tube stations. It provides live train/bus arrivals, a full interactive tube map with live train tracking, journey planning, and offline timetable fallback.

The name "Oystr" is a play on London's Oyster card — instantly recognisable to any Londoner.

## Developer Context

- **Developer**: Tom — beginner developer, no prior coding background
- **Platform**: Windows PC
- **Toolchain**: Claude Code + GitHub + Vercel
- **Code style**: Beginner-friendly, well-commented code that Tom can maintain and extend
- **Critical**: No emojis anywhere in the app UI — not in text, headings, labels, status indicators, or any component

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS 4 + shadcn/ui components (heavily customised to match the dot-matrix theme)
- **Offline storage**: Dexie.js (IndexedDB wrapper) for caching timetables and station data
- **PWA**: next-pwa or @serwist/next for service worker, offline shell, and install prompt
- **Maps**: Leaflet + OpenStreetMap (free, no API key) for geographic tube map view
- **Deployment**: Vercel (free tier)
- **Source control**: GitHub

## API — TfL Unified API

**Base URL**: `https://api.tfl.gov.uk`
**Auth**: Register for free app_id and app_key at https://api-portal.tfl.gov.uk — increases rate limit from 50 to 500 requests/min. Store these in `.env.local` as `TFL_APP_ID` and `TFL_APP_KEY`. All API calls must be made server-side via Next.js API routes to protect the keys.

### Key Endpoints

```
# Live arrivals at a specific station (tube, bus, DLR, Overground, Elizabeth line)
GET /StopPoint/{stopPointId}/arrivals

# Live arrivals for an entire line (includes currentLocation for train tracking)
GET /Line/{lineId}/Arrivals

# Line status / disruptions
GET /Line/{lineId}/Status

# All line statuses
GET /Line/Mode/tube,overground,dlr,elizabeth-line/Status

# Journey planning (A to B routing)
GET /Journey/JourneyResults/{from}/to/{to}
  - from/to can be station IDs (e.g. "1000149" for Mile End) or lat,lng coords
  - Query params: mode (tube,bus,dlr,overground,walking), time, date, timeIs (Arriving/Departing)

# All stop points for a line
GET /Line/{lineId}/StopPoints

# Route sequence for a line (ordered station list with coordinates)
GET /Line/{lineId}/Route/Sequence/{direction}
  - direction: inbound or outbound

# Search for stations/stops
GET /StopPoint/Search/{query}

# Station metadata
GET /StopPoint/{stopPointId}

# Timetable for a station on a specific line
GET /Line/{lineId}/Timetable/{fromStopPointId}
```

### Arrival Response Shape (key fields)

```json
{
  "vehicleId": "123",
  "lineId": "central",
  "lineName": "Central",
  "platformName": "Eastbound - Platform 1",
  "direction": "inbound",
  "destinationName": "Epping",
  "currentLocation": "Between Mile End and Stratford",
  "towards": "Epping",
  "expectedArrival": "2026-03-25T14:32:00Z",
  "timeToStation": 180,
  "stationName": "Mile End Underground Station"
}
```

The `currentLocation` field is critical — it contains text like "Between X and Y", "Approaching X", "At Platform", "Left X". We parse this to position trains on the map.

### Journey Planner Response Shape (simplified)

```json
{
  "journeys": [
    {
      "duration": 25,
      "legs": [
        {
          "instruction": { "summary": "Central line to Holborn" },
          "departurePoint": { "commonName": "Mile End" },
          "arrivalPoint": { "commonName": "Holborn" },
          "mode": { "name": "tube" },
          "routeOptions": [{ "lineIdentifier": { "id": "central", "name": "Central" } }],
          "duration": 15,
          "departureTime": "...",
          "arrivalTime": "..."
        }
      ]
    }
  ]
}
```

## Tube Lines Reference

| Line | ID | Colour (hex) |
|---|---|---|
| Bakerloo | bakerloo | #B36305 |
| Central | central | #E32017 |
| Circle | circle | #FFD300 |
| District | district | #00782A |
| Hammersmith & City | hammersmith-city | #F3A9BB |
| Jubilee | jubilee | #A0A5A9 |
| Metropolitan | metropolitan | #9B0056 |
| Northern | northern | #000000 |
| Piccadilly | piccadilly | #003688 |
| Victoria | victoria | #0098D4 |
| Waterloo & City | waterloo-city | #95CDBA |
| Elizabeth line | elizabeth | #6950A1 |
| DLR | dlr | #00A4A7 |
| London Overground | london-overground | #EE7C0E |
| Tram | tram | #84B817 |

## Visual Design — Dot-Matrix Board Aesthetic

The entire app must look and feel like a TfL dot-matrix departure board. Reference the uploaded photo of the Hampstead/Edgware board for the exact aesthetic target.

### Design System

```
BACKGROUND:        #0a0a0a (near-black, like the board housing)
SURFACE:           #111111 (card/panel backgrounds)
BORDER:            #1a1a1a (subtle panel edges)
PRIMARY TEXT:      #ff9500 (warm amber — the dot-matrix LED colour)
SECONDARY TEXT:    #cc7700 (dimmer amber for secondary info)
DIM TEXT:          #664400 (very dim amber for inactive/placeholder)
ACCENT:            #ff9500 (amber used for highlights, active states)
ERROR/DISRUPTION:  #ff3b30 (red — used only for disruptions/severe delays)
GOOD SERVICE:      #34c759 (green — used only for "Good Service" status)
```

### Typography

- **Primary font**: A monospaced or dot-matrix style font. Use "Share Tech Mono" from Google Fonts (free, looks like LED displays) or "VT323" for a more retro dot-matrix feel.
- **Secondary font**: "IBM Plex Mono" for any body text that needs to be more readable.
- All text should be uppercase on departure boards and status displays, mixed case in journey planner and search.
- Letter-spacing should be slightly wide (0.05em-0.1em) to simulate the spacing of LED characters.

### Visual Effects

- Subtle scanline overlay on board-style panels (CSS pseudo-element with repeating linear gradient, very low opacity ~0.03)
- Gentle text-shadow glow on amber text: `text-shadow: 0 0 8px rgba(255, 149, 0, 0.4)`
- No rounded corners on board panels (square/sharp edges like real boards)
- Thin 1px border on panels in a slightly lighter shade (#1a1a1a or #222222)
- Board panels should feel recessed — use subtle inset box-shadow
- When data is loading, show a blinking cursor or "LOADING..." in amber text, like a real board booting up
- NO emojis anywhere — use text labels, icons from Lucide React, or coloured dots for status indicators

### Component Styling Notes

- **Arrival rows**: Left-aligned destination name (uppercase), right-aligned time in minutes. Exactly like the photo reference. Platform number on the left.
- **Status bar**: Full-width amber text scrolling or static, showing line status like the dot-matrix message boards above platforms.
- **Navigation**: Bottom tab bar (dark, minimal, amber icons/text for active state, dim for inactive). Tabs: Departures | Map | Journey | Status | Saved
- **Cards/Panels**: Black background, thin dark border, no border-radius, amber text
- **Buttons**: Outlined in amber, text in amber, no fill. On press: amber fill with black text.
- **Search inputs**: Dark background, amber text, amber underline border (no full border), blinking amber cursor

## Core Features & Pages

### 1. Departures Board (Home / Default Tab)

- Station search bar at top (with autocomplete from TfL StopPoint/Search)
- "Nearby stations" using browser geolocation (optional — graceful fallback if denied)
- Once a station is selected, show a full departure board:
  - Grouped by platform/direction
  - Each row: platform number | destination (uppercase) | time in mins
  - Auto-refreshes every 30 seconds
  - Supports: Tube, Bus, DLR, Overground, Elizabeth line
- "Save station" button to add to favourites (stored in IndexedDB)
- Offline mode: If no network, show cached timetable data with a clear "SCHEDULED TIMES" indicator banner

### 2. Live Map

- Full interactive tube map using Leaflet + OpenStreetMap tiles (dark theme tiles from CartoDB dark_matter or Stadia dark)
- All tube stations plotted as markers using coordinates from TfL API
- Lines drawn between stations using official TfL line colours
- **Live train dots**: Fetch `/Line/{lineId}/Arrivals` for selected line(s), parse `currentLocation` to position train indicators between stations
  - "Between X and Y" = position dot at midpoint between those two stations
  - "Approaching X" = position dot close to station X
  - "At Platform" = position dot on the station
  - "Left X" = position dot just past station X
  - Train dots should pulse gently (CSS animation)
- Tap a station marker to see its live departures in a bottom sheet
- Line filter buttons along the top to show/hide specific lines
- This is the most complex feature — it can be built incrementally. Start with static map + stations, then add lines, then add train dots

### 3. Journey Planner

- "From" and "To" station search inputs (with autocomplete)
- "Depart now" / "Depart at" / "Arrive by" time picker
- Results displayed as journey cards:
  - Total duration
  - Each leg shown as a coloured line segment with station names
  - Line name and direction for each leg
  - Walking legs shown distinctly
  - Interchange instructions ("Change at Bank to Northern line")
- Multiple journey options (TfL returns several)
- Tap a journey to see step-by-step breakdown

### 4. Line Status

- All lines listed with current status
- "Good Service" in green, delays/disruptions in red/amber
- Tap a line to see detail and reason for disruption
- Auto-refreshes every 60 seconds
- This should look like the dot-matrix information boards at station entrances

### 5. Saved / Favourites

- List of saved stations with quick-tap to see departures
- Saved journeys (frequent routes)
- All stored in IndexedDB via Dexie.js
- These are the stations/routes that get their timetables cached for offline use

## Offline Strategy

1. **App shell**: Service worker caches the entire app shell (HTML, CSS, JS, fonts) so the app loads instantly even with no network
2. **Station data**: On first load, cache all station metadata (names, IDs, coordinates, line associations) in IndexedDB — this data rarely changes
3. **Timetables for favourites**: When a user saves a station, download and cache the scheduled timetable data for all lines serving that station. Refresh this cache daily when online.
4. **Last-known status**: Cache the most recent line status data. Show it with a "Last updated: X mins ago" label when offline.
5. **Offline indicator**: When offline, show a persistent amber banner at the top: "OFFLINE -- SHOWING SCHEDULED TIMES" (like a dot-matrix message)
6. **Background sync**: Use the Background Sync API (where supported) to refresh cached data when the device regains connectivity

## File Structure

```
oystr/
  src/
    app/
      layout.tsx              -- Root layout with PWA meta, fonts, theme
      page.tsx                -- Home / Departures board
      map/
        page.tsx              -- Live tube map
      journey/
        page.tsx              -- Journey planner
      status/
        page.tsx              -- Line status board
      saved/
        page.tsx              -- Favourites
      api/
        tfl/
          arrivals/
            route.ts          -- Proxy: station arrivals
          line-arrivals/
            route.ts          -- Proxy: full line arrivals (for train tracking)
          status/
            route.ts          -- Proxy: line status
          journey/
            route.ts          -- Proxy: journey planner
          search/
            route.ts          -- Proxy: station search
          timetable/
            route.ts          -- Proxy: scheduled timetable
          stations/
            route.ts          -- Proxy: station data + coordinates
    components/
      departure-board/
        DepartureBoard.tsx    -- The main board component
        ArrivalRow.tsx        -- Single arrival row (platform | dest | time)
        BoardPanel.tsx        -- Styled panel wrapper (dot-matrix look)
      map/
        TubeMap.tsx           -- Leaflet map with stations and lines
        TrainDot.tsx          -- Animated train position indicator
        StationMarker.tsx     -- Station marker component
        LineOverlay.tsx       -- Line path drawing
      journey/
        JourneySearch.tsx     -- From/To inputs with autocomplete
        JourneyCard.tsx       -- Single journey result
        JourneyLeg.tsx        -- Individual leg display
      status/
        LineStatusCard.tsx    -- Single line status row
        StatusBoard.tsx       -- All lines status board
      shared/
        BottomNav.tsx         -- Tab navigation bar
        StationSearch.tsx     -- Reusable station search with autocomplete
        OfflineBanner.tsx     -- "OFFLINE" indicator
        LoadingBoard.tsx      -- Dot-matrix loading animation
        AmberText.tsx         -- Styled text component with glow
    lib/
      tfl-api.ts              -- Server-side TfL API helper functions
      tfl-types.ts            -- TypeScript types for TfL API responses
      db.ts                   -- Dexie.js database schema and helpers
      offline.ts              -- Offline detection and cache management
      parse-location.ts       -- Parse currentLocation strings for train tracking
      station-data.ts         -- Station coordinate lookups
      constants.ts            -- Line colours, IDs, names
    hooks/
      useArrivals.ts          -- SWR/polling hook for live arrivals
      useLineStatus.ts        -- SWR/polling hook for line status
      useOffline.ts           -- Online/offline detection hook
      useFavourites.ts        -- Dexie.js favourites CRUD hook
      useGeolocation.ts       -- Browser geolocation hook
    public/
      manifest.json           -- PWA manifest
      icons/                  -- PWA icons (various sizes)
      sw.js                   -- Service worker (generated by next-pwa)
```

## Environment Variables (.env.local)

```
TFL_APP_ID=your_app_id_here
TFL_APP_KEY=your_app_key_here
```

Register for free at: https://api-portal.tfl.gov.uk

## Build & Development Commands

```bash
npm run dev          # Local development at localhost:3000
npm run build        # Production build
npm run start        # Run production build locally
npx next lint        # Lint check
```

## Key Implementation Notes

1. **All TfL API calls go through Next.js API routes** — never call TfL directly from the client. This protects the API key and allows server-side caching.
2. **Use SWR or polling intervals for live data** — arrivals refresh every 30s, status every 60s.
3. **The tube map is the hardest feature** — build it last. Start with departures, then status, then journey planner, then the map.
4. **Train tracking accuracy**: The `currentLocation` text is not perfectly standardised. Build a robust parser in `parse-location.ts` that handles "Between X and Y", "Approaching X", "At Platform", "Left X", "At X", and falls back gracefully for unrecognised patterns.
5. **Bus arrivals** work identically to tube arrivals — same `/StopPoint/{id}/arrivals` endpoint. Bus stops have different stopPoint IDs but the response shape is the same.
6. **Journey planner from/to** accepts station NaptanIds, ICS codes, or lat,lng coordinates. Use NaptanIds from the search endpoint for reliability.
7. **No emojis** — use Lucide React icons or plain text indicators everywhere.
8. **Mobile-first design** — this is primarily an iPhone PWA. Design for 390px width first, then scale up.

## Build Order (Recommended)

1. Project scaffolding (Next.js, Tailwind, shadcn/ui, Dexie, PWA setup)
2. Design system (colours, fonts, BoardPanel component, AmberText component)
3. Bottom navigation bar
4. Station search with autocomplete
5. Departure board (core feature — get this looking pixel-perfect)
6. Line status page
7. Favourites (save/load stations via Dexie)
8. Offline support (service worker, timetable caching)
9. Journey planner
10. Tube map (static stations + lines)
11. Live train tracking on map
12. Polish, testing, PWA install prompt

## Quality Bar

- The departure board MUST look like a real TfL dot-matrix board — amber monospaced text on black, platform numbers on the left, minutes on the right
- Transitions between views should be snappy (no heavy page transitions)
- Offline mode should be seamless — the user should barely notice they lost signal, just see the "OFFLINE" banner and scheduled times
- Journey results should be clear and scannable at a glance
- The map should feel smooth to pan and zoom on mobile (Leaflet handles this well)
