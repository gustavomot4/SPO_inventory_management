// =============================================================================
// GET /api/card-machines   — listar maquininhas
// POST /api/card-machines  — criar maquininha
// SPO — Sistema Pimenta Ousada | MAQU-001
// =============================================================================
// Acesso: Protegido por PIN via middleware (QA-003).
// QA-007: feeBasisPoints máx 5000 basis points (50%)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { ApiSuccess, ApiError, CardMachineResponse } from '@/types'

const FEE_MAX_BASIS_POINTS = 5000

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = request.nextUrl
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const machines = await prisma.cardMachine.findMany({
      take: 200, // QA-083: limite de segurança — consistente com /api/categories (QA-047)
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: 'asc' },
    })

    const data: CardMachineResponse[] = machines.map((m) => ({
      id: m.id,
      name: m.name,
      feeBasisPoints: m.feeBasisPoints,
      debitFeeBasisPoints: m.debitFeeBasisPoints,
      pixFeeBasisPoints: m.pixFeeBasisPoints,
      isActive: m.isActive,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }))

    return NextResponse.json<ApiSuccess<CardMachineResponse[]>>({ data })
  } catch (error) {
    console.error('[GET /api/card-machines]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json<ApiError>({ error: 'Body inválido', code: 'INVALID_BODY' }, { status: 400 })
    }

    const { name, feeBasisPoints, debitFeeBasisPoints, pixFeeBasisPoints } = body as Record<string, unknown>

    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
      return NextResponse.json<ApiError>(
        { error: 'O nome deve ter entre 1 e 100 caracteres', code: 'INVALID_NAME' },
        { status: 400 }
      )
    }

    if (
      typeof feeBasisPoints !== 'number' ||
      !Number.isInteger(feeBasisPoints) ||
      feeBasisPoints < 0 ||
      feeBasisPoints > FEE_MAX_BASIS_POINTS
    ) {
      return NextResponse.json<ApiError>(
        { error: `A taxa informada é muito alta. O valor máximo permitido é 50% (ex: 1,99 para 1,99%)`, code: 'INVALID_FEE' },
        { status: 400 }
      )
    }

    // v2.5: taxas opcionais de débito e PIX (null/undefined = não configurada)
    for (const [field, value] of [['debitFeeBasisPoints', debitFeeBasisPoints], ['pixFeeBasisPoints', pixFeeBasisPoints]] as const) {
      if (value !== undefined && value !== null &&
        (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > FEE_MAX_BASIS_POINTS)) {
        return NextResponse.json<ApiError>(
          { error: `A taxa informada em "${field}" é inválida. O máximo permitido é 50%`, code: 'INVALID_FEE' },
          { status: 400 }
        )
      }
    }

    const machine = await prisma.cardMachine.create({
      data: {
        name: (name as string).trim(),
        feeBasisPoints: feeBasisPoints as number,
        debitFeeBasisPoints: (debitFeeBasisPoints as number | null | undefined) ?? null,
        pixFeeBasisPoints: (pixFeeBasisPoints as number | null | undefined) ?? null,
      },
    })

    return NextResponse.json<ApiSuccess<CardMachineResponse>>(
      { data: { id: machine.id, name: machine.name, feeBasisPoints: machine.feeBasisPoints, debitFeeBasisPoints: machine.debitFeeBasisPoints, pixFeeBasisPoints: machine.pixFeeBasisPoints, isActive: machine.isActive, createdAt: machine.createdAt, updatedAt: machine.updatedAt } },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/card-machines]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
