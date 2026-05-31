@echo off
cd /d "%~dp0"

echo.
echo ============================================================
echo  PIMENTA OUSADA - Encerrando o Sistema
echo ============================================================
echo.

:: Localizar docker (mesmo fallback do iniciar.bat)
set DOCKER_CMD=
where docker >nul 2>nul
if %errorlevel% equ 0 ( set DOCKER_CMD=docker & goto rundo )
if exist "C:\Program Files\Docker\Docker\resources\bin\docker.exe" ( set DOCKER_CMD="C:\Program Files\Docker\Docker\resources\bin\docker.exe" & goto rundo )
if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" ( set DOCKER_CMD="%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" & goto rundo )
if exist "%LOCALAPPDATA%\Docker\Docker\resources\bin\docker.exe" ( set DOCKER_CMD="%LOCALAPPDATA%\Docker\Docker\resources\bin\docker.exe" & goto rundo )
echo [ERRO] Docker nao encontrado. Verifique o Docker Desktop.
pause & exit /b 1

:rundo
for %%F in (%DOCKER_CMD%) do set PATH=%%~dpF;%PATH%

%DOCKER_CMD% compose down

if %errorlevel% neq 0 (
    echo [AVISO] Ocorreu um problema ao encerrar. Verifique o Docker Desktop.
) else (
    echo [OK] Sistema encerrado com sucesso.
    echo      Os dados estao salvos e serao mantidos na proxima vez.
)

echo.
pause
