// ============================================================================
//  PAINEL DE ADMINISTRAÇÃO — conteúdo global, editável sem mexer no código.
//  Extraído de app.js (era a última função do arquivo, ~690 linhas) pra reduzir
//  o monólito. Import dinâmico a partir de biblioteca.js, quando um admin clica
//  em "🛠 Administrar conteúdo" — só quem precisa paga o custo de carregar isto.
//
//  Corpo copiado tal e qual de app.js — só os identificadores livres viraram
//  imports (nomeados igual, pra não arriscar nada na tradução).
// ============================================================================
import {
  RACAS, CLASSES, ARMAS, ARMADURAS, IMPLANTES, CONSUMIVEIS, NAVES,
  PALAVRAS_CHAVE, KEYWORDS, PERICIAS,
} from "./dados-jogo.js";
import { BESTIARIO, NIVEIS_AMEACA } from "./dados-bestiario.js";
import { NPCS, PAPEIS } from "./dados-npcs.js";
import { CONDICOES, TIPOS_DANO, novaFichaDados, calc } from "./regras.js";
import { validarEfeitos } from "./efeitos.js";
import { modalForm, confirmModal } from "./ui.js";
import {
  sb, esc, usuario, criaturaMod, conteudoMod, sincronizarExtra,
  gerarFichaHTML, imprimirFichaHTML,
} from "./app.js";

// Campo "imune a" reutilizado no editor de criatura E no editor genérico de item —
// antes era texto livre, então um typo ("fisico" sem acento, "Cegueira" em vez de
// "Cego") deixava a imunidade sem efeito nenhum, em silêncio. Lista fechada (tipo de dano +
// condição do sistema) cobre o caso comum; "Outro" libera texto pra imunidades
// narrativas que não têm lista (surpresa, terreno difícil, queda…).
const OUTRO_IMUNE = "__outro__";
const opcoesImuneA = (valorAtual) => {
  const conhecido = TIPOS_DANO.includes(valorAtual) || CONDICOES.includes(valorAtual);
  return `<option value="">— escolha —</option>
    <optgroup label="Tipo de dano">${TIPOS_DANO.map((t) => `<option value="${t}" ${valorAtual === t ? "selected" : ""}>${t}</option>`).join("")}</optgroup>
    <optgroup label="Condição">${CONDICOES.map((cnd) => `<option value="${cnd}" ${valorAtual === cnd ? "selected" : ""}>${cnd}</option>`).join("")}</optgroup>
    <option value="${OUTRO_IMUNE}" ${valorAtual && !conhecido ? "selected" : ""}>Outro (descrever)…</option>`;
};
// As 3 únicas strings que aurasSobre()/auraNega() realmente reconhecem em `nega` —
// era texto livre separado por vírgula; escrever "Cura" com maiúscula ou "scripts" em
// vez de "tecnomancia" gravava uma zona que não anulava nada, sem nenhum aviso.
const OPCOES_NEGA = [
  { v: "tecnomancia", l: "Tecnomancia (Scripts)" },
  { v: "cura", l: "Cura" },
  { v: "implantes", l: "Implantes" },
];

export async function painelAdmin(voltarPara = "racas") {
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
      { v: "adaptar", l: "🧬 Adapta-se ao tipo de dano" },
    ];

    const ov2 = document.createElement("div"); ov2.className = "ss-overlay ov-modal"; ov2.style.zIndex = "10010";
    const fechar2 = () => ov2.remove();

    const camposEfeito = (e) => {
      if (!e || !e.tipo) return "";
      if (e.tipo === "dano") return `<label>Dado de dano<input data-ef="dano" value="${esc(e.dano || "1d6")}" placeholder="1d6"/></label>
        <label>Em quem<select data-ef="alvo">${[["atacante", "quem a atingiu"], ["alvo", "no alvo dela"], ["todos_proximos", "todos por perto"]].map(([v, l]) => `<option value="${v}" ${e.alvo === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label>Tipo de dano<select data-ef="tipoDano">
          <option value="" ${!e.tipoDano ? "selected" : ""}>mesmo da arma/ataque</option>
          ${TIPOS_DANO.map((t) => `<option value="${t}" ${e.tipoDano === t ? "selected" : ""}>${t}</option>`).join("")}
        </select></label>`;
      if (e.tipo === "cura") return `<label>PV fixos<input data-ef="valor" type="number" value="${e.valor ?? 0}"/></label>
        <label>ou dado<input data-ef="dado" value="${esc(e.dado || "")}" placeholder="1d6"/></label>`;
      if (e.tipo === "condicao") return `<label>Condição<select data-ef="cond">${CONDICOES.map((x) => `<option ${e.cond === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>
        <label>Turnos<input data-ef="turnos" type="number" value="${e.turnos ?? 1}" min="1"/></label>
        <label>CD para evitar<input data-ef="cd" type="number" value="${e.cd ?? ""}" placeholder="vazio = automático"/></label>`;
      if (e.tipo === "invocar") return `<label>Criatura invocada<input data-ef="criatura" value="${esc(e.criatura || "")}" placeholder="Enxame Adaptativo"/></label>
        <label>Quantidade (dado)<input data-ef="dado" value="${esc(e.dado || "1d4")}"/></label>`;
      if (e.tipo === "imunidade") {
        // Some se e.a for vazio (nada escolhido ainda) OU já for um valor reconhecido;
        // aparece quando é a sentinela "Outro" (mostra vazio pra digitar) ou um texto
        // livre antigo que não bate com nada da lista (fichas de antes desta UI).
        const ehSentinela = e.a === OUTRO_IMUNE;
        const precisaDescrever = e.a && !TIPOS_DANO.includes(e.a) && !CONDICOES.includes(e.a);
        return `<label>Imune a<select data-ef-imune="1">${opcoesImuneA(e.a)}</select></label>
        ${precisaDescrever ? `<label>Descreva<input data-ef="a" value="${esc(ehSentinela ? "" : e.a)}" placeholder="surpresa, terreno difícil, queda…"/></label>` : ""}
        <label>Ignora dano abaixo de<input data-ef="limiar" type="number" value="${e.limiar ?? ""}" placeholder="ex: 10"/></label>`; }
      if (e.tipo === "zona") return `<label>Raio (m)<input data-ef="raio" type="number" value="${e.raio ?? 15}"/></label>
        <div class="kw-campo"><label style="margin-bottom:4px">Anula</label>
          <div class="filtros">${OPCOES_NEGA.map((op) => `<label class="chk"><input type="checkbox" data-ef-nega="${op.v}" ${(e.nega || []).includes(op.v) ? "checked" : ""}/> ${op.l}</label>`).join("")}</div></div>`;
      if (e.tipo === "adaptar") return `<label>Resistência ganha<input data-ef="valor" type="number" value="${e.valor ?? 3}" min="1"/></label>
        <p class="regra">Ao sofrer um tipo de dano pela primeira vez, todas as linhas desta criatura no rastreador passam a abater esse valor daquele tipo, pelo resto do combate.</p>`;
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
          if (v === undefined || v === "") delete h.efeito[campo]; else h.efeito[campo] = v;
          const dica = ov2.querySelector(".cri-dica");
          if (dica) dica.textContent = `${c.habs.filter((x) => x.efeito).length} habilidade(s) automática(s)`;
        });
        // "Imune a": escolher no select repinta (pode precisar mostrar/esconder o
        // campo "Descreva"). Escolher "Outro" grava a sentinela mesmo — é ela que faz
        // o campo de texto aparecer vazio; digitar ali sobrescreve com o texto real.
        box.querySelectorAll("[data-ef-imune]").forEach((el) => el.onchange = () => {
          h.efeito.a = el.value; pintar2();
        });
        // "Anula": um checkbox por valor reconhecido, junta os marcados num array.
        box.querySelectorAll("[data-ef-nega]").forEach((el) => el.onchange = () => {
          const atual = new Set(h.efeito.nega || []);
          if (el.checked) atual.add(el.dataset.efNega); else atual.delete(el.dataset.efNega);
          h.efeito.nega = [...atual];
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
    { v: "sem_critico", l: "🛡 Nega dano crítico (armadura anticrítica)" },
    { v: "pv_max", l: "❤ Concede PV máximo extra" },
    { v: "escudo_max", l: "🛡 Concede Escudo (absorve o golpe inteiro enquanto durar)" },
    { v: "resistencia", l: "◐ Concede Resistência (mais fraca que imunidade — Vantagem no teste)" },
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
      case "imunidade": {
        const ehSentinela = e.a === OUTRO_IMUNE;
        const precisaDescrever = e.a && !TIPOS_DANO.includes(e.a) && !CONDICOES.includes(e.a);
        return `<label>Imune a<select data-ef="${i}" data-c="a">${opcoesImuneA(e.a)}</select></label>` +
          (precisaDescrever ? txt("a", "Descreva", ehSentinela ? "" : e.a, "queda, ser derrubado, terreno difícil…") : ""); }
      case "recurso": return txt("n", "Nome", e.n, "Fôlego de Aço") + sel("freq", "Recarrega em", e.freq || "longo", [{ v: "curto", l: "descanso curto" }, { v: "longo", l: "descanso longo" }, { v: "sessao", l: "por sessão" }]);
      case "sem_critico": return `<p class="regra">Sem campo nenhum pra preencher — quem usar isto equipado nunca sofre o ×2 (ou ×4) de um golpe crítico contra si. Outros multiplicadores (furtivo do Assassino) continuam valendo, só o "é crítico" em si é anulado.</p>`;
      case "pv_max": return num("valor", "PV máximo extra", e.valor, "ex: 5") + `<p class="regra">Só conta enquanto a fonte estiver ativa (equipada/instalada) — remover o item encolhe o PV máximo de novo.</p>`;
      case "escudo_max": return num("valor", "Escudo extra", e.valor, "ex: 10") + `<p class="regra">Diferente de PV Temporário: enquanto tiver QUALQUER carga, absorve a instância de dano INTEIRA, mesmo que estoure e zere o escudo — o excesso não passa. Recarrega em qualquer descanso.</p>`;
      case "resistencia": {
        const ehSentinela = e.a === OUTRO_IMUNE;
        const precisaDescrever = e.a && !TIPOS_DANO.includes(e.a) && !CONDICOES.includes(e.a);
        return `<label>Resistente a<select data-ef="${i}" data-c="a">${opcoesImuneA(e.a)}</select></label>` +
          (precisaDescrever ? txt("a", "Descreva", ehSentinela ? "" : e.a, "medo, radiação…") : "") +
          `<p class="regra">Mais fraco que imunidade: não anula nada, só dá Vantagem no teste de resistência (salvaguarda/CD) contra esse dano/condição.</p>`; }
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
        // Select de "Imune a": muda o que fica visível (some/aparece o campo
        // "Descreva"), por isso sempre repinta — ao contrário do campo de texto
        // que escreve na mesma chave `a`, que não deve perder o foco a cada tecla.
        // "Outro" grava a própria sentinela: é ela que faz o texto aparecer vazio.
        if (c === "a" && el.tagName === "SELECT") { e.a = v; return repintar(); }
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
      ["manobra", "Manobrabilidade", "numero"], ["dano", "Canhões (ataque padrão)", "texto", null, "4d10"],
      ["ataques", "Outros ataques (opcional)", "ataques"],
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
    if (tipo === "nave") it.ataques = it.ataques || [];
    const ov2 = document.createElement("div"); ov2.className = "ss-overlay ov-modal"; ov2.style.zIndex = "10010";
    const fechar2 = () => ov2.remove();
    const campo = ([k, lbl, t, ops, ph]) => {
      const v = it[k];
      if (t === "escala") {
        const esc2 = it.escala || {};
        const marcos = Object.keys(esc2).map(Number).sort((x, y) => x - y);
        return `<div class="kw-campo"><label style="margin-bottom:4px">${lbl}</label>
          <p class="regra">Deixe vazio para dano fixo. Preenchendo, a arma passa a subir de dado nos níveis indicados —
            é assim que funcionam as formas de Nano-Tatuagem do Cortex Central de Nano-Enxame, e qualquer arma pode ter isso.</p>
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
      if (t === "ataques") { const lista = it.ataques || [];
        return `<div class="kw-campo"><label style="margin-bottom:4px">${lbl} <button id="natk-add" class="mini" type="button">＋</button></label>
          <p class="regra">Além dos canhões padrão de cima, dá pra cadastrar outras armas da nave (torpedos, laser ponto-a-ponto…) — quem dispara escolhe qual usar na hora.</p>
          ${lista.length ? lista.map((a2, i2) => `<div class="ed-item">
            <div class="ed-grade">
              <label>Nome<input data-natk="${i2}" data-k="n" value="${esc(a2.n || "")}" placeholder="Torpedo de Plasma"/></label>
              <label>Bônus de acerto<input data-natk="${i2}" data-k="bonus" type="number" value="${a2.bonus ?? 4}"/></label>
              <label>Dano<input data-natk="${i2}" data-k="dano" value="${esc(a2.dano || "2d10")}"/></label>
            </div>
            <label>Observação<input data-natk="${i2}" data-k="extra" value="${esc(a2.extra || "")}" placeholder="alcance curto, gasta 1 carga…"/></label>
            <button class="mini rm" data-natk-del="${i2}" type="button">remover ataque</button></div>`).join("")
            : `<p class="regra"><i>Só os canhões padrão por enquanto.</i></p>`}</div>`;
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
          <div class="ed-grade">${esq.campos.filter((c) => !["area", "kwpick", "ataques"].includes(c[2])).map(campo).join("")}</div>
          ${esq.campos.filter((c) => c[2] === "kwpick").map(campo).join("")}
          ${esq.campos.filter((c) => c[2] === "ataques").map(campo).join("")}
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
            if (bt) bt.disabled = semNome || ((it.efeitos || []).length ? validarEfeitos(it.efeitos).length > 0 : false);
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
      ov2.querySelector("#natk-add")?.addEventListener("click", () => { it.ataques.push({ n: "", bonus: 4, dano: "2d10", extra: "" }); pintar2(); });
      ov2.querySelectorAll("[data-natk-del]").forEach((b) => b.onclick = () => { it.ataques.splice(+b.dataset.natkDel, 1); pintar2(); });
      ov2.querySelectorAll("[data-natk]").forEach((el) => el.oninput = () => {
        const a2 = it.ataques[+el.dataset.natk]; if (a2) a2[el.dataset.k] = el.dataset.k === "bonus" ? +el.value : el.value;
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
  // Reabre a Biblioteca (agora em biblioteca.js) na mesma aba — precisa re-renderizar
  // de verdade, não só voltar a #hash: o conteúdo editado no painel pode ter mudado.
  const fechar = async () => { document.body.style.overflow = ""; ov.remove(); const { telaBiblioteca } = await import("./biblioteca.js"); telaBiblioteca(voltarPara); };
  document.body.appendChild(ov); document.body.style.overflow = "hidden";
  pintar();
  ov.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });
}
