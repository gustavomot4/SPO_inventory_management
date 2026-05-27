// =============================================================================
// PATCH  /api/products/[id]/variations/[varId]  — atualizar variação
// DELETE /api/products/[id]/variations/[varId]  — inativar variação
// SPO — Sistema Pimenta Ousada | PROD-002
// =============================================================================
//
// ATENÇÃO: size, color, sku e stockQuantity NÃO são editáveis aqui.
//   - size/color/sku: imutáveis após criação (integridade do histórico)
//   - stockQuantity: gerenciado exclusivamente via StockEntry (PROD-EST)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { ApiSuccess, ApiError, VariationResponse } from '@/types'

type RouteContext = { params: { id: string; varId: string } }

function formatVariation(v: {
  id: string
  sku: string
  size: string
  color: string
  stockQuantity: number
  minStock: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}): VariationResponse {
  return {
    id: v.id,
    sku: v.sku,
    size: v.size,
    color: v.color,
    stockQuantity: v.stockQuantity,
    minStock: v.minStock,
    isActive: v.isActive,
    isLowStock: v.stockQuantity > 0 && v.stockQuantity <= v.minStock,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/products/[id]/variations/[varId]
// Body: { minStock?, isActive? } — pelo menos um
// NÃO editar: size, color, sku, stockQuantity
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    // Verificar que a variação pertence ao produto
    const variation = await prisma.productVariation.findFirst({
      where: { id: params.varId, productId: params.id },
      select: { id: true },
    })

    if (!variation) {
      return NextResponse.json<ApiError>(
        { error: 'Variação não encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json<ApiError>(
        { error: 'Body inválido', code: 'INVALID_BODY' },
        { status: 400 }
      )
    }

    const { minStock, isActive } = body as Record<string, unknown>

    if (minStock !== undefined) {
      if (typeof minStock !== 'number' || !Number.isInteger(minStock) || minStock < 0) {
        return NextResponse.json<ApiError>(
          { error: 'O campo "minStock" deve ser um inteiro >= 0', code: 'INVALID_BODY' },
          { status: 400 }
        )
      }
    }

    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return NextResponse.json<ApiError>(
        { error: 'O campo "isActive" deve ser boolean', code: 'INVALID_BODY' },
        { status: 400 }
      )
    }

    const updateData: { minStock?: number; isActive?: boolean } = {}
    if (minStock !== undefined) updateData.minStock = minStock as number
    if (isActive !== undefined) updateData.isActive = isActive as boolean

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json<ApiError>(
        { error: 'Nenhum campo válido para atualizar', code: 'NO_FIELDS_TO_UPDATE' },
        { status: 400 }
      )
    }

    const updated = await prisma.productVariation.update({
      where: { id: params.varId },
      data: updateData,
    })

    return NextResponse.json<ApiSuccess<VariationResponse>>({
      data: formatVariation(updated),
    })
  } catch (error) {
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2025') {
      return NextResponse.json<ApiError>(
        { error: 'Variação não encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    console.error('[PATCH /api/products/[id]/variations/[varId]]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/products/[id]/variations/[varId]
// Soft delete: isActive = false
// Variação permanece no banco (histórico de SaleItems)
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    // Verificar que a variação pertence ao produto
    const variation = await prisma.productVariation.findFirst({
      where: { id: params.varId, productId: params.id },
      select: { id: true },
    })

    if (!variation) {
      return NextResponse.json<ApiError>(
        { error: 'Variação não encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    const updated = await prisma.productVariation.update({
      where: { id: params.varId },
      data: { isActive: false },
    })

    return NextResponse.json<ApiSuccess<VariationResponse>>({
      data: formatVariation(updated),
    })
  } catch (error) {
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2025') {
      return NextResponse.json<ApiError>(
        { error: 'Variação não encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    console.error('[DELETE /api/products/[id]/variations/[varId]]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
