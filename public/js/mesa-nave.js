// ============================================================================
//  NAVE — aba "Nave" de telaMesa (stats, posto, combate espacial clássico,
//  estaleiro/upgrades), extraído de app.js. 2ª fatia da modularização do
//  telaMesa (ver "Modularização de telaMesa" em CLAUDE.md).
//  Uso: import { renderNave, wireNave } from "./mesa-nave.js";
//       renderNave(ctx) dentro do template da mesa; wireNave(ctx) na hora de
//       religar handlers (mesmo momento em que os outros `[data-*]` da mesa
//       são religados).
//
//  Corpo copiado tal e qual de app.js — só os identificadores livres viraram
//  imports, mesmo padrão de biblioteca.js/admin.js/mesa-mestre.js.
// ============================================================================
import { NAVES, ESTACOES, REGRAS_NAVE, UPGRADES_NAVE } from "./dados-jogo.js";
import {
  d, sign, parseDice, rollNd, danoCritico, novaFichaDados, aplicarCond, distCombate,
  capacidadeArma, municaoDe, descontarMunicao, recarregarArma, podeAgirAgora,
} from "./regras.js";
import { modalForm, confirmModal } from "./ui.js";
import {
  sb, esc, usuario, POSTOS_ORDEM,
  ehNave, foraDeCombate, defesaNave, danoNave, rolarAvaria, ataqueDaNave, combateNaveVazio, naveTaticaVazia,
  salvarFicha, vidaAtual, vidaMax,
} from "./app.js";

const $ = (s) => document.querySelector(s);

export function renderNave(ctx) {
  const { ui, camp, membros, nave, cbn, meuPosto, f, defesaNaveParty, bonusDefVeiculo } = ctx;
  return `
          <div class="mesa-painel" ${ui.abaMesa === "nave" ? "" : "hidden"}>
          <section class="sec"><header><span class="tag">🚀</span><h2>Nave da campanha</h2></header>
            ${nave ? `
              <p><b>${esc(nave.nome_batismo || nave.modelo)}</b> <small>(${esc(nave.modelo)})</small></p>
              <div class="barras">
                <div class="barra"><span>Casco ${nave.casco}/${nave.casco_max}</span><div><i style="width:${(100 * nave.casco / nave.casco_max) | 0}%;background:var(--chrome)"></i></div></div>
                <div class="barra"><span>Escudos ${nave.escudos}/${nave.escudos_max}</span><div><i style="width:${nave.escudos_max ? (100 * nave.escudos / nave.escudos_max) | 0 : 0}%;background:var(--tech)"></i></div></div>
              </div>
              <p class="regra">Defesa ${defesaNaveParty()}${bonusDefVeiculo() ? ` (10 + Manobra + ${bonusDefVeiculo()} do Piloto)` : ""} · ${esc(REGRAS_NAVE.defesa)}</p>
              ${nave.armas?.length ? `<p class="regra">${nave.armas.map((a) => { const cap = capacidadeArma(a);
                return `<b class="chrome">${esc(a.n)}</b> ${esc(a.dano)}${a.area && a.raio ? ` ◎ raio ${a.raio}m` : ""}${cap == null ? " (energia)" : ` — ${municaoDe(nave, a)}/${cap} ${a.tipo === "missil" ? "unid." : "tiros"}`}`; }).join(" · ")}</p>` : ""}
              <label>Meu posto<select id="sel-posto"><option value="">— fora da nave —</option>
                ${Object.entries(ESTACOES).map(([pk, e]) => `<option value="${pk}" ${meuPosto === pk ? "selected" : ""}>${e.n}</option>`).join("")}</select></label>
              ${meuPosto && f ? `<div class="acoes-mesa">${ESTACOES[meuPosto].acoes.map((a, i) => `<button class="mini" data-est="${i}" title="${esc(a.d)}">${esc(a.n)}</button>`).join("")}</div>` : ""}
              ${(cbn.avarias || []).length ? `<div class="avarias">${cbn.avarias.map((av, ai) => `<div class="avaria"><b>⚠ ${esc(av.n)}</b> <span class="regra">${esc(av.e)}</span>${ui.souMestre ? `<button class="mini rm" data-av-fix="${ai}" title="Consertar">✔</button>` : ""}</div>`).join("")}</div>` : ""}
              ${ui.souMestre ? `<div class="acoes-mesa"><input id="nave-dano" type="number" placeholder="dano" style="width:70px"/><button id="nave-hit" class="mini dano">💥 NAVE SOFRE</button><button id="nave-upg" class="mini">🔧 Upgrades</button><button id="nave-repar" class="mini eq">🛠 Estaleiro</button></div>` : ""}
              ${(cbn.ativo && !camp.combate.ordem.some((x) => ehNave(x))) ? `
                <div class="cbn-box">
                  <div class="cbn-cab"><b>🚀 COMBATE ESPACIAL</b><span class="regra">Rodada ${cbn.rodada}</span></div>
                  ${(cbn.inimigas || []).map((x, xi) => `<div class="cb-linha ${x.casco <= 0 ? "cb-morto" : ""}">
                    <span class="cb-nome"><b>${esc(x.nome)}</b> <span class="dim">Def ${10 + (x.manobra || 0)} · ${esc(x.dano)}</span></span>
                    <span class="cb-hp" title="Casco"><span class="cb-hp-barra" style="width:${x.casco_max ? Math.max(0, 100 * x.casco / x.casco_max) : 0}%;background:var(--chrome)"></span><b>${x.casco}/${x.casco_max}</b></span>
                    <span class="cb-hp" title="Escudos"><span class="cb-hp-barra" style="width:${x.escudos_max ? Math.max(0, 100 * x.escudos / x.escudos_max) : 0}%;background:var(--tech)"></span><b>${x.escudos}/${x.escudos_max}</b></span>
                    ${ui.souMestre ? `<span class="cb-acoes"><button class="cbn-atk" data-cbn-atk="${xi}" title="Esta nave dispara contra a tripulação">⚔</button><button class="cb-rm" data-cbn-rm="${xi}">✕</button></span>` : ""}
                  </div>`).join("") || `<p class="regra">Nenhuma nave inimiga em campo.</p>`}
                  <p class="regra cbn-postos">Postos: ${POSTOS_ORDEM.map((pk) => { const quem = (membros || []).find((m) => m.posto === pk); const agiu = (cbn.agiram || []).includes(pk);
                    return `<span class="cbn-posto ${agiu ? "ok" : ""} ${quem ? "" : "vazio"}" title="${quem ? esc(quem.perfis?.apelido || "") : "vago"}">${esc(ESTACOES[pk].n.split(" ")[0])}${agiu ? " ✓" : ""}</span>`; }).join(" ")}</p>
                  ${ui.souMestre ? `<div class="filtros"><button id="cbn-add" class="mini">➕ Nave inimiga</button><button id="cbn-prox" class="mini eq">▶ Próxima rodada</button><button id="cbn-fim" class="mini rm">⏹ Encerrar</button></div>` : ""}
                </div>` : (ui.souMestre ? `<p class="regra" style="margin-top:8px">⚔ Para uma batalha espacial, abra a aba <b>Combate</b> e adicione a nossa nave e as inimigas ao rastreador — a iniciativa é a mesma do combate pessoal.</p>` : "")}
            ` : ui.souMestre ? `
              <select id="sel-nave">${NAVES.map((n) => `<option>${esc(n.n)}</option>`).join("")}</select>
              <input id="nave-nome" placeholder="Nome de batismo"/>
              <button id="def-nave" class="btn-primario" style="margin-top:8px">DEFINIR NAVE</button>` : `<p class="regra">O Mestre ainda não definiu a nave.</p>`}
          </section>
          </div>`;
}

export function wireNave(ctx) {
  const { id, camp, pers, ui, f, k, meuPosto, enviar, salvarCamp, salvarCbn, render, defesaNaveParty, aplicarDanoAlvo, snapshot, gastarAcao } = ctx;
  // A nave da party também aparece como linha no rastreador (`nave_party`), com
  // cópia própria de casco/escudos — o HUD de combate lê de lá. Toda mudança em
  // camp.nave precisa ser espelhada, senão uma aba mostra um número e a outra outro.
  const sincronizarLinhaNave = () => {
    const linha = camp.combate?.ordem?.find((x) => x.nave_party);
    if (linha && camp.nave) { linha.casco = camp.nave.casco; linha.escudos = camp.nave.escudos; }
    return linha;
  };

  $("#def-nave")?.addEventListener("click", async () => {
    const n = NAVES.find((x) => x.n === $("#sel-nave").value);
    const nave = { modelo: n.n, nome_batismo: $("#nave-nome").value.trim() || n.n, casco: n.casco, casco_max: n.casco, escudos: n.escudos, escudos_max: n.escudos, manobra: n.manobra, dano: n.dano, ataques: n.ataques || [], armas: n.armas || [] };
    if (!(await salvarCamp({ nave }, "registrar a nave"))) return;
    camp.nave = nave;
    await enviar("nave", `A nave ${nave.nome_batismo} (${n.n}) entrou em serviço. Casco ${n.casco}, Escudos ${n.escudos}, Defesa ${10 + n.manobra}.`);
    render();
  });
  $("#sel-posto")?.addEventListener("change", async (e) => {
    const novoPosto = e.target.value || null;
    // Embarcar (ocupar um posto) custa a Ação de Movimento + a Ação Principal do
    // turno — correr até o posto e operar os controles não é de graça. Sair da
    // nave (voltar a "fora da nave") continua livre. Fora de combate, gastarAcao
    // já é um no-op (retorna true direto), então isto não atrapalha fora de cena.
    if (novoPosto) {
      if (!(await gastarAcao("Ação de Movimento", "embarcar na nave"))) { e.target.value = meuPosto || ""; return; }
      if (!(await gastarAcao("Ação Principal", "embarcar na nave"))) { e.target.value = meuPosto || ""; return; }
    }
    await sb.from("campanha_membros").update({ posto: novoPosto }).eq("campanha_id", id).eq("perfil_id", usuario.id);
    location.reload();
  });
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
      await salvarCamp({ nave: camp.nave }, "salvar o reparo automático");
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
      manobra: base.manobra, dano: base.dano, ataques: base.ataques || [], armas: base.armas || [] });
    await salvarCbn(); await enviar("sistema", `🚀 Contato hostil: ${camp.combate_nave.inimigas.slice(-1)[0].nome} entrou em alcance.`); render();
  });
  document.querySelectorAll("[data-cbn-rm]").forEach((b) => b.onclick = async () => {
    camp.combate_nave.inimigas.splice(+b.dataset.cbnRm, 1); await salvarCbn(); render();
  });
  // Nave inimiga dispara contra a tripulação
  document.querySelectorAll("[data-cbn-atk]").forEach((b) => b.onclick = async () => {
    const x = camp.combate_nave.inimigas[+b.dataset.cbnAtk]; if (!x || !camp.nave) return;
    const atk = await ataqueDaNave(x); if (!atk) return;
    if (municaoDe(x, atk) <= 0) return alert(`${atk.n} está sem munição — sem como disparar.`);
    const bonusAtk = atk.bonus ?? 4;
    const nat = d(20), total = nat + bonusAtk;
    const def = defesaNave(camp.nave);
    descontarMunicao(x, atk);
    if (nat === 1 || total < def) {
      await salvarCbn();
      return enviar("rolagem", null, { titulo: `🚀 ${x.nome} dispara ${atk.n}`, detalhe: `d20 [${nat}] ${sign(bonusAtk)} vs Defesa ${def}`, total, fumble: nat === 1, extra: "Errou — o disparo passa de raspão." });
    }
    const pd = parseDice(atk.dano); const dados = rollNd(pd.n, pd.f);
    const bruto = danoCritico(dados.reduce((a2, b2) => a2 + b2, 0), pd.mod, nat === 20 ? 2 : 1);
    const r = danoNave(camp.nave, bruto);
    let extra = `Escudos absorveram ${r.escudos}; Casco sofreu ${r.casco}. Nave: ${camp.nave.casco}/${camp.nave.casco_max} casco · ${camp.nave.escudos}/${camp.nave.escudos_max} escudos.`;
    if ((nat === 20 || r.critico) && r.casco > 0) {
      const av = rolarAvaria(); camp.combate_nave.avarias.push(av);
      extra += `  ⚠ FALHA CRÍTICA — ${av.n}: ${av.e}`;
    }
    if (camp.nave.casco <= 0) extra += "  💀 CASCO A ZERO: a nave está destruída ou à deriva.";
    sincronizarLinhaNave();
    const linhaNave = camp.combate?.ordem?.some((y) => y.nave_party);
    await salvarCamp({ nave: camp.nave, ...(linhaNave ? { combate: camp.combate } : {}) }, "salvar o disparo inimigo");
    await salvarCbn();
    await enviar("rolagem", null, { titulo: `🚀 ${x.nome} dispara ${atk.n}`, detalhe: `d20 [${nat}] ${sign(bonusAtk)} vs Defesa ${def} · dano ${atk.dano} [${dados.join(", ")}]${nat === 20 ? " ×2" : ""}`, total, crit: nat === 20, extra });
    render();
  });
  document.querySelectorAll("[data-av-fix]").forEach((b) => b.onclick = async () => {
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
      await salvarFicha(pagador.id, dd); pagador.dados = dd;
    }
    camp.nave.casco = camp.nave.casco_max; camp.nave.escudos = camp.nave.escudos_max;
    const cbn2 = camp.combate?.ordem?.find((x) => x.nave_party);
    if (cbn2) { cbn2.casco = camp.nave.casco; cbn2.escudos = camp.nave.escudos; }
    if (camp.combate) camp.combate.avarias = [];
    await salvarCamp({ nave: camp.nave, ...(camp.combate ? { combate: camp.combate } : {}) }, "salvar o reparo do estaleiro");
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
    await salvarCamp({ nave: camp.nave }, "salvar a melhoria");
    await enviar("sistema", `🔧 ${camp.nave.nome_batismo || camp.nave.modelo} recebeu uma melhoria: ${u.n}. ${u.e}`);
    render();
  });
  $("#nave-hit")?.addEventListener("click", async () => {
    const v = +$("#nave-dano").value; if (!v || !camp.nave) return;
    // Muta a nave em memória (não uma cópia): gravar só a cópia deixava a tela
    // velha até o F5 e fazia a próxima ação partir do estado antigo.
    const n = camp.nave;
    const abs = Math.min(n.escudos, v); n.escudos -= abs; n.casco = Math.max(0, n.casco - (v - abs));
    const linhaNave = sincronizarLinhaNave();
    await salvarCamp({ nave: n, ...(linhaNave ? { combate: camp.combate } : {}) }, "salvar o dano na nave");
    await enviar("nave", `A nave sofreu ${v} de dano (${abs} nos escudos). Casco ${n.casco}/${n.casco_max}, Escudos ${n.escudos}/${n.escudos_max}.${n.casco === 0 ? " ⚠ CASCO ZERO — À DERIVA!" : ""}`);
    render();
  });
  if (meuPosto && f) document.querySelectorAll("[data-est]").forEach((b) => b.onclick = async () => {
    const acao = ESTACOES[meuPosto].acoes[+b.dataset.est];
    // Qualquer ação de posto (atirar, manobrar, recarregar, reparar...) consome
    // a Ação Principal do turno — operar a nave não é de graça só porque já está
    // a bordo. Mesmo padrão de turno/ação de [data-atq] (mesa-ficha.js): só o
    // dono da vez age (Mestre sempre pode forçar), e gastarAcao já é um no-op
    // fora de combate.
    if (camp.combate?.ativo && !ui.souMestre
        && !podeAgirAgora(camp.combate, camp.combate.ordem.find((x) => x.personagem_id === ui.meuPers?.id)))
      return alert(`Não é o seu turno (vez de ${camp.combate.ordem[camp.combate.turno]?.nome || "outro combatente"}).`);
    if (!(await gastarAcao("Ação Principal", `usar o posto: ${acao.n}`))) return;
    const nt = (camp.combate.nave = camp.combate.nave || naveTaticaVazia());
    let mexeuNaTatica = false;
    let extra = acao.d;

    // ---- Ações sem rolagem (Fuga de Dobra, Sobrecarga de Propulsores) ----
    if (!acao.rola) {
      if (/sobrecarga de propulsores/i.test(acao.n) && camp.nave) {
        const choque = d(4);
        ui.meuPers.dados = { ...ui.meuPers.dados, pvAtual: Math.max(0, (ui.meuPers.dados.pvAtual || 0) - choque) };
        await salvarFicha(ui.meuPers.id, ui.meuPers.dados);
        nt.manobraExtra = 2; nt.manobraAte = 1;   // vale até a próxima rodada
        await salvarCamp({ combate: camp.combate }, "salvar a sobrecarga");
        await enviar("nave", `⚙ ${ui.meuPers.nome} sobrecarrega os propulsores: +2 de Manobrabilidade por 1 turno (Defesa da nave ${defesaNaveParty()}). O engenheiro sofre ${choque} de dano de choque.`);
        return render();
      }
      if (/recarregar/i.test(acao.n) && camp.nave) {
        const balisticas = (camp.nave.armas || []).filter((a) => a.tipo === "balistica");
        if (!balisticas.length) return alert(`${camp.nave.nome_batismo || camp.nave.modelo} não tem arma balística — só energia (infinita) e mísseis (sem recarga em combate).`);
        const arma = balisticas.length === 1 ? balisticas[0] : (await modalForm({ titulo: "🔩 Recarregar", campos: [
          { k: "arma", label: "Qual arma", tipo: "select", opcoes: balisticas.map((a) => ({ v: a.n, l: `${a.n} (${municaoDe(camp.nave, a)}/${a.pente})` })) }], okLabel: "Recarregar" }))?.arma;
        const armaObj = typeof arma === "string" ? balisticas.find((a) => a.n === arma) : arma;
        if (!armaObj) return;
        recarregarArma(camp.nave, armaObj);
        camp.combate.agiram = [...new Set([...(camp.combate.agiram || []), meuPosto])];
        await salvarCamp({ combate: camp.combate, nave: camp.nave }, "salvar a recarga");
        await enviar("nave", `🔩 ${ui.meuPers.nome} recarrega ${armaObj.n} (${armaObj.pente}/${armaObj.pente}). A rodada se vai nisso.`);
        return render();
      }
      if (/fuga de dobra/i.test(acao.n) && camp.nave) {
        const dob = nt.dobra || { cargas: 0, cascoRef: camp.nave.casco };
        const levouDano = camp.nave.casco < dob.cascoRef;
        const cargas = levouDano ? 1 : (dob.cargas || 0) + 1;
        nt.dobra = { cargas, cascoRef: camp.nave.casco };
        if (cargas >= 2) {
          nt.dobra = null; camp.combate.naveEmCena = false;
          await salvarCamp({ combate: camp.combate }, "salvar o salto de dobra");
          await enviar("nave", `🌀 Salto de dobra concluído — ${camp.nave.nome_batismo || camp.nave.modelo} desaparece do combate. A tripulação escapa.`);
        } else {
          await salvarCamp({ combate: camp.combate }, "salvar a carga de dobra");
          await enviar("nave", `🌀 ${ui.meuPers.nome} carrega o motor de dobra (${cargas}/2).${levouDano ? " O casco foi atingido e a carga reiniciou." : " Mais um turno sem dano no casco e a nave salta."}`);
        }
        return render();
      }
      return enviar("nave", `${ui.meuPers.nome} executa ${acao.n}: ${acao.d}`);
    }

    // ---- Ações com rolagem ----
    const [at, pn] = acao.rola; const mod = k.attr[at] + k.per[pn];
    const comDesv = /tiro de precis/i.test(acao.n);   // Tiro de Precisão sai com Desvantagem
    let nat;
    if (comDesv) { const r1 = d(20), r2 = d(20); nat = Math.min(r1, r2); extra = `[desvantagem ${r1}/${r2}] ${extra}`; }
    else nat = d(20);
    const total = nat + mod;
    // Efeitos que persistem até serem consumidos (Cap. 12)
    if (/manobra evasiva/i.test(acao.n) && camp.nave) {
      const defBase = defesaNaveParty();
      if (total > defBase) { nt.evasiva = total; nt.evasivaDe = ui.meuPers.id; extra = `Defesa da nave passa a ${total} até o seu próximo turno (base ${defBase}).`; }
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
    // Sensores: desliga os escudos da nave inimiga por 1 turno (ou impõe Desvantagem).
    if (/guerra eletr/i.test(acao.n)) {
      const vivas = camp.combate.ordem.filter((x) => ehNave(x) && x.lado === "inimiga" && !foraDeCombate(x));
      if (!vivas.length) extra = "Nenhuma nave inimiga em campo para invadir.";
      else {
        const esc1 = vivas.length === 1 ? vivas[0].id : (await modalForm({ titulo: `📡 ${acao.n} — alvo`, campos: [
          { k: "alvo", label: "Nave inimiga", tipo: "select", opcoes: vivas.map((x) => ({ v: x.id, l: `${x.nome} — escudos ${x.escudos}/${x.escudos_max}, Def ${defesaNave(x)}` })) }], okLabel: "Invadir" }))?.alvo;
        const alvo = vivas.find((x) => x.id === esc1);
        if (alvo) {
          const cd = defesaNave(alvo);
          if (total >= cd) { alvo.escudosOff = 2;   // vale até o próximo turno dela
            extra = `Invadiu (CD ${cd}): os escudos de ${alvo.nome} ficam inertes — nada absorve dano até o próximo turno dela.`; }
          else extra = `A contramedida de ${alvo.nome} segura a invasão (CD ${cd}).`;
          mexeuNaTatica = true;
        }
      }
    }
    if (acao.cura && camp.nave && total >= 12) {
      const pd = parseDice(acao.dado); const val = rollNd(pd.n, pd.f).reduce((a, b) => a + b, 0) + (acao.cura === "escudos" ? f.nivel : 0);
      const n = camp.nave;
      n[acao.cura] = Math.min(n[acao.cura + "_max"], n[acao.cura] + val);
      const linhaNave = sincronizarLinhaNave();
      await salvarCamp({ nave: n, ...(linhaNave ? { combate: camp.combate } : {}) }, "salvar a cura");
      extra = `+${val} de ${acao.cura}! (${n[acao.cura]}/${n[acao.cura + "_max"]})`;
      mexeuNaTatica = true;   // força o render() no fim, pra barra subir na hora
    }
    // Artilharia: alvo pode ser nave inimiga, criatura ou NPC hostil — nunca um
    // jogador/aliado nem a própria nave da party (fogo amigo por engano). Um
    // jogador nunca cai neste filtro porque a linha dele nunca ganha `lado`
    // (só `tipo:"jogador"`) — o comentário antigo prometia "jogador" como alvo
    // possível aqui, mas isso nunca foi alcançável pelo código.
    const inimigosVivos = camp.combate?.ativo ? camp.combate.ordem.filter((x) => (x.tipo === "inimigo" || x.lado === "inimiga") && !foraDeCombate(x)) : [];
    if (acao.danoNave && inimigosVivos.length && camp.nave) {
      const atkNave = await ataqueDaNave(camp.nave, acao.n);
      if (!atkNave) return;   // cancelou a escolha de arma — não gasta a vez
      if (municaoDe(camp.nave, atkNave) <= 0) return alert(`${atkNave.n} está sem munição. Use "Recarregar" antes de disparar de novo.`);
      // Arma explosiva (área/raio declarado no catálogo, ex. mísseis/torpedos):
      // escolhe um epicentro entre os inimigos com posição no campo tático — igual
      // ao seletor de área que ataques de jogador/scripts já usam — e todo mundo
      // dentro do raio (só do lado inimigo; fogo amigo nunca é risco aqui) sofre o
      // mesmo tipo de resolução, um d20 por alvo (o do epicentro reaproveita a
      // rolagem original, os demais rolam fresco contra a própria Defesa).
      const comPos = inimigosVivos.filter((x) => x.pos);
      if (atkNave.area && atkNave.raio && comPos.length) {
        const rA = await modalForm({ titulo: `⚔ ${acao.n} — centro do impacto`,
          descricao: `${atkNave.n} explode num raio de ${atkNave.raio} m ao redor de quem você escolher.`,
          campos: [{ k: "epi", label: "Centro do impacto", tipo: "select",
            opcoes: comPos.map((x) => {
              const pegos = comPos.filter((y) => (distCombate(x, y) ?? 99) <= atkNave.raio).length;
              return { v: x.id, l: `${ehNave(x) ? "🚀 " : ""}${x.nome} — pega ${pegos} alvo${pegos === 1 ? "" : "s"}` };
            }) }], okLabel: "Disparar" });
        if (!rA?.epi) return;   // cancelou — não gasta a vez
        const epi = comPos.find((x) => x.id === rA.epi);
        snapshot(`${acao.n} em área contra ${epi.nome}`);
        descontarMunicao(camp.nave, atkNave);
        let natUsado = nat, totalUsado = total, marcasBase = [];
        if (nt.alinhado) { const n2 = d(20); if (n2 > nat) { natUsado = n2; totalUsado = n2 + mod; }
          marcasBase.push(`🎯 Vantagem por alinhamento [${nat}/${n2}]`); nt.alinhado = false; mexeuNaTatica = true; }
        const alvosArea = comPos.filter((x) => (distCombate(epi, x) ?? 99) <= atkNave.raio);
        const linhas = [];
        for (const alvoX of alvosArea) {
          const primario = alvoX.id === epi.id;
          const natX = primario ? natUsado : d(20);
          const totX = primario ? totalUsado : natX + mod;
          const defX = ehNave(alvoX) ? defesaNave(alvoX) : (alvoX.cd ?? 10);
          if (natX === 1 || totX < defX) { linhas.push(`${alvoX.nome}: errou (Def ${defX})`); continue; }
          const pdn = parseDice(atkNave.dano || "1d6");
          const dd = rollNd(pdn.n, pdn.f);
          let bruto = danoCritico(dd.reduce((x2, y2) => x2 + y2, 0), pdn.mod, natX === 20 ? 2 : 1);
          if (nt.fraqueza && primario) { const bonus = d(6); bruto += bonus; linhas.push(`🔎 fraqueza +${bonus}`); nt.fraqueza = false; mexeuNaTatica = true; }
          if (ehNave(alvoX)) {
            const r2 = danoNave(alvoX, bruto);
            if ((natX === 20 || r2.critico) && r2.casco > 0) { const av = rolarAvaria(); (camp.combate.avarias = camp.combate.avarias || []).push(av); linhas.push(`⚠ ${alvoX.nome}: ${av.n}`); }
            linhas.push(`🚀 ${alvoX.nome}: escudos −${r2.escudos}, casco −${r2.casco}${alvoX.casco <= 0 ? " 💥 ABATIDA!" : ""}`);
            if (comDesv && primario && r2.casco > 0) { const t4 = d(4); aplicarCond(alvoX, "Subsistema off", t4); linhas.push(`🎯 subsistema de ${alvoX.nome} desativado por ${t4}t`); }
          } else {
            const rd = await aplicarDanoAlvo(alvoX, bruto, "físico");
            linhas.push(`${alvoX.nome}: ${rd.msg}${alvoX.hp <= 0 ? " 💀 CAIU!" : ""}`);
          }
        }
        extra = `${atkNave.n} [${atkNave.dano}] explode num raio de ${atkNave.raio} m em torno de ${epi.nome}${marcasBase.length ? "  ·  " + marcasBase.join(" · ") : ""}: ${linhas.join("  ·  ")}`;
        camp.combate.agiram = [...new Set([...(camp.combate.agiram || []), meuPosto])];
        await salvarCamp({ combate: camp.combate, nave: camp.nave }, "salvar a ação do posto");
        if (mexeuNaTatica) await salvarCamp({ combate: camp.combate }, "salvar o estado tático");
        enviar("rolagem", null, { titulo: `${ESTACOES[meuPosto].n} — ${acao.n}`, detalhe: `d20 [${nat}] ${sign(mod)} (${at}+${pn})`, total, crit: nat === 20, fumble: nat === 1, extra });
        return render();
      }
      // Sempre pergunta o alvo, mesmo com um só candidato — antes pulava a
      // pergunta com 1 inimigo em campo (o caso mais comum) e parecia que a nave
      // "atirava sozinha", sem opção nenhuma de mirar.
      const r0 = await modalForm({ titulo: `⚔ ${acao.n} — escolher alvo`, campos: [
        { k: "alvo", label: "Alvo", tipo: "select", opcoes: inimigosVivos.map((x) => ({ v: x.id, l: `${ehNave(x) ? "🚀 " : ""}${x.nome} — ${vidaAtual(x)}/${vidaMax(x)}${ehNave(x) ? "" : ` PV, Def ${x.cd ?? 10}`}` })) }], okLabel: "Disparar" });
      const alvoObj = r0?.alvo ? inimigosVivos.find((x) => x.id === r0.alvo) : null;
      if (!alvoObj) return;   // fechou o seletor sem escolher — não gasta a vez
      snapshot(`${acao.n} contra ${alvoObj.nome}`);
      descontarMunicao(camp.nave, atkNave);
      const def = ehNave(alvoObj) ? defesaNave(alvoObj) : (alvoObj.cd ?? 10);
      // Alinhamento de Rota concede Vantagem: rola um segundo d20 e fica com o melhor
      let natUsado = nat, totalUsado = total, marcas = [];
      if (nt.alinhado) { const n2 = d(20); if (n2 > nat) { natUsado = n2; totalUsado = n2 + mod; }
        marcas.push(`🎯 Vantagem por alinhamento [${nat}/${n2}]`); nt.alinhado = false; mexeuNaTatica = true; }
      if (totalUsado >= def && natUsado !== 1) {
        const pdn = parseDice(atkNave.dano || "1d6");
        // Crítico: soma dados + bônus primeiro, só depois multiplica por 2 — não dobra
        // a quantidade de dados rolados (já foi bug real em 3 outros lugares de nave).
        const dd = rollNd(pdn.n, pdn.f);
        let bruto = danoCritico(dd.reduce((x2, y2) => x2 + y2, 0), pdn.mod, natUsado === 20 ? 2 : 1);
        if (nt.fraqueza) { const bonus = d(6); bruto += bonus; marcas.push(`🔎 fraqueza +${bonus}`); nt.fraqueza = false; mexeuNaTatica = true; }
        if (ehNave(alvoObj)) {
          const r2 = danoNave(alvoObj, bruto);
          extra = `Acertou (Def ${def})! ${atkNave.n} ${atkNave.dano}${natUsado === 20 ? " ×2" : ""} [${dd.join(", ")}] → escudos −${r2.escudos}, casco −${r2.casco}. ${alvoObj.nome}: ${alvoObj.casco}/${alvoObj.casco_max}`;
          // Tiro de Precisão: dano no casco desativa um subsistema por 1d4 turnos.
          if (comDesv && r2.casco > 0) { const t4 = d(4);
            aplicarCond(alvoObj, "Subsistema off", t4);
            marcas.push(`🎯 subsistema de ${alvoObj.nome} desativado por ${t4} turno(s)`); }
          if (alvoObj.casco <= 0) extra += "  💥 NAVE ABATIDA!";
        } else {
          const rd = await aplicarDanoAlvo(alvoObj, bruto, "físico");
          extra = `Acertou (Def ${def})! ${atkNave.n} ${atkNave.dano}${natUsado === 20 ? " ×2" : ""} [${dd.join(", ")}] → ${rd.msg}${alvoObj.hp <= 0 ? "  💀 CAIU!" : ""}`;
        }
        if (marcas.length) extra += `  ·  ${marcas.join(" · ")}`;
      } else extra = `Errou — Defesa ${def} da ${alvoObj.nome}.${marcas.length ? "  ·  " + marcas.join(" · ") : ""}`;
      camp.combate.agiram = [...new Set([...(camp.combate.agiram || []), meuPosto])];
      await salvarCamp({ combate: camp.combate, nave: camp.nave }, "salvar a ação do posto");
    } else if (camp.combate?.ativo) {
      camp.combate.agiram = [...new Set([...(camp.combate.agiram || []), meuPosto])];
      await salvarCamp({ combate: camp.combate }, "salvar a ação do posto");
    }
    if (mexeuNaTatica) await salvarCamp({ combate: camp.combate }, "salvar o estado tático");
    enviar("rolagem", null, { titulo: `${ESTACOES[meuPosto].n} — ${acao.n}`, detalhe: `d20 [${nat}] ${sign(mod)} (${at}+${pn})`, total, crit: nat === 20, fumble: nat === 1, extra });
    // Sem isto, um tiro de Artilharia que acerta muda casco/escudos/HP em memória
    // mas a tela só refletia no próximo render() — que só rodava se `mexeuNaTatica`
    // (Manobra Evasiva/Alinhamento/Guerra Eletrônica) tivesse disparado; um tiro
    // "normal" deixava o dano visível só depois de um F5. render() sempre no fim.
    render();
  });
}
