// ============================================================================
//  CONTEÚDO EDITÁVEL — camada global que fica por cima dos arquivos estáticos.
//  Permite ao administrador manter o app em dia com o livro (imagens, criaturas,
//  armas e mecânicas novas) sem precisar mexer no código.
//
//  Regra de ouro: se o banco não tiver nada, tudo funciona exatamente como antes.
// ============================================================================
import { sb } from "./app.js";

let cache = null;                 // { imagens: {chave: url}, criaturas: [], armas: [], mecanicas: [] }
let carregando = null;

export const conteudoVazio = () => ({ imagens: {}, criaturas: [], armas: [], mecanicas: [] });

// Carrega uma vez por sessão. Falha silenciosa: sem banco, o app segue com os dados estáticos.
export async function carregarConteudo(forcar = false) {
  if (cache && !forcar) return cache;
  if (carregando && !forcar) return carregando;
  carregando = (async () => {
    const out = conteudoVazio();
    try {
      const { data, error } = await sb.from("conteudo").select("id,tipo,chave,dados");
      if (error) throw error;
      for (const r of data || []) {
        if (r.tipo === "imagem" && r.chave) out.imagens[r.chave.toLowerCase()] = r.dados?.url || "";
        else if (r.tipo === "criatura") out.criaturas.push({ ...r.dados, _id: r.id, _custom: true });
        else if (r.tipo === "arma") out.armas.push({ ...r.dados, _id: r.id, _custom: true });
        else if (r.tipo === "mecanica") out.mecanicas.push({ ...r.dados, _id: r.id });
      }
    } catch (_) { /* offline ou tabela ainda não criada: segue com o estático */ }
    cache = out; carregando = null; return out;
  })();
  return carregando;
}

export const conteudo = () => cache || conteudoVazio();
export const limparCache = () => { cache = null; };

// URL da imagem de um item (criatura, arma, o que for). Vazio = sem imagem.
export const imagemDe = (nome) => (cache?.imagens || {})[String(nome || "").toLowerCase()] || "";

// Mescla os itens customizados com a lista estática.
export const comCustom = (lista, extras) => [...lista, ...(extras || [])];

// ---------------------------------------------------------------------------
//  Renderização
// ---------------------------------------------------------------------------
// Miniatura que só aparece se houver imagem — sem imagem, nada é desenhado
// e o layout continua idêntico ao de antes.
export function thumb(nome, alt = "") {
  const url = imagemDe(nome);
  if (!url) return "";
  const e = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return `<img class="item-thumb" src="${e(url)}" alt="${e(alt || nome)}" loading="lazy"
    onerror="this.remove()"/>`;
}

// Figura maior, para o topo de uma ficha aberta.
export function figura(nome, alt = "") {
  const url = imagemDe(nome);
  if (!url) return "";
  const e = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return `<div class="item-figura"><img src="${e(url)}" alt="${e(alt || nome)}" loading="lazy" onerror="this.parentElement.remove()"/></div>`;
}
