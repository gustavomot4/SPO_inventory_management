// =============================================================================
// api/auth/pin/change/route.ts -- Troca de PIN autenticada
// SPO -- Sistema Pimenta Ousada | SEC-001
// =============================================================================
//
// POST /api/auth/pin/change
//   Requer sessao ativa (isPinVerified = true)
//   body: { currentPin, newPin, confirmPin }
//   -> 200 { ok: true }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { sessionOptions, type SessionData } from '@/lib/session'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Verificar que o usuario esta autenticado
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

    // 2. Ler body
    let body: { currentPin?: unknown; newPin?: unknown; confirmPin?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body invalido', code: 'INVALID_BODY' }, { status: 400 })
    }

    const { currentPin, newPin, confirmPin } = body

    // 3. Validar campos obrigatorios
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

    // 4. Validar novo PIN: apenas digitos, 4-8 caracteres
    if (!/^\d{4,8}$/.test(newPin)) {
      return NextResponse.json(
        { error: 'O novo PIN deve ter entre 4 e 8 digitos numericos', code: 'INVALID_NEW_PIN' },
        { status: 400 }
      )
    }

    // 5. Confirmar que newPin === confirmPin
    if (newPin !== confirmPin) {
      return NextResponse.json(
        { error: 'O novo PIN e a confirmacao nao coincidem', code: 'PIN_MISMATCH' },
        { status: 400 }
      )
    }

    // 6. Verificar PIN atual
    const settings = await prisma.settings.findFirst({ select: { id: true, pinHash: true } })

    let currentPinValid = false
    if (settings?.pinHash) {
      currentPinValid = await bcrypt.compare(currentPin, settings.pinHash)
    } else {
      // Fallback: APP_PIN do .env
      currentPinValid = currentPin === (process.env.APP_PIN ?? '1234')
    }

    if (!currentPinValid) {
      return NextResponse.json(
        { error: 'PIN atual incorreto', code: 'WRONG_CURRENT_PIN' },
        { status: 401 }
      )
    }

    // 7. Gerar hash do novo PIN (bcrypt, custo 12)
    const newHash = await bcrypt.hash(newPin, 12)

    // 8. Salvar no banco -- upsert do singleton Settings
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
