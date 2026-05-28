// =============================================================================
// api/auth/pin/route.ts — Verificação de PIN
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// POST /api/auth/pin
//   body: { pin: string }
//   → 200 { ok: true }  se PIN correto
//   → 401 { error: 'PIN incorreto' }
//
// O PIN é definido via variável de ambiente APP_PIN (padrão: "1234").
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, type SessionData } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { pin?: string }
    const { pin } = body

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json({ error: 'PIN obrigatório' }, { status: 400 })
    }

    const correctPin = process.env.APP_PIN ?? '1234'

    if (pin !== correctPin) {
      return NextResponse.json({ error: 'PIN incorreto' }, { status: 401 })
    }

    // PIN correto — criar sessão
    const response = NextResponse.json({ ok: true })
    const session = await getIronSession<SessionData>(request, response, sessionOptions)
    session.isPinVerified = true
    await session.save()

    return response
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
