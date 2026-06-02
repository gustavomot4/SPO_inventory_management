// =============================================================================
// api/auth/status/route.ts — Verificar status da sessao PIN
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// GET /api/auth/status
//   -> 200 { authenticated: boolean }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, type SessionData } from '@/lib/session'

export async function GET(request: NextRequest) {
  // QA-047: reutilizar a mesma response para que Set-Cookie headers de sessao
  // nao sejam perdidos caso iron-session precise escrever headers (ex: renovacao de TTL)
  const response = NextResponse.json({ authenticated: false })
  const session = await getIronSession<SessionData>(request, response, sessionOptions)
  // Retornar nova response mas propagando os headers da sessao
  return NextResponse.json(
    { authenticated: session.isPinVerified === true },
    { headers: response.headers }
  )
}
