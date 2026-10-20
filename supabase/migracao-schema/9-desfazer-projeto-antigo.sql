-- ============================================================================
--  DESFAZER o passo 1 (só se precisar voltar o projeto ANTIGO a funcionar).
--  Rodar no SQL Editor do projeto antigo.
-- ============================================================================
begin;
drop table if exists passagem._mig_ddl, passagem._mig_users, passagem._mig_identities,
  passagem._mig_gatilhos_auth, passagem._mig_realtime;
drop schema public;               -- o public vazio criado no passo 1
alter schema passagem rename to public;
commit;
