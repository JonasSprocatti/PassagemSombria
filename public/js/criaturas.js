// ============================================================================
//  MOTOR DE CRIATURAS — orientado a objetos.
//
//  O problema que isto resolve: as habilidades das criaturas eram texto solto,
//  e cabia ao Mestre lembrar de aplicar cada uma. Aqui elas viram EFEITOS
//  tipados, que o motor executa sozinho nos momentos certos.
//
//  Para criar uma criatura nova basta descrever os efeitos — o motor cuida do
//  resto, e o que ele não reconhece continua aparecendo como texto para o
//  Mestre resolver na mão. Nada quebra.
// ============================================================================

// ---------------------------------------------------------------------------
//  GATILHOS — quando um efeito acontece
// ---------------------------------------------------------------------------
export const GATILHOS = {
  INICIO_TURNO: "inicio_turno",     // no início do turno da criatura
  FIM_TURNO: "fim_turno",
  AO_ACERTAR: "ao_acertar",         // quando ela acerta um ataque
  AO_SOFRER: "ao_sofrer",           // quando ela sofre dano
  AO_SOFRER_CORPO: "ao_sofrer_corpo", // quando sofre dano corpo a corpo
  AO_MORRER: "ao_morrer",
  AURA: "aura",                     // passiva contínua enquanto viva
  AO_ENTRAR: "ao_entrar",           // ao entrar em combate
};

// ---------------------------------------------------------------------------
//  TIPOS DE EFEITO — o que um efeito faz. Cada um sabe se resolver.
// ---------------------------------------------------------------------------
export const EFEITOS = {
  // Dano direto: { dano: "1d6", alvo: "atacante"|"proprio"|"todos_proximos" }
  dano: {
    rotulo: (e) => `${e.dano} de dano${e.tipoDano ? ` (${e.tipoDano})` : ""} em ${alvoTxt(e.alvo)}`,
    resolver: (e, ctx) => {
      const v = ctx.rolar(e.dano);
      return { tipo: "dano", valor: v, alvo: e.alvo || "atacante",
               texto: `${v} de dano${e.tipoDano ? ` ${e.tipoDano}` : ""}` };
    },
  },
  // Cura ou regeneração: { valor: 25 } ou { dado: "1d6" }
  cura: {
    rotulo: (e) => `recupera ${e.dado || e.valor} PV`,
    resolver: (e, ctx) => {
      const v = e.dado ? ctx.rolar(e.dado) : (e.valor || 0);
      return { tipo: "cura", valor: v, alvo: "proprio", texto: `recupera ${v} PV` };
    },
  },
  // Aplica condição: { cond: "Sangrando", turnos: 2, cd: 13, atributo: "Con" }
  condicao: {
    rotulo: (e) => `${e.cond} por ${e.turnos} turno(s)${e.cd ? ` (${e.atributo || "Con"} CD ${e.cd} evita)` : ""}`,
    resolver: (e) => ({ tipo: "condicao", cond: e.cond, turnos: e.turnos || 1,
                        cd: e.cd, atributo: e.atributo || "Con", alvo: e.alvo || "alvo",
                        texto: `${e.cond} por ${e.turnos || 1} turno(s)` }),
  },
  // Invoca lacaios: { criatura: "Enxame Adaptativo", dado: "1d4" }
  invocar: {
    rotulo: (e) => `invoca ${e.dado || e.qtd} ${e.criatura}`,
    resolver: (e, ctx) => {
      const q = e.dado ? ctx.rolar(e.dado) : (e.qtd || 1);
      return { tipo: "invocar", criatura: e.criatura, qtd: q, texto: `invoca ${q}× ${e.criatura}` };
    },
  },
  // Imunidade ou resistência: { a: "Cegueira" } / { limiar: 10 }
  imunidade: {
    rotulo: (e) => e.limiar ? `ignora ataques abaixo de ${e.limiar} de dano` : `imune a ${e.a}`,
    resolver: (e) => ({ tipo: "imunidade", a: e.a, limiar: e.limiar, texto: "" }),
  },
  // Nega mecânicas num raio: { raio: 15, nega: ["cura","tecnomancia","implantes"] }
  zona: {
    rotulo: (e) => `num raio de ${e.raio}m: ${(e.nega || []).join(", ")} não funcionam`,
    resolver: (e) => ({ tipo: "zona", raio: e.raio, nega: e.nega || [], texto: "" }),
  },
};
const alvoTxt = (a) => ({ atacante: "quem a atingiu", proprio: "si mesma",
  todos_proximos: "todos por perto", alvo: "no alvo" }[a] || "no alvo");

// ---------------------------------------------------------------------------
//  CRIATURA — a classe. Envolve os dados e sabe agir sozinha.
// ---------------------------------------------------------------------------
export class Criatura {
  constructor(dados, rolar) {
    Object.assign(this, dados);
    this._rolar = rolar;                       // injetado: função de rolagem do app
    this.habs = this.habs || [];
    this.ataques = this.ataques || [];
  }

  get viva() { return (this.hp ?? 0) > 0; }
  get ehNave() { return this.tipo === "nave"; }

  // Efeitos declarados que disparam num gatilho.
  efeitosDe(gatilho) {
    return this.habs.filter((h) => h.gatilho === gatilho && h.efeito);
  }

  // Executa todos os efeitos de um gatilho e devolve o que aconteceu,
  // para o app aplicar e narrar. Habilidades sem `efeito` são ignoradas aqui
  // (continuam visíveis como texto para o Mestre resolver).
  disparar(gatilho, contexto = {}) {
    const ctx = { rolar: this._rolar, ...contexto };
    const saidas = [];
    for (const h of this.efeitosDe(gatilho)) {
      const efs = Array.isArray(h.efeito) ? h.efeito : [h.efeito];
      for (const e of efs) {
        const tipo = EFEITOS[e.tipo];
        if (!tipo) continue;
        if (e.chance && Math.random() > e.chance) continue;
        const r = tipo.resolver(e, ctx);
        saidas.push({ ...r, habilidade: h.n, origem: this.nome || this.n });
      }
    }
    return saidas;
  }

  // Um ataque só é ignorado se houver imunidade por limiar (couraça).
  absorve(valorDano) {
    const lim = this.habs.find((h) => h.efeito?.tipo === "imunidade" && h.efeito.limiar);
    return lim ? valorDano < lim.efeito.limiar : false;
  }

  // Descrição legível de uma habilidade — usa o rótulo do efeito quando existe.
  descricaoHab(h) {
    if (h.d) return h.d;
    const efs = Array.isArray(h.efeito) ? h.efeito : [h.efeito];
    return efs.filter(Boolean).map((e) => EFEITOS[e.tipo]?.rotulo(e) || "").filter(Boolean).join(" · ");
  }

  // Ficha resumida, para o rastreador.
  resumo() {
    return { nome: this.n || this.nome, hp: this.hp, hp_max: this.hp_max ?? this.hp,
             cd: this.cd, ameaca: this.ameaca, automaticas: this.habs.filter((h) => h.efeito).length };
  }
}

// ---------------------------------------------------------------------------
//  Fábrica: transforma qualquer entrada do bestiário numa Criatura.
//  Aceita o formato antigo (habilidades em texto) sem alteração.
// ---------------------------------------------------------------------------
export function criar(dadosBrutos, rolar) {
  return new Criatura(JSON.parse(JSON.stringify(dadosBrutos)), rolar);
}

// Valida uma criatura nova e devolve os problemas encontrados — útil ao
// cadastrar criaturas próprias pelo painel de administração.
export function validar(c) {
  const erros = [];
  if (!c.n && !c.nome) erros.push("falta o nome");
  if (c.hp == null && !c.ambiental) erros.push("falta HP");
  if (c.cd == null && !c.ambiental) erros.push("falta CD (defesa)");
  for (const h of c.habs || []) {
    if (!h.efeito) continue;
    const efs = Array.isArray(h.efeito) ? h.efeito : [h.efeito];
    for (const e of efs) {
      if (!EFEITOS[e.tipo]) erros.push(`efeito desconhecido em "${h.n}": ${e.tipo}`);
      if (e.tipo === "dano" && !e.dano) erros.push(`"${h.n}" é dano mas não tem dado`);
      if (e.tipo === "condicao" && !e.cond) erros.push(`"${h.n}" é condição mas não diz qual`);
    }
  }
  return erros;
}
