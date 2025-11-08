// Service Worker for Browser Caching
// This enables offline functionality and improves performance

const CACHE_NAME = 'aio-creative-hub-v1';
const STATIC_CACHE = 'aio-static-v1';
const DYNAMIC_CACHE = 'aio-dynamic-v1';
const RUNTIME_CACHE = 'aio-runtime-v1';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Cache First: Static assets, images, fonts
  CACHE_FIRST: 'cache-first',

  // Network First: API calls, dynamic content
  NETWORK_FIRST: 'network-first',

  // Stale While Revalidate: User profile, preferences
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',

  // Network Only: Real-time data
  NETWORK_ONLY: 'network-only',

  // Cache Only: Offline fallback
  CACHE_ONLY: 'cache-only',
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[ServiceWorker] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );

  // Force activation of new service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName !== STATIC_CACHE &&
            cacheName !== DYNAMIC_CACHE &&
            cacheName !== RUNTIME_CACHE
          ) {
            console.log('[ServiceWorker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  // Claim all clients
  self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Determine caching strategy based on request type
  const strategy = getCachingStrategy(request);

  event.respondWith(handleRequest(request, strategy));
});

// Get caching strategy based on request
function getCachingStrategy(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Static assets (JS, CSS, fonts) - Cache First
  if (
    pathname.match(/\.(js|css|woff2?|ttf|eot)$/) ||
    pathname.startsWith('/assets/')
  ) {
    return CACHE_STRATEGIES.CACHE_FIRST;
  }

  // Images - Cache First with revalidation
  if (pathname.match(/\.(png|jpg|jpeg|gif|webp|avif|svg)$/)) {
    return CACHE_STRATEGIES.CACHE_FIRST;
  }

  // API calls - Network First
  if (pathname.startsWith('/api/')) {
    return CACHE_STRATEGIES.NETWORK_FIRST;
  }

  // HTML pages - Stale While Revalidate
  if (pathname.match(/\.(html|htm)$/) || pathname === '/') {
    return CACHE_STRATEGIES.STALE_WHILE_REVALIDATE;
  }

  // Default to network first
  return CACHE_STRATEGIES.NETWORK_FIRST;
}

// Handle request with specified strategy
async function handleRequest(request, strategy) {
  try {
    switch (strategy) {
      case CACHE_STRATEGIES.CACHE_FIRST:
        return await cacheFirst(request);

      case CACHE_STRATEGIES.NETWORK_FIRST:
        return await networkFirst(request);

      case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
        return await staleWhileRevalidate(request);

      case CACHE_STRATEGIES.CACHE_ONLY:
        return await cacheOnly(request);

      case CACHE_STRATEGIES.NETWORK_ONLY:
        return await networkOnly(request);

      default:
        return await networkFirst(request);
    }
  } catch (error) {
    console.error('[ServiceWorker] Request failed:', error);

    // Return cached version if available
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline fallback
    return new Response('Offline - Content not available', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

// Cache First strategy
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);

  if (networkResponse.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, networkResponse.clone());
  }

  return networkResponse;
}

// Network First strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Stale While Revalidate strategy
async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      const cache = caches.open(RUNTIME_CACHE);
      cache.then((c) => c.put(request, networkResponse.clone()));
    }
    return networkResponse;
  });

  return cachedResponse || fetchPromise;
}

// Cache Only strategy
async function cacheOnly(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  throw new Error('No cached response available');
}

// Network Only strategy
async function networkOnly(request) {
  return await fetch(request);
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('[ServiceWorker] Background sync');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Implement background sync logic
  // e.g., sync offline actions when connection is restored
}

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push received');

  const data = event.data?.json() || {};
  const options = {
    body: data.body || 'New notification',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: data,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'AIO Creative Hub', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification click');

  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
