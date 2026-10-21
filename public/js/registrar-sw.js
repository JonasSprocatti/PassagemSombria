// Registro do service worker. Fica num arquivo próprio (e não num <script>
// inline no index.html) porque a Content-Security-Policy do vercel.json não
// permite script inline.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  // sw.js já ativa a versão nova sozinho (skipWaiting + clients.claim), sem
  // esperar as abas antigas fecharem — mas sem isto, uma aba já aberta ficava
  // rodando com o app.js antigo (import estático, só carrega uma vez por
  // sessão) mesmo depois do Service Worker trocar de versão por baixo dela.
  // Recarregar na troca de controller garante que a aba sempre acaba rodando
  // a versão que o SW já teria servido de qualquer forma na próxima navegação.
  // Só recarrega se já havia um controller antes (primeira instalação não).
  let jaRecarregou = false;
  const tinhaController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (jaRecarregou || !tinhaController) return;
    jaRecarregou = true;
    location.reload();
  });
}
