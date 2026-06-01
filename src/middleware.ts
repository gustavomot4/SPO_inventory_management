// =============================================================================
// middleware.ts — Protecao por PIN em rotas sensiveis
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// Rotas protegidas (requerem PIN):
//   Paginas: /configuracoes, /relatorios
//   APIs:    /api/settings (mutacoes), /api/reports, /api/card-machines,
//            /api/categories, /api/products (mutacoes), /api/stock-entries,
//            /api/sales/:id/cancel
//
// Excecoes publicas (sem PIN):
//   GET /api/settings      — comanda e dashboard leem sem PIN
//   GET /api/products/*    — PDV (vendas/nova) precisa listar produtos sem autenticar
//   GET /api/sales/[id]    — detalhe de venda para impressão da comanda após criar venda
//
// QA-003: card-machines e categories estavam desprotegidas na API
// QA-008: cancelamento de venda e operacao destrutiva — exige PIN
// QA-034: produtos (PATCH/DELETE/POST) e stock-entries (POST) exigem PIN —
//         qualquer pessoa na rede local poderia alterar precos ou inativar produtos
// QA-041: GET /api/sales (lista financeira) exige PIN — expunha faturamento sem autenticacao
// =============================================================================

import { getIronSession } from 'iron-session'
import { NextRequest, NextResponse } from 'next/server'
import { sessionOptions, type SessionData } from '@/lib/session'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method

  // GET /api/settings e publico — comanda e dashboard leem sem PIN
  if (pathname.startsWith('/api/settings') && method === 'GET') {
    return NextResponse.next()
  }

  // GET /api/products/* e publico — PDV precisa listar produtos sem autenticar
  if (pathname.startsWith('/api/products') && method === 'GET') {
    return NextResponse.next()
  }

  // GET /api/sales/[id] e publico — tela de detalhe e comanda carregam sem PIN
  // (vendas sao criadas com PIN ativo, mas a comanda precisa ser acessivel ao imprimir)
  // GET /api/sales (lista) e GET /api/sales com filtros EXIGEM PIN (dados financeiros)
  if (pathname.match(/^\/api\/sales\/[^\/]+$/) && method === 'GET') {
    return NextResponse.next()
  }

  const response = NextResponse.next()
  const session = await getIronSession<SessionData>(request, response, sessionOptions)

  if (!session.isPinVerified) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Nao autorizado. PIN necessario.', code: 'UNAUTHORIZED' },
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
    '/api/products/:path*',
    '/api/stock-entries/:path*',
    '/api/sales',        // QA-041: GET /api/sales (lista) — dados financeiros exigem PIN
    '/api/sales/:path*', // QA-041: cobre /api/sales/:id/cancel e subrotas (exceto GET /[id] — ver logica acima)
  ],
}
