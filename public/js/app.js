// ============================================================
// PASSAGEM SOMBRIA — DECK DE CAMPO ONLINE (SPA vanilla JS)
// Rotas: #/login #/hangar #/ficha/:id #/campanhas #/mesa/:id #/biblioteca
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { FichaEfeitos, MOMENTOS, EFEITOS as EFEITOS_FICHA, validarEfeitos } from "./efeitos.js";
import { RACAS, CLASSES, FILOSOFIAS, IMPLANTES, SCRIPTS, ARMAS, ARMADURAS, PERICIAS, NAVES, ESTACOES, REGRAS_NAVE, RIQUEZA, TEMAS, CONVERTE_2D8, RENOME_PERICIAS, KEYWORDS, PALAVRAS_CHAVE, chavesDaArma, propsArma, AVARIAS, UPGRADES_NAVE, TURNOS_POR_PENTE, PENTES_MAX, custoTiro, PENTES_INICIAIS, TIROS_POR_PENTE, TIPOS_PENTE, PENTE_PADRAO, CONSUMIVEIS, ehConsumivel, SLOTS_ARMA, SLOTS_POR_ARMA, MODS_ARMA, modsDoSlot, acharMod } from "./dados-jogo.js";
import { BESTIARIO, NIVEIS_AMEACA } from "./dados-bestiario.js";
import { NPCS, PAPEIS } from "./dados-npcs.js";
import { FACCOES, NIVEIS_REPUTACAO, TABELAS, REFERENCIA  } from "./dados-mestre.js";
import { modalForm, confirmModal, somMensagem, somDado, somCritico, somFalha, notificar, pedirNotificacao, getSom, setSom } from "./ui.js";

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
// vant: 1 = vantagem, -1 = desvantagem, 0 = normal.
// Aplica-se ao primeiro d20 da expressão — que é o dado que decide o teste.
const rolarExpr = (expr, vant = 0) => {
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
  const k = { attr, per, isCin, limite, limiteOrg, carga, ramMax, ramLivre, conj, cd, armRef, deckMax, pontosDireito, pontosGastos, perDireito, perGastas, iniciativa, iniBonus, deslocBase, deslocamento };
  // Efeitos declarados (implantes, filosofias, raças, classes, armaduras) entram
  // por cima. É aditivo: o cálculo clássico acima continua valendo, e conteúdo
  // novo passa a funcionar sem precisar de código.
  const fe = FichaEfeitos.de(f, {
    RACAS: CONTEUDO_EXTRA.racas || RACAS,
    CLASSES: CONTEUDO_EXTRA.classes || CLASSES,
    FILOSOFIAS: CONTEUDO_EXTRA.filosofias || FILOSOFIAS,
    IMPLANTES: CONTEUDO_EXTRA.implantesTodos || IMPLANTES,
    ARMADURAS: CONTEUDO_EXTRA.armadurasTodas || ARMADURAS,
    modosAtivos: modosAtivosDe(f),
    chavesDeArmasEquipadas: (f.inventario || [])
      .filter((i) => i.equip && i.tipo === "arma")
      .flatMap((i) => { const w = (CONTEUDO_EXTRA.armasTodas || ARMAS).find((x) => x.n === i.nome);
        return w ? chavesDaArma(w).filter((c) => (c.efeitos || []).length)
          .map((c) => ({ nome: `${c.nome} (${w.n})`, efeitos: c.efeitos })) : []; }) });
  // os quatro implantes que já estavam no cálculo clássico não podem contar duas vezes
  const jaContados = ["Chip de Expansão de RAM", "Placas Subdérmicas de Titânio"];
  fe.fontes = fe.fontes.filter((x) => !jaContados.includes(x.nome));
  fe.aplicarNaFicha(k, { implantes: f.implantes || [], nivel: f.nivel || 1 });
  k.ramLivre = Math.max(0, k.ramMax - (f.ramGasta || 0));   // recalcula após os efeitos
  k.efeitos = fe;
  return k;
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
      <div><span class="dim">Pontos de Vida</span><b>${f.pvAtual || 0} / ${f.pvMax || 0}</b>
        <span class="barra"><i style="width:${f.pvMax ? Math.max(0, Math.min(100, 100 * f.pvAtual / f.pvMax)) : 0}%;background:${ACC}"></i></span></div>
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
// Duração de uma habilidade no nível atual (o Ven'y sobe para 5 e 8 turnos).
function duracaoDe(h, nivel) {
  if (!h?.duracao) return null;
  const d2 = h.duracao; let t = d2.base || 1;
  for (const k of Object.keys(d2).filter((x) => /^\d+$/.test(x)).map(Number).sort((a, b) => a - b))
    if ((nivel || 1) >= k) t = d2[String(k)];
  return t;
}

// Habilidades ativas que ficam LIGADAS (como o gás do Ven'y): devolve os
// efeitos da opção escolhida, para o calc somá-los enquanto durar.
function modosAtivosDe(f) {
  const out = [];
  const raca = RACAS.find((r) => r.nome === f.raca), classe = CLASSES[f.classe];
  const fontes = [...(raca?.habilidades || []), ...(classe?.hab || [])];
  for (const [id, escolha] of Object.entries(f.modos || {})) {
    const h = fontes.find((x) => x.n === id);
    const op = h?.opcoes?.find((o) => o.n === escolha);
    if (op?.efeitos?.length) out.push({ nome: `${h.n}: ${op.n}`, efeitos: op.efeitos });
  }
  return out;
}

// Habilidades ATIVAS do personagem — as que ele declara usar em combate.
// Reúne raça, classe, veterana e filosofia num formato único para a mesa.
function habilidadesAtivas(f) {
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
  const teto = PENTES_MAX - 1;
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
  if (tipo === "longo") {
    pvRec = Math.max(0, (f.pvMax || 0) - (f.pvAtual || 0));
    f.pvAtual = f.pvMax || 0;
    ramRec = f.ramGasta || 0; f.ramGasta = 0;
    f.modos = {};                       // o ar volta ao normal: modos ligados se desfazem
    const totPentes = reporPentes(f);
    cat.forEach((a) => { if (f.usos[a.id]) { delete f.usos[a.id]; habsReset++; } });
    notas.push(pvRec ? `+${pvRec} PV (cheio)` : "PV já cheio", ramRec ? `RAM recarregada (+${ramRec})` : "RAM já cheia", `${totPentes} pente(s) repostos`, `${cat.length} habilidade(s) reiniciada(s)`);
  } else {
    cat.filter((a) => a.freq === "curto").forEach((a) => { if (f.usos[a.id]) { delete f.usos[a.id]; habsReset++; } });
    const nCurto = cat.filter((a) => a.freq === "curto").length;
    notas.push(`${nCurto} habilidade(s) de descanso curto reiniciada(s)`);
    if (f.raca === "Mercusys") { const cura = d(4); pvRec = Math.min(cura, Math.max(0, (f.pvMax || 0) - (f.pvAtual || 0))); f.pvAtual = Math.min(f.pvMax || 0, (f.pvAtual || 0) + cura); notas.push(`regeneração Mercusys +${cura} PV`); }
    else notas.push("PV: use Kits Médicos");
    notas.push(`${reporPentes(f)} pente(s) repostos`);
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
// Peso de cada nível no orçamento de encontro, calibrado pela ameaça real:
// uma Colossal tem 2,5× o HP de um Chefe e mecânicas de raide — vale um encontro inteiro.
const PESO_AMEACA = { Lacaio: 1, Comum: 2, Forte: 4, Elite: 6, Chefe: 12, "Super Chefe": 24, Colossal: 40 };
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
// Condições de combate. As que têm "dano" ferem automaticamente no início do turno
// do afetado; "ic" é o ícone e "d" a regra resumida (usada no tooltip).
const CONDICOES_INFO = [
  { n: "Sangrando",    ic: "🩸", dano: "1d4", d: "Sofre 1d4 no início do seu turno até ser estabilizado." },
  { n: "Em chamas",    ic: "🔥", dano: "1d6", d: "Sofre 1d6 de fogo no início do seu turno. Apagar custa a Ação Principal." },
  { n: "Envenenado",   ic: "🧪", dano: "1d4", d: "Sofre 1d4 e tem Desvantagem em ataques e testes." },
  { n: "Atordoado",    ic: "💫", dano: null,  d: "Perde a Ação Principal. Ataques contra o alvo têm Vantagem." },
  { n: "Paralisado",   ic: "🧊", dano: null,  d: "Não age nem se move. Ataques a até 2m são Críticos automáticos." },
  { n: "Congelado",    ic: "❄", dano: null,  d: "Deslocamento zero. Ainda pode agir." },
  { n: "Cego",         ic: "🌑", dano: null,  d: "Desvantagem em ataques; ataques contra o alvo têm Vantagem." },
  { n: "Caído",        ic: "⬇", dano: null,  d: "Deslocamento pela metade. Levantar custa a Ação de Movimento." },
  { n: "Marcado",      ic: "🎯", dano: null,  d: "Aliados de quem marcou ganham +2 no acerto contra o alvo." },
  { n: "Lento",        ic: "🐌", dano: null,  d: "Perde a Ação de Movimento no próximo turno." },
  { n: "Amedrontado",  ic: "😨", dano: null,  d: "Desvantagem contra a fonte do medo; não pode se aproximar dela." },
  { n: "Enfraquecido", ic: "💔", dano: null,  d: "Causa metade do dano em ataques físicos." },
  { n: "Silenciado",   ic: "🔇", dano: null,  d: "Não conjura Scripts nem usa habilidades que exijam fala." },
];
const CONDICOES = CONDICOES_INFO.map((c) => c.n);
const infoCond = (nome) => CONDICOES_INFO.find((c) => c.n.toLowerCase() === String(nome || "").toLowerCase());
const combateVazio = () => ({ ativo: false, rodada: 1, turno: 0, ordem: [], avarias: [], agiram: [], nave: naveTaticaVazia() });
// Estado tático da nave da tripulação durante o combate (Cap. 12).
// A nave NÃO tem turno: ela é o cenário. Quem age são os tripulantes, nos seus postos.
const naveTaticaVazia = () => ({ evasiva: null, evasivaDe: null, alinhado: false, fraqueza: false, bloqueados: [] });
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
  requestAnimationFrame(() => animarBarras());   // rastro do dano / brilho da cura
}

// ---------------- AUTH ----------------
// Conteúdo cadastrado pela administração, espelhado aqui porque calc() é
// síncrono e não pode esperar um import dinâmico.
const CONTEUDO_EXTRA = { implantes: [], armaduras: [], armas: [], consumiveis: [], naves: [], npcs: [] };
// Arma com as modificações instaladas aplicadas: palavras-chave somadas,
// efeitos acumulados e capacidade do pente ajustada.
function armaMontada(cat, item) {
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
const capacidadePente = (cat) => TIROS_POR_PENTE + (cat?._tirosExtra || 0);

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
function escalaTabela(cat, nivelAtual = null) {
  if (!cat?.escala) return "";
  const marcos = Object.keys(cat.escala).map(Number).sort((a, b) => a - b);
  const faixas = [{ de: 1, ate: marcos[0] - 1, d: cat.dano }];
  marcos.forEach((m, i) => faixas.push({ de: m, ate: marcos[i + 1] ? marcos[i + 1] - 1 : 10, d: cat.escala[String(m)] }));
  return faixas.map((f2) => {
    const ativa = nivelAtual != null && nivelAtual >= f2.de && nivelAtual <= f2.ate;
    return `<span class="escala-faixa ${ativa ? "atual" : ""}"><i>NV ${f2.de}${f2.ate > f2.de ? `–${f2.ate}` : ""}</i><b>${esc(f2.d)}</b></span>`;
  }).join("");
}

function etiquetasKw(cat, { detalhado = false } = {}) {
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
async function criaturaMod() { if (!CRIA) CRIA = await import("./criaturas.js"); return CRIA; }
// Rolagem injetada no motor: ele não conhece o app, só pede um número.
const rolarTexto = (expr) => { const pd = parseDice(String(expr)); return pd ? rollNd(pd.n, pd.f).reduce((x, y) => x + y, 0) + pd.mod : (+expr || 0); };

let CONT = null;   // módulo de conteúdo editável (carregado sob demanda)
async function conteudoMod() {
  if (!CONT) { CONT = await import("./conteudo.js"); await CONT.carregarConteudo(); sincronizarExtra(); }
  return CONT;
}
function sincronizarExtra() {
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
const img = (nome) => (CONT ? CONT.thumb(nome) : "");
const imgFig = (nome) => (CONT ? CONT.figura(nome) : "");
const extras = (tipo) => (CONT ? CONT.conteudo()[tipo] || [] : []);
// Listas do jogo: itens nativos (já com os ajustes da administração aplicados
// por cima) somados ao conteúdo criado do zero.
const ajustar = (lista, tipo) => (CONT ? CONT.comAjustes(lista, tipo) : lista);
const todasArmas = () => [...ajustar(ARMAS, "arma"), ...extras("armas")];
const todasArmaduras = () => [...ajustar(ARMADURAS, "armadura"), ...extras("armaduras")];
const todosImplantes = () => [...ajustar(IMPLANTES, "implante"), ...extras("implantes")];
const todosConsumiveis = () => [...ajustar(CONSUMIVEIS, "consumivel"), ...extras("consumiveis")];
const todasNaves = () => [...ajustar(NAVES, "nave"), ...extras("naves")];
const todosNPCs = () => [...ajustar(NPCS, "npc"), ...extras("npcs")];
const todasCriaturas = () => [...ajustar(BESTIARIO, "criatura"), ...extras("criaturas")];

// ---------------------------------------------------------------------------
//  AVISO COM DESFAZER — confirma depois da ação em vez de perguntar antes.
//  Some sozinho; enquanto está na tela, dá para voltar atrás.
// ---------------------------------------------------------------------------
let avisoTimer = null;
function avisar(texto, aoDesfazer = null, ms = 6000) {
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
function estadoArma(f, it) {
  const cat = todasArmas().find((w) => w.n === it.nome);
  if (!cat || cat.tipo !== "fogo") return null;
  // migração: fichas antigas tinham um único tirosPente global
  if (it.tiros == null) {
    it.tiros = (f.tirosPente != null && f.__migrouArma !== true) ? f.tirosPente : TIROS_POR_PENTE;
    it.tipoPente = it.tipoPente || f.tipoPente || PENTE_PADRAO;
  }
  return { cat, tiros: it.tiros, tipo: it.tipoPente || PENTE_PADRAO };
}
const armasDeFogo = (f) => (f.inventario || []).filter((it) => it.equip && ARMAS.find((w) => w.n === it.nome && w.tipo === "fogo"));

function normalizaPentes(f) {
  let r = f.pentes;
  if (typeof r === "number") r = { padrao: r };
  if (!r || typeof r !== "object") r = { padrao: PENTES_MAX - 1 };
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
        <div class="card-stats"><span>PV <b>${f.pvAtual || 0}</b>/${f.pvMax || 0}</span><span>CD <b>${k.cd}</b></span><span class="sombra-c">RAM <b>${k.ramLivre}</b>/${k.ramMax}</span></div>
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
          const pvP = f.pvMax ? Math.max(0, Math.min(100, 100 * f.pvAtual / f.pvMax)) : 0;
          const ramP = k.ramMax ? Math.max(0, Math.min(100, 100 * k.ramLivre / k.ramMax)) : 0;
          const est = f.pvAtual <= 0 ? "morto" : pvP <= 30 ? "critico" : pvP <= 60 ? "ferido" : "";
          return `<div class="vitais-barras" style="margin-top:14px">
            <div class="vb" data-barra="ficha-pv">
              <div class="vb-topo"><span>❤ Pontos de Vida</span><b class="${est}">${f.pvAtual}<span class="dim">/${f.pvMax}</span></b></div>
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

      ${(f.implantes || []).includes("Tatuagens de Nano-Enxame") ? (() => {
        const formas = ARMAS.filter((a2) => a2.nano);
        const tatuadas = (f.inventario || []).filter((it) => formas.some((x) => x.n === it.nome));
        const grátis = 3;                       // o implante vem com 3 formas; extras custam 250 CG
        const extra = Math.max(0, tatuadas.length - grátis + 1) * 0 + 250;
        return `<section class="sec"><header><span class="tag">🖋</span><h2>Tatuagens de Nano-Enxame</h2>
          <span class="extra">${tatuadas.length} forma(s) tatuada(s)</span></header>
          <p class="regra">O implante vem com <b>3 formas</b> à sua escolha. Cada forma adicional custa
            <b class="chrome">250 CG</b> e um Descanso Longo numa clínica. As formas não podem ser arremessadas,
            largadas nem desarmadas — e o dano sobe nos níveis 5 e 9.</p>
          <div class="nano-grade">${formas.map((w) => {
            const tem = tatuadas.some((it) => it.nome === w.n);
            const custo = tatuadas.length < grátis ? 0 : 250;
            const podePagar = tem || custo === 0 || (f.creditos ?? 0) >= custo;
            return `<button class="nano-op ${tem ? "on" : ""}" data-nano="${esc(w.n)}" ${!tem && !podePagar ? "disabled" : ""}
              title="${esc(w.desc || "")}">
              <b>${esc(w.n.replace("Nano-Tatuagem: ", ""))}</b>
              <span class="nano-dano">${danoArma(w, f.nivel)}</span>
              <span class="regra">${esc(w.kw)} · ${w.attr}</span>
              <span class="nano-acao">${tem ? "✓ tatuada — remover" : custo ? `tatuar · ${custo} CG` : "tatuar (grátis)"}</span>
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
                <span class="dim">reserva (${total}/${PENTES_MAX - 1})</span>
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
        if (it.pente) { const res2 = normalizaPentes(f); const teto = PENTES_MAX - 1;
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
        if (!(await confirmModal(`Remover a tatuagem "${nome.replace("Nano-Tatuagem: ", "")}"?\n\nO enxame é dissolvido. Tatuar de novo custará 250 CG.`, { okLabel: "Remover", perigo: true }))) return;
        f.inventario.splice(ix, 1);
        registrar(`🖋 Tatuagem dissolvida: ${nome.replace("Nano-Tatuagem: ", "")}.`);
      } else {
        const formas = ARMAS.filter((a2) => a2.nano);
        const tatuadas = (f.inventario || []).filter((it) => formas.some((x) => x.n === it.nome));
        const custo = tatuadas.length < 3 ? 0 : 250;
        if (custo && (f.creditos ?? 0) < custo) return alert(`Faltam ${custo - (f.creditos ?? 0)} CG para tatuar mais uma forma.`);
        if (custo) f.creditos = (f.creditos ?? 0) - custo;
        f.inventario.push({ tipo: "arma", nome, equip: false, qtd: 1 });
        registrar(`🖋 Nova forma tatuada: ${nome.replace("Nano-Tatuagem: ", "")}${custo ? ` (−${custo} CG)` : " (inclusa no implante)"}.`);
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
  const [{ data: camp }, { data: membros }, { data: pers }, { data: msgs }] = await Promise.all([
    sb.from("campanhas").select("*").eq("id", id).single(),
    sb.from("campanha_membros").select("perfil_id,posto,perfis(apelido)").eq("campanha_id", id),
    sb.from("personagens").select("id,nome,dono_id,dados").eq("campanha_id", id),
    sb.from("mensagens").select("*,perfis:autor_id(apelido,avatar_url)").eq("campanha_id", id).order("criado_em", { ascending: true }).limit(120),
  ]);
  if (!camp) return (location.hash = "#/campanhas");
  const { data: meus } = await sb.from("personagens").select("id,nome").eq("dono_id", usuario.id);
  // Com mais de um personagem seu na mesma mesa, vale a escolha guardada neste
  // dispositivo; sem escolha, o primeiro. Antes pegava sempre o primeiro e o
  // seletor não trocava nada.
  const chavePers = "ps-pers-" + id;
  const meusNaMesa = () => (pers || []).filter((x) => x.dono_id === usuario.id);
  let meuPers = (() => {
    const meus = meusNaMesa();
    const salvo = localStorage.getItem(chavePers);
    return meus.find((x) => x.id === salvo) || meus[0] || null;
  })();
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
  // O realtime devolve as nossas próprias gravações. Se chegarem enquanto ainda
  // estamos no meio de uma operação, sobrescrevem o estado local e travam o turno.
  let gravandoAte = 0;
  const marcarGravacao = () => { gravandoAte = Date.now() + 1500; };
  const ecoProprio = () => Date.now() < gravandoAte;
  // Toda gravação em `campanhas` passa por aqui, para o eco do realtime ser ignorado.
  const salvarCampanha = (campos) => { marcarGravacao(); return sb.from("campanhas").update(campos); };
  const salvarMapa = async (mapa) => { camp.mapa = mapa; const { error } = await salvarCampanha({ mapa }).eq("id", id); if (error) alert("Não consegui salvar o mapa: " + error.message); };
  if (!camp.combate || typeof camp.combate !== "object" || !("ordem" in camp.combate)) camp.combate = combateVazio();
  const snapshot = (rotulo) => { pilhaUndo.push({ rotulo, combate: JSON.parse(JSON.stringify(camp.combate || {})), nave: JSON.parse(JSON.stringify(camp.nave || null)), combate_nave: JSON.parse(JSON.stringify(camp.combate_nave || {})) }); if (pilhaUndo.length > 10) pilhaUndo.shift(); };
  const salvarCombate = async () => { const { error } = await salvarCampanha({ combate: camp.combate }).eq("id", id); if (error) alert("Não consegui salvar o combate: " + error.message); };
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
    dd.pvAtual = Math.max(0, Math.min(dd.pvMax || 0, antes + delta));
    if (dd.pvAtual === antes) return;
    dd.log = [{ q: new Date().toISOString(), t: `${delta < 0 ? "💥" : "✚"} ${Math.abs(delta)} PV no combate (${antes} → ${dd.pvAtual})` }, ...(dd.log || [])].slice(0, 60);
    await sb.from("personagens").update({ dados: dd }).eq("id", alvo.id);
    alvo.dados = dd;
    if (meuPers && meuPers.id === alvo.id) meuPers.dados = dd;
  };
  if (!Array.isArray(camp.bestiario)) camp.bestiario = [];
  if (!camp.combate_nave || typeof camp.combate_nave !== "object" || !("inimigas" in camp.combate_nave)) camp.combate_nave = combateNaveVazio();
  if (!camp.faccoes || typeof camp.faccoes !== "object") camp.faccoes = {};
  if (!Array.isArray(camp.contratos)) camp.contratos = [];
  if (!camp.handout || typeof camp.handout !== "object") camp.handout = {};
  const salvarBestiario = async () => { const { error } = await salvarCampanha({ bestiario: camp.bestiario }).eq("id", id); if (error) alert("Não consegui salvar o bestiário: " + error.message); };

  const enviar = async (tipo, conteudo, payload = null) => {
    if (asCegas && souMestre && tipo === "rolagem") {   // às cegas: fica só na tela do Mestre
      const p = payload || {};
      await modalForm({ titulo: "🙈 Rolagem às cegas", campos: [
        { k: "i", label: `${p.titulo || "Rolagem"} — ${p.detalhe || ""}${p.total != null ? `  =  ${p.total}` : ""}${p.extra ? "\n" + p.extra : ""}`, tipo: "info" }], okLabel: "Fechar", semCancelar: true });
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
        <div class="topo-status">${esc(camp.nome)} · código <b class="chrome">${camp.codigo}</b></div><span style="display:flex;gap:6px"><button id="atalhos" class="btn-ghost so-desktop" title="Atalhos de teclado (?)">⌨</button><button id="abrir-diario" class="btn-ghost" title="Diário da campanha">📔 DIÁRIO</button>${souMestre ? `<button id="abrir-mestre" class="btn-ghost" title="Tela do Mestre">🎛 MESTRE</button>` : ""}<button id="abrir-mapa" class="btn-ghost" title="Mapa do sistema (compartilhado)">🗺 MAPA</button></span></nav>
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
            ${(camp.nave && camp.combate.naveEmCena) ? (() => { const nt = camp.combate.nave || naveTaticaVazia();
              const defBase = 10 + (camp.nave.manobra || 0);
              const def = nt.evasiva != null ? nt.evasiva : defBase;
              const pc = camp.nave.casco_max ? Math.max(0, 100 * camp.nave.casco / camp.nave.casco_max) : 0;
              const pe = camp.nave.escudos_max ? Math.max(0, 100 * camp.nave.escudos / camp.nave.escudos_max) : 0;
              return `<div class="nave-painel">
                <div class="nave-cab"><b>🚀 ${esc(camp.nave.nome_batismo || camp.nave.modelo)}</b>
                  <span class="nave-def ${nt.evasiva != null ? "evasiva" : ""}" title="${nt.evasiva != null ? "Manobra Evasiva ativa até o próximo turno do piloto" : "Defesa base: 10 + Manobrabilidade"}">Def ${def}${nt.evasiva != null ? " ⟳" : ""}</span></div>
                <div class="nave-barras">
                  <span class="cb-hp" title="Casco"><span class="cb-hp-barra" style="width:${pc}%;background:var(--chrome)"></span><b>${camp.nave.casco}/${camp.nave.casco_max}</b></span>
                  <span class="cb-hp" title="Escudos"><span class="cb-hp-barra" style="width:${pe}%;background:var(--tech)"></span><b>${camp.nave.escudos}/${camp.nave.escudos_max}</b></span>
                </div>
                ${(nt.alinhado || nt.fraqueza) ? `<div class="nave-buffs">${nt.alinhado ? `<span class="buff">🎯 Rota alinhada — próximo tiro com Vantagem</span>` : ""}${nt.fraqueza ? `<span class="buff">🔎 Fraqueza rastreada — próximo acerto +1d6</span>` : ""}</div>` : ""}
                <div class="nave-postos">${POSTOS_ORDEM.map((pk) => { const quem = (membros || []).find((m) => m.posto === pk);
                  const agiu = (camp.combate.agiram || []).includes(pk);
                  const bloq = (camp.combate.avarias || []).some((av) => av.bloqueia === pk);
                  return `<span class="posto ${agiu ? "ok" : ""} ${quem ? "" : "vazio"} ${bloq ? "bloq" : ""}" title="${bloq ? "Posto inacessível por avaria" : quem ? esc(quem.perfis?.apelido || "") : "vago"}">${esc(ESTACOES[pk].n.split(" ")[0])}${bloq ? " ⛔" : agiu ? " ✓" : ""}</span>`; }).join("")}</div>
              </div>`; })() : ""}
            <div class="cb-lista">${camp.combate.ordem.map((c, i) => `
              <div class="cb-linha ${i === camp.combate.turno ? "cb-atual" : ""} ${foraDeCombate(c) ? "cb-morto" : ""} ${ehNave(c) ? "cb-nave" : ""}">
                <span class="cb-ini" title="Iniciativa">${c.ini}</span>
                <span class="cb-nome">${i === camp.combate.turno ? "▶ " : ""}${ehNave(c) ? "🚀 " : ""}${esc(c.nome)}${c.tipo === "inimigo" ? ` <i class="dim">${esc(c.ameaca || "")}</i>` : ""}${ehNave(c) ? ` <i class="dim">Def ${10 + (c.manobra || 0)}</i>` : ""}${(c.cond && c.cond.length) ? `<span class="cb-conds">${c.cond.map((cd) => `<span class="cb-cond ${infoCond(cd.n)?.dano ? "sangra" : ""}" title="${esc(cd.n)} · ${cd.turnos} turno(s)${infoCond(cd.n) ? " — " + esc(infoCond(cd.n).d) : ""}">${infoCond(cd.n)?.ic || "🏷"} ${esc(cd.n)} ${cd.turnos}</span>`).join("")}</span>` : ""}</span>
                <span class="cb-hp" data-barra="${c.id}" title="${ehNave(c) ? "Casco" : "Vida"}"><span class="rastro"></span><span class="cb-hp-barra" style="width:${Math.max(0, Math.min(100, vidaMax(c) ? vidaAtual(c) / vidaMax(c) * 100 : 0))}%;background:${(c.tipo === "inimigo" || c.lado === "inimiga") ? "var(--perigo)" : ehNave(c) ? "var(--chrome)" : "var(--tech)"}"></span><b>${vidaAtual(c)}/${vidaMax(c)}</b></span>${ehNave(c) ? `<span class="cb-hp" title="Escudos"><span class="rastro"></span><span class="cb-hp-barra" style="width:${Math.max(0, Math.min(100, c.escudos_max ? c.escudos / c.escudos_max * 100 : 0))}%;background:var(--tech)"></span><b>${c.escudos}/${c.escudos_max}</b></span>` : ""}
                ${souMestre ? `<span class="cb-acoes">${c.tipo === "inimigo" && c.ataques ? c.ataques.map((atk, ai) => `<button class="cb-atk" data-cb="${c.id}" data-atk="${ai}" title="Rolar: ${esc(atk.n)}">⚔${c.ataques.length > 1 ? ai + 1 : ""}</button>`).join("") : ""}${(ehNave(c) && c.lado === "inimiga") ? `<button class="cb-atk" data-cb-nave="${c.id}" title="Esta nave dispara">⚔</button>` : ""}<button class="cb-dmg" data-cb="${c.id}" data-d="-5">−5</button><button class="cb-dmg" data-cb="${c.id}" data-d="5">+5</button><input class="cb-hpset" data-cb="${c.id}" type="number" value="${vidaAtual(c)}" style="width:46px" title="${ehNave(c) ? "definir Casco" : "definir HP"}"><button class="cb-hpset-lbl cb-cond-add" data-cb="${c.id}" title="Adicionar condição">🏷</button><button class="cb-rm" data-cb="${c.id}" title="remover">✕</button></span>` : ""}
              </div>`).join("")}</div>
            ${(camp.combate.avarias || []).length ? `<div class="avarias">${camp.combate.avarias.map((av, ai) => `<div class="avaria"><b>⚠ ${esc(av.n)}</b> <span class="regra">${esc(av.e)}</span>${souMestre ? `<button class="mini rm" data-av-fix2="${ai}">✔</button>` : ""}</div>`).join("")}</div>` : ""}
            ${camp.combate.ordem.some((x) => x.nave_party) ? `<p class="regra cbn-postos">Postos: ${POSTOS_ORDEM.map((pk) => { const q2 = (membros || []).find((m) => m.posto === pk); const ag = (camp.combate.agiram || []).includes(pk);
              return `<span class="cbn-posto ${ag ? "ok" : ""} ${q2 ? "" : "vazio"}">${esc(ESTACOES[pk].n.split(" ")[0])}${ag ? " ✓" : ""}</span>`; }).join(" ")}</p>` : ""}
            ${(souMestre && camp.nave) ? `<div class="filtros" style="margin-bottom:6px">
              <button id="cb-nave-cena" class="mini ${camp.combate.naveEmCena ? "on" : ""}"
                title="${camp.combate.naveEmCena ? "A nave está em cena: painel, postos e avarias aparecem" : "Traga a nave para a cena em combates espaciais ou de abordagem"}">
                🚀 ${camp.combate.naveEmCena ? "Nave em cena — tirar" : "Trazer a nave para a cena"}</button></div>` : ""}
            ${souMestre ? `<div class="cb-add">
              <select id="cb-quem"><optgroup label="Jogadores">${(pers || []).map((p) => `<option value="j:${p.id}">${esc(p.nome) || "sem nome"}</option>`).join("")}</optgroup>${camp.bestiario.length ? `<optgroup label="Minhas criaturas">${camp.bestiario.map((b, ci) => `<option value="c:${ci}">${esc(b.n)} · ${b.ameaca}</option>`).join("")}</optgroup>` : ""}<optgroup label="Inimigos (bestiário)">${todasCriaturas().map((b, bi) => b.ambiental ? "" : `<option value="e:${bi}">${esc(b.n)} · ${b.ameaca}</option>`).join("")}</optgroup><optgroup label="Naves inimigas">${NAVES.map((n, ni) => `<option value="ni:${ni}">🚀 ${esc(n.n)}</option>`).join("")}</optgroup></select>
              <button id="cb-add-btn" class="mini">🎲 Add</button><button id="cb-criar" class="mini" title="Criar/editar criaturas do Mestre">🐉</button></div>
            <div class="cb-ctrl"><button id="cb-undo" class="mini" title="Desfazer a última ação">↶</button><button id="cb-prox" class="mini eq">▶ Próximo turno</button><button id="cb-timer" class="mini" title="Cronômetro do turno">⏱</button><button id="cb-fim" class="mini rm">⏹ Encerrar</button></div><div id="cb-timer-out" class="cb-timer"></div>` : ""}`}
          </section>` : ""}
          </div>
          <div class="mesa-painel" ${abaMesa === "ficha" ? "" : "hidden"}>
          <section class="sec"><header><span class="tag">◈</span><h2>Meu personagem</h2></header>
            <select id="sel-pers" title="Troque de personagem sem sair da mesa">${meuPers ? "" : `<option value="">— vincular personagem —</option>`}
              ${(meus || []).map((m) => `<option value="${m.id}" ${meuPers?.id === m.id ? "selected" : ""}>${esc(m.nome) || "sem nome"}${m.campanha_id === id ? "" : " (vincular)"}</option>`).join("")}</select>
            ${f ? `${(() => {
              const pvP = f.pvMax ? Math.max(0, Math.min(100, 100 * f.pvAtual / f.pvMax)) : 0;
              const ramP = k.ramMax ? Math.max(0, Math.min(100, 100 * k.ramLivre / k.ramMax)) : 0;
              const est = f.pvAtual <= 0 ? "morto" : pvP <= 30 ? "critico" : pvP <= 60 ? "ferido" : "";
              return `<div class="vitais-barras compacto">
                <div class="vb" data-barra="mesa-pv"><div class="vb-topo"><span>❤ PV</span><b class="${est}">${f.pvAtual}<span class="dim">/${f.pvMax}</span></b></div>
                  <div class="vb-trilho"><span class="rastro"></span><span class="cb-hp-barra vb-fill ${est}" style="width:${pvP}%"></span></div></div>
                <div class="vb" data-barra="mesa-ram"><div class="vb-topo"><span>◈ RAM</span><b class="sombra-c">${k.ramLivre}<span class="dim">/${k.ramMax}</span></b></div>
                  <div class="vb-trilho"><span class="rastro"></span><span class="cb-hp-barra vb-fill ram" style="width:${ramP}%"></span></div></div>
              </div>`; })()}
            <p class="regra">CD ${k.cd} · conj +${k.conj}${f.pvAtual <= 0 ? ` · <b class="perigo-c">☠ inconsciente</b>` : ""}</p>
            ${(() => {
              const res = normalizaPentes(f);
              const totalReserva = Object.values(res).reduce((a2, b2) => a2 + b2, 0);
              const fogo = armasDeFogo(f);
              const reservaHtml = Object.entries(res).filter(([, q]) => q > 0).map(([k, q]) => { const t2 = TIPOS_PENTE[k];
                return `<span class="pente-tipo" title="${esc(t2.n)}: ${esc(t2.d)}" style="border-color:${t2.cor};color:${t2.cor}">${t2.ic} ${q}</span>`; }).join("")
                || `<span class="dim" style="font-size:10px">mochila vazia</span>`;
              if (!fogo.length) return "";
              // Cada arma de fogo tem o próprio pente carregado; a mochila é compartilhada.
              return `<div class="mun-armas">${fogo.map((it) => { const e2 = estadoArma(f, it); if (!e2) return "";
                const tp = TIPOS_PENTE[e2.tipo] || TIPOS_PENTE.padrao;
                const seco = e2.tiros === 0 && totalReserva === 0;
                const nivel = seco ? "vazio" : e2.tiros === 0 ? "critico" : totalReserva === 0 ? "baixo" : "";
                const pips = Array.from({ length: TIROS_POR_PENTE }, (_, i2) => `<i class="pip ${i2 < e2.tiros ? "cheio" : ""}" style="${i2 < e2.tiros ? `background:${tp.cor};border-color:${tp.cor}` : ""}"></i>`).join("");
                return `<div class="municao-box ${nivel}" style="${e2.tipo !== "padrao" ? `border-color:${tp.cor}` : ""}">
                  <div class="municao-cab"><span class="mun-arma-n" title="${esc(it.nome)}">${esc(it.nome.slice(0, 22))}</span>
                    <b style="color:${tp.cor}">${e2.tiros}<span class="dim">/${TIROS_POR_PENTE}</span></b>
                    <button class="mini" data-trocar="${esc(it.nome)}" ${totalReserva <= 0 ? "disabled" : ""}>↻</button></div>
                  <div class="pips">${pips}</div>
                  <p class="municao-msg">${tp.ic} ${esc(tp.n)}${e2.tiros === 0 ? " — <b>pente vazio, troque!</b>" : ""}</p>
                </div>`; }).join("")}</div>
                <div class="mun-mochila"><span class="dim">🎒 mochila (${totalReserva}/${PENTES_MAX - 1})</span>
                  <div class="pentes-reserva">${Object.entries(res).map(([k, q]) => { const t2 = TIPOS_PENTE[k];
                    return `<button class="pente-tipo ${q ? "" : "vazio-tipo"}" data-carregar="${k}" ${q ? "" : "disabled"}
                      title="${esc(t2.n)} — ${esc(t2.d)}" style="border-color:${q ? t2.cor : "var(--line)"};color:${q ? t2.cor : "var(--dim)"}">${t2.ic} ${q}</button>`; }).join("")}</div></div>`;
            })()}
            <div class="acoes-mesa">
              <select id="sel-per">${PERICIAS.map(([pn]) => `<option>${pn}</option>`).join("")}</select>
              <button id="rolar-per" class="mini">TESTE</button>
              ${armasEq.length ? `<label class="chk" style="margin:0" title="Ataque furtivo: +2 no acerto (armas Ocultas / Assassino) e dano DOBRADO para o Assassino."><input type="checkbox" id="atq-furtivo"/> 🥷 Furtivo</label>` : ""}
              ${armasEq.map((a, i) => { const cat = todasArmas().find((x) => x.n === a.nome); const pr = cat ? propsArma(cat) : {};
                const tip = [cat?.kw ? `${cat.kw}: ${pr.efeito}` : "", pr.area ? `Área: ${pr.areaTxt}` : "", pr.alcance ? `Alcance: ${pr.alcanceTxt}` : "", pr.agil ? "Ágil (Des)" : ""].filter(Boolean).join(" · ");
                return `<button class="mini atq" data-atq="${i}" title="${esc(tip)}">⚔ ${esc(a.nome)} (${cat ? danoArma(cat, f.nivel) : "—"})${pr.area ? " ◎" : ""}${pr.agil ? " ⚡" : ""}${pr.aoAcertar?.length ? " 🏷" : ""}${pr.ignoraArmadura ? " 🗡" : ""}</button>`; }).join("")}
              <select id="sel-scr">${(f.deck.length ? SCRIPTS.filter((s) => f.deck.includes(s.n)) : SCRIPTS.filter((s) => s.c === 0)).map((s) => `<option>${esc(s.n)}</option>`).join("")}</select>
              <button id="conjurar" class="mini">⚡ CONJURAR</button>
              ${(() => { const ats = habilidadesAtivas(f);
                return ats.map((h) => { const usada = h.descanso && f.usos?.[h.id];
                  const modo = f.modos?.[h.nome];
                  const resta = f.modosAte?.[h.nome];
                  const op = modo && (h.opcoes?.find((o) => o.n === modo) || { ic: "★", n: h.nome.slice(0, 16), d: "" });
                  return `<button class="mini hab-ativa ${usada ? "gasta" : ""} ${op ? "ligada" : ""}" data-hab-usar="${h.id}"
                    title="${esc(h.origem)} · ${esc(h.d)}${h.descanso ? ` (1×/descanso ${h.descanso})` : ""}${op ? `\nAtivo: ${esc(op.n)} — ${esc(op.d)}` : ""}"
                    ${usada ? "disabled" : ""}>${op ? `${op.ic} ${esc(op.n)}` : `★ ${esc(h.nome.slice(0, 20))}`}${modo && resta && resta < 90 ? ` <b>${resta}t</b>` : ""}${h.descanso ? (usada ? " ✓" : " ⟳") : ""}</button>`; }).join(""); })()}
              ${(f.inventario || []).filter((it) => ehConsumivel(it.nome) && (it.qtd || 1) > 0)
                .map((it) => { const c = ehConsumivel(it.nome);
                  return `<button class="mini item-usa" data-item="${esc(it.nome)}" title="${esc(c.d)} · ${esc(c.acao)}">${c.ic} ${esc(it.nome.replace(/ de Batalha| de Campo| de Nanofibra|Kit de |Granada de |Granada /i, "").slice(0, 16))} <b>×${it.qtd || 1}</b></button>`; }).join("")}
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
              ${souMestre ? `<div class="acoes-mesa"><input id="nave-dano" type="number" placeholder="dano" style="width:70px"/><button id="nave-hit" class="mini dano">💥 NAVE SOFRE</button><button id="nave-upg" class="mini">🔧 Upgrades</button><button id="nave-repar" class="mini eq">🛠 Estaleiro</button></div>` : ""}
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
              return `<div class="pf-linha ${crit}" data-inspect="${x.id}" title="Ver ficha completa">
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
          <div class="barra-acao">
          <div class="rol-toggles"><span class="regra" style="margin:0">Rolagem:</span>
            <button id="tg-vant" class="mini" title="Vantagem: rola 2d20, pega o maior">▲ Vantagem</button>
            <button id="tg-desv" class="mini" title="Desvantagem: rola 2d20, pega o menor">▼ Desvantagem</button>
            <button id="tg-priv" class="mini" title="Privado: só o Mestre e você veem o resultado">🔒 Privado</button>${souMestre ? `<button id="tg-cega" class="mini" title="Às cegas: o resultado aparece só para você, e não entra no chat da mesa">🙈 Às cegas</button>` : ""}
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
      if (m.payload?.privada && m.autor_id !== usuario.id && !souMestre) return; // rolagem privada: só autor + Mestre
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
        if (ehNave(alvo)) { const rn = danoNave(alvo, dano);
          if (alvo.nave_party && camp.nave) { camp.nave.casco = alvo.casco; camp.nave.escudos = alvo.escudos; }
          enviar("sistema", `💥 ${alvo.nome}: escudos −${rn.escudos}, casco −${rn.casco} (${alvo.casco}/${alvo.casco_max}).`);
        } else {
          const antes = alvo.hp;
          alvo.hp = Math.max(0, alvo.hp - dano);
          await sincronizarFicha(alvo, alvo.hp - antes);   // a ficha do jogador acompanha
          enviar("sistema", `💥 ${alvo.nome} sofreu ${dano} de dano (${alvo.hp}/${alvo.hp_max}).`);
        }
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
        dados.pvAtual = Math.max(0, Math.min(dados.pvMax || 0, antes + (m.tipo === "dano" ? -p.valor : p.valor)));
        dados.log = [{ q: new Date().toISOString(), t: `${m.tipo === "dano" ? "💥" : "✚"} ${p.valor} PV — ${esc(p.origem || "mesa")}` }, ...(dados.log || [])].slice(0, 60);
        const { error } = await sb.from("personagens").update({ dados }).eq("id", alvo.id);
        if (error) { bt.disabled = false; return alert("Não consegui aplicar: " + error.message); }
        alvo.dados = dados;                          // mantém o estado local coerente
        if (meuPers && meuPers.id === alvo.id) meuPers.dados = dados;
        await sb.from("mensagens").update({ payload: { ...p, aplicado: true } }).eq("id", m.id);
        m.payload = { ...p, aplicado: true };
        await enviar("sistema", `${alvo.nome}: ${antes} → ${dados.pvAtual} PV${dados.pvAtual <= 0 ? " — CAIU!" : ""}`);
        render();                                    // a ficha e as barras acompanham
      });
      // Descanso convocado pelo Mestre: cada cliente aplica no SEU personagem vinculado.
      // Só ao vivo (aoVivo) para não reaplicar ao recarregar o histórico.
      if (aoVivo && m.tipo === "descanso" && meuPers) {
        (async () => {
          const dados = { ...novaFichaDados(), ...meuPers.dados };
          const r = aplicarDescanso(dados, m.payload?.tipo === "longo" ? "longo" : "curto");
          dados.log = [{ q: new Date().toISOString(), t: `${m.payload?.tipo === "longo" ? "🌙" : "☾"} ${r.notas.join(" · ")}` }, ...(dados.log || [])].slice(0, 60);
          const { error } = await sb.from("personagens").update({ dados }).eq("id", meuPers.id);
          if (!error) { meuPers.dados = dados; await enviar("sistema", `🛌 ${meuPers.nome}: ${r.notas.join(" · ")}.`); render(); }
        })();
      }
      if (aoVivo && m.tipo === "recompensa" && meuPers) {
        (async () => {
          const dados = { ...novaFichaDados(), ...meuPers.dados }; const p = m.payload || {}; const notas = [];
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
            const cabe = Math.max(0, (PENTES_MAX - 1) - antes);
            const ganhou = Math.min(p.pentes, cabe);
            res[tipo] = (res[tipo] || 0) + ganhou;
            dados.pentes = res;
            const tp = TIPOS_PENTE[tipo];
            notas.push(ganhou > 0 ? `+${ganhou} pente ${tp.ic} ${tp.n} (${antes + ganhou}/${PENTES_MAX - 1} na reserva)` : "reserva de pentes já cheia");
          }
          dados.log = [{ q: new Date().toISOString(), t: `🎁 Recompensa do Mestre: ${notas.join(" · ")}` }, ...(dados.log || [])].slice(0, 60);
          const { error } = await sb.from("personagens").update({ dados }).eq("id", meuPers.id);
          if (!error) { meuPers.dados = dados; await enviar("sistema", `🎖 ${meuPers.nome}: ${notas.join(" · ")}${dados.metodoNivel === "xp" && dados.xp >= dados.xpMeta ? " — PRONTO PARA SUBIR!" : ""}`); render(); }
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
        (pl) => { if (ecoProprio()) return;   // é a nossa própria gravação voltando
          camp.nave = pl.new.nave; camp.mapa = pl.new.mapa; camp.combate = pl.new.combate; camp.combate_nave = pl.new.combate_nave || combateNaveVazio(); camp.handout = pl.new.handout || {}; camp.faccoes = pl.new.faccoes || {}; camp.contratos = pl.new.contratos || []; camp.bestiario = pl.new.bestiario || []; mapaCtrl?.atualizar(pl.new.mapa, pl.new.combate); render(); })
      .subscribe();

    // ---- binds ----
    $("#enviar-msg").onclick = () => { const t = $("#msg").value.trim(); if (!t) return; $("#msg").value = "";
      const resp = respondendoA; cancelarResp();
      const rr = /^\/(?:r(?:olar)?)?\s*(.+)$/i.exec(t);
      if (rr) { const r = rolarExpr(rr[1], vantagem); if (r) {
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
      const { error } = await salvarCampanha({ handout: camp.handout }).eq("id", id);
      if (error) return alert("Não consegui compartilhar: " + error.message);
      await enviar("sistema", `🖼 O Mestre mostrou uma imagem${r.titulo ? `: ${r.titulo}` : ""}.`);
      render();
    });
    $("#handout-off")?.addEventListener("click", async () => {
      camp.handout = { ...(camp.handout || {}), visivel: false };
      await salvarCampanha({ handout: camp.handout }).eq("id", id);
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
        const { error } = await salvarCampanha({ nave: c.nave ?? camp.nave, mapa: c.mapa ?? {}, combate: c.combate ?? combateVazio(), bestiario: c.bestiario ?? [] }).eq("id", id);
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
    // Inspetor de personagem: o Mestre precisa ver vida, RAM, armas e scripts
    // de qualquer jogador sem sair da mesa e sem pedir print.
    app.querySelectorAll("[data-inspect]").forEach((el2) => el2.onclick = () => {
      const alvo = (pers || []).find((x) => x.id === el2.dataset.inspect); if (!alvo) return;
      const fx = { ...novaFichaDados(), ...(alvo.dados || {}) }; const kx = calc(fx);
      const pvP = fx.pvMax ? Math.max(0, Math.min(100, 100 * fx.pvAtual / fx.pvMax)) : 0;
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
            <div class="vb"><div class="vb-topo"><span>❤ Vida</span><b class="${est}">${fx.pvAtual}<span class="dim">/${fx.pvMax}</span></b></div>
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
    $("#abrir-mestre")?.addEventListener("click", async () => {
      if (!camp.faccoes || typeof camp.faccoes !== "object") camp.faccoes = {};
      if (!Array.isArray(camp.contratos)) camp.contratos = [];
      const { data: nota } = await sb.from("mestre_notas").select("texto").eq("campanha_id", id).maybeSingle();
      let notaTxt = nota?.texto || "";
      const ov = document.createElement("div"); ov.className = "ss-overlay ov-modal"; ov.style.zIndex = "10000";
      const abas = [["mesa", "🎬 Mesa"], ["ref", "📖 Referência"], ["tab", "🎲 Tabelas"], ["enc", "⚖ Encontros"], ["fac", "🏛 Facções"], ["con", "📋 Contratos"], ["lin", "🕰 Linha do tempo"], ["not", "📝 Anotações"]];
      let abaAtiva = "mesa";
      const salvarCamp = async (campos) => { const { error } = await salvarCampanha(campos).eq("id", id); if (error) alert("Não consegui salvar: " + error.message); };

      const painelMesa = () => `
        <div class="det grande"><b>☾ Descansos</b>
          <p class="regra">Convoca um descanso para toda a mesa. Cada jogador conectado com personagem vinculado recupera na própria ficha.</p>
          <div class="filtros"><button id="mestre-curto" class="mini">☾ Curto (1h)</button><button id="mestre-longo" class="mini eq">🌙 Longo (8h)</button></div></div>
        <div class="det grande"><b>🎁 Recompensas</b>
          <p class="regra">Distribui para todos os jogadores conectados, direto nas fichas.</p>
          <div class="filtros"><button id="mestre-xp" class="mini">🎖 Conceder XP</button><button id="mestre-cg" class="mini">🎁 Conceder Créditos</button><button id="mestre-mun" class="mini">🔫 Conceder pentes</button><button id="mestre-loot" class="mini">🎁 Conceder equipamento</button><button id="mestre-item" class="mini">🎁 Conceder item</button></div></div>
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

      const avisaFac = () => localStorage.getItem("ps-fac-aviso") !== "0";
      const painelFac = () => `<p class="regra">Ajuste a relação da tripulação com cada facção. Os jogadores veem a reputação, mas não as suas anotações.</p>
        <label class="fac-flag"><input type="checkbox" id="fac-aviso" ${avisaFac() ? "checked" : ""}/> <span>Anunciar mudanças no chat da mesa</span></label>`
        + FACCOES.map((f) => { const v = camp.faccoes[f.n] ?? 0; const nv = NIVEIS_REPUTACAO.find((x) => x.v === v) || NIVEIS_REPUTACAO[3];
          const pct = ((v + 3) / 6) * 100;
          return `<div class="det grande fac-card" data-card="${esc(f.n)}" style="border-left:3px solid ${f.cor}">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <b>${esc(f.n)}</b><span class="best-tag fac-selo" style="color:${nv.cor};border-color:${nv.cor}">${esc(nv.n)}</span></div>
            <p class="regra">${esc(f.sede)} · ${esc(f.d)}</p>
            <div class="fac-escala"><span class="fac-trilho"><i class="fac-fill" style="width:${pct}%;background:${nv.cor}"></i></span>
              <span class="fac-pontas"><span>Caçado</span><span>Neutro</span><span>Irmão de Sangue</span></span></div>
            <div class="filtros"><button class="mini" data-fac="${esc(f.n)}" data-d="-1" title="Piorar a relação">−</button>
              <input type="range" min="-3" max="3" value="${v}" data-facr="${esc(f.n)}" style="flex:1"/>
              <button class="mini" data-fac="${esc(f.n)}" data-d="1" title="Melhorar a relação">+</button></div>
            <p class="regra fac-desc"><i>${esc(nv.d)}</i></p></div>`; }).join("");

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
        liga("mestre-longo", async () => {
          if (!(await confirmModal("Convocar Descanso Longo para toda a mesa? PV restaurados, RAM recarregada, pentes repostos e todas as habilidades reiniciadas. A tripulação também aproveita para mexer no casco.", { okLabel: "Convocar" }))) return;
          await enviar("descanso", "O Mestre convocou um Descanso Longo (8h). PV restaurados, RAM recarregada e todas as habilidades reiniciadas.", { tipo: "longo" });
          if (camp.nave && camp.nave.casco < camp.nave.casco_max) {   // 8h dão tempo de remendar o casco
            const rep = d(10) + 5;
            camp.nave.casco = Math.min(camp.nave.casco_max, camp.nave.casco + rep);
            camp.nave.escudos = camp.nave.escudos_max;
            const cbn3 = camp.combate?.ordem?.find((x) => x.nave_party);
            if (cbn3) { cbn3.casco = camp.nave.casco; cbn3.escudos = camp.nave.escudos; }
            await salvarCampanha({ nave: camp.nave, ...(camp.combate ? { combate: camp.combate } : {}) }).eq("id", id);
            await enviar("sistema", `🔧 Manutenção de bordo no descanso: +${rep} de casco (${camp.nave.casco}/${camp.nave.casco_max}) e escudos recalibrados.`);
          }
          fechar();
        });
        liga("mestre-xp", async () => { const r = await modalForm({ titulo: "🎖 Conceder XP", campos: [{ k: "n", label: "XP para toda a tripulação conectada", tipo: "numero", valor: 500 }], okLabel: "Conceder" }); if (!r || !(+r.n > 0)) return; enviar("recompensa", `O Mestre concedeu ${+r.n} XP à tripulação.`, { xp: +r.n }); fechar(); });
        liga("mestre-cg", async () => { const r = await modalForm({ titulo: "🎁 Conceder Créditos", campos: [{ k: "n", label: "CG para toda a tripulação conectada", tipo: "numero", valor: 1000 }], okLabel: "Conceder" }); if (!r || !(+r.n > 0)) return; enviar("recompensa", `O Mestre distribuiu ${+r.n} CG de saque à tripulação.`, { creditos: +r.n }); fechar(); });
        liga("mestre-item", async () => {
          const cat = await modalForm({ titulo: "🎁 Conceder item", descricao: "Saque distribuído a toda a tripulação conectada. Vai direto para o inventário.",
            campos: [{ k: "tipo", label: "Tipo", tipo: "select", opcoes: [
              { v: "arma", l: "⚔ Arma" }, { v: "armadura", l: "🛡 Armadura" }, { v: "consumivel", l: "🎒 Consumível" }] }], okLabel: "Escolher" });
          if (!cat) return;
          const lista = cat.tipo === "arma" ? ARMAS.map((x) => x.n)
            : cat.tipo === "armadura" ? ARMADURAS.map((x) => x.n) : CONSUMIVEIS.map((x) => x.n);
          const r = await modalForm({ titulo: "🎁 Conceder item", campos: [
            { k: "nome", label: "Item", tipo: "select", opcoes: lista },
            { k: "qtd", label: "Quantidade", tipo: "numero", valor: 1, min: 1, max: 10 },
          ], okLabel: "Distribuir" });
          if (!r?.nome) return;
          enviar("recompensa", `O Mestre distribuiu ${+r.qtd > 1 ? `${r.qtd}× ` : ""}${r.nome} à tripulação.`,
            { item: { nome: r.nome, tipo: cat.tipo === "consumivel" ? "item" : cat.tipo, qtd: +r.qtd || 1 } });
          fechar();
        });
        liga("mestre-loot", async () => {
          const cats = [
            ["arma", "⚔ Arma", ARMAS.filter((x) => x.preco || x.nano)],
            ["armadura", "🛡 Armadura", ARMADURAS],
            ["item", "🎒 Consumível", CONSUMIVEIS.map((c) => ({ n: c.n, preco: c.p }))],
            ["implante", "⧉ Implante", IMPLANTES.map((i2) => ({ n: i2.n, preco: i2.p }))],
          ];
          const r = await modalForm({ titulo: "🎁 Conceder equipamento",
            descricao: "Saque de um corpo, achado num contêiner ou presente de um contato. Vai direto para a ficha de cada tripulante conectado.",
            campos: [
              { k: "cat", label: "Categoria", tipo: "select", opcoes: cats.map(([v, l]) => ({ v, l })) },
              { k: "item", label: "Item (digite o nome exato ou escolha depois)", tipo: "texto" },
              { k: "qtd", label: "Quantidade", tipo: "numero", valor: 1, min: 1, max: 20 },
            ], okLabel: "Continuar" });
          if (!r) return;
          const lista = (cats.find(([v]) => v === r.cat) || [])[2] || [];
          let nome = (r.item || "").trim();
          if (!nome || !lista.some((x) => x.n === nome)) {
            const filtrada = nome ? lista.filter((x) => x.n.toLowerCase().includes(nome.toLowerCase())) : lista;
            if (!filtrada.length) return alert("Nenhum item encontrado com esse nome.");
            const r2 = await modalForm({ titulo: "🎁 Escolher item",
              campos: [{ k: "n", label: `${filtrada.length} opção(ões)`, tipo: "select",
                opcoes: filtrada.slice(0, 60).map((x) => ({ v: x.n, l: `${x.n}${x.preco ? ` — ${x.preco} CG` : ""}` })) }], okLabel: "Distribuir" });
            if (!r2?.n) return; nome = r2.n;
          }
          const qtd = Math.max(1, +r.qtd || 1);
          enviar("recompensa", `O Mestre distribuiu ${qtd > 1 ? `${qtd}× ` : ""}${nome} à tripulação.`,
            { loot: { nome, tipo: r.cat, qtd } });
          fechar();
        });
        liga("mestre-mun", async () => {
          const r = await modalForm({ titulo: "🔫 Conceder pentes",
            descricao: `Munição de saque. Vai para a reserva de cada tripulante conectado (teto de ${PENTES_MAX - 1} pentes).`,
            campos: [
              { k: "tipo", label: "Tipo de munição", tipo: "select", opcoes: Object.entries(TIPOS_PENTE).map(([k2, t2]) => ({ v: k2, l: `${t2.ic} ${t2.n} — ${t2.d}` })) },
              { k: "n", label: "Quantos pentes", tipo: "numero", valor: 1, min: 1, max: PENTES_MAX - 1 },
            ], okLabel: "Distribuir" });
          if (!r || !(+r.n > 0)) return;
          const tp = TIPOS_PENTE[r.tipo] || TIPOS_PENTE.padrao;
          enviar("recompensa", `O Mestre distribuiu ${+r.n} pente${+r.n > 1 ? "s" : ""} ${tp.ic} ${tp.n} à tripulação.`, { pentes: +r.n, tipoPente: r.tipo });
          fechar();
        });
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
        ov.querySelector("#fac-aviso") && (ov.querySelector("#fac-aviso").onchange = (e) => {
          localStorage.setItem("ps-fac-aviso", e.target.checked ? "1" : "0");
        });
        // Atualiza só o cartão alterado: redesenhar o painel inteiro fazia a tela
        // piscar e voltar para o topo no meio do ajuste.
        const aplicarFac = async (nome, valor, anterior) => {
          const v = Math.max(-3, Math.min(3, valor));
          camp.faccoes[nome] = v;
          const nv = NIVEIS_REPUTACAO.find((x) => x.v === v) || NIVEIS_REPUTACAO[3];
          const card = ov.querySelector(`[data-card="${CSS.escape(nome)}"]`);
          if (card) {
            const selo = card.querySelector(".fac-selo");
            selo.textContent = nv.n; selo.style.color = nv.cor; selo.style.borderColor = nv.cor;
            const fill = card.querySelector(".fac-fill");
            fill.style.width = `${((v + 3) / 6) * 100}%`; fill.style.background = nv.cor;
            card.querySelector(".fac-desc").innerHTML = `<i>${esc(nv.d)}</i>`;
            const range = card.querySelector("[data-facr]"); if (range) range.value = v;
            const dir = v > anterior ? "sobe" : v < anterior ? "desce" : "";
            if (dir) { card.classList.remove("sobe", "desce"); void card.offsetWidth; card.classList.add(dir);
              setTimeout(() => card.classList.remove(dir), 900); }
          }
          await salvarCamp({ faccoes: camp.faccoes });
          if (v !== anterior && avisaFac()) {
            const seta = v > anterior ? "▲" : "▼";
            await enviar("sistema", `🏛 ${seta} Reputação com ${nome}: agora ${nv.n}. ${nv.d}`);
          }
        };
        ov.querySelectorAll("[data-fac]").forEach((b) => b.onclick = () => {
          const n = b.dataset.fac; const antes = camp.faccoes[n] ?? 0;
          aplicarFac(n, antes + (+b.dataset.d), antes);
        });
        ov.querySelectorAll("[data-facr]").forEach((r) => {
          r.oninput = () => {                                  // resposta imediata ao arrastar
            const nv = NIVEIS_REPUTACAO.find((x) => x.v === +r.value) || NIVEIS_REPUTACAO[3];
            const card = r.closest(".fac-card");
            card.querySelector(".fac-fill").style.width = `${((+r.value + 3) / 6) * 100}%`;
            card.querySelector(".fac-fill").style.background = nv.cor;
            const selo = card.querySelector(".fac-selo");
            selo.textContent = nv.n; selo.style.color = nv.cor; selo.style.borderColor = nv.cor;
          };
          r.onchange = () => { const n = r.dataset.facr; const antes = camp.faccoes[n] ?? 0; aplicarFac(n, +r.value, antes); };
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
    if (!recapFeita) { recapFeita = true; setTimeout(() => recapitular().catch(() => {}), 900); }

    $("#atalhos")?.addEventListener("click", mostrarAtalhos);
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
    $("#cb-nave-cena")?.addEventListener("click", async () => {
      camp.combate.naveEmCena = !camp.combate.naveEmCena;
      await salvarCombate();
      await enviar("sistema", camp.combate.naveEmCena
        ? `🚀 ${camp.nave.nome_batismo || camp.nave.modelo} entra em cena. Postos de batalha!`
        : `🚀 A nave sai de cena — o combate segue em terra.`);
      render();
    });
    $("#cb-undo")?.addEventListener("click", async () => {
      const snap = pilhaUndo.pop();
      if (!snap) return alert("Nada para desfazer nesta sessão.");
      camp.combate = snap.combate; camp.combate_nave = snap.combate_nave; if (snap.nave) camp.nave = snap.nave;
      await salvarCampanha({ combate: camp.combate, combate_nave: camp.combate_nave, ...(snap.nave ? { nave: camp.nave } : {}) }).eq("id", id);
      await enviar("sistema", `↶ O Mestre desfez: ${snap.rotulo}.`); render();
    });
    $("#cb-fim")?.addEventListener("click", async () => { if (confirm("Encerrar o combate e limpar a ordem?")) { camp.combate = combateVazio(); await salvarCombate(); render(); } });
    app.querySelectorAll("[data-cb-nave]").forEach((b) => b.onclick = async () => {
      const atc = camp.combate.ordem.find((x) => x.id === b.dataset.cbNave); if (!atc) return;
      // Sem a nave da tripulação em cena, a nave inimiga atira em quem está no chão.
      if (!camp.nave || !camp.combate.naveEmCena) {
        const alvos = camp.combate.ordem.filter((x) => !ehNave(x) && !foraDeCombate(x));
        if (!alvos.length) return alert("Não há alvos em campo.");
        const r0 = await modalForm({ titulo: `🚀 ${atc.nome} dispara`, descricao: "A nossa nave não está em cena — escolha quem leva o tiro.",
          campos: [{ k: "alvo", label: "Alvo", tipo: "select", opcoes: alvos.map((x) => ({ v: x.id, l: `${x.nome} (${x.hp}/${x.hp_max})` })) }], okLabel: "Disparar" });
        if (!r0?.alvo) return;
        const alvoP = camp.combate.ordem.find((x) => x.id === r0.alvo);
        snapshot("disparo de nave em pessoa");
        const natP = d(20), totalP = natP + 4;
        if (natP === 1 || totalP < (alvoP.cd || 10)) return enviar("rolagem", null, { titulo: `🚀 ${atc.nome} dispara em ${alvoP.nome}`, detalhe: `d20 [${natP}] +4 vs CD ${alvoP.cd || 10}`, total: totalP, fumble: natP === 1, extra: "Errou." });
        const pdP = parseDice(atc.dano); const ddP = rollNd(pdP.n, pdP.f);
        const brutoP = ddP.reduce((x, y) => x + y, 0);
        const antesP = alvoP.hp;
        alvoP.hp = Math.max(0, alvoP.hp - brutoP);
        await sincronizarFicha(alvoP, alvoP.hp - antesP);
        await salvarCombate();
        return enviar("rolagem", null, { titulo: `🚀 ${atc.nome} dispara em ${alvoP.nome}`, detalhe: `d20 [${natP}] +4 · ${atc.dano} [${ddP.join(", ")}]`, total: totalP, extra: `${alvoP.nome}: ${antesP} → ${alvoP.hp} PV.${alvoP.hp <= 0 ? " 💀 CAIU!" : ""}` });
      }
      const alvo = { nome: camp.nave.nome_batismo || camp.nave.modelo, casco: camp.nave.casco, casco_max: camp.nave.casco_max, escudos: camp.nave.escudos, escudos_max: camp.nave.escudos_max, manobra: camp.nave.manobra, nave_party: true };
      snapshot("disparo de nave inimiga");
      const ntx = camp.combate.nave || naveTaticaVazia();
      const nat = d(20), total = nat + 4, def = ntx.evasiva != null ? ntx.evasiva : 10 + (alvo.manobra || 0);
      if (nat === 1 || total < def) return enviar("rolagem", null, { titulo: `🚀 ${atc.nome} dispara`, detalhe: `d20 [${nat}] +4 vs Defesa ${def}`, total, fumble: nat === 1, extra: "Errou." });
      const pd = parseDice(atc.dano); const dd = rollNd(pd.n * (nat === 20 ? 2 : 1), pd.f);
      const bruto = dd.reduce((x, y) => x + y, 0) + pd.mod;
      const r = danoNave(alvo, bruto);
      let extra = `Escudos −${r.escudos}, Casco −${r.casco}. ${alvo.nome}: ${alvo.casco}/${alvo.casco_max}`;
      if ((nat === 20 || r.critico) && r.casco > 0) { const av = rolarAvaria(); (camp.combate.avarias = camp.combate.avarias || []).push(av); extra += `  ⚠ ${av.n}: ${av.e}`; }
      if (alvo.casco <= 0) extra += "  💀 Casco a zero!";
      if (alvo.nave_party && camp.nave) { camp.nave.casco = alvo.casco; camp.nave.escudos = alvo.escudos; }
      await salvarCampanha({ combate: camp.combate, ...(alvo.nave_party && camp.nave ? { nave: camp.nave } : {}) }).eq("id", id);
      await enviar("rolagem", null, { titulo: `🚀 ${atc.nome} dispara`, detalhe: `d20 [${nat}] +4 vs Def ${def} · dano ${atc.dano} [${dd.join(", ")}]${nat === 20 ? " ×2" : ""}`, total, crit: nat === 20, extra });
      render();
    });
    app.querySelectorAll("[data-av-fix2]").forEach((b) => b.onclick = async () => {
      const av = (camp.combate.avarias || []).splice(+b.dataset.avFix2, 1)[0];
      await salvarCombate(); await enviar("sistema", `🔧 Avaria reparada: ${av?.n}.`); render();
    });
    app.querySelectorAll(".cb-cond-add").forEach((b) => b.onclick = async () => {
      const c = cbFind(b.dataset.cb); if (!c) return;
      const r = await modalForm({ titulo: `🏷 Condição — ${c.nome}`,
        descricao: "As condições com dano ferem sozinhas no início do turno do afetado e já descontam da ficha.",
        campos: [
          { k: "cond", label: "Condição", tipo: "select", opcoes: CONDICOES_INFO.map((x) => ({ v: x.n, l: `${x.ic} ${x.n}${x.dano ? ` (${x.dano}/turno)` : ""} — ${x.d}` })) },
          { k: "turnos", label: "Duração (turnos)", tipo: "numero", valor: 2, min: 1, max: 20 },
        ], okLabel: "Aplicar" });
      if (!r || !r.cond) return;
      snapshot("aplicar condição");
      if (!c.cond) c.cond = [];
      const ja = c.cond.find((x) => x.n === r.cond);
      if (ja) ja.turnos = Math.max(ja.turnos, +r.turnos || 1); else c.cond.push({ n: r.cond, turnos: +r.turnos || 1 });
      const inf = infoCond(r.cond);
      await enviar("sistema", `${inf?.ic || "🏷"} ${c.nome} está ${r.cond} por ${r.turnos} turno(s).${inf?.dano ? ` Sofrerá ${inf.dano} no início de cada turno.` : ""}`);
      await salvarCombate(); render();
    });
    $("#cb-prox")?.addEventListener("click", async () => { let salvarNaveJunto = false; const rodAntes = camp.combate.rodada; proximoTurno(camp.combate); if (camp.combate.rodada !== rodAntes) camp.combate.agiram = []; const atual = camp.combate.ordem[camp.combate.turno];
      // Modos temporários dos jogadores (Êxtase, Endurecer, Fúria, gás do Ven'y)
      // contam para baixo a cada rodada e expiram sozinhos.
      if (camp.combate.rodada !== rodAntes) {
        for (const p2 of pers || []) {
          const dd2 = p2.dados || {}; const ate = { ...(dd2.modosAte || {}) };
          if (!Object.keys(ate).length) continue;
          const modos = { ...(dd2.modos || {}) }; const expiraram = [];
          for (const [nome, t] of Object.entries(ate)) {
            const novo = t - 1;
            if (novo <= 0) { delete ate[nome]; delete modos[nome]; expiraram.push(nome); }
            else ate[nome] = novo;
          }
          if (expiraram.length || JSON.stringify(ate) !== JSON.stringify(dd2.modosAte)) {
            p2.dados = { ...dd2, modos, modosAte: ate };
            await sb.from("personagens").update({ dados: p2.dados }).eq("id", p2.id);
            if (meuPers && meuPers.id === p2.id) meuPers.dados = p2.dados;
            for (const nome of expiraram) await enviar("sistema", `⌛ ${p2.nome}: ${nome} acabou.`);
          }
        }
      }
      if (atual) {
        // A Manobra Evasiva vale "até o próximo turno do piloto" — aqui ela expira.
        const ntv = camp.combate.nave || naveTaticaVazia();
        if (ntv.evasiva != null && atual.personagem_id && atual.personagem_id === ntv.evasivaDe) {
          ntv.evasiva = null; ntv.evasivaDe = null;
          await enviar("sistema", `🚀 A Manobra Evasiva se esgota: a Defesa da nave volta ao normal.`);
        }
        // 0) Efeitos automáticos da própria criatura (regeneração, auras, invocações)
        if (atual.habs?.some((h) => h.efeito)) {
          const M = await criaturaMod();
          const cr = M.criar(atual, rolarTexto);
          for (const r of cr.disparar(M.GATILHOS.INICIO_TURNO)) {
            if (r.tipo === "cura") { atual.hp = Math.min(atual.hp_max, (atual.hp || 0) + r.valor);
              await enviar("sistema", `♻ ${atual.nome} — ${r.habilidade}: ${r.texto} (${atual.hp}/${atual.hp_max}).`); }
            else if (r.tipo === "invocar") await enviar("sistema", `👹 ${atual.nome} — ${r.habilidade}: ${r.texto}. O Mestre adiciona ao rastreador.`);
            else if (r.tipo === "dano") { atual.hp = Math.max(0, (atual.hp || 0) - r.valor);
              await enviar("sistema", `☠ ${atual.nome} — ${r.habilidade}: ${r.texto}.`); }
          }
        }
        // 1) Condições que ferem: rolam o dano no início do turno do afetado
        let totalDano = 0; const detalhes = [];
        for (const cd of (atual.cond || [])) {
          const info = infoCond(cd.n); if (!info?.dano) continue;
          const pdc = parseDice(info.dano); const dds = rollNd(pdc.n, pdc.f);
          const v = dds.reduce((x, y) => x + y, 0) + pdc.mod;
          totalDano += v; detalhes.push(`${info.ic} ${cd.n} ${info.dano} [${dds.join(", ")}] = ${v}`);
        }
        if (totalDano > 0) {
          if (ehNave(atual)) { danoNave(atual, totalDano); if (atual.nave_party && camp.nave) { camp.nave.casco = atual.casco; camp.nave.escudos = atual.escudos; salvarNaveJunto = true; } }
          else atual.hp = Math.max(0, (atual.hp || 0) - totalDano);
          // sensibiliza a ficha do jogador, se for um personagem vinculado
          if (atual.personagem_id) {
            const alvoP = (pers || []).find((x) => x.id === atual.personagem_id);
            if (alvoP) { const dd = { ...novaFichaDados(), ...alvoP.dados };
              dd.pvAtual = Math.max(0, (dd.pvAtual || 0) - totalDano);
              dd.log = [{ q: new Date().toISOString(), t: `☠ ${detalhes.join(" · ")} → −${totalDano} PV` }, ...(dd.log || [])].slice(0, 60);
              await sb.from("personagens").update({ dados: dd }).eq("id", alvoP.id); alvoP.dados = dd;
            }
          }
          await enviar("sistema", `☠ ${atual.nome} sofre ${totalDano} de dano por condição — ${detalhes.join(" · ")}. Agora ${vidaAtual(atual)}/${vidaMax(atual)}.`);
          if (foraDeCombate(atual)) await enviar("sistema", `💀 ${atual.nome} caiu por efeito de condição.`);
        }
        // 2) Contadores decrementam; as que expiram somem
        if (atual.cond && atual.cond.length) { const expiradas = [];
          atual.cond = atual.cond.filter((cd) => { cd.turnos -= 1; if (cd.turnos <= 0) { expiradas.push(cd.n); return false; } return true; });
          if (expiradas.length) await enviar("sistema", `✔ ${atual.nome}: acabou ${expiradas.join(", ")}.`);
        }
        const impedido = (atual.cond || []).some((cd) => /atordoado|paralisado/i.test(cd.n));
        await enviar("sistema", `⚔ Rodada ${camp.combate.rodada} · vez de ${atual.nome}${atual.cond && atual.cond.length ? ` (${atual.cond.map((x) => `${infoCond(x.n)?.ic || ""}${x.n}`).join(", ")})` : ""}${impedido ? " — não pode agir neste turno!" : ""}.`);
      }
      // Gravação única: escrever em campanhas no meio do handler dispara o realtime,
      // que sobrescreveria camp.combate com o estado antigo e travaria o turno.
      const campos = { combate: camp.combate }; if (salvarNaveJunto) campos.nave = camp.nave;
      const { error: errProx } = await salvarCampanha(campos).eq("id", id);
      if (errProx) alert("Não consegui salvar o turno: " + errProx.message);
      render(); });
    $("#cb-add-btn")?.addEventListener("click", async () => {
      const v = $("#cb-quem").value; if (!v) return;
      if (v.startsWith("j:")) { const p = (pers || []).find((x) => x.id === v.slice(2)); if (!p) return;
        const kk = calc({ ...novaFichaDados(), ...p.dados }); const nome = p.nome || "Tripulante";
        camp.combate.ordem.push({ id: cbId(), nome, ini: d(20) + kk.iniciativa, hp: p.dados.pvAtual ?? kk.attr.Con, hp_max: p.dados.pvMax || 1, cd: kk.cd, tipo: "jogador", personagem_id: p.id });
      } else if (v.startsWith("ni:")) {
        const base = NAVES[+v.slice(3)]; if (!base) return;
        const iguais = camp.combate.ordem.filter((x) => x.modelo === base.n).length;
        camp.combate.ordem.push({ id: cbId(), tipo: "nave", lado: "inimiga", modelo: base.n,
          nome: iguais ? `${base.n} #${iguais + 1}` : base.n, ini: d(20) + (base.manobra || 0),
          casco: base.casco, casco_max: base.casco, escudos: base.escudos, escudos_max: base.escudos,
          manobra: base.manobra, dano: base.dano });
      } else { const b = v.startsWith("c:") ? camp.bestiario[+v.slice(2)] : todasCriaturas()[+v.slice(2)]; if (!b) return;
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
        if (c.nave_party && camp.nave) { camp.nave.casco = c.casco; camp.nave.escudos = c.escudos; await salvarCampanha({ nave: camp.nave }).eq("id", id); }
      } else {
        c.hp = Math.max(0, Math.min(c.hp_max, c.hp + delta));
        await sincronizarFicha(c, delta);
        if (delta < 0 && c.habs?.some((h) => h.efeito)) {   // reações automáticas ao sofrer dano
          const M = await criaturaMod(); const cr = M.criar(c, rolarTexto);
          for (const r of [...cr.disparar(M.GATILHOS.AO_SOFRER), ...cr.disparar(M.GATILHOS.AO_SOFRER_CORPO)])
            await enviar("sistema", `⚡ ${c.nome} — ${r.habilidade}: ${r.texto} em ${r.alvo === "atacante" ? "quem a atingiu" : "alvo"}.`);
        }
      }
      await salvarCombate(); render();
      avisar(`${c.nome}: ${delta < 0 ? `−${-delta}` : `+${delta}`} ${ehNave(c) ? "no casco/escudos" : "de PV"}`, async () => {
        const snap = pilhaUndo.pop(); if (!snap) return;
        camp.combate = snap.combate; camp.combate_nave = snap.combate_nave; if (snap.nave) camp.nave = snap.nave;
        await salvarCampanha({ combate: camp.combate, ...(snap.nave ? { nave: camp.nave } : {}) }).eq("id", id); render();
      }); });
    app.querySelectorAll(".cb-hpset").forEach((i) => i.onchange = async () => { const c = cbFind(i.dataset.cb); if (!c) return; if (ehNave(c)) { c.casco = Math.max(0, Math.min(c.casco_max, +i.value || 0)); if (c.nave_party && camp.nave) { camp.nave.casco = c.casco; await salvarCampanha({ nave: camp.nave }).eq("id", id); } }
      else { const pvA = c.hp; c.hp = Math.max(0, Math.min(c.hp_max, +i.value || 0)); await sincronizarFicha(c, c.hp - pvA); }
      await salvarCombate(); render(); });
    app.querySelectorAll(".cb-rm").forEach((b) => b.onclick = async () => { const idx = camp.combate.ordem.findIndex((x) => x.id === b.dataset.cb); if (idx < 0) return; snapshot("remover combatente");
      const nomeRm = camp.combate.ordem[idx]?.nome || "combatente";
      camp.combate.ordem.splice(idx, 1); if (camp.combate.turno >= camp.combate.ordem.length) camp.combate.turno = 0;
      await salvarCombate(); render();
      avisar(`${nomeRm} saiu do combate`, async () => {
        const snap = pilhaUndo.pop(); if (!snap) return;
        camp.combate = snap.combate; await salvarCombate(); render();
      }); });
    $("#sel-pers").onchange = async (e) => {
      const pid = e.target.value; if (!pid) return;
      const escolhido = (pers || []).find((x) => x.id === pid);
      if (escolhido && escolhido.campanha_id === id) {
        // já está na mesa: é só troca de personagem ativo, sem recarregar a página
        localStorage.setItem(chavePers, pid);
        meuPers = escolhido;
        await enviar("sistema", `◈ ${(perfil?.apelido) || "Alguém"} agora joga como ${escolhido.nome || "sem nome"}.`);
        return render();
      }
      await sb.from("personagens").update({ campanha_id: id }).eq("id", pid);
      localStorage.setItem(chavePers, pid);
      location.reload();
    };
    if (f) {
      $("#rolar-per").onclick = () => { const pn = $("#sel-per").value; const at = PERICIAS.find(([x]) => x === pn)[1];
        rolarEEnviar(`Teste de ${pn}`, k.attr[at] + k.per[pn]); };
      app.querySelectorAll("[data-atq]").forEach((b) => b.onclick = async () => {
        const a = armasEq[+b.dataset.atq];
        const itemInv = (meuPers.dados.inventario || []).find((x) => x.nome === a.nome && x.equip);
        const catBase = todasArmas().find((x) => x.n === a.nome);
        const cat = armaMontada(catBase, itemInv);
        if (!cat) return alert(`Não encontrei "${a.nome}" no arsenal. Se a arma foi renomeada na administração, reequipe-a na ficha.`);
        const pr = propsArma(cat);
        let precisaRender = false;
        const custo = custoTiro(cat);
        if (custo > 0) {
          const dd0 = meuPers.dados || {};
          const inv0 = dd0.inventario || [];
          const idxArma = inv0.findIndex((x) => x.nome === a.nome && x.equip);
          const itArma = idxArma >= 0 ? inv0[idxArma] : null;
          const est = itArma ? estadoArma(dd0, itArma) : null;
          const noCano = est ? est.tiros : (dd0.tirosPente ?? TIROS_POR_PENTE);
          const capacidade = capacidadePente(armaMontada(catBase, itArma));
          const reserva = Object.values(normalizaPentes(dd0)).reduce((x, y) => x + y, 0);
          if (noCano < custo) {
            const falta = reserva > 0
              ? `o pente de ${a.nome} está vazio. Gaste a Ação de Movimento para trocar (${reserva} pente${reserva > 1 ? "s" : ""} na mochila).`
              : `${a.nome} está sem munição e não há pentes na mochila. Só um saque ou um descanso resolve.`;
            await enviar("sistema", `🔫 ${meuPers.nome} puxa o gatilho e ouve o clique: ${falta}`);
            return render();
          }
          // O pente carregado pertence à ARMA: duas armas gastam munição em separado.
          if (itArma) {
            const inv = inv0.map((x, i2) => i2 === idxArma ? { ...x, tiros: noCano - custo, tipoPente: est.tipo } : x);
            meuPers.dados = { ...dd0, inventario: inv, __migrouArma: true };
            f.inventario = inv;
          } else {
            f.tirosPente = noCano - custo;
            meuPers.dados = { ...dd0, tirosPente: f.tirosPente };
          }
          await sb.from("personagens").update({ dados: meuPers.dados }).eq("id", meuPers.id);
          precisaRender = true;
        }
        // Alvos possíveis: naves inimigas em campo entram na escolha, porque uma
        // tripulação pode muito bem atirar no casco de quem está do outro lado.
        const navesAlvo = (camp.combate?.ativo ? camp.combate.ordem : []).filter((x) => ehNave(x) && x.lado === "inimiga" && !foraDeCombate(x));
        let alvoNave = null;
        if (navesAlvo.length) {
          const r = await modalForm({ titulo: `⚔ ${a.nome}`, descricao: "Há naves inimigas em campo.",
            campos: [{ k: "alvo", label: "Mirar em", tipo: "select",
              opcoes: [{ v: "", l: "— alvo pessoal (resolvo na mesa) —" },
                ...navesAlvo.map((x) => ({ v: x.id, l: `🚀 ${x.nome} — casco ${x.casco}/${x.casco_max}, Def ${10 + (x.manobra || 0)}` }))] }],
            okLabel: "Atacar" });
          if (!r) return;
          if (r.alvo) alvoNave = navesAlvo.find((x) => x.id === r.alvo);
        }
        const furtivo = $("#atq-furtivo")?.checked;
        const assassino = f.classe === "Assassino";
        // Ágil: usa o melhor de For/Des no acerto e no dano
        const atkAttr = pr.agil ? (k.attr.Des >= k.attr.For ? "Des" : "For") : cat.attr;
        const mod = k.attr[atkAttr] + k.per[cat.per]
          + (cat.tipo === "fogo" && f.implantes.includes("Olho Biônico de Precisão") ? 2 : 0)
          + (furtivo && pr.oculta ? 2 : 0)          // Oculta: +2 no furtivo
          + (k.efeitos ? k.efeitos.modificarAtaque({ acerto: 0, dano: 0, arma: cat, situacao: { desprevenido: !!furtivo, em_nave: !!camp.combate?.naveEmCena } }).acerto : 0)
          + (cat._efeitos || []).filter((e) => e.momento === "ao_atacar" && e.tipo === "acerto").reduce((x, e) => x + (e.valor || 0), 0);
        let nat, detVant = "";
        if (vantagem !== 0) { const r1 = d(20), r2 = d(20); nat = vantagem > 0 ? Math.max(r1, r2) : Math.min(r1, r2); detVant = ` [${vantagem > 0 ? "vant" : "desv"} ${r1}/${r2}]`; } else nat = d(20);
        const total = nat + mod;
        const danoBase = danoArma(cat, f.nivel);
        const pd = parseDice(danoBase);
        // dobra o dano por Crítico (20) e/ou Ataque Furtivo do Assassino (cada um adiciona um conjunto de dados)
        const situacaoPre = { desprevenido: !!furtivo, em_nave: !!camp.combate?.naveEmCena };
        const modAtqPre = k.efeitos ? k.efeitos.modificarAtaque({ acerto: 0, dano: 0, arma: cat, situacao: situacaoPre }) : { acerto: 0, dano: 0, multDano: 1 };
        // Rola o dano UMA vez; crítico e multiplicadores de classe multiplicam o
        // total depois (dados + bônus), conforme a regra da mesa.
        let dados = rollNd(pd.n, pd.f);
        if (pr.brutal) { const d2 = rollNd(pd.n, pd.f); if (d2.reduce((x, y) => x + y, 0) > dados.reduce((x, y) => x + y, 0)) dados = d2; } // Brutal: vantagem no dano
        // Situação do ataque: o que o motor precisa saber para efeitos condicionais.
        const situacao = situacaoPre, modAtq = modAtqPre;
        const modsAtq = (cat._efeitos || []).filter((e) => e.momento === "ao_atacar");
        const modKw = [...(pr.efeitos || []), ...modsAtq].filter((e) => e.momento === "ao_atacar" && e.tipo === "dano" && !e.contra)
          .reduce((x, e) => x + (e.valor || 0), 0);
        const modAcertoPecas = modsAtq.filter((e) => e.tipo === "acerto").reduce((x, e) => x + (e.valor || 0), 0);
        const danoMod = k.attr[atkAttr] + modKw + modAtq.dano + (cat.tipo === "branca" && f.implantes.includes("Braço Mecânico Hidráulico") ? 2 : 0);
        // Multiplicador final: ×2 no crítico, ×2 no furtivo do Assassino — e o
        // Assassino veterano acumula os dois, chegando a ×4.
        const multCrit = (nat === 20 ? 2 : 1) * (modAtq.multDano || 1);
        const somaDados = dados.reduce((x, y) => x + y, 0);
        const danoFinal = (somaDados + danoMod) * multCrit;
        const marcadores = [nat === 20 ? "CRÍTICO ×2" : "", furtivo && assassino ? "FURTIVO ×2" : furtivo ? "furtivo +2 acerto" : "", pr.agil ? `Ágil (${atkAttr})` : "", pr.brutal ? "Brutal (vantagem)" : ""].filter(Boolean).join(" · ");
        // Palavras-chave declaradas: condições ao acertar e perfuração de armadura.
        let efeitoKw = "";
        if (nat !== 1 && total >= 0) {
          const partes = [];
          for (const ac of (pr.aoAcertar || []))
            partes.push(`🏷 ${ac.origem}: alvo fica ${ac.cond} por ${ac.turnos} turno(s)${ac.cd ? ` (CD ${ac.cd} evita)` : ""}`);
          if (pr.ignoraArmadura) partes.push(`🗡 ignora ${pr.ignoraArmadura} de armadura`);
          efeitoKw = partes.join(" · ");
        }
        // Munição especial: o efeito entra no resultado para o Mestre aplicar a condição.
        let efeitoMun = "";
        if (custo > 0 && nat !== 1) { const itA = (meuPers.dados.inventario || []).find((x) => x.nome === a.nome && x.equip);
          const tpm = TIPOS_PENTE[(itA && itA.tipoPente) || f.tipoPente || PENTE_PADRAO];
          if (tpm && tpm.cond) efeitoMun = `${tpm.ic} ${tpm.n}: alvo fica ${tpm.cond} por ${tpm.turnos} turno(s)${tpm.cd ? ` (Constituição CD ${tpm.cd} evita)` : ""}`;
          else if (tpm && tpm.bonusSint) efeitoMun = `${tpm.ic} ${tpm.n}: +${tpm.bonusSint} contra sintéticos e implantes do alvo inertes por 1 turno`;
        }
        const infoArma = [pr.area ? `◎ Área: ${pr.areaTxt}` : "", pr.alcance ? `⟿ Alcance: ${pr.alcanceTxt}` : "", cat.kw ? `🏷 ${cat.kw}: ${pr.efeito}` : ""].filter(Boolean).join("  ·  ");
        enviar("rolagem", null, { titulo: (privada ? "🔒 " : "") + `Ataque — ${a.nome}${furtivo ? " 🥷" : ""}`,
          detalhe: `d20 [${nat}]${detVant} ${sign(mod)} · dano ${danoBase} [${dados.join(", ")}] ${sign(danoMod)}${multCrit > 1 ? ` ×${multCrit}` : ""}${marcadores ? " · " + marcadores : ""}`,
          total: nat + mod, crit: nat === 20, fumble: nat === 1, ...(privada ? { privada: true } : {}), dano_total: danoFinal,
          extra: `Dano: ${danoFinal}${multCrit > 1 ? ` (${somaDados} + ${danoMod} × ${multCrit})` : ""}${efeitoKw ? "  —  " + efeitoKw : ""}${efeitoMun ? "  —  " + efeitoMun : ""}${infoArma ? "  —  " + infoArma : ""}` });
        if (alvoNave) {                    // resolve o tiro contra o casco
          const def = 10 + (alvoNave.manobra || 0);
          const acertou = total >= def && nat !== 1;
          if (acertou) {
            const bruto = danoFinal;
            const r2 = danoNave(alvoNave, bruto);
            snapshot("tiro em nave");
            if (r2.critico) { const av = rolarAvaria(); (camp.combate.avarias = camp.combate.avarias || []).push(av);
              await enviar("sistema", `⚠ ${alvoNave.nome}: ${av.n} — ${av.e}`); }
            await salvarCombate();
            await enviar("sistema", `🚀 ${meuPers.nome} acerta ${alvoNave.nome} (Def ${def}): escudos −${r2.escudos}, casco −${r2.casco}. Agora ${alvoNave.casco}/${alvoNave.casco_max}.${alvoNave.casco <= 0 ? " 💥 ABATIDA!" : ""}`);
          } else await enviar("sistema", `🚀 ${meuPers.nome} erra ${alvoNave.nome} (Defesa ${def}).`);
          render();
        }
        if (precisaRender) render();      // atualiza o contador de munição na tela
      });
      // Trocar direto pelo pente clicado na reserva — mais rápido que abrir o menu.
      const carregarPente = async (tipoNovo) => {
        const dd1 = meuPers.dados || {};
        const res = normalizaPentes(dd1);
        if (!(res[tipoNovo] > 0)) return;
        const noCano = dd1.tirosPente ?? TIROS_POR_PENTE;
        const tipoAtual = dd1.tipoPente || PENTE_PADRAO;
        // O pente que sai volta para a reserva se ainda tiver tiros.
        if (noCano > 0 && tipoAtual !== tipoNovo) res[tipoAtual] = (res[tipoAtual] || 0) + 1;
        res[tipoNovo] -= 1;
        f.pentes = res; f.tirosPente = TIROS_POR_PENTE; f.tipoPente = tipoNovo;
        meuPers.dados = { ...dd1, pentes: res, tirosPente: TIROS_POR_PENTE, tipoPente: tipoNovo };
        await sb.from("personagens").update({ dados: meuPers.dados }).eq("id", meuPers.id);
        const t3 = TIPOS_PENTE[tipoNovo];
        await enviar("sistema", `🔫 ${meuPers.nome} carrega ${t3.ic} ${t3.n} (Ação de Movimento).`);
        render();
      };
      app.querySelectorAll("[data-carregar]").forEach((b2) => b2.onclick = () => carregarPente(b2.dataset.carregar));
      // Trocar o pente de uma arma específica.
      const trocarPenteDe = async (nomeArma, tipoNovo) => {
        const dd1 = meuPers.dados || {};
        const inv = dd1.inventario || [];
        const ix = inv.findIndex((x) => x.nome === nomeArma && x.equip);
        if (ix < 0) return;
        const res = normalizaPentes(dd1);
        const disp = Object.entries(res).filter(([, q]) => q > 0);
        if (!disp.length) { await enviar("sistema", `🔫 ${meuPers.nome} procura um pente e não acha nenhum.`); return render(); }
        let escolha = tipoNovo;
        if (!escolha) {
          if (disp.length === 1) escolha = disp[0][0];
          else {
            const r = await modalForm({ titulo: `↻ Trocar pente — ${nomeArma}`, descricao: "A troca custa a Ação de Movimento.",
              campos: [{ k: "t", label: "Munição", tipo: "select", opcoes: disp.map(([k2, q]) => { const t2 = TIPOS_PENTE[k2];
                return { v: k2, l: `${t2.ic} ${t2.n} ×${q} — ${t2.d}` }; }) }], okLabel: "Carregar" });
            if (!r?.t) return; escolha = r.t;
          }
        }
        if (!(res[escolha] > 0)) return;
        const it = inv[ix]; const e2 = estadoArma(dd1, it);
        if (e2.tiros > 0 && e2.tipo !== escolha) res[e2.tipo] = (res[e2.tipo] || 0) + 1;   // o pente cheio volta
        res[escolha] -= 1;
        const novoInv = inv.map((x, i2) => i2 === ix ? { ...x, tiros: TIROS_POR_PENTE, tipoPente: escolha } : x);
        meuPers.dados = { ...dd1, inventario: novoInv, pentes: res, __migrouArma: true };
        f.inventario = novoInv; f.pentes = res;
        await sb.from("personagens").update({ dados: meuPers.dados }).eq("id", meuPers.id);
        const t3 = TIPOS_PENTE[escolha];
        await enviar("sistema", `🔫 ${meuPers.nome} carrega ${t3.ic} ${t3.n} em ${nomeArma} (Ação de Movimento).`);
        render();
      };
      app.querySelectorAll("[data-trocar]").forEach((b2) => b2.onclick = () => trocarPenteDe(b2.dataset.trocar, null));
      app.querySelectorAll("[data-carregar]").forEach((b2) => b2.onclick = async () => {
        const fogo = armasDeFogo(f);
        if (!fogo.length) return;
        let alvo = fogo[0].nome;
        if (fogo.length > 1) {
          const r = await modalForm({ titulo: "↻ Carregar em qual arma?",
            campos: [{ k: "a", label: "Arma", tipo: "select", opcoes: fogo.map((it) => { const e2 = estadoArma(f, it);
              return { v: it.nome, l: `${it.nome} — ${e2.tiros}/${TIROS_POR_PENTE}` }; }) }], okLabel: "Carregar" });
          if (!r?.a) return; alvo = r.a;
        }
        trocarPenteDe(alvo, b2.dataset.carregar);
      });
      $("#recarregar")?.addEventListener("click", async () => {
        const dd1 = meuPers.dados || {};
        const res = normalizaPentes(dd1);
        const disp = Object.entries(res).filter(([, q]) => q > 0);
        if (!disp.length) { await enviar("sistema", `🔫 ${meuPers.nome} procura um pente e não acha nenhum. Sem munição na reserva.`); return render(); }
        let escolha = disp[0][0];
        if (disp.length > 1) {
          const r = await modalForm({ titulo: "↻ Trocar pente", descricao: "Escolha a munição. A troca custa a Ação de Movimento.",
            campos: [{ k: "t", label: "Pente", tipo: "select", opcoes: disp.map(([k2, q]) => { const t2 = TIPOS_PENTE[k2];
              return { v: k2, l: `${t2.ic} ${t2.n} ×${q} — ${t2.d}` }; }) }], okLabel: "Carregar" });
          if (!r?.t) return; escolha = r.t;
        }
        res[escolha] -= 1;
        f.pentes = res; f.tirosPente = TIROS_POR_PENTE; f.tipoPente = escolha;
        meuPers.dados = { ...dd1, pentes: res, tirosPente: f.tirosPente, tipoPente: escolha };
        await sb.from("personagens").update({ dados: meuPers.dados }).eq("id", meuPers.id);
        const t3 = TIPOS_PENTE[escolha];
        await enviar("sistema", `🔫 ${meuPers.nome} carrega um pente ${t3.ic} ${t3.n} (Ação de Movimento).`); render();
      });
      app.querySelectorAll("[data-hab-usar]").forEach((bt) => bt.onclick = async () => {
        const ats = habilidadesAtivas(f);
        const h = ats.find((x) => x.id === bt.dataset.habUsar); if (!h) return;
        if (h.descanso && f.usos?.[h.id]) return;
        const hRaw = (() => {   // a declaração completa, com resolve/duracao
          const raca = RACAS.find((r) => r.nome === f.raca), cl = CLASSES[f.classe];
          return [...(raca?.habilidades || []), ...(cl?.hab || []), cl?.vet, raca?.lendaria]
            .filter(Boolean).find((x) => x.n === h.nome);
        })();
        const turnos = duracaoDe(hRaw, f.nivel);
        const R = hRaw?.resolve;

        // ---- habilidades que resolvem sozinhas ----
        if (R?.tipo === "tabela") {           // Êxtase da Batalha: 1d6 decide o efeito
          const pd = parseDice(R.dado); const v = rollNd(pd.n, pd.f).reduce((x, y) => x + y, 0);
          const op = R.opcoes.find((o) => v >= o.de && v <= o.ate);
          const modos = { ...(meuPers.dados.modos || {}), [h.nome]: op.n };
          const exp = { ...(meuPers.dados.modosAte || {}), [h.nome]: turnos };
          meuPers.dados = { ...meuPers.dados, modos, modosAte: exp }; f.modos = modos;
          await sb.from("personagens").update({ dados: meuPers.dados }).eq("id", meuPers.id);
          await enviar("rolagem", null, { titulo: `★ ${h.nome}`, detalhe: `${R.dado} [${v}]`,
            extra: `${op.n} — dura ${turnos} turno(s).` });
          return render();
        }
        if (R?.tipo === "cura") {             // Cura Genética: dado + atributo, com crítico e falha
          const alvos = (pers || []).map((p2) => ({ v: p2.id, l: p2.id === meuPers.id ? `${p2.nome} (você)` : p2.nome }));
          const r2 = await modalForm({ titulo: `★ ${h.nome}`, descricao: h.d,
            campos: [{ k: "alvo", label: "Curar quem?", tipo: "select", opcoes: alvos }], okLabel: "Curar" });
          if (!r2?.alvo) return;
          const alvo = (pers || []).find((p2) => p2.id === r2.alvo);
          const pd = parseDice(R.dado); const dd2 = rollNd(pd.n, pd.f); const bruto = dd2[0];
          let val = bruto + (R.attr ? k.attr[R.attr] : 0); let nota = "";
          if (R.critico && bruto === R.critico.no) { val *= 2; nota = " — MÁXIMO! cura dobrada"; }
          if (R.falha && bruto === R.falha.no) {
            const dd3 = { ...novaFichaDados(), ...meuPers.dados };
            dd3.pvAtual = Math.max(0, (dd3.pvAtual || 0) - R.falha.danoProprio);
            meuPers.dados = dd3;
            await sb.from("personagens").update({ dados: dd3 }).eq("id", meuPers.id);
            nota = ` — rejeição! ${meuPers.nome} sofre ${R.falha.danoProprio} de dano`;
          }
          await enviar("cura", null, { alvo_id: alvo.id, alvo_nome: alvo.nome, valor: Math.max(0, val),
            origem: `★ ${h.nome} de ${meuPers.nome}`, detalhe: `${R.dado} [${bruto}]${R.attr ? ` + ${R.attr}` : ""}${nota}`, aplicado: false });
          if (h.descanso) { const usos = { ...(meuPers.dados.usos || {}), [h.id]: true };
            meuPers.dados = { ...meuPers.dados, usos }; await sb.from("personagens").update({ dados: meuPers.dados }).eq("id", meuPers.id); }
          return render();
        }
        if (R?.tipo === "transferir_pv") {    // Emprestar Vitalidade
          const max = Math.floor((f.pvAtual || 0) * (R.maxFracao || 0.5));
          if (max < 1) return alert("Você não tem vida suficiente para transferir.");
          const r2 = await modalForm({ titulo: `★ ${h.nome}`, descricao: `${h.d}\n\nVocê pode transferir até ${max} PV.`,
            campos: [
              { k: "alvo", label: "Para quem?", tipo: "select", opcoes: (pers || []).filter((p2) => p2.id !== meuPers.id).map((p2) => ({ v: p2.id, l: p2.nome })) },
              { k: "qtd", label: "Quantos PV", tipo: "numero", valor: Math.min(max, 5), min: 1, max },
            ], okLabel: "Transferir" });
          if (!r2?.alvo) return;
          const qtd = Math.max(1, Math.min(max, +r2.qtd || 1));
          const alvo = (pers || []).find((p2) => p2.id === r2.alvo);
          const dd3 = { ...novaFichaDados(), ...meuPers.dados };
          dd3.pvAtual = Math.max(0, (dd3.pvAtual || 0) - qtd);
          meuPers.dados = dd3; f.pvAtual = dd3.pvAtual;
          await sb.from("personagens").update({ dados: dd3 }).eq("id", meuPers.id);
          await enviar("cura", null, { alvo_id: alvo.id, alvo_nome: alvo.nome, valor: qtd,
            origem: `★ ${h.nome} de ${meuPers.nome}`, detalhe: `transferiu ${qtd} PV do próprio corpo`, aplicado: false });
          return render();
        }
        if (R?.tipo === "disputa") {          // Invasão da Sombra: rolagem contra o Mestre
          const nat = d(20), meu = nat + (k.attr[R.atributo] || 0);
          const natM = d(20), mestre = natM + 2;
          const venceu = meu > mestre;
          let extra = venceu ? `Venceu — ${R.vitoria}.` : `Perdeu — ${meuPers.nome} sofre ${R.derrota.danoProprio} de dano.`;
          if (!venceu) { const dd3 = { ...novaFichaDados(), ...meuPers.dados };
            dd3.pvAtual = Math.max(0, (dd3.pvAtual || 0) - R.derrota.danoProprio);
            meuPers.dados = dd3; await sb.from("personagens").update({ dados: dd3 }).eq("id", meuPers.id); }
          await enviar("rolagem", null, { titulo: `★ ${h.nome}`,
            detalhe: `você d20 [${nat}] +${k.attr[R.atributo] || 0} = ${meu} · alvo d20 [${natM}] +2 = ${mestre}`,
            total: meu, crit: nat === 20, fumble: nat === 1, extra });
          return render();
        }
        if (R?.tipo === "condicao") {         // Repulsão Cinética: derruba sem causar dano
          const inimigos = (camp.combate?.ordem || []).filter((c2) => c2.tipo === "inimigo" && !foraDeCombate(c2));
          const r2 = inimigos.length ? await modalForm({ titulo: `★ ${h.nome}`, descricao: h.d,
            campos: [{ k: "alvo", label: "Em quem?", tipo: "select", opcoes: inimigos.map((c2) => ({ v: c2.id, l: c2.nome })) }], okLabel: "Empurrar" }) : { alvo: null };
          if (inimigos.length && !r2?.alvo) return;
          if (r2?.alvo) {
            const alvo = camp.combate.ordem.find((c2) => c2.id === r2.alvo);
            alvo.cond = [...(alvo.cond || []).filter((c2) => c2.n !== R.cond), { n: R.cond, turnos: R.turnos }];
            await salvarCombate();
            await enviar("sistema", `★ ${meuPers.nome} usa ${h.nome}: ${alvo.nome} é derrubado (${R.cond} ${R.turnos} turno) — sem dano.`);
          } else await enviar("sistema", `★ ${meuPers.nome} usa ${h.nome} — o alvo é derrubado, sem sofrer dano.`);
          return render();
        }
        if (R?.tipo === "modo" || R?.tipo === "criar") {   // Endurecer, Camuflagem, Fúria, Criogénese
          let escolha = null;
          if (R.opcoes) {
            const r2 = await modalForm({ titulo: `★ ${h.nome}`, descricao: h.d,
              campos: [{ k: "op", label: "O que criar", tipo: "select", opcoes: R.opcoes.map((o) => ({ v: o.n, l: `${o.n} — ${o.d}` })) }], okLabel: "Criar" });
            if (!r2?.op) return; escolha = r2.op;
          } else if (!(await confirmModal(`Usar ${h.nome}?\n\n${h.d}${turnos ? `\n\nDura ${turnos} turno(s).` : ""}${R.aviso ? `\n\n⚠ ${R.aviso}` : ""}`, { okLabel: "Ativar" }))) return;
          const modos = { ...(meuPers.dados.modos || {}), [h.nome]: escolha || "ativo" };
          const exp = { ...(meuPers.dados.modosAte || {}), [h.nome]: turnos || 99 };
          meuPers.dados = { ...meuPers.dados, modos, modosAte: exp }; f.modos = modos;
          await sb.from("personagens").update({ dados: meuPers.dados }).eq("id", meuPers.id);
          await enviar("sistema", `★ ${meuPers.nome} ativa **${h.nome}**${escolha ? `: ${escolha}` : ""} — ${h.d}${turnos ? ` (${turnos} turnos)` : ""}${R.aviso ? ` ⚠ ${R.aviso}` : ""}`);
          return render();
        }

        // Habilidades com opções (o gás do Ven'y) ligam um modo que fica valendo.
        if (h.opcoes?.length) {
          const atual = f.modos?.[h.nome];
          const r = await modalForm({ titulo: `★ ${h.nome}`, descricao: h.d,
            campos: [{ k: "op", label: atual ? `Respirando: ${atual}` : "O que respirar", tipo: "select",
              opcoes: [{ v: "", l: atual ? "— parar de respirar (desligar) —" : "— escolha —" },
                ...h.opcoes.map((o) => ({ v: o.n, l: `${o.ic} ${o.n} — ${o.d}` }))] }],
            okLabel: "Aplicar" });
          if (!r) return;
          const modos = { ...(meuPers.dados.modos || {}) };
          if (r.op) modos[h.nome] = r.op; else delete modos[h.nome];
          meuPers.dados = { ...meuPers.dados, modos }; f.modos = modos;
          await sb.from("personagens").update({ dados: meuPers.dados }).eq("id", meuPers.id);
          const op2 = h.opcoes.find((o) => o.n === r.op);
          await enviar("sistema", r.op
            ? `${op2.ic} ${meuPers.nome} respira **${r.op}** — ${op2.d}`
            : `💨 ${meuPers.nome} volta a respirar o ar normal (${h.nome} desligado).`);
          return render();
        }
        if (!(await confirmModal(`Usar ${h.nome}?\n\n${h.d}${h.descanso ? `\n\nRecarrega no descanso ${h.descanso}.` : ""}`, { okLabel: "Usar" }))) return;
        if (h.descanso) {                       // marca como gasta até o descanso
          const usos = { ...(meuPers.dados.usos || {}), [h.id]: true };
          meuPers.dados = { ...meuPers.dados, usos }; f.usos = usos;
          await sb.from("personagens").update({ dados: meuPers.dados }).eq("id", meuPers.id);
        }
        await enviar("sistema", `★ ${meuPers.nome} usa **${h.nome}** (${h.origem}) — ${h.d}`);
        render();
      });
      app.querySelectorAll(".item-usa").forEach((bt) => bt.onclick = async () => {
        const nomeItem = bt.dataset.item;
        const cfg = ehConsumivel(nomeItem); if (!cfg) return;
        let alvo = meuPers;
        if (!cfg.area && cfg.efeito !== "nenhum") {          // itens de alvo único perguntam em quem
          const r = await modalForm({ titulo: `${cfg.ic} ${nomeItem}`, descricao: `${cfg.d}  ·  ${cfg.acao}. O item é consumido ao ser usado.`,
            campos: [{ k: "alvo", label: "Em quem?", tipo: "select",
              opcoes: (pers || []).map((p2) => ({ v: p2.id, l: p2.id === meuPers.id ? `${p2.nome} (você)` : p2.nome })) }], okLabel: "Usar" });
          if (!r?.alvo) return;
          alvo = (pers || []).find((p2) => p2.id === r.alvo) || meuPers;
        } else if (!(await confirmModal(`Usar ${nomeItem}?\n\n${cfg.d}`, { okLabel: "Usar" }))) return;
        const r = { item: nomeItem };

        // consome o item da ficha de quem usou
        const inv = (f.inventario || []).map((it) => it.nome === r.item ? { ...it, qtd: (it.qtd || 1) - 1 } : it).filter((it) => (it.qtd || 0) > 0 || !ehConsumivel(it.nome));
        f.inventario = inv; meuPers.dados = { ...meuPers.dados, inventario: inv };
        await sb.from("personagens").update({ dados: meuPers.dados }).eq("id", meuPers.id);

        if (cfg.efeito === "cura") {
          const pd = parseDice(cfg.dado); const ds = rollNd(pd.n, pd.f);
          const val = ds.reduce((x, y) => x + y, 0) + pd.mod;
          await enviar("cura", null, { alvo_id: alvo.id, alvo_nome: alvo.nome, valor: val,
            origem: `${cfg.ic} ${cfg.n} de ${meuPers.nome}`, detalhe: `${cfg.dado} [${ds.join(", ")}]`, aplicado: false });
        } else if (cfg.efeito === "ram") {
          const dd = { ...novaFichaDados(), ...alvo.dados };
          dd.ramGasta = Math.max(0, (dd.ramGasta || 0) - (cfg.valor || 1));
          await sb.from("personagens").update({ dados: dd }).eq("id", alvo.id); alvo.dados = dd;
          await enviar("sistema", `${cfg.ic} ${meuPers.nome} usa ${cfg.n} em ${alvo.nome}: +${cfg.valor} Slot de RAM.`);
        } else if (cfg.efeito === "sangramento") {
          const cb = camp.combate?.ordem?.find((x) => x.personagem_id === alvo.id);
          if (cb && cb.cond) { cb.cond = cb.cond.filter((c2) => !/sangrando/i.test(c2.n)); await salvarCampanha({ combate: camp.combate }).eq("id", id); }
          await enviar("sistema", `${cfg.ic} ${meuPers.nome} usa ${cfg.n} em ${alvo.nome}: sangramento estancado.`);
        } else if (cfg.efeito === "condicao") {
          let txt = `${cfg.ic} ${meuPers.nome} lança ${cfg.n}!`;
          if (cfg.dano) { const pdg = parseDice(cfg.dano); const dg = rollNd(pdg.n, pdg.f);
            txt += ` Dano ${cfg.dano} [${dg.join(", ")}] = ${dg.reduce((x, y) => x + y, 0)}.`; }
          txt += ` Alvos na área ficam ${cfg.cond} por ${cfg.turnos} turno(s)${cfg.cd ? ` (Constituição CD ${cfg.cd} evita)` : ""}.`;
          await enviar("sistema", txt);
        } else {
          await enviar("sistema", `${cfg.ic} ${meuPers.nome} usa ${cfg.n}${alvo.id !== meuPers.id ? ` em ${alvo.nome}` : ""}. ${cfg.d}`);
        }
        render();
      });
      $("#conjurar").onclick = async () => {
        const s = SCRIPTS.find((x) => x.n === $("#sel-scr").value);
        if (s.c > k.ramLivre) return enviar("sistema", `${p.nome || perfil.apelido} tentou conjurar ${s.n} sem RAM suficiente (Overclock manual: 1d6/ponto).`);
        meuPers.dados = { ...f, ramGasta: (f.ramGasta || 0) + s.c };
        await sb.from("personagens").update({ dados: meuPers.dados }).eq("id", meuPers.id);
        const nat = d(20);
        // Scripts que reparam a nave resolvem direto no casco.
        const mNave = /(\d+d\d+)\s+do casco/i.exec(s.d || "");
        if (mNave && camp.nave) {
          const pdn = parseDice(mNave[1]); const dn = rollNd(pdn.n, pdn.f);
          const val = dn.reduce((x, y) => x + y, 0);
          const antes = camp.nave.casco;
          camp.nave.casco = Math.min(camp.nave.casco_max, camp.nave.casco + val);
          const cbn = camp.combate?.ordem?.find((x) => x.nave_party);
          if (cbn) cbn.casco = camp.nave.casco;
          await salvarCampanha({ nave: camp.nave, ...(cbn ? { combate: camp.combate } : {}) }).eq("id", id);
          await enviar("rolagem", null, { titulo: `Script — ${s.n}`,
            detalhe: `${mNave[1]} [${dn.join(", ")}] · ${s.c} RAM`,
            extra: `🔧 Casco reparado em ${camp.nave.casco - antes} (${camp.nave.casco}/${camp.nave.casco_max}).` });
          return render();
        }
        // Scripts que curam resolvem de verdade: escolhem alvo, rolam e aplicam.
        const mCura = /Cura (\d+d\d+)(?:\s*\+\s*(\w+))?/i.exec(s.d || "");
        if (mCura) {
          const alvoR = await modalForm({ titulo: `◈ ${s.n}`, descricao: s.d,
            campos: [{ k: "alvo", label: "Em quem?", tipo: "select",
              opcoes: (pers || []).map((p2) => ({ v: p2.id, l: p2.id === meuPers.id ? `${p2.nome} (você)` : p2.nome })) }], okLabel: "Conjurar" });
          if (alvoR?.alvo) {
            const alvo = (pers || []).find((p2) => p2.id === alvoR.alvo);
            const pd = parseDice(mCura[1]); const ds = rollNd(pd.n, pd.f);
            const bonus = mCura[2] && k.attr[mCura[2]] != null ? k.attr[mCura[2]] : 0;
            const val = ds.reduce((x, y) => x + y, 0) + pd.mod + bonus;
            await enviar("cura", null, { alvo_id: alvo.id, alvo_nome: alvo.nome, valor: val,
              origem: `◈ ${s.n} de ${meuPers.nome}`, detalhe: `${mCura[1]} [${ds.join(", ")}]${bonus ? ` ${sign(bonus)} ${mCura[2]}` : ""}`, aplicado: false });
            // Bio-feedback e afins: quem cura também recebe algo de volta.
            const rc = k.efeitos?.aoCurar();
            if (rc?.curaPropria && alvo.id !== meuPers.id) {
              const dd = { ...novaFichaDados(), ...meuPers.dados };
              const antes = dd.pvAtual || 0;
              dd.pvAtual = Math.min(dd.pvMax || 0, antes + rc.curaPropria);
              if (dd.pvAtual !== antes) {
                meuPers.dados = dd;
                await sb.from("personagens").update({ dados: dd }).eq("id", meuPers.id);
                await enviar("sistema", `♻ ${meuPers.nome} — ${rc.fontes[0]}: recupera ${dd.pvAtual - antes} PV ao curar um aliado.`);
              }
            }
            return render();
          }
        }
        enviar("rolagem", null, { titulo: `Script — ${s.n}`, detalhe: `d20 [${nat}] +${k.conj} · ${s.c} RAM · ${s.a}`, total: nat + k.conj, crit: nat === 20, fumble: nat === 1, extra: s.d.slice(0, 90) });
        render(); };
      $("#rolar-livre").onclick = () => { const v = $("#dado-livre").value.trim(); const r = rolarExpr(v.replace(/^\//, ""), vantagem); if (!r) return;
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
      await salvarCampanha({ nave }).eq("id", id);
      enviar("nave", `A nave ${nave.nome_batismo} (${n.n}) entrou em serviço. Casco ${n.casco}, Escudos ${n.escudos}, Defesa ${10 + n.manobra}.`);
    });
    $("#sel-posto")?.addEventListener("change", async (e) => {
      await sb.from("campanha_membros").update({ posto: e.target.value || null }).eq("campanha_id", id).eq("perfil_id", usuario.id);
      location.reload();
    });
    const salvarCbn = async () => { const { error } = await salvarCampanha({ combate_nave: camp.combate_nave }).eq("id", id); if (error) alert("Não consegui salvar o combate espacial: " + error.message); };
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
        await salvarCampanha({ nave: camp.nave }).eq("id", id);
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
      await salvarCampanha({ nave: camp.nave }).eq("id", id);
      await salvarCbn();
      await enviar("rolagem", null, { titulo: `🚀 ${x.nome} dispara`, detalhe: `d20 [${nat}] +4 vs Defesa ${def} · dano ${x.dano} [${dados.join(", ")}]${nat === 20 ? " ×2" : ""}`, total, crit: nat === 20, extra });
      render();
    });
    app.querySelectorAll("[data-av-fix]").forEach((b) => b.onclick = async () => {
      const av = camp.combate_nave.avarias.splice(+b.dataset.avFix, 1)[0];
      await salvarCbn(); await enviar("sistema", `🔧 Avaria reparada: ${av?.n}.`); render();
    });
    // Upgrades da nave (ficha evolutiva)
    // Reparo fora de combate: no estaleiro, pagando em créditos da tripulação.
    $("#nave-repar")?.addEventListener("click", async () => {
      if (!camp.nave) return;
      const faltaCasco = camp.nave.casco_max - camp.nave.casco;
      const faltaEsc = camp.nave.escudos_max - camp.nave.escudos;
      const avarias = (camp.combate?.avarias || []).length;
      if (!faltaCasco && !faltaEsc && !avarias) return alert("A nave está inteira: casco cheio, escudos cheios e sem avarias.");
      // 8 CG por ponto de casco; escudos recalibram de graça; avaria custa 150 CG cada
      const custoCasco = faltaCasco * 8, custoAvarias = avarias * 150;
      const r = await modalForm({ titulo: "🛠 Estaleiro",
        descricao: `Reparo completo fora de combate. Casco: ${camp.nave.casco}/${camp.nave.casco_max} · Escudos: ${camp.nave.escudos}/${camp.nave.escudos_max}${avarias ? ` · ${avarias} avaria(s)` : ""}.`,
        campos: [
          { k: "i", label: `Custo: ${custoCasco} CG pelo casco (${faltaCasco} pontos × 8)${custoAvarias ? ` + ${custoAvarias} CG pelas avarias` : ""}${faltaEsc ? " · recalibrar escudos é grátis" : ""}. Total: ${custoCasco + custoAvarias} CG.`, tipo: "info" },
          { k: "quem", label: "Quem paga a conta?", tipo: "select", opcoes: [{ v: "", l: "— ninguém (cortesia do Mestre) —" }, ...(pers || []).map((p2) => ({ v: p2.id, l: `${p2.nome} (${p2.dados?.creditos ?? 0} CG)` }))] },
        ], okLabel: "Reparar" });
      if (!r) return;
      const total = custoCasco + custoAvarias;
      if (r.quem) {
        const pagador = (pers || []).find((p2) => p2.id === r.quem);
        const saldo = pagador?.dados?.creditos ?? 0;
        if (saldo < total) return alert(`${pagador.nome} tem ${saldo} CG — faltam ${total - saldo} CG para o reparo.`);
        const dd = { ...novaFichaDados(), ...pagador.dados, creditos: saldo - total };
        dd.log = [{ q: new Date().toISOString(), t: `🛠 Pagou ${total} CG pelo reparo da nave.` }, ...(dd.log || [])].slice(0, 60);
        await sb.from("personagens").update({ dados: dd }).eq("id", pagador.id); pagador.dados = dd;
      }
      camp.nave.casco = camp.nave.casco_max; camp.nave.escudos = camp.nave.escudos_max;
      const cbn2 = camp.combate?.ordem?.find((x) => x.nave_party);
      if (cbn2) { cbn2.casco = camp.nave.casco; cbn2.escudos = camp.nave.escudos; }
      if (camp.combate) camp.combate.avarias = [];
      await salvarCampanha({ nave: camp.nave, ...(camp.combate ? { combate: camp.combate } : {}) }).eq("id", id);
      await enviar("sistema", `🛠 ${camp.nave.nome_batismo || camp.nave.modelo} sai do estaleiro: casco e escudos no máximo${avarias ? `, ${avarias} avaria(s) reparada(s)` : ""}${total ? ` — ${total} CG` : ""}.`);
      render();
    });
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
      await salvarCampanha({ nave: camp.nave }).eq("id", id);
      await enviar("sistema", `🔧 ${camp.nave.nome_batismo || camp.nave.modelo} recebeu uma melhoria: ${u.n}. ${u.e}`);
      render();
    });
    $("#nave-hit")?.addEventListener("click", async () => {
      const v = +$("#nave-dano").value; if (!v || !camp.nave) return;
      const n = { ...camp.nave };
      const abs = Math.min(n.escudos, v); n.escudos -= abs; n.casco = Math.max(0, n.casco - (v - abs));
      await salvarCampanha({ nave: n }).eq("id", id);
      enviar("nave", `A nave sofreu ${v} de dano (${abs} nos escudos). Casco ${n.casco}/${n.casco_max}, Escudos ${n.escudos}/${n.escudos_max}.${n.casco === 0 ? " ⚠ CASCO ZERO — À DERIVA!" : ""}`);
    });
    if (meuPosto && f) app.querySelectorAll("[data-est]").forEach((b) => b.onclick = async () => {
      const acao = ESTACOES[meuPosto].acoes[+b.dataset.est];
      if (!acao.rola) return enviar("nave", `${meuPers.nome} executa ${acao.n}: ${acao.d}`);
      const [at, pn] = acao.rola; const mod = k.attr[at] + k.per[pn];
      const nat = d(20); const total = nat + mod;
      let extra = acao.d;
      const nt = (camp.combate.nave = camp.combate.nave || naveTaticaVazia());
      let mexeuNaTatica = false;
      // Efeitos que persistem até serem consumidos (Cap. 12)
      if (/manobra evasiva/i.test(acao.n) && camp.nave) {
        const defBase = 10 + (camp.nave.manobra || 0);
        if (total > defBase) { nt.evasiva = total; nt.evasivaDe = meuPers.id; extra = `Defesa da nave passa a ${total} até o seu próximo turno (base ${defBase}).`; }
        else extra = `Resultado ${total} não supera a Defesa base ${defBase} — a manobra não melhora nada.`;
        mexeuNaTatica = true;
      }
      if (/alinhamento de rota/i.test(acao.n)) {
        const alvo = camp.combate.ordem.find((x) => ehNave(x) && x.lado === "inimiga" && !foraDeCombate(x));
        const cd = alvo ? 10 + (alvo.manobra || 0) : 12;
        if (total >= cd) { nt.alinhado = true; extra = `Alinhado (CD ${cd}): o próximo Fogo Concentrado sai com Vantagem.`; }
        else extra = `Falhou em alinhar (CD ${cd}).`;
        mexeuNaTatica = true;
      }
      if (/rastreio de fraqueza/i.test(acao.n)) {
        if (total >= 13) { nt.fraqueza = true; extra = "Fraqueza localizada: o próximo acerto da nave causa +1d6 de dano."; }
        else extra = "Os sensores não encontram brecha no casco inimigo (CD 13).";
        mexeuNaTatica = true;
      }
      if (/sobrecarga de propulsores/i.test(acao.n) && camp.nave) {
        const choque = d(4);
        meuPers.dados = { ...meuPers.dados, pvAtual: Math.max(0, (meuPers.dados.pvAtual || 0) - choque) };
        await sb.from("personagens").update({ dados: meuPers.dados }).eq("id", meuPers.id);
        extra = `+2 de Manobrabilidade por 1 turno. O engenheiro sofre ${choque} de dano de choque.`;
      }
      if (acao.cura && camp.nave && total >= 12) {
        const pd = parseDice(acao.dado); const val = rollNd(pd.n, pd.f).reduce((a, b) => a + b, 0) + (acao.cura === "escudos" ? f.nivel : 0);
        const n = { ...camp.nave };
        n[acao.cura] = Math.min(n[acao.cura + "_max"], n[acao.cura] + val);
        await salvarCampanha({ nave: n }).eq("id", id);
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
          // Alinhamento de Rota concede Vantagem: rola um segundo d20 e fica com o melhor
          let natUsado = nat, totalUsado = total, marcas = [];
          if (nt.alinhado) { const n2 = d(20); if (n2 > nat) { natUsado = n2; totalUsado = n2 + mod; }
            marcas.push(`🎯 Vantagem por alinhamento [${nat}/${n2}]`); nt.alinhado = false; mexeuNaTatica = true; }
          if (totalUsado >= def && natUsado !== 1) {
            const pdn = parseDice(camp.nave?.dano || "1d6");
            const dd = rollNd(pdn.n * (natUsado === 20 ? 2 : 1), pdn.f);
            let bruto = dd.reduce((x2, y2) => x2 + y2, 0) + pdn.mod;
            if (nt.fraqueza) { const bonus = d(6); bruto += bonus; marcas.push(`🔎 fraqueza +${bonus}`); nt.fraqueza = false; mexeuNaTatica = true; }
            const r2 = danoNave(alvo, bruto);
            extra = `Acertou (Def ${def})! Dano ${camp.nave?.dano}${natUsado === 20 ? " ×2" : ""} [${dd.join(", ")}] → escudos −${r2.escudos}, casco −${r2.casco}. ${alvo.nome}: ${alvo.casco}/${alvo.casco_max}`;
            if (marcas.length) extra += `  ·  ${marcas.join(" · ")}`;
            if (alvo.casco <= 0) extra += "  💥 NAVE ABATIDA!";
          } else extra = `Errou — Defesa ${def} da ${alvo.nome}.${marcas.length ? "  ·  " + marcas.join(" · ") : ""}`;
          camp.combate.agiram = [...new Set([...(camp.combate.agiram || []), meuPosto])];
          await salvarCampanha({ combate: camp.combate }).eq("id", id);
        }
      } else if (camp.combate?.ativo) {
        camp.combate.agiram = [...new Set([...(camp.combate.agiram || []), meuPosto])];
        await salvarCampanha({ combate: camp.combate }).eq("id", id);
      }
      if (mexeuNaTatica) { await salvarCampanha({ combate: camp.combate }).eq("id", id); render(); }
      enviar("rolagem", null, { titulo: `${ESTACOES[meuPosto].n} — ${acao.n}`, detalhe: `d20 [${nat}] ${sign(mod)} (${at}+${pn})`, total, crit: nat === 20, fumble: nat === 1, extra });
    });
  };
  render();
}

// ---------------- BIBLIOTECA (todas as informações detalhadas) ----------------
function telaBiblioteca(aba = "racas") {
  const abas = [["racas", "Raças"], ["classes", "Classes"], ["armas", "Arsenal"], ["armaduras", "Armaduras"], ["implantes", "Implantes"], ["scripts", "Scripts"], ["filosofias", "Filosofias"], ["naves", "Naves"], ["consumiveis", "Consumíveis"], ["bestiario", "Bestiário"], ["npcs", "NPCs"], ["mecanicas", "Mecânicas"]];
  let corpo = "";
  const cardCriatura = (c) => { const nv = NIVEIS_AMEACA[c.ameaca] || { cor: "#8189a3" };
    return `<details class="det grande best-card" style="border-left:3px solid ${nv.cor}"><summary>${img(c.n)}<b>${esc(c.n)}</b>${c.apelido ? ` <i class="dim">${esc(c.apelido)}</i>` : ""} <span class="best-tag" style="color:${nv.cor};border-color:${nv.cor}">${esc(c.ameaca)}</span>${c.raca ? ` <i class="dim">${esc(c.raca)}</i>` : ""}</summary>
      ${imgFig(c.n)}${c.ambiental ? `<p>${esc(c.desc)}</p><p class="regra"><b class="chrome">⚠ Ameaça:</b> ${esc(c.ameaca_txt)}</p>` : `<p class="regra">❤ HP ${c.hp} · 🛡 CD ${c.cd} · 🏃 ${c.desloc}m${c.nota ? ` · <i>${esc(c.nota)}</i>` : ""}</p>`}
      ${(c.ataques || []).map((a) => `<p><b class="chrome">⚔ ${esc(a.n)}:</b> ${a.bonus != null ? `${sign(a.bonus)} acerto · ` : ""}${a.dano && a.dano !== "0" && a.dano !== "auto" ? `dano ${a.dano}` : ""}${a.extra ? ` <span class="dim">(${esc(a.extra)})</span>` : ""}</p>`).join("")}
      ${(c.habs || []).map((h) => h.efeito ? `<p><b class="tech-c">⚙ ${esc(h.n)}:</b> ${esc(h.d)} <span class="auto-tag" title="O app aplica sozinho no momento certo">automático</span></p>` : null).filter(Boolean).join("")}
      ${(c.habs || []).filter((h) => !h.efeito).map((h) => `<p><b class="tech-c">✦ ${esc(h.n)}:</b> ${esc(h.d)}</p>`).join("")}</details>`; };
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
    todasArmas().filter((a) => a.tipo === t).map((a) => `<details class="det grande"><summary>${img(a.n)}<b>${esc(a.n)}</b> · <b class="chrome">${a.dano}${a.escala ? "↗" : ""}</b>${a.preco ? ` · ${a.preco} CG` : ""}${a._ajustado ? ` <span class="best-tag" style="color:var(--chrome);border-color:var(--chrome)">ajustada</span>` : ""}</summary>
      ${imgFig(a.n)}
      <p class="regra">Rola <b>1d20 + ${a.attr === "Des" ? "Destreza" : "Força"} + ${esc(a.per)}</b> · dano <b>${a.dano} + ${a.attr}</b></p>
      ${a.escala ? `<div class="escala-box"><b class="tech-c">↗ Dano por nível</b>
        <div class="escala-linha">${escalaTabela(a)}</div>
        <p class="regra">Esta arma acompanha a sua carreira: o dado sobe nos marcos abaixo.</p></div>` : ""}
      ${a.kw ? etiquetasKw(a, { detalhado: true }) : `<p class="regra"><i>Sem palavras-chave.</i></p>`}
      ${a.desc ? `<p>${esc(a.desc)}</p>` : ""}</details>`).join("")).join("");
  if (aba === "armaduras") corpo = todasArmaduras().map((a) => `<details class="det grande"><summary>${img(a.n)}<b>${esc(a.n)}</b> · CD +${a.cd} <span class="dim">(${a.t})</span>${a.preco ? ` · <b class="chrome">${a.preco} CG</b>` : ""}</summary>${a.e ? `<p class="regra"><b>Efeito:</b> ${esc(a.e)}</p>` : ""}${a.desc ? `<p>${esc(a.desc)}</p>` : ""}</details>`).join("");
  if (aba === "implantes") corpo = todosImplantes().map((i) => `<div class="det"><b>${esc(i.n)}</b> · <b class="chrome">${i.p} CG</b> <span class="dim">(${i.g})</span> — ${esc(i.e)}</div>`).join("");
  if (aba === "scripts") corpo = SCRIPTS.map((s) => `<details class="det grande"><summary><b>${esc(s.n)}</b> <i class="sombra-c">${s.c}◈ ${esc(s.a)}</i></summary><p class="regra"><b>Efeito:</b> ${esc(s.d)}</p>${s.lore ? `<p>${esc(s.lore)}</p>` : ""}</details>`).join("");
  if (aba === "filosofias") corpo = Object.entries(FILOSOFIAS).map(([n, x]) => `<details class="det grande"><summary><b>${esc(n)}</b>${x.apelido ? ` <i class="dim">${esc(x.apelido)}</i>` : ""}${x.freq ? ` <span class="best-tag">1x/desc. ${esc(x.freq)}</span>` : ""}</summary>${x.lore ? `<p>${esc(x.lore)}</p>` : ""}<p class="regra"><b class="tech-c">Mecânica:</b> ${esc(x.d)}</p></details>`).join("");
  if (aba === "naves") corpo = `<p class="regra">${esc(REGRAS_NAVE.defesa)}<br>${esc(REGRAS_NAVE.dobra)}<br>${esc(REGRAS_NAVE.critico)}</p>` +
    todasNaves().map((n) => `<details class="det grande"><summary><b>${esc(n.n)}</b> · Casco ${n.casco} · Escudos ${n.escudos} · Manobra ${sign(n.manobra)} · Dano ${n.dano}</summary>
    <p>${esc(n.desc)}</p><p class="regra">Tripulação: ${esc(n.trip)}</p></details>`).join("") +
    `<h3 class="sub">Estações de Batalha</h3>` + Object.values(ESTACOES).map((e) => `<div class="det"><b>${esc(e.n)}</b>${e.acoes.map((a) => `<p><b class="tech-c">${esc(a.n)}${a.rola ? ` (${a.rola.join("+")})` : ""}:</b> ${esc(a.d)}</p>`).join("")}</div>`).join("")
    + `<h3 class="sub">🛠 Manutenção e reparo</h3>
      <p class="regra">Uma nave avariada não se conserta sozinha. São quatro formas de recuperar o Casco, da mais imediata à mais definitiva.</p>
      <div class="det grande"><p><b class="tech-c">Em combate — Reparos de Emergência:</b> o Engenheiro gasta a Ação Principal e testa Inteligência + Mecânica. Com sucesso, a nave recupera <b>1d4</b> de Casco.</p>
        <p><b class="tech-c">Em combate — Reparo Estrutural em Massa:</b> Script de 4 Slots de RAM; nanites restauram <b>4d10</b> do Casco.</p>
        <p><b class="tech-c">Descanso Longo — manutenção de bordo:</b> oito horas paradas devolvem <b>1d10+5</b> de Casco e recalibram os Escudos, sem custo.</p>
        <p><b class="tech-c">Estaleiro — reparo definitivo:</b> Casco e Escudos ao máximo e todas as avarias reparadas. Custa <b class="chrome">8 CG por ponto de Casco</b> e <b class="chrome">150 CG por avaria</b>; alguém da tripulação paga a conta.</p>
        <p class="regra"><i>Escudos são a exceção: recarregam sozinhos entre combates. É o Casco que cobra caro.</i></p></div>`
    + `<h3 class="sub">⚙ Melhorias de nave</h3>
      <p class="regra">Permanentes: alteram os atributos da nave a partir da instalação. A nave da tripulação é um personagem coletivo — acumula melhorias e cicatrizes.</p>`
      + UPGRADES_NAVE.map((u) => `<div class="det"><b>${esc(u.n)}</b> · <b class="chrome">${u.p} CG</b> — ${esc(u.e)}</div>`).join("")
    + `<h3 class="sub">⚠ Falhas Críticas do Casco (1d6)</h3>
      <p class="regra">Um acerto crítico ou um dano massivo no Casco dispara uma avaria. Elas só saem com reparo.</p>`
      + AVARIAS.map((av) => `<div class="det"><b>${av.d} — ${esc(av.n)}</b><br><span class="regra">${esc(av.e)}</span></div>`).join("");
  if (aba === "bestiario") { const base = ["Crias do Vazio", "Inimigos das Raças", "Heranças das Estrelas"];
    const cats = [...base, ...[...new Set(todasCriaturas().map((c) => c.categoria))].filter((c) => c && !base.includes(c))];
    const legenda = `<p class="regra">Ordene as fichas por ameaça: ${Object.entries(NIVEIS_AMEACA).map(([n, v]) => `<span class="best-tag" style="color:${v.cor};border-color:${v.cor}">${n}</span>`).join(" ")}</p>`;
    corpo = legenda + cats.map((cat) => { const lista = todasCriaturas().filter((c) => c.categoria === cat).sort((a, b) => (NIVEIS_AMEACA[a.ameaca]?.ordem || 0) - (NIVEIS_AMEACA[b.ameaca]?.ordem || 0));
      const desc = { "Crias do Vazio": "Os invasores de fora da realidade — escalonados de lacaios a chefes.", "Inimigos das Raças": "Adversários de cada povo do sistema, em três níveis de dificuldade.", "Heranças das Estrelas": "Fauna exoplanetária e quimeras do mercado negro do Caminho da Espiral." }[cat];
      return `<h3 class="sub">${esc(cat)} <span class="dim">(${lista.length})</span></h3><p class="regra">${esc(desc)}</p>${lista.map(cardCriatura).join("")}`; }).join(""); }
  if (aba === "npcs") {
    const porPapel = {};
    todosNPCs().forEach((n) => (porPapel[n.papel] = porPapel[n.papel] || []).push(n));
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
  if (aba === "consumiveis") corpo = `<p class="regra">Itens de uso único. Gastam-se ao serem usados e pedem um alvo quando curam — na mesa, pelo botão <b>🎒 Usar item</b>.</p>`
    + todosConsumiveis().map((c) => `<details class="det grande"><summary>${img(c.n)}<b>${c.ic} ${esc(c.n)}</b> · <b class="chrome">${c.p} CG</b> <span class="dim">(${esc(c.acao)})</span></summary>${imgFig(c.n)}<p>${esc(c.d)}</p>${c.dado ? `<p class="regra"><b class="tech-c">Efeito:</b> cura ${c.dado} no alvo.</p>` : ""}</details>`).join("");
  if (aba === "mecanicas") {
    const ms = extras("mecanicas");
    corpo = `<p class="regra">Regras, mecânicas e conteúdo acrescentados pela administração da mesa — sempre em dia com a última versão do livro.</p>`
      + (ms.length ? ms.map((m) => `<details class="det grande" open><summary>${img(m.titulo)}<b>${esc(m.titulo)}</b>${m.cat ? ` <span class="best-tag">${esc(m.cat)}</span>` : ""}</summary>${imgFig(m.titulo)}<div class="mec-corpo">${(m.texto || "").split("\n").filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join("")}</div></details>`).join("")
        : `<p class="regra"><i>Nenhuma mecânica adicional cadastrada ainda.</i></p>`);
  }
  const podeAdmin = !!perfil?.admin;
  shell("biblioteca", `
    <header class="masthead"><h1>BIBLIOTECA<span> DO SISTEMA</span></h1>
      <div class="mast-sub">Tudo do livro Passagem Sombria, pesquisável e completo${podeAdmin ? ` · <button id="abrir-admin" class="mini">🛠 Administrar conteúdo</button>` : ""}</div></header>
    <div class="filtros">${abas.map(([id2, l]) => `<a href="#/biblioteca/${id2}" class="${aba === id2 ? "on" : ""}">${l}</a>`).join("")}</div>
    <section class="sec">${corpo}</section>`, "biblioteca");
  document.getElementById("abrir-admin")?.addEventListener("click", () => painelAdmin(aba));
}

// ---------------------------------------------------------------------------
//  PAINEL DE ADMINISTRAÇÃO — conteúdo global, editável sem mexer no código
// ---------------------------------------------------------------------------
async function painelAdmin(voltarPara = "racas") {
  const C = await conteudoMod();
  const ov = document.createElement("div"); ov.className = "ss-overlay ov-modal"; ov.style.zIndex = "10000";
  let abaA = "imagens";
  const recarregar = async () => { C.limparCache(); await C.carregarConteudo(true); };

  const listarAlvos = () => {
    const g = [];
    g.push(["Criaturas", [...BESTIARIO, ...C.conteudo().criaturas].map((c) => c.n)]);
    g.push(["Armas", [...ARMAS, ...C.conteudo().armas].map((a) => a.n)]);
    g.push(["Armaduras", ARMADURAS.map((a) => a.n)]);
    g.push(["Implantes", IMPLANTES.map((i) => i.n)]);
    g.push(["Mecânicas", C.conteudo().mecanicas.map((m) => m.titulo)]);
    return g;
  };

  let roster = null, filtroRoster = "";
  const carregarRoster = async () => {
    const { data, error } = await sb.from("personagens")
      .select("id,nome,dados,campanha_id,atualizado_em,dono_id,perfis:dono_id(apelido)")
      .order("atualizado_em", { ascending: false }).limit(500);
    roster = error ? [] : (data || []);
  };
  const painelPessoas = () => {
    if (roster === null) { carregarRoster().then(() => pintar()); return `<p class="regra">Carregando fichas…</p>`; }
    const termo = filtroRoster.toLowerCase();
    const lista = roster.filter((p) => !termo
      || (p.nome || "").toLowerCase().includes(termo)
      || (p.perfis?.apelido || "").toLowerCase().includes(termo)
      || (p.dados?.raca || "").toLowerCase().includes(termo)
      || (p.dados?.classe || "").toLowerCase().includes(termo));
    const porDono = {};
    lista.forEach((p) => (porDono[p.perfis?.apelido || "sem dono"] = porDono[p.perfis?.apelido || "sem dono"] || []).push(p));
    const donos = Object.keys(porDono).sort((x, y) => x.localeCompare(y));
    return `<p class="regra">Todas as fichas criadas no app — <b>${roster.length}</b> personagem(ns) de <b>${donos.length}</b> tripulante(s). Visão somente leitura, para dar suporte e acompanhar a comunidade.</p>
      <input id="adm-busca" placeholder="Buscar por nome, jogador, raça ou classe…" value="${esc(filtroRoster)}" style="width:100%;margin-bottom:10px"/>
      ${donos.length ? donos.map((d2) => `<h4 class="adm-dono">${esc(d2)} <span class="dim">(${porDono[d2].length})</span></h4>
        ${porDono[d2].map((p) => { const fx = { ...novaFichaDados(), ...(p.dados || {}) }; const kx = calc(fx);
          const pv = fx.pvMax ? Math.max(0, Math.min(100, 100 * fx.pvAtual / fx.pvMax)) : 0;
          return `<div class="adm-pers">
            ${fx.foto ? `<img class="adm-retrato" src="${esc(fx.foto)}" alt=""/>` : `<div class="adm-retrato vazio">◈</div>`}
            <div class="adm-pers-info">
              <div><b>${esc(p.nome) || "— sem nome —"}</b> <span class="best-tag">NV ${fx.nivel || 1}</span>${p.campanha_id ? ` <span class="dim">☄ em campanha</span>` : ""}</div>
              <div class="regra">${esc(fx.raca || "raça?")} · ${esc(fx.classe || "classe?")}${fx.filosofia ? ` · ${esc(fx.filosofia)}` : ""}</div>
              <div class="adm-barras">
                <span class="cb-hp" title="PV"><span class="cb-hp-barra" style="width:${pv}%;background:var(--tech)"></span><b>${fx.pvAtual || 0}/${fx.pvMax || 0}</b></span>
                <span class="regra">CD ${kx.cd} · RAM ${kx.ramLivre}/${kx.ramMax} · ${fx.creditos ?? 0} CG</span>
              </div>
              <div class="regra dim">atualizada em ${new Date(p.atualizado_em).toLocaleDateString("pt-BR")}</div>
            </div>
            <button class="mini" data-ver="${p.id}">👁 Ver ficha</button>
          </div>`; }).join("")}`).join("")
        : `<p class="regra"><i>Nenhuma ficha encontrada${termo ? " para essa busca" : ""}.</i></p>`}`;
  };

  const painelImagens = () => {
    const imgs = C.conteudo().imagens;
    const chaves = Object.keys(imgs).sort();
    return `<p class="regra">Cole o endereço de uma imagem para ilustrar qualquer item do jogo. Sem imagem cadastrada, tudo aparece exatamente como hoje — nada quebra.</p>
      <button id="adm-img-nova" class="mini eq">➕ Vincular imagem</button>
      ${chaves.length ? `<div class="adm-grade">${chaves.map((k) => `<div class="adm-img"><img src="${esc(imgs[k])}" alt="" onerror="this.style.display='none'"/><span>${esc(k)}</span><button class="mini rm" data-img-del="${esc(k)}">✕</button></div>`).join("")}</div>`
        : `<p class="regra"><i>Nenhuma imagem vinculada ainda.</i></p>`}`;
  };
  const painelCriaturas = () => {
    const criadas = C.conteudo().criaturas || [];
    const nativas = C.comAjustes(BESTIARIO, "criatura");
    const termo = filtroTipo.toLowerCase();
    const filtra = (arr) => termo ? arr.filter((x) => `${x.n} ${x.categoria || ""} ${x.ameaca || ""}`.toLowerCase().includes(termo)) : arr;
    const cartao = (c, nativa) => { const autos = (c.habs || []).filter((h) => h.efeito).length;
      const nv = NIVEIS_AMEACA[c.ameaca] || { cor: "var(--dim)" };
      return `<div class="inv ${c._ajustado ? "ajustado" : ""}">
        <span><b>${esc(c.n)}</b>
          <span class="best-tag" style="color:${nv.cor};border-color:${nv.cor}">${esc(c.ameaca || "—")}</span>
          <span class="dim">${esc(c.categoria || "")}${c.hp != null ? ` · HP ${c.hp}` : ""}${c.cd != null ? ` · CD ${c.cd}` : ""}</span>
          ${autos ? `<span class="auto-tag">${autos} automática(s)</span>` : ""}
          ${c._ajustado ? `<span class="best-tag" style="color:var(--chrome);border-color:var(--chrome)">ajustada</span>` : ""}</span>
        <button class="mini" data-cri-ed="${nativa ? "n:" + esc(c.n) : c._id}" title="Editar">✎</button>
        ${nativa
          ? (c._ajustado ? `<button class="mini rm" data-restaurar="${c._ajusteId}" title="Voltar ao original do livro">↺</button>` : "")
          : `<button class="mini rm" data-cri-del="${c._id}">✕</button>`}</div>`; };
    const lNat = filtra(nativas), lCri = filtra(criadas);
    // agrupa as nativas por categoria, como no Bestiário
    const porCat = {};
    lNat.forEach((c) => (porCat[c.categoria || "Outras"] = porCat[c.categoria || "Outras"] || []).push(c));
    return `<p class="regra">Todas as criaturas do jogo. As do livro podem ser ajustadas — o original é preservado e o ↺ desfaz.
      Habilidades com <span class="auto-tag">automático</span> o app aplica sozinho no combate.</p>
      <div class="filtros" style="margin-bottom:8px">
        <button id="adm-cri-nova" class="mini eq">➕ Nova criatura</button>
        <input id="adm-filtro" placeholder="Filtrar por nome, categoria ou ameaça…" value="${esc(filtroTipo)}" style="flex:1;min-width:150px"/></div>
      ${lCri.length ? `<h4 class="adm-dono">Criadas por você <span class="dim">(${lCri.length})</span></h4>${lCri.map((c) => cartao(c, false)).join("")}` : ""}
      ${Object.keys(porCat).length ? Object.entries(porCat).map(([cat, arr]) =>
        `<h4 class="adm-dono">${esc(cat)} <span class="dim">(${arr.length})</span></h4>${arr.map((c) => cartao(c, true)).join("")}`).join("")
        : `<p class="regra"><i>Nada encontrado.</i></p>`}`;
  };

  // -------------------------------------------------------------------------
  //  EDITOR DE CRIATURA — ataques e habilidades com efeitos que o app executa.
  // -------------------------------------------------------------------------
  async function editorCriatura(existente, nativa = null) {
    const M = await criaturaMod();
    const base = nativa || existente;
    const c = base ? JSON.parse(JSON.stringify(base))
      : { n: "", categoria: "Personalizado", ameaca: "Comum", hp: 20, cd: 12, desloc: 9, nota: "", ataques: [], habs: [] };
    c.ataques = c.ataques || []; c.habs = c.habs || [];

    const GAT = [
      { v: "", l: "— sem automação (só texto para o Mestre) —" },
      { v: M.GATILHOS.INICIO_TURNO, l: "No início do turno dela" },
      { v: M.GATILHOS.FIM_TURNO, l: "No fim do turno dela" },
      { v: M.GATILHOS.AO_SOFRER, l: "Quando sofre qualquer dano" },
      { v: M.GATILHOS.AO_SOFRER_CORPO, l: "Quando sofre dano corpo a corpo" },
      { v: M.GATILHOS.AO_ACERTAR, l: "Quando acerta um ataque" },
      { v: M.GATILHOS.AO_MORRER, l: "Quando é derrotada" },
      { v: M.GATILHOS.AURA, l: "Passiva contínua (aura)" },
    ];
    const TIPOS_EF = [
      { v: "dano", l: "💥 Causa dano" },
      { v: "cura", l: "♻ Recupera PV" },
      { v: "condicao", l: "🏷 Aplica condição" },
      { v: "invocar", l: "👹 Invoca lacaios" },
      { v: "imunidade", l: "🛡 Imunidade / couraça" },
      { v: "zona", l: "🚫 Zona de negação" },
    ];

    const ov2 = document.createElement("div"); ov2.className = "ss-overlay ov-modal"; ov2.style.zIndex = "10010";
    const fechar2 = () => ov2.remove();

    const camposEfeito = (e) => {
      if (!e || !e.tipo) return "";
      if (e.tipo === "dano") return `<label>Dado de dano<input data-ef="dano" value="${esc(e.dano || "1d6")}" placeholder="1d6"/></label>
        <label>Em quem<select data-ef="alvo">${[["atacante", "quem a atingiu"], ["alvo", "no alvo dela"], ["todos_proximos", "todos por perto"]].map(([v, l]) => `<option value="${v}" ${e.alvo === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label>Tipo (opcional)<input data-ef="tipoDano" value="${esc(e.tipoDano || "")}" placeholder="ácido, fogo…"/></label>`;
      if (e.tipo === "cura") return `<label>PV fixos<input data-ef="valor" type="number" value="${e.valor ?? 0}"/></label>
        <label>ou dado<input data-ef="dado" value="${esc(e.dado || "")}" placeholder="1d6"/></label>`;
      if (e.tipo === "condicao") return `<label>Condição<select data-ef="cond">${CONDICOES.map((x) => `<option ${e.cond === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>
        <label>Turnos<input data-ef="turnos" type="number" value="${e.turnos ?? 1}" min="1"/></label>
        <label>CD para evitar<input data-ef="cd" type="number" value="${e.cd ?? ""}" placeholder="vazio = automático"/></label>`;
      if (e.tipo === "invocar") return `<label>Criatura invocada<input data-ef="criatura" value="${esc(e.criatura || "")}" placeholder="Enxame Adaptativo"/></label>
        <label>Quantidade (dado)<input data-ef="dado" value="${esc(e.dado || "1d4")}"/></label>`;
      if (e.tipo === "imunidade") return `<label>Imune a<input data-ef="a" value="${esc(e.a || "")}" placeholder="Cegueira"/></label>
        <label>Ignora dano abaixo de<input data-ef="limiar" type="number" value="${e.limiar ?? ""}" placeholder="ex: 10"/></label>`;
      if (e.tipo === "zona") return `<label>Raio (m)<input data-ef="raio" type="number" value="${e.raio ?? 15}"/></label>
        <label>Anula<input data-ef="nega" value="${esc((e.nega || []).join(", "))}" placeholder="cura, tecnomancia, implantes"/></label>`;
      return "";
    };

    const pintar2 = () => {
      const erros = M.validar(c);
      ov2.innerHTML = `<div class="ss-painel" style="width:660px;max-width:96vw;margin:auto;border:1px solid var(--line);border-radius:10px;max-height:94vh">
        <div class="mp-topo"><b>🐉 ${nativa ? `Ajustar ${esc(nativa.n || "")}` : existente ? "Editar criatura" : "Nova criatura"}</b>${nativa ? `<span class="dim" style="font-size:11px">criatura do livro — o original é preservado</span>` : ""}<button id="ed-x" class="mp-x" style="margin-left:auto">✕</button></div>
        <div class="di-corpo">
          <h4>Identidade</h4>
          <div class="ed-grade">
            <label>Nome<input id="ed-n" value="${esc(c.n)}"/></label>
            <label>Categoria<input id="ed-cat" value="${esc(c.categoria)}"/></label>
            <label>Ameaça<select id="ed-am">${Object.keys(NIVEIS_AMEACA).filter((x) => x !== "Ambiental").map((x) => `<option ${c.ameaca === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>
          </div>
          <div class="ed-grade">
            <label>HP<input id="ed-hp" type="number" value="${c.hp}"/></label>
            <label>Defesa (CD)<input id="ed-cd" type="number" value="${c.cd}"/></label>
            <label>Deslocamento (m)<input id="ed-de" type="number" value="${c.desloc}"/></label>
          </div>
          <label>Nota do Mestre<input id="ed-nota" value="${esc(c.nota || "")}" placeholder="tática, comportamento…"/></label>

          <h4 style="margin-top:16px">⚔ Ataques <button id="ed-atk-add" class="mini">＋</button></h4>
          ${c.ataques.length ? c.ataques.map((a2, i2) => `<div class="ed-item">
            <div class="ed-grade">
              <label>Nome<input data-atk="${i2}" data-k="n" value="${esc(a2.n || "")}"/></label>
              <label>Bônus de acerto<input data-atk="${i2}" data-k="bonus" type="number" value="${a2.bonus ?? 0}"/></label>
              <label>Dano<input data-atk="${i2}" data-k="dano" value="${esc(a2.dano || "1d6")}"/></label>
            </div>
            <label>Observação<input data-atk="${i2}" data-k="extra" value="${esc(a2.extra || "")}" placeholder="alcance, área, efeito…"/></label>
            <button class="mini rm" data-atk-del="${i2}">remover ataque</button></div>`).join("")
            : `<p class="regra"><i>Nenhum ataque.</i></p>`}

          <h4 style="margin-top:16px">✨ Habilidades <button id="ed-hab-add" class="mini">＋</button></h4>
          <p class="regra">Escolha um gatilho e um efeito para o app aplicar sozinho. Deixe o gatilho vazio se preferir que a habilidade seja só um lembrete de texto.</p>
          ${c.habs.length ? c.habs.map((h, i2) => `<div class="ed-item ${h.efeito ? "auto" : ""}">
            <label>Nome<input data-hab="${i2}" data-k="n" value="${esc(h.n || "")}"/></label>
            <label>Descrição<textarea data-hab="${i2}" data-k="d" rows="2">${esc(h.d || "")}</textarea></label>
            <div class="ed-grade">
              <label>Quando acontece<select data-hab="${i2}" data-k="gatilho">${GAT.map((g) => `<option value="${g.v}" ${(h.gatilho || "") === g.v ? "selected" : ""}>${g.l}</option>`).join("")}</select></label>
              ${h.gatilho ? `<label>O que faz<select data-hab="${i2}" data-k="eftipo">${TIPOS_EF.map((t) => `<option value="${t.v}" ${h.efeito?.tipo === t.v ? "selected" : ""}>${t.l}</option>`).join("")}</select></label>` : ""}
            </div>
            ${h.gatilho && h.efeito ? `<div class="ed-grade ed-efeito" data-hab-ef="${i2}">${camposEfeito(h.efeito)}</div>` : ""}
            <button class="mini rm" data-hab-del="${i2}">remover habilidade</button></div>`).join("")
            : `<p class="regra"><i>Nenhuma habilidade.</i></p>`}

          <div class="ed-erros-wrap">${erros.length ? `<div class="ed-erros"><b>Falta ajustar:</b><ul>${erros.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>`
            : `<p class="regra tech-c" style="margin-top:14px">✓ Criatura válida — pronta para entrar no bestiário.</p>`}</div>
        </div>
        <div class="cri-rodape"><button id="ed-cancel" class="mini">Cancelar</button>
          <span class="cri-dica">${(c.habs || []).filter((h) => h.efeito).length} habilidade(s) automática(s)</span>
          <button id="ed-salvar" class="btn-primario" ${erros.length ? "disabled" : ""}>${existente ? "Salvar" : "Criar criatura"}</button></div>
      </div>`;
      ligar2();
    };

    const ligar2 = () => {
      ov2.querySelector("#ed-x").onclick = fechar2;
      ov2.querySelector("#ed-cancel").onclick = fechar2;
      const bind = (id, campo, num) => { const el = ov2.querySelector(id); if (el) el.oninput = () => { c[campo] = num ? +el.value : el.value; }; };
      bind("#ed-n", "n"); bind("#ed-cat", "categoria"); bind("#ed-nota", "nota");
      bind("#ed-hp", "hp", 1); bind("#ed-cd", "cd", 1); bind("#ed-de", "desloc", 1);
      ov2.querySelector("#ed-am").onchange = (e) => { c.ameaca = e.target.value; };

      ov2.querySelector("#ed-atk-add").onclick = () => { c.ataques.push({ n: "", bonus: 4, dano: "1d6", extra: "" }); pintar2(); };
      ov2.querySelectorAll("[data-atk-del]").forEach((b) => b.onclick = () => { c.ataques.splice(+b.dataset.atkDel, 1); pintar2(); });
      ov2.querySelectorAll("[data-atk]").forEach((el) => el.oninput = () => {
        const a2 = c.ataques[+el.dataset.atk]; if (a2) a2[el.dataset.k] = el.dataset.k === "bonus" ? +el.value : el.value; });

      ov2.querySelector("#ed-hab-add").onclick = () => { c.habs.push({ n: "", d: "", gatilho: "" }); pintar2(); };
      ov2.querySelectorAll("[data-hab-del]").forEach((b) => b.onclick = () => { c.habs.splice(+b.dataset.habDel, 1); pintar2(); });
      ov2.querySelectorAll("[data-hab]").forEach((el) => {
        const h = c.habs[+el.dataset.hab]; if (!h) return;
        const k = el.dataset.k;
        if (k === "gatilho") el.onchange = () => { h.gatilho = el.value;
          if (!h.gatilho) delete h.efeito; else if (!h.efeito) h.efeito = { tipo: "dano", dano: "1d6", alvo: "atacante" };
          pintar2(); };
        else if (k === "eftipo") el.onchange = () => { h.efeito = { tipo: el.value }; pintar2(); };
        else el.oninput = () => { h[k] = el.value; };
      });
      ov2.querySelectorAll("[data-hab-ef]").forEach((box) => {
        const h = c.habs[+box.dataset.habEf]; if (!h?.efeito) return;
        box.querySelectorAll("[data-ef]").forEach((el) => el.oninput = () => {
          const campo = el.dataset.ef; let v = el.value;
          if (["turnos", "cd", "valor", "limiar", "raio"].includes(campo)) v = v === "" ? undefined : +v;
          if (campo === "nega") v = v.split(",").map((x) => x.trim()).filter(Boolean);
          if (v === undefined || v === "") delete h.efeito[campo]; else h.efeito[campo] = v;
          const dica = ov2.querySelector(".cri-dica");
          if (dica) dica.textContent = `${c.habs.filter((x) => x.efeito).length} habilidade(s) automática(s)`;
        });
      });

      ov2.querySelector("#ed-salvar").onclick = async () => {
        if (M.validar(c).length) return;
        if (nativa) {
          const orig = nativa._orig || nativa;
          const dif = diferencas(c, orig);
          if (!Object.keys(dif).length) return fechar2();
          if (await salvarAjuste("criatura", orig.n, dif)) { fechar2(); pintar(); }
        } else if (await salvar("criatura", c, null, existente?._id)) { fechar2(); pintar(); }
      };
    };
    document.body.appendChild(ov2); pintar2();
  }
  // -------------------------------------------------------------------------
  //  EDITOR DE EFEITOS — componente reutilizável. Qualquer item do jogo (arma,
  //  armadura, implante, consumível, nave, NPC) declara efeitos por aqui, e o
  //  motor passa a aplicá-los sozinho. Sem código, sem esperar por deploy.
  // -------------------------------------------------------------------------
  const TIPOS_EFEITO = [
    { v: "atributo", l: "△ Modifica atributo" },
    { v: "defesa", l: "🛡 Modifica Defesa" },
    { v: "ram", l: "◈ Modifica RAM" },
    { v: "iniciativa", l: "🎯 Modifica Iniciativa" },
    { v: "deslocamento", l: "🏃 Modifica Deslocamento" },
    { v: "pericia", l: "% Modifica perícia" },
    { v: "conjuracao", l: "⚡ Modifica Conjuração" },
    { v: "acerto", l: "◎ Modifica acerto de ataque" },
    { v: "dano", l: "💥 Modifica dano de ataque" },
    { v: "vantagem", l: "▲ Concede Vantagem" },
    { v: "imunidade", l: "🚫 Concede imunidade" },
    { v: "recurso", l: "★ Habilidade por descanso" },
  ];
  const camposDoEfeito = (e, i) => {
    const num = (k, lbl, val, ph) => `<label>${lbl}<input data-ef="${i}" data-c="${k}" type="number" value="${val ?? ""}" placeholder="${ph || ""}"/></label>`;
    const txt = (k, lbl, val, ph) => `<label>${lbl}<input data-ef="${i}" data-c="${k}" value="${esc(val || "")}" placeholder="${ph || ""}"/></label>`;
    const sel = (k, lbl, val, ops) => `<label>${lbl}<select data-ef="${i}" data-c="${k}">${ops.map((o) => `<option value="${o.v}" ${val === o.v ? "selected" : ""}>${o.l}</option>`).join("")}</select></label>`;
    const CONTRA = [{ v: "", l: "sempre" }, { v: "branca", l: "só armas brancas" }, { v: "fogo", l: "só armas de fogo" }, { v: "robos", l: "só contra sintéticos" }];
    switch (e.tipo) {
      case "atributo": return sel("attr", "Atributo", e.attr, ["For", "Des", "Con", "Int", "Sab", "Car"].map((a) => ({ v: a, l: a }))) + num("valor", "Quanto", e.valor, "ex: 2");
      case "pericia": return sel("pericia", "Perícia", e.pericia, PERICIAS.map(([p]) => ({ v: p, l: p }))) + num("valor", "Quanto", e.valor);
      case "deslocamento": return sel("modo", "Como", e.modo || "soma", [{ v: "soma", l: "soma metros" }, { v: "dobra", l: "dobra o total" }]) + (e.modo === "dobra" ? "" : num("valor", "Metros", e.valor));
      case "acerto": case "dano": return num("valor", "Quanto", e.valor) + sel("contra", "Quando", e.contra || "", CONTRA);
      case "vantagem": return sel("em", "Em que", e.em || "ataque", [{ v: "ataque", l: "ataques" }, { v: "pericia", l: "uma perícia" }]) + (e.em === "pericia" ? sel("pericia", "Qual", e.pericia, PERICIAS.map(([p]) => ({ v: p, l: p }))) : "");
      case "imunidade": return txt("a", "Imune a", e.a, "queda, ser derrubado, Cegueira…");
      case "recurso": return txt("n", "Nome", e.n, "Fôlego de Aço") + sel("freq", "Recarrega em", e.freq || "longo", [{ v: "curto", l: "descanso curto" }, { v: "longo", l: "descanso longo" }, { v: "sessao", l: "por sessão" }]);
      default: return num("valor", "Quanto", e.valor, "ex: 2");
    }
  };
  // Devolve o HTML do bloco de efeitos e liga os eventos depois via ligarEfeitos.
  const blocoEfeitos = (item) => {
    item.efeitos = item.efeitos || [];
    return `<h4 style="margin-top:14px">⚙ Efeitos automáticos <button class="mini" data-ef-add="1">＋</button></h4>
      <p class="regra">O que o app deve aplicar sozinho. Deixe vazio se o item for só narrativo — o texto continua aparecendo para a mesa.</p>
      ${item.efeitos.length ? item.efeitos.map((e, i) => `<div class="ed-item auto">
        <div class="ed-grade">
          <label>O que faz<select data-ef="${i}" data-c="tipo">${TIPOS_EFEITO.map((t) => `<option value="${t.v}" ${e.tipo === t.v ? "selected" : ""}>${t.l}</option>`).join("")}</select></label>
          <label>Quando<select data-ef="${i}" data-c="momento">
            <option value="ficha" ${(e.momento || "ficha") === "ficha" ? "selected" : ""}>Sempre (nos números da ficha)</option>
            <option value="ao_atacar" ${e.momento === "ao_atacar" ? "selected" : ""}>Ao atacar</option>
            <option value="ao_sofrer" ${e.momento === "ao_sofrer" ? "selected" : ""}>Ao sofrer dano</option></select></label>
        </div>
        <div class="ed-grade ed-efeito">${camposDoEfeito(e, i)}</div>
        <button class="mini rm" data-ef-del="${i}">remover efeito</button></div>`).join("")
        : `<p class="regra"><i>Nenhum efeito automático.</i></p>`}
<div class="ed-erros-wrap">${(() => { const erros = item.efeitos.length ? validarEfeitos(item.efeitos) : [];
        return erros.length ? `<div class="ed-erros"><b>Ajuste antes de salvar:</b><ul>${erros.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""; })()}</div>`;
  };
  // Revalida e atualiza só a caixa de erros + o botão de salvar, sem redesenhar
  // o formulário inteiro — редesenhar a cada tecla perderia o foco do campo.
  const revalidarEfeitos = (raiz, item) => {
    const box = raiz.querySelector(".ed-erros-wrap");
    const erros = (item.efeitos || []).length ? validarEfeitos(item.efeitos) : [];
    if (box) box.innerHTML = erros.length
      ? `<div class="ed-erros"><b>Ajuste antes de salvar:</b><ul>${erros.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "";
    const salvarBtn = raiz.querySelector("#ed-salvar, #it-salvar");
    if (salvarBtn) salvarBtn.disabled = erros.length > 0 || salvarBtn.dataset.semEfeito === "1";
    return erros;
  };
  const ligarEfeitos = (raiz, item, repintar) => {
    raiz.querySelector("[data-ef-add]")?.addEventListener("click", () => {
      item.efeitos = item.efeitos || []; item.efeitos.push({ tipo: "defesa", valor: 1, momento: "ficha" }); repintar(); });
    raiz.querySelectorAll("[data-ef-del]").forEach((b) => b.onclick = () => { item.efeitos.splice(+b.dataset.efDel, 1); repintar(); });
    raiz.querySelectorAll("[data-ef]").forEach((el) => {
      const e = item.efeitos[+el.dataset.ef]; if (!e) return;
      const c = el.dataset.c;
      const grande = ["tipo", "momento", "modo", "em"].includes(c);
      const ev = grande ? "onchange" : (el.tagName === "SELECT" ? "onchange" : "oninput");
      el[ev] = () => {
        let v = el.value;
        if (["valor"].includes(c)) v = v === "" ? undefined : +v;
        if (c === "tipo") { item.efeitos[+el.dataset.ef] = { tipo: v, momento: e.momento || "ficha" }; return repintar(); }
        if (v === "" || v === undefined) delete e[c]; else e[c] = v;
        if (grande) repintar(); else revalidarEfeitos(raiz, item);
      };
    });
    revalidarEfeitos(raiz, item);   // estado correto assim que o formulário abre
  };

  // Esquema de cada tipo de conteúdo: só os campos próprios; efeitos são comuns.
  const ESQUEMAS = {
    arma: { rot: "Arma", ic: "⚔", campos: [
      ["n", "Nome", "texto"], ["tipo", "Tipo", "select", [{ v: "branca", l: "Branca" }, { v: "fogo", l: "De fogo" }]],
      ["dano", "Dano", "texto", null, "1d8"], ["attr", "Atributo", "select", [{ v: "For", l: "Força" }, { v: "Des", l: "Destreza" }]],
      ["escala", "Progressão por nível", "escala"],
      ["kw", "Palavras-chave", "kwpick"],
      ["preco", "Preço (CG)", "numero"],
      ["desc", "Descrição", "area"]] },
    armadura: { rot: "Armadura", ic: "🛡", campos: [
      ["n", "Nome", "texto"], ["t", "Peso", "select", [{ v: "leve", l: "Leve" }, { v: "media", l: "Média" }, { v: "pesada", l: "Pesada" }]],
      ["cd", "Bônus de CD", "numero"], ["preco", "Preço (CG)", "numero"], ["e", "Efeito (texto)", "texto"], ["desc", "Descrição", "area"]] },
    implante: { rot: "Implante", ic: "⧉", campos: [
      ["n", "Nome", "texto"], ["g", "Local", "select", [{ v: "Cabeça", l: "Cabeça" }, { v: "Torso", l: "Torso" }, { v: "Membros", l: "Membros" }, { v: "Olhos", l: "Olhos" }]],
      ["p", "Preço (CG)", "numero"], ["e", "Efeito (texto)", "texto"]] },
    consumivel: { rot: "Consumível", ic: "🎒", campos: [
      ["n", "Nome", "texto"], ["ic", "Ícone", "texto", null, "✚"], ["p", "Preço (CG)", "numero"],
      ["acao", "Ação necessária", "select", [{ v: "Ação Principal", l: "Ação Principal" }, { v: "Ação de Movimento", l: "Ação de Movimento" }, { v: "Ação Livre", l: "Ação Livre" }]],
      ["efeito", "Efeito mecânico", "select", [{ v: "nenhum", l: "Nenhum (narrativo)" }, { v: "cura", l: "Cura" }, { v: "ram", l: "Recupera RAM" }, { v: "condicao", l: "Aplica condição" }, { v: "sangramento", l: "Estanca sangramento" }]],
      ["dado", "Dado (se cura)", "texto", null, "1d8"], ["cond", "Condição (se aplica)", "texto"],
      ["turnos", "Turnos", "numero"], ["d", "Descrição", "area"]] },
    nave: { rot: "Nave", ic: "🚀", campos: [
      ["n", "Nome", "texto"], ["casco", "Casco", "numero"], ["escudos", "Escudos", "numero"],
      ["manobra", "Manobrabilidade", "numero"], ["dano", "Dano", "texto", null, "4d10"],
      ["trip", "Tripulação", "texto"], ["desc", "Descrição", "area"]] },
    raca: { rot: "Raça", ic: "🌌", campos: [
      ["nome", "Nome", "texto"], ["planeta", "Planeta", "texto"], ["titulo", "Epíteto", "texto"],
      ["dadoVida", "Dado de vida (d?)", "numero"], ["vidaMod", "Modificador de vida", "numero"],
      ["For", "Força", "numero"], ["Des", "Destreza", "numero"], ["Con", "Constituição", "numero"],
      ["Int", "Inteligência", "numero"], ["Sab", "Sabedoria", "numero"], ["Car", "Carisma", "numero"],
      ["lore", "Descrição", "area"]] },
    classe: { rot: "Classe", ic: "⚔", campos: [
      ["nome", "Nome", "texto"], ["pv", "PV base", "numero"]] },
    chave: { rot: "Palavra-chave", ic: "🏷", campos: [
      ["n", "Nome da palavra-chave", "texto", null, "Perfurante"],
      ["d", "O que significa", "area"],
      ["marca", "Marca especial", "select", [{ v: "", l: "nenhuma" }, { v: "agil", l: "Ágil (usa Destreza)" }, { v: "oculta", l: "Oculta (furtiva)" }, { v: "brutal", l: "Brutal (vantagem)" }, { v: "area", l: "Área" }, { v: "alcance", l: "Alcance estendido" }]],
      ["ignoraArmadura", "Ignora armadura (pontos)", "numero"],
      ["cond", "Condição ao acertar", "select", [{ v: "", l: "nenhuma" }, ...CONDICOES.map((c) => ({ v: c, l: c }))]],
      ["turnos", "Turnos da condição", "numero"],
      ["cd", "CD para evitar", "numero"]] },
    npc: { rot: "NPC", ic: "👤", campos: [
      ["n", "Nome", "texto"], ["papel", "Papel", "select", Object.keys(PAPEIS).map((p) => ({ v: p, l: p }))],
      ["raca", "Raça", "texto"], ["local", "Onde encontrar", "texto"], ["faccao", "Facção", "texto"],
      ["atitude", "Atitude", "select", [{ v: "Amigável", l: "Amigável" }, { v: "Neutro", l: "Neutro" }, { v: "Frio", l: "Frio" }, { v: "Hostil", l: "Hostil" }]],
      ["gancho", "Gancho de cena", "area"], ["fala", "Uma fala típica", "texto"],
      ["oferece", "O que oferece", "texto"], ["quer", "O que quer", "texto"], ["segredo", "Segredo (só o Mestre)", "area"]] },
  };

  async function editorItem(tipo, existente, nativo = null) {
    const esq = ESQUEMAS[tipo];
    const base = nativo || existente;
    const it = base ? JSON.parse(JSON.stringify(base)) : { efeitos: [] };
    it.efeitos = it.efeitos || [];
    const ov2 = document.createElement("div"); ov2.className = "ss-overlay ov-modal"; ov2.style.zIndex = "10010";
    const fechar2 = () => ov2.remove();
    const campo = ([k, lbl, t, ops, ph]) => {
      const v = it[k];
      if (t === "escala") {
        const esc2 = it.escala || {};
        const marcos = Object.keys(esc2).map(Number).sort((x, y) => x - y);
        return `<div class="kw-campo"><label style="margin-bottom:4px">${lbl}</label>
          <p class="regra">Deixe vazio para dano fixo. Preenchendo, a arma passa a subir de dado nos níveis indicados —
            é assim que funcionam as Tatuagens de Nano-Enxame, e qualquer arma pode ter isso.</p>
          <div class="escala-edit">
            <div class="escala-faixa"><i>NV 1+</i><b>${esc(it.dano || "—")}</b><span class="dim">dano base</span></div>
            ${[5, 9].map((nv) => `<div class="escala-faixa ${esc2[nv] ? "atual" : ""}">
              <i>a partir do NV ${nv}</i>
              <input data-escala="${nv}" value="${esc(esc2[nv] || "")}" placeholder="—" style="width:74px;text-align:center"/>
            </div>`).join("")}
            ${marcos.filter((m) => ![5, 9].includes(m)).map((m) => `<div class="escala-faixa atual">
              <i>a partir do NV ${m}</i><input data-escala="${m}" value="${esc(esc2[m])}" style="width:74px;text-align:center"/></div>`).join("")}
          </div>
          <p class="regra">Marcos sugeridos: <b>5</b> (Veterano) e <b>9</b> (Lenda), os mesmos da progressão de carreira.</p></div>`;
      }
      if (t === "kwpick") {
        const sel = String(v || "").split(/,|·/).map((x) => x.trim()).filter(Boolean);
        return `<div class="kw-campo"><label style="margin-bottom:4px">${lbl}</label>
          <p class="regra">Marque quantas quiser. As que têm <span class="auto-tag">automático</span> o app aplica sozinho no combate.</p>
          <div class="kw-pick">${Object.keys(PALAVRAS_CHAVE).sort((x, y) => x.localeCompare(y)).map((nome) => {
            const def = PALAVRAS_CHAVE[nome]; const marcado = sel.includes(nome);
            const autos = [];
            if (def.aoAcertar) autos.push(`aplica ${def.aoAcertar.cond}`);
            if (def.ignoraArmadura) autos.push(`ignora ${def.ignoraArmadura} de armadura`);
            if ((def.efeitos || []).length) autos.push("modifica o ataque");
            if (def.props?.agil) autos.push("usa Destreza");
            if (def.props?.area) autos.push("área");
            return `<label class="kw-op ${marcado ? "on" : ""}">
              <input type="checkbox" data-kw="${esc(nome)}" ${marcado ? "checked" : ""}/>
              <span class="kw-op-txt"><b>${esc(nome)}</b>
                <span>${esc(KEYWORDS[nome] || "sem descrição")}</span>
                ${autos.length ? `<span class="auto-tag">${esc(autos.join(" · "))}</span>` : ""}</span></label>`; }).join("")}</div></div>`;
      }
      if (t === "area") return `<label>${lbl}<textarea data-k="${k}" rows="3">${esc(v || "")}</textarea></label>`;
      if (t === "select") return `<label>${lbl}<select data-k="${k}">${(ops || []).map((o) => `<option value="${o.v}" ${v === o.v ? "selected" : ""}>${o.l}</option>`).join("")}</select></label>`;
      if (t === "numero") return `<label>${lbl}<input data-k="${k}" type="number" value="${v ?? ""}"/></label>`;
      return `<label>${lbl}<input data-k="${k}" value="${esc(v || "")}" placeholder="${esc(ph || "")}"/></label>`;
    };
    const pintar2 = () => {
      const faltaNome = !String(it.n || "").trim();
      const errosEf = (it.efeitos || []).length ? validarEfeitos(it.efeitos) : [];
      ov2.innerHTML = `<div class="ss-painel" style="width:640px;max-width:96vw;margin:auto;border:1px solid var(--line);border-radius:10px;max-height:94vh">
        <div class="mp-topo"><b>${esq.ic} ${nativo ? `Ajustar ${esc(nativo.n || "")}` : existente ? "Editar" : `Novo ${esq.rot.toLowerCase()}`}</b>${nativo ? `<span class="dim" style="font-size:11px">item do livro — o original é preservado</span>` : ""}<button id="it-x" class="mp-x" style="margin-left:auto">✕</button></div>
        <div class="di-corpo">
          <div class="ed-grade">${esq.campos.filter((c) => c[2] !== "area" && c[2] !== "kwpick").map(campo).join("")}</div>
          ${esq.campos.filter((c) => c[2] === "kwpick").map(campo).join("")}
          ${esq.campos.filter((c) => c[2] === "area").map(campo).join("")}
          ${blocoEfeitos(it)}
          <div class="ed-nome-erro" style="display:${faltaNome ? "" : "none"}"><div class="ed-erros">Dê um nome ao ${esq.rot.toLowerCase()}.</div></div>
        </div>
        <div class="cri-rodape"><button id="it-cancel" class="mini">Cancelar</button>
          <span class="cri-dica">${(it.efeitos || []).length} efeito(s) automático(s)</span>
          <button id="it-salvar" class="btn-primario" ${faltaNome || errosEf.length ? "disabled" : ""}>${existente ? "Salvar" : "Criar"}</button></div></div>`;
      ov2.querySelector("#it-x").onclick = fechar2;
      ov2.querySelector("#it-cancel").onclick = fechar2;
      ov2.querySelectorAll("[data-k]").forEach((el) => {
        const k = el.dataset.k;
        const isNum = esq.campos.find((c) => c[0] === k)?.[2] === "numero";
        const ev = el.tagName === "SELECT" ? "onchange" : "oninput";
        el[ev] = () => { it[k] = isNum ? (el.value === "" ? undefined : +el.value) : el.value;
          if (k === "n") {
            const bt = ov2.querySelector("#it-salvar");
            const semNome = !String(it.n || "").trim();
            if (bt) bt.disabled = semNome || ((item.efeitos || it.efeitos || []).length ? validarEfeitos(it.efeitos).length > 0 : false);
            const avisoNome = ov2.querySelector(".ed-nome-erro");
            if (avisoNome) avisoNome.style.display = semNome ? "" : "none";
          }
        };
      });
      ov2.querySelectorAll("[data-escala]").forEach((el) => el.oninput = () => {
        const nv = el.dataset.escala; const v = el.value.trim();
        it.escala = it.escala || {};
        if (v) it.escala[nv] = v; else delete it.escala[nv];
        if (!Object.keys(it.escala).length) delete it.escala;
      });
      ov2.querySelectorAll("[data-kw]").forEach((cb) => cb.onchange = () => {
        const atuais = String(it.kw || "").split(/,|·/).map((x) => x.trim()).filter(Boolean);
        const nome = cb.dataset.kw;
        const novos = cb.checked ? [...new Set([...atuais, nome])] : atuais.filter((x) => x !== nome);
        it.kw = novos.join(", ");
        cb.closest(".kw-op")?.classList.toggle("on", cb.checked);
      });
      ligarEfeitos(ov2, it, pintar2);
      ov2.querySelector("#it-salvar").onclick = async () => {
        if (!String(it.n || "").trim()) return;
        // completa o que o app espera para cada tipo
        if (tipo === "arma") { it.tipo = it.tipo || "branca"; it.per = it.tipo === "fogo" ? "Armas de Fogo" : "Armas Brancas"; it.attr = it.attr || "For"; }
        if (tipo === "npc") it.papel = it.papel || "Contato";
        if (nativo) {
          const orig = nativo._orig || nativo;
          const dif = diferencas(it, orig);
          if (!Object.keys(dif).length) return fechar2();
          if (await salvarAjuste(tipo, orig.n || orig.nome, dif)) { fechar2(); pintar(); }
        } else if (await salvar(tipo, it, null, existente?._id)) { fechar2(); pintar(); }
      };
    };
    document.body.appendChild(ov2); pintar2();
  }

  // Listas nativas por tipo, para o painel poder editá-las também.
  const NATIVOS = {
    arma: () => ARMAS, armadura: () => ARMADURAS, implante: () => IMPLANTES,
    consumivel: () => CONSUMIVEIS, nave: () => NAVES, npc: () => NPCS,
    criatura: () => BESTIARIO, chave: () => Object.keys(PALAVRAS_CHAVE).map((n2) => ({ n: n2, d: KEYWORDS[n2] || "" })),
    raca: () => RACAS.map((r) => ({ ...r, n: r.nome, ...r.attrs })),
    classe: () => Object.entries(CLASSES).map(([nome, c]) => ({ ...c, n: nome, nome })),
  };
  let filtroTipo = "";

  // Painel genérico: mostra o que veio no jogo e o que você criou, tudo editável.
  const painelTipo = (tipo) => {
    const esq = ESQUEMAS[tipo];
    const criados = C.conteudo()[tipo + "s"] || [];
    const nativos = C.comAjustes((NATIVOS[tipo] || (() => []))(), tipo);
    const termo = filtroTipo.toLowerCase();
    const filtra = (arr) => termo ? arr.filter((x) => String(x.n || "").toLowerCase().includes(termo)) : arr;
    const cartao = (x, nativo) => `<div class="inv ${x._ajustado ? "ajustado" : ""}">
      <span><b>${esc(x.n)}</b>
        ${x.dano ? `<span class="chrome">${esc(x.dano)}</span>` : ""}
        ${x.preco || x.p ? `<span class="dim">${x.preco || x.p} CG</span>` : ""}
        ${(x.efeitos || []).length ? `<span class="auto-tag">${x.efeitos.length} automático(s)</span>` : ""}
        ${x._ajustado ? `<span class="best-tag" style="color:var(--chrome);border-color:var(--chrome)">ajustado</span>` : ""}</span>
      <button class="mini" data-ed="${tipo}|${nativo ? "n:" + esc(x.n) : x._id}" title="Editar">✎</button>
      ${nativo
        ? (x._ajustado ? `<button class="mini rm" data-restaurar="${x._ajusteId}" title="Voltar ao original do livro">↺</button>` : "")
        : `<button class="mini rm" data-del="${x._id}" title="Apagar">✕</button>`}</div>`;
    const listaNat = filtra(nativos), listaCri = filtra(criados);
    return `<p class="regra">Tudo o que existe deste tipo. Os itens do livro podem ser ajustados — o original nunca é perdido, e o botão ↺ desfaz a mudança.</p>
      <div class="filtros" style="margin-bottom:8px">
        <button class="mini eq" data-novo="${tipo}">➕ ${esq.ic} Novo ${esq.rot.toLowerCase()}</button>
        <input id="adm-filtro" placeholder="Filtrar por nome…" value="${esc(filtroTipo)}" style="flex:1;min-width:140px"/></div>
      ${listaCri.length ? `<h4 class="adm-dono">Criados por você <span class="dim">(${listaCri.length})</span></h4>${listaCri.map((x) => cartao(x, false)).join("")}` : ""}
      <h4 class="adm-dono">Do livro <span class="dim">(${listaNat.length})</span></h4>
      ${listaNat.length ? listaNat.map((x) => cartao(x, true)).join("") : `<p class="regra"><i>Nada encontrado.</i></p>`}`;
  };

  const painelArmas = () => {
    const as = C.conteudo().armas;
    return `<p class="regra">Armas próprias, que entram no Arsenal e ficam disponíveis nas fichas.</p>
      <button id="adm-arm-nova" class="mini eq">➕ Nova arma</button>
      ${as.length ? as.map((a) => `<div class="inv"><span><b>${esc(a.n)}</b> · ${esc(a.dano || "?")} · ${esc(a.tipo || "?")}${a.preco ? ` · ${a.preco} CG` : ""}</span><button class="mini rm" data-arm-del="${a._id}">✕</button></div>`).join("") : `<p class="regra"><i>Nenhuma arma própria.</i></p>`}`;
  };
  const painelMecanicas = () => {
    const ms = C.conteudo().mecanicas;
    return `<p class="regra">Regras e mecânicas novas do livro. Aparecem na aba <b>Mecânicas</b> da Biblioteca para todos os jogadores.</p>
      <button id="adm-mec-nova" class="mini eq">➕ Nova mecânica</button>
      ${ms.length ? ms.map((m) => `<div class="inv"><span><b>${esc(m.titulo)}</b>${m.cat ? ` · ${esc(m.cat)}` : ""}</span><button class="mini" data-mec-ed="${m._id}">✎</button><button class="mini rm" data-mec-del="${m._id}">✕</button></div>`).join("") : `<p class="regra"><i>Nenhuma mecânica cadastrada.</i></p>`}`;
  };

  // Grava um ajuste sobre item nativo. Procura antes de gravar em vez de usar
  // ON CONFLICT: assim funciona mesmo que o índice de unicidade não exista.
  const salvarAjuste = async (tipo, nome, dif) => {
    const chave = `${tipo}:${nome}`;
    const { data: ja } = await sb.from("conteudo").select("id").eq("tipo", "ajuste").eq("chave", chave).maybeSingle();
    const linha = { tipo: "ajuste", chave, dados: { dados_ajustados: dif },
      criado_por: usuario.id, atualizado_em: new Date().toISOString() };
    const { error } = ja
      ? await sb.from("conteudo").update(linha).eq("id", ja.id)
      : await sb.from("conteudo").insert(linha);
    if (error) { alert("Não consegui salvar o ajuste: " + error.message); return false; }
    await recarregar(); sincronizarExtra(); return true;
  };
  // O que mudou em relação ao original — só isso é guardado.
  const diferencas = (novo, orig) => {
    const dif = {};
    for (const k of Object.keys(novo)) {
      if (k.startsWith("_")) continue;
      if (JSON.stringify(novo[k]) !== JSON.stringify(orig[k])) dif[k] = novo[k];
    }
    return dif;
  };

  const salvar = async (tipo, dados, chave = null, id2 = null) => {
    const linha = { tipo, chave, dados, criado_por: usuario.id, atualizado_em: new Date().toISOString() };
    let q;
    if (id2) q = sb.from("conteudo").update(linha).eq("id", id2);
    else if (tipo === "imagem" && chave) {
      const { data: ja } = await sb.from("conteudo").select("id").eq("tipo", "imagem").eq("chave", chave).maybeSingle();
      q = ja ? sb.from("conteudo").update(linha).eq("id", ja.id) : sb.from("conteudo").insert(linha);
    } else q = sb.from("conteudo").insert(linha);
    const { error } = await q;
    if (error) { alert("Não consegui salvar: " + error.message); return false; }
    await recarregar(); sincronizarExtra(); return true;
  };
  const apagar = async (id2) => { const { error } = await sb.from("conteudo").delete().eq("id", id2); if (error) return alert("Não consegui apagar: " + error.message); await recarregar(); };

  const pintar = () => {
    const abas = [["pessoas", "👥 Personagens"], ["imagens", "🖼 Imagens"], ["criaturas", "🐉 Criaturas"], ["arma", "⚔ Armas"], ["armadura", "🛡 Armaduras"], ["implante", "⧉ Implantes"], ["consumivel", "🎒 Consumíveis"], ["nave", "🚀 Naves"], ["npc", "👤 NPCs"], ["chave", "🏷 Palavras-chave"], ["raca", "🌌 Raças"], ["classe", "⚔ Classes"], ["mecanicas", "📜 Mecânicas"]];
    ov.innerHTML = `<div class="ss-painel" style="width:680px;max-width:96vw;margin:auto;border:1px solid var(--line);border-radius:10px;max-height:94vh">
      <div class="mp-topo"><b>🛠 Administrar conteúdo</b><button id="adm-x" class="mp-x" style="margin-left:auto">✕</button></div>
      <div class="filtros" style="padding:8px 14px;border-bottom:1px solid var(--line);flex-wrap:wrap">
        ${abas.map(([k, l]) => `<button class="mini ${abaA === k ? "on" : ""}" data-adm="${k}">${l}</button>`).join("")}</div>
      <div class="di-corpo">${ESQUEMAS[abaA] ? painelTipo(abaA) : ({ pessoas: painelPessoas, imagens: painelImagens, criaturas: painelCriaturas, mecanicas: painelMecanicas }[abaA])()}</div></div>`;
    ov.querySelector("#adm-x").onclick = fechar;
    ov.querySelectorAll("[data-adm]").forEach((b) => b.onclick = () => { abaA = b.dataset.adm; pintar(); });
    const busca = ov.querySelector("#adm-busca");
    if (busca) { busca.oninput = () => { filtroRoster = busca.value; const pos = busca.selectionStart; pintar();
      const nb = ov.querySelector("#adm-busca"); if (nb) { nb.focus(); nb.setSelectionRange(pos, pos); } }; }
    ov.querySelectorAll("[data-ver]").forEach((b) => b.onclick = () => {
      const p = (roster || []).find((x) => x.id === b.dataset.ver); if (!p) return;
      const fx = { ...novaFichaDados(), ...(p.dados || {}) };
      const html = gerarFichaHTML(p.nome, fx, calc(fx));
      const w = window.open("", "_blank");
      if (w) { w.document.write(html); w.document.close(); }
      else imprimirFichaHTML(html);
    });

    ov.querySelector("#adm-img-nova")?.addEventListener("click", async () => {
      const grupos = listarAlvos();
      const r = await modalForm({ titulo: "🖼 Vincular imagem", descricao: "Escolha o item e cole o endereço da imagem (Imgur, Drive público, qualquer host).",
        campos: [
          { k: "alvo", label: "Item", tipo: "select", opcoes: grupos.flatMap(([g, itens]) => itens.map((n) => ({ v: n, l: `${g}: ${n}` }))) },
          { k: "url", label: "URL da imagem", tipo: "texto" },
        ], okLabel: "Vincular" });
      if (!r || !r.url) return;
      if (await salvar("imagem", { url: r.url.trim() }, r.alvo.toLowerCase())) pintar();
    });
    ov.querySelectorAll("[data-img-del]").forEach((b) => b.onclick = async () => {
      const { error } = await sb.from("conteudo").delete().eq("tipo", "imagem").eq("chave", b.dataset.imgDel);
      if (error) return alert(error.message); await recarregar(); pintar();
    });

    ov.querySelectorAll("[data-novo]").forEach((b) => b.onclick = () => editorItem(b.dataset.novo, null));
    ov.querySelectorAll("[data-ed]").forEach((b) => b.onclick = () => {
      const [tipo, ref] = b.dataset.ed.split("|");
      if (ref.startsWith("n:")) {                    // item do livro
        const nome = ref.slice(2);
        const orig = ((NATIVOS[tipo] || (() => []))()).find((y) => (y.n || y.nome) === nome);
        if (!orig) return;
        const atual = C.comAjustes([orig], tipo)[0];  // abre já com os ajustes aplicados
        return editorItem(tipo, null, { ...orig, ...atual, _orig: orig });
      }
      const x = (C.conteudo()[tipo + "s"] || []).find((y) => y._id === ref);
      if (x) editorItem(tipo, x);
    });
    ov.querySelectorAll("[data-restaurar]").forEach((b) => b.onclick = async () => {
      if (!(await confirmModal("Voltar este item ao original do livro? O seu ajuste será apagado.", { okLabel: "Restaurar", perigo: true }))) return;
      await apagar(b.dataset.restaurar); sincronizarExtra(); pintar();
    });
    const flt = ov.querySelector("#adm-filtro");
    if (flt) flt.oninput = () => { filtroTipo = flt.value; const pos = flt.selectionStart; pintar();
      const nf = ov.querySelector("#adm-filtro"); if (nf) { nf.focus(); nf.setSelectionRange(pos, pos); } };
    ov.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => { await apagar(b.dataset.del); pintar(); });
    ov.querySelector("#adm-cri-nova")?.addEventListener("click", () => editorCriatura(null));
    ov.querySelectorAll("[data-cri-ed]").forEach((b) => b.onclick = () => {
      const ref = b.dataset.criEd;
      if (ref.startsWith("n:")) {                      // criatura do livro
        const nome = ref.slice(2);
        const orig = BESTIARIO.find((x) => x.n === nome); if (!orig) return;
        const atual = C.comAjustes([orig], "criatura")[0];
        return editorCriatura(null, { ...orig, ...atual, _orig: orig });
      }
      const c = C.conteudo().criaturas.find((x) => x._id === ref);
      if (c) editorCriatura(c);
    });
    ov.querySelectorAll("[data-cri-del]").forEach((b) => b.onclick = async () => { await apagar(b.dataset.criDel); pintar(); });

    ov.querySelector("#adm-arm-nova")?.addEventListener("click", async () => {
      const r = await modalForm({ titulo: "⚔ Nova arma", campos: [
        { k: "n", label: "Nome", tipo: "texto" },
        { k: "tipo", label: "Tipo", tipo: "select", opcoes: [{ v: "branca", l: "Branca" }, { v: "fogo", l: "De fogo" }] },
        { k: "dano", label: "Dano", tipo: "texto", valor: "1d8" },
        { k: "attr", label: "Atributo", tipo: "select", opcoes: ["For", "Des"] },
        { k: "kw", label: "Palavra-chave", tipo: "texto" },
        { k: "preco", label: "Preço (CG)", tipo: "numero", valor: 100 },
        { k: "desc", label: "Descrição", tipo: "area", rows: 3 },
      ], okLabel: "Criar" });
      if (!r || !r.n) return;
      const a2 = { n: r.n, tipo: r.tipo, dano: r.dano || "1d6", attr: r.attr, per: r.tipo === "fogo" ? "Armas de Fogo" : "Armas Brancas", kw: r.kw || "", preco: +r.preco || 0, desc: r.desc || "" };
      if (await salvar("arma", a2)) pintar();
    });
    ov.querySelectorAll("[data-arm-del]").forEach((b) => b.onclick = async () => { await apagar(b.dataset.armDel); pintar(); });

    const formMec = async (existente) => {
      const r = await modalForm({ titulo: existente ? "📜 Editar mecânica" : "📜 Nova mecânica",
        descricao: "Aparece na aba Mecânicas da Biblioteca para todos os jogadores.",
        campos: [
          { k: "titulo", label: "Título", tipo: "texto", valor: existente?.titulo || "" },
          { k: "cat", label: "Categoria (opcional)", tipo: "texto", valor: existente?.cat || "" },
          { k: "texto", label: "Texto da regra", tipo: "area", rows: 10, valor: existente?.texto || "" },
        ], okLabel: existente ? "Salvar" : "Publicar" });
      if (!r || !r.titulo) return;
      if (await salvar("mecanica", { titulo: r.titulo, cat: r.cat || "", texto: r.texto || "" }, null, existente?._id)) pintar();
    };
    ov.querySelector("#adm-mec-nova")?.addEventListener("click", () => formMec(null));
    ov.querySelectorAll("[data-mec-ed]").forEach((b) => b.onclick = () => formMec(C.conteudo().mecanicas.find((m) => m._id === b.dataset.mecEd)));
    ov.querySelectorAll("[data-mec-del]").forEach((b) => b.onclick = async () => { await apagar(b.dataset.mecDel); pintar(); });
  };
  const fechar = () => { document.body.style.overflow = ""; ov.remove(); telaBiblioteca(voltarPara); };
  document.body.appendChild(ov); document.body.style.overflow = "hidden";
  pintar();
  ov.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });
}

iniciar();
