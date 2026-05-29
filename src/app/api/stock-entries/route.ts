// =============================================================================
// POST /api/stock-entries  — registrar entrada de estoque
// GET  /api/stock-entries  — listar entradas (paginado)
// SPO — Sistema Pimenta Ousada | EST-001
// =============================================================================
//
// Acesso: Público (sem PIN).
//
// O POST executa 3 operações em $transaction:
//   1. Criar StockEntry
//   2. Criar StockMovement (tipo ENTRY, quantity positivo)
//   3. Atualizar stockQuantity da variação
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { MOVEMENT_TYPE } from '@/lib/enums'
import type { ApiSuccess, ApiError, StockEntryResponse, StockEntryListItem } from '@/types'

// ---------------------------------------------------------------------------
// POST /api/stock-entries
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json<ApiError>(
        { error: 'Body inválido', code: 'INVALID_BODY' },
        { status: 400 }
      )
    }

    const { variationId, quantity, unitCostCents, notes, receivedAt } =
      body as Record<string, unknown>

    // Validar variationId
    if (!variationId || typeof variationId !== 'string') {
      return NextResponse.json<ApiError>(
        { error: 'O campo "variationId" é obrigatório', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }

    // Validar quantity
    if (quantity === undefined || quantity === null) {
      return NextResponse.json<ApiError>(
        { error: 'O campo "quantity" é obrigatório', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json<ApiError>(
        { error: 'O campo "quantity" deve ser um inteiro > 0', code: 'INVALID_QUANTITY' },
        { status: 400 }
      )
    }

    // Validar unitCostCents (opcional)
    if (unitCostCents !== undefined && unitCostCents !== null) {
      if (
        typeof unitCostCents !== 'number' ||
        !Number.isInteger(unitCostCents) ||
        unitCostCents < 0
      ) {
        return NextResponse.json<ApiError>(
          { error: 'O campo "unitCostCents" deve ser um inteiro >= 0', code: 'INVALID_COST' },
          { status: 400 }
        )
      }
    }

    // Validar receivedAt (opcional — se fornecido deve ser ISO 8601 string)
    if (receivedAt !== undefined && receivedAt !== null) {
      if (typeof receivedAt !== 'string' || isNaN(Date.parse(receivedAt as string))) {
        return NextResponse.json<ApiError>(
          { error: 'O campo "receivedAt" deve ser uma string ISO 8601', code: 'INVALID_DATE' },
          { status: 400 }
        )
      }
    }

    // Verificar que variação existe e está ativa
    const variation = await prisma.productVariation.findUnique({
      where: { id: variationId as string },
      select: {
        id: true,
        sku: true,
        stockQuantity: true,
        isActive: true,
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!variation) {
      return NextResponse.json<ApiError>(
        { error: 'Variação não encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (!variation.isActive) {
      return NextResponse.json<ApiError>(
        { error: 'Variação inativa — não é possível dar entrada', code: 'VARIATION_INACTIVE' },
        { status: 422 }
      )
    }

    const newStock = variation.stockQuantity + (quantity as number)

    // Transaction: StockEntry + StockMovement + update stockQuantity
    const { entry, movement } = await prisma.$transaction(async (tx) => {
      const entry = await tx.stockEntry.create({
        data: {
          variationId: variationId as string,
          quantity: quantity as number,
          unitCostCents: (unitCostCents as number | null | undefined) ?? null,
          notes: (notes as string | null | undefined) ?? null,
          ...(receivedAt ? { receivedAt: receivedAt as string } : {}),
        },
      })

      const movement = await tx.stockMovement.create({
        data: {
          variationId: variationId as string,
          stockEntryId: entry.id,
          type: MOVEMENT_TYPE.ENTRY,
          quantity: quantity as number, // positivo = entrada
          balanceAfter: newStock,
          notes: (notes as string | null | undefined) ?? null,
        },
      })

      await tx.productVariation.update({
        where: { id: variationId as string },
        data: { stockQuantity: newStock },
      })

      return { entry, movement }
    })

    const responseData: StockEntryResponse = {
      id: entry.id,
      variationId: entry.variationId,
      variationSku: variation.sku,
      productId: variation.product.id,
      productName: variation.product.name,
      quantity: entry.quantity,
      unitCostCents: entry.unitCostCents,
      notes: entry.notes,
      receivedAt: entry.receivedAt,
      createdAt: entry.createdAt,
      stockAfter: newStock,
      movementId: movement.id,
    }

    return NextResponse.json<ApiSuccess<StockEntryResponse>>(
      { data: responseData },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/stock-entries]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// GET /api/stock-entries
// Query: ?variationId=xxx | ?productId=xxx | ?cursor=xxx | ?pageSize=20
// Ordem: receivedAt desc (mais recente primeiro)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = request.nextUrl

    const variationId = searchParams.get('variationId') || undefined
    const productId = searchParams.get('productId') || undefined
    const cursor = searchParams.get('cursor') || undefined
    const pageSizeParam = parseInt(searchParams.get('pageSize') || '20', 10)
    const pageSize = Math.min(Math.max(1, isNaN(pageSizeParam) ? 20 : pageSizeParam), 100)

    // Se productId foi passado, filtrar por todas as variações desse produto
    let variationFilter: { variationId?: string; variation?: { productId: string } } = {}
    if (variationId) {
      variationFilter = { variationId }
    } else if (productId) {
      variationFilter = { variation: { productId } }
    }

    const entries = await prisma.stockEntry.findMany({
      take: pageSize + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: variationFilter,
      orderBy: { receivedAt: 'desc' },
      include: {
        variation: {
          select: {
            sku: true,
            product: { select: { id: true, name: true } },
          },
        },
      },
    })

    const hasNextPage = entries.length > pageSize
    if (hasNextPage) entries.pop()

    const lastItem = entries.at(-1)

    const data: StockEntryListItem[] = entries.map((e) => ({
      id: e.id,
      variationId: e.variationId,
      variationSku: e.variation.sku,
      productId: e.variation.product.id,
      productName: e.variation.product.name,
      quantity: e.quantity,
      unitCostCents: e.unitCostCents,
      notes: e.notes,
      receivedAt: e.receivedAt,
      createdAt: e.createdAt,
    }))

    return NextResponse.json<ApiSuccess<StockEntryListItem[]>>({
      data,
      meta: {
        pageSize,
        hasNextPage,
        cursor: hasNextPage && lastItem ? lastItem.id : undefined,
      },
    })
  } catch (error) {
    console.error('[GET /api/stock-entries]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
