// ============================================================
// SEGURO — helpers para montar HTML com dado vindo do banco.
//
// Qualquer membro de uma mesa pode gravar direto pela API do Supabase (a
// chave anon é pública), sem passar pelas telas do app. Por isso todo valor
// lido do banco (ficha, payload de mensagem, campanha) é tratado como texto
// de estranho: mesmo um campo que "sempre é número" pode chegar como
// `<img onerror=...>`. Zero imports — testável direto no Node.
// ============================================================

// Escapa texto para dentro de HTML (conteúdo ou atributo entre aspas).
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Número finito ou o padrão. Para interpolar contadores (PV, nível, créditos,
// total de rolagem) sem confiar no tipo que veio do banco.
export const num = (v, padrao = 0) => {
  if (v === null || v === undefined || v === "") return padrao;
  const n = Number(v);
  return Number.isFinite(n) ? n : padrao;
};

// Endereço de imagem aceitável num `src`: foto comprimida no próprio app
// (data:image/… em base64) ou um endereço https (Storage do Supabase, imagem
// do Mestre). Qualquer outra coisa (javascript:, data:text/html, http solto)
// vira "" — quem chama decide mostrar o espaço vazio.
export const urlImg = (u) => {
  const s = String(u ?? "").trim();
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(s)) return s;
  if (/^https:\/\/[^\s"'<>]+$/i.test(s)) return s;
  return "";
};

// Link clicável aceitável num `href`: só https.
export const urlLink = (u) => {
  const s = String(u ?? "").trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : "";
};

// Template que escapa TUDO por padrão:  html`<b>${nome}</b>`.
// Para inserir HTML já montado (outro html`` ou markup confiável), embrulhe em
// `cru(...)`. Arrays são juntados sem separador, cada item escapado do mesmo jeito.
const CRU = Symbol("html-cru");
export const cru = (s) => ({ [CRU]: String(s ?? "") });
const parte = (v) => {
  if (v === null || v === undefined || v === false) return "";
  if (Array.isArray(v)) return v.map(parte).join("");
  if (typeof v === "object" && CRU in v) return v[CRU];
  return esc(v);
};
export const html = (cordas, ...vals) => cru(cordas.reduce((acc, s, i) => acc + s + (i < vals.length ? parte(vals[i]) : ""), ""));
// Converte o resultado de html`` (ou qualquer valor) em string para innerHTML.
export const texto = (v) => parte(v);

// Campos que o app sempre trata como número (ficha, linha do rastreador,
// payload de rolagem). `sanear()` percorre o objeto inteiro e força esses
// campos a número onde quer que apareçam — defesa de reserva para os vários
// lugares que interpolam `${c.hp}`/`${f.nivel}` sem passar por esc(). null e
// undefined ficam como estão (alguns campos usam null como "ainda não rolou").
const NUMEROS = new Set([
  "nivel", "pvAtual", "pvMax", "pvTemp", "escudoGasto", "cdExtra", "creditos", "ramGasta", "xp", "xpMeta", "marcos",
  "tirosPente", "tiros", "qtd", "ini", "hp", "hp_max", "cd", "casco", "casco_max", "escudos", "escudos_max",
  "manobra", "turnos", "rodada", "turno", "x", "lane", "cobertura", "total", "dano_total", "valor", "ignoraArmadura",
  "For", "Des", "Con", "Int", "Sab", "Car",
]);
export function sanear(v, prof = 0) {
  if (prof > 12 || v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = sanear(v[i], prof + 1); return v; }
  for (const k of Object.keys(v)) {
    const x = v[k];
    if (NUMEROS.has(k) && x !== null && x !== undefined && typeof x !== "number") v[k] = num(x);
    else if (typeof x === "number" && !Number.isFinite(x)) v[k] = 0;
    else if (x && typeof x === "object") v[k] = sanear(x, prof + 1);
  }
  return v;
}
