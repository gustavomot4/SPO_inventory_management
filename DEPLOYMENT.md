# Deployment — SPO Sistema Pimenta Ousada

Guia técnico de implantação. Para o guia da usuária final, use `guia_iniciantes_para_rodar_projeto.docx` (em `77777777_SPO_Project_DOCs/`).

---

## Requisitos

| Requisito | Versão mínima | Observação |
|---|---|---|
| Docker Desktop | 4.x | Windows, Mac ou Linux |
| Git | qualquer | Para clonar o repositório |
| Internet | — | Apenas na primeira execução (download das imagens) |

Node.js **não** é necessário na máquina host — tudo roda dentro do container.

---

## Quick Start

```bash
# 1. Clonar o repositório
git clone <url-do-repositorio>
cd SPO_inventory_management

# 2. Iniciar (Windows)
iniciar.bat

# 2. Iniciar (Linux / Mac)
cp .env.example .env
docker compose up -d
```

O `iniciar.bat` (Windows):
- Verifica se Docker está instalado e em execução (inicia o Docker Desktop se necessário)
- Verifica atualizações via GitOps (`deploy/spo-updater.ps1 -Mode boot`) — log em `deploy/updates.log`
- Detecta primeira execução (abre tela de progresso no browser)
- Executa `docker compose up -d` (imagem pré-construída, pinada por `SPO_VERSION`); se o pull falhar, cai para build local com `docker-compose.dev.yml`
- Abre `http://localhost:3000` automaticamente

No Linux/Mac não há launcher Docker dedicado — use os comandos da seção "Arquitetura Docker" abaixo (`iniciar.sh` é um atalho de desenvolvimento em modo Node, não Docker).

Para encerrar: `docker compose down` (com `restart: unless-stopped`, o container volta a subir junto com o Docker Desktop — não é necessário "parar" no dia a dia).

---

## Arquitetura Docker

```
docker compose up
    └── spo-pimenta-ousada (container)
            ├── Next.js 14 (standalone, porta 3000)
            ├── Prisma Client (SQLite)
            └── /data/spo.db  ←──  volume: spo-pimenta-ousada-data
```

**Imagem:** multi-stage build — `deps` → `builder` → `runner` (node:20-alpine)

**Volume:** `spo-pimenta-ousada-data` montado em `/data` dentro do container. O banco persiste entre restarts e atualizações da imagem.

**Serviço de backup:** `spo-backup` (Alpine 3.19) sobe junto com o sistema. Monta o volume do banco em modo read-write — exigido pela Online Backup API do SQLite para ler o WAL/`-shm` (QA-075) — mas a operação `.backup` **não altera** os dados de origem; é um snapshot transacionalmente consistente.

---

## Backup Automático

O serviço `spo-backup` no `docker-compose.yml` gerencia backups automaticamente:

- **Na inicialização** — backup imediato toda vez que `iniciar.bat` é executado
- **Diariamente às 17h50** — cron interno do container (loja fecha às 18h)
- **30 cópias mantidas** — o backup mais antigo é apagado quando o 31º é criado
- **Localização** — pasta `backups/` na raiz do projeto (visível na máquina da cliente)
- **Formato** — `spo_backup_YYYYMMDD_HHMMSS.db`

```bash
# Ver logs do serviço de backup
docker logs spo-backup

# Forçar backup manualmente
docker exec spo-backup /backup.sh
```

> O backup só roda com o computador ligado. Se o PC estiver desligado às 17h50, o backup daquele dia é pulado — mas o backup da próxima inicialização o compensa.

---

## Variáveis de Ambiente

Definidas em `docker-compose.yml` e no `.env` ao lado dele:

| Variável | Padrão | Descrição |
|---|---|---|
| `DATABASE_URL` | `file:/data/spo.db` | Caminho do banco SQLite dentro do container |
| `SESSION_SECRET` | *(gerado automaticamente)* | Segredo da sessão iron-session. **Não é definido no compose** — o `docker-entrypoint.sh` gera um valor aleatório na primeira execução e o persiste em `/data/session_secret` (QA-060), evitando que um segredo versionado permita forjar a sessão do PIN |
| `NODE_ENV` | `production` | Ambiente de execução |
| `PORT` | `3000` | Porta do servidor Next.js |
| `HOSTNAME` | `0.0.0.0` | Necessário para o container responder ao port mapping do Docker |
| `SPO_VERSION` | `v1.1.0` | Tag/digest da imagem `ghcr.io/gustavomot4/spo` a rodar. Gerenciada pelo `spo-updater` (ver "Atualizações Automáticas") — não editar manualmente exceto em rollback (ver RUNBOOK) |

---

## Comandos Úteis

```bash
# Ver logs do container em tempo real
docker logs -f spo-pimenta-ousada

# Entrar no shell do container
docker exec -it spo-pimenta-ousada sh

# Parar sem remover o volume (dados preservados)
docker compose down

# Parar E remover os dados (cuidado!)
docker compose down -v

# Atualizar manualmente para a versão pinada em .env
docker compose pull && docker compose up -d

# Rebuild local (dev / bootstrap, sem imagem publicada ainda)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# Ver status dos containers
docker compose ps

# Abrir Prisma Studio (requer Node.js local)
npx prisma studio
```

---

## Atualizações Automáticas (GitOps)

Desde a v1.1.0 o sistema se atualiza sozinho via **pull do GHCR** — não é necessário `git pull` nem rebuild manual na máquina da loja. Visão geral (detalhes completos em `deploy/RUNBOOK.md`):

1. **CI (`.github/workflows/release.yml`)**: a cada tag `vX.Y.Z`, builda e publica a imagem em `ghcr.io/gustavomot4/spo:vX.Y.Z` (com digest) e atualiza `deploy/edge.json` (canal de testes).
2. **Promoção (`.github/workflows/promote.yml`)**: workflow manual "Promote to stable" copia a versão validada de `edge.json` para `deploy/stable.json` — este é o portão humano antes de qualquer loja receber a versão.
3. **Máquina da loja (`deploy/spo-updater.ps1`)**: roda no boot (via `iniciar.bat`) e diariamente às 18h30 (Tarefa Agendada criada por `deploy/instalar-atualizacao-automatica.bat`). Para cada execução:
   - lê `deploy/stable.json`; se a versão for mais nova que `SPO_VERSION` no `.env`, prossegue;
   - faz **backup do banco** (Online Backup API via `spo-backup`, ou cópia a frio como fallback);
   - `docker compose pull && docker compose up -d` com a nova versão;
   - aguarda `GET /api/health` responder `ok: true` por até 120s;
   - **sucesso** → grava a nova versão em `.env` e mantém a imagem anterior (retenção N−1);
   - **falha** → rollback automático para a versão anterior; se a release for `breaking: true`, também restaura o backup do banco.
4. **Offline**: sem internet, o updater desiste em ~5s e o sistema sobe normalmente na versão atual (preserva o requisito de funcionamento local — RT-001).

Rollback manual, restauração de backup e troubleshooting: ver `deploy/RUNBOOK.md`.

---

## Publicar uma Nova Versão (para devs)

A entrega às lojas é automática (seção anterior). Para **publicar** uma nova versão:

```bash
# 1. Atualizar a versão em package.json (SemVer)
# 2. Commitar e criar a tag
git tag v1.2.0
git push origin main --tags
```

A tag dispara `.github/workflows/release.yml`, que builda, publica a imagem no GHCR e atualiza `deploy/edge.json`. Depois de validar no canal edge, rode o workflow manual **"Promote to stable"** para liberar a versão às lojas. Migrations devem seguir a política *expand/contract* (aditivas primeiro; remoções só numa release seguinte) — ver `deploy/RUNBOOK.md` e ADR-005.

---

## Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Criar .env a partir do exemplo
cp .env.example .env

# Aplicar migrations
npx prisma migrate deploy

# Gerar Prisma Client
npx prisma generate

# Iniciar em modo dev (hot reload)
npm run dev

# Verificar tipos TypeScript
npm run typecheck

# Build de produção (testa o mesmo processo do Docker)
npm run build && npm start
```

O `.env` local usa `DATABASE_URL="file:./prisma/dev.db"`. O Docker usa `file:/data/spo.db` (volume persistente).

---

## Estrutura de Arquivos Relevantes

```
SPO_inventory_management/
├── Dockerfile                  # Build multi-stage: deps → builder → runner (ARG/ENV SPO_VERSION)
├── docker-compose.yml          # Serviço, portas, volume, env vars — image: pinada por SPO_VERSION
├── docker-compose.dev.yml      # Override de build local (dev / bootstrap)
├── docker-entrypoint.sh        # gera SESSION_SECRET + migrate deploy + node server.js
├── .dockerignore               # Exclui node_modules, .next, banco local, .env
├── .gitattributes              # Garante LF em .sh (evita CRLF quebrando Linux)
├── iniciar.bat                 # Launcher Windows (Docker + verificação de atualização + abre browser)
├── iniciar.sh                  # Atalho de desenvolvimento em modo Node (Linux/Mac)
├── loading.html                # Tela de carregamento — reinício (~15s)
├── loading_primeira_vez.html   # Tela de carregamento — primeira vez (~10min)
├── next.config.mjs             # output: 'standalone' (obrigatório para Docker)
├── deploy/
│   ├── edge.json               # Manifesto do canal de testes (CI)
│   ├── stable.json             # Manifesto do canal das lojas (promoção manual)
│   ├── spo-updater.ps1         # Agente de atualização GitOps
│   ├── instalar-atualizacao-automatica.bat  # Cria a Tarefa Agendada (18h30)
│   └── RUNBOOK.md               # Guia operacional
├── .github/workflows/
│   ├── release.yml             # build + push GHCR + atualiza edge.json
│   └── promote.yml             # "Promote to stable" (manual)
├── prisma/
│   ├── schema.prisma           # Schema v2.4 — binaryTargets inclui linux-musl-openssl-3.0.x
│   └── migrations/             # Histórico de migrations SQL
└── src/
    ├── app/
    │   └── api/health/route.ts # GET /api/health — { ok, version } usado pelo updater
    └── lib/
        └── session.ts          # iron-session — usa SESSION_SECRET do env (gerado pelo entrypoint)
```

---

## Troubleshooting

### Container inicia mas `localhost:3000` não responde
Verifique se `HOSTNAME: "0.0.0.0"` está no `docker-compose.yml`. Sem isso o Next.js escuta só em `127.0.0.1` dentro do container e o port mapping não funciona.

### `exec ./docker-entrypoint.sh: no such file or directory`
O script tem CRLF (Windows). O Dockerfile já aplica `sed -i 's/\r$//'` automaticamente. Se persistir, verifique que o `.gitattributes` está sendo respeitado: `git check-attr eol docker-entrypoint.sh`.

### Prisma: `libssl.so.1.1: No such file or directory`
O `schema.prisma` precisa ter `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` e o Dockerfile deve ter `apk add --no-cache openssl` nos estágios `builder` e `runner`.

### Build falha por ESLint (`no-unused-vars`)
Variáveis não usadas bloqueiam o build em produção. Remova o import/variável ou adicione `// eslint-disable-next-line @typescript-eslint/no-unused-vars` na linha anterior.

### `where docker` falha no `iniciar.bat` mesmo com Docker instalado
O `iniciar.bat` já faz fallback para os caminhos padrão do Docker Desktop. Se ainda falhar, adicione `C:\Program Files\Docker\Docker\resources\bin` ao PATH do sistema manualmente.

### Dados não persistem após `docker compose down -v`
O flag `-v` remove o volume. Use apenas `docker compose down` (sem `-v`) para preservar os dados.

---

## Decisões Arquiteturais Relevantes

| Decisão | Escolha | Motivo |
|---|---|---|
| Runtime de entrega | Docker Desktop | Reprodutibilidade — Node.js direto depende do ambiente da máquina |
| Banco de dados | SQLite via Prisma | MVP local — migração para PostgreSQL via troca de `DATABASE_URL` |
| Autenticação | PIN via iron-session | Sem contas de usuário — loja operada por uma pessoa |
| Build | Next.js standalone | Minimiza imagem Docker — não precisa de `node_modules` completo no runner |
| Line endings | LF forçado via `.gitattributes` | Scripts `.sh` quebram no Linux com CRLF (Windows default) |
| Distribuição de atualizações | GitOps pull-based (CI → GHCR → manifestos → `spo-updater`) | Loja sem visita técnica, sem build na máquina, com backup/health/rollback automáticos — ADR-005 |

Ver `decisoes_arquitetura.md` na pasta de documentação para ADRs completos.
