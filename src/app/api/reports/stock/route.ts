// =============================================================================
// GET /api/reports/stock  -- relatorio de posicao de estoque
// SPO -- Sistema Pimenta Ousada | REL-001 + REL-005
// =============================================================================
// Acesso: Protegido por PIN (middleware cobre /api/reports/:path*)
// Query: ?status=all|ok|low|out  ?categoryId=xxx
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStockStatus } from '@/lib/utils'
import type { ApiError, StockReportItem, StockReportMeta } from '@/types'

// Rota dinâmica: usa searchParams + sessão PIN. Evita tentativa de prerender estático.
export const dynamic = 'force-dynamic'

type StockReportSuccess = { data: StockReportItem[]; meta: StockReportMeta }

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = request.nextUrl

    const statusParam = searchParams.get('status')?.toLowerCase() || 'all'
    if (!['all', 'ok', 'low', 'out'].includes(statusParam)) {
      return NextResponse.json<ApiError>(
        { error: 'O parametro "status" deve ser all, ok, low ou out', code: 'INVALID_PARAM' },
        { status: 400 }
      )
    }

    const categoryId = searchParams.get('categoryId') || undefined

    // QA-009: limite de 2000 variações por consulta — suficiente para qualquer loja física
    const variations = await prisma.productVariation.findMany({
      take: 2000,
      where: {
        isActive: true,
        product: {
          isActive: true,
          deletedAt: null,
          ...(categoryId ? { categoryId } : {}),
        },
      },
      include: {
        product: {
          select: {
            name: true,
            priceCents: true,
            costCents: true,
            category: { select: { name: true } },
          },
        },
      },
      orderBy: [
        { product: { name: 'asc' } },
        { size: 'asc' },
        { color: 'asc' },
      ],
    })

    const statusOrder: Record<string, number> = { out: 0, low: 1, ok: 2 }

    const items: StockReportItem[] = variations
      .map((v) => {
        const priceCents = v.product.priceCents
        const costCents = v.product.costCents ?? null
        const stockValueCents = v.stockQuantity * priceCents
        const stockCostCents = costCents !== null ? v.stockQuantity * costCents : null

        return {
          variationId: v.id,
          variationSku: v.sku,
          productId: v.productId,
          productName: v.product.name,
          categoryName: v.product.category.name,
          size: v.size,
          color: v.color,
          stockQuantity: v.stockQuantity,
          minStock: v.minStock,
          status: getStockStatus(v.stockQuantity, v.minStock) as 'ok' | 'low' | 'out',
          priceCents,
          costCents,
          stockValueCents,
          stockCostCents,
        }
      })
      .filter((item) => statusParam === 'all' || item.status === statusParam)

    items.sort(
      (a, b) =>
        (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2) ||
        a.productName.localeCompare(b.productName)
    )

    const totalStockValueCents = items.reduce((sum, i) => sum + i.stockValueCents, 0)
    const itemsWithCost = items.filter((i) => i.stockCostCents !== null)
    const totalStockCostCents =
      itemsWithCost.length > 0
        ? itemsWithCost.reduce((sum, i) => sum + (i.stockCostCents as number), 0)
        : null
    const estimatedPotentialProfitCents =
      totalStockCostCents !== null ? totalStockValueCents - totalStockCostCents : null

    const meta: StockReportMeta = {
      total: items.length,
      outCount: items.filter((i) => i.status === 'out').length,
      lowCount: items.filter((i) => i.status === 'low').length,
      okCount: items.filter((i) => i.status === 'ok').length,
      totalStockValueCents,
      totalStockCostCents,
      estimatedPotentialProfitCents,
    }

    const response: StockReportSuccess = { data: items, meta }
    return NextResponse.json(response)
  } catch (error) {
    console.error('[GET /api/reports/stock]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
