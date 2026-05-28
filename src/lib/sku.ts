// =============================================================================
// sku.ts — Gerador automatico de SKU para variacoes de produto
// SPO — Sistema Pimenta Ousada | PROD-003
// =============================================================================
//
// Formato: [PREFIXO]-[TAMANHO]-[COR]-[SEQ]
// Exemplos:
//   "Blusa Floral Rosa" tam "M" cor "Rosa"  -> BFR-M-ROS-001
//   "Calca Jeans Azul"  tam "40" cor "Azul" -> CJA-40-AZU-001
//   "Vestido"           tam "P" cor "Preto" -> VES-P-PRE-001
// =============================================================================

import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Remove diacriticos de uma string normalizada em NFD.
 * Faixa [̀-ͯ] = Combining Diacritical Marks block (sem flag /u,
 * compativel com qualquer target TypeScript).
 * Substitui a abordagem anterior com \p{M}/gu que exigia ES2018 target.
 */
function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Gera o prefixo de 3 letras a partir do nome do produto.
 *
 * Algoritmo:
 * 1. Toma a inicial de cada palavra como base
 * 2. Se as iniciais < 3 chars, preenche com letras restantes de cada palavra
 */
function buildPrefix(productName: string): string {
  const cleanName = removeDiacritics(productName)
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '')
    .trim()

  const words = cleanName.split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'XXX'

  // Passo 1: iniciais de cada palavra (ate 3)
  // Usa charAt(0) que sempre retorna string (fix para noUncheckedIndexedAccess)
  const initials = words.slice(0, 3).map((w) => w.charAt(0))
  if (initials.length >= 3) {
    return initials.join('')
  }

  // Passo 2: preenche com letras restantes, em ordem
  // Usa charAt(i) que sempre retorna string (nunca undefined)
  const remaining: string[] = []
  for (const word of words) {
    for (let i = 1; i < word.length; i++) {
      remaining.push(word.charAt(i))
    }
  }

  const full = [...initials, ...remaining]
  return full.slice(0, 3).join('').padEnd(3, 'X')
}

/**
 * Normaliza a cor para 3 letras maiusculas sem acentos.
 * "Rosa" -> "ROS" | "Azul" -> "AZU" | "Preto" -> "PRE"
 */
function buildColorCode(color: string): string {
  const normalized = removeDiacritics(color)
    .toUpperCase()
    .replace(/[^A-Z]/g, '')

  return normalized.slice(0, 3).padEnd(3, 'X')
}

// ---------------------------------------------------------------------------
// Funcao principal exportada
// ---------------------------------------------------------------------------

/**
 * Gera um SKU unico para uma variacao de produto.
 *
 * Formato: [PREFIXO]-[TAMANHO]-[COR]-[SEQ]
 *
 * Idempotente enquanto nao ha colisao — se o SKU gerado ja existir,
 * incrementa o SEQ automaticamente ate encontrar um livre.
 */
export async function generateSku(
  productName: string,
  size: string,
  color: string
): Promise<string> {
  const prefix = buildPrefix(productName)
  const sizeCode = size.toUpperCase().slice(0, 4)
  const colorCode = buildColorCode(color)

  const skuBase = `${prefix}-${sizeCode}-${colorCode}-`

  const existingCount = await prisma.productVariation.count({
    where: { sku: { startsWith: skuBase } },
  })

  let seq = existingCount + 1
  let sku = `${skuBase}${seq.toString().padStart(3, '0')}`

  // Verificar colisao (raro, mas possivel se SKUs foram criados/deletados)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const collision = await prisma.productVariation.findUnique({
      where: { sku },
      select: { id: true },
    })
    if (!collision) break
    seq++
    sku = `${skuBase}${seq.toString().padStart(3, '0')}`
  }

  return sku
}
