@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
echo.
echo ============================================================
echo  PIMENTA OUSADA — Backup do Banco de Dados
echo ============================================================
echo.

:: Definir caminhos
set DB_FILE=prisma\dev.db
set BACKUP_DIR=backups
set MAX_BACKUPS=10

:: Verificar se o banco de dados existe
if not exist "%DB_FILE%" (
    echo [ERRO] Banco de dados nao encontrado em: %DB_FILE%
    echo.
    echo Certifique-se de estar rodando este script dentro da pasta
    echo do sistema Pimenta Ousada.
    echo.
    pause
    exit /b 1
)

:: Criar pasta de backups se nao existir
if not exist "%BACKUP_DIR%\" (
    mkdir "%BACKUP_DIR%"
    echo [INFO] Pasta de backups criada: %BACKUP_DIR%\
    echo.
)

:: Gerar timestamp via PowerShell (funciona em qualquer idioma do Windows)
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'"') do set TIMESTAMP=%%i

set BACKUP_FILE=%BACKUP_DIR%\backup_%TIMESTAMP%.db

:: Copiar o banco de dados
copy "%DB_FILE%" "%BACKUP_FILE%" >nul
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao copiar o banco de dados.
    echo Verifique se o sistema nao esta em uso e tente novamente.
    echo.
    pause
    exit /b 1
)

echo [OK] Backup criado com sucesso!
echo      Arquivo: %BACKUP_FILE%
echo.

:: Apagar backups mais antigos — manter apenas os MAX_BACKUPS mais recentes
set COUNT=0
for /f "delims=" %%f in ('dir /b /o-d "%BACKUP_DIR%\backup_*.db" 2^>nul') do (
    set /a COUNT+=1
    if !COUNT! gtr %MAX_BACKUPS% (
        del "%BACKUP_DIR%\%%f" >nul 2>nul
        echo [INFO] Backup antigo removido: %%f
    )
)

:: Contar backups restantes
set TOTAL=0
for /f %%n in ('dir /b "%BACKUP_DIR%\backup_*.db" 2^>nul ^| find /c /v ""') do set TOTAL=%%n

echo ============================================================
echo  Backup concluido!
echo.
echo  Salvo em: %CD%\%BACKUP_FILE%
echo  Backups guardados: %TOTAL% de %MAX_BACKUPS%
echo ============================================================
echo.
echo  DICA: Execute este script no final de cada dia de trabalho
echo  para nao perder dados da loja.
echo.
pause
