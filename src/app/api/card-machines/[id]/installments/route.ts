// =============================================================================
// GET  /api/card-machines/[id]/installments  — listar parcelamentos
// POST /api/card-machines/[id]/installments  — criar parcelamento
// SPO — Sistema Pimenta Ousada | MAQU-003
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { ApiSuccess, ApiError, CardMachineInstallmentResponse } from '@/types'

type RouteContext = { params: { id: string } }

function formatInstallment(inst: {
  id: string
  cardMachineId: string
  installments: number
  feeBasisPoints: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}): CardMachineInstallmentResponse {
  return {
    id: inst.id,
    cardMachineId: inst.cardMachineId,
    installments: inst.installments,
    feeBasisPoints: inst.feeBasisPoints,
    isActive: inst.isActive,
    createdAt: inst.createdAt,
    updatedAt: inst.updatedAt,
  }
}

// ---------------------------------------------------------------------------
// GET /api/card-machines/[id]/installments
// Query: ?includeInactive=true
// Ordem: installments asc
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    // Verificar maquininha existe
    const machine = await prisma.cardMachine.findUnique({
      where: { id: params.id },
      select: { id: true },
    })

    if (!machine) {
      return NextResponse.json<ApiError>(
        { error: 'Maquininha não encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true'

    const installments = await prisma.cardMachineInstallment.findMany({
      where: {
        cardMachineId: params.id,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { installments: 'asc' },
    })

    return NextResponse.json<ApiSuccess<CardMachineInstallmentResponse[]>>({
      data: installments.map(formatInstallment),
    })
  } catch (error) {
    console.error('[GET /api/card-machines/[id]/installments]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/card-machines/[id]/installments
// Body: { installments: number (2-12), feeBasisPoints: number (>= 0) }
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    // Verificar maquininha existe e está ativa
    const machine = await prisma.cardMachine.findUnique({
      where: { id: params.id },
      select: { id: true, isActive: true },
    })

    if (!machine) {
      return NextResponse.json<ApiError>(
        { error: 'Maquininha não encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (!machine.isActive) {
      return NextResponse.json<ApiError>(
        { error: 'Maquininha inativa — não é possível adicionar parcelamentos', code: 'CARD_MACHINE_INACTIVE' },
        { status: 422 }
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json<ApiError>(
        { error: 'Body inválido', code: 'INVALID_BODY' },
        { status: 400 }
      )
    }

    const { installments, feeBasisPoints } = body as Record<string, unknown>

    // Validar installments (2-12)
    if (
      installments === undefined ||
      installments === null ||
      typeof installments !== 'number' ||
      !Number.isInteger(installments) ||
      installments < 2 ||
      installments > 12
    ) {
      return NextResponse.json<ApiError>(
        { error: 'O campo "installments" deve ser um inteiro entre 2 e 12', code: 'INVALID_INSTALLMENTS' },
        { status: 400 }
      )
    }

    // Validar feeBasisPoints
    if (
      feeBasisPoints === undefined ||
      feeBasisPoints === null ||
      typeof feeBasisPoints !== 'number' ||
      !Number.isInteger(feeBasisPoints) ||
      feeBasisPoints < 0
    ) {
      return NextResponse.json<ApiError>(
        { error: 'O campo "feeBasisPoints" deve ser um inteiro >= 0', code: 'INVALID_FEE' },
        { status: 400 }
      )
    }

    // Criar parcelamento — erro P2002 se duplicata (unique cardMachineId + installments)
    const inst = await prisma.cardMachineInstallment.create({
      data: {
        cardMachineId: params.id,
        installments: installments as number,
        feeBasisPoints: feeBasisPoints as number,
      },
    })

    return NextResponse.json<ApiSuccess<CardMachineInstallmentResponse>>(
      { data: formatInstallment(inst) },
      { status: 201 }
    )
  } catch (error) {
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2002') {
      return NextResponse.json<ApiError>(
        { error: 'Já existe um parcelamento com esse número de parcelas para esta maquininha', code: 'INSTALLMENT_EXISTS' },
        { status: 409 }
      )
    }
    console.error('[POST /api/card-machines/[id]/installments]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
