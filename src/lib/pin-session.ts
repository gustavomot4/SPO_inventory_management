// =============================================================================
// pin-session.ts — Configuração do iron-session para autenticação por PIN
// SPO — Sistema Pimenta Ousada | MVP-005
// =============================================================================
//
// Arquitetura de autenticação (ADR-003):
//   - Sistema SEM contas de usuário (sem login/senha)
//   - Áreas sensíveis protegidas por PIN numérico (4–6 dígitos)
//   - Sessão armazenada em cookie HTTP-only criptografado via iron-session
//   - Validade: 8 horas (jornada de trabalho)
//   - PIN armazenado como hash bcrypt em Settings.pinHash (singleton)
// =============================================================================

import type { SessionOptions } from 'iron-session'

// ---------------------------------------------------------------------------
// Tipo dos dados da sessão PIN
// ---------------------------------------------------------------------------

export interface PinSessionData {
  isPinVerified: boolean // true = PIN verificado nesta sessão
  verifiedAt?: string   // ISO timestamp de quando o PIN foi verificado
}

// Augment do IronSession com os dados da sessão SPO
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
declare module 'iron-session' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IronSessionData extends PinSessionData {}
}

// ---------------------------------------------------------------------------
// Configuração do iron-session
// ---------------------------------------------------------------------------

if (!process.env.SESSION_SECRET) {
  throw new Error(
    '[SPO] SESSION_SECRET não definido no .env — mínimo 32 caracteres'
  )
}

if (process.env.SESSION_SECRET.length < 32) {
  throw new Error(
    '[SPO] SESSION_SECRET deve ter pelo menos 32 caracteres'
  )
}

export const sessionOptions: SessionOptions = {
  cookieName: 'spo_pin_session',
  password: process.env.SESSION_SECRET,
  cookieOptions: {
    // Apenas HTTPS em produção; em desenvolvimento local http é suficiente
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,       // inacessível via JavaScript do browser — proteção contra XSS
    sameSite: 'lax',      // proteção básica contra CSRF
    maxAge: 60 * 60 * 8, // 8 horas em segundos — jornada de trabalho da loja
  },
}
