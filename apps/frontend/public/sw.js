const CACHE_VERSION = 'v2'
const STATIC_CACHE = `aio-static-${CACHE_VERSION}`
const RUNTIME_CACHE = `aio-runtime-${CACHE_VERSION}`
const API_CACHE = `aio-api-${CACHE_VERSION}`
const PRECACHE_URLS = ['/', '/index.html', '/favicon.ico', '/manifest.webmanifest']
const STATIC_ASSET_REGEX = /\.(?:js|css|woff2?|png|jpg|jpeg|gif|svg|webp|avif)$/i

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              ![STATIC_CACHE, RUNTIME_CACHE, API_CACHE].includes(key),
          )
          .map((key) => caches.delete(key)),
      ),
    ),
  )
  self.clients.claim()
})

const cacheFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) {
    return cached
  }
  const response = await fetch(request)
  if (response && response.ok) {
    cache.put(request, response.clone())
  }
  return response
}

const networkFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response && response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    const cached = await cache.match(request)
    if (cached) {
      return cached
    }
    throw error
  }
}

const staleWhileRevalidate = async (request, cacheName) => {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => cached)

  return cached || fetchPromise
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  if (request.destination === 'document') {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE))
    return
  }

  if (url.origin === self.location.origin && STATIC_ASSET_REGEX.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  if (request.destination === 'image') {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE))
    return
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      networkFirst(request, API_CACHE).catch(() => caches.match(request)),
    )
    return
  }
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
