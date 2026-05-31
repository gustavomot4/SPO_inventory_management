# 🌶️ SPO — Sistema Pimenta Ousada

Sistema de gestão de estoque para a loja **Pimenta Ousada**, desenvolvido com Next.js 14, TypeScript, Prisma ORM e SQLite. Roda localmente via Docker Desktop — sem necessidade de instalar Node.js na máquina.

---

## Início Rápido

### Pré-requisito único: [Docker Desktop](https://www.docker.com/products/docker-desktop/)

```bash
# Windows — duplo clique ou:
iniciar.bat

# Linux / Mac
chmod +x iniciar.sh && ./iniciar.sh
```

O sistema abre automaticamente em **http://localhost:3000**.

Para encerrar: execute `parar.bat` (Windows) ou `docker compose down`.

> **Guia completo para a usuária final:** `guia_dona_da_loja.docx`
> **Guia técnico de deployment:** `DEPLOYMENT.md`

---

## Funcionalidades

- **Cadastro de produtos** com variações (tamanho, cor), SKU automático e preço de custo
- **Controle de estoque** com alertas de nível mínimo e histórico de entradas
- **PDV (ponto de venda)** com desconto, parcelamento e múltiplas maquininhas de cartão
- **Comanda térmica 80mm** via `window.print()` com dados da loja configuráveis
- **Relatórios** de estoque e vendas com gráficos, lucro estimado e margem
- **Autenticação por PIN** com bcrypt — sem cadastro de usuários
- **Responsivo** — funciona em celular (375px+) e desktop

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router) |
| Linguagem | TypeScript (strict) |
| ORM | Prisma 5.x |
| Banco de dados | SQLite (MVP) → PostgreSQL (produção futura) |
| Estilização | Tailwind CSS (mobile-first) |
| Autenticação | iron-session + PIN bcrypt |
| Runtime | Node.js 20-alpine (Docker) |
| Infra | Docker Desktop, docker compose |

---

## Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Configurar ambiente
cp .env.example .env

# Aplicar migrations e gerar Prisma Client
npx prisma migrate deploy
npx prisma generate

# Iniciar em modo dev (hot reload)
npm run dev
```

Acesse: `http://localhost:3000`

### Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com hot reload |
| `npm run build` | Build de produção (testa o mesmo processo do Docker) |
| `npm start` | Inicia em modo produção (requer build) |
| `npm run typecheck` | Verifica tipos TypeScript |
| `npm run lint` | Executa ESLint |
| `npm run db:migrate` | Cria e aplica nova migration |
| `npm run db:migrate:deploy` | Aplica migrations existentes |
| `npm run db:studio` | Abre Prisma Studio em localhost:5555 |
| `npm run db:generate` | Regenera Prisma Client |

---

## Estrutura do Projeto

```
SPO_inventory_management/
├── Dockerfile                  # Build multi-stage (deps → builder → runner)
├── docker-compose.yml          # Serviço, porta 3000, volume do banco
├── docker-entrypoint.sh        # migrate deploy + node server.js
├── iniciar.bat / iniciar.sh    # Launchers (detectam Docker, abrem browser)
├── parar.bat                   # Encerra containers
├── loading.html                # Tela de carregamento — reinício rápido
├── loading_primeira_vez.html   # Tela de carregamento — primeiro build
├── guia_dona_da_loja.docx      # Guia de uso para a usuária final
├── DEPLOYMENT.md               # Guia técnico de implantação
├── prisma/
│   ├── schema.prisma           # Schema v2.4 (SQLite, binaryTargets Alpine)
│   └── migrations/             # Histórico de migrations SQL
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (app)/              # Rotas protegidas (autenticação PIN)
│   │   │   ├── estoque/        # Estoque atual + entradas
│   │   │   ├── produtos/       # Cadastro de produtos e variações
│   │   │   ├── vendas/         # PDV + histórico + detalhe
│   │   │   ├── relatorios/     # Estoque e vendas com gráficos
│   │   │   └── configuracoes/  # Maquininhas, categorias, PIN, comanda
│   │   ├── api/                # API Routes (REST)
│   │   └── pin/                # Tela de autenticação PIN
│   └── lib/
│       ├── prisma.ts           # Singleton PrismaClient
│       ├── session.ts          # iron-session (SESSION_SECRET)
│       └── utils.ts            # formatCurrency, helpers
└── db/
    ├── schema.prisma           # Schema de referência (documentação)
    └── SCHEMA_DESIGN.md        # Decisões de design do banco
```

---

## Banco de Dados

- **Docker (produção):** `/data/spo.db` dentro do container, persistido no volume `spo-pimenta-ousada-data`
- **Desenvolvimento local:** `prisma/dev.db` (criado automaticamente, não commitado)
- **Backup:** execute `backup.bat` (Windows) para copiar o banco para a pasta `backups/`

Para visualizar o banco em modo dev:
```bash
npx prisma studio   # abre em http://localhost:5555
```

---

## Convenções

- **Preços:** sempre em centavos (`Int`). `R$ 59,90` = `5990`. Use `formatCurrency()` de `src/lib/utils.ts`.
- **Taxas:** em basis points (`Int`). `1,99%` = `199`.
- **IDs:** `cuid()` — string opaca, nunca inteiro sequencial como ID público.
- **Timestamps:** `String` com ISO 8601 via `dbgenerated(strftime(...))` — compatível com Prisma 5 + SQLite.
- **Enums:** `String` na camada de banco — validação feita na API. Ver `src/lib/enums.ts`.

---

*SPO — Sistema Pimenta Ousada | v1.0.0 | Produção local via Docker | 2026*
