import { PrismaClient } from '@prisma/client'

// Singleton do PrismaClient para evitar múltiplas conexões em desenvolvimento (hot reload)
// Em produção, o módulo é carregado uma única vez e o singleton não é necessário,
// mas é mantido para consistência entre ambientes.
//
// Referência: https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices

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

// QA-002: Ativar foreign keys (SQLite desativa por padrão — Prisma não ativa automaticamente)
// QA-011: WAL mode para leituras concorrentes sem bloquear escritas
//         busy_timeout para aguardar lock em vez de retornar SQLITE_BUSY imediatamente
//
// Executado apenas quando DATABASE_URL está disponível (runtime).
// Durante o build do Next.js DATABASE_URL não existe — os PRAGMAs seriam executados
// novamente pelo entrypoint em runtime de qualquer forma.
if (process.env.DATABASE_URL) {
  prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON').catch(() => {})
  prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL').catch(() => {})
  prisma.$executeRawUnsafe('PRAGMA busy_timeout = 5000').catch(() => {})
}
