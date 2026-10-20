// ============================================================
// CONFIGURAÇÃO — preencha com os dados do seu projeto Supabase
// (Settings → API no painel do Supabase)
// A anon key é pública por design; a segurança vem das RLS policies.
// ============================================================
export const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
export const SUPABASE_ANON_KEY = "SUA_ANON_KEY_AQUI";
// Schema do Postgres com as tabelas do jogo. Deixe "public" num projeto só do
// Passagem Sombria; use "passagem" quando o projeto for dividido com outro app
// (ver supabase/migracao-schema.md).
export const SUPABASE_SCHEMA = "public";
