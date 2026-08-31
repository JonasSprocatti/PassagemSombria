// PASSAGEM SOMBRIA — DADOS DO JOGO (livro v1.3)

export const RACAS = [
 {
  "nome": "Mercusys",
  "vidaMod": -2,
  "dadoVida": 6,
  "vidaFixa": 3,
  "planeta": "Mercúrio",
  "titulo": "Os Nômades da Velocidade e do Momento Presente",
  "lore": "Nascidos sob a fúria implacável da estrela central do sistema, os Mercusys são seres humanoides altos, esguios, de pele avermelhada e quatro pernas que lhes conferem uma estabilidade e propulsão inigualáveis. Para sobreviver à radiação e ao calor de Mercúrio, evoluíram com um metabolismo alucinante. Tudo neles é rápido: o movimento, o raciocínio, a regeneração celular e, tragicamente, o esquecimento.Culturalmente, os Mercusys não constroem grandes bibliotecas ou impérios duradouros. Eles vivem num eterno \"agora\". A sua sociedade baseia-se na tradição oral e sensorial. Os inaladores sensitivos nas pontas dos seus quatro dedos permitem-lhes ler a composição química do universo apenas pelo toque. São exploradores natos, mensageiros de elite e batedores que preferem a liberdade de correr pelos desertos escaldantes ou pelos corredores de uma nave a ficarem presos a burocracias que, de qualquer forma, esquecerão em duas semanas.",
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
  "vidaMod": -1,
  "dadoVida": 8,
  "vidaFixa": 4,
  "planeta": "Vênus",
  "titulo": "Os Predadores da Bruma e Alquimistas do Fôlego",
  "lore": "A atmosfera maciça e esmagadora de Vénus forjou uma raça de predadores formidáveis. Os Ven'y possuem uma pele em tons de azul e verde, desenhada para se camuflar nas densas florestas de gases do seu mundo, e uma estrutura muscular capaz de suportar pressões que esmagariam um humano num instante. Não são conhecidos pela sua filosofia ou tecnologia avançada, mas sim pela sua intuição predatória de excelência e pelo seu sistema respiratório único. Os Ven'y possuem múltiplos pulmões e câmaras internas capazes de processar, isolar e sintetizar quase qualquer gás do universo. Na sua cultura tribal de caçadores, o ar não é apenas sobrevivência; é combustível mágico. Um guerreiro Ven'y carrega frequentemente cilindros de gases comprimidos como se fossem poções, alterando a sua própria biologia a meio de uma caçada para se adaptar à presa.",
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
  "vidaMod": 0,
  "dadoVida": 8,
  "vidaFixa": 4,
  "planeta": "Terra",
  "titulo": "A Força da Adaptação e a Gestão da Sobrevivência",
  "lore": "Os seres humanos não possuem a força esmagadora dos Marcianos, os pulmões alquímicos dos Ven'y ou o intelecto telepático dos Proturnos. Aos olhos do universo, a biologia terráquea é tragicamente frágil. Contudo, a sua verdadeira vantagem evolutiva é a resiliência absoluta. Em um universo implacável, os Terráqueos são os mestres indiscutíveis da sobrevivência e da gestão de crises.",
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
  "vidaMod": 2,
  "dadoVida": 10,
  "vidaFixa": 5,
  "planeta": "Marte",
  "titulo": "O Conclave da Guerra e a Dualidade do Sangue",
  "lore": "Marte é um mundo fraturado por milênios de conflitos. Antes um planeta verdejante, hoje é um deserto vermelho forjado pelo fogo de milhares de bombas nucleares. A sociedade marciana se dividiu em grandes conclaves e irmandades ideológicas que disputam cada centímetro de poeira e recursos, sendo as duas maiores facções os Phobos e os Deimos.",
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
  "vidaMod": -3,
  "dadoVida": 8,
  "vidaFixa": 4,
  "planeta": "Júpiter",
  "titulo": "Os Titãs da Engenharia e os Senhores da Gravidade",
  "lore": "Viver no maior e mais esmagador planeta do Sistema Solar forjou os Conjupiteros de maneira única. Sob uma gravidade que transformaria um humano em geléia, eles evoluíram como seres extremamente compactos: medem em média apenas 80 centímetros, mas pesa 120 quilos de puro músculo denso e ossos reforçados.",
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
  "vidaMod": -1,
  "dadoVida": 6,
  "vidaFixa": 3,
  "planeta": "Saturno",
  "titulo": "Os Cultistas do Anel e Moldadores Genéticos",
  "lore": "Altos, serenos e de formato humanoide (medindo cerca de 1,90m), os Satas são uma raça profundamente religiosa e cientificamente brilhante. Para eles, a fé e a biologia são a mesma coisa. Eles cultuam os anéis de Saturno, acreditando serem estilhaços do núcleo primordial que deu origem à vida. Esta devoção levou-os a desenvolver a medicina e a manipulação genética mais avançadas de todo o sistema.",
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
  "vidaMod": -1,
  "dadoVida": 8,
  "vidaFixa": 4,
  "planeta": "Urano",
  "titulo": "A Voz do Zero Absoluto",
  "lore": "Ninguém fora do seu planeta sabe como é o rosto de um Urak. Escondidos sob pesadas camadas de pelagens grossas e trajes de contenção térmica, eles habitam os desertos gelados de Urano. A sua anatomia foi desenhada para o Zero Absoluto. Mais impressionante do que a sua resistência ao frio é o seu aparelho fonador: possuem cerca de 150 cordas vocais, capazes de replicar qualquer frequência, instrumento ou timbre com uma perfeição assustadora.",
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
  "vidaMod": -3,
  "dadoVida": 6,
  "vidaFixa": 3,
  "planeta": "Netuno",
  "titulo": "O Domínio da Sombra e a Soberania Mental",
  "lore": "Habitantes dos confins gelados e escuros do Cinturão de Kuiper, os Proturnos desenvolveram a sociedade mais intelectualmente rígida da galáxia. Fisicamente, possuem pele azulada, estatura mediana (1,70m) e crânios levemente alongados para acomodar cérebros que funcionam como super computadores quânticos.",
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
  "vidaMod": 3,
  "dadoVida": 10,
  "vidaFixa": 5,
  "planeta": "Plutão",
  "titulo": "Os Titãs Esquecidos do Vácuo",
  "lore": "Com quase três metros de altura no seu estado relaxado, os Infimor's são lentos, milenares e carregam o ressentimento de um sistema inteiro. O rebaixamento de Plutão a \"planeta anão\" não foi apenas uma ofensa astronômica; para eles, foi um insulto cultural imperdoável. A sua anatomia reflete a vastidão do espaço profundo: não respiram, sobrevivem perfeitamente no vácuo e os seus membros são compostos por cartilagens hiper-elásticas que se podem esticar até 10 metros.",
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
  "n": "Faca de Plasma / Adaga Oculta", "preco": 40,
  "dano": "1d4",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Oculta",
  "desc": "Uma empunhadura metálica simples que, ao ser ativada, emite uma lâmina de plasma contida de 15 centímetros. Quase impossível de ser detectada por scanners de metal padrão de espaçoportos. A arma de escolha dos Espiões e Assassinos."
 },
 {
  "n": "Garras de Combate", "preco": 45,
  "dano": "1d4",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Aderência",
  "desc": "Lâminas acopladas a luvas reforçadas ou diretamente aos antebraços. Muito comuns entre os caçadores Ven'y e mercenários de rua que precisam de escalar estruturas industriais rapidamente."
 },
 {
  "n": "Maçarico a Laser Portátil", "preco": 60,
  "dano": "1d4",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Derretimento",
  "desc": "Dispositivo de corte industrial usado por Catadores. O feixe é muito curto para combate real, exigindo estar colado ao inimigo."
 },
 {
  "n": "Soco Inglês Energizado", "preco": 35,
  "dano": "1d4",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Concussão",
  "desc": "Placas de metal que se encaixam sobre os nós dos dedos, equipadas com microbaterias que liberam energia cinética no impacto."
 },
 {
  "n": "Bastão de Choque / Porrete de Segurança", "preco": 50,
  "dano": "1d6",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Atordoante",
  "desc": "A arma padrão das forças de segurança coloniais da Terra e corporações. Projetada para neutralizar sem matar, descarrega uma voltagem altíssima no impacto, sobrecarregando o sistema nervoso."
 },
 {
  "n": "Chicote Monomolecular", "preco": 250,
  "dano": "1d6",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Alcance",
  "desc": "Um cabo flexível feito de nanofios com a espessura de um único átomo. Extremamente difícil de dominar (um erro pode decepar o braço do usuário), mas corta através de carne e blindagem leve como se fossem manteiga."
 },
 {
  "n": "Manopla Gravitacional", "preco": 200,
  "dano": "1d6",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Impacto",
  "desc": "Originalmente uma ferramenta de mineração desenvolvida pelos Conjupiteros para mover asteroides. Foi adaptada para o combate, gerando um pulso repulsor massivo no momento do soco."
 },
 {
  "n": "Chave Inglesa Pesada", "preco": 20,
  "dano": "1d6",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Ferramenta",
  "desc": "Uma ferramenta de aço maciço desenhada para apertar porcas de naves estelares. Lenta, mas dolorosa."
 },
 {
  "n": "Arpéu Magnético de Abordagem", "preco": 90,
  "dano": "1d6",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Puxão",
  "desc": "Um gancho de metal espesso atrelado a um cabo retrátil de nanofibra, usado por Piratas para pular entre naves."
 },
 {
  "n": "Bastão Telescópico de Carbono", "preco": 40,
  "dano": "1d6",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "Des",
  "kw": "Compacto e Ágil",
  "desc": "Um dispositivo compacto de polímero reforçado e fibra de carbono, com cerca de 15 centímetros quando retraído. Ao ser ativado, expande-se rapidamente em uma haste rígida de aproximadamente 1,5 metros, usada por agentes de patrulha, exploradores e equipes de co"
 },
 {
  "n": "Katar Peçonhenta Ven'y", "preco": 120,
  "dano": "1d6",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Tóxica",
  "desc": "Uma lâmina de soco tradicional de Vênus, em formato de H, com micro-tubos de veneno ao longo do fio."
 },
 {
  "n": "Escudo-Lâmina Retrátil", "preco": 100,
  "dano": "1d6",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Defensiva",
  "desc": "Um escudo de antebraço que possui um botão de pânico, projetando uma lâmina serrilhada da ponta."
 },
 {
  "n": "Espada Térmica / Lâmina Phobos", "preco": 150,
  "dano": "1d8",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Confiável",
  "desc": "Uma espada larga de metal reforçado com um núcleo superaquecido. A borda da lâmina brilha em um tom alaranjado e cauteriza a ferida no instante em que corta. A arma mais tradicional e honrada entre os guerreiros do conclave marciano."
 },
 {
  "n": "Lança de Caça Ven'y", "preco": 80,
  "dano": "1d8",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "Des",
  "kw": "Ágil",
  "desc": "Feita de ossos de feras de Vênus ou ligas metálicas leves, esta lança é aerodinâmica e possui pontas farpadas desenhadas para prender a presa."
 },
 {
  "n": "Lâmina Longa Marciana", "preco": 110,
  "dano": "1d8",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Aparar",
  "desc": "Uma espada reta e sem guarda, de metal escuro, usada pelos recrutas do conclave de Phobos."
 },
 {
  "n": "Nunchaku de Cabo Monofibra", "preco": 95,
  "dano": "1d8",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "Des",
  "kw": "Ágil",
  "desc": "Dois bastões metálicos unidos por um fio de energia. O movimento circular torna a defesa contra eles imprevisível."
 },
 {
  "n": "Machado de Sucata Catador", "preco": 30,
  "dano": "1d8",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Despedaçador",
  "desc": "Feito de um bloco de motor afiado amarrado a um cano de aço temperado. Bruto, feio e mortal."
 },
 {
  "n": "Foice Curva de Deimos", "preco": 130,
  "dano": "1d8",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Sangramento",
  "desc": "Projetada não para cortar, mas para enganchar nos membros do adversário e arrancar peças de armadura ou carne."
 },
 {
  "n": "Foice de Diamante Conjupitera", "preco": 800,
  "dano": "1d10",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Perfurante",
  "desc": "Uma arma de haste elegante, cuja lâmina curva é forjada a partir dos diamantes puros extraídos do núcleo de Júpiter sob pressão astronômica. É o material mais afiado do sistema solar."
 },
 {
  "n": "Alabarda de Guarda Proturno", "preco": 350,
  "dano": "1d10",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Alcance Maior",
  "desc": "Uma haste longa de liga azul com uma ponta cristalina brilhante. Usada pelos guardas de elite de Netuno para manter a plebe à distância."
 },
 {
  "n": "Lança de Choque de Cavalaria", "preco": 220,
  "dano": "1d10",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Investida",
  "desc": "Uma arma pesada e imponente com um gerador na ponta, originalmente montada em veículos terrestres rápidos."
 },
 {
  "n": "Martelo de Demolição", "preco": 180,
  "dano": "2d6",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Destruidora",
  "desc": "Literalmente uma ferramenta de desmanche de naves espaciais acoplada a um cabo longo. É lento, pesado e desajeitado, mas quando acerta, amassa aço e esmaga ossos com a mesma facilidade."
 },
 {
  "n": "Machado Cinético", "preco": 400,
  "dano": "2d8",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Pesada",
  "desc": "Uma arma monstruosa, com motores a jato na parte traseira da lâmina que aceleram o golpe antes do impacto. Muito usada pela infantaria pesada de Deimos. Exige uma força absurda para ser balançada sem perder o equilíbrio."
 },
 {
  "n": "Martelo Sísmico de Júpiter", "preco": 1500,
  "dano": "1d20",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Derrubar",
  "desc": "Tem um micro-gerador gravitacional na cabeça do martelo. Quando bate no chão, a gravidade local chora."
 },
 {
  "n": "Espadão de Fusão Térmica", "preco": 2000,
  "dano": "2d12",
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Pesada / Queimadura",
  "desc": "Uma arma absurda de 2 metros de comprimento que possui aletas de ventilação para o núcleo de energia não explodir na mão do usuário."
 },
 {
  "n": "Pistola de Pulso EMP", "preco": 100,
  "dano": "1d4",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Anti-Sintético",
  "desc": "Uma arma tática que não dispara projéteis, mas anéis visíveis de energia eletromagnética. Contra matéria orgânica, causa apenas queimaduras superficiais, mas contra circuitos elétricos, é devastadora."
 },
 {
  "n": "Lança-Chamas / Emissor de Gás", "preco": 250,
  "dano": "1d4",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Área 3x3m",
  "desc": "Dois tanques nas costas e um bico dispersor. Usado originalmente para limpar esporos alienígenas hostis, rapidamente encontrou lugar nas guerras de trincheiras."
 },
 {
  "n": "Pistola Sinalizadora de Emergência", "preco": 25,
  "dano": "1d4",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Marcador Térmico",
  "desc": "Uma ferramenta de resgate que atira um cartucho de fósforo brilhante."
 },
 {
  "n": "Pistola de Dardos Tóxicos Ven'y", "preco": 150,
  "dano": "1d4",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Silenciosa / Toxina Lenta",
  "desc": "Sem pólvora. Usa ar comprimido de pequenos cilindros para disparar agulhas envenenadas de forma silenciosa."
 },
 {
  "n": "Pistola Derringer Magnética", "preco": 120,
  "dano": "1d4",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Ultra-Oculta / Surpresa",
  "desc": "Menor que a palma da mão, carrega apenas dois tiros. A favorita de Prospectores apostadores em jogos de cartas clandestinos."
 },
 {
  "n": "Pistola Laser Compacta", "preco": 60,
  "dano": "1d6",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Saque Rápido",
  "desc": "A arma civil e de apoio mais comum da galáxia. Dispara feixes de luz concentrada que deixam um rastro de cheiro de ozônio no ar. Não tem recuo mecânico e usa baterias em vez de pentes de munição."
 },
 {
  "n": "Besta de Repetição Leve", "preco": 180,
  "dano": "1d6",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Rajada Silenciosa",
  "desc": "Utiliza um pente de 10 virotes e um motor rápido de retesamento."
 },
 {
  "n": "Lança-Granadas Tático", "preco": 300,
  "dano": "1d6",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Explosão em Área 3x3",
  "desc": "Uma arma acoplada de cano largo que atira projéteis explosivos em arco sobre obstáculos."
 },
 {
  "n": "Emissor de Micro-ondas", "preco": 450,
  "dano": "1d6",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Inesquivável / Contínuo",
  "desc": "Um equipamento tático Proturno e corporativo. A arma não atira projéteis ou lasers visíveis, ela cria uma onda de calor que ferve a água no sangue do inimigo."
 },
 {
  "n": "Submetralhadora de Flechetes", "preco": 220,
  "dano": "2d4",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Sangramento",
  "desc": "Uma arma suja do submundo. Dispara \"nuvens\" de microagulhas afiadas que rasgam trajes espaciais e se alojam na carne, sendo um pesadelo para os médicos removerem."
 },
 {
  "n": "Fuzil de Estilhaços (Shrapnel Gun)", "preco": 140,
  "dano": "2d4",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Sangramento em Área",
  "desc": "Uma arma cruel criada por Catadores, que atira um monte de sucata, pregos e vidro em alta velocidade."
 },
 {
  "n": "Revólver de Íons Pesado", "preco": 160,
  "dano": "1d8",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Brutal",
  "desc": "Um canhão de mão clássico, amado por Piratas, Prospectores e exploradores dos cinturões de asteroides. Faz um barulho ensurdecedor e tem um recuo de quebrar o pulso, mas a cápsula de íons abre buracos imensos."
 },
 {
  "n": "Rifle de Assalto Híbrido", "preco": 200,
  "dano": "1d8",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Rajada",
  "desc": "O fuzil padrão das forças armadas da Terra. Usa um sistema misto de pólvora moderna e aceleração magnética para disparar dezenas de projéteis em segundos. Confiável em qualquer atmosfera."
 },
 {
  "n": "Carabina de Repetição Terráquea", "preco": 130,
  "dano": "1d8",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Confiável",
  "desc": "Um design clássico que sobreviveu aos séculos. Tiro único, ação por alavanca. Não tem a modernidade dos lasers, mas nunca encrava no frio do espaço."
 },
 {
  "n": "Besta Magnética Phobos", "preco": 350,
  "dano": "1d10",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Silenciosa",
  "desc": "Uma obra de arte letal. Os marcianos de Phobos recusam o barulho da pólvora, preferindo este rifle que usa trilhos magnéticos silenciados para disparar flechas densas de tungstênio em velocidades supersônicas."
 },
 {
  "n": "Rifle Laser de Infantaria", "preco": 280,
  "dano": "1d10",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Perfurante Leve",
  "desc": "O irmão mais velho da Pistola Laser. Uma bateria pesada alimenta este fuzil longo usado por tropas em batalhas campais."
 },
 {
  "n": "Rifle de Precisão Magnético", "preco": 500,
  "dano": "1d12",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Mira Telescópica",
  "desc": "Longo, frágil de perto e letal de longe. Possui computadores balísticos acoplados à mira que calculam a gravidade e o vento do planeta automaticamente."
 },
 {
  "n": "Arco Composto Phobos", "preco": 300,
  "dano": "1d12",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Híbrida de Atributo",
  "desc": "Roldanas eletromagnéticas que exigem uma Força sobre-humana para puxar a corda, mas disparam flechas com força de projétil anti-tanque."
 },
 {
  "n": "Canhão Portátil de Plasma", "preco": 650,
  "dano": "1d12",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Sobreaquecimento",
  "desc": "O plasma contido forma uma esfera brilhante superaquecida antes de ser cuspida. Demora a esfriar."
 },
 {
  "n": "Escopeta Sônica", "preco": 260,
  "dano": "2d6",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Curto Alcance",
  "desc": "Não usa balas. Esta arma projeta uma onda de choque de som hipercomprimido capaz de estourar tímpanos e amassar placas de metal. O impacto físico de perto é como ser atropelado por um rover."
 },
 {
  "n": "Escopeta de Cano Duplo \"Rust\"", "preco": 300,
  "dano": "2d8",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Curto Alcance / Descarregar",
  "desc": "Uma relíquia brutal de canos serrados. Tem apenas dois tiros antes de precisar recarregar manualmente."
 },
 {
  "n": "Canhão Sônico Pesado", "preco": 800,
  "dano": "2d8",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Cone de Repulsão",
  "desc": "Uma versão montada em veículos da escopeta sônica, carregada no ombro como uma bazuca."
 },
 {
  "n": "Metralhadora Rotativa Leve (Minigun)", "preco": 900,
  "dano": "3d6",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Pesada / Fogo de Supressão",
  "desc": "Seis canos giratórios alimentados por uma mochila de munição. Só pode ser segurada adequadamente por Exoesqueletos ou pessoas com Força 14+."
 },
 {
  "n": "Canhão de Antimatéria", "preco": 3500,
  "dano": "1d20",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Artilharia",
  "desc": "Uma arma que deveria estar acoplada a uma nave, mas foi miniaturizada de forma imprudente. É um tubo de metal maciço que dispara uma esfera instável que aniquila a matéria no impacto."
 },
 {
  "n": "Rifle Gauss Eletromagnético", "preco": 4500,
  "dano": "2d20",
  "tipo": "fogo",
  "per": "Armas de Fogo",
  "attr": "Des",
  "kw": "Atravessa Paredes",
  "desc": "A obra-prima da morte à distância. Usa imãs gigantes para disparar uma agulha de tungstênio muito além da velocidade do som, deixando um rastro de vácuo no ar."
 },
 {
  "n": "Nano-Tatuagem: Garras de Enxame", "preco": 0, "nano": true,
  "dano": "1d4", "escala": { "5": "1d6", "9": "1d8" },
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "Des",
  "kw": "Ágil",
  "desc": "Pares de garras que brotam das falanges. O enxame recobre os dedos e afia-se em lâminas curvas. Forma do implante Tatuagens de Nano-Enxame — não pode ser arremessada, largada nem desarmada."
 },
 {
  "n": "Nano-Tatuagem: Punhal Dérmico", "preco": 0, "nano": true,
  "dano": "1d4", "escala": { "5": "1d6", "9": "1d8" },
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "Des",
  "kw": "Oculta",
  "desc": "A tatuagem no antebraço escorre para a palma e endurece num punhal de fio único. Forma do implante Tatuagens de Nano-Enxame — não pode ser arremessada, largada nem desarmada."
 },
 {
  "n": "Nano-Tatuagem: Machadinha de Enxame", "preco": 0, "nano": true,
  "dano": "1d6", "escala": { "5": "1d8", "9": "1d10" },
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "Des",
  "kw": "Ágil",
  "desc": "Compacta e equilibrada, a tinta forma um cabo curto e uma cabeça pesada o suficiente para rachar visores. Forma do implante Tatuagens de Nano-Enxame — não pode ser arremessada, largada nem desarmada."
 },
 {
  "n": "Nano-Tatuagem: Espada de Nanofio", "preco": 0, "nano": true,
  "dano": "1d6", "escala": { "5": "1d8", "9": "1d10" },
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Confiável",
  "desc": "Uma lâmina reta de nanofio compactado. Nunca lasca, nunca emperra — simplesmente se refaz. Forma do implante Tatuagens de Nano-Enxame — não pode ser arremessada, largada nem desarmada."
 },
 {
  "n": "Nano-Tatuagem: Lâmina Serrilhada de Enxame", "preco": 0, "nano": true,
  "dano": "1d6", "escala": { "5": "1d8", "9": "1d10" },
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Sangramento",
  "desc": "Os nano-robôs vibram no fio da lâmina, serrando a carne em vez de cortá-la. Forma do implante Tatuagens de Nano-Enxame — não pode ser arremessada, largada nem desarmada."
 },
 {
  "n": "Nano-Tatuagem: Manopla de Impacto", "preco": 0, "nano": true,
  "dano": "1d6", "escala": { "5": "1d8", "9": "1d10" },
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Impacto",
  "desc": "A tinta cobre o punho numa manopla densa que descarrega a inércia acumulada no golpe. Forma do implante Tatuagens de Nano-Enxame — não pode ser arremessada, largada nem desarmada."
 },
 {
  "n": "Nano-Tatuagem: Machado Pesado de Enxame", "preco": 0, "nano": true,
  "dano": "1d8", "escala": { "5": "1d10", "9": "2d6" },
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Despedaçador",
  "desc": "O enxame inteiro migra para uma só mão e forma uma cabeça de machado brutal. Forma do implante Tatuagens de Nano-Enxame — não pode ser arremessada, largada nem desarmada."
 },
 {
  "n": "Nano-Tatuagem: Alabarda Curta de Enxame", "preco": 0, "nano": true,
  "dano": "1d6", "escala": { "5": "1d8", "9": "1d10" },
  "tipo": "branca",
  "per": "Armas Brancas",
  "attr": "For",
  "kw": "Alcance",
  "desc": "O enxame estica-se num cabo de dois metros com uma ponta de lança e um gancho. Forma do implante Tatuagens de Nano-Enxame — não pode ser arremessada, largada nem desarmada."
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
 "Caminho da Voz":{freq:"longo",d:"1x/desc. longo: Desvantagem à resistência do alvo num teste de Carisma — ou finge-se de morto perfeitamente.",lore:"Originária de seitas diplomáticas e cortes de Netuno, prega o controle absoluto do próprio biometabolismo e a imposição da vontade sobre os outros através de frequências sub-vocais quase impercetíveis.",apelido:"A Mente Sobre a Carne"},
 "Caminho da Ressonância":{freq:"curto",d:"1x/desc. curto: 1 turno ignorando escuridão; sente seres vivos a 10m através de fumaça e paredes finas.",lore:"A crença de que tudo, vivo ou morto, está conectado por cordas gravitacionais invisíveis. Eles não precisam ver o universo; eles sentem o peso das coisas ao seu redor.",apelido:"A Gravidade Universal"},
 "Caminho da Engrenagem":{freq:"longo",d:"1x/desc. longo: transforma uma Falha Crítica (fogo, pilotagem, Tecnomancia) em falha comum.",lore:"A carne é falha, fraca e corrompível pelo Vazio. O metal, a engrenagem e o código binário são a verdadeira salvação. Tratam a manutenção de equipamentos como uma liturgia sagrada.",apelido:"O Código-Deus"},
 "Caminho da Espiral":{freq:"passiva",d:"Rola dados de cura com Vantagem (kits e descansos curtos).",lore:"A adaptação genética é a única muralha contra a extinção. Veneram a evolução, o DNA e a mutação, focando na excelência física para superar qualquer ambiente hostil.",apelido:"A Biologia Perfeita"},
 "Caminho do Anel":{freq:"longo",d:"1x/desc. longo: ao cair a 0 PV, fica com 1 PV até o fim do próximo turno.",lore:"Com fortes raízes na cultura Sata de Saturno, baseia-se na paciência milenar e no ciclo inevitável de retorno. Eles sabem que tudo o que cai, mais cedo ou mais tarde, volta a subir.",apelido:"O Ciclo Eterno"},
 "Caminho do Ocaso":{freq:"combate",d:"1x/combate: sofre 1d4 Verdadeiro para somar 1d4 a uma rolagem recém-feita.",lore:"Uma seita sombria, muitas vezes banida, que vê a Passagem Sombria não como uma invasão, mas como purificação. A dor é apenas uma ponte para a assimilação cósmica.",apelido:"O Culto ao Vazio"},
 "Código do Sobrevivente":{freq:"longo",d:"+2 Iniciativa. 1x/desc. longo: age normalmente em rodada surpresa.",lore:"O universo ativamente quer matá-lo, e confiar nos outros é um luxo que você não pode pagar. A sua fé está apenas no seu instinto de preservação.",apelido:"A Paranoia Ativa"},
 "Código Corporativo":{freq:"passiva",d:"Vantagem para avaliar preços, achar saque e negociar pagamentos.",lore:"Deuses não pagam as contas, e a lealdade é uma mercadoria barata. Tudo no Sistema Solar tem um preço, e os contratos são a única verdade absoluta.",apelido:"A Lei do Crédito"},
 "Código do Cético":{freq:"passiva",d:"+2 CD contra psíquico, leitura e controle mental.",lore:"Rejeição absoluta ao misticismo, telepatia e aos sussurros cósmicos. A sua mente é inteiramente lógica, o que cria um cofre blindado contra influências externas.",apelido:"A Fortaleza Racional"},
 "Código da Fronteira":{freq:"passiva",d:"+1 em Ataques sem aliados num raio de 5m.",lore:"Você trabalha melhor quando não há ninguém no seu caminho de tiro. No vácuo profundo, depender do suporte dos outros é um convite para a morte.",apelido:"O Lobo Solitário"},
 "Código da Caserna":{freq:"curto",d:"1x/desc. curto: Reação para receber o dano no lugar de aliado adjacente.",lore:"Ninguém fica para trás. A unidade tática é sagrada e o indivíduo é sacrificável se isso significar a sobrevivência do esquadrão.",apelido:"O Dever Militar"},
 "Código do Vira-Lata":{freq:"combate",d:"1x/combate: distrai inimigo a 3m; primeiro ataque contra ele com Vantagem.",lore:"A honra não para disparos de plasma e não o protege do frio do espaço. Vença. Sobreviva a qualquer custo, mesmo que para isso tenha de morder, cegar ou fugir.",apelido:"A Luta Suja"},
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
 {n:"Tatuagens de Nano-Enxame",p:2200,e:"Materializa armas brancas na mão; dano escala por nível",g:"Torso"},
];

export const SCRIPTS = [
 {n:"Ping",c:0,a:"Ação Livre",d:"Pacote de dados a 10m: apaga luzes, liga rádios, abre portas não blindadas.",lore:"O equivalente digital a um estalar de dedos. O Tecnomante envia um pacote de dados simples que interage com qualquer eletrônico até 10m. Serve para apagar as luzes de um corredor, ligar um rádio no volume máximo para distrair guardas ou abrir portas não blindadas."},
 {n:"Choque Estático",c:0,a:"Ação Principal",dmg:"1d6",d:"Arco elétrico. 1d6 de dano.",lore:"Focando a bioeletricidade através das pontas dos dedos ou do seu deck, dispara um arco elétrico azulado. Causa 1d6 de dano e cheira a ozônio."},
 {n:"Query Neural",c:0,a:"Ação Principal",d:"Alvo cibernético falha em INT: lê o último pensamento ou baixa a localização.",lore:"Um \"ping\" direto no córtex de um alvo cibernético. Se o inimigo falhar num teste de Inteligência, você invade o cache de memória de curto prazo dele, lendo o seu último pensamento ou baixando a sua localização para o seu radar."},
 {n:"Bateria Fantasma",c:0,a:"Ação Principal",d:"Recarrega lanternas, comunicadores ou armas pequenas por 1 hora.",lore:"O usuário canaliza a estática do ambiente (o atrito do ar, a radiação de fundo) e injeta-a num dispositivo. Recarrega lanternas, comunicadores ou armas de pequeno porte por 1 hora."},
 {n:"Scanner de Frequência",c:0,a:"Ação Livre",d:"Vê Wi-Fi/rádio/Bluetooth a 50m; detecta invisíveis com implantes.",lore:"Os olhos do Tecnomante brilham levemente. Ele passa a enxergar as emissões de Wi-Fi, rádio e Bluetooth no ar num raio de 50 metros, perfeito para detectar inimigos invisíveis que usem implantes ativos."},
 {n:"Jammer Pessoal",c:1,a:"Ação de Movimento",d:"Ruído digital 10m por 3 turnos: sem reforços ou alarmes remotos.",lore:"Cria uma bolha de \"ruído branco\" digital de 10m ao seu redor. Durante 3 turnos, os rádios chiam e ninguém na área consegue pedir reforços ou acionar alarmes remotos."},
 {n:"Glitch Visual",c:1,a:"Ação Principal",d:"−2 na próxima rolagem de ataque do alvo.",lore:"Envia pacotes de dados corrompidos diretamente para o visor do capacete ou para os olhos biônicos de 1 alvo. A visão dele enche-se de pop-ups e estática, causando -2 na sua próxima rolagem de ataque."},
 {n:"Trava Biométrica",c:1,a:"Ação de Movimento",d:"Porta eletrônica passa a reconhecer apenas o seu DNA.",lore:"Reescreve a propriedade de uma porta eletrônica. A porta reconhece apenas o seu DNA. Inimigos precisam de arrombar na força bruta ou hackear a porta de volta para passar."},
 {n:"Rollback Celular",c:1,a:"Ação Principal",dmg:"1d8+Int",d:"Cura 1d8 + Int de um aliado tocado.",lore:"Um script médico. Nanites ou a própria matriz de luz da Tecnomancia forçam as células de um aliado tocado a carregarem o seu \"save state\" anterior. Cura 1d8 + Inteligência de forma espetacular, fechando cortes num piscar de olhos."},
 {n:"Firewall Ativo",c:1,a:"Reação",dmg:"1d10+Int",d:"Barreira hardlight absorve 1d10 + Int de um impacto.",lore:"Quando um tiro está prestes a acertar, o Tecnomante ergue a mão. Uma barreira hexagonal de *hardlight* (luz dura) cristaliza-se no ar, absorvendo 1d10 + Inteligência de dano daquele impacto antes de estilhaçar como vidro. ## **🟡 INJEÇÕES MALICIOSAS (Nível 2)** *Requisito: Tecnomancia +4 até +6. Códigos agressivos desenhados para a guerra. Eles ignoram protocolos de segurança e afetam diretamente a biologia e o equipamento do inimigo.*"},
 {n:"Ejetar Pente",c:1,a:"Reação",d:"O pente da arma inimiga cai; ele recarrega sob fogo.",lore:"A humilhação suprema num tiroteio. Quando um inimigo mira em si, hackeia a trava magnética do carregador da arma dele. O pente cai no chão, forçando o inimigo a recarregar sob fogo cruzado."},
 {n:"Travar Armamento",c:2,a:"Ação Principal",d:"Gatilho travado: alvo perde a próxima ação destravando.",lore:"Invade o microchip de segurança da arma inimiga. O gatilho trava eletromagneticamente. O alvo perde a próxima ação destravando a arma de forma manual."},
 {n:"Curto-Circuito em Armadura",c:2,a:"Ação Principal",dmg:"1d4",d:"−3 CD do alvo por 2 turnos e 1d4 de queimadura.",lore:"Frita os servomotores de um exoesqueleto ou armadura pesada. O traje trava nas juntas, a CD do alvo cai em -3 por 2 turnos e o calor das placas causa 1d4 de queimadura nas costas do inimigo."},
 {n:"Hackear Implante Motor",c:2,a:"Ação Principal",d:"Deslocamento pela metade, sem Esquiva, 3 turnos.",lore:"Toma o controlo parcial das pernas cibernéticas de um inimigo. Ele passa a andar arrastando-se, com o deslocamento reduzido a metade, e não pode Esquivar por 3 turnos."},
 {n:"Cegueira Cibernética",c:2,a:"Ação Principal",d:"Cego 2 turnos, ataques com Desvantagem.",lore:"Desliga os implantes óticos do alvo, mergulhando-o na escuridão digital. Cego por 2 turnos, rola todos os ataques com Desvantagem."},
 {n:"Drenar Escudos",c:2,a:"Ação Principal",d:"Suga escudos; metade vira Vida Temporária sua.",lore:"Como um vampiro digital, estende fios de energia pura que sugam os escudos do alvo. Metade do valor drenado converte-se em Vida Temporária para o próprio Tecnomante."},
 {n:"Sobrecarga de Sistema",c:2,a:"Ação Principal",dmg:"2d6",d:"Área 3×3m: 2d6 elétrico em cadeia.",lore:"Frita a rede elétrica local. Lâmpadas estouram e painéis explodem em faíscas. Inimigos numa área de 3x3m sofrem 2d6 de dano elétrico em cadeia."},
 {n:"Desativar Suporte de Vida",c:2,a:"Ação Principal",d:"Traje do alvo desliga em ambiente hostil: sufocamento imediato.",lore:"Cruel e letal. Desliga os filtros de oxigénio ou aquecedores do traje de um alvo no vácuo ou gás tóxico. O inimigo começa a sufocar e a sofrer dano ambiental imediatamente."},
 {n:"Loop de Feedback",c:2,a:"Reação",d:"Anula o Script de outro Tecnomante; ele gasta a RAM.",lore:"O contra-ataque hacker. Se outro Tecnomante conjurar um Script, você injeta um espelho de código. O Script dele é anulado instantaneamente e ele gasta a RAM na mesma."},
 {n:"Torreta Sentinela",c:3,a:"Ação Principal",d:"Drone/torreta vira o fogo contra os donos por 3 turnos.",lore:"Uma invasão complexa. Substitui o protocolo \"Amigo/Inimigo\" de um drone ou torreta montada. Durante 3 turnos, a máquina vira os canhões e atira impiedosamente contra os próprios donos. ## **🔴 PROTOCOLOS DE SOBRESCRITA (Nível 3)** *Requisito: Tecnomancia +7 ou mais. Os Cinéticos e Músicos de elite brincam de ser deuses. Estes códigos reescrevem as leis da física local e controlam máquinas colossais.*"},
 {n:"Hackear Navegação Veicular",c:3,a:"Ação Principal",d:"Controla o manche de veículo inimigo por 1 turno.",lore:"O Tecnomante fecha os olhos e a sua mente invade os propulsores de um veículo/nave inimiga. Ele ganha o controlo do manche durante 1 turno, podendo atirá-los contra asteroides ou tirá-los da sua rota de fuga."},
 {n:"Inverter Propulsores",c:3,a:"Reação",dmg:"3d8",d:"Inimigo acelera → 3d8 estrutural no casco dele.",lore:"Usado em combate de naves. Quando o inimigo tenta acelerar para fugir ou abalroar, o Tecnomante inverte o fluxo das turbinas. O choque de inércia destrói os motores, causando 3d8 de dano estrutural brutal ao casco inimigo."},
 {n:"Ejetar Piloto",c:3,a:"Ação Principal",d:"Ejeção forçada: piloto fora do combate, em choque.",lore:"Acede ao protocolo de emergência do assento de um caça ou mecha inimigo. Com um estrondo explosivo, o teto da máquina voa e o piloto é atirado para fora do combate, paralisado de choque. **28. Reparo Estrutural em Massa (Custo 4 | Ação Principal):** Liga a sua mente aos nanites de manutenção do seu próprio Cargueiro. O casco de metal retorce-se e remenda-se sozinho no meio do tiroteio espacial, restaurando 4d10 Pontos de Vida da nave."},
 {n:"Apagão do Motor",c:4,a:"Ação Principal",d:"Nave inimiga à deriva no próximo turno espacial.",lore:"Um ataque paralisante no núcleo de energia de uma nave estelar. O motor de dobra ou de combustão desliga-se bruscamente, deixando a nave à deriva sem poder mover-se no próximo turno espacial."},
 {n:"Marionete Sintética",c:4,a:"Ação Principal",d:"Androide vira marionete 3 turnos: ataca os aliados dele.",lore:"Substitui o cérebro de um ciborgue avançado ou androide pelo seu próprio comando. O alvo torna-se a sua marioneta durante 3 turnos, sendo obrigado a atacar os seus próprios aliados e usar as suas habilidades contra eles."},
 {n:"EMP Localizado",c:4,a:"Ação Principal",d:"10m: escudos, drones, armas e implantes desligam 2 turnos.",lore:"Bate no chão ou junta as mãos, emitindo um pulso eletromagnético num raio de 10 metros. Qualquer escudo, drone, arma de fogo ou implante (amigo ou inimigo) na área desliga-se por 2 turnos. Apenas a biologia pura e as armas brancas funcionam."},
 {n:"Reparo Estrutural em Massa",c:4,a:"Ação Principal",dmg:"4d10",d:"Nanites restauram 4d10 do casco da sua nave."},
 {n:"Gravidade Zero Local",c:4,a:"Ação Principal",d:"Esfera 5×5m sem gravidade: Desvantagem massiva.",lore:"O Tecnomante adultera o painel gravitacional de uma sala ou corredor. Uma esfera de 5x5m perde a gravidade. Inimigos sem botas magnéticas começam a flutuar caoticamente, desesperados por apoio, sofrendo Desvantagem massiva para fazer qualquer ataque físico. ## ## ## ## ## ## ## ## ## #"},
 {n:"Sobrecarga de Reator",c:5,a:"Ação Principal",dmg:"6d10",d:"Contagem 2 turnos → 6d10 de aniquilação em área.",lore:"O código definitivo de sabotagem. Desativa as travas de segurança do reator de um mecha ou nave inimiga. Inicia-se uma contagem decrescente de 2 turnos; se os inimigos não gastarem as suas ações a tentar resfriar manualmente o sistema, o núcleo explode, causando 6d10 de dano de aniquilação na área."},
 {n:"Formatar Mente Quântica",c:5,a:"Ação Principal",dmg:"5d8",d:"5d8 psíquico e o alvo perde 24h de memórias.",lore:"Uma arma psicológica devastadora. O Tecnomante força um erro crítico nos implantes de memória de um alvo orgânico. O cérebro do alvo sofre uma convulsão, recebendo 5d8 de dano psíquico/elétrico, e ele perde todas as memórias das últimas 24 horas."},
];

export const ARMADURAS = [
 {n:"Roupas Civis / Traje de Estação",preco:20,t:"leve",cd:0,e:"",desc:"Casacos de couro sintético, sobretudos de mercenário ou os macacões confortáveis usados nas estações comerciais da Terra e de Ceres. Não oferecem proteção balística, mas também não atrapalham os movimentos. O conforto ideal para negociações em bares esfumaçados."},
 {n:"Traje Furtivo de Nanofibra",preco:250,t:"leve",cd:1,e:"+2 em Furtividade",desc:"Um tecido negro e colante que absorve a luz e abafa as assinaturas térmicas do corpo. Usado pelos espiões corporativos e pelas guildas de assassinos. Ao toque, parece água fria; no escuro, torna o utilizador praticamente invisível."},
 {n:"Escudo de Energia Pessoal",preco:800,t:"leve",cd:0,e:"Absorve os primeiros 10 de dano; recarrega em descanso",desc:"Um gerador do tamanho de um punho, preso ao cinto, que projeta uma bolha de \"luz dura\" à volta do utilizador. Não atrapalha o movimento e salva vidas, sendo o luxo preferido de Estudiosos e Cinéticos ricos que desprezam o peso do metal."},
 {n:"Colete Tático Padrão",preco:150,t:"media",cd:2,e:"Sacar itens é Ação Livre",desc:"A espinha dorsal da infantaria leve e das forças de segurança. Feito de placas de cerâmica leve sobrepostas, aguenta alguns tiros de plasma antes de derreter. É o equipamento de confiança de Starlords e Pilotos que precisam das mãos livres rapidamente."},
 {n:"Traje de Bordo Atmosférico",preco:180,t:"media",cd:2,e:"Imune ao vácuo e gases",desc:"Volumoso e de cor viva (geralmente laranja ou branco) para facilitar resgates no espaço profundo. Tem o seu próprio suprimento de oxigénio (dura 12 horas) e é indispensável para Exploradores ou Catadores que vasculham naves à deriva com o casco rompido."},
 {n:"Exoesqueleto Leve de Combate",preco:300,t:"media",cd:4,e:"−2 Furtividade/Acrobacia; +50kg de carga",desc:"Uma estrutura de pistões hidráulicos que se alinha com as pernas e a coluna do utilizador. Inicialmente projetado para estivadores em portos espaciais de gravidade alta, foi rapidamente militarizado. O zumbido dos servomotores denuncia o utilizador a quilómetros de distância."},
 {n:"Armadura Reativa Urak",preco:450,t:"pesada",cd:3,e:"Reflete 1d4 térmico no corpo a corpo",desc:"Criada pelos habitantes de Urano, esta armadura não tem apenas placas de metal, mas veios de gelo químico e dissipadores de calor. Quando um inimigo atinge a armadura com uma arma branca, os dissipadores reagem, libertando uma onda de frio cortante ou calor intenso que queima as mãos do atacante."},
 {n:"Armadura de Engenharia Conjupitera",preco:500,t:"pesada",cd:4,e:"−2 Furtividade; +2 Mecânica",desc:"Um traje selado, atarracado e incrivelmente pesado, forjado nas fornalhas de Júpiter. Os braços têm maçaricos, chaves de calibração e fios de diagnóstico integrados nas manoplas. Um Mecânico a usar isto é um autêntico tanque de suporte."},
 {n:"Armadura Pesada Marciana",preco:650,t:"pesada",cd:6,e:"−4 Furtividade; exige For +2",desc:"O orgulho do Sindicato de Deimos. Placas angulares de liga de titânio vermelho-ferrugem. Transformam um humanoide num colosso de metal impenetrável. Um esquadrão a marchar com estas armaduras faz o chão da nave tremer."},
 {n:"Mecha-Suit de Assalto",preco:3500,t:"pesada",cd:8,e:"Sem Esquiva; ignora queda",desc:"Mais próximo de um veículo do que de uma armadura. O utilizador entra numa cabine blindada bípede. Usado pelas tropas de choque orbitais que saltam diretamente da atmosfera para o campo de batalha, esmagando o chão na aterragem e absorvendo fogo pesado. ## **🦾 IMPLANTES CIBERNÉTICOS** **O LIMITE CIBERNÉTICO: A REJEIÇÃO DA CARNE** *\"A carne é fraca, o metal é eterno. Mas o cérebro humano tem um limite para o quanto de eternidade consegue suportar.\"*"},
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

// ---------------- PROPRIEDADES DE ARMAS (palavras-chave mecanizadas) ----------------
// Efeito curto de cada palavra-chave, para exibir na rolagem e o jogador aplicar.
export const KEYWORDS = {
  "Oculta": "+2 no acerto contra desprevenidos ou em Ataque Furtivo.",
  "Ultra-Oculta / Surpresa": "Quase indetectável; +2 no acerto em surpresa/furtivo.",
  "Ágil": "Pode usar Destreza no lugar de Força no acerto e no dano.",
  "Compacto e Ágil": "Compacta; pode usar Destreza no acerto e no dano.",
  "Híbrida de Atributo": "Usa o melhor entre Força e Destreza.",
  "Aderência": "Vantagem em Acrobacia para escalar; +2 de dano fixo atacando de um ponto elevado.",
  "Derretimento": "Ignora qualquer bônus de armadura metálica do alvo.",
  "Concussão": "Acerto Crítico (20 natural) deixa o alvo Atordoado por 1 turno.",
  "Atordoante": "Dano máximo no dado faz o alvo perder a Ação de Movimento no próximo turno.",
  "Alcance": "Atinge a até 3m; sem ataque de oportunidade ao recuar.",
  "Alcance Maior": "Alcance estendido no corpo a corpo.",
  "Impacto": "Ao acertar, pode empurrar o alvo 2m para trás.",
  "Puxão": "Ao acertar, pode puxar o alvo 2m em sua direção.",
  "Derrubar": "Ao acertar, pode derrubar o alvo (fica Caído).",
  "Investida": "Bônus ao atacar após se mover em linha reta contra o alvo.",
  "Perfurante": "Ignora parte da armadura do alvo.",
  "Perfurante Leve": "Ignora uma pequena parte da armadura.",
  "Sangramento": "Ao acertar, o alvo sofre dano de sangramento nos turnos seguintes.",
  "Sangramento em Área": "Estilhaços: sangramento em todos os alvos da área.",
  "Tóxica": "Injeta toxina; o alvo testa Constituição ou sofre veneno.",
  "Silenciosa": "Disparo sem ruído — não denuncia sua posição.",
  "Silenciosa / Toxina Lenta": "Silenciosa; injeta toxina de ação lenta.",
  "Rajada": "Gasta o dobro de munição (conta como 2 turnos de disparo).",
  "Rajada Silenciosa": "Rajada sem ruído; gasta munição em dobro.",
  "Anti-Sintético": "Dano extra contra androides, drones e sintéticos.",
  "Marcador Térmico": "Marca o alvo; aliados o veem através de fumaça/paredes finas.",
  "Mira Telescópica": "Longo alcance; gaste a ação para mirar e ganhar bônus.",
  "Cone de Repulsão": "Empurra todos num cone à frente.",
  "Área 3x3m": "Atinge todos numa área de 3×3 metros.",
  "Explosão em Área 3x3": "Explode numa área de 3×3m; alvos testam para reduzir o dano.",
  "Sobreaquecimento": "Pode superaquecer se disparada em excesso.",
  "Curto Alcance": "Só é eficaz a curta distância.",
  "Curto Alcance / Descarregar": "Curto alcance; pode descarregar toda a carga de uma vez.",
  "Pesada": "Pesada — pode exigir preparação/apoio para disparar.",
  "Pesada / Queimadura": "Pesada; causa queimadura contínua.",
  "Pesada / Fogo de Supressão": "Pesada; suprime uma área (inimigos acovardados).",
  "Artilharia": "Arma de artilharia — dano massivo em área.",
  "Atravessa Paredes": "O disparo atravessa coberturas e paredes finas.",
  "Inesquivável / Contínuo": "Difícil de esquivar; dano contínuo.",
  "Despedaçador": "Dano brutal contra estruturas e armaduras.",
  "Destruidora": "Devastadora — dano muito alto.",
  "Brutal": "Rola o dado de dano com Vantagem (o maior de dois).",
  "Defensiva": "Concede bônus defensivo enquanto empunhada.",
  "Aparar": "Pode gastar a Reação para aparar um ataque corpo a corpo.",
  "Confiável": "Nunca falha por defeito; dano mínimo garantido.",
  "Saque Rápido": "Pode ser sacada como Ação Livre.",
  "Ferramenta": "Também funciona como ferramenta utilitária.",
};
// Deriva propriedades mecânicas a partir da palavra-chave da arma.
export function propsArma(cat) {
  const kw = (cat && cat.kw) || "";
  const low = kw.toLowerCase();
  const has = (t) => low.includes(t);
  const agil = has("ágil") || has("agil") || has("híbrida") || has("hibrida");
  const oculta = has("oculta") || has("surpresa");
  const brutal = has("brutal");
  const area = /área|area|cone|explos|rajada|supress|artilharia|atravessa|3x3/i.test(kw);
  const areaTxt = /3x3/i.test(kw) ? "3×3m" : has("cone") ? "cone frontal" : has("supress") || has("rajada") ? "área/linha" : area ? "área" : "";
  const alcance = has("alcance") || has("mira") || has("telesc");
  const alcanceTxt = has("curto") ? "curto" : has("mira") || has("telesc") ? "longo (mirar)" : has("alcance maior") ? "estendido" : has("alcance") ? "3m (corpo a corpo)" : "";
  return { agil, oculta, brutal, area, areaTxt, alcance, alcanceTxt, efeito: KEYWORDS[kw] || kw || "" };
}
