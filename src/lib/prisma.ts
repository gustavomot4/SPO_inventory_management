import { PrismaClient } from '@prisma/client'

// Singleton do PrismaClient — evita múltiplas conexões em dev (hot reload)
// Ref: https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices

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

// QA-002: PRAGMA foreign_keys = ON — SQLite desativa FKs por padrão, Prisma não ativa.
// QA-011: WAL mode = leituras não bloqueiam escritas (múltiplas abas abertas).
//         busy_timeout = aguarda lock em vez de retornar SQLITE_BUSY imediatamente.
if (process.env.DATABASE_URL) {
  prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON').catch(() => {})
  prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL').catch(() => {})
  prisma.$executeRawUnsafe('PRAGMA busy_timeout = 5000').catch(() => {})
}
