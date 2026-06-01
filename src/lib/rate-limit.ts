// =============================================================================
// lib/rate-limit.ts — Rate limiting em memória para endpoints de autenticação
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// Extraído de auth/pin/route.ts (QA-032) para ser compartilhado com
// auth/pin/change/route.ts e qualquer outro endpoint que precise de proteção.
//
// Limitação conhecida (QA-039): o Map é zerado a cada restart do servidor.
// Para produção com múltiplas instâncias, migrar para persistência (DB ou Redis).
// =============================================================================

import { NextRequest } from 'next/server'

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW = 10 * 60 * 1000 // 10 minutos

const attempts = new Map<string, { count: number; resetAt: number }>()

export function getRateLimitKey(request: NextRequest, prefix: string): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? (forwarded.split(',')[0]?.trim() ?? 'local') : 'local'
  return `${prefix}:${ip}`
}

export function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || now > entry.resetAt) return true
  return entry.count < RATE_LIMIT_MAX
}

export function recordFailedAttempt(key: string): void {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
  } else {
    entry.count++
  }
}

export function clearAttempts(key: string): void {
  attempts.delete(key)
}
