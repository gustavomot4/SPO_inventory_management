// =============================================================================
// prisma/seed.ts — Seed inicial do banco de dados SPO
// SPO — Sistema Pimenta Ousada | MVP-005
// =============================================================================
//
// Executar com: npx ts-node prisma/seed.ts
// Ou via npm:   npm run db:seed
//
// Este seed é idempotente (upsert): pode ser executado múltiplas vezes
// sem duplicar dados ou sobrescrever configurações existentes.
//
// O que este seed cria:
//   - Settings singleton (id = 'singleton'): configurações do sistema sem PIN inicial
//
// NOTA: As categorias padrão e maquininhas de exemplo NÃO são criadas aqui —
// a dona configurará isso pela interface. Apenas o registro obrigatório
// de Settings (necessário para que /api/auth/status funcione).
// =============================================================================

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['error'],
})

async function main() {
  console.log('🌶️  Iniciando seed do banco de dados SPO...')

  // ---------------------------------------------------------------------------
  // Settings singleton — obrigatório para o sistema funcionar
  // id = 'singleton' é o identificador fixo do único registro de configurações
  // pinHash = null → sistema aberto (sem PIN) até a dona configurar um
  // ---------------------------------------------------------------------------
  const settings = await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: {
      // Não sobrescrever shopName ou pinHash se já foram configurados
      // (upsert sem campos no update mantém os valores existentes)
    },
    create: {
      id: 'singleton',
      shopName: 'Pimenta Ousada',
      pinHash: null, // sem PIN inicial — RN-007.6
    },
  })

  console.log(`✅ Settings singleton: id=${settings.id}, shopName="${settings.shopName}", pinHash=${settings.pinHash ? '[configurado]' : 'null (acesso livre)'}`)

  console.log('\n✅ Seed concluído com sucesso.')
  console.log('   → Para configurar o PIN, use a tela de Configurações após iniciar o sistema.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Erro no seed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
