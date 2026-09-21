// ============================================================================
//  RELATÓRIO DE FICHAS — auditoria de consistência e de poder/equilíbrio.
//  Gera um texto Markdown a partir das linhas de `personagens` (o mesmo roster
//  do painel admin), pensado pra ser copiado e colado numa conversa de análise:
//  uma tabela-resumo comparável entre fichas, médias por nível/classe/raça, e
//  por ficha os números derivados (calc) + a lista de inconsistências achadas.
//
//  Puro de propósito (zero DOM, zero Supabase): o catálogo "vivo" (com o
//  conteúdo do admin) chega por parâmetro, então dá pra testar no Node.
// ============================================================================
import { RACAS, CLASSES, FILOSOFIAS, PERICIAS, ARMAS, ARMADURAS, IMPLANTES, LIMITE_TATUAGENS } from "./dados-jogo.js";
import { calc, novaFichaDados, parseDice, migrarPericias, sign } from "./regras.js";

const ATTRS = ["For", "Des", "Con", "Int", "Sab", "Car"];
const media = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const r1 = (n) => Math.round(n * 10) / 10;
// Dano médio de uma expressão "2d6+1" (null se não parsear).
export const danoMedio = (expr) => { const p = parseDice(expr); return p ? p.n * (p.f + 1) / 2 + p.mod : null; };

// Ataques equipados com acerto e dano médio — o bruto pra comparar poder ofensivo.
// Não inclui efeitos situacionais (furtivo, contra robôs, crítico): só o número
// que vale em todo ataque comum.
function ataquesDe(f, k, cat) {
  const armas = cat.armas || ARMAS;
  return (f.inventario || []).filter((i) => i.tipo === "arma" && i.equip).map((i) => {
    const w0 = armas.find((x) => x.n === i.nome);
    if (!w0) return { nome: i.nome, desconhecida: true };
    const w = cat.armaMontada ? cat.armaMontada(w0, i) : w0;
    const fogo = w.tipo === "fogo";
    const attr = w.attr === "conj" ? null : (w.attr || (fogo ? "Des" : "For"));
    const per = w.per || (fogo ? "Armas de Fogo" : "Armas Brancas");
    const acertoMods = (w._efeitos || []).filter((e) => e.tipo === "acerto" && !e.contra).reduce((a, e) => a + (e.valor || 0), 0);
    const acerto = w.attr === "conj" ? k.conj : (k.attr[attr] || 0) + (k.per[per] || 0) + acertoMods;
    const dado = cat.danoArma ? cat.danoArma(w, f.nivel) : w.dano;
    const bonusDano = attr ? (k.attr[attr] || 0) : 0;
    const dm = danoMedio(dado);
    return { nome: w.n, tipo: w.tipo, dado, attr: attr || "conj", acerto, bonusDano, kw: w.kw || "",
      mods: Object.values(i.mods || {}).filter(Boolean), medio: dm == null ? null : dm + bonusDano };
  });
}

// Inconsistências e sinais de bug. Cada item: [nível, texto] — "erro" é estado
// impossível pelas regras; "aviso" é suspeito ou incompleto.
export function checarFicha(f, k, cat = {}) {
  const out = [];
  const E = (t) => out.push(["erro", t]), A = (t) => out.push(["aviso", t]);
  const raca = RACAS.find((r) => r.nome === f.raca);
  const armas = cat.armas || ARMAS, armaduras = cat.armaduras || ARMADURAS, implantes = cat.implantes || IMPLANTES;
  if (!f.raca) A("sem raça"); else if (!raca) E(`raça desconhecida: "${f.raca}"`);
  if (!f.classe) A("sem classe"); else if (!CLASSES[f.classe]) E(`classe desconhecida: "${f.classe}"`);
  if (f.filosofia && !FILOSOFIAS[f.filosofia]) E(`filosofia desconhecida: "${f.filosofia}"`);
  if (!(f.nivel >= 1 && f.nivel <= 10)) E(`nível fora de 1–10: ${f.nivel}`);
  if (f.modoAttr !== "rolagem") {
    if (k.pontosGastos > k.pontosDireito) E(`atributos: gastou ${k.pontosGastos} pontos, direito a ${k.pontosDireito}`);
    else if (k.pontosGastos < k.pontosDireito) A(`atributos: ${k.pontosDireito - k.pontosGastos} ponto(s) sem gastar`);
  }
  Object.entries(f.pontosAttr || {}).forEach(([a, v]) => { if (v < 0) E(`pontos negativos em ${a}: ${v}`); });
  if (k.perGastas > k.perDireito) E(`perícias: gastou ${k.perGastas} pontos, direito a ${k.perDireito}`);
  else if (k.perGastas < k.perDireito) A(`perícias: ${k.perDireito - k.perGastas} ponto(s) sem gastar`);
  const nomesPer = PERICIAS.map(([p]) => p);
  Object.keys(migrarPericias(f.periciasExtra)).forEach((p) => { if (!nomesPer.includes(p)) E(`perícia desconhecida nos pontos extras: "${p}"`); });
  if (f.raca && f.classe && !(f.pvMax > 0)) E("PV máximo zerado (vida inicial nunca rolada?)");
  if ((f.pvAtual || 0) > k.pvMax) E(`PV atual ${f.pvAtual} acima do máximo ${k.pvMax}`);
  if ((f.pvAtual || 0) < 0) E(`PV atual negativo: ${f.pvAtual}`);
  if ((f.ramGasta || 0) > k.ramMax) A(`RAM gasta ${f.ramGasta} acima do máximo ${k.ramMax}`);
  if ((f.creditos || 0) < 0) E(`créditos negativos: ${f.creditos}`);
  const imps = f.implantes || [];
  if (imps.length > k.limite) E(`${imps.length} implantes para Limite Cibernético ${k.limite}`);
  imps.forEach((n) => { if (!n.startsWith("Nano-Tatuagem: ") && !implantes.some((x) => x.n === n)) E(`implante desconhecido: "${n}"`); });
  const dup = imps.filter((n, i) => imps.indexOf(n) !== i && !n.startsWith("Nano-Tatuagem: "));
  if (dup.length) A(`implante repetido: ${[...new Set(dup)].join(", ")}`);
  const inv = f.inventario || [];
  inv.forEach((i) => {
    if (i.tipo === "arma" && !armas.some((x) => x.n === i.nome)) E(`arma desconhecida no inventário: "${i.nome}"`);
    if (i.tipo === "armadura" && !armaduras.some((x) => x.n === i.nome)) E(`armadura desconhecida no inventário: "${i.nome}"`);
  });
  const armEq = inv.filter((i) => i.tipo === "armadura" && i.equip);
  if (armEq.length > 1) E(`${armEq.length} armaduras equipadas ao mesmo tempo`);
  const reserva = Object.values(f.pentes || {}).reduce((a, v) => a + (v || 0), 0);
  if (reserva > k.pentesReserva) A(`${reserva} pentes na reserva, teto ${k.pentesReserva}`);
  // Nano-tatuagens: além do limite do porte, cada forma extra precisa ocupar um slot.
  const tatuadas = inv.filter((i) => i.tipo === "arma" && armas.find((x) => x.n === i.nome)?.nano).length;
  const lim = LIMITE_TATUAGENS[raca?.tamanho] ?? 0;
  const marcadores = imps.filter((n) => n.startsWith("Nano-Tatuagem: ")).length;
  if (tatuadas && !imps.includes("Cortex Central de Nano-Enxame")) E(`${tatuadas} nano-tatuagem(ns) sem o Cortex Central de Nano-Enxame`);
  if (tatuadas > lim && marcadores < tatuadas - lim) E(`${tatuadas} nano-tatuagens, limite do porte ${lim}, mas só ${marcadores} ocupando slot`);
  if (f.metodoNivel === "xp" && f.xpMeta && f.xp >= f.xpMeta && f.nivel < 10) A(`XP ${f.xp} já passou da meta ${f.xpMeta} sem subir de nível`);
  return out;
}

// `linhas`: [{ id, nome, dados, dono (apelido), atualizado_em, campanha_id }].
// `cat`: { armas, armaduras, implantes, danoArma, armaMontada } — o catálogo vivo.
export function relatorioFichas(linhas, cat = {}) {
  const fichas = linhas.map((p) => {
    const f = { ...novaFichaDados(), ...(p.dados || {}) };
    const k = calc(f);
    const atq = ataquesDe(f, k, cat);
    const melhor = atq.filter((a) => a.medio != null).sort((a, b) => b.medio - a.medio)[0];
    return { p, f, k, atq, melhor, problemas: checarFicha(f, k, cat) };
  });
  const L = [];
  const agora = new Date().toLocaleString("pt-BR");
  L.push(`# Relatório de fichas — Passagem Sombria`, ``, `Gerado em ${agora} · ${fichas.length} ficha(s).`,
    `Números do motor (calc): atributos já com raça + pontos + efeitos; acerto = atributo + perícia (+ mods de bancada sem condição);`,
    `dano médio = média dos dados + atributo, sem crítico/furtivo/efeitos situacionais.`, ``);

  const nErros = fichas.reduce((a, x) => a + x.problemas.filter((q) => q[0] === "erro").length, 0);
  const nAvisos = fichas.reduce((a, x) => a + x.problemas.filter((q) => q[0] === "aviso").length, 0);
  L.push(`## Resumo`, ``, `- Inconsistências: **${nErros} erro(s)**, ${nAvisos} aviso(s).`, ``);

  L.push(`| Personagem | Jogador | NV | Raça | Classe | PV | CD | RAM | Conj | Ini | Desl | Implantes | Melhor ataque | Acerto | Dano méd. | CG | Probl. |`,
    `|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`);
  fichas.forEach(({ p, f, k, melhor, problemas }) => {
    const e = problemas.filter((q) => q[0] === "erro").length, a = problemas.length - e;
    L.push(`| ${p.nome || "—"} | ${p.dono || "—"} | ${f.nivel} | ${f.raca || "—"} | ${f.classe || "—"} | ${k.pvMax} | ${k.cd} | ${k.ramMax} | ${sign(k.conj)} | ${sign(k.iniciativa)} | ${k.deslocamento} | ${(f.implantes || []).length}/${k.limite} | ${melhor?.nome || "—"} | ${melhor ? sign(melhor.acerto) : "—"} | ${melhor ? r1(melhor.medio) : "—"} | ${f.creditos ?? 0} | ${e ? `❌${e}` : ""}${a ? ` ⚠${a}` : ""} |`);
  });
  L.push(``);

  // Médias agrupadas — onde o desequilíbrio aparece sem olhar ficha por ficha.
  const agrupar = (titulo, chave) => {
    const g = {};
    fichas.forEach((x) => { const c = chave(x); if (c) (g[c] = g[c] || []).push(x); });
    const ks = Object.keys(g).sort((a, b) => String(a).localeCompare(String(b), "pt-BR", { numeric: true }));
    if (!ks.length) return;
    L.push(`### Médias por ${titulo}`, ``, `| ${titulo} | Fichas | PV | CD | RAM | Acerto | Dano méd. |`, `|---|---|---|---|---|---|---|`);
    ks.forEach((c) => { const xs = g[c]; const com = xs.filter((x) => x.melhor);
      L.push(`| ${c} | ${xs.length} | ${r1(media(xs.map((x) => x.k.pvMax)))} | ${r1(media(xs.map((x) => x.k.cd)))} | ${r1(media(xs.map((x) => x.k.ramMax)))} | ${com.length ? r1(media(com.map((x) => x.melhor.acerto))) : "—"} | ${com.length ? r1(media(com.map((x) => x.melhor.medio))) : "—"} |`); });
    L.push(``);
  };
  agrupar("nível", (x) => `NV ${x.f.nivel}`);
  agrupar("classe", (x) => x.f.classe);
  agrupar("raça", (x) => x.f.raca);

  L.push(`## Fichas`, ``);
  fichas.forEach(({ p, f, k, atq, problemas }) => {
    L.push(`### ${p.nome || "— sem nome —"} (${p.dono || "sem dono"}) — NV ${f.nivel} ${f.raca || "?"} ${f.classe || "?"}${f.filosofia ? ` · ${f.filosofia}` : ""}`);
    L.push(`- id: \`${p.id}\` · ${p.campanha_id ? "em campanha" : "sem campanha"} · atualizada ${p.atualizado_em ? new Date(p.atualizado_em).toLocaleDateString("pt-BR") : "?"}`);
    L.push(`- Atributos: ${ATTRS.map((a) => `${a} ${sign(k.attr[a])}`).join(" · ")} (modo ${f.modoAttr}; pontos ${k.pontosGastos}/${k.pontosDireito})`);
    const pers = PERICIAS.map(([pn, at]) => [pn, (k.per[pn] || 0), (k.attr[at] || 0) + (k.per[pn] || 0)]).filter((x) => x[1] > 0);
    L.push(`- Perícias treinadas (pontos ${k.perGastas}/${k.perDireito}): ${pers.map(([pn, v, tot]) => `${pn} ${v} (tot ${sign(tot)})`).join(", ") || "nenhuma"}`);
    L.push(`- PV ${f.pvAtual}/${k.pvMax}${k.pvMaxBonus ? ` (bruto ${f.pvMax} + ${k.pvMaxBonus} de efeito)` : ""} · CD ${k.cd} · Escudo ${k.escudoMax} · RAM ${k.ramLivre}/${k.ramMax} · Conj ${sign(k.conj)} · Ini ${sign(k.iniciativa)} · Desl ${k.deslocamento} m · Pentes ${k.pentesMax}`);
    L.push(`- Armadura: ${k.armRef ? `${k.armRef.n} (${k.armRef.t}, CD +${k.armRef.cd || 0})` : "nenhuma"} · Implantes (${(f.implantes || []).length}/${k.limite}${k.carga ? `, carga ${k.carga}` : ""}): ${(f.implantes || []).join(", ") || "nenhum"}`);
    atq.forEach((a) => L.push(a.desconhecida ? `  - ⚔ ${a.nome} — **não encontrada no arsenal**`
      : `  - ⚔ ${a.nome} (${a.tipo}) acerto ${sign(a.acerto)} · dano ${a.dado}${a.bonusDano ? sign(a.bonusDano) : ""} ≈ ${r1(a.medio ?? 0)}${a.kw ? ` · ${a.kw}` : ""}${a.mods.length ? ` · mods: ${a.mods.join(", ")}` : ""}`));
    const fontes = (k.efeitos?.fontes || []).map((x) => `${x.nome} [${x.origem}]`);
    if (fontes.length) L.push(`- Fontes de efeito ativas: ${fontes.join(", ")}`);
    const outros = (f.inventario || []).filter((i) => !(i.tipo === "arma" && i.equip) && !(i.tipo === "armadura" && i.equip)).map((i) => `${i.nome}${i.qtd > 1 ? ` ×${i.qtd}` : ""}`);
    if (outros.length) L.push(`- Inventário (não equipado): ${outros.join(", ")}`);
    L.push(`- Créditos ${f.creditos ?? 0} · XP ${f.xp ?? 0}/${f.xpMeta ?? "?"} · deck ${(f.deck || []).length}/${k.deckMax}${(f.deck || []).length ? `: ${f.deck.join(", ")}` : ""}`);
    if (problemas.length) problemas.forEach(([n, t]) => L.push(`  - ${n === "erro" ? "❌" : "⚠"} ${t}`));
    else L.push(`- ✓ nenhuma inconsistência detectada`);
    L.push(``);
  });
  return L.join("\n");
}
