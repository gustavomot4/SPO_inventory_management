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
// QA-082: placeholders conhecidos (copiados do .env.example sem editar) são
// tratados como AUSENTES — um placeholder público de 32+ chars passava na
// checagem de tamanho e assinava a sessão com segredo previsível (cookie
// forjável → bypass do PIN no caminho de execução sem Docker).
//
// NEXT_PHASE distingue build de runtime:
//   - 'phase-production-build'  → compilando, variáveis de runtime não disponíveis
//   - 'phase-production-server' → servidor rodando, variáveis devem estar presentes
const KNOWN_PLACEHOLDER_SECRETS = new Set([
  'gerar-com-openssl-rand-base64-32', // placeholder antigo do .env.example (32 chars — passava!)
  'TROQUE-ESTE-VALOR',                // placeholder atual do .env.example (curto — falha de proposito)
])

const rawSecret = process.env.SESSION_SECRET
const sessionSecret =
  rawSecret && !KNOWN_PLACEHOLDER_SECRETS.has(rawSecret) ? rawSecret : undefined
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'

if (!sessionSecret || sessionSecret.length < 32) {
  if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
    throw new Error(
      '[SPO] SESSION_SECRET não definido, muito curto (mínimo 32 chars) ou igual ao ' +
      'placeholder do .env.example. Gere um valor próprio (ex: openssl rand -base64 32) ' +
      'antes de iniciar em produção.'
    )
  }
  if (!isBuildPhase) {
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
