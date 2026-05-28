// =============================================================================
// session.ts — Configuração da sessão PIN via iron-session
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// Uso:
//   import { getIronSession } from 'iron-session'
//   import { sessionOptions, type SessionData } from '@/lib/session'
//   const session = await getIronSession<SessionData>(req, res, sessionOptions)
// =============================================================================

import type { SessionOptions } from 'iron-session'

export interface SessionData {
  isPinVerified?: boolean
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? 'spo-secret-local-dev-32-chars-min!!',
  cookieName: 'spo_pin_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60, // 8 horas
    httpOnly: true,
    sameSite: 'lax',
  },
}
