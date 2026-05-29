// =============================================================================
// GET  /api/products  — listagem paginada com filtros
// POST /api/products  — criar produto + variações em transaction
// SPO — Sistema Pimenta Ousada | PROD-002 + PROD-003
// =============================================================================
//
// Acesso: Público.
// Paginação: cursor-based (id do último item) com pageSize padrão 20, máx 100.
// SKU: gerado automaticamente via src/lib/sku.ts quando não informado.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateSku } from '@/lib/sku'
import type { ApiSuccess, ApiError, ProductListItem, ProductResponse, VariationResponse } from '@/types'

// ---------------------------------------------------------------------------
// Helper: formatar variação para resposta
// ---------------------------------------------------------------------------

function formatVariation(v: {
  id: string
  sku: string
  size: string
  color: string
  stockQuantity: number
  minStock: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}): VariationResponse {
  return {
    id: v.id,
    sku: v.sku,
    size: v.size,
    color: v.color,
    stockQuantity: v.stockQuantity,
    minStock: v.minStock,
    isActive: v.isActive,
    isLowStock: v.stockQuantity > 0 && v.stockQuantity <= v.minStock,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  }
}

// ---------------------------------------------------------------------------
// GET /api/products
// Query params:
//   ?search=blusa         — busca por nome (LIKE %texto%)
//   ?categoryId=xxx       — filtrar por categoria
//   ?isActive=true|false  — padrão: true
//   ?includeDeleted=true  — incluir produtos com deletedAt != null
//   ?cursor=xxx           — cursor para paginação (id do último item)
//   ?pageSize=20          — itens por página (padrão 20, máx 100)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = request.nextUrl

    const search = searchParams.get('search')?.trim() || undefined
    const categoryId = searchParams.get('categoryId') || undefined
    const cursor = searchParams.get('cursor') || undefined
    const includeDeleted = searchParams.get('includeDeleted') === 'true'

    // isActive: padrão true, a menos que explicitamente passado como false
    const isActiveParam = searchParams.get('isActive')
    const isActiveFilter = isActiveParam === 'false' ? false : isActiveParam === 'true' ? true : true

    const pageSizeParam = parseInt(searchParams.get('pageSize') || '20', 10)
    const pageSize = Math.min(Math.max(1, isNaN(pageSizeParam) ? 20 : pageSizeParam), 100)

    // Buscar pageSize + 1 para saber se há próxima página
    const products = await prisma.product.findMany({
      take: pageSize + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: {
        ...(search ? { name: { contains: search } } : {}),
        ...(categoryId ? { categoryId } : {}),
        isActive: isActiveFilter,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      orderBy: { name: 'asc' },
      include: {
        category: { select: { name: true } },
        variations: {
          where: { isActive: true },
          select: {
            stockQuantity: true,
            minStock: true,
            isActive: true,
          },
        },
      },
    })

    const hasNextPage = products.length > pageSize
    if (hasNextPage) products.pop()

    const lastItem = products.at(-1)

    const data: ProductListItem[] = products.map((p) => {
      const activeVariations = p.variations
      const totalStock = activeVariations.reduce((sum, v) => sum + v.stockQuantity, 0)
      const hasLowStock = activeVariations.some(
        (v) => v.stockQuantity > 0 && v.stockQuantity <= v.minStock
      )

      return {
        id: p.id,
        name: p.name,
        categoryId: p.categoryId,
        categoryName: p.category.name,
        priceCents: p.priceCents,
        costCents: p.costCents,
        isActive: p.isActive,
        variationCount: activeVariations.length,
        totalStock,
        hasLowStock,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }
    })

    return NextResponse.json<ApiSuccess<ProductListItem[]>>({
      data,
      meta: {
        pageSize,
        hasNextPage,
        cursor: hasNextPage && lastItem ? lastItem.id : undefined,
      },
    })
  } catch (error) {
    console.error('[GET /api/products]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/products
// Body:
// {
//   name: string          // 1–120 chars
//   categoryId: string    // deve existir e estar ativa
//   priceCents: number    // inteiro >= 0
//   variations: Array<{
//     size: string
//     color: string
//     sku?: string        // omitido → gerado automaticamente
//     stockQuantity?: number  // padrão 0
//     minStock?: number       // padrão 2
//   }>
// }
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

    const { name, categoryId, priceCents, costCents, variations } = body as Record<string, unknown>

    // --- Validar produto ---

    if (!name || !categoryId || priceCents === undefined || priceCents === null) {
      return NextResponse.json<ApiError>(
        { error: 'Os campos "name", "categoryId" e "priceCents" são obrigatórios', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }

    if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 120) {
      return NextResponse.json<ApiError>(
        { error: 'O nome deve ter entre 1 e 120 caracteres', code: 'INVALID_NAME' },
        { status: 400 }
      )
    }

    if (
      typeof priceCents !== 'number' ||
      !Number.isInteger(priceCents) ||
      priceCents < 0
    ) {
      return NextResponse.json<ApiError>(
        { error: 'O preço deve ser um inteiro >= 0 (em centavos)', code: 'INVALID_PRICE' },
        { status: 400 }
      )
    }

    // Validar costCents (opcional)
    if (costCents !== undefined && costCents !== null) {
      if (typeof costCents !== 'number' || !Number.isInteger(costCents) || costCents < 0) {
        return NextResponse.json<ApiError>(
          { error: 'O campo "costCents" deve ser um inteiro >= 0 (em centavos)', code: 'INVALID_COST' },
          { status: 400 }
        )
      }
    }

    // Verificar categoria existe e está ativa
    if (typeof categoryId !== 'string') {
      return NextResponse.json<ApiError>(
        { error: 'categoryId inválido', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, isActive: true },
    })
    if (!category || !category.isActive) {
      return NextResponse.json<ApiError>(
        { error: 'Categoria não encontrada ou inativa', code: 'CATEGORY_NOT_FOUND' },
        { status: 422 }
      )
    }

    // --- Validar variações ---

    if (!Array.isArray(variations) || variations.length === 0) {
      return NextResponse.json<ApiError>(
        { error: 'Pelo menos uma variação é obrigatória', code: 'NO_VARIATIONS' },
        { status: 400 }
      )
    }

    // Checar duplicatas de size+color dentro do request (antes de ir ao banco)
    const variationKeys = new Set<string>()
    for (const v of variations) {
      const variation = v as Record<string, unknown>

      if (typeof variation.size !== 'string' || typeof variation.color !== 'string') {
        return NextResponse.json<ApiError>(
          { error: 'Os campos "size" e "color" devem ser strings (podem ser vazios)', code: 'INVALID_VARIATION' },
          { status: 400 }
        )
      }

      const key = `${(variation.size as string).toLowerCase()}::${(variation.color as string).toLowerCase()}`
      if (variationKeys.has(key)) {
        return NextResponse.json<ApiError>(
          {
            error: `Variação duplicada no request: tamanho "${variation.size}" + cor "${variation.color}"`,
            code: 'DUPLICATE_VARIATION',
          },
          { status: 400 }
        )
      }
      variationKeys.add(key)
    }

    // --- Gerar SKUs automáticos para variações sem SKU ---

    const productName = (name as string).trim()
    const variationsWithSku: {
      size: string
      color: string
      sku: string
      stockQuantity: number
      minStock: number
    }[] = []

    for (const v of variations) {
      const variation = v as Record<string, unknown>
      const size = variation.size as string
      const color = variation.color as string

      let sku: string
      if (typeof variation.sku === 'string' && variation.sku.trim().length > 0) {
        sku = variation.sku.trim()
        // Verificar se o SKU informado já existe
        const existing = await prisma.productVariation.findUnique({
          where: { sku },
          select: { id: true },
        })
        if (existing) {
          return NextResponse.json<ApiError>(
            { error: `SKU "${sku}" já está em uso`, code: 'SKU_TAKEN' },
            { status: 409 }
          )
        }
      } else {
        sku = await generateSku(productName, size, color)
      }

      variationsWithSku.push({
        size,
        color,
        sku,
        stockQuantity:
          typeof variation.stockQuantity === 'number' && Number.isInteger(variation.stockQuantity)
            ? Math.max(0, variation.stockQuantity)
            : 0,
        minStock:
          typeof variation.minStock === 'number' && Number.isInteger(variation.minStock)
            ? Math.max(0, variation.minStock)
            : 2,
      })
    }

    // --- Criar produto + variações em transaction ---

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: productName,
          categoryId: categoryId as string,
          priceCents: priceCents as number,
          costCents: (costCents as number | null | undefined) ?? null,
          variations: {
            create: variationsWithSku,
          },
        },
        include: {
          category: { select: { name: true } },
          variations: {
            orderBy: [{ size: 'asc' }, { color: 'asc' }],
          },
        },
      })
      return created
    })

    const responseData: ProductResponse = {
      id: product.id,
      name: product.name,
      categoryId: product.categoryId,
      categoryName: product.category.name,
      priceCents: product.priceCents,
      costCents: product.costCents,
      isActive: product.isActive,
      deletedAt: product.deletedAt,
      variations: product.variations.map(formatVariation),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }

    return NextResponse.json<ApiSuccess<ProductResponse>>(
      { data: responseData },
      { status: 201 }
    )
  } catch (error) {
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2002') {
      return NextResponse.json<ApiError>(
        { error: 'SKU já está em uso', code: 'SKU_TAKEN' },
        { status: 409 }
      )
    }
    if (prismaError.code === 'P2003') {
      return NextResponse.json<ApiError>(
        { error: 'Categoria não encontrada', code: 'CATEGORY_NOT_FOUND' },
        { status: 422 }
      )
    }
    console.error('[POST /api/products]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
