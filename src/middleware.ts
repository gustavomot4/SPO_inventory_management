// =============================================================================
// middleware.ts — Proteção por PIN em rotas sensíveis
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// Rotas protegidas (requerem PIN):
//   Páginas: /configuracoes, /relatorios
//   APIs:    /api/settings (mutações), /api/reports, /api/card-machines,
//            /api/categories (mutações), /api/sales/:id/cancel
//
// Exceções públicas (sem PIN):
//   GET /api/settings — leitura usada pela comanda e dashboard
//
// QA-003: card-machines e categories estavam sem proteção na API
// QA-008: cancelamento de venda exige PIN (operação destrutiva)
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
    '/api/reports/:path*',
    '/api/card-machines/:path*',  // QA-003: maquininhas são área protegida (RN-007.4)
    '/api/categories/:path*',     // QA-003: categorias são configuração protegida
    '/api/sales/:id/cancel',      // QA-008: cancelamento é operação destrutiva
  ],
}
