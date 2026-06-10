// =============================================================================
// GET  /api/products/[id]/variations  — listar variações do produto
// POST /api/products/[id]/variations  — adicionar variação a produto existente
// SPO — Sistema Pimenta Ousada | PROD-002
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateSkuWithFallback } from '@/lib/sku'
import { MOVEMENT_TYPE } from '@/lib/enums'
import type { ApiSuccess, ApiError, VariationResponse } from '@/types'

type RouteContext = { params: { id: string } }

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
// GET /api/products/[id]/variations
// Retorna TODAS as variações (ativas e inativas) do produto
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
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

    return NextResponse.json<ApiSuccess<VariationResponse[]>>({
      data: product.variations.map(formatVariation),
    })
  } catch (error) {
    console.error('[GET /api/products/[id]/variations]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/products/[id]/variations
// Body: { size, color, sku?, stockQuantity?, minStock? }
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    // Verificar produto existe e não foi deletado
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, deletedAt: true },
    })

    if (!product) {
      return NextResponse.json<ApiError>(
        { error: 'Produto não encontrado', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (product.deletedAt !== null) {
      return NextResponse.json<ApiError>(
        { error: 'Produto foi excluído — não é possível adicionar variações', code: 'PRODUCT_DELETED' },
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

    const { size, color, sku: skuInput, stockQuantity, minStock } = body as Record<string, unknown>

    // Validar size e color — DT-008: strings vazias são permitidas
    if (typeof size !== 'string') {
      return NextResponse.json<ApiError>(
        { error: 'O campo "size" é obrigatório e deve ser uma string (pode ser vazia)', code: 'INVALID_VARIATION' },
        { status: 400 }
      )
    }

    if (typeof color !== 'string') {
      return NextResponse.json<ApiError>(
        { error: 'O campo "color" é obrigatório e deve ser uma string (pode ser vazia)', code: 'INVALID_VARIATION' },
        { status: 400 }
      )
    }

    const sizeClean = size as string
    const colorClean = color as string

    // Verificar duplicata size+color neste produto
    const duplicate = await prisma.productVariation.findFirst({
      where: {
        productId: params.id,
        size: sizeClean,
        color: colorClean,
      },
      select: { id: true },
    })

    if (duplicate) {
      return NextResponse.json<ApiError>(
        {
          error: `Já existe uma variação tamanho "${sizeClean}" + cor "${colorClean}" neste produto`,
          code: 'DUPLICATE_VARIATION',
        },
        { status: 409 }
      )
    }

    // Determinar SKU
    let sku: string
    if (typeof skuInput === 'string' && skuInput.trim().length > 0) {
      sku = skuInput.trim()
      const existing = await prisma.productVariation.findUnique({
        where: { sku },
        select: { id: true },
      })
      if (existing) {
        return NextResponse.json<ApiError>(
          { error: `SKU "${sku}" já está em uso`, code: 'SKU_TAKEN' },
          { status: 409 }
        )
      }
    } else {
      // QA-077: usa a variante com fallback de timestamp (QA-046) — SKU informado
      // manualmente continua tratado com SKU_TAKEN logo acima.
      sku = await generateSkuWithFallback(product.name, sizeClean, colorClean)
    }

    const initialStock =
      typeof stockQuantity === 'number' && Number.isInteger(stockQuantity)
        ? Math.max(0, stockQuantity)
        : 0

    // QA-066: criação + movimento de abertura na MESMA transação, mantendo a
    // invariante stockQuantity == soma dos movimentos.
    const variation = await prisma.$transaction(async (tx) => {
      const created = await tx.productVariation.create({
        data: {
          productId: params.id,
          size: sizeClean,
          color: colorClean,
          sku,
          stockQuantity: initialStock,
          minStock:
            typeof minStock === 'number' && Number.isInteger(minStock)
              ? Math.max(0, minStock)
              : 2,
        },
      })

      if (initialStock > 0) {
        await tx.stockMovement.create({
          data: {
            variationId: created.id,
            type: MOVEMENT_TYPE.ENTRY,
            quantity: initialStock,
            balanceAfter: initialStock,
            notes: 'Estoque inicial (nova variação)',
          },
        })
      }

      return created
    })

    return NextResponse.json<ApiSuccess<VariationResponse>>(
      { data: formatVariation(variation) },
      { status: 201 }
    )
  } catch (error) {
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2002') {
      return NextResponse.json<ApiError>(
        { error: 'SKU já está em uso ou variação duplicada', code: 'SKU_TAKEN' },
        { status: 409 }
      )
    }
    console.error('[POST /api/products/[id]/variations]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
