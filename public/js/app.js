// ============================================================
// PASSAGEM SOMBRIA — DECK DE CAMPO ONLINE (SPA vanilla JS)
// Rotas: #/login #/hangar #/ficha/:id #/campanhas #/mesa/:id #/biblioteca
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { RACAS, CLASSES, FILOSOFIAS, IMPLANTES, SCRIPTS, ARMAS, ARMADURAS, PERICIAS, NAVES, ESTACOES, REGRAS_NAVE, RIQUEZA, TEMAS, CONVERTE_2D8, RENOME_PERICIAS, KEYWORDS, propsArma, AVARIAS, UPGRADES_NAVE, TURNOS_POR_PENTE, custoTiro, PENTES_INICIAIS } from "./dados-jogo.js";
import { BESTIARIO, NIVEIS_AMEACA } from "./dados-bestiario.js";
import { NPCS, PAPEIS } from "./dados-npcs.js";
import { FACCOES, NIVEIS_REPUTACAO, TABELAS, REFERENCIA  } from "./dados-mestre.js";
import { modalForm, confirmModal, somMensagem, somDado, notificar, pedirNotificacao, getSom, setSom } from "./ui.js";

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
// Rola uma expressão com vários termos: "1d20+2d10-1", "d20", "2d6 + 3". Devolve {total, detalhe} ou null.
const rolarExpr = (expr) => {
  const clean = String(expr || "").replace(/\s+/g, "");
  if (!clean) return null;
  const termos = clean.match(/[+-]?[^+-]+/g);
  if (!termos) return null;
  let total = 0; const partes = [];
  for (const raw of termos) {
    const sinal = raw[0] === "-" ? -1 : 1;
    const termo = raw.replace(/^[+-]/, "");
    const md = /^(\d*)d(\d+)$/i.exec(termo);
    if (md) {
      const n = +(md[1] || 1), faces = +md[2];
      if (n < 1 || n > 200 || faces < 1 || faces > 1000) return null;
      const dados = rollNd(n, faces);
      total += dados.reduce((a, b) => a + b, 0) * sinal;
      partes.push(`${sinal < 0 ? "−" : partes.length ? "+" : ""}${n}d${faces} [${dados.join(", ")}]`);
    } else if (/^\d+$/.test(termo)) {
      total += +termo * sinal;
      partes.push(`${sinal < 0 ? "−" : "+"}${termo}`);
    } else return null;
  }
  return { total, detalhe: partes.join(" ") };
};
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
    f.municaoUsada = 0;   // reorganizar equipamento: pentes recarregados
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


// Dano de arma no nível atual (armas Nano-Tatuagem escalam nos marcos NV5 e NV9)
function danoArma(cat, nivel) {
  if (!cat) return "1d4";
  if (!cat.escala) return cat.dano;
  const marcos = Object.keys(cat.escala).map(Number).sort((a, b) => a - b);
  let d = cat.dano;
  for (const m of marcos) if ((nivel || 1) >= m) d = cat.escala[String(m)];
  return d;
}

// ---------------- COMBATE ESPACIAL ----------------
const POSTOS_ORDEM = ["leme", "artilharia", "engenharia", "sensores"];
const combateNaveVazio = () => ({ ativo: false, rodada: 1, turno: 0, inimigas: [], avarias: [], agiram: [] });
// Defesa da nave = 10 + Manobrabilidade (Cap. 12)
const defesaNave = (n) => 10 + (n?.manobra || 0);
// Aplica dano respeitando Escudos antes do Casco; devolve o detalhamento.
function danoNave(alvo, valor) {
  const r = { escudos: 0, casco: 0, critico: false };
  let restante = valor;
  const abs = Math.min(alvo.escudos || 0, restante);
  alvo.escudos = (alvo.escudos || 0) - abs; restante -= abs; r.escudos = abs;
  if (restante > 0) { alvo.casco = Math.max(0, (alvo.casco || 0) - restante); r.casco = restante; }
  if (r.casco > 15) r.critico = true;   // dano massivo dispara Falha Crítica
  return r;
}
const rolarAvaria = () => AVARIAS[d(6) - 1];

// ---------------- FERRAMENTAS DO MESTRE ----------------
const sorteia = (lista) => lista[Math.floor(Math.random() * lista.length)];
// Gera um resultado de tabela aleatória (npc é montado por partes)
function rolarTabela(chave) {
  const t = TABELAS[chave]; if (!t) return "";
  if (t.monta) return `${sorteia(t.nomes)} ${sorteia(t.sobrenomes)} — ${sorteia(t.papeis)}. `
    + `Traço: ${sorteia(t.tracos)}. Quer: ${sorteia(t.querem)}.`;
  return sorteia(t.itens).replace(/\{creditos\}/g, () => String((1 + Math.floor(Math.random() * 12)) * 25));
}
// Orçamento de encontro: "pontos de ameaça" que uma party aguenta sem TPK.
const PESO_AMEACA = { Lacaio: 1, Comum: 2, Forte: 4, Elite: 6, Chefe: 12, Colossal: 18, "Super Chefe": 24 };
function orcamentoEncontro(nivel, jogadores, dificuldade) {
  const base = (2 + (nivel || 1) * 1.5) * (jogadores || 1);
  const mult = { facil: 0.6, medio: 1, dificil: 1.5, mortal: 2.2 }[dificuldade] || 1;
  return Math.max(1, Math.round(base * mult));
}
// Sugere combinações de criaturas que cabem no orçamento
function sugerirEncontro(orc) {
  const sug = [];
  for (const [tipo, peso] of Object.entries(PESO_AMEACA)) {
    const q = Math.floor(orc / peso);
    if (q >= 1 && q <= 12) sug.push({ tipo, q, sobra: orc - q * peso });
  }
  return sug.sort((a, b) => a.sobra - b.sobra).slice(0, 5);
}

// ---------------- COMBATE: rastreador de iniciativa ----------------
const CONDICOES = ["Sangrando", "Atordoado", "Cego", "Envenenado", "Caído", "Congelado", "Marcado", "Lento", "Amedrontado", "Enfraquecido", "Em chamas", "Silenciado"];
const combateVazio = () => ({ ativo: false, rodada: 1, turno: 0, ordem: [], avarias: [], agiram: [] });
// Um participante pode ser pessoa/criatura (hp) ou nave (casco). Estes helpers unificam os dois.
const ehNave = (c) => c?.tipo === "nave";
const foraDeCombate = (c) => ehNave(c) ? (c.casco || 0) <= 0 : (c.hp || 0) <= 0;
const vidaAtual = (c) => ehNave(c) ? c.casco : c.hp;
const vidaMax = (c) => ehNave(c) ? c.casco_max : c.hp_max;
const ordenarCombate = (cb) => { cb.ordem.sort((a, b) => (b.ini - a.ini) || a.nome.localeCompare(b.nome)); return cb; };
// Avança para o próximo combatente vivo; vira a rodada ao dar a volta.
const proximoTurno = (cb) => {
  if (!cb.ordem.length) return cb;
  let i = cb.turno, voltas = 0;
  do { i++; if (i >= cb.ordem.length) { i = 0; cb.rodada++; voltas++; } } while (cb.ordem[i] && foraDeCombate(cb.ordem[i]) && voltas < 2);
  cb.turno = i; return cb;
};

function aplicarTema(f) {
  const t = f?.tema || TEMAS["Vácuo"];
  document.documentElement.style.setProperty("--tech", t.tech);
  document.documentElement.style.setProperty("--chrome", t.chrome);
  document.documentElement.style.setProperty("--sombra", t.sombra);
}

// ---------------- ACESSIBILIDADE ----------------
const A11Y = [
  { k: "contraste", lbl: "Alto contraste", d: "Cores mais fortes e bordas mais nítidas." },
  { k: "dislexia", lbl: "Fonte para dislexia", d: "Letras espaçadas e linhas mais largas." },
  { k: "grande", lbl: "Texto maior", d: "Aumenta o tamanho do texto em toda a interface." },
  { k: "reduzir", lbl: "Reduzir animações", d: "Desliga transições e movimentos." },
];
function aplicarA11y() {
  A11Y.forEach(({ k }) => {
    const on = localStorage.getItem("ps-a11y-" + k) === "1";
    document.body.classList.toggle("a11y-" + k, on);
  });
  if (localStorage.getItem("ps-a11y-reduzir") === "1") document.documentElement.style.setProperty("scroll-behavior", "auto");
}
function montarA11y() {
  if (document.querySelector(".a11y-btn")) return;
  const b = document.createElement("button");
  b.className = "a11y-btn"; b.type = "button";
  b.setAttribute("aria-label", "Opções de acessibilidade");
  b.setAttribute("aria-expanded", "false");
  b.textContent = "♿";
  document.body.appendChild(b);
  let painel = null;
  b.onclick = () => {
    if (painel) { painel.remove(); painel = null; b.setAttribute("aria-expanded", "false"); return; }
    painel = document.createElement("div");
    painel.className = "a11y-painel"; painel.setAttribute("role", "dialog");
    painel.setAttribute("aria-label", "Opções de acessibilidade");
    painel.innerHTML = `<h3>Acessibilidade</h3><p class="regra">As escolhas ficam salvas neste dispositivo.</p>`
      + A11Y.map(({ k, lbl, d }) => `<label title="${esc(d)}"><input type="checkbox" data-a11y="${k}" ${localStorage.getItem("ps-a11y-" + k) === "1" ? "checked" : ""}/> <span>${esc(lbl)}</span></label>`).join("");
    document.body.appendChild(painel);
    b.setAttribute("aria-expanded", "true");
    painel.querySelectorAll("[data-a11y]").forEach((i) => i.onchange = () => {
      localStorage.setItem("ps-a11y-" + i.dataset.a11y, i.checked ? "1" : "0"); aplicarA11y();
    });
    painel.querySelector("input")?.focus();
  };
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && painel) { painel.remove(); painel = null; b.setAttribute("aria-expanded", "false"); b.focus(); } });
}

// ---------------- ROTEADOR ----------------
window.addEventListener("hashchange", rotear);
async function rotear() {
  if (canalMesa) { sb.removeChannel(canalMesa); canalMesa = null; }
  const [_, rota, arg] = location.hash.split("/");
  if (rota === "p") return telaFichaPublica(arg);           // ficha compartilhada (sem login)
  if (rota === "entrar" && arg) {                          // convite por link
    if (!usuario) { sessionStorage.setItem("ps-convite", arg); return telaLogin(); }
    const { data, error } = await sb.rpc("entrar_campanha", { cod: arg.toUpperCase() });
    if (error) { alert("Não consegui entrar: " + error.message); return (location.hash = "#/campanhas"); }
    return (location.hash = `#/mesa/${data}`);
  }
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

// Ficha compartilhada por link público (somente leitura, sem login).
async function telaFichaPublica(token) {
  const app = document.getElementById("app");
  app.innerHTML = `<div class="carregando"><div class="pulse"></div>Carregando ficha…</div>`;
  if (!token) { app.innerHTML = `<div class="frame"><p class="regra">Link inválido.</p></div>`; return; }
  const { data, error } = await sb.from("personagens").select("nome,dados,publico").eq("token_publico", token).eq("publico", true).maybeSingle();
  if (error || !data) {
    app.innerHTML = `<div class="frame" style="padding-top:60px;text-align:center">
      <h1>Ficha indisponível</h1>
      <p class="regra">Este link não existe mais ou o dono deixou de compartilhá-lo.</p>
      <p><a class="btn-ghost" href="#/hangar">Ir para o app</a></p></div>`;
    return;
  }
  const f = { ...novaFichaDados(), ...(data.dados || {}) };
  aplicarTema(f);
  const html = gerarFichaHTML(data.nome, f, calc(f));
  const corpoInterno = html.slice(html.indexOf("<body>") + 6, html.indexOf("</body>"));
  const estilos = html.slice(html.indexOf("<style>") + 7, html.indexOf("</style>"));
  app.innerHTML = `<style>${estilos}</style>
    <div style="background:#fff;min-height:100vh;padding:18px">
      <div style="max-width:900px;margin:0 auto">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
          <span style="font-size:11px;color:#777">Ficha compartilhada · Passagem Sombria · somente leitura</span>
          <span style="display:flex;gap:8px">
            <button id="pub-print" style="border:1px solid #ccc;background:#f5f5f5;padding:7px 12px;border-radius:5px;cursor:pointer">🖨 Imprimir / PDF</button>
            <a href="#/hangar" style="border:1px solid #ccc;background:#f5f5f5;padding:7px 12px;border-radius:5px;text-decoration:none;color:#15181f">Abrir o app</a>
          </span>
        </div>
        ${corpoInterno}
      </div></div>`;
  document.getElementById("pub-print").onclick = () => imprimirFichaHTML(html);
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
  const convite = sessionStorage.getItem("ps-convite");
  if (convite && location.hash.indexOf("#/entrar/") !== 0) { sessionStorage.removeItem("ps-convite"); location.hash = `#/entrar/${convite}`; }
  aplicarA11y(); montarA11y();
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
    if (await confirmModal("Apagar este tripulante? Esta ação é permanente.", { okLabel: "Apagar", perigo: true })) { await sb.from("personagens").delete().eq("id", b.dataset.del); telaHangar(); }
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
      <nav class="topo"><a class="btn-ghost" href="#/hangar">← HANGAR</a><div class="topo-status" id="st"></div><button id="imprimir" class="btn-ghost" title="Abre o diálogo de impressão — escolha 'Salvar como PDF'">🖨 PDF</button><button id="baixar" class="btn-ghost" title="Baixa a ficha como arquivo .html">💾 .html</button><button id="compartilhar" class="btn-ghost" title="Gerar link público (somente leitura)">🔗 LINK</button><button id="salvar" class="btn-primario">SALVAR</button></nav>

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
          <label>Raça<span class="raca-linha"><select id="raca"><option value="">—</option>${RACAS.map((r) => `<option ${f.raca === r.nome ? "selected" : ""}>${r.nome}</option>`).join("")}</select><button id="abrir-sistema" type="button" class="mini" title="Escolher a raça explorando o sistema solar em 3D">🌌</button></span></label>
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

      <section class="sec"><header><span class="tag">🛒</span><h2>Mercado</h2><span class="extra" id="loja-cg">${f.creditos ?? 0} CG</span></header>
        <p class="regra">Compre equipamento gastando Créditos Galácticos. A tabela de riqueza sugere ~${RIQUEZA[Math.min(10, f.nivel || 1)] || 300} CG para o nível ${f.nivel}.</p>
        <div class="filtros"><select id="loja-cat"><option value="arma">⚔ Armas</option><option value="armadura">🛡 Armaduras</option><option value="implante">🔧 Implantes</option></select></div>
        <div id="loja-lista" class="loja-lista"></div>
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
    $("#compartilhar").onclick = async () => {
      const { data: atual } = await sb.from("personagens").select("publico,token_publico").eq("id", p.id).single();
      const ativo = !!atual?.publico;
      const link = `${location.origin}${location.pathname}#/p/${atual?.token_publico}`;
      const r = await modalForm({
        titulo: ativo ? "🔗 Link público ativo" : "🔗 Compartilhar ficha",
        campos: [
          { k: "aviso", label: ativo ? "Qualquer pessoa com este link vê a ficha, sem precisar de conta. Copie abaixo ou desative." : "Cria um link somente leitura da ficha, para mostrar o personagem fora do app. Você pode desativar quando quiser.", tipo: "info" },
          ...(ativo ? [{ k: "link", label: "Link", tipo: "texto", valor: link }] : []),
        ],
        okLabel: ativo ? "Desativar link" : "Ativar link",
      });
      if (!r) return;
      const { error } = await sb.from("personagens").update({ publico: !ativo }).eq("id", p.id);
      if (error) return alert("Não consegui alterar o compartilhamento: " + error.message);
      if (!ativo) {
        try { await navigator.clipboard.writeText(link); } catch (_) {}
        await modalForm({ titulo: "✅ Link ativado", campos: [
          { k: "i", label: "Copiado para a área de transferência. Qualquer pessoa com ele pode ver a ficha (somente leitura).", tipo: "info" },
          { k: "l", label: "Link", tipo: "texto", valor: link }], okLabel: "Fechar" });
        $("#st").textContent = "Link público ativo ✓";
      } else $("#st").textContent = "Link público desativado";
    };
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
    $("#abrir-sistema")?.addEventListener("click", async () => {
      try { const { abrirSeletorPlanetas } = await import("./sistema-solar.js");
        abrirSeletorPlanetas(RACAS, (nome) => { f.raca = nome; render(); $("#st").textContent = `Raça: ${nome} ✓`; });
      } catch (err) { alert("Não consegui abrir o sistema solar: " + err.message); }
    });
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
    // ---- Mercado (loja com créditos) ----
    const renderLoja = (cat) => {
      const alvo = $("#loja-lista"); if (!alvo) return;
      const cg = f.creditos ?? 0;
      let itens;
      if (cat === "arma") itens = ARMAS.filter((a) => a.preco).map((a) => ({ nome: a.n, preco: a.preco, sub: `${a.dano} · ${a.kw || a.tipo}` }));
      else if (cat === "armadura") itens = ARMADURAS.filter((a) => a.preco).map((a) => ({ nome: a.n, preco: a.preco, sub: `${a.t} · +${a.cd} CD${a.e ? " · " + a.e : ""}` }));
      else itens = Object.values(IMPLANTES).filter((i) => i.p).map((i) => ({ nome: i.n, preco: i.p, sub: `${i.g} · ${i.e}`, jaTem: f.implantes.includes(i.n) }));
      itens.sort((a, b) => a.preco - b.preco);
      alvo.innerHTML = itens.map((it, ix) => `<div class="loja-item ${cg < it.preco ? "caro" : ""}">
        <span class="loja-nome"><b>${esc(it.nome)}</b><small>${esc(it.sub)}</small></span>
        <span class="loja-preco">${it.preco} CG</span>
        <button class="mini loja-comprar" data-ix="${ix}" ${cg < it.preco || it.jaTem ? "disabled" : ""}>${it.jaTem ? "✓ já tem" : "comprar"}</button></div>`).join("");
      alvo.querySelectorAll(".loja-comprar").forEach((b) => b.onclick = () => {
        const it = itens[+b.dataset.ix]; if (!it) return;
        if ((f.creditos ?? 0) < it.preco) return;
        f.creditos = (f.creditos ?? 0) - it.preco;
        if (cat === "implante") { if (!f.implantes.includes(it.nome)) f.implantes.push(it.nome); }
        else f.inventario.push({ tipo: cat, nome: it.nome, equip: false, qtd: 1 });
        registrar(`🛒 Comprou ${it.nome} por ${it.preco} CG (restam ${f.creditos} CG).`);
        render();
      });
    };
    $("#loja-cat") && ($("#loja-cat").onchange = (e) => renderLoja(e.target.value));
    renderLoja($("#loja-cat")?.value || "arma");
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
    if (!(await confirmModal(`Excluir a campanha "${b.dataset.nome}"? Isso apaga a mesa e todo o histórico de mensagens e remove os jogadores da campanha. Os personagens deles NÃO são apagados — apenas desvinculados. Esta ação é permanente.`, { okLabel: "Excluir campanha", perigo: true }))) return;
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
  let mapaCtrl = null;           // controlador do mapa aberto (para sync via realtime)
  let abaMesa = sessionStorage.getItem("ps-aba-mesa") || "ficha";  // aba ativa da lateral
  let timerInt = null;           // cronômetro de turno (local)
  let vantagem = 0;              // 0 normal · 1 vantagem · -1 desvantagem
  let privada = false;           // rolagem/mensagem privada (só Mestre + autor veem)
  let asCegas = false;           // rolagem às cegas: resultado só para o Mestre, fora do chat
  const pilhaUndo = [];          // snapshots para desfazer a última ação do Mestre (máx 10)
  let recapFeita = false;        // a recapitulação aparece uma vez por entrada na mesa
  const salvarMapa = async (mapa) => { camp.mapa = mapa; const { error } = await sb.from("campanhas").update({ mapa }).eq("id", id); if (error) alert("Não consegui salvar o mapa: " + error.message); };
  if (!camp.combate || typeof camp.combate !== "object" || !("ordem" in camp.combate)) camp.combate = combateVazio();
  const snapshot = (rotulo) => { pilhaUndo.push({ rotulo, combate: JSON.parse(JSON.stringify(camp.combate || {})), nave: JSON.parse(JSON.stringify(camp.nave || null)), combate_nave: JSON.parse(JSON.stringify(camp.combate_nave || {})) }); if (pilhaUndo.length > 10) pilhaUndo.shift(); };
  const salvarCombate = async () => { const { error } = await sb.from("campanhas").update({ combate: camp.combate }).eq("id", id); if (error) alert("Não consegui salvar o combate: " + error.message); };
  if (!Array.isArray(camp.bestiario)) camp.bestiario = [];
  if (!camp.combate_nave || typeof camp.combate_nave !== "object" || !("inimigas" in camp.combate_nave)) camp.combate_nave = combateNaveVazio();
  if (!camp.faccoes || typeof camp.faccoes !== "object") camp.faccoes = {};
  if (!Array.isArray(camp.contratos)) camp.contratos = [];
  if (!camp.handout || typeof camp.handout !== "object") camp.handout = {};
  const salvarBestiario = async () => { const { error } = await sb.from("campanhas").update({ bestiario: camp.bestiario }).eq("id", id); if (error) alert("Não consegui salvar o bestiário: " + error.message); };

  const enviar = async (tipo, conteudo, payload = null) => {
    if (asCegas && souMestre && tipo === "rolagem") {   // às cegas: fica só na tela do Mestre
      const p = payload || {};
      await modalForm({ titulo: "🙈 Rolagem às cegas", campos: [
        { k: "i", label: `${p.titulo || "Rolagem"} — ${p.detalhe || ""}${p.total != null ? `  =  ${p.total}` : ""}${p.extra ? "\n" + p.extra : ""}`, tipo: "info" }], okLabel: "Fechar" });
      return true;
    }
    const { data, error } = await sb.from("mensagens").insert({ campanha_id: id, autor_id: usuario.id, personagem_id: meuPers?.id || null, tipo, conteudo, payload }).select("*,perfis:autor_id(apelido,avatar_url)").single();
    if (error) { alert("Não consegui transmitir: " + error.message); return false; }
    pintarMsg?.(data, true); // mostra na hora, sem depender do realtime voltar
    return true;
  };

  const rolarEEnviar = (titulo, mod, extras = {}) => {
    let nat, detVant = "";
    if (vantagem !== 0) { const a = d(20), b = d(20); nat = vantagem > 0 ? Math.max(a, b) : Math.min(a, b); detVant = ` [${vantagem > 0 ? "vant" : "desv"} ${a}/${b}]`; }
    else nat = d(20);
    const total = nat + mod;
    return enviar("rolagem", null, { titulo: (privada ? "🔒 " : "") + titulo, detalhe: `d20 [${nat}]${detVant} ${sign(mod)}`, total, crit: nat === 20, fumble: nat === 1, ...(privada ? { privada: true } : {}), ...extras });
  };

  const render = async () => {
    if (canalMesa) { sb.removeChannel(canalMesa); canalMesa = null; }
    const f = meuPers ? { ...novaFichaDados(), ...meuPers.dados } : null;
    const k = f ? calc(f) : null;
    const armasEq = f ? (f.inventario || []).filter((i) => i.tipo === "arma" && i.equip) : [];
    const nave = camp.nave;
    const meuPosto = membros?.find((m) => m.perfil_id === usuario.id)?.posto;
    const cbn = camp.combate_nave || combateNaveVazio();
    shell("mesa", `
      <nav class="topo"><a class="btn-ghost" href="#/campanhas">← CAMPANHAS</a>
        <div class="topo-status">${esc(camp.nome)} · código <b class="chrome">${camp.codigo}</b></div><span style="display:flex;gap:6px"><button id="abrir-diario" class="btn-ghost" title="Diário da campanha">📔 DIÁRIO</button>${souMestre ? `<button id="abrir-mestre" class="btn-ghost" title="Tela do Mestre">🎛 MESTRE</button>` : ""}<button id="abrir-mapa" class="btn-ghost" title="Mapa do sistema (compartilhado)">🗺 MAPA</button></span></nav>
      <div class="mesa">
        <div class="mesa-lateral">
          <nav class="mesa-abas" role="tablist">
            <button class="mesa-aba ${abaMesa === "ficha" ? "on" : ""}" data-mesa-aba="ficha" role="tab">◈ <span>Ficha</span></button>
            <button class="mesa-aba ${abaMesa === "combate" ? "on" : ""}" data-mesa-aba="combate" role="tab">⚔ <span>Combate</span>${camp.combate.ativo ? `<i class="aba-dot"></i>` : ""}</button>
            <button class="mesa-aba ${abaMesa === "nave" ? "on" : ""}" data-mesa-aba="nave" role="tab">🚀 <span>Nave</span>${cbn.ativo ? `<i class="aba-dot"></i>` : ""}</button>
            <button class="mesa-aba ${abaMesa === "mesa" ? "on" : ""}" data-mesa-aba="mesa" role="tab">📋 <span>Mesa</span></button>
          </nav>
          <div class="mesa-painel" ${abaMesa === "combate" ? "" : "hidden"}>
          ${(camp.combate.ativo || souMestre) ? `<section class="sec combate-sec">
            <header><span class="tag">⚔</span><h2>Combate</h2>${camp.combate.ativo ? `<span class="regra" style="margin-left:auto">Rodada ${camp.combate.rodada}</span>` : ""}</header>
            ${!camp.combate.ativo ? (souMestre ? `<button id="cb-iniciar" class="mini eq">⚔ Iniciar Combate</button><p class="regra">Adicione jogadores e inimigos do bestiário; a ordem é montada pela iniciativa.</p>` : "") : `
            <div class="cb-lista">${camp.combate.ordem.map((c, i) => `
              <div class="cb-linha ${i === camp.combate.turno ? "cb-atual" : ""} ${foraDeCombate(c) ? "cb-morto" : ""} ${ehNave(c) ? "cb-nave" : ""}">
                <span class="cb-ini" title="Iniciativa">${c.ini}</span>
                <span class="cb-nome">${i === camp.combate.turno ? "▶ " : ""}${ehNave(c) ? "🚀 " : ""}${esc(c.nome)}${c.tipo === "inimigo" ? ` <i class="dim">${esc(c.ameaca || "")}</i>` : ""}${ehNave(c) ? ` <i class="dim">Def ${10 + (c.manobra || 0)}</i>` : ""}${(c.cond && c.cond.length) ? `<span class="cb-conds">${c.cond.map((cd) => `<span class="cb-cond" title="${esc(cd.n)} · ${cd.turnos} turno(s)">${esc(cd.n)} ${cd.turnos}</span>`).join("")}</span>` : ""}</span>
                <span class="cb-hp" title="${ehNave(c) ? "Casco" : "Vida"}"><span class="cb-hp-barra" style="width:${Math.max(0, Math.min(100, vidaMax(c) ? vidaAtual(c) / vidaMax(c) * 100 : 0))}%;background:${(c.tipo === "inimigo" || c.lado === "inimiga") ? "var(--perigo)" : ehNave(c) ? "var(--chrome)" : "var(--tech)"}"></span><b>${vidaAtual(c)}/${vidaMax(c)}</b></span>${ehNave(c) ? `<span class="cb-hp" title="Escudos"><span class="cb-hp-barra" style="width:${Math.max(0, Math.min(100, c.escudos_max ? c.escudos / c.escudos_max * 100 : 0))}%;background:var(--tech)"></span><b>${c.escudos}/${c.escudos_max}</b></span>` : ""}
                ${souMestre ? `<span class="cb-acoes">${c.tipo === "inimigo" && c.ataques ? c.ataques.map((atk, ai) => `<button class="cb-atk" data-cb="${c.id}" data-atk="${ai}" title="Rolar: ${esc(atk.n)}">⚔${c.ataques.length > 1 ? ai + 1 : ""}</button>`).join("") : ""}${(ehNave(c) && c.lado === "inimiga") ? `<button class="cb-atk" data-cb-nave="${c.id}" title="Esta nave dispara">⚔</button>` : ""}<button class="cb-dmg" data-cb="${c.id}" data-d="-5">−5</button><button class="cb-dmg" data-cb="${c.id}" data-d="5">+5</button><input class="cb-hpset" data-cb="${c.id}" type="number" value="${vidaAtual(c)}" style="width:46px" title="${ehNave(c) ? "definir Casco" : "definir HP"}"><button class="cb-hpset-lbl cb-cond-add" data-cb="${c.id}" title="Adicionar condição">🏷</button><button class="cb-rm" data-cb="${c.id}" title="remover">✕</button></span>` : ""}
              </div>`).join("")}</div>
            ${(camp.combate.avarias || []).length ? `<div class="avarias">${camp.combate.avarias.map((av, ai) => `<div class="avaria"><b>⚠ ${esc(av.n)}</b> <span class="regra">${esc(av.e)}</span>${souMestre ? `<button class="mini rm" data-av-fix2="${ai}">✔</button>` : ""}</div>`).join("")}</div>` : ""}
            ${camp.combate.ordem.some((x) => x.nave_party) ? `<p class="regra cbn-postos">Postos: ${POSTOS_ORDEM.map((pk) => { const q2 = (membros || []).find((m) => m.posto === pk); const ag = (camp.combate.agiram || []).includes(pk);
              return `<span class="cbn-posto ${ag ? "ok" : ""} ${q2 ? "" : "vazio"}">${esc(ESTACOES[pk].n.split(" ")[0])}${ag ? " ✓" : ""}</span>`; }).join(" ")}</p>` : ""}
            ${souMestre ? `<div class="cb-add">
              <select id="cb-quem"><optgroup label="Jogadores">${(pers || []).map((p) => `<option value="j:${p.id}">${esc(p.nome) || "sem nome"}</option>`).join("")}</optgroup>${camp.bestiario.length ? `<optgroup label="Minhas criaturas">${camp.bestiario.map((b, ci) => `<option value="c:${ci}">${esc(b.n)} · ${b.ameaca}</option>`).join("")}</optgroup>` : ""}<optgroup label="Inimigos (bestiário)">${BESTIARIO.map((b, bi) => b.ambiental ? "" : `<option value="e:${bi}">${esc(b.n)} · ${b.ameaca}</option>`).join("")}</optgroup>${camp.nave ? `<optgroup label="Nossa nave"><option value="np:party">🚀 ${esc(camp.nave.nome_batismo || camp.nave.modelo)}</option></optgroup>` : ""}<optgroup label="Naves inimigas">${NAVES.map((n, ni) => `<option value="ni:${ni}">🚀 ${esc(n.n)}</option>`).join("")}</optgroup></select>
              <button id="cb-add-btn" class="mini">🎲 Add</button><button id="cb-criar" class="mini" title="Criar/editar criaturas do Mestre">🐉</button></div>
            <div class="cb-ctrl"><button id="cb-undo" class="mini" title="Desfazer a última ação">↶</button><button id="cb-prox" class="mini eq">▶ Próximo turno</button><button id="cb-timer" class="mini" title="Cronômetro do turno">⏱</button><button id="cb-fim" class="mini rm">⏹ Encerrar</button></div><div id="cb-timer-out" class="cb-timer"></div>` : ""}`}
          </section>` : ""}
          </div>
          <div class="mesa-painel" ${abaMesa === "ficha" ? "" : "hidden"}>
          <section class="sec"><header><span class="tag">◈</span><h2>Meu personagem</h2></header>
            <select id="sel-pers">${meuPers ? "" : `<option value="">— vincular personagem —</option>`}
              ${(meus || []).map((m) => `<option value="${m.id}" ${meuPers?.id === m.id ? "selected" : ""}>${esc(m.nome) || "sem nome"}</option>`).join("")}</select>
            ${f ? `<p class="regra">PV ${f.pvAtual}/${f.pvMax} · CD ${k.cd} · RAM ${k.ramLivre}/${k.ramMax} · conj +${k.conj}</p>
            ${(() => { const pentes = f.pentes ?? PENTES_INICIAIS, cap = pentes * TURNOS_POR_PENTE, us = f.municaoUsada || 0, resta = Math.max(0, cap - us);
              const nivel = resta === 0 ? "vazio" : resta <= 3 ? "critico" : resta <= 6 ? "baixo" : "";
              const pips = Array.from({ length: cap }, (_, i2) => `<i class="pip ${i2 < resta ? "cheio" : ""} ${(i2 + 1) % TURNOS_POR_PENTE === 0 ? "fim-pente" : ""}"></i>`).join("");
              return `<div class="municao-box ${nivel}">
                <div class="municao-cab"><span>🔫 Munição</span><b>${resta}<span class="dim">/${cap}</span></b>
                  <button id="recarregar" class="mini" title="Recarrega todos os pentes (Ação de Movimento)">↻ Recarregar</button></div>
                <div class="pips">${pips}</div>
                <p class="municao-msg">${resta === 0 ? "⛔ SEM MUNIÇÃO — recarregue antes de atirar (Ação de Movimento)."
                  : resta <= 3 ? `⚠ Últimos ${resta} tiro${resta > 1 ? "s" : ""}! Considere recarregar.`
                  : `${pentes} pente${pentes > 1 ? "s" : ""} · ${TURNOS_POR_PENTE} turnos cada`}</p>
              </div>`; })()}
            <div class="acoes-mesa">
              <select id="sel-per">${PERICIAS.map(([pn]) => `<option>${pn}</option>`).join("")}</select>
              <button id="rolar-per" class="mini">TESTE</button>
              ${armasEq.length ? `<label class="chk" style="margin:0" title="Ataque furtivo: +2 no acerto (armas Ocultas / Assassino) e dano DOBRADO para o Assassino."><input type="checkbox" id="atq-furtivo"/> 🥷 Furtivo</label>` : ""}
              ${armasEq.map((a, i) => { const cat = ARMAS.find((x) => x.n === a.nome); const pr = cat ? propsArma(cat) : {};
                const tip = [cat?.kw ? `${cat.kw}: ${pr.efeito}` : "", pr.area ? `Área: ${pr.areaTxt}` : "", pr.alcance ? `Alcance: ${pr.alcanceTxt}` : "", pr.agil ? "Ágil (Des)" : ""].filter(Boolean).join(" · ");
                return `<button class="mini atq" data-atq="${i}" title="${esc(tip)}">⚔ ${esc(a.nome)} (${cat ? danoArma(cat, f.nivel) : "—"})${pr.area ? " ◎" : ""}${pr.agil ? " ⚡" : ""}</button>`; }).join("")}
              <select id="sel-scr">${(f.deck.length ? SCRIPTS.filter((s) => f.deck.includes(s.n)) : SCRIPTS.filter((s) => s.c === 0)).map((s) => `<option>${esc(s.n)}</option>`).join("")}</select>
              <button id="conjurar" class="mini">⚡ CONJURAR</button>
              <input id="dado-livre" placeholder="1d20+2d10" style="width:80px"/><button id="rolar-livre" class="mini">🎲</button>
            </div>
            <div class="acoes-mesa"><b class="chrome">Direcionar dano:</b>
              <select id="sel-alvo">${(pers || []).map((x) => `<option value="${x.id}">${esc(x.nome)}</option>`).join("")}</select>
              <input id="dano-val" type="number" placeholder="valor" style="width:70px"/>
              <button id="enviar-dano" class="mini dano">💥 DANO</button><button id="enviar-cura" class="mini eq">✚ CURA</button></div>` : `<p class="regra">Vincule um personagem para rolar pela mesa.</p>`}
          </section>
          </div>
          <div class="mesa-painel" ${abaMesa === "nave" ? "" : "hidden"}>
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
              ${(cbn.avarias || []).length ? `<div class="avarias">${cbn.avarias.map((av, ai) => `<div class="avaria"><b>⚠ ${esc(av.n)}</b> <span class="regra">${esc(av.e)}</span>${souMestre ? `<button class="mini rm" data-av-fix="${ai}" title="Consertar">✔</button>` : ""}</div>`).join("")}</div>` : ""}
              ${souMestre ? `<div class="acoes-mesa"><input id="nave-dano" type="number" placeholder="dano" style="width:70px"/><button id="nave-hit" class="mini dano">💥 NAVE SOFRE</button><button id="nave-upg" class="mini">🔧 Upgrades</button></div>` : ""}
              ${(cbn.ativo && !camp.combate.ordem.some((x) => ehNave(x))) ? `
                <div class="cbn-box">
                  <div class="cbn-cab"><b>🚀 COMBATE ESPACIAL</b><span class="regra">Rodada ${cbn.rodada}</span></div>
                  ${(cbn.inimigas || []).map((x, xi) => `<div class="cb-linha ${x.casco <= 0 ? "cb-morto" : ""}">
                    <span class="cb-nome"><b>${esc(x.nome)}</b> <span class="dim">Def ${10 + (x.manobra || 0)} · ${esc(x.dano)}</span></span>
                    <span class="cb-hp" title="Casco"><span class="cb-hp-barra" style="width:${x.casco_max ? Math.max(0, 100 * x.casco / x.casco_max) : 0}%;background:var(--chrome)"></span><b>${x.casco}/${x.casco_max}</b></span>
                    <span class="cb-hp" title="Escudos"><span class="cb-hp-barra" style="width:${x.escudos_max ? Math.max(0, 100 * x.escudos / x.escudos_max) : 0}%;background:var(--tech)"></span><b>${x.escudos}/${x.escudos_max}</b></span>
                    ${souMestre ? `<span class="cb-acoes"><button class="cbn-atk" data-cbn-atk="${xi}" title="Esta nave dispara contra a tripulação">⚔</button><button class="cb-rm" data-cbn-rm="${xi}">✕</button></span>` : ""}
                  </div>`).join("") || `<p class="regra">Nenhuma nave inimiga em campo.</p>`}
                  <p class="regra cbn-postos">Postos: ${POSTOS_ORDEM.map((pk) => { const quem = (membros || []).find((m) => m.posto === pk); const agiu = (cbn.agiram || []).includes(pk);
                    return `<span class="cbn-posto ${agiu ? "ok" : ""} ${quem ? "" : "vazio"}" title="${quem ? esc(quem.perfis?.apelido || "") : "vago"}">${esc(ESTACOES[pk].n.split(" ")[0])}${agiu ? " ✓" : ""}</span>`; }).join(" ")}</p>
                  ${souMestre ? `<div class="filtros"><button id="cbn-add" class="mini">➕ Nave inimiga</button><button id="cbn-prox" class="mini eq">▶ Próxima rodada</button><button id="cbn-fim" class="mini rm">⏹ Encerrar</button></div>` : ""}
                </div>` : (souMestre ? `<p class="regra" style="margin-top:8px">⚔ Para uma batalha espacial, abra a aba <b>Combate</b> e adicione a nossa nave e as inimigas ao rastreador — a iniciativa é a mesma do combate pessoal.</p>` : "")}
            ` : souMestre ? `
              <select id="sel-nave">${NAVES.map((n) => `<option>${esc(n.n)}</option>`).join("")}</select>
              <input id="nave-nome" placeholder="Nome de batismo"/>
              <button id="def-nave" class="btn-primario" style="margin-top:8px">DEFINIR NAVE</button>` : `<p class="regra">O Mestre ainda não definiu a nave.</p>`}
          </section>
          </div>
          <div class="mesa-painel" ${abaMesa === "mesa" ? "" : "hidden"}>
          ${(camp.contratos?.length || Object.keys(camp.faccoes || {}).length) ? `<section class="sec"><header><span class="tag">📋</span><h2>Contratos & Reputação</h2></header>
            ${(camp.contratos || []).filter((c) => c.status !== "concluido").map((c) => `<div class="inv"><span><b>${esc(c.titulo)}</b> <span class="best-tag">${esc(c.status)}</span><br><span class="regra">${esc(c.recompensa)}${c.faccao ? ` · ${esc(c.faccao)}` : ""}</span></span></div>`).join("") || `<p class="regra">Nenhum contrato aberto.</p>`}
            ${Object.entries(camp.faccoes || {}).filter(([, v]) => v !== 0).map(([n, v]) => { const nv = NIVEIS_REPUTACAO.find((x) => x.v === v) || NIVEIS_REPUTACAO[3];
              return `<p class="regra">${esc(n)}: <b style="color:${nv.cor}">${esc(nv.n)}</b></p>`; }).join("")}
          </section>` : ""}
          <section class="sec"><header><span class="tag">🩺</span><h2>Estado da tripulação</h2></header>
            ${(pers || []).length ? (pers || []).map((x) => { const fx = { ...novaFichaDados(), ...(x.dados || {}) }; const kx = calc(fx);
              const pv = fx.pvMax ? Math.max(0, Math.min(100, 100 * fx.pvAtual / fx.pvMax)) : 0;
              const ram = kx.ramMax ? Math.max(0, Math.min(100, 100 * kx.ramLivre / kx.ramMax)) : 0;
              const crit = fx.pvAtual <= 0 ? "morto" : (fx.pvMax && fx.pvAtual / fx.pvMax <= 0.3) ? "ferido" : "";
              return `<div class="pf-linha ${crit}">
                <span class="pf-nome">${esc(x.nome) || "sem nome"}${fx.pvAtual <= 0 ? " ☠" : ""}</span>
                <span class="cb-hp" title="Pontos de Vida"><span class="cb-hp-barra" style="width:${pv}%;background:${crit === "ferido" ? "var(--perigo)" : "var(--tech)"}"></span><b>${fx.pvAtual}/${fx.pvMax}</b></span>
                <span class="cb-hp" title="RAM"><span class="cb-hp-barra" style="width:${ram}%;background:var(--sombra)"></span><b>${kx.ramLivre}/${kx.ramMax}</b></span>
              </div>`; }).join("") : `<p class="regra">Nenhum personagem vinculado ainda.</p>`}
          </section>
          <section class="sec"><header><span class="tag">👥</span><h2>Tripulação</h2></header>
            ${(membros || []).map((m) => `<p class="regra">${esc(m.perfis?.apelido)}${m.posto ? ` · ${ESTACOES[m.posto]?.n}` : ""}${m.perfil_id === camp.mestre_id ? " · MESTRE" : ""}</p>`).join("")}
          </section>
          <section class="sec"><header><span class="tag">📊</span><h2>Registros da mesa</h2></header>
            <p class="regra">Consulte o que já rolou nesta campanha.</p>
            <div class="filtros"><button id="abrir-stats" class="mini">📊 Estatísticas de rolagem</button><button id="ir-diario" class="mini">📔 Diário</button></div>
            <div class="filtros" style="margin-top:6px"><button id="copiar-convite" class="mini">🔗 Copiar convite</button></div>
          </section>
          </div>
        </div>
        <section class="sec mesa-chat">
          <header><span class="tag">≣</span><h2>Mesa · transmissão ao vivo</h2></header>
          ${camp.handout?.visivel && camp.handout?.url ? `<div class="handout"><div class="handout-cab"><b>🖼 ${esc(camp.handout.titulo || "O Mestre mostra algo")}</b><a href="${esc(camp.handout.url)}" target="_blank" rel="noopener" class="mini">abrir</a></div><img src="${esc(camp.handout.url)}" alt="${esc(camp.handout.titulo || "imagem compartilhada pelo Mestre")}"/></div>` : ""}
          <div id="chat" class="chat"></div>
          <div id="resp-preview" class="resp-preview" style="display:none"><span class="rp-txt"></span><button id="resp-cancel" class="rp-x" title="Cancelar resposta">✕</button></div>
          <button id="abrir-stats-oculto" class="sr-only">Estatísticas de rolagem</button>
          <div class="rol-toggles"><span class="regra" style="margin:0">Rolagem:</span>
            <button id="tg-vant" class="mini" title="Vantagem: rola 2d20, pega o maior">▲ Vantagem</button>
            <button id="tg-desv" class="mini" title="Desvantagem: rola 2d20, pega o menor">▼ Desvantagem</button>
            <button id="tg-priv" class="mini" title="Privado: só o Mestre e você veem o resultado">🔒 Privado</button>${souMestre ? `<button id="tg-cega" class="mini" title="Às cegas: o resultado aparece só para você, e não entra no chat da mesa">🙈 Às cegas</button>` : ""}
            <button id="tg-som" class="mini" title="Ligar/desligar som e notificações" style="margin-left:auto"></button></div>
          <div class="linha-add"><input id="msg" placeholder="Mensagem ou rolagem: /1d20 · /r2d6+1 · /1d20+2d10"/><button id="enviar-msg" class="btn-primario">▶</button></div>
        </section>
      </div>`, "campanhas");

    // ---- chat render ----
    const chatEl = $("#chat");
    const idsVistos = new Set();
    let ultimoAutor = null;      // para espaçar quando muda quem fala
    let respondendoA = null;     // mensagem sendo referenciada
    const resumoMsg = (m) => {
      if (m.tipo === "rolagem") return `🎲 ${m.payload?.titulo || "rolagem"}${m.payload?.total !== undefined ? ` = ${m.payload.total}` : ""}`;
      if (m.tipo === "dano" || m.tipo === "cura") return `${m.tipo === "dano" ? "💥" : "✚"} ${m.payload?.valor} em ${m.payload?.alvo_nome || ""}`;
      return (m.conteudo || "").slice(0, 70);
    };
    const iniciarResp = (m) => {
      respondendoA = { id: m.id, quem: m.perfis?.apelido || "?", resumo: resumoMsg(m) };
      const bar = $("#resp-preview");
      if (bar) { bar.querySelector(".rp-txt").innerHTML = `↩ Respondendo a <b>${esc(respondendoA.quem)}</b>: <span class="rp-resumo">${esc(respondendoA.resumo)}</span>`; bar.style.display = "flex"; }
      $("#msg")?.focus();
    };
    const cancelarResp = () => { respondendoA = null; const bar = $("#resp-preview"); if (bar) bar.style.display = "none"; };
    const addMsg = (m, aoVivo = false) => {
      if (idsVistos.has(m.id)) return; idsVistos.add(m.id);
      if (m.payload?.privada && m.autor_id !== usuario.id && !souMestre) return; // rolagem privada: só autor + Mestre
      if (aoVivo && !historico.some((x) => x.id === m.id)) historico.push(m); // persiste entre re-renders
      if (aoVivo && m.autor_id !== usuario.id && m.tipo !== "sistema") { // alerta de mensagem de outra pessoa
        if (m.tipo === "rolagem") somDado(); else somMensagem();
        notificar(`${m.perfis?.apelido || "Mesa"} · ${esc(camp.nome)}`, m.tipo === "rolagem" ? `🎲 ${m.payload?.titulo || "rolagem"}${m.payload?.total != null ? " = " + m.payload.total : ""}` : (m.conteudo || "").slice(0, 80));
      }
      const quem = esc(m.perfis?.apelido || "?");
      const persN = m.personagem_id ? esc(pers?.find((x) => x.id === m.personagem_id)?.nome || "") : "";
      let corpo = "";
      if (m.tipo === "texto" || m.tipo === "sistema") corpo = `<div class="m-txt ${m.tipo}">${esc(m.conteudo)}</div>`;
      else if (m.tipo === "rolagem") { const p = m.payload || {};
        corpo = `<div class="m-roll ${p.crit ? "crit" : ""} ${p.fumble ? "fumble" : ""}">
          <b>${esc(p.titulo)}</b><span class="m-det">${esc(p.detalhe)}</span>
          ${p.total !== undefined && p.total !== null ? `<span class="m-total">${p.total}</span>` : ""}
          ${p.crit ? `<span class="log-flag crit">CRÍTICO!</span>` : ""}${p.fumble ? `<span class="log-flag fumble">FALHA CRÍTICA</span>` : ""}
          ${p.extra ? `<span class="m-extra">${esc(p.extra)}</span>` : ""}
          ${p.dano_total != null && souMestre && camp.combate.ativo ? `<button class="m-aplicar" data-dano="${p.dano_total}">🩸 aplicar ${p.dano_total} de dano</button>` : ""}</div>`; }
      else if (m.tipo === "dano" || m.tipo === "cura") { const p = m.payload || {};
        const meu = pers?.find((x) => x.id === p.alvo_id)?.dono_id === usuario.id;
        corpo = `<div class="m-roll ${m.tipo === "dano" ? "fumble" : "crit"}"><b>${m.tipo === "dano" ? "💥" : "✚"} ${p.valor} em ${esc(p.alvo_nome)}</b>
          <span class="m-det">${esc(p.origem || "")}</span>
          ${p.aplicado ? `<span class="m-extra">aplicado ✓</span>` : meu ? `<button class="mini ${m.tipo === "dano" ? "dano" : "eq"}" data-aplicar="${m.id}">APLICAR ${m.tipo === "dano" ? "−" : "+"}${p.valor} PV</button>` : `<span class="m-extra">aguardando o dono aplicar…</span>`}</div>`; }
      else if (m.tipo === "nave") corpo = `<div class="m-txt sistema">🚀 ${esc(m.conteudo)}</div>`;
      else if (m.tipo === "descanso") { const p = m.payload || {}; corpo = `<div class="m-txt sistema">${p.tipo === "longo" ? "🌙" : "☾"} ${esc(m.conteudo)}</div>`; }
      else if (m.tipo === "recompensa") { corpo = `<div class="m-txt sistema">🎁 ${esc(m.conteudo)}</div>`; }
      const el = document.createElement("div");
      const persMsg = m.personagem_id ? pers?.find((x) => x.id === m.personagem_id) : null;
      const av = persMsg?.dados?.foto || m.perfis?.avatar_url || null;
      const avatarHtml = av ? `<img class="m-avatar" src="${esc(av)}" alt=""/>` : `<div class="m-avatar vazia">◈</div>`;
      const minha = m.autor_id === usuario.id;
      const novaPessoa = m.autor_id !== ultimoAutor; ultimoAutor = m.autor_id;
      const resp = m.payload?.resp;
      const respHtml = resp ? `<div class="m-quote" data-goto="${esc(resp.id)}">↩ <b>${esc(resp.quem)}</b>: ${esc(resp.resumo)}</div>` : "";
      el.className = "m" + (minha ? " minha" : "") + (novaPessoa ? " nova-pessoa" : "");
      el.dataset.mid = m.id;
      el.innerHTML = `${avatarHtml}<div class="m-corpo"><div class="m-cab">${quem}${persN ? ` <i>como ${persN}</i>` : ""} <time>${new Date(m.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time><button class="m-reply" data-reply title="Responder">↩</button></div>${respHtml}${corpo}</div>`;
      chatEl.appendChild(el); chatEl.scrollTop = chatEl.scrollHeight;
      el.querySelector("[data-reply]")?.addEventListener("click", () => iniciarResp(m));
      el.querySelector(".m-aplicar")?.addEventListener("click", async () => {
        if (!camp.combate.ativo || !camp.combate.ordem.length) return alert("Nenhum combate ativo com combatentes.");
        const dano = +el.querySelector(".m-aplicar").dataset.dano;
        const r = await modalForm({ titulo: `🩸 Aplicar ${dano} de dano`, campos: [{ k: "alvo", label: "Alvo", tipo: "select", opcoes: camp.combate.ordem.map((c) => ({ v: c.id, l: `${c.nome} (${c.hp}/${c.hp_max})` })) }], okLabel: "Aplicar" });
        if (!r) return; const alvo = camp.combate.ordem.find((c) => c.id === r.alvo); if (!alvo) return;
        alvo.hp = Math.max(0, alvo.hp - dano);
        enviar("sistema", `💥 ${alvo.nome} sofreu ${dano} de dano (${alvo.hp}/${alvo.hp_max}).`);
        await salvarCombate(); render();
      });
      el.querySelector("[data-goto]")?.addEventListener("click", () => {
        const alvo = chatEl.querySelector(`[data-mid="${resp.id}"]`);
        if (alvo) { alvo.scrollIntoView({ behavior: "smooth", block: "center" }); alvo.classList.add("piscar"); setTimeout(() => alvo.classList.remove("piscar"), 1200); }
      });
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
      if (aoVivo && m.tipo === "recompensa" && meuPers) {
        (async () => {
          const dados = { ...novaFichaDados(), ...meuPers.dados }; const p = m.payload || {}; const notas = [];
          if (p.xp) { dados.xp = (dados.xp || 0) + p.xp; notas.push(`+${p.xp} XP (${dados.xp}/${dados.xpMeta})`); }
          if (p.creditos) { dados.creditos = (dados.creditos || 0) + p.creditos; notas.push(`+${p.creditos} CG (${dados.creditos})`); }
          dados.log = [{ q: new Date().toISOString(), t: `🎁 Recompensa do Mestre: ${notas.join(" · ")}` }, ...(dados.log || [])].slice(0, 60);
          const { error } = await sb.from("personagens").update({ dados }).eq("id", meuPers.id);
          if (!error) { meuPers.dados = dados; await enviar("sistema", `🎖 ${meuPers.nome}: ${notas.join(" · ")}${dados.metodoNivel === "xp" && dados.xp >= dados.xpMeta ? " — PRONTO PARA SUBIR!" : ""}`); }
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
        (pl) => { camp.nave = pl.new.nave; camp.mapa = pl.new.mapa; camp.combate = pl.new.combate; camp.combate_nave = pl.new.combate_nave || combateNaveVazio(); camp.handout = pl.new.handout || {}; camp.faccoes = pl.new.faccoes || {}; camp.contratos = pl.new.contratos || []; camp.bestiario = pl.new.bestiario || []; mapaCtrl?.atualizar(pl.new.mapa, pl.new.combate); render(); })
      .subscribe();

    // ---- binds ----
    $("#enviar-msg").onclick = () => { const t = $("#msg").value.trim(); if (!t) return; $("#msg").value = "";
      const resp = respondendoA; cancelarResp();
      const rr = /^\/(?:r(?:olar)?)?\s*(.+)$/i.exec(t);
      if (rr) { const r = rolarExpr(rr[1]); if (r) {
        return enviar("rolagem", null, { titulo: (privada ? "🔒 " : "") + `Rolagem ${rr[1]}`, detalhe: r.detalhe, total: r.total, ...(privada ? { privada: true } : {}), ...(resp ? { resp } : {}) }); } }
      enviar("texto", t, resp ? { resp } : null); };
    $("#resp-cancel")?.addEventListener("click", cancelarResp);
    const syncTg = () => { $("#tg-vant")?.classList.toggle("on", vantagem > 0); $("#tg-desv")?.classList.toggle("on", vantagem < 0); $("#tg-priv")?.classList.toggle("on", privada); $("#tg-cega")?.classList.toggle("on", asCegas); };
    $("#tg-vant")?.addEventListener("click", () => { vantagem = vantagem > 0 ? 0 : 1; syncTg(); });
    $("#tg-desv")?.addEventListener("click", () => { vantagem = vantagem < 0 ? 0 : -1; syncTg(); });
    $("#tg-priv")?.addEventListener("click", () => { privada = !privada; syncTg(); });
    $("#tg-cega")?.addEventListener("click", () => { asCegas = !asCegas; syncTg(); });
    const syncSom = () => { const b = $("#tg-som"); if (b) b.textContent = getSom() ? "🔔 Som" : "🔕 Mudo"; };
    $("#tg-som")?.addEventListener("click", () => { setSom(!getSom()); if (getSom()) { pedirNotificacao(); somMensagem(); } syncSom(); });
    syncSom();
    syncTg();
    $("#msg").onkeydown = (e) => { if (e.key === "Enter") $("#enviar-msg").click(); else if (e.key === "Escape") cancelarResp(); };
    $("#mestre-curto")?.addEventListener("click", () => { if (confirm("Convocar Descanso Curto para toda a mesa? Cada jogador conectado recupera as habilidades de descanso curto no próprio personagem.")) enviar("descanso", "O Mestre convocou um Descanso Curto (1h). Habilidades de descanso curto reiniciadas; cura via Kits Médicos.", { tipo: "curto" }); });
    $("#mestre-longo")?.addEventListener("click", () => { if (confirm("Convocar Descanso Longo para toda a mesa? Cada jogador conectado tem PV restaurados, RAM recarregada e todas as habilidades reiniciadas.")) enviar("descanso", "O Mestre convocou um Descanso Longo (8h). PV restaurados, RAM recarregada e todas as habilidades reiniciadas.", { tipo: "longo" }); });
    $("#mestre-xp")?.addEventListener("click", async () => { const r = await modalForm({ titulo: "🎖 Conceder XP", descricao: "Todos os jogadores conectados com personagem vinculado recebem.", campos: [{ k: "xp", label: "Quantidade de XP", tipo: "numero", valor: 500, min: 1 }], okLabel: "Conceder" }); if (!r || !r.xp || r.xp <= 0) return; enviar("recompensa", `O Mestre concedeu ${r.xp} XP à tripulação.`, { xp: r.xp }); });
    $("#mestre-cg")?.addEventListener("click", async () => { const r = await modalForm({ titulo: "🎁 Conceder Créditos", descricao: "Saque distribuído a toda a tripulação conectada.", campos: [{ k: "cg", label: "Créditos (CG)", tipo: "numero", valor: 1000, min: 1 }], okLabel: "Distribuir" }); if (!r || !r.cg || r.cg <= 0) return; enviar("recompensa", `O Mestre distribuiu ${r.cg} CG de saque à tripulação.`, { creditos: r.cg }); });
    $("#handout-btn")?.addEventListener("click", async () => {
      const r = await modalForm({ titulo: "🖼 Mostrar imagem para a mesa", campos: [
        { k: "i", label: "Cole o endereço de uma imagem (mapa da sala, documento, retrato de NPC). Ela aparece no topo do chat de todos.", tipo: "info" },
        { k: "url", label: "URL da imagem", tipo: "texto", valor: camp.handout?.url || "" },
        { k: "titulo", label: "Legenda (opcional)", tipo: "texto", valor: camp.handout?.titulo || "" },
      ], okLabel: "Mostrar" });
      if (!r || !r.url) return;
      camp.handout = { url: r.url.trim(), titulo: (r.titulo || "").trim(), visivel: true };
      const { error } = await sb.from("campanhas").update({ handout: camp.handout }).eq("id", id);
      if (error) return alert("Não consegui compartilhar: " + error.message);
      await enviar("sistema", `🖼 O Mestre mostrou uma imagem${r.titulo ? `: ${r.titulo}` : ""}.`);
      render();
    });
    $("#handout-off")?.addEventListener("click", async () => {
      camp.handout = { ...(camp.handout || {}), visivel: false };
      await sb.from("campanhas").update({ handout: camp.handout }).eq("id", id);
      render();
    });
    const fazerBackup = async () => {
      const [{ data: msgs2 }, { data: membros2 }, { data: pers2 }] = await Promise.all([
        sb.from("mensagens").select("*").eq("campanha_id", id).order("criado_em", { ascending: true }).limit(5000),
        sb.from("campanha_membros").select("*").eq("campanha_id", id),
        sb.from("personagens").select("*").eq("campanha_id", id),
      ]);
      const backup = { formato: "passagem-sombria/campanha", versao: 1, exportado_em: new Date().toISOString(),
        campanha: { nome: camp.nome, codigo: camp.codigo, nave: camp.nave, mapa: camp.mapa, combate: camp.combate, bestiario: camp.bestiario },
        membros: membros2 || [], personagens: pers2 || [], mensagens: msgs2 || [] };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const a2 = document.createElement("a");
      a2.href = url; a2.download = `campanha-${(camp.nome || "mesa").replace(/[^\w-]/g, "_")}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a2); a2.click(); a2.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
      $("#st") && ($("#st").textContent = "Backup baixado ✓");
    };
    const restaurarBackup = () => {
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/json,.json";
      inp.onchange = async () => {
        const arq = inp.files?.[0]; if (!arq) return;
        let b; try { b = JSON.parse(await arq.text()); } catch { return alert("Arquivo inválido: não é um JSON legível."); }
        if (b?.formato !== "passagem-sombria/campanha") return alert("Este arquivo não é um backup de campanha do Passagem Sombria.");
        const ok = await confirmModal(`Restaurar o estado desta campanha a partir do backup de ${new Date(b.exportado_em).toLocaleDateString("pt-BR")}?\n\nIsso substitui a NAVE, o MAPA, o COMBATE e o BESTIÁRIO do Mestre pelos do arquivo. As mensagens e as fichas dos jogadores NÃO são tocadas.`, { okLabel: "Restaurar", perigo: true });
        if (!ok) return;
        const c = b.campanha || {};
        const { error } = await sb.from("campanhas").update({ nave: c.nave ?? camp.nave, mapa: c.mapa ?? {}, combate: c.combate ?? combateVazio(), bestiario: c.bestiario ?? [] }).eq("id", id);
        if (error) return alert("Não consegui restaurar: " + error.message);
        Object.assign(camp, { nave: c.nave ?? camp.nave, mapa: c.mapa ?? {}, combate: c.combate ?? combateVazio(), bestiario: c.bestiario ?? [] });
        await enviar("sistema", "♻ O Mestre restaurou o estado da campanha a partir de um backup.");
        render();
      };
      inp.click();
    };
    app.querySelectorAll("[data-mesa-aba]").forEach((b) => b.onclick = () => {
      abaMesa = b.dataset.mesaAba; sessionStorage.setItem("ps-aba-mesa", abaMesa);
      app.querySelectorAll("[data-mesa-aba]").forEach((x) => x.classList.toggle("on", x.dataset.mesaAba === abaMesa));
      app.querySelectorAll(".mesa-painel").forEach((p2, i2) => { p2.hidden = ["combate", "ficha", "nave", "mesa"][i2] !== abaMesa; });
    });
    $("#abrir-mestre")?.addEventListener("click", async () => {
      if (!camp.faccoes || typeof camp.faccoes !== "object") camp.faccoes = {};
      if (!Array.isArray(camp.contratos)) camp.contratos = [];
      const { data: nota } = await sb.from("mestre_notas").select("texto").eq("campanha_id", id).maybeSingle();
      let notaTxt = nota?.texto || "";
      const ov = document.createElement("div"); ov.className = "ss-overlay ov-modal"; ov.style.zIndex = "10000";
      const abas = [["mesa", "🎬 Mesa"], ["ref", "📖 Referência"], ["tab", "🎲 Tabelas"], ["enc", "⚖ Encontros"], ["fac", "🏛 Facções"], ["con", "📋 Contratos"], ["lin", "🕰 Linha do tempo"], ["not", "📝 Anotações"]];
      let abaAtiva = "mesa";
      const salvarCamp = async (campos) => { const { error } = await sb.from("campanhas").update(campos).eq("id", id); if (error) alert("Não consegui salvar: " + error.message); };

      const painelMesa = () => `
        <div class="det grande"><b>☾ Descansos</b>
          <p class="regra">Convoca um descanso para toda a mesa. Cada jogador conectado com personagem vinculado recupera na própria ficha.</p>
          <div class="filtros"><button id="mestre-curto" class="mini">☾ Curto (1h)</button><button id="mestre-longo" class="mini eq">🌙 Longo (8h)</button></div></div>
        <div class="det grande"><b>🎁 Recompensas</b>
          <p class="regra">Distribui para todos os jogadores conectados, direto nas fichas.</p>
          <div class="filtros"><button id="mestre-xp" class="mini">🎖 Conceder XP</button><button id="mestre-cg" class="mini">🎁 Conceder Créditos</button></div></div>
        <div class="det grande"><b>🖼 Imagem para a mesa</b>
          <p class="regra">Mostra um mapa, documento ou retrato no topo do chat de todos.</p>
          <div class="filtros"><button id="handout-btn" class="mini">🖼 Mostrar imagem</button>${camp.handout?.visivel ? `<button id="handout-off" class="mini rm">Ocultar atual</button>` : ""}</div></div>
        <div class="det grande"><b>💾 Backup</b>
          <p class="regra">Baixa ou restaura o estado da campanha (nave, mapa, combate, bestiário).</p>
          <div class="filtros"><button id="camp-export" class="mini">💾 Baixar backup</button><button id="camp-import" class="mini">📥 Restaurar</button></div></div>`;

      const painelRef = () => Object.values(REFERENCIA).map((r) => `<details class="det grande" open><summary><b>${r.ic} ${esc(r.n)}</b></summary>
        <table class="stats-tab"><tbody>${r.linhas.map(([a2, b2]) => `<tr><td style="width:34%"><b>${esc(a2)}</b></td><td>${esc(b2)}</td></tr>`).join("")}</tbody></table></details>`).join("")
        + `<details class="det grande"><summary><b>🩹 Condições</b></summary><table class="stats-tab"><tbody>${CONDICOES.map((c) => `<tr><td>${esc(c)}</td></tr>`).join("")}</tbody></table></details>`
        + `<details class="det grande"><summary><b>🏷 Palavras-chave de armas</b></summary><table class="stats-tab"><tbody>${Object.entries(KEYWORDS).map(([k, v]) => `<tr><td style="width:34%"><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join("")}</tbody></table></details>`
        + `<details class="det grande"><summary><b>💀 Níveis de ameaça</b></summary><table class="stats-tab"><tbody>${Object.entries(NIVEIS_AMEACA).map(([k, v]) => `<tr><td><span class="best-tag" style="color:${v.cor};border-color:${v.cor}">${esc(k)}</span></td><td>peso ${PESO_AMEACA[k] ?? "—"} no orçamento de encontro</td></tr>`).join("")}</tbody></table></details>`;

      const painelTab = () => Object.entries(TABELAS).map(([k, t]) => `<div class="det grande">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>${t.ic} ${esc(t.n)}</b><button class="mini" data-rolar="${k}">🎲 Rolar</button></div>
        <p class="regra">${esc(t.d)}</p><p class="tab-res" data-res="${k}"></p></div>`).join("");

      const painelEnc = () => `<div class="det grande">
        <div class="linha-3"><label>Nível médio<input id="enc-nv" type="number" min="1" max="10" value="${(pers || [])[0]?.dados?.nivel || 1}"/></label>
        <label>Jogadores<input id="enc-j" type="number" min="1" max="8" value="${(pers || []).length || 4}"/></label>
        <label>Dificuldade<select id="enc-d"><option value="facil">Fácil</option><option value="medio" selected>Média</option><option value="dificil">Difícil</option><option value="mortal">Mortal</option></select></label></div>
        <button id="enc-calc" class="mini eq" style="margin-top:8px">⚖ Calcular</button>
        <div id="enc-out"></div></div>`;

      const painelFac = () => `<p class="regra">Ajuste a relação da tripulação com cada facção. Os jogadores veem a reputação, mas não as suas anotações.</p>`
        + FACCOES.map((f) => { const v = camp.faccoes[f.n] ?? 0; const nv = NIVEIS_REPUTACAO.find((x) => x.v === v) || NIVEIS_REPUTACAO[3];
          return `<div class="det grande" style="border-left:3px solid ${f.cor}">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <b>${esc(f.n)}</b><span class="best-tag" style="color:${nv.cor};border-color:${nv.cor}">${esc(nv.n)}</span></div>
            <p class="regra">${esc(f.sede)} · ${esc(f.d)}</p>
            <div class="filtros"><button class="mini" data-fac="${esc(f.n)}" data-d="-1">−</button>
              <input type="range" min="-3" max="3" value="${v}" data-facr="${esc(f.n)}" style="flex:1"/>
              <button class="mini" data-fac="${esc(f.n)}" data-d="1">+</button></div>
            <p class="regra"><i>${esc(nv.d)}</i></p></div>`; }).join("");

      const painelCon = () => `<button id="con-novo" class="mini eq">➕ Publicar contrato</button>`
        + (camp.contratos.length ? camp.contratos.map((c, i) => `<div class="det grande" style="border-left:3px solid ${c.status === "concluido" ? "var(--tech)" : c.status === "aceito" ? "var(--chrome)" : "var(--line)"}">
            <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${esc(c.titulo)}</b><span class="best-tag">${esc(c.status)}</span></div>
            <p>${esc(c.desc)}</p>
            <p class="regra"><b class="chrome">Recompensa:</b> ${esc(c.recompensa)}${c.faccao ? ` · <b>Contratante:</b> ${esc(c.faccao)}` : ""}</p>
            <div class="filtros"><button class="mini" data-con-st="${i}" data-st="aberto">Aberto</button><button class="mini" data-con-st="${i}" data-st="aceito">Aceito</button>
              <button class="mini" data-con-st="${i}" data-st="concluido">Concluído</button><button class="mini rm" data-con-del="${i}">✕</button></div></div>`).join("")
          : `<p class="regra">Nenhum contrato publicado. Os que você publicar aparecem para a tripulação na mesa.</p>`);

      let linCache = null;
      const painelLin = () => {
        if (!linCache) { setTimeout(async () => {
          const { data: tudo } = await sb.from("mensagens").select("tipo,conteudo,payload,criado_em,perfis:autor_id(apelido)")
            .eq("campanha_id", id).order("criado_em", { ascending: true }).limit(3000);
          const eventos = [];
          (tudo || []).forEach((m) => {
            const q = new Date(m.criado_em);
            if (m.tipo === "sistema" && /^📖/.test(m.conteudo || "")) eventos.push({ q, ic: "📖", cls: "marco", t: (m.conteudo || "").replace(/^📖\s*/, "") });
            else if (m.tipo === "recompensa") { const p = m.payload || {}; eventos.push({ q, ic: "🎖", cls: "", t: `Recompensa: ${p.xp ? p.xp + " XP" : ""}${p.xp && p.creditos ? " e " : ""}${p.creditos ? p.creditos + " CG" : ""}` }); }
            else if (m.tipo === "sistema" && /combate espacial iniciado/i.test(m.conteudo || "")) eventos.push({ q, ic: "🚀", cls: "", t: "Combate espacial" });
            else if (m.tipo === "sistema" && /Reputação com/i.test(m.conteudo || "")) eventos.push({ q, ic: "🏛", cls: "", t: (m.conteudo || "").replace(/^🏛\s*/, "") });
            else if (m.tipo === "sistema" && /Novo contrato|Contrato "/i.test(m.conteudo || "")) eventos.push({ q, ic: "📋", cls: "", t: (m.conteudo || "").replace(/^📋\s*/, "") });
            else if (/NAVE ABATIDA|CASCO A ZERO/i.test(m.payload?.extra || "")) eventos.push({ q, ic: "💥", cls: "baixa", t: (m.payload?.titulo || "Nave destruída") });
            else if (m.tipo === "descanso") eventos.push({ q, ic: m.payload?.tipo === "longo" ? "🌙" : "☾", cls: "dim", t: m.payload?.tipo === "longo" ? "Descanso longo" : "Descanso curto" });
          });
          let ultimoDia = "";
          const html = eventos.length ? eventos.map((e) => { const dia = e.q.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
            const cab = dia !== ultimoDia ? `<h4 class="lin-dia">${dia}</h4>` : ""; ultimoDia = dia;
            return cab + `<div class="lin-ev ${e.cls}"><span class="lin-ic">${e.ic}</span><span>${esc(e.t)}</span></div>`; }).join("")
            : `<p class="regra">Ainda não há eventos marcantes registrados.</p>`;
          linCache = `<p class="regra">A história da campanha, montada a partir do que aconteceu na mesa.</p>` + html;
          if (abaAtiva === "lin") pintar();
        }, 0); return `<p class="regra">Montando a linha do tempo…</p>`; }
        return linCache;
      };
      const painelNot = () => `<p class="regra">Só você lê isto. Fica guardado numa tabela separada, protegida por permissão de banco — nem uma consulta direta de jogador alcança.</p>
        <textarea id="not-txt" rows="16" style="width:100%" placeholder="Segredos, ganchos, o que o vilão faz se ninguém interferir…">${esc(notaTxt)}</textarea>
        <button id="not-salvar" class="mini eq" style="margin-top:8px">💾 Salvar anotações</button> <span id="not-st" class="regra"></span>`;

      const conteudo = () => ({ mesa: painelMesa, ref: painelRef, tab: painelTab, enc: painelEnc, fac: painelFac, con: painelCon, lin: painelLin, not: painelNot }[abaAtiva])();

      const pintar = () => {
        ov.innerHTML = `<div class="ss-painel" style="width:700px;max-width:96vw;margin:auto;border:1px solid var(--line);border-radius:10px;max-height:94vh">
          <div class="mp-topo"><b>🎛 Tela do Mestre</b><button id="me-fechar" class="mp-x" style="margin-left:auto">✕</button></div>
          <div class="filtros" style="padding:8px 14px;border-bottom:1px solid var(--line);flex-wrap:wrap">
            ${abas.map(([k, l]) => `<button class="mini ${abaAtiva === k ? "on" : ""}" data-aba="${k}">${l}</button>`).join("")}</div>
          <div class="di-corpo">${conteudo()}</div></div>`;
        ov.querySelector("#me-fechar").onclick = fechar;
        ov.querySelectorAll("[data-aba]").forEach((b) => b.onclick = () => { abaAtiva = b.dataset.aba; pintar(); });
        // controles migrados da lateral — os handlers globais são religados por render(),
        // então aqui delegamos para eles disparando o clique no elemento equivalente.
        const liga = (idm, fn) => { const el2 = ov.querySelector("#" + idm); if (el2) el2.onclick = fn; };
        liga("mestre-curto", async () => { if (await confirmModal("Convocar Descanso Curto para toda a mesa?", { okLabel: "Convocar" })) { enviar("descanso", "O Mestre convocou um Descanso Curto (1h). Habilidades de descanso curto reiniciadas; cura via Kits Médicos.", { tipo: "curto" }); fechar(); } });
        liga("mestre-longo", async () => { if (await confirmModal("Convocar Descanso Longo para toda a mesa? PV restaurados, RAM recarregada e todas as habilidades reiniciadas.", { okLabel: "Convocar" })) { enviar("descanso", "O Mestre convocou um Descanso Longo (8h). PV restaurados, RAM recarregada e todas as habilidades reiniciadas.", { tipo: "longo" }); fechar(); } });
        liga("mestre-xp", async () => { const r = await modalForm({ titulo: "🎖 Conceder XP", campos: [{ k: "n", label: "XP para toda a tripulação conectada", tipo: "numero", valor: 500 }], okLabel: "Conceder" }); if (!r || !(+r.n > 0)) return; enviar("recompensa", `O Mestre concedeu ${+r.n} XP à tripulação.`, { xp: +r.n }); fechar(); });
        liga("mestre-cg", async () => { const r = await modalForm({ titulo: "🎁 Conceder Créditos", campos: [{ k: "n", label: "CG para toda a tripulação conectada", tipo: "numero", valor: 1000 }], okLabel: "Conceder" }); if (!r || !(+r.n > 0)) return; enviar("recompensa", `O Mestre distribuiu ${+r.n} CG de saque à tripulação.`, { creditos: +r.n }); fechar(); });
        liga("handout-btn", async () => {
          const r = await modalForm({ titulo: "🖼 Mostrar imagem para a mesa", campos: [
            { k: "i", label: "Cole o endereço de uma imagem. Ela aparece no topo do chat de todos.", tipo: "info" },
            { k: "url", label: "URL da imagem", tipo: "texto", valor: camp.handout?.url || "" },
            { k: "titulo", label: "Legenda (opcional)", tipo: "texto", valor: camp.handout?.titulo || "" }], okLabel: "Mostrar" });
          if (!r || !r.url) return;
          camp.handout = { url: r.url.trim(), titulo: (r.titulo || "").trim(), visivel: true };
          await salvarCamp({ handout: camp.handout });
          await enviar("sistema", `🖼 O Mestre mostrou uma imagem${r.titulo ? `: ${r.titulo}` : ""}.`); fechar(); render();
        });
        liga("handout-off", async () => { camp.handout = { ...(camp.handout || {}), visivel: false }; await salvarCamp({ handout: camp.handout }); fechar(); render(); });
        liga("camp-export", () => fazerBackup());
        liga("camp-import", () => restaurarBackup());
        // tabelas
        ov.querySelectorAll("[data-rolar]").forEach((b) => b.onclick = () => {
          const k = b.dataset.rolar; const alvo = ov.querySelector(`[data-res="${k}"]`);
          alvo.textContent = rolarTabela(k); alvo.classList.add("tab-res-on");
        });
        // encontros
        ov.querySelector("#enc-calc") && (ov.querySelector("#enc-calc").onclick = () => {
          const nv = +ov.querySelector("#enc-nv").value || 1, j = +ov.querySelector("#enc-j").value || 1, d = ov.querySelector("#enc-d").value;
          const orc = orcamentoEncontro(nv, j, d); const sug = sugerirEncontro(orc);
          ov.querySelector("#enc-out").innerHTML = `<p class="regra" style="margin-top:10px">Orçamento: <b class="chrome">${orc} pontos de ameaça</b> para ${j} jogador(es) de nível ${nv}.</p>
            <table class="stats-tab"><thead><tr><th>Combinação</th><th>Peso</th></tr></thead><tbody>
            ${sug.map((x) => `<tr><td><b>${x.q}×</b> ${esc(x.tipo)}</td><td>${x.q * PESO_AMEACA[x.tipo]} pts${x.sobra ? ` <span class="dim">(sobram ${x.sobra})</span>` : ""}</td></tr>`).join("")}
            </tbody></table><p class="regra">Misture: 1 Elite + 4 Lacaios costuma render mais que 1 Chefe sozinho. Sobras viram terreno, armadilhas ou reforços.</p>`;
        });
        // facções
        ov.querySelectorAll("[data-fac]").forEach((b) => b.onclick = async () => {
          const n = b.dataset.fac; const v = Math.max(-3, Math.min(3, (camp.faccoes[n] ?? 0) + (+b.dataset.d)));
          camp.faccoes[n] = v; await salvarCamp({ faccoes: camp.faccoes });
          const nv = NIVEIS_REPUTACAO.find((x) => x.v === v);
          await enviar("sistema", `🏛 Reputação com ${n}: ${nv.n}.`); pintar();
        });
        ov.querySelectorAll("[data-facr]").forEach((r) => r.onchange = async () => {
          camp.faccoes[r.dataset.facr] = +r.value; await salvarCamp({ faccoes: camp.faccoes }); pintar();
        });
        // contratos
        ov.querySelector("#con-novo") && (ov.querySelector("#con-novo").onclick = async () => {
          const r = await modalForm({ titulo: "📋 Publicar contrato", campos: [
            { k: "titulo", label: "Título", tipo: "texto" },
            { k: "desc", label: "Descrição / objetivo", tipo: "area", rows: 3 },
            { k: "recompensa", label: "Recompensa", tipo: "texto", valor: "1000 CG" },
            { k: "faccao", label: "Contratante", tipo: "select", opcoes: ["—", ...FACCOES.map((f) => f.n)] },
          ], okLabel: "Publicar" });
          if (!r || !r.titulo) return;
          camp.contratos.push({ id: "k" + Math.random().toString(36).slice(2, 8), titulo: r.titulo, desc: r.desc || "", recompensa: r.recompensa || "", faccao: r.faccao === "—" ? "" : r.faccao, status: "aberto" });
          await salvarCamp({ contratos: camp.contratos });
          await enviar("sistema", `📋 Novo contrato disponível: ${r.titulo} — ${r.recompensa || "recompensa a negociar"}.`);
          pintar();
        });
        ov.querySelectorAll("[data-con-st]").forEach((b) => b.onclick = async () => {
          const c = camp.contratos[+b.dataset.conSt]; if (!c) return; c.status = b.dataset.st;
          await salvarCamp({ contratos: camp.contratos });
          await enviar("sistema", `📋 Contrato "${c.titulo}": ${c.status}.`); pintar();
        });
        ov.querySelectorAll("[data-con-del]").forEach((b) => b.onclick = async () => {
          camp.contratos.splice(+b.dataset.conDel, 1); await salvarCamp({ contratos: camp.contratos }); pintar();
        });
        // anotações
        ov.querySelector("#not-salvar") && (ov.querySelector("#not-salvar").onclick = async () => {
          notaTxt = ov.querySelector("#not-txt").value;
          const { error } = await sb.from("mestre_notas").upsert({ campanha_id: id, texto: notaTxt, atualizado_em: new Date().toISOString() });
          ov.querySelector("#not-st").textContent = error ? "erro: " + error.message : "salvo ✓";
        });
      };
      const fechar = () => { document.body.style.overflow = ""; ov.remove(); };
      document.body.appendChild(ov); document.body.style.overflow = "hidden";
      pintar();
      ov.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });
    });
    $("#copiar-convite")?.addEventListener("click", async () => {
      const link = `${location.origin}${location.pathname}#/entrar/${camp.codigo}`;
      try { await navigator.clipboard.writeText(link); } catch (_) {}
      await modalForm({ titulo: "🔗 Convite da mesa", campos: [
        { k: "i", label: "Quem abrir este link entra direto na campanha (basta ter conta).", tipo: "info" },
        { k: "l", label: "Link", tipo: "texto", valor: link }], okLabel: "Fechar" });
    });
    $("#ir-diario")?.addEventListener("click", () => $("#abrir-diario")?.click());
    $("#abrir-stats")?.addEventListener("click", () => $("#abrir-stats-oculto")?.click());
    $("#abrir-stats-oculto")?.addEventListener("click", async () => {
      const { data: todas } = await sb.from("mensagens").select("autor_id,personagem_id,tipo,payload,perfis:autor_id(apelido)").eq("campanha_id", id).eq("tipo", "rolagem").limit(4000);
      const porAutor = {};
      (todas || []).forEach((m) => {
        const p = m.payload || {}; const nat = /d20 \[(\d+)\]/.exec(p.detalhe || "");
        if (!nat) return; // só rolagens de d20 entram na estatística
        const nome = (pers || []).find((x) => x.id === m.personagem_id)?.nome || m.perfis?.apelido || "?";
        const a = porAutor[nome] = porAutor[nome] || { n: 0, soma: 0, crits: 0, fumbles: 0, maior: 0, menor: 21 };
        const v = +nat[1];
        a.n++; a.soma += v; a.maior = Math.max(a.maior, v); a.menor = Math.min(a.menor, v);
        if (v === 20) a.crits++; if (v === 1) a.fumbles++;
      });
      const linhas = Object.entries(porAutor).sort((x, y) => (y[1].soma / y[1].n) - (x[1].soma / x[1].n));
      const ov = document.createElement("div"); ov.className = "ss-overlay ov-modal"; ov.style.zIndex = "10000";
      const corpo = linhas.length ? `<table class="stats-tab"><thead><tr><th>Quem</th><th>Rolagens</th><th>Média</th><th>🎯 Crít</th><th>💀 Falha</th><th>Melhor</th><th>Pior</th></tr></thead><tbody>
        ${linhas.map(([n, a]) => `<tr><td><b>${esc(n)}</b></td><td>${a.n}</td><td><b class="${(a.soma / a.n) >= 10.5 ? "tech-c" : "dim"}">${(a.soma / a.n).toFixed(1)}</b></td>
          <td>${a.crits}${a.crits ? ` <span class="dim">(${(a.crits / a.n * 100).toFixed(0)}%)</span>` : ""}</td>
          <td>${a.fumbles}${a.fumbles ? ` <span class="dim">(${(a.fumbles / a.n * 100).toFixed(0)}%)</span>` : ""}</td>
          <td>${a.maior}</td><td>${a.menor === 21 ? "—" : a.menor}</td></tr>`).join("")}</tbody></table>
        <p class="regra">A média esperada de um d20 honesto é <b>10,5</b>. Quem está acima teve sorte; quem está abaixo tem uma história para contar.</p>`
        : `<p class="regra">Ninguém rolou nada nesta mesa ainda.</p>`;
      ov.innerHTML = `<div class="ss-painel" style="width:620px;max-width:96vw;margin:auto;border:1px solid var(--line);border-radius:10px;max-height:92vh">
        <div class="mp-topo"><b>📊 Estatísticas de Rolagem</b><button id="st-fechar" class="mp-x" style="margin-left:auto">✕</button></div>
        <div class="di-corpo">${corpo}</div></div>`;
      document.body.appendChild(ov); document.body.style.overflow = "hidden";
      const fechar = () => { document.body.style.overflow = ""; ov.remove(); };
      ov.querySelector("#st-fechar").onclick = fechar;
      ov.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });
    });
    // Recapitulação: o que aconteceu desde a última vez que esta pessoa abriu a mesa.
    const recapitular = async () => {
      const chaveVisita = "ps-visita-" + id;
      const ultima = localStorage.getItem(chaveVisita);
      localStorage.setItem(chaveVisita, new Date().toISOString());
      if (!ultima) return;                        // primeira visita: nada a recapitular
      const { data: novas } = await sb.from("mensagens").select("tipo,conteudo,payload,criado_em,personagem_id,perfis:autor_id(apelido)")
        .eq("campanha_id", id).gt("criado_em", ultima).order("criado_em", { ascending: true }).limit(600);
      if (!novas?.length) return;
      const marcos = novas.filter((m) => m.tipo === "sistema" && /^📖/.test(m.conteudo || ""));
      const recompensas = novas.filter((m) => m.tipo === "recompensa");
      const mortes = novas.filter((m) => /☠|0 PV|abatid|destruíd/i.test(m.conteudo || "") || /💀/.test(m.payload?.extra || ""));
      const combates = novas.filter((m) => m.tipo === "sistema" && /Rodada 1 ·|combate espacial iniciado|Iniciar Combate/i.test(m.conteudo || ""));
      const falas = novas.filter((m) => m.tipo === "texto").length;
      const rolagens = novas.filter((m) => m.tipo === "rolagem").length;
      if (!marcos.length && !recompensas.length && !combates.length && falas === 0 && rolagens === 0) return;  // nada que valha um resumo
      const linhas = [];
      if (marcos.length) linhas.push(`<p><b class="chrome">Momentos marcados:</b></p><ul>${marcos.map((m) => `<li>${esc((m.conteudo || "").replace(/^📖\s*/, ""))}</li>`).join("")}</ul>`);
      if (combates.length) linhas.push(`<p>⚔ ${combates.length} combate(s) começaram.</p>`);
      if (mortes.length) linhas.push(`<p class="dim">💀 ${mortes.length} registro(s) de baixa ou destruição.</p>`);
      if (recompensas.length) { const xp = recompensas.reduce((a2, m) => a2 + (m.payload?.xp || 0), 0), cg = recompensas.reduce((a2, m) => a2 + (m.payload?.creditos || 0), 0);
        linhas.push(`<p>🎖 Recompensas: ${xp ? `${xp} XP` : ""}${xp && cg ? " · " : ""}${cg ? `${cg} CG` : ""}.</p>`); }
      linhas.push(`<p class="regra">${falas} mensagem(ns) e ${rolagens} rolagem(ns) desde a sua última visita (${new Date(ultima).toLocaleString("pt-BR")}).</p>`);
      await modalForm({ titulo: "📼 Onde paramos", campos: [{ k: "i", label: "", tipo: "html", html: linhas.join("") }], okLabel: "Continuar a aventura" });
    };
    if (!recapFeita) { recapFeita = true; setTimeout(() => recapitular().catch(() => {}), 900); }

    $("#abrir-diario")?.addEventListener("click", async () => {
      const { data: todas } = await sb.from("mensagens").select("*,perfis:autor_id(apelido,avatar_url)").eq("campanha_id", id).order("criado_em", { ascending: true }).limit(2000);
      const ov = document.createElement("div"); ov.className = "ss-overlay ov-modal"; ov.style.zIndex = "10000";
      const linha = (m) => { const p = m.persm = m.personagem_id ? (pers || []).find((x) => x.id === m.personagem_id) : null;
        const quem = esc(p?.nome || m.perfis?.apelido || "?");
        const hora = new Date(m.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        if (m.tipo === "sistema" && /^📖/.test(m.conteudo || "")) return `<div class="di-marco">${esc(m.conteudo)}</div>`;
        if (m.tipo === "texto") return `<div class="di-linha"><span class="di-hora">${hora}</span><b>${quem}:</b> ${esc(m.conteudo)}</div>`;
        if (m.tipo === "rolagem") { const pl = m.payload || {}; return `<div class="di-linha di-rol"><span class="di-hora">${hora}</span>🎲 <b>${quem}</b> ${esc(pl.titulo || "")}${pl.total != null ? ` = <b>${pl.total}</b>` : ""}</div>`; }
        if (m.tipo === "dano" || m.tipo === "cura") { const pl = m.payload || {}; return `<div class="di-linha"><span class="di-hora">${hora}</span>${m.tipo === "dano" ? "💥" : "✚"} ${pl.valor} em ${esc(pl.alvo_nome || "")}</div>`; }
        return `<div class="di-linha di-sis"><span class="di-hora">${hora}</span>${esc(m.conteudo || "")}</div>`;
      };
      let ultimoDia = "";
      const corpo = (todas || []).map((m) => { const dia = new Date(m.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
        const cab = dia !== ultimoDia ? `<h3 class="di-dia">${dia}</h3>` : ""; ultimoDia = dia; return cab + linha(m); }).join("") || `<p class="regra">Ainda não há registros nesta campanha.</p>`;
      ov.innerHTML = `<div class="ss-painel" style="width:640px;max-width:96vw;margin:auto;border:1px solid var(--line);border-radius:10px;max-height:92vh">
        <div class="mp-topo"><b>📔 Diário — ${esc(camp.nome)}</b>${souMestre ? `<button id="di-marco" class="mini">📖 Marcar momento</button>` : ""}<button id="di-stats" class="mini">📊 Estatísticas</button><button id="di-fechar" class="mp-x" style="margin-left:auto">✕</button></div>
        <div class="di-corpo">${corpo}</div></div>`;
      document.body.appendChild(ov); document.body.style.overflow = "hidden";
      const fechar = () => { document.body.style.overflow = ""; ov.remove(); };
      ov.querySelector("#di-fechar").onclick = fechar;
      ov.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });
      const dc = ov.querySelector(".di-corpo"); dc.scrollTop = dc.scrollHeight;
      ov.querySelector("#di-stats")?.addEventListener("click", () => { fechar(); $("#abrir-stats-oculto")?.click(); });
      ov.querySelector("#di-marco")?.addEventListener("click", async () => { const r = await modalForm({ titulo: "📖 Marcar momento", descricao: "Vira um marco destacado na linha do tempo do diário.", campos: [{ k: "t", label: "Título do momento", tipo: "texto", placeholder: "Ex.: A queda da estação Titã" }], okLabel: "Marcar" }); if (!r || !r.t?.trim()) return;
        await enviar("sistema", `📖 ${r.t.trim()}`); fechar(); });
    });
    $("#abrir-mapa")?.addEventListener("click", async () => {
      try { const { abrirMapa } = await import("./mapa-sistema.js");
        mapaCtrl = abrirMapa({ mapa: camp.mapa, combate: camp.combate, souMestre, salvar: salvarMapa, aoFechar: () => { mapaCtrl = null; } });
      } catch (err) { alert("Não consegui abrir o mapa: " + err.message); }
    });
    // ---- rastreador de iniciativa ----
    const cbId = () => "c" + Math.random().toString(36).slice(2, 8);
    const cbFind = (idc) => camp.combate.ordem.find((x) => x.id === idc);
    $("#cb-iniciar")?.addEventListener("click", async () => { camp.combate = { ...combateVazio(), ativo: true }; await salvarCombate(); render(); });
    $("#cb-criar")?.addEventListener("click", () => {
      const ov = document.createElement("div"); ov.className = "ss-overlay ov-modal"; ov.style.zIndex = "10000";
      const listaHtml = () => camp.bestiario.map((b, i) => `<div class="inv"><span><b>${esc(b.n)}</b> · ${b.ameaca} · HP ${b.hp} CD ${b.cd}</span><button class="mini rm" data-del="${i}">✕</button></div>`).join("") || `<p class="regra">Nenhuma criatura criada ainda.</p>`;
      ov.innerHTML = `<div class="ss-painel" style="width:460px;max-width:94vw;margin:auto;border:1px solid var(--line);border-radius:10px">
        <div class="ss-vazio"><h2>🐉 Criaturas do Mestre</h2><p>Crie inimigos próprios; eles aparecem no "Add" do combate.</p>
        <div class="cria-form">
          <input id="cr-n" placeholder="Nome da criatura"/>
          <div class="linha-3"><select id="cr-am">${Object.keys(NIVEIS_AMEACA).map((a) => `<option>${a}</option>`).join("")}</select><input id="cr-hp" type="number" placeholder="HP" value="30"/><input id="cr-cd" type="number" placeholder="CD" value="13"/></div>
          <div class="linha-3"><input id="cr-desl" type="number" placeholder="Desloc (m)" value="9"/><input id="cr-atk-n" placeholder="Ataque (nome)"/><input id="cr-atk-b" type="number" placeholder="+acerto" value="4"/></div>
          <div class="linha-3"><input id="cr-atk-d" placeholder="Dano (ex: 1d8+2)" value="1d6"/><input id="cr-atk-e" placeholder="Efeito extra (opcional)"/><span></span></div>
          <input id="cr-hab-n" placeholder="Habilidade (nome, opcional)"/>
          <textarea id="cr-hab-d" placeholder="Descrição da habilidade (opcional)" rows="2"></textarea>
          <button id="cr-salvar" class="btn-primario">➕ Adicionar criatura</button>
        </div>
        <h4 style="margin-top:16px">Minhas criaturas</h4><div id="cr-lista">${listaHtml()}</div>
        </div>
        <div class="ss-acoes"><button class="ss-voltar" id="cr-fechar">Fechar</button></div></div>`;
      document.body.appendChild(ov); document.body.style.overflow = "hidden";
      const fechar = () => { document.body.style.overflow = ""; ov.remove(); render(); };
      ov.querySelector("#cr-fechar").onclick = fechar;
      ov.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });
      const relista = () => { ov.querySelector("#cr-lista").innerHTML = listaHtml();
        ov.querySelectorAll("#cr-lista [data-del]").forEach((b) => b.onclick = async () => { camp.bestiario.splice(+b.dataset.del, 1); await salvarBestiario(); relista(); }); };
      relista();
      ov.querySelector("#cr-salvar").onclick = async () => {
        const nome = ov.querySelector("#cr-n").value.trim(); if (!nome) return alert("Dê um nome à criatura.");
        const cri = { n: nome, categoria: "Personalizado", ameaca: ov.querySelector("#cr-am").value,
          hp: +ov.querySelector("#cr-hp").value || 1, cd: +ov.querySelector("#cr-cd").value || 10, desloc: +ov.querySelector("#cr-desl").value || 9,
          ataques: [], habs: [] };
        const an = ov.querySelector("#cr-atk-n").value.trim();
        if (an) cri.ataques.push({ n: an, bonus: +ov.querySelector("#cr-atk-b").value || 0, dano: ov.querySelector("#cr-atk-d").value.trim() || "1d4", extra: ov.querySelector("#cr-atk-e").value.trim() });
        const hn = ov.querySelector("#cr-hab-n").value.trim();
        if (hn) cri.habs.push({ n: hn, d: ov.querySelector("#cr-hab-d").value.trim() });
        camp.bestiario.push(cri); await salvarBestiario();
        ov.querySelector("#cr-n").value = ""; ov.querySelector("#cr-atk-n").value = ""; ov.querySelector("#cr-hab-n").value = ""; ov.querySelector("#cr-hab-d").value = "";
        relista();
      };
    });
    $("#cb-timer")?.addEventListener("click", async () => {
      if (timerInt) { clearInterval(timerInt); timerInt = null; const o = $("#cb-timer-out"); if (o) o.textContent = ""; return; }
      const r = await modalForm({ titulo: "⏱ Cronômetro de turno", campos: [
        { k: "i", label: "Conta o tempo de cada jogador. É local: só você vê, e serve para manter o combate andando.", tipo: "info" },
        { k: "seg", label: "Segundos por turno", tipo: "numero", valor: 60 },
      ], okLabel: "Iniciar" });
      if (!r) return;
      const total = Math.max(10, +r.seg || 60);
      let resta = total;
      const pinta = () => { const o = $("#cb-timer-out"); if (!o) { clearInterval(timerInt); timerInt = null; return; }
        const m = String(Math.floor(resta / 60)).padStart(1, "0"), sg = String(resta % 60).padStart(2, "0");
        o.textContent = `⏱ ${m}:${sg}`;
        o.className = "cb-timer" + (resta <= 10 ? " urgente" : "");
        if (resta <= 0) { clearInterval(timerInt); timerInt = null; o.textContent = "⏱ tempo!"; try { somDado(); } catch (_) {} }
        resta--;
      };
      pinta(); timerInt = setInterval(pinta, 1000);
    });
    $("#cb-undo")?.addEventListener("click", async () => {
      const snap = pilhaUndo.pop();
      if (!snap) return alert("Nada para desfazer nesta sessão.");
      camp.combate = snap.combate; camp.combate_nave = snap.combate_nave; if (snap.nave) camp.nave = snap.nave;
      await sb.from("campanhas").update({ combate: camp.combate, combate_nave: camp.combate_nave, ...(snap.nave ? { nave: camp.nave } : {}) }).eq("id", id);
      await enviar("sistema", `↶ O Mestre desfez: ${snap.rotulo}.`); render();
    });
    $("#cb-fim")?.addEventListener("click", async () => { if (confirm("Encerrar o combate e limpar a ordem?")) { camp.combate = combateVazio(); await salvarCombate(); render(); } });
    app.querySelectorAll("[data-cb-nave]").forEach((b) => b.onclick = async () => {
      const atc = camp.combate.ordem.find((x) => x.id === b.dataset.cbNave); if (!atc) return;
      const alvos = camp.combate.ordem.filter((x) => ehNave(x) && x.lado === "aliada" && !foraDeCombate(x));
      if (!alvos.length) return alert("Nenhuma nave aliada em campo para servir de alvo.");
      const alvo = alvos[0];
      snapshot("disparo de nave inimiga");
      const nat = d(20), total = nat + 4, def = 10 + (alvo.manobra || 0);
      if (nat === 1 || total < def) return enviar("rolagem", null, { titulo: `🚀 ${atc.nome} dispara`, detalhe: `d20 [${nat}] +4 vs Defesa ${def}`, total, fumble: nat === 1, extra: "Errou." });
      const pd = parseDice(atc.dano); const dd = rollNd(pd.n * (nat === 20 ? 2 : 1), pd.f);
      const bruto = dd.reduce((x, y) => x + y, 0) + pd.mod;
      const r = danoNave(alvo, bruto);
      let extra = `Escudos −${r.escudos}, Casco −${r.casco}. ${alvo.nome}: ${alvo.casco}/${alvo.casco_max}`;
      if ((nat === 20 || r.critico) && r.casco > 0) { const av = rolarAvaria(); (camp.combate.avarias = camp.combate.avarias || []).push(av); extra += `  ⚠ ${av.n}: ${av.e}`; }
      if (alvo.casco <= 0) extra += "  💀 Casco a zero!";
      if (alvo.nave_party && camp.nave) { camp.nave.casco = alvo.casco; camp.nave.escudos = alvo.escudos; await sb.from("campanhas").update({ nave: camp.nave }).eq("id", id); }
      await salvarCombate();
      await enviar("rolagem", null, { titulo: `🚀 ${atc.nome} dispara`, detalhe: `d20 [${nat}] +4 vs Def ${def} · dano ${atc.dano} [${dd.join(", ")}]${nat === 20 ? " ×2" : ""}`, total, crit: nat === 20, extra });
      render();
    });
    app.querySelectorAll("[data-av-fix2]").forEach((b) => b.onclick = async () => {
      const av = (camp.combate.avarias || []).splice(+b.dataset.avFix2, 1)[0];
      await salvarCombate(); await enviar("sistema", `🔧 Avaria reparada: ${av?.n}.`); render();
    });
    app.querySelectorAll(".cb-cond-add").forEach((b) => b.onclick = async () => {
      const c = cbFind(b.dataset.cb); if (!c) return;
      const r = await modalForm({ titulo: `🏷 Condição — ${c.nome}`, campos: [
        { k: "nome", label: "Condição", tipo: "select", opcoes: CONDICOES },
        { k: "turnos", label: "Duração (turnos)", tipo: "numero", valor: 2, min: 1 }], okLabel: "Aplicar" });
      if (!r || !r.nome || !r.turnos || r.turnos < 1) return;
      if (!c.cond) c.cond = []; c.cond.push({ n: r.nome, turnos: r.turnos });
      enviar("sistema", `🏷 ${c.nome} está ${r.nome} (${r.turnos} turno${r.turnos > 1 ? "s" : ""}).`);
      await salvarCombate(); render();
    });
    $("#cb-prox")?.addEventListener("click", async () => { const rodAntes = camp.combate.rodada; proximoTurno(camp.combate); if (camp.combate.rodada !== rodAntes) camp.combate.agiram = []; const atual = camp.combate.ordem[camp.combate.turno];
      if (atual) { // condições do combatente que começa o turno decrementam; expiradas somem
        if (atual.cond && atual.cond.length) { const expiradas = [];
          atual.cond = atual.cond.filter((cd) => { cd.turnos -= 1; if (cd.turnos <= 0) { expiradas.push(cd.n); return false; } return true; });
          if (expiradas.length) enviar("sistema", `✔ ${atual.nome}: acabou ${expiradas.join(", ")}.`);
        }
        enviar("sistema", `⚔ Rodada ${camp.combate.rodada} · vez de ${atual.nome}${atual.cond && atual.cond.length ? ` (${atual.cond.map((x) => x.n).join(", ")})` : ""}.`);
      }
      await salvarCombate(); render(); });
    $("#cb-add-btn")?.addEventListener("click", async () => {
      const v = $("#cb-quem").value; if (!v) return;
      if (v.startsWith("j:")) { const p = (pers || []).find((x) => x.id === v.slice(2)); if (!p) return;
        const kk = calc({ ...novaFichaDados(), ...p.dados }); const nome = p.nome || "Tripulante";
        camp.combate.ordem.push({ id: cbId(), nome, ini: d(20) + kk.iniciativa, hp: p.dados.pvAtual ?? kk.attr.Con, hp_max: p.dados.pvMax || 1, cd: kk.cd, tipo: "jogador", personagem_id: p.id });
      } else if (v === "np:party") {
        if (!camp.nave) return;
        if (camp.combate.ordem.some((x) => x.nave_party)) return alert("A nave da tripulação já está neste combate.");
        camp.combate.ordem.push({ id: cbId(), tipo: "nave", nave_party: true, lado: "aliada",
          nome: camp.nave.nome_batismo || camp.nave.modelo, ini: d(20) + (camp.nave.manobra || 0),
          casco: camp.nave.casco, casco_max: camp.nave.casco_max, escudos: camp.nave.escudos,
          escudos_max: camp.nave.escudos_max, manobra: camp.nave.manobra, dano: camp.nave.dano });
      } else if (v.startsWith("ni:")) {
        const base = NAVES[+v.slice(3)]; if (!base) return;
        const iguais = camp.combate.ordem.filter((x) => x.modelo === base.n).length;
        camp.combate.ordem.push({ id: cbId(), tipo: "nave", lado: "inimiga", modelo: base.n,
          nome: iguais ? `${base.n} #${iguais + 1}` : base.n, ini: d(20) + (base.manobra || 0),
          casco: base.casco, casco_max: base.casco, escudos: base.escudos, escudos_max: base.escudos,
          manobra: base.manobra, dano: base.dano });
      } else { const b = v.startsWith("c:") ? camp.bestiario[+v.slice(2)] : BESTIARIO[+v.slice(2)]; if (!b) return;
        const iguais = camp.combate.ordem.filter((x) => x.nome.replace(/ #\d+$/, "") === b.n).length;
        camp.combate.ordem.push({ id: cbId(), nome: iguais ? `${b.n} #${iguais + 1}` : b.n, ini: d(20), hp: b.hp, hp_max: b.hp, cd: b.cd, tipo: "inimigo", ameaca: b.ameaca, ataques: b.ataques });
      }
      ordenarCombate(camp.combate); await salvarCombate(); render();
    });
    app.querySelectorAll(".cb-atk").forEach((b) => b.onclick = async () => {
      const c = cbFind(b.dataset.cb); if (!c || !c.ataques) return; const atk = c.ataques[+b.dataset.atk]; if (!atk) return;
      let nat = null, detVant = "", acerto = null;
      if (atk.bonus != null) { if (vantagem !== 0) { const r1 = d(20), r2 = d(20); nat = vantagem > 0 ? Math.max(r1, r2) : Math.min(r1, r2); detVant = ` [${vantagem > 0 ? "vant" : "desv"} ${r1}/${r2}]`; } else nat = d(20); acerto = nat + atk.bonus; }
      const pd = parseDice(atk.dano); let danoTxt = "", danoTotal = null;
      if (pd) { const mult = nat === 20 ? 2 : 1; const ds = rollNd(pd.n * mult, pd.f); danoTotal = ds.reduce((x, y) => x + y, 0) + pd.mod; danoTxt = ` · dano ${atk.dano}${mult > 1 ? "×2" : ""} [${ds.join(", ")}]${pd.mod ? sign(pd.mod) : ""} = ${danoTotal}`; }
      enviar("rolagem", null, { titulo: `👹 ${c.nome} — ${atk.n}`,
        detalhe: `${nat != null ? `d20 [${nat}]${detVant} ${sign(atk.bonus)} = acerto ${acerto}` : "efeito automático"}${danoTxt}`,
        total: acerto, crit: nat === 20, fumble: nat === 1,
        extra: `${atk.extra ? atk.extra : ""}`, ...(danoTotal != null ? { dano_total: danoTotal } : {}) });
    });
    app.querySelectorAll(".cb-dmg").forEach((b) => b.onclick = async () => { const c = cbFind(b.dataset.cb); if (!c) return; snapshot("dano/cura no rastreador"); const delta = +b.dataset.d;
      if (ehNave(c)) {
        if (delta < 0) { const r = danoNave(c, -delta); if (r.critico) { const av = rolarAvaria(); (camp.combate.avarias = camp.combate.avarias || []).push(av); await enviar("sistema", `⚠ ${c.nome}: ${av.n} — ${av.e}`); } }
        else c.escudos = Math.min(c.escudos_max, c.escudos + delta);
        if (c.nave_party && camp.nave) { camp.nave.casco = c.casco; camp.nave.escudos = c.escudos; await sb.from("campanhas").update({ nave: camp.nave }).eq("id", id); }
      } else c.hp = Math.max(0, Math.min(c.hp_max, c.hp + delta));
      await salvarCombate(); render(); });
    app.querySelectorAll(".cb-hpset").forEach((i) => i.onchange = async () => { const c = cbFind(i.dataset.cb); if (!c) return; if (ehNave(c)) { c.casco = Math.max(0, Math.min(c.casco_max, +i.value || 0)); if (c.nave_party && camp.nave) { camp.nave.casco = c.casco; await sb.from("campanhas").update({ nave: camp.nave }).eq("id", id); } }
      else c.hp = Math.max(0, Math.min(c.hp_max, +i.value || 0));
      await salvarCombate(); render(); });
    app.querySelectorAll(".cb-rm").forEach((b) => b.onclick = async () => { const idx = camp.combate.ordem.findIndex((x) => x.id === b.dataset.cb); if (idx < 0) return; snapshot("remover combatente");
      camp.combate.ordem.splice(idx, 1); if (camp.combate.turno >= camp.combate.ordem.length) camp.combate.turno = 0; await salvarCombate(); render(); });
    $("#sel-pers").onchange = async (e) => {
      const pid = e.target.value; if (!pid) return;
      await sb.from("personagens").update({ campanha_id: id }).eq("id", pid);
      location.reload();
    };
    if (f) {
      $("#rolar-per").onclick = () => { const pn = $("#sel-per").value; const at = PERICIAS.find(([x]) => x === pn)[1];
        rolarEEnviar(`Teste de ${pn}`, k.attr[at] + k.per[pn]); };
      app.querySelectorAll("[data-atq]").forEach((b) => b.onclick = async () => {
        const a = armasEq[+b.dataset.atq]; const cat = ARMAS.find((x) => x.n === a.nome);
        const pr = propsArma(cat);
        let precisaRender = false;
        const custo = custoTiro(cat);
        if (custo > 0) {
          const cap = (f.pentes ?? PENTES_INICIAIS) * TURNOS_POR_PENTE;
          const usado = (meuPers.dados?.municaoUsada) || 0;   // lê o estado real, não a cópia do render
          if (usado + custo > cap) { await enviar("sistema", `🔫 ${meuPers.nome} puxa o gatilho e ouve o clique: sem munição para ${a.nome}. Recarregar custa uma Ação de Movimento.`); return render(); }
          f.municaoUsada = usado + custo;                       // mantém a cópia local coerente
          meuPers.dados = { ...meuPers.dados, municaoUsada: f.municaoUsada };
          await sb.from("personagens").update({ dados: meuPers.dados }).eq("id", meuPers.id);
          precisaRender = true;
        }
        const furtivo = $("#atq-furtivo")?.checked;
        const assassino = f.classe === "Assassino";
        // Ágil: usa o melhor de For/Des no acerto e no dano
        const atkAttr = pr.agil ? (k.attr.Des >= k.attr.For ? "Des" : "For") : cat.attr;
        const mod = k.attr[atkAttr] + k.per[cat.per]
          + (cat.tipo === "fogo" && f.implantes.includes("Olho Biônico de Precisão") ? 2 : 0)
          + (furtivo && pr.oculta ? 2 : 0)          // Oculta: +2 no furtivo
          + (furtivo && assassino ? 2 : 0);          // Assassino: +2 no furtivo
        let nat, detVant = "";
        if (vantagem !== 0) { const r1 = d(20), r2 = d(20); nat = vantagem > 0 ? Math.max(r1, r2) : Math.min(r1, r2); detVant = ` [${vantagem > 0 ? "vant" : "desv"} ${r1}/${r2}]`; } else nat = d(20);
        const danoBase = danoArma(cat, f.nivel);
        const pd = parseDice(danoBase);
        // dobra o dano por Crítico (20) e/ou Ataque Furtivo do Assassino (cada um adiciona um conjunto de dados)
        const sets = 1 + (nat === 20 ? 1 : 0) + (furtivo && assassino ? 1 : 0);
        let dados = rollNd(pd.n * sets, pd.f);
        if (pr.brutal) { const d2 = rollNd(pd.n * sets, pd.f); if (d2.reduce((x, y) => x + y, 0) > dados.reduce((x, y) => x + y, 0)) dados = d2; } // Brutal: vantagem no dano
        const danoMod = k.attr[atkAttr] + (cat.tipo === "branca" && f.implantes.includes("Braço Mecânico Hidráulico") ? 2 : 0);
        const marcadores = [nat === 20 ? "CRÍTICO ×2" : "", furtivo && assassino ? "FURTIVO ×2" : furtivo ? "furtivo +2 acerto" : "", pr.agil ? `Ágil (${atkAttr})` : "", pr.brutal ? "Brutal (vantagem)" : ""].filter(Boolean).join(" · ");
        const infoArma = [pr.area ? `◎ Área: ${pr.areaTxt}` : "", pr.alcance ? `⟿ Alcance: ${pr.alcanceTxt}` : "", cat.kw ? `🏷 ${cat.kw}: ${pr.efeito}` : ""].filter(Boolean).join("  ·  ");
        enviar("rolagem", null, { titulo: (privada ? "🔒 " : "") + `Ataque — ${a.nome}${furtivo ? " 🥷" : ""}`,
          detalhe: `d20 [${nat}]${detVant} ${sign(mod)} · dano ${danoBase}${sets > 1 ? `×${sets}` : ""} [${dados.join(", ")}] ${sign(danoMod)}${marcadores ? " · " + marcadores : ""}`,
          total: nat + mod, crit: nat === 20, fumble: nat === 1, ...(privada ? { privada: true } : {}), dano_total: dados.reduce((x, y) => x + y, 0) + danoMod,
          extra: `Dano: ${dados.reduce((x, y) => x + y, 0) + danoMod}${infoArma ? "  —  " + infoArma : ""}` });
        if (precisaRender) render();      // atualiza o contador de munição na tela
      });
      $("#recarregar")?.addEventListener("click", async () => {
        f.municaoUsada = 0;
        meuPers.dados = { ...meuPers.dados, municaoUsada: 0 };
        await sb.from("personagens").update({ dados: meuPers.dados }).eq("id", meuPers.id);
        await enviar("sistema", `🔫 ${meuPers.nome} recarrega (Ação de Movimento).`); render();
      });
      $("#conjurar").onclick = async () => {
        const s = SCRIPTS.find((x) => x.n === $("#sel-scr").value);
        if (s.c > k.ramLivre) return enviar("sistema", `${p.nome || perfil.apelido} tentou conjurar ${s.n} sem RAM suficiente (Overclock manual: 1d6/ponto).`);
        meuPers.dados = { ...f, ramGasta: (f.ramGasta || 0) + s.c };
        await sb.from("personagens").update({ dados: meuPers.dados }).eq("id", meuPers.id);
        const nat = d(20);
        enviar("rolagem", null, { titulo: `Script — ${s.n}`, detalhe: `d20 [${nat}] +${k.conj} · ${s.c} RAM · ${s.a}`, total: nat + k.conj, crit: nat === 20, fumble: nat === 1, extra: s.d.slice(0, 90) });
        render(); };
      $("#rolar-livre").onclick = () => { const v = $("#dado-livre").value.trim(); const r = rolarExpr(v.replace(/^\//, "")); if (!r) return;
        enviar("rolagem", null, { titulo: (privada ? "🔒 " : "") + `Rolagem ${v}`, detalhe: r.detalhe, total: r.total, ...(privada ? { privada: true } : {}) }); };
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
    const salvarCbn = async () => { const { error } = await sb.from("campanhas").update({ combate_nave: camp.combate_nave }).eq("id", id); if (error) alert("Não consegui salvar o combate espacial: " + error.message); };
    $("#cbn-iniciar")?.addEventListener("click", async () => {
      camp.combate_nave = { ...combateNaveVazio(), ativo: true };
      await salvarCbn(); await enviar("sistema", "🚀 Alerta vermelho: combate espacial iniciado. Todos aos postos!"); render();
    });
    $("#cbn-fim")?.addEventListener("click", async () => {
      if (!(await confirmModal("Encerrar o combate espacial? As naves inimigas e as avarias em campo serão limpas.", { okLabel: "Encerrar", perigo: true }))) return;
      camp.combate_nave = combateNaveVazio(); await salvarCbn(); await enviar("sistema", "🚀 Combate espacial encerrado."); render();
    });
    $("#cbn-prox")?.addEventListener("click", async () => {
      const cb = camp.combate_nave; cb.rodada++; cb.agiram = [];
      // Núcleo de Reparo Automático
      if ((camp.nave?.upgrades || []).some((u) => u === "Núcleo de Reparo Automático") && camp.nave.casco < camp.nave.casco_max) {
        const rep = d(6); camp.nave.casco = Math.min(camp.nave.casco_max, camp.nave.casco + rep);
        await sb.from("campanhas").update({ nave: camp.nave }).eq("id", id);
        await enviar("sistema", `🔧 Núcleo de Reparo: +${rep} de Casco (${camp.nave.casco}/${camp.nave.casco_max}).`);
      }
      await salvarCbn(); await enviar("sistema", `🚀 Rodada ${cb.rodada}. Postos liberados para agir.`); render();
    });
    $("#cbn-add")?.addEventListener("click", async () => {
      const r = await modalForm({ titulo: "➕ Nave inimiga", campos: [
        { k: "modelo", label: "Modelo", tipo: "select", opcoes: NAVES.map((n) => n.n) },
        { k: "nome", label: "Nome (opcional)", tipo: "texto" },
      ], okLabel: "Lançar" });
      if (!r) return;
      const base = NAVES.find((n) => n.n === r.modelo); if (!base) return;
      const iguais = camp.combate_nave.inimigas.filter((x) => x.modelo === base.n).length;
      camp.combate_nave.inimigas.push({ id: "s" + Math.random().toString(36).slice(2, 8),
        nome: r.nome?.trim() || (iguais ? `${base.n} #${iguais + 1}` : base.n), modelo: base.n,
        casco: base.casco, casco_max: base.casco, escudos: base.escudos, escudos_max: base.escudos,
        manobra: base.manobra, dano: base.dano });
      await salvarCbn(); await enviar("sistema", `🚀 Contato hostil: ${camp.combate_nave.inimigas.slice(-1)[0].nome} entrou em alcance.`); render();
    });
    app.querySelectorAll("[data-cbn-rm]").forEach((b) => b.onclick = async () => {
      camp.combate_nave.inimigas.splice(+b.dataset.cbnRm, 1); await salvarCbn(); render();
    });
    // Nave inimiga dispara contra a tripulação
    app.querySelectorAll("[data-cbn-atk]").forEach((b) => b.onclick = async () => {
      const x = camp.combate_nave.inimigas[+b.dataset.cbnAtk]; if (!x || !camp.nave) return;
      const nat = d(20), total = nat + 4;                       // ataque padrão de nave
      const def = defesaNave(camp.nave);
      if (nat === 1 || total < def) {
        return enviar("rolagem", null, { titulo: `🚀 ${x.nome} dispara`, detalhe: `d20 [${nat}] +4 vs Defesa ${def}`, total, fumble: nat === 1, extra: "Errou — o disparo passa de raspão." });
      }
      const pd = parseDice(x.dano); const dados = rollNd(pd.n * (nat === 20 ? 2 : 1), pd.f);
      const bruto = dados.reduce((a2, b2) => a2 + b2, 0) + pd.mod;
      const r = danoNave(camp.nave, bruto);
      let extra = `Escudos absorveram ${r.escudos}; Casco sofreu ${r.casco}. Nave: ${camp.nave.casco}/${camp.nave.casco_max} casco · ${camp.nave.escudos}/${camp.nave.escudos_max} escudos.`;
      if ((nat === 20 || r.critico) && r.casco > 0) {
        const av = rolarAvaria(); camp.combate_nave.avarias.push(av);
        extra += `  ⚠ FALHA CRÍTICA — ${av.n}: ${av.e}`;
      }
      if (camp.nave.casco <= 0) extra += "  💀 CASCO A ZERO: a nave está destruída ou à deriva.";
      await sb.from("campanhas").update({ nave: camp.nave }).eq("id", id);
      await salvarCbn();
      await enviar("rolagem", null, { titulo: `🚀 ${x.nome} dispara`, detalhe: `d20 [${nat}] +4 vs Defesa ${def} · dano ${x.dano} [${dados.join(", ")}]${nat === 20 ? " ×2" : ""}`, total, crit: nat === 20, extra });
      render();
    });
    app.querySelectorAll("[data-av-fix]").forEach((b) => b.onclick = async () => {
      const av = camp.combate_nave.avarias.splice(+b.dataset.avFix, 1)[0];
      await salvarCbn(); await enviar("sistema", `🔧 Avaria reparada: ${av?.n}.`); render();
    });
    // Upgrades da nave (ficha evolutiva)
    $("#nave-upg")?.addEventListener("click", async () => {
      if (!camp.nave) return;
      camp.nave.upgrades = camp.nave.upgrades || [];
      const r = await modalForm({ titulo: "🔧 Melhorias da nave", campos: [
        { k: "i", label: `Instaladas: ${camp.nave.upgrades.length ? camp.nave.upgrades.join(", ") : "nenhuma"}. Escolha uma melhoria para instalar.`, tipo: "info" },
        { k: "up", label: "Melhoria", tipo: "select", opcoes: UPGRADES_NAVE.filter((u) => !camp.nave.upgrades.includes(u.n)).map((u) => ({ v: u.n, l: `${u.n} — ${u.p} CG · ${u.e}` })) },
      ], okLabel: "Instalar" });
      if (!r || !r.up) return;
      const u = UPGRADES_NAVE.find((x) => x.n === r.up); if (!u) return;
      camp.nave.upgrades.push(u.n);
      if (u.campo === "casco_max") { camp.nave.casco_max += u.v; camp.nave.casco += u.v; }
      if (u.campo === "escudos_max") { camp.nave.escudos_max += u.v; camp.nave.escudos += u.v; }
      if (u.campo === "manobra") camp.nave.manobra = (camp.nave.manobra || 0) + u.v;
      if (u.penal?.manobra) camp.nave.manobra = (camp.nave.manobra || 0) + u.penal.manobra;
      if (u.campo === "dano_bonus") { const pd = parseDice(camp.nave.dano); if (pd) camp.nave.dano = `${pd.n + 1}d${pd.f}${pd.mod ? sign(pd.mod) : ""}`; }
      await sb.from("campanhas").update({ nave: camp.nave }).eq("id", id);
      await enviar("sistema", `🔧 ${camp.nave.nome_batismo || camp.nave.modelo} recebeu uma melhoria: ${u.n}. ${u.e}`);
      render();
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
      // Artilharia: se há combate espacial ativo, resolve contra uma nave inimiga
      if (acao.danoNave && camp.combate?.ativo && camp.combate.ordem.some((x) => ehNave(x) && x.lado === "inimiga" && !foraDeCombate(x))) {
        const vivas = camp.combate.ordem.filter((x) => ehNave(x) && x.lado === "inimiga" && !foraDeCombate(x));
        const esc1 = vivas.length === 1 ? vivas[0] : (await modalForm({ titulo: `⚔ ${acao.n} — escolher alvo`, campos: [
          { k: "alvo", label: "Nave inimiga", tipo: "select", opcoes: vivas.map((x) => ({ v: x.id, l: `${x.nome} — casco ${x.casco}/${x.casco_max}, Def ${10 + (x.manobra || 0)}` })) }], okLabel: "Disparar" }))?.alvo;
        const alvo = typeof esc1 === "string" ? vivas.find((x) => x.id === esc1) : esc1;
        if (alvo) {
          const def = defesaNave(alvo);
          if (total >= def && nat !== 1) {
            const pdn = parseDice(camp.nave?.dano || "1d6");
            const dd = rollNd(pdn.n * (nat === 20 ? 2 : 1), pdn.f);
            const bruto = dd.reduce((x2, y2) => x2 + y2, 0) + pdn.mod;
            const r2 = danoNave(alvo, bruto);
            extra = `Acertou (Def ${def})! Dano ${camp.nave?.dano}${nat === 20 ? " ×2" : ""} [${dd.join(", ")}] → escudos −${r2.escudos}, casco −${r2.casco}. ${alvo.nome}: ${alvo.casco}/${alvo.casco_max}`;
            if (alvo.casco <= 0) extra += "  💥 NAVE ABATIDA!";
          } else extra = `Errou — Defesa ${def} da ${alvo.nome}.`;
          camp.combate.agiram = [...new Set([...(camp.combate.agiram || []), meuPosto])];
          await sb.from("campanhas").update({ combate: camp.combate }).eq("id", id);
        }
      } else if (camp.combate?.ativo) {
        camp.combate.agiram = [...new Set([...(camp.combate.agiram || []), meuPosto])];
        await sb.from("campanhas").update({ combate: camp.combate }).eq("id", id);
      }
      enviar("rolagem", null, { titulo: `${ESTACOES[meuPosto].n} — ${acao.n}`, detalhe: `d20 [${nat}] ${sign(mod)} (${at}+${pn})`, total, crit: nat === 20, fumble: nat === 1, extra });
    });
  };
  render();
}

// ---------------- BIBLIOTECA (todas as informações detalhadas) ----------------
function telaBiblioteca(aba = "racas") {
  const abas = [["racas", "Raças"], ["classes", "Classes"], ["armas", "Arsenal"], ["armaduras", "Armaduras"], ["implantes", "Implantes"], ["scripts", "Scripts"], ["filosofias", "Filosofias"], ["naves", "Naves"], ["bestiario", "Bestiário"], ["npcs", "NPCs"]];
  let corpo = "";
  const cardCriatura = (c) => { const nv = NIVEIS_AMEACA[c.ameaca] || { cor: "#8189a3" };
    return `<details class="det grande best-card" style="border-left:3px solid ${nv.cor}"><summary><b>${esc(c.n)}</b>${c.apelido ? ` <i class="dim">${esc(c.apelido)}</i>` : ""} <span class="best-tag" style="color:${nv.cor};border-color:${nv.cor}">${esc(c.ameaca)}</span>${c.raca ? ` <i class="dim">${esc(c.raca)}</i>` : ""}</summary>
      ${c.ambiental ? `<p>${esc(c.desc)}</p><p class="regra"><b class="chrome">⚠ Ameaça:</b> ${esc(c.ameaca_txt)}</p>` : `<p class="regra">❤ HP ${c.hp} · 🛡 CD ${c.cd} · 🏃 ${c.desloc}m${c.nota ? ` · <i>${esc(c.nota)}</i>` : ""}</p>`}
      ${c.ataques.map((a) => `<p><b class="chrome">⚔ ${esc(a.n)}:</b> ${a.bonus != null ? `${sign(a.bonus)} acerto · ` : ""}${a.dano && a.dano !== "0" && a.dano !== "auto" ? `dano ${a.dano}` : ""}${a.extra ? ` <span class="dim">(${esc(a.extra)})</span>` : ""}</p>`).join("")}
      ${c.habs.map((h) => `<p><b class="tech-c">✦ ${esc(h.n)}:</b> ${esc(h.d)}</p>`).join("")}</details>`; };
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
  if (aba === "armaduras") corpo = ARMADURAS.map((a) => `<details class="det grande"><summary><b>${esc(a.n)}</b> · CD +${a.cd} <span class="dim">(${a.t})</span>${a.preco ? ` · <b class="chrome">${a.preco} CG</b>` : ""}</summary>${a.e ? `<p class="regra"><b>Efeito:</b> ${esc(a.e)}</p>` : ""}${a.desc ? `<p>${esc(a.desc)}</p>` : ""}</details>`).join("");
  if (aba === "implantes") corpo = IMPLANTES.map((i) => `<div class="det"><b>${esc(i.n)}</b> · <b class="chrome">${i.p} CG</b> <span class="dim">(${i.g})</span> — ${esc(i.e)}</div>`).join("");
  if (aba === "scripts") corpo = SCRIPTS.map((s) => `<details class="det grande"><summary><b>${esc(s.n)}</b> <i class="sombra-c">${s.c}◈ ${esc(s.a)}</i></summary><p class="regra"><b>Efeito:</b> ${esc(s.d)}</p>${s.lore ? `<p>${esc(s.lore)}</p>` : ""}</details>`).join("");
  if (aba === "filosofias") corpo = Object.entries(FILOSOFIAS).map(([n, x]) => `<details class="det grande"><summary><b>${esc(n)}</b>${x.apelido ? ` <i class="dim">${esc(x.apelido)}</i>` : ""}${x.freq ? ` <span class="best-tag">1x/desc. ${esc(x.freq)}</span>` : ""}</summary>${x.lore ? `<p>${esc(x.lore)}</p>` : ""}<p class="regra"><b class="tech-c">Mecânica:</b> ${esc(x.d)}</p></details>`).join("");
  if (aba === "naves") corpo = `<p class="regra">${esc(REGRAS_NAVE.defesa)}<br>${esc(REGRAS_NAVE.dobra)}<br>${esc(REGRAS_NAVE.critico)}</p>` +
    NAVES.map((n) => `<details class="det grande"><summary><b>${esc(n.n)}</b> · Casco ${n.casco} · Escudos ${n.escudos} · Manobra ${sign(n.manobra)} · Dano ${n.dano}</summary>
    <p>${esc(n.desc)}</p><p class="regra">Tripulação: ${esc(n.trip)}</p></details>`).join("") +
    `<h3 class="sub">Estações de Batalha</h3>` + Object.values(ESTACOES).map((e) => `<div class="det"><b>${esc(e.n)}</b>${e.acoes.map((a) => `<p><b class="tech-c">${esc(a.n)}${a.rola ? ` (${a.rola.join("+")})` : ""}:</b> ${esc(a.d)}</p>`).join("")}</div>`).join("");
  if (aba === "bestiario") { const cats = ["Crias do Vazio", "Inimigos das Raças", "Heranças das Estrelas"];
    const legenda = `<p class="regra">Ordene as fichas por ameaça: ${Object.entries(NIVEIS_AMEACA).map(([n, v]) => `<span class="best-tag" style="color:${v.cor};border-color:${v.cor}">${n}</span>`).join(" ")}</p>`;
    corpo = legenda + cats.map((cat) => { const lista = BESTIARIO.filter((c) => c.categoria === cat).sort((a, b) => (NIVEIS_AMEACA[a.ameaca]?.ordem || 0) - (NIVEIS_AMEACA[b.ameaca]?.ordem || 0));
      const desc = { "Crias do Vazio": "Os invasores de fora da realidade — escalonados de lacaios a chefes.", "Inimigos das Raças": "Adversários de cada povo do sistema, em três níveis de dificuldade.", "Heranças das Estrelas": "Fauna exoplanetária e quimeras do mercado negro do Caminho da Espiral." }[cat];
      return `<h3 class="sub">${esc(cat)} <span class="dim">(${lista.length})</span></h3><p class="regra">${esc(desc)}</p>${lista.map(cardCriatura).join("")}`; }).join(""); }
  if (aba === "npcs") {
    const porPapel = {};
    NPCS.forEach((n) => (porPapel[n.papel] = porPapel[n.papel] || []).push(n));
    corpo = `<p class="regra">Figuras prontas para o Mestre puxar numa cena social: o que oferecem, o que querem e o segredo que guardam.</p>`
      + Object.entries(porPapel).map(([papel, lista]) => { const p = PAPEIS[papel] || { ic: "•", cor: "#8189a3" };
        return `<h3 class="sub">${p.ic} ${esc(papel)} <span class="dim">(${lista.length})</span></h3>` + lista.map((n) => `
          <details class="det grande best-card" style="border-left:3px solid ${p.cor}">
            <summary><b>${esc(n.n)}</b> <span class="best-tag" style="color:${p.cor};border-color:${p.cor}">${esc(n.atitude)}</span> <i class="dim">${esc(n.raca)} · ${esc(n.faccao)}</i></summary>
            <p class="regra">📍 ${esc(n.local)}</p>
            <p>${esc(n.gancho)}</p>
            <p class="npc-fala">${esc(n.fala)}</p>
            <p><b class="tech-c">Oferece:</b> ${esc(n.oferece)}</p>
            <p><b class="chrome">Quer:</b> ${esc(n.quer)}</p>
            <p><b style="color:var(--sombra)">Segredo (só o Mestre):</b> ${esc(n.segredo)}</p>
          </details>`).join(""); }).join("");
  }
  shell("biblioteca", `
    <header class="masthead"><h1>BIBLIOTECA<span> DO SISTEMA</span></h1>
      <div class="mast-sub">Tudo do livro Passagem Sombria v1.3, pesquisável e completo</div></header>
    <div class="filtros">${abas.map(([id2, l]) => `<a href="#/biblioteca/${id2}" class="${aba === id2 ? "on" : ""}">${l}</a>`).join("")}</div>
    <section class="sec">${corpo}</section>`, "biblioteca");
}

iniciar();
