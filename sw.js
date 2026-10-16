/**
 * sw.js — Service Worker
 * ─────────────────────────────────────────────────────────────
 * Features:
 *   • Versioned cache — bump CACHE_VER to force fresh assets
 *   • Offline fallback page (/ served from cache)
 *   • Network-first for navigation, cache-first for static assets
 *   • Auto-activation: new SW takes over without waiting
 *   • Stale-while-revalidate for everything else
 *   • ✅ Skips non-GET requests (POST/PUT/DELETE never cached)
 *   • ✅ Skips Supabase API (never cache auth/data)
 *   • ✅ Resilient install (one bad URL doesn't kill the SW)
 * ─────────────────────────────────────────────────────────────
 */

const CACHE_VER = 'lista-compras-v3.1';
const CACHE_STATIC = `${CACHE_VER}-static`;

// Assets que devem ser cacheados no install (app shell).
// Mantenha só o que EXISTE de verdade no repositório.
const SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/js/supabase-client.js',
  '/js/auth.js',
  '/js/calculator.js',
  '/js/storage.js',
  '/js/ui.js',
  '/js/export.js',
  '/js/app.js',
  // 'manifest.json'  → deixa de fora: Codespaces intercepta
  //                    (o navegador busca o manifest sozinho e
  //                     cacheá-lo não traz benefício real)
];

// URLs externas (fontes, CDN) — cacheadas separadamente e de forma opcional
const SHELL_EXTERNAL = [
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,500;12..96,700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
];

// ── Helper: nunca cachear nada que não seja GET ────────────────────
function isCacheable(request) {
  return request.method === 'GET';
}

// ── Helper: nunca cachear chamadas da API do Supabase ──────────────
function isSupabaseUrl(url) {
  // Ajuste se o seu projeto Supabase tiver outro domínio.
  return url.hostname.endsWith('.supabase.co') ||
         url.hostname.endsWith('.supabase.in');
}

// ── Install: cacheia o app shell de forma resiliente ───────────────
self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_STATIC);

      // 1. Cacheia assets locais — 1 falha não derruba os outros
      for (const url of SHELL) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('[sw] Falha ao cachear (local):', url, err.message);
        }
      }

      // 2. Cacheia recursos externos (fontes, CDN) — opcional
      for (const url of SHELL_EXTERNAL) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('[sw] Falha ao cachear (externo):', url, err.message);
        }
      }

      // 3. Ativa imediatamente
      await self.skipWaiting();
    })()
  );
});

// ── Activate: limpa caches antigos ─────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_STATIC)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch strategy ─────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Só http(s)
  if (!url.protocol.startsWith('http')) return;

  // 2. 🔴 CRÍTICO: nunca interceptar métodos diferentes de GET
  //    (Cache API rejeita POST/PUT/DELETE → quebra o app)
  if (!isCacheable(request)) return;

  // 3. 🔴 CRÍTICO: nunca cachear a API do Supabase
  //    (auth tokens, dados de listas, etc. devem sempre vir da rede)
  if (isSupabaseUrl(url)) return;

  // 4. Nunca cachear manifest.json em Codespaces (redirecionado p/ login)
  if (url.pathname.endsWith('/manifest.json')) return;

  // ─── Navigation requests (HTML) — network-first com fallback ───
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_STATIC)
              .then(c => c.put(request, clone))
              .catch(() => {});   // silencioso: put pode falhar, sem drama
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(r => r || caches.match('/index.html'))
        )
    );
    return;
  }

  // ─── Static assets — cache-first ────────────────────────────────
  if (
    url.pathname.match(/\.(css|js|png|jpe?g|svg|ico|webp|woff2?|ttf)$/) ||
    url.hostname.includes('fonts.g') ||
    url.hostname.includes('cloudflare') ||
    url.hostname.includes('jsdelivr')
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request)
          .then(response => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_STATIC)
                .then(c => c.put(request, clone))
                .catch(() => {});
            }
            return response;
          })
          .catch(() => cached || Response.error());
      })
    );
    return;
  }

  // ─── Everything else — stale-while-revalidate ──────────────────
  event.respondWith(
    caches.open(CACHE_STATIC).then(cache =>
      cache.match(request).then(cached => {
        const fresh = fetch(request)
          .then(response => {
            // Só atualiza cache se a resposta for OK
            if (response.ok) {
              cache.put(request, response.clone()).catch(() => {});
            }
            return response;
          })
          .catch(() => cached);   // 🔴 fallback se a rede falhar

        return cached || fresh;
      })
    )
  );
});

// ── Message: force update from app ─────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});