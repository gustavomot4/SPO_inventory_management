// =============================================================================
// utils.ts -- Funcoes utilitarias compartilhadas
// SPO -- Sistema Pimenta Ousada
// =============================================================================

// ---------------------------------------------------------------------------
// FORMATACAO DE MOEDA
// Todos os valores monetarios no banco sao armazenados em CENTAVOS (Int).
// Referencia: SCHEMA_DESIGN.md secao 2.1
// ---------------------------------------------------------------------------

/**
 * Converte um valor em centavos (Int) para string formatada em BRL.
 *
 * @example
 * formatCurrency(5990)  // "R$ 59,90"
 * formatCurrency(0)     // "R$ 0,00"
 * formatCurrency(100)   // "R$ 1,00"
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100)
}

/**
 * Converte uma string de valor decimal para centavos (Int).
 * Aceita tanto ponto quanto virgula como separador decimal.
 *
 * @example
 * parseCurrencyToCents("59.90")  // 5990
 * parseCurrencyToCents("59,90")  // 5990
 * parseCurrencyToCents("100")    // 10000
 *
 * @throws {Error} se o valor nao for um numero valido
 */
export function parseCurrencyToCents(value: string): number {
  const normalized = value.trim().replace(',', '.')
  const parsed = parseFloat(normalized)

  if (isNaN(parsed)) {
    throw new Error(`Valor invalido para conversao de moeda: "${value}"`)
  }

  return Math.round(parsed * 100)
}

// ---------------------------------------------------------------------------
// FORMATACAO DE DATAS
// ---------------------------------------------------------------------------

/**
 * Formata uma data para exibicao no padrao brasileiro (dd/mm/aaaa).
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

/**
 * Formata uma data para exibicao com hora no padrao brasileiro.
 */
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

// ---------------------------------------------------------------------------
// STATUS DE ESTOQUE
// Centraliza a logica de classificacao de estoque
// Referencia: SCHEMA_DESIGN.md secao 9 -- status de estoque por variacao
// ---------------------------------------------------------------------------

export type StockStatus = 'ok' | 'low' | 'out'

/**
 * Determina o status de estoque de uma variacao.
 *
 * - 'ok'  => stockQuantity > minStock
 * - 'low' => stockQuantity > 0 && stockQuantity <= minStock
 * - 'out' => stockQuantity === 0
 */
export function getStockStatus(
  stockQuantity: number,
  minStock: number
): StockStatus {
  if (stockQuantity === 0) return 'out'
  if (stockQuantity <= minStock) return 'low'
  return 'ok'
}

/**
 * Labels em portugues para cada status de estoque.
 */
export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  ok: 'OK',
  low: 'Estoque Baixo',
  out: 'Zerado',
}

// ---------------------------------------------------------------------------
// LABELS DE FORMAS DE PAGAMENTO
// Traducao dos valores do enum PaymentMethod para portugues
// MVP-004: PaymentMethod atualizado -- DEBIT_CARD->DEBIT | CREDIT_CARD->CREDIT
// ---------------------------------------------------------------------------

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH:   'Dinheiro',
  PIX:    'Pix',
  DEBIT:  'Cartao de Debito',
  CREDIT: 'Cartao de Credito',
}

// ---------------------------------------------------------------------------
// CALCULO DE TAXA DE MAQUININHA
// Basis points: 199 = 1,99% -- nunca Float para percentuais monetarios
// ---------------------------------------------------------------------------

export function calculateCardFee(
  totalCents: number,
  feeBasisPoints: number
): number {
  return Math.round((totalCents * feeBasisPoints) / 10000)
}

export function formatBasisPoints(basisPoints: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(basisPoints / 10000)
}
