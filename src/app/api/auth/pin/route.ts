// =============================================================================
// api/auth/pin/route.ts -- Verificacao de PIN
// SPO -- Sistema Pimenta Ousada
// =============================================================================
//
// POST /api/auth/pin
//   body: { pin: string }
//   -> 200 { ok: true }  se PIN correto
//   -> 401 { error: 'PIN incorreto' }
//
// Logica de verificacao (SEC-001):
//   1. Se Settings.pinHash existir no banco -> verificar com bcrypt
//   2. Senao -> fallback para APP_PIN do .env (padrao: "1234")
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { sessionOptions, type SessionData } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { pin?: string }
    const { pin } = body

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json({ error: 'PIN obrigatorio' }, { status: 400 })
    }

    const settings = await prisma.settings.findFirst({
      select: { pinHash: true },
    })

    let isValid = false

    if (settings?.pinHash) {
      // PIN definido via interface -- verificar com bcrypt
      isValid = await bcrypt.compare(pin, settings.pinHash)
    } else {
      // Fallback: usar APP_PIN do .env (padrao: '1234')
      const appPin = process.env.APP_PIN ?? '1234'
      isValid = pin === appPin
    }

    if (!isValid) {
      return NextResponse.json({ error: 'PIN incorreto' }, { status: 401 })
    }

    // PIN correto -- criar sessao
    const response = NextResponse.json({ ok: true })
    const session = await getIronSession<SessionData>(request, response, sessionOptions)
    session.isPinVerified = true
    await session.save()

    return response
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
