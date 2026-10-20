# Mover o Passagem Sombria para outro projeto Supabase (schema `passagem`)

Leva **tudo** do projeto antigo para dentro de um schema `passagem` num projeto que já é usado por outro app (o PokeRPG): tabelas, dados, políticas de RLS, funções, gatilhos, Realtime e as contas de login. Nada do outro app é alterado, ele continua no `public`.

**Tudo pelo painel do Supabase**, sem instalar nada no computador: o projeto novo se conecta no antigo (extensão `postgres_fdw`) e puxa os dados sozinho.

Quem usa o **mesmo e-mail** nos dois apps fica com uma conta só (a do projeto novo), e as fichas, campanhas e mensagens dessa pessoa passam a apontar para ela. Quem só jogava Passagem Sombria continua entrando com a mesma senha ou o mesmo Google de antes.

Testado ponta a ponta num Postgres 16 local simulando os dois projetos, com `admin.sql` e `social.sql` aplicados e um e-mail repetido entre eles. A estrutura chegou idêntica: 38 constraints, 21 políticas, 18 índices, 15 funções e 2 gatilhos.

## Passo a passo

| # | Onde | O que fazer |
|---|---|---|
| 0 | Painel | Deixar os **dois projetos ativos** ao mesmo tempo (pausar outro se precisar). |
| 1 | Projeto **antigo** → SQL Editor | Colar e rodar `1-projeto-antigo.sql`. A primeira tabela do resultado precisa vir **vazia** (se listar alguma extensão, pare e avise). A segunda mostra quantos comandos de estrutura foram preparados. |
| 2 | Projeto **antigo** → botão **Connect** (topo) → **Session pooler** → **View parameters** | Anotar `host` e `user`. A senha é a do banco: se não lembrar, Settings → Database → **Reset database password**. |
| 3 | Projeto **novo** → SQL Editor | Colar `2-projeto-novo-importar.sql`, preencher as 3 linhas marcadas com `<<<` (host, user e senha do passo 2) e rodar. No fim aparece a contagem de perfis, personagens, campanhas e mensagens: compare com o antigo. |
| 4 | Projeto **novo** → Settings → API (Data API) | Em **Exposed schemas**, adicionar `passagem` e salvar. |
| 5 | Projeto **novo** → Authentication → URL Configuration | Adicionar a URL do Passagem Sombria na Vercel (ex.: `https://passagem-sombria.vercel.app/**`) em **Redirect URLs**. |
| 6 | Projeto **novo** → Authentication → Providers | Se o Passagem Sombria usava login com Google: ligar o Google aqui (se o PokeRPG ainda não usa) e, no Google Cloud Console, acrescentar a URL de callback do projeto novo (`https://<projeto-novo>.supabase.co/auth/v1/callback`). |
| 7 | `public/js/config.js` (onde ficam as chaves reais) | `SUPABASE_URL` e `SUPABASE_ANON_KEY` do projeto **novo**, e `SUPABASE_SCHEMA = "passagem"`. Publicar. |
| 8 | SQL Editor do projeto novo | Apagar a aba/snippet do passo 3, porque ela guarda a senha do banco antigo. Por garantia, troque essa senha depois (passo 2). |

Depois de conferir que o jogo funciona no projeto novo, o antigo pode ficar pausado como backup.

## Se algo der errado

- O passo 3 roda numa transação só: se der erro, nada fica pela metade. Corrija e rode de novo (ele mesmo apaga a conexão anterior).
- `could not connect to server` / `password authentication failed`: confira host, user (`postgres.<ref-do-projeto-antigo>`) e senha, e se o projeto antigo está ativo.
- `permission denied` mexendo em `auth.users`: o Supabase pode ter restringido o acesso ao schema `auth` nesse projeto. Pare e mande a mensagem completa.
- Tempo esgotado (timeout) no SQL Editor: avise, dá para dividir a cópia dos dados em partes.
- Para o projeto antigo voltar a funcionar como era: `9-desfazer-projeto-antigo.sql` no SQL Editor dele.

## Efeitos colaterais conhecidos

- Os gatilhos de cadastro do PokeRPG também rodam para as contas trazidas (ex.: se o PokeRPG cria um perfil de treinador ao cadastrar, quem só jogava Passagem Sombria ganha um). É o mesmo que aconteceria se a pessoa se cadastrasse no PokeRPG.
- A partir daqui, uma conta criada em qualquer um dos dois jogos vale nos dois, e o e-mail de login (Authentication → Emails) é o mesmo para ambos.
- Sessões não são copiadas: todo mundo precisa entrar de novo uma vez.
- O plano grátis (500 MB de banco, banda, conexões de Realtime) passa a ser dividido entre os dois jogos.
- O gatilho de cadastro do Passagem Sombria passa a se chamar `passagem_<nome original>` em `auth.users`, ao lado do gatilho do PokeRPG.
