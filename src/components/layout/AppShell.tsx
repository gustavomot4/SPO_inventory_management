// =============================================================================
// AppShell.tsx — Wrapper de layout responsivo (Client Component)
// SPO — Sistema Pimenta Ousada | MVP-007 v2
// =============================================================================
//
// 'use client' necessário para useState (toggle mobile) e useEffect (Escape).
// O conteúdo do sidebar vem como ReactNode de um Server Component —
// padrão recomendado pelo Next.js App Router para preservar o Server tree.
//
// Layout:
//   Desktop (lg+): sidebar fixo 256px à esquerda + área de conteúdo flex-1
//   Mobile:        header top com botão Menu → sidebar como overlay com backdrop
//
// Design (v2):
//   - Menu (Lucide) e X (Lucide) como ícones de toggle — sem emojis
//   - Flame (Lucide) no header mobile para manter identidade visual
//   - Backdrop semitransparente no mobile com transição suave
// =============================================================================

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Menu, X, Flame } from 'lucide-react'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AppShellProps {
  children: React.ReactNode
  sidebar: React.ReactNode
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function AppShell({ children, sidebar }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  // Fechar ao pressionar Escape
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) setMobileOpen(false)
    },
    [mobileOpen]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [handleEscape])

  // Travar scroll do body quando sidebar mobile está visível
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <div className="flex min-h-screen bg-background">

      {/* ── Backdrop mobile ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-gray-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        id="main-sidebar"
        className={[
          // Desktop: estático, sempre visível
          'lg:static lg:z-auto lg:h-auto lg:translate-x-0 lg:w-64 lg:shrink-0',
          // Mobile: fixo, desliza via translate
          'fixed inset-y-0 left-0 z-40 w-64 transition-transform duration-200 ease-in-out lg:transition-none',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        aria-label="Menu lateral"
      >
        {/* Botão fechar — só no mobile */}
        <button
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
          type="button"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="h-full">{sidebar}</div>
      </aside>

      {/* ── Área de conteúdo ── */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* Header mobile */}
        <header className="no-print sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 -ml-1 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            aria-label="Abrir menu de navegação"
            aria-expanded={mobileOpen}
            aria-controls="main-sidebar"
            type="button"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Marca no header mobile */}
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-brand-700" aria-hidden="true" strokeWidth={2.5} />
            <span className="text-sm font-bold tracking-tight text-gray-900">
              Pimenta Ousada
            </span>
          </div>

          {/* Espaçador para centralizar a marca */}
          <div className="w-9" aria-hidden="true" />
        </header>

        {/* Conteúdo da página */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
