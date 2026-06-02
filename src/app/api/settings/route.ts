// =============================================================================
// GET   /api/settings  — retornar configuracoes da loja (publico)
// PATCH /api/settings  — atualizar configuracoes (protegido por PIN via middleware)
// SPO — Sistema Pimenta Ousada | COM-006
// =============================================================================
//
// pinHash NUNCA e retornado em nenhuma resposta deste endpoint.
// O PIN e gerenciado exclusivamente via /api/auth/pin.
//
// QA-040: findFirst + create — race condition de primeira criacao e LOW e aceita.
//         O upsert com ID fixo (tentativa anterior) criava registro duplicado em
//         bancos existentes (QA-048), potencialmente bypassando autenticacao PIN.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { ApiSuccess, ApiError, SettingsResponse } from '@/types'

// ---------------------------------------------------------------------------
// GET /api/settings
// Acesso: Publico (comanda precisa sem autenticacao)
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  try {
    let settings = await prisma.settings.findFirst()

    if (!settings) {
      settings = await prisma.settings.create({
        data: { shopName: 'Pimenta Ousada' },
      })
    }

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
// Acesso: Protegido por PIN (middleware.ts cobre /api/settings/*)
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

    // QA-048: usar findFirst + update por ID encontrado (compativel com dados existentes).
    // O upsert com ID fixo criava registro duplicado em bancos com Settings pre-existente.
    let existing = await prisma.settings.findFirst()
    if (!existing) {
      existing = await prisma.settings.create({
        data: { shopName: 'Pimenta Ousada' },
      })
    }

    const updated = await prisma.settings.update({
      where: { id: existing.id },
      data: updateData,
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
