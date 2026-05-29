// =============================================================================
// GET /api/stock-entries/[id]  — detalhar entrada de estoque
// SPO — Sistema Pimenta Ousada | EST-001
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { ApiSuccess, ApiError, StockEntryResponse } from '@/types'

type RouteContext = { params: { id: string } }

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const entry = await prisma.stockEntry.findUnique({
      where: { id: params.id },
      include: {
        variation: {
          select: {
            sku: true,
            product: { select: { id: true, name: true } },
          },
        },
        movement: {
          select: { id: true },
        },
      },
    })

    if (!entry) {
      return NextResponse.json<ApiError>(
        { error: 'Entrada de estoque não encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // stockAfter é o balanceAfter do movimento vinculado
    // Para o detalhe, buscamos o stockQuantity atual da variação como referência
    const variation = await prisma.productVariation.findUnique({
      where: { id: entry.variationId },
      select: { stockQuantity: true },
    })

    // balanceAfter do movimento é o estado do estoque logo após a entrada
    const movement = await prisma.stockMovement.findFirst({
      where: { stockEntryId: entry.id },
      select: { id: true, balanceAfter: true },
    })

    const responseData: StockEntryResponse = {
      id: entry.id,
      variationId: entry.variationId,
      variationSku: entry.variation.sku,
      productId: entry.variation.product.id,
      productName: entry.variation.product.name,
      quantity: entry.quantity,
      unitCostCents: entry.unitCostCents,
      notes: entry.notes,
      receivedAt: entry.receivedAt,
      createdAt: entry.createdAt,
      stockAfter: movement?.balanceAfter ?? (variation?.stockQuantity ?? 0),
      movementId: movement?.id ?? '',
    }

    return NextResponse.json<ApiSuccess<StockEntryResponse>>({ data: responseData })
  } catch (error) {
    console.error('[GET /api/stock-entries/[id]]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
