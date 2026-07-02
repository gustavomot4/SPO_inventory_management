# RUNBOOK — Atualizações automáticas (GitOps) — SPO

> **Para quem opera o projeto** (não é para a dona da loja — para ela nada muda: abrir o
> sistema pelo atalho como sempre). Referência completa: `77777777_SPO_Project_DOCs/b_plano/c_plano_gitops_atualizacoes.md` e ADR-005.

---

## Como funciona (resumo de 30 segundos)

1. Você cria uma tag `vX.Y.Z` no GitHub → o CI builda a imagem e publica no **GHCR** + canal **edge**.
2. Você valida a versão numa máquina de teste (canal edge) e roda o workflow **"Promote to stable"**.
3. Cada máquina da loja roda o **spo-updater** (no boot, via `iniciar.bat`, e às 18h30 via Tarefa Agendada):
   lê `deploy/stable.json` → se há versão nova: **backup → pull → up → healthcheck**; se o health
   falhar, **rollback automático** para a versão anterior. Sem internet = continua na versão atual.

Estado local da máquina: versão pinada em `.env` (`SPO_VERSION=...`) · log em `deploy/updates.log`.

---

## 1. Primeira release (bootstrap — fazer UMA vez)

1. Commitar/mergear tudo em `main` (incluindo os arquivos de GitOps).
2. Criar a tag e empurrar:
   ```bash
   git tag v1.1.0 && git push origin v1.1.0
   ```
3. Acompanhar o workflow **Release** no GitHub Actions (builda e publica `ghcr.io/gustavomot4/spo:v1.1.0` + atualiza `deploy/edge.json`).
4. **Tornar o package público** (uma vez só): GitHub → perfil → *Packages* → `spo` → *Package settings* → *Change visibility* → **Public**. Sem isso, as lojas não conseguem `pull` anônimo.
5. Testar numa máquina com canal edge (ver §3), depois rodar **Actions → "Promote to stable" → version `v1.1.0`, breaking `false`**.
6. Em cada máquina da loja:
   - garantir que o projeto está atualizado (`git pull` ou copiar a pasta nova);
   - rodar `deploy\instalar-atualizacao-automatica.bat` **como administrador** (uma vez);
   - abrir o sistema pelo `iniciar.bat` normalmente. Pronto — dali em diante é automático.

## 2. Release de rotina

```bash
# 1. mergear em main
# 2. atualizar a versão no package.json (mesma da tag) e commitar
git tag v1.2.0 && git push origin v1.2.0
# 3. validar em edge → Actions → "Promote to stable" (version=v1.2.0, breaking=false/true)
```

**Quando marcar `breaking=true`:** a release contém migration que a versão ANTERIOR não consegue
ler (removeu/renomeou coluna ou tabela). Política padrão é **não** fazer isso (expand/contract —
plano §8): adicione na release N, remova só na N+1, e `breaking` quase nunca será necessário.

## 3. Máquina de teste no canal edge

Na máquina de teste (NUNCA na loja): criar o arquivo `deploy\channel` com o conteúdo `edge`.
Ela passa a acompanhar `deploy/edge.json` (toda release, antes da promoção). Para voltar: apagar o arquivo.

## 4. Rollback manual (quando o automático não bastar)

```bat
:: na máquina, na pasta do projeto:
:: 1. editar .env →  SPO_VERSION="vX.Y.(Z-1)"   (versão anterior)
docker compose up -d
:: 2. conferir: http://localhost:3000/api/health → {"ok":true,"version":"..."}
```
Para **despromover** para todas as máquinas: rodar "Promote to stable" com a versão anterior
(ela precisa estar no edge.json — se não estiver, editar `deploy/stable.json` via PR com a versão/digest antigos).

## 5. Restaurar o banco (último recurso)

O updater cria `backups\spo_preupdate_<versão>_<data>.db` antes de TODA atualização
(além dos backups diários 17h50). Para restaurar:

```bat
docker compose stop spo
docker run --rm -v spo-pimenta-ousada-data:/data -v "%cd%\backups:/backups" alpine:3.19 ^
  sh -c "cp /backups/ARQUIVO_ESCOLHIDO.db /data/spo.db && rm -f /data/spo.db-wal /data/spo.db-shm"
docker compose up -d
```

## 6. Diagnóstico rápido

| Sintoma | Onde olhar |
|---|---|
| "Atualizou ou não?" | `deploy\updates.log` (toda decisão é logada) e `http://localhost:3000/api/health` (campo `version`) |
| Update não acontece | Internet? `deploy/stable.json` no GitHub mudou? Tarefa agendada existe (`schtasks /Query /TN "SPO Atualizacao Automatica"`)? |
| `compose pull` falha | Package `spo` está público no GHCR? Tag existe? |
| Health falhou e fez rollback | Investigar a release antes de repromorer: `docker logs spo-pimenta-ousada` na máquina de teste |
| Máquina muito antiga (abaixo de `minSupported`) | Atualização assistida: atualizar manualmente para uma versão intermediária e deixar o updater seguir |

## 7. Pendências conhecidas (registradas no backlog)

- **GITOPS-010**: paridade Linux do updater (`spo-updater.sh` + gancho no `iniciar.sh`). Hoje o
  Linux roda o compose por imagem normalmente, mas sem auto-update.
- **GITOPS-011 (P3)**: assinatura de imagem (cosign) e notificação de update.
- O `docker-compose.dev.yml` é o caminho de build local (dev/bootstrap):
  `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`.
