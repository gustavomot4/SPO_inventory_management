// =============================================================================
// POST /api/sales/[id]/cancel  — cancelar venda e reverter estoque
// SPO — Sistema Pimenta Ousada | VEND-003
// =============================================================================
//
// Acesso: Público.
//
// Só pode cancelar vendas com status = 'ACTIVE'.
// Reverte estoque via StockMovement com type = CANCELLATION (quantity positivo).
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { MOVEMENT_TYPE, SALE_STATUS, PAYMENT_METHOD_LABELS } from '@/lib/enums'
import type { PaymentMethod } from '@/lib/enums'
import type { ApiSuccess, ApiError, SaleResponse, SaleItemResponse } from '@/types'

type RouteContext = { params: { id: string } }

function formatSaleItem(item: {
  id: string
  variationId: string
  quantity: number
  unitPriceCents: number
  subtotalCents: number
  variation: {
    sku: string
    size: string
    color: string
    product: { name: string }
  }
}): SaleItemResponse {
  return {
    id: item.id,
    variationId: item.variationId,
    variationSku: item.variation.sku,
    productName: item.variation.product.name,
    size: item.variation.size,
    color: item.variation.color,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    subtotalCents: item.subtotalCents,
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    // Verificar que venda existe
    const existing = await prisma.sale.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    })

    if (!existing) {
      return NextResponse.json<ApiError>(
        { error: 'Venda não encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (existing.status === SALE_STATUS.CANCELLED) {
      return NextResponse.json<ApiError>(
        { error: 'Venda já foi cancelada', code: 'ALREADY_CANCELLED' },
        { status: 422 }
      )
    }

    let cancelReason: string | null = null
    try {
      const body = await request.json() as Record<string, unknown>
      if (typeof body.cancelReason === 'string' && body.cancelReason.trim().length > 0) {
        cancelReason = body.cancelReason.trim()
      }
    } catch {
      // body é opcional — ignorar erro de parse
    }

    // Executar cancelamento em $transaction
    const updatedSale = await prisma.$transaction(async (tx) => {
      // 1. Buscar venda com items (dentro da tx para consistência)
      const sale = await tx.sale.findUnique({
        where: { id: params.id },
        include: { items: true },
      })

      if (!sale) throw new Error('Sale not found inside transaction')

      // 2. Para cada item: reverter estoque + criar StockMovement CANCELLATION
      for (const item of sale.items) {
        const variation = await tx.productVariation.findUnique({
          where: { id: item.variationId },
          select: { stockQuantity: true },
        })

        const currentStock = variation?.stockQuantity ?? 0
        const newStock = currentStock + item.quantity

        await tx.productVariation.update({
          where: { id: item.variationId },
          data: { stockQuantity: newStock },
        })

        await tx.stockMovement.create({
          data: {
            variationId: item.variationId,
            saleId: sale.id,
            type: MOVEMENT_TYPE.CANCELLATION,
            quantity: item.quantity, // POSITIVO — reversão ao estoque
            balanceAfter: newStock,
            notes: cancelReason,
          },
        })
      }

      // 3. Atualizar Sale para CANCELLED
      const cancelled = await tx.sale.update({
        where: { id: params.id },
        data: {
          status: SALE_STATUS.CANCELLED,
          cancelledAt: new Date().toISOString(),
          cancelReason,
        },
        include: {
          cardMachine: { select: { name: true } },
          items: {
            include: {
              variation: {
                select: {
                  sku: true,
                  size: true,
                  color: true,
                  product: { select: { name: true } },
                },
              },
            },
          },
        },
      })

      return cancelled
    })

    const responseData: SaleResponse = {
      id: updatedSale.id,
      status: updatedSale.status,
      paymentMethod: updatedSale.paymentMethod,
      paymentMethodLabel: PAYMENT_METHOD_LABELS[updatedSale.paymentMethod as PaymentMethod] ?? updatedSale.paymentMethod,
      subtotalCents: updatedSale.subtotalCents,
      discountCents: updatedSale.discountCents,
      totalCents: updatedSale.totalCents,
      cardMachineId: updatedSale.cardMachineId,
      cardMachineName: updatedSale.cardMachine?.name ?? null,
      feeCents: updatedSale.feeCents,
      installments: updatedSale.installments,
      installmentFeeBasisPoints: updatedSale.installmentFeeBasisPoints,
      notes: updatedSale.notes,
      cancelledAt: updatedSale.cancelledAt,
      cancelReason: updatedSale.cancelReason,
      items: updatedSale.items.map(formatSaleItem),
      createdAt: updatedSale.createdAt,
      updatedAt: updatedSale.updatedAt,
    }

    return NextResponse.json<ApiSuccess<SaleResponse>>({ data: responseData })
  } catch (error) {
    console.error('[POST /api/sales/[id]/cancel]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
