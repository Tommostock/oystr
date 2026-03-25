# PROMPT.md — Paste this into Claude Code to start building

## Initial Setup Prompt

Copy and paste the following into Claude Code after placing CLAUDE.md and SPEC.md in your project root:

---

Read CLAUDE.md and SPEC.md carefully before doing anything. These files contain the full project specification for Oystr, a London transport PWA.

I am a beginner developer on Windows. I use GitHub and deploy to Vercel. I need well-commented, beginner-friendly code that I can understand and maintain.

Please start by:

1. Initialise the Next.js 15 project with App Router, TypeScript, and Tailwind CSS 4
2. Install all dependencies: shadcn/ui, dexie, leaflet, react-leaflet, @types/leaflet, swr, next-pwa (or @serwist/next — pick whichever is most stable with Next.js 15 right now)
3. Set up the design system: Tailwind config with the dot-matrix colour palette from CLAUDE.md, Google Fonts (Share Tech Mono + IBM Plex Mono), global CSS with the scanline overlay and amber glow effects
4. Create the layout.tsx with PWA meta tags, fonts loaded, dark background, and the BottomNav component
5. Create the BoardPanel and AmberText shared components as the foundation for the dot-matrix aesthetic
6. Create the .env.local.example file with TFL_APP_ID and TFL_APP_KEY placeholders
7. Set up the Dexie.js database with the schema from SPEC.md

Do NOT build any pages yet — just the scaffolding, design system, and shared components. I want to review the look and feel before we build features.

---

## Follow-Up Prompts (use these in order after reviewing each step)

### Step 2 — Departures Board
```
Now build the Departures Board (home page). Read CLAUDE.md for the exact specification.

Build the station search with autocomplete, the departure board component showing arrivals grouped by platform/direction, and the arrival row component. Make it look exactly like a real TfL dot-matrix board — amber monospaced text on black, platform numbers on the left, time in minutes on the right, uppercase destination names.

Create the API route for station search and station arrivals. Use polling (every 30 seconds) for live arrival data.

Remember: no emojis anywhere. Use Lucide React icons where needed.
```

### Step 3 — Line Status
```
Build the Line Status page. Read CLAUDE.md for the specification.

Show all tube, DLR, Overground, Elizabeth line, and Tram statuses. "Good Service" in green text, disruptions in amber/red. Each line should show its official colour as a small indicator. Tap a line to expand and see the disruption reason.

Create the API route for line status. Poll every 60 seconds.

Style it like a dot-matrix information board.
```

### Step 4 — Favourites and Offline
```
Build the Favourites/Saved page and implement offline support.

1. Add a "Save station" button on the departure board that stores the station in Dexie.js
2. Build the Saved page showing all favourite stations with one-tap to view departures
3. When a station is saved, download and cache its timetable data in IndexedDB
4. Implement the offline detection hook
5. When offline, show cached timetable data with an "OFFLINE -- SHOWING SCHEDULED TIMES" banner
6. Set up the service worker for app shell caching

Read SPEC.md section 4 for the full offline strategy.
```

### Step 5 — Journey Planner
```
Build the Journey Planner page. Read CLAUDE.md and SPEC.md section 6.

Two station search inputs (From/To) with a swap button. Time selector for "Leave now", "Depart at", "Arrive by". Results as journey cards showing each leg with coloured line indicators, station names, durations, and interchange instructions.

Create the API route for journey planning. Use the TfL Journey endpoint.

Allow saving frequent journeys to Dexie.js.
```

### Step 6 — Tube Map (Static)
```
Build the interactive tube map page. Read SPEC.md section 5.

Use Leaflet with CartoDB dark_matter tiles. Fetch station coordinates from TfL API for all tube lines. Plot stations as circle markers. Draw polylines between stations using official line colours from CLAUDE.md.

Tap a station to see a bottom sheet with its live departures.

Add line toggle buttons along the top to show/hide specific lines.

Store all station coordinate data in IndexedDB for offline map viewing.
```

### Step 7 — Live Train Tracking
```
Add live train tracking to the tube map. Read SPEC.md sections 5.3 and 5.4.

Build the currentLocation parser in parse-location.ts. When a line is toggled on, poll /Line/{lineId}/Arrivals every 15 seconds. Parse each vehicle's currentLocation, look up station coordinates, interpolate position, and show a pulsing dot on the map in the line's colour.

Group by vehicleId to avoid duplicate dots. Animate position changes smoothly.

Only fetch data for lines the user has toggled on to save API calls.
```

### Step 8 — Polish and PWA
```
Final polish pass:

1. Review all pages for visual consistency with the dot-matrix board aesthetic
2. Ensure the PWA manifest is correct and the app is installable
3. Add a subtle install prompt banner for first-time users
4. Test offline mode works for saved stations
5. Add proper loading states (blinking "LOADING..." text in amber)
6. Add error states for API failures
7. Ensure bottom nav highlights the active tab correctly
8. Check mobile responsiveness at 390px width
9. Add page transition handling (loading indicators between route changes)
10. Make sure there are ZERO emojis anywhere in the app
```
