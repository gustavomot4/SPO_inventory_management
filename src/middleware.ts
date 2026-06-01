// =============================================================================
// middleware.ts — Proteção por PIN em rotas sensíveis
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// Rotas protegidas (requerem PIN):
//   Páginas: /configuracoes, /relatorios
//   APIs:    /api/settings (mutações), /api/reports, /api/card-machines,
//            /api/categories, /api/sales/:id/cancel
//
// Exceção pública: GET /api/settings — comanda e dashboard lêem sem PIN
//
// QA-003: card-machines e categories estavam desprotegidas na API
// QA-008: cancelamento de venda é operação destrutiva — exige PIN
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
    '/api/card-machines/:path*',
    '/api/categories/:path*',
    '/api/sales/:id/cancel',
  ],
}
