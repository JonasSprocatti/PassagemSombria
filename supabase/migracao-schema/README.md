# Mover o Passagem Sombria para outro projeto Supabase (schema `passagem`)

Leva **tudo** do projeto antigo (tabelas, dados, políticas de RLS, funções, gatilhos, Realtime **e as contas de login**) para dentro de um schema `passagem` num projeto que já é usado por outro app (o PokeRPG). Nada do outro app é alterado: ele continua no `public`.

Quem já tem conta com o **mesmo e-mail** nos dois apps fica com uma conta só (a do projeto novo), e as fichas, campanhas e mensagens dessa pessoa são reapontadas para ela. Quem só jogava Passagem Sombria entra com a mesma senha / o mesmo Google de antes.

Testado ponta a ponta num Postgres 16 local simulando os dois projetos (inclusive com `admin.sql` e `social.sql` aplicados e um e-mail repetido entre eles).

## Antes de começar

1. Os **dois projetos ativos** ao mesmo tempo (pause outro se precisar).
2. **PostgreSQL instalado no Windows**, com `pg_dump` e `psql`. No instalador oficial (postgresql.org/download/windows) dá pra marcar só "Command Line Tools". Use a **mesma versão do Postgres dos projetos ou mais nova** (Settings → Infrastructure mostra a versão; se forem diferentes, instale a maior).
3. A **string de conexão** de cada projeto: botão **Connect** no topo do painel → **Session pooler** → copiar a URI e trocar `[YOUR-PASSWORD]` pela senha do banco (se não lembrar: Settings → Database → Reset database password).

No PowerShell, guarde as duas (troque pelos valores reais):

```powershell
$ANTIGO = "postgresql://postgres.xxxxxxxx:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
$NOVO   = "postgresql://postgres.yyyyyyyy:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
cd caminho\do\repositorio\supabase\migracao-schema
```

## Passo a passo

| # | Onde | O que fazer |
|---|---|---|
| 1 | Projeto **antigo** → SQL Editor | Rodar `1-projeto-antigo.sql`. A última consulta lista as tabelas; a penúltima precisa voltar **vazia** (se listar extensão, pare e avise). |
| 2 | PowerShell | Exportar: `pg_dump $ANTIGO --schema=passagem --no-owner --no-privileges --section=pre-data --section=data -f passagem-dados.sql` e depois `pg_dump $ANTIGO --schema=passagem --no-owner --no-privileges --section=post-data -f passagem-regras.sql` |
| 3 | PowerShell | Importar as tabelas e os dados no **novo**: `psql $NOVO -v ON_ERROR_STOP=1 -f passagem-dados.sql` |
| 4 | PowerShell | Contas de login: `psql $NOVO -v ON_ERROR_STOP=1 -f 2-projeto-novo-contas.sql` (mostra quantas contas vieram e quais foram casadas por e-mail) |
| 5 | PowerShell | Chaves, índices, políticas e gatilhos: `psql $NOVO -v ON_ERROR_STOP=1 -f passagem-regras.sql` |
| 6 | PowerShell | Finalizar: `psql $NOVO -v ON_ERROR_STOP=1 -f 3-projeto-novo-finalizar.sql` (no fim mostra a contagem de perfis/personagens/campanhas/mensagens — compare com o antigo) |
| 7 | Projeto **novo** → Settings → API (Data API) | Em **Exposed schemas**, adicionar `passagem` e salvar. |
| 8 | Projeto **novo** → Authentication → URL Configuration | Adicionar a URL do Passagem Sombria na Vercel (ex.: `https://passagem-sombria.vercel.app/**`) em **Redirect URLs**. |
| 9 | Projeto **novo** → Authentication → Providers | Se o Passagem Sombria usava login com Google: ligar o Google aqui (se o PokeRPG ainda não usa) e, no Google Cloud Console, acrescentar a URL de callback do projeto novo (`https://<projeto-novo>.supabase.co/auth/v1/callback`). |
| 10 | `public/js/config.js` (onde ficam as chaves reais) | `SUPABASE_URL` e `SUPABASE_ANON_KEY` do projeto **novo**, e `SUPABASE_SCHEMA = "passagem"`. Publicar. |

Depois de conferir que o jogo funciona no projeto novo, o antigo pode ficar pausado como backup.

## Se algo der errado

- Qualquer comando com `ON_ERROR_STOP` para no primeiro erro e mostra a linha. Os scripts `2-` e `3-` rodam numa transação só: se falharem, nada fica pela metade.
- `unrecognized configuration parameter "transaction_timeout"` no passo 3: o `pg_dump` é mais novo que o banco novo. Apague a linha `SET transaction_timeout = 0;` do começo dos dois arquivos `passagem-*.sql` e rode de novo.
- `permission denied` mexendo em `auth.users` (passos 4 ou 6): o Supabase pode ter restringido o acesso ao schema `auth` nesse projeto. Pare ali e me mande a mensagem completa.
- Para começar do zero no projeto novo: `drop schema passagem cascade;` no SQL Editor dele (e `drop trigger passagem_on_auth_user_created on auth.users;`, se o passo 6 já tiver rodado). As contas trazidas no passo 4 ficam em `auth.users`, o que não atrapalha uma nova tentativa.
- Para o projeto antigo voltar a funcionar como era: `9-desfazer-projeto-antigo.sql` no SQL Editor dele.

## Efeitos colaterais conhecidos

- Os gatilhos de cadastro do PokeRPG também rodam para as contas trazidas no passo 4 (ex.: se o PokeRPG cria um perfil de treinador ao cadastrar, quem só jogava Passagem Sombria ganha um). É o mesmo que aconteceria se a pessoa se cadastrasse no PokeRPG.
- A partir daqui, uma conta criada em qualquer um dos dois jogos vale nos dois, e o e-mail de login (modelo em Authentication → Emails) é o mesmo para ambos.
- Sessões não são copiadas: todo mundo precisa entrar de novo uma vez.
- O plano grátis (500 MB de banco, banda, conexões de Realtime) passa a ser dividido entre os dois jogos.

**Apague** `passagem-dados.sql` e `passagem-regras.sql` do computador quando terminar: eles têm os dados de todos os jogadores, inclusive os hashes de senha. O passo 6 já apaga do banco a cópia temporária das contas (com os hashes de senha).
