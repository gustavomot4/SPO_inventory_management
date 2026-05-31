@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo.
echo ============================================================
echo  PIMENTA OUSADA - Sistema de Gestao de Estoque
echo ============================================================
echo.

:: -------------------------------------------------------
:: 1. Verificar se Docker esta instalado
:: -------------------------------------------------------
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Docker nao encontrado no sistema.
    echo.
    echo Por favor, instale o Docker Desktop em:
    echo   https://www.docker.com/products/docker-desktop/
    echo.
    echo Apos instalar e reiniciar o computador, abra este arquivo novamente.
    pause
    exit /b 1
)

:: -------------------------------------------------------
:: 2. Verificar se o Docker daemon esta rodando
:: -------------------------------------------------------
docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Docker nao esta em execucao. Iniciando Docker Desktop...
    echo       Aguarde - isso pode levar ate 1 minuto.
    echo.

    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" 2>nul
    if %errorlevel% neq 0 (
        start "" "%LOCALAPPDATA%\Docker\Docker Desktop.exe" 2>nul
    )

    set DOCKER_WAIT=0
    :waitdocker
    timeout /t 5 /nobreak >nul
    docker info >nul 2>nul
    if %errorlevel% equ 0 goto dockerready
    set /a DOCKER_WAIT+=5
    if %DOCKER_WAIT% lss 90 (
        echo   Aguardando Docker... (%DOCKER_WAIT%s)
        goto waitdocker
    )
    echo [ERRO] Docker nao inicializou em 90 segundos.
    echo        Abra o Docker Desktop manualmente e tente novamente.
    pause
    exit /b 1
)

:dockerready
echo [OK] Docker esta em execucao.
echo.

:: -------------------------------------------------------
:: 3. Detectar primeira execucao ou reinicio normal
::    Primeira vez = imagem "spo-pimenta-ousada" nao existe ainda
:: -------------------------------------------------------
docker image inspect spo-pimenta-ousada >nul 2>nul
if %errorlevel% neq 0 (
    set FIRST_RUN=1
) else (
    set FIRST_RUN=0
)

:: -------------------------------------------------------
:: 4. Abrir tela de carregamento ANTES do docker compose
::    (a pagina faz polling e redireciona quando pronto)
:: -------------------------------------------------------
if %FIRST_RUN% equ 1 (
    echo [INFO] Primeira execucao detectada. Abrindo tela de progresso...
    start "" "%~dp0loading_primeira_vez.html"
) else (
    echo [INFO] Reiniciando o sistema. Abrindo tela de carregamento...
    start "" "%~dp0loading.html"
)

:: -------------------------------------------------------
:: 5. Iniciar containers em modo detached
:: -------------------------------------------------------
if %FIRST_RUN% equ 1 (
    echo [INFO] Construindo e iniciando o sistema pela primeira vez...
    echo       Isso pode levar varios minutos. A tela no browser mostra o progresso.
) else (
    echo [INFO] Iniciando o sistema...
)
echo.

call docker compose up -d --build

if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha ao iniciar o sistema.
    echo       Veja as mensagens acima para identificar o problema.
    pause
    exit /b 1
)

echo.
echo [OK] Containers iniciados. Aguardando aplicacao ficar pronta...
echo      O browser abrira automaticamente quando estiver pronto.
echo.
echo      Para encerrar o sistema: execute parar.bat
echo.
pause
