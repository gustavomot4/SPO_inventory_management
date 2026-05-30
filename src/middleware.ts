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
  const { pathname } = request.nextUrl

  // GET /api/settings é público — comanda e dashboard lêem sem PIN
  if (pathname.startsWith('/api/settings') && request.method === 'GET') {
    return NextResponse.next()
  }

  const response = NextResponse.next()
  const session = await getIronSession<SessionData>(request, response, sessionOptions)

  if (!session.isPinVerified) {
    // Rotas de API retornam 401 JSON (não redirect) para não quebrar fetch() no cliente
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Não autorizado. PIN necessário.', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }
    const pinUrl = new URL(`/pin?redirect=${encodeURIComponent(pathname)}`, request.url)
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
