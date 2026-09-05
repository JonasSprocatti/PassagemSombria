// ============================================================================
//  Service Worker — Passagem Sombria (PWA)
//  Cacheia o "app shell" para abrir offline/instantâneo. Dados (Supabase) e
//  realtime seguem sempre pela rede. Bump em CACHE a cada deploy relevante.
// ============================================================================
const CACHE = "ps-shell-v18";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./logo.svg",
  "./css/estilo.css",
  "./js/config.js",
  "./js/ui.js",
  "./js/dados-jogo.js",
  "./js/dados-bestiario.js",
  "./js/dados-npcs.js",
  "./js/dados-mestre.js",
  "./js/conteudo.js",
  "./js/app.js",
  "./js/sistema-solar.js",
  "./js/mapa-sistema.js",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(SHELL.map((u) => c.add(u))); // não falha o install se 1 arquivo faltar
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const chaves = await caches.keys();
    await Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                       // só GET
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // Supabase / esm.sh → rede direta

  // Navegações (HTML): rede primeiro, cai pro cache se offline.
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try { const net = await fetch(req); const c = await caches.open(CACHE); c.put("./index.html", net.clone()); return net; }
      catch { return (await caches.match("./index.html")) || (await caches.match("./")); }
    })());
    return;
  }

  // Demais estáticos: stale-while-revalidate (serve rápido do cache, atualiza em segundo plano).
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const rede = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    return cached || (await rede) || new Response("", { status: 504 });
  })());
});
