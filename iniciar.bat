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
:: -------------------------------------------------------
set DOCKER_CMD=

where docker >nul 2>nul
if %errorlevel% equ 0 (
    set DOCKER_CMD=docker
    goto dockerfound
)
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

echo [ERRO] Docker Desktop nao encontrado neste computador.
echo.
echo Por favor, instale o Docker Desktop em:
echo   https://www.docker.com/products/docker-desktop/
echo.
echo Apos instalar, reinicie o computador e abra este arquivo novamente.
pause
exit /b 1

:dockerfound
echo [OK] Docker encontrado.
echo.

:: -------------------------------------------------------
:: 2. Verificar se o daemon esta rodando
:: -------------------------------------------------------
%DOCKER_CMD% info >nul 2>nul
if %errorlevel% equ 0 goto dockerready

echo [INFO] Docker nao esta em execucao. Iniciando Docker Desktop...
echo       Aguarde - isso pode levar ate 1 minuto.
echo.

call :startDesktop

set DOCKER_WAIT=0
:waitdocker
ping -n 6 127.0.0.1 >nul 2>nul
%DOCKER_CMD% info >nul 2>nul
if %errorlevel% equ 0 goto dockerready
set /a DOCKER_WAIT+=5
if !DOCKER_WAIT! lss 90 (
    echo   Aguardando Docker inicializar... (!DOCKER_WAIT!s)
    goto waitdocker
)
echo [ERRO] Docker nao inicializou em 90 segundos.
echo        Abra o Docker Desktop manualmente e tente novamente.
pause
exit /b 1

:dockerready
echo [OK] Docker esta em execucao.
echo.

:: -------------------------------------------------------
:: 2.5 GITOPS-006: verificar/aplicar atualizacao automatica
::     Pull-based: le deploy/stable.json no GitHub. Sem internet,
::     sai em ~5 segundos sem erro e o sistema sobe na versao atual.
::     Log de auditoria: deploy\updates.log
:: -------------------------------------------------------
if exist "%~dp0deploy\spo-updater.ps1" (
    echo [INFO] Verificando atualizacoes do sistema...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\spo-updater.ps1" -Mode boot
    echo.
)

:: -------------------------------------------------------
:: 2.6 GITOPS-006: Tarefa Agendada (update diario 18h30) — auto-instala na 1a vez.
::     Tarefa do usuario atual; no uso normal NAO exige admin. Roda so uma vez:
::     nas proximas o schtasks /Query ja encontra a tarefa e este bloco e pulado.
::     Se falhar, o update no boot (secao 2.5) continua funcionando do mesmo jeito.
:: -------------------------------------------------------
if not exist "%~dp0deploy\spo-updater.ps1" goto spo_task_ok
schtasks /Query /TN "SPO Atualizacao Automatica" >nul 2>nul
if not errorlevel 1 goto spo_task_ok
echo [INFO] Configurando atualizacao automatica diaria (18h30) pela primeira vez...
schtasks /Create /F /TN "SPO Atualizacao Automatica" /SC DAILY /ST 18:30 /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"%~dp0deploy\spo-updater.ps1\" -Mode scheduled" >nul 2>nul
if errorlevel 1 (
    echo [AVISO] Nao foi possivel criar a tarefa diaria automaticamente.
    echo         O update no boot segue funcionando normalmente. Para ativar a
    echo         verificacao das 18h30, rode uma vez como administrador:
    echo         deploy\instalar-atualizacao-automatica.bat
) else (
    echo [OK] Atualizacao automatica diaria configurada.
)
:spo_task_ok
echo.

:: -------------------------------------------------------
:: 3. Detectar primeira execucao
::    Checa o volume do banco — criado apenas na 1a execucao.
::    Nao usa o nome da imagem pois o docker compose gera
::    "spo_inventory_management-spo", nao "spo-pimenta-ousada".
:: -------------------------------------------------------
%DOCKER_CMD% volume inspect spo-pimenta-ousada-data >nul 2>nul
if %errorlevel% neq 0 (
    set FIRST_RUN=1
) else (
    set FIRST_RUN=0
)

:: -------------------------------------------------------
:: 4. Abrir tela de carregamento
:: -------------------------------------------------------
if !FIRST_RUN! equ 1 (
    echo [INFO] Primeira execucao detectada.
    start "" "%~dp0loading_primeira_vez.html"
) else (
    echo [INFO] Reiniciando o sistema...
    start "" "%~dp0loading.html"
)

:: -------------------------------------------------------
:: 5. Iniciar containers
:: -------------------------------------------------------
if !FIRST_RUN! equ 1 (
    echo [INFO] Preparando o sistema pela primeira vez...
    echo       Isso pode levar varios minutos. Acompanhe no browser.
) else (
    echo [INFO] Iniciando containers...
)
echo.

:: GITOPS-003: a imagem vem pronta do GHCR (sem --build). A versao e pinada
:: pela variavel SPO_VERSION no arquivo .env (gerenciada pelo spo-updater).
%DOCKER_CMD% compose up -d

if %errorlevel% neq 0 (
    echo.
    echo [AVISO] Nao foi possivel baixar a imagem pronta do sistema.
    echo         Tentando construir localmente - pode levar varios minutos...
    echo.
    %DOCKER_CMD% compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
)

if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha ao iniciar o sistema.
    echo       Veja as mensagens acima para identificar o problema.
    pause
    exit /b 1
)

echo.
echo [OK] Sistema iniciado. O browser abrira quando estiver pronto.
echo      Atualizacoes sao automaticas (log em deploy\updates.log).
echo.
pause
exit /b 0

:: -------------------------------------------------------
:: Subroutine: tentar iniciar o Docker Desktop
:: -------------------------------------------------------
:startDesktop
if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    exit /b
)
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
    start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    exit /b
)
if exist "%LOCALAPPDATA%\Docker\Docker Desktop.exe" (
    start "" "%LOCALAPPDATA%\Docker\Docker Desktop.exe"
    exit /b
)
if exist "%USERPROFILE%\AppData\Local\Docker\Docker Desktop.exe" (
    start "" "%USERPROFILE%\AppData\Local\Docker\Docker Desktop.exe"
    exit /b
)
echo [AVISO] Nao foi possivel iniciar o Docker Desktop automaticamente.
echo         Abra o Docker Desktop manualmente pela barra de tarefas.
exit /b
