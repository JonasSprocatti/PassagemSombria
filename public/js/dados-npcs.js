// ============================================================================
//  NPCs PRONTOS — contatos, mercadores, informantes, capitães e figuras
//  recorrentes do Sistema Solar. Feitos para o Mestre improvisar cena social
//  sem precisar inventar do zero.
//  Ficha: { n, papel, raca, local, faccao, gancho, fala, oferece, quer, segredo, atitude }
// ============================================================================

export const PAPEIS = {
  "Mercador":   { ic: "🛒", cor: "#f0d060" },
  "Informante": { ic: "🕵", cor: "#7ad0f0" },
  "Contato":    { ic: "🤝", cor: "#59e3c8" },
  "Capitão":    { ic: "🚀", cor: "#f0a860" },
  "Autoridade": { ic: "⚖", cor: "#b0b8d0" },
  "Submundo":   { ic: "🏴", cor: "#f07a7a" },
  "Médico":     { ic: "✚", cor: "#8be05a" },
  "Tecnomante": { ic: "◈", cor: "#a78bfa" },
};

const N = (n, papel, raca, local, faccao, gancho, fala, oferece, quer, segredo, atitude = "Neutro") =>
  ({ n, papel, raca, local, faccao, gancho, fala, oferece, quer, segredo, atitude });

export const NPCS = [
  // ---------------- MERCADORES ----------------
  N("Sela Vantroix", "Mercador", "Terráqueo", "Estação Meridiano (órbita da Terra)", "Independente",
    "Vende de tudo num contêiner reaproveitado, com preços que dançam conforme a sua cara.",
    "“Preço é conversa. Agora, se você tem pressa, aí o preço para de ser conversa.”",
    "Qualquer item de tabela com 10% de desconto se a party trouxer sucata para trocar.",
    "Rotas de fornecimento novas — paga bem por informação de comboio.",
    "Revende peças recuperadas de naufrágios que ela mesma denuncia como perdidos.",
    "Amigável"),
  N("Brox-Que-Solda", "Mercador", "Conjupitero", "Fornalhas de Ío", "Guilda de Engenharia",
    "Titã taciturno que fabrica armaduras pesadas sob encomenda e reprova quem trata mal o equipamento.",
    "“Você quebrou. Você paga. Depois eu conserto. Nessa ordem.”",
    "Armaduras pesadas e modificações; conserta CD perdida por Sangue Cáustico de graça se você trouxer a criatura morta.",
    "Minério de tungstênio e histórias sobre o que há no fundo de Júpiter.",
    "Foi expulso da Guilda por construir um exoesqueleto que matou o próprio piloto.",
    "Neutro"),
  N("Doutora Yssen Ka", "Médico", "Sata", "Clínica flutuante nos Anéis", "Caminho do Anel",
    "Cirurgiã-cultista que instala cromo cantando baixinho durante o procedimento.",
    "“A carne é rascunho, querido. Eu só passo a limpo.”",
    "Instalação e remoção de implantes com 20% de desconto; estabiliza qualquer personagem a 0 PV.",
    "Corpos interessantes. Ela pede permissão para estudar mutações e cicatrizes raras.",
    "Guarda um enxame de nano-robôs de origem desconhecida em incubação.",
    "Amigável"),

  // ---------------- INFORMANTES ----------------
  N("Tik", "Informante", "Mercusys", "Em trânsito — nunca no mesmo lugar", "Independente",
    "Mensageira relativística que sabe de tudo porque está em todo lugar antes de todo mundo.",
    "“Já respondi. Você é que ainda não ouviu.”",
    "Uma informação por favor prestado — nunca por crédito. Ela não confia em dinheiro.",
    "Favores. E que ninguém pergunte de onde ela veio.",
    "Está fugindo de um Ancião Relativístico da própria raça há três anos.",
    "Amigável"),
  N("O Sussurro de Netuno", "Informante", "Proturno", "Salão de escuta, Tritão", "Corte de Netuno",
    "Telepata que vende segredos e cobra em memórias — ele leva um pedaço do que você lembra.",
    "“Eu não leio mentes. Eu escuto o que elas gritam.”",
    "Qualquer segredo do sistema, se você pagar com uma lembrança sua (perde 1 ponto de perícia até o próximo Descanso Longo).",
    "Memórias de primeira mão de quem já viu a Passagem Sombria por dentro.",
    "Está montando um mosaico das memórias roubadas para reconstruir a face de um Monólito.",
    "Frio"),
  N("Corvo", "Submundo", "Terráqueo", "Docas baixas de qualquer estação", "Caminho da Espiral",
    "Recrutador do Caminho da Espiral disfarçado de agenciador de fretes.",
    "“Trabalho honesto existe. Só não paga.”",
    "Contratos ilegais bem remunerados e acesso a mercado negro biológico.",
    "Cobaias voluntárias, ou involuntárias — ele não faz distinção contratual.",
    "Cada contrato que ele fecha é uma coleta de amostra genética da tripulação.",
    "Hostil"),

  // ---------------- CAPITÃES ----------------
  N("Capitã Rhoswen Ilk", "Capitão", "Ven'y", "Nave-caçadora “Fôlego Curto”", "Independente",
    "Caçadora de recompensas que só aceita alvos que ela considera merecedores.",
    "“Eu não caço gente. Eu caço quem parou de ser gente.”",
    "Carona, apoio em combate e um alvo compartilhado se os interesses baterem.",
    "Ajuda para encurralar uma presa grande demais para ela sozinha.",
    "O último alvo dela era o próprio irmão. Ela não terminou o serviço.",
    "Neutro"),
  N("Comodoro Halvex", "Capitão", "Marciano", "Frota Renegada", "Sindicato de Deimos",
    "Ex-oficial do Conclave que virou senhor da guerra com uma frota própria.",
    "“Ordem custa caro. Caos custa mais.”",
    "Proteção de rota, mercenários e artilharia — por um preço e uma lealdade.",
    "Naves. Sempre mais naves, e capitães que saibam pilotá-las.",
    "A frota dele está a duas semanas de ficar sem combustível de dobra.",
    "Frio"),
  N("Velho Tunn", "Capitão", "Urak", "Quebra-gelo “Silêncio Longo”", "Cofre Urak",
    "Capitão de carga que atravessa o cinturão pelas rotas que ninguém mais aceita.",
    "“Se o gelo canta, você para. Se ele grita, você corre.”",
    "Passagem segura por rotas congeladas e conhecimento sobre o que vive no escuro.",
    "Tripulação que não faça perguntas sobre a carga selada no porão.",
    "A carga é um Monólito fragmentado. Ele não sabe — ou finge não saber.",
    "Amigável"),

  // ---------------- CONTATOS E AUTORIDADE ----------------
  N("Arbiter Solenne", "Autoridade", "Terráqueo", "Tribunal Orbital, Meridiano", "Genotheca S.A.",
    "Juíza corporativa que decide disputas de patente — inclusive sobre corpos.",
    "“A lei não é justa. Ela é aplicável. Aprenda a diferença.”",
    "Perdão legal, licenças e acesso a arquivos lacrados — por um favor futuro.",
    "Precedentes. Ela coleciona casos que possam virar jurisprudência a favor da Genotheca.",
    "Ela mesma é uma clone patenteada e sabe que a patente expira em breve.",
    "Frio"),
  N("Ferrolho", "Tecnomante", "Infimor", "Sucatão de Plutão", "Independente",
    "Tecnomante gigante e silencioso que conserta o inconsertável e fala por gestos.",
    "“…” (ele aponta para a peça, depois para você, depois para o preço)",
    "Recuperação de dados corrompidos, conserto de implantes queimados e Scripts raros.",
    "Peças antigas. Quanto mais velha a tecnologia, mais ele paga.",
    "Ele conversa com uma IA pré-Passagem que vive na sucata e a chama de mãe.",
    "Neutro"),
  N("Irmã Vell", "Contato", "Sata", "Santuário do Anel, Encélado", "Caminho do Anel",
    "Sacerdotisa que oferece abrigo a qualquer um — e cobra a conta em serviço, não em crédito.",
    "“Descanse. O ciclo continua amanhã, com ou sem você.”",
    "Descanso Longo seguro e gratuito, cura e um lugar para esconder gente.",
    "Que a tripulação leve mantimentos a colônias isoladas.",
    "O santuário abriga fugitivos do Caminho da Espiral — e a Espiral já sabe.",
    "Amigável"),
];
