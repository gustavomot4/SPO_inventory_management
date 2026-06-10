// =============================================================================
// lib/safe-compare.ts — Comparação de strings constant-time (QA-012 / QA-068)
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// Evita timing attacks ao comparar segredos (PIN no fallback APP_PIN).
// Extraído para ser compartilhado entre /api/auth/pin e /api/auth/pin/change.
// =============================================================================

import { timingSafeEqual } from 'crypto'

export function safeCompareString(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return false
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}
