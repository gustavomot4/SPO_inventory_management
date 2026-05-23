// =============================================================================
// enums.ts — Constantes de domínio que substituem os enums do Prisma
//
// SQLite não suporta enum nativo no Prisma ORM. Os campos são armazenados como
// TEXT com CHECK constraints no banco (ver migration). Aqui centralizamos os
// valores válidos para uso em toda a aplicação com type safety via TypeScript.
//
// USO:
//   import { SaleStatus, PaymentMethod, MovementType } from '@/lib/enums'
//   const status: SaleStatus = 'ACTIVE'
// =============================================================================

// ---------------------------------------------------------------------------
// SaleStatus
// ---------------------------------------------------------------------------
export const SALE_STATUS = {
  ACTIVE: 'ACTIVE',
  CANCELLED: 'CANCELLED',
} as const

export type SaleStatus = (typeof SALE_STATUS)[keyof typeof SALE_STATUS]

// ---------------------------------------------------------------------------
// PaymentMethod
// ---------------------------------------------------------------------------
export const PAYMENT_METHOD = {
  CASH: 'CASH',
  PIX: 'PIX',
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
} as const

export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD]

/** Métodos de pagamento que exigem maquininha */
export const CARD_PAYMENT_METHODS: PaymentMethod[] = [
  PAYMENT_METHOD.DEBIT,
  PAYMENT_METHOD.CREDIT,
]

export function requiresCardMachine(method: PaymentMethod): boolean {
  return CARD_PAYMENT_METHODS.includes(method)
}

// ---------------------------------------------------------------------------
// MovementType
// ---------------------------------------------------------------------------
export const MOVEMENT_TYPE = {
  ENTRY: 'ENTRY',
  SALE: 'SALE',
  CANCELLATION: 'CANCELLATION',
  LOSS: 'LOSS',
  ADJUSTMENT: 'ADJUSTMENT',
} as const

export type MovementType = (typeof MOVEMENT_TYPE)[keyof typeof MOVEMENT_TYPE]

// ---------------------------------------------------------------------------
// Labels para exibição na UI
// ---------------------------------------------------------------------------
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  DEBIT: 'Débito',
  CREDIT: 'Crédito',
}

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  ACTIVE: 'Ativa',
  CANCELLED: 'Cancelada',
}

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  ENTRY: 'Entrada',
  SALE: 'Venda',
  CANCELLATION: 'Cancelamento',
  LOSS: 'Perda',
  ADJUSTMENT: 'Ajuste',
}
