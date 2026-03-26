/**
 * Service Worker for Oystr PWA
 *
 * Caches the app shell (HTML, CSS, JS, fonts, icons) so the app
 * loads instantly on repeat visits and works offline for basic
 * navigation. API responses are NOT cached — live data always
 * comes from the network.
 *
 * Cache strategy:
 *   - App shell: Cache-first (fast loads, update in background)
 *   - API calls: Network-only (always fresh data)
 *   - Images/SVGs: Cache-first with network fallback
 */

const CACHE_NAME = "oystr-v2";

/**
 * Files to pre-cache on install.
 * These are the minimum files needed to render the app shell.
 */
const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/tube-map.svg",
];

/* ========================================
 * INSTALL — Pre-cache app shell files
 * ======================================== */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
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
 * FETCH — Serve from cache or network
 * ======================================== */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* Skip non-GET requests */
  if (request.method !== "GET") return;

  /* Skip API calls — always go to network for fresh data */
  if (url.pathname.startsWith("/api/")) return;

  /* Skip Next.js internal requests */
  if (url.pathname.startsWith("/_next/")) {
    /* Cache JS/CSS chunks for faster loads */
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            /* Only cache successful responses */
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  /* For everything else: try cache first, fall back to network */
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
            /* If both cache and network fail, show offline page for navigation */
            if (request.mode === "navigate") {
              return caches.match("/");
            }
            return new Response("Offline", { status: 503 });
          })
    )
  );
});
