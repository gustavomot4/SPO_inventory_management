// =============================================================================
// types/index.ts — Tipos TypeScript compartilhados
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// NOTA: Tipos derivados diretamente do schema Prisma são importados de
// '@prisma/client' e NÃO são redeclarados aqui.
// Ex: import type { User, Product, Sale } from '@prisma/client'
//
// Este arquivo contém tipos de aplicação (API contracts, estados de UI,
// tipos compostos) que não existem no schema do banco.

// ---------------------------------------------------------------------------
// API — Formato padrão de resposta
// Todas as Route Handlers e Server Actions seguem este contrato.
// ---------------------------------------------------------------------------

export type ApiSuccess<T> = {
  data: T
  meta?: {
    page?: number
    pageSize?: number
    total?: number
    hasNextPage?: boolean
    cursor?: string
  }
}

export type ApiError = {
  error: string
  code?: string     // código de erro legível por máquina
  details?: unknown // erros de validação campo a campo
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ---------------------------------------------------------------------------
// RESULT TYPE — Para operações de serviço que podem falhar previsivelmente
// Evita uso de try/catch espalhado pela aplicação.
// ---------------------------------------------------------------------------

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

// ---------------------------------------------------------------------------
// PAGINAÇÃO — Parâmetros de entrada para listagens
// ---------------------------------------------------------------------------

export type PaginationParams = {
  cursor?: string
  pageSize?: number
}

// ---------------------------------------------------------------------------
// CARD MACHINES — MAQU-001
// ---------------------------------------------------------------------------

export type CardMachineInstallmentResponse = {
  id: string
  cardMachineId: string
  installments: number   // numero de parcelas: 2, 3... 12
  feeBasisPoints: number // taxa para esse parcelamento em basis points
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CardMachineResponse = {
  id: string
  name: string
  feeBasisPoints: number // taxa crédito à vista — ex: 199 = 1,99%
  debitFeeBasisPoints: number | null // taxa débito — null = não configurada (v2.5)
  pixFeeBasisPoints: number | null   // taxa PIX via maquininha — null = não configurada (v2.5)
  isActive: boolean
  createdAt: string
  updatedAt: string
  installments?: CardMachineInstallmentResponse[]  // incluido em GET /[id], omitido no GET da lista
}

// ---------------------------------------------------------------------------
// SETTINGS — COM-006
// ---------------------------------------------------------------------------

export type SettingsResponse = {
  id: string
  shopName: string
  address: string | null
  phone: string | null
  updatedAt: string
  // Nota: pinHash NUNCA exposto
  // QA-081: presente APENAS quando a requisicao tem sessao PIN verificada.
  // false = sistema ainda no PIN padrao (APP_PIN/1234) — UI exibe aviso.
  pinConfigured?: boolean
}

// ---------------------------------------------------------------------------
// CATEGORIES — PROD-001
// ---------------------------------------------------------------------------

export type CategoryResponse = {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: { products: number } // incluído apenas em GET /api/categories/[id]
}

// ---------------------------------------------------------------------------
// PRODUCTS + VARIATIONS — PROD-002
// ---------------------------------------------------------------------------

export type VariationResponse = {
  id: string
  sku: string
  size: string
  color: string
  stockQuantity: number
  minStock: number
  isActive: boolean
  isLowStock: boolean // calculado: stockQuantity > 0 && stockQuantity <= minStock
  createdAt: string
  updatedAt: string
}

export type ProductResponse = {
  id: string
  name: string
  categoryId: string
  categoryName: string
  priceCents: number
  costCents: number | null  // preço de custo em centavos (PROD-007) — null se não informado
  isActive: boolean
  deletedAt: string | null
  variations: VariationResponse[]
  createdAt: string
  updatedAt: string
}

/** Usado na listagem paginada — sem array de variações para performance */
export type ProductListItem = {
  id: string
  name: string
  categoryId: string
  categoryName: string
  priceCents: number
  costCents: number | null  // preço de custo em centavos (PROD-007) — null se não informado
  isActive: boolean
  variationCount: number
  variationSkus: string[]  // SKUs das variações ativas
  totalStock: number   // soma de stockQuantity das variações ativas
  hasLowStock: boolean // true se alguma variação ativa está em alerta de estoque
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// STOCK ENTRIES — EST-001
// ---------------------------------------------------------------------------

export type StockEntryResponse = {
  id: string
  variationId: string
  variationSku: string
  productId: string
  productName: string
  quantity: number
  unitCostCents: number | null
  notes: string | null
  receivedAt: string
  createdAt: string
  stockAfter: number   // novo stockQuantity da variação após a entrada
  movementId: string   // id do StockMovement criado
}

export type StockEntryListItem = {
  id: string
  variationId: string
  variationSku: string
  productId: string
  productName: string
  quantity: number
  unitCostCents: number | null
  notes: string | null
  receivedAt: string
  createdAt: string
}

// ---------------------------------------------------------------------------
// STOCK ALERTS — EST-004
// ---------------------------------------------------------------------------

export type StockAlertItem = {
  variationId: string
  variationSku: string
  size: string
  color: string
  stockQuantity: number
  minStock: number
  status: 'OUT' | 'LOW' // OUT = zerado | LOW = abaixo do mínimo
  productId: string
  productName: string
  categoryId: string
  categoryName: string
}

// ---------------------------------------------------------------------------
// SALES — VEND-001/002/003
// ---------------------------------------------------------------------------

export type SaleItemResponse = {
  id: string
  variationId: string
  variationSku: string
  productName: string
  size: string
  color: string
  quantity: number
  unitPriceCents: number
  subtotalCents: number
}

export type SaleResponse = {
  id: string
  status: string
  paymentMethod: string
  paymentMethodLabel: string   // "Dinheiro" | "PIX" | "Débito" | "Crédito"
  subtotalCents: number
  discountCents: number
  totalCents: number
  cardMachineId: string | null
  cardMachineName: string | null
  feeCents: number | null
  notes: string | null
  cancelledAt: string | null
  cancelReason: string | null
  installments: number
  installmentFeeBasisPoints: number | null
  items: SaleItemResponse[]
  createdAt: string
  updatedAt: string
}

export type SaleListItem = {
  id: string
  status: string
  paymentMethod: string
  paymentMethodLabel: string
  subtotalCents: number
  discountCents: number
  totalCents: number
  cardMachineName: string | null
  feeCents: number | null
  itemCount: number   // contagem de SaleItems
  installments: number
  createdAt: string
}

// ---------------------------------------------------------------------------
// REPORTS -- REL-001 + REL-002
// ---------------------------------------------------------------------------

export type StockReportItem = {
  variationId: string
  variationSku: string
  productId: string
  productName: string
  categoryName: string
  size: string
  color: string
  stockQuantity: number
  minStock: number
  status: 'ok' | 'low' | 'out'
  priceCents: number
  costCents: number | null
  stockValueCents: number
  stockCostCents: number | null
}

export type StockReportMeta = {
  total: number
  okCount: number
  lowCount: number
  outCount: number
  totalStockValueCents: number
  totalStockCostCents: number | null
  estimatedPotentialProfitCents: number | null
  // QA-078: % de itens exibidos que possuem costCents (0-100).
  // null quando nao ha itens. Cobertura < 100 = custo/lucro PARCIAIS.
  costCoveragePct: number | null
}

export type SalesReportSummary = {
  totalSales: number
  totalRevenue: number
  totalDiscount: number
  averageTicketCents: number
  cancelledCount: number
  estimatedCostCents: number | null
  estimatedProfitCents: number | null
  estimatedMarginPct: number | null
  // Taxas de maquininha
  totalFeeCents: number
  netRevenueCents: number         // receita - taxas
  feePercentage: number | null    // % medio de taxa sobre receita (null se sem taxa)
  // QA-053: indica que o periodo excedeu o limite de 5000 vendas e o relatorio
  // foi calculado apenas sobre uma amostra (totais subestimados).
  truncated: boolean
  totalSalesInPeriod: number      // total real de vendas no periodo (antes do limite)
  // QA-078: % das unidades vendidas cujo produto tem costCents (0-100).
  // null quando nao ha itens vendidos. Cobertura < 100 = lucro/margem calculados
  // sobre base de custo INCOMPLETA (receita total - custo de parte dos itens).
  costCoveragePct: number | null
}

export type SalesByPaymentMethod = {
  paymentMethod: string
  paymentMethodLabel: string
  count: number
  totalCents: number
  feeCents: number // taxas estimadas do método no período (v2.5)
  netCents: number // totalCents - feeCents (v2.5)
}

export type TopVariation = {
  variationId: string
  variationSku: string
  productName: string
  size: string
  color: string
  quantitySold: number
  revenueCents: number
  costPerUnitCents: number | null
  estimatedProfitCents: number | null
}

export type SalesByDay = {
  date: string
  count: number
  revenueCents: number
}

export type SalesReportData = {
  summary: SalesReportSummary
  byPaymentMethod: SalesByPaymentMethod[]
  topVariations: TopVariation[]
  byDay: SalesByDay[]
}
