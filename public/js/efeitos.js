// ============================================================================
//  MOTOR DE EFEITOS — o irmão do motor de criaturas, para o lado dos jogadores.
//
//  Antes, os bônus de implantes, filosofias, raças e classes estavam escritos
//  no código pelo nome ("se tem Placas Subdérmicas, +1 CD"). Adicionar conteúdo
//  novo exigia mexer no app.
//
//  Aqui qualquer elemento do jogo — raça, classe, filosofia, implante, armadura,
//  arma, palavra-chave, consumível, nave ou NPC — declara EFEITOS tipados, e o
//  motor os aplica no momento certo. Conteúdo sem efeitos declarados continua
//  funcionando como texto, exatamente como antes.
// ============================================================================

// ---------------------------------------------------------------------------
//  MOMENTOS — quando um efeito é considerado
// ---------------------------------------------------------------------------
export const MOMENTOS = {
  FICHA: "ficha",             // ao derivar os números da ficha (CD, RAM, iniciativa…)
  AO_ATACAR: "ao_atacar",     // modifica acerto e dano de um ataque
  AO_SOFRER: "ao_sofrer",     // quando o personagem sofre dano
  AO_CURAR: "ao_curar",       // quando cura um aliado (Bio-feedback do Cinético)
  AO_SAQUEAR: "ao_saquear",   // ao receber créditos ou vasculhar (Catador, Prospector)
  INICIO_COMBATE: "inicio_combate",
  INICIO_TURNO: "inicio_turno",
  DESCANSO_CURTO: "descanso_curto",
  DESCANSO_LONGO: "descanso_longo",
};

// CONDIÇÕES DE ALVO — quando um efeito de ataque só vale em certas situações.
// É o que faltava para o Assassino, o Pirata e o Espião funcionarem sozinhos.
export const CONDICOES_ALVO = {
  desprevenido: { rot: "contra alvo desprevenido ou que ainda não agiu" },
  em_nave: { rot: "dentro de naves e espaços confinados" },
  disfarcado: { rot: "quando disfarçado" },
  social: { rot: "em cena social" },
};

// ---------------------------------------------------------------------------
//  EFEITOS — cada tipo sabe se descrever e se aplicar
// ---------------------------------------------------------------------------
export const EFEITOS = {
  // { tipo:"atributo", attr:"For", valor:2 }
  atributo: { rotulo: (e) => `${sinal(e.valor)} de ${e.attr}`,
    ficha: (e, k) => { k.attr[e.attr] = (k.attr[e.attr] || 0) + e.valor; } },

  // { tipo:"defesa", valor:1 }
  defesa: { rotulo: (e) => `${sinal(e.valor)} de Defesa`,
    ficha: (e, k) => { k.cd += e.valor; } },

  // { tipo:"ram", valor:2 }
  ram: { rotulo: (e) => `${sinal(e.valor)} Slot(s) de RAM`,
    ficha: (e, k) => { k.ramMax = Math.max(0, k.ramMax + e.valor); } },

  // { tipo:"iniciativa", valor:2 }
  iniciativa: { rotulo: (e) => `${sinal(e.valor)} na Iniciativa`,
    ficha: (e, k) => { k.iniciativa += e.valor; } },

  // { tipo:"deslocamento", valor:9, modo:"soma"|"dobra" }
  deslocamento: { rotulo: (e) => e.modo === "dobra" ? "dobra o Deslocamento" : `${sinal(e.valor)}m de Deslocamento`,
    ficha: (e, k) => { k.deslocamento = e.modo === "dobra" ? k.deslocamento * 2 : k.deslocamento + e.valor; } },

  // { tipo:"pericia", pericia:"Mecânica", valor:2 }
  pericia: { rotulo: (e) => `${sinal(e.valor)} em ${e.pericia}`,
    ficha: (e, k) => { k.per[e.pericia] = (k.per[e.pericia] || 0) + e.valor; } },

  // { tipo:"conjuracao", valor:1 }
  conjuracao: { rotulo: (e) => `${sinal(e.valor)} na Conjuração`,
    ficha: (e, k) => { k.conj += e.valor; } },

  // { tipo:"dano", valor:2, contra:"branca"|"fogo"|"robos", quando:"desprevenido" }
  // `contra` filtra por tipo de arma/alvo; `quando` filtra pela situação do momento.
  dano: { rotulo: (e) => `${sinal(e.valor)} de dano${e.contra ? ` com ${rotContra(e.contra)}` : ""}${e.quando ? ` ${CONDICOES_ALVO[e.quando]?.rot || ""}` : ""}`,
    ataque: (e, ctx) => { if (!aplicaAqui(e, ctx)) return; ctx.dano += e.valor; } },

  // { tipo:"acerto", valor:2, contra:"fogo", quando:"desprevenido" }
  acerto: { rotulo: (e) => `${sinal(e.valor)} no acerto${e.contra ? ` com ${rotContra(e.contra)}` : ""}${e.quando ? ` ${CONDICOES_ALVO[e.quando]?.rot || ""}` : ""}`,
    ataque: (e, ctx) => { if (!aplicaAqui(e, ctx)) return; ctx.acerto += e.valor; } },

  // { tipo:"vantagem", em:"ataque"|"pericia", pericia:"Atletismo" }
  vantagem: { rotulo: (e) => `Vantagem em ${e.pericia || e.em || "testes"}`,
    ataque: (e, ctx) => { if (e.em === "ataque") ctx.vantagem = true; } },

  // { tipo:"imunidade", a:"queda" }
  imunidade: { rotulo: (e) => `imune a ${e.a}` },

  // { tipo:"recurso", n:"Fôlego de Aço", freq:"curto"|"longo"|"sessao" }
  recurso: { rotulo: (e) => `${e.n} — 1×/${rotFreq(e.freq)}` },

  // { tipo:"multiplicar_dano", fator:2, quando:"desprevenido" } — o dano dobra
  multiplicar_dano: {
    rotulo: (e) => `dano ×${e.fator} ${CONDICOES_ALVO[e.quando]?.rot || ""}`,
    ataque: (e, ctx) => { if (ctx.situacao?.[e.quando]) ctx.multDano = Math.max(ctx.multDano || 1, e.fator); } },

  // { tipo:"cura_reflexa", valor:2 } — cura a si ao curar outro
  cura_reflexa: {
    rotulo: (e) => `recupera ${e.valor} PV ao curar um aliado`,
    curar: (e, ctx) => { ctx.curaPropria = (ctx.curaPropria || 0) + e.valor; } },

  // { tipo:"bonus_recompensa", pct:20 } — recompensas maiores
  bonus_recompensa: {
    rotulo: (e) => `+${e.pct}% em recompensas de missão`,
    saque: (e, ctx) => { ctx.pct = (ctx.pct || 0) + e.pct; } },

  // { tipo:"chance_extra", dado:"1d6", minimo:4, oque:"item valioso" }
  chance_extra: {
    rotulo: (e) => `${e.dado}: com ${e.minimo}+ acha ${e.oque}`,
    saque: (e, ctx) => { (ctx.rolagens = ctx.rolagens || []).push(e); } },

  // { tipo:"reducao_dano", valor:2 } — abate dano físico recebido (Endurecer)
  reducao_dano: {
    rotulo: (e) => `−${e.valor} de dano físico recebido`,
    sofrer: (e, ctx) => { ctx.reducao = (ctx.reducao || 0) + e.valor; } },

  // { tipo:"por_implante", cada:3, attr:"conj", valor:1 } — escala com o cromo
  por_implante: {
    rotulo: (e) => `+${e.valor} em ${e.attr === "conj" ? "Conjuração" : e.attr} a cada ${e.cada} implantes`,
    ficha: (e, k, ctx) => {
      const n = (ctx?.implantes || []).length;
      const b = Math.floor(n / e.cada) * e.valor;
      if (!b) return;
      if (e.attr === "conj") k.conj += b;
      else if (e.pericia) k.per[e.pericia] = (k.per[e.pericia] || 0) + b;
      else if (e.attr) k.attr[e.attr] = (k.attr[e.attr] || 0) + b;
    } },

  // { tipo:"defesa_veiculo", valor:2 } — vale para a nave pilotada, não para o corpo
  defesa_veiculo: {
    rotulo: (e) => `+${e.valor} na Defesa do veículo pilotado` },

  // { tipo:"nave", campo:"casco_max", valor:15 } — para melhorias de nave
  nave: { rotulo: (e) => `${sinal(e.valor)} de ${e.campo.replace("_max", "")}`,
    naveFicha: (e, n) => { n[e.campo] = (n[e.campo] || 0) + e.valor; } },
};

// Um efeito de ataque só entra se o tipo de arma/alvo bater E a situação bater.
const aplicaAqui = (e, ctx) => {
  if (e.contra && !ctx.combina(e.contra)) return false;
  if (e.quando && !ctx.situacao?.[e.quando]) return false;
  return true;
};
const sinal = (v) => (v >= 0 ? `+${v}` : `${v}`);
const rotFreq = (f) => ({ curto: "descanso curto", longo: "descanso longo", sessao: "sessão" }[f] || f);
const rotContra = (c) => ({ branca: "armas brancas", fogo: "armas de fogo", robos: "robôs e sintéticos" }[c] || c);

// ---------------------------------------------------------------------------
//  PORTADOR — qualquer coisa que carrega efeitos (implante, filosofia, raça…)
// ---------------------------------------------------------------------------
export class Portador {
  constructor(nome, dados = {}, origem = "") {
    this.nome = nome; this.origem = origem;
    Object.assign(this, dados);
    this.efeitos = normalizaEfeitos([
      ...(Array.isArray(dados.efeitos) ? dados.efeitos : dados.efeitos ? [dados.efeitos] : []),
      ...efeitosDeHabilidades(dados.habilidades || dados.hab || []),
    ]);
  }
  efeitosDe(momento) {
    return this.efeitos.filter((e) => (e.momento || MOMENTOS.FICHA) === momento);
  }
  // Descrição legível: usa o texto do autor, ou monta a partir dos efeitos.
  descricao() {
    if (this.e || this.d) return this.e || this.d;
    return this.efeitos.map((e) => EFEITOS[e.tipo]?.rotulo(e)).filter(Boolean).join(" · ");
  }
  get automatico() { return this.efeitos.length > 0; }
}

const normalizaEfeitos = (efs) => (Array.isArray(efs) ? efs : efs ? [efs] : []).filter((e) => e && EFEITOS[e.tipo]);

// Raças e classes guardam os efeitos dentro de cada habilidade passiva.
// Esta função os reúne para o Portador tratá-los como se fossem do item.
export const efeitosDeHabilidades = (habs = []) =>
  habs.filter((h) => h.tipo !== "Ativa").flatMap((h) => (h.efeitos || []).map((e) => ({ ...e, _hab: h.n })));

// ---------------------------------------------------------------------------
//  FICHA — reúne todas as fontes de efeito de um personagem
// ---------------------------------------------------------------------------
export class FichaEfeitos {
  constructor(fontes = []) { this.fontes = fontes.filter(Boolean); }

  static de(f, { RACAS, CLASSES, FILOSOFIAS, IMPLANTES, ARMADURAS, chavesDeArmasEquipadas = [], modosAtivos = [] }) {
    const fontes = [];
    const r = RACAS.find((x) => x.nome === f.raca);
    if (r) fontes.push(new Portador(r.nome, r, "raça"));
    const c = CLASSES[f.classe];
    if (c) fontes.push(new Portador(f.classe, c, "classe"));
    // A Veterana só entra a partir do nível 5; a Lendária da raça, no 10.
    if (c?.vet && (f.nivel || 1) >= 5 && c.vet.efeitos)
      fontes.push(new Portador(c.vet.n, { efeitos: c.vet.efeitos }, "veterana"));
    if (r?.lendaria && (f.nivel || 1) >= 10 && r.lendaria.efeitos)
      fontes.push(new Portador(r.lendaria.n, { efeitos: r.lendaria.efeitos }, "lendária"));
    const fi = FILOSOFIAS[f.filosofia];
    if (fi) fontes.push(new Portador(f.filosofia, fi, "filosofia"));
    for (const nome of f.implantes || []) {
      const im = IMPLANTES.find((x) => x.n === nome);
      if (im) fontes.push(new Portador(nome, im, "implante"));
    }
    const arm = (f.inventario || []).find((i) => i.tipo === "armadura" && i.equip);
    if (arm) { const a = ARMADURAS.find((x) => x.n === arm.nome);
      if (a) fontes.push(new Portador(arm.nome, a, "armadura")); }
    // Armas equipadas também carregam efeitos — pelas palavras-chave delas.
    // (Aparar concede +1 de Defesa; Aderência dá Vantagem em Atletismo.)
    for (const w of chavesDeArmasEquipadas || [])
      fontes.push(new Portador(w.nome, { efeitos: w.efeitos }, "arma"));
    // Modos ligados no momento (gás respirado, postura assumida…).
    for (const mo of modosAtivos || [])
      fontes.push(new Portador(mo.nome, { efeitos: mo.efeitos }, "modo ativo"));
    return new FichaEfeitos(fontes);
  }

  // Aplica sobre os valores já calculados. É aditivo: o que o calc() clássico
  // faz continua valendo, e os efeitos declarados entram por cima.
  aplicarNaFicha(k, ctx = {}) {
    for (const fonte of this.fontes)
      for (const e of fonte.efeitosDe(MOMENTOS.FICHA))
        EFEITOS[e.tipo]?.ficha?.(e, k, ctx);
    return k;
  }

  // Redução de dano acumulada (Endurecer e afins).
  aoSofrer() {
    const ctx = { reducao: 0, fontes: [] };
    for (const fonte of this.fontes)
      for (const e of fonte.efeitosDe(MOMENTOS.AO_SOFRER))
        if (EFEITOS[e.tipo]?.sofrer) { EFEITOS[e.tipo].sofrer(e, ctx); ctx.fontes.push(fonte.nome); }
    return ctx;
  }
  // Bônus que valem para o veículo pilotado, não para o corpo.
  defesaVeiculo() {
    return this.fontes.flatMap((x) => x.efeitos.filter((e) => e.tipo === "defesa_veiculo"))
      .reduce((a, e) => a + (e.valor || 0), 0);
  }

  // Modificadores de um ataque. `situacao` traz o contexto do momento
  // (alvo desprevenido, luta dentro de nave…) para efeitos condicionais.
  modificarAtaque({ acerto = 0, dano = 0, arma = null, alvo = null, situacao = {} } = {}) {
    const ctx = { acerto, dano, vantagem: false, multDano: 1, situacao,
      combina: (contra) => {
        if (contra === "branca" || contra === "fogo") return arma?.tipo === contra;
        if (contra === "robos") return /rob|sintét|drone|andr/i.test(`${alvo?.nome || ""} ${alvo?.categoria || ""}`);
        return false;
      } };
    for (const fonte of this.fontes)
      for (const e of fonte.efeitosDe(MOMENTOS.AO_ATACAR))
        EFEITOS[e.tipo]?.ataque?.(e, ctx);
    return ctx;
  }

  // Quando o personagem cura um aliado — devolve o que ele mesmo recupera.
  aoCurar() {
    const ctx = { curaPropria: 0, fontes: [] };
    for (const fonte of this.fontes)
      for (const e of fonte.efeitosDe(MOMENTOS.AO_CURAR))
        if (EFEITOS[e.tipo]?.curar) { EFEITOS[e.tipo].curar(e, ctx); ctx.fontes.push(fonte.nome); }
    return ctx;
  }

  // Ao receber recompensa ou vasculhar destroços.
  aoSaquear() {
    const ctx = { pct: 0, rolagens: [], fontes: [] };
    for (const fonte of this.fontes)
      for (const e of fonte.efeitosDe(MOMENTOS.AO_SAQUEAR))
        if (EFEITOS[e.tipo]?.saque) { EFEITOS[e.tipo].saque(e, ctx); ctx.fontes.push(fonte.nome); }
    return ctx;
  }

  // Tudo o que o personagem tem de automático, para mostrar na ficha.
  resumo() {
    return this.fontes.filter((x) => x.automatico).map((x) => ({
      nome: x.nome, origem: x.origem,
      efeitos: x.efeitos.map((e) => EFEITOS[e.tipo]?.rotulo(e)).filter(Boolean),
    }));
  }
  imunidades() {
    return this.fontes.flatMap((x) => x.efeitos.filter((e) => e.tipo === "imunidade").map((e) => e.a));
  }
  recursos() {
    return this.fontes.flatMap((x) => x.efeitos.filter((e) => e.tipo === "recurso")
      .map((e) => ({ ...e, fonte: x.nome })));
  }
}

// ---------------------------------------------------------------------------
//  Validação — a mesma rede de proteção do motor de criaturas.
// ---------------------------------------------------------------------------
export function validarEfeitos(efs) {
  const erros = [];
  for (const e of Array.isArray(efs) ? efs : [efs]) {
    if (!e || !e.tipo) { erros.push("efeito sem tipo"); continue; }
    if (!EFEITOS[e.tipo]) { erros.push(`tipo desconhecido: ${e.tipo}`); continue; }
    if (["atributo", "defesa", "ram", "iniciativa", "pericia", "conjuracao", "dano", "acerto"].includes(e.tipo)
        && typeof e.valor !== "number") erros.push(`"${e.tipo}" precisa de um valor numérico`);
    if (e.tipo === "atributo" && !e.attr) erros.push("efeito de atributo não diz qual");
    if (e.tipo === "pericia" && !e.pericia) erros.push("efeito de perícia não diz qual");
    if (e.tipo === "recurso" && !e.n) erros.push("recurso sem nome");
    if (e.tipo === "multiplicar_dano" && !e.fator) erros.push("multiplicar dano sem fator");
    if (e.tipo === "multiplicar_dano" && !CONDICOES_ALVO[e.quando]) erros.push(`situação desconhecida: ${e.quando}`);
    if (e.tipo === "bonus_recompensa" && typeof e.pct !== "number") erros.push("bônus de recompensa sem percentual");
    if (e.tipo === "chance_extra" && !e.dado) erros.push("chance extra sem dado");
  }
  return erros;
}
