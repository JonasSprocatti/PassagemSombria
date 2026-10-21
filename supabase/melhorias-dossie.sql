-- ============================================================================
--  Melhorias do dossiê — rodar UMA vez no SQL Editor do Supabase.
--
--  Pode rodar de novo sem estragar nada (cada passo confere se já existe).
--  Só ADICIONA: nenhuma tabela, coluna ou dado é apagado.
--
--  Schema: `passagem` (o projeto dividido com o PokéRPG). Se um dia o app voltar
--  a usar `public`, troque "passagem." por "public." no arquivo inteiro.
--
--  O que faz:
--   1) coluna `versao` em campanhas e personagens, que sobe sozinha a cada
--      gravação — o app usa para não gravar por cima do que outra pessoa
--      acabou de salvar (dano, turno, recompensa…);
--   2) personagens no Realtime — a mesa vê na hora o PV/RAM que o próprio
--      jogador mudou na ficha;
--   3) rolagem privada fica privada de verdade: só quem rolou e o Mestre da
--      campanha conseguem ler (antes só a tela escondia);
--   4) bucket de Storage `passagem-fotos` para as fotos dos personagens
--      (antes iam em base64 dentro da ficha, pesando em toda leitura).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Versão das linhas (controle de gravação simultânea)
-- ---------------------------------------------------------------------------
alter table passagem.campanhas   add column if not exists versao integer not null default 0;
alter table passagem.personagens add column if not exists versao integer not null default 0;

create or replace function passagem.subir_versao() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.versao := coalesce(old.versao, 0) + 1;
  return new;
end $$;

drop trigger if exists subir_versao on passagem.campanhas;
create trigger subir_versao before update on passagem.campanhas
  for each row execute function passagem.subir_versao();

drop trigger if exists subir_versao on passagem.personagens;
create trigger subir_versao before update on passagem.personagens
  for each row execute function passagem.subir_versao();

-- ---------------------------------------------------------------------------
-- 2) Realtime: mudanças nas fichas
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'passagem' and tablename = 'personagens') then
    alter publication supabase_realtime add table passagem.personagens;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Rolagem privada: só o autor e o Mestre da campanha leem
-- ---------------------------------------------------------------------------
-- RESTRITIVA: combina por "E" com as políticas de leitura que já existem, então
-- só tira acesso (às privadas), nunca dá acesso novo.
drop policy if exists "privada só autor e mestre" on passagem.mensagens;
create policy "privada só autor e mestre" on passagem.mensagens
  as restrictive for select to authenticated
  using (coalesce(payload->>'privada', 'false') <> 'true'
         or autor_id = auth.uid()
         or exists (select 1 from passagem.campanhas c
                    where c.id = mensagens.campanha_id and c.mestre_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 4) Fotos dos personagens no Storage
-- ---------------------------------------------------------------------------
-- Bucket público para LEITURA (a foto aparece na ficha pública e no chat sem
-- login), até 1 MB por arquivo, só imagem. Escrever só na própria pasta
-- (<id do usuário>/...).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('passagem-fotos', 'passagem-fotos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "passagem-fotos: ler a própria pasta" on storage.objects;
create policy "passagem-fotos: ler a própria pasta" on storage.objects
  for select to authenticated
  using (bucket_id = 'passagem-fotos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "passagem-fotos: enviar na própria pasta" on storage.objects;
create policy "passagem-fotos: enviar na própria pasta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'passagem-fotos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "passagem-fotos: trocar na própria pasta" on storage.objects;
create policy "passagem-fotos: trocar na própria pasta" on storage.objects
  for update to authenticated
  using (bucket_id = 'passagem-fotos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'passagem-fotos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "passagem-fotos: apagar na própria pasta" on storage.objects;
create policy "passagem-fotos: apagar na própria pasta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'passagem-fotos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Conferência (deve listar as duas colunas, o gatilho e o bucket)
-- ---------------------------------------------------------------------------
select 'coluna' as o_que, table_name as nome from information_schema.columns
  where table_schema = 'passagem' and column_name = 'versao'
union all
select 'gatilho', event_object_table from information_schema.triggers
  where trigger_schema = 'passagem' and trigger_name = 'subir_versao'
union all
select 'realtime', tablename::text from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'passagem'
union all
select 'bucket', id from storage.buckets where id = 'passagem-fotos';
