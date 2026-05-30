@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo.
echo ============================================================
echo  PIMENTA OUSADA - Sistema de Gestao de Estoque
echo ============================================================
echo.

:: Verificar se Node.js esta instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado no sistema.
    echo.
    echo Por favor, instale o Node.js 20 LTS em:
    echo   https://nodejs.org/pt/download
    echo.
    echo Apos instalar, feche e reabra este arquivo.
    pause
    exit /b 1
)

:: Verificar versao minima do Node.js
for /f "tokens=1 delims=v" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=1 delims=." %%i in ("%NODE_VERSION%") do set NODE_MAJOR=%%i

if %NODE_MAJOR% lss 18 (
    echo [AVISO] Node.js v%NODE_VERSION% detectado. Recomendado: v20 LTS.
    echo Continuando mesmo assim...
    echo.
)

:: Verificar se .env existe antes do Prisma
if not exist ".env" (
    echo [INFO] Criando arquivo de configuracao .env...
    copy .env.example .env >nul
    echo [OK] .env criado.
    echo.
)

:: Instalar dependencias se node_modules nao existir
if not exist "node_modules\" (
    echo [INFO] Instalando dependencias pela primeira vez...
    echo       Isso pode levar alguns minutos. Aguarde.
    echo.

    call npm install

    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao instalar dependencias.
        pause
        exit /b 1
    )

    echo.
    echo [OK] Dependencias instaladas.
    echo.
)

:: Aplicar migrations do banco de dados
if not exist "prisma\dev.db" (
    echo [INFO] Criando banco de dados pela primeira vez...

    call npx prisma migrate deploy

    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao criar o banco de dados.
        pause
        exit /b 1
    )

    echo [OK] Banco de dados criado.
    echo.
) else (
    echo [INFO] Verificando atualizacoes do banco...

    call npx prisma migrate deploy

    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao atualizar o banco de dados.
        pause
        exit /b 1
    )

    echo.
)

echo ============================================================
echo  Sistema pronto! Abrindo em http://localhost:3000
echo  Para encerrar: pressione Ctrl+C nesta janela
echo ============================================================
echo.

start "" http://localhost:3000

call npm run dev

echo.
echo [INFO] Sistema encerrado.
pause