' ============================================================
' criar_atalho_area_de_trabalho.vbs
' Pimenta Ousada — Sistema de Gestao de Estoque
' ============================================================
' Execute este arquivo UMA vez para criar o atalho clicavel
' na Area de Trabalho com nome e icone personalizados.
' ============================================================

Dim oShell, oFSO, sDir, oLink, sDesktop

Set oShell = CreateObject("WScript.Shell")
Set oFSO   = CreateObject("Scripting.FileSystemObject")

' Pasta onde este arquivo .vbs esta
sDir = oFSO.GetParentFolderName(WScript.ScriptFullName)

' Area de trabalho do usuario atual
sDesktop = oShell.SpecialFolders("Desktop")

' Caminho do atalho a ser criado
Dim sLinkPath
sLinkPath = sDesktop & "\Pimenta Ousada - Sistema de Estoque.lnk"

' Criar o atalho
Set oLink = oShell.CreateShortcut(sLinkPath)

oLink.TargetPath       = sDir & "\iniciar.bat"
oLink.WorkingDirectory = sDir
oLink.Description      = "Abrir o Sistema de Gestao de Estoque da Pimenta Ousada"
oLink.IconLocation     = sDir & "\pimenta-ousada.ico, 0"
oLink.WindowStyle      = 1   ' 1 = janela normal

oLink.Save

' Confirmacao
MsgBox "Atalho criado com sucesso na Area de Trabalho!" & vbCrLf & vbCrLf & _
       "Procure por:" & vbCrLf & _
       "  Pimenta Ousada - Sistema de Estoque" & vbCrLf & vbCrLf & _
       "Clique duas vezes nele para abrir o sistema.", _
       vbInformation, "Pimenta Ousada"

Set oLink  = Nothing
Set oFSO   = Nothing
Set oShell = Nothing
