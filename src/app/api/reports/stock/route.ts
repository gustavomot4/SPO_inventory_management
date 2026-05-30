// =============================================================================
// GET /api/reports/stock  -- relatorio de posicao de estoque
// SPO -- Sistema Pimenta Ousada | REL-001
// =============================================================================
// Acesso: Protegido por PIN (middleware cobre /api/reports/:path*)
//
// Query: ?status=all|ok|low|out  ?categoryId=xxx
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStockStatus } from '@/lib/utils'
import type { ApiSuccess, ApiError, StockReportItem, StockReportMeta } from '@/types'

type StockReportSuccess = ApiSuccess<StockReportItem[]> & { meta: StockReportMeta }

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

    const variations = await prisma.productVariation.findMany({
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
          include: { category: { select: { name: true } } },
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
      .map((v) => ({
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
      }))
      .filter((item) => statusParam === 'all' || item.status === statusParam)

    items.sort(
      (a, b) =>
        (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2) ||
        a.productName.localeCompare(b.productName)
    )

    const meta: StockReportMeta = {
      total: items.length,
      outCount: items.filter((i) => i.status === 'out').length,
      lowCount: items.filter((i) => i.status === 'low').length,
      okCount: items.filter((i) => i.status === 'ok').length,
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
