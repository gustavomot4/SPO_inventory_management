// =============================================================================
// POST /api/sales  -- criar venda
// GET  /api/sales  -- listar vendas (paginado)
// SPO -- Sistema Pimenta Ousada | VEND-001 + VEND-002 + VEND-007 + VEND-008
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
// Helpers
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
  installments: number
  installmentFeeBasisPoints: number | null
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
    installments: sale.installments,
    installmentFeeBasisPoints: sale.installmentFeeBasisPoints,
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
        { error: 'Body invalido', code: 'INVALID_BODY' },
        { status: 400 }
      )
    }

    const { paymentMethod, cardMachineId, installments: installmentsRaw, discountCents, notes, items } =
      body as Record<string, unknown>

    // --- Validar installments (opcional, default 1) ---
    const installmentsValue = installmentsRaw !== undefined ? installmentsRaw : 1
    if (
      typeof installmentsValue !== 'number' ||
      !Number.isInteger(installmentsValue) ||
      installmentsValue < 1 ||
      installmentsValue > 12
    ) {
      return NextResponse.json<ApiError>(
        { error: 'O campo "installments" deve ser um inteiro entre 1 e 12', code: 'INVALID_INSTALLMENTS' },
        { status: 400 }
      )
    }

    // --- Validar paymentMethod ---
    if (!paymentMethod) {
      return NextResponse.json<ApiError>(
        { error: 'Os campos "paymentMethod" e "items" sao obrigatorios', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }
    if (!(Object.values(PAYMENT_METHOD) as string[]).includes(paymentMethod as string)) {
      return NextResponse.json<ApiError>(
        {
          error: 'Forma de pagamento invalida. Valores aceitos: ' + Object.values(PAYMENT_METHOD).join(', '),
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
        { error: 'Maquininha de cartao e obrigatoria para pagamentos com DEBIT ou CREDIT', code: 'CARD_MACHINE_REQUIRED' },
        { status: 400 }
      )
    }
    if (!isCardPayment && cardMachineId) {
      return NextResponse.json<ApiError>(
        { error: 'Maquininha de cartao nao e permitida para pagamentos em CASH ou PIX', code: 'CARD_MACHINE_NOT_ALLOWED' },
        { status: 400 }
      )
    }

    // --- Validar items ---
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json<ApiError>(
        { error: 'Pelo menos um item e obrigatorio', code: 'NO_ITEMS' },
        { status: 400 }
      )
    }

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

    // --- Verificar maquininha existe e esta ativa ---
    type CardMachineRecord = { id: string; name: string; feeBasisPoints: number; isActive: boolean }
    let cardMachine: CardMachineRecord | null = null
    if (cardMachineId) {
      if (typeof cardMachineId !== 'string') {
        return NextResponse.json<ApiError>(
          { error: 'cardMachineId invalido', code: 'MISSING_FIELDS' },
          { status: 400 }
        )
      }
      cardMachine = await prisma.cardMachine.findUnique({
        where: { id: cardMachineId },
        select: { id: true, name: true, feeBasisPoints: true, isActive: true },
      }) as CardMachineRecord | null
      if (!cardMachine || !cardMachine.isActive) {
        return NextResponse.json<ApiError>(
          { error: 'Maquininha de cartao nao encontrada ou inativa', code: 'CARD_MACHINE_NOT_FOUND' },
          { status: 422 }
        )
      }
    }

    // --- QA-005: Rejeitar variationIds duplicados no mesmo pedido ---
    const variationIds = (items as Array<{ variationId: string; quantity: number }>).map(
      (i) => i.variationId
    )
    if (new Set(variationIds).size !== variationIds.length) {
      return NextResponse.json<ApiError>(
        { error: 'Itens duplicados no pedido: use um unico item por variacao', code: 'DUPLICATE_ITEMS' },
        { status: 400 }
      )
    }

    // --- Buscar todas as variacoes em uma unica query para validacao de produto/ativo ---
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

    // QA-001: currentStock removido de resolvedItems — leitura sera feita DENTRO da tx
    type ResolvedItem = {
      variationId: string
      quantity: number
      unitPriceCents: number
    }
    const resolvedItems: ResolvedItem[] = []

    for (const it of items as Array<{ variationId: string; quantity: number }>) {
      const v = variationMap.get(it.variationId)

      if (!v) {
        return NextResponse.json<ApiError>(
          { error: 'Variacao nao encontrada: ' + it.variationId, code: 'VARIATION_NOT_FOUND' },
          { status: 422 }
        )
      }

      if (!v.isActive || !v.product.isActive || v.product.deletedAt !== null) {
        return NextResponse.json<ApiError>(
          { error: 'Variacao inativa ou produto deletado: ' + it.variationId, code: 'VARIATION_INACTIVE' },
          { status: 422 }
        )
      }

      if (v.stockQuantity < it.quantity) {
        return NextResponse.json<ApiError>(
          {
            error: 'Estoque insuficiente para variacao ' + v.sku + ': disponivel ' + v.stockQuantity + ', solicitado ' + it.quantity,
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
        // QA-001: currentStock NAO armazenado aqui — seria valor stale (TOCTOU)
      })
    }

    // --- Calculos financeiros ---
    const subtotalCents = resolvedItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPriceCents,
      0
    )
    const totalCents = subtotalCents - discount

    if (totalCents < 0) {
      return NextResponse.json<ApiError>(
        { error: 'O desconto nao pode ser maior que o subtotal', code: 'INVALID_DISCOUNT' },
        { status: 400 }
      )
    }

    // --- Resolver installments e taxa de parcelamento (VEND-007) ---
    // installments so e valido para CREDIT; para CASH/PIX/DEBIT forcamos 1
    const finalInstallments = pm === PAYMENT_METHOD.CREDIT ? (installmentsValue as number) : 1
    let installmentFeeBasisPoints: number | null = null
    let feeCents: number | null = null

    if (cardMachine) {
      if (finalInstallments > 1) {
        const installmentRecord = await prisma.cardMachineInstallment.findFirst({
          where: {
            cardMachineId: cardMachine.id,
            installments: finalInstallments,
            isActive: true,
          },
          select: { feeBasisPoints: true },
        })

        if (!installmentRecord) {
          return NextResponse.json<ApiError>(
            {
              error: 'Parcelamento de ' + finalInstallments + 'x nao configurado para esta maquininha',
              code: 'INSTALLMENT_NOT_CONFIGURED',
            },
            { status: 422 }
          )
        }

        installmentFeeBasisPoints = installmentRecord.feeBasisPoints
        feeCents = Math.round(totalCents * installmentRecord.feeBasisPoints / 10000)
      } else {
        feeCents = Math.round(totalCents * cardMachine.feeBasisPoints / 10000)
      }
    }

    // --- Criar tudo em $transaction ---
    const sale = await prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          status: SALE_STATUS.ACTIVE,
          paymentMethod: pm,
          subtotalCents,
          discountCents: discount,
          totalCents,
          cardMachineId: (cardMachineId as string | undefined) ?? null,
          feeCents,
          installments: finalInstallments,
          installmentFeeBasisPoints,
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

      for (const item of resolvedItems) {
        // QA-001: updateMany com condicao atomica — evita TOCTOU / race condition
        // Se outro request ja decrementou o estoque, stockQuantity < item.quantity
        // e o update nao ocorre (count = 0), lancando erro e revertendo a tx.
        const updated = await tx.productVariation.updateMany({
          where: {
            id: item.variationId,
            stockQuantity: { gte: item.quantity },
          },
          data: { stockQuantity: { decrement: item.quantity } },
        })

        if (updated.count === 0) {
          throw Object.assign(
            new Error('INSUFFICIENT_STOCK'),
            { variationId: item.variationId }
          )
        }

        // Ler o valor atualizado para o balanceAfter do movimento
        const afterUpdate = await tx.productVariation.findUnique({
          where: { id: item.variationId },
          select: { stockQuantity: true },
        })
        const balanceAfter = afterUpdate?.stockQuantity ?? 0

        await tx.stockMovement.create({
          data: {
            variationId: item.variationId,
            saleId: created.id,
            type: MOVEMENT_TYPE.SALE,
            quantity: -item.quantity,
            balanceAfter,
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
    // QA-001: erro lancado pela tx quando estoque insuficiente em concorrencia
    if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') {
      const varId = (error as Error & { variationId?: string }).variationId
      return NextResponse.json<ApiError>(
        { error: 'Estoque insuficiente — produto vendido por outro acesso simultaneo', code: 'INSUFFICIENT_STOCK', details: { variationId: varId } },
        { status: 422 }
      )
    }
    console.error('[POST /api/sales]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// GET /api/sales
// Query: ?status=ACTIVE|CANCELLED|ALL  ?paymentMethod=CASH|PIX|DEBIT|CREDIT
//        ?dateFrom=2026-05-01  ?dateTo=2026-05-31
//        ?code=CMPRJKYD  (VEND-008: busca por prefixo do ID)
//        ?cursor=xxx  ?pageSize=20
// Ordem: createdAt desc
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = request.nextUrl

    const statusParam = searchParams.get('status')?.toUpperCase() || 'ALL'
    if (!['ACTIVE', 'CANCELLED', 'ALL'].includes(statusParam)) {
      return NextResponse.json<ApiError>(
        { error: 'O parametro "status" deve ser ACTIVE, CANCELLED ou ALL', code: 'INVALID_PARAM' },
        { status: 400 }
      )
    }

    const paymentMethodParam = searchParams.get('paymentMethod')?.toUpperCase() || undefined
    if (
      paymentMethodParam &&
      !(Object.values(PAYMENT_METHOD) as string[]).includes(paymentMethodParam as string)
    ) {
      return NextResponse.json<ApiError>(
        { error: 'Valor de "paymentMethod" invalido', code: 'INVALID_PARAM' },
        { status: 400 }
      )
    }

    const dateFrom = searchParams.get('dateFrom') || undefined
    const dateTo = searchParams.get('dateTo') || undefined
    const cursor = searchParams.get('cursor') || undefined
    const pageSizeParam = parseInt(searchParams.get('pageSize') || '20', 10)
    const pageSize = Math.min(Math.max(1, isNaN(pageSizeParam) ? 20 : pageSizeParam), 100)

    // VEND-008: busca por codigo (primeiros chars do ID, case-insensitive)
    const code = searchParams.get('code')?.trim().toLowerCase() || undefined

    // Filtro de data: comparacao lexicografica de strings ISO 8601
    const dateFilter: Record<string, string> = {}
    if (dateFrom) dateFilter['gte'] = dateFrom + 'T00:00:00.000Z'
    if (dateTo) dateFilter['lte'] = dateTo + 'T23:59:59.999Z'

    const sales = await prisma.sale.findMany({
      take: pageSize + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: {
        ...(statusParam !== 'ALL' ? { status: statusParam } : {}),
        ...(paymentMethodParam ? { paymentMethod: paymentMethodParam } : {}),
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        ...(code ? { id: { startsWith: code } } : {}),
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
      installments: s.installments,
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
