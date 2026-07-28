# Passagem Sombria — Deck de Campo Online

Mesa virtual (VTT) e gerenciador de fichas para o RPG espacial **Passagem Sombria**.
É um webapp multiplayer: cada jogador cria e salva suas fichas na nuvem, entra em campanhas
por código de convite e joga numa mesa em tempo real — com chat, rolagens completas de
combate, controle de vida/RAM, descansos sincronizados, nave da campanha e um mapa do
sistema solar compartilhado que o Mestre atualiza ao vivo.

> **Stack:** JavaScript puro (ES Modules, sem build/bundler) · **Supabase** (Auth, Postgres, Realtime) · **Vercel** (hospedagem estática) · **Three.js** (via ESM, só no seletor de raça 3D).

---

## Índice

1. [O que o app faz (funcionalidades)](#o-que-o-app-faz)
2. [Arquitetura e como foi feito](#arquitetura-e-como-foi-feito)
3. [Estrutura de arquivos](#estrutura-de-arquivos)
4. [Modelo de dados (banco)](#modelo-de-dados)
5. [Segurança (RLS) e tempo real](#seguranca-e-tempo-real)
6. [Regras do sistema implementadas](#regras-do-sistema-implementadas)
7. [Implantação (deploy) do zero](#implantacao)
8. [Migrações — banco já existente](#migracoes)
9. [Desenvolvimento local](#desenvolvimento-local)
10. [Limitações conhecidas e próximos passos](#limitacoes-e-proximos-passos)

---

<a name="o-que-o-app-faz"></a>
## 1. O que o app faz

**Contas e fichas**
- Login com **Google** (OAuth) ou **link mágico** por e-mail.
- **Hangar de tripulantes:** cada usuário cria, edita e apaga suas fichas; ficam salvas na nuvem.
- **Ficha completa:** identidade (nome, retrato comprimido no cliente), raça/classe/filosofia com painéis detalhados, atributos, perícias, vitais (PV, CD, RAM, Iniciativa, Deslocamento), implantes, deck de Scripts, inventário, anotações e um registro de eventos.
- **Seletor de raça em 3D:** um botão abre o **Sistema Solar** (Three.js); ao clicar num planeta a câmera foca e mostra a silhueta + personagem de exemplo + ficha completa da raça, com botão para escolher. Fallback 2D em SVG se o Three.js não carregar.
- **Impressão / exportação:** botões que geram uma ficha limpa (tema claro) para **imprimir/salvar em PDF** (via diálogo do navegador) ou **baixar como `.html`** autossuficiente.

**Progressão**
- Rolagem de **Origem** (atributos), distribuição de pontos com **teto de orçamento** (só gasta o que ganhou por nível; não deixa exceder).
- **Level up** com rolagem de vida por raça (dado de peso ou média fixa), ganhos automáticos de atributo/perícia/RAM, e preview do que vem no próximo nível.

**Campanhas e mesa**
- Criar campanha (gera código de 6 letras) ou entrar por código; excluir campanha (só o Mestre).
- **Mesa em tempo real:**
  - **Chat** com mensagens alinhadas (suas à direita, dos outros à esquerda), agrupamento por autor e **responder/citar** mensagens.
  - **Rolagens** por comando flexível: `/1d20`, `/r1d20`, `/rolar 2d6+1`, `/1d20+2d10` (multi-termo).
  - **Combate:** ataque pelas armas equipadas com d20 + atributo + perícia, dano com crítico, **Ataque Furtivo** (dano dobrado para o Assassino), armas **Ágeis** (usam o melhor de For/Des), **Brutais** (vantagem no dano) e exibição de **palavra-chave / área / alcance** de cada arma.
  - **Dano/cura direcionados** a personagens (aplicados pelo dono do alvo).
  - **Nave da campanha** com casco/escudos/manobra e ações das estações de batalha.
  - **Descansos sincronizados:** o Mestre convoca Descanso Curto/Longo para toda a mesa; cada jogador recupera PV/RAM e reinicia habilidades no próprio personagem. Catálogo de todas as habilidades "1×/descanso".
  - **Mapa do Sistema (VTT):** mapa 2D top-down com Sol, planetas, luas reais, cinturão de asteroides; zoom/pan; o Mestre adiciona **pontos de interesse** (22 tipos: cidade, estação, detritos, nave abandonada, anomalia, base pirata, nebulosa…), marca regiões/áreas com raio e move a **localização da tripulação**. Tudo sincronizado ao vivo.

**Biblioteca**
- Consulta de raças, classes, filosofias, implantes, armas, armaduras, naves e regras do livro.

---

<a name="arquitetura-e-como-foi-feito"></a>
## 2. Arquitetura e como foi feito

- **Sem build.** Tudo é HTML/CSS/JS estático servido pela Vercel. O JS usa **ES Modules** nativos; bibliotecas externas (Supabase, Three.js) são importadas por URL de `esm.sh`. Não há npm/webpack/vite.
- **SPA com hash-routing.** `app.js` é uma Single Page App que roteia por `location.hash` (`#/hangar`, `#/ficha/:id`, `#/campanhas`, `#/mesa/:id`, `#/biblioteca`). Cada "tela" é uma função que renderiza HTML numa `<div>` raiz e religa os eventos.
- **Backend = Supabase.** Postgres guarda tudo; a **Row-Level Security (RLS)** é a camada de segurança (a anon key é pública por design). O **Realtime** do Supabase entrega mudanças de `mensagens`/`campanhas`/`personagens` para os clientes conectados.
- **Ficha como JSON.** A ficha inteira vive num campo `jsonb` (`personagens.dados`), no mesmo formato do artifact "Deck de Campo". Isso deixa a evolução das regras livre sem migração de schema.
- **Módulos pesados sob demanda.** O seletor 3D (`sistema-solar.js`) e o mapa (`mapa-sistema.js`) são carregados por `import()` dinâmico só quando abertos — não pesam o carregamento inicial.
- **Sincronização otimista.** Ao enviar uma mensagem, ela aparece na hora para quem enviou (sem esperar o eco do Realtime), com deduplicação por id quando o eco chega.

---

<a name="estrutura-de-arquivos"></a>
## 3. Estrutura de arquivos

```
webapp/
├── README.md
├── supabase/
│   └── schema.sql            ← banco completo: tabelas, RLS, funções, triggers, realtime
└── public/                   ← RAIZ DE DEPLOY na Vercel (Output Directory = public)
    ├── index.html            ← casca da SPA + favicon (logo.svg)
    ├── logo.svg              ← logo (favicon, header, tela de login)
    ├── css/
    │   └── estilo.css        ← todo o visual, incluindo overlays 3D e do mapa
    └── js/
        ├── config.js         ← SUAS CHAVES (gerado no build da Vercel a partir de env vars)
        ├── dados-jogo.js     ← dados do livro: raças, 15 classes, 50 armas + palavras-chave,
        │                        naves, scripts, implantes, perícias, temas, helpers de regra
        ├── app.js            ← a SPA inteira (auth, hangar, ficha, campanhas, mesa, biblioteca)
        ├── sistema-solar.js  ← seletor de raça 3D (Three.js) + fichas de raça + silhuetas SVG
        └── mapa-sistema.js   ← mapa VTT do sistema (SVG, zoom/pan, pontos de interesse)
```

> **Nota:** existe um arquivo legado `public/js/mapa.js` que **não é mais usado** (o mapa atual é `mapa-sistema.js`). Pode ser removido com segurança.

---

<a name="modelo-de-dados"></a>
## 4. Modelo de dados

Todo o schema está em `supabase/schema.sql`. Tabelas:

| Tabela | Papel | Campos-chave |
|---|---|---|
| `perfis` | Perfil público do usuário (criado automaticamente no signup por trigger) | `id` (= `auth.users.id`), `apelido`, `avatar_url` |
| `personagens` | Fichas | `dono_id`, `nome`, `dados` (jsonb com a ficha inteira), `campanha_id` |
| `campanhas` | Mesas | `mestre_id`, `codigo` (6 letras único), `nave` (jsonb), `mapa` (jsonb) |
| `campanha_membros` | Quem está em cada mesa | `campanha_id`, `perfil_id`, `posto` (estação de batalha) |
| `mensagens` | Chat/eventos da mesa | `campanha_id`, `autor_id`, `personagem_id`, `tipo`, `conteudo`, `payload` (jsonb) |

**Formas dos `jsonb`:**
- `personagens.dados` — a ficha (nível, raça, classe, atributos, perícias, PV/RAM, deck, inventário, log…).
- `campanhas.nave` — `{ modelo, casco, casco_max, escudos, escudos_max, manobra, dano, nome_batismo }`.
- `campanhas.mapa` — `{ pontos: [{id, tipo, nome, desc, x, y, raio?}], party: {x, y, nome} }`.
- `mensagens.payload` — depende do `tipo` (`rolagem`, `dano`, `cura`, `descanso`, `nave`, e resposta/citação).

Deleções em cascata: apagar uma campanha remove seus membros e mensagens (`on delete cascade`) e **desvincula** os personagens sem apagá-los (`on delete set null`).

---

<a name="seguranca-e-tempo-real"></a>
## 5. Segurança (RLS) e tempo real

A segurança é 100% por **Row-Level Security** no Postgres (não confie no cliente):

- `perfis`: leitura por qualquer autenticado; cada um só edita o próprio.
- `personagens`: cada um só lê/edita/apaga os seus (`dono_id = auth.uid()`).
- `campanhas`: membros leem; **só o Mestre** insere/edita/apaga (a policy de SELECT também checa `mestre_id = auth.uid()` diretamente — necessário para não quebrar o retorno do INSERT).
- `campanha_membros` / `mensagens`: restritas a membros da campanha (função `sou_membro`, `security definer`).
- Função `entrar_campanha(codigo)`: adiciona o usuário à campanha pelo código.

**Realtime:** as tabelas `mensagens`, `campanhas` e `personagens` estão na publicação `supabase_realtime`. A mesa assina mudanças e atualiza chat, nave e mapa ao vivo. O socket do Realtime é autenticado com o token do usuário (senão a RLS filtra tudo e nada chega).

---

<a name="regras-do-sistema-implementadas"></a>
## 6. Regras do sistema implementadas (livro v1.4)

- **Atributos por Origem:** rola 2d8 sete vezes, descarta a pior soma; converte cada soma em modificador (2–4 = −1 · 5–10 = +0 · 11–15 = +1 · 16 = +2). Modificador final = Origem + Raça + Aprimoramento (teto +6).
- **20 perícias unificadas** (lista da ficha + Explosivos e Performance/Arte); classes remapeadas para a nova nomenclatura; migração automática de fichas antigas.
- **Vida:** inicial (nível 1) = 4d6 (descarta o menor) + modificador racial + Con + PV base da classe. Por nível = dado de peso da raça (1d10/1d8/1d6, ou média fixa 5/4/3) + Con.
- **Progressão:** +1 atributo por nível (a partir do 2), +1 perícia por nível (teto +5 até o NV4, +7 do NV5), +1 RAM em níveis ímpares.
- **Combate:** ataque furtivo (dano dobrado do Assassino), armas Ágeis/Brutais, 47 palavras-chave de arma com efeito, área e alcance.
- **Descansos:** curto reinicia habilidades "1×/curto" (+ regeneração Mercusys); longo enche PV/RAM e reinicia tudo.

---

<a name="implantacao"></a>
## 7. Implantação (deploy) do zero

### Passo 1 — Supabase
1. Crie um projeto em [supabase.com](https://supabase.com) (o plano free serve).
2. **SQL Editor → New query** → cole todo o `supabase/schema.sql` → **Run**. Isso cria tabelas, RLS, funções, triggers e ativa o realtime.
3. **Authentication → Providers → Google:** habilite e cole o **Client ID** e **Client Secret** do Google Cloud Console.
   - No Google Cloud Console, em *Authorized redirect URIs*, adicione: `https://SEU-PROJETO.supabase.co/auth/v1/callback`.
4. **Authentication → Providers → Email:** deixe habilitado (para o link mágico).
5. **Authentication → URL Configuration:**
   - **Site URL:** a URL real do seu deploy (ex.: `https://passagem-sombria.vercel.app`). **Não** deixe placeholder aqui.
   - **Redirect URLs:** adicione a URL do deploy e, para dev, `http://localhost:3000`.
6. **Settings → API:** anote a **Project URL** e a **anon/publishable key** (é a chave pública; a segurança vem da RLS — nunca use a *service/secret key* no frontend).

### Passo 2 — Chaves (`config.js`)
O arquivo `public/js/config.js` exporta `SUPABASE_URL` e `SUPABASE_ANON_KEY`. Em produção, **gere-o no build** a partir de variáveis de ambiente (recomendado), para não commitar chaves.

### Passo 3 — Vercel
1. Importe o repositório na Vercel.
2. **Settings → Environment Variables:** crie `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
3. **Settings → Build & Development:**
   - **Root Directory:** vazio (a raiz do repo).
   - **Output Directory:** `public`.
   - **Build Command:** gere o `config.js` a partir das env vars, por exemplo:
     ```bash
     printf 'export const SUPABASE_URL="%s";\nexport const SUPABASE_ANON_KEY="%s";\n' "$SUPABASE_URL" "$SUPABASE_ANON_KEY" > public/js/config.js
     ```
   - **Install Command:** pode deixar vazio (não há dependências).
4. Deploy. Depois, confirme o **Site URL / Redirect URLs** no Supabase com o domínio final.

### Passo 4 — Checklist pós-deploy
- [ ] Login com Google funciona (se der `redirect_uri_mismatch`, revise o callback no Google Cloud Console).
- [ ] Criar uma ficha no Hangar salva e recarrega.
- [ ] Criar campanha e abrir a mesa.
- [ ] Enviar mensagem e `/1d20` no chat.
- [ ] Com uma segunda conta (aba anônima), entrar pelo código e ver mensagens cruzarem em tempo real.

---

<a name="migracoes"></a>
## 8. Migrações — banco já existente

Se o seu banco foi criado com uma versão anterior do schema, rode estes ajustes no **SQL Editor** (todos são seguros/idempotentes):

**a) Campo do mapa (VTT):**
```sql
alter table public.campanhas add column if not exists mapa jsonb default '{}'::jsonb;
```

**b) Correção da policy de SELECT de campanhas** (necessária para criar campanha com retorno da linha):
```sql
drop policy if exists campanhas_select on public.campanhas;
create policy campanhas_select on public.campanhas for select to authenticated
  using (mestre_id = auth.uid() or sou_membro(id));
```

**c) Garantir realtime nas tabelas** (ignore o erro "already member of publication"):
```sql
alter publication supabase_realtime add table public.mensagens;
alter publication supabase_realtime add table public.campanhas;
alter publication supabase_realtime add table public.personagens;
```

> A versão atual de `supabase/schema.sql` já inclui (a), (b) e (c) — as migrações acima são só para bancos antigos que não foram recriados.

---

<a name="desenvolvimento-local"></a>
## 9. Desenvolvimento local

Como é estático e usa ES Modules, sirva a pasta `public/` por HTTP (abrir o arquivo direto via `file://` não funciona com módulos):

```bash
cd public
python3 -m http.server 3000
# abra http://localhost:3000
```

Preencha `public/js/config.js` com a URL e a anon key do seu projeto Supabase de dev, e garanta que `http://localhost:3000` está nas *Redirect URLs* do Supabase.

---

<a name="limitacoes-e-proximos-passos"></a>
## 10. Limitações conhecidas e próximos passos

- **Sistema solar 3D:** depende do Three.js carregar de `esm.sh` (precisa de rede). Há fallback 2D em SVG se falhar.
- **Descanso do Mestre:** só afeta jogadores **conectados** à mesa no momento e com personagem vinculado; não reaplica retroativamente para quem entra depois.
- **Mapa:** o zoom/pan é local de cada usuário (por escolha); apenas os pontos e a localização da tripulação são compartilhados. Formulários de ponto usam `prompt()` — dá para trocar por um formulário estilizado.
- **Armas:** cada arma tem uma palavra-chave principal mecanizada; algumas do livro têm palavras-chave secundárias que ainda não estão na base.
- **Artifact "Deck de Campo" (React):** é uma ferramenta separada e **não** compartilha as últimas regras do webapp (2d8, perícias unificadas, dado de vida) — precisaria ser atualizado à parte, se desejado.
- **Ideias futuras:** condições/status por turno (sangramento, atordoado) automatizados; palavras-chave secundárias das armas; sincronização opcional da câmera do mapa; formulário bonito para pontos de interesse.

---

*Passagem Sombria — um RPG espacial. Este webapp é a mesa e o deck de campo online do sistema.*
