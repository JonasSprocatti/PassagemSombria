# Passagem Sombria

App web de mesa virtual para o RPG espacial Passagem Sombria, com gestão de fichas, campanhas, rolagens em tempo real e acompanhamento de sessão no navegador.

Este repositório contém a interface do jogo em JavaScript puro, criada como SPA estática e hospedada em Vercel, com autenticação e sincronização em tempo real via Supabase.

## Visão geral

O projeto funciona como um deck de campo digital + mesa de jogo:

- criação e edição de fichas por jogador;
- login com Supabase Auth;
- campanhas com código de convite;
- chat e rolagens de dados em tempo real;
- combate, danos, cura, descanso e controle de nave;
- mapa do sistema compartilhado para o mestre;
- biblioteca de regras, raças, classes, armas, implantes e outros dados do jogo;
- suporte a PWA e uso em navegador mobile/desktop.

## Stack

- JavaScript puro com ES modules;
- HTML/CSS customizados;
- Supabase Auth + Postgres + Realtime;
- Vercel para hospedagem estática;
- Three.js carregado sob demanda no seletor 3D do sistema solar;
- sem build system obrigatório para rodar a aplicação.

## Estrutura do projeto

```text
PassagemSombria/
├── README.md
├── .gitignore
├── public/
│   ├── index.html
│   ├── manifest.json
│   ├── logo.svg
│   ├── sw.js
│   ├── css/
│   │   └── estilo.css
│   ├── js/
│   │   ├── app.js
│   │   ├── config.js
│   │   ├── conteudo.js
│   │   ├── criacao.js
│   │   ├── criaturas.js
│   │   ├── dados-bestiario.js
│   │   ├── dados-jogo.js
│   │   ├── dados-mestre.js
│   │   ├── dados-npcs.js
│   │   ├── efeitos.js
│   │   ├── mapa-sistema.js
│   │   ├── mapa.js
│   │   ├── sistema-solar.js
│   │   └── ui.js
│   ├── apple-touch-icon.png
│   ├── favicon-32.png
│   ├── icon-192.png
│   ├── icon-512.png
│   └── icon-maskable-512.png
└── .git/
```

## Funcionalidades principais

### Fichas de personagem

- cadastro de personagem com atributos, perícias, implantes, inventário e notas;
- suporte à rolagem de origem e atribuição por pontos;
- cálculo automático de vida, RAM, excesso de carga, bônus e status derivados;
- upload de foto com compressão local antes do envio;
- exportação de ficha em HTML ou uso do painel de impressão do navegador.

### Campanhas e mesas

- criação de campanhas com código de convite;
- entrada de jogadores por código;
- chat com mensagens de mesa, rolagens e respostas;
- movimentação de nave da campanha e gestão de combate;
- controle de dano e cura por personagem;
- descanso curto e longo com sincronização para a mesa;
- mapa do sistema editável pelo mestre com pontos de interesse e posicionamento da tripulação.

### Biblioteca de jogo

- raças, classes, filosofias, armas, armaduras, implantes e scripts;
- bestiário e NPCs;
- dados do mestre, tabelas de reputação, facções e referências gerais do cenário.

### Experiência do usuário

- interface em português;
- navegação por hash (`#/login`, `#/hangar`, `#/ficha/:id`, `#/campanhas`, `#/mesa/:id`, `#/biblioteca`);
- carregamento sob demanda dos módulos pesados;
- comportamento responsivo em navegador;
- suporte a PWA, com manifest e service worker.

## Requisitos de configuração

Antes de rodar o app, configure o arquivo `public/js/config.js` com as credenciais do projeto Supabase:

```js
export const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
export const SUPABASE_ANON_KEY = "SUA_ANON_KEY_AQUI";
```

Este projeto usa a `anon key` do Supabase no frontend. A segurança real fica na Row Level Security (RLS) do banco e nas políticas do projeto.

## Como rodar localmente

Como a aplicação usa módulos nativos do navegador, ela deve ser servida via HTTP e não aberta diretamente com `file://`.

### Opção 1: Python

```bash
cd public
python -m http.server 3000
```

Depois abra:

```text
http://localhost:3000
```

### Opção 2: qualquer servidor estático

Você pode usar um servidor estático simples em qualquer ambiente, desde que a pasta `public/` seja a raiz do site.

## Configuração do Supabase

Crie ou use um projeto no Supabase e configure:

1. Autenticação
   - Google OAuth, se quiser login social;
   - magic link por e-mail, se quiser autenticação por e-mail.

2. URL de redirecionamento
   - URL do deploy em produção;
   - `http://localhost:3000` para desenvolvimento local.

3. Realtime
   - habilite as tabelas relevantes para mensagens, campanhas e personagens no painel do Supabase;
   - em projetos novos, as publicações e políticas precisam ser ajustadas conforme o modelo de dados do seu banco.

4. Variáveis do frontend
   - copie `SUPABASE_URL` e `SUPABASE_ANON_KEY` para `public/js/config.js`.

## Deploy

A aplicação é um site estático e pode ser publicada facilmente na Vercel.

### Configuração recomendada na Vercel

- Root Directory: vazio / raiz do repositório;
- Output Directory: `public`;
- Build Command: vazio ou omitido;
- Install Command: vazio ou omitido.

Se você quiser gerar o `config.js` no build, faça isso antes do deploy a partir de variáveis de ambiente, mas o fluxo mais simples é manter o arquivo localmente preenchido para a instância correta do projeto.

## Observações importantes

- O projeto não inclui um bundle de build obrigatório e, por isso, depende de um ambiente de execução HTTP.
- O frontend assume a existência de um banco Supabase corretamente configurado.
- A estrutura atual do repositório foca no frontend e na lógica do jogo; o schema de banco e policies precisam ser provisionados no Supabase conforme a arquitetura do seu projeto.
- A aplicação usa módulos carregados sob demanda para reduzir o peso inicial, especialmente no seletor 3D e no mapa do sistema.

## Próximos passos sugeridos

- revisar e documentar o schema SQL do banco em um arquivo versionado;
- padronizar o processo de deploy com geração automatizada de `config.js`;
- fortalecer a documentação de regras do sistema e de dados por tabela;
- melhorar a experiência de dark/light mode, acessibilidade e onboarding de jogadores.

## Licença

Este README e o código do projeto não incluem uma licença formal definida no repositório. Verifique com o responsável do projeto antes de distribuir ou reutilizar em ambiente comercial.

---

Passagem Sombria — mesa, fichas, combate e exploração em um único painel de jogo.
