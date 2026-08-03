const STATIC_CACHE = 'tvtracker-static-v3';
const IMAGE_CACHE = 'tvtracker-images-v1';

// Asset types we want to cache on-the-fly
const CACHEABLE_EXTENSIONS = ['.js', '.css', '.svg', '.png', '.jpg', '.jpeg', '.woff2', '.json'];

// Core app assets to pre-cache immediately
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json'
];

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[Service Worker] Pre-caching core assets...');
      return cache.addAll(CORE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== IMAGE_CACHE) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Skip caching for non-GET requests or internal API requests (Plex, Settings, etc.)
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. TMDB Images Cache-First Strategy
  if (url.hostname === 'image.tmdb.org') {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }).catch(() => {
            // Return nothing or let it fail gracefully
          });
        });
      })
    );
    return;
  }

  // 3. SPA Navigation fallback: return cached /index.html if network is offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        console.log('[Service Worker] Navigation failed, serving cached index.html...');
        return caches.match('/index.html');
      })
    );
    return;
  }

  // 4. Network-First for JS/CSS and static assets (with Cache fallback when offline)
  const isStaticAsset = CACHEABLE_EXTENSIONS.some(ext => url.pathname.endsWith(ext)) || url.pathname.includes('/assets/');
  
  if (isStaticAsset) {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(event.request);
      })
    );
  }
});
