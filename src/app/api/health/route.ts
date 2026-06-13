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

// GITOPS-001: a versao vem do build da imagem (Dockerfile ARG SPO_VERSION,
// injetado pelo CI na release). Fora do Docker (dev), cai em 'dev'.
// O spo-updater usa este campo para confirmar que a versao alvo subiu.
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    version: process.env.SPO_VERSION ?? 'dev',
  })
}
