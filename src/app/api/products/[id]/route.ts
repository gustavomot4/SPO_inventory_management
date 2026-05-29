// =============================================================================
// GET    /api/products/[id]  — detalhar produto com todas as variações
// PATCH  /api/products/[id]  — atualizar produto (sem variações)
// DELETE /api/products/[id]  — soft delete (deletedAt + isActive=false)
// SPO — Sistema Pimenta Ousada | PROD-002
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { ApiSuccess, ApiError, ProductResponse, VariationResponse } from '@/types'

type RouteContext = { params: { id: string } }

// ---------------------------------------------------------------------------
// Helper: formatar variação
// ---------------------------------------------------------------------------

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
// GET /api/products/[id]
// Retorna produto com TODAS as variações (ativas e inativas)
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        category: { select: { name: true } },
        variations: {
          orderBy: [{ isActive: 'desc' }, { size: 'asc' }, { color: 'asc' }],
        },
      },
    })

    if (!product) {
      return NextResponse.json<ApiError>(
        { error: 'Produto não encontrado', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    return NextResponse.json<ApiSuccess<ProductResponse>>({
      data: {
        id: product.id,
        name: product.name,
        categoryId: product.categoryId,
        categoryName: product.category.name,
        priceCents: product.priceCents,
        costCents: product.costCents,
        isActive: product.isActive,
        deletedAt: product.deletedAt,
        variations: product.variations.map(formatVariation),
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
    })
  } catch (error) {
    console.error('[GET /api/products/[id]]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/products/[id]
// Body: { name?, categoryId?, priceCents?, isActive? } — pelo menos um
// Não altera variações — usar /api/products/[id]/variations para isso
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    // Verificar que produto existe e não foi deletado
    const existing = await prisma.product.findUnique({
      where: { id: params.id },
      select: { id: true, deletedAt: true },
    })

    if (!existing) {
      return NextResponse.json<ApiError>(
        { error: 'Produto não encontrado', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (existing.deletedAt !== null) {
      return NextResponse.json<ApiError>(
        { error: 'Produto foi excluído e não pode ser atualizado', code: 'PRODUCT_DELETED' },
        { status: 422 }
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

    const { name, categoryId, priceCents, costCents, isActive } = body as Record<string, unknown>

    // Validações
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 120) {
        return NextResponse.json<ApiError>(
          { error: 'O nome deve ter entre 1 e 120 caracteres', code: 'INVALID_NAME' },
          { status: 400 }
        )
      }
    }

    if (priceCents !== undefined) {
      if (typeof priceCents !== 'number' || !Number.isInteger(priceCents) || priceCents < 0) {
        return NextResponse.json<ApiError>(
          { error: 'O preço deve ser um inteiro >= 0 (em centavos)', code: 'INVALID_PRICE' },
          { status: 400 }
        )
      }
    }

    if (categoryId !== undefined) {
      if (typeof categoryId !== 'string') {
        return NextResponse.json<ApiError>(
          { error: 'categoryId inválido', code: 'MISSING_FIELDS' },
          { status: 400 }
        )
      }
      const cat = await prisma.category.findUnique({
        where: { id: categoryId },
        select: { id: true, isActive: true },
      })
      if (!cat || !cat.isActive) {
        return NextResponse.json<ApiError>(
          { error: 'Categoria não encontrada ou inativa', code: 'CATEGORY_NOT_FOUND' },
          { status: 422 }
        )
      }
    }

    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return NextResponse.json<ApiError>(
        { error: 'O campo "isActive" deve ser boolean', code: 'INVALID_BODY' },
        { status: 400 }
      )
    }

    // Validar costCents (opcional; null = limpar valor)
    if (costCents !== undefined && costCents !== null) {
      if (typeof costCents !== 'number' || !Number.isInteger(costCents) || costCents < 0) {
        return NextResponse.json<ApiError>(
          { error: 'O campo "costCents" deve ser um inteiro >= 0 (em centavos)', code: 'INVALID_COST' },
          { status: 400 }
        )
      }
    }

    const updateData: {
      name?: string
      categoryId?: string
      priceCents?: number
      costCents?: number | null
      isActive?: boolean
    } = {}
    if (name !== undefined) updateData.name = (name as string).trim()
    if (categoryId !== undefined) updateData.categoryId = categoryId as string
    if (priceCents !== undefined) updateData.priceCents = priceCents as number
    if (costCents !== undefined) updateData.costCents = costCents as number | null
    if (isActive !== undefined) updateData.isActive = isActive as boolean

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json<ApiError>(
        { error: 'Nenhum campo válido para atualizar', code: 'NO_FIELDS_TO_UPDATE' },
        { status: 400 }
      )
    }

    const product = await prisma.product.update({
      where: { id: params.id },
      data: updateData,
      include: {
        category: { select: { name: true } },
        variations: {
          orderBy: [{ isActive: 'desc' }, { size: 'asc' }, { color: 'asc' }],
        },
      },
    })

    return NextResponse.json<ApiSuccess<ProductResponse>>({
      data: {
        id: product.id,
        name: product.name,
        categoryId: product.categoryId,
        categoryName: product.category.name,
        priceCents: product.priceCents,
        costCents: product.costCents,
        isActive: product.isActive,
        deletedAt: product.deletedAt,
        variations: product.variations.map(formatVariation),
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
    })
  } catch (error) {
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2025') {
      return NextResponse.json<ApiError>(
        { error: 'Produto não encontrado', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    console.error('[PATCH /api/products/[id]]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/products/[id]
// Soft delete: deletedAt = ISO string + isActive = false
// Produto desaparece da listagem padrão mas não é removido do banco
// (histórico de SaleItems preservado)
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        deletedAt: new Date().toISOString(),
        isActive: false,
      },
      include: {
        category: { select: { name: true } },
        variations: {
          orderBy: [{ size: 'asc' }, { color: 'asc' }],
        },
      },
    })

    return NextResponse.json<ApiSuccess<ProductResponse>>({
      data: {
        id: product.id,
        name: product.name,
        categoryId: product.categoryId,
        categoryName: product.category.name,
        priceCents: product.priceCents,
        costCents: product.costCents,
        isActive: product.isActive,
        deletedAt: product.deletedAt,
        variations: product.variations.map(formatVariation),
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
    })
  } catch (error) {
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2025') {
      return NextResponse.json<ApiError>(
        { error: 'Produto não encontrado', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    console.error('[DELETE /api/products/[id]]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
