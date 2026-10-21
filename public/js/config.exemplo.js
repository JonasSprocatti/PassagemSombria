// ============================================================
// MODELO de configuração. O config.js de verdade NÃO fica no repositório:
//  • na Vercel, scripts/build-vercel.sh gera public/js/config.js a partir das
//    Environment Variables (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SCHEMA);
//  • para rodar no computador, copie este arquivo para config.js e preencha
//    (Supabase → Settings → API Keys / Data API).
// A chave anon/publishable é pública por design; a segurança vem das políticas de RLS.
// ============================================================
export const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
export const SUPABASE_ANON_KEY = "SUA_ANON_KEY_AQUI";
// Schema do Postgres com as tabelas do jogo. "public" num projeto só do
// Passagem Sombria; "passagem" quando o projeto é dividido com outro app
// (ver supabase/migracao-schema/README.md).
export const SUPABASE_SCHEMA = "public";
