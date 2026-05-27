// =============================================================================
// sku.ts — Gerador automático de SKU para variações de produto
// SPO — Sistema Pimenta Ousada | PROD-003
// =============================================================================
//
// Formato: [PREFIXO]-[TAMANHO]-[COR]-[SEQ]
// Exemplos:
//   "Blusa Floral Rosa" tam "M" cor "Rosa"  → BFR-M-ROS-001
//   "Calça Jeans Azul"  tam "40" cor "Azul" → CJA-40-AZU-001
//   "Vestido"           tam "P" cor "Preto" → VES-P-PRE-001
// =============================================================================

import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Gera o prefixo de 3 letras a partir do nome do produto.
 *
 * Algoritmo:
 * 1. Toma a inicial (1ª letra) de cada palavra como base
 * 2. Se as iniciais < 3 chars, preenche com as letras restantes de cada palavra
 *    (letras 2, 3, 4... da 1ª palavra, depois da 2ª, etc.)
 *
 * Exemplos:
 *   "Blusa Floral Rosa" → B+F+R → "BFR"  (3 palavras, iniciais suficientes)
 *   "Vestido"           → V + "ES" → "VES" (1 palavra, preenche com letras seguintes)
 *   "Blusa Floral"      → B+F + "L" → "BFL" (2 palavras, preenche com 2ª letra de "Blusa")
 *   "Calça Jeans Azul"  → C+J+A → "CJA"
 */
function buildPrefix(productName: string): string {
  // Normaliza: remove acentos, letras maiúsculas, remove não-letras exceto espaços
  const cleanName = productName
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '')
    .trim()

  const words = cleanName.split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'XXX'

  // Passo 1: iniciais de cada palavra (até 3)
  const initials = words.slice(0, 3).map((w) => w[0])
  if (initials.length >= 3) {
    return initials.join('')
  }

  // Passo 2: precisamos de mais letras — usamos as letras restantes de cada palavra, em ordem
  const remaining: string[] = []
  for (const word of words) {
    for (let i = 1; i < word.length; i++) {
      remaining.push(word[i])
    }
  }

  const full = [...initials, ...remaining]
  return full.slice(0, 3).join('').padEnd(3, 'X')
}

/**
 * Normaliza a cor para 3 letras maiúsculas sem acentos.
 * "Rosa" → "RSA" | "Azul" → "AZL" | "Preto" → "PRT"
 */
function buildColorCode(color: string): string {
  const normalized = color
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')

  // Toma 1ª letra + letras consonantais restantes para compactar melhor
  // Se tiver < 3 letras, preenche com o que tiver
  return normalized.slice(0, 3).padEnd(3, 'X')
}

// ---------------------------------------------------------------------------
// Função principal exportada
// ---------------------------------------------------------------------------

/**
 * Gera um SKU único para uma variação de produto.
 *
 * Formato: [PREFIXO]-[TAMANHO]-[COR]-[SEQ]
 *
 * Idempotente enquanto não há colisão — se o SKU gerado já existir,
 * incrementa o SEQ automaticamente até encontrar um livre.
 *
 * @param productName - Nome do produto (ex: "Blusa Floral Rosa")
 * @param size        - Tamanho da variação (ex: "M", "40", "Único")
 * @param color       - Cor da variação (ex: "Rosa", "Azul", "Preto")
 * @returns SKU único gerado (ex: "BFR-M-RSA-001")
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

  // Contar quantas variações já usam este prefixo para determinar o SEQ inicial
  const existingCount = await prisma.productVariation.count({
    where: { sku: { startsWith: skuBase } },
  })

  let seq = existingCount + 1
  let sku = `${skuBase}${seq.toString().padStart(3, '0')}`

  // Verificar colisão (raro, mas possível se SKUs foram criados/deletados)
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
