// =============================================================================
// api/auth/logout/route.ts — Encerrar sessão PIN
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// POST /api/auth/logout
//   → 200 { ok: true }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, type SessionData } from '@/lib/session'

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true })
  const session = await getIronSession<SessionData>(request, response, sessionOptions)
  session.destroy()
  return response
}
