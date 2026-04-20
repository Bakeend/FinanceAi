const VERSION = 'v3';
const SHELL = `shell-${VERSION}`;
const API = `api-${VERSION}`;

const SHELL_ASSETS = ['/', '/manifest.webmanifest', '/icon.svg', '/favicon.svg'];

const READ_PREFIXES = [
  '/dashboard', '/transactions', '/accounts', '/goals',
  '/budgets', '/reminders', '/rules', '/trips',
  '/auth/me', '/auth/status', '/ai/chat/history', '/ai/memory',
];

const WRITE_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.all(SHELL_ASSETS.map(async (u) => {
      try { await cache.add(u); } catch {}
    }));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => n !== SHELL && n !== API).map((n) => caches.delete(n)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.method === 'GET') {
    if (req.mode === 'navigate' || url.pathname.startsWith('/assets/') || SHELL_ASSETS.includes(url.pathname)) {
      event.respondWith(networkFirst(req, SHELL, { fallbackNav: req.mode === 'navigate' }));
      return;
    }
    if (isReadEndpoint(url.pathname)) {
      event.respondWith(staleWhileRevalidate(req, API));
    }
    return;
  }

  if (WRITE_METHODS.includes(req.method) && isApiPath(url.pathname)) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) invalidateForWrite(url.pathname).catch(() => {});
        return res;
      } catch {
        return new Response(JSON.stringify({ error: 'offline', message: 'Sem conexão — tente novamente.' }), {
          status: 503, headers: { 'Content-Type': 'application/json' },
        });
      }
    })());
  }
});

function isReadEndpoint(pathname) {
  return READ_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?'));
}

function isApiPath(pathname) {
  const first = '/' + (pathname.split('/')[1] ?? '');
  return ['/auth', '/transactions', '/accounts', '/goals', '/budgets', '/reminders', '/rules', '/trips', '/dashboard', '/ai', '/backup'].includes(first);
}

async function networkFirst(req, cacheName, opts = {}) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    if (opts.fallbackNav) {
      const root = await cache.match('/');
      if (root) return root;
    }
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fresh = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  if (cached) {
    fresh.catch(() => {});
    return cached;
  }
  const r = await fresh;
  if (r) return r;
  return new Response(JSON.stringify({ error: 'offline' }), {
    status: 503, headers: { 'Content-Type': 'application/json' },
  });
}

async function invalidateForWrite(pathname) {
  const cache = await caches.open(API);
  const first = '/' + (pathname.split('/')[1] ?? '');
  const keys = await cache.keys();
  await Promise.all(keys.map((req) => {
    const p = new URL(req.url).pathname;
    if (p.startsWith(first) || p.startsWith('/dashboard')) return cache.delete(req);
    return Promise.resolve();
  }));
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_API_CACHE') {
    event.waitUntil(caches.delete(API));
  }
});
