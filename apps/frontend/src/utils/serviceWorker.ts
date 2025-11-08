// Service Worker registration and management utility

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(
      /^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)){3}$/
    )
);

export function registerSW() {
  if ('serviceWorker' in navigator) {
    const publicUrl = new URL(
      process.env.PUBLIC_URL || '',
      window.location.href
    );
    if (publicUrl.origin !== window.location.origin) {
      return;
    }

    window.addEventListener('load', () => {
      const swUrl = '/sw.js';

      if (isLocalhost) {
        checkValidServiceWorker(swUrl);
        navigator.serviceWorker.ready.then(() => {
          console.log(
            'This web app is being served cache-first by a service worker.'
          );
        });
      } else {
        registerValidSW(swUrl);
      }
    });
  }
}

function registerValidSW(swUrl: string) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      console.log('SW registered:', registration);

      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }
        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              showUpdateNotification();
            }
          }
        });
      });
    })
    .catch((error) => {
      console.error('SW registration failed:', error);
    });
}

function checkValidServiceWorker(swUrl: string) {
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        registerValidSW(swUrl);
      }
    })
    .catch(() => {
      console.log('No internet connection, running in offline mode.');
    });
}

function showUpdateNotification() {
  // Create notification
  const notification = document.createElement('div');
  notification.className =
    'fixed top-4 right-4 bg-blue-600 text-white p-4 rounded shadow-lg z-50';
  notification.innerHTML = `
    <div class="flex items-center justify-between">
      <span>New version available!</span>
      <div class="ml-4">
        <button class="px-3 py-1 bg-white text-blue-600 rounded mr-2 hover:bg-gray-100" id="update-btn">
          Update
        </button>
        <button class="px-3 py-1 bg-blue-700 text-white rounded hover:bg-blue-800" id="dismiss-btn">
          Dismiss
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(notification);

  // Update button handler
  notification.querySelector('#update-btn')?.addEventListener('click', () => {
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration && registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }
    });
  });

  // Dismiss button handler
  notification.querySelector('#dismiss-btn')?.addEventListener('click', () => {
    notification.remove();
  });

  // Auto dismiss after 10 seconds
  setTimeout(() => {
    notification.remove();
  }, 10000);
}

export function unregisterSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}

// Cache management functions
export async function clearCache(cacheName?: string) {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    const promises = cacheNames
      .filter((name) => !cacheName || name.includes(cacheName))
      .map((name) => caches.delete(name));
    await Promise.all(promises);
  }
}

export async function getCacheSize(cacheName?: string): Promise<number> {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    const filteredCaches = cacheName
      ? cacheNames.filter((name) => name.includes(cacheName))
      : cacheNames;

    let totalSize = 0;
    for (const cacheName of filteredCaches) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
    }
    return totalSize;
  }
  return 0;
}

export async function getCachedUrls(): Promise<string[]> {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    const allUrls: string[] = [];
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      for (const request of requests) {
        allUrls.push(request.url);
      }
    }
    return allUrls;
  }
  return [];
}

// Background sync
export async function registerBackgroundSync(tag: string) {
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register(tag);
  }
}

// Push notifications
export async function subscribePush(
  applicationServerKey: string
): Promise<PushSubscription | null> {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey,
    });
    return subscription;
  }
  return null;
}
