// ============================================================================
//  FERRAMENTAS DO MESTRE — tabelas aleatórias, facções e referência rápida.
//  Tudo no clima do Sistema Solar de Passagem Sombria.
// ============================================================================

// ---------------------------------------------------------------------------
//  FACÇÕES (do livro) — usadas no rastreador de reputação
// ---------------------------------------------------------------------------
export const FACCOES = [
  { n: "Genotheca S.A.", sede: "Vênus", cor: "#8be05a",
    d: "Corporação de bioengenharia que patenteia genomas. Se você tem cromo biológico, provavelmente deve royalties a eles." },
  { n: "Cofre Urak", sede: "Urano", cor: "#a0e0e0",
    d: "O cartório blindado do sistema. Guardam bens, segredos e dívidas no gelo — e cobram juros em favores." },
  { n: "Caminho da Espiral", sede: "Itinerante", cor: "#c060f0",
    d: "Culto-laboratório da adaptação genética. Recrutam nas docas baixas e pagam bem por cobaias." },
  { n: "Sindicato de Deimos", sede: "Marte", cor: "#c1440e",
    d: "Senhores da guerra marcianos e frotas mercenárias. Vendem ordem — e criam o caos que a torna necessária." },
  { n: "Conclave Marciano", sede: "Marte", cor: "#f0a860",
    d: "A autoridade tradicional do sangue duplo. Honra, duelo e uma burocracia militar implacável." },
  { n: "Frota Renegada", sede: "Cinturão", cor: "#f07a7a",
    d: "Piratas organizados sob o Comodoro. Cobram pedágio nas rotas que ninguém patrulha." },
  { n: "Cultos do Anel", sede: "Saturno", cor: "#e3d9a8",
    d: "Sacerdotes-moldadores satas. Curam, remodelam corpos e cobram em devoção." },
  { n: "Corte de Netuno", sede: "Netuno", cor: "#3a6ecc",
    d: "Telepatas proturnos e a diplomacia das sombras. Sabem o que você pensou antes de você dizer." },
];

export const NIVEIS_REPUTACAO = [
  { v: -3, n: "Caçado",     cor: "#f07a7a", d: "Atiram primeiro. Há um preço pela sua cabeça." },
  { v: -2, n: "Hostil",     cor: "#e08040", d: "Portas fechadas, preços dobrados, emboscadas." },
  { v: -1, n: "Desconfiado",cor: "#c0a060", d: "Atendem, mas vigiam. Sem crédito, sem favores." },
  { v:  0, n: "Neutro",     cor: "#8189a3", d: "Você é mais um rosto no sistema." },
  { v:  1, n: "Cordial",    cor: "#7ad0f0", d: "Pequenos descontos e informação de superfície." },
  { v:  2, n: "Aliado",     cor: "#59e3c8", d: "Acesso a contratos fechados e apoio em apuros." },
  { v:  3, n: "Irmão de Sangue", cor: "#8be05a", d: "Abrem os cofres. Mandam gente morrer por você." },
];

// ---------------------------------------------------------------------------
//  TABELAS ALEATÓRIAS
// ---------------------------------------------------------------------------
export const TABELAS = {
  loot: {
    n: "Saque", ic: "💎",
    d: "O que sobrou no corpo, no contêiner ou no cofre arrombado.",
    itens: [
      "Um pente de munição queimado e meio cartucho aproveitável.",
      "{creditos} CG em fichas de estação, um pouco descascadas.",
      "Um datachip lacrado — precisa de Tecnomancia (CD 13) para abrir.",
      "Kit Médico usado pela metade. Serve para uma aplicação.",
      "Um implante arrancado às pressas, ainda com sangue seco. Vale {creditos} CG num Body Shop.",
      "Foto holográfica de uma família que ninguém vai reclamar.",
      "Uma chave biométrica ligada a um cofre que ninguém sabe onde fica.",
      "Ração de longa duração de sabor indeterminado (×1d4).",
      "Um frasco de Néctar da Orquídea de Sangue. Uma dose.",
      "Peça de nave sobressalente: vale {creditos} CG ou um reparo de casco.",
      "Um diário de bordo com as três últimas coordenadas apagadas.",
      "Arma branca de origem marciana, com o nome de outro dono gravado.",
      "Um cartão de dívida do Cofre Urak. Em nome de quem?",
      "Amostra biológica em estase, etiquetada apenas com 'ESPIRAL-7'.",
      "Nada. Alguém chegou antes.",
    ],
  },
  complicacao: {
    n: "Complicação", ic: "⚠",
    d: "Aquilo que dá errado quando o plano estava dando certo demais.",
    itens: [
      "O alarme dispara — reforços chegam em 1d4 rodadas.",
      "A gravidade artificial falha por 1d6 turnos: tudo flutua.",
      "Um vazamento de atmosfera começa. A sala esvazia em 3 rodadas.",
      "A porta trava atrás do grupo. Tecnomancia ou Mecânica (CD 15) para abrir.",
      "Alguém reconhece um dos jogadores — e não é uma boa lembrança.",
      "As luzes morrem. Só quem tem visão no escuro enxerga.",
      "Um segundo grupo chega atrás do mesmo objetivo.",
      "A carga é falsa. A verdadeira nunca esteve ali.",
      "Um dos inimigos está gravando tudo e transmitindo ao vivo.",
      "Incêndio elétrico: 1d6 de dano por turno para quem ficar na sala.",
      "O chão cede. Teste de Acrobacia (CD 13) ou cai um nível abaixo.",
      "O contato do grupo estava mentindo — e já foi embora.",
      "Um civil aparece no meio do fogo cruzado.",
      "O sistema de segurança religa e marca os jogadores como intrusos permanentes.",
      "A nave começa a partir sem eles.",
    ],
  },
  rumor: {
    n: "Rumor de Estação", ic: "🗣",
    d: "O que se ouve no bar, na doca e na fila do reabastecimento.",
    itens: [
      "Dizem que uma nave saiu da Passagem Sombria com a tripulação toda viva — e todos com a mesma voz.",
      "A Genotheca está pagando o triplo por amostras de sangue Ven'y. Ninguém pergunta por quê.",
      "Tem um Monólito novo no cinturão. Ou é velho e só agora acordou.",
      "O Comodoro perdeu duas naves para algo que não aparece no radar.",
      "Um Infimor apareceu vendendo tecnologia pré-Passagem no sucatão. Sumiu no dia seguinte.",
      "As colônias de Ío pararam de responder há seis dias. A Guilda diz que é falha de antena.",
      "Um Proturno está comprando memórias de quem esteve na Passagem. Paga em créditos limpos.",
      "Tem gente entrando no Caminho da Espiral e saindo... diferente. Mais alto. Mais calado.",
      "O Cofre Urak abriu uma conta em nome de alguém que morreu há vinte anos.",
      "Uma quimera fugiu de um laboratório e está caçando nos dutos da estação.",
      "Os preços do combustível de dobra vão triplicar. Alguém está estocando.",
      "Um capitão vendeu a própria nave por uma coordenada num guardanapo.",
    ],
  },
  nave: {
    n: "Nome de Nave", ic: "🚀",
    d: "Para batizar a nave da tripulação ou a que acabou de aparecer no radar.",
    itens: [
      "Fôlego Curto", "Silêncio Longo", "Dívida Antiga", "Última Palavra", "Sem Retorno Previsto",
      "A Piada do Vácuo", "Filha da Poeira", "Orbita Torta", "Cão-de-Guarda de Plutão", "Terceira Tentativa",
      "Nada Consta", "A Paciência do Gelo", "Sucata Coroada", "Voz de Netuno", "Erro de Cálculo",
      "Mãe Sintética", "O Preço Justo", "Rasante", "Memória Corrompida", "Ainda Aqui",
    ],
  },
  npc: {
    n: "NPC Instantâneo", ic: "👤",
    d: "Alguém que os jogadores decidiram conversar e você não tinha preparado.",
    monta: true,
    nomes: ["Vex", "Solenne", "Brox", "Tik", "Rhoswen", "Halvex", "Yssen", "Corvo", "Ferrolho", "Vell",
            "Draska", "Nym", "Ozar", "Sibila", "Klekt", "Marrow", "Ilza", "Puck", "Tunn", "Ravi"],
    sobrenomes: ["Vantroix", "da Bruma", "de Deimos", "Sem-Órbita", "Ka", "Ilk", "do Anel", "Nove-Dedos",
                 "Cinza", "de Ío", "Sem-Nome", "Terceiro", "da Fenda", "Oxidado"],
    papeis: ["mecânico de doca", "traficante de dados", "cozinheiro de estação", "ex-soldado do Conclave",
             "piloto de carga", "sacerdote do Anel", "cobrador do Cofre Urak", "catador de sucata",
             "médico sem licença", "informante de bar", "segurança corporativo", "artista holográfico"],
    tracos: ["fala rápido demais", "nunca olha nos olhos", "ri na hora errada", "cheira a fumaça e óleo",
             "tem um implante zumbindo alto", "usa luvas mesmo dentro da estação", "chama todo mundo de 'chefe'",
             "carrega uma foto amassada", "tosse a cada duas frases", "tem sotaque impossível de localizar",
             "está claramente com medo de alguém", "bebe algo que ninguém reconhece"],
    querem: ["sair da estação a qualquer custo", "achar um irmão desaparecido", "pagar uma dívida com o Cofre Urak",
             "vender algo que não deveria ter", "vingar-se de um capitão", "proteger uma criança",
             "conseguir cromo novo", "esquecer o que viu na Passagem", "ser deixado em paz",
             "provar que estava certo", "voltar para casa", "um trabalho honesto pela primeira vez"],
  },
};

// ---------------------------------------------------------------------------
//  REFERÊNCIA RÁPIDA (Tela do Mestre)
// ---------------------------------------------------------------------------
export const REFERENCIA = {
  cds: { n: "Escala de Dificuldade (CD)", ic: "🎯", linhas: [
    ["CD 5", "Trivial — quase não vale rolar."],
    ["CD 10", "Fácil — um profissional faz sem pensar."],
    ["CD 13", "Médio — o padrão de uma tarefa real."],
    ["CD 15", "Difícil — exige treino ou sorte."],
    ["CD 18", "Muito difícil — poucos conseguem."],
    ["CD 20+", "Heroico — a lenda começa aqui."],
  ]},
  turno: { n: "Economia do Turno (6 segundos)", ic: "⏱", linhas: [
    ["Ação Principal", "Atacar, conjurar Script, usar kit médico, operar painéis."],
    ["Ação de Movimento", "Andar até 9m, recarregar, sacar arma, buscar cobertura, levantar-se."],
    ["Ação Livre", "Falar brevemente, apertar botão, soltar item. Limite de 1 por turno."],
    ["Reação", "Habilidade fora do seu turno (ex: Firewall Ativo) ou ataque de oportunidade."],
  ]},
  defesa: { n: "Defesa e Armaduras", ic: "🛡", linhas: [
    ["Fórmula", "CD = 10 + Mod. Destreza + Bônus da Armadura."],
    ["Leves (+0 a +1)", "Soma toda a Destreza."],
    ["Médias (+2)", "Soma Destreza até o limite de +2."],
    ["Pesadas (+3 a +8)", "Não soma Destreza: apenas 10 + Bônus."],
  ]},
  criticos: { n: "Críticos, Falhas e Munição", ic: "💥", linhas: [
    ["Crítico (20 natural)", "Acerto automático; dobra os dados de dano (não os bônus fixos)."],
    ["Falha Crítica (1 natural)", "A arma emperra ou superaquece: custa a Ação de Movimento do próximo turno."],
    ["Munição (Pentes)", "1 pente = 3 turnos atirando. Rajada consome 2. Recarregar = Ação de Movimento."],
    ["Morte Iminente (0 PV)", "Inconsciente. No início do turno rola 1d20 puro: 10+ sucesso. 3 sucessos estabilizam, 3 falhas matam."],
  ]},
  descanso: { n: "Descansos", ic: "☾", linhas: [
    ["Curto (1 hora)", "Kits Médicos, reinicia habilidades '1x/descanso curto', reorganiza equipamento."],
    ["Longo (8 horas)", "Restaura todos os PV, recarrega a RAM e reinicia todas as habilidades."],
  ]},
};
