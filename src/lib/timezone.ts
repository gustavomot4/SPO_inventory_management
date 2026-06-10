// =============================================================================
// lib/timezone.ts — Fuso horário fixo da loja (QA-055)
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// PROBLEMA (QA-055): timestamps são gravados em UTC (strftime '...Z' no SQLite),
// mas o usuário pensa em "dia comercial" no horário de Brasília. Tratar a data
// local como se fosse UTC fazia vendas após as 21h (BRT) caírem no dia seguinte
// no filtro e no agrupamento por dia.
//
// SOLUÇÃO: fuso fixo da loja. O Brasil (America/Sao_Paulo) não observa horário
// de verão desde 2019, então um offset constante de UTC−3 é correto e estável,
// sem dependências externas. Sistema single-tenant de fuso único.
//
// Se um dia a loja mudar de fuso (ou o Brasil reintroduzir DST), basta ajustar
// STORE_TZ_OFFSET_MINUTES — este é o único ponto de verdade do fuso no projeto.
// =============================================================================

/** Offset do fuso da loja em minutos relativo ao UTC. UTC−3 = -180. */
export const STORE_TZ_OFFSET_MINUTES = -180

// Extrai ano/mês/dia de uma string YYYY-MM-DD sem desestruturar array
// (noUncheckedIndexedAccess trata índices como number | undefined; Number(...)
// aceita string | undefined e sempre retorna number).
function parseYmd(dateYmd: string): { y: number; m: number; d: number } {
  const parts = dateYmd.split('-')
  return { y: Number(parts[0]), m: Number(parts[1]), d: Number(parts[2]) }
}

/**
 * Converte uma data local da loja (YYYY-MM-DD) no instante UTC ISO do
 * INÍCIO desse dia (00:00:00.000 no horário da loja).
 * Ex.: '2026-06-02' (UTC−3) → '2026-06-02T03:00:00.000Z'
 */
export function storeDayStartToUtc(dateYmd: string): string {
  const { y, m, d } = parseYmd(dateYmd)
  const utcMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - STORE_TZ_OFFSET_MINUTES * 60_000
  return new Date(utcMs).toISOString()
}

/**
 * Converte uma data local da loja (YYYY-MM-DD) no instante UTC ISO do
 * FIM desse dia (23:59:59.999 no horário da loja).
 * Ex.: '2026-06-02' (UTC−3) → '2026-06-03T02:59:59.999Z'
 */
export function storeDayEndToUtc(dateYmd: string): string {
  const { y, m, d } = parseYmd(dateYmd)
  const utcMs = Date.UTC(y, m - 1, d, 23, 59, 59, 999) - STORE_TZ_OFFSET_MINUTES * 60_000
  return new Date(utcMs).toISOString()
}

/**
 * Dado um timestamp UTC ISO, retorna o "dia comercial" da loja (YYYY-MM-DD)
 * a que ele pertence no horário local.
 * Ex.: '2026-06-03T00:00:00.000Z' (= 21h BRT do dia 02) → '2026-06-02'
 */
export function utcToStoreDay(utcIso: string): string {
  const localMs = new Date(utcIso).getTime() + STORE_TZ_OFFSET_MINUTES * 60_000
  return new Date(localMs).toISOString().slice(0, 10)
}

/** Retorna a data local da loja de "hoje" (YYYY-MM-DD), independente do fuso do servidor. */
export function storeToday(): string {
  return utcToStoreDay(new Date().toISOString())
}

/**
 * QA-070: valida uma data no formato YYYY-MM-DD garantindo que é um dia de
 * calendário REAL (rejeita 2026-13-45). O regex sozinho aceitava datas inválidas,
 * que o Date.UTC "rolava" silenciosamente, deslocando filtros e relatórios.
 */
export function isValidYmd(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const { y, m, d } = parseYmd(value)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  )
}
