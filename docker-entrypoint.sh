#!/bin/sh
set -e

echo "[SPO] DATABASE_URL: $DATABASE_URL"
echo "[SPO] Aplicando migrations do banco de dados..."

node node_modules/prisma/build/index.js migrate deploy

echo "[SPO] Migrations aplicadas com sucesso."
echo "[SPO] Iniciando servidor em modo producao (0.0.0.0:3000)..."

exec node server.js
