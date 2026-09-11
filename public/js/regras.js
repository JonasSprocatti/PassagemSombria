// ============================================================================
//  REGRAS — funções puras do sistema (ficha, dados, condições, campo tático,
//  tipos de dano). Zero DOM, zero Supabase, zero import de rede: só recebe
//  dados e devolve dados. É o módulo pensado pra ser importado tanto pelo
//  app.js (produção) quanto pelos testes automatizados em tests/ (`node --test`).
//
//  Extraído de app.js em 2026 pra viabilizar testar calc(), aplicarCond(),
//  distCombate() etc. sem precisar simular navegador nem Supabase — antes,
//  essas funções viviam misturadas com telaMesa()/telaFicha() no mesmo arquivo
//  que começa importando "https://esm.sh/@supabase/supabase-js@2", uma URL
//  remota que o Node não resolve sozinho, então nada dali era importável.
// ============================================================================
import {
  RACAS, CLASSES, FILOSOFIAS, IMPLANTES, ARMAS, ARMADURAS, PERICIAS, TEMAS,
  CONVERTE_2D8, RENOME_PERICIAS, chavesDaArma,
} from "./dados-jogo.js";
import { FichaEfeitos } from "./efeitos.js";

// ---------------- DADOS (d20, Nd, expressões de dano) ----------------------
export const sign = (n) => (n >= 0 ? `+${n}` : `${n}`);
export const d = (f) => 1 + Math.floor(Math.random() * f);
export const rollNd = (n, f) => Array.from({ length: n }, () => d(f));
export const parseDice = (s) => { const m = /^(\d*)d(\d+)([+-]\d+)?$/i.exec(String(s).trim()); return m ? { n: +(m[1] || 1), f: +m[2], mod: +(m[3] || 0) } : null; };
// Dado de vida por grupo racial (Pesado 1d10 · Médio 1d8 · Leve 1d6), OU o valor fixo
// (5/4/3). Devolve as faces, se foi fixo, e o valor rolado/fixo do dado.
export const rolaDadoVida = (raca, fixo = false) => {
  const faces = raca?.dadoVida || 8;
  const val = fixo ? (raca?.vidaFixa ?? Math.ceil((faces + 1) / 2)) : d(faces);
  return { faces, fixo, val };
};
// Vida INICIAL (nível 1): 4d6, DESCARTA o menor, soma os 3 maiores + vidaMod da raça.
// Diferente do dado por nível (rolaDadoVida): o nível 1 é sempre este 4d6 tira-menor.
export const rolaVidaInicial = (raca) => {
  const ds = rollNd(4, 6);
  const menor = Math.min(...ds);
  const soma3 = ds.reduce((a, b) => a + b, 0) - menor;
  return { ds, menor, soma3, subtotal: soma3 + (raca?.vidaMod || 0) };
};
// Crítico (regra da mesa): soma dados + qualquer bônus PRIMEIRO, só depois multiplica
// o total por `mult` (2 no crítico comum, 4 quando algo dobra o crítico por cima).
// NUNCA dobrar a quantidade de dados rolados — isso deixa o bônus fixo de fora da
// conta e sub-contabiliza o dano. Já foi bug real em 3 lugares diferentes que
// resolviam ataque com d20 (criaturas/derivados e as duas naves inimigas).
export const danoCritico = (somaDados, mod = 0, mult = 1) => (somaDados + mod) * mult;

// Migra perícias de fichas antigas para a nomenclatura unificada v1.4
export const migrarPericias = (pe) => {
  const out = { ...(pe || {}) };
  for (const [velho, novo] of Object.entries(RENOME_PERICIAS)) {
    if (out[velho] != null) { out[novo] = (out[novo] || 0) + out[velho]; delete out[velho]; }
  }
  return out;
};

// ---------------- FICHA: modelo e cálculos (mesmo formato do Deck de Campo) ----------------
// Conteúdo global editável pelo painel admin (tabela `conteudo`), espelho síncrono
// pro calc(). Objeto mutável: app.js grava as chaves via sincronizarExtra() depois
// de carregar do Supabase; aqui começa vazio, e calc() cai nos dados estáticos
// (RACAS, CLASSES…) enquanto nada foi carregado — é exatamente o que já acontecia.
export const CONTEUDO_EXTRA = { implantes: [], armaduras: [], armas: [], consumiveis: [], naves: [], npcs: [] };

// Habilidades ativas que ficam LIGADAS (como o gás do Ven'y): devolve os
// efeitos da opção escolhida, para o calc somá-los enquanto durar.
export function modosAtivosDe(f) {
  const out = [];
  const raca = RACAS.find((r) => r.nome === f.raca), classe = CLASSES[f.classe];
  const fontes = [...(raca?.habilidades || []), ...(classe?.hab || []), ...(classe?.vet ? [classe.vet] : []), ...(raca?.lendaria ? [raca.lendaria] : [])];
  for (const [id, escolha] of Object.entries(f.modos || {})) {
    const h = fontes.find((x) => x.n === id);
    if (!h) continue;
    // opções podem estar em h.opcoes (gás do Ven'y) ou em h.resolve.opcoes (Êxtase da Batalha)
    const op = (h.opcoes || h.resolve?.opcoes)?.find((o) => o.n === escolha);
    if (op?.efeitos?.length) out.push({ nome: `${h.n}: ${op.n}`, efeitos: op.efeitos });
    // modo sem opções (Endurecer): os efeitos ficam direto em h.resolve.efeitos
    else if (h.resolve?.efeitos?.length) out.push({ nome: h.n, efeitos: h.resolve.efeitos });
  }
  return out;
}

export const novaFichaDados = () => ({
  nivel: 1, foto: null, tema: { ...TEMAS["Vácuo"] },
  raca: "", classe: "", filosofia: "",
  pontosAttr: { For: 0, Des: 0, Con: 0, Int: 0, Sab: 0, Car: 0 },
  modoAttr: "pontos", rolagem: { For: null, Des: null, Con: null, Int: null, Sab: null, Car: null }, rolagemPool: [],
  pvAtual: 0, pvMax: 0, cdExtra: 0, creditos: 100,
  pvTemp: 0, escudoGasto: 0,          // PV Temporário e o quanto do escudo pessoal já foi consumido
  periciasExtra: {}, implantes: [], patrocinados: [],
  deck: [], ramGasta: 0, usos: {}, inventario: [], notas: "",
  metodoNivel: "manual", xp: 0, xpMeta: 1000, marcos: 0, log: [], usarVidaFixa: false,
});

// `opcoes.semImplantes`: a pessoa está dentro de uma aura que desliga cibernética
// (Zona Morta do Silenciador Cósmico, Campo de Não-Existência da Ferida do Mundo).
// Recalcula a ficha inteira como se ela não tivesse implante nenhum — some o bônus
// de RAM do Chip, a CD das Placas, e todo efeito declarado de implante.
export function calc(f, opcoes = {}) {
  const semImplantes = !!opcoes.semImplantes;
  // Fonte única da verdade pros implantes que estão REALMENTE funcionando agora.
  const implantesAtivos = semImplantes ? [] : (f.implantes || []);
  const r = RACAS.find((x) => x.nome === f.raca), c = CLASSES[f.classe];
  const attr = {};
  ["For", "Des", "Con", "Int", "Sab", "Car"].forEach((a) => {
    attr[a] = (r ? r.attrs[a] : 0) + (f.pontosAttr?.[a] || 0) + (f.modoAttr === "rolagem" && f.rolagem?.[a] != null ? CONVERTE_2D8(f.rolagem[a]) : 0);
  });
  const pontosDireito = Math.max(0, (f.nivel || 1) - 1) + (r?.livre && f.modoAttr !== "rolagem" ? 4 : 0);
  const pontosGastos = Object.values(f.pontosAttr || {}).reduce((s, v) => s + (v || 0), 0);
  const perDireito = Math.max(0, (f.nivel || 1) - 1) + (r?.livre ? 3 : 0);
  const peMig = migrarPericias(f.periciasExtra);
  const perGastas = Object.values(peMig).reduce((s, v) => s + (v || 0), 0);
  const per = {};
  PERICIAS.forEach(([p]) => { per[p] = (c?.pericias[p] || 0) + (peMig[p] || 0); });
  const isCin = !!c?.cinetico;
  const limite = Math.max(1, 2 + (isCin ? attr.Int : attr.Con));
  const limiteOrg = Math.max(1, 2 + attr.Con);
  const carga = isCin ? Math.max(0, implantesAtivos.length - limiteOrg) : 0;
  const chip = implantesAtivos.includes("Chip de Expansão de RAM") ? 2 : 0;
  const impares = [3, 5, 7, 9].filter((n) => n <= f.nivel).length;
  const ramMax = Math.max(0, 1 + attr.Int + Math.floor(per["Tecnomancia"] / 2) + impares + chip - carga);
  const ramLivre = Math.max(0, ramMax - (f.ramGasta || 0));
  const bonusRes = isCin && f.nivel >= 5 ? Math.floor(implantesAtivos.length / 3) : 0;
  const conj = attr.Int + per["Tecnomancia"] + bonusRes;
  const arm = (f.inventario || []).find((i) => i.tipo === "armadura" && i.equip);
  const armRef = arm ? ARMADURAS.find((a) => a.n === arm.nome) : null;
  const t = armRef?.t || "leve";
  const desAdj = t === "pesada" ? 0 : t === "media" ? Math.min(2, attr.Des) : attr.Des;
  const placas = implantesAtivos.includes("Placas Subdérmicas de Titânio") ? 1 : 0;
  const cd = 10 + desAdj + (armRef?.cd || 0) + placas + (f.cdExtra || 0);
  const deckMax = Math.max(3, f.nivel + per["Tecnomancia"]);
  const iniBonus = (f.classe === "Batedor" ? 2 : 0) + (f.filosofia === "Código do Sobrevivente" ? 2 : 0);
  const iniciativa = attr.Des + iniBonus;
  const deslocBase = f.raca === "Mercusys" ? 18 : 9;
  const deslocamento = deslocBase + 2 * attr.Des;
  const k = { attr, per, isCin, limite, limiteOrg, carga, ramMax, ramLivre, conj, cd, armRef, deckMax, pontosDireito, pontosGastos, perDireito, perGastas, iniciativa, iniBonus, deslocBase, deslocamento };
  // Efeitos declarados (implantes, filosofias, raças, classes, armaduras) entram
  // por cima. É aditivo: o cálculo clássico acima continua valendo, e conteúdo
  // novo passa a funcionar sem precisar de código.
  const fe = FichaEfeitos.de({ ...f, implantes: implantesAtivos }, {
    RACAS: CONTEUDO_EXTRA.racas || RACAS,
    CLASSES: CONTEUDO_EXTRA.classes || CLASSES,
    FILOSOFIAS: CONTEUDO_EXTRA.filosofias || FILOSOFIAS,
    IMPLANTES: CONTEUDO_EXTRA.implantesTodos || IMPLANTES,
    ARMADURAS: CONTEUDO_EXTRA.armadurasTodas || ARMADURAS,
    modosAtivos: modosAtivosDe(f),
    chavesDeArmasEquipadas: (f.inventario || [])
      .filter((i) => i.equip && i.tipo === "arma")
      .flatMap((i) => { const w = (CONTEUDO_EXTRA.armasTodas || ARMAS).find((x) => x.n === i.nome);
        return w ? chavesDaArma(w).filter((c) => (c.efeitos || []).length)
          .map((c) => ({ nome: `${c.nome} (${w.n})`, efeitos: c.efeitos })) : []; }) });
  // os quatro implantes que já estavam no cálculo clássico não podem contar duas vezes
  const jaContados = ["Chip de Expansão de RAM", "Placas Subdérmicas de Titânio"];
  fe.fontes = fe.fontes.filter((x) => !jaContados.includes(x.nome));
  fe.aplicarNaFicha(k, { implantes: implantesAtivos, nivel: f.nivel || 1 });
  k.implantesInertes = semImplantes && (f.implantes || []).length > 0;
  k.ramLivre = Math.max(0, k.ramMax - (f.ramGasta || 0));   // recalcula após os efeitos
  // Pentes que a pessoa carrega: 5 + mod de Força (1 no cano + o resto na reserva).
  k.pentesMax = Math.max(2, 5 + (k.attr.For || 0));
  k.pentesReserva = k.pentesMax - 1;
  // Escudo pessoal (armadura com `absorve`): soma que some antes do PV; recarrega no descanso.
  k.escudoMax = armRef?.absorve || 0;
  k.escudoLivre = Math.max(0, k.escudoMax - (f.escudoGasto || 0));
  k.pvTemp = Math.max(0, f.pvTemp || 0);
  k.efeitos = fe;
  return k;
}
// Teto da reserva de pentes a partir da ficha bruta (para onde não há um `k` à mão).
export const pentesReservaDe = (f) => calc(f).pentesReserva;

// CD de um teste de resistência forçado por uma habilidade/palavra-chave do
// personagem: 8 + modificador do atributo-chave. Usado por salvaguardas e
// palavras-chave de arma que não trazem uma CD fixa própria.
export const dcSalvaguarda = (k, atributo) => 8 + ((k?.attr?.[atributo]) || 0);

// O que se ganha ao subir para o nível n (para o preview e o registro)
export function ganhosDoNivel(n, f) {
  const c = CLASSES[f.classe], r = RACAS.find((x) => x.nome === f.raca);
  const g = ["+1 Ponto de Atributo (teto natural +6)", "Vida: role 1d" + (r?.dadoVida || 6) + " (ou pegue a média fixa " + (r?.vidaFixa || 3) + ") + Con", "+1 Ponto de Perícia"];
  if ([3, 5, 7, 9].includes(n)) g.push("+1 Slot de RAM (nível ímpar)");
  if (n === 5) { g.push("Teto de perícias sobe para +7"); if (c) g.push(`★ Especialização Veterana — ${c.vet.n}: ${c.vet.d}`); }
  if (n === 10 && r?.lendaria) g.push(`★★ Lendária da raça — ${r.lendaria.n}: ${r.lendaria.d}`);
  return g;
}

// ---------------- CONDIÇÕES ----------------
export const CONDICOES_INFO = [
  { n: "Sangrando",    ic: "🩸", dano: "1d4", d: "Sofre 1d4 no início do seu turno até ser estabilizado." },
  { n: "Em chamas",    ic: "🔥", dano: "1d6", d: "Sofre 1d6 de fogo no início do seu turno. Apagar: Ação Principal + Reação, deslocamento pela metade neste turno, d20 puro ≥10 apaga." },
  { n: "Envenenado",   ic: "🧪", dano: "1d4", d: "Sofre 1d4; Desvantagem em ataques e em testes físicos (Atletismo, Acrobacia, Furtividade)." },
  { n: "Atordoado",    ic: "💫", dano: null,  d: "Perde a Ação Principal. Ataques contra o alvo têm Vantagem." },
  { n: "Paralisado",   ic: "🧊", dano: null,  d: "Não age nem se move. Ataques a até 2m são Críticos automáticos." },
  { n: "Congelado",    ic: "❄", dano: null,  d: "Deslocamento zero. Ainda pode agir." },
  { n: "Cego",         ic: "🌑", dano: null,  d: "Desvantagem em ataques e em testes visuais (Percepção, Investigação, Prestidigitação, Pilotagem); ataques contra o alvo têm Vantagem." },
  { n: "Caído",        ic: "⬇", dano: null,  d: "Deslocamento pela metade. Levantar: Ação Principal + Ação de Movimento, remove na hora." },
  { n: "Marcado",      ic: "🎯", dano: null,  d: "Aliados de quem marcou ganham +2 no acerto contra o alvo." },
  { n: "Lento",        ic: "🐌", dano: null,  d: "Perde a Ação de Movimento no próximo turno." },
  { n: "Motor Travado", ic: "🦿", dano: null, d: "Implantes motores sob controle alheio: deslocamento pela metade e não pode Esquivar." },
  { n: "Hesitante",    ic: "😐", dano: null,  d: "Baixou a arma por um instante: perde a Ação Principal neste turno." },
  { n: "Amedrontado",  ic: "😨", dano: null,  d: "Desvantagem contra a fonte do medo; não pode se aproximar dela." },
  { n: "Acovardado",   ic: "😖", dano: null,  d: "Cabeça baixa sob fogo: ataca com Desvantagem." },
  { n: "Dominado",     ic: "🕸", dano: null,  d: "Age sob comando de quem o dominou: perde a Ação Principal." },
  { n: "Surpreso",     ic: "❕", dano: null,  d: "Pego de surpresa: não age na rodada surpresa." },
  { n: "Subsistema off", ic: "🔌", dano: null, d: "Um sistema da nave está desativado." },
  { n: "Enfraquecido", ic: "💔", dano: null,  d: "Causa metade do dano em ataques físicos." },
  { n: "Silenciado",   ic: "🔇", dano: null,  d: "Não conjura Scripts nem usa habilidades que exijam fala." },
];
export const CONDICOES = CONDICOES_INFO.map((c) => c.n);
export const infoCond = (nome) => CONDICOES_INFO.find((c) => c.n.toLowerCase() === String(nome || "").toLowerCase());
// Aplica uma condição a um combatente do rastreador seguindo a regra da mesa:
// - condição com dano contínuo: se já ativa, empilha +1 turno (nunca o dano);
// - condição de estado (sem dano): renova para a maior duração.
// O rastreador decrementa as condições no INÍCIO do turno do afetado, antes de
// ele agir; para as de estado valerem pelo turno inteiro guardamos +1.
// `origemId` (opcional) = id da linha do rastreador que causou a condição — hoje só
// usado por Amedrontado, pra restringir a Desvantagem e o bloqueio de aproximação
// à fonte do medo específica, em vez de qualquer inimigo.
export function aplicarCond(alvo, cond, turnos = 1, origemId = null) {
  if (!alvo || !cond) return;
  alvo.cond = alvo.cond || [];
  const temDano = !!infoCond(cond)?.dano;
  const base = Math.max(1, turnos || 1);
  const alvoTurnos = temDano ? base : base + 1;
  const ja = alvo.cond.find((c) => c.n === cond);
  if (ja) { ja.turnos = temDano ? ja.turnos + 1 : Math.max(ja.turnos, alvoTurnos); if (origemId) ja.origemId = origemId; }
  else alvo.cond.push({ n: cond, turnos: alvoTurnos, ...(origemId ? { origemId } : {}) });
}

// ---------------- CAMPO TÁTICO (grade 2D rasa: X em metros × 3 pistas de profundidade) ----------------
export const CAMPO_LARGURA = 40;   // metros de frente
export const CAMPO_PISTAS = 3;     // frente / meio / fundo
export const PISTA_M = 1;          // separação entre pistas, em metros (profundidade rasa de beat'em up)
export const CAMPO_JANELA = 12;    // metros visíveis no modo aproximado
export const ALCANCE_CAC = 1.5;    // alcance de corpo-a-corpo — golpe de espada não chega a 2m
export const ALCANCE_ARMA = { curto: 15, medio: 30, longo: 40 };
// Distância entre dois combatentes no campo, em metros (null se algum não tem posição).
export const distCombate = (a, b) => (a?.pos && b?.pos)
  ? Math.hypot(a.pos.x - b.pos.x, (a.pos.lane - b.pos.lane) * PISTA_M) : null;
// Empurra `alvo` para LONGE de `origem`, N metros, sem sair do campo. Devolve a
// nova posição `{x, lane}` — função pura: não muta nada, quem chama é que aplica.
// Empurrão só mexe no eixo X (a profundidade de pista é rasa demais pra valer a pena).
export const empurrarDe = (origem, alvo, metros) => {
  if (!origem?.pos || !alvo?.pos || !metros) return null;
  const dx = alvo.pos.x - origem.pos.x;
  const dir = dx === 0 ? 1 : Math.sign(dx);   // em cima um do outro: empurra pra direita
  const x = Math.max(0, Math.min(CAMPO_LARGURA, Math.round((alvo.pos.x + dir * metros) * 10) / 10));
  return { x, lane: alvo.pos.lane };
};
// Posição inicial: aliados à esquerda, inimigos à direita, espalhados nas pistas.
export const posInicial = (ordem, tipo) => {
  const aliado = tipo === "jogador";
  const mesmos = (ordem || []).filter((o) => o.pos && (o.tipo === "jogador") === aliado).length;
  const lane = mesmos % CAMPO_PISTAS;
  const fila = Math.floor(mesmos / CAMPO_PISTAS);
  return { x: aliado ? 6 + fila * 3 : CAMPO_LARGURA - 6 - fila * 3, lane };
};

// ---------------- TIPOS DE DANO ----------------
// "verdadeiro" atravessa qualquer resistência ou imunidade.
export const TIPOS_DANO = ["físico", "térmico", "químico", "elétrico", "psíquico", "gélido", "ácido", "verdadeiro"];
export const semAcento = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// Tipo de dano de uma arma: deriva da palavra-chave, senão é físico.
export function tipoDanoArma(cat) {
  const kw = semAcento(cat?.kw);
  if (/derretimento|incendi|termic|plasma|maçarico|macarico/.test(kw)) return "térmico";
  if (/toxic|toxina|acid/.test(kw)) return "químico";
  if (/emp|anti-sintetic|eletric|choque/.test(kw)) return "elétrico";
  return "físico";
}
// Tipo de dano de um ataque de criatura: lido do texto de `extra` ("psíquico", "ácido"…).
export function tipoDanoAtaque(atk) {
  const e = semAcento(atk?.extra);
  return TIPOS_DANO.find((t) => e.includes(semAcento(t))) || "físico";
}
// Imunidade declarada a um tipo de dano (habs com efeito imunidade cujo `a` é um tipo).
export function imuneAoDano(habs, tipo) {
  if (!tipo || tipo === "verdadeiro") return null;
  const alvo = semAcento(tipo);
  return (habs || []).find((h) => h.efeito?.tipo === "imunidade" && h.efeito.a
    && TIPOS_DANO.some((t) => semAcento(t) === semAcento(h.efeito.a))
    && semAcento(h.efeito.a) === alvo) || null;
}
// Até onde a arma chega, em metros. Branca fica no corpo-a-corpo (a menos que a
// palavra-chave Alcance estenda); de fogo vai do curto ao longo conforme a chave.
export function alcanceDaArma(cat, pr) {
  const txt = String(pr?.alcanceTxt || "");
  if (cat?.tipo === "branca") return pr?.alcance ? 3 : ALCANCE_CAC;
  if (!pr?.alcance) return ALCANCE_ARMA.curto;
  if (/longo|telesc/i.test(txt)) return ALCANCE_ARMA.longo;
  return ALCANCE_ARMA.medio;
}
