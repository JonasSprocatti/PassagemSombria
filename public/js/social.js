// ============================================================================
//  SOCIAL — amigos, chat geral, conversas privadas, perfil com estatísticas,
//  pedidos para entrar numa mesa e trechos de sessão compartilhados.
//
//  Import dinâmico a partir do roteador (#/social…, #/t/<token>), no mesmo
//  padrão de biblioteca.js/criacao.js. Depende das tabelas e funções de
//  supabase/social.sql — se a migração ainda não rodou, cada tela avisa isso
//  em vez de quebrar (ver `faltaMigracao`).
//
//  Privacidade (decisões do dono do projeto): estatísticas só para amigos;
//  chat geral é uma sala para todo usuário logado; trecho compartilhado é um
//  link público somente-leitura; espectador vê a mesa sem agir nela.
// ============================================================================
import { sb, esc, usuario, perfil, shell } from "./app.js";
import { modalForm, confirmModal } from "./ui.js";

const $ = (s) => document.querySelector(s);
let canalSocial = null;   // um canal Realtime por tela social aberta

const pararCanal = () => { if (canalSocial) { sb.removeChannel(canalSocial); canalSocial = null; } };
// Sair da tela social por qualquer hashchange fecha o canal — senão cada visita
// empilhava uma assinatura nova ouvindo o banco pra sempre.
const assinar = (nome, montar) => {
  pararCanal();
  canalSocial = montar(sb.channel(nome)).subscribe();
  window.addEventListener("hashchange", pararCanal, { once: true });
};

// Erro de "tabela/função não existe" = supabase/social.sql ainda não foi aplicado.
const faltaMigracao = (error) => !!error && /does not exist|not find|schema cache|PGRST20[0-9]|42P01|42883/i.test(`${error.code || ""} ${error.message || ""}`);
const avisoMigracao = `<section class="sec"><header><span class="tag">⚠</span><h2>Sistema social ainda não instalado</h2></header>
  <p class="regra">O banco ainda não tem as tabelas do sistema social. Quem administra o projeto precisa rodar
  <b>supabase/social.sql</b> no SQL Editor do Supabase (uma vez só).</p></section>`;

const avatar = (url, nome, cls = "") => url
  ? `<img class="soc-av ${cls}" src="${esc(url)}" alt=""/>`
  : `<span class="soc-av ${cls} soc-av-letra">${esc((nome || "?").trim().charAt(0).toUpperCase())}</span>`;
const hora = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const ABAS = [["amigos", "👥 Amigos"], ["geral", "🌐 Chat geral"], ["conversas", "✉ Conversas"], ["mesas", "🎲 Mesas"]];
const cabecalho = (aba) => `<div class="filtros soc-abas">${ABAS.map(([id, rot]) =>
  `<a class="mini ${aba === id ? "eq" : ""}" href="#/social/${id}">${rot}</a>`).join("")}</div>`;

// ---------------------------------------------------------------------------
//  Contador do menu (👥 Social N): conversas não lidas + pedidos de amizade
//  recebidos + pedidos pendentes nas minhas mesas. Falha em silêncio (0) se a
//  migração ainda não rodou — o menu nunca pode quebrar por causa disto.
// ---------------------------------------------------------------------------
export async function contarPendencias() {
  if (!usuario) return 0;
  try {
    const [a, b, c] = await Promise.all([
      sb.from("mensagens_diretas").select("id", { count: "exact", head: true }).eq("para", usuario.id).eq("lida", false),
      sb.from("amizades").select("id", { count: "exact", head: true }).eq("para", usuario.id).eq("status", "pendente"),
      sb.rpc("pedidos_para_mim"),
    ]);
    return (a.count || 0) + (b.count || 0) + (c.data?.length || 0);
  } catch { return 0; }
}

export async function telaSocial(aba = "amigos", arg = null) {
  if (aba === "perfil" && arg) return telaPerfil(arg);
  if (aba === "conversa" && arg) return telaConversa(arg);
  if (aba === "geral") return telaGeral();
  if (aba === "conversas") return telaConversas();
  if (aba === "mesas") return telaMesas();
  return telaAmigos();
}

// ---------------------------------------------------------------------------
//  AMIGOS — buscar, pedir, aceitar, recusar, desfazer
// ---------------------------------------------------------------------------
async function telaAmigos() {
  pararCanal();
  const { data: contatos, error } = await sb.rpc("meus_contatos");
  if (faltaMigracao(error)) return shell("social", cabecalho("amigos") + avisoMigracao, "social");
  const aceitos = (contatos || []).filter((c) => c.status === "aceita");
  const recebidos = (contatos || []).filter((c) => c.status === "pendente" && !c.enviei);
  const enviados = (contatos || []).filter((c) => c.status === "pendente" && c.enviei);
  shell("social", `${cabecalho("amigos")}
    <section class="sec"><header><span class="tag">🔎</span><h2>Adicionar amigo</h2></header>
      <div class="linha-add"><input id="soc-busca" placeholder="Apelido (mínimo 2 letras)" maxlength="40"/><button id="soc-buscar" class="btn-ghost">BUSCAR</button></div>
      <div id="soc-result"></div>
    </section>
    ${recebidos.length ? `<section class="sec"><header><span class="tag">📨</span><h2>Pedidos recebidos</h2></header>
      ${recebidos.map((c) => `<div class="det soc-linha">${avatar(c.avatar_url, c.apelido)}<b>${esc(c.apelido)}</b>
        <span class="soc-acoes"><button class="mini eq" data-aceitar="${c.amizade_id}">✔ Aceitar</button>
        <button class="mini rm" data-desfazer="${c.amizade_id}" data-rot="recusar o pedido de ${esc(c.apelido)}">✕ Recusar</button></span></div>`).join("")}
    </section>` : ""}
    <section class="sec"><header><span class="tag">👥</span><h2>Amigos</h2><span class="extra">${aceitos.length}</span></header>
      ${aceitos.map((c) => `<div class="det soc-linha">${avatar(c.avatar_url, c.apelido)}<b>${esc(c.apelido)}</b>
        <span class="soc-acoes"><a class="mini" href="#/social/perfil/${c.outro}">👤 Perfil</a>
        <a class="mini" href="#/social/conversa/${c.outro}">✉ Conversar</a>
        <button class="mini rm" data-desfazer="${c.amizade_id}" data-rot="desfazer a amizade com ${esc(c.apelido)}" title="Desfazer amizade">✕</button></span></div>`).join("")
        || `<p class="regra">Nenhum amigo ainda. Busque pelo apelido acima.</p>`}
    </section>
    ${enviados.length ? `<section class="sec"><header><span class="tag">⏳</span><h2>Aguardando resposta</h2></header>
      ${enviados.map((c) => `<div class="det soc-linha">${avatar(c.avatar_url, c.apelido)}<b>${esc(c.apelido)}</b>
        <span class="soc-acoes"><button class="mini rm" data-desfazer="${c.amizade_id}" data-rot="cancelar o pedido a ${esc(c.apelido)}">Cancelar</button></span></div>`).join("")}
    </section>` : ""}`, "social");

  const buscar = async () => {
    const termo = $("#soc-busca").value.trim();
    if (termo.length < 2) return;
    const { data } = await sb.rpc("buscar_perfis", { termo });
    const jaTem = new Set((contatos || []).map((c) => c.outro));
    $("#soc-result").innerHTML = (data || []).map((p) => `<div class="det soc-linha">${avatar(p.avatar_url, p.apelido)}<b>${esc(p.apelido)}</b>
      <span class="soc-acoes">${jaTem.has(p.id) ? `<span class="dim">já na sua lista</span>` : `<button class="mini eq" data-pedir="${p.id}">➕ Pedir amizade</button>`}</span></div>`).join("")
      || `<p class="regra">Ninguém com esse apelido.</p>`;
    document.querySelectorAll("[data-pedir]").forEach((b) => b.onclick = async () => {
      const { error: e2 } = await sb.from("amizades").insert({ de: usuario.id, para: b.dataset.pedir });
      if (e2) return alert(/duplicate|unique/i.test(e2.message) ? "Já existe um pedido ou amizade com essa pessoa." : `Não consegui enviar: ${e2.message}`);
      telaAmigos();
    });
  };
  $("#soc-buscar").onclick = buscar;
  $("#soc-busca").onkeydown = (e) => { if (e.key === "Enter") buscar(); };
  document.querySelectorAll("[data-aceitar]").forEach((b) => b.onclick = async () => {
    const { error: e2 } = await sb.from("amizades").update({ status: "aceita" }).eq("id", b.dataset.aceitar);
    if (e2) return alert(`Não consegui aceitar: ${e2.message}`);
    telaAmigos();
  });
  document.querySelectorAll("[data-desfazer]").forEach((b) => b.onclick = async () => {
    if (!(await confirmModal(`Tem certeza que quer ${b.dataset.rot}?`, { okLabel: "Confirmar", perigo: true }))) return;
    const { error: e2 } = await sb.from("amizades").delete().eq("id", b.dataset.desfazer);
    if (e2) return alert(`Não consegui: ${e2.message}`);
    telaAmigos();
  });
}

// ---------------------------------------------------------------------------
//  PERFIL DE UM AMIGO — estatísticas, personagens mais usados, pedir mesa
// ---------------------------------------------------------------------------
async function telaPerfil(uid) {
  pararCanal();
  const [{ data: st, error }, { data: mesas }] = await Promise.all([
    sb.rpc("perfil_social", { alvo: uid }),
    uid === usuario.id ? Promise.resolve({ data: [] }) : sb.rpc("mesas_do_amigo", { amigo: uid }),
  ]);
  if (faltaMigracao(error)) return shell("social", cabecalho("amigos") + avisoMigracao, "social");
  if (!st) return shell("social", `${cabecalho("amigos")}<section class="sec"><p class="regra">Esse perfil só abre para amigos.</p></section>`, "social");
  const pct = (n) => st.d20 ? `${Math.round(100 * n / st.d20)}%` : "—";
  const sorte = st.media_d20 == null ? "" : st.media_d20 >= 11.5 ? "🍀 acima da média (10,5)" : st.media_d20 <= 9.5 ? "🌧 abaixo da média (10,5)" : "⚖ na média (10,5)";
  shell("social", `${cabecalho("amigos")}
    <section class="sec soc-perfil"><header>${avatar(st.avatar, st.apelido, "grande")}<h2>${esc(st.apelido || "?")}</h2>
      ${uid !== usuario.id ? `<a class="mini" href="#/social/conversa/${uid}" style="margin-left:auto">✉ Conversar</a>` : ""}</header>
      <div class="soc-stats">
        <div class="soc-stat"><b>${st.media_d20 ?? "—"}</b><span>média do d20</span><i>${sorte}</i></div>
        <div class="soc-stat"><b>${st.rolagens}</b><span>rolagens</span><i>${st.d20} com d20</i></div>
        <div class="soc-stat"><b>${st.criticos}</b><span>críticos (20)</span><i>${pct(st.criticos)}</i></div>
        <div class="soc-stat"><b>${st.falhas}</b><span>falhas (1)</span><i>${pct(st.falhas)}</i></div>
        <div class="soc-stat"><b>${st.mesas}</b><span>mesas</span><i>jogando ou mestrando</i></div>
      </div>
    </section>
    <section class="sec"><header><span class="tag">◈</span><h2>Personagens mais usados</h2></header>
      ${(st.personagens || []).map((p, i) => `<div class="det soc-linha"><b class="chrome">${i + 1}.</b> <b>${esc(p.nome)}</b>
        <span class="dim">${esc([p.raca, p.classe].filter(Boolean).join(" · "))} · NV ${p.nivel}</span>
        <span class="soc-acoes"><span class="regra">${p.usos} rolagem${p.usos === 1 ? "" : "s"}</span></span></div>`).join("")
        || `<p class="regra">Nenhum personagem ainda.</p>`}
    </section>
    ${uid !== usuario.id ? `<section class="sec"><header><span class="tag">🎲</span><h2>Mesas que ${esc(st.apelido)} mestra</h2></header>
      ${(mesas || []).map((m) => `<div class="det soc-linha"><b>${esc(m.nome)}</b>
        <span class="soc-acoes">${m.ja_membro ? `<a class="mini" href="#/mesa/${m.id}">Abrir mesa</a>`
          : m.pedido_pendente ? `<span class="dim">⏳ pedido enviado</span>`
          : `<button class="mini eq" data-pedir-mesa="${m.id}" data-papel="jogador">🎲 Pedir para jogar</button>
             <button class="mini" data-pedir-mesa="${m.id}" data-papel="espectador">👁 Pedir para assistir</button>`}</span></div>`).join("")
        || `<p class="regra">${esc(st.apelido)} não mestra nenhuma mesa.</p>`}
    </section>` : ""}`, "social");

  document.querySelectorAll("[data-pedir-mesa]").forEach((b) => b.onclick = async () => {
    const papel = b.dataset.papel;
    const r = await modalForm({ titulo: papel === "jogador" ? "🎲 Pedir para jogar" : "👁 Pedir para assistir",
      descricao: papel === "jogador"
        ? "O Mestre recebe o pedido e decide. Aceito, você entra na mesa como tripulante."
        : "Como espectador você acompanha chat, combate e mapa ao vivo, sem rolar dados nem falar na mesa.",
      campos: [{ k: "msg", label: "Recado para o Mestre (opcional)", tipo: "area", rows: 3 }], okLabel: "Enviar pedido" });
    if (!r) return;
    const { error: e2 } = await sb.from("pedidos_mesa").insert({ campanha_id: b.dataset.pedirMesa, perfil_id: usuario.id, papel, mensagem: (r.msg || "").trim().slice(0, 300) || null });
    if (e2) return alert(/duplicate|unique/i.test(e2.message) ? "Você já tem um pedido pendente nessa mesa." : `Não consegui enviar: ${e2.message}`);
    telaPerfil(uid);
  });
}

// ---------------------------------------------------------------------------
//  MESAS — pedidos que chegaram às minhas mesas + os que eu fiz
// ---------------------------------------------------------------------------
async function telaMesas() {
  pararCanal();
  const [{ data: chegaram, error }, { data: meus }] = await Promise.all([sb.rpc("pedidos_para_mim"), sb.rpc("meus_pedidos")]);
  if (faltaMigracao(error)) return shell("social", cabecalho("mesas") + avisoMigracao, "social");
  const rotPapel = (p) => p === "espectador" ? "👁 assistir" : "🎲 jogar";
  shell("social", `${cabecalho("mesas")}
    <section class="sec"><header><span class="tag">📨</span><h2>Pedidos para as suas mesas</h2></header>
      ${(chegaram || []).map((q) => `<div class="det soc-linha"><b>${esc(q.apelido)}</b> quer <b>${rotPapel(q.papel)}</b> em <b class="chrome">${esc(q.campanha)}</b>
        ${q.mensagem ? `<p class="regra soc-recado">“${esc(q.mensagem)}”</p>` : ""}
        <span class="soc-acoes"><button class="mini eq" data-responder="${q.id}" data-sim="1">✔ Aceitar</button>
        <button class="mini rm" data-responder="${q.id}" data-sim="">✕ Recusar</button></span></div>`).join("")
        || `<p class="regra">Nenhum pedido pendente. Amigos podem pedir para jogar ou assistir pelas mesas que você mestra, no seu perfil.</p>`}
    </section>
    <section class="sec"><header><span class="tag">⏳</span><h2>Seus pedidos</h2></header>
      ${(meus || []).map((q) => `<div class="det soc-linha"><b class="chrome">${esc(q.campanha)}</b> <span class="dim">(Mestre ${esc(q.mestre || "?")}) · ${rotPapel(q.papel)}</span>
        <span class="soc-acoes"><span class="regra">${q.status === "pendente" ? "⏳ aguardando" : q.status === "aceito" ? "✔ aceito — já está em Campanhas" : "✕ recusado"}</span>
        ${q.status === "pendente" ? `<button class="mini rm" data-cancelar-pedido="${q.id}">Cancelar</button>` : ""}</span></div>`).join("")
        || `<p class="regra">Você não pediu para entrar em nenhuma mesa. Abra o perfil de um amigo que mestra para pedir.</p>`}
    </section>`, "social");
  document.querySelectorAll("[data-responder]").forEach((b) => b.onclick = async () => {
    const { error: e2 } = await sb.rpc("responder_pedido", { pid: b.dataset.responder, aceitar: !!b.dataset.sim });
    if (e2) return alert(`Não consegui responder: ${e2.message}`);
    telaMesas();
  });
  document.querySelectorAll("[data-cancelar-pedido]").forEach((b) => b.onclick = async () => {
    const { error: e2 } = await sb.from("pedidos_mesa").delete().eq("id", b.dataset.cancelarPedido);
    if (e2) return alert(`Não consegui cancelar: ${e2.message}`);
    telaMesas();
  });
}

// ---------------------------------------------------------------------------
//  CHAT GERAL — uma sala para todo usuário logado
// ---------------------------------------------------------------------------
async function telaGeral() {
  // As 100 MAIS RECENTES (desc) e depois invertidas — a regra do chat da mesa
  // (CLAUDE.md): asc + limit pegaria as 100 mais antigas.
  const { data, error } = await sb.from("chat_geral").select("*").order("criado_em", { ascending: false }).limit(100);
  if (faltaMigracao(error)) return shell("social", cabecalho("geral") + avisoMigracao, "social");
  const podeApagar = (m) => m.autor_id === usuario.id || !!perfil?.admin;
  const linha = (m) => `<div class="soc-msg ${m.autor_id === usuario.id ? "minha" : ""}" data-msg="${m.id}">
    ${avatar(m.avatar_url, m.apelido)}<div><b>${esc(m.apelido || "?")}</b> <span class="dim">${hora(m.criado_em)}</span>
    ${podeApagar(m) ? `<button class="mini rm soc-apagar" data-apagar="${m.id}" title="Apagar">✕</button>` : ""}
    <p>${esc(m.conteudo)}</p></div></div>`;
  shell("social", `${cabecalho("geral")}
    <section class="sec soc-chat"><header><span class="tag">🌐</span><h2>Chat geral</h2><span class="extra">todo mundo logado vê</span></header>
      <div id="soc-log" class="soc-log">${[...(data || [])].reverse().map(linha).join("") || `<p class="regra">Ninguém falou ainda. Seja o primeiro.</p>`}</div>
      <form id="soc-form" class="linha-add"><input id="soc-txt" maxlength="500" placeholder="Mensagem para todos…" autocomplete="off"/><button class="btn-ghost">ENVIAR</button></form>
    </section>`, "social");
  const log = $("#soc-log"); log.scrollTop = log.scrollHeight;
  const ligarApagar = () => log.querySelectorAll("[data-apagar]").forEach((b) => b.onclick = async () => {
    if (!(await confirmModal("Apagar esta mensagem do chat geral?", { okLabel: "Apagar", perigo: true }))) return;
    const { error: e2 } = await sb.from("chat_geral").delete().eq("id", b.dataset.apagar);
    if (e2) return alert(`Não consegui apagar: ${e2.message}`);
    log.querySelector(`[data-msg="${b.dataset.apagar}"]`)?.remove();
  });
  ligarApagar();
  $("#soc-form").onsubmit = async (e) => {
    e.preventDefault();
    const txt = $("#soc-txt").value.trim(); if (!txt) return;
    $("#soc-txt").value = "";
    const { error: e2 } = await sb.from("chat_geral").insert({ autor_id: usuario.id, conteudo: txt });
    if (e2) { $("#soc-txt").value = txt; alert(`Não consegui enviar: ${e2.message}`); }
  };
  // Tudo (inclusive a própria mensagem) chega pelo Realtime, já com o apelido
  // que o gatilho do banco preencheu — uma fonte só, sem duplicar na tela.
  assinar("chat-geral", (ch) => ch
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_geral" }, ({ new: m }) => {
      log.querySelector(".regra")?.remove();
      log.insertAdjacentHTML("beforeend", linha(m)); ligarApagar(); log.scrollTop = log.scrollHeight;
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_geral" }, ({ old }) => {
      log.querySelector(`[data-msg="${old?.id}"]`)?.remove();
    }));
}

// ---------------------------------------------------------------------------
//  CONVERSAS PRIVADAS — lista e conversa com um amigo
// ---------------------------------------------------------------------------
async function telaConversas() {
  pararCanal();
  const [{ data: contatos, error }, { data: ultimas }] = await Promise.all([
    sb.rpc("meus_contatos"),
    sb.from("mensagens_diretas").select("de,para,conteudo,lida,criado_em").order("criado_em", { ascending: false }).limit(300),
  ]);
  if (faltaMigracao(error)) return shell("social", cabecalho("conversas") + avisoMigracao, "social");
  const amigos = (contatos || []).filter((c) => c.status === "aceita");
  const resumo = new Map();   // amigo → { ultima, naoLidas }
  for (const m of ultimas || []) {
    const outro = m.de === usuario.id ? m.para : m.de;
    const r = resumo.get(outro) || { ultima: m, naoLidas: 0 };
    if (m.para === usuario.id && !m.lida) r.naoLidas++;
    resumo.set(outro, r);
  }
  const ordem = [...amigos].sort((a, b) => (resumo.get(b.outro)?.ultima.criado_em || "").localeCompare(resumo.get(a.outro)?.ultima.criado_em || ""));
  shell("social", `${cabecalho("conversas")}
    <section class="sec"><header><span class="tag">✉</span><h2>Conversas</h2></header>
      ${ordem.map((c) => { const r = resumo.get(c.outro);
        return `<a class="det soc-linha soc-conversa" href="#/social/conversa/${c.outro}">${avatar(c.avatar_url, c.apelido)}
          <span><b>${esc(c.apelido)}</b>${r?.naoLidas ? ` <b class="soc-badge">${r.naoLidas}</b>` : ""}
          <span class="regra">${r ? `${r.ultima.de === usuario.id ? "você: " : ""}${esc(r.ultima.conteudo.slice(0, 70))}` : "nenhuma mensagem ainda"}</span></span></a>`; }).join("")
        || `<p class="regra">Conversas privadas são só entre amigos. Adicione alguém na aba Amigos.</p>`}
    </section>`, "social");
}

async function telaConversa(uid) {
  const [{ data: contatos, error }, { data: desc }] = await Promise.all([
    sb.rpc("meus_contatos"),
    sb.from("mensagens_diretas").select("*")
      .or(`and(de.eq.${usuario.id},para.eq.${uid}),and(de.eq.${uid},para.eq.${usuario.id})`)
      .order("criado_em", { ascending: false }).limit(150),
  ]);
  if (faltaMigracao(error)) return shell("social", cabecalho("conversas") + avisoMigracao, "social");
  const amigo = (contatos || []).find((c) => c.outro === uid && c.status === "aceita");
  if (!amigo) return shell("social", `${cabecalho("conversas")}<section class="sec"><p class="regra">Conversas privadas só entre amigos.</p></section>`, "social");
  const linha = (m) => `<div class="soc-msg ${m.de === usuario.id ? "minha" : ""}">
    <div><span class="dim">${hora(m.criado_em)}</span>
    <p>${esc(m.conteudo)}</p>
    ${m.payload?.trecho ? `<a class="mini eq" href="#/t/${esc(m.payload.trecho)}" target="_blank" rel="noopener">📜 Abrir trecho: ${esc(m.payload.titulo || "sessão")}</a>` : ""}</div></div>`;
  shell("social", `${cabecalho("conversas")}
    <section class="sec soc-chat"><header>${avatar(amigo.avatar_url, amigo.apelido)}<h2>${esc(amigo.apelido)}</h2>
      <a class="mini" href="#/social/perfil/${uid}" style="margin-left:auto">👤 Perfil</a></header>
      <div id="soc-log" class="soc-log">${[...(desc || [])].reverse().map(linha).join("") || `<p class="regra">Comece a conversa.</p>`}</div>
      <form id="soc-form" class="linha-add"><input id="soc-txt" maxlength="2000" placeholder="Mensagem para ${esc(amigo.apelido)}…" autocomplete="off"/><button class="btn-ghost">ENVIAR</button></form>
    </section>`, "social");
  const log = $("#soc-log"); log.scrollTop = log.scrollHeight;
  // Abriu a conversa = leu. Só marca as que ELE mandou pra mim.
  sb.from("mensagens_diretas").update({ lida: true }).eq("para", usuario.id).eq("de", uid).eq("lida", false).then(() => {});
  $("#soc-form").onsubmit = async (e) => {
    e.preventDefault();
    const txt = $("#soc-txt").value.trim(); if (!txt) return;
    $("#soc-txt").value = "";
    const { data: nova, error: e2 } = await sb.from("mensagens_diretas").insert({ de: usuario.id, para: uid, conteudo: txt }).select().single();
    if (e2) { $("#soc-txt").value = txt; return alert(`Não consegui enviar: ${e2.message}`); }
    log.querySelector(".regra")?.remove();
    log.insertAdjacentHTML("beforeend", linha(nova)); log.scrollTop = log.scrollHeight;
  };
  // Só as mensagens que ELE me manda chegam por aqui (as minhas já entraram na
  // tela ao enviar). O filtro no servidor evita receber conversa de terceiros.
  assinar(`md-${usuario.id}`, (ch) => ch.on("postgres_changes",
    { event: "INSERT", schema: "public", table: "mensagens_diretas", filter: `para=eq.${usuario.id}` },
    ({ new: m }) => {
      if (m.de !== uid) return;
      log.querySelector(".regra")?.remove();
      log.insertAdjacentHTML("beforeend", linha(m)); log.scrollTop = log.scrollHeight;
      sb.from("mensagens_diretas").update({ lida: true }).eq("id", m.id).then(() => {});
    }));
}

// ---------------------------------------------------------------------------
//  TRECHO COMPARTILHADO — criar (a partir da mesa) e ler (link público)
// ---------------------------------------------------------------------------
// Chamado pelo botão 📤 da mesa. O trecho é montado NO SERVIDOR (criar_trecho)
// a partir do intervalo escolhido: mensagem privada nunca entra, e ninguém
// consegue forjar o conteúdo.
export async function compartilharTrecho(campanhaId) {
  const { data: desc, error } = await sb.from("mensagens").select("id,tipo,conteudo,payload,criado_em")
    .eq("campanha_id", campanhaId).order("criado_em", { ascending: false }).limit(150);
  if (error) return alert(`Não consegui ler o chat: ${error.message}`);
  const lista = (desc || []).filter((m) => !m.payload?.privada);
  if (!lista.length) return alert("Ainda não há mensagens públicas nesta mesa para compartilhar.");
  const rotulo = (m) => `${hora(m.criado_em)} — ${(m.payload?.titulo || m.conteudo || m.tipo || "").replace(/\*\*/g, "").slice(0, 60)}`;
  const opcoes = lista.map((m) => ({ v: m.criado_em, l: rotulo(m) }));
  const r = await modalForm({ titulo: "📤 Compartilhar trecho da sessão",
    descricao: "Escolha o começo e o fim. Vira um link somente-leitura que qualquer pessoa abre, mesmo sem conta. Rolagens privadas nunca entram.",
    campos: [
      { k: "titulo", label: "Título", tipo: "texto", valor: "Um momento da sessão" },
      { k: "de", label: "Do momento", tipo: "select", valor: opcoes[Math.min(9, opcoes.length - 1)].v, opcoes },
      { k: "ate", label: "Até o momento", tipo: "select", valor: opcoes[0].v, opcoes },
    ], okLabel: "Gerar link" });
  if (!r) return;
  const { data: token, error: e2 } = await sb.rpc("criar_trecho", { camp: campanhaId, desde: r.de, ate: r.ate, titulo: (r.titulo || "").trim() || "Um momento da sessão" });
  if (faltaMigracao(e2)) return alert("O sistema social ainda não foi instalado no banco (supabase/social.sql).");
  if (e2) return alert(`Não consegui criar o trecho: ${e2.message}`);
  const link = `${location.origin}${location.pathname}#/t/${token}`;
  try { await navigator.clipboard?.writeText(link); } catch { /* sem permissão de área de transferência: o campo abaixo resolve */ }
  const { data: contatos } = await sb.rpc("meus_contatos");
  const amigos = (contatos || []).filter((c) => c.status === "aceita");
  const r2 = await modalForm({ titulo: "📜 Trecho pronto",
    campos: [
      { k: "i", label: "", tipo: "html", html: `<p class="regra">Link copiado (se o navegador deixou). Qualquer pessoa com ele vê o trecho:</p><input class="soc-link" readonly value="${esc(link)}" onclick="this.select()"/>` },
      ...(amigos.length ? [{ k: "amigo", label: "Mandar também para um amigo (opcional)", tipo: "select",
        opcoes: [{ v: "", l: "— ninguém —" }, ...amigos.map((c) => ({ v: c.outro, l: c.apelido }))] }] : []),
    ], okLabel: "Pronto" });
  if (r2?.amigo) {
    const titulo = (r.titulo || "").trim() || "Um momento da sessão";
    const { error: e3 } = await sb.from("mensagens_diretas").insert({ de: usuario.id, para: r2.amigo, conteudo: `📜 Olha isso: "${titulo}"`, payload: { trecho: token, titulo } });
    if (e3) alert(`O link foi criado, mas não consegui mandar pro amigo: ${e3.message}`);
  }
}

// Página pública do trecho: funciona sem login (a função ler_trecho é liberada
// pro papel anônimo). Somente leitura, sem nenhum dado além das mensagens.
export async function telaTrecho(token) {
  const app = document.getElementById("app");
  app.innerHTML = `<div class="carregando"><div class="pulse"></div>Carregando trecho…</div>`;
  const { data, error } = await sb.rpc("ler_trecho", { tok: token || "" });
  if (error || !data) {
    app.innerHTML = `<div class="frame" style="padding-top:60px;text-align:center"><h1>Trecho indisponível</h1>
      <p class="regra">Este link não existe ou foi apagado por quem o criou.</p><p><a class="btn-ghost" href="#/hangar">Ir para o app</a></p></div>`;
    return;
  }
  const msg = (m) => {
    const p = m.payload || {};
    const quem = m.personagem || m.autor || "";
    if (m.tipo === "rolagem") return `<div class="soc-msg"><div><b>${esc(quem)}</b> <span class="dim">${hora(m.criado_em)}</span>
      <p><b class="chrome">${esc(p.titulo || "Rolagem")}</b>${p.total != null ? ` — <b class="tech-c">${esc(String(p.total))}</b>` : ""}${p.crit ? " ✨ CRÍTICO" : p.fumble ? " 💀 falha" : ""}</p>
      ${p.detalhe ? `<p class="regra">${esc(p.detalhe)}</p>` : ""}${p.extra ? `<p class="regra">${esc(p.extra)}</p>` : ""}</div></div>`;
    if (m.tipo === "sistema" || m.tipo === "nave") return `<div class="soc-msg sistema"><div><p class="regra">${esc(m.conteudo || "")}</p></div></div>`;
    return `<div class="soc-msg"><div><b>${esc(quem)}</b> <span class="dim">${hora(m.criado_em)}</span><p>${esc(m.conteudo || "")}</p></div></div>`;
  };
  app.innerHTML = `<div class="frame">
    <section class="sec soc-trecho"><header><span class="tag">📜</span><h2>${esc(data.titulo)}</h2></header>
      <p class="regra">${esc(data.campanha || "Uma mesa")} · compartilhado por ${esc(data.autor || "?")} em ${hora(data.criado_em)} · Passagem Sombria</p>
      <div class="soc-log soc-log-livre">${(data.mensagens || []).map(msg).join("")}</div>
      <p style="margin-top:14px"><a class="btn-ghost" href="#/hangar">Abrir o app</a></p>
    </section></div>`;
}
