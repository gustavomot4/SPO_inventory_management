@echo off
cd /d "%~dp0"

echo.
echo ============================================================
echo  PIMENTA OUSADA - Encerrando o Sistema
echo ============================================================
echo.

docker compose down

if %errorlevel% neq 0 (
    echo [AVISO] Ocorreu um problema ao encerrar. Verifique o Docker Desktop.
) else (
    echo [OK] Sistema encerrado com sucesso.
    echo      Os dados estao salvos e serao mantidos na proxima vez.
)

echo.
pause
