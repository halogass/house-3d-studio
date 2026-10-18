// Offline cache for the walk-through. Pages always go to the network so the PIN gate and new
// deploys still apply.
//   cache-first: hashed app bundles (/assets/*), textures, and the baked lightmaps (/bake/<area>/*.webp:
//                their names carry the area's geometry hash, so a re-bake is a new URL)
//   stale-while-revalidate: photo vegetation, HDRI, scanned furniture (/garden, /env: fixed
//                names, served from the cache at once and refreshed in the background)
//   network-first (cache when offline): /bake/index.json (which bakes are current)
const CACHE = 'h3s-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

// only keep real files, not the PIN page served to a logged-out visitor
const keep = (res) => res.ok && !(res.headers.get('content-type') || '').includes('text/html');

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const p = url.pathname;
  if (/^\/(assets|textures)\//.test(p) || /^\/bake\/[^/]+\/[^/]+\.webp$/.test(p)) {
    e.respondWith(caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (keep(res)) cache.put(req, res.clone());
      return res;
    }));
  } else if (/^\/(garden|env)\//.test(p)) {
    e.respondWith(caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      const net = fetch(req).then((res) => { if (keep(res)) cache.put(req, res.clone()); return res; }).catch(() => hit);
      if (hit) { e.waitUntil(net); return hit; }
      return net;
    }));
  } else if (p === '/bake/index.json') {
    e.respondWith(caches.open(CACHE).then(async (cache) => {
      try {
        const res = await fetch(req);
        if (keep(res)) cache.put(req, res.clone());
        return res;
      } catch (err) {
        return (await cache.match(req)) || Response.error();
      }
    }));
  }
});
