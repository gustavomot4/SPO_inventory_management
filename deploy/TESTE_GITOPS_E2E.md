# Teste de ponta a ponta do GitOps (GITOPS-009)

> **Objetivo:** validar o ciclo completo **release → atualização automática → rollback** numa
> máquina de TESTE antes de ativar o auto-update nas máquinas das lojas.
> Enquanto este checklist não passar 100%, **não** ative o GitOps na loja (política do backlog — GITOPS-009).
>
> **Onde rodar:** uma máquina de TESTE (nunca a loja). Docker Desktop instalado, repositório na pasta do projeto.
> **Referências:** `deploy/RUNBOOK.md`, ADR-005, `plano/plano_gitops_atualizacoes.md`.

Convenções usadas abaixo:
- **Log:** `deploy/updates.log` (toda decisão do updater fica aqui).
- **Health:** `http://localhost:3000/api/health` → `{"ok":true,"version":"vX.Y.Z"}`.
- **Updater manual (verboso):** `powershell -NoProfile -ExecutionPolicy Bypass -File deploy\spo-updater.ps1 -Mode manual`.
- **Versão pinada:** linha `SPO_VERSION="..."` no `.env`.

---

## 0. Baseline (antes de começar)

- [ ] `docker pull ghcr.io/gustavomot4/spo:v1.1.0` baixa sem login (package público).
- [ ] `curl http://localhost:3000/api/health` responde `{"ok":true,"version":"v1.1.0"}`.
- [ ] `docker compose images` mostra a imagem `ghcr.io/gustavomot4/spo:v1.1.0` (não um build local).
- [ ] Coloca a máquina no **canal de teste**: crie o arquivo `deploy\channel` com o conteúdo `edge`
      (assim ela segue `edge.json`, antes de qualquer promoção). No fim do teste, apague o arquivo.

---

## 1. Publicar a versão de teste (release)

- [ ] `package.json` já está em **1.1.1** (feito).
- [ ] Comitar e enviar:
  ```bash
  git add package.json
  git commit -m "release v1.1.1 (teste e2e GitOps)"
  git push origin main
  git tag v1.1.1
  git push origin v1.1.1
  ```
- [ ] GitHub → **Actions** → workflow **"Release (build + publish edge)"** rodou e ficou verde.
- [ ] O workflow commitou a atualização de `deploy/edge.json` (versão `v1.1.1` + um `digest` novo, `breaking:false`).
- [ ] `git pull` na máquina de teste para trazer o `edge.json` novo (ou aguarde — o updater lê direto do GitHub).

---

## 2. Caminho feliz — atualização pelo canal edge

- [ ] Rodar o updater manual: `...spo-updater.ps1 -Mode manual`.
- [ ] No `deploy/updates.log`, conferir a sequência completa:
  - `Atualizacao disponivel: v1.1.0 -> v1.1.1 (canal edge, breaking=False)`
  - `docker-compose.yml sincronizado da tag v1.1.1`
  - `Backup pre-update (Backup API): spo_preupdate_v1.1.1_<data>.db`
  - (pull da imagem) e `ATUALIZADO com sucesso para v1.1.1.`
- [ ] `curl .../api/health` agora responde `"version":"v1.1.1"`.
- [ ] `.env` agora tem `SPO_VERSION="v1.1.1"`.
- [ ] Existe um backup novo em `backups\spo_preupdate_v1.1.1_*.db`.
- [ ] Rodar o updater de novo → log mostra `Convergido em v1.1.1` (idempotente, não reaplica).

---

## 3. Promoção para stable

- [ ] GitHub → **Actions** → **"Promote to stable"** → `version: v1.1.1`, `breaking: false` → Run.
- [ ] O workflow reescreveu `deploy/stable.json` para `v1.1.1` (com `digest` e `publishedAt` reais).
- [ ] Numa máquina **no canal stable** (sem o arquivo `deploy\channel`, ou com conteúdo `stable`):
      rodar o updater → ela atualiza para `v1.1.1` pela mesma sequência do passo 2.
- [ ] Reabrir pelo `iniciar.bat` também aplica a atualização (verificação no boot).

---

## 4. Cenários de resiliência (o coração do GITOPS-009)

### 4.1 Offline — sistema não pode quebrar sem internet
- [ ] Desligue a internet (ou o Wi-Fi) e rode o updater manual.
- [ ] Log mostra `Sem acesso ao manifesto (offline?) - mantendo versao atual.` em ~5 s.
- [ ] O sistema continua no ar normalmente (health responde) na versão atual. Religue a internet.

### 4.2 Falha de pull (registry inacessível) — reverte o ponteiro, segue na versão atual
- [ ] Simule: promova/edite um manifesto apontando uma versão cujo **digest não existe**
      (ou bloqueie `ghcr.io` no firewall) e rode o updater.
- [ ] Log mostra `compose pull falhou (registry inacessivel?) - revertendo ponteiro de versao`.
- [ ] `SPO_VERSION` volta ao valor anterior e o sistema segue funcionando.

### 4.3 Falha de health → ROLLBACK automático *(teste central)*
> A tag precisa ser numérica `vX.Y.Z` — o comparador de versão do updater rejeita sufixos
> como `-badhealth`. Use um número de descarte bem alto para não colidir com a sequência real.
- [ ] Numa branch, faça `GET /api/health` responder erro (ex.: `return NextResponse.json({ ok: false }, { status: 500 })`),
      comite e publique como versão de descarte:
  ```bash
  git tag v1.1.99
  git push origin v1.1.99
  ```
- [ ] Com a máquina no canal **edge** (passo 0), rode o updater. **Não promova essa versão para stable.**
- [ ] Log mostra: tenta subir → `Health da versao v1.1.99 FALHOU - executando rollback.`
      → `Rollback concluido - sistema operando em v1.1.1.`
- [ ] `curl .../api/health` confirma que voltou para `v1.1.1` e está `ok:true`.
- [ ] Limpeza: apague a tag (`git push origin :v1.1.99`); o próximo release real (v1.1.2) sobrescreve o `edge.json`.

### 4.4 Release "breaking" → restaura o banco no rollback *(avançado, opcional)*
- [ ] Publique uma versão com migration incompatível e promova com **`breaking: true`**.
- [ ] Force a falha de health (como em 4.3). No rollback, o log deve mostrar
      `Release marcada como BREAKING - restaurando banco do backup pre-update antes de voltar a imagem.`
- [ ] Conferir que os dados batem com o estado anterior à atualização.

### 4.5 Backup e restauração manual (RUNBOOK §5)
- [ ] Antes de cada atualização há um `backups\spo_preupdate_*.db` (verificado no passo 2).
- [ ] O backup diário das 17h50 também roda: `docker logs spo-backup` mostra a execução; existem
      `backups\spo_backup_*.db`.
- [ ] Teste restaurar um backup seguindo o RUNBOOK §5 e confirme que o sistema sobe com os dados.

### 4.6 Versão abaixo do mínimo suportado (bloqueio) *(opcional)*
- [ ] Edite `deploy/stable.json` (via PR) subindo `minSupported` acima da versão local e rode o updater.
- [ ] Log mostra `Versao local (...) abaixo do minimo suportado (...) - atualizacao automatica BLOQUEADA.`
      (cenário de atualização assistida — RUNBOOK).

### 4.7 Reentrância / lock órfão *(opcional)*
- [ ] Rode dois updaters ao mesmo tempo → o segundo loga `Outra execucao em andamento (lock) - saindo.`
- [ ] Um `deploy\updater.lock` com mais de 30 min é descartado sozinho (`Lock obsoleto descartado.`).

---

## 5. Critérios de aprovação (sign-off do GITOPS-009)

- [ ] Caminho feliz (edge **e** stable) atualiza e o health reflete a versão nova.
- [ ] Offline = no-op seguro (4.1).
- [ ] Pull falho = mantém versão atual (4.2).
- [ ] Health falho = rollback automático para a versão anterior (4.3).
- [ ] Backup pré-update criado a cada atualização e restauração testada (4.5).
- [ ] (Se aplicável) breaking restaura o banco (4.4).

Com todos os itens marcados, o GITOPS-009 pode ser dado como concluído no `plano/backlog.md` e o
auto-update pode ser ativado nas máquinas das lojas (rodar `deploy\instalar-atualizacao-automatica.bat`
como administrador, ou apenas abrir pelo `iniciar.bat`, que já instala a Tarefa Agendada na 1ª vez).

> **Limpeza pós-teste:** apague o arquivo `deploy\channel` da máquina de teste (volta para o canal
> stable) e remova quaisquer tags de teste (`v1.1.2-badhealth` etc.).
