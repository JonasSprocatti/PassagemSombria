#!/bin/sh
# Build da Vercel (chamado pelo "buildCommand" do vercel.json). Não compila
# nada: só escreve os dois arquivos que dependem do ambiente.
#
#  1. public/js/config.js — chaves do Supabase vindas das Environment
#     Variables do projeto na Vercel (SUPABASE_URL, SUPABASE_ANON_KEY e,
#     opcional, SUPABASE_SCHEMA). O arquivo não fica no repositório.
#  2. public/sw.js — troca "__VERSAO__" pelo commit, para cada deploy ganhar
#     um cache novo do PWA sem ninguém precisar lembrar de mudar um número.
set -e

# Sem as variáveis (ex.: um deploy de Preview quando elas só valem em
# Production) o build não falha: o site sobe, só não conecta no banco.
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "AVISO: faltam SUPABASE_URL e/ou SUPABASE_ANON_KEY nas Environment Variables da Vercel." >&2
fi

printf 'export const SUPABASE_URL="%s";\nexport const SUPABASE_ANON_KEY="%s";\nexport const SUPABASE_SCHEMA="%s";\n' \
  "$SUPABASE_URL" "$SUPABASE_ANON_KEY" "${SUPABASE_SCHEMA:-public}" > public/js/config.js

VERSAO=$(printf '%s' "${VERCEL_GIT_COMMIT_SHA:-$(date +%s)}" | cut -c1-12)
sed -i "s/__VERSAO__/$VERSAO/" public/sw.js

echo "config.js gerado (schema ${SUPABASE_SCHEMA:-public}); cache do PWA: ps-shell-$VERSAO"
