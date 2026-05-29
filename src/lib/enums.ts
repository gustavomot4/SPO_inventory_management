// =============================================================================
// enums.ts — Constantes de valores de campo string (substitutos de enum)
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// Prisma 5 + SQLite não suporta tipos enum nativos.
// Os campos correspondentes no schema são do tipo String.
// Use estas constantes em vez de strings literais para evitar typos.
// =============================================================================

// ---------------------------------------------------------------------------
// StockMovement.type
// ---------------------------------------------------------------------------

export const MOVEMENT_TYPE = {
  ENTRY:      'ENTRY',      // entrada de estoque (stock-entries)
  SALE:       'SALE',       // saída por venda (sale-items)
  ADJUSTMENT: 'ADJUSTMENT', // ajuste manual (futuro)
  RETURN:     'RETURN',     // devolução (futuro)
} as const

export type MovementType = typeof MOVEMENT_TYPE[keyof typeof MOVEMENT_TYPE]

// ---------------------------------------------------------------------------
// Sale.status
// ---------------------------------------------------------------------------

export const SALE_STATUS = {
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const

export type SaleStatus = typeof SALE_STATUS[keyof typeof SALE_STATUS]

// ---------------------------------------------------------------------------
// Sale.paymentMethod
// ---------------------------------------------------------------------------

export const PAYMENT_METHOD = {
  CASH:        'CASH',
  CREDIT_CARD: 'CREDIT_CARD',
  DEBIT_CARD:  'DEBIT_CARD',
  PIX:         'PIX',
} as const

export type PaymentMethod = typeof PAYMENT_METHOD[keyof typeof PAYMENT_METHOD]
