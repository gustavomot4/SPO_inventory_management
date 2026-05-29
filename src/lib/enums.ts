// =============================================================================
// enums.ts -- Constantes de valores de campo string (substitutos de enum)
// SPO -- Sistema Pimenta Ousada
// =============================================================================
//
// Prisma 5 + SQLite nao suporta tipos enum nativos.
// Os campos correspondentes no schema sao do tipo String.
// Use estas constantes em vez de strings literais para evitar typos.
// =============================================================================

// ---------------------------------------------------------------------------
// StockMovement.type
// Valores validos: ENTRY | SALE | CANCELLATION | LOSS | ADJUSTMENT
// ---------------------------------------------------------------------------

export const MOVEMENT_TYPE = {
  ENTRY:        'ENTRY',
  SALE:         'SALE',
  CANCELLATION: 'CANCELLATION',
  LOSS:         'LOSS',
  ADJUSTMENT:   'ADJUSTMENT',
} as const

export type MovementType = typeof MOVEMENT_TYPE[keyof typeof MOVEMENT_TYPE]

// ---------------------------------------------------------------------------
// Sale.status
// Valores validos: ACTIVE | CANCELLED
// ---------------------------------------------------------------------------

export const SALE_STATUS = {
  ACTIVE:    'ACTIVE',
  CANCELLED: 'CANCELLED',
} as const

export type SaleStatus = typeof SALE_STATUS[keyof typeof SALE_STATUS]

// ---------------------------------------------------------------------------
// Sale.paymentMethod
// Valores validos: CASH | PIX | DEBIT | CREDIT
// ---------------------------------------------------------------------------

export const PAYMENT_METHOD = {
  CASH:   'CASH',
  PIX:    'PIX',
  DEBIT:  'DEBIT',
  CREDIT: 'CREDIT',
} as const

export type PaymentMethod = typeof PAYMENT_METHOD[keyof typeof PAYMENT_METHOD]

// Metodos que requerem maquininha de cartao
export const CARD_PAYMENT_METHODS: PaymentMethod[] = [
  PAYMENT_METHOD.DEBIT,
  PAYMENT_METHOD.CREDIT,
]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH:   'Dinheiro',
  PIX:    'PIX',
  DEBIT:  'Debito',
  CREDIT: 'Credito',
}
