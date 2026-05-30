// =============================================================================
// middleware.ts — Proteção por PIN em rotas sensíveis
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// Rotas protegidas: /configuracoes, /relatorios
// Rotas abertas: /, /produtos, /estoque, /vendas, /pin, /api/*
//
// Fluxo:
//   1. Usuário acessa rota protegida
//   2. Middleware verifica cookie iron-session
//   3. Se isPinVerified = true → acesso liberado
//   4. Se não → redirect para /pin?redirect=<path>
// =============================================================================

import { getIronSession } from 'iron-session'
import { NextRequest, NextResponse } from 'next/server'
import { sessionOptions, type SessionData } from '@/lib/session'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const session = await getIronSession<SessionData>(request, response, sessionOptions)

  if (!session.isPinVerified) {
    const redirectTo = request.nextUrl.pathname
    const pinUrl = new URL(`/pin?redirect=${encodeURIComponent(redirectTo)}`, request.url)
    return NextResponse.redirect(pinUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/configuracoes/:path*',
    '/relatorios/:path*',
    '/api/settings/:path*',
  ],
}
