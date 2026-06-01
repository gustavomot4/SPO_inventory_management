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
//
// QA-010: Rate limiting em memoria — bloqueia apos 5 tentativas erradas em 10min
// QA-012: timingSafeEqual no fallback para evitar timing attack
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import bcrypt from 'bcryptjs'
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import { sessionOptions, type SessionData } from '@/lib/session'

// QA-010: Rate limiting simples em memoria (sistema single-instance)
const RATE_LIMIT_MAX = 5          // tentativas erradas
const RATE_LIMIT_WINDOW = 10 * 60 * 1000 // 10 minutos em ms

const attempts = new Map<string, { count: number; resetAt: number }>()

function getRateLimitKey(request: NextRequest): string {
  // Sistema local single-tenant — chave fixa; em multi-tenant usaria IP
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? (forwarded.split(',')[0]?.trim() ?? 'local') : 'local'
  return `pin:${ip}`
}

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = attempts.get(key)

  if (!entry || now > entry.resetAt) {
    return true // janela expirou ou primeira tentativa
  }

  return entry.count < RATE_LIMIT_MAX
}

function recordFailedAttempt(key: string): void {
  const now = Date.now()
  const entry = attempts.get(key)

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
  } else {
    entry.count++
  }
}

function clearAttempts(key: string): void {
  attempts.delete(key)
}

// QA-012: comparacao constant-time para evitar timing attack no fallback
function safeCompareString(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return false
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { pin?: string }
    const { pin } = body

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json({ error: 'PIN obrigatorio' }, { status: 400 })
    }

    // QA-010: verificar rate limit antes de qualquer validacao
    const rlKey = getRateLimitKey(request)
    if (!checkRateLimit(rlKey)) {
      return NextResponse.json(
        { error: 'Muitas tentativas incorretas. Aguarde 10 minutos.', code: 'RATE_LIMITED' },
        { status: 429 }
      )
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
      // QA-012: timingSafeEqual para evitar timing attack
      const appPin = process.env.APP_PIN ?? '1234'
      isValid = safeCompareString(pin, appPin)
    }

    if (!isValid) {
      recordFailedAttempt(rlKey) // QA-010: contar tentativa errada
      return NextResponse.json({ error: 'PIN incorreto' }, { status: 401 })
    }

    // PIN correto -- limpar tentativas e criar sessao
    clearAttempts(rlKey) // QA-010: reset ao acertar
    const response = NextResponse.json({ ok: true })
    const session = await getIronSession<SessionData>(request, response, sessionOptions)
    session.isPinVerified = true
    await session.save()

    return response
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
