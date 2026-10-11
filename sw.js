// Standout Service Worker
// Caches the shell for offline use and fast repeat loads

const CACHE = 'standout-v1';
const SHELL = [
  '/',
  '/index.html',
  '/app.html',
];

// Install — cache the shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// Activate — clean up old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network first, fall back to cache
// API calls always go to network (never cache)
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always pass API and Stripe calls straight through
  if (url.pathname.startsWith('/api/') || url.hostname.includes('stripe')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache successful GET responses for shell pages
        if (e.request.method === 'GET' && res.ok && SHELL.includes(url.pathname)) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
