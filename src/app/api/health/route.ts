// =============================================================================
// GET /api/health — healthcheck do container (QA-083)
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// O healthcheck do docker-compose.yml testa `wget /api/health` e só caía no
// fallback `wget /` porque esta rota não existia. Agora o caminho primário
// responde de verdade. Rota pública (fora do matcher do middleware) e leve —
// não toca o banco para não derrubar o healthcheck por um lock transitório.
// =============================================================================

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true })
}
