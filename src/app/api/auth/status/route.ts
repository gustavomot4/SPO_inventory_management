// =============================================================================
// GET /api/auth/status — Retorna estado da sessão PIN atual
// SPO — Sistema Pimenta Ousada | MVP-005
// =============================================================================
//
// Resposta:
//   isVerified:    true se o PIN foi verificado nesta sessão
//   pinConfigured: true se há PIN definido no banco (Settings.pinHash != null)
//
// Usado pelo frontend para decidir:
//   - Se mostrar o botão "Entrar com PIN" ou "Configurar PIN"
//   - Se bloquear acesso a áreas sensíveis sem redirecionar para /pin
// =============================================================================

import { NextResponse } from 'next/server'
import { isPinVerified, isPinConfigured } from '@/lib/pin-auth'
import type { ApiSuccess } from '@/types'

export type AuthStatusResponse = {
  isVerified: boolean
  pinConfigured: boolean
}

export async function GET(): Promise<NextResponse> {
  const [verified, configured] = await Promise.all([
    isPinVerified(),
    isPinConfigured(),
  ])

  return NextResponse.json<ApiSuccess<AuthStatusResponse>>({
    data: {
      isVerified: verified,
      pinConfigured: configured,
    },
  })
}
