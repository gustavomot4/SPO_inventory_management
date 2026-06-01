// =============================================================================
// GET    /api/card-machines/[id]  — detalhar maquininha
// PATCH  /api/card-machines/[id]  — atualizar nome, taxa ou status
// DELETE /api/card-machines/[id]  — inativar (soft delete: isActive = false)
// SPO — Sistema Pimenta Ousada | MAQU-001
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { ApiSuccess, ApiError, CardMachineResponse } from '@/types'

type RouteContext = { params: { id: string } }

// ---------------------------------------------------------------------------
// GET /api/card-machines/[id]
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const machine = await prisma.cardMachine.findUnique({
      where: { id: params.id },
      include: {
        installments: {
          where: { isActive: true },
          orderBy: { installments: 'asc' },
        },
      },
    })

    if (!machine) {
      return NextResponse.json<ApiError>(
        { error: 'Maquininha não encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    return NextResponse.json<ApiSuccess<CardMachineResponse>>({
      data: {
        id: machine.id,
        name: machine.name,
        feeBasisPoints: machine.feeBasisPoints,
        isActive: machine.isActive,
        createdAt: machine.createdAt,
        updatedAt: machine.updatedAt,
        installments: machine.installments.map((inst) => ({
          id: inst.id,
          cardMachineId: inst.cardMachineId,
          installments: inst.installments,
          feeBasisPoints: inst.feeBasisPoints,
          isActive: inst.isActive,
          createdAt: inst.createdAt,
          updatedAt: inst.updatedAt,
        })),
      },
    })
  } catch (error) {
    console.error('[GET /api/card-machines/[id]]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/card-machines/[id]
// Body: { name?, feeBasisPoints?, isActive? } — pelo menos um obrigatório
// Nota: updatedAt não incluído — trigger SQL cuida do update automático
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

    const { name, feeBasisPoints, isActive } = body as Record<string, unknown>

    // Validar campos opcionais quando presentes
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
        return NextResponse.json<ApiError>(
          { error: 'O nome deve ter entre 1 e 100 caracteres', code: 'INVALID_NAME' },
          { status: 400 }
        )
      }
    }

    if (feeBasisPoints !== undefined) {
      if (
        typeof feeBasisPoints !== 'number' ||
        !Number.isInteger(feeBasisPoints) ||
        feeBasisPoints < 0 ||
        feeBasisPoints > 5000  // QA-007: máx 50%
      ) {
        return NextResponse.json<ApiError>(
          { error: 'A taxa deve ser um inteiro entre 0 e 5000 basis points (máx 50%)', code: 'INVALID_FEE' },
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

    // Montar dados de update — apenas campos presentes
    const updateData: { name?: string; feeBasisPoints?: number; isActive?: boolean } = {}
    if (name !== undefined) updateData.name = (name as string).trim()
    if (feeBasisPoints !== undefined) updateData.feeBasisPoints = feeBasisPoints as number
    if (isActive !== undefined) updateData.isActive = isActive as boolean

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json<ApiError>(
        { error: 'Nenhum campo válido para atualizar', code: 'NO_FIELDS_TO_UPDATE' },
        { status: 400 }
      )
    }

    const machine = await prisma.cardMachine.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json<ApiSuccess<CardMachineResponse>>({
      data: {
        id: machine.id,
        name: machine.name,
        feeBasisPoints: machine.feeBasisPoints,
        isActive: machine.isActive,
        createdAt: machine.createdAt,
        updatedAt: machine.updatedAt,
      },
    })
  } catch (error) {
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2025') {
      return NextResponse.json<ApiError>(
        { error: 'Maquininha não encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    console.error('[PATCH /api/card-machines/[id]]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/card-machines/[id]
// Soft delete: isActive = false (nunca excluir do banco — histórico de vendas)
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const machine = await prisma.cardMachine.update({
      where: { id: params.id },
      data: { isActive: false },
    })

    return NextResponse.json<ApiSuccess<CardMachineResponse>>({
      data: {
        id: machine.id,
        name: machine.name,
        feeBasisPoints: machine.feeBasisPoints,
        isActive: machine.isActive,
        createdAt: machine.createdAt,
        updatedAt: machine.updatedAt,
      },
    })
  } catch (error) {
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2025') {
      return NextResponse.json<ApiError>(
        { error: 'Maquininha não encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    console.error('[DELETE /api/card-machines/[id]]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
