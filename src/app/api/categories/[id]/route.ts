// =============================================================================
// GET    /api/categories/[id]  — detalhar categoria (com _count de produtos)
// PATCH  /api/categories/[id]  — renomear ou ativar/inativar
// DELETE /api/categories/[id]  — inativar (soft delete: isActive = false)
// SPO — Sistema Pimenta Ousada | PROD-001
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { ApiSuccess, ApiError, CategoryResponse } from '@/types'

type RouteContext = { params: { id: string } }

// ---------------------------------------------------------------------------
// GET /api/categories/[id]
// Inclui _count.products para informar quantos produtos têm esta categoria
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const category = await prisma.category.findUnique({
      where: { id: params.id },
      include: {
        _count: { select: { products: true } },
      },
    })

    if (!category) {
      return NextResponse.json<ApiError>(
        { error: 'Categoria não encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    return NextResponse.json<ApiSuccess<CategoryResponse>>({
      data: {
        id: category.id,
        name: category.name,
        isActive: category.isActive,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
        _count: { products: category._count.products },
      },
    })
  } catch (error) {
    console.error('[GET /api/categories/[id]]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/categories/[id]
// Body: { name?, isActive? } — pelo menos um obrigatório
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
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

    const { name, isActive } = body as Record<string, unknown>

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 80) {
        return NextResponse.json<ApiError>(
          { error: 'O nome deve ter entre 1 e 80 caracteres', code: 'INVALID_NAME' },
          { status: 400 }
        )
      }
    }

    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return NextResponse.json<ApiError>(
        { error: 'O campo "isActive" deve ser boolean', code: 'INVALID_BODY' },
        { status: 400 }
      )
    }

    const updateData: { name?: string; isActive?: boolean } = {}
    if (name !== undefined) updateData.name = (name as string).trim()
    if (isActive !== undefined) updateData.isActive = isActive as boolean

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json<ApiError>(
        { error: 'Nenhum campo válido para atualizar', code: 'NO_FIELDS_TO_UPDATE' },
        { status: 400 }
      )
    }

    // QA-058: aplicar a MESMA guarda do DELETE — inativar via PATCH não pode
    // contornar a proteção (QA-044) contra categorias com produtos ativos vinculados.
    // Sem isso, PATCH { isActive: false } reabre o estado ruim: produtos ficam presos
    // a uma categoria inativa e não podem ser editados (PATCH de produto rejeita
    // categoryId inativo).
    if (isActive === false) {
      const activeProducts = await prisma.product.count({
        where: { categoryId: params.id, isActive: true, deletedAt: null },
      })
      if (activeProducts > 0) {
        return NextResponse.json<ApiError>(
          {
            error: `Não é possível inativar: ${activeProducts} produto(s) ativo(s) vinculado(s) a esta categoria. Mova-os para outra categoria antes de inativar.`,
            code: 'CATEGORY_HAS_ACTIVE_PRODUCTS',
          },
          { status: 422 }
        )
      }
    }

    const category = await prisma.category.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json<ApiSuccess<CategoryResponse>>({
      data: {
        id: category.id,
        name: category.name,
        isActive: category.isActive,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      },
    })
  } catch (error) {
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2025') {
      return NextResponse.json<ApiError>(
        { error: 'Categoria não encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    if (prismaError.code === 'P2002') {
      return NextResponse.json<ApiError>(
        { error: 'Já existe uma categoria com este nome', code: 'NAME_TAKEN' },
        { status: 409 }
      )
    }
    console.error('[PATCH /api/categories/[id]]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/categories/[id]
// Soft delete: isActive = false — produtos associados não são afetados
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    // QA-044: bloquear inativação se houver produtos ativos vinculados.
    // Sem esta verificação, produtos ficam com categoryId apontando para categoria inativa
    // e tornam-se impossíveis de editar (API rejeita categoryId inativo no PATCH).
    const activeProducts = await prisma.product.count({
      where: { categoryId: params.id, isActive: true, deletedAt: null },
    })
    if (activeProducts > 0) {
      return NextResponse.json<ApiError>(
        {
          error: `Não é possível inativar: ${activeProducts} produto(s) ativo(s) vinculado(s) a esta categoria. Mova-os para outra categoria antes de inativar.`,
          code: 'CATEGORY_HAS_ACTIVE_PRODUCTS',
        },
        { status: 422 }
      )
    }

    const category = await prisma.category.update({
      where: { id: params.id },
      data: { isActive: false },
    })

    return NextResponse.json<ApiSuccess<CategoryResponse>>({
      data: {
        id: category.id,
        name: category.name,
        isActive: category.isActive,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      },
    })
  } catch (error) {
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2025') {
      return NextResponse.json<ApiError>(
        { error: 'Categoria não encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    console.error('[DELETE /api/categories/[id]]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
