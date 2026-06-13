// =============================================================================
// middleware.ts — Protecao por PIN em rotas sensiveis
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// Rotas protegidas (requerem PIN):
//   Paginas: /configuracoes, /relatorios
//   APIs:    /api/settings (mutacoes), /api/reports, /api/card-machines (mutacoes),
//            /api/categories, /api/products (mutacoes), /api/stock-entries (GET),
//            /api/sales/:id/cancel
//
// Excecoes publicas (sem PIN):
//   GET  /api/settings        — comanda e dashboard leem sem PIN
//   GET  /api/products/*      — PDV (vendas/nova) precisa listar produtos sem autenticar
//   GET  /api/card-machines/* — PDV precisa listar maquininhas/parcelas p/ venda em cartao — QA-071
//   GET  /api/sales           — historico de vendas e area aberta (decisao do cliente
//                               2026-06-12; reverte QA-041 — taxa segue oculta sem PIN)
//   GET  /api/sales/[id]      — detalhe de venda para impressão da comanda após criar venda
//   POST /api/sales           — registrar venda é área aberta (ADR-003 / RN-007.2) — QA-061
//   POST /api/stock-entries   — entrada de estoque é área aberta (ADR-003) — QA-063
//
// NOTA (verificado no Next 14): um matcher '/api/x/:path*' casa TAMBEM o caminho
// base '/api/x' (sem segmento extra). Toda excecao de caminho base precisa ser
// explicita na logica abaixo — nao confiar no matcher para isso.
//
// QA-003: card-machines e categories estavam desprotegidas na API
// QA-008: cancelamento de venda e operacao destrutiva — exige PIN
// QA-034: produtos (PATCH/DELETE/POST) e stock-entries (POST) exigem PIN —
//         qualquer pessoa na rede local poderia alterar precos ou inativar produtos
// QA-041: GET /api/sales (lista financeira) exige PIN — expunha faturamento sem autenticacao
// QA-071: leitura de maquininhas liberada — sem isso a vendedora sem PIN via o
//         dropdown de maquininha vazio e NAO CONSEGUIA vender em cartao (a
//         abertura do QA-061 ficava pela metade). Mutacoes continuam sob PIN.
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
  // (a projecao publica omite taxa/maquininha — ver QA-064 no handler)
  if (pathname.match(/^\/api\/sales\/[^\/]+$/) && method === 'GET') {
    return NextResponse.next()
  }

  // DECISAO DO CLIENTE (2026-06-12): a tela de Vendas (/vendas, historico) e
  // AREA ABERTA — sem PIN. Reverte parcialmente o QA-041 (que protegia a lista
  // por expor faturamento) por decisao explicita do dono do projeto; alinha com
  // a RN-007.4, que so preve PIN em RELATORIOS e CONFIGURACOES. A projecao
  // publica do handler omite taxa/maquininha sem sessao (padrao QA-064).
  // Mutacao destrutiva continua protegida: POST /api/sales/:id/cancel exige PIN
  // (QA-008 / FLUXO-007 — cancelamento e acao da dona).
  if (pathname === '/api/sales' && method === 'GET') {
    return NextResponse.next()
  }

  // QA-061: POST /api/sales (registrar venda) e AREA ABERTA por ADR-003 / RN-007.2.
  // Apenas a LISTA financeira (GET /api/sales) exige PIN. Sem esta excecao, a
  // vendedora montava o carrinho mas nao conseguia finalizar (401), quebrando o
  // fluxo primario FLUXO-001.
  if (pathname === '/api/sales' && method === 'POST') {
    return NextResponse.next()
  }

  // QA-063: POST /api/stock-entries (entrada de estoque) e AREA ABERTA por ADR-003.
  // A LISTA/detalhe (GET) continua exigindo PIN (exibe custo unitario).
  if (pathname === '/api/stock-entries' && method === 'POST') {
    return NextResponse.next()
  }

  // QA-071: GET /api/card-machines (lista, detalhe e parcelamentos) e publico.
  // O PDV (vendas/nova — area aberta, ADR-003/RN-007.2) carrega a lista de
  // maquininhas e as taxas de parcelamento para registrar venda em DEBIT/CREDIT.
  // Sem esta excecao o GET respondia 401, o dropdown ficava vazio e a venda em
  // cartao era impossivel sem PIN — quebrando o FLUXO-001 no caso mais comum.
  // A taxa exibida ao operador no PDV e comportamento especificado (RN-010.3).
  // Mutacoes (POST/PATCH/DELETE de maquininha e parcelamento) continuam sob PIN.
  if (pathname.startsWith('/api/card-machines') && method === 'GET') {
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
    '/api/sales',        // POST e publico (QA-061) e GET e publico (decisao do cliente 2026-06-12) — excecoes na logica acima
    '/api/sales/:path*', // cobre /api/sales/:id/cancel (PIN — QA-008); GET /[id] e publico via logica acima
  ],
}
