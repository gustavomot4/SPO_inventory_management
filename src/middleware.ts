// =============================================================================
// middleware.ts — Proteção de rotas sensíveis por PIN
// SPO — Sistema Pimenta Ousada | MVP-005
// =============================================================================
//
// Arquitetura (ADR-003 + RN-007.4):
//   - Sistema ABERTO por padrão: vendas, estoque, cadastros sem PIN
//   - Apenas relatórios e configurações requerem PIN verificado
//
// Lógica:
//   1. Rotas públicas → passa direto (sem verificação)
//   2. Rotas protegidas sem sessão válida:
//      - Rotas de API  → 401 JSON (o frontend trata)
//      - Rotas de página → redireciona para /pin
//   3. Todas as demais rotas → passa direto (acesso aberto)
//
// IMPORTANTE: O middleware roda no Edge Runtime (sem acesso ao Prisma/SQLite).
// A verificação de PIN configurado (se existe hash no banco) é feita pelos
// Route Handlers, não aqui. O middleware verifica apenas o cookie de sessão.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, type PinSessionData } from '@/lib/pin-session'

// ---------------------------------------------------------------------------
// Mapa de rotas protegidas (requerem PIN verificado)
// RN-007.4: relatórios e configurações protegidos
// ---------------------------------------------------------------------------
const PROTECTED_PAGE_PATHS = [
  '/relatorios',    // relatórios financeiros (vendas por período, produtos mais vendidos)
  '/configuracoes', // configurações do sistema (maquininhas, PIN, nome da loja)
] as const

const PROTECTED_API_PATHS = [
  '/api/reports',   // APIs de relatório
  '/api/settings',  // APIs de configuração do sistema
] as const

// ---------------------------------------------------------------------------
// Rotas públicas (nunca bloqueadas)
// ---------------------------------------------------------------------------
const ALWAYS_PUBLIC_PATHS = [
  '/pin',        // tela de entrada do PIN
  '/api/auth',   // endpoints de autenticação (verify, logout, status)
  '/_next',      // assets do Next.js (JS, CSS, images)
  '/favicon',    // ícone do browser
] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPublicPath(pathname: string): boolean {
  return ALWAYS_PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

function isProtectedApiPath(pathname: string): boolean {
  return PROTECTED_API_PATHS.some((p) => pathname.startsWith(p))
}

function isProtectedPagePath(pathname: string): boolean {
  return PROTECTED_PAGE_PATHS.some((p) => pathname.startsWith(p))
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/')
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // 1. Rotas públicas: passa direto
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // 2. Verificar se a rota requer PIN
  const requiresPin =
    isProtectedPagePath(pathname) || isProtectedApiPath(pathname)

  if (!requiresPin) {
    // Rota aberta (vendas, estoque, cadastros) — sem verificação
    return NextResponse.next()
  }

  // 3. Verificar sessão PIN no cookie
  const session = await getIronSession<PinSessionData>(
    request.cookies,
    sessionOptions
  )

  if (session.isPinVerified === true) {
    // Sessão válida — permitir acesso
    return NextResponse.next()
  }

  // 4. Sem sessão válida — negar acesso
  if (isApiPath(pathname)) {
    // APIs: retornar 401 JSON (o frontend trata o erro e redireciona)
    return NextResponse.json(
      {
        error: 'PIN necessário para acessar esta área',
        code: 'PIN_REQUIRED',
      },
      { status: 401 }
    )
  }

  // Páginas: redirecionar para /pin com o destino original como query param
  const pinUrl = new URL('/pin', request.url)
  pinUrl.searchParams.set('redirect', pathname)
  return NextResponse.redirect(pinUrl)
}

// ---------------------------------------------------------------------------
// Configuração do matcher
// Exclui assets estáticos para não impactar performance
// ---------------------------------------------------------------------------
export const config = {
  matcher: [
    /*
     * Aplica o middleware em todas as rotas exceto:
     * - Arquivos estáticos do Next.js (_next/static, _next/image)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
}
