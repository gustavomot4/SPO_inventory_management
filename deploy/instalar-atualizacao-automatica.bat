@echo off
:: =============================================================================
:: instalar-atualizacao-automatica.bat (GITOPS-006)
:: SPO - Sistema Pimenta Ousada
:: =============================================================================
:: Cria a Tarefa Agendada do Windows que roda o spo-updater todo dia as 18:30
:: (loja fecha 18h; backup automatico roda 17h50). Executar UMA vez por maquina,
:: como Administrador. O update tambem roda a cada boot via iniciar.bat.
:: =============================================================================

cd /d "%~dp0"

echo.
echo ============================================================
echo  SPO - Instalar atualizacao automatica (diaria 18:30)
echo ============================================================
echo.

schtasks /Create /F /TN "SPO Atualizacao Automatica" /SC DAILY /ST 18:30 /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"%~dp0spo-updater.ps1\" -Mode scheduled"

if %errorlevel% equ 0 (
    echo.
    echo [OK] Tarefa "SPO Atualizacao Automatica" instalada.
    echo      Todo dia as 18:30 a maquina verifica se ha versao nova.
    echo      O log fica em: %~dp0updates.log
) else (
    echo.
    echo [ERRO] Nao foi possivel criar a tarefa agendada.
    echo        Clique com o botao direito neste arquivo e escolha
    echo        "Executar como administrador".
)

echo.
pause
