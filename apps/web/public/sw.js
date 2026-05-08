const CACHE_VERSION = 'dtb-v1'
const STATIC_CACHE  = `${CACHE_VERSION}-static`
const IMAGE_CACHE   = `${CACHE_VERSION}-images`
const API_CACHE     = `${CACHE_VERSION}-api`
const ALL_CACHES    = [STATIC_CACHE, IMAGE_CACHE, API_CACHE]

// Pre-cache critical shell assets on install
const PRECACHE_URLS = [
  '/offline',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE_URLS).catch(() => {}))
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !ALL_CACHES.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin and known CDN requests
  if (request.method !== 'GET') return

  // Next.js static chunks — CacheFirst (they have content-hashed filenames)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Images — CacheFirst with 7-day expiry
  if (/\.(png|jpg|jpeg|svg|gif|webp|ico)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE))
    return
  }

  // API routes — NetworkFirst, fall back to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE))
    return
  }

  // Navigation requests — NetworkFirst, fall back to /offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline').then(r => r ?? fetch('/offline')))
    )
    return
  }
})

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(cacheName)
    cache.put(request, response.clone())
  }
  return response
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return caches.match(request)
  }
}
