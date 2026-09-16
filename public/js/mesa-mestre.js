// ============================================================================
//  MESTRE — painel "🎛 Tela do Mestre" (overlay de telaMesa), extraído de
//  app.js. Uso: import { abrirMestre } from "./mesa-mestre.js";
//  await abrirMestre(ctx); — ctx vem de telaMesa (ver CLAUDE.md, seção do
//  objeto ctx da modularização).
//
//  Corpo da função copiado tal e qual de app.js — só os identificadores
//  livres viraram imports (nomeados igual, pra não arriscar nada na
//  tradução), mesmo padrão de biblioteca.js/admin.js. `fazerBackup`/
//  `restaurarBackup` vieram junto pra cá porque só eram usados aqui.
// ============================================================================
import { KEYWORDS, ARMAS, ARMADURAS, CONSUMIVEIS, IMPLANTES, NAVES, TIPOS_PENTE } from "./dados-jogo.js";
import { NIVEIS_AMEACA } from "./dados-bestiario.js";
import { FACCOES, NIVEIS_REPUTACAO, TABELAS, REFERENCIA } from "./dados-mestre.js";
import { d, CONDICOES } from "./regras.js";
import { modalForm, confirmModal } from "./ui.js";
import { sb, esc, combateVazio, rolarTabela, orcamentoEncontro, sugerirEncontro, PESO_AMEACA } from "./app.js";

export async function abrirMestre(ctx) {
  const { id, camp, pers, enviar, salvarCamp, render } = ctx;

  const fazerBackup = async () => {
    const [{ data: msgs2desc }, { data: membros2 }, { data: pers2 }] = await Promise.all([
      // desc + reverse: sem isso, campanhas com mais de 5000 mensagens perdem as mais recentes no backup.
      sb.from("mensagens").select("*").eq("campanha_id", id).order("criado_em", { ascending: false }).limit(5000),
      sb.from("campanha_membros").select("*").eq("campanha_id", id),
      sb.from("personagens").select("*").eq("campanha_id", id),
    ]);
    const msgs2 = msgs2desc ? [...msgs2desc].reverse() : msgs2desc;
    const backup = { formato: "passagem-sombria/campanha", versao: 1, exportado_em: new Date().toISOString(),
      campanha: { nome: camp.nome, codigo: camp.codigo, nave: camp.nave, mapa: camp.mapa, combate: camp.combate, bestiario: camp.bestiario },
      membros: membros2 || [], personagens: pers2 || [], mensagens: msgs2 || [] };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a2 = document.createElement("a");
    a2.href = url; a2.download = `campanha-${(camp.nome || "mesa").replace(/[^\w-]/g, "_")}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a2); a2.click(); a2.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
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
      const campos = { nave: c.nave ?? camp.nave, mapa: c.mapa ?? {}, combate: c.combate ?? combateVazio(), bestiario: c.bestiario ?? [] };
      if (!(await salvarCamp(campos, "restaurar o backup"))) return;
      Object.assign(camp, campos);
      await enviar("sistema", "♻ O Mestre restaurou o estado da campanha a partir de um backup.");
      render();
    };
    inp.click();
  };

  if (!camp.faccoes || typeof camp.faccoes !== "object") camp.faccoes = {};
  if (!Array.isArray(camp.contratos)) camp.contratos = [];
  const { data: nota } = await sb.from("mestre_notas").select("texto").eq("campanha_id", id).maybeSingle();
  let notaTxt = nota?.texto || "";
  const ov = document.createElement("div"); ov.className = "ss-overlay ov-modal"; ov.style.zIndex = "10000";
  const abas = [["mesa", "🎬 Mesa"], ["ref", "📖 Referência"], ["tab", "🎲 Tabelas"], ["enc", "⚖ Encontros"], ["fac", "🏛 Facções"], ["con", "📋 Contratos"], ["lin", "🕰 Linha do tempo"], ["not", "📝 Anotações"]];
  let abaAtiva = "mesa";

  const painelMesa = () => `
    <div class="det grande"><b>☾ Descansos</b>
      <p class="regra">Convoca um descanso para toda a mesa. Cada jogador conectado com personagem vinculado recupera na própria ficha.</p>
      <div class="filtros"><button id="mestre-curto" class="mini">☾ Curto (1h)</button><button id="mestre-longo" class="mini eq">🌙 Longo (8h)</button><button id="mestre-sessao" class="mini" title="Reinicia as habilidades que são 1×/sessão (Mapa Mental, Charme Malandro, Cláusula de Contingência)">📅 Nova sessão</button></div></div>
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
    + (camp.contratos.length ? camp.contratos.map((c, i) => { const itens = c.recompensaItens || [];
        return `<div class="det grande" style="border-left:3px solid ${c.status === "concluido" ? "var(--tech)" : c.status === "aceito" ? "var(--chrome)" : "var(--line)"}">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${esc(c.titulo)}</b><span class="best-tag">${esc(c.status)}</span></div>
        <p>${esc(c.desc)}</p>
        <p class="regra"><b class="chrome">Recompensa:</b> ${esc(c.recompensa)}${c.recompensaCg ? ` · ${c.recompensaCg} CG` : ""}${c.recompensaXp ? ` · ${c.recompensaXp} XP` : ""}${c.faccao ? ` · <b>Contratante:</b> ${esc(c.faccao)}` : ""}</p>
        ${itens.length ? `<p class="regra">${itens.map((it, j) => `<span class="pente-tipo" style="margin:2px">${{arma:"⚔",armadura:"🛡",implante:"⧉",consumivel:"🎒",nave:"🚀"}[it.tipo] || "🎁"} ${esc(it.nome)}${it.qtd > 1 ? ` ×${it.qtd}` : ""} <a href="javascript:void 0" data-con-item-del="${i}:${j}" title="Remover">✕</a></span>`).join(" ")}</p>` : ""}
        <div class="filtros"><button class="mini" data-con-st="${i}" data-st="aberto">Aberto</button><button class="mini" data-con-st="${i}" data-st="aceito">Aceito</button>
          <button class="mini" data-con-st="${i}" data-st="concluido">Concluído</button>
          <button class="mini" data-con-item="${i}" title="Adicionar item/arma/armadura/nave declarado como recompensa deste contrato">➕ Item</button>
          ${(c.recompensaCg || c.recompensaXp || itens.length) ? `<button class="mini eq" data-con-entregar="${i}" title="Distribui CG/XP/itens declarados a toda a tripulação conectada">🎁 Entregar</button>` : ""}
          <button class="mini rm" data-con-del="${i}">✕</button></div></div>`; }).join("")
      : `<p class="regra">Nenhum contrato publicado. Os que você publicar aparecem para a tripulação na mesa.</p>`);

  let linCache = null;
  const painelLin = () => {
    if (!linCache) { setTimeout(async () => {
      // desc + reverse: sem isso, campanhas com mais de 3000 mensagens perdem os marcos mais recentes da linha do tempo.
      const { data: tudoDesc } = await sb.from("mensagens").select("tipo,conteudo,payload,criado_em,perfis:autor_id(apelido)")
        .eq("campanha_id", id).order("criado_em", { ascending: false }).limit(3000);
      const tudo = tudoDesc ? [...tudoDesc].reverse() : tudoDesc;
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
    liga("mestre-sessao", async () => {
      if (!(await confirmModal("Abrir uma nova sessão? Reinicia as habilidades que são 1×/sessão de todos os jogadores conectados.", { okLabel: "Abrir sessão" }))) return;
      await enviar("descanso", "📅 Nova sessão. As habilidades de 1×/sessão voltam a ficar disponíveis.", { tipo: "sessao" });
      fechar();
    });
    liga("mestre-longo", async () => {
      if (!(await confirmModal("Convocar Descanso Longo para toda a mesa? PV restaurados, RAM recarregada, pentes repostos e todas as habilidades reiniciadas. A tripulação também aproveita para mexer no casco.", { okLabel: "Convocar" }))) return;
      await enviar("descanso", "O Mestre convocou um Descanso Longo (8h). PV restaurados, RAM recarregada e todas as habilidades reiniciadas.", { tipo: "longo" });
      if (camp.nave && camp.nave.casco < camp.nave.casco_max) {   // 8h dão tempo de remendar o casco
        const rep = d(10) + 5;
        camp.nave.casco = Math.min(camp.nave.casco_max, camp.nave.casco + rep);
        camp.nave.escudos = camp.nave.escudos_max;
        const cbn3 = camp.combate?.ordem?.find((x) => x.nave_party);
        if (cbn3) { cbn3.casco = camp.nave.casco; cbn3.escudos = camp.nave.escudos; }
        await salvarCamp({ nave: camp.nave, ...(camp.combate ? { combate: camp.combate } : {}) }, "salvar a manutenção da nave");
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
        descricao: "Munição de saque. Vai para a reserva de cada tripulante conectado, respeitando o teto de cada um (4 + mod de Força).",
        campos: [
          { k: "tipo", label: "Tipo de munição", tipo: "select", opcoes: Object.entries(TIPOS_PENTE).map(([k2, t2]) => ({ v: k2, l: `${t2.ic} ${t2.n} — ${t2.d}` })) },
          { k: "n", label: "Quantos pentes", tipo: "numero", valor: 1, min: 1, max: 10 },
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
        { k: "recompensa", label: "Recompensa (texto, aparece pra tripulação)", tipo: "texto", valor: "1000 CG" },
        { k: "cg", label: "CG estruturado (opcional — some ao clicar 🎁 Entregar depois)", tipo: "numero", valor: 0, min: 0 },
        { k: "xp", label: "XP estruturado (opcional)", tipo: "numero", valor: 0, min: 0 },
        { k: "faccao", label: "Contratante", tipo: "select", opcoes: ["—", ...FACCOES.map((f) => f.n)] },
      ], okLabel: "Publicar" });
      if (!r || !r.titulo) return;
      camp.contratos.push({ id: "k" + Math.random().toString(36).slice(2, 8), titulo: r.titulo, desc: r.desc || "", recompensa: r.recompensa || "",
        recompensaCg: +r.cg || 0, recompensaXp: +r.xp || 0, recompensaItens: [],
        faccao: r.faccao === "—" ? "" : r.faccao, status: "aberto" });
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
    // Item/arma/armadura/nave declarado como recompensa de um contrato — igual
    // ao seletor de "🎁 Conceder equipamento" (mestre-loot), só que fica
    // guardado no contrato até o Mestre clicar em "Entregar".
    ov.querySelectorAll("[data-con-item]").forEach((b) => b.onclick = async () => {
      const c = camp.contratos[+b.dataset.conItem]; if (!c) return;
      const cats = [
        ["arma", "⚔ Arma", ARMAS.filter((x) => x.preco || x.nano)],
        ["armadura", "🛡 Armadura", ARMADURAS],
        ["item", "🎒 Consumível", CONSUMIVEIS.map((c2) => ({ n: c2.n, preco: c2.p }))],
        ["implante", "⧉ Implante", IMPLANTES.map((i2) => ({ n: i2.n, preco: i2.p }))],
        ["nave", "🚀 Nave (substitui a nave da party ao entregar)", NAVES.map((n2) => ({ n: n2.n }))],
      ];
      const r = await modalForm({ titulo: "🎁 Item de recompensa",
        descricao: "Fica guardado no contrato — só vai para a tripulação quando você clicar em \"🎁 Entregar\".",
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
            opcoes: filtrada.slice(0, 60).map((x) => ({ v: x.n, l: `${x.n}${x.preco ? ` — ${x.preco} CG` : ""}` })) }], okLabel: "Adicionar" });
        if (!r2?.n) return; nome = r2.n;
      }
      (c.recompensaItens = c.recompensaItens || []).push({ tipo: r.cat === "item" ? "item" : r.cat, nome, qtd: Math.max(1, +r.qtd || 1) });
      await salvarCamp({ contratos: camp.contratos }); pintar();
    });
    ov.querySelectorAll("[data-con-item-del]").forEach((b) => b.onclick = async () => {
      const [ci, cj] = b.dataset.conItemDel.split(":").map(Number);
      const c = camp.contratos[ci]; if (!c?.recompensaItens) return;
      c.recompensaItens.splice(cj, 1);
      await salvarCamp({ contratos: camp.contratos }); pintar();
    });
    // Entrega tudo que o contrato declara: CG/XP estruturados (via o mesmo
    // canal "recompensa" que mestre-xp/mestre-cg usam — cada cliente conectado
    // aplica na própria ficha ao ouvir a mensagem) e cada item/arma/armadura
    // (via o payload "loot", igual mestre-loot). Nave é diferente: não há
    // inventário de naves por jogador, então ou vira a nave da party (se ainda
    // não tem) ou pede confirmação pra substituir a que já existe.
    ov.querySelectorAll("[data-con-entregar]").forEach((b) => b.onclick = async () => {
      const c = camp.contratos[+b.dataset.conEntregar]; if (!c) return;
      if (!(await confirmModal(`Entregar as recompensas de "${c.titulo}" a toda a tripulação conectada?`, { okLabel: "Entregar" }))) return;
      if (c.recompensaCg || c.recompensaXp) {
        await enviar("recompensa", `O Mestre entregou a recompensa de "${c.titulo}"${c.recompensaXp ? ` (${c.recompensaXp} XP)` : ""}${c.recompensaCg ? ` (${c.recompensaCg} CG)` : ""} à tripulação.`,
          { ...(c.recompensaXp ? { xp: c.recompensaXp } : {}), ...(c.recompensaCg ? { creditos: c.recompensaCg } : {}) });
      }
      for (const it of c.recompensaItens || []) {
        if (it.tipo === "nave") {
          const base = NAVES.find((n2) => n2.n === it.nome); if (!base) continue;
          if (camp.nave && !(await confirmModal(`A party já tem a nave "${camp.nave.nome_batismo || camp.nave.modelo}". Substituir por "${it.nome}" (recompensa do contrato)?`, { okLabel: "Substituir", perigo: true }))) continue;
          camp.nave = { modelo: base.n, nome_batismo: base.n, casco: base.casco, casco_max: base.casco, escudos: base.escudos, escudos_max: base.escudos, manobra: base.manobra, dano: base.dano, ataques: base.ataques || [] };
          await salvarCamp({ nave: camp.nave }, "salvar a nave de recompensa");
          await enviar("sistema", `🚀 Recompensa de "${c.titulo}": a party recebe a nave ${it.nome}.`);
          continue;
        }
        await enviar("recompensa", `O Mestre entregou ${it.qtd > 1 ? `${it.qtd}× ` : ""}${it.nome} (recompensa de "${c.titulo}") à tripulação.`,
          { loot: { nome: it.nome, tipo: it.tipo, qtd: it.qtd } });
      }
      pintar();
    });
    // anotações
    ov.querySelector("#not-salvar") && (ov.querySelector("#not-salvar").onclick = async () => {
      notaTxt = ov.querySelector("#not-txt").value;
      const { error } = await sb.from("mestre_notas").upsert({ campanha_id: id, texto: notaTxt, atualizado_em: new Date().toISOString() });
      ov.querySelector("#not-st").textContent = error ? "erro: " + error.message : "salvo ✓";
    });
  };
  // Esc precisa ir no document, não no ov: um <div> sem tabindex nunca recebe
  // foco sozinho, então um keydown ligado nele só dispara se algum campo dentro
  // do painel já estiver focado — na prática, quase nunca. Era bug real: Esc
  // não fechava o painel do Mestre (nem os overlays irmãos que usam o mesmo
  // padrão em app.js — bancada, inspetor, diário, estatísticas — mas aqui só
  // corrigimos este, que é o que foi extraído).
  const onEsc = (e) => { if (e.key === "Escape") fechar(); };
  const fechar = () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onEsc); ov.remove(); };
  document.body.appendChild(ov); document.body.style.overflow = "hidden";
  pintar();
  document.addEventListener("keydown", onEsc);
}
