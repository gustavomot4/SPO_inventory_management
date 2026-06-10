// =============================================================================
// api/auth/pin/change/route.ts -- Troca de PIN autenticada
// SPO -- Sistema Pimenta Ousada | SEC-001
// =============================================================================
//
// POST /api/auth/pin/change
//   Requer sessao ativa (isPinVerified = true)
//   body: { currentPin, newPin, confirmPin }
//   -> 200 { ok: true }
//
// QA-015: PIN fixado em exatamente 4 digitos — compativel com PIN_LENGTH = 4
//         da tela de verificacao (pin/page.tsx).
// QA-032: Rate limiting adicionado — sem isso, atacante com cookie valido podia
//         testar todas as 10.000 combinacoes de PIN de 4 digitos sem ser bloqueado.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { sessionOptions, type SessionData } from '@/lib/session'
import { safeCompareString } from '@/lib/safe-compare'
import {
  getRateLimitKey,
  checkRateLimit,
  recordFailedAttempt,
  clearAttempts,
} from '@/lib/rate-limit'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const dummyRes = new Response()
    const session = await getIronSession<SessionData>(
      request,
      dummyRes as unknown as Response,
      sessionOptions
    )
    if (!session.isPinVerified) {
      return NextResponse.json(
        { error: 'Nao autorizado. Faca login primeiro.', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // QA-032: rate limiting — mesmo limite do endpoint de verificacao (5/10min)
    const rlKey = getRateLimitKey(request, 'pin-change')
    if (!checkRateLimit(rlKey)) {
      return NextResponse.json(
        { error: 'Muitas tentativas incorretas. Aguarde 10 minutos.', code: 'RATE_LIMITED' },
        { status: 429 }
      )
    }

    let body: { currentPin?: unknown; newPin?: unknown; confirmPin?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body invalido', code: 'INVALID_BODY' }, { status: 400 })
    }

    const { currentPin, newPin, confirmPin } = body

    if (!currentPin || !newPin || !confirmPin) {
      return NextResponse.json(
        { error: 'Preencha o PIN atual, o novo PIN e a confirmacao', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }
    if (
      typeof currentPin !== 'string' ||
      typeof newPin !== 'string' ||
      typeof confirmPin !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Campos invalidos', code: 'INVALID_FIELDS' },
        { status: 400 }
      )
    }

    // QA-015: exatamente 4 digitos — tela de PIN tem PIN_LENGTH = 4 fixo
    if (!/^\d{4}$/.test(newPin)) {
      return NextResponse.json(
        { error: 'O novo PIN deve ter exatamente 4 digitos numericos', code: 'INVALID_NEW_PIN' },
        { status: 400 }
      )
    }

    if (newPin !== confirmPin) {
      return NextResponse.json(
        { error: 'O novo PIN e a confirmacao nao coincidem', code: 'PIN_MISMATCH' },
        { status: 400 }
      )
    }

    // QA-067: linha autoritativa = a que tem pinHash (se houver), senão a mais antiga.
    const settings =
      (await prisma.settings.findFirst({
        where: { pinHash: { not: null } },
        select: { id: true, pinHash: true },
      })) ??
      (await prisma.settings.findFirst({
        orderBy: { id: 'asc' },
        select: { id: true, pinHash: true },
      }))

    let currentPinValid = false
    if (settings?.pinHash) {
      currentPinValid = await bcrypt.compare(currentPin, settings.pinHash)
    } else {
      // QA-068: comparação constant-time no fallback (evita timing attack)
      currentPinValid = safeCompareString(currentPin, process.env.APP_PIN ?? '1234')
    }

    if (!currentPinValid) {
      // QA-032: registrar tentativa falha
      recordFailedAttempt(rlKey)
      return NextResponse.json(
        { error: 'PIN atual incorreto', code: 'WRONG_CURRENT_PIN' },
        { status: 401 }
      )
    }

    // PIN correto — limpar contador de tentativas
    clearAttempts(rlKey)

    const newHash = await bcrypt.hash(newPin, 12)

    if (settings?.id) {
      await prisma.settings.update({
        where: { id: settings.id },
        data: { pinHash: newHash },
      })
    } else {
      await prisma.settings.create({
        data: { shopName: 'Pimenta Ousada', pinHash: newHash },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[POST /api/auth/pin/change]', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
