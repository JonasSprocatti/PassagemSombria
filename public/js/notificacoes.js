// ============================================================================
//  NOTIFICAÇÕES DE MESA — pop-up pequeno quando algo acontece numa campanha
//  sua e você NÃO está com a mesa dela aberta: mensagem/rolagem de outra
//  pessoa, e passagem de turno no combate (destaque quando é a SUA vez).
//
//  Um canal Realtime só ("notif-<uid>"), separado do `mesa-<id>` da telaMesa,
//  assinado para todas as campanhas de que a pessoa participa (como jogador ou
//  Mestre). `atualizarNotificacoes()` roda a cada troca de rota (rotear em
//  app.js): recarrega a lista de campanhas e só reassina se ela mudou — entrar
//  numa campanha nova passa a notificar sem F5.
//
//  Mesa aberta = nenhum pop-up daquela mesa (ela já tem chat, som e destaque
//  próprios). Mensagens `sistema` não notificam — o combate gera dezenas delas.
// ============================================================================
import { sb, usuario, esc } from "./app.js";
import { somMensagem, notificar } from "./ui.js";

let canal = null;
let chaveAtual = "";          // ids das campanhas assinadas, pra saber se mudou
let camps = {};               // id → { nome, mestre_id, turnoVisto }
let meusPers = new Set();     // ids dos meus personagens (pra "é a sua vez")
let ultimaCarga = 0;

const DESLIGADO = "ps-notif-off";
export const notifLigadas = () => { try { return localStorage.getItem(DESLIGADO) !== "1"; } catch { return true; } };
export const setNotifLigadas = (v) => { try { localStorage.setItem(DESLIGADO, v ? "0" : "1"); } catch {} };

// Mesa aberta agora (#/mesa/<id>) — dela não sai pop-up.
const mesaAberta = () => { const [, rota, id] = location.hash.split("/"); return rota === "mesa" ? id : null; };
// Assinatura do turno atual — muda quando o combate começa, termina ou avança.
const assinaturaTurno = (cb) => cb?.ativo ? `${cb.rodada}:${cb.turno}` : "off";

export async function atualizarNotificacoes() {
  if (!usuario) return pararNotificacoes();
  if (Date.now() - ultimaCarga < 30000 && canal) return;   // não reconsulta a cada clique
  ultimaCarga = Date.now();
  const [mem, mestre, pers] = await Promise.all([
    sb.from("campanha_membros").select("campanha_id").eq("perfil_id", usuario.id),
    sb.from("campanhas").select("id").eq("mestre_id", usuario.id),
    sb.from("personagens").select("id").eq("dono_id", usuario.id),
  ]);
  meusPers = new Set((pers.data || []).map((p) => p.id));
  const ids = [...new Set([...(mem.data || []).map((m) => m.campanha_id), ...(mestre.data || []).map((c) => c.id)])].sort();
  if (!ids.length) return pararNotificacoes();
  const chave = ids.join(",");
  if (chave === chaveAtual && canal) return;
  const { data: cs } = await sb.from("campanhas").select("id,nome,mestre_id,combate").in("id", ids);
  camps = {};
  (cs || []).forEach((c) => (camps[c.id] = { nome: c.nome, mestre_id: c.mestre_id, turnoVisto: assinaturaTurno(c.combate) }));
  pararNotificacoes(); chaveAtual = chave;
  const lista = `(${ids.join(",")})`;
  canal = sb.channel(`notif-${usuario.id}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens", filter: `campanha_id=in.${lista}` }, ({ new: m }) => aoMensagem(m))
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "campanhas", filter: `id=in.${lista}` }, ({ new: c }) => aoCampanha(c))
    .subscribe();
}

export function pararNotificacoes() {
  if (canal) { sb.removeChannel(canal); canal = null; }
  chaveAtual = "";
}

async function aoMensagem(m) {
  const c = camps[m.campanha_id];
  if (!c || !notifLigadas() || mesaAberta() === m.campanha_id) return;
  if (m.autor_id === usuario?.id || m.tipo === "sistema" || m.tipo === "descanso") return;
  // Rolagem privada: só autor + Mestre veem (mesma regra do addMsg da mesa).
  if (m.payload?.privada && c.mestre_id !== usuario?.id) return;
  const { data: p } = await sb.from("perfis").select("apelido").eq("id", m.autor_id).maybeSingle();
  const quem = p?.apelido || "Alguém";
  const txt = m.tipo === "rolagem"
    ? `🎲 ${m.payload?.titulo || "rolagem"}${m.payload?.total != null ? ` = ${m.payload.total}` : ""}${m.payload?.crit ? " · CRÍTICO!" : ""}`
    : (m.conteudo || "").slice(0, 120);
  mostrar({ campanhaId: m.campanha_id, titulo: `💬 ${quem} · ${c.nome}`, corpo: txt });
}

function aoCampanha(novo) {
  const c = camps[novo.id]; if (!c) return;
  if (novo.nome) c.nome = novo.nome;
  const cb = novo.combate;
  const sig = assinaturaTurno(cb);
  if (sig === c.turnoVisto) return;          // UPDATE de outra coisa (mapa, nave…)
  const antes = c.turnoVisto; c.turnoVisto = sig;
  if (!notifLigadas() || mesaAberta() === novo.id) return;
  if (sig === "off") { if (antes !== "off") mostrar({ campanhaId: novo.id, titulo: `🏁 ${c.nome}`, corpo: "O combate terminou." }); return; }
  const vez = (cb.ordem || [])[cb.turno];
  const minha = vez?.personagem_id && meusPers.has(vez.personagem_id);
  const comecou = antes === "off";
  mostrar({ campanhaId: novo.id, destaque: minha,
    titulo: minha ? `⚔ É A SUA VEZ · ${c.nome}` : `⚔ ${comecou ? "Combate começou" : "Turno passou"} · ${c.nome}`,
    corpo: `Rodada ${cb.rodada} — vez de ${vez?.nome || "?"}` });
}

// ---------------- pop-up ----------------
function mostrar({ campanhaId, titulo, corpo, destaque = false }) {
  somMensagem();
  notificar(titulo, corpo);                 // notificação do sistema, só com a aba em segundo plano
  let pilha = document.querySelector(".notif-pilha");
  if (!pilha) { pilha = document.createElement("div"); pilha.className = "notif-pilha"; pilha.setAttribute("aria-live", "polite"); document.body.appendChild(pilha); }
  // Mesma campanha e mesmo tipo de aviso: substitui em vez de empilhar.
  pilha.querySelector(`[data-notif="${campanhaId}:${destaque ? "vez" : titulo.slice(0, 2)}"]`)?.remove();
  const el = document.createElement("div");
  el.className = "notif" + (destaque ? " vez" : "");
  el.dataset.notif = `${campanhaId}:${destaque ? "vez" : titulo.slice(0, 2)}`;
  el.innerHTML = `<button class="notif-abrir" type="button"><b>${esc(titulo)}</b><span>${esc(corpo)}</span></button><button class="notif-x" type="button" aria-label="Fechar">✕</button>`;
  const fechar = () => { el.classList.add("saindo"); setTimeout(() => el.remove(), 200); };
  el.querySelector(".notif-abrir").onclick = () => { el.remove(); location.hash = `#/mesa/${campanhaId}`; };
  el.querySelector(".notif-x").onclick = fechar;
  pilha.prepend(el);
  while (pilha.children.length > 3) pilha.lastElementChild.remove();
  setTimeout(fechar, destaque ? 15000 : 7000);   // a sua vez fica mais tempo na tela
}
