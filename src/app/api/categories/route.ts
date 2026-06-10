// =============================================================================
// GET  /api/categories  — listar categorias
// POST /api/categories  — criar categoria
// SPO — Sistema Pimenta Ousada | PROD-001
// =============================================================================
//
// Acesso: Protegido por PIN via middleware (QA-003) — INCLUSIVE o GET: o matcher
// '/api/categories/:path*' do Next 14 casa também o caminho base /api/categories.
// Consumidores do GET são telas de gestão (/configuracoes, /produtos/novo,
// /produtos/[id]), que redirecionam para /pin no 401 (QA-072). A listagem
// /produtos usa o GET apenas para o filtro — degrada sem PIN, por design.
// Regras: name único (P2002 → NAME_TAKEN) | 1–80 chars | soft delete via isActive=false
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { ApiSuccess, ApiError, CategoryResponse } from '@/types'

// ---------------------------------------------------------------------------
// GET /api/categories
// Query: ?includeInactive=true  → retorna todas
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = request.nextUrl
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const categories = await prisma.category.findMany({
      take: 200, // QA-047: limite de segurança — design pressupõe < 20 categorias por loja
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: 'asc' },
    })

    const data: CategoryResponse[] = categories.map((c) => ({
      id: c.id,
      name: c.name,
      isActive: c.isActive,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }))

    return NextResponse.json<ApiSuccess<CategoryResponse[]>>({ data })
  } catch (error) {
    console.error('[GET /api/categories]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/categories
// Body: { name: string }
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

    const { name } = body as Record<string, unknown>

    // Validar name
    if (name === undefined || name === null) {
      return NextResponse.json<ApiError>(
        { error: 'O campo "name" é obrigatório', code: 'MISSING_NAME' },
        { status: 400 }
      )
    }
    if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 80) {
      return NextResponse.json<ApiError>(
        { error: 'O nome deve ter entre 1 e 80 caracteres', code: 'INVALID_NAME' },
        { status: 400 }
      )
    }

    const category = await prisma.category.create({
      data: { name: name.trim() },
    })

    return NextResponse.json<ApiSuccess<CategoryResponse>>(
      {
        data: {
          id: category.id,
          name: category.name,
          isActive: category.isActive,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2002') {
      return NextResponse.json<ApiError>(
        { error: 'Já existe uma categoria com este nome', code: 'NAME_TAKEN' },
        { status: 409 }
      )
    }
    console.error('[POST /api/categories]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
