// =============================================================================
// POST /api/sales/[id]/cancel  — cancelar venda e reverter estoque
// SPO — Sistema Pimenta Ousada | VEND-003
// =============================================================================
// Acesso: Protegido por PIN via middleware (QA-008).
// QA-004: status verificado atomicamente dentro da tx via updateMany condicional.
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
  variation: { sku: string; size: string; color: string; product: { name: string } }
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
    const existing = await prisma.sale.findUnique({
      where: { id: params.id },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json<ApiError>(
        { error: 'Venda não encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    let cancelReason: string | null = null
    try {
      const body = await request.json() as Record<string, unknown>
      if (typeof body.cancelReason === 'string' && body.cancelReason.trim().length > 0) {
        // QA-043: limite de tamanho em cancelReason
        if (body.cancelReason.trim().length > 300) {
          return NextResponse.json<ApiError>(
            { error: 'O motivo de cancelamento deve ter no máximo 300 caracteres', code: 'INVALID_CANCEL_REASON' },
            { status: 400 }
          )
        }
        cancelReason = body.cancelReason.trim()
      }
    } catch { /* body opcional */ }

    // QA-004: tudo dentro da tx. updateMany com where status=ACTIVE é atômico.
    // Dois cancelamentos simultâneos: apenas um atualiza (count=1), o outro lança ALREADY_CANCELLED.
    const updatedSale = await prisma.$transaction(async (tx) => {
      const cancelResult = await tx.sale.updateMany({
        where: { id: params.id, status: SALE_STATUS.ACTIVE },
        data: {
          status: SALE_STATUS.CANCELLED,
          cancelledAt: new Date().toISOString(),
          cancelReason,
        },
      })

      if (cancelResult.count === 0) {
        throw Object.assign(new Error('ALREADY_CANCELLED'), { code: 'ALREADY_CANCELLED' })
      }

      const sale = await tx.sale.findUnique({
        where: { id: params.id },
        include: { items: true },
      })
      if (!sale) throw new Error('Sale not found inside transaction')

      // QA-035: increment atomico — consistente com o padrao do projeto e
      // seguro para eventual migracao para PostgreSQL.
      for (const item of sale.items) {
        await tx.productVariation.update({
          where: { id: item.variationId },
          data: { stockQuantity: { increment: item.quantity } },
        })

        const afterUpdate = await tx.productVariation.findUnique({
          where: { id: item.variationId },
          select: { stockQuantity: true },
        })
        const balanceAfter = afterUpdate?.stockQuantity ?? 0

        await tx.stockMovement.create({
          data: {
            variationId: item.variationId,
            saleId: sale.id,
            type: MOVEMENT_TYPE.CANCELLATION,
            quantity: item.quantity,
            balanceAfter,
            notes: cancelReason,
          },
        })
      }

      const cancelled = await tx.sale.findUnique({
        where: { id: params.id },
        include: {
          cardMachine: { select: { name: true } },
          items: {
            include: {
              variation: {
                select: {
                  sku: true, size: true, color: true,
                  product: { select: { name: true } },
                },
              },
            },
          },
        },
      })
      return cancelled!
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
    if (error instanceof Error && (error as Error & { code?: string }).code === 'ALREADY_CANCELLED') {
      return NextResponse.json<ApiError>(
        { error: 'Venda já foi cancelada', code: 'ALREADY_CANCELLED' },
        { status: 422 }
      )
    }
    console.error('[POST /api/sales/[id]/cancel]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
