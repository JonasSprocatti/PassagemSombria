// ============================================================================
//  COMBATE — aba "Combate" de telaMesa (rastreador de iniciativa, campo tático,
//  ⚔/🏷/±5 do Mestre), extraído de app.js. 3ª fatia da modularização do
//  telaMesa (ver "Modularização de telaMesa" em CLAUDE.md, ordem: nave → combate → ficha).
//  Uso: import { renderCombate, wireCombate } from "./mesa-combate.js";
//       renderCombate(ctx) dentro do template da mesa; wireCombate(ctx) na hora
//       de religar handlers (mesmo momento em que os outros `[data-*]` da mesa
//       são religados).
//
//  Corpo copiado tal e qual de app.js — só os identificadores livres viraram
//  imports, mesmo padrão de biblioteca.js/admin.js/mesa-mestre.js/mesa-nave.js.
//  `aplicarEmAlvos`/`[data-atq]`/`#cb-apagar-fogo`/`#cb-levantar` NÃO vieram —
//  apesar do prefixo `cb-`/mexerem em `camp.combate`, são ações da aba "Meu
//  personagem" (destino: mesa-ficha.js, ainda não extraído).
// ============================================================================
import { NAVES, ESTACOES, propsArma } from "./dados-jogo.js";
import { NIVEIS_AMEACA } from "./dados-bestiario.js";
import {
  d, sign, parseDice, rollNd, danoCritico, aplicarCond, novaFichaDados, calc,
  CONDICOES_INFO, infoCond, distCombate, posInicial, tipoDanoAtaque, alcanceDaArma,
  CAMPO_LARGURA, CAMPO_PISTAS, PISTA_M, ALCANCE_CAC, municaoDe, descontarMunicao,
} from "./regras.js";
import { modalForm, confirmModal, somDado } from "./ui.js";
import {
  sb, esc, POSTOS_ORDEM,
  ehNave, foraDeCombate, defesaNave, danoNave, rolarAvaria, ataqueDaNave, combateVazio, naveTaticaVazia,
  vidaAtual, vidaMax, salvarFicha, todasArmas, todasCriaturas, criaturaMod, danoArma, armaMontada, avisar,
} from "./app.js";

const $ = (s) => document.querySelector(s);

// Ataques de um combatente para o rastreador: os inimigos trazem `ataques` do
// bestiário; para um jogador, derivamos da arma equipada na hora, para o
// Mestre poder rolar e direcionar o dano quando o jogador não puder.
const ataquesDoCombatente = (pers, c) => {
  if (!c) return null;
  if (c.ataques?.length) return c.ataques;
  if (!c.personagem_id) return null;
  const pj = (pers || []).find((p) => p.id === c.personagem_id);
  if (!pj) return null;
  const dd = { ...novaFichaDados(), ...pj.dados };
  const kk = calc(dd);
  const lista = (dd.inventario || []).filter((w) => w.tipo === "arma" && w.equip).map((w) => {
    const cb = todasArmas().find((x) => x.n === w.nome); if (!cb) return null;
    const cm = armaMontada(cb, w); const pr = propsArma(cm);
    const aa = pr.agil ? (kk.attr.Des >= kk.attr.For ? "Des" : "For") : cm.attr;
    const bd = kk.attr[aa] || 0; const base = danoArma(cm, dd.nivel || 1);
    return { n: w.nome, bonus: kk.attr[aa] + kk.per[cm.per], alcance: alcanceDaArma(cm, pr),
      dano: (bd && /^\d*d\d+$/i.test(String(base).trim())) ? `${base}${bd > 0 ? "+" : ""}${bd}` : base,
      extra: cm.kw ? `${cm.kw}: ${pr.efeito}` : "" };
  }).filter(Boolean);
  return lista.length ? lista : null;
};
// (mesmo cálculo de ordem que #cb-add-btn/#cb-prox usavam em app.js — únicos consumidores.)
const ordenarCombate = (cb) => { cb.ordem.sort((a, b) => (b.ini - a.ini) || a.nome.localeCompare(b.nome)); return cb; };
const proximoTurno = (cb) => {
  if (!cb.ordem.length) return cb;
  let i = cb.turno, voltas = 0;
  do { i++; if (i >= cb.ordem.length) { i = 0; cb.rodada++; voltas++; } } while (cb.ordem[i] && foraDeCombate(cb.ordem[i]) && voltas < 2);
  cb.turno = i; return cb;
};
// Rolagem injetada no motor de efeitos de criatura: ele não conhece o app, só pede um número.
const rolarTexto = (expr) => { const pd = parseDice(String(expr)); return pd ? rollNd(pd.n, pd.f).reduce((x, y) => x + y, 0) + pd.mod : (+expr || 0); };

// Um jogador "a bordo" (posto na nave, qualquer posto) não é um token à parte no
// campo tático — ele está dentro da nave, não pisando o chão ao lado dela.
const estaABordoDeNave = (c, pers, membros) => {
  if (!c.personagem_id) return false;
  const dono = (pers || []).find((p) => p.id === c.personagem_id)?.dono_id;
  return !!(dono && (membros || []).find((m) => m.perfil_id === dono)?.posto);
};

export function renderCombate(ctx) {
  const { ui, camp, membros, pers, f, k, tokenSelObj, vistaCampo, vistaLarg, pctX, defesaNaveParty, bonusDefVeiculo, aurasAtivas } = ctx;
  return `
          <div class="mesa-painel" ${ui.abaMesa === "combate" ? "" : "hidden"}>
          ${(camp.combate.ativo || ui.souMestre) ? `<section class="sec combate-sec">
            <header><span class="tag">⚔</span><h2>Combate</h2>${camp.combate.ativo ? `<span class="regra" style="margin-left:auto">Rodada ${camp.combate.rodada}</span>` : ""}</header>
            ${!camp.combate.ativo ? (ui.souMestre ? `<button id="cb-iniciar" class="mini eq">⚔ Iniciar Combate</button><p class="regra">Adicione jogadores e inimigos do bestiário; a ordem é montada pela iniciativa.</p>` : "") : `
            ${(f && k) ? (() => {
              // PV/RAM/Escudo do PRÓPRIO jogador, visíveis aqui — sem isto, quem está
              // lutando precisava trocar pra aba Ficha toda hora só pra conferir RAM/
              // escudo no meio do combate. Mesmas barras da aba Ficha (vitais-barras
              // compacto), só que na aba onde a ação realmente está acontecendo.
              const pvP = k.pvMax ? Math.max(0, Math.min(100, 100 * f.pvAtual / k.pvMax)) : 0;
              const ramP = k.ramMax ? Math.max(0, Math.min(100, 100 * k.ramLivre / k.ramMax)) : 0;
              const est = f.pvAtual <= 0 ? "morto" : pvP <= 30 ? "critico" : pvP <= 60 ? "ferido" : "";
              const escP = k.escudoMax ? Math.max(0, Math.min(100, 100 * k.escudoLivre / k.escudoMax)) : 0;
              return `<div class="vitais-barras compacto cb-meus-vitais">
                <div class="vb" data-barra="cb-pv"><div class="vb-topo"><span>❤ PV</span><b class="${est}">${f.pvAtual}<span class="dim">/${k.pvMax}</span></b></div>
                  <div class="vb-trilho"><span class="rastro"></span><span class="cb-hp-barra vb-fill ${est}" style="width:${pvP}%"></span></div></div>
                <div class="vb" data-barra="cb-ram"><div class="vb-topo"><span>◈ RAM</span><b class="sombra-c">${k.ramLivre}<span class="dim">/${k.ramMax}</span></b></div>
                  <div class="vb-trilho"><span class="rastro"></span><span class="cb-hp-barra vb-fill ram" style="width:${ramP}%"></span></div></div>
                ${k.escudoMax ? `<div class="vb" data-barra="cb-escudo"><div class="vb-topo"><span>🛡 Escudo</span><b class="chrome">${k.escudoLivre}<span class="dim">/${k.escudoMax}</span></b></div>
                  <div class="vb-trilho"><span class="rastro"></span><span class="cb-hp-barra vb-fill escudo" style="width:${escP}%"></span></div></div>` : ""}
                ${k.pvTemp ? `<p class="regra" style="grid-column:1/-1;margin:0">✚ <b class="tech-c">${k.pvTemp} PV temporário</b> (absorve antes do PV)</p>` : ""}
              </div>`; })() : ""}
            ${(camp.nave && camp.combate.naveEmCena) ? (() => { const nt = camp.combate.nave || naveTaticaVazia();
              const defBase = defesaNaveParty();
              const def = nt.evasiva != null ? nt.evasiva : defBase;
              const pc = camp.nave.casco_max ? Math.max(0, 100 * camp.nave.casco / camp.nave.casco_max) : 0;
              const pe = camp.nave.escudos_max ? Math.max(0, 100 * camp.nave.escudos / camp.nave.escudos_max) : 0;
              return `<div class="nave-painel">
                <div class="nave-cab"><b>🚀 ${esc(camp.nave.nome_batismo || camp.nave.modelo)}</b>
                  <span class="nave-def ${nt.evasiva != null ? "evasiva" : ""}" title="${nt.evasiva != null ? "Manobra Evasiva ativa até o próximo turno do piloto" : `10 + Manobrabilidade${bonusDefVeiculo() ? ` + ${bonusDefVeiculo()} do Piloto (Instinto Evasivo)` : ""}`}">Def ${def}${nt.evasiva != null ? " ⟳" : ""}</span></div>
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
            ${camp.combate.ordem.some((c) => c.pos) ? `<div class="cb-campo ${ui.campoZoom ? "perto" : ""}" id="cb-campo" style="--g1:${((1 / vistaLarg) * 100).toFixed(3)}%;--g5:${((5 / vistaLarg) * 100).toFixed(3)}%">
              <div class="cb-campo-topo">
                <button id="cb-zoom" class="mini" title="${ui.campoZoom ? "Ver o campo inteiro (40 m)" : "Aproximar: janela de 12 m com grade de 1 m"}">${ui.campoZoom ? "🔎− afastar" : "🔎+ aproximar"}</button>
                <span class="dim">${Math.round(vistaCampo.ini)}–${Math.round(vistaCampo.fim)} m · grade ${ui.campoZoom ? "1" : "5"} m</span>
                ${tokenSelObj ? `<button id="cb-limpar-sel" class="mini" title="Limpar seleção">✕ ${esc(tokenSelObj.nome.slice(0, 12))}</button>` : ""}
              </div>
              ${tokenSelObj?.pos ? (() => {
                const a = Math.max(vistaCampo.ini, tokenSelObj.pos.x - ALCANCE_CAC);
                const b2 = Math.min(vistaCampo.fim, tokenSelObj.pos.x + ALCANCE_CAC);
                return b2 > a ? `<div class="cb-alcance" style="left:${pctX(a).toFixed(2)}%;width:${(pctX(b2) - pctX(a)).toFixed(2)}%" title="Alcance corpo-a-corpo de ${esc(tokenSelObj.nome)} — ${String(ALCANCE_CAC).replace(".", ",")} m"></div>` : "";
              })() : ""}
              ${Array.from({ length: CAMPO_PISTAS }, (_, lane) => {
                const naPista = camp.combate.ordem.filter((c) => !estaABordoDeNave(c, pers, membros) && (c.pos?.lane ?? 1) === lane)
                  .sort((a, b2) => (a.pos?.x ?? 20) - (b2.pos?.x ?? 20));
                let stack = 0;
                return `<div class="cb-pista" data-lane="${lane}" data-rot="${["frente", "meio", "fundo"][lane] || ""}">${naPista.map((c, idx) => {
                  const prev = naPista[idx - 1];
                  const pertinho = vistaLarg / 14;   // metros que ainda causam sobreposição visual
                  stack = (prev && Math.abs((c.pos?.x ?? 20) - (prev.pos?.x ?? 20)) < pertinho) ? stack + 1 : 0;
                  const px = pctX(c.pos?.x ?? 20);
                  if (px < -4 || px > 104) return "";
                  const meu = c.personagem_id && c.personagem_id === ui.meuPers?.id;
                  const vez = camp.combate.ordem[camp.combate.turno]?.id === c.id;
                  const movivel = ui.souMestre || (meu && vez);
                  const lado = (c.tipo === "inimigo" || c.lado === "inimiga") ? "inim" : "aliado";
                  const dSel = tokenSelObj && tokenSelObj.id !== c.id ? distCombate(tokenSelObj, c) : null;
                  const rel = dSel == null ? "" : (dSel <= ALCANCE_CAC ? "perto" : "longe");
                  return `<span class="cb-token ${lado} ${ehNave(c) ? "nave-tok" : ""} ${foraDeCombate(c) ? "morto" : ""} ${vez ? "vez" : ""} ${movivel ? "movivel" : ""} ${c.id === ui.tokenSel ? "sel" : ""} ${rel}" data-token="${c.id}" style="left:${px.toFixed(2)}%;--stack:${stack}" title="${esc(c.nome)} · x ${(c.pos?.x ?? 20).toFixed(1).replace(".", ",")} m · pista ${(c.pos?.lane ?? 1) + 1}${dSel != null ? ` · ${dSel.toFixed(1).replace(".", ",")} m de ${esc(tokenSelObj.nome)}` : ""}">${ehNave(c) ? "🚀" : esc(c.nome.replace(/ #\d+$/, "").slice(0, 5))}${c.qtd > 1 ? `×${c.qtd}` : ""}</span>`;
                }).join("")}</div>`;
              }).join("")}
              <div class="cb-regua">${(() => { const passo = vistaLarg <= 15 ? 1 : 5; const out = [];
                for (let m = Math.ceil(vistaCampo.ini / passo) * passo; m <= vistaCampo.fim + 0.001; m += passo)
                  out.push(`<span class="${m % 5 === 0 ? "maior" : ""}" style="left:${pctX(m).toFixed(2)}%">${m}</span>`);
                return out.join(""); })()}</div>
            </div>
            ${tokenSelObj ? `<div class="cb-distancias"><b class="chrome">${esc(tokenSelObj.nome)}</b> <span class="dim">corpo-a-corpo ${String(ALCANCE_CAC).replace(".", ",")} m</span>
              ${camp.combate.ordem.filter((c) => !estaABordoDeNave(c, pers, membros) && c.id !== tokenSelObj.id && !foraDeCombate(c))
                .map((c) => ({ c, dd: distCombate(tokenSelObj, c) })).filter((o) => o.dd != null)
                .sort((a, b2) => a.dd - b2.dd)
                .map(({ c, dd }) => `<span class="cb-dist ${dd <= ALCANCE_CAC ? "ok" : ""}">${dd <= ALCANCE_CAC ? "⚔" : "·"} ${esc(c.nome.replace(/ #\d+$/, "").slice(0, 14))} <b>${dd.toFixed(1).replace(".", ",")}</b></span>`).join("")
                || `<span class="dim">ninguém mais de pé no campo</span>`}</div>`
              : `<p class="regra cb-campo-dica">Clique num token para ver o alcance corpo-a-corpo e a distância para os outros.</p>`}` : ""}
            <div class="cb-lista">${camp.combate.ordem.map((c, i) => `
              <div class="cb-linha ${i === camp.combate.turno ? "cb-atual" : ""} ${foraDeCombate(c) ? "cb-morto" : ""} ${ehNave(c) ? "cb-nave" : ""}">
                <span class="cb-ini" title="Iniciativa">${c.ini}</span>
                <span class="cb-nome">${i === camp.combate.turno ? "▶ " : ""}${ehNave(c) ? "🚀 " : ""}${esc(c.nome)}${c.qtd > 1 ? ` <b class="chrome">×${c.qtd}</b>` : ""}${c.tipo === "inimigo" ? ` <i class="dim">${esc(c.ameaca || "")}</i>` : ""}${ehNave(c) ? ` <i class="dim">Def ${10 + (c.manobra || 0)}</i>` : ""}</span>${(!ehNave(c) && i === camp.combate.turno) ? `<span class="cb-acoes-uso" title="Ações desta rodada — as acesas ainda estão disponíveis">${[["p", "Principal"], ["m", "Movimento"], ["r", "Reação"]].map(([ch, rot]) => `<i class="${c.acoes?.[ch] ? "gasta" : ""}" title="${rot}${c.acoes?.[ch] ? " — já usada" : " — disponível"}">${rot[0]}</i>`).join("")}</span>` : ""}${(c.cond && c.cond.length) ? `<span class="cb-conds">${c.cond.map((cd) => `<span class="cb-cond ${infoCond(cd.n)?.dano ? "sangra" : "estado"}" title="${esc(cd.n)} · ${cd.turnos} turno(s)${infoCond(cd.n) ? " — " + esc(infoCond(cd.n).d) : ""}">${infoCond(cd.n)?.ic || "🏷"} ${esc(cd.n)} ${cd.turnos}</span>`).join("")}</span>` : ""}
                <span class="cb-hp" data-barra="${c.id}" title="${ehNave(c) ? "Casco" : "Vida"}"><span class="rastro"></span><span class="cb-hp-barra" style="width:${Math.max(0, Math.min(100, vidaMax(c) ? vidaAtual(c) / vidaMax(c) * 100 : 0))}%;background:${(c.tipo === "inimigo" || c.lado === "inimiga") ? "var(--perigo)" : ehNave(c) ? "var(--chrome)" : "var(--tech)"}"></span><b>${vidaAtual(c)}/${vidaMax(c)}</b></span>${ehNave(c) ? `<span class="cb-hp ${c.escudosOff > 0 ? "off" : ""}" title="${c.escudosOff > 0 ? "Escudos inertes por Guerra Eletrônica — não absorvem dano" : "Escudos"}"><span class="rastro"></span><span class="cb-hp-barra" style="width:${Math.max(0, Math.min(100, c.escudos_max ? c.escudos / c.escudos_max * 100 : 0))}%;background:var(--tech)"></span><b>${c.escudosOff > 0 ? "⚡off" : `${c.escudos}/${c.escudos_max}`}</b></span>` : ""}
                ${ui.souMestre ? `<span class="cb-acoes">${(() => { const _atq = ataquesDoCombatente(pers, c); return _atq ? _atq.map((atk, ai) => `<button class="cb-atk" data-cb="${c.id}" data-atk="${ai}" title="Rolar ${esc(atk.n)}${c.personagem_id ? ` por ${esc(c.nome)}` : ""}">⚔${_atq.length > 1 ? ai + 1 : ""}</button>`).join("") : ""; })()}${(ehNave(c) && c.lado === "inimiga") ? `<button class="cb-atk" data-cb-nave="${c.id}" title="Esta nave dispara">⚔</button>` : ""}<button class="cb-dmg" data-cb="${c.id}" data-d="-5">−5</button><button class="cb-dmg" data-cb="${c.id}" data-d="5">+5</button><input class="cb-hpset" data-cb="${c.id}" type="number" value="${vidaAtual(c)}" style="width:46px" title="${ehNave(c) ? "definir Casco" : "definir HP"}"><button class="cb-hpset-lbl cb-cond-add" data-cb="${c.id}" title="Adicionar condição">🏷</button><button class="cb-cob ${c.cobertura ? "on" : ""}" data-cb="${c.id}" title="Cobertura contra ataques à distância: ${["nenhuma", "parcial (+2 Def)", "total (+5 Def)"][c.cobertura || 0]}">${["🚫", "🧱", "🏚"][c.cobertura || 0]}</button><button class="cb-rm" data-cb="${c.id}" title="remover">✕</button></span>` : ""}
              </div>`).join("")}</div>
            ${aurasAtivas().length ? `<div class="nave-buffs">${aurasAtivas().map((a) => {
              const dentro = (a.nega?.length && a.raio && a.fonte?.pos)
                ? camp.combate.ordem.filter((x) => !ehNave(x) && !foraDeCombate(x) && x.id !== a.fonte.id && (distCombate(a.fonte, x) ?? 99) <= a.raio)
                : null;
              const alcance = a.nega?.length
                ? ` — ${a.nega.join(", ")} não funcionam${a.raio ? ` num raio de ${a.raio} m` : ""}${dentro ? (dentro.length ? ` · no raio: ${dentro.map((x) => esc(x.nome.replace(/ #\d+$/, ""))).join(", ")}` : " · ninguém no raio") : ""}`
                : a.imune ? ` — imune a ${esc(a.imune)}` : a.limiar ? ` — ignora dano abaixo de ${a.limiar}` : "";
              return `<span class="buff">🌀 <b>${esc(a.criatura)}</b> · ${esc(a.hab)}${alcance}</span>`;
            }).join("")}</div>` : ""}
            ${(camp.combate.avarias || []).length ? `<div class="avarias">${camp.combate.avarias.map((av, ai) => `<div class="avaria"><b>⚠ ${esc(av.n)}</b> <span class="regra">${esc(av.e)}</span>${ui.souMestre ? `<button class="mini rm" data-av-fix2="${ai}">✔</button>` : ""}</div>`).join("")}</div>` : ""}
            ${camp.combate.ordem.some((x) => x.nave_party) ? `<p class="regra cbn-postos">Postos: ${POSTOS_ORDEM.map((pk) => { const q2 = (membros || []).find((m) => m.posto === pk); const ag = (camp.combate.agiram || []).includes(pk);
              return `<span class="cbn-posto ${ag ? "ok" : ""} ${q2 ? "" : "vazio"}">${esc(ESTACOES[pk].n.split(" ")[0])}${ag ? " ✓" : ""}</span>`; }).join(" ")}</p>` : ""}
            ${(ui.souMestre && camp.nave) ? `<div class="filtros" style="margin-bottom:6px">
              <button id="cb-nave-cena" class="mini ${camp.combate.naveEmCena ? "on" : ""}"
                title="${camp.combate.naveEmCena ? "A nave está em cena: painel, postos e avarias aparecem" : "Traga a nave para a cena em combates espaciais ou de abordagem"}">
                🚀 ${camp.combate.naveEmCena ? "Nave em cena — tirar" : "Trazer a nave para a cena"}</button></div>` : ""}
            ${ui.souMestre ? `<div class="cb-add">
              <select id="cb-quem"><optgroup label="Jogadores">${(pers || []).map((p) => `<option value="j:${p.id}">${esc(p.nome) || "sem nome"}</option>`).join("")}</optgroup>${camp.bestiario.length ? `<optgroup label="Minhas criaturas">${camp.bestiario.map((b, ci) => `<option value="c:${ci}">${esc(b.n)} · ${b.ameaca}</option>`).join("")}</optgroup>` : ""}<optgroup label="Inimigos (bestiário)">${todasCriaturas().map((b, bi) => b.ambiental ? "" : `<option value="e:${bi}">${esc(b.n)} · ${b.ameaca}</option>`).join("")}</optgroup><optgroup label="Naves inimigas">${NAVES.map((n, ni) => `<option value="ni:${ni}">🚀 ${esc(n.n)}</option>`).join("")}</optgroup></select>
              <button id="cb-add-btn" class="mini">🎲 Add</button><button id="cb-criar" class="mini" title="Criar/editar criaturas do Mestre">🐉</button>
              <button id="cb-surpresa" class="mini" title="Declarar rodada surpresa: quem for pego não age no primeiro turno">❕ Surpresa</button>
              <button id="cb-evento" class="mini" title="Agendar um evento para daqui a N turnos (contagem regressiva, explosão, reforços)">⏳ Evento</button></div>
            ${(camp.combate.eventos || []).length ? `<div class="avarias">${camp.combate.eventos.map((ev, ei) => `<div class="avaria"><b>⏳ ${esc(ev.n)}</b> <span class="regra">em ${ev.turnos} rodada(s) — ${esc(ev.texto || "")}</span>${ui.souMestre ? `<button class="mini rm" data-ev-del="${ei}" title="Cancelar">✕</button>` : ""}</div>`).join("")}</div>` : ""}
            <div class="cb-ctrl"><button id="cb-undo" class="mini" title="Desfazer a última ação">↶</button><button id="cb-prox" class="mini eq" title="Atalho: barra de espaço (Mestre)">▶ Próximo turno</button><button id="cb-timer" class="mini" title="Cronômetro do turno">⏱</button><button id="cb-fim" class="mini rm">⏹ Encerrar</button></div><div id="cb-timer-out" class="cb-timer"></div>` : ""}`}
          </section>` : ""}
          </div>`;
}

export function wireCombate(ctx) {
  const {
    id, camp, pers, membros, ui, k, enviar, salvarCamp, salvarCombate, render, snapshot,
    aplicarDanoAlvo, habsDoCombatente, gastarAcao, sincronizarCdCombate, sincronizarFicha,
    salvarBestiario, pilhaUndo, vistaCampo, vistaLarg, pctX,
  } = ctx;
  // ---- rastreador de iniciativa ----
  const cbId = () => "c" + Math.random().toString(36).slice(2, 8);
  const cbFind = (idc) => camp.combate.ordem.find((x) => x.id === idc);
  // Atalho de teclado pro Mestre passar o turno (#cb-prox é clicado toda hora
  // durante o combate): barra de espaço. Guardado em `ui`, mesmo padrão de
  // `ui._teclaListener` em mesa-ficha.js — wireCombate roda a cada render(),
  // então sem essa guarda cada render empilharia um listener novo no documento.
  if (!ui._provimoTurnoListener) {
    ui._provimoTurnoListener = (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.code !== "Space") return;
      const alvo = e.target;
      // Espaço é o jeito padrão de "clicar" um elemento focado via teclado
      // (botão, link, checkbox…) — se algo assim estiver com foco, deixa o
      // navegador fazer o normal em vez de roubar a tecla pro próximo turno.
      if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.tagName === "SELECT" || alvo.tagName === "BUTTON" || alvo.tagName === "A" || alvo.isContentEditable)) return;
      if (document.querySelector(".mdl-overlay")) return;   // modal pedindo decisão — não passa o turno por baixo
      if (!ui.souMestre || !camp.combate?.ativo) return;
      e.preventDefault();
      document.querySelector("#cb-prox")?.click();
    };
    document.addEventListener("keydown", ui._provimoTurnoListener);
  }
  $("#cb-iniciar")?.addEventListener("click", async () => { camp.combate = { ...combateVazio(), ativo: true }; await salvarCombate(); render(); });
  // Rodada surpresa: quem não estava emboscando fica Surpreso por 1 turno.
  // Sentidos Alertas (Batedor) e o Código do Sobrevivente passam batido.
  $("#cb-surpresa")?.addEventListener("click", async () => {
    const alvos = camp.combate.ordem.filter((x) => !ehNave(x) && !foraDeCombate(x));
    if (!alvos.length) return alert("Adicione combatentes ao rastreador antes de declarar a surpresa.");
    const r = await modalForm({ titulo: "❕ Rodada surpresa",
      descricao: "Marque quem está emboscando. Todo o resto fica Surpreso e perde o primeiro turno — exceto quem é imune.",
      campos: alvos.map((c2) => ({ k: c2.id, label: c2.nome, tipo: "select",
        valor: c2.tipo === "inimigo" ? "1" : "", opcoes: [{ v: "1", l: "emboscando" }, { v: "", l: "foi pego" }] })),
      okLabel: "Declarar" });
    if (!r) return;
    snapshot("rodada surpresa");
    const pegos = [], imunes = [];
    for (const c2 of alvos) {
      if (r[c2.id]) continue;
      let imune = false;
      if (c2.personagem_id) {
        const pj = (pers || []).find((p2) => p2.id === c2.personagem_id);
        if (pj) { const dd = { ...novaFichaDados(), ...pj.dados }; const kk = calc(dd);
          imune = dd.filosofia === "Código do Sobrevivente"
            || (kk.efeitos?.imunidades?.() || []).some((i2) => /surpres/i.test(i2)); }
      }
      if (imune) imunes.push(c2.nome); else { aplicarCond(c2, "Surpreso", 1); pegos.push(c2.nome); }
    }
    await salvarCombate();
    await enviar("sistema", `❕ Rodada surpresa!${pegos.length ? ` Pegos: ${pegos.join(", ")}.` : ""}${imunes.length ? ` Reagiram a tempo: ${imunes.join(", ")}.` : ""}`);
    render();
  });
  // Evento agendado: contagem regressiva por rodada (reator, reforços, desabamento).
  $("#cb-evento")?.addEventListener("click", async () => {
    const r = await modalForm({ titulo: "⏳ Agendar evento",
      descricao: "Conta para baixo a cada rodada e avisa na mesa quando chegar a zero.",
      campos: [
        { k: "n", label: "Nome", tipo: "texto", placeholder: "Sobrecarga do reator" },
        { k: "t", label: "Em quantas rodadas", tipo: "numero", valor: 2, min: 1, max: 20 },
        { k: "txt", label: "O que acontece", tipo: "area", rows: 2, placeholder: "6d10 de dano em área de 5 m" },
      ], okLabel: "Agendar" });
    if (!r?.n) return;
    camp.combate.eventos = [...(camp.combate.eventos || []), { n: r.n, turnos: Math.max(1, +r.t || 1), texto: r.txt || "" }];
    await salvarCombate();
    await enviar("sistema", `⏳ ${r.n} — em ${Math.max(1, +r.t || 1)} rodada(s).${r.txt ? ` ${r.txt}` : ""}`);
    render();
  });
  document.querySelectorAll("[data-ev-del]").forEach((b) => b.onclick = async () => {
    (camp.combate.eventos || []).splice(+b.dataset.evDel, 1);
    await salvarCombate(); render();
  });
  document.querySelectorAll(".cb-cob").forEach((b) => b.onclick = async () => {
    const c = cbFind(b.dataset.cb); if (!c) return;
    c.cobertura = ((c.cobertura || 0) + 1) % 3;
    await salvarCombate();
    await enviar("sistema", `${["🚫", "🧱", "🏚"][c.cobertura]} ${c.nome}: cobertura ${["nenhuma", "parcial (+2 Def contra tiro)", "total (+5 Def contra tiro)"][c.cobertura]}.`);
    render();
  });
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
    if (ui.timerInt) { clearInterval(ui.timerInt); ui.timerInt = null; const o = $("#cb-timer-out"); if (o) o.textContent = ""; return; }
    const r = await modalForm({ titulo: "⏱ Cronômetro de turno", campos: [
      { k: "i", label: "Conta o tempo de cada jogador. É local: só você vê, e serve para manter o combate andando.", tipo: "info" },
      { k: "seg", label: "Segundos por turno", tipo: "numero", valor: 60 },
    ], okLabel: "Iniciar" });
    if (!r) return;
    const total = Math.max(10, +r.seg || 60);
    let resta = total;
    const pinta = () => { const o = $("#cb-timer-out"); if (!o) { clearInterval(ui.timerInt); ui.timerInt = null; return; }
      const m = String(Math.floor(resta / 60)).padStart(1, "0"), sg = String(resta % 60).padStart(2, "0");
      o.textContent = `⏱ ${m}:${sg}`;
      o.className = "cb-timer" + (resta <= 10 ? " urgente" : "");
      if (resta <= 0) { clearInterval(ui.timerInt); ui.timerInt = null; o.textContent = "⏱ tempo!"; try { somDado(); } catch (_) {} }
      resta--;
    };
    pinta(); ui.timerInt = setInterval(pinta, 1000);
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
    await salvarCamp({ combate: camp.combate, combate_nave: camp.combate_nave, ...(snap.nave ? { nave: camp.nave } : {}) }, "desfazer");
    await enviar("sistema", `↶ O Mestre desfez: ${snap.rotulo}.`); render();
  });
  $("#cb-fim")?.addEventListener("click", async () => { if (confirm("Encerrar o combate e limpar a ordem?")) { camp.combate = combateVazio(); await salvarCombate(); render(); } });
  document.querySelectorAll("[data-cb-nave]").forEach((b) => b.onclick = async () => {
    const atc = camp.combate.ordem.find((x) => x.id === b.dataset.cbNave); if (!atc) return;
    const atk = await ataqueDaNave(atc); if (!atk) return;   // cancelou a escolha de arma
    if (municaoDe(atc, atk) <= 0) return alert(`${atk.n} está sem munição — sem como disparar.`);
    const bonusAtk = atk.bonus ?? 4;
    // Alvo: qualquer um vivo no rastreador (pessoa/criatura/NPC) — nunca a própria
    // atacante nem outra nave inimiga (isso é combate nave-a-nave de verdade, fora
    // de escopo aqui). A nave da party não é uma linha do rastreador (o HUD lê
    // direto de camp.nave), então entra como candidato sintético quando em cena.
    const naveParty = (camp.nave && camp.combate.naveEmCena)
      ? { id: "__nave_party__", nome: camp.nave.nome_batismo || camp.nave.modelo, tipo: "nave",
          casco: camp.nave.casco, casco_max: camp.nave.casco_max, escudos: camp.nave.escudos, escudos_max: camp.nave.escudos_max,
          manobra: camp.nave.manobra, nave_party: true }
      : null;
    const candidatos = [...camp.combate.ordem.filter((x) => x.id !== atc.id && !foraDeCombate(x) && !ehNave(x)), ...(naveParty ? [naveParty] : [])];
    if (!candidatos.length) return alert("Não há alvos em campo.");
    // Arma explosiva: mesmo padrão de epicentro+raio do posto de Artilharia
    // (mesa-nave.js) — só entra quem tem posição real no campo (a nave da party
    // sintética não tem `.pos`, então nunca é epicentro nem é pega pela área).
    if (atk.area && atk.raio) {
      const comPos = candidatos.filter((x) => x.pos);
      if (comPos.length) {
        const rA = await modalForm({ titulo: `🚀 ${atc.nome} dispara ${atk.n} — centro do impacto`,
          descricao: `Explode num raio de ${atk.raio} m ao redor de quem você escolher.`,
          campos: [{ k: "epi", label: "Centro do impacto", tipo: "select", opcoes: comPos.map((x) => {
            const pegos = comPos.filter((y) => (distCombate(x, y) ?? 99) <= atk.raio).length;
            return { v: x.id, l: `${x.nome} — pega ${pegos} alvo${pegos === 1 ? "" : "s"}` }; }) }], okLabel: "Disparar" });
        if (!rA?.epi) return;
        const epi = comPos.find((x) => x.id === rA.epi);
        snapshot("disparo de nave em área");
        descontarMunicao(atc, atk);
        const alvosArea = comPos.filter((x) => (distCombate(epi, x) ?? 99) <= atk.raio);
        const linhas = [];
        for (const alvoX of alvosArea) {
          const natX = d(20), totX = natX + bonusAtk;
          const defX = ehNave(alvoX) ? defesaNave(alvoX) : (alvoX.cd || 10);
          if (natX === 1 || totX < defX) { linhas.push(`${alvoX.nome}: errou (Def ${defX})`); continue; }
          const pd = parseDice(atk.dano); const dd = rollNd(pd.n, pd.f);
          const bruto = danoCritico(dd.reduce((x, y) => x + y, 0), pd.mod, natX === 20 ? 2 : 1);
          if (ehNave(alvoX)) {
            const r = danoNave(alvoX, bruto);
            if ((natX === 20 || r.critico) && r.casco > 0) { const av = rolarAvaria(); (camp.combate.avarias = camp.combate.avarias || []).push(av); linhas.push(`⚠ ${alvoX.nome}: ${av.n}`); }
            linhas.push(`🚀 ${alvoX.nome}: escudos −${r.escudos}, casco −${r.casco}${alvoX.casco <= 0 ? " 💀" : ""}`);
            if (alvoX.nave_party && camp.nave) { camp.nave.casco = alvoX.casco; camp.nave.escudos = alvoX.escudos; }
          } else {
            const rd = await aplicarDanoAlvo(alvoX, bruto, "físico");
            linhas.push(`${alvoX.nome}: ${rd.msg}${alvoX.hp <= 0 ? " 💀 CAIU!" : ""}`);
          }
        }
        const tocaNaveParty = alvosArea.some((x) => x.nave_party);
        await salvarCamp({ combate: camp.combate, ...(tocaNaveParty && camp.nave ? { nave: camp.nave } : {}) }, "salvar o disparo");
        await enviar("rolagem", null, { titulo: `🚀 ${atc.nome} dispara ${atk.n} em área`, detalhe: `raio ${atk.raio} m — cada alvo rola contra a própria Defesa`, extra: `Em torno de ${epi.nome}: ${linhas.join("  ·  ")}` });
        return render();
      }
    }
    const r0 = await modalForm({ titulo: `🚀 ${atc.nome} dispara ${atk.n}`, campos: [
      { k: "alvo", label: "Alvo", tipo: "select", opcoes: candidatos.map((x) => ({ v: x.id, l: `${ehNave(x) ? "🚀 " : ""}${x.nome} — ${vidaAtual(x)}/${vidaMax(x)}${ehNave(x) ? "" : ` PV, Def ${x.cd ?? 10}`}` })) }], okLabel: "Disparar" });
    if (!r0?.alvo) return;
    const alvo = candidatos.find((x) => x.id === r0.alvo);
    snapshot("disparo de nave");
    descontarMunicao(atc, atk);
    const ntx = camp.combate.nave || naveTaticaVazia();
    const def = ehNave(alvo) ? (ntx.evasiva != null ? ntx.evasiva : defesaNave(alvo)) : (alvo.cd || 10);
    const nat = d(20), total = nat + bonusAtk;
    if (nat === 1 || total < def) {
      await salvarCombate();
      return enviar("rolagem", null, { titulo: `🚀 ${atc.nome} dispara ${atk.n} em ${alvo.nome}`, detalhe: `d20 [${nat}] ${sign(bonusAtk)} vs Defesa ${def}`, total, fumble: nat === 1, extra: "Errou." });
    }
    const pd = parseDice(atk.dano); const dd = rollNd(pd.n, pd.f);
    const bruto = danoCritico(dd.reduce((x, y) => x + y, 0), pd.mod, nat === 20 ? 2 : 1);
    let extra;
    if (ehNave(alvo)) {
      const r = danoNave(alvo, bruto);
      extra = `Escudos −${r.escudos}, Casco −${r.casco}. ${alvo.nome}: ${alvo.casco}/${alvo.casco_max}`;
      if ((nat === 20 || r.critico) && r.casco > 0) { const av = rolarAvaria(); (camp.combate.avarias = camp.combate.avarias || []).push(av); extra += `  ⚠ ${av.n}: ${av.e}`; }
      if (alvo.casco <= 0) extra += "  💀 Casco a zero!";
      if (alvo.nave_party && camp.nave) { camp.nave.casco = alvo.casco; camp.nave.escudos = alvo.escudos; }
    } else {
      const rd = await aplicarDanoAlvo(alvo, bruto, "físico");
      extra = `${rd.msg}${alvo.hp <= 0 ? "  💀 CAIU!" : ""}`;
    }
    await salvarCamp({ combate: camp.combate, ...(alvo.nave_party && camp.nave ? { nave: camp.nave } : {}) }, "salvar o disparo");
    await enviar("rolagem", null, { titulo: `🚀 ${atc.nome} dispara ${atk.n} em ${alvo.nome}`, detalhe: `d20 [${nat}] ${sign(bonusAtk)} vs Def ${def} · dano ${atk.dano} [${dd.join(", ")}]${nat === 20 ? " ×2" : ""}`, total, crit: nat === 20, extra });
    render();
  });
  document.querySelectorAll("[data-av-fix2]").forEach((b) => b.onclick = async () => {
    const av = (camp.combate.avarias || []).splice(+b.dataset.avFix2, 1)[0];
    await salvarCombate(); await enviar("sistema", `🔧 Avaria reparada: ${av?.n}.`); render();
  });
  document.querySelectorAll(".cb-cond-add").forEach((b) => b.onclick = async () => {
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
  // ---- Campo tático: selecionar (ver alcance) e arrastar o próprio token no turno ----
  const campoEl = $("#cb-campo");
  const alternarSel = (idTok) => { ui.tokenSel = ui.tokenSel === idTok ? null : idTok; render(); };
  $("#cb-zoom")?.addEventListener("click", () => { ui.campoZoom = !ui.campoZoom; render(); });
  $("#cb-limpar-sel")?.addEventListener("click", () => { ui.tokenSel = null; render(); });
  if (campoEl) campoEl.querySelectorAll(".cb-token:not(.movivel)").forEach((tok) => {
    tok.addEventListener("click", () => alternarSel(tok.dataset.token));
  });
  if (campoEl) campoEl.querySelectorAll(".cb-token.movivel").forEach((tok) => {
    tok.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      const c = cbFind(tok.dataset.token); if (!c?.pos) return;
      const rect = campoEl.getBoundingClientRect();
      const pistas = [...campoEl.querySelectorAll(".cb-pista")];
      const origem = { x: c.pos.x, lane: c.pos.lane };
      const conds = (c.cond || []).map((x) => x.n.toLowerCase());
      let maxMov = ui.souMestre ? 9999 : (k?.deslocamento || 6);
      if (!ui.souMestre) {
        // Lento é "perde a Ação de Movimento" — bloqueia como Paralisado/Congelado,
        // não é "metade do deslocamento" (isso é só o Caído).
        if (conds.some((n) => /paralisado|congelado|lento/.test(n))) return alert(`${c.nome} não pode se mover (${conds.find((n) => /paralisado|congelado|lento/.test(n))}).`);
        // Caído, Motor Travado, ou ter tentado apagar o próprio fogo neste turno: metade do deslocamento.
        if (conds.some((n) => /caído|motor travado/.test(n)) || c._movMetade === camp.combate.rodada) maxMov = Math.floor(maxMov / 2);
      }
      tok.classList.add("arrastando");
      let nx = c.pos.x, nlane = c.pos.lane;
      const mover = (e) => {
        const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        nx = Math.max(0, Math.min(CAMPO_LARGURA, vistaCampo.ini + frac * vistaLarg));
        const li = pistas.findIndex((el) => { const r2 = el.getBoundingClientRect(); return e.clientY >= r2.top - 8 && e.clientY <= r2.bottom + 8; });
        if (li >= 0) nlane = li;
        tok.style.left = pctX(nx).toFixed(2) + "%";
        if (pistas[nlane] && tok.parentElement !== pistas[nlane]) pistas[nlane].appendChild(tok);
      };
      const soltar = async () => {
        window.removeEventListener("pointermove", mover); window.removeEventListener("pointerup", soltar);
        tok.classList.remove("arrastando");
        const andou = Math.hypot(nx - origem.x, (nlane - origem.lane) * PISTA_M);
        if (andou < 0.4) return alternarSel(tok.dataset.token);   // clique sem arrastar: seleciona
        if (andou > maxMov + 0.01) { alert(`${c.nome} só anda ${maxMov} m neste turno (tentou ${andou.toFixed(1).replace(".", ",")} m).`); return render(); }
        // Amedrontado não consegue se aproximar da fonte do medo. Se a condição
        // sabe quem causou o medo (origemId), é só contra ela; senão (condição
        // antiga, sem origem registrada) cai no comportamento antigo — qualquer inimigo.
        const medoObjM = (c.cond || []).find((x) => x.n.toLowerCase() === "amedrontado");
        if (!ui.souMestre && medoObjM) {
          const fonte = medoObjM.origemId ? camp.combate.ordem.find((x) => x.id === medoObjM.origemId && x.pos) : null;
          const hostis = fonte ? [fonte] : camp.combate.ordem.filter((x) => !ehNave(x) && !foraDeCombate(x) && x.pos
            && (x.tipo === "jogador") !== (c.tipo === "jogador"));
          const perto = (p2) => hostis.reduce((m, h2) => Math.min(m, distCombate({ pos: p2 }, h2) ?? 99), 99);
          const antesD = perto(origem), depoisD = perto({ x: nx, lane: nlane });
          if (hostis.length && depoisD < antesD - 0.01) {
            alert(`${c.nome} está Amedrontado${fonte ? ` (de ${fonte.nome})` : ""} e não consegue se aproximar (de ${antesD.toFixed(1).replace(".", ",")} m para ${depoisD.toFixed(1).replace(".", ",")} m). Só dá para se afastar ou circular.`);
            return render();
          }
        }
        // Mover no campo custa a Ação de Movimento (só para quem é o dono do token).
        if (!ui.souMestre && !(await gastarAcao("Ação de Movimento", "mover no campo"))) return render();
        snapshot("mover no campo");
        c.pos = { x: Math.round(nx * 10) / 10, lane: nlane };
        await salvarCombate(); render();
      };
      window.addEventListener("pointermove", mover); window.addEventListener("pointerup", soltar);
    });
  });
  $("#cb-prox")?.addEventListener("click", async () => { let salvarNaveJunto = false; const rodAntes = camp.combate.rodada;
    const encerrou = camp.combate.ordem[camp.combate.turno];   // quem termina o turno agora
    proximoTurno(camp.combate); if (camp.combate.rodada !== rodAntes) camp.combate.agiram = []; const atual = camp.combate.ordem[camp.combate.turno];
    // FIM DE TURNO: efeitos declarados da criatura que acabou de agir.
    // Em try/catch: se este bloco quebrar, o turno ainda avança e salva —
    // sem isso, um erro aqui derrubava a rodada inteira sem persistir nada.
    try {
      if (encerrou && encerrou !== atual && habsDoCombatente(encerrou).some((h) => h.efeito && h.gatilho === "fim_turno")) {
        const M = await criaturaMod(); const cr = M.criar({ ...encerrou, habs: habsDoCombatente(encerrou) }, rolarTexto);
        for (const r of cr.disparar(M.GATILHOS.FIM_TURNO)) {
          if (r.tipo === "cura") { encerrou.hp = Math.min(encerrou.hp_max, (encerrou.hp || 0) + r.valor);
            await enviar("sistema", `♻ ${encerrou.nome} — ${r.habilidade}: ${r.texto} (${encerrou.hp}/${encerrou.hp_max}).`); }
          else if (r.tipo === "dano") { encerrou.hp = Math.max(0, (encerrou.hp || 0) - r.valor);
            await enviar("sistema", `☠ ${encerrou.nome} — ${r.habilidade}: ${r.texto}.`); }
          else await enviar("sistema", `⚡ ${encerrou.nome} — ${r.habilidade}: ${r.texto || "efeito de fim de turno"}.`);
        }
      }
    } catch (eFimTurno) { console.error("fim_turno:", eFimTurno); }
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
          await salvarFicha(p2.id, p2.dados);
          if (ui.meuPers && ui.meuPers.id === p2.id) ui.meuPers.dados = p2.dados;
          if (expiraram.length) sincronizarCdCombate(p2.id, p2.dados);
          for (const nome of expiraram) await enviar("sistema", `⌛ ${p2.nome}: ${nome} acabou.`);
        }
      }
    }
    // Eventos agendados contam para baixo a cada rodada e disparam no zero.
    try {
      if (camp.combate.rodada !== rodAntes && (camp.combate.eventos || []).length) {
        const restantes = [];
        for (const ev of camp.combate.eventos) {
          ev.turnos -= 1;
          if (ev.turnos <= 0) await enviar("sistema", `⏳ **${ev.n}** acontece agora!${ev.texto ? ` ${ev.texto}` : ""}`);
          else { restantes.push(ev); if (ev.turnos <= 2) await enviar("sistema", `⏳ ${ev.n}: ${ev.turnos} rodada(s).`); }
        }
        camp.combate.eventos = restantes;
      }
    } catch (eEvento) { console.error("eventos:", eEvento); }
    // Reação recarrega a cada rodada; Principal e Movimento, no turno de cada um.
    if (camp.combate.rodada !== rodAntes) for (const c2 of camp.combate.ordem) if (c2.acoes) c2.acoes.r = false;
    if (atual) atual.acoes = { r: !!atual.acoes?.r };
    if (atual) delete atual._movMetade;   // tentativa de apagar fogo só reduz o deslocamento no turno em que aconteceu
    if (atual) {
      // A Manobra Evasiva vale "até o próximo turno do piloto" — aqui ela expira.
      const ntv = camp.combate.nave || naveTaticaVazia();
      if (ntv.evasiva != null && atual.personagem_id && atual.personagem_id === ntv.evasivaDe) {
        ntv.evasiva = null; ntv.evasivaDe = null;
        await enviar("sistema", `🚀 A Manobra Evasiva se esgota: a Defesa da nave volta ao normal.`);
      }
      // Sobrecarga de Propulsores dura uma rodada.
      if (camp.combate.rodada !== rodAntes && ntv.manobraAte > 0) {
        ntv.manobraAte -= 1;
        if (ntv.manobraAte <= 0) { ntv.manobraExtra = 0;
          await enviar("sistema", `⚙ A sobrecarga dos propulsores passa: a Manobrabilidade volta ao normal.`); }
      }
      // Escudos derrubados por Guerra Eletrônica voltam no turno da nave afetada.
      if (ehNave(atual) && atual.escudosOff > 0) {
        atual.escudosOff -= 1;
        if (atual.escudosOff <= 0) await enviar("sistema", `📡 Os escudos de ${atual.nome} voltam a responder.`);
      }
      // 0) Efeitos automáticos da própria criatura (regeneração, auras, invocações)
      try {
        if (habsDoCombatente(atual).some((h) => h.efeito)) {
          const M = await criaturaMod();
          const cr = M.criar({ ...atual, habs: habsDoCombatente(atual) }, rolarTexto);
          for (const r of cr.disparar(M.GATILHOS.INICIO_TURNO)) {
            if (r.tipo === "cura") { atual.hp = Math.min(atual.hp_max, (atual.hp || 0) + r.valor);
              await enviar("sistema", `♻ ${atual.nome} — ${r.habilidade}: ${r.texto} (${atual.hp}/${atual.hp_max}).`); }
            else if (r.tipo === "dano") { atual.hp = Math.max(0, (atual.hp || 0) - r.valor);
              await enviar("sistema", `☠ ${atual.nome} — ${r.habilidade}: ${r.texto}.`); }
            else if (r.tipo === "invocar") {
              const base = todasCriaturas().find((x) => x.n === r.criatura) || (camp.bestiario || []).find((x) => x.n === r.criatura);
              if (base) {
                for (let n = 0; n < (r.qtd || 1); n++) {
                  const iguais = camp.combate.ordem.filter((x) => x.nome.replace(/ #\d+$/, "") === base.n).length;
                  camp.combate.ordem.push({ id: cbId(), nome: iguais ? `${base.n} #${iguais + 1}` : base.n, ini: d(20),
                    hp: base.hp, hp_max: base.hp, cd: base.cd, tipo: "inimigo", ameaca: base.ameaca, ataques: base.ataques,
                    habs: base.habs || [], pos: posInicial(camp.combate.ordem, "inimigo") });
                }
                await enviar("sistema", `👹 ${atual.nome} — ${r.habilidade}: ${r.texto}. ${r.qtd || 1}× ${base.n} entra no rastreador.`);
              } else await enviar("sistema", `👹 ${atual.nome} — ${r.habilidade}: ${r.texto}. (Criatura "${r.criatura}" não encontrada — o Mestre adiciona.)`);
            }
            else if (r.tipo === "condicao") {
              if (r.alvo === "proprio") { aplicarCond(atual, r.cond, r.turnos); await enviar("sistema", `🏷 ${atual.nome} — ${r.habilidade}: fica ${r.cond} por ${r.turnos} turno(s).`); }
              else await enviar("sistema", `🏷 ${atual.nome} — ${r.habilidade}: ${r.texto || `aplica ${r.cond}`} (o Mestre resolve o alvo).`);
            }
            else await enviar("sistema", `⚡ ${atual.nome} — ${r.habilidade}: ${r.texto || "efeito passivo — o Mestre aplica"}.`);
          }
        }
      } catch (eInicioTurno) { console.error("inicio_turno:", eInicioTurno); }
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
            await salvarFicha(alvoP.id, dd); alvoP.dados = dd;
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
    // AO MORRER: efeitos declarados de quem caiu desde o último turno (varre uma vez).
    try {
      for (const c2 of camp.combate.ordem) {
        if (c2._morreu || !foraDeCombate(c2) || !habsDoCombatente(c2).some((h) => h.efeito && h.gatilho === "ao_morrer")) continue;
        c2._morreu = true;
        const M = await criaturaMod(); const cr = M.criar({ ...c2, habs: habsDoCombatente(c2) }, rolarTexto);
        for (const r of cr.disparar(M.GATILHOS.AO_MORRER)) {
          // Dano em área (ex. Bocarra Corrosiva "Morte Volátil", Morcego-Bomba
          // "Detonação Biológica"): rola automático e já aplica em quem estiver
          // no raio — igual ao resto do app, o teste de resistência (`r.cd`)
          // fica só narrado pro Mestre reduzir à metade na mão se o jogador
          // disser que passou (mesmo padrão dos botões ±PV livres do rastreador).
          if (r.tipo === "dano" && r.alvo === "area" && r.raio && c2.pos) {
            const pegos = camp.combate.ordem.filter((x) => x !== c2 && !ehNave(x) && !foraDeCombate(x) && x.pos && (distCombate(c2, x) ?? 99) <= r.raio);
            if (pegos.length) {
              const linhas = [];
              for (const alvoA of pegos) { const rd = await aplicarDanoAlvo(alvoA, r.valor, r.tipoDano); linhas.push(`${alvoA.nome}: ${rd.msg}`); }
              await enviar("sistema", `💀 ${c2.nome} — ${r.habilidade}: ${r.texto} num raio de ${r.raio}m${r.cd ? ` (${r.atributo} CD ${r.cd} reduz à metade — ajuste na mão quem passou)` : ""}. ${linhas.join(" · ")}`);
              continue;
            }
          }
          await enviar("sistema", `💀 ${c2.nome} — ${r.habilidade}: ${r.texto || "efeito ao morrer"}.${r.tipo === "invocar" ? " O Mestre adiciona ao rastreador." : ""}`);
        }
      }
    } catch (eAoMorrer) { console.error("ao_morrer:", eAoMorrer); }
    // Gravação única: escrever em campanhas no meio do handler dispara o realtime,
    // que sobrescreveria camp.combate com o estado antigo e travaria o turno.
    const campos = { combate: camp.combate }; if (salvarNaveJunto) campos.nave = camp.nave;
    await salvarCamp(campos, "salvar o turno");
    render(); });
  $("#cb-add-btn")?.addEventListener("click", async () => {
    const v = $("#cb-quem").value; if (!v) return;
    if (v.startsWith("j:")) { const p = (pers || []).find((x) => x.id === v.slice(2)); if (!p) return;
      // Quem está a bordo (posto de nave atribuído) some do campo tático — ver
      // `estaABordoDeNave` — mesmo com a nave FORA de cena. Adicionar assim sem
      // avisar deixava o personagem "invisível" no rastreador, sem token nenhum
      // e sem pista do motivo. Avisa e oferece tirar do posto na hora.
      const membroDono = (membros || []).find((m) => m.perfil_id === p.dono_id);
      if (membroDono?.posto) {
        const nomePosto = ESTACOES[membroDono.posto]?.n || membroDono.posto;
        const semNave = !(camp.nave && camp.combate.naveEmCena);
        const sair = await confirmModal(
          `${p.nome || "Esse personagem"} está no posto "${nomePosto}"${semNave ? " e a nave não está em cena" : ""} — enquanto estiver a bordo, ele não aparece como token no campo tático.\n\nTirar do posto agora, pra entrar em combate físico?`,
          { okLabel: "Tirar do posto e adicionar" });
        if (sair) {
          await sb.from("campanha_membros").update({ posto: null }).eq("campanha_id", id).eq("perfil_id", membroDono.perfil_id);
          membroDono.posto = null;
        }
      }
      const kk = calc({ ...novaFichaDados(), ...p.dados }); const nome = p.nome || "Tripulante";
      camp.combate.ordem.push({ id: cbId(), nome, ini: d(20) + kk.iniciativa, hp: p.dados.pvAtual ?? kk.attr.Con, hp_max: kk.pvMax || 1, cd: kk.cd, tipo: "jogador", personagem_id: p.id });
    } else if (v.startsWith("ni:")) {
      const base = NAVES[+v.slice(3)]; if (!base) return;
      const iguais = camp.combate.ordem.filter((x) => x.modelo === base.n).length;
      camp.combate.ordem.push({ id: cbId(), tipo: "nave", lado: "inimiga", modelo: base.n,
        nome: iguais ? `${base.n} #${iguais + 1}` : base.n, ini: d(20) + (base.manobra || 0),
        casco: base.casco, casco_max: base.casco, escudos: base.escudos, escudos_max: base.escudos,
        manobra: base.manobra, dano: base.dano, ataques: base.ataques || [], armas: base.armas || [] });
    } else { const b = v.startsWith("c:") ? camp.bestiario[+v.slice(2)] : todasCriaturas()[+v.slice(2)]; if (!b) return;
      // Lacaios entram em bando: uma linha só, com quantidade. O dano transborda de um para o próximo.
      const rq = await modalForm({ titulo: `🎲 ${b.n}`,
        descricao: b.ameaca === "Lacaio" ? "Lacaios costumam vir em grupo. Uma linha só no rastreador, com a quantidade." : "",
        campos: [{ k: "q", label: "Quantos", tipo: "numero", valor: b.ameaca === "Lacaio" ? 5 : 1, min: 1, max: 20 }], okLabel: "Adicionar" });
      if (!rq) return;
      const qtd = Math.max(1, +rq.q || 1);
      const iguais = camp.combate.ordem.filter((x) => x.nome.replace(/ #\d+$/, "") === b.n).length;
      camp.combate.ordem.push({ id: cbId(), nome: iguais ? `${b.n} #${iguais + 1}` : b.n, ini: d(20), hp: b.hp, hp_max: b.hp, cd: b.cd, tipo: "inimigo", ameaca: b.ameaca, ataques: b.ataques, habs: b.habs || [], ...(qtd > 1 ? { qtd } : {}) });
    }
    const novoCb = camp.combate.ordem[camp.combate.ordem.length - 1];
    // Naves também entram no campo tático agora (posição própria, mesmo grid dos
    // personagens/criaturas) — tratadas como "inimigo" pro lado em que aparecem,
    // já que só entram por aqui como `lado: "inimiga"`.
    if (novoCb && !novoCb.pos) novoCb.pos = posInicial(camp.combate.ordem, ehNave(novoCb) ? "inimigo" : novoCb.tipo);
    ordenarCombate(camp.combate); await salvarCombate(); render();
  });
  document.querySelectorAll(".cb-atk").forEach((b) => b.onclick = async () => {
    const c = cbFind(b.dataset.cb); const lista = ataquesDoCombatente(pers, c); if (!c || !lista) return;
    const atk = lista[+b.dataset.atk]; if (!atk) return;
    const pd = parseDice(atk.dano);
    // Ataque sem rolagem de acerto (efeito automático / teste de resistência): só posta o dado.
    if (atk.bonus == null) {
      let danoTxt = "", danoTotal = null;
      if (pd) { const ds = rollNd(pd.n, pd.f); danoTotal = ds.reduce((x, y) => x + y, 0) + pd.mod; danoTxt = ` · dano ${atk.dano} [${ds.join(", ")}] = ${danoTotal}`; }
      return enviar("rolagem", null, { titulo: `${c.personagem_id ? "🎯" : "👹"} ${c.nome} — ${atk.n}`,
        detalhe: `efeito automático${danoTxt}`, extra: atk.extra || "", ...(danoTotal != null ? { dano_total: danoTotal } : {}) });
    }
    // Mira um alvo do rastreador — o acerto e o dano se resolvem sozinhos.
    // O alcance é informativo aqui: quem conduz é o Mestre, que pode forçar.
    const alc = atk.alcance || null;
    const alvos = camp.combate.ordem.filter((x) => !foraDeCombate(x) && x.id !== c.id && !x.nave_party)
      .map((x) => ({ x, dist: distCombate(c, x) }));
    const dentro = alvos.filter((o) => alc == null || o.dist == null || o.dist <= alc + 0.01);
    const oposto = (o) => (o.x.tipo === "jogador") !== (c.tipo === "jogador");
    const padrao = (dentro.find(oposto) || dentro[0] || alvos.find(oposto) || alvos[0])?.x.id || "";
    const r = alvos.length ? await modalForm({ titulo: `⚔ ${c.nome} — ${atk.n}`,
      descricao: alc ? `Alcance deste ataque: ${String(alc).replace(".", ",")} m.` : "",
      campos: [{ k: "alvo", label: "Alvo", tipo: "select", valor: padrao, opcoes: [
        ...alvos.map(({ x, dist }) => ({ v: x.id, l: `${ehNave(x) ? "🚀 " : ""}${x.nome} — ${ehNave(x) ? `casco ${x.casco}/${x.casco_max}` : `${vidaAtual(x)}/${vidaMax(x)} PV, Def ${x.cd ?? 10}`}${dist != null ? ` · ${dist.toFixed(1).replace(".", ",")} m${alc != null && dist > alc + 0.01 ? " ⚠ fora de alcance" : ""}` : ""}` })),
        { v: "", l: "— só rolar (Mestre resolve) —" } ] }], okLabel: "Atacar" }) : { alvo: "" };
    if (!r) return;
    const alvo = r.alvo ? camp.combate.ordem.find((x) => x.id === r.alvo) : null;
    const distAlvo2 = alvo ? alvos.find((o) => o.x.id === alvo.id)?.dist : null;
    const condsAlvo = (alvo?.cond || []).map((x) => x.n.toLowerCase());
    const bonusMarcado = condsAlvo.includes("marcado") ? 2 : 0;
    const alvoAberto = condsAlvo.some((n) => /atordoado|paralisado|caído|cego|surpreso/.test(n));
    const vSoma = (ui.vantagem || 0) + (alvoAberto ? 1 : 0);
    const vv = vSoma > 0 ? 1 : vSoma < 0 ? -1 : 0;
    let nat, detVant = "";
    if (vv !== 0) { const r1 = d(20), r2 = d(20); nat = vv > 0 ? Math.max(r1, r2) : Math.min(r1, r2); detVant = ` [${vv > 0 ? "vant" : "desv"} ${r1}/${r2}]`; } else nat = d(20);
    const acerto = nat + atk.bonus + bonusMarcado;
    // Paralisado (regra da mesa): ataque a até 2m dele é Crítico automático (nat 1 ainda falha).
    const paralisadoPerto2 = condsAlvo.includes("paralisado") && distAlvo2 != null && distAlvo2 <= 2.01;
    // Armadura anticrítica: mesma checagem do [data-atq], só que aqui o alvo vem
    // do rastreador — só faz sentido pra linha de jogador (personagem_id).
    const semCriticoAlvo2 = alvo?.personagem_id
      ? !!calc({ ...novaFichaDados(), ...(pers.find((p2) => p2.id === alvo.personagem_id)?.dados || {}) }).efeitos?.aoSofrer?.().semCritico
      : false;
    const seriaCritico2 = nat === 20 || (paralisadoPerto2 && nat !== 1);
    const critAuto2 = !semCriticoAlvo2 && seriaCritico2;
    const mult = critAuto2 ? 2 : 1;
    const ds = pd ? rollNd(pd.n, pd.f) : [];
    const danoDiceSoma = pd ? ds.reduce((x, y) => x + y, 0) : 0;
    const danoTotal = pd ? danoCritico(danoDiceSoma, pd.mod, mult) : 0;
    // Mesmo layout de [data-atq] (mesa-ficha.js): `detalhe` só com a rolagem
    // em dados brutos (o total de acerto já aparece grande no .m-total, não
    // precisa repetir "= acerto N" aqui), e o resumo do dano no `extra` —
    // antes esta linha cravava "= acerto N" + a conta do dano toda dentro de
    // `detalhe`, então a MESMA arma saía com um formato diferente conforme
    // quem rolou (jogador vs. Mestre pelo rastreador).
    const notaCrit = critAuto2 && paralisadoPerto2 && nat !== 20 ? "crítico automático — Paralisado ≤2m" : semCriticoAlvo2 && seriaCritico2 ? "🛡 armadura anticrítica bloqueia o crítico" : "";
    const danoExtra = pd ? `Dano: ${danoTotal}${mult > 1 ? ` (${danoDiceSoma} + ${pd.mod} × ${mult})` : ""}` : "";
    await enviar("rolagem", null, { titulo: `${c.personagem_id ? "🎯" : "👹"} ${c.nome} — ${atk.n}`,
      detalhe: `d20 [${nat}]${detVant} ${sign(atk.bonus)}${bonusMarcado ? ` +${bonusMarcado} Marcado` : ""}${pd ? ` · dano ${atk.dano} [${ds.join(", ")}]${pd.mod ? ` ${sign(pd.mod)}` : ""}${mult > 1 ? ` ×${mult}` : ""}` : ""}`,
      total: acerto, crit: critAuto2, fumble: nat === 1,
      extra: [danoExtra, notaCrit, atk.extra].filter(Boolean).join("  —  "), ...(danoTotal ? { dano_total: danoTotal } : {}), ...(alvo ? { alvo_resolvido: true } : {}) });
    if (alvo && danoTotal) {
      const cobA = (alc == null || alc > 3) ? [0, 2, 5][alvo.cobertura || 0] : 0;   // cobertura só vale contra tiro
      const def = (alvo.cd ?? 10) + cobA;
      if (nat === 20 || (nat !== 1 && acerto >= def)) {
        snapshot("ataque no rastreador");
        const rd = await aplicarDanoAlvo(alvo, danoTotal, tipoDanoAtaque(atk));
        // AO ACERTAR: efeitos declarados do atacante (veneno na mordida, agarrar…).
        // Em try/catch: o dano de aplicarDanoAlvo acima já foi aplicado em memória —
        // se isto quebrar, ainda precisamos chegar no salvarCombate() abaixo.
        try {
          const habsAc = habsDoCombatente(c).filter((h) => h.efeito && h.gatilho === "ao_acertar");
          if (habsAc.length) {
            const M = await criaturaMod(); const cr = M.criar({ ...c, habs: habsAc }, rolarTexto);
            for (const rr of cr.disparar(M.GATILHOS.AO_ACERTAR)) {
              if (rr.tipo === "condicao") { aplicarCond(alvo, rr.cond, rr.turnos, c.id); await enviar("sistema", `🏷 ${c.nome} — ${rr.habilidade}: ${alvo.nome} fica ${rr.cond} por ${rr.turnos} turno(s).`); }
              else if (rr.tipo === "dano") { const r3 = await aplicarDanoAlvo(alvo, rr.valor); await enviar("sistema", `☠ ${c.nome} — ${rr.habilidade}: ${rr.texto} em ${alvo.nome} · ${r3.msg}.`); }
              else await enviar("sistema", `⚡ ${c.nome} — ${rr.habilidade}: ${rr.texto || "efeito ao acertar"}.`);
            }
          }
        } catch (eAoAcertar) { console.error("ao_acertar:", eAoAcertar); }
        // AO MATAR: efeitos declarados do atacante quando este golpe reduziu o
        // alvo a 0 PV (ex. um "vampiro" que se cura ao abater alguém). A maioria
        // das habilidades "ao matar" do bestiário (copiar aparência, aprender
        // perícia da vítima…) não tem efeito numérico pra mecanizar — continuam
        // só em texto pro Mestre narrar; o gatilho aqui só resolve o que o motor
        // sabe fazer sozinho (cura/dano/condição).
        if (!ehNave(alvo) && foraDeCombate(alvo)) {
          try {
            const habsMatar = habsDoCombatente(c).filter((h) => h.efeito && h.gatilho === "ao_matar");
            if (habsMatar.length) {
              const M = await criaturaMod(); const cr = M.criar({ ...c, habs: habsMatar }, rolarTexto);
              for (const rm of cr.disparar(M.GATILHOS.AO_MATAR)) {
                if (rm.tipo === "cura") { c.hp = Math.min(c.hp_max, (c.hp || 0) + rm.valor); await enviar("sistema", `☠ ${c.nome} — ${rm.habilidade}: abateu ${alvo.nome} e ${rm.texto} (${c.hp}/${c.hp_max}).`); }
                else await enviar("sistema", `☠ ${c.nome} — ${rm.habilidade}: abateu ${alvo.nome} — ${rm.texto || "efeito ao matar"}.`);
              }
            }
          } catch (eAoMatar) { console.error("ao_matar:", eAoMatar); }
        }
        await salvarCombate();
        await enviar("sistema", `💥 ${c.nome} acerta ${alvo.nome} (Def ${def}${cobA ? ` · 🧱+${cobA} cobertura` : ""}): ${rd.msg}.${!ehNave(alvo) && foraDeCombate(alvo) ? " 💀 CAIU!" : ""}`);
      } else await enviar("sistema", `❌ ${c.nome} erra ${alvo.nome} (Def ${def}${cobA ? ` · 🧱+${cobA} cobertura` : ""}).`);
      render();
    }
  });
  document.querySelectorAll(".cb-dmg").forEach((b) => b.onclick = async () => { const c = cbFind(b.dataset.cb); if (!c) return; snapshot("dano/cura no rastreador"); const delta = +b.dataset.d;
    if (ehNave(c)) {
      if (delta < 0) { const r = danoNave(c, -delta); if (r.critico) { const av = rolarAvaria(); (camp.combate.avarias = camp.combate.avarias || []).push(av); await enviar("sistema", `⚠ ${c.nome}: ${av.n} — ${av.e}`); } }
      else c.escudos = Math.min(c.escudos_max, c.escudos + delta);
      if (c.nave_party && camp.nave) { camp.nave.casco = c.casco; camp.nave.escudos = c.escudos; await salvarCamp({ nave: camp.nave }, "salvar a nave"); }
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
      await salvarCamp({ combate: camp.combate, ...(snap.nave ? { nave: camp.nave } : {}) }, "desfazer"); render();
    }); });
  document.querySelectorAll(".cb-hpset").forEach((i) => i.onchange = async () => { const c = cbFind(i.dataset.cb); if (!c) return; if (ehNave(c)) { c.casco = Math.max(0, Math.min(c.casco_max, +i.value || 0)); if (c.nave_party && camp.nave) { camp.nave.casco = c.casco; await salvarCamp({ nave: camp.nave }, "salvar a nave"); } }
    else { const pvA = c.hp; c.hp = Math.max(0, Math.min(c.hp_max, +i.value || 0)); await sincronizarFicha(c, c.hp - pvA); }
    await salvarCombate(); render(); });
  document.querySelectorAll(".cb-rm").forEach((b) => b.onclick = async () => { const idx = camp.combate.ordem.findIndex((x) => x.id === b.dataset.cb); if (idx < 0) return; snapshot("remover combatente");
    const nomeRm = camp.combate.ordem[idx]?.nome || "combatente";
    camp.combate.ordem.splice(idx, 1); if (camp.combate.turno >= camp.combate.ordem.length) camp.combate.turno = 0;
    await salvarCombate(); render();
    avisar(`${nomeRm} saiu do combate`, async () => {
      const snap = pilhaUndo.pop(); if (!snap) return;
      camp.combate = snap.combate; await salvarCombate(); render();
    }); });
}
