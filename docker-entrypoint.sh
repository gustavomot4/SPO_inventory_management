#!/bin/sh
set -e

echo "[SPO] DATABASE_URL: $DATABASE_URL"

# =============================================================================
# QA-060: SESSION_SECRET por instalação.
# Gera um segredo aleatório na primeira execução e o persiste no volume (/data).
# Nunca é versionado. Sem isso, qualquer um que leia o repositório poderia forjar
# a sessão PIN e burlar a autenticação.
# =============================================================================
if [ -z "$SESSION_SECRET" ]; then
  mkdir -p /data
  SECRET_FILE="/data/session_secret"
  if [ ! -f "$SECRET_FILE" ]; then
    echo "[SPO] Gerando SESSION_SECRET para esta instalacao..."
    head -c 48 /dev/urandom | base64 | tr -d '\n' > "$SECRET_FILE"
    chmod 600 "$SECRET_FILE"
  fi
  SESSION_SECRET="$(cat "$SECRET_FILE")"
  export SESSION_SECRET
fi

echo "[SPO] Aplicando migrations do banco de dados..."

node node_modules/prisma/build/index.js migrate deploy

echo "[SPO] Migrations aplicadas com sucesso."
echo "[SPO] Iniciando servidor em modo producao (0.0.0.0:3000)..."

exec node server.js
