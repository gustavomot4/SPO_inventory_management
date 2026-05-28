// =============================================================================
// api/auth/status/route.ts — Verificar status da sessão PIN
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// GET /api/auth/status
//   → 200 { authenticated: boolean }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, type SessionData } from '@/lib/session'

export async function GET(request: NextRequest) {
  const response = NextResponse.json({ authenticated: false })
  const session = await getIronSession<SessionData>(request, response, sessionOptions)
  return NextResponse.json({ authenticated: session.isPinVerified === true })
}
