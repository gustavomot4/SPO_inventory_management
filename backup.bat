@echo off
setlocal enabledelayedexpansion
echo.
echo ============================================================
echo  PIMENTA OUSADA - Backup do Banco de Dados
echo ============================================================
echo.

set DB_FILE=prisma\dev.db
set BACKUP_DIR=backups
set MAX_BACKUPS=10

if not exist "%DB_FILE%" (
    echo [ERRO] Banco de dados nao encontrado: %DB_FILE%
    echo.
    echo Certifique-se de rodar este script dentro da pasta
    echo do sistema Pimenta Ousada.
    echo.
    pause
    exit /b 1
)

if not exist "%BACKUP_DIR%\" (
    mkdir "%BACKUP_DIR%"
    echo [INFO] Pasta de backups criada.
    echo.
)

for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set TIMESTAMP=%%i

set BACKUP_FILE=%BACKUP_DIR%\backup_%TIMESTAMP%.db

copy "%DB_FILE%" "%BACKUP_FILE%" >nul
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao copiar o banco de dados.
    echo Tente novamente ou feche o sistema antes de fazer o backup.
    echo.
    pause
    exit /b 1
)

echo [OK] Backup criado: %BACKUP_FILE%
echo.

set COUNT=0
for /f "delims=" %%f in ('dir /b /o-d "%BACKUP_DIR%\backup_*.db" 2^>nul') do (
    set /a COUNT+=1
    if !COUNT! gtr %MAX_BACKUPS% (
        del "%BACKUP_DIR%\%%f" >nul 2>nul
        echo [INFO] Backup antigo removido: %%f
    )
)

set TOTAL=0
for /f %%n in ('dir /b "%BACKUP_DIR%\backup_*.db" 2^>nul ^| find /c /v ""') do set TOTAL=%%n

echo ============================================================
echo  Backup concluido!
echo.
echo  Arquivo: %CD%\%BACKUP_FILE%
echo  Backups guardados: %TOTAL% de %MAX_BACKUPS%
echo ============================================================
echo.
echo  DICA: Execute este script ao final de cada dia de trabalho.
echo.
pause
