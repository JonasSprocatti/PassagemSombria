-- ============================================================================
--  PASSO 2 — rodar no SQL Editor do projeto NOVO (o do PokeRPG), com o
--  projeto antigo ATIVO e o passo 1 já rodado nele.
--
--  Conecta no projeto antigo (postgres_fdw), recria a estrutura no schema
--  `passagem`, copia os dados e as contas de login, e liga de novo políticas,
--  gatilhos, Realtime e permissões. Nada do PokeRPG é alterado.
--
--  Tudo roda numa transação só: se der erro em qualquer ponto, nada fica pela
--  metade — é só corrigir e rodar de novo.
--
--  ANTES DE RODAR, preencha as 3 linhas marcadas com  <<<  logo abaixo, com os
--  dados do projeto ANTIGO (botão "Connect" no topo do painel dele →
--  "Session pooler" → "View parameters"):
-- ============================================================================
create extension if not exists postgres_fdw with schema extensions;

drop server if exists mig_antigo cascade;
create server mig_antigo foreign data wrapper postgres_fdw options (
  host    'aws-0-REGIAO.pooler.supabase.com',      -- <<< host do projeto antigo
  port    '5432',
  dbname  'postgres',
  sslmode 'require'
);
create user mapping for current_user server mig_antigo options (
  user     'postgres.REF_DO_PROJETO_ANTIGO',         -- <<< user do projeto antigo
  password 'SENHA_DO_BANCO_ANTIGO'                   -- <<< senha do banco antigo
);

begin;
set local check_function_bodies = off;   -- funções podem citar tabelas que ainda vão nascer

-- O banco antigo visto daqui, como tabelas "estrangeiras" (só leitura).
-- Primeiro só a lista de comandos e os tipos (as outras tabelas podem usar
-- esses tipos), depois o resto.
create schema mig_antigo;
create schema passagem;
import foreign schema passagem limit to (_mig_ddl) from server mig_antigo into mig_antigo;
do $$
declare r record;
begin
  for r in select comando from mig_antigo._mig_ddl where fase = 10 order by ordem loop execute r.comando; end loop;
end $$;
import foreign schema passagem except (_mig_ddl) from server mig_antigo into mig_antigo;

-- ---- 1) Estrutura: tipos, sequências, tabelas, funções ---------------------
do $$
declare r record; cmd text;
begin
  for r in select fase, comando from mig_antigo._mig_ddl where fase > 10 and fase < 50 order by fase, ordem loop
    cmd := r.comando;
    if r.fase = 42 then   -- corpo de função é texto: public. → passagem.
      cmd := regexp_replace(cmd, '(?<![A-Za-z0-9_])public\.', 'passagem.', 'g');
      cmd := regexp_replace(cmd, '(search_path\s+(TO|=)\s*)''?public''?', '\1passagem', 'gi');
    end if;
    execute cmd;
  end loop;
end $$;

-- ---- 2) Dados ---------------------------------------------------------------
do $$
declare t record; cols text;
begin
  for t in select c.relname from pg_class c
           where c.relnamespace = 'passagem'::regnamespace and c.relkind = 'r' loop
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into cols
    from pg_attribute a
    where a.attrelid = ('passagem.' || quote_ident(t.relname))::regclass
      and a.attnum > 0 and not a.attisdropped and a.attgenerated = '';
    execute format('insert into passagem.%1$I (%2$s) overriding system value select %2$s from mig_antigo.%1$I',
                   t.relname, cols);
  end loop;
end $$;

-- ---- 3) Contas de login -------------------------------------------------------
--  • e-mail que ainda não existe aqui → a conta vem inteira, com o MESMO id
--    (senha e login Google continuam valendo);
--  • e-mail que já existe aqui (a pessoa já joga PokeRPG) → fica a conta
--    daqui, e o id antigo dela nas tabelas do jogo vira o id daqui.
create table passagem._mig_mapa as
  select a.id as antigo, n.id as novo, a.email
  from passagem._mig_users a
  join auth.users n on lower(n.email) = lower(a.email) and n.id <> a.id
  where a.email is not null;

do $$
declare cols_u text; cols_i text; sel_i text; r record; t record; n int;
begin
  -- Colunas em comum entre a cópia e a tabela real (sem as geradas): protege
  -- contra diferença de versão do auth entre os dois projetos.
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into cols_u
  from pg_attribute a
  where a.attrelid = 'auth.users'::regclass and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
    and exists (select 1 from pg_attribute b where b.attrelid = 'passagem._mig_users'::regclass
                and b.attname = a.attname and not b.attisdropped);
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum),
         string_agg(case when a.attname = 'user_id' then 'coalesce(m.novo, i.user_id)' else 'i.' || quote_ident(a.attname) end,
                    ', ' order by a.attnum)
    into cols_i, sel_i
  from pg_attribute a
  where a.attrelid = 'auth.identities'::regclass and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
    and exists (select 1 from pg_attribute b where b.attrelid = 'passagem._mig_identities'::regclass
                and b.attname = a.attname and not b.attisdropped);

  execute format(
    'insert into auth.users (%1$s) select %1$s from passagem._mig_users u
       where not exists (select 1 from auth.users x where x.id = u.id)
         and not exists (select 1 from auth.users x where lower(x.email) = lower(u.email))', cols_u);
  get diagnostics n = row_count; raise notice 'contas novas trazidas: %', n;

  -- Logins (e-mail, Google…). Das contas casadas por e-mail, só os que o
  -- projeto novo ainda não tem (o login por e-mail delas já existe aqui).
  execute format(
    'insert into auth.identities (%1$s)
       select %2$s from passagem._mig_identities i
       left join passagem._mig_mapa m on m.antigo = i.user_id
       where exists (select 1 from auth.users x where x.id = coalesce(m.novo, i.user_id))
         and not (m.novo is not null and i.provider = ''email'')
         and not exists (select 1 from auth.identities y where y.provider = i.provider and y.provider_id = i.provider_id)',
    cols_i, sel_i);
  get diagnostics n = row_count; raise notice 'logins trazidos: %', n;

  -- Troca de id (colunas uuid, e dentro de texto/JSON) para quem já tinha conta aqui.
  for t in
    select c.table_name, c.column_name, c.data_type
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'passagem' and c.table_name not like '\_mig\_%'
      and c.data_type in ('uuid', 'jsonb', 'json', 'text')
  loop
    for r in select antigo, novo from passagem._mig_mapa loop
      if t.data_type = 'uuid' then
        execute format('update passagem.%I set %I = $2 where %I = $1', t.table_name, t.column_name, t.column_name)
          using r.antigo, r.novo;
      else
        execute format('update passagem.%I set %I = replace(%I::text, $1::text, $2::text)::%s where strpos(%I::text, $1::text) > 0',
          t.table_name, t.column_name, t.column_name, t.data_type, t.column_name)
          using r.antigo, r.novo;
      end if;
    end loop;
  end loop;
end $$;

-- ---- 4) Chaves, índices, RLS, políticas, gatilhos, views, sequências ---------
do $$
declare r record;
begin
  for r in select comando from mig_antigo._mig_ddl where fase >= 50 order by fase, ordem loop
    execute r.comando;
  end loop;
end $$;

-- Gatilhos do jogo em auth.users (ex.: criar o perfil no cadastro), com
-- prefixo `passagem_` para não trombar com os do PokeRPG.
do $$
declare g record;
begin
  for g in select nome, definicao from passagem._mig_gatilhos_auth loop
    execute format('drop trigger if exists %I on auth.users', 'passagem_' || g.nome);
    execute regexp_replace(g.definicao, '^CREATE (CONSTRAINT )?TRIGGER \S+',
                           'CREATE \1TRIGGER ' || quote_ident('passagem_' || g.nome));
  end loop;
end $$;

-- ---- 5) Permissões (mesmo padrão que o Supabase dá ao public) -----------------
grant usage on schema passagem to anon, authenticated, service_role;
grant all on all tables    in schema passagem to anon, authenticated, service_role;
grant all on all sequences in schema passagem to anon, authenticated, service_role;
grant all on all routines  in schema passagem to anon, authenticated, service_role;
alter default privileges in schema passagem grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema passagem grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema passagem grant all on routines  to anon, authenticated, service_role;
do $$ begin
  -- Quem recebe uma mensagem direta só marca `lida` (como no social.sql).
  if to_regclass('passagem.mensagens_diretas') is not null then
    revoke update on passagem.mensagens_diretas from authenticated;
    grant update (lida) on passagem.mensagens_diretas to authenticated;
  end if;
  -- Correção do dossiê: quem recebe um pedido de amizade só muda o `status`.
  if to_regclass('passagem.amizades') is not null then
    revoke update on passagem.amizades from authenticated;
    grant update (status) on passagem.amizades to authenticated;
  end if;
end $$;

-- ---- 6) Realtime: as mesmas tabelas de antes --------------------------------
do $$
declare r record;
begin
  for r in select tabela from passagem._mig_realtime loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'passagem' and tablename = r.tabela) then
      execute format('alter publication supabase_realtime add table passagem.%I', r.tabela);
    end if;
  end loop;
end $$;

-- ---- 7) Limpeza: cópias temporárias (têm hashes de senha) e a conexão --------
drop table passagem._mig_users, passagem._mig_identities, passagem._mig_gatilhos_auth,
  passagem._mig_realtime, passagem._mig_mapa;
drop schema mig_antigo cascade;

commit;

drop server mig_antigo cascade;     -- apaga também a senha guardada acima
notify pgrst, 'reload schema';      -- a API passa a enxergar o schema novo

-- Conferência: compare com o projeto antigo.
select 'perfis' as tabela, count(*) from passagem.perfis
union all select 'personagens', count(*) from passagem.personagens
union all select 'campanhas', count(*) from passagem.campanhas
union all select 'mensagens', count(*) from passagem.mensagens;
