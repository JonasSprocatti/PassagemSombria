// PASSAGEM SOMBRIA — DADOS DO JOGO (livro v1.3)

export const RACAS = [
 {
  "nome": "Mercusys",
  "planeta": "Mercúrio",
  "titulo": "Os Nômades da Velocidade e do Momento Presente",
  "lore": "Nascidos sob a fúria implacável da estrela central do sistema, os Mercusys são seres humanoides altos, esguios, de pele avermelhada e quatro pernas que lhes conferem uma estabilidade e propulsão inigualáveis. Para sobreviver à radiação e ao calor de Mercúrio, evoluíram com um metabolismo alucinante. Tudo neles é rápido: o movimento, o raciocínio, a regeneração celular e, tragicamente, o esquecimento.Culturalmente, os Mercusys não constroem grandes bibliotecas ou impérios duradouros. Eles vivem num eterno \"agora\". A sua sociedade baseia-se na tradição oral e sensorial. Os inaladores sensitivos nas pontas dos seus quatro dedos permitem-lhes ler a composição química do universo apenas pelo toque. São exploradores natos, mensageiros de elite e batedores que preferem a liberdade de correr pelos desertos escaldantes ou pelos corredores de uma nave a ficarem presos a burocracias que, de qualquer forma, esquecerão em duas semanas.",
  "vidaMod": -2,
  "attrs": {
   "For": 0,
   "Des": 3,
   "Con": 0,
   "Int": 1,
   "Sab": -1,
   "Car": 1
  },
  "livre": false,
  "habilidades": [
   {
    "n": "Alta Velocidade e Metabolismo",
    "d": "O deslocamento base do Mercusys é o dobro do normal. Possuem regeneração acelerada (recuperam 1d4 de Vida extra num descanso curto). Contra: Precisam de consumir o dobro das rações diárias; se não o fizerem, sofrem 1 nível de exaustão e perdem acesso à regeneração."
   },
   {
    "n": "Leitura Sensitiva",
    "d": "Ao tocar numa superfície, objeto ou líquido, podem identificar imediatamente a sua composição elementar básica e detetar venenos ou ácidos."
   },
   {
    "n": "Resistência ao Calor",
    "d": "Imunes a dano por fogo ambiental e temperaturas extremas. Contra: Sofrem desvantagem em rolagens físicas em qualquer ambiente abaixo de 25°C."
   }
  ],
  "lendaria": {
   "n": "Aceleração Relativística",
   "d": "O Mercusys vibra numa frequência onde o tempo parece parar. Uma vez por Descanso Longo, como Ação Livre, o jogador ganha dois turnos completos e consecutivos antes de qualquer inimigo poder reagir, tornando-se permanentemente imune a ataques de oportunidade."
  }
 },
 {
  "nome": "Ven'y",
  "planeta": "Vênus",
  "titulo": "Os Predadores da Bruma e Alquimistas do Fôlego",
  "lore": "A atmosfera maciça e esmagadora de Vénus forjou uma raça de predadores formidáveis. Os Ven'y possuem uma pele em tons de azul e verde, desenhada para se camuflar nas densas florestas de gases do seu mundo, e uma estrutura muscular capaz de suportar pressões que esmagariam um humano num instante. Não são conhecidos pela sua filosofia ou tecnologia avançada, mas sim pela sua intuição predatória de excelência e pelo seu sistema respiratório único. Os Ven'y possuem múltiplos pulmões e câmaras internas capazes de processar, isolar e sintetizar quase qualquer gás do universo. Na sua cultura tribal de caçadores, o ar não é apenas sobrevivência; é combustível mágico. Um guerreiro Ven'y carrega frequentemente cilindros de gases comprimidos como se fossem poções, alterando a sua própria biologia a meio de uma caçada para se adaptar à presa.",
  "vidaMod": -1,
  "attrs": {
   "For": 1,
   "Des": 2,
   "Con": 1,
   "Int": -1,
   "Sab": 1,
   "Car": 0
  },
  "livre": false,
  "habilidades": [
   {
    "n": "Air Shifter",
    "d": "O Ven'y pode ativar um efeito respirando um gás dominante durante 6 minutos (ou 2 minutos com cilindro concentrado). O efeito dura até 1 minuto após a troca de ar."
   }
  ],
  "lendaria": {
   "n": "Pulmão Alquímico",
   "d": "Pode ativar dois efeitos de gases em simultâneo sem precisar de os respirar no ambiente (durando 5 turnos). Pode exalar uma nuvem tóxica (Área 3x3m, causando 4d6 de dano aos inimigos)."
  }
 },
 {
  "nome": "Terráqueo",
  "planeta": "Terra",
  "titulo": "A Força da Adaptação e a Gestão da Sobrevivência",
  "lore": "Os seres humanos não possuem a força esmagadora dos Marcianos, os pulmões alquímicos dos Ven'y ou o intelecto telepático dos Proturnos. Aos olhos do universo, a biologia terráquea é tragicamente frágil. Contudo, a sua verdadeira vantagem evolutiva é a resiliência absoluta. Em um universo implacável, os Terráqueos são os mestres indiscutíveis da sobrevivência e da gestão de crises.",
  "vidaMod": 0,
  "attrs": {
   "For": 0,
   "Des": 0,
   "Con": 0,
   "Int": 0,
   "Sab": 0,
   "Car": 0
  },
  "livre": true,
  "habilidades": [
   {
    "n": "Alta Adaptabilidade",
    "d": "O terráqueo é uma tela em branco. Ao criar o personagem, o jogador recebe +2 pontos para distribuir livremente entre quaisquer Atributos (For, Des, Con, Int, Sab, Car) e +3 pontos para distribuir em Perícias."
   },
   {
    "n": "Gambiarra",
    "d": "Uma vez por dia, o terráqueo pode transformar 3 itens inúteis (sucata, fios, pedaços de metal) em um item funcional temporário (como uma arma branca simples, um comunicador de curto alcance ou um kit de primeiros socorros improvisado)."
   }
  ],
  "lendaria": {
   "n": "Espírito Indomável",
   "d": "Uma vez por Descanso Longo, se o Terráqueo receber um golpe letal (Vida chegaria a zero), ele se recusa a cair, ficando com 1 PV. Nesse ápice de adrenalina, ele recupera instantaneamente 3d8 + Constituição de Vida e ganha um turno extra imediato, interrompendo a ordem de Iniciativa."
  }
 },
 {
  "nome": "Marciano",
  "planeta": "Marte",
  "titulo": "O Conclave da Guerra e a Dualidade do Sangue",
  "lore": "Marte é um mundo fraturado por milênios de conflitos. Antes um planeta verdejante, hoje é um deserto vermelho forjado pelo fogo de milhares de bombas nucleares. A sociedade marciana se dividiu em grandes conclaves e irmandades ideológicas que disputam cada centímetro de poeira e recursos, sendo as duas maiores facções os Phobos e os Deimos.",
  "vidaMod": 2,
  "attrs": {
   "For": 3,
   "Des": -1,
   "Con": 3,
   "Int": 0,
   "Sab": -1,
   "Car": 0
  },
  "livre": false,
  "habilidades": [
   {
    "n": "Êxtase da Batalha (Adrenalina ou DHEA)",
    "d": "O metabolismo marciano armazena hormônios de combate. Como Ação Livre, o jogador ativa o Êxtase. Jogue 1d6: se cair 1-3 (Adrenalina de Phobos), ganha +2 de Dano Físico e +3m de Deslocamento. Se cair 4-6 (DHEA de Deimos), a mente esfria, ganhando +2 em rolagens de Ataque à Distância e ignorando penalidades de cobertura. Dura 4 turnos."
   },
   {
    "n": "Endurecer",
    "d": "Como Ação de Movimento, enrijece os músculos. Recebe redução de dano de -2 contra qualquer ataque físico por 4 turnos."
   }
  ],
  "lendaria": {
   "n": "Senhor da Guerra Avatar",
   "d": "O marciano atinge o ápice físico. Passa a poder empunhar armas \"Pesadas\" (de duas mãos) usando apenas uma mão. Além disso, quando ativa o Êxtase da Batalha, ele não rola o dado: recebe os bônus de Adrenalina E DHEA simultaneamente."
  }
 },
 {
  "nome": "Conjupitero",
  "planeta": "Júpiter",
  "titulo": "Os Titãs da Engenharia e os Senhores da Gravidade",
  "lore": "Viver no maior e mais esmagador planeta do Sistema Solar forjou os Conjupiteros de maneira única. Sob uma gravidade que transformaria um humano em geléia, eles evoluíram como seres extremamente compactos: medem em média apenas 80 centímetros, mas pesa 120 quilos de puro músculo denso e ossos reforçados.",
  "vidaMod": -3,
  "attrs": {
   "For": 2,
   "Des": -2,
   "Con": 2,
   "Int": 2,
   "Sab": 1,
   "Car": -1
  },
  "livre": false,
  "habilidades": [
   {
    "n": "Física de Motor",
    "d": "Devido à densidade de seus corpos, eles recebem +2 de bônus natural em sua Classe de Defesa (CD) contra tentativas de empurrões ou arremessos, e podem carregar o triplo do peso que o seu atributo de Força normalmente permitiria."
   },
   {
    "n": "Engenharia de Bordo",
    "d": "Recebem um bônus permanente de +2 nas perícias Pilotagem e Mecânica."
   },
   {
    "n": "Conta da Confederação",
    "d": "O Conjupitero possui uma credencial de cristal de diamante que funciona em toda a galáxia. Em qualquer loja ou negociação, o Mestre deve aplicar um desconto passivo de 10% no valor dos itens."
   }
  ],
  "lendaria": {
   "n": "Singularidade",
   "d": "Uma vez por dia, o Conjupitero lança um dispositivo de colapso de massa. Cria um poço gravitacional em um raio de 10m. Inimigos na área são puxados para o centro, sofrem 4d10 de dano de esmagamento, e perdem a Ação de Movimento no próximo turno tentando se levantar."
  }
 },
 {
  "nome": "Sata",
  "planeta": "Saturno",
  "titulo": "Os Cultistas do Anel e Moldadores Genéticos",
  "lore": "Altos, serenos e de formato humanoide (medindo cerca de 1,90m), os Satas são uma raça profundamente religiosa e cientificamente brilhante. Para eles, a fé e a biologia são a mesma coisa. Eles cultuam os anéis de Saturno, acreditando serem estilhaços do núcleo primordial que deu origem à vida. Esta devoção levou-os a desenvolver a medicina e a manipulação genética mais avançadas de todo o sistema.",
  "vidaMod": -1,
  "attrs": {
   "For": -1,
   "Des": 1,
   "Con": 0,
   "Int": 2,
   "Sab": 2,
   "Car": 0
  },
  "livre": false,
  "habilidades": [
   {
    "n": "Cura Genética",
    "d": "1 vez por dia, através de micro-incisões e partilha genética, cura 1d8 + Sabedoria PV de um alvo. Se o dado rolar o valor máximo (8), a cura é duplicada. Se rolar 1, o Sata sofre 2 de dano pela rejeição."
   },
   {
    "n": "Camuflagem Cromática",
    "d": "O Sata gasta a sua Ação Principal para alterar os pigmentos da sua pele, ganhando +5 em Furtividade enquanto se mantiver imóvel ou se mover a metade da velocidade."
   },
   {
    "n": "Emprestar Vitalidade",
    "d": "Como Ação Livre, o Sata pode transferir até metade dos seus próprios Pontos de Vida atuais para curar um aliado em quem toque, sofrendo dano equivalente."
   }
  ],
  "lendaria": {
   "n": "Milagre do Anel Primordial",
   "d": "Emite um pulso genético. Todos os aliados a 10 metros recuperam 5d8 + Sabedoria PV e todas as condições negativas (venenos, sangramentos) são removidas. Opcionalmente, gasta o turno e metade da sua vida para ressuscitar um aliado."
  }
 },
 {
  "nome": "Urak",
  "planeta": "Urano",
  "titulo": "A Voz do Zero Absoluto",
  "lore": "Ninguém fora do seu planeta sabe como é o rosto de um Urak. Escondidos sob pesadas camadas de pelagens grossas e trajes de contenção térmica, eles habitam os desertos gelados de Urano. A sua anatomia foi desenhada para o Zero Absoluto. Mais impressionante do que a sua resistência ao frio é o seu aparelho fonador: possuem cerca de 150 cordas vocais, capazes de replicar qualquer frequência, instrumento ou timbre com uma perfeição assustadora.",
  "vidaMod": -1,
  "attrs": {
   "For": 0,
   "Des": -1,
   "Con": 2,
   "Int": 0,
   "Sab": 0,
   "Car": 3
  },
  "livre": false,
  "habilidades": [
   {
    "n": "Mímica Sonora e Proficiência",
    "d": "Memorizam perfeitamente qualquer código ou informação se for cantada. Podem imitar a voz de qualquer pessoa ou o som de qualquer alarme ou máquina após ouvirem apenas uma vez (teste de Enganação com Vantagem para iludir portas biométricas de voz)."
   },
   {
    "n": "Criogénese",
    "d": "Como Ação Principal, podem focar a umidade do ar e congelá-la, criando um objeto inanimado médio (como uma chave grossa, um escudo frágil ou um martelo) que derrete ao fim de 6 turnos."
   },
   {
    "n": "Resistência ao Frio",
    "d": "Sobrevivem no vácuo espacial gelado. Contra: Acima de 15°C ficam stressados (-1 em testes mentais); acima de 40°C sofrem 1 de dano fixo por turno se não usarem trajes refrigerados."
   }
  ],
  "lendaria": {
   "n": "Sinfonia do Inverno Eterno",
   "d": "Um grito em frequência devastadora. Inimigos num raio de 15m testam Constituição; quem falhar sofre 4d8 de dano gélido e fica paralisado (congelado) por 2 turnos. A umidade do ar cria barricadas de gelo permanentes à volta do Urak."
  }
 },
 {
  "nome": "Proturno",
  "planeta": "Netuno",
  "titulo": "O Domínio da Sombra e a Soberania Mental",
  "lore": "Habitantes dos confins gelados e escuros do Cinturão de Kuiper, os Proturnos desenvolveram a sociedade mais intelectualmente rígida da galáxia. Fisicamente, possuem pele azulada, estatura mediana (1,70m) e crânios levemente alongados para acomodar cérebros que funcionam como super computadores quânticos.",
  "vidaMod": -3,
  "attrs": {
   "For": -1,
   "Des": 0,
   "Con": -1,
   "Int": 2,
   "Sab": 3,
   "Car": 1
  },
  "livre": false,
  "habilidades": [
   {
    "n": "Levantamento Mental",
    "d": "O Proturno pode usar sua Inteligência (ao invés de Força) para erguer, mover ou arremessar objetos de até 50kg a uma distância de 10 metros, usando apenas o pensamento."
   },
   {
    "n": "Invasão da Sombra (Controle Mental)",
    "d": "Como Ação Principal, o Proturno tenta invadir a mente de um inimigo orgânico. O jogador e o Mestre rolam 1d20 + Sabedoria. Se o Proturno vencer, ele dita a próxima Ação Principal do alvo. Se o Proturno perder, o esforço causa uma hemorragia cerebral leve, e ele toma 2 pontos de dano fixo."
   }
  ],
  "lendaria": {
   "n": "Soberania Telepática",
   "d": "O Proturno não sofre mais dano de penalidade ao falhar em controles mentais. Uma vez por Descanso Longo, ele pode erguer até 3 inimigos simultaneamente no ar e esmagá-los com força telecinética, causando 5d10 de dano inesquivável a cada um."
  }
 },
 {
  "nome": "Infimor",
  "planeta": "Plutão",
  "titulo": "Os Titãs Esquecidos do Vácuo",
  "lore": "Com quase três metros de altura no seu estado relaxado, os Infimor's são lentos, milenares e carregam o ressentimento de um sistema inteiro. O rebaixamento de Plutão a \"planeta anão\" não foi apenas uma ofensa astronômica; para eles, foi um insulto cultural imperdoável. A sua anatomia reflete a vastidão do espaço profundo: não respiram, sobrevivem perfeitamente no vácuo e os seus membros são compostos por cartilagens hiper-elásticas que se podem esticar até 10 metros.",
  "vidaMod": 3,
  "attrs": {
   "For": 3,
   "Des": -1,
   "Con": 2,
   "Int": 0,
   "Sab": 0,
   "Car": 0
  },
  "livre": false,
  "habilidades": [
   {
    "n": "Espaço e Passos Leves",
    "d": "Imunes ao vácuo e a asfixia. Podem encolher-se como Ação de Movimento; neste estado, o seu deslocamento cai para metade, mas ganham vantagem absoluta em testes de Furtividade para não fazerem ruído."
   },
   {
    "n": "Braços Telescópicos",
    "d": "Os seus ataques corpo a corpo têm um alcance natural de 10 metros, podendo agarrar inimigos ou itens a essa distância."
   },
   {
    "n": "Fúria dos Desclassificados",
    "d": "Se ouvirem alguém dizer que Plutão não é um planeta durante uma batalha, entram em fúria instintiva. Crescem de tamanho, ganham +2 em todos os atributos e +3 nas rolagens de ataque/dano, mas perdem a capacidade de distinguir aliados de inimigos por 5 turnos."
   }
  ],
  "lendaria": {
   "n": "Colosso do Vácuo",
   "d": "Fica com 5 metros de altura. Ganha a Fúria, mas mantém o controle total da mente. Recebe +20 de Vida Temporária e cada acerto físico seu atira os inimigos pelo ar."
  }
 }
];

export const ARMAS = [
 {
  "n": "Faca de Plasma / Adaga Oculta",
  "dano": "1d4",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Oculta",
  "desc": "Uma empunhadura metálica simples que, ao ser ativada, emite uma lâmina de plasma contida de 15 centímetros. Quase impossível de ser detectada por scanners de metal padrão de espaçoportos. A arma de escolha dos Espiões e Assassinos."
 },
 {
  "n": "Garras de Combate",
  "dano": "1d4",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Aderência",
  "desc": "Lâminas acopladas a luvas reforçadas ou diretamente aos antebraços. Muito comuns entre os caçadores Ven'y e mercenários de rua que precisam de escalar estruturas industriais rapidamente."
 },
 {
  "n": "Maçarico a Laser Portátil",
  "dano": "1d4",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Derretimento",
  "desc": "Dispositivo de corte industrial usado por Catadores. O feixe é muito curto para combate real, exigindo estar colado ao inimigo."
 },
 {
  "n": "Soco Inglês Energizado",
  "dano": "1d4",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Concussão",
  "desc": "Placas de metal que se encaixam sobre os nós dos dedos, equipadas com microbaterias que liberam energia cinética no impacto."
 },
 {
  "n": "Bastão de Choque / Porrete de Segurança",
  "dano": "1d6",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Atordoante",
  "desc": "A arma padrão das forças de segurança coloniais da Terra e corporações. Projetada para neutralizar sem matar, descarrega uma voltagem altíssima no impacto, sobrecarregando o sistema nervoso."
 },
 {
  "n": "Chicote Monomolecular",
  "dano": "1d6",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Alcance",
  "desc": "Um cabo flexível feito de nanofios com a espessura de um único átomo. Extremamente difícil de dominar (um erro pode decepar o braço do usuário), mas corta através de carne e blindagem leve como se fossem manteiga."
 },
 {
  "n": "Manopla Gravitacional",
  "dano": "1d6",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Impacto",
  "desc": "Originalmente uma ferramenta de mineração desenvolvida pelos Conjupiteros para mover asteroides. Foi adaptada para o combate, gerando um pulso repulsor massivo no momento do soco."
 },
 {
  "n": "Chave Inglesa Pesada",
  "dano": "1d6",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Ferramenta",
  "desc": "Uma ferramenta de aço maciço desenhada para apertar porcas de naves estelares. Lenta, mas dolorosa."
 },
 {
  "n": "Arpéu Magnético de Abordagem",
  "dano": "1d6",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Puxão",
  "desc": "Um gancho de metal espesso atrelado a um cabo retrátil de nanofibra, usado por Piratas para pular entre naves."
 },
 {
  "n": "Bastão Telescópico de Carbono",
  "dano": "1d6",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "Des",
  "kw": "Compacto e Ágil",
  "desc": "Um dispositivo compacto de polímero reforçado e fibra de carbono, com cerca de 15 centímetros quando retraído. Ao ser ativado, expande-se rapidamente em uma haste rígida de aproximadamente 1,5 metros, usada por agentes de patrulha, exploradores e equipes de co"
 },
 {
  "n": "Katar Peçonhenta Ven'y",
  "dano": "1d6",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Tóxica",
  "desc": "Uma lâmina de soco tradicional de Vênus, em formato de H, com micro-tubos de veneno ao longo do fio."
 },
 {
  "n": "Escudo-Lâmina Retrátil",
  "dano": "1d6",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Defensiva",
  "desc": "Um escudo de antebraço que possui um botão de pânico, projetando uma lâmina serrilhada da ponta."
 },
 {
  "n": "Espada Térmica / Lâmina Phobos",
  "dano": "1d8",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Confiável",
  "desc": "Uma espada larga de metal reforçado com um núcleo superaquecido. A borda da lâmina brilha em um tom alaranjado e cauteriza a ferida no instante em que corta. A arma mais tradicional e honrada entre os guerreiros do conclave marciano."
 },
 {
  "n": "Lança de Caça Ven'y",
  "dano": "1d8",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "Des",
  "kw": "Ágil",
  "desc": "Feita de ossos de feras de Vênus ou ligas metálicas leves, esta lança é aerodinâmica e possui pontas farpadas desenhadas para prender a presa."
 },
 {
  "n": "Lâmina Longa Marciana",
  "dano": "1d8",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Aparar",
  "desc": "Uma espada reta e sem guarda, de metal escuro, usada pelos recrutas do conclave de Phobos."
 },
 {
  "n": "Nunchaku de Cabo Monofibra",
  "dano": "1d8",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "Des",
  "kw": "Ágil",
  "desc": "Dois bastões metálicos unidos por um fio de energia. O movimento circular torna a defesa contra eles imprevisível."
 },
 {
  "n": "Machado de Sucata Catador",
  "dano": "1d8",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Despedaçador",
  "desc": "Feito de um bloco de motor afiado amarrado a um cano de aço temperado. Bruto, feio e mortal."
 },
 {
  "n": "Foice Curva de Deimos",
  "dano": "1d8",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Sangramento",
  "desc": "Projetada não para cortar, mas para enganchar nos membros do adversário e arrancar peças de armadura ou carne."
 },
 {
  "n": "Foice de Diamante Conjupitera",
  "dano": "1d10",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Perfurante",
  "desc": "Uma arma de haste elegante, cuja lâmina curva é forjada a partir dos diamantes puros extraídos do núcleo de Júpiter sob pressão astronômica. É o material mais afiado do sistema solar."
 },
 {
  "n": "Alabarda de Guarda Proturno",
  "dano": "1d10",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Alcance Maior",
  "desc": "Uma haste longa de liga azul com uma ponta cristalina brilhante. Usada pelos guardas de elite de Netuno para manter a plebe à distância."
 },
 {
  "n": "Lança de Choque de Cavalaria",
  "dano": "1d10",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Investida",
  "desc": "Uma arma pesada e imponente com um gerador na ponta, originalmente montada em veículos terrestres rápidos."
 },
 {
  "n": "Martelo de Demolição",
  "dano": "2d6",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Destruidora",
  "desc": "Literalmente uma ferramenta de desmanche de naves espaciais acoplada a um cabo longo. É lento, pesado e desajeitado, mas quando acerta, amassa aço e esmaga ossos com a mesma facilidade."
 },
 {
  "n": "Machado Cinético",
  "dano": "2d8",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Pesada",
  "desc": "Uma arma monstruosa, com motores a jato na parte traseira da lâmina que aceleram o golpe antes do impacto. Muito usada pela infantaria pesada de Deimos. Exige uma força absurda para ser balançada sem perder o equilíbrio."
 },
 {
  "n": "Martelo Sísmico de Júpiter",
  "dano": "1d20",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Derrubar",
  "desc": "Tem um micro-gerador gravitacional na cabeça do martelo. Quando bate no chão, a gravidade local chora."
 },
 {
  "n": "Espadão de Fusão Térmica",
  "dano": "2d12",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Pesada / Queimadura",
  "desc": "Uma arma absurda de 2 metros de comprimento que possui aletas de ventilação para o núcleo de energia não explodir na mão do usuário."
 },
 {
  "n": "Pistola de Pulso EMP",
  "dano": "1d4",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Anti-Sintético",
  "desc": "Uma arma tática que não dispara projéteis, mas anéis visíveis de energia eletromagnética. Contra matéria orgânica, causa apenas queimaduras superficiais, mas contra circuitos elétricos, é devastadora."
 },
 {
  "n": "Lança-Chamas / Emissor de Gás",
  "dano": "1d4",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Área 3x3m",
  "desc": "Dois tanques nas costas e um bico dispersor. Usado originalmente para limpar esporos alienígenas hostis, rapidamente encontrou lugar nas guerras de trincheiras."
 },
 {
  "n": "Pistola Sinalizadora de Emergência",
  "dano": "1d4",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Marcador Térmico",
  "desc": "Uma ferramenta de resgate que atira um cartucho de fósforo brilhante."
 },
 {
  "n": "Pistola de Dardos Tóxicos Ven'y",
  "dano": "1d4",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Silenciosa / Toxina Lenta",
  "desc": "Sem pólvora. Usa ar comprimido de pequenos cilindros para disparar agulhas envenenadas de forma silenciosa."
 },
 {
  "n": "Pistola Derringer Magnética",
  "dano": "1d4",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Ultra-Oculta / Surpresa",
  "desc": "Menor que a palma da mão, carrega apenas dois tiros. A favorita de Prospectores apostadores em jogos de cartas clandestinos."
 },
 {
  "n": "Pistola Laser Compacta",
  "dano": "1d6",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Saque Rápido",
  "desc": "A arma civil e de apoio mais comum da galáxia. Dispara feixes de luz concentrada que deixam um rastro de cheiro de ozônio no ar. Não tem recuo mecânico e usa baterias em vez de pentes de munição."
 },
 {
  "n": "Besta de Repetição Leve",
  "dano": "1d6",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Rajada Silenciosa",
  "desc": "Utiliza um pente de 10 virotes e um motor rápido de retesamento."
 },
 {
  "n": "Lança-Granadas Tático",
  "dano": "1d6",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Explosão em Área 3x3",
  "desc": "Uma arma acoplada de cano largo que atira projéteis explosivos em arco sobre obstáculos."
 },
 {
  "n": "Emissor de Micro-ondas",
  "dano": "1d6",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Inesquivável / Contínuo",
  "desc": "Um equipamento tático Proturno e corporativo. A arma não atira projéteis ou lasers visíveis, ela cria uma onda de calor que ferve a água no sangue do inimigo."
 },
 {
  "n": "Submetralhadora de Flechetes",
  "dano": "2d4",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Sangramento",
  "desc": "Uma arma suja do submundo. Dispara \"nuvens\" de microagulhas afiadas que rasgam trajes espaciais e se alojam na carne, sendo um pesadelo para os médicos removerem."
 },
 {
  "n": "Fuzil de Estilhaços (Shrapnel Gun)",
  "dano": "2d4",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Sangramento em Área",
  "desc": "Uma arma cruel criada por Catadores, que atira um monte de sucata, pregos e vidro em alta velocidade."
 },
 {
  "n": "Revólver de Íons Pesado",
  "dano": "1d8",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Brutal",
  "desc": "Um canhão de mão clássico, amado por Piratas, Prospectores e exploradores dos cinturões de asteroides. Faz um barulho ensurdecedor e tem um recuo de quebrar o pulso, mas a cápsula de íons abre buracos imensos."
 },
 {
  "n": "Rifle de Assalto Híbrido",
  "dano": "1d8",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Rajada",
  "desc": "O fuzil padrão das forças armadas da Terra. Usa um sistema misto de pólvora moderna e aceleração magnética para disparar dezenas de projéteis em segundos. Confiável em qualquer atmosfera."
 },
 {
  "n": "Carabina de Repetição Terráquea",
  "dano": "1d8",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Confiável",
  "desc": "Um design clássico que sobreviveu aos séculos. Tiro único, ação por alavanca. Não tem a modernidade dos lasers, mas nunca encrava no frio do espaço."
 },
 {
  "n": "Besta Magnética Phobos",
  "dano": "1d10",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Silenciosa",
  "desc": "Uma obra de arte letal. Os marcianos de Phobos recusam o barulho da pólvora, preferindo este rifle que usa trilhos magnéticos silenciados para disparar flechas densas de tungstênio em velocidades supersônicas."
 },
 {
  "n": "Rifle Laser de Infantaria",
  "dano": "1d10",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Perfurante Leve",
  "desc": "O irmão mais velho da Pistola Laser. Uma bateria pesada alimenta este fuzil longo usado por tropas em batalhas campais."
 },
 {
  "n": "Rifle de Precisão Magnético",
  "dano": "1d12",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Mira Telescópica",
  "desc": "Longo, frágil de perto e letal de longe. Possui computadores balísticos acoplados à mira que calculam a gravidade e o vento do planeta automaticamente."
 },
 {
  "n": "Arco Composto Phobos",
  "dano": "1d12",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Híbrida de Atributo",
  "desc": "Roldanas eletromagnéticas que exigem uma Força sobre-humana para puxar a corda, mas disparam flechas com força de projétil anti-tanque."
 },
 {
  "n": "Canhão Portátil de Plasma",
  "dano": "1d12",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Sobreaquecimento",
  "desc": "O plasma contido forma uma esfera brilhante superaquecida antes de ser cuspida. Demora a esfriar."
 },
 {
  "n": "Escopeta Sônica",
  "dano": "2d6",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Curto Alcance",
  "desc": "Não usa balas. Esta arma projeta uma onda de choque de som hipercomprimido capaz de estourar tímpanos e amassar placas de metal. O impacto físico de perto é como ser atropelado por um rover."
 },
 {
  "n": "Escopeta de Cano Duplo \"Rust\"",
  "dano": "2d8",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Curto Alcance / Descarregar",
  "desc": "Uma relíquia brutal de canos serrados. Tem apenas dois tiros antes de precisar recarregar manualmente."
 },
 {
  "n": "Canhão Sônico Pesado",
  "dano": "2d8",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Cone de Repulsão",
  "desc": "Uma versão montada em veículos da escopeta sônica, carregada no ombro como uma bazuca."
 },
 {
  "n": "Metralhadora Rotativa Leve (Minigun)",
  "dano": "3d6",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Pesada / Fogo de Supressão",
  "desc": "Seis canos giratórios alimentados por uma mochila de munição. Só pode ser segurada adequadamente por Exoesqueletos ou pessoas com Força 14+."
 },
 {
  "n": "Canhão de Antimatéria",
  "dano": "1d20",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Artilharia",
  "desc": "Uma arma que deveria estar acoplada a uma nave, mas foi miniaturizada de forma imprudente. É um tubo de metal maciço que dispara uma esfera instável que aniquila a matéria no impacto."
 },
 {
  "n": "Rifle Gauss Eletromagnético",
  "dano": "2d20",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Atravessa Paredes",
  "desc": "A obra-prima da morte à distância. Usa imãs gigantes para disparar uma agulha de tungstênio muito além da velocidade do som, deixando um rastro de vácuo no ar."
 }
];

export const NAVES = [
 {
  "n": "Caça Ligeiro (O Zangão do Vácuo)",
  "casco": 30,
  "escudos": 10,
  "manobra": 4,
  "dano": "3d6",
  "trip": "1 a 2 (Piloto e Artilheiro).",
  "desc": "Pequenos, aerodinâmicos e com a blindagem de uma folha de papel. Os Caças Ligeiros são motores gigantes com um cockpit colado em cima. Usados por milícias locais, patrulhas de estações espaciais e piratas que operam a partir de naves-mãe. A vida de um piloto de caça baseia-se puramente em reflexos: "
 },
 {
  "n": "Interceptador Furtivo (O Fantasma Magnético)",
  "casco": 40,
  "escudos": 15,
  "manobra": 3,
  "dano": "2d10",
  "trip": "1 a 3.",
  "desc": "Construídos com materiais que absorvem frequências de rádio e pintados com compostos que anulam assinaturas térmicas, os Interceptadores Furtivos são indetectáveis na maioria dos radares convencionais. São as naves preferidas de Assassinos e Espiões corporativos. O seu design é angular e esguio, lem"
 },
 {
  "n": "Veleiro Solar Sata (A Lâmina de Luz)",
  "casco": 40,
  "escudos": 25,
  "manobra": 5,
  "dano": "3d8",
  "trip": "2 a 4 (Foco absoluto no Piloto e Tático).",
  "desc": "Utilizadas pelos fanáticos do Caminho do Anel em Saturno. Os Veleiros Solares não usam motores convencionais agressivos, mas sim imensas velas de grafeno que captam ventos solares e correntes gravitacionais. O resultado é uma nave belíssima, frágil como vidro e completamente silenciosa nos radares t"
 },
 {
  "n": "Cargueiro Modificado (A Casa Longe de Casa)",
  "casco": 60,
  "escudos": 30,
  "manobra": 1,
  "dano": "3d8",
  "trip": "4 a 6 (Acomoda a equipa completa).",
  "desc": "Originalmente veículos de transporte civil, os cargueiros modificados tiveram os seus porões de carga sacrificados para acomodar motores maiores, beliches e geradores de escudos ilegais. Estas naves são notórias por precisarem de gambiarras constantes. Trocar um núcleo de processamento em pleno voo "
 },
 {
  "n": "Nave de Prospecção Conjupitera (A Fera Industrial)",
  "casco": 80,
  "escudos": 20,
  "manobra": -1,
  "dano": "4d8",
  "trip": "3 a 5.",
  "desc": "Um bloco maciço de aço, diamante e propulsores industriais. As naves conjupiteras não são bonitas nem aerodinâmicas — parecem cidades-fábrica voadoras. Foram desenhadas para aguentar a pressão atmosférica e a gravidade esmagadora de Júpiter. São lentas e têm uma manobrabilidade terrível, mas o seu c"
 },
 {
  "n": "Cruzador de Interdição Proturno (O Olho de Netuno)",
  "casco": 70,
  "escudos": 80,
  "manobra": 0,
  "dano": "8d10",
  "trip": "4 a 6 (Exige um Tático de elite nos Sensores).",
  "desc": "A ferramenta de Netuno para impor embargos e ditar a lei no sistema externo. Este Cruzador não foi desenhado para destruir, mas para subjugar. O seu formato é esférico e polido. Quando um \"Olho de Netuno\" entra num setor, os radares de todas as naves próximas começam a falhar e as comunicações são i"
 },
 {
  "n": "Corveta Militar (A Lança da Confederação)",
  "casco": 100,
  "escudos": 50,
  "manobra": -1,
  "dano": "6d10",
  "trip": "5+",
  "desc": "O padrão-ouro do combate naval das marinhas da Terra e estações militares de Netuno. Uma Corveta possui corredores bem iluminados, salas de briefing tático e uma ponte de comando elevada. Foram feitas para a guerra de atrito e patrulhas prolongadas. Exigem coordenação perfeita da equipa, caso contrá"
 },
 {
  "n": "Bombardeiro de Cerco Urak (O Quebra-Gelo)",
  "casco": 120,
  "escudos": 30,
  "manobra": -3,
  "dano": "8d12",
  "trip": "3 a 5 (Foco no Engenheiro e no Artilheiro).",
  "desc": "Os Urak's de Urano são mestres em arquitetura pesada e isolamento. O \"Quebra-Gelo\" foi inicialmente desenhado para implodir asteroides maciços, mas foi adaptado para a guerra de cerco corporativo. É um retângulo feio, brutal e lento, com blindagem sobreposta e motores que cospem radiação escura. Enf"
 },
 {
  "n": "Fragata de Assalto Marciana (A Lâmina Bruta de Deimos)",
  "casco": 150,
  "escudos": 40,
  "manobra": -2,
  "dano": "5d12",
  "trip": "Dezenas de legionários.",
  "desc": "Uma nave de combate brutal e sem refinamentos estéticos, pintada com as cores da ferrugem marciana. A estratégia destas naves não é atirar de longe, mas acelerar diretamente contra a nave inimiga. Disparam os arpéus magnéticos, puxam a presa para perto e abrem as eclusas laterais para que os Soldado"
 },
 {
  "n": "Encouraçado (Dreadnought)",
  "casco": 300,
  "escudos": 150,
  "manobra": -4,
  "dano": "10d20",
  "trip": "Centenas. Um jogador não pilota isto, o grupo invade isto.",
  "desc": "O ápice da destruição galáctica. Um Encouraçado é tão massivo que possui a sua própria força gravitacional ligeira. Quando esta nave entra na órbita de um planeta ou estação, é um evento de extinção ou rendição imediata. Em termos de jogo, um Encouraçado funciona mais como um cenário de masmorra (du"
 }
];

// ==== CLASSES (v1.3, com Especialização Veterana) ====
export const CLASSES = {
 "Estudioso":{pv:4,pericias:{"História / Cultura":4,"Investigação":3,"Mecânica":2,"Tecnomancia":2,"Lábia / Persuasão":1},hab:[{n:"Mapa Mental",tipo:"Passiva",freq:"sessao",d:"1x/sessão: declara já ter lido sobre um assunto/criatura/facção. O Mestre fornece uma informação útil, tática ou uma fraqueza."},{n:"Ponto Estrutural Crítico",tipo:"Ativa",freq:"livre",ram:1,d:"Ação Principal (1 RAM): analisa um inimigo. O próximo ataque contra ele causa dano máximo, sem rolar."}],vet:{n:"Análise em Cascata",freq:"combate",d:"1x/combate: Ponto Estrutural sem gastar RAM. Fraquezas catalogadas: +1 de dano do grupo contra o tipo."}},
 "Mecânico":{pv:6,pericias:{"Mecânica":5,"Pilotagem":2,"Armas Brancas":2,"Tecnomancia":1,"Lábia / Persuasão":1,"Sobrevivência":1},hab:[{n:"Operador de Máquinas Pesadas",tipo:"Passiva",freq:"passiva",d:"Ignora penalidades de movimento e acrobacia de Armaduras Pesadas."},{n:"Reparo Tático",tipo:"Ativa",freq:"livre",d:"Ação Principal: aliado ou nave ganha 1d6 + Mecânica de PV Temporários até o fim da batalha."}],vet:{n:"Torreta de Sucata",freq:"combate",d:"1x/combate: torreta (10 PV, CD 12) que atira 1d6 a 15m no início de cada turno seu."}},
 "Assassino":{pv:8,pericias:{"Furtividade":4,"Armas Brancas":2,"Armas de Fogo":2,"Enganação":2,"Medicina":1,"Lábia / Persuasão":1},hab:[{n:"O Primeiro Corte",tipo:"Passiva",freq:"passiva",d:"Contra inimigo que ainda não agiu ou não o notou: +2 no acerto e dano da arma DOBRADO."},{n:"Desaparecer nas Sombras",tipo:"Ativa",freq:"livre",d:"Ao derrubar um inimigo: Ação Livre para rolar Furtividade e sumir do campo de visão."}],vet:{n:"Anatomia Comparada",freq:"combate",d:"Furtivos critam com 19–20; Desaparecer 1x/combate mesmo sem abate."}},
 "Soldado":{pv:10,pericias:{"Armas de Fogo":4,"Armas Brancas":3,"Explosivos":2,"Pilotagem":1,"Sobrevivência":1,"Furtividade":1},hab:[{n:"Memória Muscular",tipo:"Passiva",freq:"passiva",d:"Não sofre a penalidade de −2 com armas Pesadas."},{n:"Fogo de Supressão",tipo:"Ativa",freq:"livre",d:"Ação Principal: alvo testa Sabedoria; falhou → acovardado e ataca com Desvantagem. (NV5: cone de 5m.)"}],vet:{n:"Rajada Disciplinada",freq:"combate",d:"1x/combate: dois ataques com a mesma arma na Ação Principal."}},
 "Starlord":{pv:8,pericias:{"Lábia / Persuasão":5,"Armas de Fogo":2,"Tecnomancia":2,"Pilotagem":2,"Furtividade":1},hab:[{n:"Charme Malandro",tipo:"Passiva",freq:"combate",d:"1x/encontro social: re-rola um teste de Lábia / Persuasão falhado."},{n:"\u201cDeixem isto comigo!\u201d",tipo:"Ativa",freq:"livre",d:"Ação Livre: o próximo aliado a atacar ganha Vantagem. (NV5: os dois próximos.)"}],vet:{n:"Palavra de Capitão",freq:"longo",d:"1x/desc. longo: cede o turno para dar um turno completo extra a um aliado."}},
 "Franco-atirador":{pv:6,pericias:{"Armas de Fogo":5,"Sobrevivência":3,"Furtividade":2,"Investigação":2},hab:[{n:"Foco à Distância",tipo:"Ativa",freq:"livre",d:"Analisa 1 turno; no próximo, acerto E dano com Vantagem. (NV5: Ação de Movimento.)"},{n:"Tiro Incapacitante",tipo:"Passiva",freq:"livre",d:"Mira num membro: metade do dano, alvo com deslocamento 0 (ou derruba a arma) por 1 turno."}],vet:{n:"Geometria da Morte",freq:"combate",d:"1x/combate: um disparo ignora completamente qualquer cobertura."}},
 "Músico":{pv:4,pericias:{"Tecnomancia":5,"Performance / Arte":4,"Lábia / Persuasão":2,"Armas Brancas":1},hab:[{n:"Ouvido Absoluto",tipo:"Passiva",freq:"passiva",d:"+2 na CD contra controle mental, ilusões e dano sônico."},{n:"Frequência de Inspiração/Ressonância",tipo:"Ativa",freq:"livre",d:"Aura 10m: aliados +2 acerto OU inimigos −2 CD. Dura enquanto não sofrer dano (NV5: Performance CD12 sustenta)."}],vet:{n:"Maestro de Guerra — Acorde Duplo",freq:"combate",d:"1x/combate: os DOIS efeitos simultâneos por 2 turnos."}},
 "Espião":{pv:4,pericias:{"Enganação":4,"Lábia / Persuasão":4,"Furtividade":2,"Acrobacia":1,"Intimidação":1},hab:[{n:"Rosto na Multidão",tipo:"Passiva",freq:"passiva",d:"Vantagem absoluta em Persuasão/Enganação quando disfarçado de uma facção."},{n:"Ponto Cego",tipo:"Ativa",freq:"livre",d:"Ação de Mov.: mistura-se; inimigos o ignoram até você atacar. (NV5: persiste 1 turno após atacar.)"}],vet:{n:"Identidade Profunda",freq:"passiva",d:"Terceira identidade blindada — resiste a verificações formais da Confederação."}},
 "Catador":{pv:6,pericias:{"Lábia / Persuasão":3,"Investigação":2,"Sobrevivência":2,"Mecânica":2,"Pilotagem":2,"Armas de Fogo":1},hab:[{n:"Olho para o Ouro",tipo:"Passiva",freq:"livre",d:"Ao investigar: 1d6; com 4–6 (NV5: 3–6) acha item valioso extra."},{n:"Desmanche Rápido",tipo:"Ativa",freq:"combate",d:"1x/combate: arranca placa de inimigo mecânico — 1d8 e −1 CD permanente. (NV5: rouba módulo instalado.)"}],vet:{n:"Olho Clínico",freq:"passiva",d:"Olho para o Ouro com 3–6; Desmanche rouba módulos."}},
 "Piloto":{pv:6,pericias:{"Pilotagem":5,"Mecânica":2,"Lábia / Persuasão":2,"Sobrevivência":2,"Armas de Fogo":1},hab:[{n:"Instinto Evasivo",tipo:"Passiva",freq:"passiva",d:"+2 na CD de qualquer veículo pilotado. (NV5: +4.)"},{n:"Sobrecarga de Propulsores",tipo:"Ativa",freq:"livre",d:"Pilotagem com Vantagem para escapar; nave sofre 1d4. (NV5: 1x/combate sem dano.)"}],vet:{n:"Um com a Máquina",freq:"combate",d:"1x/combate espacial: Sobrecarga sem dano à estrutura."}},
 "Batedor":{pv:8,pericias:{"Sobrevivência":4,"Armas de Fogo":3,"Investigação":3,"Furtividade":1,"Explosivos":1},hab:[{n:"Sentidos Alertas",tipo:"Passiva",freq:"passiva",d:"Imune a surpresa no 1º turno; +2 Iniciativa."},{n:"Marca do Caçador",tipo:"Ativa",freq:"livre",d:"Marca inimigo visível: aliados sabem a posição e ignoram cobertura média. (NV5: +1d4 de dano dos aliados.)"}],vet:{n:"Predador Paciente",freq:"passiva",d:"Ataques de aliados contra o marcado: +1d4 de dano."}},
 "Explorador":{pv:6,pericias:{"Investigação":4,"Sobrevivência":4,"História / Cultura":3,"Lábia / Persuasão":1},hab:[{n:"Mapeamento Tático",tipo:"Passiva",freq:"passiva",d:"Você e aliados a 10m ignoram terreno difícil."},{n:"Vulnerabilidade Exposta",tipo:"Ativa",freq:"livre",d:"Teste de Investigação/Sobrevivência revela fraqueza; próximo ataque do grupo +1d6. (NV5: Ação de Mov., dois ataques.)"}],vet:{n:"Cartógrafo do Impossível",freq:"passiva",d:"Vira Ação de Movimento e vale dois ataques."}},
 "Cinético":{pv:6,cinetico:true,pericias:{"Tecnomancia":5,"Medicina":3,"Atletismo":2,"Acrobacia":2},hab:[{n:"Bio-feedback",tipo:"Passiva",freq:"passiva",d:"Ao curar um aliado com Script, você recupera 2 PV."},{n:"Simbiose Sintética",tipo:"Passiva",freq:"passiva",d:"Limite Cibernético = 2 + INT. Implantes acima de 2 + CON ocupam 1 Slot de RAM cada."},{n:"Repulsão Cinética",tipo:"Ativa",freq:"livre",ram:1,d:"Onda de força: adjacentes empurrados 3m; testam Força ou caem."}],vet:{n:"Ressonância de Cromo",freq:"passiva",d:"+1 na conjuração por cada 3 implantes instalados."}},
 "Prospector":{pv:4,pericias:{"Lábia / Persuasão":5,"Intuição":4,"Tecnomancia":3},hab:[{n:"Contrato Lucrativo",tipo:"Passiva",freq:"passiva",d:"Recompensas de missão +20% (NV5: +30%)."},{n:"\u201cEspere, podemos resolver isto\u201d",tipo:"Ativa",freq:"combate",d:"1x/combate: inimigo que o entenda hesita e perde a Ação Principal."}],vet:{n:"Cláusula de Contingência",freq:"sessao",d:"1x/sessão: contato corporativo — informação, porta, embarque."}},
 "Pirata":{pv:10,pericias:{"Armas de Fogo":3,"Armas Brancas":3,"Intimidação":3,"Sobrevivência":2,"Pilotagem":1},hab:[{n:"Brutalidade de Abordagem",tipo:"Passiva",freq:"passiva",d:"Ignora espaços confinados; +1 de dano dentro de naves."},{n:"Grito de Saqueador",tipo:"Ativa",freq:"livre",d:"Inimigos a 5m testam Sabedoria (NV5: Desvantagem) ou Amedrontados 2 turnos."}],vet:{n:"Terror Nominal",freq:"passiva",d:"Amedrontados sofrem +2 de dano dos seus ataques."}},
};

export const FILOSOFIAS = {
 "Caminho da Voz":{freq:"longo",d:"1x/desc. longo: Desvantagem à resistência do alvo num teste de Carisma — ou finge-se de morto perfeitamente."},
 "Caminho da Ressonância":{freq:"curto",d:"1x/desc. curto: 1 turno ignorando escuridão; sente seres vivos a 10m através de fumaça e paredes finas."},
 "Caminho da Engrenagem":{freq:"longo",d:"1x/desc. longo: transforma uma Falha Crítica (fogo, pilotagem, Tecnomancia) em falha comum."},
 "Caminho da Espiral":{freq:"passiva",d:"Rola dados de cura com Vantagem (kits e descansos curtos)."},
 "Caminho do Anel":{freq:"longo",d:"1x/desc. longo: ao cair a 0 PV, fica com 1 PV até o fim do próximo turno."},
 "Caminho do Ocaso":{freq:"combate",d:"1x/combate: sofre 1d4 Verdadeiro para somar 1d4 a uma rolagem recém-feita."},
 "Código do Sobrevivente":{freq:"longo",d:"+2 Iniciativa. 1x/desc. longo: age normalmente em rodada surpresa."},
 "Código Corporativo":{freq:"passiva",d:"Vantagem para avaliar preços, achar saque e negociar pagamentos."},
 "Código do Cético":{freq:"passiva",d:"+2 CD contra psíquico, leitura e controle mental."},
 "Código da Fronteira":{freq:"passiva",d:"+1 em Ataques sem aliados num raio de 5m."},
 "Código da Caserna":{freq:"curto",d:"1x/desc. curto: Reação para receber o dano no lugar de aliado adjacente."},
 "Código do Vira-Lata":{freq:"combate",d:"1x/combate: distrai inimigo a 3m; primeiro ataque contra ele com Vantagem."},
};

export const IMPLANTES = [
 {n:"Chip de Expansão de RAM",p:1500,e:"+2 Slots de RAM",g:"Cabeça"},
 {n:"Olho Biônico de Precisão",p:800,e:"+2 em Ataque à Distância, ignora fumo/escuro",g:"Cabeça"},
 {n:"Interface de Navegação (Plugar)",p:1200,e:"Vantagem em manobras evasivas espaciais",g:"Cabeça"},
 {n:"Tradutor Universal Subcortical",p:600,e:"+2 Lábia / Persuasão, tradução em tempo real",g:"Cabeça"},
 {n:"Módulo de Mira Preditiva",p:950,e:"Reduz penalidade de precisão de perto",g:"Cabeça"},
 {n:"Placas Subdérmicas de Titânio",p:1100,e:"+1 na CD, cumulativo com armadura",g:"Torso"},
 {n:"Coração Sintético de Duplo Fluxo",p:2500,e:"+5 PV máximos, +2 contra venenos",g:"Torso"},
 {n:"Filtro Pulmonar Universal",p:750,e:"Imune a gases venenosos e ambientais",g:"Torso"},
 {n:"Reator de Adrenalina",p:3000,e:"1x/dia: Ação Principal extra",g:"Torso",ativa:{freq:"dia",d:"Ação Livre: 1 Ação Principal extra neste turno."}},
 {n:"Bateria Interna",p:2000,e:"Sem RAM: 1d8 de PV conjura Script custo 1–2",g:"Torso",ativa:{freq:"livre",d:"Sofra 1d8 de Vida para conjurar um Script de custo 1 ou 2 sem RAM."}},
 {n:"Braço Mecânico Hidráulico",p:850,e:"+2 dano corpo a corpo, Vantagem em Força",g:"Membros"},
 {n:"Estabilizador de Pulso",p:500,e:"Anula penalidades de armas pesadas",g:"Membros"},
 {n:"Lâmina Oculta Retrátil (Mantis)",p:1000,e:"1d8; dobra dano em Furtivos",g:"Membros"},
 {n:"Pernas Pneumáticas",p:1500,e:"Dobra deslocamento, ignora quedas 15m",g:"Membros"},
 {n:"Âncoras Magnéticas (Pés)",p:700,e:"Imune a derrubar; anda no teto em Grav. Zero",g:"Membros"},
];

export const SCRIPTS = [
 {n:"Ping",c:0,a:"Ação Livre",d:"Pacote de dados a 10m: apaga luzes, liga rádios, abre portas não blindadas."},
 {n:"Choque Estático",c:0,a:"Ação Principal",dmg:"1d6",d:"Arco elétrico. 1d6 de dano."},
 {n:"Query Neural",c:0,a:"Ação Principal",d:"Alvo cibernético falha em INT: lê o último pensamento ou baixa a localização."},
 {n:"Bateria Fantasma",c:0,a:"Ação Principal",d:"Recarrega lanternas, comunicadores ou armas pequenas por 1 hora."},
 {n:"Scanner de Frequência",c:0,a:"Ação Livre",d:"Vê Wi-Fi/rádio/Bluetooth a 50m; detecta invisíveis com implantes."},
 {n:"Jammer Pessoal",c:1,a:"Ação de Movimento",d:"Ruído digital 10m por 3 turnos: sem reforços ou alarmes remotos."},
 {n:"Glitch Visual",c:1,a:"Ação Principal",d:"−2 na próxima rolagem de ataque do alvo."},
 {n:"Trava Biométrica",c:1,a:"Ação de Movimento",d:"Porta eletrônica passa a reconhecer apenas o seu DNA."},
 {n:"Rollback Celular",c:1,a:"Ação Principal",dmg:"1d8+Int",d:"Cura 1d8 + Int de um aliado tocado."},
 {n:"Firewall Ativo",c:1,a:"Reação",dmg:"1d10+Int",d:"Barreira hardlight absorve 1d10 + Int de um impacto."},
 {n:"Ejetar Pente",c:1,a:"Reação",d:"O pente da arma inimiga cai; ele recarrega sob fogo."},
 {n:"Travar Armamento",c:2,a:"Ação Principal",d:"Gatilho travado: alvo perde a próxima ação destravando."},
 {n:"Curto-Circuito em Armadura",c:2,a:"Ação Principal",dmg:"1d4",d:"−3 CD do alvo por 2 turnos e 1d4 de queimadura."},
 {n:"Hackear Implante Motor",c:2,a:"Ação Principal",d:"Deslocamento pela metade, sem Esquiva, 3 turnos."},
 {n:"Cegueira Cibernética",c:2,a:"Ação Principal",d:"Cego 2 turnos, ataques com Desvantagem."},
 {n:"Drenar Escudos",c:2,a:"Ação Principal",d:"Suga escudos; metade vira Vida Temporária sua."},
 {n:"Sobrecarga de Sistema",c:2,a:"Ação Principal",dmg:"2d6",d:"Área 3×3m: 2d6 elétrico em cadeia."},
 {n:"Desativar Suporte de Vida",c:2,a:"Ação Principal",d:"Traje do alvo desliga em ambiente hostil: sufocamento imediato."},
 {n:"Loop de Feedback",c:2,a:"Reação",d:"Anula o Script de outro Tecnomante; ele gasta a RAM."},
 {n:"Torreta Sentinela",c:3,a:"Ação Principal",d:"Drone/torreta vira o fogo contra os donos por 3 turnos."},
 {n:"Hackear Navegação Veicular",c:3,a:"Ação Principal",d:"Controla o manche de veículo inimigo por 1 turno."},
 {n:"Inverter Propulsores",c:3,a:"Reação",dmg:"3d8",d:"Inimigo acelera → 3d8 estrutural no casco dele."},
 {n:"Ejetar Piloto",c:3,a:"Ação Principal",d:"Ejeção forçada: piloto fora do combate, em choque."},
 {n:"Apagão do Motor",c:4,a:"Ação Principal",d:"Nave inimiga à deriva no próximo turno espacial."},
 {n:"Marionete Sintética",c:4,a:"Ação Principal",d:"Androide vira marionete 3 turnos: ataca os aliados dele."},
 {n:"EMP Localizado",c:4,a:"Ação Principal",d:"10m: escudos, drones, armas e implantes desligam 2 turnos."},
 {n:"Reparo Estrutural em Massa",c:4,a:"Ação Principal",dmg:"4d10",d:"Nanites restauram 4d10 do casco da sua nave."},
 {n:"Gravidade Zero Local",c:4,a:"Ação Principal",d:"Esfera 5×5m sem gravidade: Desvantagem massiva."},
 {n:"Sobrecarga de Reator",c:5,a:"Ação Principal",dmg:"6d10",d:"Contagem 2 turnos → 6d10 de aniquilação em área."},
 {n:"Formatar Mente Quântica",c:5,a:"Ação Principal",dmg:"5d8",d:"5d8 psíquico e o alvo perde 24h de memórias."},
];

export const ARMADURAS = [
 {n:"Roupas Civis / Traje de Estação",t:"leve",cd:0,e:""},
 {n:"Traje Furtivo de Nanofibra",t:"leve",cd:1,e:"+2 em Furtividade"},
 {n:"Escudo de Energia Pessoal",t:"leve",cd:0,e:"Absorve os primeiros 10 de dano; recarrega em descanso"},
 {n:"Colete Tático Padrão",t:"media",cd:2,e:"Sacar itens é Ação Livre"},
 {n:"Traje de Bordo Atmosférico",t:"media",cd:2,e:"Imune ao vácuo e gases"},
 {n:"Exoesqueleto Leve de Combate",t:"media",cd:4,e:"−2 Furtividade/Acrobacia; +50kg de carga"},
 {n:"Armadura Reativa Urak",t:"pesada",cd:3,e:"Reflete 1d4 térmico no corpo a corpo"},
 {n:"Armadura de Engenharia Conjupitera",t:"pesada",cd:4,e:"−2 Furtividade; +2 Mecânica"},
 {n:"Armadura Pesada Marciana",t:"pesada",cd:6,e:"−4 Furtividade; exige For +2"},
 {n:"Mecha-Suit de Assalto",t:"pesada",cd:8,e:"Sem Esquiva; ignora queda"},
];

export const PERICIAS = [["Acrobacia","Des"],["Armas Brancas","For"],["Armas de Fogo","Des"],["Atletismo","For"],["Enganação","Car"],["Explosivos","Int"],["Furtividade","Des"],["História / Cultura","Int"],["Intimidação","Car"],["Intuição","Sab"],["Investigação","Int"],["Lábia / Persuasão","Car"],["Mecânica","Int"],["Medicina","Sab"],["Percepção","Sab"],["Performance / Arte","Car"],["Pilotagem","Des"],["Prestidigitação","Des"],["Sobrevivência","Sab"],["Tecnomancia","Int"]];

// Conversão de origem: soma de 2d8 -> modificador (regra oficial v1.4)
export const CONVERTE_2D8 = (v) => v <= 4 ? -1 : v <= 10 ? 0 : v <= 15 ? 1 : 2;
// Mapa de renomes de perícias (migração de fichas antigas -> nomenclatura v1.4)
export const RENOME_PERICIAS = {"Persuasão":"Lábia / Persuasão","Conhecimentos Gerais":"História / Cultura","Espionagem / Disfarce":"Enganação","Medicina / Alquimia":"Medicina","Resistência / Fortitude":"Atletismo","Liderança":"Intuição"};


export const ESTACOES = {
 leme:{n:"Leme (Piloto)",acoes:[
  {n:"Manobra Evasiva",rola:["Des","Pilotagem"],d:"O resultado substitui a Defesa da nave até o seu próximo turno."},
  {n:"Alinhamento de Rota",rola:["Des","Pilotagem"],d:"Contra a Defesa inimiga: sucesso dá Vantagem ao próximo ataque do Artilheiro."},
  {n:"Fuga de Dobra",rola:null,d:"2 turnos consecutivos sem sofrer Crítico para saltar e fugir."}]},
 artilharia:{n:"Artilharia",acoes:[
  {n:"Fogo Concentrado",rola:["Des","Armas de Fogo"],danoNave:true,d:"Contra a Defesa da nave inimiga; acertou → rola o dano da arma da nave."},
  {n:"Tiro de Precisão",rola:["Des","Armas de Fogo"],danoNave:true,d:"Com Desvantagem; dano no Casco desativa um subsistema 1d4 turnos."}]},
 engenharia:{n:"Engenharia",acoes:[
  {n:"Redirecionar Energia",rola:["Int","Tecnomancia"],cura:"escudos",dado:"1d8",d:"CD 12: a nave recupera 1d8 + Nível em Escudos."},
  {n:"Reparos de Emergência",rola:["Int","Tecnomancia"],cura:"casco",dado:"1d4",d:"Sucesso: a nave recupera 1d4 de Casco."},
  {n:"Sobrecarga de Propulsores",rola:null,d:"+2 Manobrabilidade por 1 turno; o engenheiro sofre 1d4 de choque."}]},
 sensores:{n:"Sensores (Tático)",acoes:[
  {n:"Guerra Eletrônica",rola:["Int","Tecnomancia"],d:"Contra a Defesa Eletrônica: desliga Escudos inimigos 1 turno ou impõe Desvantagem."},
  {n:"Rastreio de Fraqueza",rola:["Sab","Percepção"],d:"Sucesso: o próximo acerto da nave aliada causa +1d6."}]},
};

export const REGRAS_NAVE = {
 defesa:"Defesa da nave = 10 + Manobrabilidade. Escudos absorvem antes do Casco. Casco 0 = destruída ou à deriva.",
 dobra:"Salto de dobra: 1 Célula de Matéria (200 CG). Vizinhos: 1d4 horas. Cruzando o sistema: 1d4 dias. Salto Cego: Pilotagem CD 20 ou 3d10 no Casco + setor aleatório.",
 critico:"Crítico ou 15+ de dano no Casco: role 1d6 na Tabela de Avarias (incêndio, sensores, arma emperrada, furo no casco, pane no reator).",
};

export const RIQUEZA = {1:300,2:1000,3:4000,4:8000,5:12000,6:15000,7:25000,8:40000,9:60000,10:100000};
export const TEMAS = {
 "Vácuo":{tech:"#59e3c8",chrome:"#f0a860",sombra:"#a78bfa"},
 "Phobos":{tech:"#f07a7a",chrome:"#f0c060",sombra:"#e05070"},
 "Deimos":{tech:"#f0a860",chrome:"#59e3c8",sombra:"#c88850"},
 "Netuno":{tech:"#a78bfa",chrome:"#7dd3fc",sombra:"#f0a0e0"},
 "Vênus":{tech:"#8be05a",chrome:"#f0d060",sombra:"#50c8a0"},
 "Mercúrio":{tech:"#ffd24d",chrome:"#ff8c42",sombra:"#f0e68c"},
};
