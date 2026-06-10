// =============================================================================
// GET /api/sales/[id]  — detalhar venda
// SPO — Sistema Pimenta Ousada | VEND-002
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PAYMENT_METHOD_LABELS } from '@/lib/enums'
import { isPinVerified } from '@/lib/pin-session'
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

export async function GET(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: params.id },
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

    if (!sale) {
      return NextResponse.json<ApiError>(
        { error: 'Venda não encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // QA-064: dados internos (taxa, maquininha) só aparecem com PIN verificado.
    // A comanda pública precisa do recurso, mas não da taxa/maquininha (COM-007).
    //
    // QA-073 (decisão intencional): a página /vendas/[id] é ABERTA — logo após
    // finalizar a venda, o PDV navega para cá SEM PIN para imprimir a comanda.
    // Nesse fluxo (vendedora), a taxa fica oculta também na tela de detalhe — é o
    // comportamento desejado (COM-007: taxa é dado interno). A dona chega ao
    // detalhe via /vendas (lista exige PIN), com sessão ativa, e vê a taxa.
    const showInternal = await isPinVerified(request)

    const responseData: SaleResponse = {
      id: sale.id,
      status: sale.status,
      paymentMethod: sale.paymentMethod,
      paymentMethodLabel: PAYMENT_METHOD_LABELS[sale.paymentMethod as PaymentMethod] ?? sale.paymentMethod,
      subtotalCents: sale.subtotalCents,
      discountCents: sale.discountCents,
      totalCents: sale.totalCents,
      cardMachineId: showInternal ? sale.cardMachineId : null,
      cardMachineName: showInternal ? (sale.cardMachine?.name ?? null) : null,
      feeCents: showInternal ? sale.feeCents : null,
      installments: sale.installments,
      installmentFeeBasisPoints: showInternal ? sale.installmentFeeBasisPoints : null,
      notes: sale.notes,
      cancelledAt: sale.cancelledAt,
      cancelReason: sale.cancelReason,
      items: sale.items.map(formatSaleItem),
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,
    }

    return NextResponse.json<ApiSuccess<SaleResponse>>({ data: responseData })
  } catch (error) {
    console.error('[GET /api/sales/[id]]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
