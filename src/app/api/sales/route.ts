// =============================================================================
// POST /api/sales  -- criar venda
// GET  /api/sales  -- listar vendas (paginado)
// SPO -- Sistema Pimenta Ousada | VEND-001 + VEND-002 + VEND-007 + VEND-008
// QA-001: decremento atomico dentro da tx (updateMany + gte) evita race condition
// QA-005: rejeita variationIds duplicados no mesmo pedido
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  MOVEMENT_TYPE, SALE_STATUS, PAYMENT_METHOD,
  CARD_PAYMENT_METHODS, PAYMENT_METHOD_LABELS,
} from '@/lib/enums'
import type { PaymentMethod } from '@/lib/enums'
import { storeDayStartToUtc, storeDayEndToUtc } from '@/lib/timezone'
import type { ApiSuccess, ApiError, SaleResponse, SaleListItem, SaleItemResponse } from '@/types'

function formatSaleItem(item: {
  id: string; variationId: string; quantity: number
  unitPriceCents: number; subtotalCents: number
  variation: { sku: string; size: string; color: string; product: { name: string } }
}): SaleItemResponse {
  return {
    id: item.id, variationId: item.variationId,
    variationSku: item.variation.sku, productName: item.variation.product.name,
    size: item.variation.size, color: item.variation.color,
    quantity: item.quantity, unitPriceCents: item.unitPriceCents,
    subtotalCents: item.subtotalCents,
  }
}

function formatSaleResponse(sale: {
  id: string; status: string; paymentMethod: string
  subtotalCents: number; discountCents: number; totalCents: number
  cardMachineId: string | null; feeCents: number | null
  installments: number; installmentFeeBasisPoints: number | null
  notes: string | null; cancelledAt: string | null; cancelReason: string | null
  createdAt: string; updatedAt: string
  cardMachine: { name: string } | null
  items: Array<{
    id: string; variationId: string; quantity: number
    unitPriceCents: number; subtotalCents: number
    variation: { sku: string; size: string; color: string; product: { name: string } }
  }>
}): SaleResponse {
  return {
    id: sale.id, status: sale.status, paymentMethod: sale.paymentMethod,
    paymentMethodLabel: PAYMENT_METHOD_LABELS[sale.paymentMethod as PaymentMethod] ?? sale.paymentMethod,
    subtotalCents: sale.subtotalCents, discountCents: sale.discountCents, totalCents: sale.totalCents,
    cardMachineId: sale.cardMachineId, cardMachineName: sale.cardMachine?.name ?? null,
    feeCents: sale.feeCents, installments: sale.installments,
    installmentFeeBasisPoints: sale.installmentFeeBasisPoints,
    notes: sale.notes, cancelledAt: sale.cancelledAt, cancelReason: sale.cancelReason,
    items: sale.items.map(formatSaleItem),
    createdAt: sale.createdAt, updatedAt: sale.updatedAt,
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown
    try { body = await request.json() } catch {
      return NextResponse.json<ApiError>({ error: 'Body invalido', code: 'INVALID_BODY' }, { status: 400 })
    }

    const { paymentMethod, cardMachineId, installments: installmentsRaw, discountCents, notes, items } =
      body as Record<string, unknown>

    const installmentsValue = installmentsRaw !== undefined ? installmentsRaw : 1
    if (typeof installmentsValue !== 'number' || !Number.isInteger(installmentsValue) ||
      installmentsValue < 1 || installmentsValue > 12) {
      return NextResponse.json<ApiError>(
        { error: 'O campo "installments" deve ser um inteiro entre 1 e 12', code: 'INVALID_INSTALLMENTS' },
        { status: 400 }
      )
    }

    if (!paymentMethod) {
      return NextResponse.json<ApiError>(
        { error: 'Os campos "paymentMethod" e "items" sao obrigatorios', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }
    if (!(Object.values(PAYMENT_METHOD) as string[]).includes(paymentMethod as string)) {
      return NextResponse.json<ApiError>(
        { error: 'Forma de pagamento invalida. Valores aceitos: ' + Object.values(PAYMENT_METHOD).join(', '), code: 'INVALID_PAYMENT_METHOD' },
        { status: 400 }
      )
    }

    const pm = paymentMethod as string
    const isCardPayment = CARD_PAYMENT_METHODS.includes(pm as typeof CARD_PAYMENT_METHODS[number])

    if (isCardPayment && !cardMachineId) {
      return NextResponse.json<ApiError>(
        { error: 'Maquininha de cartao e obrigatoria para DEBIT ou CREDIT', code: 'CARD_MACHINE_REQUIRED' },
        { status: 400 }
      )
    }
    if (!isCardPayment && cardMachineId) {
      return NextResponse.json<ApiError>(
        { error: 'Maquininha nao permitida para CASH ou PIX', code: 'CARD_MACHINE_NOT_ALLOWED' },
        { status: 400 }
      )
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json<ApiError>(
        { error: 'Pelo menos um item e obrigatorio', code: 'NO_ITEMS' }, { status: 400 }
      )
    }

    for (const it of items as unknown[]) {
      const item = it as Record<string, unknown>
      if (!item.variationId || typeof item.variationId !== 'string') {
        return NextResponse.json<ApiError>(
          { error: 'Cada item deve ter "variationId" (string)', code: 'MISSING_FIELDS' }, { status: 400 }
        )
      }
      if (item.quantity === undefined || typeof item.quantity !== 'number' ||
        !Number.isInteger(item.quantity) || item.quantity <= 0) {
        return NextResponse.json<ApiError>(
          { error: 'Cada item deve ter "quantity" (inteiro > 0)', code: 'MISSING_FIELDS' }, { status: 400 }
        )
      }
    }

    const discount = (discountCents as number | undefined) ?? 0
    if (typeof discount !== 'number' || !Number.isInteger(discount) || discount < 0) {
      return NextResponse.json<ApiError>(
        { error: 'O campo "discountCents" deve ser um inteiro >= 0', code: 'INVALID_DISCOUNT' }, { status: 400 }
      )
    }

    // QA-043: limite de tamanho em campos de texto livre
    if (notes !== undefined && notes !== null) {
      if (typeof notes !== 'string' || notes.length > 500) {
        return NextResponse.json<ApiError>(
          { error: 'O campo "notes" deve ter no máximo 500 caracteres', code: 'INVALID_NOTES' }, { status: 400 }
        )
      }
    }

    type CardMachineRecord = { id: string; name: string; feeBasisPoints: number; isActive: boolean }
    let cardMachine: CardMachineRecord | null = null
    if (cardMachineId) {
      if (typeof cardMachineId !== 'string') {
        return NextResponse.json<ApiError>(
          { error: 'cardMachineId invalido', code: 'MISSING_FIELDS' }, { status: 400 }
        )
      }
      cardMachine = await prisma.cardMachine.findUnique({
        where: { id: cardMachineId as string },
        select: { id: true, name: true, feeBasisPoints: true, isActive: true },
      }) as CardMachineRecord | null
      if (!cardMachine || !cardMachine.isActive) {
        return NextResponse.json<ApiError>(
          { error: 'Maquininha nao encontrada ou inativa', code: 'CARD_MACHINE_NOT_FOUND' }, { status: 422 }
        )
      }
    }

    // QA-005: rejeitar variationIds duplicados
    const variationIds = (items as Array<{ variationId: string; quantity: number }>).map(i => i.variationId)
    if (new Set(variationIds).size !== variationIds.length) {
      return NextResponse.json<ApiError>(
        { error: 'Itens duplicados: use um unico item por variacao', code: 'DUPLICATE_ITEMS' }, { status: 400 }
      )
    }

    const variations = await prisma.productVariation.findMany({
      where: { id: { in: variationIds } },
      select: {
        id: true, sku: true, stockQuantity: true, isActive: true,
        product: { select: { priceCents: true, deletedAt: true, isActive: true } },
      },
    })

    const variationMap = new Map(variations.map(v => [v.id, v]))

    // QA-001: currentStock NAO armazenado — decremento atomico ocorre dentro da tx
    type ResolvedItem = { variationId: string; quantity: number; unitPriceCents: number }
    const resolvedItems: ResolvedItem[] = []

    for (const it of items as Array<{ variationId: string; quantity: number }>) {
      const v = variationMap.get(it.variationId)
      if (!v) {
        return NextResponse.json<ApiError>(
          { error: 'Variacao nao encontrada: ' + it.variationId, code: 'VARIATION_NOT_FOUND' }, { status: 422 }
        )
      }
      if (!v.isActive || !v.product.isActive || v.product.deletedAt !== null) {
        return NextResponse.json<ApiError>(
          { error: 'Variacao inativa ou produto deletado: ' + it.variationId, code: 'VARIATION_INACTIVE' }, { status: 422 }
        )
      }
      if (v.stockQuantity < it.quantity) {
        return NextResponse.json<ApiError>(
          {
            error: 'Estoque insuficiente para ' + v.sku + ': disponivel ' + v.stockQuantity + ', solicitado ' + it.quantity,
            code: 'INSUFFICIENT_STOCK',
            details: { variationId: it.variationId, sku: v.sku, available: v.stockQuantity, requested: it.quantity },
          },
          { status: 422 }
        )
      }
      resolvedItems.push({ variationId: it.variationId, quantity: it.quantity, unitPriceCents: v.product.priceCents })
    }

    const subtotalCents = resolvedItems.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0)
    const totalCents = subtotalCents - discount

    if (totalCents < 0) {
      return NextResponse.json<ApiError>(
        { error: 'O desconto nao pode ser maior que o subtotal', code: 'INVALID_DISCOUNT' }, { status: 400 }
      )
    }

    const finalInstallments = pm === PAYMENT_METHOD.CREDIT ? (installmentsValue as number) : 1
    let installmentFeeBasisPoints: number | null = null
    let feeCents: number | null = null

    if (cardMachine) {
      if (finalInstallments > 1) {
        const instRecord = await prisma.cardMachineInstallment.findFirst({
          where: { cardMachineId: cardMachine.id, installments: finalInstallments, isActive: true },
          select: { feeBasisPoints: true },
        })
        if (!instRecord) {
          return NextResponse.json<ApiError>(
            { error: 'Parcelamento de ' + finalInstallments + 'x nao configurado para esta maquininha', code: 'INSTALLMENT_NOT_CONFIGURED' },
            { status: 422 }
          )
        }
        installmentFeeBasisPoints = instRecord.feeBasisPoints
        feeCents = Math.round(totalCents * instRecord.feeBasisPoints / 10000)
      } else {
        feeCents = Math.round(totalCents * cardMachine.feeBasisPoints / 10000)
      }
    }

    // QA-001: tx com updateMany atomico — evita TOCTOU / race condition de estoque
    const sale = await prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          status: SALE_STATUS.ACTIVE,
          paymentMethod: pm,
          subtotalCents, discountCents: discount, totalCents,
          cardMachineId: (cardMachineId as string | undefined) ?? null,
          feeCents, installments: finalInstallments, installmentFeeBasisPoints,
          notes: (notes as string | null | undefined) ?? null,
          items: {
            create: resolvedItems.map(item => ({
              variationId: item.variationId, quantity: item.quantity,
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
                select: { sku: true, size: true, color: true, product: { select: { name: true } } },
              },
            },
          },
        },
      })

      for (const item of resolvedItems) {
        // QA-001: condicao atomica — se outro request ja decrementou, count=0 e tx reverte
        const updated = await tx.productVariation.updateMany({
          where: { id: item.variationId, stockQuantity: { gte: item.quantity } },
          data: { stockQuantity: { decrement: item.quantity } },
        })

        if (updated.count === 0) {
          throw Object.assign(new Error('INSUFFICIENT_STOCK'), { variationId: item.variationId })
        }

        const afterUpdate = await tx.productVariation.findUnique({
          where: { id: item.variationId },
          select: { stockQuantity: true },
        })

        await tx.stockMovement.create({
          data: {
            variationId: item.variationId, saleId: created.id,
            type: MOVEMENT_TYPE.SALE, quantity: -item.quantity,
            balanceAfter: afterUpdate?.stockQuantity ?? 0, notes: null,
          },
        })
      }

      return created
    })

    return NextResponse.json<ApiSuccess<SaleResponse>>(
      { data: formatSaleResponse(sale) }, { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') {
      const varId = (error as Error & { variationId?: string }).variationId
      return NextResponse.json<ApiError>(
        { error: 'Estoque insuficiente — produto vendido simultaneamente', code: 'INSUFFICIENT_STOCK', details: { variationId: varId } },
        { status: 422 }
      )
    }
    console.error('[POST /api/sales]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' }, { status: 500 }
    )
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = request.nextUrl

    const statusParam = searchParams.get('status')?.toUpperCase() || 'ALL'
    if (!['ACTIVE', 'CANCELLED', 'ALL'].includes(statusParam)) {
      return NextResponse.json<ApiError>(
        { error: 'O parametro "status" deve ser ACTIVE, CANCELLED ou ALL', code: 'INVALID_PARAM' }, { status: 400 }
      )
    }

    const paymentMethodParam = searchParams.get('paymentMethod')?.toUpperCase() || undefined
    if (paymentMethodParam && !(Object.values(PAYMENT_METHOD) as string[]).includes(paymentMethodParam)) {
      return NextResponse.json<ApiError>(
        { error: 'Valor de "paymentMethod" invalido', code: 'INVALID_PARAM' }, { status: 400 }
      )
    }

    const dateFrom = searchParams.get('dateFrom') || undefined
    const dateTo = searchParams.get('dateTo') || undefined
    const cursor = searchParams.get('cursor') || undefined

    // QA-036: validar formato YYYY-MM-DD
    const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
    if (dateFrom && !DATE_REGEX.test(dateFrom)) {
      return NextResponse.json<ApiError>(
        { error: 'O parâmetro "dateFrom" deve estar no formato YYYY-MM-DD', code: 'INVALID_PARAM' },
        { status: 400 }
      )
    }
    if (dateTo && !DATE_REGEX.test(dateTo)) {
      return NextResponse.json<ApiError>(
        { error: 'O parâmetro "dateTo" deve estar no formato YYYY-MM-DD', code: 'INVALID_PARAM' },
        { status: 400 }
      )
    }
    const pageSizeParam = parseInt(searchParams.get('pageSize') || '20', 10)
    const pageSize = Math.min(Math.max(1, isNaN(pageSizeParam) ? 20 : pageSizeParam), 100)
    const code = searchParams.get('code')?.trim().toLowerCase() || undefined

    // QA-055: limites no fuso da loja (UTC−3) para que "Hoje" inclua as vendas
    // do fim do expediente (após 21h BRT), que em UTC já pertencem ao dia seguinte.
    const dateFilter: Record<string, string> = {}
    if (dateFrom) dateFilter['gte'] = storeDayStartToUtc(dateFrom)
    if (dateTo) dateFilter['lte'] = storeDayEndToUtc(dateTo)

    const sales = await prisma.sale.findMany({
      take: pageSize + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: {
        ...(statusParam !== 'ALL' ? { status: statusParam } : {}),
        ...(paymentMethodParam ? { paymentMethod: paymentMethodParam } : {}),
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        ...(code ? { id: { startsWith: code } } : {}),
      },
      // QA-054: orderBy determinístico — createdAt sozinho não é único (várias vendas
      // podem ter o mesmo timestamp num PDV movimentado). Sem um critério de desempate
      // único, a paginação por cursor (cursor: { id }) pode pular ou duplicar registros
      // na fronteira de página ("Carregar mais"). Adicionar id como desempate torna a
      // ordenação total e a paginação estável.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        cardMachine: { select: { name: true } },
        _count: { select: { items: true } },
      },
    })

    const hasNextPage = sales.length > pageSize
    if (hasNextPage) sales.pop()
    const lastItem = sales.at(-1)

    const data: SaleListItem[] = sales.map(s => ({
      id: s.id, status: s.status, paymentMethod: s.paymentMethod,
      paymentMethodLabel: PAYMENT_METHOD_LABELS[s.paymentMethod as PaymentMethod] ?? s.paymentMethod,
      subtotalCents: s.subtotalCents, discountCents: s.discountCents, totalCents: s.totalCents,
      cardMachineName: s.cardMachine?.name ?? null,
      feeCents: s.feeCents, itemCount: s._count.items,
      installments: s.installments, createdAt: s.createdAt,
    }))

    return NextResponse.json<ApiSuccess<SaleListItem[]>>({
      data,
      meta: { pageSize, hasNextPage, cursor: hasNextPage && lastItem ? lastItem.id : undefined },
    })
  } catch (error) {
    console.error('[GET /api/sales]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' }, { status: 500 }
    )
  }
}
