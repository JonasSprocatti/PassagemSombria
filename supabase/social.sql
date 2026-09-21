-- ============================================================================
--  PASSAGEM SOMBRIA — SISTEMA SOCIAL
--  Amigos · chat geral · conversas privadas · trechos compartilhados ·
--  pedidos para entrar numa mesa (jogador ou espectador).
--
--  Como aplicar: Supabase → SQL Editor → colar este arquivo inteiro → Run.
--  Só ADICIONA (tabelas, uma coluna, funções, políticas) — não altera nem apaga
--  nada que já existe. Idempotente: rodar de novo não quebra nem duplica.
--
--  Segurança: toda tabela nova tem RLS ligada. O que cruza dados de outras
--  pessoas (estatísticas de um amigo, ler um trecho público, aceitar pedido)
--  passa por função SECURITY DEFINER que confere a permissão ANTES de ler.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) Colunas novas em tabelas existentes
-- ---------------------------------------------------------------------------
-- Papel na mesa. Quem já é membro vira 'jogador' — nada muda pra ninguém.
alter table public.campanha_membros
  add column if not exists papel text not null default 'jogador';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'campanha_membros_papel_chk') then
    alter table public.campanha_membros
      add constraint campanha_membros_papel_chk check (papel in ('jogador', 'espectador'));
  end if;
end $$;

-- O app já lê perfis.admin (botão de administrar conteúdo). Garante que existe.
alter table public.perfis add column if not exists admin boolean not null default false;

-- ---------------------------------------------------------------------------
-- 1) Amizades
-- ---------------------------------------------------------------------------
create table if not exists public.amizades (
  id        uuid primary key default gen_random_uuid(),
  de        uuid not null references public.perfis(id) on delete cascade,  -- quem pediu
  para      uuid not null references public.perfis(id) on delete cascade,  -- quem recebeu
  status    text not null default 'pendente' check (status in ('pendente', 'aceita')),
  criado_em timestamptz not null default now(),
  check (de <> para)
);
-- Um par só, em qualquer direção (A→B e B→A não coexistem).
create unique index if not exists amizades_par_unico
  on public.amizades (least(de, para), greatest(de, para));
alter table public.amizades enable row level security;

drop policy if exists "amizades: ver as minhas" on public.amizades;
create policy "amizades: ver as minhas" on public.amizades
  for select to authenticated using (auth.uid() in (de, para));

drop policy if exists "amizades: pedir" on public.amizades;
create policy "amizades: pedir" on public.amizades
  for insert to authenticated with check (de = auth.uid() and status = 'pendente');

-- Só quem RECEBEU aceita (vira 'aceita'); ninguém "des-aceita" por update.
drop policy if exists "amizades: aceitar" on public.amizades;
create policy "amizades: aceitar" on public.amizades
  for update to authenticated using (para = auth.uid()) with check (para = auth.uid() and status = 'aceita');

-- Qualquer um dos dois desfaz (recusar, cancelar o pedido ou desfazer a amizade).
drop policy if exists "amizades: desfazer" on public.amizades;
create policy "amizades: desfazer" on public.amizades
  for delete to authenticated using (auth.uid() in (de, para));

create or replace function public.sao_amigos(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from amizades
                 where status = 'aceita' and ((de = a and para = b) or (de = b and para = a)));
$$;

-- Meus contatos: amizades (aceitas e pendentes, nos dois sentidos) já com o
-- apelido/avatar da OUTRA pessoa. Não depende da RLS atual de `perfis`.
create or replace function public.meus_contatos()
returns table (amizade_id uuid, outro uuid, apelido text, avatar_url text, status text, enviei boolean, criado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, case when a.de = auth.uid() then a.para else a.de end,
         p.apelido, p.avatar_url, a.status, a.de = auth.uid(), a.criado_em
  from amizades a
  join perfis p on p.id = case when a.de = auth.uid() then a.para else a.de end
  where auth.uid() in (a.de, a.para)
  order by p.apelido;
$$;

-- Busca por apelido (pra adicionar amigo). Não depende da RLS de perfis.
create or replace function public.buscar_perfis(termo text)
returns table (id uuid, apelido text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.apelido, p.avatar_url from perfis p
  where auth.uid() is not null and char_length(trim(termo)) >= 2
    and p.id <> auth.uid() and p.apelido ilike '%' || trim(termo) || '%'
  order by p.apelido limit 20;
$$;

-- ---------------------------------------------------------------------------
-- 2) Conversas privadas (só entre amigos)
-- ---------------------------------------------------------------------------
create table if not exists public.mensagens_diretas (
  id        uuid primary key default gen_random_uuid(),
  de        uuid not null references public.perfis(id) on delete cascade,
  para      uuid not null references public.perfis(id) on delete cascade,
  conteudo  text not null check (char_length(conteudo) between 1 and 2000),
  payload   jsonb,                                   -- ex.: { trecho: token, titulo }
  lida      boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists md_para_idx on public.mensagens_diretas (para, criado_em desc);
create index if not exists md_de_idx   on public.mensagens_diretas (de, criado_em desc);
alter table public.mensagens_diretas enable row level security;

drop policy if exists "md: ver as minhas" on public.mensagens_diretas;
create policy "md: ver as minhas" on public.mensagens_diretas
  for select to authenticated using (auth.uid() in (de, para));

drop policy if exists "md: mandar pra amigo" on public.mensagens_diretas;
create policy "md: mandar pra amigo" on public.mensagens_diretas
  for insert to authenticated with check (de = auth.uid() and public.sao_amigos(de, para));

-- Quem recebe só pode marcar como lida — nunca editar o conteúdo.
drop policy if exists "md: marcar lida" on public.mensagens_diretas;
create policy "md: marcar lida" on public.mensagens_diretas
  for update to authenticated using (para = auth.uid()) with check (para = auth.uid());
revoke update on public.mensagens_diretas from authenticated;
grant update (lida) on public.mensagens_diretas to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Chat geral (uma sala para todo usuário logado)
-- ---------------------------------------------------------------------------
create table if not exists public.chat_geral (
  id        uuid primary key default gen_random_uuid(),
  autor_id  uuid not null references public.perfis(id) on delete cascade,
  conteudo  text not null check (char_length(conteudo) between 1 and 500),
  criado_em timestamptz not null default now()
);
create index if not exists chat_geral_idx on public.chat_geral (criado_em desc);
alter table public.chat_geral enable row level security;
-- Apelido/avatar gravados junto da mensagem (preenchidos no servidor por
-- gatilho — o cliente não escolhe o nome com que fala). Assim a mensagem que
-- chega pelo Realtime já vem com quem falou, sem outra consulta.
alter table public.chat_geral add column if not exists apelido text;
alter table public.chat_geral add column if not exists avatar_url text;
create or replace function public.chat_geral_autor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select apelido, avatar_url into new.apelido, new.avatar_url from perfis where id = new.autor_id;
  return new;
end $$;
drop trigger if exists chat_geral_autor on public.chat_geral;
create trigger chat_geral_autor before insert on public.chat_geral
  for each row execute function public.chat_geral_autor();

drop policy if exists "geral: ler" on public.chat_geral;
create policy "geral: ler" on public.chat_geral for select to authenticated using (true);

drop policy if exists "geral: falar" on public.chat_geral;
create policy "geral: falar" on public.chat_geral
  for insert to authenticated with check (autor_id = auth.uid());

-- Apaga: o próprio autor, ou um admin (moderação).
drop policy if exists "geral: apagar" on public.chat_geral;
create policy "geral: apagar" on public.chat_geral
  for delete to authenticated
  using (autor_id = auth.uid() or coalesce((select admin from public.perfis where id = auth.uid()), false));

-- ---------------------------------------------------------------------------
-- 4) Trechos de sessão compartilhados (link público, somente leitura)
-- ---------------------------------------------------------------------------
-- O trecho é uma CÓPIA feita no servidor, não uma referência: o cliente não
-- consegue forjar mensagem, e mensagem privada nunca entra.
create table if not exists public.trechos (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique default replace(gen_random_uuid()::text, '-', ''),
  autor_id    uuid not null references public.perfis(id) on delete cascade,
  campanha_id uuid references public.campanhas(id) on delete set null,
  titulo      text not null check (char_length(titulo) between 1 and 120),
  mensagens   jsonb not null,
  criado_em   timestamptz not null default now()
);
alter table public.trechos enable row level security;

drop policy if exists "trechos: ver os meus" on public.trechos;
create policy "trechos: ver os meus" on public.trechos
  for select to authenticated using (autor_id = auth.uid());

drop policy if exists "trechos: apagar os meus" on public.trechos;
create policy "trechos: apagar os meus" on public.trechos
  for delete to authenticated using (autor_id = auth.uid());
-- Sem política de insert: só a função abaixo cria trecho.

create or replace function public.criar_trecho(camp uuid, desde timestamptz, ate timestamptz, titulo text)
returns text language plpgsql security definer set search_path = public as $$
declare tok text; msgs jsonb;
begin
  if auth.uid() is null then raise exception 'precisa estar logado'; end if;
  if not exists (select 1 from campanhas c where c.id = camp and c.mestre_id = auth.uid())
     and not exists (select 1 from campanha_membros m where m.campanha_id = camp and m.perfil_id = auth.uid()) then
    raise exception 'você não participa desta mesa';
  end if;
  select coalesce(jsonb_agg(x order by x->>'criado_em'), '[]'::jsonb) into msgs from (
    select jsonb_build_object(
      'tipo', m.tipo, 'conteudo', m.conteudo, 'criado_em', m.criado_em,
      'payload', m.payload - 'resp',
      'autor', p.apelido, 'personagem', pe.nome) as x
    from mensagens m
    left join perfis p on p.id = m.autor_id
    left join personagens pe on pe.id = m.personagem_id
    where m.campanha_id = camp and m.criado_em between least(desde, ate) and greatest(desde, ate)
      and coalesce(m.payload->>'privada', 'false') <> 'true'
    order by m.criado_em limit 200) s;
  if jsonb_array_length(msgs) = 0 then raise exception 'nenhuma mensagem pública nesse intervalo'; end if;
  insert into trechos (autor_id, campanha_id, titulo, mensagens)
    values (auth.uid(), camp, left(trim(titulo), 120), msgs) returning token into tok;
  return tok;
end $$;

-- Leitura pública pelo token — funciona sem login (anon).
create or replace function public.ler_trecho(tok text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('titulo', t.titulo, 'criado_em', t.criado_em,
           'autor', p.apelido, 'campanha', c.nome, 'mensagens', t.mensagens)
  from trechos t
  left join perfis p on p.id = t.autor_id
  left join campanhas c on c.id = t.campanha_id
  where t.token = tok;
$$;

-- ---------------------------------------------------------------------------
-- 5) Pedidos para entrar numa mesa (feitos a um amigo que é Mestre)
-- ---------------------------------------------------------------------------
create table if not exists public.pedidos_mesa (
  id          uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas(id) on delete cascade,
  perfil_id   uuid not null references public.perfis(id) on delete cascade,
  papel       text not null check (papel in ('jogador', 'espectador')),
  mensagem    text check (mensagem is null or char_length(mensagem) <= 300),
  status      text not null default 'pendente' check (status in ('pendente', 'aceito', 'recusado')),
  criado_em   timestamptz not null default now()
);
create unique index if not exists pedidos_mesa_um_pendente
  on public.pedidos_mesa (campanha_id, perfil_id) where status = 'pendente';
alter table public.pedidos_mesa enable row level security;

drop policy if exists "pedidos: ver" on public.pedidos_mesa;
create policy "pedidos: ver" on public.pedidos_mesa for select to authenticated
  using (perfil_id = auth.uid()
         or exists (select 1 from campanhas c where c.id = campanha_id and c.mestre_id = auth.uid()));

-- Só pede quem é amigo do Mestre daquela mesa.
drop policy if exists "pedidos: pedir" on public.pedidos_mesa;
create policy "pedidos: pedir" on public.pedidos_mesa for insert to authenticated
  with check (perfil_id = auth.uid() and status = 'pendente'
              and public.sao_amigos(auth.uid(), (select c.mestre_id from campanhas c where c.id = campanha_id)));

drop policy if exists "pedidos: cancelar" on public.pedidos_mesa;
create policy "pedidos: cancelar" on public.pedidos_mesa for delete to authenticated
  using (perfil_id = auth.uid());

-- Pedidos que chegaram às MINHAS mesas (sou o Mestre), com quem pediu.
create or replace function public.pedidos_para_mim()
returns table (id uuid, campanha_id uuid, campanha text, perfil_id uuid, apelido text, papel text, mensagem text, criado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select q.id, c.id, c.nome, q.perfil_id, p.apelido, q.papel, q.mensagem, q.criado_em
  from pedidos_mesa q
  join campanhas c on c.id = q.campanha_id and c.mestre_id = auth.uid()
  join perfis p on p.id = q.perfil_id
  where q.status = 'pendente'
  order by q.criado_em;
$$;

-- Os pedidos que EU fiz, com o nome da mesa (que eu ainda não posso ler direto).
create or replace function public.meus_pedidos()
returns table (id uuid, campanha text, mestre text, papel text, status text, criado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select q.id, c.nome, p.apelido, q.papel, q.status, q.criado_em
  from pedidos_mesa q
  join campanhas c on c.id = q.campanha_id
  left join perfis p on p.id = c.mestre_id
  where q.perfil_id = auth.uid()
  order by q.criado_em desc limit 30;
$$;

-- Mesas em que um AMIGO é o Mestre (pra escolher onde pedir entrada).
create or replace function public.mesas_do_amigo(amigo uuid)
returns table (id uuid, nome text, ja_membro boolean, pedido_pendente boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.nome,
    exists (select 1 from campanha_membros m where m.campanha_id = c.id and m.perfil_id = auth.uid()),
    exists (select 1 from pedidos_mesa q where q.campanha_id = c.id and q.perfil_id = auth.uid() and q.status = 'pendente')
  from campanhas c
  where c.mestre_id = amigo and public.sao_amigos(auth.uid(), amigo)
  order by c.nome;
$$;

-- O Mestre aceita ou recusa. Aceitar põe a pessoa na mesa com o papel pedido.
create or replace function public.responder_pedido(pid uuid, aceitar boolean)
returns void language plpgsql security definer set search_path = public as $$
declare q pedidos_mesa;
begin
  select * into q from pedidos_mesa where id = pid and status = 'pendente';
  if q.id is null then raise exception 'pedido não encontrado'; end if;
  if not exists (select 1 from campanhas c where c.id = q.campanha_id and c.mestre_id = auth.uid()) then
    raise exception 'só o Mestre da mesa responde';
  end if;
  update pedidos_mesa set status = case when aceitar then 'aceito' else 'recusado' end where id = pid;
  if aceitar then
    if exists (select 1 from campanha_membros m where m.campanha_id = q.campanha_id and m.perfil_id = q.perfil_id) then
      update campanha_membros set papel = q.papel where campanha_id = q.campanha_id and perfil_id = q.perfil_id;
    else
      insert into campanha_membros (campanha_id, perfil_id, papel) values (q.campanha_id, q.perfil_id, q.papel);
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6) Perfil de um amigo: estatísticas (só amigos — ou você mesmo)
-- ---------------------------------------------------------------------------
-- Média do d20 NATURAL: lida do texto da rolagem ("d20 [17] ..."), o mesmo
-- formato que o app já grava. Rolagens sem d20 (dano puro) ficam de fora.
create or replace function public.perfil_social(alvo uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if auth.uid() is null or (alvo <> auth.uid() and not public.sao_amigos(auth.uid(), alvo)) then
    return null;
  end if;
  with rol as (
    select m.personagem_id,
           substring(m.payload->>'detalhe' from 'd20 \[(\d+)\]')::int as nat
    from mensagens m where m.autor_id = alvo and m.tipo = 'rolagem'
  ), d20 as (select nat from rol where nat between 1 and 20)
  select jsonb_build_object(
    'apelido',   (select apelido from perfis where id = alvo),
    'avatar',    (select avatar_url from perfis where id = alvo),
    'rolagens',  (select count(*) from rol),
    'd20',       (select count(*) from d20),
    'media_d20', (select round(avg(nat)::numeric, 2) from d20),
    'criticos',  (select count(*) from d20 where nat = 20),
    'falhas',    (select count(*) from d20 where nat = 1),
    'mesas',     (select count(*) from campanha_membros where perfil_id = alvo)
                 + (select count(*) from campanhas where mestre_id = alvo),
    'personagens', coalesce((
      select jsonb_agg(x order by (x->>'usos')::int desc) from (
        select jsonb_build_object(
          'nome', pe.nome, 'raca', pe.dados->>'raca', 'classe', pe.dados->>'classe',
          'nivel', coalesce((pe.dados->>'nivel')::int, 1),
          'usos', (select count(*) from rol where rol.personagem_id = pe.id)) as x
        from personagens pe where pe.dono_id = alvo
        order by (select count(*) from rol where rol.personagem_id = pe.id) desc limit 5) s), '[]'::jsonb)
  ) into r;
  return r;
end $$;

-- ---------------------------------------------------------------------------
-- 7) Espectador: vê a mesa, não age nela
-- ---------------------------------------------------------------------------
-- Políticas RESTRITIVAS: combinam por "E" com as que já existem, então
-- restringem o espectador sem precisar mexer (nem conhecer) nas atuais.
drop policy if exists "espectador não escreve na mesa" on public.mensagens;
create policy "espectador não escreve na mesa" on public.mensagens
  as restrictive for insert to authenticated
  with check (not exists (select 1 from public.campanha_membros m
    where m.campanha_id = mensagens.campanha_id and m.perfil_id = auth.uid() and m.papel = 'espectador'));

drop policy if exists "espectador não vê rolagem privada" on public.mensagens;
create policy "espectador não vê rolagem privada" on public.mensagens
  as restrictive for select to authenticated
  using (coalesce(payload->>'privada', 'false') <> 'true'
         or not exists (select 1 from public.campanha_membros m
           where m.campanha_id = mensagens.campanha_id and m.perfil_id = auth.uid() and m.papel = 'espectador'));

drop policy if exists "espectador não altera a campanha" on public.campanhas;
create policy "espectador não altera a campanha" on public.campanhas
  as restrictive for update to authenticated
  using (not exists (select 1 from public.campanha_membros m
    where m.campanha_id = campanhas.id and m.perfil_id = auth.uid() and m.papel = 'espectador'));

-- ---------------------------------------------------------------------------
-- 8) Permissões das funções e Realtime
-- ---------------------------------------------------------------------------
grant execute on function public.sao_amigos(uuid, uuid)            to authenticated;
grant execute on function public.buscar_perfis(text)               to authenticated;
grant execute on function public.meus_contatos()                   to authenticated;
grant execute on function public.pedidos_para_mim()                to authenticated;
grant execute on function public.meus_pedidos()                    to authenticated;
grant execute on function public.criar_trecho(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.ler_trecho(text)                  to anon, authenticated;
grant execute on function public.mesas_do_amigo(uuid)             to authenticated;
grant execute on function public.responder_pedido(uuid, boolean)   to authenticated;
grant execute on function public.perfil_social(uuid)               to authenticated;

-- Chat geral e conversas privadas chegam ao vivo (como o chat da mesa).
do $$
declare t text;
begin
  foreach t in array array['chat_geral', 'mensagens_diretas', 'amizades', 'pedidos_mesa'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
