// ══════════════════════════════
// sw.js — Service Worker
// واحدتنا v1.0
// ══════════════════════════════

const CACHE_NAME = 'wahdatina-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  '/helpers.js',
  '/config.js',
  '/i18n.js',
  '/auth.js',
  '/units.js',
  '/payments.js',
  '/dashboard.js',
  '/reports.js',
  '/moves.js',
];

// تثبيت: كاش الملفات الأساسية
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// تفعيل: حذف الكاش القديم
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: Network first، ثم Cache fallback
self.addEventListener('fetch', event => {
  // لا تتدخل في طلبات Supabase
  if (event.request.url.includes('supabase.co')) return;

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
