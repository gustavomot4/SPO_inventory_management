// =============================================================================
// session.ts — Configuração da sessão PIN via iron-session
// SPO — Sistema Pimenta Ousada
// =============================================================================

import type { SessionOptions } from 'iron-session'

export interface SessionData {
  isPinVerified?: boolean
}

// QA-006: SESSION_SECRET deve ser definido em produção.
// Fallback fraco permite forjar cookies de sessão por quem lê o código-fonte.
//
// NEXT_PHASE distingue build de runtime:
//   - 'phase-production-build'  → Next.js está compilando, variáveis de runtime
//     ainda não estão disponíveis — não lançar erro durante build.
//   - 'phase-production-server' → servidor rodando, variáveis devem estar presentes.
const sessionSecret = process.env.SESSION_SECRET
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'

if (!sessionSecret || sessionSecret.length < 32) {
  if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
    // Runtime em produção sem SECRET configurado — erro fatal
    throw new Error(
      '[SPO] SESSION_SECRET não definido ou muito curto (mínimo 32 chars). ' +
      'Configure a variável de ambiente no docker-compose.yml antes de iniciar.'
    )
  }
  if (!isBuildPhase) {
    // Desenvolvimento: avisa mas não bloqueia
    console.warn('[SPO] SESSION_SECRET não configurado — usando fallback de desenvolvimento.')
  }
}

export const sessionOptions: SessionOptions = {
  password: sessionSecret ?? 'spo-secret-local-dev-32-chars-min!!',
  cookieName: 'spo_pin_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60, // 8 horas
    httpOnly: true,
    sameSite: 'lax',
  },
}
