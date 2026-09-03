// ============================================================================
//  MAPA DO SISTEMA — mapa 2D top-down, compartilhado e sincronizado (VTT).
//  Uso: import { abrirMapa } from "./mapa-sistema.js";
//       const ctrl = abrirMapa({ mapa, souMestre, salvar(mapa), aoFechar });
//       ctrl.atualizar(novoMapa);  // chamado pelo realtime
// ============================================================================
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
import { modalForm, confirmModal } from "./ui.js";
const uid = () => "p" + Math.random().toString(36).slice(2, 9);

// ---- Layout fixo do sistema (top-down). Unidades de mapa; Sol em (0,0). ----
const K = 18; // escala das órbitas
// "periodo" é o período orbital real em anos terrestres. As velocidades no mapa
// guardam a mesma proporção do sistema solar — Mercúrio dá ~4 voltas enquanto a
// Terra dá 1 — apenas comprimidas numa escala de tempo jogável.
const PLANETAS = [
  { nome: "Mercúrio", raca: "Mercusys",    r: 9,  ang: 20,  tam: 6,  cor: "#c9a15a", periodo: 0.241, luas: [] },
  { nome: "Vênus",    raca: "Ven'y",       r: 13, ang: 75,  tam: 8,  cor: "#e0b060", periodo: 0.615, luas: [] },
  { nome: "Terra",    raca: "Terráqueo",   r: 17, ang: 130, tam: 8,  cor: "#4a90d9", periodo: 1.000, luas: ["Lua"] },
  { nome: "Marte",    raca: "Marciano",    r: 21, ang: 200, tam: 7,  cor: "#c1440e", periodo: 1.881, luas: ["Phobos", "Deimos"] },
  { nome: "Júpiter",  raca: "Conjupitero", r: 28, ang: 300, tam: 16, cor: "#d8a878", periodo: 11.86, luas: ["Io", "Europa", "Ganimedes", "Calisto"] },
  { nome: "Saturno",  raca: "Sata",        r: 35, ang: 40,  tam: 14, cor: "#e3d9a8", periodo: 29.46, luas: ["Titã", "Encélado", "Reia"], aneis: true },
  { nome: "Urano",    raca: "Urak",        r: 41, ang: 160, tam: 11, cor: "#a0e0e0", periodo: 84.01, luas: ["Titânia", "Oberon"], aneis: true },
  { nome: "Netuno",   raca: "Proturno",    r: 46, ang: 250, tam: 11, cor: "#3a6ecc", periodo: 164.8, luas: ["Tritão"] },
  { nome: "Plutão",   raca: "Infimor",     r: 51, ang: 340, tam: 5,  cor: "#b0a090", periodo: 248.0, luas: ["Caronte"] },
];
const rad = (g) => (g * Math.PI) / 180;

// Quanto tempo real vale um "ano terrestre" no mapa. Com 15 minutos, Mercúrio
// fecha uma volta em ~3,6min e a Terra em 15min: uma deriva perceptível ao longo
// de uma cena, sem roubar a atenção de quem está jogando.
const SEGUNDOS_POR_ANO = 900;
// Época fixa: todos os clientes calculam a mesma posição a partir daqui,
// então a mesa inteira vê os planetas no mesmo lugar sem sincronizar nada.
const EPOCA = Date.UTC(2400, 0, 1) / 1000;

let relogioMapa = () => Date.now() / 1000;      // trocável para pausar ou avançar o tempo
const anoAtual = () => (relogioMapa() - EPOCA) / SEGUNDOS_POR_ANO;
// Ângulo do planeta agora: posição inicial + voltas dadas desde a época.
const angDe = (p) => p.ang + (anoAtual() / p.periodo) * 360;
const px = (p) => Math.cos(rad(angDe(p))) * p.r * K;
const py = (p) => Math.sin(rad(angDe(p))) * p.r * K;

// ---- Catálogo de tipos de ponto de interesse ----
export const POI_TIPOS = {
  cidade:        { ic: "🏙", cor: "#f0d060", lbl: "Cidade" },
  regiao:        { ic: "🗺", cor: "#8be05a", lbl: "Região", area: true },
  estacao:       { ic: "🛰", cor: "#59e3c8", lbl: "Estação espacial" },
  colonia:       { ic: "🏘", cor: "#7ad0f0", lbl: "Colônia" },
  posto:         { ic: "🏭", cor: "#c0a060", lbl: "Posto avançado" },
  nave_abandon:  { ic: "🚀", cor: "#b0b8d0", lbl: "Nave abandonada" },
  destrocos:     { ic: "🛠", cor: "#9098b0", lbl: "Destroços / sucata" },
  detritos:      { ic: "💥", cor: "#e08040", lbl: "Zona de detritos", area: true },
  campo_ast:     { ic: "☄", cor: "#b0a080", lbl: "Campo de asteroides", area: true },
  asteroide:     { ic: "🪨", cor: "#a09080", lbl: "Asteroide" },
  nebulosa:      { ic: "☁", cor: "#a78bfa", lbl: "Nebulosa", area: true },
  anomalia:      { ic: "🌀", cor: "#c060f0", lbl: "Anomalia" },
  dobra:         { ic: "🕳", cor: "#8060ff", lbl: "Portal / dobra" },
  batalha:       { ic: "⚔", cor: "#f07a7a", lbl: "Local de batalha" },
  base_pirata:   { ic: "🏴", cor: "#e05050", lbl: "Base pirata" },
  mina:          { ic: "⛏", cor: "#d0a040", lbl: "Mina / extração" },
  farol:         { ic: "📡", cor: "#60e0e0", lbl: "Farol / sinal" },
  perigo:        { ic: "⚠", cor: "#f0b030", lbl: "Perigo / hazard", area: true },
  tesouro:       { ic: "💎", cor: "#50e0c0", lbl: "Tesouro / loot" },
  objetivo:      { ic: "🎯", cor: "#ff6060", lbl: "Objetivo" },
  contato:       { ic: "👤", cor: "#d0d8f0", lbl: "NPC / contato" },
  generico:      { ic: "📍", cor: "#f0a860", lbl: "Marcador" },
};

export function abrirMapa({ mapa, combate, souMestre, salvar, aoFechar }) {
  let ultimaParty = null;   // posição anterior do grupo, para desenhar o trajeto
  const reduzirMovimento = () => document.body.classList.contains("a11y-reduzir") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let estado = mapa && typeof mapa === "object" ? JSON.parse(JSON.stringify(mapa)) : {};
  if (!Array.isArray(estado.pontos)) estado.pontos = [];
  if (!estado.tokens || typeof estado.tokens !== "object") estado.tokens = {};
  let cbt = combate && Array.isArray(combate.ordem) ? combate : { ativo: false, ordem: [] };
  // viewBox de câmera (local por usuário)
  let cam = { x: -1100, y: -1100, w: 2200, h: 2200 };
  let modo = null; // "add" | "party" | null
  let tipoNovo = "generico";

  const ov = document.createElement("div");
  ov.className = "mp-overlay";
  ov.innerHTML = `
    <div class="mp-topo">
      <b>🗺 Mapa do Sistema</b>
      ${souMestre ? `<span class="mp-mestre-tools">
        <select id="mp-tipo">${Object.entries(POI_TIPOS).map(([k, v]) => `<option value="${k}">${v.ic} ${esc(v.lbl)}</option>`).join("")}</select>
        <button id="mp-add" class="mini">➕ Adicionar ponto</button>
        <button id="mp-party" class="mini">📍 Mover a party</button>
      </span>` : `<span class="mp-dim">Visão do jogador — o Mestre controla os pontos</span>`}
      <span class="mp-data" id="mp-data" title="Data do sistema. Os planetas orbitam na mesma proporção do sistema solar real."></span>
      <span class="mp-hint" id="mp-hint">Arraste para mover · role ou pinça para zoom</span>
      <button id="mp-fechar" class="mp-x">✕</button>
    </div>
    <div class="mp-canvas"><svg id="mp-svg" xmlns="http://www.w3.org/2000/svg"></svg>
      <div class="mp-zoom"><button id="mp-zin" title="Aproximar">+</button><button id="mp-zout" title="Afastar">−</button></div>
    </div>
    <div id="mp-pop" class="mp-pop" style="display:none"></div>`;
  document.body.appendChild(ov);
  document.body.style.overflow = "hidden";
  const svg = ov.querySelector("#mp-svg");
  const pop = ov.querySelector("#mp-pop");
  const hint = ov.querySelector("#mp-hint");

  const aplicarView = () => svg.setAttribute("viewBox", `${cam.x} ${cam.y} ${cam.w} ${cam.h}`);
  // Ajusta o viewBox ao formato do elemento (evita margens/letterbox), mantendo o centro.
  const ajustarAspecto = () => { const r = svg.getBoundingClientRect(); if (!r.width || !r.height) return;
    const cx = cam.x + cam.w / 2, cy = cam.y + cam.h / 2; cam.h = cam.w * (r.height / r.width);
    cam.x = cx - cam.w / 2; cam.y = cy - cam.h / 2; aplicarView(); };
  const onResize = () => { ajustarAspecto(); };
  window.addEventListener("resize", onResize);

  const atualizarData = () => {
    const el2 = ov.querySelector("#mp-data"); if (!el2) return;
    const anos = anoAtual();
    const ano = 2400 + Math.floor(anos);
    const dia = Math.floor((anos % 1) * 365) + 1;
    el2.textContent = `☀ Ano ${ano} · dia ${dia}`;
  };
  const grupos = [];              // {p, gp, luas} de cada planeta, para animar sem redesenhar
  let animId = 0;
  const posicionarPlanetas = () => {
    for (const { p, gp, luas } of grupos) {
      gp.setAttribute("transform", `translate(${px(p).toFixed(1)} ${py(p).toFixed(1)})`);
      for (const l of luas) {
        const a2 = l.fase + (anoAtual() / l.periodo) * 360;
        l.el.setAttribute("transform", `rotate(${a2.toFixed(1)})`);
      }
    }
  };
  const animar = () => {
    if (reduzirMovimento()) return;                 // quem pediu menos movimento vê o mapa parado
    posicionarPlanetas();
    animId = requestAnimationFrame(animar);
  };

  // ---- desenho ----
  const el = (tag, attrs, inner) => { const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]); if (inner != null) e.textContent = inner; return e; };

  const desenhar = () => {
    svg.innerHTML = "";
    const g = el("g", {});
    // órbitas
    for (const p of PLANETAS) g.appendChild(el("circle", { cx: 0, cy: 0, r: p.r * K, fill: "none", stroke: "#233", "stroke-width": 2 }));
    // cinturão de asteroides (Marte↔Júpiter)
    for (let i = 0; i < 120; i++) { const a = Math.random() * 360, rr = (24 + Math.random() * 3) * K;
      g.appendChild(el("circle", { cx: Math.cos(rad(a)) * rr, cy: Math.sin(rad(a)) * rr, r: 1.6, fill: "#6a6a55", opacity: 0.7 })); }
    // sol
    g.appendChild(el("circle", { cx: 0, cy: 0, r: 22, fill: "#ffcc44" }));
    g.appendChild(el("circle", { cx: 0, cy: 0, r: 30, fill: "#ffaa33", opacity: 0.2 }));
    g.appendChild(el("text", { x: 0, y: 44, fill: "#ffcc44", "font-size": 15, "text-anchor": "middle" }, "Sol"));
    // Planetas + luas. Cada planeta é um grupo desenhado na origem e posicionado
    // por transform — assim a animação só reposiciona o grupo, sem redesenhar o mapa.
    grupos.length = 0;
    for (const p of PLANETAS) {
      const gp = el("g", { class: "mp-planeta" });
      if (p.aneis) gp.appendChild(el("ellipse", { cx: 0, cy: 0, rx: p.tam * 2, ry: p.tam * 0.8, fill: "none", stroke: p.cor, "stroke-width": 2, opacity: 0.6 }));
      gp.appendChild(el("circle", { cx: 0, cy: 0, r: p.tam, fill: p.cor }));
      gp.appendChild(el("text", { x: 0, y: -p.tam - 6, fill: p.cor, "font-size": 14, "text-anchor": "middle", "font-weight": "600" }, p.nome));
      gp.appendChild(el("text", { x: 0, y: -p.tam - 20, fill: "#8189a3", "font-size": 10, "text-anchor": "middle" }, p.raca));
      const luas = [];
      p.luas.forEach((lua, i) => { const lr = p.tam + 14 + i * 9;
        gp.appendChild(el("circle", { cx: 0, cy: 0, r: lr, fill: "none", stroke: "#2a2a3a", "stroke-width": 1 }));
        const gl = el("g", {});
        gl.appendChild(el("circle", { cx: lr, cy: 0, r: 3, fill: "#c8c8d8" }));
        gl.appendChild(el("text", { x: lr, y: -6, fill: "#9098b0", "font-size": 9, "text-anchor": "middle" }, lua));
        gp.appendChild(gl);
        // Luas giram bem mais rápido que o planeta, como no sistema real.
        luas.push({ el: gl, periodo: p.periodo / (28 + i * 14), fase: (i / Math.max(1, p.luas.length)) * 360 + 30 });
      });
      g.appendChild(gp);
      grupos.push({ p, gp, luas });
    }
    posicionarPlanetas();
    // pontos de interesse
    for (const pt of estado.pontos) {
      const t = POI_TIPOS[pt.tipo] || POI_TIPOS.generico;
      if (t.area) { g.appendChild(el("circle", { cx: pt.x, cy: pt.y, r: pt.raio || 60, fill: t.cor, "fill-opacity": 0.12, stroke: t.cor, "stroke-width": 2, "stroke-dasharray": "6 5", "data-poi": pt.id, style: "cursor:pointer" })); }
      const mk = el("g", { "data-poi": pt.id, style: "cursor:pointer" });
      mk.appendChild(el("circle", { cx: pt.x, cy: pt.y, r: 11, fill: "#0c0f19", stroke: t.cor, "stroke-width": 2 }));
      mk.appendChild(el("text", { x: pt.x, y: pt.y + 5, "font-size": 13, "text-anchor": "middle" }, t.ic));
      mk.appendChild(el("text", { x: pt.x, y: pt.y - 15, fill: t.cor, "font-size": 12, "text-anchor": "middle", "font-weight": "600" }, pt.nome || t.lbl));
      g.appendChild(mk);
    }
    // localização da party — o grupo desliza até a nova posição em vez de teleportar,
    // e um rastro tracejado mostra o trajeto percorrido.
    if (estado.party) { const b = estado.party;
      const de = ultimaParty, indo = de && (de.x !== b.x || de.y !== b.y);
      if (indo) g.appendChild(el("line", { x1: de.x, y1: de.y, x2: b.x, y2: b.y,
        stroke: "#59e3c8", "stroke-width": 1.5, "stroke-dasharray": "5 6", opacity: 0.5, class: "mp-rota" }));
      const gp = el("g", { class: "mp-party" + (indo ? " viajando" : "") });
      gp.appendChild(el("circle", { cx: b.x, cy: b.y, r: 16, fill: "none", stroke: "#59e3c8", "stroke-width": 2, opacity: 0.5, class: "mp-pulso" }));
      gp.appendChild(el("text", { x: b.x, y: b.y + 6, "font-size": 18, "text-anchor": "middle" }, "🚀"));
      gp.appendChild(el("text", { x: b.x, y: b.y - 22, fill: "#59e3c8", "font-size": 12, "text-anchor": "middle", "font-weight": "700" }, b.nome || "A TRIPULAÇÃO"));
      if (indo && !reduzirMovimento()) {
        gp.style.transform = `translate(${de.x - b.x}px, ${de.y - b.y}px)`;
        requestAnimationFrame(() => { gp.style.transition = "transform 1.4s cubic-bezier(.35,.05,.2,1)"; gp.style.transform = "translate(0,0)"; });
      }
      g.appendChild(gp);
      ultimaParty = { x: b.x, y: b.y };
    }
    // tokens dos combatentes (do rastreador de iniciativa)
    if (cbt.ativo && cbt.ordem.length) {
      const base = estado.party || { x: 0, y: 0 };
      cbt.ordem.forEach((c, i) => {
        if (!estado.tokens[c.id]) estado.tokens[c.id] = { x: base.x + ((i % 5) - 2) * 40, y: base.y + 40 + Math.floor(i / 5) * 40 };
        const tk = estado.tokens[c.id]; const cor = c.tipo === "inimigo" ? "#f07a7a" : "#59e3c8"; const morto = c.hp <= 0;
        const gk = el("g", { "data-token": c.id, style: "cursor:pointer", opacity: morto ? 0.4 : 1 });
        gk.appendChild(el("circle", { cx: tk.x, cy: tk.y, r: 13, fill: "#0c0f19", stroke: cor, "stroke-width": 2.5 }));
        gk.appendChild(el("text", { x: tk.x, y: tk.y + 4, "font-size": 11, "text-anchor": "middle", fill: cor, "font-weight": "700" }, (c.nome || "?").slice(0, 3)));
        gk.appendChild(el("text", { x: tk.x, y: tk.y - 17, fill: cor, "font-size": 10, "text-anchor": "middle" }, `${esc(c.nome)}`));
        gk.appendChild(el("text", { x: tk.x, y: tk.y + 25, fill: "#8189a3", "font-size": 9, "text-anchor": "middle" }, `${c.hp}/${c.hp_max}${morto ? " ☠" : ""}`));
        g.appendChild(gk);
      });
    }
    svg.appendChild(g);
    aplicarView();
  };

  // ---- coordenadas tela → mapa (usa a matriz do SVG: robusto a viewBox/aspect) ----
  const paraMapa = (clientX, clientY) => {
    const ctm = svg.getScreenCTM(); if (!ctm) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint(); pt.x = clientX; pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  // ---- zoom ----
  const aplicarZoom = (f, cx, cy) => { const r = svg.getBoundingClientRect();
    const m = paraMapa(cx ?? r.left + r.width / 2, cy ?? r.top + r.height / 2);
    const nw = Math.min(8000, Math.max(120, cam.w * f)), nh = nw * (cam.h / cam.w);
    cam.x = m.x - (m.x - cam.x) * (nw / cam.w); cam.y = m.y - (m.y - cam.y) * (nh / cam.h);
    cam.w = nw; cam.h = nh; aplicarView(); };
  ov.querySelector(".mp-canvas").addEventListener("wheel", (e) => { e.preventDefault(); aplicarZoom(e.deltaY < 0 ? 0.85 : 1.18, e.clientX, e.clientY); }, { passive: false });
  ov.querySelector("#mp-zin").onclick = () => aplicarZoom(0.7);
  ov.querySelector("#mp-zout").onclick = () => aplicarZoom(1.42);

  // ---- pan / clique / pinça (zoom por 2 dedos) ----
  let arrastando = null, movendoPoi = null, movendoToken = null;
  const ponteiros = new Map(); // pointerId -> {x,y}
  let pinca = null;            // { lastDist } quando há 2 dedos
  const distancia = () => { const p = [...ponteiros.values()]; return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); };
  const meio = () => { const p = [...ponteiros.values()]; return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }; };

  svg.addEventListener("pointerdown", (e) => {
    ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ponteiros.size === 2) { // inicia pinça: cancela qualquer arraste
      arrastando = movendoPoi = movendoToken = null; pinca = { lastDist: distancia() }; return;
    }
    const tok = e.target.closest("[data-token]");
    if (tok && souMestre && modo === null) { movendoToken = { id: tok.dataset.token, moved: false }; svg.setPointerCapture(e.pointerId); return; }
    const alvo = e.target.closest("[data-poi]");
    if (alvo && souMestre && modo === null) { movendoPoi = { id: alvo.dataset.poi, moved: false }; svg.setPointerCapture(e.pointerId); return; }
    if (alvo && modo === null) { abrirPop(alvo.dataset.poi); return; }
    if (modo === "add") { adicionarPonto(paraMapa(e.clientX, e.clientY)); return; }
    if (modo === "party") { estado.party = { ...(estado.party || {}), ...paraMapa(e.clientX, e.clientY) }; setModo(null); persistir(); desenhar(); return; }
    const ctm = svg.getScreenCTM();
    arrastando = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, sx: (ctm && ctm.a) || 1, sy: (ctm && ctm.d) || 1 }; svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove", (e) => {
    if (ponteiros.has(e.pointerId)) ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinca && ponteiros.size === 2) { // zoom incremental ancorado no ponto entre os dedos
      const dist = distancia(); if (!dist) return; const f = pinca.lastDist / dist; pinca.lastDist = dist;
      const md = meio(); const m = paraMapa(md.x, md.y);
      const nw = Math.min(8000, Math.max(120, cam.w * f)), nh = nw * (cam.h / cam.w);
      cam.x = m.x - (m.x - cam.x) * (nw / cam.w); cam.y = m.y - (m.y - cam.y) * (nh / cam.h);
      cam.w = nw; cam.h = nh; aplicarView(); return;
    }
    if (movendoToken) { const t = estado.tokens[movendoToken.id]; if (t) { const m = paraMapa(e.clientX, e.clientY); t.x = Math.round(m.x); t.y = Math.round(m.y); movendoToken.moved = true; desenhar(); } return; }
    if (movendoPoi) { const pt = estado.pontos.find((p) => p.id === movendoPoi.id); if (pt) { const m = paraMapa(e.clientX, e.clientY); pt.x = Math.round(m.x); pt.y = Math.round(m.y); movendoPoi.moved = true; desenhar(); } return; }
    if (arrastando) {
      cam.x = arrastando.cx - (e.clientX - arrastando.x) / arrastando.sx;
      cam.y = arrastando.cy - (e.clientY - arrastando.y) / arrastando.sy; aplicarView(); }
  });
  const soltar = (e) => { ponteiros.delete(e.pointerId); if (ponteiros.size < 2) pinca = null;
    if (movendoToken) { if (movendoToken.moved) persistir(); movendoToken = null; } if (movendoPoi) { if (movendoPoi.moved) persistir(); movendoPoi = null; } arrastando = null; };
  svg.addEventListener("pointerup", soltar);
  svg.addEventListener("pointercancel", soltar);

  const setModo = (m) => { modo = m; hint.textContent = m === "add" ? "Clique no mapa para posicionar o ponto" : m === "party" ? "Clique no mapa para mover a tripulação" : "Arraste para mover · role para zoom";
    ov.querySelector("#mp-add")?.classList.toggle("on", m === "add"); ov.querySelector("#mp-party")?.classList.toggle("on", m === "party"); };

  const adicionarPonto = async (m) => {
    const t = POI_TIPOS[tipoNovo];
    const r = await modalForm({ titulo: `${t.ic} Novo ponto — ${t.lbl}`, campos: [
      { k: "nome", label: "Nome", tipo: "texto", placeholder: t.lbl },
      { k: "desc", label: "Descrição (opcional)", tipo: "area", rows: 2 }], okLabel: "Adicionar" });
    setModo(null); if (!r) return;
    const pt = { id: uid(), tipo: tipoNovo, nome: (r.nome || "").trim() || t.lbl, desc: (r.desc || "").trim(), x: Math.round(m.x), y: Math.round(m.y) };
    if (t.area) pt.raio = 70;
    estado.pontos.push(pt); persistir(); desenhar();
  };

  const abrirPop = (id) => {
    const pt = estado.pontos.find((p) => p.id === id); if (!pt) return;
    const t = POI_TIPOS[pt.tipo] || POI_TIPOS.generico;
    pop.style.display = "block";
    pop.innerHTML = `<div class="mp-pop-cab"><span>${t.ic} ${esc(pt.nome)}</span><button class="mp-pop-x">✕</button></div>
      <span class="mp-pop-tipo" style="color:${t.cor}">${esc(t.lbl)}</span>
      <p>${pt.desc ? esc(pt.desc) : "<i>Sem descrição.</i>"}</p>
      ${souMestre ? `<div class="mp-pop-acoes">${t.area ? `<label>raio <input type="range" id="mp-raio" min="20" max="300" value="${pt.raio || 70}"></label>` : ""}
        <button class="mini" id="mp-editar">✎ Editar</button><button class="mini rm" id="mp-del">🗑 Excluir</button></div>` : ""}`;
    pop.querySelector(".mp-pop-x").onclick = () => (pop.style.display = "none");
    if (souMestre) {
      pop.querySelector("#mp-editar").onclick = async () => { const r = await modalForm({ titulo: `✎ Editar ponto`, campos: [
        { k: "nome", label: "Nome", tipo: "texto", valor: pt.nome },
        { k: "desc", label: "Descrição", tipo: "area", rows: 2, valor: pt.desc || "" }], okLabel: "Salvar" });
        if (!r) return; pt.nome = (r.nome || "").trim() || pt.nome; pt.desc = (r.desc || "").trim(); persistir(); desenhar(); abrirPop(id); };
      pop.querySelector("#mp-del").onclick = async () => { if (await confirmModal(`Excluir "${pt.nome}"?`, { okLabel: "Excluir", perigo: true })) { estado.pontos = estado.pontos.filter((p) => p.id !== id); pop.style.display = "none"; persistir(); desenhar(); } };
      const raio = pop.querySelector("#mp-raio"); if (raio) raio.oninput = () => { pt.raio = +raio.value; desenhar(); };
      if (raio) raio.onchange = () => persistir();
    }
  };

  let salvarTimer = null;
  const persistir = () => { clearTimeout(salvarTimer); salvarTimer = setTimeout(() => salvar(estado), 250); };

  // ---- controles do topo ----
  if (souMestre) {
    ov.querySelector("#mp-tipo").onchange = (e) => (tipoNovo = e.target.value);
    ov.querySelector("#mp-add").onclick = () => setModo(modo === "add" ? null : "add");
    ov.querySelector("#mp-party").onclick = () => setModo(modo === "party" ? null : "party");
  }
  const fechar = () => { document.body.style.overflow = ""; window.removeEventListener("resize", onResize); cancelAnimationFrame(animId); clearInterval(relogioInt); ov.remove(); aoFechar?.(); };
  ov.querySelector("#mp-fechar").onclick = fechar;
  ov.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (modo) setModo(null); else fechar(); } });

  desenhar();
  ajustarAspecto();
  animar();                     // planetas passam a orbitar
  const relogioInt = setInterval(atualizarData, 1000);

  // controlador para o realtime atualizar o mapa em tempo real
  return {
    atualizar: (novo, novoCombate) => { const arrastandoAlgo = movendoToken || movendoPoi;
      if (novo) { estado = JSON.parse(JSON.stringify(novo)); if (!Array.isArray(estado.pontos)) estado.pontos = []; if (!estado.tokens || typeof estado.tokens !== "object") estado.tokens = {}; }
      if (novoCombate && Array.isArray(novoCombate.ordem)) cbt = novoCombate;
      if (!arrastandoAlgo && modo !== "party") desenhar(); },
    fechar,
  };
}
