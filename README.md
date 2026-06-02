# 🌶️ SPO — Sistema Pimenta Ousada

Sistema de gestão de estoque e vendas para a loja **Pimenta Ousada**. Controle de produtos e variações, registro de vendas (dinheiro, PIX, débito, crédito com parcelamento), entradas de estoque, relatórios de estoque e de vendas, tudo protegido por um PIN de acesso.

**Stack:** Next.js 14 (App Router) · TypeScript · Prisma · SQLite · Tailwind CSS · Docker

---

## 🤖 Como este projeto foi feito (vibe coding)

Este é um projeto de **vibe coding**: em vez de escrever o código linha a linha, ele foi construído **descrevendo em linguagem natural o que se queria** e deixando agentes de IA implementarem, com uma pessoa dirigindo e revisando cada etapa.

O processo, bem resumido, foi um pipeline de agentes especializados (os prompts ficam em `77777777_SPO_Project_DOCs/`):

1. **Contexto e planejamento** — definição do que a loja precisava e do plano de build.
2. **Agente de banco de dados** — modelagem do schema Prisma e das migrations.
3. **Agentes de implementação** — APIs, telas e regras de negócio.
4. **Agente de QA (adversarial)** — várias passagens caçando bugs, corrigindo e documentando cada achado (relatórios em `QA_AGENT/`). Até esta versão foram 57 bugs encontrados e corrigidos.

Ou seja: a pessoa atua como **diretor e revisor**, e os agentes fazem o trabalho pesado de código — sempre com verificação (type-check, testes de borda, revisão de segurança) antes de cada entrega.

---

## ▶️ Como rodar

Há **dois modos**. O **modo Docker é o oficial** (recomendado para uso na loja, não exige instalar Node). O **modo Node** é para desenvolvimento.

### Modo 1 — Docker (oficial / produção)

**Pré-requisito:** ter o Docker instalado e em execução.
- **Windows:** instalar o **Docker Desktop** ([docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)) e abri-lo (esperar ficar "Running").
- **Linux:** instalar **Docker Engine + plugin Docker Compose** ([docs.docker.com/engine/install](https://docs.docker.com/engine/install/)).

#### Windows

Dê **duplo clique em `iniciar.bat`**. Na primeira vez ele constrói a imagem (pode levar alguns minutos) e sobe o container.

#### Linux

```bash
chmod +x iniciar.sh
./iniciar.sh
```

#### Comando Docker direto (qualquer sistema)

Equivale ao que os scripts fazem:

```bash
docker compose up -d --build      # construir e iniciar em segundo plano
docker compose logs -f            # acompanhar os logs
docker compose down               # parar o sistema
```

➡️ Acesse **http://localhost:3000**. Os dados (banco SQLite) ficam salvos e **persistem** entre reinícios.

### Modo 2 — Node / npm (desenvolvimento)

**Pré-requisito:** Node.js 20 LTS ([nodejs.org](https://nodejs.org/pt/download)).

#### Windows e Linux (mesmos comandos)

```bash
npm install                    # 1. instalar dependências (primeira vez)
npx prisma migrate deploy      # 2. criar/atualizar o banco
npm run dev                    # 3. iniciar em modo desenvolvimento
```

➡️ Acesse **http://localhost:3000**. Para encerrar: `Ctrl + C` no terminal.

> 🔑 **PIN de acesso:** o PIN padrão é **`1234`** (configurável pela variável `APP_PIN`). A sessão dura 8 horas.

---

## 🧰 Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm start` | Servidor em produção (requer build) |
| `npm run typecheck` | Verifica tipos TypeScript sem compilar |
| `npm run lint` | Executa o ESLint |
| `npm run db:migrate` | Cria e aplica nova migration (dev) |
| `npm run db:migrate:deploy` | Aplica migrations existentes (produção/CI) |
| `npm run db:studio` | Abre o Prisma Studio (UI visual do banco) |
| `npm run db:generate` | Regenera o Prisma Client após mudanças no schema |
| `npm run db:reset` | Recria o banco do zero (⚠️ apaga os dados) |

---

## ⚙️ Variáveis de ambiente

Copie `.env.example` para `.env` (os scripts de inicialização fazem isso automaticamente na primeira vez):

```bash
cp .env.example .env
```

| Variável | Padrão | Descrição |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | Caminho do arquivo SQLite. Em produção, aponte para fora da pasta do projeto (ex.: `file:C:/SPO/dados/spo.db`). |
| `SESSION_SECRET` | *(default de dev)* | Senha usada pelo iron-session para assinar o cookie de sessão. **Defina um valor próprio em produção** (mín. 32 caracteres). Gere com `openssl rand -base64 32`. |
| `APP_PIN` | `1234` | PIN de acesso de 4 dígitos. |
| `NODE_ENV` | `development` | Ambiente de execução (`production` ativa cookie seguro). |

---

## 🔐 Autenticação

Acesso protegido por **PIN de 4 dígitos** via **iron-session** (cookie `spo_pin_session`, HTTP-only, validade de 8 horas). Não há login com usuário/senha nem NextAuth — é um sistema *single-tenant* (uma única loja). O `middleware.ts` protege as rotas de API e as páginas internas; quando o PIN expira, o usuário é redirecionado para a tela de PIN.

---

## 🗂️ Estrutura do projeto

```
SPO_inventory_management/
├── prisma/
│   ├── schema.prisma          # Schema do banco (modelos, índices, triggers)
│   └── migrations/            # Histórico de migrations
├── src/
│   ├── app/
│   │   ├── (app)/             # Páginas internas (protegidas por PIN)
│   │   │   ├── produtos/      # Catálogo, cadastro e edição de produtos
│   │   │   ├── vendas/        # PDV (nova venda) e histórico
│   │   │   ├── estoque/       # Entradas de estoque
│   │   │   ├── relatorios/    # Relatórios de estoque e de vendas
│   │   │   └── configuracoes/ # Loja, PIN e maquininhas de cartão
│   │   ├── api/               # Rotas de API (REST) — auth, products, sales, etc.
│   │   ├── pin/               # Tela de PIN
│   │   └── globals.css        # Estilos globais + Tailwind
│   ├── components/            # Componentes de UI reutilizáveis
│   ├── lib/                   # prisma, session, rate-limit, sku, timezone, utils, enums
│   ├── types/                 # Tipos TypeScript compartilhados
│   └── middleware.ts          # Proteção de rotas por PIN
├── Dockerfile                 # Build multi-stage (node:20-alpine → standalone)
├── docker-compose.yml         # Orquestração do container
├── iniciar.bat                # Launcher para Windows
├── iniciar.sh                 # Launcher para Linux
└── .env.example               # Modelo das variáveis de ambiente
```

---

## 💾 Banco de dados e backup

- **Desenvolvimento:** `dev.db` na raiz do projeto (criado automaticamente).
- **Produção:** aponte `DATABASE_URL` para um caminho **fora** da pasta do projeto, para não ser sobrescrito.

Backup é simplesmente uma cópia do arquivo `.db`:

```bash
# Linux
cp dev.db ~/backups/spo_backup_$(date +%Y%m%d_%H%M%S).db
```

```bat
:: Windows
copy dev.db "%USERPROFILE%\Desktop\spo_backup.db"
```

> ⚠️ Nunca commite o arquivo `.db` (já está no `.gitignore`). Para inspecionar os dados visualmente: `npm run db:studio` (abre em `http://localhost:5555`).

---

## 📐 Convenções de desenvolvimento

- **Dinheiro sempre em centavos (Int):** `R$ 59,90` = `5990`. Nunca usar `Float` para valores monetários. Use `formatCurrency()` / `parseCurrencyToCents()` de `src/lib/utils.ts`.
- **Taxas em basis points (Int):** `1,99%` = `199`.
- **IDs:** `cuid` (string opaca gerada pelo Prisma) — nunca inteiros sequenciais como ID público.
- **Datas:** armazenadas em UTC (ISO 8601); o "dia comercial" da loja usa o fuso fixo de `src/lib/timezone.ts` (UTC−3).
- **TypeScript estrito:** `strict` + `noUncheckedIndexedAccess`. Evitar `any`.
- **Estilo:** Tailwind CSS, mobile-first (viewport mínimo 375px).

---

## 🧪 Tecnologias

| Tecnologia | Versão | Papel |
|---|---|---|
| Next.js | 14.2 | Framework full-stack (App Router) |
| TypeScript | 5.x | Linguagem (modo estrito) |
| Prisma | 5.22 | ORM e migrations |
| SQLite | — | Banco de dados local |
| iron-session | 8.x | Sessão por PIN (cookie HTTP-only) |
| bcryptjs | 2.x | Hash do PIN |
| Tailwind CSS | 3.x | Estilização |
| Docker | — | Empacotamento e execução (node:20-alpine) |
| Node.js | 20 LTS | Runtime |

---

*SPO — Sistema Pimenta Ousada | v0.1.0 | Projeto de vibe coding · 2026*
