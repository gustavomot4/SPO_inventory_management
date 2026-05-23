// =============================================================================
// POST /api/auth/logout — Destruir sessão PIN
// SPO — Sistema Pimenta Ousada | MVP-005
// =============================================================================

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/pin-auth'
import type { ApiSuccess } from '@/types'

export async function POST(): Promise<NextResponse> {
  const session = await getSession()
  session.destroy()

  return NextResponse.json<ApiSuccess<{ message: string }>>({
    data: { message: 'Sessão encerrada com sucesso' },
  })
}
