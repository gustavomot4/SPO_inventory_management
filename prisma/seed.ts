// =============================================================================
// prisma/seed.ts — Seed idempotente do banco SPO
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// QA-076: este arquivo era referenciado em package.json (db:seed / prisma.seed)
// mas estava ausente — `prisma migrate dev/reset` e `db:seed` quebravam.
//
// Idempotente: pode rodar quantas vezes quiser sem duplicar dados.
//   - Settings: garante o singleton (mesma logica do app — 1 linha autoritativa).
//   - Categorias: garante um conjunto inicial via upsert no `name` (unico).
//
// NAO cria PIN: o sistema e aberto por padrao (RN-007.2) e a dona define o PIN
// quando quiser. NAO cria produtos/vendas — dados reais entram pela aplicacao.
//
// Producao NAO roda seed (docker-entrypoint usa `prisma migrate deploy`).
// =============================================================================

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_CATEGORIES = ['Blusas', 'Vestidos', 'Calcas', 'Saias', 'Acessorios']

async function main() {
  // --- Settings singleton (idempotente) ---
  const existing = await prisma.settings.findFirst({ orderBy: { id: 'asc' } })
  if (!existing) {
    await prisma.settings.create({ data: { shopName: 'Pimenta Ousada' } })
    console.log('[seed] Settings singleton criado (shopName: "Pimenta Ousada").')
  } else {
    console.log('[seed] Settings ja existe — preservado.')
  }

  // --- Categorias padrao (idempotente via @unique em name) ---
  for (const name of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }
  console.log(`[seed] ${DEFAULT_CATEGORIES.length} categorias padrao garantidas.`)

  console.log('[seed] Concluido.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error('[seed] Erro ao executar o seed:', error)
    await prisma.$disconnect()
    process.exit(1)
  })
