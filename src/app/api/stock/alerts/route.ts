// =============================================================================
// GET /api/stock/alerts  — alertas de estoque baixo e zerado
// SPO — Sistema Pimenta Ousada | EST-004
// =============================================================================
//
// Acesso: Público.
//
// Retorna variações onde stockQuantity <= minStock, isActive=true e
// produto não deletado (deletedAt=null).
//
// Classificação:
//   OUT: stockQuantity === 0
//   LOW: stockQuantity > 0 && stockQuantity <= minStock
//
// Ordem: OUT primeiro → LOW → productName asc
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStockStatus } from '@/lib/utils'

export const dynamic = 'force-dynamic'
import type { ApiSuccess, ApiError, StockAlertItem } from '@/types'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = request.nextUrl
    const statusFilter = searchParams.get('status')?.toUpperCase() || 'ALL'

    if (!['OUT', 'LOW', 'ALL'].includes(statusFilter)) {
      return NextResponse.json<ApiError>(
        { error: 'O parâmetro "status" deve ser OUT, LOW ou ALL', code: 'INVALID_PARAM' },
        { status: 400 }
      )
    }

    // Buscar variações com stockQuantity <= minStock, ativas, produto não deletado
    const variations = await prisma.productVariation.findMany({
      where: {
        isActive: true,
        product: { deletedAt: null },
        // Prisma não suporta WHERE colA <= colB diretamente — filtrar em JS
        // Buscar todas as ativas e filtrar depois (dataset pequeno para loja física)
      },
      select: {
        id: true,
        sku: true,
        size: true,
        color: true,
        stockQuantity: true,
        minStock: true,
        product: {
          select: {
            id: true,
            name: true,
            category: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: [{ product: { name: 'asc' } }],
    })

    // Filtrar: apenas variações onde stockQuantity <= minStock
    const alerts: StockAlertItem[] = []

    for (const v of variations) {
      const rawStatus = getStockStatus(v.stockQuantity, v.minStock)
      if (rawStatus === 'ok') continue

      const status: 'OUT' | 'LOW' = rawStatus === 'out' ? 'OUT' : 'LOW'

      // Aplicar filtro de status da query
      if (statusFilter !== 'ALL' && status !== statusFilter) continue

      alerts.push({
        variationId: v.id,
        variationSku: v.sku,
        size: v.size,
        color: v.color,
        stockQuantity: v.stockQuantity,
        minStock: v.minStock,
        status,
        productId: v.product.id,
        productName: v.product.name,
        categoryId: v.product.category.id,
        categoryName: v.product.category.name,
      })
    }

    // Ordenar: OUT primeiro, depois LOW, depois productName asc (já vem ordenado do banco)
    alerts.sort((a, b) => {
      if (a.status === b.status) return 0
      return a.status === 'OUT' ? -1 : 1
    })

    return NextResponse.json<ApiSuccess<StockAlertItem[]>>({
      data: alerts,
      meta: { total: alerts.length },
    })
  } catch (error) {
    console.error('[GET /api/stock/alerts]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
