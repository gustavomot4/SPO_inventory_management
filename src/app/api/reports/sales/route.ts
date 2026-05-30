// =============================================================================
// GET /api/reports/sales  -- relatorio de vendas por periodo
// SPO -- Sistema Pimenta Ousada | REL-002 + REL-005
// =============================================================================
// Acesso: Protegido por PIN (middleware cobre /api/reports/:path*)
// Query: ?dateFrom=2026-05-01  ?dateTo=2026-05-31 (padrao: ultimos 30 dias)
//
// Custo/lucro sao ESTIMATIVAS baseadas no costCents atual do produto,
// nao num snapshot historico do momento da venda.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SALE_STATUS, PAYMENT_METHOD_LABELS } from '@/lib/enums'
import type { PaymentMethod } from '@/lib/enums'
import type {
  ApiSuccess,
  ApiError,
  SalesReportData,
  SalesReportSummary,
  SalesByPaymentMethod,
  TopVariation,
  SalesByDay,
} from '@/types'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = request.nextUrl

    const dateFrom = searchParams.get('dateFrom') || undefined
    const dateTo = searchParams.get('dateTo') || undefined

    const now = new Date()
    const todayEnd = now.toISOString().slice(0, 10) + 'T23:59:59.999Z'
    const thirtyDaysAgo =
      new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) +
      'T00:00:00.000Z'

    const from = dateFrom ? dateFrom + 'T00:00:00.000Z' : thirtyDaysAgo
    const to   = dateTo   ? dateTo   + 'T23:59:59.999Z' : todayEnd

    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: {
        items: {
          include: {
            variation: {
              select: {
                sku: true,
                size: true,
                color: true,
                product: {
                  select: {
                    name: true,
                    costCents: true, // estimativa -- baseada no custo atual do produto
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const activeSales = sales.filter((s) => s.status === SALE_STATUS.ACTIVE)
    const cancelledSales = sales.filter((s) => s.status === SALE_STATUS.CANCELLED)

    const totalRevenue = activeSales.reduce((sum, s) => sum + s.totalCents, 0)
    const totalDiscount = activeSales.reduce((sum, s) => sum + s.discountCents, 0)

    // estimativa de custo -- baseada no custo atual do produto (nao e snapshot)
    let totalEstimatedCostCents = 0
    let hasAnyCostData = false

    for (const sale of activeSales) {
      for (const item of sale.items) {
        const costPerUnit = item.variation.product.costCents ?? null
        if (costPerUnit !== null) {
          totalEstimatedCostCents += costPerUnit * item.quantity
          hasAnyCostData = true
        }
      }
    }

    const estimatedCostCents = hasAnyCostData ? totalEstimatedCostCents : null
    const estimatedProfitCents =
      estimatedCostCents !== null ? totalRevenue - estimatedCostCents : null
    const estimatedMarginPct =
      estimatedProfitCents !== null && totalRevenue > 0
        ? Math.round((estimatedProfitCents / totalRevenue) * 100)
        : null

    const summary: SalesReportSummary = {
      totalSales: activeSales.length,
      totalRevenue,
      totalDiscount,
      averageTicketCents:
        activeSales.length > 0 ? Math.round(totalRevenue / activeSales.length) : 0,
      cancelledCount: cancelledSales.length,
      estimatedCostCents,
      estimatedProfitCents,
      estimatedMarginPct,
    }

    // byPaymentMethod (apenas vendas ativas)
    const methodMap = new Map<string, { count: number; totalCents: number }>()
    for (const sale of activeSales) {
      const existing = methodMap.get(sale.paymentMethod) ?? { count: 0, totalCents: 0 }
      methodMap.set(sale.paymentMethod, {
        count: existing.count + 1,
        totalCents: existing.totalCents + sale.totalCents,
      })
    }
    const byPaymentMethod: SalesByPaymentMethod[] = Array.from(methodMap.entries())
      .map(([method, data]) => ({
        paymentMethod: method,
        paymentMethodLabel: PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method,
        count: data.count,
        totalCents: data.totalCents,
      }))
      .sort((a, b) => b.totalCents - a.totalCents)

    // topVariations (top 10 por quantidade, apenas itens de vendas ativas)
    type VarAcc = {
      sku: string
      size: string
      color: string
      productName: string
      costPerUnitCents: number | null
      qty: number
      revenue: number
    }
    const varMap = new Map<string, VarAcc>()

    for (const sale of activeSales) {
      for (const item of sale.items) {
        const existing = varMap.get(item.variationId) ?? {
          sku: item.variation.sku,
          size: item.variation.size,
          color: item.variation.color,
          productName: item.variation.product.name,
          costPerUnitCents: item.variation.product.costCents ?? null,
          qty: 0,
          revenue: 0,
        }
        varMap.set(item.variationId, {
          ...existing,
          qty: existing.qty + item.quantity,
          revenue: existing.revenue + item.subtotalCents,
        })
      }
    }

    const topVariations: TopVariation[] = Array.from(varMap.entries())
      .map(([variationId, v]) => {
        const costPerUnitCents = v.costPerUnitCents
        const avgUnitPrice = v.qty > 0 ? Math.round(v.revenue / v.qty) : 0
        const estimatedProfitCents =
          costPerUnitCents !== null ? (avgUnitPrice - costPerUnitCents) * v.qty : null
        return {
          variationId,
          variationSku: v.sku,
          productName: v.productName,
          size: v.size,
          color: v.color,
          quantitySold: v.qty,
          revenueCents: v.revenue,
          costPerUnitCents,
          estimatedProfitCents,
        }
      })
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 10)

    // byDay (apenas vendas ativas)
    const dayMap = new Map<string, { count: number; revenueCents: number }>()
    for (const sale of activeSales) {
      const day = sale.createdAt.slice(0, 10)
      const existing = dayMap.get(day) ?? { count: 0, revenueCents: 0 }
      dayMap.set(day, {
        count: existing.count + 1,
        revenueCents: existing.revenueCents + sale.totalCents,
      })
    }
    const byDay: SalesByDay[] = Array.from(dayMap.entries())
      .map(([date, data]) => ({ date, count: data.count, revenueCents: data.revenueCents }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const reportData: SalesReportData = { summary, byPaymentMethod, topVariations, byDay }

    return NextResponse.json<ApiSuccess<SalesReportData>>({ data: reportData })
  } catch (error) {
    console.error('[GET /api/reports/sales]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
