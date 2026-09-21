-- ============================================================================
--  ADMIN — permite que perfis com `perfis.admin = true` LEIAM e EDITEM a ficha
--  de qualquer jogador (painel admin → 👥 Personagens → ✎ Editar / { }).
--
--  Só adiciona. Idempotente (pode rodar de novo). Rodar uma vez no SQL Editor.
--  As políticas são PERMISSIVAS: combinam por "OU" com as políticas que já
--  existem em `personagens` (não versionadas no repo) — dono continua podendo
--  tudo que já podia; admin passa a poder também. Nada é tirado de ninguém.
--
--  Pra se tornar admin (uma vez, trocando o e-mail):
--    update public.perfis set admin = true
--    where id = (select id from auth.users where email = 'SEU_EMAIL');
-- ============================================================================

alter table public.perfis add column if not exists admin boolean not null default false;

-- SECURITY DEFINER: lê perfis.admin sem depender da RLS de `perfis`, e evita
-- recursão se algum dia `perfis` tiver política que consulte `personagens`.
create or replace function public.eh_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select admin from public.perfis where id = auth.uid()), false);
$$;
grant execute on function public.eh_admin() to authenticated;

drop policy if exists "admin le todas as fichas" on public.personagens;
create policy "admin le todas as fichas" on public.personagens
  for select to authenticated
  using (public.eh_admin());

drop policy if exists "admin edita todas as fichas" on public.personagens;
create policy "admin edita todas as fichas" on public.personagens
  for update to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- Ninguém pode se promover a admin pelo app. Com esta migração, admin passa a
-- editar a ficha de TODO mundo — se o próprio usuário conseguisse fazer
-- `update perfis set admin = true` no próprio perfil (a política de perfis
-- costuma deixar o dono editar a própria linha), viraria uma escalada de
-- privilégio. Um `revoke update (admin)` não basta: o Supabase dá UPDATE na
-- tabela inteira pro papel `authenticated`, e privilégio de tabela vence o de
-- coluna. Então: gatilho. Requisições da API (papéis anon/authenticated) nunca
-- mudam `admin`; o SQL Editor (postgres) e o service_role continuam podendo.
create or replace function public.proteger_perfis_admin()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.admin := false;
    elsif new.admin is distinct from old.admin then
      new.admin := old.admin;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_perfis_admin on public.perfis;
create trigger proteger_perfis_admin
  before insert or update on public.perfis
  for each row execute function public.proteger_perfis_admin();
