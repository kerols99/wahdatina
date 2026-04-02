// ══════════════════════════════
// sw.js — Service Worker
// واحدتنا v1.0
// ملاحظة: GitHub Pages مع subfolder
// يسجّل من index.html نفسه بـ scope صح
// ══════════════════════════════

const CACHE_NAME = 'wahdatina-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './helpers.js',
  './config.js',
  './i18n.js',
  './auth.js',
  './units.js',
  './payments.js',
  './dashboard.js',
  './reports.js',
  './moves.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .catch(err => console.warn('SW cache error:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // لا تتدخل في طلبات Supabase أو APIs خارجية
  if (event.request.url.includes('supabase.co') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('cdn.jsdelivr.net')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
