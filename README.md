# 🌶️ SPO — Sistema Pimenta Ousada

Sistema de gestão de estoque para a loja **Pimenta Ousada**, desenvolvido com Next.js 14, TypeScript, Prisma e SQLite.

---

## Requisitos

- **Node.js 20 LTS** ou superior — [nodejs.org](https://nodejs.org/pt/download)
- **npm** (vem junto com o Node.js)
- Windows 11 ou Linux

---

## Iniciando o sistema

### Windows

Dê duplo clique em `iniciar.bat` ou execute no terminal:

```bat
iniciar.bat
```

### Linux / Mac

```bash
chmod +x iniciar.sh
./iniciar.sh
```

O sistema ficará disponível em: **http://localhost:3000**

---

## Iniciando manualmente (desenvolvedores)

```bash
# 1. Instalar dependências
npm install

# 2. Criar o banco de dados (primeira execução)
npx prisma migrate deploy

# 3. Iniciar o servidor de desenvolvimento
npm run dev
```

---

## Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Gera o build de produção |
| `npm start` | Inicia o servidor em modo produção (requer build) |
| `npm run typecheck` | Verifica tipos TypeScript sem compilar |
| `npm run lint` | Executa o linter ESLint |
| `npm run db:migrate` | Cria e aplica nova migration (desenvolvimento) |
| `npm run db:migrate:deploy` | Aplica migrations existentes (produção/CI) |
| `npm run db:studio` | Abre o Prisma Studio (UI visual do banco) |
| `npm run db:generate` | Regenera o Prisma Client após mudanças no schema |

---

## Estrutura do projeto

```
SPO_inventory_management/
├── db/                    # Documentação do banco de dados (Database Agent)
│   ├── schema.prisma      # Schema de referência
│   └── SCHEMA_DESIGN.md   # Decisões de design do banco
├── prisma/
│   ├── schema.prisma      # Schema usado pelo Prisma CLI
│   └── migrations/        # Histórico de migrations (gerado automaticamente)
├── src/
│   ├── app/               # Next.js App Router (páginas e layouts)
│   │   ├── layout.tsx     # Layout raiz da aplicação
│   │   ├── page.tsx       # Página inicial
│   │   └── globals.css    # Estilos globais + Tailwind
│   ├── lib/
│   │   ├── prisma.ts      # Singleton do PrismaClient
│   │   └── utils.ts       # Funções utilitárias (formatação de moeda, datas)
│   └── types/
│       └── index.ts       # Tipos TypeScript compartilhados
├── .env                   # Variáveis de ambiente locais (não commitado)
├── .env.example           # Modelo das variáveis de ambiente (commitado)
├── iniciar.bat            # Script de inicialização para Windows
├── iniciar.sh             # Script de inicialização para Linux/Mac
└── dev.db                 # Banco de dados SQLite (não commitado)
```

---

## Banco de dados

### Localização do arquivo

- **Desenvolvimento:** `dev.db` na raiz do projeto (criado automaticamente)
- **Produção:** configurar `DATABASE_URL` no `.env` para um caminho **fora** da pasta do projeto, ex: `file:C:/SPO/dados/spo.db`

> ⚠️ O arquivo `dev.db` não deve ser commitado no Git (já no `.gitignore`).
> Nunca sobrescreva o banco de produção com `git pull`.

### Backup manual

Copie o arquivo `.db` para um local seguro:

```bat
:: Windows — copiar para área de trabalho
copy dev.db "%USERPROFILE%\Desktop\spo_backup_%date:~-4,4%%date:~-7,2%%date:~0,2%.db"
```

```bash
# Linux
cp dev.db ~/backups/spo_backup_$(date +%Y%m%d_%H%M%S).db
```

### Visualizando o banco

```bash
npx prisma studio
```

Abre uma interface web em `http://localhost:5555` para visualizar e editar registros diretamente.

---

## Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste se necessário:

```bash
cp .env.example .env
```

| Variável | Padrão | Descrição |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | Caminho para o arquivo SQLite |
| `NEXTAUTH_SECRET` | *(ver .env.example)* | Segredo para tokens de sessão |
| `NEXTAUTH_URL` | `http://localhost:3000` | URL base da aplicação |
| `NODE_ENV` | `development` | Ambiente de execução |

---

## Convenções de desenvolvimento

- **Preços:** sempre em centavos (Int). `R$ 59,90` = `5990`. Use `formatCurrency()` de `src/lib/utils.ts` para exibição.
- **IDs:** cuid (string opaco gerado pelo Prisma). Nunca usar inteiros sequenciais como ID público.
- **Tipos:** `any` é proibido. Usar tipos do Prisma via `import type { User } from '@prisma/client'`.
- **Banco de dados:** todas as chamadas ao Prisma vão em `src/repositories/`. Nunca chamar `prisma` diretamente em páginas ou actions.
- **Estilização:** Tailwind CSS, mobile-first. Viewport mínimo suportado: 375px (iPhone SE).

---

## Tecnologias

| Tecnologia | Versão | Papel |
|---|---|---|
| Next.js | 14+ | Framework full-stack (App Router) |
| TypeScript | 5.x | Linguagem (strict mode) |
| Tailwind CSS | 3.x | Estilização mobile-first |
| Prisma | 5.x | ORM e migrations |
| SQLite | — | Banco de dados local (MVP) |
| Node.js | 20 LTS | Runtime |

---

*SPO — Sistema Pimenta Ousada | MVP v0.1.0 | 2026*
