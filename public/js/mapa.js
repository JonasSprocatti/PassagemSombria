// ============================================================================
//  MAPA DO SISTEMA SOLAR — compartilhado na sessão (pan/zoom + pontos de interesse).
//  Base estática (sol, órbitas, planetas, luas, cinturões) + camada dinâmica de
//  pontos de interesse, editável pelo Mestre e sincronizada via Supabase.
//  Uso: const api = abrirMapa({ mapaInicial, souMestre, salvar });
//       api.atualizarExterno(novoMapa);  // ao receber update em tempo real
//       api.fechar();
// ============================================================================
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const uid = () => "p" + Math.random().toString(36).slice(2, 9);
const SVGNS = "http://www.w3.org/2000/svg";

// Tipos de ponto de interesse (ícone + cor + rótulo).
export const TIPOS_POI = {
  cidade:     { ic: "🏙️", cor: "#59e3c8", lbl: "Cidade" },
  regiao:     { ic: "📍", cor: "#7ab8ff", lbl: "Região" },
  estacao:    { ic: "🛰️", cor: "#a0d0ff", lbl: "Estação espacial" },
  nave:       { ic: "🚀", cor: "#f0a860", lbl: "Nave abandonada" },
  detritos:   { ic: "☄️", cor: "#c89060", lbl: "Zona de detritos" },
  asteroides: { ic: "🪨", cor: "#b0a090", lbl: "Campo de asteroides" },
  anomalia:   { ic: "🌀", cor: "#a78bfa", lbl: "Anomalia" },
  base:       { ic: "🏭", cor: "#d0d0d0", lbl: "Base / Instalação" },
  mercado:    { ic: "💠", cor: "#5ad0e0", lbl: "Mercado / Porto" },
  perigo:     { ic: "⚠️", cor: "#f07a7a", lbl: "Perigo" },
  objetivo:   { ic: "🎯", cor: "#ffd24d", lbl: "Objetivo" },
  ruina:      { ic: "🏛️", cor: "#c0b0a0", lbl: "Ruína / Relíquia" },
  nebulosa:   { ic: "☁️", cor: "#9080d0", lbl: "Nebulosa" },
  destrocos:  { ic: "💀", cor: "#e08080", lbl: "Destroços" },
  portal:     { ic: "🌌", cor: "#8be0ff", lbl: "Portal / Salto" },
  posto:      { ic: "⛽", cor: "#90c080", lbl: "Posto avançado" },
  frota:      { ic: "⚔️", cor: "#f0a0a0", lbl: "Frota / Encontro" },
  tesouro:    { ic: "💎", cor: "#7affd0", lbl: "Tesouro / Recurso" },
};

// Planetas (posições fixas no mapa — ângulo estável p/ todos verem igual).
const PLANETAS = [
  { nome: "Mercúrio", raca: "Mercusys",    r: 70,  ang: 15,  tam: 6,  cor: "#c9a15a", luas: [] },
  { nome: "Vênus",    raca: "Ven'y",       r: 105, ang: 70,  tam: 8,  cor: "#e0b060", luas: [] },
  { nome: "Terra",    raca: "Terráqueo",   r: 140, ang: 130, tam: 8,  cor: "#4a90d9", luas: ["Lua"] },
  { nome: "Marte",    raca: "Marciano",    r: 175, ang: 200, tam: 7,  cor: "#c1440e", luas: ["Fobos", "Deimos"] },
  { nome: "Júpiter",  raca: "Conjupitero", r: 250, ang: 300, tam: 18, cor: "#d8a878", luas: ["Io", "Europa", "Ganimedes", "Calisto"] },
  { nome: "Saturno",  raca: "Sata",        r: 320, ang: 40,  tam: 15, cor: "#e3d9a8", luas: ["Titã", "Encélado"], aneis: true },
  { nome: "Urano",    raca: "Urak",        r: 385, ang: 160, tam: 11, cor: "#a0e0e0", luas: ["Titânia", "Oberon"], aneis: true },
  { nome: "Netuno",   raca: "Proturno",    r: 440, ang: 250, tam: 11, cor: "#3a6ecc", luas: ["Tritão"] },
  { nome: "Plutão",   raca: "Infimor",     r: 500, ang: 330, tam: 4,  cor: "#b0a090", luas: ["Caronte"] },
];
const pol = (r, angDeg) => { const a = (angDeg * Math.PI) / 180; return [Math.cos(a) * r, Math.sin(a) * r]; };

export function abrirMapa({ mapaInicial, souMestre, salvar }) {
  let mapa = normaliza(mapaInicial);
  let tx = 0, ty = 0, s = 1;                 // pan/zoom
  let modo = "navegar";                       // navegar | adicionar | local
  let tipoSel = "cidade";
  let arrastandoPOI = null, arrastouMapa = false;

  const ov = document.createElement("div");
  ov.className = "mp-overlay";
  ov.innerHTML = `
    <div class="mp-topo">
      <b>🗺 Mapa do Sistema Solar</b>
      <span class="mp-modo-lbl"></span>
      <div class="mp-zoom"><button data-z="-" title="Afastar">−</button><button data-z="0" title="Centralizar">⊙</button><button data-z="+" title="Aproximar">+</button></div>
      <button class="mp-fechar" title="Fechar">✕</button>
    </div>
    <div class="mp-canvas"><svg class="mp-svg"></svg>
      <div class="mp-card" style="display:none"></div>
      ${souMestre ? `<div class="mp-ferramentas">
        <div class="mp-modos">
          <button data-m="navegar" class="on">🧭 Navegar</button>
          <button data-m="adicionar">➕ Adicionar ponto</button>
          <button data-m="local">🚩 Local do grupo</button>
        </div>
        <div class="mp-tipos" style="display:none">${Object.entries(TIPOS_POI).map(([k, t]) => `<button data-t="${k}" title="${t.lbl}" style="border-color:${t.cor}">${t.ic}</button>`).join("")}</div>
        <p class="mp-dica"></p>
      </div>` : `<div class="mp-ferramentas"><p class="mp-dica">👁 Visão da tripulação — o Mestre controla o mapa. Arraste para mover, role para dar zoom, clique nos pontos.</p></div>`}
    </div>`;
  document.body.appendChild(ov);
  document.body.style.overflow = "hidden";

  const svg = ov.querySelector(".mp-svg");
  const card = ov.querySelector(".mp-card");
  const dica = ov.querySelector(".mp-dica");
  const modoLbl = ov.querySelector(".mp-modo-lbl");
  const W = () => svg.clientWidth, H = () => svg.clientHeight;

  const persistir = () => { if (salvar) salvar(JSON.parse(JSON.stringify(mapa))); };

  // ---- desenho ----
  function tela2mapa(cx, cy) { const rect = svg.getBoundingClientRect(); return [(cx - rect.left - tx) / s, (cy - rect.top - ty) / s]; }
  function aplicarCam() { const g = svg.querySelector("#cam"); if (g) g.setAttribute("transform", `translate(${tx} ${ty}) scale(${s})`); }
  function centralizar() { s = Math.min(W() / 1120, H() / 1120) || 0.6; tx = W() / 2; ty = H() / 2; aplicarCam(); }

  function el(tag, attrs, txt) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (txt != null) e.textContent = txt; return e; }

  function desenhar() {
    svg.innerHTML = "";
    const cam = el("g", { id: "cam" }); svg.appendChild(cam);
    // estrelas de fundo
    const est = el("g", { opacity: ".6" });
    for (let i = 0; i < 220; i++) est.appendChild(el("circle", { cx: (Math.random() * 2 - 1) * 700, cy: (Math.random() * 2 - 1) * 700, r: Math.random() * 1.3, fill: "#ffffff", opacity: (0.3 + Math.random() * 0.6).toFixed(2) }));
    cam.appendChild(est);
    // cinturão de asteroides (entre Marte e Júpiter) e de Kuiper (além de Netuno)
    for (const [rr, n, op] of [[210, 90, 0.5], [470, 120, 0.35]]) {
      const belt = el("g", { fill: "#8a7a5a", opacity: op });
      for (let i = 0; i < n; i++) { const [x, y] = pol(rr + (Math.random() * 2 - 1) * (rr > 400 ? 30 : 18), Math.random() * 360); belt.appendChild(el("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: (0.6 + Math.random() * 1.4).toFixed(1) })); }
      cam.appendChild(belt);
    }
    // órbitas
    for (const p of PLANETAS) cam.appendChild(el("circle", { cx: 0, cy: 0, r: p.r, fill: "none", stroke: "#2a3350", "stroke-width": 0.6 }));
    // sol
    cam.appendChild(el("circle", { cx: 0, cy: 0, r: 26, fill: "#ffcc44" }));
    cam.appendChild(el("circle", { cx: 0, cy: 0, r: 40, fill: "#ffaa33", opacity: ".18" }));
    cam.appendChild(el("text", { x: 0, y: 52, fill: "#ffcc44", "font-size": 11, "text-anchor": "middle" }, "Sol"));
    // planetas + luas + rótulos
    for (const p of PLANETAS) {
      const [x, y] = pol(p.r, p.ang);
      if (p.aneis) { const ring = el("ellipse", { cx: x, cy: y, rx: p.tam * 2, ry: p.tam * 0.7, fill: "none", stroke: p.cor, "stroke-width": 1.2, opacity: ".6" }); cam.appendChild(ring); }
      cam.appendChild(el("circle", { cx: x, cy: y, r: p.tam, fill: p.cor }));
      cam.appendChild(el("text", { x, y: y - p.tam - 5, fill: p.cor, "font-size": 11, "text-anchor": "middle", "font-weight": "600" }, p.nome));
      cam.appendChild(el("text", { x, y: y + p.tam + 12, fill: "#8189a3", "font-size": 8.5, "text-anchor": "middle" }, p.raca));
      (p.luas || []).forEach((lua, i) => { const lr = p.tam + 10 + i * 7; const [lx, ly] = [x + Math.cos((i * 67) * Math.PI / 180) * lr, y + Math.sin((i * 67) * Math.PI / 180) * lr];
        cam.appendChild(el("circle", { cx: lx, cy: ly, r: 1.8, fill: "#c0c8d8" }));
        cam.appendChild(el("text", { x: lx, y: ly - 3, fill: "#6a77a3", "font-size": 6, "text-anchor": "middle" }, lua)); });
    }
    // pontos de interesse
    for (const poi of mapa.pois) cam.appendChild(nodePOI(poi));
    // local do grupo
    if (mapa.atual) { const g = el("g", { class: "mp-atual" });
      g.appendChild(el("circle", { cx: mapa.atual.x, cy: mapa.atual.y, r: 9, fill: "none", stroke: "#59e3c8", "stroke-width": 2 }));
      g.appendChild(el("circle", { cx: mapa.atual.x, cy: mapa.atual.y, r: 3, fill: "#59e3c8" }));
      g.appendChild(el("text", { x: mapa.atual.x, y: mapa.atual.y - 14, fill: "#59e3c8", "font-size": 10, "text-anchor": "middle", "font-weight": "700" }, "🚩 " + (mapa.atual.nome || "Grupo")));
      cam.appendChild(g); }
    aplicarCam();
  }

  function nodePOI(poi) {
    const t = TIPOS_POI[poi.tipo] || TIPOS_POI.objetivo;
    const g = el("g", { class: "mp-poi", "data-id": poi.id, style: "cursor:pointer" });
    g.appendChild(el("circle", { cx: poi.x, cy: poi.y, r: 8, fill: "#0c0f19", stroke: t.cor, "stroke-width": 1.5 }));
    g.appendChild(el("text", { x: poi.x, y: poi.y + 4, "font-size": 10, "text-anchor": "middle" }, t.ic));
    g.appendChild(el("text", { x: poi.x, y: poi.y - 12, fill: t.cor, "font-size": 9.5, "text-anchor": "middle" }, poi.nome || t.lbl));
    return g;
  }

  // ---- card de detalhe ----
  function abrirCard(poi) {
    const t = TIPOS_POI[poi.tipo] || TIPOS_POI.objetivo;
    card.innerHTML = `<div class="mp-card-cab"><span style="color:${t.cor}">${t.ic} ${esc(poi.nome || t.lbl)}</span><button class="mp-card-x">✕</button></div>
      <p class="mp-card-tipo">${t.lbl}</p>
      ${poi.desc ? `<p class="mp-card-desc">${esc(poi.desc)}</p>` : `<p class="mp-card-desc dim">Sem descrição.</p>`}
      ${souMestre ? `<div class="mp-card-acoes"><button class="mp-edit">✎ Editar</button><button class="mp-del">🗑 Excluir</button><span class="dim" style="font-size:10px">arraste o ponto p/ mover</span></div>` : ""}`;
    card.style.display = "block";
    card.querySelector(".mp-card-x").onclick = () => card.style.display = "none";
    if (souMestre) {
      card.querySelector(".mp-edit").onclick = () => editarPOI(poi);
      card.querySelector(".mp-del").onclick = () => { if (confirm(`Excluir "${poi.nome || t.lbl}"?`)) { mapa.pois = mapa.pois.filter((x) => x.id !== poi.id); card.style.display = "none"; desenhar(); persistir(); } };
    }
  }
  function editarPOI(poi) {
    const nome = prompt("Nome do ponto:", poi.nome || ""); if (nome === null) return;
    const desc = prompt("Descrição (opcional):", poi.desc || ""); if (desc === null) return;
    poi.nome = nome.trim(); poi.desc = desc.trim(); desenhar(); persistir();
    card.style.display = "none";
  }

  // ---- interação (pan/zoom/clique/arraste) ----
  let down = null;
  svg.addEventListener("pointerdown", (e) => {
    const poiEl = e.target.closest(".mp-poi");
    if (souMestre && modo === "navegar" && poiEl) { arrastandoPOI = { id: poiEl.dataset.id, moveu: false }; }
    down = { x: e.clientX, y: e.clientY, tx, ty }; arrastouMapa = false;
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (arrastandoPOI) {
      if (Math.hypot(dx, dy) > 3) arrastandoPOI.moveu = true;
      const poi = mapa.pois.find((p) => p.id === arrastandoPOI.id);
      if (poi) { const [mx, my] = tela2mapa(e.clientX, e.clientY); poi.x = Math.round(mx); poi.y = Math.round(my); desenhar(); }
      return;
    }
    if (Math.hypot(dx, dy) > 3) arrastouMapa = true;
    tx = down.tx + dx; ty = down.ty + dy; aplicarCam();
  });
  svg.addEventListener("pointerup", (e) => {
    const eraArrasteMapa = arrastouMapa, poiMoveu = arrastandoPOI?.moveu;
    if (arrastandoPOI) { if (poiMoveu) persistir(); arrastandoPOI = null; }
    down = null;
    if (eraArrasteMapa || poiMoveu) return; // foi arraste, não clique
    const [mx, my] = tela2mapa(e.clientX, e.clientY);
    const poiEl = e.target.closest(".mp-poi");
    if (poiEl) { const poi = mapa.pois.find((p) => p.id === poiEl.dataset.id); if (poi) abrirCard(poi); return; }
    if (!souMestre) { card.style.display = "none"; return; }
    if (modo === "adicionar") {
      const nome = prompt(`Nome do ${TIPOS_POI[tipoSel].lbl.toLowerCase()}:`, ""); if (nome === null) return;
      const desc = prompt("Descrição (opcional):", "") || "";
      mapa.pois.push({ id: uid(), tipo: tipoSel, nome: nome.trim(), desc: desc.trim(), x: Math.round(mx), y: Math.round(my) });
      desenhar(); persistir();
    } else if (modo === "local") {
      const nome = prompt("Rótulo do grupo (ex.: A Tripulação):", mapa.atual?.nome || "Grupo");
      mapa.atual = { x: Math.round(mx), y: Math.round(my), nome: (nome || "Grupo").trim() };
      desenhar(); persistir();
    } else card.style.display = "none";
  });
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = svg.getBoundingClientRect(), cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    const [mx, my] = [(cx - tx) / s, (cy - ty) / s];
    s = Math.max(0.15, Math.min(6, s * (e.deltaY < 0 ? 1.15 : 0.87)));
    tx = cx - mx * s; ty = cy - my * s; aplicarCam();
  }, { passive: false });

  // ---- ferramentas do mestre ----
  const setModo = (m) => { modo = m; card.style.display = "none";
    ov.querySelectorAll(".mp-modos button").forEach((b) => b.classList.toggle("on", b.dataset.m === m));
    ov.querySelector(".mp-tipos").style.display = m === "adicionar" ? "flex" : "none";
    modoLbl.textContent = m === "adicionar" ? `Adicionando: ${TIPOS_POI[tipoSel].lbl}` : m === "local" ? "Clique para marcar o local do grupo" : "";
    dica.textContent = m === "adicionar" ? "Escolha um tipo e clique no mapa para posicionar." : m === "local" ? "Clique onde a tripulação está agora." : "Arraste para mover · role para zoom · clique num ponto para ver/editar · arraste um ponto para reposicioná-lo.";
  };
  if (souMestre) {
    ov.querySelectorAll(".mp-modos button").forEach((b) => b.onclick = () => setModo(b.dataset.m));
    ov.querySelectorAll(".mp-tipos button").forEach((b) => b.onclick = () => { tipoSel = b.dataset.t; ov.querySelectorAll(".mp-tipos button").forEach((x) => x.classList.toggle("on", x === b)); modoLbl.textContent = `Adicionando: ${TIPOS_POI[tipoSel].lbl}`; });
    setModo("navegar");
  } else dica.textContent = "👁 Visão da tripulação — arraste para mover, role para zoom, clique nos pontos.";

  ov.querySelectorAll(".mp-zoom button").forEach((b) => b.onclick = () => {
    if (b.dataset.z === "0") { centralizar(); return; }
    const cx = W() / 2, cy = H() / 2, mx = (cx - tx) / s, my = (cy - ty) / s;
    s = Math.max(0.15, Math.min(6, s * (b.dataset.z === "+" ? 1.25 : 0.8)));
    tx = cx - mx * s; ty = cy - my * s; aplicarCam();
  });
  ov.querySelector(".mp-fechar").onclick = () => fechar();
  ov.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });

  const onResize = () => aplicarCam();
  window.addEventListener("resize", onResize);
  let fechado = false;
  function fechar() { if (fechado) return; fechado = true; window.removeEventListener("resize", onResize); document.body.style.overflow = ""; ov.remove(); }

  // primeira pintura
  requestAnimationFrame(() => { centralizar(); desenhar(); });

  return {
    atualizarExterno(novo) { if (fechado) return; mapa = normaliza(novo); const cardAberto = card.style.display === "block"; desenhar(); if (!cardAberto) card.style.display = "none"; },
    fechar,
  };
}

function normaliza(m) {
  const o = (m && typeof m === "object") ? m : {};
  return { pois: Array.isArray(o.pois) ? o.pois : [], atual: o.atual || null };
}
