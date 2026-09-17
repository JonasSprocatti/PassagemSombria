// ============================================================
// PASSAGEM SOMBRIA — DECK DE CAMPO ONLINE (SPA vanilla JS)
// Rotas: #/login #/hangar #/ficha/:id #/campanhas #/mesa/:id #/biblioteca
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { EFEITOS as EFEITOS_FICHA, validarEfeitos } from "./efeitos.js";
import { RACAS, CLASSES, FILOSOFIAS, IMPLANTES, SCRIPTS, ARMAS, ARMADURAS, PERICIAS, NAVES, ESTACOES, REGRAS_NAVE, RIQUEZA, TEMAS, CONVERTE_2D8, KEYWORDS, PALAVRAS_CHAVE, chavesDaArma, propsArma, AVARIAS, UPGRADES_NAVE, TURNOS_POR_PENTE, TIROS_POR_PENTE, TIPOS_PENTE, PENTE_PADRAO, CONSUMIVEIS, ehConsumivel, SLOTS_ARMA, SLOTS_POR_ARMA, MODS_ARMA, modsDoSlot, acharMod, LIMITE_TATUAGENS } from "./dados-jogo.js";
import { BESTIARIO } from "./dados-bestiario.js";
import { NPCS, PAPEIS } from "./dados-npcs.js";
import { FACCOES, NIVEIS_REPUTACAO, TABELAS, REFERENCIA  } from "./dados-mestre.js";
import { modalForm, confirmModal, somMensagem, somDado, somCritico, somFalha, notificar, pedirNotificacao, getSom, setSom } from "./ui.js";
// Regras puras (ficha, dados, condições, campo tático, tipos de dano) — extraídas
// pra um módulo sem import de rede, testável direto com `node --test tests/`.
// Ver public/js/regras.js.
import {
  d, sign, rollNd, parseDice, rolaDadoVida, rolaVidaInicial, migrarPericias, danoCritico,
  novaFichaDados, calc, pentesReservaDe, ganhosDoNivel, CONTEUDO_EXTRA, modosAtivosDe,
  CONDICOES_INFO, CONDICOES, infoCond, aplicarCond,
  CAMPO_LARGURA, CAMPO_JANELA, distCombate, posInicial,
  TIPOS_DANO, semAcento, imuneAoDano,
  capacidadeArma, municaoDe,
} from "./regras.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const app = document.getElementById("app");
const $ = (s, el = document) => el.querySelector(s);
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Rola uma expressão com vários termos: "1d20+2d10-1", "d20", "2d6 + 3". Devolve {total, detalhe} ou null.
// vant: 1 = vantagem, -1 = desvantagem, 0 = normal.
// Aplica-se ao primeiro d20 da expressão — que é o dado que decide o teste.
export const rolarExpr = (expr, vant = 0) => {
  let jaAplicou = false;
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
      let dados = rollNd(n, faces);
      if (vant !== 0 && faces === 20 && !jaAplicou) {          // vantagem incide no d20 do teste
        const alt = rollNd(n, faces);
        const somaA = dados.reduce((x, y) => x + y, 0), somaB = alt.reduce((x, y) => x + y, 0);
        const usa = vant > 0 ? (somaB > somaA ? alt : dados) : (somaB < somaA ? alt : dados);
        partes.push(`${vant > 0 ? "▲" : "▼"}[${somaA}/${somaB}]`);
        dados = usa; jaAplicou = true;
      }
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

export let usuario = null, perfil = null;
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


// (Ficha: novaFichaDados/calc/pentesReservaDe/dcSalvaguarda/ganhosDoNivel agora vivem
// em regras.js — importados no topo do arquivo.)
// ---------------- FICHA IMPRIMÍVEL (PDF / download) ----------------
// Gera um documento HTML autossuficiente, tema claro (economiza tinta), pronto p/ impressão.
export function gerarFichaHTML(nome, f, k) {
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
  // A cor do tema do personagem tinge a ficha inteira — cada tripulante
  // sai com uma folha que parece dele, não um formulário genérico.
  const tema = TEMAS[f.tema] || TEMAS["Vácuo"];
  const ACC = tema.tech, ACC2 = tema.chrome, ACC3 = tema.sombra;
  const css = `*{box-sizing:border-box}
  body{font-family:'Segoe UI',system-ui,sans-serif;color:#15181f;margin:0;padding:0;background:#fff;font-size:11.5px;line-height:1.45}
  .folha{padding:22px 26px 26px}
  /* Faixa de topo com a cor do personagem */
  .faixa{background:linear-gradient(115deg,${ACC}22,${ACC2}18 55%,transparent);
    border-left:6px solid ${ACC};padding:14px 18px;margin:0 0 16px;border-radius:0 10px 10px 0}
  h1{font-size:25px;margin:0;letter-spacing:.01em;color:#0e1118}
  .sub{color:#4a5060;margin:3px 0 0;font-size:12.5px}
  .etiquetas{margin-top:7px;display:flex;gap:6px;flex-wrap:wrap}
  .etq{font-size:10px;text-transform:uppercase;letter-spacing:.07em;padding:2px 9px;border-radius:20px;
    border:1.5px solid ${ACC};color:#2a2f3a;background:${ACC}1a;font-weight:600}
  h2{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:${ACC3};
    border-bottom:2px solid ${ACC3}44;padding-bottom:4px;margin:18px 0 9px;display:flex;align-items:center;gap:7px}
  h2::before{content:"";width:9px;height:9px;background:${ACC3};border-radius:2px;transform:rotate(45deg)}
  .top{display:flex;gap:16px;align-items:flex-start}
  .retr{width:104px;height:104px;border:3px solid ${ACC};border-radius:12px;object-fit:cover;flex:0 0 auto;
    box-shadow:0 3px 10px rgba(0,0,0,.14)}
  /* Atributos */
  .grid6{display:grid;grid-template-columns:repeat(6,1fr);gap:7px;margin-top:10px}
  .a{border:2px solid ${ACC}55;border-radius:9px;text-align:center;padding:8px 2px;background:${ACC}0d}
  .an{display:block;font-size:9px;color:#6a7080;text-transform:uppercase;letter-spacing:.08em;font-weight:600}
  .av{display:block;font-size:23px;font-weight:800;color:#0e1118;line-height:1.1}
  /* Vitais com barras */
  .vit{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
  .vit div{border:1px solid #dde1e8;border-radius:8px;padding:7px 10px;background:#fafbfc}
  .vit .dim{font-size:9px;color:#6a7080;text-transform:uppercase;letter-spacing:.06em;font-weight:600}
  .vit b{display:block;font-size:17px;color:#0e1118;margin-top:1px}
  .barra{height:5px;background:#e7eaef;border-radius:3px;overflow:hidden;margin-top:4px}
  .barra i{display:block;height:100%;border-radius:3px}
  /* Perícias em duas colunas */
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .per{width:100%;border-collapse:collapse}
  .per th{text-align:left;font-size:8.5px;color:#8a90a0;text-transform:uppercase;letter-spacing:.06em;padding:2px 4px}
  .per td{padding:3px 4px;border-bottom:1px solid #eef0f4}
  .per .tot{text-align:right;font-weight:700;color:#0e1118}
  .per .tr{background:${ACC}12}
  .per .tr td:first-child{color:${ACC3};font-weight:700}
  .dim{color:#8a90a0}
  /* Listas */
  ul{margin:4px 0;padding-left:17px}li{margin:3px 0}
  .hab b{color:${ACC3}}
  .notas{white-space:pre-wrap;border:1px solid #dde1e8;border-radius:8px;padding:10px;min-height:44px;background:#fafbfc}
  .rodape{margin-top:18px;padding-top:8px;border-top:1px solid #e7eaef;
    font-size:9px;color:#9aa0ae;display:flex;justify-content:space-between}
  @page{margin:12mm}
  @media print{body{padding:0}.folha{padding:0}h2{break-after:avoid}li,tr,.a,.vit div{break-inside:avoid}}`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Ficha — ${esc(nome || "Personagem")}</title><style>${css}</style></head><body>
  <div class="folha">
  <div class="faixa">
    <div class="top">${f.foto ? `<img class="retr" src="${f.foto}"/>` : ""}<div style="flex:1">
      <h1>${esc(nome || "Sem nome")}</h1>
      <p class="sub">${[raca ? `${raca.nome} — ${raca.planeta}` : "", f.classe].filter(Boolean).join(" · ")}</p>
      <div class="etiquetas">
        <span class="etq">Nível ${f.nivel}</span>
        ${f.filosofia ? `<span class="etq">${esc(f.filosofia)}</span>` : ""}
        ${raca ? `<span class="etq">Dado de vida 1d${raca.dadoVida}</span>` : ""}
      </div>
    </div></div>
    <div class="grid6">${ATTRS.map(attrCard).join("")}</div>
    <div class="vit">
      <div><span class="dim">Pontos de Vida</span><b>${f.pvAtual || 0} / ${k.pvMax || 0}</b>
        <span class="barra"><i style="width:${k.pvMax ? Math.max(0, Math.min(100, 100 * f.pvAtual / k.pvMax)) : 0}%;background:${ACC}"></i></span></div>
      <div><span class="dim">RAM</span><b>${k.ramLivre} / ${k.ramMax}</b>
        <span class="barra"><i style="width:${k.ramMax ? Math.max(0, Math.min(100, 100 * k.ramLivre / k.ramMax)) : 0}%;background:${ACC3}"></i></span></div>
      <div><span class="dim">Defesa (CD)</span><b>${k.cd}</b></div>
      <div><span class="dim">Iniciativa</span><b>${sign(k.iniciativa)}</b></div>
      <div><span class="dim">Deslocamento</span><b>${k.deslocamento} m</b></div>
      <div><span class="dim">Créditos</span><b>${f.creditos ?? 0} CG</b></div>
    </div>
  </div>
  <h2>Perícias</h2><div class="cols">${perTab(PERICIAS.slice(0, half))}${perTab(PERICIAS.slice(half))}</div>
  ${habs.length ? `<h2>Habilidades</h2><ul class="hab">${habs.map(([n, d]) => `<li><b>${esc(n)}:</b> ${esc(d)}</li>`).join("")}</ul>` : ""}
  ${implantes ? `<h2>Implantes</h2><ul>${implantes}</ul>` : ""}
  ${deck ? `<h2>Deck de Scripts (${f.deck.length}/${k.deckMax})</h2><ul>${deck}</ul>` : ""}
  ${inv ? `<h2>Inventário</h2><ul>${inv}</ul>` : ""}
  <h2>Suprimentos</h2>
  <p><b>Munição:</b> ${(() => { const r2 = normalizaPentes(f); const tp2 = TIPOS_PENTE[f.tipoPente || PENTE_PADRAO];
    const carregado = `${tp2.n} — ${f.tirosPente ?? TIROS_POR_PENTE}/${TIROS_POR_PENTE} tiros no cano`;
    const reserva = Object.entries(r2).filter(([, q]) => q > 0).map(([k2, q]) => `${TIPOS_PENTE[k2].n} ×${q}`).join(", ") || "reserva vazia";
    return `${carregado}. Reserva: ${reserva}.`; })()}</p>
  ${(() => { const cons = (f.inventario || []).filter((it) => ehConsumivel(it.nome) && (it.qtd || 1) > 0);
    return cons.length ? `<p><b>Itens utilizáveis:</b></p><ul>${cons.map((it) => { const c = ehConsumivel(it.nome);
      return `<li><b>${esc(it.nome)}</b> ×${it.qtd || 1} <span class="dim">(${esc(c.acao)})</span> — ${esc(c.d)}</li>`; }).join("")}</ul>` : ""; })()}
  <h2>Anotações</h2><div class="notas">${esc(f.notas || "")}</div>
  <div class="rodape"><span>Passagem Sombria — Deck de Campo</span><span>${new Date().toLocaleDateString("pt-BR")}</span></div>
  </div></body></html>`;
}
export function imprimirFichaHTML(html) {
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
// Habilidades que recarregam por SESSÃO (o Mestre abre a sessão na tela dele).
function abilidadesDeSessao(f) {
  const out = [];
  const raca = RACAS.find((r) => r.nome === f.raca), classe = CLASSES[f.classe];
  const filo = f.filosofia ? FILOSOFIAS[f.filosofia] : null;
  const ehSessao = (h) => h && (h.freq === "sessao" || /1x\s*\/\s*sess|por sess[ãa]o|1 vez por sess/i.test(`${h.n || ""} ${h.d || ""}`)
    || (h.efeitos || []).some((e) => e.tipo === "recurso" && e.freq === "sessao"));
  (classe?.hab || []).forEach((h, i) => { if (ehSessao(h)) out.push({ id: `cl${i}`, nome: h.n }); });
  if (classe?.vet && f.nivel >= 5 && ehSessao(classe.vet)) out.push({ id: "vet", nome: classe.vet.n });
  if (filo && ehSessao(filo)) out.push({ id: "filo", nome: f.filosofia });
  (raca?.habilidades || []).forEach((h, i) => { if (ehSessao(h)) out.push({ id: `ra${i}`, nome: h.n }); });
  return out;
}
// Duração de uma habilidade no nível atual (o Ven'y sobe para 5 e 8 turnos).
export function duracaoDe(h, nivel) {
  if (!h?.duracao) return null;
  const d2 = h.duracao; let t = d2.base || 1;
  for (const k of Object.keys(d2).filter((x) => /^\d+$/.test(x)).map(Number).sort((a, b) => a - b))
    if ((nivel || 1) >= k) t = d2[String(k)];
  return t;
}

// (modosAtivosDe agora vive em regras.js.)

// Habilidades ATIVAS do personagem — as que ele declara usar em combate.
// Reúne raça, classe, veterana e filosofia num formato único para a mesa.
export function habilidadesAtivas(f) {
  const out = [];
  const raca = RACAS.find((r) => r.nome === f.raca), classe = CLASSES[f.classe];
  const add = (id, h, origem) => {
    if (!h || h.tipo === "Passiva") return;
    out.push({ id, nome: h.n, d: h.d || "", origem, freq: h.freq || "livre",
               descanso: freqDescanso(h), opcoes: h.opcoes || null });
  };
  (classe?.hab || []).forEach((h, i) => add(`cl${i}`, h, f.classe));
  if (classe?.vet && f.nivel >= 5) add("vet", classe.vet, `${f.classe} · Veterana`);
  (raca?.habilidades || []).forEach((h, i) => add(`ra${i}`, h, raca.nome));
  if (raca?.lendaria && f.nivel >= 10) add("lend", raca.lendaria, `${raca.nome} · Lendária`);
  return out;
}

// Aplica um descanso à ficha (muta f) e devolve um resumo do que foi recuperado.
// Curto: reinicia habilidades "curto"; regen racial (Mercusys +1d4). PV normal via Kits.
// Longo: PV cheio, RAM cheia, reinicia TODAS as habilidades (curto + longo).
// Repõe os pentes num descanso preservando os TIPOS que a pessoa carrega.
// Antes isto gravava um número e apagava munição EMP/paralisante/incendiária.
function reporPentes(f) {
  const antes = normalizaPentes(f);
  const teto = pentesReservaDe(f);
  const usados = Object.entries(antes).filter(([, q]) => q > 0);
  const res = {}; for (const k of Object.keys(TIPOS_PENTE)) res[k] = 0;
  if (!usados.length) { res[f.tipoPente || PENTE_PADRAO] = teto; }
  else {
    // devolve o que havia e completa o resto com o tipo carregado na arma
    let total = 0;
    for (const [k, q] of usados) { res[k] = q; total += q; }
    const preferido = f.tipoPente || usados[0][0];
    res[preferido] = (res[preferido] || 0) + Math.max(0, teto - total);
  }
  f.pentes = res;
  f.tirosPente = TIROS_POR_PENTE;
  return Object.values(res).reduce((a, b) => a + b, 0);
}

function aplicarDescanso(f, tipo) {
  const cat = abilidadesDeDescanso(f);
  f.usos = f.usos || {};
  const notas = [];
  let pvRec = 0, ramRec = 0, habsReset = 0;
  // Qualquer descanso recarrega o escudo pessoal e dissolve o PV Temporário
  // (que vale "até o fim da batalha").
  if (f.escudoGasto) { notas.push("escudo pessoal recarregado"); f.escudoGasto = 0; }
  if (f.pvTemp) { notas.push(`${f.pvTemp} PV Temporário se dissolve`); f.pvTemp = 0; }
  // PV máximo EFETIVO (base salva + qualquer bônus de item/implante/modo em vigor),
  // não o valor bruto — senão quem tem vida máxima extra não conseguia usá-la no descanso.
  const pvMaxEf = calc(f).pvMax;
  if (tipo === "longo") {
    pvRec = Math.max(0, pvMaxEf - (f.pvAtual || 0));
    f.pvAtual = pvMaxEf;
    ramRec = f.ramGasta || 0; f.ramGasta = 0;
    f.modos = {};                       // o ar volta ao normal: modos ligados se desfazem
    const totPentes = reporPentes(f);
    cat.forEach((a) => { if (f.usos[a.id]) { delete f.usos[a.id]; habsReset++; } });
    notas.push(pvRec ? `+${pvRec} PV (cheio)` : "PV já cheio", ramRec ? `RAM recarregada (+${ramRec})` : "RAM já cheia", `${totPentes} pente(s) repostos`, `${cat.length} habilidade(s) reiniciada(s)`);
  } else {
    cat.filter((a) => a.freq === "curto").forEach((a) => { if (f.usos[a.id]) { delete f.usos[a.id]; habsReset++; } });
    const nCurto = cat.filter((a) => a.freq === "curto").length;
    notas.push(`${nCurto} habilidade(s) de descanso curto reiniciada(s)`);
    if (f.raca === "Mercusys") { const cura = d(4); pvRec = Math.min(cura, Math.max(0, pvMaxEf - (f.pvAtual || 0))); f.pvAtual = Math.min(pvMaxEf, (f.pvAtual || 0) + cura); notas.push(`regeneração Mercusys +${cura} PV`); }
    else notas.push("PV: use Kits Médicos");
    notas.push(`${reporPentes(f)} pente(s) repostos`);
  }
  return { tipo, pvRec, ramRec, habsReset, cat, notas };
}


// Dano de arma no nível atual (armas Nano-Tatuagem escalam nos marcos NV5 e NV9)
export function danoArma(cat, nivel) {
  if (!cat) return "1d4";
  if (!cat.escala) return cat.dano;
  const marcos = Object.keys(cat.escala).map(Number).sort((a, b) => a - b);
  let d = cat.dano;
  for (const m of marcos) if ((nivel || 1) >= m) d = cat.escala[String(m)];
  return d;
}

// ---------------- COMBATE ESPACIAL ----------------
export const POSTOS_ORDEM = ["leme", "artilharia", "engenharia", "sensores"];
export const combateNaveVazio = () => ({ ativo: false, rodada: 1, turno: 0, inimigas: [], avarias: [], agiram: [] });
// Defesa da nave = 10 + Manobrabilidade (Cap. 12)
export const defesaNave = (n) => 10 + (n?.manobra || 0);
// Aplica dano respeitando Escudos antes do Casco; devolve o detalhamento.
export function danoNave(alvo, valor) {
  const r = { escudos: 0, casco: 0, critico: false };
  let restante = valor;
  // Guerra Eletrônica desliga os escudos: enquanto `escudosOff` durar, nada absorve.
  const abs = (alvo.escudosOff > 0) ? 0 : Math.min(alvo.escudos || 0, restante);
  alvo.escudos = (alvo.escudos || 0) - abs; restante -= abs; r.escudos = abs;
  if (restante > 0) { alvo.casco = Math.max(0, (alvo.casco || 0) - restante); r.casco = restante; }
  if (r.casco > 15) r.critico = true;   // dano massivo dispara Falha Crítica
  return r;
}
export const rolarAvaria = () => AVARIAS[d(6) - 1];
// Ataques de uma nave: `nave.armas` (novo esquema — cada uma com `tipo` energia/
// balistica/missil e seu próprio `dano`) se existir; senão cai no esquema antigo
// (Canhões = `dano` do modelo + `ataques` cadastrados no admin), pra não quebrar
// nave customizada sem o campo novo. Com só uma opção, devolve ela direto — quem só
// tem canhão não vê pergunta nenhuma a mais. `bonus`/`acerto`, se omitido, +4 padrão.
export async function ataqueDaNave(nave, origemTxt = "") {
  const pool = nave?.armas?.length ? nave.armas : [{ n: "Canhões", dano: nave?.dano || "1d6" }, ...(nave?.ataques || [])];
  if (pool.length === 1) return pool[0];
  const r = await modalForm({ titulo: `⚔ ${origemTxt || nave?.nome || nave?.nome_batismo || nave?.modelo || "Nave"} — qual arma?`,
    campos: [{ k: "atk", label: "Ataque", tipo: "select",
      opcoes: pool.map((a, i) => { const cap = capacidadeArma(a); const mun = cap == null ? "" : ` (${municaoDe(nave, a)}/${cap})`;
        return { v: String(i), l: `${a.n || "Canhões"}${a.dano ? ` — ${a.dano}` : ""}${a.extra ? ` (${a.extra})` : ""}${mun}` }; }) }],
    okLabel: "Disparar" });
  if (!r?.atk) return null;   // cancelou
  return pool[+r.atk];
}

// ---------------- FERRAMENTAS DO MESTRE ----------------
const sorteia = (lista) => lista[Math.floor(Math.random() * lista.length)];
// Gera um resultado de tabela aleatória (npc é montado por partes)
export function rolarTabela(chave) {
  const t = TABELAS[chave]; if (!t) return "";
  if (t.monta) return `${sorteia(t.nomes)} ${sorteia(t.sobrenomes)} — ${sorteia(t.papeis)}. `
    + `Traço: ${sorteia(t.tracos)}. Quer: ${sorteia(t.querem)}.`;
  return sorteia(t.itens).replace(/\{creditos\}/g, () => String((1 + Math.floor(Math.random() * 12)) * 25));
}
// Orçamento de encontro: "pontos de ameaça" que uma party aguenta sem TPK.
// Peso de cada nível no orçamento de encontro, calibrado pela ameaça real:
// uma Colossal tem 2,5× o HP de um Chefe e mecânicas de raide — vale um encontro inteiro.
export const PESO_AMEACA = { Lacaio: 1, Comum: 2, Forte: 4, Elite: 6, Chefe: 12, "Super Chefe": 24, Colossal: 40 };
export function orcamentoEncontro(nivel, jogadores, dificuldade) {
  const base = (2 + (nivel || 1) * 1.5) * (jogadores || 1);
  const mult = { facil: 0.6, medio: 1, dificil: 1.5, mortal: 2.2 }[dificuldade] || 1;
  return Math.max(1, Math.round(base * mult));
}
// Sugere combinações de criaturas que cabem no orçamento
export function sugerirEncontro(orc) {
  const sug = [];
  for (const [tipo, peso] of Object.entries(PESO_AMEACA)) {
    const q = Math.floor(orc / peso);
    if (q >= 1 && q <= 12) sug.push({ tipo, q, sobra: orc - q * peso });
  }
  return sug.sort((a, b) => a.sobra - b.sobra).slice(0, 5);
}

// ---------------- COMBATE: rastreador de iniciativa ----------------
// (CONDICOES_INFO/CONDICOES/infoCond/aplicarCond agora vivem em regras.js.)
export const combateVazio = () => ({ ativo: false, rodada: 1, turno: 0, ordem: [], avarias: [], agiram: [], nave: naveTaticaVazia() });
// Estado tático da nave da tripulação durante o combate (Cap. 12).
// A nave NÃO tem turno: ela é o cenário. Quem age são os tripulantes, nos seus postos.
export const naveTaticaVazia = () => ({ evasiva: null, evasivaDe: null, alinhado: false, fraqueza: false, bloqueados: [] });
// Um participante pode ser pessoa/criatura (hp) ou nave (casco). Estes helpers unificam os dois.
export const ehNave = (c) => c?.tipo === "nave";
export const foraDeCombate = (c) => ehNave(c) ? (c.casco || 0) <= 0 : (c.hp || 0) <= 0;
export const vidaAtual = (c) => ehNave(c) ? c.casco : c.hp;
export const vidaMax = (c) => ehNave(c) ? c.casco_max : c.hp_max;
// (ordenarCombate/proximoTurno agora vivem em mesa-combate.js — únicos consumidores.)

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
  let painel = null, fundo = null;
  // Fechar tinha só dois jeitos: clicar de novo no ♿ (nada visual indica que é
  // "fechar", é o mesmo ícone de abrir) ou apertar Esc (não existe no celular).
  // Sem nenhum "X" nem overlay de fundo pra tocar fora, quem abria pelo toque
  // ficava preso — só recarregando a página. Agora: botão ✕ visível no canto do
  // painel, toque no overlay de fundo fecha, Esc continua funcionando, e clicar
  // de novo no ♿ também (mantém o toggle de antes).
  const fecharPainel = () => {
    if (fundo) { fundo.remove(); fundo = null; }
    if (painel) { painel.remove(); painel = null; }
    b.setAttribute("aria-expanded", "false");
  };
  b.onclick = () => {
    if (painel) { fecharPainel(); return; }
    fundo = document.createElement("div");
    fundo.className = "a11y-fundo";
    fundo.onclick = fecharPainel;
    document.body.appendChild(fundo);
    painel = document.createElement("div");
    painel.className = "a11y-painel"; painel.setAttribute("role", "dialog");
    painel.setAttribute("aria-label", "Opções de acessibilidade");
    painel.innerHTML = `<button type="button" class="a11y-x" aria-label="Fechar">✕</button>`
      + `<h3>Acessibilidade</h3><p class="regra">As escolhas ficam salvas neste dispositivo.</p>`
      + A11Y.map(({ k, lbl, d }) => `<label title="${esc(d)}"><input type="checkbox" data-a11y="${k}" ${localStorage.getItem("ps-a11y-" + k) === "1" ? "checked" : ""}/> <span>${esc(lbl)}</span></label>`).join("");
    document.body.appendChild(painel);
    b.setAttribute("aria-expanded", "true");
    painel.querySelector(".a11y-x").onclick = fecharPainel;
    painel.querySelectorAll("[data-a11y]").forEach((i) => i.onchange = () => {
      localStorage.setItem("ps-a11y-" + i.dataset.a11y, i.checked ? "1" : "0"); aplicarA11y();
    });
    painel.querySelector("input")?.focus();
  };
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && painel) { fecharPainel(); b.focus(); } });
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
    case "biblioteca": { const { telaBiblioteca } = await import("./biblioteca.js"); return telaBiblioteca(arg); }
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

export function shell(titulo, corpo, ativo = "") {
  // Tela cheia (hoje só o login): zera o padding do body pra `.tela-login` virar
  // um container de tela inteira de verdade (min-height:100dvh direto, sem ter
  // que descontar um número mágico do padding do body na conta) — mais simples
  // e sem acoplamento com um valor de padding que pode mudar no resto do app.
  document.body.classList.toggle("pagina-cheia", titulo === "login");
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
  requestAnimationFrame(() => animarBarras());   // rastro do dano / brilho da cura
}

// ---------------- AUTH ----------------
// (CONTEUDO_EXTRA agora vive em regras.js — importado no topo. É o mesmo objeto por
// referência; as atribuições abaixo em CONTEUDO_EXTRA[...] continuam mutando-o normalmente.)
// Arma com as modificações instaladas aplicadas: palavras-chave somadas,
// efeitos acumulados e capacidade do pente ajustada.
export function armaMontada(cat, item) {
  if (!cat || !item?.mods) return cat;
  const mods = Object.values(item.mods).map(acharMod).filter(Boolean);
  if (!mods.length) return cat;
  const kws = [String(cat.kw || "").trim(), ...mods.map((m) => m.kw).filter(Boolean)].filter(Boolean);
  return { ...cat,
    kw: [...new Set(kws.join(",").split(",").map((x) => x.trim()).filter(Boolean))].join(", "),
    _mods: mods,
    _efeitos: mods.flatMap((m) => (m.efeitos || []).map((e) => ({ ...e, origem: m.n }))),
    _tirosExtra: mods.reduce((a2, m) => a2 + (m.tirosExtra || 0), 0),
    _trocaLivre: mods.some((m) => m.trocaLivre),
  };
}
export const capacidadePente = (cat) => TIROS_POR_PENTE + (cat?._tirosExtra || 0);

// ---------------------------------------------------------------------------
//  BANCADA — HUD de customização de armas e naves.
//  A peça no centro, os slots ao redor, e o antes/depois visível a cada escolha.
// ---------------------------------------------------------------------------
const ROT_SLOT = { mira: "Mira", cano: "Cano", coronha: "Coronha", carregador: "Carregador",
  revestimento: "Revestimento", fio: "Fio", nucleo: "Núcleo", empunhadura: "Empunhadura" };
const IC_SLOT = { mira: "🎯", cano: "🔩", coronha: "🪝", carregador: "▮",
  revestimento: "🛡", fio: "🗡", nucleo: "🔥", empunhadura: "🤲" };

function abrirBancada({ f, item, catBase, emCombate, onSalvar }) {
  const slots = SLOTS_POR_ARMA(catBase);
  item.mods = item.mods || {};
  const ov = document.createElement("div"); ov.className = "ss-overlay ov-modal bancada-ov"; ov.style.zIndex = "10020";
  const fechar = () => { document.body.style.overflow = ""; ov.remove(); };
  let selecionado = null;   // slot aberto para escolha

  const montada = () => armaMontada(catBase, item);
  const resumo = () => {
    const m = montada();
    const pr = propsArma(m);
    const bonusAcerto = (m._efeitos || []).filter((e) => e.tipo === "acerto").reduce((a, e) => a + (e.valor || 0), 0);
    const bonusDano = (m._efeitos || []).filter((e) => e.tipo === "dano").reduce((a, e) => a + (e.valor || 0), 0);
    return { m, pr, bonusAcerto, bonusDano, cap: capacidadePente(m) };
  };
  const custoTotal = () => Object.values(item.mods).map(acharMod).filter(Boolean).reduce((a, x) => a + x.p, 0);

  const pintar = () => {
    const { m, pr, bonusAcerto, bonusDano, cap } = resumo();
    const dano = danoArma(catBase, f.nivel);
    ov.innerHTML = `<div class="bancada">
      <div class="mp-topo"><b>🔧 Bancada de Modificações</b>
        <span class="dim">${esc(catBase.n)}</span>
        <button id="bc-x" class="mp-x" style="margin-left:auto">✕</button></div>

      <div class="bc-corpo">
        <div class="bc-arma">
          <div class="bc-silhueta">${img(catBase.n) || `<span class="bc-ic">${catBase.tipo === "fogo" ? "🔫" : "⚔"}</span>`}</div>
          <div class="bc-stats">
            <div class="bc-stat"><span>Dano</span><b>${esc(dano)}${bonusDano ? ` <i class="bc-mais">+${bonusDano}</i>` : ""}</b></div>
            <div class="bc-stat"><span>Acerto</span><b>${bonusAcerto >= 0 ? "+" : ""}${bonusAcerto || 0}</b></div>
            ${catBase.tipo === "fogo" ? `<div class="bc-stat"><span>Pente</span><b>${cap}${cap > TIROS_POR_PENTE ? ` <i class="bc-mais">+${cap - TIROS_POR_PENTE}</i>` : ""}</b></div>` : ""}
            <div class="bc-stat"><span>Investido</span><b class="chrome">${custoTotal()} CG</b></div>
          </div>
          ${m.kw ? `<div class="bc-kws">${etiquetasKw(m)}</div>` : ""}
        </div>

        <div class="bc-slots">
          ${slots.map((sl) => { const nome = item.mods[sl]; const mod = nome && acharMod(nome);
            return `<button class="bc-slot ${mod ? "ocupado" : ""} ${selecionado === sl ? "aberto" : ""}" data-slot="${sl}">
              <span class="bc-slot-ic">${mod ? mod.ic : IC_SLOT[sl]}</span>
              <span class="bc-slot-txt"><i>${esc(ROT_SLOT[sl] || sl)}</i>
                <b>${mod ? esc(mod.n) : "vazio"}</b>
                ${mod ? `<span class="regra">${esc(mod.d)}</span>` : `<span class="regra dim">clique para instalar</span>`}</span>
              ${mod ? `<span class="bc-remover" data-remover="${sl}" title="Remover peça">✕</span>` : ""}
            </button>`; }).join("")}
        </div>

        ${selecionado ? (() => {
          const opcoes = modsDoSlot(selecionado, catBase.tipo);
          return `<div class="bc-loja"><h4>${IC_SLOT[selecionado]} ${esc(ROT_SLOT[selecionado])} — peças disponíveis</h4>
            ${opcoes.length ? opcoes.map((o) => { const tem = item.mods[selecionado] === o.n;
              const podePagar = tem || (f.creditos ?? 0) >= o.p;
              return `<button class="bc-peca ${tem ? "on" : ""}" data-instalar="${esc(o.n)}" ${podePagar ? "" : "disabled"}>
                <span class="bc-peca-ic">${o.ic}</span>
                <span class="bc-peca-txt"><b>${esc(o.n)}</b><span class="regra">${esc(o.d)}</span>
                  ${o.kw ? `<span class="auto-tag">adiciona ${esc(o.kw)}</span>` : ""}</span>
                <span class="bc-peca-preco ${podePagar ? "" : "caro"}">${o.p} CG<i>${o.turnos}t p/ instalar</i></span>
              </button>`; }).join("")
              : `<p class="regra"><i>Nenhuma peça para este slot.</i></p>`}</div>`; })() : ""}

        <p class="regra bc-nota">${emCombate
          ? "⚠ Você está em combate: instalar ou remover consome os turnos indicados em cada peça."
          : "Fora de combate a troca é livre. Remover devolve metade do valor da peça."}</p>
      </div>
    </div>`;
    ligar();
  };

  const ligar = () => {
    ov.querySelector("#bc-x").onclick = fechar;
    ov.querySelectorAll("[data-slot]").forEach((b) => b.onclick = (e) => {
      if (e.target.closest("[data-remover]")) return;
      selecionado = selecionado === b.dataset.slot ? null : b.dataset.slot; pintar();
    });
    ov.querySelectorAll("[data-remover]").forEach((b) => b.onclick = async (e) => {
      e.stopPropagation();
      const sl = b.dataset.remover; const mod = acharMod(item.mods[sl]); if (!mod) return;
      const devolve = Math.floor(mod.p / 2);
      if (!(await confirmModal(`Remover ${mod.n}?\n\nVocê recebe ${devolve} CG de volta.${emCombate ? `\n\n⚠ Em combate isto consome ${mod.turnos} turno(s).` : ""}`, { okLabel: "Remover", perigo: true }))) return;
      delete item.mods[sl];
      f.creditos = (f.creditos ?? 0) + devolve;
      await onSalvar(`🔧 Removeu ${mod.n} de ${catBase.n} (+${devolve} CG).${emCombate ? ` Custou ${mod.turnos} turno(s).` : ""}`);
      pintar();
    });
    ov.querySelectorAll("[data-instalar]").forEach((b) => b.onclick = async () => {
      const mod = acharMod(b.dataset.instalar); if (!mod) return;
      if (item.mods[selecionado] === mod.n) return;
      const antigo = acharMod(item.mods[selecionado]);
      const devolve = antigo ? Math.floor(antigo.p / 2) : 0;
      const liquido = mod.p - devolve;
      if ((f.creditos ?? 0) < liquido) return alert(`Faltam ${liquido - (f.creditos ?? 0)} CG.`);
      if (!(await confirmModal(`Instalar ${mod.n}?\n\n${mod.d}\n\nCusto: ${mod.p} CG${antigo ? ` (−${devolve} CG pela peça antiga)` : ""}.${emCombate ? `\n\n⚠ Em combate consome ${mod.turnos} turno(s).` : ""}`, { okLabel: "Instalar" }))) return;
      item.mods[selecionado] = mod.n;
      f.creditos = (f.creditos ?? 0) - liquido;
      await onSalvar(`🔧 Instalou ${mod.ic} ${mod.n} em ${catBase.n} (−${liquido} CG).${mod.kw ? ` A arma ganha ${mod.kw}.` : ""}${emCombate ? ` Custou ${mod.turnos} turno(s).` : ""}`);
      selecionado = null; pintar();
    });
    ov.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });
  };
  document.body.appendChild(ov); document.body.style.overflow = "hidden";
  pintar();
}

// Etiquetas de palavra-chave que explicam o que fazem — em vez do nome solto.
// Mostra a progressão de dano de uma arma que escala por nível.
export function escalaTabela(cat, nivelAtual = null) {
  if (!cat?.escala) return "";
  const marcos = Object.keys(cat.escala).map(Number).sort((a, b) => a - b);
  const faixas = [{ de: 1, ate: marcos[0] - 1, d: cat.dano }];
  marcos.forEach((m, i) => faixas.push({ de: m, ate: marcos[i + 1] ? marcos[i + 1] - 1 : 10, d: cat.escala[String(m)] }));
  return faixas.map((f2) => {
    const ativa = nivelAtual != null && nivelAtual >= f2.de && nivelAtual <= f2.ate;
    return `<span class="escala-faixa ${ativa ? "atual" : ""}"><i>NV ${f2.de}${f2.ate > f2.de ? `–${f2.ate}` : ""}</i><b>${esc(f2.d)}</b></span>`;
  }).join("");
}

export function etiquetasKw(cat, { detalhado = false } = {}) {
  const chaves = chavesDaArma(cat);
  if (!chaves.length) return "";
  const linha = chaves.map((c) => {
    const efs = [];
    if (c.props?.agil) efs.push("usa Destreza");
    if (c.props?.oculta) efs.push("furtiva");
    if (c.props?.brutal) efs.push("vantagem");
    if (c.props?.area) efs.push(c.props.areaTxt || "área");
    if (c.props?.alcance) efs.push(c.props.alcanceTxt || "alcance");
    if (c.ignoraArmadura) efs.push(`ignora ${c.ignoraArmadura} de armadura`);
    if (c.aoAcertar) efs.push(`${c.aoAcertar.cond} ${c.aoAcertar.turnos}t`);
    for (const e of c.efeitos || []) { const r = EFEITOS_FICHA[e.tipo]?.rotulo(e); if (r) efs.push(r); }
    const auto = efs.length > 0;
    return `<span class="kw-tag ${auto ? "auto" : ""}" title="${esc(KEYWORDS[c.nome] || c.nome)}">${esc(c.nome)}${efs.length ? ` <i>${esc(efs.join(" · "))}</i>` : ""}</span>`;
  }).join("");
  if (!detalhado) return `<span class="kw-linha">${linha}</span>`;
  // versão longa: cada palavra-chave com a regra inteira
  return `<span class="kw-linha">${linha}</span>
    <div class="kw-detalhe">${chaves.map((c) => `<p><b class="tech-c">${esc(c.nome)}:</b> ${esc(KEYWORDS[c.nome] || "sem descrição cadastrada")}
      ${c.aoAcertar ? `<span class="auto-tag">aplica ${esc(c.aoAcertar.cond)} automaticamente</span>` : ""}
      ${c.ignoraArmadura ? `<span class="auto-tag">ignora ${c.ignoraArmadura} de armadura</span>` : ""}</p>`).join("")}</div>`;
}

let CRIA = null;   // motor de criaturas (efeitos automáticos)
export async function criaturaMod() { if (!CRIA) CRIA = await import("./criaturas.js"); return CRIA; }
// (rolarTexto agora vive em mesa-combate.js — único consumidor.)

let CONT = null;   // módulo de conteúdo editável (carregado sob demanda)
export async function conteudoMod() {
  if (!CONT) { CONT = await import("./conteudo.js"); await CONT.carregarConteudo(); sincronizarExtra(); }
  return CONT;
}
export function sincronizarExtra() {
  const c = CONT?.conteudo?.(); if (!c) return;
  for (const k of ["implantes", "armaduras", "armas", "consumiveis", "naves", "npcs"]) CONTEUDO_EXTRA[k] = c[k] || [];
  // versões completas, com os ajustes já aplicados, para o calc() usar
  CONTEUDO_EXTRA.implantesTodos = todosImplantes();
  CONTEUDO_EXTRA.armadurasTodas = todasArmaduras();
  CONTEUDO_EXTRA.armasTodas = todasArmas();
  CONTEUDO_EXTRA.racas = CONT.comAjustes(RACAS, "raca", "nome");
  CONTEUDO_EXTRA.classes = CLASSES;
  CONTEUDO_EXTRA.filosofias = FILOSOFIAS;
  // Palavras-chave cadastradas entram no catálogo do jogo, para que propsArma
  // as reconheça exatamente como as nativas.
  for (const ch of c.chaves || []) {
    if (!ch.n) continue;
    const def = { props: {} };
    if (ch.marca) def.props[ch.marca] = true;
    if (ch.ignoraArmadura) def.ignoraArmadura = +ch.ignoraArmadura;
    if (ch.cond) def.aoAcertar = { cond: ch.cond, turnos: +ch.turnos || 1, ...(ch.cd ? { cd: +ch.cd } : {}) };
    if ((ch.efeitos || []).length) def.efeitos = ch.efeitos;
    PALAVRAS_CHAVE[ch.n] = def;
    if (ch.d) KEYWORDS[ch.n] = ch.d;
  }
}
export const img = (nome) => (CONT ? CONT.thumb(nome) : "");
export const imgFig = (nome) => (CONT ? CONT.figura(nome) : "");
export const extras = (tipo) => (CONT ? CONT.conteudo()[tipo] || [] : []);
// Listas do jogo: itens nativos (já com os ajustes da administração aplicados
// por cima) somados ao conteúdo criado do zero.
const ajustar = (lista, tipo) => (CONT ? CONT.comAjustes(lista, tipo) : lista);
export const todasArmas = () => [...ajustar(ARMAS, "arma"), ...extras("armas")];
export const todasArmaduras = () => [...ajustar(ARMADURAS, "armadura"), ...extras("armaduras")];
export const todosImplantes = () => [...ajustar(IMPLANTES, "implante"), ...extras("implantes")];
export const todosConsumiveis = () => [...ajustar(CONSUMIVEIS, "consumivel"), ...extras("consumiveis")];
export const todasNaves = () => [...ajustar(NAVES, "nave"), ...extras("naves")];
export const todosNPCs = () => [...ajustar(NPCS, "npc"), ...extras("npcs")];
export const todasCriaturas = () => [...ajustar(BESTIARIO, "criatura"), ...extras("criaturas")];

// Salva `dados` de UMA ficha (`personagens.dados`) já checando erro — módulo-level
// porque telaFicha e telaMesa (dano, cura, RAM, level up, inventário…) precisam dela
// igual. Sem isto, uma falha silenciosa deixava a mudança só na tela: o app já tinha
// renderizado como se tivesse dado certo, e o PV/RAM/item "voltava" sozinho ao recarregar.
export async function salvarFicha(personagemId, dados, rotulo = "salvar a ficha") {
  const { error } = await sb.from("personagens").update({ dados }).eq("id", personagemId);
  if (error) alert(`Não consegui ${rotulo}: ${error.message}`);
  return !error;
}

// ---------------------------------------------------------------------------
//  AVISO COM DESFAZER — confirma depois da ação em vez de perguntar antes.
//  Some sozinho; enquanto está na tela, dá para voltar atrás.
// ---------------------------------------------------------------------------
let avisoTimer = null;
export function avisar(texto, aoDesfazer = null, ms = 6000) {
  document.querySelector(".aviso")?.remove(); clearTimeout(avisoTimer);
  const el = document.createElement("div");
  el.className = "aviso";
  el.innerHTML = `<span>${esc(texto)}</span>${aoDesfazer ? `<button class="aviso-undo">↶ Desfazer</button>` : ""}<button class="aviso-x" aria-label="Fechar">✕</button>`;
  document.body.appendChild(el);
  const fecha = () => { el.classList.add("saindo"); setTimeout(() => el.remove(), 200); clearTimeout(avisoTimer); };
  el.querySelector(".aviso-x").onclick = fecha;
  el.querySelector(".aviso-undo")?.addEventListener("click", async () => { fecha(); await aoDesfazer(); });
  avisoTimer = setTimeout(fecha, ms);
}

// ---------------------------------------------------------------------------
//  ATALHOS DE TECLADO — o Mestre repete os mesmos gestos dezenas de vezes.
// ---------------------------------------------------------------------------
document.addEventListener("keydown", (e) => {
  const alvo = e.target;
  const digitando = alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.tagName === "SELECT" || alvo.isContentEditable);
  // Esc fecha o painel mais recente (modais tratam o próprio Esc)
  if (e.key === "Escape" && !digitando) {
    const painel = document.querySelector(".a11y-painel"); if (painel) return painel.remove();
  }
  if (digitando) {
    if (e.key === "Escape") alvo.blur();
    return;
  }
  // "/" foca o campo de mensagem da mesa
  if (e.key === "/" ) { const m = document.getElementById("msg"); if (m) { e.preventDefault(); m.focus(); } return; }
  // Espaço avança o turno (só quando há combate e você é o Mestre)
  if (e.key === " " || e.code === "Space") { const b = document.getElementById("cb-prox"); if (b) { e.preventDefault(); b.click(); } return; }
  // Números 1-4 trocam as abas da mesa
  if (/^[1-4]$/.test(e.key)) { const abas = document.querySelectorAll(".mesa-aba"); const b = abas[+e.key - 1]; if (b) { e.preventDefault(); b.click(); } return; }
  // "?" mostra a lista de atalhos
  if (e.key === "?") { e.preventDefault(); mostrarAtalhos(); }
});
function mostrarAtalhos() {
  modalForm({ titulo: "⌨ Atalhos de teclado", campos: [{ k: "i", tipo: "html", label: "", html: `
    <table class="stats-tab"><tbody>
      <tr><td><kbd>/</kbd></td><td>Focar o campo de mensagem</td></tr>
      <tr><td><kbd>Espaço</kbd></td><td>Próximo turno do combate</td></tr>
      <tr><td><kbd>1</kbd>–<kbd>4</kbd></td><td>Trocar as abas da mesa</td></tr>
      <tr><td><kbd>Esc</kbd></td><td>Fechar painel ou sair do campo</td></tr>
      <tr><td><kbd>?</kbd></td><td>Mostrar esta lista</td></tr>
    </tbody></table>` }], okLabel: "Fechar", semCancelar: true });
}

// Ondulação a partir do ponto clicado, em qualquer botão do app.
// Um só listener no documento: funciona também para botões criados depois.
document.addEventListener("pointerdown", (e) => {
  const b = e.target.closest("button, .filtros a, .mesa-aba, .btn-ghost, .btn-primario, .btn-novo");
  if (!b || document.body.classList.contains("a11y-reduzir")) return;
  const r = b.getBoundingClientRect();
  b.style.setProperty("--ox", `${e.clientX - r.left}px`);
  b.style.setProperty("--oy", `${e.clientY - r.top}px`);
  b.classList.remove("ondula"); void b.offsetWidth; b.classList.add("ondula");
  setTimeout(() => b.classList.remove("ondula"), 520);
  // Ações de peso ganham um pulso de confirmação
  const perigo = b.matches(".dano, .rm, .cb-atk, .cbn-atk, .cb-rm");
  const forte = b.matches(".eq, .btn-primario, .atq, #rolar-per, #conjurar");
  if (perigo || forte) { const cls = perigo ? "pulsa-perigo" : "pulsa-tech";
    b.classList.remove(cls); void b.offsetWidth; b.classList.add(cls);
    setTimeout(() => b.classList.remove(cls), 470); }
}, { passive: true });

// Conta um número até o novo valor. Usado quando créditos e XP mudam:
// ver o número subindo diz o que aconteceu melhor do que ele simplesmente trocar.
// A reserva de pentes virou um mapa por tipo. Fichas antigas guardavam um número:
// esta função converte sem perder munição.
// A reserva de pentes é da mochila (compartilhada), mas o pente CARREGADO vive
// em cada arma: duas armas de fogo têm contagens independentes.
export function estadoArma(f, it) {
  const cat = todasArmas().find((w) => w.n === it.nome);
  if (!cat || cat.tipo !== "fogo") return null;
  // migração: fichas antigas tinham um único tirosPente global
  if (it.tiros == null) {
    it.tiros = (f.tirosPente != null && f.__migrouArma !== true) ? f.tirosPente : TIROS_POR_PENTE;
    it.tipoPente = it.tipoPente || f.tipoPente || PENTE_PADRAO;
  }
  return { cat, tiros: it.tiros, tipo: it.tipoPente || PENTE_PADRAO };
}
export const armasDeFogo = (f) => (f.inventario || []).filter((it) => it.equip && ARMAS.find((w) => w.n === it.nome && w.tipo === "fogo"));

export function normalizaPentes(f) {
  let r = f.pentes;
  if (typeof r === "number") r = { padrao: r };
  if (!r || typeof r !== "object") r = { padrao: pentesReservaDe(f) };
  const out = {};
  for (const k of Object.keys(TIPOS_PENTE)) out[k] = Math.max(0, r[k] || 0);
  return out;
}
const xpVisto = {};   // último XP visto por personagem, para animar o ganho
function contarAte(el, de, para, ms = 700, sufixo = "") {
  if (!el || de === para || document.body.classList.contains("a11y-reduzir")) {
    if (el) el.textContent = para + sufixo; return;
  }
  const t0 = performance.now(); const dif = para - de;
  el.classList.add(dif > 0 ? "num-sobe" : "num-desce");
  const passo = (t) => {
    const p = Math.min(1, (t - t0) / ms);
    const eased = 1 - Math.pow(1 - p, 3);              // desacelera no fim
    el.textContent = Math.round(de + dif * eased) + sufixo;
    if (p < 1) requestAnimationFrame(passo);
    else setTimeout(() => el.classList.remove("num-sobe", "num-desce"), 400);
  };
  requestAnimationFrame(passo);
}

// A cena de subir de nível: acontece poucas vezes por campanha e merece peso.
async function cenaNivel(nivel, ganhoPV, detalhe, extras) {
  if (document.body.classList.contains("a11y-reduzir")) return;
  const ov = document.createElement("div");
  ov.className = "nv-cena";
  ov.innerHTML = `<div class="nv-caixa">
      <div class="nv-halo"></div>
      <span class="nv-eyebrow">Nível alcançado</span>
      <div class="nv-num">${nivel}</div>
      <div class="nv-linha"></div>
      <ul class="nv-ganhos">
        <li><b>+${ganhoPV} PV</b> <span class="dim">${esc(detalhe)}</span></li>
        ${extras.map((g) => `<li>${esc(g)}</li>`).join("")}
      </ul>
      <button class="btn-primario nv-ok">Continuar</button>
    </div>`;
  document.body.appendChild(ov);
  try { somCritico(); } catch (_) {}
  await new Promise((res) => {
    ov.querySelector(".nv-ok").onclick = res;
    ov.addEventListener("click", (e) => { if (e.target === ov) res(); });
    setTimeout(res, 9000);
  });
  ov.classList.add("saindo");
  setTimeout(() => ov.remove(), 260);
}

// Guarda a largura anterior de cada barra para desenhar o rastro do dano.
const larguraAnterior = {};
function animarBarras(raiz = document) {
  raiz.querySelectorAll("[data-barra]").forEach((box) => {
    const chave = box.dataset.barra;
    const barra = box.querySelector(".cb-hp-barra"), rastro = box.querySelector(".rastro");
    if (!barra || !rastro) return;
    const atual = parseFloat(barra.style.width) || 0;
    const antes = larguraAnterior[chave];
    if (antes != null && antes > atual) {          // perdeu vida: o rastro mostra de onde veio
      rastro.style.transition = "none"; rastro.style.width = antes + "%";
      void rastro.offsetWidth; rastro.style.transition = "";
      requestAnimationFrame(() => { rastro.style.width = atual + "%"; });
    } else if (antes != null && antes < atual) {   // curou: brilho verde percorre a barra
      rastro.style.width = atual + "%";
      box.classList.remove("curou"); void box.offsetWidth; box.classList.add("curou");
      setTimeout(() => box.classList.remove("curou"), 950);
    } else rastro.style.width = atual + "%";
    larguraAnterior[chave] = atual;
  });
}

// Um crítico ou uma falha crítica sacode a mesa por um instante.
function sacudir() {
  if (document.body.classList.contains("a11y-reduzir")) return;
  document.body.classList.remove("critico"); void document.body.offsetWidth;
  document.body.classList.add("critico");
  setTimeout(() => document.body.classList.remove("critico"), 420);
}

async function iniciar() {
  const convite = sessionStorage.getItem("ps-convite");
  if (convite && location.hash.indexOf("#/entrar/") !== 0) { sessionStorage.removeItem("ps-convite"); location.hash = `#/entrar/${convite}`; }
  aplicarA11y(); montarA11y();
  conteudoMod().catch(() => {});   // conteúdo do banco; se falhar, segue com o estático
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
    <div class="tela-login"><div class="estrelas"></div>
    <div class="login-caixa">
      <img src="logo.svg" alt="Passagem Sombria" class="login-logo"/>
      <div class="mast-eyebrow" style="text-align:center">CONFEDERAÇÃO SOLAR · TERMINAL DE ACESSO</div>
      <h1>PASSAGEM<span> SOMBRIA</span></h1>
      <p class="sub">O sistema é grande, e o vazio entre os mundos é maior.</p>
      <button id="google" class="btn-primario">ENTRAR COM GOOGLE</button>
      <div class="ou">ou receba um link mágico por e-mail</div>
      <div class="linha-email"><input id="email" type="email" placeholder="voce@estacao.orbital"/>
      <button id="magic" class="btn-ghost">ENVIAR LINK</button></div>
      <p class="regra">Ao entrar, um perfil de tripulante é criado automaticamente. <a href="#/biblioteca">Explorar a Biblioteca sem login →</a></p>
    </div></div>`);
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
    const tema = TEMAS[f.tema] || TEMAS["Vácuo"];
    return `<article class="card-pers" data-id="${p.id}" style="--acento:${tema.tech}">
      <span class="selo-nv" style="border-color:${tema.tech};color:${tema.tech}">NV ${f.nivel || 1}</span>
      <button class="card-del" data-del="${p.id}" title="Apagar tripulante">✕</button>
      ${f.foto ? `<img class="retrato" src="${f.foto}" alt="${esc(p.nome)}"/>` : `<div class="retrato-vazio">◈</div>`}
      <div class="info">
        <div class="nome">${esc(p.nome) || "— sem nome —"}</div>
        <div class="meta">${esc(f.raca || "raça?")} · ${esc(f.classe || "classe?")}${p.campanha_id ? " · ☄ em campanha" : ""}</div>
        <div class="card-stats"><span>PV <b>${f.pvAtual || 0}</b>/${k.pvMax}</span><span>CD <b>${k.cd}</b></span><span class="sombra-c">RAM <b>${k.ramLivre}</b>/${k.ramMax}</span></div>
      </div>
    </article>`; }).join("");
  shell("hangar", `
    <header class="masthead"><div class="mast-eyebrow">ARQUIVO DE PESSOAL · ${esc(perfil?.apelido || "")}</div>
      <h1>HANGAR<span> DE TRIPULANTES</span></h1></header>
    <div class="grid-fichas">${cards || `<div class="vazio"><p class="vazio-t">Nenhum tripulante registrado.</p></div>`}</div>
    <div class="hangar-acoes"><button id="novo" class="btn-novo">+ REGISTRAR NOVO TRIPULANTE</button>
      <button id="novo-vazio" class="mini" title="Cria a ficha em branco, para preencher na mão">ficha em branco</button></div>`, "hangar");
  $("#novo").onclick = async () => {
    const u = await sessaoAtiva(); if (!u) return;
    const { abrirCriacao } = await import("./criacao.js");
    abrirCriacao({
      abrirSistemaSolar: async (escolher) => {
        const { abrirSeletorPlanetas } = await import("./sistema-solar.js");
        abrirSeletorPlanetas(RACAS, escolher);
      },
      onCriar: async (escolhas, nome) => {
        const dados = { ...novaFichaDados(), ...escolhas };
        const { data, error } = await sb.from("personagens")
          .insert({ dono_id: u.id, nome, dados }).select("id").single();
        if (error) return alert("Não consegui registrar o tripulante: " + error.message);
        location.hash = `#/ficha/${data.id}`;
      },
    });
  };
  // Atalho para quem prefere a ficha em branco e preencher na mão.
  $("#novo-vazio")?.addEventListener("click", async () => {
    const u = await sessaoAtiva(); if (!u) return;
    const { data, error } = await sb.from("personagens").insert({ dono_id: u.id, nome: "", dados: novaFichaDados() }).select("id").single();
    if (error) return alert(error.message);
    location.hash = `#/ficha/${data.id}`;
  });
  app.querySelectorAll(".card-pers").forEach((c) => c.onclick = (e) => { if (!e.target.dataset.del) location.hash = `#/ficha/${c.dataset.id}`; });
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
  let salvando = false, pendente = false, autoTimer = null;
  const marcaEstado = (txt, cls = "") => { const el = document.getElementById("st"); if (el) { el.textContent = txt; el.className = "topo-status " + cls; } };
  const salvar = async () => {
    if (salvando) { pendente = true; return; }          // enfileira em vez de atropelar
    salvando = true;
    const { error } = await sb.from("personagens").update({ nome: f.nomeVisivel ?? p.nome, dados: f, atualizado_em: new Date().toISOString() }).eq("id", id);
    salvando = false;
    if (error) { marcaEstado("⚠ não salvou — tentando de novo", "erro"); setTimeout(salvar, 2500); return; }
    marcaEstado("salvo ✓", "ok");
    if (pendente) { pendente = false; salvar(); }
  };
  // Salvamento automático: qualquer mudança na ficha grava sozinha em ~1s.
  // Antes era preciso clicar em SALVAR, e dava para comprar um item, ir para a
  // mesa e descobrir que nada tinha sido gravado.
  const autoSalvar = () => {
    marcaEstado("salvando…", "salvando");
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => salvar(), 900);
  };
  // Rede de segurança: se sair da página com algo pendente, grava na hora.
  const aoSair = () => { if (autoTimer) { clearTimeout(autoTimer); salvar(); } };
  window.addEventListener("beforeunload", aoSair);
  window.addEventListener("hashchange", aoSair, { once: true });
  const render = () => {
    const k = calc(f);
    const raca = RACAS.find((r) => r.nome === f.raca), classe = CLASSES[f.classe];
    const sobra = k.pontosDireito - k.pontosGastos, sobraPer = k.perDireito - k.perGastas;
    const usados = ["For","Des","Con","Int","Sab","Car"].map((a) => f.rolagem[a]).filter((v) => v !== null);
    const pool = [...(f.rolagemPool || [])];
    usados.forEach((v) => { const i = pool.indexOf(v); if (i >= 0) pool.splice(i, 1); });
    const ganhos = ganhosDoNivel(f.nivel + 1, f);
    const xpAntes = xpVisto[p.id];
    xpVisto[p.id] = f.xp;
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
        ${(() => {
          const pvP = k.pvMax ? Math.max(0, Math.min(100, 100 * f.pvAtual / k.pvMax)) : 0;
          const ramP = k.ramMax ? Math.max(0, Math.min(100, 100 * k.ramLivre / k.ramMax)) : 0;
          const est = f.pvAtual <= 0 ? "morto" : pvP <= 30 ? "critico" : pvP <= 60 ? "ferido" : "";
          return `<div class="vitais-barras" style="margin-top:14px">
            <div class="vb" data-barra="ficha-pv">
              <div class="vb-topo"><span>❤ Pontos de Vida</span><b class="${est}">${f.pvAtual}<span class="dim">/${k.pvMax}</span></b>${k.pvMaxBonus ? `<span class="dim" style="font-size:10px" title="PV máximo base ${f.pvMax || 0} + ${k.pvMaxBonus} de bônus">(${sign(k.pvMaxBonus)})</span>` : ""}</div>
              <div class="vb-trilho"><span class="rastro"></span><span class="cb-hp-barra vb-fill ${est}" style="width:${pvP}%"></span></div>
              ${est === "morto" ? `<span class="vb-aviso">☠ Inconsciente — role a salvaguarda de morte no seu turno.</span>`
                : est === "critico" ? `<span class="vb-aviso">⚠ Gravemente ferido</span>` : ""}
            </div>
            <div class="vb" data-barra="ficha-ram">
              <div class="vb-topo"><span>◈ RAM disponível</span><b class="sombra-c">${k.ramLivre}<span class="dim">/${k.ramMax}</span></b></div>
              <div class="vb-trilho"><span class="rastro"></span><span class="cb-hp-barra vb-fill ram" style="width:${ramP}%"></span></div>
              ${k.ramLivre === 0 && k.ramMax > 0 ? `<span class="vb-aviso">⚠ Sem RAM — descanse para recarregar</span>` : ""}
            </div>
          </div>`; })()}
        ${(() => { const res = k.efeitos?.resumo() || []; const imu = k.efeitos?.imunidades() || []; const rec = k.efeitos?.recursos() || [];
          if (!res.length && !imu.length) return "";
          return `<details class="det grande" style="margin-top:12px"><summary><b>⚙ Bônus aplicados automaticamente</b> <span class="auto-tag">${res.length}</span></summary>
            <p class="regra">O app já soma tudo isto nos seus números. O que não aparece aqui é regra de mesa e continua com você e o Mestre.</p>
            ${res.map((x) => `<p class="regra"><b class="tech-c">${esc(x.nome)}</b> <i class="dim">(${esc(x.origem)})</i> — ${x.efeitos.map(esc).join(" · ")}</p>`).join("")}
            ${imu.length ? `<p class="regra"><b class="chrome">Imunidades:</b> ${imu.map(esc).join(", ")}</p>` : ""}
            ${rec.length ? `<p class="regra"><b class="sombra-c">Recursos:</b> ${rec.map((r) => `${esc(r.n)} (${esc(r.fonte)})`).join(", ")}</p>` : ""}
          </details>`; })()}
        <div class="linha-4" style="margin-top:12px">
          <label>PV atual<input id="pvAtual" type="number" value="${f.pvAtual}"/></label>
          <label>PV máx<input id="pvMax" type="number" value="${f.pvMax}"/></label>
          <label>Defesa (auto)<input value="${k.cd}" disabled/></label>
          <label>RAM<input value="${k.ramLivre}/${k.ramMax}" disabled/></label>
        </div>
        <p class="regra">⏱️ Iniciativa <b class="chrome">${sign(k.iniciativa)}</b> (Des ${sign(k.attr.Des)}${k.iniBonus ? ` +${k.iniBonus} bônus de classe/filosofia` : ""}) · 🏃 Deslocamento <b class="chrome">${k.deslocamento}m</b> (base ${k.deslocBase} + 2m×Des${k.deslocBase === 18 ? ", ×2 Mercusys" : ""})</p>
        ${classe && raca && f.pvMax === 0 ? `<button id="pv-inicial" class="mini eq">🎲 ROLAR PV DO NÍVEL 1 (4d6 tira o menor ${sign(raca.vidaMod)} raça ${sign(k.attr.Con)} Con +${classe.pv} classe)</button>` : ""}
        <p class="regra">Limite Cibernético: ${f.implantes.length}/${k.limite} · Patrimônio ref. NV${f.nivel}: ${RIQUEZA[f.nivel]} CG · Deck: ${f.deck.length}/${k.deckMax}${k.pvTemp ? ` · ✚ ${k.pvTemp} PV Temporário` : ""}${k.escudoMax ? ` · 🛡 Escudo pessoal ${k.escudoLivre}/${k.escudoMax}` : ""}${k.attr && ["For","Des","Con","Int","Sab","Car"].some((a) => k.attr[a] > 6) ? " · ⚠ atributo acima do teto +6" : ""}</p>
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
        ${f.metodoNivel === "xp" ? `<div class="barra xp-barra" style="margin-bottom:10px"><span>Progresso: <b id="xp-num">${f.xp}</b>/${f.xpMeta} XP ${f.xp >= f.xpMeta ? "— PRONTO PARA SUBIR!" : ""}</span><div><i style="width:${Math.min(100, (100 * f.xp / Math.max(1, f.xpMeta)) | 0)}%;background:var(--tech)"></i></div></div>` : ""}
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
            <p class="regra">Você só carrega o que comprou no Mercado ou recebeu do Mestre. A lista completa fica na seção <b>Inventário</b>, abaixo.</p>
            <div id="inv">${f.inventario.length ? `<p class="regra">${f.inventario.length} item(ns) · ${f.inventario.filter((it) => it.equip).length} equipado(s)</p>` : `<p class="regra"><i>Mochila vazia.</i></p>`}</div></div>
        </div>
      </section>

      <section class="sec"><header><span class="tag">🎒</span><h2>Inventário</h2>
        <span class="extra">${f.inventario.length} item(ns)</span></header>
        ${(() => {
          if (!f.inventario.length) return `<div class="vazio-msg"><span class="icone">🎒</span>
            <p>A mochila está vazia. Compre equipamento no Mercado abaixo — ou espere o Mestre distribuir saque.</p></div>`;
          const grupos = [
            ["arma", "⚔ Armas", (it) => ARMAS.find((x) => x.n === it.nome)],
            ["armadura", "🛡 Armaduras", (it) => ARMADURAS.find((x) => x.n === it.nome)],
            ["item", "🎒 Itens", () => null],
          ];
          return grupos.map(([tipo, titulo]) => {
            const itens = f.inventario.map((it, ix) => ({ it, ix }))
              .filter(({ it }) => (tipo === "item" ? (it.tipo === "item" || ehConsumivel(it.nome)) : (it.tipo === tipo && !ehConsumivel(it.nome))));
            if (!itens.length) return "";
            return `<h4>${titulo} <span class="dim">(${itens.length})</span></h4>
              ${itens.map(({ it, ix }) => {
                const cat = todasArmas().find((x) => x.n === it.nome) || todasArmaduras().find((x) => x.n === it.nome);
                const cs = ehConsumivel(it.nome);
                const pr = (cat && cat.dano) ? propsArma(cat) : null;
                return `<details class="det inv-item ${it.equip ? "equipado" : ""}">
                  <summary>${img(it.nome)}
                    <b>${cs ? `${cs.ic} ` : ""}${esc(it.nome)}</b>
                    ${(it.qtd || 1) > 1 ? `<span class="chrome">×${it.qtd}</span>` : ""}
                    ${cat && cat.dano ? `<span class="inv-dano">${danoArma(cat, f.nivel)}</span>` : ""}
                    ${cat && cat.cd != null ? `<span class="inv-dano">CD +${cat.cd}</span>` : ""}
                    ${it.equip ? `<span class="best-tag" style="color:var(--tech);border-color:var(--tech)">EQUIPADO</span>` : ""}
                  </summary>
                  ${imgFig(it.nome)}
                  ${cat && cat.dano ? `<p class="regra"><b class="chrome">Dano:</b> ${danoArma(cat, f.nivel)} ·
                    <b>Rolagem:</b> 1d20 + ${cat.attr} + ${esc(cat.per)}</p>` : ""}
                  ${cat && cat.cd != null ? `<p class="regra"><b class="chrome">Defesa:</b> +${cat.cd} de CD (${esc(cat.t)})${cat.e ? ` · ${esc(cat.e)}` : ""}</p>` : ""}
                  ${cat && cat.escala ? `<div class="escala-box"><b class="tech-c">↗ Dano por nível</b><div class="escala-linha">${escalaTabela(cat, f.nivel)}</div></div>` : ""}
                  ${cat && SLOTS_POR_ARMA(cat).length ? (() => { const nm = Object.keys(it.mods || {}).length;
                    return `<button class="mini bancada-btn" data-bancada="${ix}">🔧 Bancada${nm ? ` <b>${nm}/${SLOTS_POR_ARMA(cat).length}</b>` : ""}</button>`; })() : ""}
                  ${cat && (cat.kw || Object.keys(it.mods || {}).length) ? etiquetasKw(armaMontada(cat, it), { detalhado: true }) : ""}
                  ${pr && (pr.area || pr.alcance) ? `<p class="regra">${pr.area ? `◎ Área: ${esc(pr.areaTxt)}` : ""}${pr.area && pr.alcance ? " · " : ""}${pr.alcance ? `⟿ Alcance: ${esc(pr.alcanceTxt)}` : ""}</p>` : ""}
                  ${cs ? `<p class="regra"><b class="tech-c">${esc(cs.acao)}:</b> ${esc(cs.d)}</p>` : ""}
                  ${cat && cat.desc ? `<p>${esc(cat.desc)}</p>` : ""}
                  ${cat && cat.preco ? `<p class="regra dim">Valor de tabela: ${cat.preco} CG</p>` : ""}
                  <div class="filtros">
                    ${(!cs && (it.tipo === "arma" || it.tipo === "armadura")) ? `<button class="mini eq ${it.equip ? "on" : ""}" data-eq="${ix}">${it.equip ? "✓ Equipado — desequipar" : "Equipar"}</button>` : ""}
                    <button class="mini rm" data-rm="${ix}">🗑 Descartar</button>
                  </div></details>`; }).join("")}`;
          }).join("");
        })()}
      </section>

      ${(f.implantes || []).includes("Cortex Central de Nano-Enxame") ? (() => {
        const formas = ARMAS.filter((a2) => a2.nano);
        const tatuadas = (f.inventario || []).filter((it) => formas.some((x) => x.n === it.nome));
        // Limite de formas sem gastar slot extra vem do tamanho da raça (RACAS[i].tamanho).
        // Além dele, cada tatuagem nova também ocupa 1 slot do Limite Cibernético.
        const limiteGratis = LIMITE_TATUAGENS[raca?.tamanho] || LIMITE_TATUAGENS["média"];
        const precisaSlot = tatuadas.length >= limiteGratis;
        const slotLivre = (f.implantes || []).length < k.limite;
        return `<section class="sec"><header><span class="tag">🖋</span><h2>Cortex Central de Nano-Enxame</h2>
          <span class="extra">${tatuadas.length} forma(s) tatuada(s) · limite sem slot: ${limiteGratis} (${esc(raca?.tamanho || "média")})</span></header>
          <p class="regra">Cada forma tatuada custa <b class="chrome">250 CG</b> e um Descanso Longo numa clínica.
            Até <b>${limiteGratis}</b> formas (pelo porte da raça) não ocupam slot de implante — a partir da
            ${limiteGratis + 1}ª, cada forma extra também consome <b>1 slot</b> do Limite Cibernético.
            As formas não podem ser arremessadas, largadas nem desarmadas — o enxame perde a conexão longe do
            corpo e desliga — e o dano sobe nos níveis 5 e 9.</p>
          <div class="nano-grade">${formas.map((w) => {
            const tem = tatuadas.some((it) => it.nome === w.n);
            const custo = 250;
            const podePagar = tem || (f.creditos ?? 0) >= custo;
            const bloqueado = !tem && (!podePagar || (precisaSlot && !slotLivre));
            return `<button class="nano-op ${tem ? "on" : ""}" data-nano="${esc(w.n)}" ${bloqueado ? "disabled" : ""}
              title="${esc(w.desc || "")}${!tem && precisaSlot ? " (além do limite gratuito — consome 1 slot de implante)" : ""}">
              <b>${esc(w.n.replace("Nano-Tatuagem: ", ""))}</b>
              <span class="nano-dano">${danoArma(w, f.nivel)}</span>
              <span class="regra">${esc(w.kw)} · ${w.attr}</span>
              <span class="nano-acao">${tem ? "✓ tatuada — remover" : `tatuar · ${custo} CG${precisaSlot ? " + 1 slot" : ""}`}</span>
            </button>`; }).join("")}</div>
          ${tatuadas.length ? `<p class="regra">Materializar ou dissolver uma forma é <b>Ação Livre</b>, uma por vez.
            Equipe a forma que quer usar na seção Inventário para ela aparecer na mesa.</p>` : ""}
        </section>`; })() : ""}

      <section class="sec"><header><span class="tag">🎒</span><h2>Suprimentos</h2>
        <span class="extra">o que você leva para o combate</span></header>
        ${(() => {
          const res = normalizaPentes(f);
          const tipo = f.tipoPente || PENTE_PADRAO, tp = TIPOS_PENTE[tipo] || TIPOS_PENTE.padrao;
          const noCano = f.tirosPente ?? TIROS_POR_PENTE;
          const total = Object.values(res).reduce((a3, b3) => a3 + b3, 0);
          const cano = Array.from({ length: TIROS_POR_PENTE }, (_, i2) => `<i class="pip ${i2 < noCano ? "cheio" : ""}" style="${i2 < noCano ? `background:${tp.cor};border-color:${tp.cor}` : ""}"></i>`).join("");
          return `<h4>Munição</h4>
            <div class="sup-mun">
              <div class="sup-carregado" style="border-color:${tp.cor}">
                <span class="dim">no cano</span>
                <b style="color:${tp.cor}">${tp.ic} ${esc(tp.n)}</b>
                <div class="pips">${cano}</div>
                <span class="regra">${noCano}/${TIROS_POR_PENTE} tiros</span>
              </div>
              <div class="sup-reserva">
                <span class="dim">reserva (${total}/${k.pentesReserva})</span>
                ${Object.entries(TIPOS_PENTE).map(([k2, t2]) => `<div class="sup-linha ${res[k2] ? "" : "zerado"} ${k2 === tipo ? "no-cano" : ""}">
                  <span style="color:${res[k2] ? t2.cor : "var(--dim)"}">${t2.ic} ${esc(t2.n)}${k2 === tipo ? " ▸ no cano" : ""}</span>
                  <b>×${res[k2] || 0}</b>
                  <span class="regra">${esc(t2.d)}</span></div>`).join("")}
              </div>
            </div>
            <p class="regra">Um pente leva ${TIROS_POR_PENTE} tiros. Esgotado, é preciso trocar (Ação de Movimento). Descansos repõem tudo; o Mestre também pode conceder pentes de saque.</p>`;
        })()}
        <h4 style="margin-top:14px">Itens utilizáveis</h4>
        ${(() => { const cons = (f.inventario || []).filter((it) => ehConsumivel(it.nome) && (it.qtd || 1) > 0);
          return cons.length ? `<div class="sup-itens">${cons.map((it) => { const c = ehConsumivel(it.nome);
            return `<div class="sup-item"><span class="sup-ic">${c.ic}</span>
              <span class="sup-nome"><b>${esc(it.nome)}</b> <b class="chrome">×${it.qtd || 1}</b>
                <span class="regra">${esc(c.acao)} · ${esc(c.d)}</span></span></div>`; }).join("")}</div>
            <p class="regra">Na mesa, cada um destes vira um botão próprio na barra de ações.</p>`
          : `<p class="regra"><i>Nenhum item utilizável. Compre kits, baterias e granadas no Mercado abaixo.</i></p>`; })()}
      </section>

      <section class="sec"><header><span class="tag">🛒</span><h2>Mercado</h2><span class="extra" id="loja-cg">${f.creditos ?? 0} CG</span></header>
        <p class="regra">Compre equipamento gastando Créditos Galácticos. A tabela de riqueza sugere ~${RIQUEZA[Math.min(10, f.nivel || 1)] || 300} CG para o nível ${f.nivel}.</p>
        <div class="filtros"><select id="loja-cat"><option value="arma">⚔ Armas</option><option value="consumivel">🎒 Consumíveis</option><option value="municao">🔫 Munição</option><option value="armadura">🛡 Armaduras</option><option value="implante">🔧 Implantes</option></select></div>
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
    if (xpAntes != null && xpAntes !== f.xp) {
      const el = $("#xp-num"), barra = document.querySelector(".xp-barra i");
      if (barra) { barra.style.transition = "none"; barra.style.width = Math.min(100, 100 * xpAntes / Math.max(1, f.xpMeta)) + "%";
        void barra.offsetWidth; barra.style.transition = "";
        requestAnimationFrame(() => { barra.style.width = Math.min(100, 100 * f.xp / Math.max(1, f.xpMeta)) + "%"; }); }
      contarAte(el, xpAntes, f.xp, 900);
    }
    $("#salvar").onclick = async () => { clearTimeout(autoTimer); marcaEstado("salvando…", "salvando"); await salvar(); };
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
          { k: "l", label: "Link", tipo: "texto", valor: link }], okLabel: "Fechar", semCancelar: true });
        $("#st").textContent = "Link público ativo ✓";
      } else $("#st").textContent = "Link público desativado";
    };
    $("#imprimir").onclick = () => { const nome = $("#nome")?.value || p.nome; imprimirFichaHTML(gerarFichaHTML(nome, f, calc(f))); };
    $("#baixar").onclick = () => { const nome = $("#nome")?.value || p.nome; baixarFichaHTML(gerarFichaHTML(nome, f, calc(f)), nome); };
    $("#desc-curto")?.addEventListener("click", async () => { const r = aplicarDescanso(f, "curto"); registrar(`☾ Descanso Curto: ${r.notas.join(" · ")}.`); await salvar(); render(); $("#st").textContent = "Descanso curto ✓ (salvo)"; });
    $("#desc-longo")?.addEventListener("click", async () => { const r = aplicarDescanso(f, "longo"); registrar(`🌙 Descanso Longo: ${r.notas.join(" · ")}.`); await salvar(); render(); $("#st").textContent = "Descanso longo ✓ (salvo)"; });
    app.querySelectorAll(".ck-uso").forEach((c) => c.onchange = () => { f.usos = f.usos || {}; if (c.checked) f.usos[c.dataset.uso] = true; else delete f.usos[c.dataset.uso]; (autoSalvar(), render()); });
    $("#nome").oninput = (e) => { p.nome = e.target.value; f.nomeVisivel = e.target.value; };
    $("#foto-in")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      comprimirFoto(file, (data) => { f.foto = data; registrar("◈ Retrato do personagem atualizado."); (autoSalvar(), render()); });
      e.target.value = "";
    });
    $("#foto-rm")?.addEventListener("click", () => { f.foto = null; (autoSalvar(), render()); });
    ["raca", "classe", "filosofia"].forEach((c) => $("#" + c).onchange = (e) => { f[c] = e.target.value; (autoSalvar(), render()); });
    $("#abrir-sistema")?.addEventListener("click", async () => {
      try { const { abrirSeletorPlanetas } = await import("./sistema-solar.js");
        abrirSeletorPlanetas(RACAS, (nome) => { f.raca = nome; (autoSalvar(), render()); $("#st").textContent = `Raça: ${nome} ✓`; });
      } catch (err) { alert("Não consegui abrir o sistema solar: " + err.message); }
    });
    ["creditos", "pvAtual", "pvMax"].forEach((c) => { const el = $("#" + c); if (el) el.oninput = (e) => { f[c] = +e.target.value; autoSalvar(); }; });
    $("#modo-pontos").onclick = () => { f.modoAttr = "pontos"; (autoSalvar(), render()); };
    $("#modo-rolagem").onclick = () => { f.modoAttr = "rolagem"; (autoSalvar(), render()); };
    $("#rolar-pool")?.addEventListener("click", () => {
      const somas = Array.from({ length: 7 }, () => rollNd(2, 8).reduce((a, b) => a + b, 0));
      somas.sort((a, b) => a - b);
      const pior = somas.shift(); // descarta a pior (menor soma)
      f.rolagemPool = somas; // guarda as SOMAS BRUTAS; a conversão acontece ao distribuir
      f.rolagem = { For: null, Des: null, Con: null, Int: null, Sab: null, Car: null };
      registrar(`🎲 Origem rolada — 2d8 sete vezes, descartada a pior soma (${pior}). Somas guardadas: [${somas.join(", ")}]. Distribua cada soma num atributo; a conversão em modificador aparece ao lado. Raça e pontos somam por cima.`);
      (autoSalvar(), render());
    });
    app.querySelectorAll(".sel-pool").forEach((s) => s.onchange = () => {
      const a = s.dataset.a; f.rolagem[a] = s.value === "" ? null : +s.value;
      if (s.value !== "") registrar(`Δ ${a} recebeu ${sign(+s.value)} da rolagem.`);
      (autoSalvar(), render());
    });
    app.querySelectorAll(".pt-attr").forEach((i) => i.onchange = () => {
      const a = i.dataset.a;
      const outros = Object.entries(f.pontosAttr || {}).reduce((s, [key, v]) => s + (key === a ? 0 : (v || 0)), 0);
      const maxEste = Math.max(0, k.pontosDireito - outros); // não pode exceder o orçamento total
      let v = Math.max(0, Math.floor(+i.value || 0));
      if (v > maxEste) { v = maxEste; $("#st").textContent = `Sem pontos de atributo livres (${k.pontosDireito} no total)`; }
      f.pontosAttr[a] = v; (autoSalvar(), render());
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
      f.periciasExtra[pn] = v; (autoSalvar(), render());
    });
    $("#pv-inicial")?.addEventListener("click", () => {
      const k2 = calc(f); const r = RACAS.find((x) => x.nome === f.raca); const c = CLASSES[f.classe];
      const { ds, menor, soma3, subtotal } = rolaVidaInicial(r);
      const base = Math.max(1, subtotal + k2.attr.Con + (c?.pv || 0));
      f.pvMax = base; f.pvAtual = base;
      registrar(`❤ PV do nível 1: 4d6 [${ds.join(", ")}] descarta ${menor}, soma ${soma3} ${sign(r?.vidaMod || 0)} raça ${sign(k2.attr.Con)} Con +${c?.pv || 0} classe = ${base} PV.`);
      (autoSalvar(), render());
    });
    $("#vida-fixa")?.addEventListener("change", (e) => { f.usarVidaFixa = e.target.checked; (autoSalvar(), render()); });
    $("#metodo")?.addEventListener("change", (e) => { f.metodoNivel = e.target.value; (autoSalvar(), render()); });
    $("#xp")?.addEventListener("input", (e) => { f.xp = +e.target.value; });
    $("#xpMeta")?.addEventListener("input", (e) => { f.xpMeta = +e.target.value; });
    $("#marcos")?.addEventListener("input", (e) => { f.marcos = +e.target.value; });
    $("#add-marco")?.addEventListener("click", () => { f.marcos = (f.marcos || 0) + 1; registrar(`⚑ Marco da história alcançado (total: ${f.marcos}).`); (autoSalvar(), render()); });
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
      // Armas com progressão que mudaram de dado neste nível merecem aviso:
      // é um ganho real que passaria despercebido no meio dos números.
      const subiram = (f.inventario || []).map((it) => todasArmas().find((w) => w.n === it.nome))
        .filter((w) => w && w.escala && danoArma(w, novoNv) !== danoArma(w, novoNv - 1))
        .map((w) => `${w.n.replace("Nano-Tatuagem: ", "")}: ${danoArma(w, novoNv - 1)} → ${danoArma(w, novoNv)}`);
      if (subiram.length) registrar(`↗ Armas evoluíram — ${subiram.join(" · ")}.`);
      cenaNivel(novoNv, ganhoPV, detalhe, [...extras, ...subiram.map((x) => `↗ ${x}`)]);
    });
    app.querySelectorAll(".ck-impl").forEach((c) => c.onchange = () => {
      f.implantes = c.checked ? [...f.implantes, c.dataset.n] : f.implantes.filter((x) => x !== c.dataset.n); (autoSalvar(), render()); });
    app.querySelectorAll(".ck-scr").forEach((c) => c.onchange = () => {
      f.deck = c.checked ? [...f.deck, c.dataset.n] : f.deck.filter((x) => x !== c.dataset.n); (autoSalvar(), render()); });
    // ---- Mercado (loja com créditos) ----
    const renderLoja = (cat) => {
      const alvo = $("#loja-lista"); if (!alvo) return;
      const cg = f.creditos ?? 0;
      let itens;
      if (cat === "consumivel") itens = CONSUMIVEIS.map((c) => ({ nome: c.n, preco: c.p, sub: `${c.ic} ${c.acao} · ${c.d}` }));
      else if (cat === "municao") itens = Object.entries(TIPOS_PENTE).map(([k2, t2]) => ({ nome: `Pente ${t2.n}`, preco: t2.p, sub: `${t2.ic} ${t2.d}`, pente: k2 }));
      else if (cat === "arma") itens = todasArmas().filter((a) => a.preco).map((a) => ({ nome: a.n, preco: a.preco, sub: `${danoArma(a, f.nivel)}${a.escala ? " ↗" : ""} · ${a.kw || a.tipo}` }));
      else if (cat === "armadura") itens = ARMADURAS.filter((a) => a.preco).map((a) => ({ nome: a.n, preco: a.preco, sub: `${a.t} · +${a.cd} CD${a.e ? " · " + a.e : ""}` }));
      else itens = Object.values(IMPLANTES).filter((i) => i.p).map((i) => ({ nome: i.n, preco: i.p, sub: `${i.g} · ${i.e}`, jaTem: f.implantes.includes(i.n) }));
      itens.sort((a, b) => a.preco - b.preco);
      alvo.innerHTML = itens.map((it, ix) => `<div class="loja-item ${cg < it.preco ? "caro" : ""}">
        <span class="loja-nome"><b>${esc(it.nome)}</b><small>${esc(it.sub)}</small></span>
        <span class="loja-preco">${it.preco} CG</span>
        <button class="mini loja-comprar" data-ix="${ix}" ${cg < it.preco || it.jaTem ? "disabled" : ""}>${it.jaTem ? "✓ já tem" : "comprar"}</button></div>`).join("");
      alvo.querySelectorAll(".loja-comprar").forEach((b) => b.onclick = async () => {
        const it = itens[+b.dataset.ix]; if (!it) return;
        if ((f.creditos ?? 0) < it.preco) return;
        // Consumíveis e pentes empilham: pergunta a quantidade antes de cobrar.
        const empilha = ehConsumivel(it.nome) || it.pente;
        let qtd = 1;
        if (empilha) {
          const maxPode = Math.max(1, Math.floor((f.creditos ?? 0) / it.preco));
          const r = await modalForm({ titulo: `🛒 ${it.nome}`,
            descricao: `${it.preco} CG cada. Você tem ${f.creditos ?? 0} CG — dá para ${maxPode}.`,
            campos: [{ k: "q", label: "Quantidade", tipo: "numero", valor: 1, min: 1, max: maxPode }], okLabel: "Comprar" });
          if (!r) return;
          qtd = Math.max(1, Math.min(maxPode, +r.q || 1));
        }
        const total = it.preco * qtd;
        if ((f.creditos ?? 0) < total) return alert(`Faltam ${total - (f.creditos ?? 0)} CG.`);
        const cgAntes = f.creditos ?? 0;
        f.creditos = cgAntes - total;
        contarAte($("#loja-cg"), cgAntes, f.creditos, 600, " CG");
        if (it.pente) { const res2 = normalizaPentes(f); const teto = pentesReservaDe(f);
          const tot = Object.values(res2).reduce((x, y) => x + y, 0);
          const cabe = Math.min(qtd, Math.max(0, teto - tot));
          if (!cabe) { f.creditos = cgAntes; return alert(`A reserva já está cheia (${teto} pentes).`); }
          res2[it.pente] = (res2[it.pente] || 0) + cabe; f.pentes = res2;
          if (cabe < qtd) f.creditos = cgAntes - it.preco * cabe;   // devolve o que não coube
          qtd = cabe;
        } else if (cat === "implante") { if (!f.implantes.includes(it.nome)) f.implantes.push(it.nome); }
        else { const ja = f.inventario.find((x) => x.nome === it.nome && ehConsumivel(it.nome));
          if (ja) ja.qtd = (ja.qtd || 1) + qtd; else f.inventario.push({ tipo: cat, nome: it.nome, equip: false, qtd }); }
        registrar(`🛒 Comprou ${qtd > 1 ? `${qtd}× ` : ""}${it.nome} por ${it.preco * qtd} CG (restam ${f.creditos} CG).`);
        autoSalvar();                       // a compra precisa persistir antes de ir para a mesa
        setTimeout(render, 650);
      });
    };
    $("#loja-cat") && ($("#loja-cat").onchange = (e) => renderLoja(e.target.value));
    renderLoja($("#loja-cat")?.value || "arma");
    app.querySelectorAll("[data-nano]").forEach((b) => b.onclick = async () => {
      const nome = b.dataset.nano;
      const ix = (f.inventario || []).findIndex((it) => it.nome === nome);
      if (ix >= 0) {                                    // remover a tatuagem
        const usavaSlot = (f.implantes || []).includes(nome);
        if (!(await confirmModal(`Remover a tatuagem "${nome.replace("Nano-Tatuagem: ", "")}"?\n\nO enxame é dissolvido. Tatuar de novo custará 250 CG${usavaSlot ? " + 1 slot de implante" : ""}.`, { okLabel: "Remover", perigo: true }))) return;
        f.inventario.splice(ix, 1);
        if (usavaSlot) f.implantes = f.implantes.filter((x) => x !== nome);   // libera o slot cibernético
        registrar(`🖋 Tatuagem dissolvida: ${nome.replace("Nano-Tatuagem: ", "")}${usavaSlot ? " (libera 1 slot de implante)" : ""}.`);
      } else {
        const formas = ARMAS.filter((a2) => a2.nano);
        const tatuadas = (f.inventario || []).filter((it) => formas.some((x) => x.n === it.nome));
        const raca2 = RACAS.find((r) => r.nome === f.raca);
        const limiteGratis = LIMITE_TATUAGENS[raca2?.tamanho] || LIMITE_TATUAGENS["média"];
        const precisaSlot = tatuadas.length >= limiteGratis;
        const custo = 250;
        if ((f.creditos ?? 0) < custo) return alert(`Faltam ${custo - (f.creditos ?? 0)} CG para tatuar mais uma forma.`);
        if (precisaSlot && (f.implantes || []).length >= k.limite)
          return alert(`Sem slot de implante livre para tatuar além do limite gratuito (${limiteGratis} formas para porte ${raca2?.tamanho || "média"}). Libere um slot ou remova outra tatuagem extra.`);
        f.creditos = (f.creditos ?? 0) - custo;
        f.inventario.push({ tipo: "arma", nome, equip: false, qtd: 1 });
        if (precisaSlot) f.implantes = [...f.implantes, nome];   // além do limite gratuito: ocupa 1 slot cibernético
        registrar(`🖋 Nova forma tatuada: ${nome.replace("Nano-Tatuagem: ", "")} (−${custo} CG${precisaSlot ? " + 1 slot de implante" : ""}).`);
      }
      autoSalvar(); render();
    });
    app.querySelectorAll("[data-bancada]").forEach((b) => b.onclick = () => {
      const it = f.inventario[+b.dataset.bancada];
      const catBase = todasArmas().find((x) => x.n === it.nome); if (!catBase) return;
      abrirBancada({ f, item: it, catBase, emCombate: false,
        onSalvar: async (msg) => { registrar(msg); autoSalvar(); render(); } });
    });
    app.querySelectorAll("[data-eq]").forEach((b) => b.onclick = () => { const it = f.inventario[+b.dataset.eq];
      if (it.tipo === "armadura") f.inventario.forEach((x) => { if (x.tipo === "armadura") x.equip = false; });
      it.equip = !it.equip; (autoSalvar(), render()); });
    app.querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => { f.inventario.splice(+b.dataset.rm, 1); (autoSalvar(), render()); });
    app.querySelectorAll("[data-tema]").forEach((b) => b.onclick = () => { f.tema = { ...TEMAS[b.dataset.tema] }; aplicarTema(f); });
  };
  (autoSalvar(), render());
}

// ---------------- CAMPANHAS ----------------
async function telaCampanhas() {
  const { data: minhas } = await sb.from("campanhas").select("id,nome,codigo,mestre_id");
  shell("campanhas", `
    <header class="masthead"><h1>CAMPANHAS<span> ATIVAS</span></h1></header>
    <section class="sec"><header><span class="tag">☄</span><h2>Minhas mesas</h2></header>
      ${(minhas || []).map((c) => `<div class="inv"><span><b>${esc(c.nome)}</b> · código <b class="chrome">${c.codigo}</b>${c.mestre_id === usuario.id ? " · você é o Mestre" : ""}</span>
        <span style="display:flex;gap:6px"><a class="mini" href="#/mesa/${c.id}">ABRIR MESA</a>${c.mestre_id === usuario.id ? `<button class="mini rm" data-del-camp="${c.id}" data-nome="${esc(c.nome)}">EXCLUIR</button>` : ""}</span></div>`).join("") || `<div class="vazio-msg"><span class="icone">☄</span><p>Nenhuma mesa ainda. O sistema é grande — crie uma campanha ou entre na de alguém com um código.</p></div>`}
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
  const [{ data: camp }, { data: membros }, { data: pers }, { data: msgsDesc }] = await Promise.all([
    sb.from("campanhas").select("*").eq("id", id).single(),
    sb.from("campanha_membros").select("perfil_id,posto,perfis(apelido)").eq("campanha_id", id),
    sb.from("personagens").select("id,nome,dono_id,dados").eq("campanha_id", id),
    // Pega as 120 MAIS RECENTES (desc) e devolve pro chat em ordem cronológica (asc).
    // Antes buscava com .order(asc).limit(120): pegava as 120 mais ANTIGAS, e com
    // campanhas que já passaram desse teto, tudo recente sumia da tela ao recarregar.
    sb.from("mensagens").select("*,perfis:autor_id(apelido,avatar_url)").eq("campanha_id", id).order("criado_em", { ascending: false }).limit(120),
  ]);
  const msgs = msgsDesc ? [...msgsDesc].reverse() : msgsDesc;
  if (!camp) return (location.hash = "#/campanhas");
  const { data: meus } = await sb.from("personagens").select("id,nome").eq("dono_id", usuario.id);
  // Com mais de um personagem seu na mesma mesa, vale a escolha guardada neste
  // dispositivo; sem escolha, o primeiro. Antes pegava sempre o primeiro e o
  // seletor não trocava nada.
  const chavePers = "ps-pers-" + id;
  const meusNaMesa = () => (pers || []).filter((x) => x.dono_id === usuario.id);
  const meuPersInicial = (() => {
    const meus = meusNaMesa();
    const salvo = localStorage.getItem(chavePers);
    return meus.find((x) => x.id === salvo) || meus[0] || null;
  })();
  const ehMestreReal = camp.mestre_id === usuario.id;
  const chaveModoJog = "ps-modojog-" + id;
  const modoJogadorInicial = localStorage.getItem(chaveModoJog) === "1";
  // `ui`: bag mutável e persistente (SEMPRE a mesma referência, nunca reatribuída
  // inteira — só seus campos mudam) para o estado que precisa ser lido/escrito por
  // qualquer parte da mesa, inclusive futuramente por arquivos separados (mesa-*.js).
  // Antes de existir, cada um desses campos era um `let` solto na closure de
  // telaMesa — funcionava só porque tudo vivia na mesma função; virar campo de um
  // objeto é o que permite um handler em outro módulo mudar `ui.campoZoom` e o
  // próximo render() (em qualquer arquivo) enxergar a mudança. Ver CLAUDE.md.
  const ui = {
    modoJogador: modoJogadorInicial,
    // ui.souMestre é o "Mestre efetivo": some quando o Mestre liga o Modo Jogador,
    // para testar (ou jogar) como um tripulante comum. Reatribuído no toggle.
    souMestre: ehMestreReal && !modoJogadorInicial,
    meuPers: meuPersInicial,
    tokenSel: null,      // token selecionado no campo tático (mostra alcance e distâncias)
    campoZoom: false,    // false = campo inteiro (40 m) · true = janela de 12 m com grade de 1 m
    pintarMsg: null,     // aponta pro addMsg do render atual (renderização otimista)
    mapaCtrl: null,      // controlador do mapa aberto (para sync via realtime)
    abaMesa: sessionStorage.getItem("ps-aba-mesa") || "ficha",  // aba ativa da lateral
    timerInt: null,      // cronômetro de turno (local)
    vantagem: 0,         // 0 normal · 1 vantagem · -1 desvantagem
    privada: false,      // rolagem/mensagem privada (só Mestre + autor veem)
    asCegas: false,      // rolagem às cegas: resultado só para o Mestre, fora do chat
    recapFeita: false,   // a recapitulação aparece uma vez por entrada na mesa
    // O realtime devolve as nossas próprias gravações. Se chegarem enquanto ainda
    // estamos no meio de uma operação, sobrescrevem o estado local e travam o turno.
    gravandoAte: 0,
  };
  const historico = msgs || [];  // lista mutável de mensagens (sobrevive a re-renders)
  const pilhaUndo = [];          // snapshots para desfazer a última ação do Mestre (máx 10)
  // (macrosDe/salvarMacros agora vivem em mesa-ficha.js — único consumidor.)
  const marcarGravacao = () => { ui.gravandoAte = Date.now() + 1500; };
  const ecoProprio = () => Date.now() < ui.gravandoAte;
  // Toda gravação em `campanhas` passa por aqui, para o eco do realtime ser ignorado.
  const salvarCampanha = (campos) => { marcarGravacao(); return sb.from("campanhas").update(campos); };
  // Wrapper com checagem de erro OBRIGATÓRIA — sem isto, uma falha de rede ou de RLS
  // deixava a mudança só na tela: o app já tinha renderizado como se tivesse dado
  // certo, e ninguém via aviso nenhum até a sincronização seguinte apagar a ação
  // silenciosamente. Devolve `true`/`false` pra quem chamar poder decidir o que fazer
  // (ex.: devolver um recurso gasto se o salvamento falhou).
  const salvarCamp = async (campos, rotulo = "salvar") => {
    const { error } = await salvarCampanha(campos).eq("id", id);
    if (error) alert(`Não consegui ${rotulo}: ${error.message}`);
    return !error;
  };
  const salvarMapa = async (mapa) => { camp.mapa = mapa; await salvarCamp({ mapa }, "salvar o mapa"); };
  if (!camp.combate || typeof camp.combate !== "object" || !("ordem" in camp.combate)) camp.combate = combateVazio();
  // Migração: combates antigos não têm posição no campo. Persiste no próximo salvamento.
  // Naves inimigas também ganham posição agora (entram no mesmo campo tático, do
  // lado "inimigo") — antes ficavam de fora e não davam pra selecionar/medir distância.
  for (const c of camp.combate.ordem || []) if (!c.pos) c.pos = posInicial(camp.combate.ordem, ehNave(c) ? "inimigo" : c.tipo);
  // Migração: naves registradas antes do esquema de armas nomeadas (com CD/munição
  // própria) não têm `nave.armas` — `armas` só é preenchido em `#def-nave`, na
  // criação. Sem isto, o posto de Artilharia nunca pergunta qual arma nem mostra
  // munição (cai sempre no fallback de 1 opção só, "Canhões"), e com 1 inimigo em
  // campo também não pergunta o alvo — parece que "a nave atira sozinha". Persiste
  // no próximo salvamento que tocar `nave` (dano, cura, disparo…).
  if (camp.nave && !camp.nave.armas?.length) {
    const baseNave = NAVES.find((n) => n.n === camp.nave.modelo);
    if (baseNave?.armas?.length) camp.nave.armas = baseNave.armas;
  }
  const snapshot = (rotulo) => { pilhaUndo.push({ rotulo, combate: JSON.parse(JSON.stringify(camp.combate || {})), nave: JSON.parse(JSON.stringify(camp.nave || null)), combate_nave: JSON.parse(JSON.stringify(camp.combate_nave || {})) }); if (pilhaUndo.length > 10) pilhaUndo.shift(); };
  const salvarCombate = async () => { await salvarCamp({ combate: camp.combate }, "salvar o combate"); };
  const salvarCbn = async () => { await salvarCamp({ combate_nave: camp.combate_nave }, "salvar o combate espacial"); };
  // A Defesa (`c.cd`) de um jogador no rastreador é uma FOTO tirada ao entrar em
  // combate (#cb-iniciar) — não recalcula sozinha. Sem isto, ativar um modo que
  // mexe na CD (Criogénese: Escudo de gelo, Placas, Defensiva/Aparar) em pleno
  // combate não muda o que os ataques realmente checam, e o alvo segue tomando
  // dano como se o escudo não existisse. Chamar sempre que `dadosFicha.modos`
  // mudar para alguém que já está no rastreador.
  const sincronizarCdCombate = (personagemId, dadosFicha) => {
    const linha = camp.combate?.ordem?.find((c2) => c2.personagem_id === personagemId);
    if (!linha) return false;
    const novoCd = calc({ ...novaFichaDados(), ...dadosFicha }).cd;
    if (linha.cd === novoCd) return false;
    linha.cd = novoCd;
    return true;
  };
  // Espelha na ficha do jogador a variação de PV sofrida no rastreador.
  // Sem isto, o rastreador e a ficha viviam com valores diferentes — e a ficha,
  // sempre cheia, fazia qualquer cura parecer "restaurou tudo".
  const sincronizarFicha = async (c, delta) => {
    if (!c || !c.personagem_id || !delta) return;
    const alvo = (pers || []).find((x) => x.id === c.personagem_id);
    if (!alvo) return;
    const { data: fresco } = await sb.from("personagens").select("dados").eq("id", alvo.id).single();
    const dd = { ...novaFichaDados(), ...(fresco?.dados || alvo.dados) };
    const antes = dd.pvAtual || 0;
    dd.pvAtual = Math.max(0, Math.min(calc(dd).pvMax, antes + delta));
    if (dd.pvAtual === antes) return;
    dd.log = [{ q: new Date().toISOString(), t: `${delta < 0 ? "💥" : "✚"} ${Math.abs(delta)} PV no combate (${antes} → ${dd.pvAtual})` }, ...(dd.log || [])].slice(0, 60);
    await salvarFicha(alvo.id, dd);
    alvo.dados = dd;
    if (ui.meuPers && ui.meuPers.id === alvo.id) ui.meuPers.dados = dd;
  };
  // Ponto único por onde passa TODO dano rolado contra um combatente do
  // rastreador. Aplica, nesta ordem: couraça por limiar de criatura (Guardião
  // de Anéis), redução de dano do alvo (Endurecer, filosofias), e então o corpo.
  // O Mestre ainda ajusta livre pelos botões ±5 / definir HP — esses não passam aqui.
  const aplicarDanoAlvo = async (alvo, valor, tipoDano = "físico") => {
    if (!alvo || !(valor > 0)) return { aplicado: 0, msg: "" };
    // Imunidade declarada a este tipo de dano (Espectro do Vácuo vs físico).
    const imu = imuneAoDano(habsDoCombatente(alvo), tipoDano);
    if (imu) return { aplicado: 0, imune: true, msg: `imune a dano ${tipoDano} (${imu.n}) — sem efeito` };
    if (ehNave(alvo)) {
      const r = danoNave(alvo, valor);
      if (alvo.nave_party && camp.nave) { camp.nave.casco = alvo.casco; camp.nave.escudos = alvo.escudos;
        await salvarCamp({ nave: camp.nave }, "salvar a nave"); }
      return { aplicado: r.casco + r.escudos, nave: r,
        msg: `escudos −${r.escudos}, casco −${r.casco} (${alvo.casco}/${alvo.casco_max})` };
    }
    const lim = habsDoCombatente(alvo).find((h) => h.efeito?.tipo === "imunidade" && h.efeito.limiar);
    if (lim && valor < lim.efeito.limiar) {
      return { aplicado: 0, absorvido: true, msg: `couraça: golpe abaixo de ${lim.efeito.limiar} não arranha` };
    }
    // ---- Resistência adaptativa (Enxame Adaptativo) -------------------------
    // 1) Se este bicho já apanhou deste tipo de dano neste combate, ele endureceu:
    //    abate a resistência guardada em `alvo.resist[tipo]`.
    // 2) Depois, se ele TEM a habilidade de adaptar, aprende com este golpe — e o
    //    aprendizado vale para todas as linhas do mesmo bicho no rastreador
    //    ("todo o Enxame ganha resistência"), não só a linha atingida.
    let msgResist = "";
    if (tipoDano !== "verdadeiro") {
      const jaResiste = (alvo.resist || {})[tipoDano] || 0;
      if (jaResiste) {
        const antes = valor;
        valor = Math.max(0, valor - jaResiste);
        msgResist = `🧬 resistência a ${tipoDano} −${antes - valor} · `;
        if (valor === 0) return { aplicado: 0, absorvido: true, msg: `${msgResist}o golpe não passa` };
      }
      const adapt = habsDoCombatente(alvo).find((h) => h.efeito?.tipo === "adaptar");
      if (adapt && !jaResiste) {
        const ganho = adapt.efeito.valor || 3;
        const base0 = String(alvo.nome || "").replace(/ #\d+$/, "");
        for (const c2 of camp.combate?.ordem || []) {
          if (String(c2.nome || "").replace(/ #\d+$/, "") !== base0) continue;
          c2.resist = { ...(c2.resist || {}), [tipoDano]: ganho };
        }
        msgResist = `🧬 adapta-se: ${base0} passa a resistir a ${tipoDano} (−${ganho}) · `;
      }
    }
    // ---- Alvo com ficha: redução → escudo pessoal → PV Temporário → corpo ----
    if (alvo.personagem_id) {
      // Lê a ficha fresca do banco: a cópia do render pode não ter os modos ligados (Endurecer).
      const { data: fresco } = await sb.from("personagens").select("dados").eq("id", alvo.personagem_id).single();
      const pjA = (pers || []).find((x) => x.id === alvo.personagem_id);
      const dd = { ...novaFichaDados(), ...(fresco?.dados || pjA?.dados || {}) };
      // Se o alvo está dentro de uma Zona Morta, a cibernética dele não conta na conta
      // do dano — inclusive a redução vinda de implante.
      const kA = calc(dd, { semImplantes: auraNega("implantes", alvo) });
      // Endurecer e afins só abatem dano FÍSICO.
      const reduzido = tipoDano === "físico" ? (kA.efeitos?.aoSofrer?.().reducao || 0) : 0;
      let resta = Math.max(0, valor - reduzido);
      // Escudo: diferente de PV Temporário (abaixo), não deixa passar o excedente.
      // Regra pedida: "o escudo tem 10, você toma 15 — os 5 de excesso não passam".
      // Enquanto o escudo tiver QUALQUER carga, a instância de dano inteira é
      // bloqueada, mesmo que estoure e o zere — só a PRÓXIMA instância, já sem
      // escudo, volta a valer normal.
      const escudoAntes = kA.escudoLivre;
      let absorvidoEscudo = 0;
      if (escudoAntes > 0 && resta > 0) {
        absorvidoEscudo = resta;
        dd.escudoGasto = (dd.escudoGasto || 0) + Math.min(escudoAntes, resta);
        resta = 0;
      }
      // PV Temporário: aqui sim o excedente passa — é só um estoque a mais de PV.
      const noTemp = Math.min(dd.pvTemp || 0, resta);
      if (noTemp) { dd.pvTemp = (dd.pvTemp || 0) - noTemp; resta -= noTemp; }
      const antesPv = dd.pvAtual || 0;
      dd.pvAtual = Math.max(0, antesPv - resta);
      const partes = [];
      if (reduzido) partes.push(`−${reduzido} redução`);
      if (absorvidoEscudo) partes.push(`🛡 escudo bloqueia o golpe inteiro (${absorvidoEscudo})${absorvidoEscudo > escudoAntes ? ` — estourou o escudo (tinha ${escudoAntes})` : ""}`);
      if (noTemp) partes.push(`✚ PV temp absorve ${noTemp}`);
      partes.push(`−${resta} (${dd.pvAtual}/${kA.pvMax || dd.pvMax || alvo.hp_max})`);
      dd.log = [{ q: new Date().toISOString(), t: `💥 ${valor} de dano — ${partes.join(" · ")}` }, ...(dd.log || [])].slice(0, 60);
      await salvarFicha(alvo.personagem_id, dd);
      if (pjA) pjA.dados = dd;
      if (ui.meuPers && ui.meuPers.id === alvo.personagem_id) ui.meuPers.dados = dd;
      alvo.hp = dd.pvAtual;   // o rastreador acompanha a ficha
      return { aplicado: resta, reduzido, escudo: absorvidoEscudo, temp: noTemp, msg: msgResist + partes.join(" · ") };
    }
    // ---- Criatura: PV Temporário vive na própria linha do rastreador ----
    let resta = valor;
    const noTemp = Math.min(alvo.pvTemp || 0, resta);
    if (noTemp) { alvo.pvTemp = (alvo.pvTemp || 0) - noTemp; resta -= noTemp; }
    let mortos = 0;
    if (!(alvo.qtd > 1)) {
      alvo.hp = Math.max(0, (alvo.hp ?? 0) - resta);
    } else {
      // Bando: o excesso de dano transborda para o próximo lacaio da fila.
      let sobra = resta;
      while (sobra > 0 && alvo.qtd > 0) {
        const tira = Math.min(sobra, alvo.hp);
        alvo.hp -= tira; sobra -= tira;
        if (alvo.hp > 0) break;
        alvo.qtd -= 1; mortos++;
        if (alvo.qtd > 0) alvo.hp = alvo.hp_max; else { alvo.hp = 0; break; }
      }
    }
    return { aplicado: resta, temp: noTemp, mortos,
      msg: `${msgResist}${noTemp ? `✚ PV temp absorve ${noTemp} · ` : ""}−${resta}${mortos ? ` · ${mortos} caiu${mortos > 1 ? "ram" : ""}, restam ${alvo.qtd}` : ""} (${alvo.hp}/${alvo.hp_max})` };
  };
  // Instinto Evasivo do Piloto: +Defesa na nave da tripulação enquanto ele está no leme.
  const bonusDefVeiculo = () => {
    const pil = (membros || []).find((m) => m.posto === "leme")?.perfil_id;
    if (!pil) return 0;
    return (pers || []).filter((p) => p.dono_id === pil)
      .reduce((mx, p) => Math.max(mx, calc({ ...novaFichaDados(), ...p.dados }).efeitos?.defesaVeiculo?.() || 0), 0);
  };
  // Defesa da nave da tripulação: base + Instinto Evasivo do piloto + Sobrecarga de Propulsores.
  const defesaNaveParty = () => {
    const nt = camp.combate?.nave;
    const extra = (nt?.manobraAte > 0 ? (nt.manobraExtra || 0) : 0);
    return 10 + (camp.nave?.manobra || 0) + bonusDefVeiculo() + extra;
  };
  // Auras de criatura (gatilho "aura"): valem enquanto a criatura está viva no
  // rastreador. `fonte` guarda a linha dela para medir o raio no campo tático.
  const aurasAtivas = () => {
    if (!camp.combate?.ativo) return [];
    const out = [];
    for (const c of camp.combate.ordem) {
      if (ehNave(c) || foraDeCombate(c)) continue;
      for (const h of habsDoCombatente(c)) {
        if (!h.efeito || h.gatilho !== "aura") continue;
        const e = h.efeito;
        if (e.tipo === "zona") out.push({ criatura: c.nome, hab: h.n, raio: e.raio, nega: e.nega || [], fonte: c });
        else if (e.tipo === "imunidade") out.push({ criatura: c.nome, hab: h.n, imune: e.a, limiar: e.limiar, fonte: c });
      }
    }
    return out;
  };
  // A zona só pega quem está dentro do raio da criatura. Sem posição dos dois
  // lados (ou sem raio declarado), vale para o combate inteiro, como antes.
  const aurasSobre = (quem, oque) => aurasAtivas().filter((a) => {
    if (oque && !(a.nega || []).includes(oque)) return false;
    if (!a.raio || !quem?.pos || !a.fonte?.pos) return true;
    const dd = distCombate(a.fonte, quem);
    return dd == null || dd <= a.raio;
  });
  const auraNega = (oque, quem) => aurasSobre(quem ?? minhaLinhaCb(), oque).length > 0;
  // Linha do rastreador do personagem ativo; e a condição que trava a ação dele,
  // se houver (Atordoado / Paralisado, + as passadas em `extra`). Mestre nunca trava.
  const minhaLinhaCb = () => (camp.combate?.ativo ? camp.combate.ordem.find((x) => x.personagem_id === ui.meuPers?.id) : null) || null;
  // (minhaTrava agora vive em mesa-ficha.js — único consumidor.)
  // ---- Economia de ações ----------------------------------------------------
  // Cada combatente gasta Ação Principal (p) e de Movimento (m) no próprio turno,
  // e uma Reação (r) por rodada, que pode ser usada no turno de qualquer um.
  // Ação Livre não consome nada. O Mestre sempre pode forçar.
  const ROT_ACAO = { p: "Ação Principal", m: "Ação de Movimento", r: "Reação" };
  const chaveAcao = (txt) => /principal/i.test(txt || "") ? "p"
    : /movimento/i.test(txt || "") ? "m" : /rea[çc]/i.test(txt || "") ? "r" : null;
  const gastarAcao = async (tipoTxt, oque = "") => {
    const chave = chaveAcao(tipoTxt);
    if (!chave || !camp.combate?.ativo) return true;   // livre, ou fora de combate
    const linha = minhaLinhaCb();
    if (!linha) return true;                            // não está no rastreador
    linha.acoes = linha.acoes || {};
    if (linha.acoes[chave]) {
      if (!ui.souMestre) { alert(`${ui.meuPers.nome} já usou a ${ROT_ACAO[chave]} nesta rodada${oque ? ` (tentou: ${oque})` : ""}.`); return false; }
      if (!(await confirmModal(`A ${ROT_ACAO[chave]} de ${linha.nome} já foi usada nesta rodada.\n\nUsar assim mesmo?`, { okLabel: "Usar mesmo assim" }))) return false;
    }
    linha.acoes[chave] = true;
    await salvarCombate();
    return true;
  };
  if (!Array.isArray(camp.bestiario)) camp.bestiario = [];
  // Habilidades declaradas de um combatente. Linhas antigas do rastreador foram
  // salvas sem `habs` — reidrata pelo nome, senão auras/regeneração/invocação
  // simplesmente não existiriam para quem já estava em campo.
  const habsDoCombatente = (c) => {
    if (c?.habs?.length) return c.habs;
    if (!c || ehNave(c) || c.personagem_id) return [];
    const base0 = String(c.nome || "").replace(/ #\d+$/, "");
    const b = todasCriaturas().find((x) => x.n === base0) || (camp.bestiario || []).find((x) => x.n === base0);
    if (b?.habs?.length) { c.habs = b.habs; return c.habs; }   // gruda na linha para o próximo salvamento
    return [];
  };
  if (!camp.combate_nave || typeof camp.combate_nave !== "object" || !("inimigas" in camp.combate_nave)) camp.combate_nave = combateNaveVazio();
  if (!camp.faccoes || typeof camp.faccoes !== "object") camp.faccoes = {};
  if (!Array.isArray(camp.contratos)) camp.contratos = [];
  if (!camp.handout || typeof camp.handout !== "object") camp.handout = {};
  const salvarBestiario = async () => { await salvarCamp({ bestiario: camp.bestiario }, "salvar o bestiário"); };

  const enviar = async (tipo, conteudo, payload = null) => {
    if (ui.asCegas && ui.souMestre && tipo === "rolagem") {   // às cegas: fica só na tela do Mestre
      const p = payload || {};
      await modalForm({ titulo: "🙈 Rolagem às cegas", campos: [
        { k: "i", label: `${p.titulo || "Rolagem"} — ${p.detalhe || ""}${p.total != null ? `  =  ${p.total}` : ""}${p.extra ? "\n" + p.extra : ""}`, tipo: "info" }], okLabel: "Fechar", semCancelar: true });
      return true;
    }
    const { data, error } = await sb.from("mensagens").insert({ campanha_id: id, autor_id: usuario.id, personagem_id: ui.meuPers?.id || null, tipo, conteudo, payload }).select("*,perfis:autor_id(apelido,avatar_url)").single();
    if (error) { alert("Não consegui transmitir: " + error.message); return false; }
    ui.pintarMsg?.(data, true); // mostra na hora, sem depender do realtime voltar
    return true;
  };

  // (rolarEEnviar/desvPorTeste/PERICIAS_VISUAIS/PERICIAS_FISICAS agora vivem em
  // mesa-ficha.js — únicos consumidores.)

  // (ataquesDoCombatente agora vive em mesa-combate.js — único consumidor.)

  // (aplicarEmAlvos/temResistencia/implanteComoArma/catDoAtaque agora vivem em
  // mesa-ficha.js — únicos consumidores.)

  const render = async () => {
    // Fatias já extraídas do monólito (ver "Modularização de telaMesa" em
    // CLAUDE.md) — import() dinâmico é gratuito depois da 1ª vez (módulo já
    // fica em cache do navegador), então não precisa de flag de "já carregou".
    if (canalMesa) { sb.removeChannel(canalMesa); canalMesa = null; }
    const { renderNave, wireNave } = await import("./mesa-nave.js");
    const { renderCombate, wireCombate } = await import("./mesa-combate.js");
    const { renderFicha, wireFicha } = await import("./mesa-ficha.js");
    const f = ui.meuPers ? { ...novaFichaDados(), ...ui.meuPers.dados } : null;
    // Dentro de uma Zona Morta (aura que anula "implantes"), a ficha é recalculada
    // como se a pessoa não tivesse cibernética nenhuma: some o +2 de RAM do Chip,
    // a CD das Placas e todo efeito declarado de implante, enquanto ela estiver no raio.
    const semImplantes = auraNega("implantes");
    const k = f ? calc(f, { semImplantes }) : null;
    const nave = camp.nave;
    const meuPosto = membros?.find((m) => m.perfil_id === usuario.id)?.posto;
    const cbn = camp.combate_nave || combateNaveVazio();
    // Janela visível do campo tático: tudo (40 m) ou aproximada (12 m em volta do foco).
    const vistaCampo = (() => {
      if (!ui.campoZoom) return { ini: 0, fim: CAMPO_LARGURA };
      const foco = camp.combate.ordem.find((c) => c.id === ui.tokenSel)
        || camp.combate.ordem[camp.combate.turno]
        || camp.combate.ordem.find((c) => c.pos);
      const cx = foco?.pos?.x ?? CAMPO_LARGURA / 2;
      const ini = Math.max(0, Math.min(CAMPO_LARGURA - CAMPO_JANELA, cx - CAMPO_JANELA / 2));
      return { ini, fim: ini + CAMPO_JANELA };
    })();
    const vistaLarg = vistaCampo.fim - vistaCampo.ini;
    const pctX = (x) => ((x - vistaCampo.ini) / vistaLarg) * 100;
    // Naves agora têm posição no campo tático — podem ser selecionadas como
    // qualquer token (ver alcance/distâncias), não só personagens/criaturas.
    const tokenSelObj = camp.combate.ordem.find((c) => c.id === ui.tokenSel) || null;
    const ctxNave = { id, camp, pers, membros, ui, f, k, nave, cbn, meuPosto, enviar, salvarCamp, salvarCbn, render, defesaNaveParty, bonusDefVeiculo, aplicarDanoAlvo, snapshot };
    const ctxCombate = { id, camp, pers, membros, ui, f, k, enviar, salvarCamp, salvarCombate, render, snapshot,
      aplicarDanoAlvo, habsDoCombatente, aurasAtivas, gastarAcao, sincronizarCdCombate, sincronizarFicha,
      defesaNaveParty, bonusDefVeiculo, salvarBestiario, pilhaUndo, vistaCampo, vistaLarg, pctX, tokenSelObj };
    const ctxFicha = { id, camp, pers, meus, semImplantes, chavePers, ui, f, k,
      enviar, salvarCamp, salvarCombate, render, snapshot,
      aplicarDanoAlvo, gastarAcao, sincronizarCdCombate, aurasSobre, minhaLinhaCb };
    shell("mesa", `
      <nav class="topo"><a class="btn-ghost" href="#/campanhas">← CAMPANHAS</a>
        <div class="topo-status">${esc(camp.nome)} · código <b class="chrome">${camp.codigo}</b></div><span style="display:flex;gap:6px"><button id="atalhos" class="btn-ghost so-desktop" title="Atalhos de teclado (?)">⌨</button><button id="abrir-diario" class="btn-ghost" title="Diário da campanha">📔 DIÁRIO</button>${ehMestreReal ? `<button id="modo-jogador" class="btn-ghost ${ui.modoJogador ? "on" : ""}" title="${ui.modoJogador ? "Você está jogando como tripulante. Clique para voltar a ser Mestre." : "Testar/jogar como um tripulante comum — some as ferramentas e os privilégios de Mestre."}">${ui.modoJogador ? "🎭 MODO JOGADOR" : "👑 MESTRE"}</button>` : ""}${ui.souMestre ? `<button id="abrir-mestre" class="btn-ghost" title="Tela do Mestre">🎛 MESTRE</button>` : ""}<a href="#/biblioteca/regras" target="_blank" rel="noopener" class="btn-ghost" title="Manual de regras — abre numa aba nova, a mesa continua aberta aqui">📖 REGRAS</a><button id="abrir-mapa" class="btn-ghost" title="Mapa do sistema (compartilhado)">🗺 MAPA</button></span></nav>
      <div class="mesa">
        <div class="mesa-lateral">
          <nav class="mesa-abas" role="tablist">
            <button class="mesa-aba ${ui.abaMesa === "ficha" ? "on" : ""}" data-mesa-aba="ficha" role="tab">◈ <span>Ficha</span></button>
            <button class="mesa-aba ${ui.abaMesa === "combate" ? "on" : ""}" data-mesa-aba="combate" role="tab">⚔ <span>Combate</span>${camp.combate.ativo ? `<i class="aba-dot"></i>` : ""}</button>
            <button class="mesa-aba ${ui.abaMesa === "nave" ? "on" : ""}" data-mesa-aba="nave" role="tab">🚀 <span>Nave</span>${cbn.ativo ? `<i class="aba-dot"></i>` : ""}</button>
            <button class="mesa-aba ${ui.abaMesa === "mesa" ? "on" : ""}" data-mesa-aba="mesa" role="tab">📋 <span>Mesa</span></button>
          </nav>
          ${renderCombate(ctxCombate)}
          ${renderFicha(ctxFicha)}
          ${renderNave(ctxNave)}
          <div class="mesa-painel" ${ui.abaMesa === "mesa" ? "" : "hidden"}>
          ${(camp.contratos?.length || Object.keys(camp.faccoes || {}).length) ? `<section class="sec"><header><span class="tag">📋</span><h2>Contratos & Reputação</h2></header>
            ${(camp.contratos || []).filter((c) => c.status !== "concluido").map((c) => `<div class="inv"><span><b>${esc(c.titulo)}</b> <span class="best-tag">${esc(c.status)}</span><br><span class="regra">${esc(c.recompensa)}${c.faccao ? ` · ${esc(c.faccao)}` : ""}</span></span></div>`).join("") || `<p class="regra">Nenhum contrato aberto.</p>`}
            ${Object.entries(camp.faccoes || {}).filter(([, v]) => v !== 0).map(([n, v]) => { const nv = NIVEIS_REPUTACAO.find((x) => x.v === v) || NIVEIS_REPUTACAO[3];
              return `<p class="regra">${esc(n)}: <b style="color:${nv.cor}">${esc(nv.n)}</b></p>`; }).join("")}
          </section>` : ""}
          <section class="sec"><header><span class="tag">🩺</span><h2>Estado da tripulação</h2></header>
            ${(pers || []).length ? (pers || []).map((x) => { const fx = { ...novaFichaDados(), ...(x.dados || {}) }; const kx = calc(fx);
              const pv = kx.pvMax ? Math.max(0, Math.min(100, 100 * fx.pvAtual / kx.pvMax)) : 0;
              const ram = kx.ramMax ? Math.max(0, Math.min(100, 100 * kx.ramLivre / kx.ramMax)) : 0;
              const crit = fx.pvAtual <= 0 ? "morto" : (kx.pvMax && fx.pvAtual / kx.pvMax <= 0.3) ? "ferido" : "";
              const linhaCb = (camp.combate?.ordem || []).find((c2) => c2.personagem_id === x.id);
              return `<div class="pf-linha ${crit}" data-inspect="${x.id}" title="Ver ficha completa">
                <span class="pf-nome">${esc(x.nome) || "sem nome"}${fx.pvAtual <= 0 ? " ☠" : ""}${fx.pvTemp ? ` <b class="tech-c">✚${fx.pvTemp}</b>` : ""}${kx.escudoLivre ? ` <b class="sombra-c">🛡${kx.escudoLivre}</b>` : ""}</span>
                <span class="cb-hp" title="Pontos de Vida"><span class="cb-hp-barra" style="width:${pv}%;background:${crit === "ferido" ? "var(--perigo)" : "var(--tech)"}"></span><b>${fx.pvAtual}/${kx.pvMax}</b></span>
                <span class="cb-hp" title="RAM"><span class="cb-hp-barra" style="width:${ram}%;background:var(--sombra)"></span><b>${kx.ramLivre}/${kx.ramMax}</b></span>
                ${(linhaCb?.cond || []).length ? `<span class="cb-conds">${linhaCb.cond.map((cd) => `<span class="cb-cond ${infoCond(cd.n)?.dano ? "sangra" : "estado"}" title="${esc(cd.n)} · ${cd.turnos} turno(s)">${infoCond(cd.n)?.ic || "🏷"} ${esc(cd.n)} ${cd.turnos}</span>`).join("")}</span>` : ""}
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
          <div class="barra-acao">
          <div class="rol-toggles"><span class="regra" style="margin:0">Rolagem:</span>
            <button id="tg-vant" class="mini" title="Vantagem: rola 2d20, pega o maior">▲ Vantagem</button>
            <button id="tg-desv" class="mini" title="Desvantagem: rola 2d20, pega o menor">▼ Desvantagem</button>
            <button id="tg-priv" class="mini" title="Privado: só o Mestre e você veem o resultado">🔒 Privado</button>${ui.souMestre ? `<button id="tg-cega" class="mini" title="Às cegas: o resultado aparece só para você, e não entra no chat da mesa">🙈 Às cegas</button>` : ""}
            <button id="tg-som" class="mini" title="Ligar/desligar som e notificações" style="margin-left:auto"></button></div>
          <div class="linha-add"><input id="msg" placeholder="Mensagem ou rolagem: /1d20 · /r2d6+1"/><button id="enviar-msg" class="btn-primario">▶</button></div>
          </div>
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
      if (m.payload?.privada && m.autor_id !== usuario.id && !ui.souMestre) return; // rolagem privada: só autor + Mestre
      if (aoVivo && !historico.some((x) => x.id === m.id)) historico.push(m); // persiste entre re-renders
      if (aoVivo && m.autor_id !== usuario.id && m.tipo !== "sistema") { // alerta de mensagem de outra pessoa
        if (m.tipo === "rolagem") { const p = m.payload || {}; if (p.crit) { somCritico(); sacudir(); } else if (p.fumble) { somFalha(); sacudir(); } else somDado(); }
        else somMensagem();
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
          ${p.dano_total != null && !p.alvo_resolvido && ui.souMestre && camp.combate.ativo ? `<button class="m-aplicar" data-dano="${p.dano_total}">🩸 aplicar ${p.dano_total} de dano</button>` : ""}</div>`; }
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
        const pRoll = m.payload || {};
        const r = await modalForm({ titulo: `🩸 Aplicar ${dano} de dano`, campos: [{ k: "alvo", label: "Alvo", tipo: "select", opcoes: camp.combate.ordem.map((c) => ({ v: c.id, l: ehNave(c) ? `${c.nome} (casco ${c.casco}/${c.casco_max})` : `${c.nome} (${c.hp}/${c.hp_max}${c.cd != null ? `, Def ${c.cd}` : ""})` })) }], okLabel: "Aplicar" });
        if (!r) return; const alvo = camp.combate.ordem.find((c) => c.id === r.alvo); if (!alvo) return;
        // Se a rolagem trouxe um acerto (payload.total), confere contra a Defesa do alvo antes de aplicar.
        // Perfurante/Derretimento (payload.ignoraArmadura) reduzem a Defesa efetiva do teste.
        const defAlvo = Math.max(0, (ehNave(alvo) ? 10 + (alvo.manobra || 0) : (alvo.cd ?? 10)) - (pRoll.ignoraArmadura || 0));
        if (pRoll.total != null && !pRoll.crit && (pRoll.fumble || pRoll.total < defAlvo)) {
          const forcar = await confirmModal(`A rolagem foi ${pRoll.total} contra a Defesa ${defAlvo} de ${alvo.nome}.${pRoll.ignoraArmadura ? ` (Perfurante −${pRoll.ignoraArmadura})` : ""}${pRoll.fumble ? " Falha crítica." : ""} ${alvo.nome} desvia do golpe.\n\nAplicar o dano mesmo assim?`, { okLabel: "Aplicar mesmo assim", cancelLabel: "Errou o alvo", perigo: true });
          if (!forcar) { await enviar("sistema", `🛡 ${pRoll.titulo || "O ataque"} erra ${alvo.nome} (rolagem ${pRoll.total} vs Defesa ${defAlvo}) — sem dano.`); return; }
        }
        const rd = await aplicarDanoAlvo(alvo, dano);
        await enviar("sistema", `💥 ${alvo.nome}: ${rd.msg}${!ehNave(alvo) && foraDeCombate(alvo) ? " 💀 CAIU!" : ""}`);
        await salvarCombate(); render();
      });
      el.querySelector("[data-goto]")?.addEventListener("click", () => {
        const alvo = chatEl.querySelector(`[data-mid="${resp.id}"]`);
        if (alvo) { alvo.scrollIntoView({ behavior: "smooth", block: "center" }); alvo.classList.add("piscar"); setTimeout(() => alvo.classList.remove("piscar"), 1200); }
      });
      el.querySelector("[data-aplicar]")?.addEventListener("click", async (ev) => {
        const bt = ev.currentTarget; if (bt.disabled) return; bt.disabled = true;   // evita clique duplo
        const p = m.payload; const alvo = pers.find((x) => x.id === p.alvo_id);
        if (!alvo) { bt.disabled = false; return; }
        // Lê o estado real do banco: a cópia do render fica velha entre cliques.
        const { data: fresco } = await sb.from("personagens").select("dados").eq("id", alvo.id).single();
        const dados = { ...novaFichaDados(), ...(fresco?.dados || alvo.dados) };
        const antes = dados.pvAtual || 0;
        dados.pvAtual = Math.max(0, Math.min(calc(dados).pvMax, antes + (m.tipo === "dano" ? -p.valor : p.valor)));
        dados.log = [{ q: new Date().toISOString(), t: `${m.tipo === "dano" ? "💥" : "✚"} ${p.valor} PV — ${esc(p.origem || "mesa")}` }, ...(dados.log || [])].slice(0, 60);
        if (!(await salvarFicha(alvo.id, dados, "aplicar o dano/cura"))) { bt.disabled = false; return; }
        alvo.dados = dados;                          // mantém o estado local coerente
        if (ui.meuPers && ui.meuPers.id === alvo.id) ui.meuPers.dados = dados;
        await sb.from("mensagens").update({ payload: { ...p, aplicado: true } }).eq("id", m.id);
        m.payload = { ...p, aplicado: true };
        await enviar("sistema", `${alvo.nome}: ${antes} → ${dados.pvAtual} PV${dados.pvAtual <= 0 ? " — CAIU!" : ""}`);
        render();                                    // a ficha e as barras acompanham
      });
      // Descanso convocado pelo Mestre: cada cliente aplica no SEU personagem vinculado.
      // Só ao vivo (aoVivo) para não reaplicar ao recarregar o histórico.
      if (aoVivo && m.tipo === "descanso" && ui.meuPers) {
        (async () => {
          const dados = { ...novaFichaDados(), ...ui.meuPers.dados };
          // Nova sessão não é descanso: só libera as habilidades de 1×/sessão.
          if (m.payload?.tipo === "sessao") {
            const cat = abilidadesDeSessao(dados); let n = 0;
            dados.usos = dados.usos || {};
            cat.forEach((a) => { if (dados.usos[a.id]) { delete dados.usos[a.id]; n++; } });
            if (!n) return;
            dados.log = [{ q: new Date().toISOString(), t: `📅 Nova sessão — ${n} habilidade(s) de 1×/sessão liberada(s)` }, ...(dados.log || [])].slice(0, 60);
            if (await salvarFicha(ui.meuPers.id, dados, "liberar as habilidades de sessão")) { ui.meuPers.dados = dados; await enviar("sistema", `📅 ${ui.meuPers.nome}: ${cat.map((a) => a.nome).join(", ")} disponível de novo.`); render(); }
            return;
          }
          const r = aplicarDescanso(dados, m.payload?.tipo === "longo" ? "longo" : "curto");
          dados.log = [{ q: new Date().toISOString(), t: `${m.payload?.tipo === "longo" ? "🌙" : "☾"} ${r.notas.join(" · ")}` }, ...(dados.log || [])].slice(0, 60);
          if (await salvarFicha(ui.meuPers.id, dados, "salvar o descanso")) { ui.meuPers.dados = dados; await enviar("sistema", `🛌 ${ui.meuPers.nome}: ${r.notas.join(" · ")}.`); render(); }
        })();
      }
      if (aoVivo && m.tipo === "recompensa" && ui.meuPers) {
        (async () => {
          const dados = { ...novaFichaDados(), ...ui.meuPers.dados }; const p = m.payload || {}; const notas = [];
          if (p.xp) { dados.xp = (dados.xp || 0) + p.xp; notas.push(`+${p.xp} XP (${dados.xp}/${dados.xpMeta})`); }
          if (p.creditos) {
            const kk = calc(dados);
            const rs = kk.efeitos?.aoSaquear();
            let ganho = p.creditos;
            if (rs?.pct) { const extra = Math.round(p.creditos * rs.pct / 100); ganho += extra;
              notas.push(`+${extra} CG extra (${rs.fontes[0]}: +${rs.pct}%)`); }
            for (const r of rs?.rolagens || []) {
              const pd2 = parseDice(r.dado); const v2 = rollNd(pd2.n, pd2.f).reduce((x, y) => x + y, 0);
              notas.push(v2 >= r.minimo ? `🎲 ${r.dado} [${v2}] — achou ${r.oque}!` : `🎲 ${r.dado} [${v2}] — nada além do previsto`);
            }
            dados.creditos = (dados.creditos || 0) + ganho;
            notas.push(`+${ganho} CG (${dados.creditos})`);
          }
          if (p.item) {
            dados.inventario = dados.inventario || [];
            const ja = dados.inventario.find((x) => x.nome === p.item.nome);
            if (ja) ja.qtd = (ja.qtd || 1) + (p.item.qtd || 1);
            else dados.inventario.push({ ...p.item, equip: false });
            notas.push(`+${p.item.qtd || 1}× ${p.item.nome}`);
          }
          if (p.loot) {
            const { nome, tipo, qtd } = p.loot;
            if (tipo === "implante") { dados.implantes = dados.implantes || [];
              if (!dados.implantes.includes(nome)) { dados.implantes.push(nome); notas.push(`⧉ ${nome}`); }
              else notas.push(`${nome} (já instalado)`);
            } else {
              dados.inventario = dados.inventario || [];
              const empilha = ehConsumivel(nome);
              const ja = empilha ? dados.inventario.find((x) => x.nome === nome) : null;
              if (ja) ja.qtd = (ja.qtd || 1) + qtd;
              else dados.inventario.push({ tipo, nome, equip: false, qtd: empilha ? qtd : 1 });
              notas.push(`${qtd > 1 ? `${qtd}× ` : ""}${nome}`);
            }
          }
          if (p.pentes) {
            const res = normalizaPentes(dados);
            const tipo = p.tipoPente || PENTE_PADRAO;
            const antes = Object.values(res).reduce((x, y) => x + y, 0);
            const teto = pentesReservaDe(dados);
            const cabe = Math.max(0, teto - antes);
            const ganhou = Math.min(p.pentes, cabe);
            res[tipo] = (res[tipo] || 0) + ganhou;
            dados.pentes = res;
            const tp = TIPOS_PENTE[tipo];
            notas.push(ganhou > 0 ? `+${ganhou} pente ${tp.ic} ${tp.n} (${antes + ganhou}/${teto} na reserva)` : "reserva de pentes já cheia");
          }
          dados.log = [{ q: new Date().toISOString(), t: `🎁 Recompensa do Mestre: ${notas.join(" · ")}` }, ...(dados.log || [])].slice(0, 60);
          if (await salvarFicha(ui.meuPers.id, dados, "salvar a recompensa")) { ui.meuPers.dados = dados; await enviar("sistema", `🎖 ${ui.meuPers.nome}: ${notas.join(" · ")}${dados.metodoNivel === "xp" && dados.xp >= dados.xpMeta ? " — PRONTO PARA SUBIR!" : ""}`); render(); }
        })();
      }
    };
    ui.pintarMsg = addMsg;
    historico.forEach((m) => addMsg(m));

    // ---- realtime ----
    // Passa o token do usuário pro socket realtime; sem isso o canal entra como
    // anônimo e a RLS de mensagens filtra tudo (nada chega na mesa).
    try { const { data: { session } } = await sb.auth.getSession(); if (session?.access_token) sb.realtime.setAuth(session.access_token); } catch (_) {}
    canalMesa = sb.channel(`mesa-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens", filter: `campanha_id=eq.${id}` },
        async (pl) => { const { data: m } = await sb.from("mensagens").select("*,perfis:autor_id(apelido,avatar_url)").eq("id", pl.new.id).single(); if (m) addMsg(m, true); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "campanhas", filter: `id=eq.${id}` },
        (pl) => { if (ecoProprio()) return;   // é a nossa própria gravação voltando
          camp.nave = pl.new.nave; camp.mapa = pl.new.mapa; camp.combate = pl.new.combate; camp.combate_nave = pl.new.combate_nave || combateNaveVazio(); camp.handout = pl.new.handout || {}; camp.faccoes = pl.new.faccoes || {}; camp.contratos = pl.new.contratos || []; camp.bestiario = pl.new.bestiario || []; ui.mapaCtrl?.atualizar(pl.new.mapa, pl.new.combate); render(); })
      .subscribe();

    // ---- binds ----
    $("#enviar-msg").onclick = () => { const t = $("#msg").value.trim(); if (!t) return; $("#msg").value = "";
      const resp = respondendoA; cancelarResp();
      const rr = /^\/(?:r(?:olar)?)?\s*(.+)$/i.exec(t);
      if (rr) { const r = rolarExpr(rr[1], ui.vantagem); if (r) {
        return enviar("rolagem", null, { titulo: (ui.privada ? "🔒 " : "") + `Rolagem ${rr[1]}`, detalhe: r.detalhe, total: r.total, ...(ui.privada ? { privada: true } : {}), ...(resp ? { resp } : {}) }); } }
      enviar("texto", t, resp ? { resp } : null); };
    $("#resp-cancel")?.addEventListener("click", cancelarResp);
    const syncTg = () => { $("#tg-vant")?.classList.toggle("on", ui.vantagem > 0); $("#tg-desv")?.classList.toggle("on", ui.vantagem < 0); $("#tg-priv")?.classList.toggle("on", ui.privada); $("#tg-cega")?.classList.toggle("on", ui.asCegas); };
    $("#tg-vant")?.addEventListener("click", () => { ui.vantagem = ui.vantagem > 0 ? 0 : 1; syncTg(); });
    $("#tg-desv")?.addEventListener("click", () => { ui.vantagem = ui.vantagem < 0 ? 0 : -1; syncTg(); });
    $("#tg-priv")?.addEventListener("click", () => { ui.privada = !ui.privada; syncTg(); });
    $("#tg-cega")?.addEventListener("click", () => { ui.asCegas = !ui.asCegas; syncTg(); });
    const syncSom = () => { const b = $("#tg-som"); if (b) b.textContent = getSom() ? "🔔 Som" : "🔕 Mudo"; };
    $("#tg-som")?.addEventListener("click", () => { setSom(!getSom()); if (getSom()) { pedirNotificacao(); somMensagem(); } syncSom(); });
    syncSom();
    syncTg();
    $("#msg").onkeydown = (e) => { if (e.key === "Enter") $("#enviar-msg").click(); else if (e.key === "Escape") cancelarResp(); };
    $("#mestre-curto")?.addEventListener("click", () => { if (confirm("Convocar Descanso Curto para toda a mesa? Cada jogador conectado recupera as habilidades de descanso curto no próprio personagem.")) enviar("descanso", "O Mestre convocou um Descanso Curto (1h). Habilidades de descanso curto reiniciadas; cura via Kits Médicos.", { tipo: "curto" }); });
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
      if (!(await salvarCamp({ handout: camp.handout }, "compartilhar a imagem"))) return;
      await enviar("sistema", `🖼 O Mestre mostrou uma imagem${r.titulo ? `: ${r.titulo}` : ""}.`);
      render();
    });
    $("#handout-off")?.addEventListener("click", async () => {
      camp.handout = { ...(camp.handout || {}), visivel: false };
      await salvarCamp({ handout: camp.handout }, "ocultar a imagem");
      render();
    });
    app.querySelectorAll("[data-mesa-aba]").forEach((b) => b.onclick = () => {
      ui.abaMesa = b.dataset.mesaAba; sessionStorage.setItem("ps-aba-mesa", ui.abaMesa);
      app.querySelectorAll("[data-mesa-aba]").forEach((x) => x.classList.toggle("on", x.dataset.mesaAba === ui.abaMesa));
      app.querySelectorAll(".mesa-painel").forEach((p2, i2) => { p2.hidden = ["combate", "ficha", "nave", "mesa"][i2] !== ui.abaMesa; });
    });
    // Inspetor de personagem: o Mestre precisa ver vida, RAM, armas e scripts
    // de qualquer jogador sem sair da mesa e sem pedir print.
    app.querySelectorAll("[data-inspect]").forEach((el2) => el2.onclick = () => {
      const alvo = (pers || []).find((x) => x.id === el2.dataset.inspect); if (!alvo) return;
      const fx = { ...novaFichaDados(), ...(alvo.dados || {}) }; const kx = calc(fx);
      const pvP = kx.pvMax ? Math.max(0, Math.min(100, 100 * fx.pvAtual / kx.pvMax)) : 0;
      const ramP = kx.ramMax ? Math.max(0, Math.min(100, 100 * kx.ramLivre / kx.ramMax)) : 0;
      const est = fx.pvAtual <= 0 ? "morto" : pvP <= 30 ? "critico" : pvP <= 60 ? "ferido" : "";
      const res = normalizaPentes(fx); const tpm = TIPOS_PENTE[fx.tipoPente || PENTE_PADRAO];
      const totalPentes = Object.values(res).reduce((a2, b2) => a2 + b2, 0);
      const armas = (fx.inventario || []).filter((it) => it.equip && ARMAS.find((w) => w.n === it.nome));
      const cons = (fx.inventario || []).filter((it) => ehConsumivel(it.nome) && (it.qtd || 1) > 0);
      const ov = document.createElement("div"); ov.className = "ss-overlay ov-modal"; ov.style.zIndex = "10000";
      const linhaAttr = (a3) => `<div class="ins-attr"><span>${a3}</span><b>${sign(kx.attr[a3])}</b></div>`;
      ov.innerHTML = `<div class="ss-painel ins-painel">
        <div class="mp-topo">${fx.foto ? `<img class="ins-foto" src="${esc(fx.foto)}" alt=""/>` : ""}
          <b>${esc(alvo.nome) || "sem nome"}</b>
          <span class="best-tag">NV ${fx.nivel || 1}</span>
          <span class="dim">${esc(fx.raca || "?")} · ${esc(fx.classe || "?")}</span>
          <button id="ins-x" class="mp-x" style="margin-left:auto">✕</button></div>
        <div class="di-corpo">
          <div class="vitais-barras">
            <div class="vb"><div class="vb-topo"><span>❤ Vida</span><b class="${est}">${fx.pvAtual}<span class="dim">/${kx.pvMax}</span></b></div>
              <div class="vb-trilho"><span class="cb-hp-barra vb-fill ${est}" style="width:${pvP}%"></span></div></div>
            <div class="vb"><div class="vb-topo"><span>◈ RAM</span><b class="sombra-c">${kx.ramLivre}<span class="dim">/${kx.ramMax}</span></b></div>
              <div class="vb-trilho"><span class="cb-hp-barra vb-fill ram" style="width:${ramP}%"></span></div></div>
          </div>
          <div class="ins-linha"><span>🛡 Defesa <b>${kx.cd}</b></span><span>🎯 Iniciativa <b>${sign(kx.iniciativa)}</b></span>
            <span>🏃 <b>${kx.deslocamento}m</b></span><span>◈ Conjuração <b>+${kx.conj}</b></span><span>💰 <b>${fx.creditos ?? 0}</b> CG</span></div>
          <div class="ins-attrs">${["For", "Des", "Con", "Int", "Sab", "Car"].map(linhaAttr).join("")}</div>

          <h4>🔫 Munição</h4>
          <p class="regra">No cano: <b style="color:${tpm.cor}">${tpm.ic} ${esc(tpm.n)}</b> — ${fx.tirosPente ?? TIROS_POR_PENTE}/${TIROS_POR_PENTE} tiros.
            Reserva: ${totalPentes ? Object.entries(res).filter(([, q]) => q > 0).map(([k2, q]) => `${TIPOS_PENTE[k2].ic} ${TIPOS_PENTE[k2].n} ×${q}`).join(" · ") : "<b class='perigo-c'>vazia</b>"}</p>

          <h4>⚔ Armas equipadas</h4>
          ${armas.length ? armas.map((it) => { const w = ARMAS.find((x2) => x2.n === it.nome); const pr = propsArma(w);
            return `<div class="ins-item"><b>${esc(w.n)}</b> <span class="chrome">${danoArma(w, fx.nivel)}</span>
              <span class="regra">${esc(w.per)} (${w.attr}) · ${esc(w.kw || "")}${pr.efeito ? ` — ${esc(pr.efeito)}` : ""}</span></div>`; }).join("")
            : `<p class="regra"><i>Nenhuma arma equipada.</i></p>`}

          <h4>◈ Deck de Scripts (${(fx.deck || []).length}/${kx.deckMax})</h4>
          ${(fx.deck || []).length ? (fx.deck || []).map((n2) => { const sc = SCRIPTS.find((x2) => x2.n === n2);
            return sc ? `<div class="ins-item"><b>${esc(sc.n)}</b> <span class="sombra-c">${sc.c}◈ ${esc(sc.a)}</span><span class="regra">${esc(sc.d)}</span></div>` : ""; }).join("")
            : `<p class="regra"><i>Deck vazio.</i></p>`}

          <h4>⧉ Implantes</h4>
          ${(fx.implantes || []).length ? (fx.implantes || []).map((n2) => { const im = IMPLANTES.find((x2) => x2.n === n2);
            return `<div class="ins-item"><b>${esc(n2)}</b>${im ? ` <span class="regra">${esc(im.g)} — ${esc(im.e)}</span>` : ""}</div>`; }).join("")
            : `<p class="regra"><i>Sem cromo.</i></p>`}

          ${cons.length ? `<h4>🎒 Itens utilizáveis</h4>${cons.map((it) => { const c2 = ehConsumivel(it.nome);
            return `<div class="ins-item"><b>${c2.ic} ${esc(it.nome)}</b> <span class="chrome">×${it.qtd || 1}</span><span class="regra">${esc(c2.d)}</span></div>`; }).join("")}` : ""}

          ${(fx.notas || "").trim() ? `<h4>📝 Anotações do jogador</h4><p class="regra" style="white-space:pre-wrap">${esc(fx.notas)}</p>` : ""}
        </div></div>`;
      document.body.appendChild(ov); document.body.style.overflow = "hidden";
      const fechar = () => { document.body.style.overflow = ""; ov.remove(); };
      ov.querySelector("#ins-x").onclick = fechar;
      ov.addEventListener("click", (e) => { if (e.target === ov) fechar(); });
      ov.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });
    });
    $("#modo-jogador")?.addEventListener("click", () => {
      ui.modoJogador = !ui.modoJogador;
      try { localStorage.setItem(chaveModoJog, ui.modoJogador ? "1" : "0"); } catch (e) {}
      ui.souMestre = ehMestreReal && !ui.modoJogador;
      render();
    });
    $("#abrir-mestre")?.addEventListener("click", async () => {
      const { abrirMestre } = await import("./mesa-mestre.js");
      await abrirMestre({ id, camp, pers, enviar, salvarCamp, render });
    });
    $("#copiar-convite")?.addEventListener("click", async () => {
      const link = `${location.origin}${location.pathname}#/entrar/${camp.codigo}`;
      try { await navigator.clipboard.writeText(link); } catch (_) {}
      await modalForm({ titulo: "🔗 Convite da mesa", campos: [
        { k: "i", label: "Quem abrir este link entra direto na campanha (basta ter conta).", tipo: "info" },
        { k: "l", label: "Link", tipo: "texto", valor: link }], okLabel: "Fechar", semCancelar: true });
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
    if (!ui.recapFeita) { ui.recapFeita = true; setTimeout(() => recapitular().catch(() => {}), 900); }

    $("#atalhos")?.addEventListener("click", mostrarAtalhos);
    $("#abrir-diario")?.addEventListener("click", async () => {
      // desc + reverse: sem isso, campanhas com mais de 2000 mensagens perdem tudo que é recente no Diário.
      const { data: todasDesc } = await sb.from("mensagens").select("*,perfis:autor_id(apelido,avatar_url)").eq("campanha_id", id).order("criado_em", { ascending: false }).limit(2000);
      const todas = todasDesc ? [...todasDesc].reverse() : todasDesc;
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
        <div class="mp-topo"><b>📔 Diário — ${esc(camp.nome)}</b>${ui.souMestre ? `<button id="di-marco" class="mini">📖 Marcar momento</button>` : ""}<button id="di-stats" class="mini">📊 Estatísticas</button><button id="di-fechar" class="mp-x" style="margin-left:auto">✕</button></div>
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
        ui.mapaCtrl = abrirMapa({ mapa: camp.mapa, combate: camp.combate, souMestre: ui.souMestre, salvar: salvarMapa, aoFechar: () => { ui.mapaCtrl = null; } });
      } catch (err) { alert("Não consegui abrir o mapa: " + err.message); }
    });
    wireCombate(ctxCombate);
    wireFicha(ctxFicha);
    wireNave(ctxNave);
  };
  render();
}

// ---------------- BIBLIOTECA (movida para biblioteca.js — import() dinâmico no roteador) ----------------

// ---------------- PAINEL DE ADMINISTRAÇÃO (movido para admin.js — import() dinâmico) ----------------

iniciar();
