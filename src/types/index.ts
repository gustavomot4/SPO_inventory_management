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
// PLACEHOLDER — Tipos específicos de domínio serão adicionados nas próximas tasks
// Ex: tipos para criação de venda, filtros de relatório, etc.
// ---------------------------------------------------------------------------
