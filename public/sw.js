// Freela Manager Service Worker — offline cache
const CACHE_NAME = "freela-v1"
const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/offline",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  // Only handle same-origin GET requests (skip API, Supabase)
  const url = new URL(event.request.url)
  if (event.request.method !== "GET") return
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/")) return
  if (url.pathname.startsWith("/_next/")) return

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // Cache successful page responses
        if (res.ok && res.type === "basic") {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return res
      })
      .catch(() =>
        caches.match(event.request).then((cached) =>
          cached ?? caches.match("/offline").then(r => r ?? new Response("Offline", { status: 503 }))
        )
      )
  )
})
