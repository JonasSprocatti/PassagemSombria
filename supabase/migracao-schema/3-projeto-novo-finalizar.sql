-- ============================================================================
--  PASSO 5 — rodar no projeto NOVO, DEPOIS de restaurar `passagem-regras.sql`.
--
--  • Reescreve as funções do jogo que citavam `public.` (o corpo de função é
--    texto: o rename do passo 1 não mexe nele) para `passagem.`.
--  • Recria os gatilhos do jogo em auth.users com nome próprio
--    (`passagem_<nome>`), pra não trombar com os do PokeRPG.
--  • Permissões do schema para anon/authenticated/service_role, e o
--    Realtime das mesmas tabelas de antes.
--  • Apaga as cópias temporárias (_mig_*), que têm os hashes de senha.
-- ============================================================================
begin;

-- 1) Funções: public → passagem no corpo e no search_path.
do $$
declare f record; def text; novo text;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'passagem' and p.prokind in ('f', 'p')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    def := pg_get_functiondef(f.oid);
    novo := regexp_replace(def, '(?<![A-Za-z0-9_])public\.', 'passagem.', 'g');
    novo := regexp_replace(novo, '(search_path\s+(TO|=)\s*)''?public''?', '\1passagem', 'gi');
    if novo <> def then execute novo; end if;
  end loop;
end $$;

-- 2) Gatilhos do jogo em auth.users, com prefixo para não colidir.
do $$
declare g record;
begin
  for g in select nome, definicao from passagem._mig_gatilhos_auth loop
    execute format('drop trigger if exists %I on auth.users', 'passagem_' || g.nome);
    execute regexp_replace(g.definicao, '^CREATE (CONSTRAINT )?TRIGGER \S+',
                           'CREATE \1TRIGGER ' || quote_ident('passagem_' || g.nome));
  end loop;
end $$;

-- 3) Permissões (o mesmo padrão que o Supabase dá ao public; quem protege é a RLS).
grant usage on schema passagem to anon, authenticated, service_role;
grant all on all tables    in schema passagem to anon, authenticated, service_role;
grant all on all sequences in schema passagem to anon, authenticated, service_role;
grant all on all routines  in schema passagem to anon, authenticated, service_role;
alter default privileges in schema passagem grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema passagem grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema passagem grant all on routines  to anon, authenticated, service_role;
-- Restrições por coluna que o social.sql já fazia (quem recebe uma mensagem
-- direta só marca `lida`) — o grant geral acima as desfaria.
do $$ begin
  if to_regclass('passagem.mensagens_diretas') is not null then
    revoke update on passagem.mensagens_diretas from authenticated;
    grant update (lida) on passagem.mensagens_diretas to authenticated;
  end if;
  -- Correção de segurança do dossiê: quem recebe um pedido de amizade só
  -- pode mudar o `status` (antes podia trocar o `de` e forjar amizade).
  if to_regclass('passagem.amizades') is not null then
    revoke update on passagem.amizades from authenticated;
    grant update (status) on passagem.amizades to authenticated;
  end if;
end $$;

-- 4) Realtime: as mesmas tabelas que estavam publicadas no projeto antigo.
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

-- 5) Limpeza das cópias temporárias.
drop table passagem._mig_users, passagem._mig_identities, passagem._mig_gatilhos_auth,
  passagem._mig_realtime, passagem._mig_mapa;

commit;

-- A API passa a enxergar o schema novo sem esperar.
notify pgrst, 'reload schema';

-- Conferência rápida:
select 'perfis' as tabela, count(*) from passagem.perfis
union all select 'personagens', count(*) from passagem.personagens
union all select 'campanhas', count(*) from passagem.campanhas
union all select 'mensagens', count(*) from passagem.mensagens;
