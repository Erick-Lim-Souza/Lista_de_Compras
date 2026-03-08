/**
 * sw.js — Service Worker
 * ─────────────────────────────────────────────────────────────
 * Features:
 *   • Versioned cache — bump CACHE_VER to force fresh assets
 *   • Offline fallback page (/ served from cache)
 *   • Network-first for navigation, cache-first for static assets
 *   • Auto-activation: new SW takes over without waiting
 *   • Stale-while-revalidate for everything else
 * ─────────────────────────────────────────────────────────────
 */

const CACHE_VER   = 'lista-compras-v2';
const CACHE_STATIC = `${CACHE_VER}-static`;

// Assets that must be cached on install (app shell)
const SHELL = [
  '/',
  '/index.html',
  '/versao.html',
  '/styles.css',
  '/js/calculator.js',
  '/js/storage.js',
  '/js/ui.js',
  '/js/export.js',
  '/js/app.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,500;12..96,700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
];

// ── Install: cache the app shell ───────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())   // take over immediately
  );
});

// ── Activate: delete old caches ────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_STATIC)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())   // control all open tabs
  );
});

// ── Fetch strategy ─────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle http/https
  if (!url.protocol.startsWith('http')) return;

  // Navigation requests (HTML pages) — network-first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache a fresh copy
          const clone = response.clone();
          caches.open(CACHE_STATIC).then(c => c.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then(r => r || caches.match('/')))
    );
    return;
  }

  // Static assets (CSS, JS, fonts, images) — cache-first
  if (
    url.pathname.match(/\.(css|js|png|ico|webp|woff2?|ttf)$/) ||
    url.hostname.includes('fonts.g') ||
    url.hostname.includes('cloudflare')
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_STATIC).then(c => c.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Everything else — stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_STATIC).then(cache =>
      cache.match(request).then(cached => {
        const fresh = fetch(request).then(response => {
          cache.put(request, response.clone());
          return response;
        });
        return cached || fresh;
      })
    )
  );
});

// ── Message: force update from app ─────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
