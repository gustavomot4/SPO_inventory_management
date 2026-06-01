import { PrismaClient } from '@prisma/client'

// Singleton do PrismaClient — evita multiplas conexoes em dev (hot reload)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// QA-002: PRAGMA foreign_keys = ON — SQLite desativa FKs por padrao, Prisma nao ativa.
// QA-011: WAL mode = leituras nao bloqueiam escritas (multiplas abas abertas).
//         busy_timeout = aguarda lock em vez de retornar SQLITE_BUSY imediatamente.
// QA-037: falhas de PRAGMA sao logadas — silenciar era perigoso (FKs desativadas sem aviso).
// QA-038: usar $executeRaw (template literal) em vez de $executeRawUnsafe com strings.
if (process.env.DATABASE_URL) {
  Promise.all([
    prisma.$executeRaw`PRAGMA foreign_keys = ON`,
    prisma.$executeRaw`PRAGMA journal_mode = WAL`,
    prisma.$executeRaw`PRAGMA busy_timeout = 5000`,
  ]).catch((err) => {
    console.error('[SPO] Falha ao configurar PRAGMAs do SQLite — integridade do banco pode estar comprometida:', err)
  })
}
