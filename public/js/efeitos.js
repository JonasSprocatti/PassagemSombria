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
  isolado: { rot: "sem aliados a 5 m de você" },
  alvo_amedrontado: { rot: "contra alvo Amedrontado" },
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

  // { tipo:"alcance_cac", valor:10 } — alcance natural de corpo a corpo, em
  // metros (Braços Telescópicos do Infimor). NÃO soma com a palavra-chave
  // Alcance nem com outra fonte: vale sempre o maior, porque braço não empilha.
  // Guarda 0 como "nada declarado" para não precisar importar ALCANCE_CAC de
  // regras.js aqui (regras.js importa este arquivo — seria import circular).
  alcance_cac: { rotulo: (e) => `alcance corpo a corpo de ${e.valor} m`,
    ficha: (e, k) => { k.alcanceCac = Math.max(k.alcanceCac || 0, e.valor); } },

  // { tipo:"vantagem_cura" } — rola dados de cura com Vantagem (Caminho da
  // Espiral). Vale nos dois sentidos: quem aplica o Kit e quem recebe.
  vantagem_cura: { rotulo: () => "Vantagem nos dados de cura",
    ficha: (e, k) => { k.vantagemCura = true; } },

  // { tipo:"ataque_extra", valor:1 } — ataques a mais dentro da MESMA Ação
  // Principal (Rajada Disciplinada, Não Recuar). gastarAcao conta os ataques
  // feitos na ação e só a dá por gasta quando estouram k.ataquesPorAcao.
  ataque_extra: { rotulo: (e) => `+${e.valor} ataque(s) por Ação Principal`,
    ficha: (e, k) => { k.ataquesPorAcao = (k.ataquesPorAcao || 1) + (e.valor || 1); } },

  // { tipo:"tiro_perfeito" } — o próximo disparo com arma de fogo acerta sem
  // rolagem, ignora alcance e cobertura e causa o dano máximo ×2 (Um Tiro).
  // Vive dentro de um modo: o [data-atq] desliga o modo assim que ele é usado.
  tiro_perfeito: { rotulo: () => "próximo disparo: acerto automático, dano máximo ×2",
    ficha: (e, k) => { k.tiroPerfeito = true; } },

  // { tipo:"marca_em_area" } — a Marca do Caçador pega todos os inimigos de uma vez.
  marca_em_area: { rotulo: () => "a Marca do Caçador pega todos os inimigos em cena",
    ficha: (e, k) => { k.marcaEmArea = true; } },

  // { tipo:"bonus_marca", dado:"1d4" } — dano extra de QUALQUER aliado contra
  // quem esta ficha marcou (Predador Paciente, O Território é Meu). Fontes não
  // somam: fica o dado de maior face.
  bonus_marca: { rotulo: (e) => `aliados causam +${e.dado} contra quem você marcou`,
    ficha: (e, k) => { const f0 = +(String(k.bonusMarca || "").split("d")[1] || 0), f1 = +(String(e.dado).split("d")[1] || 0);
      if (f1 > f0) k.bonusMarca = e.dado; } },

  // { tipo:"exposto_cargas", valor:2 } — quantos ataques do grupo aproveitam a
  // Vulnerabilidade Exposta antes dela se esgotar (99 = o combate inteiro).
  exposto_cargas: { rotulo: (e) => e.valor >= 99 ? "Vulnerabilidade Exposta vale o combate inteiro" : `Vulnerabilidade Exposta vale ${e.valor} ataques`,
    ficha: (e, k) => { k.expostoCargas = Math.max(k.expostoCargas || 1, e.valor || 1); } },

  // { tipo:"acao_de", hab:"Foco à Distância", acao:"Ação de Movimento" } — muda o
  // custo de ação de uma habilidade (as Veteranas que "viram Ação de Movimento").
  acao_de: { rotulo: (e) => `${e.hab} passa a custar ${e.acao}`,
    ficha: (e, k) => { (k.acaoDe = k.acaoDe || {})[e.hab] = e.acao; } },

  // { tipo:"aura", alvo:"aliados"|"inimigos", acerto?, defesa?, raio, inquebravel? }
  // Aura de JOGADOR (a Frequência do Músico). Quem ataca consulta as auras de
  // todas as fichas em combate: aliado dentro do raio soma `acerto`; inimigo
  // dentro do raio tem a Defesa somada de `defesa` (negativo = mais fácil).
  aura: { rotulo: (e) => `aura ${e.raio} m: ${e.alvo === "aliados" ? `aliados ${e.acerto >= 0 ? "+" : ""}${e.acerto} no acerto` : `inimigos ${e.defesa >= 0 ? "+" : ""}${e.defesa} na Defesa`}` },

  // { tipo:"sustenta_aura", pericia:"Performance / Arte", cd:12 } — ao sofrer
  // dano, a aura não cai sozinha: rola a perícia contra a CD pra mantê-la.
  sustenta_aura: { rotulo: (e) => `ao sofrer dano, ${e.pericia} CD ${e.cd} mantém a aura`,
    ficha: (e, k) => { k.sustentaAura = { pericia: e.pericia, cd: e.cd }; } },

  // { tipo:"aura_inquebravel" } — a aura nunca cai por dano (Sinfonia Total).
  aura_inquebravel: { rotulo: () => "a aura não é interrompida por dano",
    ficha: (e, k) => { k.auraInquebravel = true; } },

  // { tipo:"desconto_loja", pct:50 } — 1x/sessão, uma compra na loja sai com
  // desconto (Dono do Contrato). O uso é rastreado pelo id da habilidade.
  desconto_loja: { rotulo: (e) => `1x/sessão: uma compra na loja com ${e.pct}% de desconto`,
    ficha: (e, k) => { k.descontoLoja = Math.max(k.descontoLoja || 0, e.pct || 0); } },

  // ---- Modificadores de UMA habilidade (as Veteranas que "melhoram" a do NV1) ----
  // Todos indexados pelo nome da habilidade: o handler lê k.<mapa>[h.nome].

  // { tipo:"cargas_de", hab:"“Deixem isto comigo!”", valor:2 } — quantas vezes
  // o efeito deixado pela habilidade vale antes de se gastar.
  cargas_de: { rotulo: (e) => `${e.hab} vale ${e.valor} vezes`,
    ficha: (e, k) => { const m = (k.cargasDe = k.cargasDe || {}); m[e.hab] = Math.max(m[e.hab] || 1, e.valor || 1); } },

  // { tipo:"area_de", hab:"Fogo de Supressão", raio:5 } — alvo único vira área.
  area_de: { rotulo: (e) => `${e.hab} passa a pegar uma área de ${e.raio} m`,
    ficha: (e, k) => { (k.areaDe = k.areaDe || {})[e.hab] = Math.max(k.areaDe[e.hab] || 0, e.raio || 0); } },

  // { tipo:"save_desvantagem", hab:"Grito de Saqueador" } — os alvos rolam o
  // teste de resistência contra essa habilidade com Desvantagem.
  save_desvantagem: { rotulo: (e) => `alvos testam contra ${e.hab} com Desvantagem`,
    ficha: (e, k) => { (k.saveDesv = k.saveDesv || {})[e.hab] = true; } },

  // { tipo:"gratis_por_combate", hab:"Ponto Estrutural Crítico" } — 1x por
  // combate essa habilidade sai sem o custo/requisito dela (RAM, dano na nave,
  // precisar ter derrubado alguém…). O uso grátis mora na linha do rastreador.
  gratis_por_combate: { rotulo: (e) => `1x/combate: ${e.hab} sem custo`,
    ficha: (e, k) => { (k.gratisPorCombate = k.gratisPorCombate || {})[e.hab] = true; } },

  // { tipo:"cond_persiste", cond:"Ponto Cego", turnos:1 } — a condição que o
  // próprio ataque desfaria em você dura mais N turnos em vez de sumir na hora.
  cond_persiste: { rotulo: (e) => `${e.cond} persiste ${e.turnos} turno(s) depois de atacar`,
    ficha: (e, k) => { (k.condPersiste = k.condPersiste || {})[e.cond] = e.turnos || 1; } },

  // { tipo:"critico_em", valor:19, quando:"desprevenido" } — margem de crítico maior.
  critico_em: { rotulo: (e) => `crítico com ${e.valor}–20${e.quando ? ` ${CONDICOES_ALVO[e.quando]?.rot || ""}` : ""}`,
    ficha: (e, k) => { (k.criticoEm = k.criticoEm || []).push({ valor: e.valor, quando: e.quando || null }); } },

  // { tipo:"catalogar" } — ao expor o ponto fraco de um inimigo, o TIPO dele
  // entra no catálogo da ficha (f.catalogo) e o grupo inteiro passa a causar
  // +1 de dano contra essa criatura, para sempre.
  catalogar: { rotulo: () => "fraquezas expostas entram no catálogo: +1 de dano do grupo contra o tipo",
    ficha: (e, k) => { k.catalogar = true; } },

  // { tipo:"rouba_modulo" } — o Desmanche arranca uma peça de bancada inteira,
  // que vai pra f.pecasSalvas e se instala de graça na bancada.
  rouba_modulo: { rotulo: () => "o Desmanche arranca um módulo de arma que fica com você",
    ficha: (e, k) => { k.roubaModulo = true; } },

  // { tipo:"disparo_sem_cobertura" } — o próximo disparo ignora cobertura (em
  // modo; o [data-atq] desliga o modo depois do tiro, igual ao tiro_perfeito).
  disparo_sem_cobertura: { rotulo: () => "próximo disparo ignora qualquer cobertura",
    ficha: (e, k) => { k.disparoSemCobertura = true; } },

  // { tipo:"opcao_ataque", id, rot, d, multDano?, cond?, turnos? } — um checkbox
  // a mais na barra de ataque (Tiro Incapacitante: metade do dano, alvo Lento).
  opcao_ataque: { rotulo: (e) => `opção de ataque: ${e.rot}` },

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
    // Fontes da MESMA chance (mesmo dado e mesmo achado) não empilham rolagem:
    // fica a de menor mínimo. É o que deixa a progressão do Catador (4-6 → 3-6
    // → 2-6) ser declarada em três fontes sem a ficha rolar três d6.
    saque: (e, ctx) => {
      ctx.rolagens = ctx.rolagens || [];
      const ja = ctx.rolagens.find((r) => r.dado === e.dado && r.oque === e.oque);
      if (!ja) ctx.rolagens.push({ ...e });
      else if (e.minimo < ja.minimo) ja.minimo = e.minimo;
    } },

  // { tipo:"reducao_dano", valor:2 } — abate dano físico recebido (Endurecer)
  reducao_dano: {
    rotulo: (e) => `−${e.valor} de dano físico recebido`,
    sofrer: (e, ctx) => { ctx.reducao = (ctx.reducao || 0) + e.valor; } },

  // { tipo:"sem_critico" } — ataques contra você nunca multiplicam por crítico
  // (armadura anticrítica). Só anula o ×2 do crítico em si; outro multiplicador
  // que não seja especificamente "é crítico" (ex. furtivo do Assassino) continua valendo.
  sem_critico: {
    rotulo: () => `imune a dano crítico`,
    sofrer: (e, ctx) => { ctx.semCritico = true; } },

  // { tipo:"pv_max", valor:5 } — vida máxima extra enquanto a fonte estiver ativa
  // (implante, item equipado, passiva de modo). Some em k.pvMaxBonus; calc()
  // soma isso ao f.pvMax bruto pra formar k.pvMax (o teto de verdade em jogo).
  pv_max: {
    rotulo: (e) => `${sinal(e.valor)} de PV máximo`,
    ficha: (e, k) => { k.pvMaxBonus = (k.pvMaxBonus || 0) + e.valor; } },

  // { tipo:"escudo_max", valor:10 } — escudo concedido por algo além da armadura
  // com `absorve` (implante, filosofia, modo). Some em k.escudoBonus; calc()
  // soma isso ao absorve da armadura pra formar k.escudoMax.
  escudo_max: {
    rotulo: (e) => `${sinal(e.valor)} de Escudo`,
    ficha: (e, k) => { k.escudoBonus = (k.escudoBonus || 0) + e.valor; } },

  // { tipo:"resistencia", a:"psíquico" } — mais fraco que imunidade: não anula,
  // só dá Vantagem em qualquer teste de resistência (salvaguarda/CD) contra
  // aquele tipo de dano elemental ou condição/efeito ("a" casa com o nome da
  // condição, ex. "Paralisado", ou com um TIPOS_DANO, ex. "psíquico").
  resistencia: {
    rotulo: (e) => `resistência a ${e.a} (Vantagem nos testes de resistência)` },

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
    // A Veterana só entra a partir do nível 5; a Lendária da raça e o Marco da
    // classe, no 10 — os dois coexistem na mesma ficha, por isso são fontes
    // separadas com origens distintas.
    if (c?.vet && (f.nivel || 1) >= 5 && c.vet.efeitos)
      fontes.push(new Portador(c.vet.n, { efeitos: c.vet.efeitos }, "veterana"));
    if (c?.lendaria && (f.nivel || 1) >= 10 && c.lendaria.efeitos)
      fontes.push(new Portador(c.lendaria.n, { efeitos: c.lendaria.efeitos }, "marco de classe"));
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
    const ctx = { reducao: 0, semCritico: false, fontes: [] };
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
  // Resistências (mais fracas que imunidade): lista normalizada em minúsculas,
  // pra bater com o nome da condição ou tipo de dano no momento do teste.
  resistencias() {
    return this.fontes.flatMap((x) => x.efeitos.filter((e) => e.tipo === "resistencia").map((e) => (e.a || "").toLowerCase()));
  }
  recursos() {
    return this.fontes.flatMap((x) => x.efeitos.filter((e) => e.tipo === "recurso")
      .map((e) => ({ ...e, fonte: x.nome })));
  }
  // Perícias que rolam com Vantagem por efeito declarado (Rosto na Multidão do
  // Espião, Braço Mecânico Hidráulico, Código Corporativo…). Devolve o nome da
  // fonte pra quem for rolar poder dizer de onde veio a Vantagem.
  // Checkboxes extras da barra de ataque (Tiro Incapacitante).
  opcoesAtaque() {
    return this.fontes.flatMap((x) => x.efeitos.filter((e) => e.tipo === "opcao_ataque").map((e) => ({ ...e, fonte: x.nome })));
  }
  // Auras de jogador declaradas nesta ficha (Frequência do Músico).
  auras() {
    return this.fontes.flatMap((x) => x.efeitos.filter((e) => e.tipo === "aura").map((e) => ({ ...e, fonte: x.nome })));
  }
  vantagensPericia() {
    return this.fontes.flatMap((x) => x.efeitos
      .filter((e) => e.tipo === "vantagem" && e.em === "pericia" && e.pericia)
      .map((e) => ({ pericia: e.pericia, fonte: x.nome })));
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
    // "__outro__" é a sentinela do select "Imune a" (ver admin.js): o admin escolheu
    // "Outro" mas não chegou a descrever; sem isto, salvava assim mesmo e a imunidade
    // ficava inerte pra sempre, sem avisar ninguém.
    if (e.tipo === "imunidade" && (!e.a || e.a === "__outro__")) erros.push("imunidade não diz a quê");
    if (e.tipo === "resistencia" && (!e.a || e.a === "__outro__")) erros.push("resistência não diz a quê");
    if (e.tipo === "alcance_cac" && !(e.valor > 0)) erros.push("alcance corpo a corpo precisa de um valor em metros maior que zero");
    if (e.tipo === "pv_max" && typeof e.valor !== "number") erros.push("PV máximo extra sem valor numérico");
    if (e.tipo === "escudo_max" && typeof e.valor !== "number") erros.push("escudo extra sem valor numérico");
    if (e.tipo === "multiplicar_dano" && !e.fator) erros.push("multiplicar dano sem fator");
    if (e.tipo === "multiplicar_dano" && !CONDICOES_ALVO[e.quando]) erros.push(`situação desconhecida: ${e.quando}`);
    if (e.tipo === "bonus_recompensa" && typeof e.pct !== "number") erros.push("bônus de recompensa sem percentual");
    if (e.tipo === "chance_extra" && !e.dado) erros.push("chance extra sem dado");
  }
  return erros;
}
