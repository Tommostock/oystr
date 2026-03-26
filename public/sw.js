/**
 * Service Worker for Oystr PWA
 *
 * Caches the app shell (HTML, CSS, JS, fonts, icons) so the app
 * works offline for basic navigation. API responses are NOT cached —
 * live data always comes from the network.
 *
 * Cache strategy:
 *   - Navigation (HTML pages): Network-first (always get latest deploy)
 *   - Next.js chunks (_next/): Network-first (always get latest code)
 *   - API calls: Network-only (always fresh data)
 *   - Static assets (icons, fonts): Cache-first (rarely change)
 *
 * IMPORTANT: This uses network-first for app code so that new deploys
 * are picked up immediately without needing to clear the browser cache.
 * The cache is only used as a fallback when offline.
 */

const CACHE_NAME = "oystr-v3";

/**
 * Files to pre-cache on install.
 * These are the minimum files needed to render the app shell offline.
 */
const PRECACHE_URLS = [
  "/",
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
      .then((cache) => cache.addAll(PRECACHE_URLS))
      /* skipWaiting forces the new SW to activate immediately,
       * replacing any old service worker without waiting for
       * the user to close all tabs */
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
      /* clients.claim() makes this SW take control of all open tabs
       * immediately, so the user doesn't need to refresh */
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

  /* Skip API calls — always go to network for fresh data */
  if (url.pathname.startsWith("/api/")) return;

  /*
   * NETWORK-FIRST strategy for Next.js chunks and page navigations.
   *
   * This is the key change: we TRY the network first so that new
   * deploys are picked up immediately. If the network fails (offline),
   * we fall back to the cached version.
   *
   * This means:
   *   - Online: always serves the latest code from Vercel
   *   - Offline: serves the last cached version as fallback
   *   - No more needing to clear browser history to see updates!
   */
  if (url.pathname.startsWith("/_next/") || request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          /* Got a fresh response — cache it for offline use */
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          /* Network failed — try the cache as fallback */
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            /* If navigating and nothing cached, show the home page shell */
            if (request.mode === "navigate") {
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
