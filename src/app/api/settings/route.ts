// =============================================================================
// GET   /api/settings  — retornar configuracoes da loja (publico)
// PATCH /api/settings  — atualizar configuracoes (protegido por PIN via middleware)
// SPO — Sistema Pimenta Ousada | COM-006
// =============================================================================
//
// pinHash NUNCA e retornado em nenhuma resposta deste endpoint.
// O PIN e gerenciado exclusivamente via /api/auth/pin.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { ApiSuccess, ApiError, SettingsResponse } from '@/types'

// ---------------------------------------------------------------------------
// GET /api/settings
// Acesso: Publico (comanda precisa sem autenticacao)
// Cria o singleton com valores padrao se nao existir.
// ---------------------------------------------------------------------------

// ID fixo do singleton — garante que upsert nunca cria duplicatas (QA-040)
const SETTINGS_SINGLETON_ID = 'spo-settings-singleton'

export async function GET(): Promise<NextResponse> {
  try {
    // QA-040: upsert atomico — findFirst + create sem transacao criava registros
    // duplicados se dois requests chegassem simultaneamente antes do 1o insert.
    const settings = await prisma.settings.upsert({
      where: { id: SETTINGS_SINGLETON_ID },
      update: {},
      create: { id: SETTINGS_SINGLETON_ID, shopName: 'Pimenta Ousada' },
    })

    return NextResponse.json<ApiSuccess<SettingsResponse>>({
      data: {
        id: settings.id,
        shopName: settings.shopName,
        address: settings.address ?? null,
        phone: settings.phone ?? null,
        updatedAt: settings.updatedAt,
      },
    })
  } catch (error) {
    console.error('[GET /api/settings]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/settings
// Acesso: Protegido por PIN (middleware.ts cobre /api/settings/* — ver config abaixo)
// Body: { shopName?, address?, phone? } — pelo menos um obrigatorio
// null = limpar campo (address e phone aceitam null)
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json<ApiError>(
        { error: 'Body invalido', code: 'INVALID_BODY' },
        { status: 400 }
      )
    }

    const { shopName, address, phone } = body as Record<string, unknown>

    // Validacoes
    if (shopName !== undefined) {
      if (
        typeof shopName !== 'string' ||
        shopName.trim().length === 0 ||
        shopName.trim().length > 100
      ) {
        return NextResponse.json<ApiError>(
          { error: 'O campo "shopName" deve ter entre 1 e 100 caracteres', code: 'INVALID_SHOP_NAME' },
          { status: 400 }
        )
      }
    }

    if (address !== undefined && address !== null) {
      if (typeof address !== 'string' || address.length > 200) {
        return NextResponse.json<ApiError>(
          { error: 'O campo "address" deve ser uma string de ate 200 caracteres', code: 'INVALID_ADDRESS' },
          { status: 400 }
        )
      }
    }

    if (phone !== undefined && phone !== null) {
      if (typeof phone !== 'string' || phone.length > 30) {
        return NextResponse.json<ApiError>(
          { error: 'O campo "phone" deve ser uma string de ate 30 caracteres', code: 'INVALID_PHONE' },
          { status: 400 }
        )
      }
    }

    // Pelo menos um campo presente
    if (shopName === undefined && address === undefined && phone === undefined) {
      return NextResponse.json<ApiError>(
        { error: 'Nenhum campo valido para atualizar', code: 'NO_FIELDS_TO_UPDATE' },
        { status: 400 }
      )
    }

    const updateData: { shopName?: string; address?: string | null; phone?: string | null } = {}
    if (shopName !== undefined) updateData.shopName = (shopName as string).trim()
    if (address !== undefined) updateData.address = address as string | null
    if (phone !== undefined) updateData.phone = phone as string | null

    // QA-040: upsert garante que o singleton existe antes de atualizar
    const updated = await prisma.settings.upsert({
      where: { id: SETTINGS_SINGLETON_ID },
      update: updateData,
      create: { id: SETTINGS_SINGLETON_ID, shopName: 'Pimenta Ousada', ...updateData },
    })

    return NextResponse.json<ApiSuccess<SettingsResponse>>({
      data: {
        id: updated.id,
        shopName: updated.shopName,
        address: updated.address ?? null,
        phone: updated.phone ?? null,
        updatedAt: updated.updatedAt,
      },
    })
  } catch (error) {
    console.error('[PATCH /api/settings]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
