// =============================================================================
// pin-auth.ts — Helpers de autenticação por PIN
// SPO — Sistema Pimenta Ousada | MVP-005
// =============================================================================
//
// Regras de negócio (RN-007):
//   RN-007.3: PIN numérico de 4–6 dígitos
//   RN-007.5: PIN armazenado como hash bcrypt — nunca em texto plano
//   RN-007.6: Se nenhum PIN configurado, áreas sensíveis ficam acessíveis
//   RN-007.7: PIN pode ser redefinido nas Configurações
//   RN-007.8: Sem recuperação de PIN — sistema local
//
// NOTA: As funções neste arquivo acessam `prisma.settings` usando os field names
// do Prisma schema (pinHash, shopName). O Database Agent deve adicionar as
// anotações @map correspondentes ao schema.prisma para alinhar com as colunas
// snake_case do banco (pin_hash, shop_name). Ver DT-004 no z_last_task.md.
// =============================================================================

import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { sessionOptions, type PinSessionData } from '@/lib/pin-session'

// ---------------------------------------------------------------------------
// Gestão de sessão
// ---------------------------------------------------------------------------

/**
 * Retorna a sessão PIN atual do cookie HTTP-only.
 * Deve ser chamada apenas em contexto de servidor (Server Components, Route Handlers).
 */
export async function getSession() {
  return getIronSession<PinSessionData>(await cookies(), sessionOptions)
}

/**
 * Verifica se há uma sessão PIN ativa na requisição atual.
 */
export async function isPinVerified(): Promise<boolean> {
  const session = await getSession()
  return session.isPinVerified === true
}

// ---------------------------------------------------------------------------
// Verificação e gestão do PIN
// ---------------------------------------------------------------------------

export type CheckPinResult = 'ok' | 'wrong' | 'no_pin_set'

/**
 * Verifica o PIN informado contra o hash armazenado no banco.
 *
 * Retorna:
 * - 'ok'         → PIN correto, conceder acesso
 * - 'wrong'      → PIN incorreto, negar acesso
 * - 'no_pin_set' → nenhum PIN configurado, conceder acesso (RN-007.6)
 */
export async function checkPin(pin: string): Promise<CheckPinResult> {
  const settings = await prisma.settings.findFirst()

  if (!settings?.pinHash) {
    return 'no_pin_set'
  }

  const valid = await bcrypt.compare(pin, settings.pinHash)
  return valid ? 'ok' : 'wrong'
}

/**
 * Define ou redefine o PIN do sistema.
 * Cria o hash bcrypt e salva no Settings singleton.
 *
 * @param newPin - PIN em texto plano (4–6 dígitos) — validar formato antes de chamar
 */
export async function setPin(newPin: string): Promise<void> {
  // Custo 12 é o recomendado para bcrypt em 2026 — bom balanço segurança/performance
  const pinHash = await bcrypt.hash(newPin, 12)

  await prisma.settings.update({
    where: { id: 'singleton' },
    data: { pinHash },
  })
}

/**
 * Remove o PIN (sistema volta a ter acesso livre às áreas sensíveis).
 * Apenas a dona deve ter acesso a esta função.
 */
export async function clearPin(): Promise<void> {
  await prisma.settings.update({
    where: { id: 'singleton' },
    data: { pinHash: null },
  })
}

/**
 * Verifica se o PIN está configurado no sistema.
 */
export async function isPinConfigured(): Promise<boolean> {
  const settings = await prisma.settings.findFirst({
    select: { pinHash: true },
  })
  return settings?.pinHash != null
}
