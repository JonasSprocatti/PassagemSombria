// ============================================================
// PASSAGEM SOMBRIA — DECK DE CAMPO ONLINE (SPA vanilla JS)
// Rotas: #/login #/hangar #/ficha/:id #/campanhas #/mesa/:id #/biblioteca
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { RACAS, CLASSES, FILOSOFIAS, IMPLANTES, SCRIPTS, ARMAS, ARMADURAS, PERICIAS, NAVES, ESTACOES, REGRAS_NAVE, RIQUEZA, TEMAS, CONVERTE_2D8, RENOME_PERICIAS } from "./dados-jogo.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const app = document.getElementById("app");
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sign = (n) => (n >= 0 ? `+${n}` : `${n}`);
const d = (f) => 1 + Math.floor(Math.random() * f);
const rollNd = (n, f) => Array.from({ length: n }, () => d(f));
// Dado de vida por grupo racial (Pesado 1d10 · Médio 1d8 · Leve 1d6), OU o valor fixo
// (5/4/3). Devolve as faces, se foi fixo, e o valor rolado/fixo do dado.
const rolaDadoVida = (raca, fixo = false) => {
  const faces = raca?.dadoVida || 8;
  const val = fixo ? (raca?.vidaFixa ?? Math.ceil((faces + 1) / 2)) : d(faces);
  return { faces, fixo, val };
};
// Vida INICIAL (nível 1): 4d6, DESCARTA o menor, soma os 3 maiores + vidaMod da raça.
// Diferente do dado por nível (rolaDadoVida): o nível 1 é sempre este 4d6 tira-menor.
const rolaVidaInicial = (raca) => {
  const ds = rollNd(4, 6);
  const menor = Math.min(...ds);
  const soma3 = ds.reduce((a, b) => a + b, 0) - menor;
  return { ds, menor, soma3, subtotal: soma3 + (raca?.vidaMod || 0) };
};
// Migra perícias de fichas antigas para a nomenclatura unificada v1.4
const migrarPericias = (pe) => {
  const out = { ...(pe || {}) };
  for (const [velho, novo] of Object.entries(RENOME_PERICIAS)) {
    if (out[velho] != null) { out[novo] = (out[novo] || 0) + out[velho]; delete out[velho]; }
  }
  return out;
};
const parseDice = (s) => { const m = /^(\d*)d(\d+)([+-]\d+)?$/i.exec(String(s).trim()); return m ? { n: +(m[1] || 1), f: +m[2], mod: +(m[3] || 0) } : null; };
const comprimirFoto = (file, cb) => {
  const fr = new FileReader();
  fr.onload = () => { const img = new Image();
    img.onload = () => { const c = document.createElement("canvas");
      const max = 420, sc = Math.min(1, max / Math.max(img.width, img.height));
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL("image/jpeg", 0.82)); };
    img.src = fr.result; };
  fr.readAsDataURL(file);
};

let usuario = null, perfil = null;
let canalMesa = null; // realtime da mesa aberta

// Valida a sessão contra o servidor de auth. Se estiver morta (refresh token
// revogado/expirado), limpa o cache podre e força re-login. Devolve o user ou null.
async function sessaoAtiva() {
  const { data: { user } = {}, error } = await sb.auth.getUser();
  if (error || !user) {
    try { await sb.auth.signOut(); } catch (_) {}
    try { Object.keys(localStorage).filter((k) => k.startsWith("sb-")).forEach((k) => localStorage.removeItem(k)); } catch (_) {}
    usuario = null; perfil = null;
    alert("Sua sessão expirou. Faça login novamente para continuar.");
    location.hash = "#/login";
    return null;
  }
  usuario = user;
  return user;
}


// ---------------- FICHA: modelo e cálculos (mesmo formato do Deck de Campo) ----------------
export const novaFichaDados = () => ({
  nivel: 1, foto: null, tema: { ...TEMAS["Vácuo"] },
  raca: "", classe: "", filosofia: "",
  pontosAttr: { For: 0, Des: 0, Con: 0, Int: 0, Sab: 0, Car: 0 },
  modoAttr: "pontos", rolagem: { For: null, Des: null, Con: null, Int: null, Sab: null, Car: null }, rolagemPool: [],
  pvAtual: 0, pvMax: 0, cdExtra: 0, creditos: 100,
  periciasExtra: {}, implantes: [], patrocinados: [],
  deck: [], ramGasta: 0, usos: {}, inventario: [], notas: "",
  metodoNivel: "manual", xp: 0, xpMeta: 1000, marcos: 0, log: [], usarVidaFixa: false,
});

export function calc(f) {
  const r = RACAS.find((x) => x.nome === f.raca), c = CLASSES[f.classe];
  const attr = {};
  ["For", "Des", "Con", "Int", "Sab", "Car"].forEach((a) => {
    attr[a] = (r ? r.attrs[a] : 0) + (f.pontosAttr?.[a] || 0) + (f.modoAttr === "rolagem" && f.rolagem?.[a] != null ? CONVERTE_2D8(f.rolagem[a]) : 0);
  });
  const pontosDireito = Math.max(0, (f.nivel || 1) - 1) + (r?.livre && f.modoAttr !== "rolagem" ? 4 : 0);
  const pontosGastos = Object.values(f.pontosAttr || {}).reduce((s, v) => s + (v || 0), 0);
  const perDireito = Math.max(0, (f.nivel || 1) - 1) + (r?.livre ? 3 : 0);
  const peMig = migrarPericias(f.periciasExtra);
  const perGastas = Object.values(peMig).reduce((s, v) => s + (v || 0), 0);
  const per = {};
  PERICIAS.forEach(([p]) => { per[p] = (c?.pericias[p] || 0) + (peMig[p] || 0); });
  const isCin = !!c?.cinetico;
  const limite = Math.max(1, 2 + (isCin ? attr.Int : attr.Con));
  const limiteOrg = Math.max(1, 2 + attr.Con);
  const carga = isCin ? Math.max(0, (f.implantes?.length || 0) - limiteOrg) : 0;
  const chip = f.implantes?.includes("Chip de Expansão de RAM") ? 2 : 0;
  const impares = [3, 5, 7, 9].filter((n) => n <= f.nivel).length;
  const ramMax = Math.max(0, 1 + attr.Int + Math.floor(per["Tecnomancia"] / 2) + impares + chip - carga);
  const ramLivre = Math.max(0, ramMax - (f.ramGasta || 0));
  const bonusRes = isCin && f.nivel >= 5 ? Math.floor((f.implantes?.length || 0) / 3) : 0;
  const conj = attr.Int + per["Tecnomancia"] + bonusRes;
  const arm = (f.inventario || []).find((i) => i.tipo === "armadura" && i.equip);
  const armRef = arm ? ARMADURAS.find((a) => a.n === arm.nome) : null;
  const t = armRef?.t || "leve";
  const desAdj = t === "pesada" ? 0 : t === "media" ? Math.min(2, attr.Des) : attr.Des;
  const placas = f.implantes?.includes("Placas Subdérmicas de Titânio") ? 1 : 0;
  const cd = 10 + desAdj + (armRef?.cd || 0) + placas + (f.cdExtra || 0);
  const deckMax = Math.max(3, f.nivel + per["Tecnomancia"]);
  const iniBonus = (f.classe === "Batedor" ? 2 : 0) + (f.filosofia === "Código do Sobrevivente" ? 2 : 0);
  const iniciativa = attr.Des + iniBonus;
  const deslocBase = f.raca === "Mercusys" ? 18 : 9;
  const deslocamento = deslocBase + 2 * attr.Des;
  return { attr, per, isCin, limite, limiteOrg, carga, ramMax, ramLivre, conj, cd, armRef, deckMax, pontosDireito, pontosGastos, perDireito, perGastas, iniciativa, iniBonus, deslocBase, deslocamento };
}

// O que se ganha ao subir para o nível n (para o preview e o registro)
export function ganhosDoNivel(n, f) {
  const c = CLASSES[f.classe], r = RACAS.find((x) => x.nome === f.raca);
  const g = ["+1 Ponto de Atributo (teto natural +6)", "Vida: role 1d" + (r?.dadoVida || 6) + " (ou pegue a média fixa " + (r?.vidaFixa || 3) + ") + Con", "+1 Ponto de Perícia"];
  if ([3, 5, 7, 9].includes(n)) g.push("+1 Slot de RAM (nível ímpar)");
  if (n === 5) { g.push("Teto de perícias sobe para +7"); if (c) g.push(`★ Especialização Veterana — ${c.vet.n}: ${c.vet.d}`); }
  if (n === 10 && r?.lendaria) g.push(`★★ Lendária da raça — ${r.lendaria.n}: ${r.lendaria.d}`);
  return g;
}

// ---------------- FICHA IMPRIMÍVEL (PDF / download) ----------------
// Gera um documento HTML autossuficiente, tema claro (economiza tinta), pronto p/ impressão.
function gerarFichaHTML(nome, f, k) {
  const raca = RACAS.find((r) => r.nome === f.raca), classe = CLASSES[f.classe];
  const filo = f.filosofia ? FILOSOFIAS[f.filosofia] : null;
  const ATTRS = ["For", "Des", "Con", "Int", "Sab", "Car"];
  const attrCard = (a) => `<div class="a"><span class="an">${a}</span><span class="av">${sign(k.attr[a])}</span></div>`;
  const perLinha = (pn, at) => { const tot = (k.attr[at] || 0) + (k.per[pn] || 0); const tr = (k.per[pn] || 0) > 0; return `<tr class="${tr ? "tr" : ""}"><td>${tr ? "▣" : "☐"}</td><td>${esc(pn)}</td><td class="dim">${at}</td><td class="tot">${sign(tot)}</td></tr>`; };
  const half = Math.ceil(PERICIAS.length / 2);
  const perTab = (lista) => `<table class="per"><thead><tr><th></th><th>Perícia</th><th>Atr</th><th>Tot</th></tr></thead><tbody>${lista.map(([pn, at]) => perLinha(pn, at)).join("")}</tbody></table>`;
  const habs = [];
  if (raca) raca.habilidades.forEach((h) => habs.push([`${raca.nome} — ${h.n}`, h.d]));
  if (raca?.lendaria && f.nivel >= 10) habs.push([`★★ Lendária — ${raca.lendaria.n}`, raca.lendaria.d]);
  if (classe) classe.hab.forEach((h) => habs.push([`${f.classe} (${h.tipo}) — ${h.n}`, h.d]));
  if (classe && f.nivel >= 5) habs.push([`★ Veterana — ${classe.vet.n}`, classe.vet.d]);
  if (filo) habs.push([`Filosofia — ${f.filosofia}`, filo.d]);
  const implantes = (f.implantes || []).map((nm) => { const im = Object.values(IMPLANTES).find((x) => x.n === nm); return im ? `<li><b>${esc(im.n)}</b> <span class="dim">(${esc(im.g)})</span> — ${esc(im.e)}</li>` : `<li>${esc(nm)}</li>`; }).join("");
  const deck = (f.deck || []).map((nm) => { const s = SCRIPTS.find((x) => x.n === nm); return s ? `<li><b>${esc(s.n)}</b> <span class="dim">${s.c}◈ · ${esc(s.a)}</span> — ${esc(s.d)}</li>` : `<li>${esc(nm)}</li>`; }).join("");
  const inv = (f.inventario || []).map((it) => `<li>${it.equip ? "▣ " : ""}<b>${esc(it.nome)}</b> <span class="dim">(${esc(it.tipo)}${it.qtd > 1 ? ` ×${it.qtd}` : ""})</span></li>`).join("");
  const css = `*{box-sizing:border-box}body{font-family:'Segoe UI',system-ui,sans-serif;color:#15181f;margin:0;padding:26px;background:#fff;font-size:12px;line-height:1.4}
  h1{font-size:22px;margin:0 0 2px;letter-spacing:.02em}h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#7a4bd0;border-bottom:1.5px solid #d9c9f5;padding-bottom:3px;margin:16px 0 8px}
  .sub{color:#555;margin:0 0 10px;font-size:13px}.top{display:flex;gap:16px;align-items:flex-start}.retr{width:96px;height:96px;border:2px solid #cbb6ef;border-radius:10px;object-fit:cover;flex:0 0 auto}
  .grid6{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}.a{border:1.5px solid #d9c9f5;border-radius:8px;text-align:center;padding:7px 2px}.an{display:block;font-size:10px;color:#777;text-transform:uppercase}.av{display:block;font-size:20px;font-weight:700;color:#111}
  .vit{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px}.vit div{border:1px solid #e0e0e0;border-radius:6px;padding:6px 8px}.vit b{display:block;font-size:16px}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}.per{width:100%;border-collapse:collapse}.per th{text-align:left;font-size:9px;color:#999;text-transform:uppercase;padding:2px 4px}.per td{padding:2px 4px;border-bottom:1px solid #eee}.per .tot{text-align:right;font-weight:700}.per .tr{background:#faf6ff}.dim{color:#999}
  ul{margin:4px 0;padding-left:16px}li{margin:3px 0}.hab b{color:#0e7a68}.notas{white-space:pre-wrap;border:1px solid #e0e0e0;border-radius:6px;padding:8px;min-height:40px}
  @page{margin:14mm}@media print{body{padding:0}h2{break-after:avoid}li,tr,.a{break-inside:avoid}}`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Ficha — ${esc(nome || "Personagem")}</title><style>${css}</style></head><body>
  <div class="top">${f.foto ? `<img class="retr" src="${f.foto}"/>` : ""}<div>
    <h1>${esc(nome || "Sem nome")}</h1>
    <p class="sub">${[raca ? `${raca.nome} (${raca.planeta})` : "", f.classe, f.filosofia].filter(Boolean).join(" · ")} — Nível ${f.nivel}</p>
    <div class="grid6">${ATTRS.map(attrCard).join("")}</div>
    <div class="vit">
      <div><span class="dim">Pontos de Vida</span><b>${f.pvAtual || 0} / ${f.pvMax || 0}</b></div>
      <div><span class="dim">Defesa (CD)</span><b>${k.cd}</b></div>
      <div><span class="dim">RAM</span><b>${k.ramLivre} / ${k.ramMax}</b></div>
      <div><span class="dim">Iniciativa</span><b>${sign(k.iniciativa)}</b></div>
      <div><span class="dim">Deslocamento</span><b>${k.deslocamento} m</b></div>
      <div><span class="dim">Créditos</span><b>${f.creditos ?? 0} CG</b></div>
    </div>
  </div></div>
  <h2>Perícias</h2><div class="cols">${perTab(PERICIAS.slice(0, half))}${perTab(PERICIAS.slice(half))}</div>
  ${habs.length ? `<h2>Habilidades</h2><ul class="hab">${habs.map(([n, d]) => `<li><b>${esc(n)}:</b> ${esc(d)}</li>`).join("")}</ul>` : ""}
  ${implantes ? `<h2>Implantes</h2><ul>${implantes}</ul>` : ""}
  ${deck ? `<h2>Deck de Scripts (${f.deck.length}/${k.deckMax})</h2><ul>${deck}</ul>` : ""}
  ${inv ? `<h2>Inventário</h2><ul>${inv}</ul>` : ""}
  <h2>Anotações</h2><div class="notas">${esc(f.notas || "")}</div>
  </body></html>`;
}
function imprimirFichaHTML(html) {
  const ifr = document.createElement("iframe");
  ifr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(ifr);
  const doc = ifr.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => { try { ifr.contentWindow.focus(); ifr.contentWindow.print(); } catch (_) {} setTimeout(() => ifr.remove(), 1500); }, 350);
}
function baixarFichaHTML(html, nome) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `Ficha - ${(nome || "personagem").replace(/[^\w\s-]/g, "").trim() || "personagem"}.html`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------------- DESCANSOS (catálogo de usos + recuperação) ----------------
// Detecta a frequência de descanso de uma habilidade: usa o campo freq quando existe,
// senão procura "Descanso Curto/Longo" no texto.
function freqDescanso(h) {
  if (!h) return null;
  if (h.freq === "curto" || h.freq === "longo") return h.freq;
  const txt = `${h.n || ""} ${h.d || ""}`;
  if (/descanso\s+curto/i.test(txt)) return "curto";
  if (/descanso\s+longo/i.test(txt)) return "longo";
  return null;
}
// Cataloga todas as habilidades do personagem que são "1x por descanso" (curto ou longo),
// respeitando os bloqueios de nível (Veterana NV5, Lendária NV10).
function abilidadesDeDescanso(f) {
  const out = [];
  const raca = RACAS.find((r) => r.nome === f.raca), classe = CLASSES[f.classe];
  const filo = f.filosofia ? FILOSOFIAS[f.filosofia] : null;
  if (classe) classe.hab.forEach((h, i) => { const fr = freqDescanso(h); if (fr) out.push({ id: `cl${i}`, nome: h.n, origem: f.classe, freq: fr }); });
  if (classe && f.nivel >= 5) { const fr = freqDescanso(classe.vet); if (fr) out.push({ id: "vet", nome: classe.vet.n, origem: `${f.classe} · Veterana`, freq: fr }); }
  if (filo) { const fr = freqDescanso(filo); if (fr) out.push({ id: "filo", nome: f.filosofia, origem: "Filosofia", freq: fr }); }
  if (raca) (raca.habilidades || []).forEach((h, i) => { const fr = freqDescanso(h); if (fr) out.push({ id: `ra${i}`, nome: h.n, origem: raca.nome, freq: fr }); });
  if (raca?.lendaria && f.nivel >= 10) { const fr = freqDescanso(raca.lendaria) || "longo"; out.push({ id: "lend", nome: raca.lendaria.n, origem: `${raca.nome} · Lendária`, freq: fr }); }
  return out;
}
// Aplica um descanso à ficha (muta f) e devolve um resumo do que foi recuperado.
// Curto: reinicia habilidades "curto"; regen racial (Mercusys +1d4). PV normal via Kits.
// Longo: PV cheio, RAM cheia, reinicia TODAS as habilidades (curto + longo).
function aplicarDescanso(f, tipo) {
  const cat = abilidadesDeDescanso(f);
  f.usos = f.usos || {};
  const notas = [];
  let pvRec = 0, ramRec = 0, habsReset = 0;
  if (tipo === "longo") {
    pvRec = Math.max(0, (f.pvMax || 0) - (f.pvAtual || 0));
    f.pvAtual = f.pvMax || 0;
    ramRec = f.ramGasta || 0; f.ramGasta = 0;
    cat.forEach((a) => { if (f.usos[a.id]) { delete f.usos[a.id]; habsReset++; } });
    notas.push(pvRec ? `+${pvRec} PV (cheio)` : "PV já cheio", ramRec ? `RAM recarregada (+${ramRec})` : "RAM já cheia", `${cat.length} habilidade(s) reiniciada(s)`);
  } else {
    cat.filter((a) => a.freq === "curto").forEach((a) => { if (f.usos[a.id]) { delete f.usos[a.id]; habsReset++; } });
    const nCurto = cat.filter((a) => a.freq === "curto").length;
    notas.push(`${nCurto} habilidade(s) de descanso curto reiniciada(s)`);
    if (f.raca === "Mercusys") { const cura = d(4); pvRec = Math.min(cura, Math.max(0, (f.pvMax || 0) - (f.pvAtual || 0))); f.pvAtual = Math.min(f.pvMax || 0, (f.pvAtual || 0) + cura); notas.push(`regeneração Mercusys +${cura} PV`); }
    else notas.push("PV: use Kits Médicos");
  }
  return { tipo, pvRec, ramRec, habsReset, cat, notas };
}


function aplicarTema(f) {
  const t = f?.tema || TEMAS["Vácuo"];
  document.documentElement.style.setProperty("--tech", t.tech);
  document.documentElement.style.setProperty("--chrome", t.chrome);
  document.documentElement.style.setProperty("--sombra", t.sombra);
}

// ---------------- ROTEADOR ----------------
window.addEventListener("hashchange", rotear);
async function rotear() {
  if (canalMesa) { sb.removeChannel(canalMesa); canalMesa = null; }
  const [_, rota, arg] = location.hash.split("/");
  if (!usuario && rota !== "biblioteca") return telaLogin();
  switch (rota) {
    case "hangar": return telaHangar();
    case "ficha": return telaFicha(arg);
    case "campanhas": return telaCampanhas();
    case "mesa": return telaMesa(arg);
    case "biblioteca": return telaBiblioteca(arg);
    default: location.hash = usuario ? "#/hangar" : "#/login";
  }
}

function shell(titulo, corpo, ativo = "") {
  const nav = usuario ? `
    <nav class="menu">
      <a href="#/hangar" class="brand" title="Passagem Sombria"><img src="logo.svg" alt="Passagem Sombria" class="brand-logo"/><span class="brand-txt">PASSAGEM<b>SOMBRIA</b></span></a>
      <a href="#/hangar" class="${ativo === "hangar" ? "on" : ""}">◈ Hangar</a>
      <a href="#/campanhas" class="${ativo === "campanhas" ? "on" : ""}">☄ Campanhas</a>
      <a href="#/biblioteca" class="${ativo === "biblioteca" ? "on" : ""}">📖 Biblioteca</a>
      <span class="menu-user">${esc(perfil?.apelido || "")}</span>
      <button id="sair" class="btn-ghost">SAIR</button>
    </nav>` : "";
  app.innerHTML = `<div class="frame">${nav}${corpo}</div>`;
  $("#sair")?.addEventListener("click", async () => { await sb.auth.signOut(); location.hash = "#/login"; });
}

// ---------------- AUTH ----------------
async function iniciar() {
  const { data: { session } } = await sb.auth.getSession();
  usuario = session?.user || null;
  if (usuario) { const { data } = await sb.from("perfis").select("*").eq("id", usuario.id).single(); perfil = data; }
  sb.auth.onAuthStateChange(async (_ev, s) => {
    const antes = !!usuario; usuario = s?.user || null;
    if (usuario) { const { data } = await sb.from("perfis").select("*").eq("id", usuario.id).single(); perfil = data; }
    if (!!usuario !== antes) location.hash = usuario ? "#/hangar" : "#/login";
  });
  if (!location.hash) location.hash = usuario ? "#/hangar" : "#/login";
  rotear();
}

function telaLogin() {
  shell("login", `
    <header class="masthead login-mast">
      <img src="logo.svg" alt="Passagem Sombria" class="login-logo"/>
      <div class="mast-eyebrow">CONFEDERAÇÃO SOLAR · TERMINAL DE ACESSO</div>
      <h1>PASSAGEM<span> SOMBRIA</span></h1>
      <div class="mast-sub">Deck de Campo Online — fichas, campanhas e mesa em tempo real</div>
    </header>
    <section class="sec login-box">
      <button id="google" class="btn-primario">ENTRAR COM GOOGLE</button>
      <div class="ou">ou receba um link mágico por e-mail</div>
      <div class="linha-email"><input id="email" type="email" placeholder="voce@estacao.orbital"/>
      <button id="magic" class="btn-ghost">ENVIAR LINK</button></div>
      <p class="regra">Ao entrar, um perfil de tripulante é criado automaticamente. <a href="#/biblioteca">Explorar a Biblioteca sem login →</a></p>
    </section>`);
  $("#google").onclick = () => sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin } });
  $("#magic").onclick = async () => {
    const email = $("#email").value.trim(); if (!email) return;
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } });
    alert(error ? error.message : "Link enviado! Confira o e-mail.");
  };
}

// ---------------- HANGAR ----------------
async function telaHangar() {
  const { data: pers } = await sb.from("personagens").select("id,nome,dados,campanha_id").eq("dono_id", usuario.id).order("atualizado_em", { ascending: false });
  const cards = (pers || []).map((p) => {
    const f = p.dados || {}, k = calc({ ...novaFichaDados(), ...f });
    return `<article class="card" data-id="${p.id}">
      <div class="card-top"><span class="card-nivel">NV ${f.nivel || 1}</span><button class="card-del" data-del="${p.id}">✕</button></div>
      <div class="card-id">${f.foto ? `<img class="card-foto" src="${f.foto}"/>` : `<div class="card-foto vazia">◈</div>`}<h3>${esc(p.nome) || "— sem nome —"}</h3></div>
      <div class="card-linha">${esc(f.raca || "raça?")} · ${esc(f.classe || "classe?")}${p.campanha_id ? " · ☄ em campanha" : ""}</div>
      <div class="card-stats"><span>PV ${f.pvAtual || 0}/${f.pvMax || 0}</span><span>CD ${k.cd}</span><span class="tech-c">RAM ${k.ramLivre}/${k.ramMax}</span></div>
    </article>`; }).join("");
  shell("hangar", `
    <header class="masthead"><div class="mast-eyebrow">ARQUIVO DE PESSOAL · ${esc(perfil?.apelido || "")}</div>
      <h1>HANGAR<span> DE TRIPULANTES</span></h1></header>
    <div class="grid-fichas">${cards || `<div class="vazio"><p class="vazio-t">Nenhum tripulante registrado.</p></div>`}</div>
    <button id="novo" class="btn-novo">+ REGISTRAR NOVO TRIPULANTE</button>`, "hangar");
  $("#novo").onclick = async () => {
    const u = await sessaoAtiva(); if (!u) return;
    const { data, error } = await sb.from("personagens").insert({ dono_id: u.id, nome: "", dados: novaFichaDados() }).select("id").single();
    if (error) return alert(error.message);
    location.hash = `#/ficha/${data.id}`;
  };
  app.querySelectorAll(".card").forEach((c) => c.onclick = (e) => { if (!e.target.dataset.del) location.hash = `#/ficha/${c.dataset.id}`; });
  app.querySelectorAll("[data-del]").forEach((b) => b.onclick = async (e) => {
    e.stopPropagation();
    if (confirm("Apagar este tripulante?")) { await sb.from("personagens").delete().eq("id", b.dataset.del); telaHangar(); }
  });
}

// ---------------- FICHA (edição completa + level up + registro) ----------------
async function telaFicha(id) {
  const { data: p } = await sb.from("personagens").select("*").eq("id", id).single();
  if (!p) return (location.hash = "#/hangar");
  let f = { ...novaFichaDados(), ...(p.dados || {}) };
  f.rolagem = { ...novaFichaDados().rolagem, ...(f.rolagem || {}) };
  f.periciasExtra = migrarPericias(f.periciasExtra);
  aplicarTema(f);
  const registrar = (texto) => { f.log = [{ q: new Date().toISOString(), t: texto }, ...(f.log || [])].slice(0, 60); };
  const salvar = async () => {
    await sb.from("personagens").update({ nome: f.nomeVisivel ?? p.nome, dados: f, atualizado_em: new Date().toISOString() }).eq("id", id);
  };
  const render = () => {
    const k = calc(f);
    const raca = RACAS.find((r) => r.nome === f.raca), classe = CLASSES[f.classe];
    const sobra = k.pontosDireito - k.pontosGastos, sobraPer = k.perDireito - k.perGastas;
    const usados = ["For","Des","Con","Int","Sab","Car"].map((a) => f.rolagem[a]).filter((v) => v !== null);
    const pool = [...(f.rolagemPool || [])];
    usados.forEach((v) => { const i = pool.indexOf(v); if (i >= 0) pool.splice(i, 1); });
    const ganhos = ganhosDoNivel(f.nivel + 1, f);
    shell("ficha", `
      <nav class="topo"><a class="btn-ghost" href="#/hangar">← HANGAR</a><div class="topo-status" id="st"></div><button id="imprimir" class="btn-ghost" title="Abre o diálogo de impressão — escolha 'Salvar como PDF'">🖨 PDF</button><button id="baixar" class="btn-ghost" title="Baixa a ficha como arquivo .html">💾 .html</button><button id="salvar" class="btn-primario">SALVAR</button></nav>

      <section class="sec">
        <header><span class="tag">ID</span><h2>Identidade</h2></header>
        <div class="id-topo">
          <div class="retrato">
            ${f.foto ? `<img src="${f.foto}" alt="Retrato do personagem"/>` : `<div class="retrato-vazio"><span>◈</span><small>sem holograma</small></div>`}
            <div class="retrato-btns">
              <label class="btn-foto">${f.foto ? "TROCAR" : "+ FOTO"}<input id="foto-in" type="file" accept="image/*" hidden/></label>
              ${f.foto ? `<button id="foto-rm" class="btn-foto rm">✕</button>` : ""}
            </div>
          </div>
          <div class="id-campos">
        <div class="linha-3">
          <label>Nome<input id="nome" value="${esc(p.nome)}"/></label>
          <label>Raça<select id="raca"><option value="">—</option>${RACAS.map((r) => `<option ${f.raca === r.nome ? "selected" : ""}>${r.nome}</option>`).join("")}</select></label>
          <label>Classe<select id="classe"><option value="">—</option>${Object.keys(CLASSES).map((n) => `<option ${f.classe === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        </div>
        <div class="linha-3">
          <label>Filosofia<select id="filosofia"><option value="">—</option>${Object.keys(FILOSOFIAS).map((n) => `<option ${f.filosofia === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>
          <label>Créditos<input id="creditos" type="number" value="${f.creditos}"/></label>
          <label>Nível (atual)<input value="${f.nivel}" disabled title="Suba de nível na seção Progressão"/></label>
        </div>
          </div>
        </div>
        ${raca ? `<details class="det grande" open><summary>🧬 <b>${esc(raca.nome)}</b> (${raca.planeta}) — ${esc(raca.titulo)}</summary>
          <p>${esc(raca.lore)}</p>
          <p class="regra">Vida inicial (nível 1): 4d6 descarta o menor ${sign(raca.vidaMod)} + Con · Vida por nível: 1d${raca.dadoVida} (ou fixo ${raca.vidaFixa}) + Con · ${["For","Des","Con","Int","Sab","Car"].map((a) => `${a} ${sign(raca.attrs[a])}`).join(" · ")}${raca.livre ? " · +4 pontos livres (máx. +2 cada) e +3 perícias" : ""}</p>
          ${raca.habilidades.map((h) => `<p><b class="tech-c">${esc(h.n)}:</b> ${esc(h.d)}</p>`).join("")}
          ${raca.lendaria ? `<p class="sombra-c"><b>★★ Lendária (NV10) — ${esc(raca.lendaria.n)}:</b> ${esc(raca.lendaria.d)}${f.nivel < 10 ? " <i>(bloqueada até o nível 10)</i>" : " ✓ DESBLOQUEADA"}</p>` : ""}</details>` : ""}
        ${classe ? `<details class="det grande" open><summary>⚙ <b>${esc(f.classe)}</b> — Vida base +${classe.pv}${k.isCin ? " · usa Int no Limite Cibernético" : ""}</summary>
          <p class="regra">Perícias de classe: ${Object.entries(classe.pericias).map(([pn, v]) => `${pn} +${v}`).join(", ")}</p>
          ${classe.hab.map((h) => `<p><b class="tech-c">${h.tipo} — ${esc(h.n)}:</b> ${esc(h.d)}</p>`).join("")}
          <p><b class="chrome">★ Veterana (NV5) — ${esc(classe.vet.n)}:</b> ${esc(classe.vet.d)}${f.nivel < 5 ? " <i>(bloqueada até o nível 5)</i>" : " ✓ DESBLOQUEADA"}</p></details>` : ""}
        ${f.filosofia ? `<details class="det" open><summary>☯ <b>${esc(f.filosofia)}</b></summary><p>${esc(FILOSOFIAS[f.filosofia].d)}</p></details>` : ""}
      </section>

      <section class="sec"><header><span class="tag">Δ</span><h2>Atributos & Vitais</h2>
        <span class="extra">${f.modoAttr === "rolagem" ? "modo rolagem" : `${sobra} ponto${sobra === 1 ? "" : "s"} de nível ${sobra >= 0 ? "livre" + (sobra === 1 ? "" : "s") : "⚠ EXCEDIDO"}`}</span></header>
        <div class="filtros">
          <a href="javascript:void 0" id="modo-pontos" class="${f.modoAttr !== "rolagem" ? "on" : ""}">Por pontos</a>
          <a href="javascript:void 0" id="modo-rolagem" class="${f.modoAttr === "rolagem" ? "on" : ""}">Por rolagem</a>
          ${f.modoAttr === "rolagem" ? `<a href="javascript:void 0" id="rolar-pool" class="on" style="color:var(--chrome);border-color:var(--chrome)">🎲 ROLAR A ORIGEM (2d8×7)</a>` : ""}
        </div>
        ${f.modoAttr === "rolagem" && f.rolagemPool.length ? `<p class="regra">Somas de Origem disponíveis: ${pool.length ? pool.map((v) => `<b class="chrome">${v}</b>`).join(" · ") : "<i>todas distribuídas</i>"} — escolha uma soma em cada atributo abaixo. Regra: 2d8 sete vezes, descarta a pior soma; a conversão em modificador (2–4=−1 · 5–10=+0 · 11–15=+1 · 16=+2) aparece ao lado ao distribuir. Raça e pontos de nível (caixinha) somam por cima. Teto natural +6.</p>` : ""}
        <div class="grid-attr">${["For","Des","Con","Int","Sab","Car"].map((a) => `
          <div class="attr ${k.attr[a] > 6 ? "warn" : ""}"><span class="attr-nome">${a}</span><span class="attr-total">${sign(k.attr[a])}</span>
          <span class="regra" style="margin:0">racial ${sign(raca ? raca.attrs[a] : 0)}</span>
          ${f.modoAttr === "rolagem" ? `<select class="sel-pool" data-a="${a}"><option value="">rolado —</option>
            ${[...new Set([...pool, ...(f.rolagem[a] !== null ? [f.rolagem[a]] : [])])].sort((x, y) => y - x).map((v) => `<option value="${v}" ${f.rolagem[a] === v ? "selected" : ""}>${v} → ${sign(CONVERTE_2D8(v))}</option>`).join("")}</select>
            ${f.rolagem[a] !== null ? `<span class="regra" style="margin:0">rolou ${f.rolagem[a]} → <b class="chrome">${sign(CONVERTE_2D8(f.rolagem[a]))}</b></span>` : ""}` : ""}
          <span class="regra" style="margin:6px 0 0;display:block;font-size:9px">pontos de nível (+1/nível a partir do NV2)</span>
          <input class="pt-attr" data-a="${a}" type="number" min="0" max="${(f.pontosAttr[a] || 0) + Math.max(0, sobra)}" value="${f.pontosAttr[a] || 0}" ${sobra <= 0 && !(f.pontosAttr[a] > 0) ? "disabled" : ""} title="Distribua aqui os pontos de atributo ganhos ao subir de nível (+1 por nível, a partir do nível 2). Sem pontos livres, o campo trava."/></div>`).join("")}</div>
        <div class="linha-4" style="margin-top:12px">
          <label>PV atual<input id="pvAtual" type="number" value="${f.pvAtual}"/></label>
          <label>PV máx<input id="pvMax" type="number" value="${f.pvMax}"/></label>
          <label>Defesa (auto)<input value="${k.cd}" disabled/></label>
          <label>RAM<input value="${k.ramLivre}/${k.ramMax}" disabled/></label>
        </div>
        <p class="regra">⏱️ Iniciativa <b class="chrome">${sign(k.iniciativa)}</b> (Des ${sign(k.attr.Des)}${k.iniBonus ? ` +${k.iniBonus} bônus de classe/filosofia` : ""}) · 🏃 Deslocamento <b class="chrome">${k.deslocamento}m</b> (base ${k.deslocBase} + 2m×Des${k.deslocBase === 18 ? ", ×2 Mercusys" : ""})</p>
        ${classe && raca && f.pvMax === 0 ? `<button id="pv-inicial" class="mini eq">🎲 ROLAR PV DO NÍVEL 1 (4d6 tira o menor ${sign(raca.vidaMod)} raça ${sign(k.attr.Con)} Con +${classe.pv} classe)</button>` : ""}
        <p class="regra">Limite Cibernético: ${f.implantes.length}/${k.limite} · Patrimônio ref. NV${f.nivel}: ${RIQUEZA[f.nivel]} CG · Deck: ${f.deck.length}/${k.deckMax}${k.attr && ["For","Des","Con","Int","Sab","Car"].some((a) => k.attr[a] > 6) ? " · ⚠ atributo acima do teto +6" : ""}</p>
      </section>

      <section class="sec"><header><span class="tag">☾</span><h2>Descansos & Habilidades por Descanso</h2>
        <span class="extra">${(() => { const c = abilidadesDeDescanso(f); const usadas = c.filter((a) => f.usos?.[a.id]).length; return `${usadas}/${c.length} usada${usadas === 1 ? "" : "s"}`; })()}</span></header>
        <div class="filtros">
          <button id="desc-curto" class="mini">☾ Descanso Curto</button>
          <button id="desc-longo" class="mini eq">🌙 Descanso Longo</button>
        </div>
        <p class="regra">Curto (1h): reinicia habilidades "1×/descanso curto"${f.raca === "Mercusys" ? " · Mercusys regenera +1d4 PV" : " · cura via Kits Médicos"}. Longo (8h): PV cheio, RAM recarregada, reinicia todas as habilidades. Na mesa, o Mestre pode convocar um descanso pra todos de uma vez.</p>
        ${(() => { const cat = abilidadesDeDescanso(f); if (!cat.length) return `<p class="regra"><i>Nenhuma habilidade limitada por descanso — escolha raça, classe e filosofia para catalogar.</i></p>`;
          return `<div class="usos-lista">${cat.map((a) => { const usada = !!f.usos?.[a.id]; return `<label class="chk uso-item ${usada ? "usado" : ""}"><input type="checkbox" class="ck-uso" data-uso="${a.id}" ${usada ? "checked" : ""}/> <b>${esc(a.nome)}</b> <small>${esc(a.origem)} · 1×/desc. ${a.freq === "curto" ? "curto ☾" : "longo 🌙"}</small> <span class="uso-tag">${usada ? "USADA" : "disponível"}</span></label>`; }).join("")}</div>`; })()}
      </section>

      <section class="sec"><header><span class="tag">▲</span><h2>Progressão & Level Up</h2>
        <span class="extra">nível ${f.nivel} · ${f.nivel === 1 ? "Recruta" : f.nivel <= 8 ? "Veterano" : "Lenda"}</span></header>
        <div class="linha-3">
          <label>Método<select id="metodo">
            <option value="manual" ${f.metodoNivel === "manual" ? "selected" : ""}>Manual (o Mestre manda)</option>
            <option value="xp" ${f.metodoNivel === "xp" ? "selected" : ""}>Por XP</option>
            <option value="marcos" ${f.metodoNivel === "marcos" ? "selected" : ""}>Por marcos da história</option>
          </select></label>
          ${f.metodoNivel === "xp" ? `
            <label>XP atual<input id="xp" type="number" value="${f.xp}"/></label>
            <label>XP para subir<input id="xpMeta" type="number" value="${f.xpMeta}"/></label>` : ""}
          ${f.metodoNivel === "marcos" ? `
            <label>Marcos concluídos<input id="marcos" type="number" value="${f.marcos}"/></label>
            <label>&nbsp;<button id="add-marco" class="mini eq">+1 MARCO ALCANÇADO</button></label>` : ""}
        </div>
        ${f.metodoNivel === "xp" ? `<div class="barra" style="margin-bottom:10px"><span>Progresso: ${f.xp}/${f.xpMeta} XP ${f.xp >= f.xpMeta ? "— PRONTO PARA SUBIR!" : ""}</span><div><i style="width:${Math.min(100, (100 * f.xp / Math.max(1, f.xpMeta)) | 0)}%;background:var(--tech)"></i></div></div>` : ""}
        ${f.nivel < 10 ? `
        <details class="det"><summary>O que você ganha no nível ${f.nivel + 1}</summary>${ganhos.map((g) => `<p>· ${esc(g)}</p>`).join("")}</details>
        <label class="chk" style="margin:6px 0"><input type="checkbox" id="vida-fixa" ${f.usarVidaFixa ? "checked" : ""}/> Usar média fixa da vida ao subir de nível${raca ? ` (${raca.vidaFixa} + Con, sem rolar)` : ""}</label>
        <button id="levelup" class="btn-primario" ${f.metodoNivel === "xp" && f.xp < f.xpMeta ? "disabled title='XP insuficiente'" : ""}>▲ SUBIR PARA O NÍVEL ${f.nivel + 1}</button>
        <span class="regra" style="margin-left:10px">${f.usarVidaFixa ? `soma a média fixa${raca ? ` (${raca.vidaFixa})` : ""}` : `rola 1d${raca ? raca.dadoVida : "?"}`} + Con, aplica os ganhos e registra abaixo</span>` : `<p class="regra">★★ Nível máximo alcançado — uma Lenda do sistema.</p>`}
      </section>

      <section class="sec"><header><span class="tag">%</span><h2>Perícias</h2>
        <span class="extra">${sobraPer} pt${sobraPer === 1 ? "" : "s"} livre${sobraPer === 1 ? "" : "s"} · teto ${f.nivel >= 5 ? "+7" : "+5"}</span></header>
        <div class="grid-per">${PERICIAS.map(([pn, at]) => `
          <div class="per ${k.per[pn] > 0 ? "ativa" : ""}"><span class="per-n">${pn} <i>(${at})</i></span>
          <span class="per-ctl"><input class="pt-per" data-p="${pn}" type="number" min="0" max="${Math.max(0, Math.min((f.periciasExtra[pn] || 0) + Math.max(0, sobraPer), (f.nivel >= 5 ? 7 : 5) - ((k.per[pn] || 0) - (f.periciasExtra[pn] || 0))))}" value="${f.periciasExtra[pn] || 0}" ${sobraPer <= 0 && !(f.periciasExtra[pn] > 0) ? "disabled" : ""} title="Pontos de perícia ganhos ao subir de nível (1/nível). Teto por perícia: +${f.nivel >= 5 ? 7 : 5}."/><b class="tech-c">${sign(k.per[pn])}</b></span></div>`).join("")}</div>
      </section>

      <section class="sec"><header><span class="tag">⧉</span><h2>Implantes & Deck & Inventário</h2></header>
        <div class="colunas">
          <div><h4>Implantes (${f.implantes.length}/${k.limite})</h4>${IMPLANTES.map((i) => `
            <label class="chk"><input type="checkbox" class="ck-impl" data-n="${esc(i.n)}" ${f.implantes.includes(i.n) ? "checked" : ""}/> ${esc(i.n)} <small>${esc(i.e)}</small></label>`).join("")}</div>
          <div><h4>Deck de Scripts (${f.deck.length}/${k.deckMax})</h4>${SCRIPTS.map((s) => `
            <label class="chk" title="${esc(s.d)}"><input type="checkbox" class="ck-scr" data-n="${esc(s.n)}" ${f.deck.includes(s.n) ? "checked" : ""}/> ${esc(s.n)} <small>${s.c}◈ ${esc(s.a)}</small></label>`).join("")}</div>
          <div><h4>Inventário</h4>
            <div class="linha-add"><select id="add-tipo"><option value="arma">Arma</option><option value="armadura">Armadura</option></select>
            <select id="add-sel"></select><button id="add-btn" class="btn-ghost">+</button></div>
            <div id="inv">${f.inventario.map((it, ix) => `
              <div class="inv"><span>${esc(it.nome)}</span>
              <span>${it.tipo !== "item" ? `<button class="mini eq ${it.equip ? "on" : ""}" data-eq="${ix}">${it.equip ? "EQUIPADO" : "equipar"}</button>` : ""}
              <button class="mini rm" data-rm="${ix}">✕</button></span></div>`).join("")}</div></div>
        </div>
      </section>

      <section class="sec"><header><span class="tag">◧</span><h2>Tema</h2></header>
        <div class="temas">${Object.entries(TEMAS).map(([n, t]) => `<button class="tema-btn" data-tema="${n}">
          <span class="tema-sw"><i style="background:${t.tech}"></i><i style="background:${t.chrome}"></i><i style="background:${t.sombra}"></i></span>${n}</button>`).join("")}</div>
      </section>

      <section class="sec"><header><span class="tag">✎</span><h2>Registro da Ficha</h2>
        <span class="extra">${(f.log || []).length} evento${(f.log || []).length === 1 ? "" : "s"}</span></header>
        ${(f.log || []).length ? (f.log || []).map((e) => `<div class="det"><span class="regra" style="margin:0">${new Date(e.q).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span><p style="margin:4px 0 0">${esc(e.t)}</p></div>`).join("") : `<p class="regra">Rolagens de atributo e level ups aparecem aqui, gravados na ficha.</p>`}
      </section>`);

    // ---- binds ----
    $("#salvar").onclick = async () => { $("#st").textContent = "Transmitindo…"; await salvar(); $("#st").textContent = "Salvo ✓"; };
    $("#imprimir").onclick = () => { const nome = $("#nome")?.value || p.nome; imprimirFichaHTML(gerarFichaHTML(nome, f, calc(f))); };
    $("#baixar").onclick = () => { const nome = $("#nome")?.value || p.nome; baixarFichaHTML(gerarFichaHTML(nome, f, calc(f)), nome); };
    $("#desc-curto")?.addEventListener("click", async () => { const r = aplicarDescanso(f, "curto"); registrar(`☾ Descanso Curto: ${r.notas.join(" · ")}.`); await salvar(); render(); $("#st").textContent = "Descanso curto ✓ (salvo)"; });
    $("#desc-longo")?.addEventListener("click", async () => { const r = aplicarDescanso(f, "longo"); registrar(`🌙 Descanso Longo: ${r.notas.join(" · ")}.`); await salvar(); render(); $("#st").textContent = "Descanso longo ✓ (salvo)"; });
    app.querySelectorAll(".ck-uso").forEach((c) => c.onchange = () => { f.usos = f.usos || {}; if (c.checked) f.usos[c.dataset.uso] = true; else delete f.usos[c.dataset.uso]; render(); });
    $("#nome").oninput = (e) => { p.nome = e.target.value; f.nomeVisivel = e.target.value; };
    $("#foto-in")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      comprimirFoto(file, (data) => { f.foto = data; registrar("◈ Retrato do personagem atualizado."); render(); });
      e.target.value = "";
    });
    $("#foto-rm")?.addEventListener("click", () => { f.foto = null; render(); });
    ["raca", "classe", "filosofia"].forEach((c) => $("#" + c).onchange = (e) => { f[c] = e.target.value; render(); });
    ["creditos", "pvAtual", "pvMax"].forEach((c) => { const el = $("#" + c); if (el) el.oninput = (e) => { f[c] = +e.target.value; }; });
    $("#modo-pontos").onclick = () => { f.modoAttr = "pontos"; render(); };
    $("#modo-rolagem").onclick = () => { f.modoAttr = "rolagem"; render(); };
    $("#rolar-pool")?.addEventListener("click", () => {
      const somas = Array.from({ length: 7 }, () => rollNd(2, 8).reduce((a, b) => a + b, 0));
      somas.sort((a, b) => a - b);
      const pior = somas.shift(); // descarta a pior (menor soma)
      f.rolagemPool = somas; // guarda as SOMAS BRUTAS; a conversão acontece ao distribuir
      f.rolagem = { For: null, Des: null, Con: null, Int: null, Sab: null, Car: null };
      registrar(`🎲 Origem rolada — 2d8 sete vezes, descartada a pior soma (${pior}). Somas guardadas: [${somas.join(", ")}]. Distribua cada soma num atributo; a conversão em modificador aparece ao lado. Raça e pontos somam por cima.`);
      render();
    });
    app.querySelectorAll(".sel-pool").forEach((s) => s.onchange = () => {
      const a = s.dataset.a; f.rolagem[a] = s.value === "" ? null : +s.value;
      if (s.value !== "") registrar(`Δ ${a} recebeu ${sign(+s.value)} da rolagem.`);
      render();
    });
    app.querySelectorAll(".pt-attr").forEach((i) => i.onchange = () => {
      const a = i.dataset.a;
      const outros = Object.entries(f.pontosAttr || {}).reduce((s, [key, v]) => s + (key === a ? 0 : (v || 0)), 0);
      const maxEste = Math.max(0, k.pontosDireito - outros); // não pode exceder o orçamento total
      let v = Math.max(0, Math.floor(+i.value || 0));
      if (v > maxEste) { v = maxEste; $("#st").textContent = `Sem pontos de atributo livres (${k.pontosDireito} no total)`; }
      f.pontosAttr[a] = v; render();
    });
    app.querySelectorAll(".pt-per").forEach((i) => i.onchange = () => {
      const pn = i.dataset.p;
      const teto = f.nivel >= 5 ? 7 : 5;
      const extraAtual = f.periciasExtra[pn] || 0;
      const classGrant = (k.per[pn] || 0) - extraAtual;                 // parte de classe/migração (não conta no orçamento)
      const outros = Object.entries(f.periciasExtra || {}).reduce((s, [key, v]) => s + (key === pn ? 0 : (v || 0)), 0);
      const maxOrc = Math.max(0, k.perDireito - outros);               // teto pelo orçamento de nível
      const maxSkill = Math.max(0, teto - classGrant);                 // teto por perícia (+5 / +7 total)
      let v = Math.max(0, Math.floor(+i.value || 0));
      if (v > maxOrc) { v = maxOrc; $("#st").textContent = `Sem pontos de perícia livres (${k.perDireito} no total)`; }
      if (v > maxSkill) { v = maxSkill; $("#st").textContent = `Teto de perícia: +${teto} (classe já concede +${classGrant})`; }
      f.periciasExtra[pn] = v; render();
    });
    $("#pv-inicial")?.addEventListener("click", () => {
      const k2 = calc(f); const r = RACAS.find((x) => x.nome === f.raca); const c = CLASSES[f.classe];
      const { ds, menor, soma3, subtotal } = rolaVidaInicial(r);
      const base = Math.max(1, subtotal + k2.attr.Con + (c?.pv || 0));
      f.pvMax = base; f.pvAtual = base;
      registrar(`❤ PV do nível 1: 4d6 [${ds.join(", ")}] descarta ${menor}, soma ${soma3} ${sign(r?.vidaMod || 0)} raça ${sign(k2.attr.Con)} Con +${c?.pv || 0} classe = ${base} PV.`);
      render();
    });
    $("#vida-fixa")?.addEventListener("change", (e) => { f.usarVidaFixa = e.target.checked; render(); });
    $("#metodo")?.addEventListener("change", (e) => { f.metodoNivel = e.target.value; render(); });
    $("#xp")?.addEventListener("input", (e) => { f.xp = +e.target.value; });
    $("#xpMeta")?.addEventListener("input", (e) => { f.xpMeta = +e.target.value; });
    $("#marcos")?.addEventListener("input", (e) => { f.marcos = +e.target.value; });
    $("#add-marco")?.addEventListener("click", () => { f.marcos = (f.marcos || 0) + 1; registrar(`⚑ Marco da história alcançado (total: ${f.marcos}).`); render(); });
    $("#levelup")?.addEventListener("click", async () => {
      if (f.nivel >= 10) return;
      const novoNv = f.nivel + 1;
      const k2 = calc(f); const r = RACAS.find((x) => x.nome === f.raca);
      let ganhoPV, detalhe;
      if (f.usarVidaFixa) {
        ganhoPV = Math.max(1, (r?.vidaFixa || 3) + k2.attr.Con);
        detalhe = `média fixa ${r?.vidaFixa} ${sign(k2.attr.Con)} Con`;
      } else {
        const rolou = d(r?.dadoVida || 6);
        ganhoPV = Math.max(1, rolou + k2.attr.Con);
        detalhe = `1d${r?.dadoVida} [${rolou}] ${sign(k2.attr.Con)} Con`;
      }
      f.nivel = novoNv; f.pvMax += ganhoPV; f.pvAtual += ganhoPV;
      if (f.metodoNivel === "xp") { f.xp = Math.max(0, f.xp - f.xpMeta); f.xpMeta = novoNv * 1000; }
      const extras = ganhosDoNivel(novoNv, f).filter((g) => !g.startsWith("Vida"));
      registrar(`▲ NÍVEL ${novoNv - 1} → ${novoNv}! Vida: ${detalhe} = +${ganhoPV} PV (agora ${f.pvMax}). Ganhos: ${extras.join(" · ")}`);
      await salvar(); render();
      $("#st").textContent = `Nível ${novoNv}! +${ganhoPV} PV ✓ (salvo)`;
    });
    app.querySelectorAll(".ck-impl").forEach((c) => c.onchange = () => {
      f.implantes = c.checked ? [...f.implantes, c.dataset.n] : f.implantes.filter((x) => x !== c.dataset.n); render(); });
    app.querySelectorAll(".ck-scr").forEach((c) => c.onchange = () => {
      f.deck = c.checked ? [...f.deck, c.dataset.n] : f.deck.filter((x) => x !== c.dataset.n); render(); });
    const fillSel = () => { const t = $("#add-tipo").value; const cat = t === "arma" ? ARMAS : ARMADURAS;
      $("#add-sel").innerHTML = cat.map((a) => `<option>${esc(a.n)}</option>`).join(""); };
    fillSel(); $("#add-tipo").onchange = fillSel;
    $("#add-btn").onclick = () => { f.inventario.push({ tipo: $("#add-tipo").value, nome: $("#add-sel").value, equip: false, qtd: 1 }); render(); };
    app.querySelectorAll("[data-eq]").forEach((b) => b.onclick = () => { const it = f.inventario[+b.dataset.eq];
      if (it.tipo === "armadura") f.inventario.forEach((x) => { if (x.tipo === "armadura") x.equip = false; });
      it.equip = !it.equip; render(); });
    app.querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => { f.inventario.splice(+b.dataset.rm, 1); render(); });
    app.querySelectorAll("[data-tema]").forEach((b) => b.onclick = () => { f.tema = { ...TEMAS[b.dataset.tema] }; aplicarTema(f); });
  };
  render();
}

// ---------------- CAMPANHAS ----------------
async function telaCampanhas() {
  const { data: minhas } = await sb.from("campanhas").select("id,nome,codigo,mestre_id");
  shell("campanhas", `
    <header class="masthead"><h1>CAMPANHAS<span> ATIVAS</span></h1></header>
    <section class="sec"><header><span class="tag">☄</span><h2>Minhas mesas</h2></header>
      ${(minhas || []).map((c) => `<div class="inv"><span><b>${esc(c.nome)}</b> · código <b class="chrome">${c.codigo}</b>${c.mestre_id === usuario.id ? " · você é o Mestre" : ""}</span>
        <span style="display:flex;gap:6px"><a class="mini" href="#/mesa/${c.id}">ABRIR MESA</a>${c.mestre_id === usuario.id ? `<button class="mini rm" data-del-camp="${c.id}" data-nome="${esc(c.nome)}">EXCLUIR</button>` : ""}</span></div>`).join("") || `<p class="regra">Nenhuma campanha ainda.</p>`}
    </section>
    <section class="sec"><header><span class="tag">+</span><h2>Criar ou entrar</h2></header>
      <div class="linha-add"><input id="nova-nome" placeholder="Nome da nova campanha"/><button id="criar" class="btn-primario">CRIAR</button></div>
      <div class="linha-add"><input id="codigo" placeholder="Código de convite (6 letras)" maxlength="6"/><button id="entrar" class="btn-ghost">ENTRAR</button></div>
    </section>`, "campanhas");
  $("#criar").onclick = async () => {
    const nome = $("#nova-nome").value.trim(); if (!nome) return;
    const u = await sessaoAtiva(); if (!u) return;
    const { data, error } = await sb.from("campanhas").insert({ nome, mestre_id: u.id }).select("id").single();
    if (error) return alert(error.message);
    await sb.from("campanha_membros").insert({ campanha_id: data.id, perfil_id: u.id });
    location.hash = `#/mesa/${data.id}`;
  };
  $("#entrar").onclick = async () => {
    if (!(await sessaoAtiva())) return;
    const { data, error } = await sb.rpc("entrar_campanha", { cod: $("#codigo").value.trim() });
    if (error) return alert(error.message);
    location.hash = `#/mesa/${data}`;
  };
  app.querySelectorAll("[data-del-camp]").forEach((b) => b.onclick = async () => {
    if (!confirm(`Excluir a campanha "${b.dataset.nome}"?\n\nIsso apaga a mesa e todo o histórico de mensagens, e remove os jogadores da campanha. Os personagens deles NÃO são apagados — apenas desvinculados. Esta ação é permanente.`)) return;
    if (!(await sessaoAtiva())) return;
    const { error } = await sb.from("campanhas").delete().eq("id", b.dataset.delCamp);
    if (error) return alert("Não consegui excluir: " + error.message);
    telaCampanhas();
  });
}

// ---------------- MESA (chat + rolagens + dano + nave) ----------------
async function telaMesa(id) {
  const [{ data: camp }, { data: membros }, { data: pers }, { data: msgs }] = await Promise.all([
    sb.from("campanhas").select("*").eq("id", id).single(),
    sb.from("campanha_membros").select("perfil_id,posto,perfis(apelido)").eq("campanha_id", id),
    sb.from("personagens").select("id,nome,dono_id,dados").eq("campanha_id", id),
    sb.from("mensagens").select("*,perfis:autor_id(apelido,avatar_url)").eq("campanha_id", id).order("criado_em", { ascending: true }).limit(120),
  ]);
  if (!camp) return (location.hash = "#/campanhas");
  const { data: meus } = await sb.from("personagens").select("id,nome").eq("dono_id", usuario.id);
  let meuPers = pers?.find((x) => x.dono_id === usuario.id) || null;
  const souMestre = camp.mestre_id === usuario.id;
  let pintarMsg = null;          // aponta pro addMsg do render atual (renderização otimista)
  const historico = msgs || [];  // lista mutável de mensagens (sobrevive a re-renders)

  const enviar = async (tipo, conteudo, payload = null) => {
    const { data, error } = await sb.from("mensagens").insert({ campanha_id: id, autor_id: usuario.id, personagem_id: meuPers?.id || null, tipo, conteudo, payload }).select("*,perfis:autor_id(apelido,avatar_url)").single();
    if (error) { alert("Não consegui transmitir: " + error.message); return false; }
    pintarMsg?.(data, true); // mostra na hora, sem depender do realtime voltar
    return true;
  };

  const rolarEEnviar = (titulo, mod, extras = {}) => {
    const nat = d(20), total = nat + mod;
    return enviar("rolagem", null, { titulo, detalhe: `d20 [${nat}] ${sign(mod)}`, total, crit: nat === 20, fumble: nat === 1, ...extras });
  };

  const render = async () => {
    if (canalMesa) { sb.removeChannel(canalMesa); canalMesa = null; }
    const f = meuPers ? { ...novaFichaDados(), ...meuPers.dados } : null;
    const k = f ? calc(f) : null;
    const armasEq = f ? (f.inventario || []).filter((i) => i.tipo === "arma" && i.equip) : [];
    const nave = camp.nave;
    const meuPosto = membros?.find((m) => m.perfil_id === usuario.id)?.posto;
    shell("mesa", `
      <nav class="topo"><a class="btn-ghost" href="#/campanhas">← CAMPANHAS</a>
        <div class="topo-status">${esc(camp.nome)} · código <b class="chrome">${camp.codigo}</b></div><span></span></nav>
      <div class="mesa">
        <div class="mesa-lateral">
          <section class="sec"><header><span class="tag">◈</span><h2>Meu personagem</h2></header>
            <select id="sel-pers">${meuPers ? "" : `<option value="">— vincular personagem —</option>`}
              ${(meus || []).map((m) => `<option value="${m.id}" ${meuPers?.id === m.id ? "selected" : ""}>${esc(m.nome) || "sem nome"}</option>`).join("")}</select>
            ${f ? `<p class="regra">PV ${f.pvAtual}/${f.pvMax} · CD ${k.cd} · RAM ${k.ramLivre}/${k.ramMax} · conj +${k.conj}</p>
            <div class="acoes-mesa">
              <select id="sel-per">${PERICIAS.map(([pn]) => `<option>${pn}</option>`).join("")}</select>
              <button id="rolar-per" class="mini">TESTE</button>
              ${armasEq.map((a, i) => { const cat = ARMAS.find((x) => x.n === a.nome);
                return `<button class="mini atq" data-atq="${i}">⚔ ${esc(a.nome)} (${cat?.dano})</button>`; }).join("")}
              <select id="sel-scr">${(f.deck.length ? SCRIPTS.filter((s) => f.deck.includes(s.n)) : SCRIPTS.filter((s) => s.c === 0)).map((s) => `<option>${esc(s.n)}</option>`).join("")}</select>
              <button id="conjurar" class="mini">⚡ CONJURAR</button>
              <input id="dado-livre" placeholder="2d6+1" style="width:80px"/><button id="rolar-livre" class="mini">🎲</button>
            </div>
            <div class="acoes-mesa"><b class="chrome">Direcionar dano:</b>
              <select id="sel-alvo">${(pers || []).map((x) => `<option value="${x.id}">${esc(x.nome)}</option>`).join("")}</select>
              <input id="dano-val" type="number" placeholder="valor" style="width:70px"/>
              <button id="enviar-dano" class="mini dano">💥 DANO</button><button id="enviar-cura" class="mini eq">✚ CURA</button></div>` : `<p class="regra">Vincule um personagem para rolar pela mesa.</p>`}
          </section>
          <section class="sec"><header><span class="tag">🚀</span><h2>Nave da campanha</h2></header>
            ${nave ? `
              <p><b>${esc(nave.nome_batismo || nave.modelo)}</b> <small>(${esc(nave.modelo)})</small></p>
              <div class="barras">
                <div class="barra"><span>Casco ${nave.casco}/${nave.casco_max}</span><div><i style="width:${(100 * nave.casco / nave.casco_max) | 0}%;background:var(--chrome)"></i></div></div>
                <div class="barra"><span>Escudos ${nave.escudos}/${nave.escudos_max}</span><div><i style="width:${nave.escudos_max ? (100 * nave.escudos / nave.escudos_max) | 0 : 0}%;background:var(--tech)"></i></div></div>
              </div>
              <p class="regra">Defesa ${10 + (nave.manobra || 0)} · Dano ${esc(nave.dano)} · ${esc(REGRAS_NAVE.defesa)}</p>
              <label>Meu posto<select id="sel-posto"><option value="">— fora da nave —</option>
                ${Object.entries(ESTACOES).map(([pk, e]) => `<option value="${pk}" ${meuPosto === pk ? "selected" : ""}>${e.n}</option>`).join("")}</select></label>
              ${meuPosto && f ? `<div class="acoes-mesa">${ESTACOES[meuPosto].acoes.map((a, i) => `<button class="mini" data-est="${i}" title="${esc(a.d)}">${esc(a.n)}</button>`).join("")}</div>` : ""}
              ${souMestre ? `<div class="acoes-mesa"><input id="nave-dano" type="number" placeholder="dano" style="width:70px"/><button id="nave-hit" class="mini dano">💥 NAVE SOFRE</button></div>` : ""}
            ` : souMestre ? `
              <select id="sel-nave">${NAVES.map((n) => `<option>${esc(n.n)}</option>`).join("")}</select>
              <input id="nave-nome" placeholder="Nome de batismo"/>
              <button id="def-nave" class="btn-primario" style="margin-top:8px">DEFINIR NAVE</button>` : `<p class="regra">O Mestre ainda não definiu a nave.</p>`}
          </section>
          <section class="sec"><header><span class="tag">👥</span><h2>Tripulação</h2></header>
            ${(membros || []).map((m) => `<p class="regra">${esc(m.perfis?.apelido)}${m.posto ? ` · ${ESTACOES[m.posto]?.n}` : ""}${m.perfil_id === camp.mestre_id ? " · MESTRE" : ""}</p>`).join("")}
          </section>
          ${souMestre ? `<section class="sec"><header><span class="tag">☾</span><h2>Controles do Mestre</h2></header>
            <p class="regra">Convoque um descanso para toda a mesa. Cada jogador conectado com personagem vinculado recupera automaticamente na própria ficha.</p>
            <div class="filtros" style="margin-top:8px"><button id="mestre-curto" class="mini">☾ Descanso Curto (todos)</button><button id="mestre-longo" class="mini eq">🌙 Descanso Longo (todos)</button></div>
          </section>` : ""}
        </div>
        <section class="sec mesa-chat">
          <header><span class="tag">≣</span><h2>Mesa · transmissão ao vivo</h2></header>
          <div id="chat" class="chat"></div>
          <div class="linha-add"><input id="msg" placeholder="Transmitir mensagem… (/r 2d6+1 rola dados)"/><button id="enviar-msg" class="btn-primario">▶</button></div>
        </section>
      </div>`, "campanhas");

    // ---- chat render ----
    const chatEl = $("#chat");
    const idsVistos = new Set();
    const addMsg = (m, aoVivo = false) => {
      if (idsVistos.has(m.id)) return; idsVistos.add(m.id);
      if (aoVivo && !historico.some((x) => x.id === m.id)) historico.push(m); // persiste entre re-renders
      const quem = esc(m.perfis?.apelido || "?");
      const persN = m.personagem_id ? esc(pers?.find((x) => x.id === m.personagem_id)?.nome || "") : "";
      let corpo = "";
      if (m.tipo === "texto" || m.tipo === "sistema") corpo = `<div class="m-txt ${m.tipo}">${esc(m.conteudo)}</div>`;
      else if (m.tipo === "rolagem") { const p = m.payload || {};
        corpo = `<div class="m-roll ${p.crit ? "crit" : ""} ${p.fumble ? "fumble" : ""}">
          <b>${esc(p.titulo)}</b><span class="m-det">${esc(p.detalhe)}</span>
          ${p.total !== undefined ? `<span class="m-total">${p.total}</span>` : ""}
          ${p.crit ? `<span class="log-flag crit">CRÍTICO!</span>` : ""}${p.fumble ? `<span class="log-flag fumble">FALHA CRÍTICA</span>` : ""}
          ${p.extra ? `<span class="m-extra">${esc(p.extra)}</span>` : ""}</div>`; }
      else if (m.tipo === "dano" || m.tipo === "cura") { const p = m.payload || {};
        const meu = pers?.find((x) => x.id === p.alvo_id)?.dono_id === usuario.id;
        corpo = `<div class="m-roll ${m.tipo === "dano" ? "fumble" : "crit"}"><b>${m.tipo === "dano" ? "💥" : "✚"} ${p.valor} em ${esc(p.alvo_nome)}</b>
          <span class="m-det">${esc(p.origem || "")}</span>
          ${p.aplicado ? `<span class="m-extra">aplicado ✓</span>` : meu ? `<button class="mini ${m.tipo === "dano" ? "dano" : "eq"}" data-aplicar="${m.id}">APLICAR ${m.tipo === "dano" ? "−" : "+"}${p.valor} PV</button>` : `<span class="m-extra">aguardando o dono aplicar…</span>`}</div>`; }
      else if (m.tipo === "nave") corpo = `<div class="m-txt sistema">🚀 ${esc(m.conteudo)}</div>`;
      else if (m.tipo === "descanso") { const p = m.payload || {}; corpo = `<div class="m-txt sistema">${p.tipo === "longo" ? "🌙" : "☾"} ${esc(m.conteudo)}</div>`; }
      const el = document.createElement("div");
      const persMsg = m.personagem_id ? pers?.find((x) => x.id === m.personagem_id) : null;
      const av = persMsg?.dados?.foto || m.perfis?.avatar_url || null;
      const avatarHtml = av ? `<img class="m-avatar" src="${esc(av)}" alt=""/>` : `<div class="m-avatar vazia">◈</div>`;
      el.className = "m"; el.innerHTML = `${avatarHtml}<div class="m-corpo"><div class="m-cab">${quem}${persN ? ` <i>como ${persN}</i>` : ""} <time>${new Date(m.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time></div>${corpo}</div>`;
      chatEl.appendChild(el); chatEl.scrollTop = chatEl.scrollHeight;
      el.querySelector("[data-aplicar]")?.addEventListener("click", async (ev) => {
        const p = m.payload; const alvo = pers.find((x) => x.id === p.alvo_id);
        const dados = { ...novaFichaDados(), ...alvo.dados };
        dados.pvAtual = (dados.pvAtual || 0) + (m.tipo === "dano" ? -p.valor : p.valor);
        await sb.from("personagens").update({ dados }).eq("id", alvo.id);
        await sb.from("mensagens").update({ payload: { ...p, aplicado: true } }).eq("id", m.id);
        await enviar("sistema", `${alvo.nome} agora está com ${dados.pvAtual} PV.`);
      });
      // Descanso convocado pelo Mestre: cada cliente aplica no SEU personagem vinculado.
      // Só ao vivo (aoVivo) para não reaplicar ao recarregar o histórico.
      if (aoVivo && m.tipo === "descanso" && meuPers) {
        (async () => {
          const dados = { ...novaFichaDados(), ...meuPers.dados };
          const r = aplicarDescanso(dados, m.payload?.tipo === "longo" ? "longo" : "curto");
          const { error } = await sb.from("personagens").update({ dados }).eq("id", meuPers.id);
          if (!error) { meuPers.dados = dados; await enviar("sistema", `🛌 ${meuPers.nome}: ${r.notas.join(" · ")}.`); }
        })();
      }
    };
    pintarMsg = addMsg;
    historico.forEach((m) => addMsg(m));

    // ---- realtime ----
    // Passa o token do usuário pro socket realtime; sem isso o canal entra como
    // anônimo e a RLS de mensagens filtra tudo (nada chega na mesa).
    try { const { data: { session } } = await sb.auth.getSession(); if (session?.access_token) sb.realtime.setAuth(session.access_token); } catch (_) {}
    canalMesa = sb.channel(`mesa-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens", filter: `campanha_id=eq.${id}` },
        async (pl) => { const { data: m } = await sb.from("mensagens").select("*,perfis:autor_id(apelido,avatar_url)").eq("id", pl.new.id).single(); if (m) addMsg(m, true); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "campanhas", filter: `id=eq.${id}` },
        (pl) => { camp.nave = pl.new.nave; render(); })
      .subscribe();

    // ---- binds ----
    $("#enviar-msg").onclick = () => { const t = $("#msg").value.trim(); if (!t) return; $("#msg").value = "";
      const rr = /^\/r(?:olar)?\s+(.+)/i.exec(t);
      if (rr) { const p = parseDice(rr[1]); if (p) { const dados = rollNd(p.n, p.f); const total = dados.reduce((a, b) => a + b, 0) + p.mod;
        return enviar("rolagem", null, { titulo: `Rolagem ${rr[1]}`, detalhe: `[${dados.join(", ")}] ${p.mod ? sign(p.mod) : ""}`, total }); } }
      enviar("texto", t); };
    $("#msg").onkeydown = (e) => { if (e.key === "Enter") $("#enviar-msg").click(); };
    $("#mestre-curto")?.addEventListener("click", () => { if (confirm("Convocar Descanso Curto para toda a mesa? Cada jogador conectado recupera as habilidades de descanso curto no próprio personagem.")) enviar("descanso", "O Mestre convocou um Descanso Curto (1h). Habilidades de descanso curto reiniciadas; cura via Kits Médicos.", { tipo: "curto" }); });
    $("#mestre-longo")?.addEventListener("click", () => { if (confirm("Convocar Descanso Longo para toda a mesa? Cada jogador conectado tem PV restaurados, RAM recarregada e todas as habilidades reiniciadas.")) enviar("descanso", "O Mestre convocou um Descanso Longo (8h). PV restaurados, RAM recarregada e todas as habilidades reiniciadas.", { tipo: "longo" }); });
    $("#sel-pers").onchange = async (e) => {
      const pid = e.target.value; if (!pid) return;
      await sb.from("personagens").update({ campanha_id: id }).eq("id", pid);
      location.reload();
    };
    if (f) {
      $("#rolar-per").onclick = () => { const pn = $("#sel-per").value; const at = PERICIAS.find(([x]) => x === pn)[1];
        rolarEEnviar(`Teste de ${pn}`, k.attr[at] + k.per[pn]); };
      app.querySelectorAll("[data-atq]").forEach((b) => b.onclick = () => {
        const a = armasEq[+b.dataset.atq]; const cat = ARMAS.find((x) => x.n === a.nome);
        const mod = k.attr[cat.attr] + k.per[cat.per] + (cat.tipo === "fogo" && f.implantes.includes("Olho Biônico de Precisão") ? 2 : 0);
        const nat = d(20); const pd = parseDice(cat.dano); const mult = nat === 20 ? 2 : 1;
        const dados = rollNd(pd.n * mult, pd.f);
        const danoMod = k.attr[cat.attr] + (cat.tipo === "branca" && f.implantes.includes("Braço Mecânico Hidráulico") ? 2 : 0);
        enviar("rolagem", null, { titulo: `Ataque — ${a.nome}`, detalhe: `d20 [${nat}] ${sign(mod)} · dano ${cat.dano}${nat === 20 ? "×2" : ""} [${dados.join(", ")}] ${sign(danoMod)}`,
          total: nat + mod, crit: nat === 20, fumble: nat === 1, extra: `Dano: ${dados.reduce((x, y) => x + y, 0) + danoMod}` }); });
      $("#conjurar").onclick = async () => {
        const s = SCRIPTS.find((x) => x.n === $("#sel-scr").value);
        if (s.c > k.ramLivre) return enviar("sistema", `${p.nome || perfil.apelido} tentou conjurar ${s.n} sem RAM suficiente (Overclock manual: 1d6/ponto).`);
        meuPers.dados = { ...f, ramGasta: (f.ramGasta || 0) + s.c };
        await sb.from("personagens").update({ dados: meuPers.dados }).eq("id", meuPers.id);
        const nat = d(20);
        enviar("rolagem", null, { titulo: `Script — ${s.n}`, detalhe: `d20 [${nat}] +${k.conj} · ${s.c} RAM · ${s.a}`, total: nat + k.conj, crit: nat === 20, fumble: nat === 1, extra: s.d.slice(0, 90) });
        render(); };
      $("#rolar-livre").onclick = () => { const p2 = parseDice($("#dado-livre").value); if (!p2) return;
        const dados = rollNd(p2.n, p2.f); enviar("rolagem", null, { titulo: `Rolagem ${$("#dado-livre").value}`, detalhe: `[${dados.join(", ")}]`, total: dados.reduce((a, b) => a + b, 0) + p2.mod }); };
      $("#enviar-dano").onclick = () => { const v = +$("#dano-val").value; if (!v) return;
        const alvo = pers.find((x) => x.id === $("#sel-alvo").value);
        enviar("dano", null, { alvo_id: alvo.id, alvo_nome: alvo.nome, valor: v, origem: `de ${meuPers.nome}`, aplicado: false }); };
      $("#enviar-cura").onclick = () => { const v = +$("#dano-val").value; if (!v) return;
        const alvo = pers.find((x) => x.id === $("#sel-alvo").value);
        enviar("cura", null, { alvo_id: alvo.id, alvo_nome: alvo.nome, valor: v, origem: `de ${meuPers.nome}`, aplicado: false }); };
    }
    // nave binds
    $("#def-nave")?.addEventListener("click", async () => {
      const n = NAVES.find((x) => x.n === $("#sel-nave").value);
      const nave = { modelo: n.n, nome_batismo: $("#nave-nome").value.trim() || n.n, casco: n.casco, casco_max: n.casco, escudos: n.escudos, escudos_max: n.escudos, manobra: n.manobra, dano: n.dano };
      await sb.from("campanhas").update({ nave }).eq("id", id);
      enviar("nave", `A nave ${nave.nome_batismo} (${n.n}) entrou em serviço. Casco ${n.casco}, Escudos ${n.escudos}, Defesa ${10 + n.manobra}.`);
    });
    $("#sel-posto")?.addEventListener("change", async (e) => {
      await sb.from("campanha_membros").update({ posto: e.target.value || null }).eq("campanha_id", id).eq("perfil_id", usuario.id);
      location.reload();
    });
    $("#nave-hit")?.addEventListener("click", async () => {
      const v = +$("#nave-dano").value; if (!v || !camp.nave) return;
      const n = { ...camp.nave };
      const abs = Math.min(n.escudos, v); n.escudos -= abs; n.casco = Math.max(0, n.casco - (v - abs));
      await sb.from("campanhas").update({ nave: n }).eq("id", id);
      enviar("nave", `A nave sofreu ${v} de dano (${abs} nos escudos). Casco ${n.casco}/${n.casco_max}, Escudos ${n.escudos}/${n.escudos_max}.${n.casco === 0 ? " ⚠ CASCO ZERO — À DERIVA!" : ""}`);
    });
    if (meuPosto && f) app.querySelectorAll("[data-est]").forEach((b) => b.onclick = async () => {
      const acao = ESTACOES[meuPosto].acoes[+b.dataset.est];
      if (!acao.rola) return enviar("nave", `${meuPers.nome} executa ${acao.n}: ${acao.d}`);
      const [at, pn] = acao.rola; const mod = k.attr[at] + k.per[pn];
      const nat = d(20); const total = nat + mod;
      let extra = acao.d;
      if (acao.cura && camp.nave && total >= 12) {
        const pd = parseDice(acao.dado); const val = rollNd(pd.n, pd.f).reduce((a, b) => a + b, 0) + (acao.cura === "escudos" ? f.nivel : 0);
        const n = { ...camp.nave };
        n[acao.cura] = Math.min(n[acao.cura + "_max"], n[acao.cura] + val);
        await sb.from("campanhas").update({ nave: n }).eq("id", id);
        extra = `+${val} de ${acao.cura}! (${n[acao.cura]}/${n[acao.cura + "_max"]})`;
      }
      enviar("rolagem", null, { titulo: `${ESTACOES[meuPosto].n} — ${acao.n}`, detalhe: `d20 [${nat}] ${sign(mod)} (${at}+${pn})`, total, crit: nat === 20, fumble: nat === 1, extra });
    });
  };
  render();
}

// ---------------- BIBLIOTECA (todas as informações detalhadas) ----------------
function telaBiblioteca(aba = "racas") {
  const abas = [["racas", "Raças"], ["classes", "Classes"], ["armas", "Arsenal"], ["armaduras", "Armaduras"], ["implantes", "Implantes"], ["scripts", "Scripts"], ["filosofias", "Filosofias"], ["naves", "Naves"]];
  let corpo = "";
  if (aba === "racas") corpo = RACAS.map((r) => `<details class="det grande"><summary><b>${esc(r.nome)}</b> (${r.planeta}) — ${esc(r.titulo)}</summary>
    <p>${esc(r.lore)}</p>
    <p class="regra">Vida 4d6 (tira o menor) ${sign(r.vidaMod)} · ${["For","Des","Con","Int","Sab","Car"].map((a) => `${a} ${sign(r.attrs[a])}`).join(" · ")}</p>
    ${r.habilidades.map((h) => `<p><b class="tech-c">${esc(h.n)}:</b> ${esc(h.d)}</p>`).join("")}
    ${r.lendaria ? `<p><b class="sombra-c">★ Lendária (NV10) — ${esc(r.lendaria.n)}:</b> ${esc(r.lendaria.d)}</p>` : ""}</details>`).join("");
  if (aba === "classes") corpo = Object.entries(CLASSES).map(([n, c]) => `<details class="det grande"><summary><b>${esc(n)}</b> — Vida +${c.pv}</summary>
    <p class="regra">Perícias: ${Object.entries(c.pericias).map(([p, v]) => `${p} +${v}`).join(", ")}</p>
    ${c.hab.map((h) => `<p><b class="tech-c">${h.tipo} — ${esc(h.n)}:</b> ${esc(h.d)}</p>`).join("")}
    <p><b class="chrome">★ Veterana (NV5) — ${esc(c.vet.n)}:</b> ${esc(c.vet.d)}</p></details>`).join("");
  if (aba === "armas") corpo = ["branca", "fogo"].map((t) => `<h3 class="sub">${t === "branca" ? "⚔ Armas Brancas (1d20 + For + Armas Brancas)" : "🔫 Armas de Fogo (1d20 + Des + Armas de Fogo)"}</h3>` +
    ARMAS.filter((a) => a.tipo === t).map((a) => `<details class="det"><summary><b>${esc(a.n)}</b> · ${a.dano}${a.kw ? ` · <i>${esc(a.kw)}</i>` : ""}</summary><p>${esc(a.desc)}${a.attr === "Des" && a.tipo === "branca" ? "<br><b>Ágil:</b> usa Destreza." : ""}</p></details>`).join("")).join("");
  if (aba === "armaduras") corpo = ARMADURAS.map((a) => `<div class="det"><b>${esc(a.n)}</b> · CD +${a.cd} (${a.t})${a.e ? ` — ${esc(a.e)}` : ""}</div>`).join("");
  if (aba === "implantes") corpo = IMPLANTES.map((i) => `<div class="det"><b>${esc(i.n)}</b> · ${i.p} CG (${i.g}) — ${esc(i.e)}</div>`).join("");
  if (aba === "scripts") corpo = SCRIPTS.map((s) => `<div class="det"><b>${esc(s.n)}</b> <i class="sombra-c">${s.c}◈ ${esc(s.a)}</i> — ${esc(s.d)}</div>`).join("");
  if (aba === "filosofias") corpo = Object.entries(FILOSOFIAS).map(([n, x]) => `<div class="det"><b>${esc(n)}</b> — ${esc(x.d)}</div>`).join("");
  if (aba === "naves") corpo = `<p class="regra">${esc(REGRAS_NAVE.defesa)}<br>${esc(REGRAS_NAVE.dobra)}<br>${esc(REGRAS_NAVE.critico)}</p>` +
    NAVES.map((n) => `<details class="det grande"><summary><b>${esc(n.n)}</b> · Casco ${n.casco} · Escudos ${n.escudos} · Manobra ${sign(n.manobra)} · Dano ${n.dano}</summary>
    <p>${esc(n.desc)}</p><p class="regra">Tripulação: ${esc(n.trip)}</p></details>`).join("") +
    `<h3 class="sub">Estações de Batalha</h3>` + Object.values(ESTACOES).map((e) => `<div class="det"><b>${esc(e.n)}</b>${e.acoes.map((a) => `<p><b class="tech-c">${esc(a.n)}${a.rola ? ` (${a.rola.join("+")})` : ""}:</b> ${esc(a.d)}</p>`).join("")}</div>`).join("");
  shell("biblioteca", `
    <header class="masthead"><h1>BIBLIOTECA<span> DO SISTEMA</span></h1>
      <div class="mast-sub">Tudo do livro Passagem Sombria v1.3, pesquisável e completo</div></header>
    <div class="filtros">${abas.map(([id2, l]) => `<a href="#/biblioteca/${id2}" class="${aba === id2 ? "on" : ""}">${l}</a>`).join("")}</div>
    <section class="sec">${corpo}</section>`, "biblioteca");
}

iniciar();
