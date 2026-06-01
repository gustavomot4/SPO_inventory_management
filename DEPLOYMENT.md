# Deployment — SPO Sistema Pimenta Ousada

Guia técnico de implantação. Para o guia da usuária final, use `guia_dona_da_loja.docx`.

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
chmod +x iniciar.sh
./iniciar.sh
```

O `iniciar.bat` / `iniciar.sh`:
- Verifica se Docker está instalado e em execução
- Detecta primeira execução (abre tela de progresso no browser)
- Executa `docker compose up -d --build`
- Abre `http://localhost:3000` automaticamente

Para encerrar: execute `parar.bat` (Windows) ou `docker compose down`.

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

**Serviço de backup:** `spo-backup` (Alpine 3.19) sobe junto com o sistema. Acessa o volume em modo read-only, nunca interfere com o sistema principal.

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

Definidas em `docker-compose.yml`. Para produção real (exposto na internet), altere:

| Variável | Padrão | Descrição |
|---|---|---|
| `DATABASE_URL` | `file:/data/spo.db` | Caminho do banco SQLite dentro do container |
| `SESSION_SECRET` | `spo-pimenta-ousada-local-secret-...` | Segredo da sessão iron-session. **Trocar em produção.** Gerar com `openssl rand -base64 32` |
| `NODE_ENV` | `production` | Ambiente de execução |
| `PORT` | `3000` | Porta do servidor Next.js |
| `HOSTNAME` | `0.0.0.0` | Necessário para o container responder ao port mapping do Docker |

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

# Rebuild forçado (após mudanças no código)
docker compose up -d --build

# Ver status dos containers
docker compose ps

# Abrir Prisma Studio (requer Node.js local)
npx prisma studio
```

---

## Atualizar o Sistema

Para entregar uma nova versão na máquina da cliente:

```bash
# Na máquina da cliente
git pull
docker compose up -d --build
```

O `--build` reconstrói a imagem com as novas alterações. O volume de dados não é afetado.

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
├── Dockerfile                  # Build multi-stage: deps → builder → runner
├── docker-compose.yml          # Serviço, portas, volume, env vars
├── docker-entrypoint.sh        # migrate deploy + node server.js
├── .dockerignore               # Exclui node_modules, .next, banco local, .env
├── .gitattributes              # Garante LF em .sh (evita CRLF quebrando Linux)
├── iniciar.bat                 # Launcher Windows (detecta Docker, abre browser)
├── iniciar.sh                  # Launcher Linux/Mac
├── parar.bat                   # Encerra containers (docker compose down)
├── loading.html                # Tela de carregamento — reinício (~15s)
├── loading_primeira_vez.html   # Tela de carregamento — primeira vez (~10min)
├── next.config.mjs             # output: 'standalone' (obrigatório para Docker)
├── prisma/
│   ├── schema.prisma           # Schema v2.4 — binaryTargets inclui linux-musl-openssl-3.0.x
│   └── migrations/             # Histórico de migrations SQL
└── src/
    ├── app/                    # Next.js App Router (páginas + API routes)
    └── lib/
        └── session.ts          # iron-session — usa SESSION_SECRET do env
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

Ver `decisoes_arquitetura.md` na pasta de documentação para ADRs completos.
