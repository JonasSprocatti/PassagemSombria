# Passagem Sombria

Mesa virtual (VTT) para o RPG de mesa espacial **Passagem Sombria** — SPA estática em JavaScript puro (ES modules, sem build), com Supabase como backend (Auth + Postgres + Realtime + Storage) e deploy na Vercel.

O projeto cobre a jornada inteira de uma sessão: criar personagem, entrar numa campanha, jogar em tempo real numa mesa com chat/rolagens/combate tático/combate espacial, e consultar a biblioteca de regras do sistema — tudo em português.

## Visão geral

- **Fichas de personagem**: criação guiada (raça/classe/filosofia/perícias, rolagem de atributos ou pontos), inventário, implantes, munição por arma, ficha imprimível.
- **Campanhas**: código de convite, chat em tempo real, rolagens de dados, combate pessoal e espacial, controle de dano/cura, descansos, mapa do sistema para o Mestre.
- **Combate tático**: rastreador de iniciativa, campo tático 2D (posição, alcance, cobertura, condições), combate de nave integrado ao mesmo campo.
- **Painel do Mestre**: tabelas de rolagem aleatória, facções e reputação, orçamento de encontro, contratos, linha do tempo, backup/restauração de campanha.
- **Biblioteca**: raças, classes, filosofias, arsenal (armas + palavras-chave + mods de bancada), armaduras, implantes, naves, bestiário, NPCs e a aba **Regras** (manual de bolso gerado a partir das próprias constantes do sistema).
- **Painel de administração**: CRUD do conteúdo global (criaturas, armas, armaduras, implantes, consumíveis, naves, NPCs, palavras-chave, raças, classes) direto no navegador, sem precisar mexer em código para expandir o sistema.
- **Macros de teclado**: teclas `1`–`9` e `Shift+1`–`Shift+9` disparam ataque/teste/habilidade/item/script configuráveis por personagem; sem configurar nada, as armas equipadas já ocupam as primeiras teclas sozinhas.
- **PWA**: funciona offline/instalado, com service worker versionado e auto-atualização de aba aberta.

## Stack

- JavaScript puro com ES modules — sem framework, sem passo de build.
- HTML/CSS customizados (`public/css/estilo.css`).
- Supabase: Auth, Postgres, Realtime (chat e presença), Storage (fotos de personagem).
- Vercel para hospedagem estática (`public/` como raiz).
- Three.js carregado sob demanda só no seletor 3D de planeta/raça.
- Testador embutido do Node (`node:test`) para as funções puras de regras — sem `package.json`/`node_modules`.

## Estrutura do projeto

```text
PassagemSombria/
├── README.md
├── CLAUDE.md              # mapa detalhado do código para quem desenvolve com IA
├── .gitignore
├── .github/workflows/testes.yml   # roda `node --test` a cada push/PR
├── tests/                 # dados-jogo.test.js, regras.test.js, validacao.test.js
└── public/
    ├── index.html
    ├── manifest.json
    ├── sw.js               # service worker PWA — CACHE incrementado a cada deploy relevante
    ├── css/estilo.css
    └── js/
        ├── app.js          # roteador, telas, chat, "cimento" da mesa (~2500 linhas)
        ├── config.js       # credenciais Supabase (placeholders no repo, preencher localmente)
        ├── dados-jogo.js   # raças, classes, filosofias, armas, armaduras, implantes,
        │                   # scripts, naves, perícias, palavras-chave, mods de bancada
        ├── dados-bestiario.js  # criaturas (Cap. 13/14 do livro)
        ├── dados-npcs.js       # NPCs e papéis
        ├── dados-mestre.js     # facções, reputação, tabelas aleatórias, referência rápida
        ├── regras.js       # regras puras (ficha, dados, condições, campo tático) — testável no Node
        ├── efeitos.js      # motor de efeitos declarados (implantes/raças/classes alteram a ficha sem código novo)
        ├── criaturas.js    # motor de efeitos automáticos de criaturas em combate
        ├── conteudo.js     # conteúdo global editável pelo painel admin (tabela `conteudo`)
        ├── biblioteca.js   # a Biblioteca inteira (raças, classes, arsenal, bestiário, regras…)
        ├── admin.js        # painel de administração de conteúdo
        ├── mesa-mestre.js  # overlay "Tela do Mestre" (descansos, recompensas, backup, tabelas…)
        ├── mesa-nave.js    # aba Nave da mesa (postos, munição por arma, combate espacial clássico)
        ├── mesa-combate.js # aba Combate da mesa (rastreador, campo tático, ataques do Mestre)
        ├── mesa-ficha.js   # aba "Meu personagem" (ataque de arma, habilidades, scripts, macros)
        ├── mapa-sistema.js # mapa compartilhado do Mestre (pontos de interesse)
        ├── sistema-solar.js# seletor 3D de planeta/raça (Three.js sob demanda)
        ├── criacao.js      # assistente de criação de personagem
        └── ui.js           # modais reutilizáveis, sons, notificações
```

Veja `CLAUDE.md` para o mapa linha-a-linha do código, as decisões de regra de mesa e o histórico de bugs corrigidos — é o documento vivo do projeto.

## Requisitos de configuração

Antes de rodar o app, preencha `public/js/config.js` com as credenciais do projeto Supabase:

```js
export const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
export const SUPABASE_ANON_KEY = "SUA_ANON_KEY_AQUI";
```

Esse arquivo não é versionado (`.gitignore`). A segurança real fica na Row Level Security (RLS) do Supabase, não no front.

## Como rodar localmente

A aplicação usa ES modules nativos — precisa ser servida por HTTP, `file://` não funciona.

```bash
cd public
python -m http.server 3000
```

Depois abra `http://localhost:3000`. Qualquer outro servidor estático simples também serve, desde que `public/` seja a raiz.

## Testes automatizados

```bash
node --test
```

O Node varre o projeto e roda tudo que casa com `*.test.js` (não passe um caminho — a partir do Node 22 isso quebra o runner). Cobre as funções puras de `dados-jogo.js`, `regras.js` e as validações de `criaturas.js`/`efeitos.js`. Sem Node instalado localmente, o GitHub Actions (`.github/workflows/testes.yml`) roda os mesmos testes a cada push/PR — o resultado aparece na aba **Actions** e como ✓/✗ ao lado do commit.

Fora isso, não há suite de UI — validar mudanças de tela é manual no navegador, com um projeto Supabase configurado.

## Configuração do Supabase

1. **Autenticação** — Google OAuth e/ou magic link por e-mail.
2. **URL de redirecionamento** — o domínio de produção e `http://localhost:3000` para dev.
3. **Realtime** — habilite as tabelas de mensagens, campanhas e personagens.
4. **Schema** — tabelas principais: `perfis`, `personagens` (`dados` JSONB), `campanhas` (`nave`/`mapa`/`combate`/`bestiario`/`contratos`/`faccoes`/`handout` em JSONB), `campanha_membros`, `mensagens` (`payload` JSONB), `mestre_notas`, `conteudo` (conteúdo global do painel admin). O schema SQL completo e as policies de RLS não estão versionados neste repositório — provisione conforme esse modelo.

## Deploy (Vercel)

- Root Directory: vazio (raiz do repositório).
- Output Directory: `public`.
- Build/Install Command: vazio.

Depois de qualquer mudança relevante em arquivo listado no `SHELL` de `public/sw.js`, **incremente a constante `CACHE`** — senão o service worker continua servindo a versão em cache para quem já tinha o PWA instalado.

## Licença

Sem licença formal definida no repositório. Verifique com o responsável do projeto antes de distribuir ou reutilizar em ambiente comercial. O cenário/lore de "Passagem Sombria" (raças, facções, textos narrativos) é propriedade intelectual do autor do sistema de RPG.

---

Passagem Sombria — mesa, fichas, combate e exploração em um único painel de jogo.
