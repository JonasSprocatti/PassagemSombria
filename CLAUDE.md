# Passagem Sombria — Deck de Campo Online

Mesa virtual (VTT) para o RPG espacial *Passagem Sombria*. SPA estática em **JavaScript puro (ES modules)**, sem build. Backend: **Supabase** (Auth + Postgres + Realtime + Storage). Hospedagem: Vercel (site estático, raiz = `public/`). PT-BR em toda a UI, comentários e nomes.

## Como rodar

Precisa ser servido por HTTP (usa ES modules nativos — `file://` não funciona).

```
cd public
python -m http.server 3000   # abre http://localhost:3000
```

Antes: preencher `public/js/config.js` com `SUPABASE_URL` e `SUPABASE_ANON_KEY` (não versionado / placeholders). Segurança real fica na RLS do Supabase, não no front.

Não há testes automatizados nem lint. Verificação é manual no navegador (com um projeto Supabase configurado).

## Estrutura de arquivos

| Arquivo | Papel |
|---|---|
| `public/index.html` | Shell mínimo: monta `#app`, registra o service worker, carrega `js/app.js` como módulo. |
| `public/js/app.js` | **~4270 linhas — o app inteiro.** Roteador por hash, todas as telas, combate, chat, bancada, painel admin. Ponto de entrada. |
| `public/js/config.js` | Credenciais Supabase (placeholders no repo). |
| `public/js/dados-jogo.js` | Dados do sistema: `RACAS`, `CLASSES`, `FILOSOFIAS`, `ARMAS`, `ARMADURAS`, `IMPLANTES`, `SCRIPTS`, `NAVES`, `PERICIAS`, `KEYWORDS`/`PALAVRAS_CHAVE`, `CONSUMIVEIS`, pentes (`TIROS_POR_PENTE=3`, `PENTES_MAX=4`, `TIPOS_PENTE`), `MODS_ARMA`/`SLOTS_ARMA` (bancada), `UPGRADES_NAVE`, `AVARIAS`, `ESTACOES`. Helpers puros: `propsArma`, `chavesDaArma`, `custoTiro`, `modsDoSlot`, `acharMod`. |
| `public/js/efeitos.js` | Motor de **efeitos declarados** de fichas: `FichaEfeitos`, `Portador`, `EFEITOS`, `MOMENTOS`, `CONDICOES_ALVO`, `validarEfeitos`. Permite que conteúdo novo (implante/raça/classe/arma) altere atributos sem novo código. |
| `public/js/criaturas.js` | Motor de efeitos automáticos de **criaturas/inimigos** em combate: `class Criatura`, `GATILHOS`, `EFEITOS`, `criar`, `validar`. Carregado sob demanda. |
| `public/js/ui.js` | Modais reutilizáveis: `modalForm`, `confirmModal` (substituem `prompt`/`confirm`). Sons (`somDado`, `somCritico`…), `notificar`, prefs de som. Overlay `.mdl-overlay`. |
| `public/js/conteudo.js` | Conteúdo global editável pelo painel admin (tabela `conteudo`): `carregarConteudo`, `conteudo()`, `comAjustes`, `imagemDe`, `thumb`, `figura`. Cache em memória. |
| `public/js/dados-bestiario.js` | `BESTIARIO`, `NIVEIS_AMEACA`. |
| `public/js/dados-npcs.js` | `NPCS`, `PAPEIS`. |
| `public/js/dados-mestre.js` | `FACCOES`, `NIVEIS_REPUTACAO`, `TABELAS` (rolagem aleatória do Mestre), `REFERENCIA`. |
| `public/js/mapa-sistema.js` | **VTT ativo** (mapa compartilhado do Mestre): `abrirMapa({ mapa, combate, souMestre, salvar, aoFechar })`, `POI_TIPOS`. Import dinâmico. |
| `public/js/sistema-solar.js` | Seletor 3D de planeta/raça (Three.js sob demanda): `abrirSeletorPlanetas(RACAS, onSelect)`. Import dinâmico. |
| `public/js/criacao.js` | Assistente de criação de personagem: `abrirCriacao({ onCriar, onCancelar, abrirSistemaSolar })`. Import dinâmico. |
| `public/sw.js` | Service worker PWA. `CACHE = "ps-shell-vNN"` — **incrementar a cada deploy relevante**. HTML: network-first; estáticos: stale-while-revalidate; Supabase/esm.sh: rede direta. |
| `public/css/estilo.css` | Todo o CSS. Seções marcadas com `/* ---- NOME ---- */`. |
| `public/js/mapa.js` | **LEGADO / não importado.** Substituído por `mapa-sistema.js`. Não editar sem confirmar.

Bibliotecas via CDN direto (sem npm): `@supabase/supabase-js@2` de `esm.sh`, Three.js sob demanda. Fontes: Google Fonts (Chakra Petch, IBM Plex Sans/Mono).

## Mapa interno de `app.js`

Seções demarcadas por comentários `// ---------------- NOME ----------------`. Faixas aproximadas (linhas deslocam com edições):

| Linhas | Bloco |
|---|---|
| 1–95 | Imports, `sb` (client Supabase exportado), helpers de dados (`parseDice`, `rollNd`, `d`, `sign`), `sessaoAtiva`. |
| 111–190 | **Ficha**: `novaFichaDados()` (shape do objeto `f`), `calc(f)` → `k` (derivados: `attr`, `per`, `ramMax/ramLivre`, `cd`, `conj`, `iniciativa`, `deslocamento`, `k.efeitos`), `ganhosDoNivel`. |
| 192–318 | Ficha imprimível (`gerarFichaHTML`, imprimir/baixar). |
| 319–440 | Descansos (curto/longo), `habilidadesAtivas`, `reporPentes`, `aplicarDescanso`, `danoArma`. |
| 441–485 | Combate espacial + ferramentas do Mestre (`danoNave`, `orcamentoEncontro`, `sugerirEncontro`, `rolarTabela`). |
| 486–570 | `CONDICOES_INFO`/`CONDICOES`, temas, acessibilidade (`aplicarA11y`, `montarA11y`). |
| 571–640 | **Roteador** (`rotear` — hash routes), `telaFichaPublica`, `shell()` (layout base). |
| 642–775 | `CONTEUDO_EXTRA` (espelho síncrono do conteúdo admin p/ `calc`), `armaMontada` (aplica mods à arma), **`abrirBancada`** (HUD de mods de arma). |
| 776–860 | `etiquetasKw`, `escalaTabela`, lazy `criaturaMod`/`conteudoMod`, `sincronizarExtra`. |
| 860–935 | `avisar` (toast com desfazer), atalhos de teclado. |
| 935–1030 | `estadoArma`, `normalizaPentes`, animações (`contarAte`, `cenaNivel`, `animarBarras`), `iniciar()` (bootstrap). |
| 1046–1120 | `telaLogin`, `telaHangar` (lista de personagens). |
| 1122–1646 | **`telaFicha(id)`** — edição completa, level up, loja, inventário, equipar, bancada, nano-tatuagens. |
| 1647–1682 | `telaCampanhas` (criar / entrar por código). |
| 1683–3614 | **`telaMesa(id)`** — a maior. Chat + rolagens + dano/cura + combate pessoal + combate espacial + nave + postos + mapa + diário + estatísticas. Realtime via `sb.channel('mesa-<id>')`. Sub-blocos: painel de combate (~1790), aba "Meu personagem" (~1846), munição/pentes (~1849), ações de mesa e **handler `[data-atq]`** de ataque de arma (~2967), habilidades ativas (~3168), scripts/conjuração (~3390), postos de nave (~3410), estaleiro/upgrades (~3490). |
| 3615–3702 | `telaBiblioteca` (regras, raças, classes, armas… somente leitura). |
| 3703–4270 | **`painelAdmin`** — CRUD do conteúdo global (tabela `conteudo`), ajustes e imagens. |

## Modelo de dados

- **`f`** = objeto `dados` do personagem (JSONB em `personagens.dados`). Shape canônico em `novaFichaDados()`. Sempre mesclar sobre ele: `{ ...novaFichaDados(), ...(row.dados||{}) }`.
- **`k = calc(f)`** = derivados recalculados a cada render; nunca persistido. `k.efeitos` é a instância `FichaEfeitos` (motor declarativo).
- **`dcSalvaguarda(k, atributo)`** = `8 + mod` — CD de teste de resistência forçado por **habilidade** de personagem (`salvaguarda`). Palavras-chave de arma e granadas usam o `cd` **fixo do texto** (13 físico / 14 Acrobacia); granadas com `pericia` (Acrobacia) rolam `d20 + attr + perícia`.
- **`aplicarCond(alvo, cond, turnos)`** (módulo) — aplica condição no rastreador com a regra da mesa: **dano contínuo** (Sangrando/Em chamas/Envenenado) empilha **+1 turno** se já ativa (nunca aumenta o dado, sempre 1d4/1d6/1d4 fixo); **estado** renova para a maior duração. Guarda `turnos+1` para condições de estado porque o `#cb-prox` decrementa no início do turno do afetado antes dele agir. Padrão de duração: hard (Atordoado/Paralisado/Congelado) 1t · estado (Cego/Caído/Marcado/Lento/Amedrontado/Enfraquecido/Silenciado) 2t · dano 3t.
- **Condições no fluxo de ataque** (`[data-atq]`): atacante **Cego/Amedrontado/Envenenado** → Desvantagem; **Enfraquecido** → `danoFinal × 0.5`; **Atordoado/Paralisado** (não-Mestre) → bloqueio via `minhaTrava()`. Alvo **Marcado** → +2 acerto de quem o ataca; alvo **Atordoado/Paralisado/Caído/Cego** → Vantagem contra ele. Vant/desv de todas as fontes somam e reduzem a −1/0/+1. `#conjurar` e `[data-hab-usar]` também respeitam `minhaTrava(["silenciado"])`. **Paralisado a até 2m** é Crítico automático (não só Vantagem) — `paralisadoPerto`/`multCrit` em `[data-atq]` e `paralisadoPerto2`/`critAuto2` em `.cb-atk`; nat 1 ainda falha. Já foi bug real: só dava Vantagem, igual às outras condições do grupo `alvoAberto`, sem o multiplicador que o texto da condição promete.
- **Movimento no campo tático × condições**: Paralisado/Congelado/**Lento** bloqueiam o movimento por completo (deslocamento zero); só **Caído** (ou ter tentado **Apagar fogo** no próprio turno, `c._movMetade === rodada`) reduz a deslocamento à metade. Já foi bug real: Lento estava agrupado com Caído (metade do deslocamento) em vez de "perde a Ação de Movimento" (zero) — checar em `.cb-token.movivel` → `pointerdown`.
- **Mecânicas de condição que exigiam ação do jogador** (`.acoes-mesa`, aba "Meu personagem", só aparecem em combate ativo e com a condição presente):
  - **🔥 Apagar fogo** (`#cb-apagar-fogo`): gasta Ação Principal **e** Reação (duas chamadas a `gastarAcao`), marca `linha._movMetade = rodada` (deslocamento pela metade neste turno, limpo no `#cb-prox` seguinte), rola **d20 puro sem modificador** — ≥10 remove "Em chamas" na hora, <10 continua queimando (mas as ações já foram gastas).
  - **🧎 Levantar** (`#cb-levantar`): gasta Ação Principal **e** Ação de Movimento, remove "Caído" na hora, sem rolagem.
  - Os dois respeitam o mesmo gate de turno do `[data-atq]` (não-Mestre só usa no próprio turno) e `minhaTrava()`.
- **Desvantagem de condição em testes de perícia** (fora de ataque): `desvPorTeste(condsList, pericia)` em `telaMesa` — **Cego** só atrapalha testes visuais (`PERICIAS_VISUAIS`: Percepção, Investigação, Prestidigitação, Pilotagem); **Envenenado** só testes físicos (`PERICIAS_FISICAS`: Atletismo, Acrobacia, Furtividade). Usado em `#rolar-per` e nos dois lados do `#teste-oposto` (`rolarEEnviar` ganhou um 4º parâmetro `vantOverride` pra isso). Fora dessas listas, a condição não pesa no teste — é intencional (não é geral, só onde faz sentido narrativo).
- **Amedrontado com fonte rastreada**: `aplicarCond(alvo, cond, turnos, origemId)` — 4º parâmetro opcional, guardado como `cond.origemId` na linha do rastreador. Preenchido pelas 3 rotas que hoje aplicam Amedrontado no atacante real: `aplicarEmAlvos` (salvaguardas/scripts/granadas, usa `minhaLinhaCb()?.id`), o gatilho `ao_acertar` de criatura em `.cb-atk` (usa `c.id`), e `aplicarCondsNoAlvo` de palavra-chave/munição em `[data-atq]` (usa `minhaLinhaCb()?.id`). Com `origemId` conhecido: a Desvantagem em `[data-atq]` só vale atacando essa fonte (`desvPorMedo`), e o bloqueio de aproximação no campo tático (`.cb-token.movivel`) mede a distância só até ela, não até "qualquer inimigo". Sem `origemId` (condição aplicada por uma rota antiga que não foi atualizada, ex. o Mestre aplicando manualmente por `.cb-cond-add`) cai no comportamento antigo — vale contra/para qualquer inimigo, pra não enfraquecer a condição silenciosamente.
- **`aplicarDanoAlvo(alvo, valor)`** (helper em `telaMesa`) = ponto único de todo dano ROLADO contra um combatente. Ordem: couraça por limiar de criatura (`habs` com `imunidade.limiar`) → redução de dano do alvo (`k.efeitos.aoSofrer().reducao`, jogador) → corpo (`sincronizarFicha`). Nave → `danoNave` + persiste `camp.nave` se `nave_party`. Os botões `±5` / definir HP do Mestre NÃO passam por aqui (ajuste livre). Usado por `.m-aplicar`, blocos `alvoNave`/`alvoCombatente` do `[data-atq]` e `aplicarEmAlvos`.
- **`c.cd` do jogador no rastreador é uma FOTO**, tirada uma vez em `#cb-iniciar` (`cd: kk.cd`) — não recalcula sozinha depois. `sincronizarCdCombate(personagemId, dadosFicha)` (helper em `telaMesa`, perto de `salvarCombate`) recomputa `calc(dados).cd` e atualiza a linha se mudou; chamado nos 4 pontos onde `f.modos`/`f.modosAte` mudam em combate: ativar modo/criar (Criogénese, Endurecer…), Êxtase da Batalha (`tipo:"tabela"`), ligar/desligar o gás do Ven'y, e a expiração automática de modos no `#cb-prox`. Sem isso, um jogador que ativa Criogénese (Escudo de gelo, +2 Defesa) **em pleno combate** segue tomando dano como se a CD não tivesse mudado, porque `.cb-atk`/`[data-atq]`/`aplicarEmAlvos` checam `alvo.cd` da linha, não recalculam do zero. Já foi bug real — CD do Urak ficou 2 pontos abaixo do esperado depois de criar o escudo em combate.
- **`defesaNaveParty()`** = `10 + manobra + bonusDefVeiculo()`, onde `bonusDefVeiculo()` soma `efeitos.defesaVeiculo()` do personagem do piloto no leme (Instinto Evasivo). Usado no painel de combate, aba nave e Manobra Evasiva.
- **`aurasAtivas()` / `auraNega(oque)`** = auras de criatura (`hab.gatilho === "aura"`) das criaturas vivas no rastreador. Sem posição, valem para todo o combate. `auraNega("tecnomancia")` bloqueia `#conjurar`; `auraNega("cura")` bloqueia `#enviar-cura`. Banner no painel de combate lista todas. **`#cb-add-btn` copia `b.habs` para a linha do combate** — sem isso, auras, couraça por limiar (`aplicarDanoAlvo`) e efeitos automáticos de criatura (`#cb-prox`) não funcionavam para bicho do bestiário. Criaturas com aura: `Silenciador Cósmico` (nega tecnomancia+implantes), `A Ferida do Mundo` (nega cura+tecnomancia+implantes).
- **`modosAtivosDe(f)`** lê efeitos de modo em `h.opcoes`/`h.resolve.opcoes` (gás Ven'y, Êxtase) **e** em `h.resolve.efeitos` (Endurecer — modo sem opções). Sem esse último, Endurecer não reduzia dano.
- **Ataque de jogador em combate**: não-Mestre só ataca no próprio turno (bloqueio; o Mestre rola pelo ⚔ da linha dele). Com alvo escolhido, o seletor abre já com um inimigo selecionado; "sem alvo" é a última opção (para atacar algo fora do rastreador).
- **Modo Jogador** (`#modo-jogador`, só para `ehMestreReal`): toggle no topo da mesa que zera `souMestre` (guardado em `localStorage` `ps-modojog-<id>`) para o Mestre testar/jogar como tripulante — some as ferramentas de Mestre e valem os bloqueios (turno, Atordoado). `souMestre` é `let` reatribuído no toggle + `render()`. `ehMestreReal` guarda a permissão verdadeira.
- **`.cb-atk`** (⚔ na linha do rastreador, Mestre): agora **mira um alvo primeiro** e resolve acerto (`acerto` vs `alvo.cd`, +2 se alvo Marcado, Vantagem se alvo exposto) + dano via `aplicarDanoAlvo`, marcando `alvo_resolvido`. Ataques `bonus == null` (efeito automático / teste de resistência) continuam só postando o dado.
- **Campo tático** (`#cb-campo` no painel de Combate): grade 2D rasa — `CAMPO_LARGURA=40`m, `CAMPO_PISTAS=3` (frente/meio/fundo), `PISTA_M=1`m entre pistas (profundidade rasa), `ALCANCE_CAC=1.5`m (corpo-a-corpo), `ALCANCE_ARMA={curto:15,medio:30,longo:40}`. Cada combatente não-nave tem `c.pos = {x, lane}`. `distCombate(a,b)` = `hypot(dx, dlane*PISTA_M)`. `posInicial(ordem, tipo)` — aliados à esquerda / inimigos à direita, espalhados nas pistas; atribuído em `#cb-add-btn`, no auto-invocar e migrado em massa no início de `telaMesa`. **Janela visível**: `vistaCampo {ini,fim}` + `pctX(x)` calculados por render — campo inteiro (40 m) ou aproximado (`campoZoom`, janela `CAMPO_JANELA=12` m centrada no token selecionado / no turno atual). A grade vem de `--g1`/`--g5` inline (passo em % da janela), então o `repeating-linear-gradient` do CSS serve as duas escalas. Régua adapta o passo (1 m no zoom, 5 m no geral). **Seleção** (`tokenSel`): clique num token desenha a banda `.cb-alcance` (±`ALCANCE_CAC`), marca quem está no alcance (`.perto`, prefixo ⚔) vs fora (`.longe`, esmaecido) e lista distâncias em `.cb-distancias`. Arrastar (`.cb-token.movivel`): jogador move o seu só no turno, limite `k.deslocamento` (½ Caído/Lento, 0 Paralisado/Congelado); Mestre move qualquer um; clique sem arrastar (<0,4 m) seleciona. O arraste converte px→metros pela janela visível, não pela largura total. **Alcance de arma ligado**: `alcanceDaArma(cat, pr)` → branca `ALCANCE_CAC` (1,5 m; 3 m com a chave Alcance), fogo `ALCANCE_ARMA.curto/medio/longo` (15/30/40) conforme Alcance Maior / Telescópica. No `[data-atq]` a checagem roda **antes de gastar munição**: jogador sem ninguém no alcance leva `alert` e o tiro nem acontece; o seletor só lista quem está no alcance (o Mestre vê todos, marcados com “⚠ fora de alcance”, e pode forçar — aí a resolução posta “não alcança” sem dano). `.cb-atk` mostra a distância de cada alvo e avisa fora de alcance (sem bloquear — quem conduz é o Mestre); ataques derivados de jogador carregam `alcance`. **Falta ligar**: auras só no raio, área por ponto de impacto, Amedrontado não aproxima.
- **Gatilhos de criatura** (`#cb-prox`): `INICIO_TURNO` agora resolve `invocar` (auto-adiciona a criatura ao rastreador com `pos`) e `condicao` (`alvo:"proprio"` aplica no próprio; senão narra); `FIM_TURNO` roda para quem encerrou o turno; varredura `AO_MORRER` uma vez por turno em quem caiu (marca `_morreu`). `zona`/`imunidade` fora de `gatilho:"aura"` são narrados.
- **`habsDoCombatente(c)`** — linhas antigas do rastreador foram salvas **sem `habs`**, o que matava auras, regeneração, invocação e couraça. Reidrata do bestiário pelo nome (tirando o sufixo ` #N`) e gruda na linha. Usado por `aurasAtivas`, `aplicarDanoAlvo` (limiar) e os três gatilhos do `#cb-prox`. Sempre preferir a ele em vez de ler `c.habs` direto.
- **`aplicarEmAlvos` retorna** `true` (resolveu ou narrou) / `false` (cancelou sem mirar). Chamadores devolvem o recurso no `false`: `#conjurar` (RAM), `.item-usa` (granada), `[data-hab-usar]` salvaguarda (não marca `usos`).
- **Condições no rastreador**: `.cb-conds` saiu de dentro de `.cb-nome` (que tem `nowrap`+`overflow:hidden` e escondia múltiplas) — agora é um bloco `flex:1 1 100%` que quebra para uma faixa própria sob a linha. Badge azul (`estado`) para condição sem dano, vermelho (`sangra`) para com dano.
- **Munição**: cada arma de fogo tem o próprio pente carregado (`item.tiros`, `item.tipoPente` no inventário); a reserva (`f.pentes`, mapa `tipo → qtd`) é compartilhada. Migração de fichas antigas via flag `__migrouArma` / `f.tirosPente` (legado de pente único).
- **Limite de pentes**: `k.pentesMax = max(2, 5 + mod de Força)` (1 no cano + resto na reserva); `k.pentesReserva = pentesMax − 1` é o teto da mochila. Calculado em `calc()` após os efeitos (buffs de Força contam). Sites sem `k` usam `pentesReservaDe(f)` (chama `calc`). `dados-jogo.js` ainda exporta o antigo `PENTES_MAX=4`, mas o app não usa mais para o teto.
- **`propsArma(cat).efeito`** = descrição legível das palavras-chave da arma, montada palavra por palavra (`chaves.map(c => KEYWORDS[c.nome])`). Já foi bug real: buscava `KEYWORDS` pela string **inteira e crua** da arma (`"Destruidora, Perfurante, Aparar"`), que nunca bate com nenhuma chave do dicionário (que é uma por palavra-chave), e caía de volta no próprio `cat.kw` — a mensagem de ataque saía com `🏷 Destruidora, Perfurante, Aparar: Destruidora, Perfurante, Aparar.` (rótulo repetindo o valor). Corrigido; e a mensagem de ataque (`[data-atq]`) parou de reexibir as palavras-chave ali (já aparecem nos marcadores — Brutal, Ágil — e em "ignora N de armadura"), pra não duplicar informação.
- **Defesa mostrada no log de ataque**: sempre por extenso, base → modificadores → efetiva (`Def 15 −2🗡 = 13`), nunca só o número final seguido de um modificador solto (`Def 13 · 🗡−2` lia como se ainda faltasse subtrair algo — o 🗡 já estava embutido no 13).
- **Mods de arma** (bancada): `item.mods` = `{ slot: nomeDaPeça }`. `armaMontada(catBase, item)` devolve a arma com `kw`, `_efeitos`, `_tirosExtra`, `_mods` aplicados. Peças em `MODS_ARMA`.
- **Ataque de arma mirado** (`[data-atq]` em `telaMesa`): quando há combate ativo, o seletor de alvo (combatentes do rastreador) só aparece se `souMestre` **ou** for a vez do personagem (`camp.combate.ordem[turno].personagem_id === meuPers.id`); ao mirar, acerto (`total` vs `alvo.cd − pr.ignoraArmadura`) e dano se resolvem sozinhos e o payload da rolagem ganha `alvo_resolvido` (esconde o botão “🩸 aplicar” do Mestre). No acerto, `aplicarCondsNoAlvo()` aplica as condições declaradas: `pr.aoAcertar` (palavra-chave) + `munCond` (munição especial), rolando `d20 + Con` vs o `cd` de cada uma quando há CD. `pr.ignoraArmadura` também vai no payload (`ignoraArmadura`) para o `.m-aplicar` usar quando não houve alvo. `ataquesDoCombatente(c)` deriva ataques de linhas de jogador no rastreador para o Mestre rolar/direcionar por eles.
- **Botão “🩸 aplicar N de dano”** (`.m-aplicar`, Mestre, mensagens de `rolagem` com `dano_total`): se a rolagem carrega `payload.total`, compara com a Defesa efetiva (`alvo.cd − payload.ignoraArmadura`, ou `10 + manobra` para nave). Rolagem < Defesa (ou `fumble`, e sem `crit`) → `confirmModal` de override; recusando, posta “errou” e não aplica. Aplica via `aplicarDanoAlvo`. Ataques sem rolagem de acerto (`payload.total == null`) aplicam direto.
- **`resolve:{tipo:"disputa"}`** (Invasão da Sombra): disputa real de `d20 + atributo` contra um combatente escolhido do rastreador — personagem usa o atributo real (`calc`), inimigo usa `NIVEIS_AMEACA[ameaca].ordem` (0–6) ou `cd − 10`. **Exige alvo**: sem combate ativo / sem candidatos → `alert` e não rola; fechar o modal sem escolher também aborta. Vitória tagueia o alvo com a condição `dominado` (1 turno); derrota causa `derrota.danoProprio`. Marca `usos` (1×/descanso) só se chegou a rolar.
- **`aplicarEmAlvos({...})`** (helper em `telaMesa`, antes de `render`): resolve uma ação contra 1 ou vários combatentes do rastreador. Modos: `acerto` (conjurador rola `d20 + acerto` vs `alvo.cd`), `atributo`+`cd` (alvo faz teste de resistência `d20 + atributo` vs CD — bônus do inimigo = ordem da ameaça ou `cd − 10`), ou nenhum (área que pega todo mundo marcado). `area:true` abre um `select` por combatente (inimigos pré-marcados) para marcar quem está no efeito. Aplica `dado` de dano (rolado 1×) e/ou `cond` por `turnos` a quem o efeito pegou; `snapshot` + `salvarCombate` + resumo em `sistema`.
- **`resolve:{tipo:"salvaguarda", atributo, cd?, dado?, cond?, turnos?, area?}`**: Fogo de Supressão (Sab → Amedrontado), Grito de Saqueador (Sab, área → Amedrontado), Sinfonia do Inverno (Con, área, 4d8 → Paralisado). CD do teste = `dcSalvaguarda(k, atributo)` = 8 + mod.
- **Scripts ofensivos** (`SCRIPTS[i].resolve = {tipo:"ataque", dado, area?}`): Choque Estático, Curto-Circuito em Armadura, Formatar Mente Quântica (alvo único, `d20 + k.conj` vs Def), Sobrecarga de Sistema/Reator (área). O `#conjurar` roteia por `aplicarEmAlvos`.
- **Consumíveis `efeito:"condicao"`** (granadas): roteados por `aplicarEmAlvos` com `area:true`; save só quando o item tem `cd` (usa Con). Sem `cd` → aplica a quem for marcado.
- **Postos de nave** (`[data-est]`): ações com `rola:null` (Fuga de Dobra, Sobrecarga de Propulsores) são tratadas **antes** do `return` genérico — antes elas nunca executavam. *Sobrecarga* → `nt.manobraExtra/manobraAte` (entra em `defesaNaveParty()`, expira na virada de rodada) + dano de choque. *Fuga de Dobra* → `nt.dobra {cargas, cascoRef}`; 2 cargas sem perder casco ⇒ `naveEmCena = false` e a tripulação escapa. *Guerra Eletrônica* → `d20 + Int + Tecnomancia` vs `defesaNave(alvo)`; sucesso põe `alvo.escudosOff = 2` e `danoNave` deixa de absorver com escudo (decrementa no turno da nave; a linha mostra `⚡off`). *Tiro de Precisão* → rola com Desvantagem e, com dano no casco, aplica a condição `Subsistema off` por 1d4 turnos.
- **Scripts de cura/reparo**: `resolve:{tipo:"cura",dado,attr}` (Rollback Celular) e `resolve:{tipo:"reparo_nave",dado}` (Reparo Estrutural em Massa) mandam; o regex no texto (`/Cura (\d+d\d+)/`, `/(\d+d\d+) do casco/`) ficou só como rede para conteúdo do painel admin que ainda não declara `resolve`.
- **PV Temporário e escudo pessoal**: `f.pvTemp` e `f.escudoGasto` na ficha; `k.escudoMax` vem de `armadura.absorve` (Escudo de Energia Pessoal = 10), `k.escudoLivre = escudoMax − escudoGasto`. Ordem de absorção em `aplicarDanoAlvo`: imunidade a tipo → couraça por limiar → redução (só dano físico) → **escudo pessoal** → **PV Temporário** → corpo. Qualquer descanso recarrega o escudo e dissolve o PV Temporário. Concedido por `resolve:{tipo:"pvtemp",dado,attr?,pericia?,proprio?}` (Reparo Tático, Firewall Ativo) e `resolve:{tipo:"drenar_escudos"}`. PV Temporário **não soma**: fica o maior.
- **Tipos de dano**: `TIPOS_DANO` (físico, térmico, químico, elétrico, psíquico, gélido, ácido, verdadeiro). `tipoDanoArma(cat)` deriva da palavra-chave; `tipoDanoAtaque(atk)` lê o `extra` da criatura; munição especial sobrepõe (`TIPOS_PENTE[x].tipoDano`); scripts/habilidades/granadas declaram `tipoDano`. `imuneAoDano(habs, tipo)` respeita `imunidade` cujo `a` é um tipo (Espectro do Vácuo = imune a físico). "verdadeiro" ignora tudo.
- **Economia de ações**: `linha.acoes = {p, m, r}` (gastas) na linha do rastreador. `gastarAcao(textoDaAcao, oque)` mapeia "Ação Principal"→`p`, "Ação de Movimento"→`m`, "Reação"→`r`, Ação Livre→grátis; bloqueia o jogador e deixa o Mestre forçar. `p`/`m` zeram no turno do próprio; `r` zera na virada de rodada — por isso **Reações funcionam fora do turno**. Consomem: atacar, conjurar (pelo `s.a`), habilidade (pelo `hRaw.acao`), item (`cfg.acao`), mover no campo e trocar pente. Indicador `P M R` na linha de quem está agindo.
- **Cobertura**: `c.cobertura` 0/1/2 (botão 🚫/🧱/🏚 na linha, Mestre). Soma `+0/+2/+5` na Defesa **só contra ataques à distância** (arma branca ou `alcance ≤ 3 m` ignora).
- **Surpresa / eventos**: `#cb-surpresa` marca quem emboscou; o resto ganha a condição `Surpreso` (1 turno, bloqueia ação) — Código do Sobrevivente e imunidades com /surpres/ passam. `#cb-evento` agenda `camp.combate.eventos[]` com contagem regressiva por rodada.
- **Bandos**: linha do rastreador com `qtd > 1` representa N lacaios. O dano transborda: mata um, o excesso vai para o próximo. Mostra `×N` no nome e no token.
- **1×/sessão**: `abilidadesDeSessao(f)` cataloga `freq:"sessao"` (ou texto "1x/sessão"); o Mestre abre uma sessão pelo painel (`mestre-sessao` → `descanso` com `payload.tipo="sessao"`), e cada cliente limpa os `usos` correspondentes.
- **Overclock de RAM**: sem RAM, `#conjurar` oferece pagar com Vida — Bateria Interna (1d8, scripts de custo ≤2) ou Overclock manual (1d6 por ponto que falta).
- **Teste oposto** (`#teste-oposto`): escolhe a sua perícia, o alvo e a perícia dele; rola os dois e o empate favorece a defesa.
- **Ainda narrativas** (mensagem de sistema, Mestre adjudica): Repulsão Cinética (`tipo:"condicao"`, sem teste), "Espere, podemos resolver isto", scripts de controle sem dano (Hackear Implante Motor, etc.), e a resistência adaptativa do Enxame (muda de tipo a cada combate). **Cegueira Cibernética** foi mecanizado: `resolve:{tipo:"ataque",cond:"Cego",turnos:2}` (sem `dado`) — o `#conjurar` já suportava `tipo:"ataque"` com dano; passei a repassar `cond`/`turnos` pra `aplicarEmAlvos` também nesse branch, então script ofensivo agora pode ser "dano", "condição" ou os dois. Rola `d20 + conj` vs Defesa do alvo; acertou → aplica Cego 2 turnos via `aplicarCond`.

## Supabase

**Tabelas**: `perfis` (id, apelido, avatar_url), `personagens` (dono_id, campanha_id, nome, `dados` JSONB, publico, token_publico, atualizado_em), `campanhas` (nome, codigo, mestre_id + colunas JSONB `nave`/`mapa`/`combate`/`bestiario`/`contratos`/`faccoes`/`handout`), `campanha_membros` (campanha_id, perfil_id, posto), `mensagens` (campanha_id, autor_id, personagem_id, tipo, conteudo, `payload` JSONB), `mestre_notas` (campanha_id, texto), `conteudo` (tipo, chave, `dados` JSONB — conteúdo global do painel admin).

**Mensagens** `tipo`: `mensagem` | `rolagem` | `sistema` | `descanso`. Rolagens guardam `payload.total`, `payload.dano_total`, `crit`, `fumble`, etc.

**RPC**: `entrar_campanha({ cod })` → id da campanha.

**Realtime**: `sb.channel('mesa-<id>')` ouve INSERT em `mensagens`. Persistência de estado de combate/nave é o Mestre gravando colunas JSONB de `campanhas` (com `snapshot()` para desfazer).

**Cuidado — histórico do chat**: toda busca de `mensagens` com `limit` **sem** filtro de "a partir de agora" precisa ser `.order("criado_em", { ascending: false }).limit(N)` e **depois inverter o array** (`[...data].reverse()`) antes de usar em ordem cronológica. Buscar `ascending: true` + `limit(N)` pega as N mensagens mais **antigas**, não as mais recentes — numa campanha com mais de N mensagens (fácil de bater: cada ação de combate gera várias `sistema`), tudo recente some, sem erro nenhum. Já foi bug real (histórico do chat em `telaMesa`, backup em `fazerBackup`, linha do tempo em `painelLin`, `#abrir-diario` — os quatro corrigidos juntos). Exceção correta: `recapitular()` usa `.gt("criado_em", ultima).order(asc)` — aí `ascending: true` está certo, porque o corte já é "desde a última visita" pra frente.

**Cuidado — handlers "mutar tudo, salvar 1×"**: vários handlers grandes (`#cb-prox`, `[data-atq]`, `.cb-atk`) mutam `camp.combate` em vários pontos e só chamam `salvarCombate()`/`salvarCampanha()` **uma vez no final**, pra não disparar o eco do realtime no meio. Qualquer exceção lançada entre o início do handler e esse save final faz a rodada inteira (dano, condição, turno, invocação) ficar só na tela e sumir ao recarregar — sem alerta nenhum, porque o `catch` de erro do Supabase nunca é alcançado. Blocos de efeito automático/narrativo (`habsDoCombatente(...).disparar(...)`, gatilhos de criatura) devem ir em `try/catch` isolado para não arriscar o save principal.

**Storage**: upload de foto de personagem (comprimida no cliente antes do envio).

## Convenções

- Vanilla JS, sem framework. Telas = funções que geram string HTML e fazem `app.innerHTML = ...`, depois religam handlers (`app.querySelectorAll(...).forEach(b => b.onclick = ...)`). Re-render total, não diffing.
- `$` / `$$` = atalhos de `querySelector`/`All`. `esc()` sempre em texto vindo do usuário dentro de template string.
- Confirmações: `confirmModal` / `modalForm` de `ui.js` — nunca `alert`/`confirm` nativos para fluxo (só `alert` para erro seco).
- Ações destrutivas do Mestre usam `avisar(texto, aoDesfazer)` (desfazer) ou `snapshot()` antes.
- Sem dependências novas sem necessidade real. Sem passo de build — o que está no arquivo é o que roda.
- PT-BR em identificadores de domínio (`arma`, `pente`, `nave`, `posto`, `mestre`).

## Camadas de z-index (CSS) — fonte recorrente de bug

`.mp-overlay` 9998 · `.ss-overlay` 9999 · `.pular-link` 10001 · **bancada** (inline em `abrirBancada`) 10020 · `.cri-overlay` 10030 · `.aviso` 10040 · `.nv-cena` 10050 · **`.mdl-overlay`** (modais de `ui.js`) **10060** — deve ficar acima de tudo, pois exige decisão do usuário. Ao criar um overlay novo, conferir se um `confirmModal` disparado de dentro dele ainda aparece por cima.

## Deploy (Vercel)

Root Directory vazio · Output Directory `public` · sem Build/Install Command. Após mudança relevante em arquivo do `SHELL`, **incrementar `CACHE` em `public/sw.js`** senão o PWA serve a versão velha.

## Verificação de mudanças

Não há testes. Para validar:
1. `cd public && python -m http.server 3000`, abrir no navegador com `config.js` apontando p/ um projeto Supabase real.
2. Exercitar o fluxo tocado (ex.: criar personagem → equipar arma → entrar em campanha → atirar no chat → abrir bancada e instalar/remover mod).
3. Olhar o console do navegador — um `ReferenceError` num handler faz o clique "não fazer nada" silenciosamente.
