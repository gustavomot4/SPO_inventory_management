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

// Rota dinâmica: usa searchParams + sessão PIN. Evita tentativa de prerender estático.
export const dynamic = 'force-dynamic'

import { storeDayStartToUtc, storeDayEndToUtc, utcToStoreDay, storeToday, isValidYmd } from '@/lib/timezone'
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

    // QA-036 + QA-070: validar formato E data de calendário real (rejeita 2026-13-45)
    if (dateFrom && !isValidYmd(dateFrom)) {
      return NextResponse.json<ApiError>(
        { error: 'O parâmetro "dateFrom" deve ser uma data válida no formato YYYY-MM-DD (ex: 2026-01-01)', code: 'INVALID_PARAM' },
        { status: 400 }
      )
    }
    if (dateTo && !isValidYmd(dateTo)) {
      return NextResponse.json<ApiError>(
        { error: 'O parâmetro "dateTo" deve ser uma data válida no formato YYYY-MM-DD (ex: 2026-12-31)', code: 'INVALID_PARAM' },
        { status: 400 }
      )
    }

    // QA-055: limites calculados no fuso da loja (UTC−3). Antes, a data local era
    // tratada como UTC, fazendo vendas após 21h (BRT) caírem no dia errado.
    const today = storeToday() // YYYY-MM-DD no horário da loja
    // Instante UTC da meia-noite (no fuso da loja) de hoje; 30 dias antes = padrão.
    const todayStartMs = new Date(storeDayStartToUtc(today)).getTime()

    const from = dateFrom
      ? storeDayStartToUtc(dateFrom)
      : new Date(todayStartMs - 30 * 24 * 60 * 60 * 1000).toISOString()
    const to = dateTo ? storeDayEndToUtc(dateTo) : storeDayEndToUtc(today)

    // QA-033: validar intervalo maximo de 366 dias
    const diffDays = (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays > 366) {
      return NextResponse.json<ApiError>(
        { error: 'O período máximo permitido é de 12 meses. Refine o intervalo de datas.', code: 'DATE_RANGE_TOO_LARGE' },
        { status: 400 }
      )
    }

    const SALES_REPORT_LIMIT = 5000

    // QA-053: contar o total real de vendas no periodo ANTES de aplicar o limite.
    // Sem isso, um periodo com mais de 5000 vendas era truncado silenciosamente
    // (orderBy asc → mantinha as MAIS ANTIGAS), subestimando receita/lucro sem
    // nenhum aviso. Agora detectamos o truncamento e sinalizamos ao usuario.
    const totalSalesInPeriod = await prisma.sale.count({
      where: { createdAt: { gte: from, lte: to } },
    })
    const truncated = totalSalesInPeriod > SALES_REPORT_LIMIT

    const sales = await prisma.sale.findMany({
      take: SALES_REPORT_LIMIT, // QA-033: limite de seguranca — evita carregar todo o historico em memoria
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

    // taxas de maquininha -- soma real gravada no momento da venda
    const totalFeeCents = activeSales.reduce((sum, s) => sum + (s.feeCents ?? 0), 0)
    const netRevenueCents = totalRevenue - totalFeeCents
    const feePercentage =
      totalFeeCents > 0 && totalRevenue > 0
        ? Math.round((totalFeeCents / totalRevenue) * 1000) / 10
        : null

    // lucro = receita - custo dos produtos - taxas de maquininha
    const estimatedProfitCents =
      estimatedCostCents !== null ? totalRevenue - estimatedCostCents - totalFeeCents : null
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
      totalFeeCents,
      netRevenueCents,
      feePercentage,
      truncated,
      totalSalesInPeriod,
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
      // QA-055: agrupar pelo dia comercial da loja (UTC−3), não pelo dia UTC
      const day = utcToStoreDay(sale.createdAt)
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
