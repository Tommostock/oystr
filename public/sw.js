/**
 * Service Worker for Oystr PWA
 *
 * Caches the app shell (HTML, CSS, JS, fonts, icons) so the app
 * works offline for basic navigation.
 *
 * Cache strategy:
 *   - Navigation (HTML pages):       Network-first (latest deploy)
 *   - Next.js chunks (_next/):        Network-first (latest code)
 *   - /api/tfl/arrivals:              Stale-while-revalidate (offline
 *                                     fallback to last-known departures)
 *   - Other /api/:                    Network-only (always fresh)
 *   - Static assets (icons, fonts):   Cache-first (rarely change)
 *
 * The arrivals API is treated specially: we cache the last
 * successful response so that when offline (or mid-request on
 * a flaky connection) the widget / home screen still renders
 * something useful instead of a spinner.
 */

const CACHE_NAME = "oystr-v4";

/**
 * Files to pre-cache on install.
 * These are the minimum files needed to render the app shell offline,
 * including the widget shell so iOS home-screen widget views work
 * on first-cold-open without a network round-trip.
 */
const PRECACHE_URLS = [
  "/",
  "/widget",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

/* ========================================
 * INSTALL — Pre-cache app shell files
 * ======================================== */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        /*
         * Use individual cache.add() calls so a single failure doesn't
         * abort the whole install. /widget is an aliased route that may
         * not exist as an exact URL (it's a dynamic /widget/[stopId]),
         * so tolerate individual miss.
         */
        Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  );
});

/* ========================================
 * ACTIVATE — Clean up old caches
 * ======================================== */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ========================================
 * FETCH — Serve from network or cache
 * ======================================== */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* Skip non-GET requests (POST, PUT, DELETE etc.) */
  if (request.method !== "GET") return;

  /*
   * STALE-WHILE-REVALIDATE for TfL arrivals + rail departures.
   *
   * Live arrivals are the single most important data source offline —
   * when you're on a tube platform with no signal, the widget should
   * still show the last-known board. We respond from cache immediately
   * (if anything) AND kick off a network refresh in the background
   * so the next view gets fresh data.
   */
  const isArrivalsEndpoint =
    url.pathname === "/api/tfl/arrivals" ||
    url.pathname === "/api/rail/departures";

  if (isArrivalsEndpoint) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const fetchPromise = fetch(request)
            .then((response) => {
              if (response.ok) {
                /* Clone before caching — Response bodies are one-shot. */
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => {
              /* Network failed — the cached response (if any) already
                 satisfied the event. Nothing more to do. */
              return null;
            });
          /* If we have a cached copy, return it straight away; the
             fetchPromise continues in the background to refresh. */
          return cached || fetchPromise || new Response("Offline", { status: 503 });
        })
      )
    );
    return;
  }

  /* Skip all other API calls — always go to network for fresh data */
  if (url.pathname.startsWith("/api/")) return;

  /*
   * NETWORK-FIRST strategy for Next.js chunks and page navigations.
   *
   * Try the network first so new deploys are picked up immediately.
   * Fall back to cache when offline. /widget and /widget/... are
   * covered by the navigate mode match since they're page routes.
   */
  if (url.pathname.startsWith("/_next/") || request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          /* Network failed — try the cache. */
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            /* Fall back to the nearest shell:
                 - Widget routes → cached /widget (if we've been there)
                 - Anything else → home shell */
            if (request.mode === "navigate") {
              if (url.pathname.startsWith("/widget/")) {
                return caches.match("/widget").then((w) => w || caches.match("/"));
              }
              return caches.match("/");
            }
            return new Response("Offline", { status: 503 });
          });
        })
    );
    return;
  }

  /*
   * CACHE-FIRST strategy for static assets (icons, fonts, images).
   * These rarely change and are safe to serve from cache.
   */
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => {
            return new Response("Offline", { status: 503 });
          })
    )
  );
});
