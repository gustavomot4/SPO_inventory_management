// =============================================================================
// GET /api/card-machines   — listar maquininhas
// POST /api/card-machines  — criar maquininha
// SPO — Sistema Pimenta Ousada | MAQU-001
// =============================================================================
//
// Acesso: Público (sem PIN) — a tela de configurações já é protegida no middleware.
// RN-010: feeBasisPoints >= 0 | name 1–100 chars | soft delete via isActive=false
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { ApiSuccess, ApiError, CardMachineResponse } from '@/types'

// ---------------------------------------------------------------------------
// GET /api/card-machines
// Query: ?includeInactive=true  → retorna todas (ativas + inativas)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = request.nextUrl
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const machines = await prisma.cardMachine.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: 'asc' },
    })

    const data: CardMachineResponse[] = machines.map((m) => ({
      id: m.id,
      name: m.name,
      feeBasisPoints: m.feeBasisPoints,
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

// ---------------------------------------------------------------------------
// POST /api/card-machines
// Body: { name: string, feeBasisPoints: number }
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

    const { name, feeBasisPoints } = body as Record<string, unknown>

    // Validar name
    if (name === undefined || name === null) {
      return NextResponse.json<ApiError>(
        { error: 'O campo "name" é obrigatório', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }
    if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
      return NextResponse.json<ApiError>(
        { error: 'O nome deve ter entre 1 e 100 caracteres', code: 'INVALID_NAME' },
        { status: 400 }
      )
    }

    // Validar feeBasisPoints
    if (feeBasisPoints === undefined || feeBasisPoints === null) {
      return NextResponse.json<ApiError>(
        { error: 'O campo "feeBasisPoints" é obrigatório', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }
    if (
      typeof feeBasisPoints !== 'number' ||
      !Number.isInteger(feeBasisPoints) ||
      feeBasisPoints < 0 ||
      feeBasisPoints > 5000  // QA-007: máx 50% (taxas reais no Brasil raramente passam de 10%)
    ) {
      return NextResponse.json<ApiError>(
        { error: 'A taxa deve ser um inteiro entre 0 e 5000 basis points (máx 50%)', code: 'INVALID_FEE' },
        { status: 400 }
      )
    }

    const machine = await prisma.cardMachine.create({
      data: {
        name: name.trim(),
        feeBasisPoints,
      },
    })

    return NextResponse.json<ApiSuccess<CardMachineResponse>>(
      {
        data: {
          id: machine.id,
          name: machine.name,
          feeBasisPoints: machine.feeBasisPoints,
          isActive: machine.isActive,
          createdAt: machine.createdAt,
          updatedAt: machine.updatedAt,
        },
      },
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
