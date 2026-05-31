#!/bin/sh
set -e

echo "[SPO] Aplicando migrations do banco de dados..."
node node_modules/prisma/build/index.js migrate deploy

echo "[SPO] Iniciando servidor em modo producao (porta 3000)..."
exec node server.js
