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
