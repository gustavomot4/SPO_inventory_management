#!/bin/sh
# =============================================================================
# docker-entrypoint.sh — inicialização do container SPO
# Executa migrations pendentes, seed e inicia o servidor
#
# Este script roda toda vez que o container inicia:
#   - prisma migrate deploy é idempotente (aplica apenas migrations pendentes)
#   - prisma db seed é idempotente (upsert — nunca duplica o Settings singleton)
# =============================================================================

set -e

echo "🚀 SPO — Sistema Pimenta Ousada"
echo "================================"

# Aguardar filesystem estar pronto (edge case em alguns hosts)
sleep 1

# Aplicar migrations pendentes (idempotente — seguro rodar sempre)
echo "📦 Aplicando migrations..."
npx prisma migrate deploy

# Executar seed (idempotente — upsert, nunca duplica o Settings singleton)
echo "🌱 Inicializando banco de dados..."
npx prisma db seed

echo "✅ Banco de dados pronto"
echo ""
echo "🌐 Iniciando servidor em http://localhost:3000"

# Iniciar Next.js standalone
exec node server.js
