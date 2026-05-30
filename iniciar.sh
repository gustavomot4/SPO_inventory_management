#!/bin/bash
set -e

echo ""
echo "============================================================"
echo " PIMENTA OUSADA — Sistema de Gestão de Estoque"
echo "============================================================"
echo ""

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "[ERRO] Node.js não encontrado no sistema."
    echo ""
    echo "Por favor, instale o Node.js 20 LTS:"
    echo "  - Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "  - Outros: https://nodejs.org/pt/download"
    echo ""
    exit 1
fi

# Verificar versão mínima do Node.js
NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "[AVISO] Node.js v$(node --version) detectado. Recomendado: v20 LTS ou superior."
    echo "Continuando mesmo assim..."
    echo ""
fi

# Instalar dependências se node_modules não existir
if [ ! -d "node_modules" ]; then
    echo "[INFO] Instalando dependências pela primeira vez..."
    echo "      Isso pode levar alguns minutos. Aguarde."
    echo ""
    npm install
    echo ""
    echo "[OK] Dependências instaladas."
    echo ""
fi

# Criar/aplicar migrations do banco de dados
if [ ! -f "prisma/dev.db" ]; then
    echo "[INFO] Criando banco de dados pela primeira vez..."
    npx prisma migrate deploy
    echo "[OK] Banco de dados criado."
    echo ""
else
    echo "[INFO] Aplicando atualizações do banco de dados (se houver)..."
    npx prisma migrate deploy
    echo ""
fi

# Verificar se .env existe
if [ ! -f ".env" ]; then
    echo "[INFO] Criando arquivo de configuração .env a partir do exemplo..."
    cp .env.example .env
    echo "[OK] .env criado. Verifique as configurações se necessário."
    echo ""
fi

echo "============================================================"
echo " Sistema pronto! Abrindo em http://localhost:3000"
echo " Para encerrar: pressione Ctrl+C"
echo "============================================================"
echo ""

# Iniciar o servidor
npm run dev
