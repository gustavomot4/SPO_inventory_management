// =============================================================================
// PATCH  /api/card-machines/[id]/installments/[iid]  — atualizar parcelamento
// DELETE /api/card-machines/[id]/installments/[iid]  — remover parcelamento (hard delete)
// SPO — Sistema Pimenta Ousada | MAQU-003
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { ApiSuccess, ApiError, CardMachineInstallmentResponse } from '@/types'

type RouteContext = { params: { id: string; iid: string } }

// ---------------------------------------------------------------------------
// PATCH /api/card-machines/[id]/installments/[iid]
// Body: { feeBasisPoints?, isActive? } — pelo menos um
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    // Verificar que o parcelamento existe e pertence a esta maquininha
    const existing = await prisma.cardMachineInstallment.findUnique({
      where: { id: params.iid },
      select: { id: true, cardMachineId: true },
    })

    if (!existing || existing.cardMachineId !== params.id) {
      return NextResponse.json<ApiError>(
        { error: 'Parcelamento não encontrado', code: 'NOT_FOUND' },
        { status: 404 }
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

    const { feeBasisPoints, isActive } = body as Record<string, unknown>

    if (feeBasisPoints !== undefined) {
      if (
        typeof feeBasisPoints !== 'number' ||
        !Number.isInteger(feeBasisPoints) ||
        feeBasisPoints < 0
      ) {
        return NextResponse.json<ApiError>(
          { error: 'O campo "feeBasisPoints" deve ser um inteiro >= 0', code: 'INVALID_FEE' },
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

    const updateData: { feeBasisPoints?: number; isActive?: boolean } = {}
    if (feeBasisPoints !== undefined) updateData.feeBasisPoints = feeBasisPoints as number
    if (isActive !== undefined) updateData.isActive = isActive as boolean

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json<ApiError>(
        { error: 'Nenhum campo válido para atualizar', code: 'NO_FIELDS_TO_UPDATE' },
        { status: 400 }
      )
    }

    const inst = await prisma.cardMachineInstallment.update({
      where: { id: params.iid },
      data: updateData,
    })

    const responseData: CardMachineInstallmentResponse = {
      id: inst.id,
      cardMachineId: inst.cardMachineId,
      installments: inst.installments,
      feeBasisPoints: inst.feeBasisPoints,
      isActive: inst.isActive,
      createdAt: inst.createdAt,
      updatedAt: inst.updatedAt,
    }

    return NextResponse.json<ApiSuccess<CardMachineInstallmentResponse>>({ data: responseData })
  } catch (error) {
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2025') {
      return NextResponse.json<ApiError>(
        { error: 'Parcelamento não encontrado', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    console.error('[PATCH /api/card-machines/[id]/installments/[iid]]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/card-machines/[id]/installments/[iid]
// Hard delete — sem soft delete nesta tabela
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    // Verificar que pertence a esta maquininha
    const existing = await prisma.cardMachineInstallment.findUnique({
      where: { id: params.iid },
      select: { id: true, cardMachineId: true },
    })

    if (!existing || existing.cardMachineId !== params.id) {
      return NextResponse.json<ApiError>(
        { error: 'Parcelamento não encontrado', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    await prisma.cardMachineInstallment.delete({
      where: { id: params.iid },
    })

    return NextResponse.json<ApiSuccess<{ deleted: boolean }>>({
      data: { deleted: true },
    })
  } catch (error) {
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2025') {
      return NextResponse.json<ApiError>(
        { error: 'Parcelamento não encontrado', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    console.error('[DELETE /api/card-machines/[id]/installments/[iid]]', error)
    return NextResponse.json<ApiError>(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
