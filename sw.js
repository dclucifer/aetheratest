// sw.js — clean v6 (dev-friendly)
const BUILD_VER = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE_NAME = `aethera-cache-${BUILD_VER}`;
const ASSETS = [
  './',
  './index.html',
  './locales/id.json',
  './locales/en.json',
  './assets/images/logo-full.png',
  './assets/images/logo-full-light.png',
  './assets/images/logo-icon.png',
  './assets/images/logo-icon-light.png',
  './assets/images/favicon.png',
  // catatan: URL cross-origin di bawah ini akan DIABAIKAN saat install, aman.
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@700&display=swap',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css',
  'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/docx/8.4.0/docx.umd.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      // Cache HANYA same-origin (hindari CORS error untuk CDN)
      const sameOrigin = ASSETS.filter(u => {
        try { return new URL(u, self.location.origin).origin === self.location.origin; }
        catch { return false; }
      });
      await cache.addAll(sameOrigin);
    } catch (e) {}
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // Abaikan cross-origin
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;
  // DEV: jangan intercept path Vite dev/hmr supaya selalu fresh (hindari port lama di-cache)
  if (
    path.startsWith('/@vite') ||
    path.startsWith('/@id') ||
    path.startsWith('/@fs') ||
    path === '/__vite_ping' ||
    path.startsWith('/node_modules/.vite')
  ) {
    return; // biarkan network langsung
  }

  const accept = event.request.headers.get('accept') || '';
  const isHtml  = accept.includes('text/html') || event.request.mode === 'navigate';
  const isAsset = url.pathname.endsWith('.js') || url.pathname.endsWith('.css');

  // Network-first untuk HTML & JS/CSS agar update tidak kehalang cache
  if (isHtml || isAsset) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request, { cache: 'no-store' });
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
        if (cached) return cached;
        if (isHtml) return new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
        throw new Error('Network error and no cache');
      }
    })());
    return;
  }

  // Cache-first untuk aset same-origin lain (gambar, font lokal, dll.)
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      const resp = await fetch(event.request);
      cache.put(event.request, resp.clone());
      return resp;
    } catch {
      return cached || Response.error();
    }
  })());
});
