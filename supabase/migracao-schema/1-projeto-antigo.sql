-- ============================================================================
--  PASSO 1 — rodar no SQL Editor do projeto ANTIGO do Passagem Sombria.
--
--  Renomeia o schema `public` para `passagem` (tabelas, dados, políticas,
--  funções vão junto) e guarda, dentro dele, o que mora fora do schema e
--  precisa ir para o projeto novo: as contas (auth.users / auth.identities),
--  os gatilhos que o jogo pendurou em auth.users e a lista de tabelas do
--  Realtime. Assim um único `pg_dump --schema=passagem` leva tudo.
--
--  Reversível: 9-desfazer-projeto-antigo.sql devolve o projeto como estava.
-- ============================================================================
begin;

alter schema public rename to passagem;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

-- Contas de login. Cópia temporária: o passo 3 apaga depois de usar.
create table passagem._mig_users      as select * from auth.users;
create table passagem._mig_identities as select * from auth.identities;

-- Gatilhos do jogo em auth.users (ex.: o que cria o perfil no cadastro).
-- Depois do rename, a definição já aponta para passagem.<função>.
create table passagem._mig_gatilhos_auth as
  select t.tgname::text as nome, pg_get_triggerdef(t.oid) as definicao
  from pg_trigger t
  where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal;

-- Tabelas do jogo que estavam no Realtime.
create table passagem._mig_realtime as
  select tablename::text as tabela from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'passagem';

commit;

-- Deve voltar VAZIO. Se aparecer alguma extensão aqui, ela estava instalada
-- no public e não vai junto no dump — pare e avise antes de seguir.
select e.extname as extensao_no_schema from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace where n.nspname = 'passagem';

-- Confira o resultado (deve listar as tabelas do jogo + as _mig_*):
select table_name from information_schema.tables where table_schema = 'passagem' order by 1;
