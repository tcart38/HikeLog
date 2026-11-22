/* HikeLog service worker. Scope "/" (relative, so it works on any domain).
 * - Precaches an offline fallback page and the icons.
 * - Static assets (/_next/static, icons, fonts, map worker): cache-first.
 * - Page navigations: network-first, falling back to the last cached copy, then /offline.html.
 * - /api/* and everything that is not a same-origin GET: never touched, never cached.
 * Bump CACHE_VERSION to invalidate every cache on the next deploy of this file.
 */
const CACHE_VERSION = "v1"
const STATIC_CACHE = `hikelog-static-${CACHE_VERSION}`
const PAGE_CACHE = `hikelog-pages-${CACHE_VERSION}`
const OFFLINE_URL = "/offline.html"
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png", "/icon.svg"]
const MAX_PAGES = 40

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("hikelog-") && k !== STATIC_CACHE && k !== PAGE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

const isStaticAsset = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/icons/") ||
  url.pathname === "/icon.svg" ||
  url.pathname === "/maplibre-gl-worker.mjs" ||
  /\.(?:woff2?|ttf|otf)$/.test(url.pathname)

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok && res.status === 200) cache.put(request, res.clone())
  return res
}

async function trimPages(cache) {
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - MAX_PAGES; i++) await cache.delete(keys[i])
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE)
  try {
    const res = await fetch(request)
    // Only plain successful HTML pages (not redirects to /login, not errors).
    if (res.ok && res.status === 200 && !res.redirected && (res.headers.get("content-type") || "").includes("text/html")) {
      await cache.put(request, res.clone())
      trimPages(cache)
    }
    return res
  } catch {
    const hit = await cache.match(request)
    if (hit) return hit
    const offline = await caches.match(OFFLINE_URL)
    return offline || new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } })
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Signing out drops cached (user specific) pages. Not intercepted, just observed.
  if (url.pathname === "/api/auth/logout") {
    event.waitUntil(caches.delete(PAGE_CACHE))
    return
  }
  if (request.method !== "GET") return
  if (url.pathname.startsWith("/api/") || url.pathname === "/docs") return

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request))
    return
  }
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request))
  }
  // Anything else (RSC payload fetches, etc.) goes straight to the network.
})
