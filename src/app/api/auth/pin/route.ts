// =============================================================================
// POST /api/auth/pin — Verificar PIN e criar sessão
// SPO — Sistema Pimenta Ousada | MVP-005
// =============================================================================
//
// Fluxo:
//   1. Recebe { pin: string } no body
//   2. Valida formato (4–6 dígitos numéricos)
//   3. Chama checkPin() → 'ok' | 'wrong' | 'no_pin_set'
//   4. Se 'wrong' → 401
//   5. Se 'ok' ou 'no_pin_set' → cria sessão e retorna 200
//
// Não há rate limiting neste endpoint (sistema local, usuário único).
// Em versão cloud, adicionar rate limiting por IP.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { checkPin, getSession } from '@/lib/pin-auth'
import type { ApiError, ApiSuccess } from '@/types'

// Valida que o PIN é numérico e tem entre 4 e 6 dígitos
const PIN_REGEX = /^\d{4,6}$/

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await request.json()

    // Validação básica do body
    if (!body || typeof body !== 'object') {
      return NextResponse.json<ApiError>(
        { error: 'Body inválido', code: 'INVALID_BODY' },
        { status: 400 }
      )
    }

    const { pin } = body as Record<string, unknown>

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json<ApiError>(
        { error: 'PIN é obrigatório', code: 'MISSING_PIN' },
        { status: 400 }
      )
    }

    if (!PIN_REGEX.test(pin)) {
      return NextResponse.json<ApiError>(
        { error: 'PIN deve conter entre 4 e 6 dígitos numéricos', code: 'INVALID_PIN_FORMAT' },
        { status: 400 }
      )
    }

    // Verificar PIN contra o banco
    const result = await checkPin(pin)

    if (result === 'wrong') {
      return NextResponse.json<ApiError>(
        { error: 'PIN incorreto', code: 'WRONG_PIN' },
        { status: 401 }
      )
    }

    // PIN correto ou não configurado — criar sessão
    const session = await getSession()
    session.isPinVerified = true
    session.verifiedAt = new Date().toISOString()
    await session.save()

    return NextResponse.json<ApiSuccess<{ pinRequired: boolean }>>({
      data: {
        // Informa o frontend se havia PIN configurado (para feedback de UX)
        pinRequired: result !== 'no_pin_set',
      },
    })
  } catch (error) {
    console.error('[POST /api/auth/pin] Erro inesperado:', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
