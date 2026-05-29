// =============================================================================
// POST /api/sales  — criar venda
// GET  /api/sales  — listar vendas (paginado)
// SPO — Sistema Pimenta Ousada | VEND-001 + VEND-002
// =============================================================================
//
// Acesso: Público (sem PIN).
//
// O POST executa tudo em $transaction:
//   Fase 1: Valida stock de TODOS os items antes de criar qualquer registro
//   Fase 2: Cria Sale + SaleItems
//   Fase 3: Para cada item — decrementa stockQuantity + cria StockMovement(SALE)
//
// RN-001: Estoque nunca pode ficar negativo (verificado antes da transaction)
// RN-004: unitPriceCents é snapshot imutável — lido do banco, NUNCA do body
// RN-010: Maquininha obrigatória para DEBIT/CREDIT; proibida para CASH/PIX
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  MOVEMENT_TYPE,
  SALE_STATUS,
  PAYMENT_METHOD,
  CARD_PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
} from '@/lib/enums'
import type { PaymentMethod } from '@/lib/enums'
import type {
  ApiSuccess,
  ApiError,
  SaleResponse,
  SaleListItem,
  SaleItemResponse,
} from '@/types'

// ---------------------------------------------------------------------------
// Helper: montar SaleResponse a partir de um sale com includes
// ---------------------------------------------------------------------------

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

function formatSaleResponse(sale: {
  id: string
  status: string
  paymentMethod: string
  subtotalCents: number
  discountCents: number
  totalCents: number
  cardMachineId: string | null
  feeCents: number | null
  notes: string | null
  cancelledAt: string | null
  cancelReason: string | null
  createdAt: string
  updatedAt: string
  cardMachine: { name: string } | null
  items: Array<{
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
  }>
}): SaleResponse {
  return {
    id: sale.id,
    status: sale.status,
    paymentMethod: sale.paymentMethod,
    paymentMethodLabel: PAYMENT_METHOD_LABELS[sale.paymentMethod as PaymentMethod] ?? sale.paymentMethod,
    subtotalCents: sale.subtotalCents,
    discountCents: sale.discountCents,
    totalCents: sale.totalCents,
    cardMachineId: sale.cardMachineId,
    cardMachineName: sale.cardMachine?.name ?? null,
    feeCents: sale.feeCents,
    notes: sale.notes,
    cancelledAt: sale.cancelledAt,
    cancelReason: sale.cancelReason,
    items: sale.items.map(formatSaleItem),
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
  }
}

// ---------------------------------------------------------------------------
// POST /api/sales
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

    const { paymentMethod, cardMachineId, discountCents, notes, items } =
      body as Record<string, unknown>

    // --- Validar paymentMethod ---
    if (!paymentMethod) {
      return NextResponse.json<ApiError>(
        { error: 'Os campos "paymentMethod" e "items" são obrigatórios', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }
    if (!(Object.values(PAYMENT_METHOD) as string[]).includes(paymentMethod as string)) {
      return NextResponse.json<ApiError>(
        {
          error: `Forma de pagamento inválida. Valores aceitos: ${Object.values(PAYMENT_METHOD).join(', ')}`,
          code: 'INVALID_PAYMENT_METHOD',
        },
        { status: 400 }
      )
    }

    const pm = paymentMethod as string
    const isCardPayment = CARD_PAYMENT_METHODS.includes(pm as typeof CARD_PAYMENT_METHODS[number])

    // --- Validar maquininha (RN-010) ---
    if (isCardPayment && !cardMachineId) {
      return NextResponse.json<ApiError>(
        { error: 'Maquininha de cartão é obrigatória para pagamentos com DEBIT ou CREDIT', code: 'CARD_MACHINE_REQUIRED' },
        { status: 400 }
      )
    }
    if (!isCardPayment && cardMachineId) {
      return NextResponse.json<ApiError>(
        { error: 'Maquininha de cartão não é permitida para pagamentos em CASH ou PIX', code: 'CARD_MACHINE_NOT_ALLOWED' },
        { status: 400 }
      )
    }

    // --- Validar items ---
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json<ApiError>(
        { error: 'Pelo menos um item é obrigatório', code: 'NO_ITEMS' },
        { status: 400 }
      )
    }

    // Validar shape de cada item
    for (const it of items as unknown[]) {
      const item = it as Record<string, unknown>
      if (!item.variationId || typeof item.variationId !== 'string') {
        return NextResponse.json<ApiError>(
          { error: 'Cada item deve ter "variationId" (string)', code: 'MISSING_FIELDS' },
          { status: 400 }
        )
      }
      if (
        item.quantity === undefined ||
        typeof item.quantity !== 'number' ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return NextResponse.json<ApiError>(
          { error: 'Cada item deve ter "quantity" (inteiro > 0)', code: 'MISSING_FIELDS' },
          { status: 400 }
        )
      }
    }

    // --- Validar discountCents ---
    const discount = (discountCents as number | undefined) ?? 0
    if (
      typeof discount !== 'number' ||
      !Number.isInteger(discount) ||
      discount < 0
    ) {
      return NextResponse.json<ApiError>(
        { error: 'O campo "discountCents" deve ser um inteiro >= 0', code: 'INVALID_DISCOUNT' },
        { status: 400 }
      )
    }

    // --- Verificar maquininha existe e está ativa ---
    type CardMachineRecord = { id: string; name: string; feeBasisPoints: number; isActive: boolean }
    let cardMachine: CardMachineRecord | null = null
    if (cardMachineId) {
      if (typeof cardMachineId !== 'string') {
        return NextResponse.json<ApiError>(
          { error: 'cardMachineId inválido', code: 'MISSING_FIELDS' },
          { status: 400 }
        )
      }
      cardMachine = await prisma.cardMachine.findUnique({
        where: { id: cardMachineId },
        select: { id: true, name: true, feeBasisPoints: true, isActive: true },
      }) as CardMachineRecord | null
      if (!cardMachine || !cardMachine.isActive) {
        return NextResponse.json<ApiError>(
          { error: 'Maquininha de cartão não encontrada ou inativa', code: 'CARD_MACHINE_NOT_FOUND' },
          { status: 422 }
        )
      }
    }

    // --- Buscar todas as variações em uma única query ---
    const variationIds = (items as Array<{ variationId: string; quantity: number }>).map(
      (i) => i.variationId
    )

    const variations = await prisma.productVariation.findMany({
      where: { id: { in: variationIds } },
      select: {
        id: true,
        sku: true,
        stockQuantity: true,
        isActive: true,
        product: {
          select: {
            priceCents: true,
            deletedAt: true,
            isActive: true,
          },
        },
      },
    })

    const variationMap = new Map(variations.map((v) => [v.id, v]))

    // --- Validar cada item individualmente ---
    type ResolvedItem = {
      variationId: string
      quantity: number
      unitPriceCents: number
      currentStock: number
    }
    const resolvedItems: ResolvedItem[] = []

    for (const it of items as Array<{ variationId: string; quantity: number }>) {
      const v = variationMap.get(it.variationId)

      if (!v) {
        return NextResponse.json<ApiError>(
          { error: `Variação não encontrada: ${it.variationId}`, code: 'VARIATION_NOT_FOUND' },
          { status: 422 }
        )
      }

      if (!v.isActive || !v.product.isActive || v.product.deletedAt !== null) {
        return NextResponse.json<ApiError>(
          { error: `Variação inativa ou produto deletado: ${it.variationId}`, code: 'VARIATION_INACTIVE' },
          { status: 422 }
        )
      }

      if (v.stockQuantity < it.quantity) {
        return NextResponse.json<ApiError>(
          {
            error: `Estoque insuficiente para variação ${v.sku}: disponível ${v.stockQuantity}, solicitado ${it.quantity}`,
            code: 'INSUFFICIENT_STOCK',
            details: {
              variationId: it.variationId,
              sku: v.sku,
              available: v.stockQuantity,
              requested: it.quantity,
            },
          },
          { status: 422 }
        )
      }

      resolvedItems.push({
        variationId: it.variationId,
        quantity: it.quantity,
        unitPriceCents: v.product.priceCents, // RN-004: snapshot do banco
        currentStock: v.stockQuantity,
      })
    }

    // --- Cálculos financeiros ---
    const subtotalCents = resolvedItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPriceCents,
      0
    )
    const totalCents = subtotalCents - discount

    if (totalCents < 0) {
      return NextResponse.json<ApiError>(
        { error: 'O desconto não pode ser maior que o subtotal', code: 'INVALID_DISCOUNT' },
        { status: 400 }
      )
    }

    const feeCents =
      cardMachine
        ? Math.round(totalCents * cardMachine.feeBasisPoints / 10000)
        : null

    // --- Criar tudo em $transaction ---
    const sale = await prisma.$transaction(async (tx) => {
      // 1. Criar Sale + SaleItems
      const created = await tx.sale.create({
        data: {
          status: SALE_STATUS.ACTIVE,
          paymentMethod: pm,
          subtotalCents,
          discountCents: discount,
          totalCents,
          cardMachineId: (cardMachineId as string | undefined) ?? null,
          feeCents,
          notes: (notes as string | null | undefined) ?? null,
          items: {
            create: resolvedItems.map((item) => ({
              variationId: item.variationId,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              subtotalCents: item.quantity * item.unitPriceCents,
            })),
          },
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

      // 2. Para cada item: decrementar stockQuantity + criar StockMovement
      for (const item of resolvedItems) {
        const newStock = item.currentStock - item.quantity

        await tx.productVariation.update({
          where: { id: item.variationId },
          data: { stockQuantity: newStock },
        })

        await tx.stockMovement.create({
          data: {
            variationId: item.variationId,
            saleId: created.id,
            type: MOVEMENT_TYPE.SALE,
            quantity: -item.quantity, // NEGATIVO — saída
            balanceAfter: newStock,
            notes: null,
          },
        })
      }

      return created
    })

    return NextResponse.json<ApiSuccess<SaleResponse>>(
      { data: formatSaleResponse(sale) },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/sales]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// GET /api/sales
// Query: ?status=ACTIVE|CANCELLED|ALL  ?paymentMethod=CASH|...
//        ?dateFrom=2026-05-01  ?dateTo=2026-05-31
//        ?cursor=xxx  ?pageSize=20
// Ordem: createdAt desc
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = request.nextUrl

    const statusParam = searchParams.get('status')?.toUpperCase() || 'ALL'
    if (!['ACTIVE', 'CANCELLED', 'ALL'].includes(statusParam)) {
      return NextResponse.json<ApiError>(
        { error: 'O parâmetro "status" deve ser ACTIVE, CANCELLED ou ALL', code: 'INVALID_PARAM' },
        { status: 400 }
      )
    }

    const paymentMethodParam = searchParams.get('paymentMethod')?.toUpperCase() || undefined
    if (
      paymentMethodParam &&
      !(Object.values(PAYMENT_METHOD) as string[]).includes(paymentMethodParam as string)
    ) {
      return NextResponse.json<ApiError>(
        { error: 'Valor de "paymentMethod" inválido', code: 'INVALID_PARAM' },
        { status: 400 }
      )
    }

    const dateFrom = searchParams.get('dateFrom') || undefined
    const dateTo = searchParams.get('dateTo') || undefined
    const cursor = searchParams.get('cursor') || undefined
    const pageSizeParam = parseInt(searchParams.get('pageSize') || '20', 10)
    const pageSize = Math.min(Math.max(1, isNaN(pageSizeParam) ? 20 : pageSizeParam), 100)

    // Filtro de data: comparação lexicográfica de strings ISO 8601
    const dateFilter: Record<string, string> = {}
    if (dateFrom) dateFilter.gte = `${dateFrom}T00:00:00.000Z`
    if (dateTo) dateFilter.lte = `${dateTo}T23:59:59.999Z`

    const sales = await prisma.sale.findMany({
      take: pageSize + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: {
        ...(statusParam !== 'ALL' ? { status: statusParam } : {}),
        ...(paymentMethodParam ? { paymentMethod: paymentMethodParam } : {}),
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        cardMachine: { select: { name: true } },
        _count: { select: { items: true } },
      },
    })

    const hasNextPage = sales.length > pageSize
    if (hasNextPage) sales.pop()

    const lastItem = sales.at(-1)

    const data: SaleListItem[] = sales.map((s) => ({
      id: s.id,
      status: s.status,
      paymentMethod: s.paymentMethod,
      paymentMethodLabel: PAYMENT_METHOD_LABELS[s.paymentMethod as PaymentMethod] ?? s.paymentMethod,
      subtotalCents: s.subtotalCents,
      discountCents: s.discountCents,
      totalCents: s.totalCents,
      cardMachineName: s.cardMachine?.name ?? null,
      feeCents: s.feeCents,
      itemCount: s._count.items,
      createdAt: s.createdAt,
    }))

    return NextResponse.json<ApiSuccess<SaleListItem[]>>({
      data,
      meta: {
        pageSize,
        hasNextPage,
        cursor: hasNextPage && lastItem ? lastItem.id : undefined,
      },
    })
  } catch (error) {
    console.error('[GET /api/sales]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
