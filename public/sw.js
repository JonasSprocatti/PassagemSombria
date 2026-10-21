// ============================================================================
//  Service Worker — Passagem Sombria (PWA)
//  Guarda o "app shell" para abrir offline. Dados (Supabase) e realtime seguem
//  sempre pela rede.
//
//  CACHE: o "__VERSAO__" é trocado pelo commit no build da Vercel
//  (scripts/build-vercel.sh), então cada deploy ganha um cache novo sozinho —
//  não precisa mais lembrar de subir um número aqui.
//
//  Código (HTML/JS/CSS) vem da REDE primeiro e só cai no cache sem conexão.
//  Antes era stale-while-revalidate: a página abria com o app.js velho do
//  cache e, minutos depois, um import() dinâmico (mesa-ficha.js…) já pegava a
//  versão nova, que podia esperar um export que o app.js velho não tinha
//  ("does not provide an export named …"). Rede primeiro mantém todos os
//  módulos da mesma versão enquanto houver internet.
// ============================================================================
const CACHE = "ps-shell-__VERSAO__";
// Arquivos baixados na instalação, para o app abrir offline. Os testes
// (tests/modulos.test.js) conferem que todo módulo de public/js está aqui.
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./logo.svg",
  "./css/estilo.css",
  "./vendor/supabase-2.117.2.js",
  "./js/registrar-sw.js",
  "./js/config.js",
  "./js/seguro.js",
  "./js/ui.js",
  "./js/dados-jogo.js",
  "./js/dados-bestiario.js",
  "./js/dados-npcs.js",
  "./js/dados-mestre.js",
  "./js/conteudo.js",
  "./js/criacao.js",
  "./js/criaturas.js",
  "./js/efeitos.js",
  "./js/regras.js",
  "./js/biblioteca.js",
  "./js/admin.js",
  "./js/relatorio-fichas.js",
  "./js/notificacoes.js",
  "./js/app.js",
  "./js/sistema-solar.js",
  "./js/mapa-sistema.js",
  "./js/mesa-mestre.js",
  "./js/mesa-nave.js",
  "./js/mesa-combate.js",
  "./js/mesa-ficha.js",
  "./js/social.js",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // Um arquivo faltando não derruba a instalação, mas aparece no console
    // (antes o allSettled engolia o erro e o arquivo só não funcionava offline).
    const res = await Promise.allSettled(SHELL.map((u) => c.add(u)));
    res.forEach((r, i) => { if (r.status === "rejected") console.warn("[sw] não guardei", SHELL[i], r.reason); });
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

const ehCodigo = (url, req) => req.mode === "navigate" || /\.(js|mjs|css|html|json)$/.test(url.pathname) || url.pathname.endsWith("/");

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                       // só GET
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // Supabase / esm.sh / fontes → rede direta

  // Código: rede primeiro (mesma versão em todos os módulos), cache só offline.
  if (ehCodigo(url, req)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const net = await fetch(req, { cache: "no-cache" });
        if (net && net.ok) cache.put(req.mode === "navigate" ? "./index.html" : req, net.clone());
        return net;
      } catch {
        return (await cache.match(req.mode === "navigate" ? "./index.html" : req, { ignoreSearch: true }))
          || (await cache.match("./")) || new Response("", { status: 504 });
      }
    })());
    return;
  }

  // Imagens e outros estáticos: stale-while-revalidate (rápido, versão não importa).
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const rede = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    return cached || (await rede) || new Response("", { status: 504 });
  })());
});
