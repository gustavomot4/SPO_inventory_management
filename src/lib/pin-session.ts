// =============================================================================
// lib/pin-session.ts — Leitura da sessão PIN em Route Handlers (QA-062/QA-064)
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// Alguns GETs são públicos no middleware (comanda, PDV), mas retornam dados
// sensíveis (custo do produto, taxa da maquininha) que só devem aparecer para
// quem tem o PIN verificado. Este helper permite ao handler decidir, campo a
// campo, o que expor — sem bloquear o acesso público ao recurso.
// =============================================================================

import { getIronSession } from 'iron-session'
import type { NextRequest } from 'next/server'
import { sessionOptions, type SessionData } from '@/lib/session'

/**
 * Retorna true se a requisição traz uma sessão com PIN verificado.
 * Nunca lança — em qualquer erro de leitura do cookie, retorna false (fail-closed).
 */
export async function isPinVerified(request: NextRequest): Promise<boolean> {
  try {
    const dummyRes = new Response()
    const session = await getIronSession<SessionData>(
      request,
      dummyRes as unknown as Response,
      sessionOptions
    )
    return session.isPinVerified === true
  } catch {
    return false
  }
}
