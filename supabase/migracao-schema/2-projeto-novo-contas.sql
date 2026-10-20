-- ============================================================================
--  PASSO 3 — rodar no projeto NOVO (o do PokeRPG), DEPOIS de restaurar o
--  arquivo `passagem-dados.sql` e ANTES de `passagem-regras.sql`.
--
--  Traz as contas do Passagem Sombria para o auth do projeto novo:
--   • e-mail que ainda não existe aqui → a conta vem inteira, com o MESMO id
--     (senha/Google continuam valendo);
--   • e-mail que já existe aqui (a pessoa já joga PokeRPG) → reaproveita a
--     conta daqui, e todo id antigo dela nas tabelas do jogo é trocado pelo
--     id novo (colunas uuid, e dentro de texto/JSON também).
--  Roda antes das chaves estrangeiras e gatilhos do jogo existirem (eles vêm
--  em `passagem-regras.sql`), por isso a troca de id não esbarra em nada.
--  Não mexe em nada do PokeRPG.
-- ============================================================================
begin;

-- Antigo → novo, casando pelo e-mail.
create table passagem._mig_mapa as
  select a.id as antigo, n.id as novo, a.email
  from passagem._mig_users a
  join auth.users n on lower(n.email) = lower(a.email) and n.id <> a.id
  where a.email is not null;

do $$
declare
  cols_u text; cols_i text; sel_i text;
  r record; t record; n int;
begin
  -- Colunas em comum (por nome) entre a cópia e a tabela real, sem as geradas:
  -- protege contra diferença de versão do auth entre os dois projetos.
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into cols_u
  from pg_attribute a
  where a.attrelid = 'auth.users'::regclass and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
    and exists (select 1 from pg_attribute b where b.attrelid = 'passagem._mig_users'::regclass
                and b.attname = a.attname and not b.attisdropped);
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into cols_i
  from pg_attribute a
  where a.attrelid = 'auth.identities'::regclass and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
    and exists (select 1 from pg_attribute b where b.attrelid = 'passagem._mig_identities'::regclass
                and b.attname = a.attname and not b.attisdropped);
  select string_agg(case when a.attname = 'user_id' then 'coalesce(m.novo, i.user_id)' else 'i.' || quote_ident(a.attname) end,
                    ', ' order by a.attnum) into sel_i
  from pg_attribute a
  where a.attrelid = 'auth.identities'::regclass and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
    and exists (select 1 from pg_attribute b where b.attrelid = 'passagem._mig_identities'::regclass
                and b.attname = a.attname and not b.attisdropped);

  -- 1) Contas que não existem aqui: entram com o id de sempre.
  execute format(
    'insert into auth.users (%1$s) select %1$s from passagem._mig_users u
       where not exists (select 1 from auth.users x where x.id = u.id)
         and not exists (select 1 from auth.users x where lower(x.email) = lower(u.email))', cols_u);
  get diagnostics n = row_count; raise notice 'contas novas trazidas: %', n;

  -- 2) Logins (e-mail, Google…) dessas contas, e os das contas casadas por
  --    e-mail que o projeto novo ainda não conhece (Google etc.) — já com o
  --    id novo. O login por e-mail dessas contas já existe aqui.
  execute format(
    'insert into auth.identities (%1$s)
       select %2$s from passagem._mig_identities i
       left join passagem._mig_mapa m on m.antigo = i.user_id
       where exists (select 1 from auth.users x where x.id = coalesce(m.novo, i.user_id))
         and not (m.novo is not null and i.provider = ''email'')
         and not exists (select 1 from auth.identities y where y.provider = i.provider and y.provider_id = i.provider_id)',
    cols_i, sel_i);
  get diagnostics n = row_count; raise notice 'logins trazidos: %', n;

  -- 3) Troca de id para quem já tinha conta aqui.
  select count(*) into n from passagem._mig_mapa;
  raise notice 'contas reaproveitadas pelo e-mail: %', n;
  if n > 0 then
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
  end if;
end $$;

commit;

-- Quem foi reaproveitado (confira se os e-mails fazem sentido):
select email, antigo, novo from passagem._mig_mapa order by email;
