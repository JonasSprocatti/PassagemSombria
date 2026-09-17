// ============================================================================
//  FICHA — aba "Meu personagem" de telaMesa (vitais, munição/pentes, testes,
//  [data-atq] de ataque de arma, habilidades ativas, itens, scripts/conjuração,
//  macros de rolagem, direcionar dano/cura), extraído de app.js. 4ª e última
//  fatia da modularização do telaMesa (ver "Modularização de telaMesa" em
//  CLAUDE.md — ordem: nave → combate → ficha).
//  Uso: import { renderFicha, wireFicha } from "./mesa-ficha.js";
//       renderFicha(ctx) dentro do template da mesa; wireFicha(ctx) na hora de
//       religar handlers (mesmo momento em que os outros `[data-*]` da mesa
//       são religados).
//
//  Corpo copiado tal e qual de app.js — só os identificadores livres viraram
//  imports, mesmo padrão de biblioteca.js/admin.js/mesa-mestre.js/mesa-nave.js/
//  mesa-combate.js. `aplicarEmAlvos` (resolve scripts/granadas/salvaguardas
//  contra o rastreador) e `[data-atq]` moram aqui porque são combate PESSOAL do
//  jogador — não o rastreador do Mestre (isso é mesa-combate.js).
// ============================================================================
import { RACAS, CLASSES, SCRIPTS, PERICIAS, propsArma, ehConsumivel, TIPOS_PENTE, PENTE_PADRAO, TIROS_POR_PENTE, custoTiro } from "./dados-jogo.js";
import { NIVEIS_AMEACA } from "./dados-bestiario.js";
import {
  d, sign, parseDice, rollNd, danoCritico, aplicarCond, novaFichaDados, calc,
  distCombate, tipoDanoArma, alcanceDaArma, empurrarDe, dcSalvaguarda,
} from "./regras.js";
import { modalForm, confirmModal, efeitoMatrix } from "./ui.js";
import {
  sb, esc, usuario, perfil,
  ehNave, foraDeCombate, vidaAtual, vidaMax, rolarAvaria, salvarFicha,
  todasArmas, todosImplantes, danoArma, armaMontada,
  estadoArma, normalizaPentes, capacidadePente, armasDeFogo, habilidadesAtivas, duracaoDe, rolarExpr,
} from "./app.js";

const $ = (s) => document.querySelector(s);

// Implante com `ataque` declarado (ex. Lâmina Oculta Retrátil) age como uma
// arma branca extra, sempre "equipada" enquanto o implante estiver instalado —
// rola dado próprio de dano em vez de só somar bônus num ataque já existente.
const implanteComoArma = (nome) => {
  const imp = todosImplantes().find((x) => x.n === nome);
  if (!imp?.ataque) return null;
  return { n: imp.n, preco: 0, dano: imp.ataque.dano, tipo: imp.ataque.tipo || "branca",
    per: imp.ataque.per || "Armas Brancas", attr: imp.ataque.attr || "For",
    kw: imp.ataque.kw, efeitos: imp.ataque.efeitos, _implante: true };
};
const catDoAtaque = (nome) => todasArmas().find((x) => x.n === nome) || implanteComoArma(nome);
// Armas equipadas + implantes com ataque próprio, na mesma lista de `[data-atq]`.
const armasEqDe = (f, semImplantes) => f ? [
  ...(f.inventario || []).filter((i) => i.tipo === "arma" && i.equip),
  ...(semImplantes ? [] : (f.implantes || [])).filter((nome) => implanteComoArma(nome))
    .map((nome) => ({ nome, tipo: "arma", equip: true, _implante: true })),
] : [];
// Resistência (mais fraca que imunidade): não anula nada, só dá Vantagem no
// teste de resistência contra aquele tipo de dano/condição.
const temResistencia = (kAlvo, chave) => !!(kAlvo?.efeitos && chave && kAlvo.efeitos.resistencias().includes(String(chave).toLowerCase()));
// Cego/Envenenado só atrapalham testes de perícia que fazem sentido pra cada um —
// Cego, os que dependem de enxergar; Envenenado, os que dependem do corpo responder.
const PERICIAS_VISUAIS = ["Percepção", "Investigação", "Prestidigitação", "Pilotagem"];
const PERICIAS_FISICAS = ["Atletismo", "Acrobacia", "Furtividade"];
const desvPorTeste = (condsList, pericia) =>
  (condsList.includes("cego") && PERICIAS_VISUAIS.includes(pericia)) ||
  (condsList.includes("envenenado") && PERICIAS_FISICAS.includes(pericia));
// Macros de rolagem: expressões salvas por personagem, só no navegador (não
// sincroniza entre dispositivos nem precisa de coluna nova no banco).
const macrosDe = (pid) => { if (!pid) return [];
  try { return JSON.parse(localStorage.getItem("ps-macros-" + pid) || "[]"); } catch { return []; } };
const salvarMacros = (pid, lista) => { try { localStorage.setItem("ps-macros-" + pid, JSON.stringify(lista.slice(0, 12))); } catch {} };

export function renderFicha(ctx) {
  const { id, ui, f, k, camp, pers, meus, semImplantes, minhaLinhaCb } = ctx;
  const armasEq = armasEqDe(f, semImplantes);
  return `
          <div class="mesa-painel" ${ui.abaMesa === "ficha" ? "" : "hidden"}>
          <section class="sec"><header><span class="tag">◈</span><h2>Meu personagem</h2></header>
            <select id="sel-pers" title="Troque de personagem sem sair da mesa">${ui.meuPers ? "" : `<option value="">— vincular personagem —</option>`}
              ${(meus || []).map((m) => `<option value="${m.id}" ${ui.meuPers?.id === m.id ? "selected" : ""}>${esc(m.nome) || "sem nome"}${m.campanha_id === id ? "" : " (vincular)"}</option>`).join("")}</select>
            ${f ? `${(() => {
              const pvP = k.pvMax ? Math.max(0, Math.min(100, 100 * f.pvAtual / k.pvMax)) : 0;
              const ramP = k.ramMax ? Math.max(0, Math.min(100, 100 * k.ramLivre / k.ramMax)) : 0;
              const est = f.pvAtual <= 0 ? "morto" : pvP <= 30 ? "critico" : pvP <= 60 ? "ferido" : "";
              return `<div class="vitais-barras compacto">
                <div class="vb" data-barra="mesa-pv"><div class="vb-topo"><span>❤ PV</span><b class="${est}">${f.pvAtual}<span class="dim">/${k.pvMax}</span></b></div>
                  <div class="vb-trilho"><span class="rastro"></span><span class="cb-hp-barra vb-fill ${est}" style="width:${pvP}%"></span></div></div>
                <div class="vb" data-barra="mesa-ram"><div class="vb-topo"><span>◈ RAM</span><b class="sombra-c">${k.ramLivre}<span class="dim">/${k.ramMax}</span></b></div>
                  <div class="vb-trilho"><span class="rastro"></span><span class="cb-hp-barra vb-fill ram" style="width:${ramP}%"></span></div></div>
              </div>`; })()}
            <p class="regra">CD ${k.cd} · conj +${k.conj}${k.pvTemp ? ` · <b class="tech-c">✚ ${k.pvTemp} PV temp</b>` : ""}${k.escudoMax ? ` · <b class="sombra-c">🛡 escudo ${k.escudoLivre}/${k.escudoMax}</b>` : ""}${f.pvAtual <= 0 ? ` · <b class="perigo-c">☠ inconsciente</b>` : ""}</p>
            ${k.implantesInertes ? `<p class="regra perigo-c fx-glitch"><b>⧉ Implantes inertes:</b> você está dentro de uma zona que desliga cibernética — os números acima já estão recalculados sem eles. Saia do raio para voltar ao normal.</p>` : ""}
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
                <div class="mun-mochila"><span class="dim">🎒 mochila (${totalReserva}/${k.pentesReserva})</span>
                  <div class="pentes-reserva">${Object.entries(res).map(([k, q]) => { const t2 = TIPOS_PENTE[k];
                    return `<button class="pente-tipo ${q ? "" : "vazio-tipo"}" data-carregar="${k}" ${q ? "" : "disabled"}
                      title="${esc(t2.n)} — ${esc(t2.d)}" style="border-color:${q ? t2.cor : "var(--line)"};color:${q ? t2.cor : "var(--dim)"}">${t2.ic} ${q}</button>`; }).join("")}</div></div>`;
            })()}
            <div class="acoes-mesa">
              ${(() => {
                if (!camp.combate?.ativo) return "";
                const condsSelf = (minhaLinhaCb()?.cond || []).map((c) => c.n.toLowerCase());
                const btns = [];
                if (condsSelf.includes("em chamas")) btns.push(`<button id="cb-apagar-fogo" class="mini" title="Ação Principal + Reação; deslocamento pela metade neste turno. Rola d20 puro (sem modificador) — 10 ou mais apaga.">🔥 Apagar fogo</button>`);
                if (condsSelf.includes("caído")) btns.push(`<button id="cb-levantar" class="mini" title="Ação Principal + Ação de Movimento: levanta na hora, sem esperar a condição acabar.">🧎 Levantar</button>`);
                return btns.join("");
              })()}
              <select id="sel-per">${PERICIAS.map(([pn]) => `<option>${pn}</option>`).join("")}</select>
              <button id="rolar-per" class="mini">TESTE</button>
              <button id="teste-oposto" class="mini" title="Teste oposto: você e um alvo rolam perícias diferentes e o maior vence">⚖ OPOSTO</button>
              ${armasEq.length ? `<label class="chk" style="margin:0" title="Ataque furtivo: +2 no acerto (armas Ocultas / Assassino) e dano DOBRADO para o Assassino."><input type="checkbox" id="atq-furtivo"/> 🥷 Furtivo</label>` : ""}
              ${armasEq.some((a) => propsArma(catDoAtaque(a.nome) || {}).descarrega) ? `<label class="chk" style="margin:0" title="Esvazia o pente inteiro num tiro só — dado de dano extra por bala gasta além do custo normal (só armas com a palavra-chave Descarregar)."><input type="checkbox" id="atq-descarregar"/> 🔫 Descarregar</label>` : ""}
              ${armasEq.map((a, i) => { const cat = catDoAtaque(a.nome); const pr = cat ? propsArma(cat) : {};
                const tip = [a._implante ? "Ataque de implante" : "", cat?.kw ? `${cat.kw}: ${pr.efeito}` : "", pr.area ? `Área: ${pr.areaTxt}` : "", pr.alcance ? `Alcance: ${pr.alcanceTxt}` : "", pr.agil ? "Ágil (Des)" : ""].filter(Boolean).join(" · ");
                return `<button class="mini atq" data-atq="${i}" title="${esc(tip)}">${a._implante ? "⧉" : "⚔"} ${esc(a.nome)} (${cat ? danoArma(cat, f.nivel) : "—"})${pr.area ? " ◎" : ""}${pr.agil ? " ⚡" : ""}${pr.aoAcertar?.length ? " 🏷" : ""}${pr.ignoraArmadura ? " 🗡" : ""}</button>`; }).join("")}
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
              <input id="dado-livre" placeholder="1d20+2d10" style="width:80px"/><button id="rolar-livre" class="mini">🎲</button><button id="macro-salvar" class="mini" title="Salvar essa expressão como macro, pra rolar num clique depois">☆</button>
              ${macrosDe(ui.meuPers?.id).map((m, i) => `<span class="macro-par"><button class="mini macro-chip" data-macro="${i}" title="${esc(m.expr)}${ui.vantagem ? ` · ${ui.vantagem > 0 ? "vantagem" : "desvantagem"} ligada` : ""}">🎲 ${esc(m.rotulo)}</button><button class="mini rm" data-macro-del="${i}" title="Remover macro">✕</button></span>`).join("")}
            </div>
            <div class="acoes-mesa"><b class="chrome">Direcionar dano:</b>
              <select id="sel-alvo">${(pers || []).map((x) => `<option value="${x.id}">${esc(x.nome)}</option>`).join("")}</select>
              <input id="dano-val" type="number" placeholder="valor" style="width:70px"/>
              <button id="enviar-dano" class="mini dano">💥 DANO</button><button id="enviar-cura" class="mini eq">✚ CURA</button></div>` : `<p class="regra">Vincule um personagem para rolar pela mesa.</p>`}
          </section>
          </div>`;
}

export function wireFicha(ctx) {
  const {
    id, camp, pers, ui, f, k, semImplantes, chavePers,
    enviar, salvarCamp, salvarCombate, render, snapshot,
    aplicarDanoAlvo, gastarAcao, sincronizarCdCombate, aurasSobre, minhaLinhaCb,
  } = ctx;
  $("#sel-pers").onchange = async (e) => {
    const pid = e.target.value; if (!pid) return;
    const escolhido = (pers || []).find((x) => x.id === pid);
    if (escolhido && escolhido.campanha_id === id) {
      // já está na mesa: é só troca de personagem ativo, sem recarregar a página
      localStorage.setItem(chavePers, pid);
      ui.meuPers = escolhido;
      await enviar("sistema", `◈ ${(perfil?.apelido) || "Alguém"} agora joga como ${escolhido.nome || "sem nome"}.`);
      return render();
    }
    const { error: errVinc } = await sb.from("personagens").update({ campanha_id: id }).eq("id", pid);
    if (errVinc) return alert("Não consegui vincular o personagem: " + errVinc.message);
    localStorage.setItem(chavePers, pid);
    location.reload();
  };
  if (!f) return;
  const armasEq = armasEqDe(f, semImplantes);
  const minhaTrava = (extra = []) => {
    if (ui.souMestre) return null;
    const bloq = ["atordoado", "paralisado", "dominado", "surpreso", "hesitante", ...extra];
    return (minhaLinhaCb()?.cond || []).find((c) => bloq.includes(c.n.toLowerCase())) || null;
  };
  // `vantOverride`: quando passado, substitui o toggle global de vant/desv da mesa —
  // usado por testes de perícia travados por condição (Cego/Envenenado em testes específicos).
  const rolarEEnviar = (titulo, mod, extras = {}, vantOverride) => {
    const vv = vantOverride !== undefined ? vantOverride : ui.vantagem;
    let nat, detVant = "";
    if (vv !== 0) { const a = d(20), b = d(20); nat = vv > 0 ? Math.max(a, b) : Math.min(a, b); detVant = ` [${vv > 0 ? "vant" : "desv"} ${a}/${b}]`; }
    else nat = d(20);
    const total = nat + mod;
    return enviar("rolagem", null, { titulo: (ui.privada ? "🔒 " : "") + titulo, detalhe: `d20 [${nat}]${detVant} ${sign(mod)}`, total, crit: nat === 20, fumble: nat === 1, ...(ui.privada ? { privada: true } : {}), ...extras });
  };
  // Resolve uma ação contra um ou vários combatentes do rastreador.
  //  acerto  → o conjurador rola d20 + acerto contra a Defesa do alvo (só acerta se vencer)
  //  atributo+cd → o alvo faz um teste de resistência (d20 + atributo) contra a CD (só pega se falhar)
  //  nenhum dos dois → efeito de área que pega todo mundo marcado
  // Depois aplica `dado` de dano e/ou a condição `cond` por `turnos` a quem o efeito pegou.
  //  area + raio → escolhe um epicentro no campo e pega todo mundo dentro do raio
  // `empurrao`: metros que o alvo atingido é jogado para longe do epicentro (ou de
  // quem conjurou, quando não há epicentro) no campo tático — Repulsão Cinética e afins.
  const aplicarEmAlvos = async ({ titulo, origem, dado = null, acerto = null, atributo = null, pericia = null, cd = null, cond = null, turnos = 2, area = false, raio = null, tipoDano = "físico", empurrao = 0 }) => {
    if (!camp.combate?.ativo || !camp.combate.ordem.length) {
      await enviar("sistema", `★ ${origem}: sem combate no rastreador — o Mestre resolve.${dado ? ` (dano ${dado})` : ""}${cond ? ` (${cond} ${turnos}t)` : ""}`);
      return true;   // narrado; não é cancelamento
    }
    const vivos = camp.combate.ordem.filter((c2) => !ehNave(c2) && !foraDeCombate(c2) && c2.personagem_id !== ui.meuPers?.id);
    if (!vivos.length) { await enviar("sistema", `★ ${origem}: nenhum alvo válido no rastreador.`); return true; }
    let alvos, epiNome = "", epiObj = null;
    // Área com raio declarado e posições no campo: escolhe o epicentro e o raio
    // decide quem pega — inclusive aliados, que é o risco real de uma granada.
    const todosComPos = camp.combate.ordem.filter((c2) => !ehNave(c2) && !foraDeCombate(c2) && c2.pos);
    if (area && raio && todosComPos.length) {
      const inimigosPos = todosComPos.filter((c2) => c2.tipo === "inimigo" || c2.lado === "inimiga");
      const r = await modalForm({ titulo,
        descricao: `Área de ${raio} m de raio. Escolha quem está no centro do impacto — todo mundo dentro do raio é atingido, aliado ou não.`,
        campos: [{ k: "epi", label: "Centro do impacto", tipo: "select",
          valor: (inimigosPos[0] || todosComPos[0]).id,
          opcoes: todosComPos.map((c2) => {
            const pegos = todosComPos.filter((y) => (distCombate(c2, y) ?? 99) <= raio).length;
            return { v: c2.id, l: `${c2.nome} — pega ${pegos} combatente${pegos === 1 ? "" : "s"}` };
          }) }], okLabel: "Lançar" });
      if (!r?.epi) return false;
      const epi = todosComPos.find((c2) => c2.id === r.epi);
      epiNome = epi?.nome || ""; epiObj = epi || null;
      alvos = todosComPos.filter((c2) => (distCombate(epi, c2) ?? 99) <= raio);
    } else if (area) {
      const r = await modalForm({ titulo, descricao: "Marque quem está na área de efeito.",
        campos: vivos.map((c2) => ({ k: c2.id, label: `${c2.nome} — ${vidaAtual(c2)}/${vidaMax(c2)} PV`, tipo: "select",
          valor: c2.tipo === "inimigo" ? "1" : "", opcoes: [{ v: "1", l: "no efeito" }, { v: "", l: "fora" }] })),
        okLabel: "Resolver" });
      if (!r) return false;   // cancelou — o chamador devolve o recurso
      alvos = vivos.filter((c2) => r[c2.id]);
    } else {
      const r = await modalForm({ titulo, campos: [{ k: "alvo", label: "Alvo", tipo: "select",
        opcoes: vivos.map((c2) => ({ v: c2.id, l: `${c2.nome} — ${vidaAtual(c2)}/${vidaMax(c2)} PV, Def ${c2.cd ?? 10}` })) }], okLabel: "Resolver" });
      if (!r?.alvo) return false;
      alvos = [vivos.find((c2) => c2.id === r.alvo)].filter(Boolean);
    }
    if (!alvos.length) { await enviar("sistema", `★ ${origem}: nenhum alvo marcado.`); return false; }
    const pdd = dado ? parseDice(dado) : null;
    const rolDano = pdd ? rollNd(pdd.n, pdd.f).reduce((x, y) => x + y, 0) + pdd.mod : 0;
    snapshot(titulo);
    const linhas = [];
    for (const alvo of alvos) {
      const defesa = alvo.cd ?? 10;
      let pegou = true, det = "";   // pegou = o efeito atinge o alvo
      if (acerto != null) {
        const natA = d(20), tot = natA + acerto;
        pegou = natA === 20 || (natA !== 1 && tot >= defesa);
        det = ` [ataque ${natA}${sign(acerto)}=${tot} vs Def ${defesa} — ${pegou ? "acertou" : "errou"}]`;
      } else if ((atributo || pericia) && cd != null) {
        let bo, kA = null;
        if (alvo.personagem_id) {
          kA = calc({ ...novaFichaDados(), ...((pers || []).find((p) => p.id === alvo.personagem_id)?.dados || {}) });
          if (pericia) { const pa = (PERICIAS.find(([n]) => n === pericia) || [])[1]; bo = (kA.attr[pa] || 0) + (kA.per[pericia] || 0); }
          else bo = kA.attr[atributo] || 0;
        } else bo = NIVEIS_AMEACA[alvo.ameaca]?.ordem ?? Math.max(0, defesa - 10);
        const rot = pericia || atributo;
        const temRes = temResistencia(kA, cond) || temResistencia(kA, tipoDano);
        const natS = temRes ? Math.max(d(20), d(20)) : d(20);
        const tot = natS + bo;
        pegou = tot < cd;
        det = ` [${rot} ${natS}${sign(bo)}=${tot}${temRes ? " (resistência: Vant.)" : ""} vs CD ${cd} — ${pegou ? "falhou" : "resistiu"}]`;
      }
      let danoMsg = "";
      if (pegou && rolDano) { const rd = await aplicarDanoAlvo(alvo, rolDano, tipoDano); danoMsg = ` ${rd.msg}`; if (rd.imune) pegou = false; }
      if (pegou && cond) aplicarCond(alvo, cond, turnos, minhaLinhaCb()?.id || null);
      // Empurrão: joga o alvo pra longe do epicentro (ou de quem conjurou). Só quem
      // tem posição no campo é empurrado — sem mapa, vira só narração.
      let empMsg = "";
      if (pegou && empurrao) {
        const fonte = epiObj || minhaLinhaCb();
        const nova = empurrarDe(fonte, alvo, empurrao);
        if (nova) { const antes = alvo.pos.x; alvo.pos = nova;
          empMsg = ` ↗ empurrado ${Math.abs(nova.x - antes).toFixed(1).replace(".", ",")} m`; }
      }
      linhas.push(`${pegou ? "💥" : "🛡"} ${alvo.nome}${det}${danoMsg}${pegou && cond ? ` · ${cond} ${turnos}t` : ""}${empMsg}${foraDeCombate(alvo) ? " 💀 CAIU" : ""}`);
    }
    await salvarCombate();
    await enviar("sistema", `★ ${origem}${epiNome ? ` — impacto em ${epiNome} (raio ${raio} m)` : ""}${rolDano ? ` — dano ${dado} [${rolDano}]` : ""}: ${linhas.join("  ·  ")}`);
    return true;
  };
  $("#rolar-per").onclick = () => { const pn = $("#sel-per").value; const at = PERICIAS.find(([x]) => x === pn)[1];
    const condsSelf = (minhaLinhaCb()?.cond || []).map((c) => c.n.toLowerCase());
    const desv = desvPorTeste(condsSelf, pn);
    rolarEEnviar(`Teste de ${pn}${desv ? " (Desvantagem)" : ""}`, k.attr[at] + k.per[pn], {}, desv ? -1 : undefined); };
  // Teste oposto genérico: Furtividade vs Percepção, Enganação vs Intuição, etc.
  $("#teste-oposto").onclick = async () => {
    const cands = (camp.combate?.ativo ? camp.combate.ordem.filter((x) => !ehNave(x) && !foraDeCombate(x) && x.personagem_id !== ui.meuPers.id) : [])
      .concat((pers || []).filter((p2) => p2.id !== ui.meuPers.id && !(camp.combate?.ordem || []).some((x) => x.personagem_id === p2.id))
        .map((p2) => ({ id: `p:${p2.id}`, nome: p2.nome, personagem_id: p2.id })));
    if (!cands.length) return alert("Não há ninguém para se opor — adicione alguém ao rastreador ou vincule outro personagem à mesa.");
    const r = await modalForm({ titulo: "⚖ Teste oposto",
      descricao: "Os dois rolam d20 + perícia. Empate favorece quem se defende.",
      campos: [
        { k: "minha", label: "Sua perícia", tipo: "select", valor: "Furtividade", opcoes: PERICIAS.map(([pn]) => pn) },
        { k: "alvo", label: "Contra quem", tipo: "select", opcoes: cands.map((c2) => ({ v: c2.id, l: c2.nome })) },
        { k: "dele", label: "Perícia do alvo", tipo: "select", valor: "Percepção", opcoes: PERICIAS.map(([pn]) => pn) },
      ], okLabel: "Rolar" });
    if (!r?.alvo) return;
    const alvo = cands.find((c2) => c2.id === r.alvo);
    const atMeu = PERICIAS.find(([x]) => x === r.minha)[1];
    const meuMod = k.attr[atMeu] + k.per[r.minha];
    // Bônus do alvo: personagem usa a ficha real; criatura usa a ordem da ameaça.
    let deleMod = 0;
    if (alvo.personagem_id) {
      const pj = (pers || []).find((p2) => p2.id === alvo.personagem_id);
      if (pj) { const kk = calc({ ...novaFichaDados(), ...pj.dados });
        const atDele = PERICIAS.find(([x]) => x === r.dele)[1];
        deleMod = (kk.attr[atDele] || 0) + (kk.per[r.dele] || 0); }
    } else deleMod = NIVEIS_AMEACA[alvo.ameaca]?.ordem ?? Math.max(0, (alvo.cd ?? 10) - 10);
    const condsMeu = (minhaLinhaCb()?.cond || []).map((c) => c.n.toLowerCase());
    const condsDele = (alvo.cond || []).map((c) => c.n.toLowerCase());
    const desvMeu = desvPorTeste(condsMeu, r.minha);
    const desvDele = desvPorTeste(condsDele, r.dele);
    const rolar2 = (desv) => desv ? Math.min(d(20), d(20)) : d(20);
    const n1 = rolar2(desvMeu), t1 = n1 + meuMod;
    const n2 = rolar2(desvDele), t2 = n2 + deleMod;
    const venci = t1 > t2;
    await enviar("rolagem", null, { titulo: `⚖ ${r.minha} × ${r.dele}`,
      detalhe: `${ui.meuPers.nome} d20 [${n1}]${desvMeu ? " (desv)" : ""} ${sign(meuMod)} = ${t1}  ·  ${alvo.nome} d20 [${n2}]${desvDele ? " (desv)" : ""} ${sign(deleMod)} = ${t2}`,
      total: t1, crit: n1 === 20, fumble: n1 === 1,
      extra: venci ? `${ui.meuPers.nome} vence a disputa.` : `${alvo.nome} resiste (empate favorece a defesa).` });
  };
  // Em chamas: apaga gastando Ação Principal + Reação, com deslocamento pela
  // metade neste turno (independente do resultado) — d20 puro, sem modificador.
  $("#cb-apagar-fogo")?.addEventListener("click", async () => {
    if (camp.combate?.ativo && !ui.souMestre && camp.combate.ordem[camp.combate.turno]?.personagem_id !== ui.meuPers.id)
      return alert(`Não é o seu turno (vez de ${camp.combate.ordem[camp.combate.turno]?.nome || "outro combatente"}).`);
    const travaFogo = minhaTrava(); if (travaFogo) return alert(`${ui.meuPers.nome} está ${travaFogo.n} e não pode agir neste turno.`);
    if (!(await gastarAcao("Ação Principal", "apagar o fogo"))) return render();
    if (!(await gastarAcao("Reação", "apagar o fogo"))) return render();
    const linha = minhaLinhaCb(); if (!linha) return render();
    linha._movMetade = camp.combate.rodada;   // limpo na virada de turno, em #cb-prox
    const nat = d(20);
    const apagou = nat >= 10;
    if (apagou) linha.cond = (linha.cond || []).filter((c2) => c2.n.toLowerCase() !== "em chamas");
    await salvarCombate();
    await enviar("rolagem", null, { titulo: `🔥 ${ui.meuPers.nome} tenta apagar o fogo`,
      detalhe: `d20 puro [${nat}]${nat < 10 ? " < 10" : " ≥ 10"}`, total: nat,
      extra: `${apagou ? "🧯 Apagou — Em chamas removido." : "O fogo continua."} Deslocamento pela metade neste turno.` });
    render();
  });
  // Caído: levanta na hora gastando Ação Principal + Ação de Movimento.
  $("#cb-levantar")?.addEventListener("click", async () => {
    if (camp.combate?.ativo && !ui.souMestre && camp.combate.ordem[camp.combate.turno]?.personagem_id !== ui.meuPers.id)
      return alert(`Não é o seu turno (vez de ${camp.combate.ordem[camp.combate.turno]?.nome || "outro combatente"}).`);
    const travaLev = minhaTrava(); if (travaLev) return alert(`${ui.meuPers.nome} está ${travaLev.n} e não pode agir neste turno.`);
    if (!(await gastarAcao("Ação Principal", "levantar"))) return render();
    if (!(await gastarAcao("Ação de Movimento", "levantar"))) return render();
    const linha = minhaLinhaCb(); if (!linha) return render();
    linha.cond = (linha.cond || []).filter((c2) => c2.n.toLowerCase() !== "caído");
    await salvarCombate();
    await enviar("sistema", `🧎 ${ui.meuPers.nome} se levanta.`);
    render();
  });
  document.querySelectorAll("[data-atq]").forEach((b) => b.onclick = async () => {
    const a = armasEq[+b.dataset.atq];
    // Em combate, o jogador só ataca no próprio turno. O Mestre rola por ele
    // pelo botão ⚔ da linha dele no rastreador.
    if (camp.combate?.ativo && !ui.souMestre) {
      const minhaLinha = camp.combate.ordem.find((x) => x.personagem_id === ui.meuPers.id);
      const ehMinhaVez = camp.combate.ordem[camp.combate.turno]?.personagem_id === ui.meuPers.id;
      if (minhaLinha && !ehMinhaVez)
        return alert(`Não é o seu turno (vez de ${camp.combate.ordem[camp.combate.turno]?.nome || "outro combatente"}). O Mestre pode rolar por você no rastreador.`);
    }
    const trava = minhaTrava();
    if (trava) return alert(`${ui.meuPers.nome} está ${trava.n} e não pode agir neste turno.`);
    if (!(await gastarAcao("Ação Principal", `atacar com ${a.nome}`))) return;
    const itemInv = (ui.meuPers.dados.inventario || []).find((x) => x.nome === a.nome && x.equip);
    const catBase = catDoAtaque(a.nome);
    const cat = armaMontada(catBase, itemInv);
    if (!cat) return alert(`Não encontrei "${a.nome}" no arsenal. Se a arma foi renomeada na administração, reequipe-a na ficha.`);
    const pr = propsArma(cat);
    // Alcance da arma: quem está longe demais nem entra na mira (e a munição
    // nem chega a ser gasta). O Mestre ainda pode mirar fora do alcance.
    const alcance = alcanceDaArma(cat, pr);
    const minhaLinhaAtq = minhaLinhaCb();
    const podeMirarAtq = !!(camp.combate?.ativo && (ui.souMestre || camp.combate.ordem[camp.combate.turno]?.personagem_id === ui.meuPers.id));
    const candidatos = podeMirarAtq
      ? camp.combate.ordem.filter((x) => !foraDeCombate(x) && x.personagem_id !== ui.meuPers.id && !x.nave_party)
          .map((x) => ({ x, dist: distCombate(minhaLinhaAtq, x) }))
      : [];
    const noAlcance = candidatos.filter((o) => o.dist == null || o.dist <= alcance + 0.01);
    if (podeMirarAtq && candidatos.length && !noAlcance.length && !ui.souMestre) {
      const perto = candidatos.slice().sort((p, q) => (p.dist ?? 999) - (q.dist ?? 999))[0];
      return alert(`${a.nome} alcança ${String(alcance).replace(".", ",")} m.\n\nO alvo mais próximo (${perto.x.nome}) está a ${perto.dist.toFixed(1).replace(".", ",")} m. Aproxime-se arrastando o seu token no campo tático.`);
    }
    let precisaRender = false;
    const custo = custoTiro(cat);
    // Descarregar: esvazia o pente carregado inteiro num tiro só, em troca de
    // dados extra de dano proporcionais às balas gastas além do custo normal.
    const descarregarMarcado = pr.descarrega && $("#atq-descarregar")?.checked;
    let dadosExtraDescarregar = 0;
    if (custo > 0) {
      const dd0 = ui.meuPers.dados || {};
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
        await enviar("sistema", `🔫 ${ui.meuPers.nome} puxa o gatilho e ouve o clique: ${falta}`);
        return render();
      }
      const gasto = descarregarMarcado ? noCano : custo;
      dadosExtraDescarregar = descarregarMarcado ? Math.max(0, noCano - custo) : 0;
      // O pente carregado pertence à ARMA: duas armas gastam munição em separado.
      if (itArma) {
        const inv = inv0.map((x, i2) => i2 === idxArma ? { ...x, tiros: noCano - gasto, tipoPente: est.tipo } : x);
        ui.meuPers.dados = { ...dd0, inventario: inv, __migrouArma: true };
        f.inventario = inv;
      } else {
        f.tirosPente = noCano - gasto;
        ui.meuPers.dados = { ...dd0, tirosPente: f.tirosPente };
      }
      await salvarFicha(ui.meuPers.id, ui.meuPers.dados);
      precisaRender = true;
    }
    // Mira: o jogador só enxerga quem está dentro do alcance da arma; o Mestre
    // vê todos, com aviso de quem está fora, para poder forçar.
    const listaMira = ui.souMestre ? candidatos : noAlcance;
    let alvoNave = null, alvoCombatente = null, distAlvo = null;
    // Palavra-chave de Área com raio declarado (Área/Rajada/Cone de Repulsão/
    // Artilharia/Atravessa Paredes/Sangramento em Área): em vez de mirar um só
    // combatente, escolhe um epicentro entre quem tem posição no campo tático —
    // todo mundo dentro do raio é atingido, igual ao `aplicarEmAlvos` de scripts/
    // granadas. `alvosArea` guarda todo mundo pego; o primeiro (de preferência
    // um inimigo) vira o alvo "principal" e segue o fluxo de baixo sem mudança —
    // os demais são resolvidos num laço próprio depois.
    let alvosArea = null;
    if (pr.area && pr.raio && camp.combate?.ativo) {
      const todosComPosAtq = camp.combate.ordem.filter((x) => !ehNave(x) && !foraDeCombate(x) && x.pos && x.id !== minhaLinhaAtq?.id);
      if (todosComPosAtq.length) {
        const inimigosPosAtq = todosComPosAtq.filter((x) => x.tipo === "inimigo" || x.lado === "inimiga");
        const rA = await modalForm({ titulo: `⚔ ${a.nome} — centro do impacto`,
          descricao: `Área de ${pr.raio} m de raio ao redor de quem você escolher — todo mundo dentro pega, aliado incluído.`,
          campos: [{ k: "epi", label: "Centro do impacto", tipo: "select",
            valor: (inimigosPosAtq[0] || todosComPosAtq[0]).id,
            opcoes: todosComPosAtq.map((x) => {
              const pegos = todosComPosAtq.filter((y) => (distCombate(x, y) ?? 99) <= pr.raio).length;
              return { v: x.id, l: `${x.nome} — pega ${pegos} combatente${pegos === 1 ? "" : "s"}` };
            }) }], okLabel: "Disparar" });
        if (rA?.epi) {
          const epi = todosComPosAtq.find((x) => x.id === rA.epi);
          alvosArea = todosComPosAtq.filter((x) => (distCombate(epi, x) ?? 99) <= pr.raio)
            .map((x) => ({ x, dist: distCombate(minhaLinhaAtq, x) }));
          const primeiro = alvosArea.find((o) => o.x.tipo === "inimigo" || o.x.lado === "inimiga") || alvosArea[0];
          if (primeiro) { distAlvo = primeiro.dist; if (ehNave(primeiro.x)) alvoNave = primeiro.x; else alvoCombatente = primeiro.x; }
        }
      }
    }
    if (!alvosArea && listaMira.length) {
      const bons = listaMira.filter((o) => (o.x.tipo === "inimigo" || o.x.lado === "inimiga") && (o.dist == null || o.dist <= alcance + 0.01));
      const alvoPadrao = (bons[0] || listaMira[0]).x.id;
      const r = await modalForm({ titulo: `⚔ ${a.nome}`,
        descricao: `Alcance da arma: ${String(alcance).replace(".", ",")} m.${ui.souMestre ? " Como Mestre, você pode mirar fora do alcance." : ""}`,
        campos: [{ k: "alvo", label: "Mirar em", tipo: "select", valor: alvoPadrao,
          opcoes: [
            ...listaMira.map(({ x, dist }) => ({ v: x.id, l: `${ehNave(x) ? "🚀 " : ""}${x.nome} — ${ehNave(x) ? `casco ${x.casco}/${x.casco_max}` : `${vidaAtual(x)}/${vidaMax(x)} PV, Def ${x.cd ?? 10}`}${dist != null ? ` · ${dist.toFixed(1).replace(".", ",")} m${dist > alcance + 0.01 ? " ⚠ fora de alcance" : ""}` : ""}` })),
            { v: "", l: "— sem alvo (o Mestre resolve) —" } ] }],
        okLabel: "Atacar" });
      if (r && r.alvo) { const esc2 = listaMira.find((o) => o.x.id === r.alvo);
        if (esc2) { distAlvo = esc2.dist; if (ehNave(esc2.x)) alvoNave = esc2.x; else alvoCombatente = esc2.x; } }
    }
    // Condições em jogo: as minhas atrapalham; as do alvo abrem brecha.
    const condsMinhasObjs = minhaLinhaCb()?.cond || [];
    const condsMinhas = condsMinhasObjs.map((c) => c.n.toLowerCase());
    const condsAlvo = (alvoCombatente?.cond || []).map((c) => c.n.toLowerCase());
    // Amedrontado: Desvantagem só contra a fonte do medo (se soubermos qual é —
    // condições antigas sem origem registrada continuam valendo pra qualquer alvo).
    const medoObj = condsMinhasObjs.find((c) => c.n.toLowerCase() === "amedrontado");
    const desvPorMedo = !!medoObj && (!medoObj.origemId || medoObj.origemId === alvoCombatente?.id);
    const desvPorCond = condsMinhas.some((n) => /cego|acovardado|envenenado/.test(n)) || desvPorMedo;   // Desvantagem no ataque
    const enfraquecido = condsMinhas.includes("enfraquecido");                              // metade do dano físico
    const alvoMarcado = condsAlvo.includes("marcado");                                      // +2 no acerto de quem o ataca
    const alvoAberto = condsAlvo.some((n) => /atordoado|paralisado|caído|cego|surpreso/.test(n));   // Vantagem contra ele
    // Furtividade real: o checkbox 🥷 só vale mecanicamente (bônus de acerto
    // e dano dobrado) se o alvo está de fato desprevenido — Surpreso, ou ainda
    // não teve turno neste combate (1ª rodada, a vez dele ainda não chegou).
    // Antes o checkbox valia sozinho, sem checagem nenhuma por trás — qualquer
    // um marcava e levava o bônus mesmo com o alvo alerta e reagindo havia turnos.
    // Sem alvo do rastreador (fora de combate / Mestre narrando à parte) mantém
    // como sempre foi: a palavra do jogador vale, o Mestre adjudica.
    const furtivoMarcado = $("#atq-furtivo")?.checked;
    const idxAlvoCb = alvoCombatente ? (camp.combate?.ordem || []).findIndex((x) => x.id === alvoCombatente.id) : -1;
    const alvoAindaNaoAgiu = !!alvoCombatente && camp.combate?.rodada === 1 && idxAlvoCb > (camp.combate?.turno ?? -1);
    const alvoRealmenteDesprevenido = !alvoCombatente || condsAlvo.includes("surpreso") || alvoAindaNaoAgiu;
    const furtivo = !!(furtivoMarcado && alvoRealmenteDesprevenido);
    const furtivoNegado = furtivoMarcado && !furtivo;
    const assassino = f.classe === "Assassino";
    // Ágil: usa o melhor de For/Des no acerto e no dano
    const atkAttr = pr.agil ? (k.attr.Des >= k.attr.For ? "Des" : "For") : cat.attr;
    // O alvo já mirado (combatente OU nave) entra em `modificarAtaque` — sem
    // isso, `combina("robos")` nunca tinha quem checar e "Anti-Sintético"/
    // "Ferramenta" (+2 dano contra robôs/sintéticos) nunca aplicavam nada,
    // silenciosamente, em ataque nenhum. Era bug real, não só duplicata de nome.
    const alvoParaEfeitos = alvoCombatente || alvoNave || null;
    // Pesada: −2 no acerto de verdade — a passiva "Memória Muscular" do
    // Soldado (imunidade a "penalidade de -2 com armas Pesadas") já prometia
    // anular isso, mas nada aplicava a penalidade até agora.
    const penalidadePesada = pr.pesada && !(k.efeitos?.imunidades() || []).some((im) => /pesada/i.test(im || "")) ? -2 : 0;
    const mod = k.attr[atkAttr] + k.per[cat.per]
      + (cat.tipo === "fogo" && f.implantes.includes("Olho Biônico de Precisão") ? 2 : 0)
      + (furtivo && pr.oculta ? 2 : 0)          // Oculta: +2 no furtivo
      + (alvoMarcado ? 2 : 0)                   // alvo Marcado
      + penalidadePesada
      + (k.efeitos ? k.efeitos.modificarAtaque({ acerto: 0, dano: 0, arma: cat, alvo: alvoParaEfeitos, situacao: { desprevenido: !!furtivo, em_nave: !!camp.combate?.naveEmCena } }).acerto : 0)
      + (cat._efeitos || []).filter((e) => e.momento === "ao_atacar" && e.tipo === "acerto").reduce((x, e) => x + (e.valor || 0), 0);
    // Vantagem/desvantagem líquida: soma as fontes e reduz a −1 / 0 / +1.
    const vantEfeito = !!(k.efeitos && k.efeitos.modificarAtaque({ acerto: 0, dano: 0, arma: cat, alvo: alvoParaEfeitos, situacao: { desprevenido: !!furtivo, em_nave: !!camp.combate?.naveEmCena } }).vantagem);
    const vantSoma = (ui.vantagem || 0) + (vantEfeito ? 1 : 0) + (alvoAberto ? 1 : 0) - (desvPorCond ? 1 : 0);
    const vantAtaque = vantSoma > 0 ? 1 : vantSoma < 0 ? -1 : 0;
    const marcasVant = [vantEfeito ? "efeito" : "", alvoAberto ? "alvo exposto" : "", desvPorCond ? "condição" : ""].filter(Boolean).join(", ");
    let nat, detVant = "";
    if (vantAtaque !== 0) { const r1 = d(20), r2 = d(20); nat = vantAtaque > 0 ? Math.max(r1, r2) : Math.min(r1, r2); detVant = ` [${vantAtaque > 0 ? "vant" : "desv"}${marcasVant ? ` (${marcasVant})` : ""} ${r1}/${r2}]`; } else nat = d(20);
    const total = nat + mod;
    const danoBase = danoArma(cat, f.nivel);
    const pd = parseDice(danoBase);
    // dobra o dano por Crítico (20) e/ou Ataque Furtivo do Assassino (cada um adiciona um conjunto de dados)
    const situacaoPre = { desprevenido: !!furtivo, em_nave: !!camp.combate?.naveEmCena };
    const modAtqPre = k.efeitos ? k.efeitos.modificarAtaque({ acerto: 0, dano: 0, arma: cat, alvo: alvoParaEfeitos, situacao: situacaoPre }) : { acerto: 0, dano: 0, multDano: 1 };
    // Rola o dano UMA vez; crítico e multiplicadores de classe multiplicam o
    // total depois (dados + bônus), conforme a regra da mesa.
    let dados = rollNd(pd.n, pd.f);
    if (pr.brutal) { const d2 = rollNd(pd.n, pd.f); if (d2.reduce((x, y) => x + y, 0) > dados.reduce((x, y) => x + y, 0)) dados = d2; } // Brutal: vantagem no dano
    // Confiável: nenhum dado rola abaixo da metade da face (arredondado pra
    // cima) — "dano mínimo garantido" deixou de ser só texto.
    if (pr.confiavel) dados = dados.map((v) => Math.max(v, Math.ceil(pd.f / 2)));
    // Descarregar: esvaziou o pente inteiro (ver bloco de munição acima) —
    // some um dado extra de dano por bala gasta além do custo normal do tiro.
    if (dadosExtraDescarregar > 0) dados = [...dados, ...rollNd(dadosExtraDescarregar, pd.f)];
    // Situação do ataque: o que o motor precisa saber para efeitos condicionais.
    const situacao = situacaoPre, modAtq = modAtqPre;
    const modsAtq = (cat._efeitos || []).filter((e) => e.momento === "ao_atacar");
    const modKw = [...(pr.efeitos || []), ...modsAtq].filter((e) => e.momento === "ao_atacar" && e.tipo === "dano" && !e.contra)
      .reduce((x, e) => x + (e.valor || 0), 0);
    const modAcertoPecas = modsAtq.filter((e) => e.tipo === "acerto").reduce((x, e) => x + (e.valor || 0), 0);
    const danoMod = k.attr[atkAttr] + modKw + modAtq.dano + (cat.tipo === "branca" && f.implantes.includes("Braço Mecânico Hidráulico") ? 2 : 0);
    // Paralisado (regra da mesa): qualquer ataque a até 2m dele que acerte é
    // Crítico automático — não só Vantagem. `alvoAberto` já cobre a Vantagem;
    // isto soma o multiplicador que faltava quando o alvo está perto o bastante.
    const paralisadoPerto = condsAlvo.includes("paralisado") && distAlvo != null && distAlvo <= 2.01;
    // Armadura anticrítica: se o alvo é um personagem com ela equipada, o golpe
    // nunca multiplica por crítico — nem o natural 20, nem o automático do
    // Paralisado. Só zera ESSA parte; outros multiplicadores (furtivo do
    // Assassino) continuam valendo, porque não são especificamente "crítico".
    const semCriticoAlvo = alvoCombatente?.personagem_id
      ? !!calc({ ...novaFichaDados(), ...(pers.find((p2) => p2.id === alvoCombatente.personagem_id)?.dados || {}) }).efeitos?.aoSofrer?.().semCritico
      : false;
    const critAuto = !semCriticoAlvo && (nat === 20 || (paralisadoPerto && nat !== 1));   // 1 natural ainda falha, mesmo contra alvo Paralisado
    // Multiplicador final: ×2 no crítico, ×2 no furtivo do Assassino — e o
    // Assassino veterano acumula os dois, chegando a ×4.
    const multCrit = (critAuto ? 2 : 1) * (modAtq.multDano || 1);
    const somaDados = dados.reduce((x, y) => x + y, 0);
    const danoFinal = Math.floor(danoCritico(somaDados, danoMod, multCrit) * (enfraquecido ? 0.5 : 1));   // Enfraquecido: metade
    const seriaCritico = nat === 20 || (paralisadoPerto && nat !== 1);   // pra mostrar que a armadura bloqueou, não só omitir
    const marcadores = [critAuto && nat === 20 ? "CRÍTICO ×2" : critAuto ? "CRÍTICO automático (alvo Paralisado ≤2m) ×2" : (semCriticoAlvo && seriaCritico) ? "🛡 armadura anticrítica bloqueia o crítico" : "", furtivo && assassino ? "FURTIVO ×2" : furtivo ? "furtivo +2 acerto" : furtivoNegado ? "🥷 furtivo NÃO vale — alvo não está desprevenido" : "", pr.agil ? `Ágil (${atkAttr})` : "", pr.brutal ? "Brutal (vantagem)" : "", enfraquecido ? "Enfraquecido ½" : "", alvoMarcado ? "alvo Marcado +2" : "", penalidadePesada ? "Pesada −2" : (pr.pesada ? "Pesada (Memória Muscular anula)" : ""), pr.confiavel ? "Confiável (mín. garantido)" : "", dadosExtraDescarregar > 0 ? `Descarregou +${dadosExtraDescarregar}d${pd.f}` : ""].filter(Boolean).join(" · ");
    // Palavras-chave declaradas: condições ao acertar e perfuração de armadura.
    let efeitoKw = "";
    if (nat !== 1 && total >= 0) {
      const partes = [];
      for (const ac of (pr.aoAcertar || []))
        partes.push(`🏷 ${ac.origem}: alvo fica ${ac.cond} por ${ac.turnos} turno(s)${ac.cd ? ` (CD ${ac.cd} evita)` : ""}`);
      if (pr.ignoraArmadura) partes.push(`🗡 ignora ${pr.ignoraArmadura} de armadura`);
      efeitoKw = partes.join(" · ");
    }
    // Munição especial: condição e tipo de dano que a munição carrega.
    let efeitoMun = "", munCond = null, munTipo = null;
    if (custo > 0 && nat !== 1) { const itA = (ui.meuPers.dados.inventario || []).find((x) => x.nome === a.nome && x.equip);
      const tpm = TIPOS_PENTE[(itA && itA.tipoPente) || f.tipoPente || PENTE_PADRAO];
      if (tpm?.tipoDano) munTipo = tpm.tipoDano;
      if (tpm && tpm.cond) { efeitoMun = `${tpm.ic} ${tpm.n}: alvo fica ${tpm.cond} por ${tpm.turnos} turno(s)${tpm.cd ? ` (Constituição CD ${tpm.cd} evita)` : ""}`;
        munCond = { cond: tpm.cond, turnos: tpm.turnos, cd: tpm.cd, origem: tpm.n }; }
      else if (tpm && tpm.bonusSint) efeitoMun = `${tpm.ic} ${tpm.n}: +${tpm.bonusSint} contra sintéticos e implantes do alvo inertes por 1 turno`;
    }
    // Área/Alcance da arma, se houver — as demais palavras-chave já aparecem
    // nos marcadores (Brutal, Ágil…) e em "ignora N de armadura" acima; repeti-las
    // aqui de novo só duplicava o texto sem acrescentar nada.
    const infoArma = [pr.area ? `◎ Área: ${pr.areaTxt}` : "", pr.alcance ? `⟿ Alcance: ${pr.alcanceTxt}` : ""].filter(Boolean).join("  ·  ");
    enviar("rolagem", null, { titulo: (ui.privada ? "🔒 " : "") + `Ataque — ${a.nome}${furtivo ? " 🥷" : ""}`,
      detalhe: `d20 [${nat}]${detVant} ${sign(mod)} · dano ${danoBase} [${dados.join(", ")}] ${sign(danoMod)}${multCrit > 1 ? ` ×${multCrit}` : ""}${marcadores ? " · " + marcadores : ""}`,
      total: nat + mod, crit: critAuto, fumble: nat === 1, ...(ui.privada ? { privada: true } : {}), dano_total: danoFinal,
      tipoDano: munTipo || tipoDanoArma(cat),
      ...(pr.ignoraArmadura ? { ignoraArmadura: pr.ignoraArmadura } : {}),
      ...(alvoNave || alvoCombatente ? { alvo_resolvido: true } : {}),
      extra: `Dano: ${danoFinal}${multCrit > 1 ? ` (${somaDados} + ${danoMod} × ${multCrit})` : ""}${efeitoKw ? "  —  " + efeitoKw : ""}${efeitoMun ? "  —  " + efeitoMun : ""}${infoArma ? "  —  " + infoArma : ""}` });
    // Sobreaquecimento: num natural 1, a arma superaquece e queima a mão de
    // quem atira — "pode superaquecer se disparada em excesso" virou de fato
    // uma consequência jogável, em vez de só texto sem efeito nenhum.
    if (pr.sobreaquece && nat === 1) {
      const dq = d(4);
      const ddQ = { ...novaFichaDados(), ...ui.meuPers.dados };
      const antesQ = ddQ.pvAtual || 0;
      ddQ.pvAtual = Math.max(0, antesQ - dq);
      ui.meuPers.dados = ddQ; f.pvAtual = ddQ.pvAtual;
      await salvarFicha(ui.meuPers.id, ddQ, "salvar o superaquecimento");
      await enviar("sistema", `🔥 ${a.nome} superaquece na mão de ${ui.meuPers.nome}: ${dq} de dano térmico (${ddQ.pvAtual}/${k.pvMax}).`);
    }
    // Resistência do alvo num atributo (personagem usa o valor real; inimigo, a ordem da ameaça).
    const resistDe = (alvo, attr) => alvo.personagem_id
      ? (calc({ ...novaFichaDados(), ...((pers || []).find((p2) => p2.id === alvo.personagem_id)?.dados || {}) }).attr[attr] || 0)
      : (NIVEIS_AMEACA[alvo.ameaca]?.ordem ?? Math.max(0, (alvo.cd ?? 10) - 10));
    // Aplica condições declaradas (palavra-chave + munição) no alvo acertado, com teste quando há CD.
    const aplicarCondsNoAlvo = (alvo) => {
      const linhas = [];
      const kAlvoRes = alvo.personagem_id
        ? calc({ ...novaFichaDados(), ...((pers || []).find((p2) => p2.id === alvo.personagem_id)?.dados || {}) })
        : null;
      for (const ac of [...(pr.aoAcertar || []), ...(munCond ? [munCond] : [])]) {
        if (!ac.cond) continue;
        let resistiu = false, det = "";
        if (ac.cd) { const b = resistDe(alvo, "Con");
          const temRes = temResistencia(kAlvoRes, ac.cond) || temResistencia(kAlvoRes, munTipo);
          const n2 = temRes ? Math.max(d(20), d(20)) : d(20); const t2 = n2 + b;
          resistiu = t2 >= ac.cd; det = ` [Con ${n2}${sign(b)}=${t2}${temRes ? " (resist.)" : ""} vs CD ${ac.cd}]`; }
        if (!resistiu) aplicarCond(alvo, ac.cond, ac.turnos || 1, minhaLinhaCb()?.id || null);
        linhas.push(`${resistiu ? "🛡" : "🏷"} ${ac.origem || ac.cond}: ${resistiu ? "resistiu" : `${ac.cond} ${ac.turnos || 1}t`}${det}`);
      }
      return linhas;
    };
    if (alvoNave) {                    // resolve o tiro contra o casco
      const def = 10 + (alvoNave.manobra || 0);
      const acertou = total >= def && nat !== 1;
      if (acertou) {
        snapshot("tiro em nave");
        const rd = await aplicarDanoAlvo(alvoNave, danoFinal);
        if (rd.nave?.critico) { const av = rolarAvaria(); (camp.combate.avarias = camp.combate.avarias || []).push(av);
          await enviar("sistema", `⚠ ${alvoNave.nome}: ${av.n} — ${av.e}`); }
        await salvarCombate();
        await enviar("sistema", `🚀 ${ui.meuPers.nome} acerta ${alvoNave.nome} (Def ${def}): ${rd.msg}.${alvoNave.casco <= 0 ? " 💥 ABATIDA!" : ""}`);
      } else await enviar("sistema", `🚀 ${ui.meuPers.nome} erra ${alvoNave.nome} (Defesa ${def}).`);
      render();
    }
    if (alvoCombatente) {             // resolve o tiro contra um combatente do rastreador
      // Cobertura só atrapalha tiro; quem está no corpo-a-corpo contorna o muro.
      // Atravessa Paredes (pr.ignoraCobertura) ignora a cobertura de qualquer alcance.
      const cob = (cat.tipo === "branca" || pr.ignoraCobertura) ? 0 : [0, 2, 5][alvoCombatente.cobertura || 0];
      const defBase = alvoCombatente.cd ?? 10;
      const def = Math.max(0, defBase + cob - (pr.ignoraArmadura || 0));
      // Def mostrada por extenso (base → cobertura/perfuração → efetiva) — antes
      // aparecia só "Def 13 · 🗡−2", que lia como se ainda faltasse subtrair algo.
      const defTxt = (cob || pr.ignoraArmadura)
        ? `Def ${defBase}${cob ? ` +${cob}🧱` : ""}${pr.ignoraArmadura ? ` −${pr.ignoraArmadura}🗡` : ""} = ${def}`
        : `Def ${def}`;
      const fora = distAlvo != null && distAlvo > alcance + 0.01;
      const txtDist = distAlvo != null ? ` · ${distAlvo.toFixed(1).replace(".", ",")} m${fora ? ` ⚠ fora do alcance de ${String(alcance).replace(".", ",")} m` : ""}` : "";
      const acertou = !fora && (nat === 20 || (nat !== 1 && total >= def));
      if (fora) {
        await enviar("sistema", `⚠ ${ui.meuPers.nome} não alcança ${alvoCombatente.nome} com ${a.nome}${txtDist}. O golpe passa longe.`);
      } else if (acertou) {
        snapshot("tiro em combate");
        const rd = await aplicarDanoAlvo(alvoCombatente, danoFinal, munTipo || tipoDanoArma(cat));
        const conds = (rd.absorvido || rd.imune) ? [] : aplicarCondsNoAlvo(alvoCombatente);
        // Cone de Repulsão: empurra quem foi atingido para longe de quem atirou.
        if (pr.empurrao && !foraDeCombate(alvoCombatente)) { const novaPos = empurrarDe(minhaLinhaAtq, alvoCombatente, pr.empurrao); if (novaPos) alvoCombatente.pos = novaPos; }
        await salvarCombate();
        await enviar("sistema", `🎯 ${ui.meuPers.nome} acerta ${alvoCombatente.nome} com ${a.nome} (${defTxt}${txtDist}): ${rd.msg}.${foraDeCombate(alvoCombatente) ? " 💀 CAIU!" : ""}${conds.length ? `  —  ${conds.join(" · ")}` : ""}${pr.empurrao ? " ↗ empurrado" : ""}`);
      } else {
        await enviar("sistema", `❌ ${ui.meuPers.nome} erra ${alvoCombatente.nome} com ${a.nome} (${defTxt}${txtDist}).`);
      }
      render();
    }
    // Palavra-chave de Área com raio: quem mais o estouro pegou (além do alvo
    // principal já resolvido acima) sofre o MESMO dano já rolado — é a mesma
    // rajada/explosão — com uma checagem de acerto própria (mesmo bônus, d20
    // fresco) contra a Defesa de cada um, igual ao padrão que os scripts de área
    // do Mestre (`aplicarEmAlvos`) já usam: um dano só, um acerto por alvo.
    if (alvosArea && alvosArea.length > 1) {
      const jaResolvidoId = (alvoCombatente || alvoNave)?.id;
      const resto = alvosArea.filter((o) => o.x.id !== jaResolvidoId);
      if (resto.length) {
        const linhasArea = [];
        for (const { x: alvoX } of resto) {
          if (ehNave(alvoX)) {
            const defN = 10 + (alvoX.manobra || 0);
            const totN = d(20) + mod;
            if (totN >= defN) { const rd = await aplicarDanoAlvo(alvoX, danoFinal); linhasArea.push(`🚀 ${alvoX.nome}: ${rd.msg}`); }
            else linhasArea.push(`🚀 ${alvoX.nome}: errou (Def ${defN})`);
            continue;
          }
          const cobX = (cat.tipo === "branca" || pr.ignoraCobertura) ? 0 : [0, 2, 5][alvoX.cobertura || 0];
          const defX = Math.max(0, (alvoX.cd ?? 10) + cobX - (pr.ignoraArmadura || 0));
          const totX = d(20) + mod;
          if (totX >= defX) {
            const rd = await aplicarDanoAlvo(alvoX, danoFinal, munTipo || tipoDanoArma(cat));
            const condsX = (rd.absorvido || rd.imune) ? [] : aplicarCondsNoAlvo(alvoX);
            if (pr.empurrao && !foraDeCombate(alvoX)) { const novaPosX = empurrarDe(minhaLinhaAtq, alvoX, pr.empurrao); if (novaPosX) alvoX.pos = novaPosX; }
            linhasArea.push(`${alvoX.nome}: ${rd.msg}${foraDeCombate(alvoX) ? " 💀 CAIU" : ""}${condsX.length ? ` — ${condsX.join(" · ")}` : ""}`);
          } else linhasArea.push(`${alvoX.nome}: errou (Def ${defX})`);
        }
        await salvarCombate();
        await enviar("sistema", `💥 ${a.nome} também pega: ${linhasArea.join("  ·  ")}`);
        render();
      }
    }
    if (precisaRender) render();      // atualiza o contador de munição na tela
  });
  // Trocar direto pelo pente clicado na reserva — mais rápido que abrir o menu.
  const carregarPente = async (tipoNovo) => {
    const dd1 = ui.meuPers.dados || {};
    const res = normalizaPentes(dd1);
    if (!(res[tipoNovo] > 0)) return;
    const noCano = dd1.tirosPente ?? TIROS_POR_PENTE;
    const tipoAtual = dd1.tipoPente || PENTE_PADRAO;
    // O pente que sai volta para a reserva se ainda tiver tiros.
    if (noCano > 0 && tipoAtual !== tipoNovo) res[tipoAtual] = (res[tipoAtual] || 0) + 1;
    res[tipoNovo] -= 1;
    f.pentes = res; f.tirosPente = TIROS_POR_PENTE; f.tipoPente = tipoNovo;
    ui.meuPers.dados = { ...dd1, pentes: res, tirosPente: TIROS_POR_PENTE, tipoPente: tipoNovo };
    await salvarFicha(ui.meuPers.id, ui.meuPers.dados);
    const t3 = TIPOS_PENTE[tipoNovo];
    await enviar("sistema", `🔫 ${ui.meuPers.nome} carrega ${t3.ic} ${t3.n} (Ação de Movimento).`);
    render();
  };
  document.querySelectorAll("[data-carregar]").forEach((b2) => b2.onclick = () => carregarPente(b2.dataset.carregar));
  // Trocar o pente de uma arma específica.
  const trocarPenteDe = async (nomeArma, tipoNovo) => {
    const dd1 = ui.meuPers.dados || {};
    const inv = dd1.inventario || [];
    const ix = inv.findIndex((x) => x.nome === nomeArma && x.equip);
    if (ix < 0) return;
    if (!(await gastarAcao("Ação de Movimento", `recarregar ${nomeArma}`))) return;
    const res = normalizaPentes(dd1);
    const disp = Object.entries(res).filter(([, q]) => q > 0);
    if (!disp.length) { await enviar("sistema", `🔫 ${ui.meuPers.nome} procura um pente e não acha nenhum.`); return render(); }
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
    ui.meuPers.dados = { ...dd1, inventario: novoInv, pentes: res, __migrouArma: true };
    f.inventario = novoInv; f.pentes = res;
    await salvarFicha(ui.meuPers.id, ui.meuPers.dados);
    const t3 = TIPOS_PENTE[escolha];
    await enviar("sistema", `🔫 ${ui.meuPers.nome} carrega ${t3.ic} ${t3.n} em ${nomeArma} (Ação de Movimento).`);
    render();
  };
  document.querySelectorAll("[data-trocar]").forEach((b2) => b2.onclick = () => trocarPenteDe(b2.dataset.trocar, null));
  document.querySelectorAll("[data-carregar]").forEach((b2) => b2.onclick = async () => {
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
    const dd1 = ui.meuPers.dados || {};
    const res = normalizaPentes(dd1);
    const disp = Object.entries(res).filter(([, q]) => q > 0);
    if (!disp.length) { await enviar("sistema", `🔫 ${ui.meuPers.nome} procura um pente e não acha nenhum. Sem munição na reserva.`); return render(); }
    let escolha = disp[0][0];
    if (disp.length > 1) {
      const r = await modalForm({ titulo: "↻ Trocar pente", descricao: "Escolha a munição. A troca custa a Ação de Movimento.",
        campos: [{ k: "t", label: "Pente", tipo: "select", opcoes: disp.map(([k2, q]) => { const t2 = TIPOS_PENTE[k2];
          return { v: k2, l: `${t2.ic} ${t2.n} ×${q} — ${t2.d}` }; }) }], okLabel: "Carregar" });
      if (!r?.t) return; escolha = r.t;
    }
    res[escolha] -= 1;
    f.pentes = res; f.tirosPente = TIROS_POR_PENTE; f.tipoPente = escolha;
    ui.meuPers.dados = { ...dd1, pentes: res, tirosPente: f.tirosPente, tipoPente: escolha };
    await salvarFicha(ui.meuPers.id, ui.meuPers.dados);
    const t3 = TIPOS_PENTE[escolha];
    await enviar("sistema", `🔫 ${ui.meuPers.nome} carrega um pente ${t3.ic} ${t3.n} (Ação de Movimento).`); render();
  });
  document.querySelectorAll("[data-hab-usar]").forEach((bt) => bt.onclick = async () => {
    const ats = habilidadesAtivas(f);
    const h = ats.find((x) => x.id === bt.dataset.habUsar); if (!h) return;
    if (h.descanso && f.usos?.[h.id]) return;
    const trvH = minhaTrava(["silenciado"]);
    if (trvH) return alert(`${ui.meuPers.nome} está ${trvH.n} e não pode usar ${h.nome} neste turno.`);
    const hRaw = (() => {   // a declaração completa, com resolve/duracao
      const raca = RACAS.find((r) => r.nome === f.raca), cl = CLASSES[f.classe];
      return [...(raca?.habilidades || []), ...(cl?.hab || []), cl?.vet, raca?.lendaria]
        .filter(Boolean).find((x) => x.n === h.nome);
    })();
    const turnos = duracaoDe(hRaw, f.nivel);
    const R = hRaw?.resolve;
    if (!(await gastarAcao(hRaw?.acao, `usar ${h.nome}`))) return;

    // ---- habilidades que resolvem sozinhas ----
    if (R?.tipo === "tabela") {           // Êxtase da Batalha: 1d6 decide o efeito
      const pd = parseDice(R.dado); const v = rollNd(pd.n, pd.f).reduce((x, y) => x + y, 0);
      const op = R.opcoes.find((o) => v >= o.de && v <= o.ate);
      const modos = { ...(ui.meuPers.dados.modos || {}), [h.nome]: op.n };
      const exp = { ...(ui.meuPers.dados.modosAte || {}), [h.nome]: turnos };
      ui.meuPers.dados = { ...ui.meuPers.dados, modos, modosAte: exp }; f.modos = modos;
      await salvarFicha(ui.meuPers.id, ui.meuPers.dados);
      if (sincronizarCdCombate(ui.meuPers.id, ui.meuPers.dados)) await salvarCombate();
      await enviar("rolagem", null, { titulo: `★ ${h.nome}`, detalhe: `${R.dado} [${v}]`,
        extra: `${op.n} — dura ${turnos} turno(s).` });
      return render();
    }
    if (R?.tipo === "cura") {             // Cura Genética: dado + atributo, com crítico e falha
      const alvos = (pers || []).map((p2) => ({ v: p2.id, l: p2.id === ui.meuPers.id ? `${p2.nome} (você)` : p2.nome }));
      const r2 = await modalForm({ titulo: `★ ${h.nome}`, descricao: h.d,
        campos: [{ k: "alvo", label: "Curar quem?", tipo: "select", opcoes: alvos }], okLabel: "Curar" });
      if (!r2?.alvo) return;
      const alvo = (pers || []).find((p2) => p2.id === r2.alvo);
      const pd = parseDice(R.dado); const dd2 = rollNd(pd.n, pd.f); const bruto = dd2[0];
      let val = bruto + (R.attr ? k.attr[R.attr] : 0); let nota = "";
      if (R.critico && bruto === R.critico.no) { val *= 2; nota = " — MÁXIMO! cura dobrada"; }
      if (R.falha && bruto === R.falha.no) {
        const dd3 = { ...novaFichaDados(), ...ui.meuPers.dados };
        dd3.pvAtual = Math.max(0, (dd3.pvAtual || 0) - R.falha.danoProprio);
        ui.meuPers.dados = dd3;
        await salvarFicha(ui.meuPers.id, dd3);
        nota = ` — rejeição! ${ui.meuPers.nome} sofre ${R.falha.danoProprio} de dano`;
      }
      await enviar("cura", null, { alvo_id: alvo.id, alvo_nome: alvo.nome, valor: Math.max(0, val),
        origem: `★ ${h.nome} de ${ui.meuPers.nome}`, detalhe: `${R.dado} [${bruto}]${R.attr ? ` + ${R.attr}` : ""}${nota}`, aplicado: false });
      if (h.descanso) { const usos = { ...(ui.meuPers.dados.usos || {}), [h.id]: true };
        ui.meuPers.dados = { ...ui.meuPers.dados, usos }; await salvarFicha(ui.meuPers.id, ui.meuPers.dados); }
      return render();
    }
    if (R?.tipo === "transferir_pv") {    // Emprestar Vitalidade
      const max = Math.floor((f.pvAtual || 0) * (R.maxFracao || 0.5));
      if (max < 1) return alert("Você não tem vida suficiente para transferir.");
      const r2 = await modalForm({ titulo: `★ ${h.nome}`, descricao: `${h.d}\n\nVocê pode transferir até ${max} PV.`,
        campos: [
          { k: "alvo", label: "Para quem?", tipo: "select", opcoes: (pers || []).filter((p2) => p2.id !== ui.meuPers.id).map((p2) => ({ v: p2.id, l: p2.nome })) },
          { k: "qtd", label: "Quantos PV", tipo: "numero", valor: Math.min(max, 5), min: 1, max },
        ], okLabel: "Transferir" });
      if (!r2?.alvo) return;
      const qtd = Math.max(1, Math.min(max, +r2.qtd || 1));
      const alvo = (pers || []).find((p2) => p2.id === r2.alvo);
      const dd3 = { ...novaFichaDados(), ...ui.meuPers.dados };
      dd3.pvAtual = Math.max(0, (dd3.pvAtual || 0) - qtd);
      ui.meuPers.dados = dd3; f.pvAtual = dd3.pvAtual;
      await salvarFicha(ui.meuPers.id, dd3);
      await enviar("cura", null, { alvo_id: alvo.id, alvo_nome: alvo.nome, valor: qtd,
        origem: `★ ${h.nome} de ${ui.meuPers.nome}`, detalhe: `transferiu ${qtd} PV do próprio corpo`, aplicado: false });
      return render();
    }
    if (R?.tipo === "disputa") {          // Invasão da Sombra: disputa de rolagem contra o alvo
      const meuBonus = k.attr[R.atributo] || 0;
      // Precisa de um alvo no rastreador — sem isso, não rola.
      const cands = (camp.combate?.ativo ? camp.combate.ordem : []).filter((c2) => !ehNave(c2) && !foraDeCombate(c2) && c2.personagem_id !== ui.meuPers.id);
      if (!cands.length) return alert(`${h.nome} precisa de um alvo. Adicione o inimigo ao rastreador de combate primeiro.`);
      const r2 = await modalForm({ titulo: `★ ${h.nome}`, descricao: h.d,
        campos: [{ k: "alvo", label: "Invadir a mente de quem?", tipo: "select",
          opcoes: cands.map((c2) => ({ v: c2.id, l: `${c2.nome} — ${vidaAtual(c2)}/${vidaMax(c2)} PV` })) }], okLabel: "Invadir" });
      if (!r2 || !r2.alvo) return;   // fechou sem escolher = não rola
      const alvo = cands.find((c2) => c2.id === r2.alvo);
      if (!alvo) return;
      // Bônus do alvo no atributo disputado: personagem usa o valor real; inimigo
      // usa a ordem da ameaça (Lacaio 0 … Colossal 6), ou a Defesa − 10 se não houver.
      const alvoNome = alvo.nome;
      const alvoBonus = alvo.personagem_id
        ? (calc({ ...novaFichaDados(), ...((pers || []).find((p2) => p2.id === alvo.personagem_id)?.dados || {}) }).attr[R.atributo] || 0)
        : (NIVEIS_AMEACA[alvo.ameaca]?.ordem ?? Math.max(0, (alvo.cd ?? 10) - 10));
      const nat = d(20), meu = nat + meuBonus;
      const natA = d(20), contra = natA + alvoBonus;
      const venceu = meu > contra;   // empate: o alvo resiste
      let extra;
      if (venceu) {
        extra = `Venceu a disputa (${meu} × ${contra}) — ${R.vitoria}.`;
        aplicarCond(alvo, "Dominado", 1);
        await salvarCombate();
      } else {
        extra = `Perdeu a disputa (${meu} × ${contra}) — ${ui.meuPers.nome} sofre ${R.derrota.danoProprio} de dano.`;
        const dd3 = { ...novaFichaDados(), ...ui.meuPers.dados };
        dd3.pvAtual = Math.max(0, (dd3.pvAtual || 0) - R.derrota.danoProprio);
        ui.meuPers.dados = dd3; await salvarFicha(ui.meuPers.id, dd3);
      }
      await enviar("rolagem", null, { titulo: `★ ${h.nome}`,
        detalhe: `${ui.meuPers.nome} d20 [${nat}] ${sign(meuBonus)} = ${meu}  ·  ${alvoNome} d20 [${natA}] ${sign(alvoBonus)} = ${contra}`,
        total: meu, crit: nat === 20, fumble: nat === 1, extra });
      if (h.descanso) { const usos = { ...(ui.meuPers.dados.usos || {}), [h.id]: true };
        ui.meuPers.dados = { ...ui.meuPers.dados, usos }; f.usos = usos;
        await salvarFicha(ui.meuPers.id, ui.meuPers.dados); }
      return render();
    }
    if (R?.tipo === "pvtemp") {           // Reparo Tático: PV Temporário num aliado
      const val = (() => { const pd = parseDice(R.dado); const ds = rollNd(pd.n, pd.f);
        const bo = R.pericia ? (k.per[R.pericia] || 0) : (R.attr ? (k.attr[R.attr] || 0) : 0);
        return { total: ds.reduce((x, y) => x + y, 0) + pd.mod + bo, ds, bo }; })();
      let alvoP = ui.meuPers;
      if (!R.proprio) {
        const r2 = await modalForm({ titulo: `★ ${h.nome}`, descricao: h.d,
          campos: [{ k: "alvo", label: "Em quem?", tipo: "select",
            opcoes: (pers || []).map((p2) => ({ v: p2.id, l: p2.id === ui.meuPers.id ? `${p2.nome} (você)` : p2.nome })) }], okLabel: "Reforçar" });
        if (!r2?.alvo) return;
        alvoP = (pers || []).find((p2) => p2.id === r2.alvo) || ui.meuPers;
      }
      const dd3 = { ...novaFichaDados(), ...alvoP.dados };
      dd3.pvTemp = Math.max(dd3.pvTemp || 0, val.total);   // PV Temporário não soma: fica o maior
      await salvarFicha(alvoP.id, dd3);
      alvoP.dados = dd3; if (ui.meuPers.id === alvoP.id) ui.meuPers.dados = dd3;
      await enviar("rolagem", null, { titulo: `★ ${h.nome}`,
        detalhe: `${R.dado} [${val.ds.join(", ")}]${val.bo ? ` +${val.bo} ${R.pericia || R.attr}` : ""}`,
        extra: `✚ ${alvoP.nome} fica com ${dd3.pvTemp} PV Temporário (absorve antes do PV, some no descanso).` });
      if (h.descanso) { const usos = { ...(ui.meuPers.dados.usos || {}), [h.id]: true };
        ui.meuPers.dados = { ...ui.meuPers.dados, usos }; f.usos = usos;
        await salvarFicha(ui.meuPers.id, ui.meuPers.dados); }
      return render();
    }
    if (R?.tipo === "salvaguarda") {      // Fogo de Supressão, Grito de Saqueador, Sinfonia do Inverno
      const ok = await aplicarEmAlvos({ titulo: `★ ${h.nome}`, origem: `${ui.meuPers.nome} — ${h.nome}`,
        dado: R.dado || null, atributo: R.atributo || null, cd: R.atributo ? dcSalvaguarda(k, R.atributo) : null,
        cond: R.cond || null, turnos: R.turnos || 2, area: !!R.area, raio: R.raio || null,
        tipoDano: R.tipoDano || "físico", empurrao: R.empurrao || 0 });
      if (ok === false) return;   // cancelou sem mirar: não gasta a habilidade
      if (h.descanso) { const usos = { ...(ui.meuPers.dados.usos || {}), [h.id]: true };
        ui.meuPers.dados = { ...ui.meuPers.dados, usos }; f.usos = usos;
        await salvarFicha(ui.meuPers.id, ui.meuPers.dados); }
      return render();
    }
    if (R?.tipo === "condicao") {         // Repulsão Cinética: derruba sem causar dano
      const inimigos = (camp.combate?.ordem || []).filter((c2) => c2.tipo === "inimigo" && !foraDeCombate(c2));
      const r2 = inimigos.length ? await modalForm({ titulo: `★ ${h.nome}`, descricao: h.d,
        campos: [{ k: "alvo", label: "Em quem?", tipo: "select", opcoes: inimigos.map((c2) => ({ v: c2.id, l: c2.nome })) }], okLabel: "Empurrar" }) : { alvo: null };
      if (inimigos.length && !r2?.alvo) return;
      if (r2?.alvo) {
        const alvo = camp.combate.ordem.find((c2) => c2.id === r2.alvo);
        aplicarCond(alvo, R.cond, R.turnos);
        await salvarCombate();
        await enviar("sistema", `★ ${ui.meuPers.nome} usa ${h.nome}: ${alvo.nome} é derrubado (${R.cond} ${R.turnos} turno) — sem dano.`);
      } else await enviar("sistema", `★ ${ui.meuPers.nome} usa ${h.nome} — o alvo é derrubado, sem sofrer dano.`);
      return render();
    }
    if (R?.tipo === "modo" || R?.tipo === "criar") {   // Endurecer, Camuflagem, Fúria, Criogénese
      let escolha = null;
      if (R.opcoes) {
        const r2 = await modalForm({ titulo: `★ ${h.nome}`, descricao: h.d,
          campos: [{ k: "op", label: "O que criar", tipo: "select", opcoes: R.opcoes.map((o) => ({ v: o.n, l: `${o.n} — ${o.d}` })) }], okLabel: "Criar" });
        if (!r2?.op) return; escolha = r2.op;
      } else if (!(await confirmModal(`Usar ${h.nome}?\n\n${h.d}${turnos ? `\n\nDura ${turnos} turno(s).` : ""}${R.aviso ? `\n\n⚠ ${R.aviso}` : ""}`, { okLabel: "Ativar" }))) return;
      const modos = { ...(ui.meuPers.dados.modos || {}), [h.nome]: escolha || "ativo" };
      const exp = { ...(ui.meuPers.dados.modosAte || {}), [h.nome]: turnos || 99 };
      ui.meuPers.dados = { ...ui.meuPers.dados, modos, modosAte: exp }; f.modos = modos;
      await salvarFicha(ui.meuPers.id, ui.meuPers.dados);
      if (sincronizarCdCombate(ui.meuPers.id, ui.meuPers.dados)) await salvarCombate();
      await enviar("sistema", `★ ${ui.meuPers.nome} ativa **${h.nome}**${escolha ? `: ${escolha}` : ""} — ${h.d}${turnos ? ` (${turnos} turnos)` : ""}${R.aviso ? ` ⚠ ${R.aviso}` : ""}`);
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
      const modos = { ...(ui.meuPers.dados.modos || {}) };
      if (r.op) modos[h.nome] = r.op; else delete modos[h.nome];
      ui.meuPers.dados = { ...ui.meuPers.dados, modos }; f.modos = modos;
      await salvarFicha(ui.meuPers.id, ui.meuPers.dados);
      if (sincronizarCdCombate(ui.meuPers.id, ui.meuPers.dados)) await salvarCombate();
      const op2 = h.opcoes.find((o) => o.n === r.op);
      await enviar("sistema", r.op
        ? `${op2.ic} ${ui.meuPers.nome} respira **${r.op}** — ${op2.d}`
        : `💨 ${ui.meuPers.nome} volta a respirar o ar normal (${h.nome} desligado).`);
      return render();
    }
    if (!(await confirmModal(`Usar ${h.nome}?\n\n${h.d}${h.descanso ? `\n\nRecarrega no descanso ${h.descanso}.` : ""}`, { okLabel: "Usar" }))) return;
    if (h.descanso) {                       // marca como gasta até o descanso
      const usos = { ...(ui.meuPers.dados.usos || {}), [h.id]: true };
      ui.meuPers.dados = { ...ui.meuPers.dados, usos }; f.usos = usos;
      await salvarFicha(ui.meuPers.id, ui.meuPers.dados);
    }
    await enviar("sistema", `★ ${ui.meuPers.nome} usa **${h.nome}** (${h.origem}) — ${h.d}`);
    render();
  });
  document.querySelectorAll(".item-usa").forEach((bt) => bt.onclick = async () => {
    const nomeItem = bt.dataset.item;
    const cfg = ehConsumivel(nomeItem); if (!cfg) return;
    if (!(await gastarAcao(cfg.acao, `usar ${cfg.n}`))) return;
    let alvo = ui.meuPers;
    if (!cfg.area && cfg.efeito !== "nenhum" && cfg.efeito !== "condicao") {   // itens de alvo único perguntam em quem
      const r = await modalForm({ titulo: `${cfg.ic} ${nomeItem}`, descricao: `${cfg.d}  ·  ${cfg.acao}. O item é consumido ao ser usado.`,
        campos: [{ k: "alvo", label: "Em quem?", tipo: "select",
          opcoes: (pers || []).map((p2) => ({ v: p2.id, l: p2.id === ui.meuPers.id ? `${p2.nome} (você)` : p2.nome })) }], okLabel: "Usar" });
      if (!r?.alvo) return;
      alvo = (pers || []).find((p2) => p2.id === r.alvo) || ui.meuPers;
    } else if (!(await confirmModal(`Usar ${nomeItem}?\n\n${cfg.d}`, { okLabel: "Usar" }))) return;
    const r = { item: nomeItem };

    // consome o item da ficha de quem usou
    const inv = (f.inventario || []).map((it) => it.nome === r.item ? { ...it, qtd: (it.qtd || 1) - 1 } : it).filter((it) => (it.qtd || 0) > 0 || !ehConsumivel(it.nome));
    f.inventario = inv; ui.meuPers.dados = { ...ui.meuPers.dados, inventario: inv };
    await salvarFicha(ui.meuPers.id, ui.meuPers.dados);

    if (cfg.efeito === "cura") {
      const pd = parseDice(cfg.dado); const ds = rollNd(pd.n, pd.f);
      const val = ds.reduce((x, y) => x + y, 0) + pd.mod;
      await enviar("cura", null, { alvo_id: alvo.id, alvo_nome: alvo.nome, valor: val,
        origem: `${cfg.ic} ${cfg.n} de ${ui.meuPers.nome}`, detalhe: `${cfg.dado} [${ds.join(", ")}]`, aplicado: false });
    } else if (cfg.efeito === "ram") {
      const dd = { ...novaFichaDados(), ...alvo.dados };
      dd.ramGasta = Math.max(0, (dd.ramGasta || 0) - (cfg.valor || 1));
      await salvarFicha(alvo.id, dd); alvo.dados = dd;
      await enviar("sistema", `${cfg.ic} ${ui.meuPers.nome} usa ${cfg.n} em ${alvo.nome}: +${cfg.valor} Slot de RAM.`);
    } else if (cfg.efeito === "sangramento") {
      const cb = camp.combate?.ordem?.find((x) => x.personagem_id === alvo.id);
      if (cb && cb.cond) { cb.cond = cb.cond.filter((c2) => !/sangrando/i.test(c2.n)); await salvarCamp({ combate: camp.combate }, "estancar o sangramento"); }
      await enviar("sistema", `${cfg.ic} ${ui.meuPers.nome} usa ${cfg.n} em ${alvo.nome}: sangramento estancado.`);
    } else if (cfg.efeito === "condicao") {
      const ok = await aplicarEmAlvos({ titulo: `${cfg.ic} ${cfg.n}`, origem: `${ui.meuPers.nome} — ${cfg.n}`,
        dado: cfg.dano || null, cond: cfg.cond || null, turnos: cfg.turnos || 2, area: true, raio: cfg.raio || null,
        tipoDano: cfg.tipoDano || "físico",
        pericia: cfg.pericia || null, atributo: cfg.pericia ? null : (cfg.cd ? (cfg.atributo || "Con") : null), cd: cfg.cd || null });
      if (ok === false) {   // cancelou sem marcar ninguém: devolve o item
        const volta = (ui.meuPers.dados.inventario || []).slice();
        const ja = volta.find((it) => it.nome === r.item);
        if (ja) ja.qtd = (ja.qtd || 0) + 1; else volta.push({ tipo: "consumivel", nome: r.item, equip: false, qtd: 1 });
        f.inventario = volta; ui.meuPers.dados = { ...ui.meuPers.dados, inventario: volta };
        await salvarFicha(ui.meuPers.id, ui.meuPers.dados);
      }
    } else {
      await enviar("sistema", `${cfg.ic} ${ui.meuPers.nome} usa ${cfg.n}${alvo.id !== ui.meuPers.id ? ` em ${alvo.nome}` : ""}. ${cfg.d}`);
    }
    render();
  });
  $("#conjurar").onclick = async () => {
    const s = SCRIPTS.find((x) => x.n === $("#sel-scr").value);
    const trvC = minhaTrava(["silenciado"]);
    if (trvC) return enviar("sistema", `${ui.meuPers.nome} está ${trvC.n} e não consegue conjurar ${s.n}.`);
    if (!(await gastarAcao(s.a, `conjurar ${s.n}`))) return;
    const zonaTec = aurasSobre(minhaLinhaCb(), "tecnomancia");
    if (zonaTec.length) return enviar("sistema", `🌀 ${ui.meuPers.nome} tenta conjurar ${s.n} — a matriz não responde. ${ui.meuPers.nome} está dentro da zona de nulidade de ${zonaTec.map((a) => a.criatura).join(", ")}. Saia do raio para conjurar.`);
    if (s.c > k.ramLivre) {
      // Sem RAM: dá para pagar com o corpo — Overclock manual (1d6 por ponto
      // que falta) ou a Bateria Interna (1d8 para scripts de custo 1–2).
      const falta = s.c - k.ramLivre;
      const temBateria = (f.implantes || []).includes("Bateria Interna") && s.c <= 2;
      const opc = [];
      if (temBateria) opc.push({ v: "bateria", l: "Bateria Interna — 1d8 de Vida, sem gastar RAM" });
      opc.push({ v: "overclock", l: `Overclock manual — ${falta}d6 de Vida (1d6 por ponto que falta)` });
      opc.push({ v: "", l: "— desistir —" });
      const rOC = await modalForm({ titulo: `◈ ${s.n} — RAM insuficiente`,
        descricao: `${s.n} custa ${s.c} e você tem ${k.ramLivre}. Faltam ${falta}. Dá para forçar pagando com Vida.`,
        campos: [{ k: "como", label: "Como conjurar", tipo: "select", valor: temBateria ? "bateria" : "overclock", opcoes: opc }],
        okLabel: "Forçar" });
      if (!rOC?.como) return render();
      const pdOC = rOC.como === "bateria" ? parseDice("1d8") : parseDice(`${falta}d6`);
      const dsOC = rollNd(pdOC.n, pdOC.f);
      const custoPv = dsOC.reduce((x, y) => x + y, 0);
      const ddOC = { ...novaFichaDados(), ...ui.meuPers.dados };
      ddOC.pvAtual = Math.max(0, (ddOC.pvAtual || 0) - custoPv);
      if (rOC.como === "overclock") ddOC.ramGasta = (ddOC.ramGasta || 0) + k.ramLivre;   // consome o que sobrava
      ui.meuPers.dados = ddOC; f.pvAtual = ddOC.pvAtual; f.ramGasta = ddOC.ramGasta;
      await salvarFicha(ui.meuPers.id, ddOC);
      await enviar("sistema", `⚡ ${ui.meuPers.nome} força ${s.n} ${rOC.como === "bateria" ? "pela Bateria Interna" : "em Overclock"}: ${pdOC.n}d${pdOC.f} [${dsOC.join(", ")}] = ${custoPv} de dano. PV ${ddOC.pvAtual}/${ddOC.pvMax}.${ddOC.pvAtual <= 0 ? " ☠ CAIU!" : ""}`);
    } else {
      ui.meuPers.dados = { ...f, ramGasta: (f.ramGasta || 0) + s.c };
      await salvarFicha(ui.meuPers.id, ui.meuPers.dados);
    }
    efeitoMatrix();   // flash de "código da matrix" — só imersão, não afeta a resolução
    const nat = d(20);
    // Scripts que reparam a nave resolvem direto no casco.
    // O campo `resolve` manda; o regex no texto fica só como rede para
    // conteúdo cadastrado pela administração que ainda não o declara.
    const repDado = s.resolve?.tipo === "reparo_nave" ? s.resolve.dado : (/(\d+d\d+)\s+do casco/i.exec(s.d || "") || [])[1];
    if (repDado && camp.nave) {
      const pdn = parseDice(repDado); const dn = rollNd(pdn.n, pdn.f);
      const val = dn.reduce((x, y) => x + y, 0) + pdn.mod;
      const antes = camp.nave.casco;
      camp.nave.casco = Math.min(camp.nave.casco_max, camp.nave.casco + val);
      const cbn2 = camp.combate?.ordem?.find((x) => x.nave_party);
      if (cbn2) cbn2.casco = camp.nave.casco;
      await salvarCamp({ nave: camp.nave, ...(cbn2 ? { combate: camp.combate } : {}) }, "salvar o reparo");
      await enviar("rolagem", null, { titulo: `Script — ${s.n}`,
        detalhe: `${repDado} [${dn.join(", ")}] · ${s.c} RAM`,
        extra: `🔧 Casco reparado em ${camp.nave.casco - antes} (${camp.nave.casco}/${camp.nave.casco_max}).` });
      return render();
    }
    // Scripts que curam resolvem de verdade: escolhem alvo, rolam e aplicam.
    const mTexto = /Cura (\d+d\d+)(?:\s*\+\s*(\w+))?/i.exec(s.d || "");
    const mCura = s.resolve?.tipo === "cura" ? [null, s.resolve.dado, s.resolve.attr] : mTexto;
    if (mCura) {
      const alvoR = await modalForm({ titulo: `◈ ${s.n}`, descricao: s.d,
        campos: [{ k: "alvo", label: "Em quem?", tipo: "select",
          opcoes: (pers || []).map((p2) => ({ v: p2.id, l: p2.id === ui.meuPers.id ? `${p2.nome} (você)` : p2.nome })) }], okLabel: "Conjurar" });
      if (alvoR?.alvo) {
        const alvo = (pers || []).find((p2) => p2.id === alvoR.alvo);
        const pd = parseDice(mCura[1]); const ds = rollNd(pd.n, pd.f);
        const bonus = mCura[2] && k.attr[mCura[2]] != null ? k.attr[mCura[2]] : 0;
        const val = ds.reduce((x, y) => x + y, 0) + pd.mod + bonus;
        await enviar("cura", null, { alvo_id: alvo.id, alvo_nome: alvo.nome, valor: val,
          origem: `◈ ${s.n} de ${ui.meuPers.nome}`, detalhe: `${mCura[1]} [${ds.join(", ")}]${bonus ? ` ${sign(bonus)} ${mCura[2]}` : ""}`, aplicado: false });
        // Bio-feedback e afins: quem cura também recebe algo de volta.
        const rc = k.efeitos?.aoCurar();
        if (rc?.curaPropria && alvo.id !== ui.meuPers.id) {
          const dd = { ...novaFichaDados(), ...ui.meuPers.dados };
          const antes = dd.pvAtual || 0;
          dd.pvAtual = Math.min(k.pvMax, antes + rc.curaPropria);
          if (dd.pvAtual !== antes) {
            ui.meuPers.dados = dd;
            await salvarFicha(ui.meuPers.id, dd);
            await enviar("sistema", `♻ ${ui.meuPers.nome} — ${rc.fontes[0]}: recupera ${dd.pvAtual - antes} PV ao curar um aliado.`);
          }
        }
        return render();
      }
    }
    if (s.resolve?.tipo === "pvtemp") {   // Firewall Ativo: barreira que absorve
      const pdt = parseDice(s.resolve.dado); const dst = rollNd(pdt.n, pdt.f);
      const bo = s.resolve.attr ? (k.attr[s.resolve.attr] || 0) : 0;
      const val = dst.reduce((x, y) => x + y, 0) + pdt.mod + bo;
      const dd = { ...novaFichaDados(), ...ui.meuPers.dados };
      dd.pvTemp = Math.max(dd.pvTemp || 0, val);
      ui.meuPers.dados = dd;
      await salvarFicha(ui.meuPers.id, dd);
      await enviar("rolagem", null, { titulo: `◈ ${s.n}`,
        detalhe: `${s.resolve.dado} [${dst.join(", ")}]${bo ? ` +${bo} ${s.resolve.attr}` : ""} · ${s.c} RAM`,
        extra: `🛡 Barreira de ${dd.pvTemp}: absorve o próximo impacto antes do PV.` });
      return render();
    }
    if (s.resolve?.tipo === "drenar_escudos") {   // metade do que drenou vira PV Temporário
      const naves = (camp.combate?.ordem || []).filter((x) => ehNave(x) && x.lado === "inimiga" && !foraDeCombate(x) && x.escudos > 0);
      const r2 = await modalForm({ titulo: `◈ ${s.n}`, descricao: s.d,
        campos: naves.length
          ? [{ k: "alvo", label: "De qual nave?", tipo: "select", opcoes: naves.map((x) => ({ v: x.id, l: `${x.nome} — escudos ${x.escudos}/${x.escudos_max}` })) },
             { k: "qtd", label: "Quanto drenar", tipo: "numero", valor: Math.min(10, naves[0].escudos), min: 1, max: naves[0].escudos }]
          : [{ k: "qtd", label: "Quanto de escudo foi drenado", tipo: "numero", valor: 10, min: 1, max: 99 }],
        okLabel: "Drenar" });
      if (!r2 || !(+r2.qtd > 0)) {   // cancelou: devolve a RAM
        ui.meuPers.dados = { ...ui.meuPers.dados, ramGasta: Math.max(0, (ui.meuPers.dados.ramGasta || 0) - s.c) };
        await salvarFicha(ui.meuPers.id, ui.meuPers.dados);
        return render();
      }
      const alvoN = naves.find((x) => x.id === r2.alvo);
      const drenado = Math.min(+r2.qtd, alvoN ? alvoN.escudos : +r2.qtd);
      if (alvoN) { alvoN.escudos = Math.max(0, alvoN.escudos - drenado); await salvarCombate(); }
      const ganho = Math.floor(drenado / 2);
      const dd = { ...novaFichaDados(), ...ui.meuPers.dados };
      dd.pvTemp = Math.max(dd.pvTemp || 0, ganho);
      ui.meuPers.dados = dd;
      await salvarFicha(ui.meuPers.id, dd);
      await enviar("rolagem", null, { titulo: `◈ ${s.n}`,
        detalhe: `drenou ${drenado} de escudo${alvoN ? ` de ${alvoN.nome}` : ""} · ${s.c} RAM`,
        extra: `✚ ${ui.meuPers.nome} converte metade: ${ganho} de PV Temporário.` });
      return render();
    }
    if (s.resolve?.tipo === "ataque") {   // Script ofensivo: mira um alvo (ou área) e resolve
      const ok = await aplicarEmAlvos({ titulo: `◈ ${s.n}`, origem: `${ui.meuPers.nome} — ${s.n}`,
        dado: s.resolve.dado || s.dmg || null,
        acerto: s.resolve.area ? null : k.conj, area: !!s.resolve.area, raio: s.resolve.raio || null,
        tipoDano: s.resolve.tipoDano || "físico",
        cond: s.resolve.cond || null, turnos: s.resolve.turnos || 2 });
      if (ok === false) {   // cancelou sem mirar: devolve a RAM
        ui.meuPers.dados = { ...ui.meuPers.dados, ramGasta: Math.max(0, (ui.meuPers.dados.ramGasta || 0) - s.c) };
        await salvarFicha(ui.meuPers.id, ui.meuPers.dados);
      }
      return render();
    }
    enviar("rolagem", null, { titulo: `Script — ${s.n}`, detalhe: `d20 [${nat}] +${k.conj} · ${s.c} RAM · ${s.a}`, total: nat + k.conj, crit: nat === 20, fumble: nat === 1, extra: s.d.slice(0, 90) });
    render(); };
  const rolarLivre = (v) => { const r = rolarExpr(v.replace(/^\//, ""), ui.vantagem); if (!r) return;
    enviar("rolagem", null, { titulo: (ui.privada ? "🔒 " : "") + `Rolagem ${v}`, detalhe: r.detalhe, total: r.total, ...(ui.privada ? { privada: true } : {}) }); };
  $("#rolar-livre").onclick = () => rolarLivre($("#dado-livre").value.trim());
  $("#macro-salvar")?.addEventListener("click", async () => {
    const expr = $("#dado-livre").value.trim();
    if (!expr) return alert("Digite uma expressão em '1d20+2d10' antes de salvar como macro.");
    const r = await modalForm({ titulo: "☆ Salvar macro", descricao: `Vai rolar "${expr}" com um clique só.`,
      campos: [{ k: "rotulo", label: "Nome curto (aparece no botão)", tipo: "texto", valor: expr.slice(0, 14) }], okLabel: "Salvar" });
    if (!r?.rotulo?.trim()) return;
    const lista = macrosDe(ui.meuPers.id); lista.push({ rotulo: r.rotulo.trim().slice(0, 14), expr });
    salvarMacros(ui.meuPers.id, lista); render();
  });
  document.querySelectorAll("[data-macro]").forEach((b) => b.onclick = () => {
    const m = macrosDe(ui.meuPers.id)[+b.dataset.macro]; if (m) rolarLivre(m.expr);
  });
  document.querySelectorAll("[data-macro-del]").forEach((b) => b.onclick = () => {
    const lista = macrosDe(ui.meuPers.id); lista.splice(+b.dataset.macroDel, 1); salvarMacros(ui.meuPers.id, lista); render();
  });
  $("#enviar-dano").onclick = () => { const v = +$("#dano-val").value; if (!v) return;
    const alvo = pers.find((x) => x.id === $("#sel-alvo").value);
    enviar("dano", null, { alvo_id: alvo.id, alvo_nome: alvo.nome, valor: v, origem: `de ${ui.meuPers.nome}`, aplicado: false }); };
  $("#enviar-cura").onclick = () => { const v = +$("#dano-val").value; if (!v) return;
    const alvoCura = camp.combate?.ordem?.find((x) => x.personagem_id === $("#sel-alvo").value);
    const zonaCura = aurasSobre(alvoCura || minhaLinhaCb(), "cura");
    if (zonaCura.length) return enviar("sistema", `🌀 A cura não pega: o alvo está dentro da zona de nulidade de ${zonaCura.map((a) => a.criatura).join(", ")}. Tire-o do raio primeiro.`);
    const alvo = pers.find((x) => x.id === $("#sel-alvo").value);
    enviar("cura", null, { alvo_id: alvo.id, alvo_nome: alvo.nome, valor: v, origem: `de ${ui.meuPers.nome}`, aplicado: false }); };
}
