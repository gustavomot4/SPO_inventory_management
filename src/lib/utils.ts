// =============================================================================
// utils.ts — Funções utilitárias compartilhadas
// SPO — Sistema Pimenta Ousada
// =============================================================================

// ---------------------------------------------------------------------------
// CLASS MERGE — clsx + tailwind-merge
// ---------------------------------------------------------------------------
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge de classes Tailwind sem conflitos. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ---------------------------------------------------------------------------
// FORMATAÇÃO DE MOEDA
// Todos os valores monetários no banco são armazenados em CENTAVOS (Int).
// Referência: docs/a_schema_design.md seção 2.1
// ---------------------------------------------------------------------------

/**
 * Converte um valor em centavos (Int) para string formatada em BRL.
 *
 * @example
 * formatCurrency(5990)  // → "R$ 59,90"
 * formatCurrency(0)     // → "R$ 0,00"
 * formatCurrency(100)   // → "R$ 1,00"
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100)
}

/**
 * Converte uma string de valor decimal para centavos (Int).
 * Aceita tanto ponto quanto vírgula como separador decimal.
 *
 * Suporta o padrão brasileiro com separador de milhar:
 * @example
 * parseCurrencyToCents("59.90")        // → 5990   (ponto decimal, legado)
 * parseCurrencyToCents("59,90")        // → 5990   (vírgula decimal)
 * parseCurrencyToCents("100")          // → 10000
 * parseCurrencyToCents("1.500")        // → 150000 (milhar pt-BR — QA-080)
 * parseCurrencyToCents("0.50")         // → 50     (decimal, parte inteira 0)
 * parseCurrencyToCents("1.299,90")     // → 129990 (milhar + decimal BR)
 * parseCurrencyToCents("1.234.567,89") // → 123456789
 * parseCurrencyToCents("R$ 49,90")     // → 4990   (ignora símbolo/espaços)
 *
 * @throws {Error} se o valor não for um número válido
 */
export function parseCurrencyToCents(value: string): number {
  // QA-057: o replace(',', '.') antigo só trocava a PRIMEIRA vírgula e não removia
  // o separador de milhar. "1.299,90" virava "1.299.90" → parseFloat parava no 2º
  // ponto → 1.299 → R$ 1,30 (erro de 1000×) em preços/descontos. Agora tratamos os
  // separadores conforme o formato brasileiro.
  let s = value.trim().replace(/[^\d.,-]/g, '') // mantém dígitos, ',', '.', '-'
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')

  if (hasComma && hasDot) {
    // Formato BR completo: ponto = milhar, vírgula = decimal (ex.: "1.299,90")
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (hasComma) {
    // Apenas vírgula = separador decimal BR (ex.: "59,90")
    s = s.replace(',', '.')
  } else if (hasDot) {
    // Apenas ponto(s): mais de um ponto = separador de milhar ("1.234.567").
    if (((s.match(/\./g) || []).length) > 1) {
      s = s.replace(/\./g, '')
    } else {
      // QA-080: um ÚNICO ponto seguido de exatamente 3 dígitos, com parte inteira
      // não-zero, é separador de MILHAR pt-BR — "1.500" = R$ 1.500,00 (antes virava
      // R$ 1,50: erro de 1000×). Ponto com 1-2 casas segue decimal ("59.90"), e
      // "0.500" segue decimal (ninguém digita milhar com inteiro zero).
      const thousand = s.match(/^(-?\d+)\.(\d{3})$/)
      if (thousand && thousand[1] !== '0' && thousand[1] !== '-0') {
        s = s.replace(/\./g, '')
      }
    }
  }

  const parsed = parseFloat(s)

  if (isNaN(parsed)) {
    throw new Error(`Valor inválido para conversão de moeda: "${value}"`)
  }

  return Math.round(parsed * 100)
}

// ---------------------------------------------------------------------------
// FORMATAÇÃO DE DATAS
// ---------------------------------------------------------------------------

/**
 * Formata uma data para exibição no padrão brasileiro (dd/mm/aaaa).
 *
 * @example
 * formatDate(new Date('2026-05-22'))  // → "22/05/2026"
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

/**
 * Formata uma data para exibição com hora no padrão brasileiro.
 *
 * @example
 * formatDateTime(new Date('2026-05-22T14:30:00'))  // → "22/05/2026, 14:30"
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
// Centraliza a lógica de classificação de estoque (usada em queries e UI)
// Referência: docs/a_schema_design.md seção 9 — status de estoque por variação
// ---------------------------------------------------------------------------

export type StockStatus = 'ok' | 'low' | 'out'

/**
 * Determina o status de estoque de uma variação.
 *
 * - 'ok'  → stockQuantity > minStock
 * - 'low' → stockQuantity > 0 && stockQuantity <= minStock
 * - 'out' → stockQuantity === 0
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
 * Labels em português para cada status de estoque.
 */
export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  ok: 'OK',
  low: 'Estoque Baixo',
  out: 'Zerado',
}

// ---------------------------------------------------------------------------
// LABELS DE FORMAS DE PAGAMENTO
// Tradução dos valores do enum PaymentMethod para português
// ---------------------------------------------------------------------------

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH:   'Dinheiro',
  PIX:    'PIX',
  DEBIT:  'Débito',
  CREDIT: 'Crédito',
}

// ---------------------------------------------------------------------------
// FORMATAÇÃO DE BASIS POINTS (taxas de maquininha)
// 199 basis points = 1,99%
// ---------------------------------------------------------------------------

/**
 * Converte basis points (Int) para string de percentual formatada em pt-BR.
 *
 * @example
 * formatBasisPoints(199)  // → "1,99%"
 * formatBasisPoints(250)  // → "2,50%"
 */
export function formatBasisPoints(basisPoints: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(basisPoints / 10000)
}

/**
 * Converte string de percentual para basis points.
 * Aceita vírgula ou ponto como separador decimal.
 *
 * @example
 * parseBasisPoints("1,99")  // → 199
 * parseBasisPoints("2.50")  // → 250
 */
export function parseBasisPoints(value: string): number {
  // QA-057: mesma normalização robusta de parseCurrencyToCents (o replace único de
  // vírgula falhava em formatos com milhar). Taxas raramente usam milhar, mas
  // mantemos consistente para evitar o mesmo defeito.
  let s = value.trim().replace(/[^\d.,-]/g, '')
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) s = s.replace(/\./g, '').replace(',', '.')
  else if (hasComma) s = s.replace(',', '.')
  else if (hasDot && ((s.match(/\./g) || []).length) > 1) s = s.replace(/\./g, '')

  const parsed = parseFloat(s)
  if (isNaN(parsed)) throw new Error(`Taxa inválida: "${value}"`)
  return Math.round(parsed * 100)
}
