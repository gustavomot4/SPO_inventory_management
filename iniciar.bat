@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo.
echo ============================================================
echo  PIMENTA OUSADA - Sistema de Gestao de Estoque
echo ============================================================
echo.

:: -------------------------------------------------------
:: 1. Localizar o executavel do Docker
::    Docker Desktop pode estar no PATH ou em caminhos fixos.
::    O CMD aberto por duplo clique nem sempre herda o PATH
::    atualizado apos a instalacao do Docker Desktop.
:: -------------------------------------------------------
set DOCKER_CMD=

:: Tentar PATH primeiro
where docker >nul 2>nul
if %errorlevel% equ 0 (
    set DOCKER_CMD=docker
    goto dockerfound
)

:: Fallback: caminhos conhecidos do Docker Desktop no Windows
if exist "C:\Program Files\Docker\Docker\resources\bin\docker.exe" (
    set DOCKER_CMD="C:\Program Files\Docker\Docker\resources\bin\docker.exe"
    goto dockerfound
)
if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" (
    set DOCKER_CMD="%ProgramFiles%\Docker\Docker\resources\bin\docker.exe"
    goto dockerfound
)
if exist "%LOCALAPPDATA%\Docker\Docker\resources\bin\docker.exe" (
    set DOCKER_CMD="%LOCALAPPDATA%\Docker\Docker\resources\bin\docker.exe"
    goto dockerfound
)
if exist "%USERPROFILE%\AppData\Local\Docker\Docker\resources\bin\docker.exe" (
    set DOCKER_CMD="%USERPROFILE%\AppData\Local\Docker\Docker\resources\bin\docker.exe"
    goto dockerfound
)

:: Docker nao encontrado em nenhum local conhecido
echo [ERRO] Docker Desktop nao encontrado neste computador.
echo.
echo Por favor, instale o Docker Desktop em:
echo   https://www.docker.com/products/docker-desktop/
echo.
echo Apos instalar, reinicie o computador e abra este arquivo novamente.
pause
exit /b 1

:dockerfound
:: Adicionar o diretorio do docker ao PATH da sessao atual
:: Isso garante que "docker compose" tambem funcione
for %%F in (%DOCKER_CMD%) do set DOCKER_DIR=%%~dpF
set PATH=%DOCKER_DIR%;%PATH%
set DOCKER_COMPOSE_CMD=%DOCKER_CMD%

echo [OK] Docker encontrado.
echo.

:: -------------------------------------------------------
:: 2. Verificar se o Docker daemon esta rodando
:: -------------------------------------------------------
%DOCKER_CMD% info >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Docker nao esta em execucao. Iniciando Docker Desktop...
    echo       Aguarde - isso pode levar ate 1 minuto.
    echo.

    :: Tentar iniciar o Docker Desktop
    set DESKTOP_STARTED=0
    if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
        start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        set DESKTOP_STARTED=1
    )
    if %DESKTOP_STARTED% equ 0 (
        if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
            start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
            set DESKTOP_STARTED=1
        )
    )
    if %DESKTOP_STARTED% equ 0 (
        if exist "%LOCALAPPDATA%\Docker\Docker Desktop.exe" (
            start "" "%LOCALAPPDATA%\Docker\Docker Desktop.exe"
            set DESKTOP_STARTED=1
        )
    )

    :: Aguardar Docker inicializar (ate 90s)
    set DOCKER_WAIT=0
    :waitdocker
    timeout /t 5 /nobreak >nul
    %DOCKER_CMD% info >nul 2>nul
    if %errorlevel% equ 0 goto dockerready
    set /a DOCKER_WAIT+=5
    if %DOCKER_WAIT% lss 90 (
        echo   Aguardando Docker inicializar... (%DOCKER_WAIT%s)
        goto waitdocker
    )
    echo [ERRO] Docker nao inicializou em 90 segundos.
    echo        Abra o Docker Desktop manualmente pela barra de tarefas e tente novamente.
    pause
    exit /b 1
)

:dockerready
echo [OK] Docker esta em execucao.
echo.

:: -------------------------------------------------------
:: 3. Detectar primeira execucao ou reinicio normal
:: -------------------------------------------------------
%DOCKER_CMD% image inspect spo-pimenta-ousada >nul 2>nul
if %errorlevel% neq 0 (
    set FIRST_RUN=1
) else (
    set FIRST_RUN=0
)

:: -------------------------------------------------------
:: 4. Abrir tela de carregamento no browser
:: -------------------------------------------------------
if %FIRST_RUN% equ 1 (
    echo [INFO] Primeira execucao detectada.
    echo       Abrindo tela de progresso no browser...
    start "" "%~dp0loading_primeira_vez.html"
) else (
    echo [INFO] Reiniciando o sistema...
    start "" "%~dp0loading.html"
)

:: -------------------------------------------------------
:: 5. Iniciar containers
:: -------------------------------------------------------
if %FIRST_RUN% equ 1 (
    echo [INFO] Construindo o sistema pela primeira vez...
    echo       Isso pode levar varios minutos. Acompanhe no browser.
) else (
    echo [INFO] Iniciando containers...
)
echo.

%DOCKER_CMD% compose up -d --build

if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha ao iniciar o sistema.
    echo       Veja as mensagens acima para identificar o problema.
    pause
    exit /b 1
)

echo.
echo [OK] Sistema iniciado com sucesso.
echo      O browser abrira automaticamente quando estiver pronto.
echo.
echo      Para encerrar: execute parar.bat
echo.
pause
