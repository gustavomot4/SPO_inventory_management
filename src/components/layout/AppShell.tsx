// =============================================================================
// AppShell.tsx — Wrapper interativo do layout (Client Component)
// SPO — Sistema Pimenta Ousada | MVP-007
// =============================================================================
//
// Necessita 'use client' apenas para controlar abertura/fechamento do sidebar
// no mobile. O conteúdo do sidebar é passado como ReactNode vindo de um
// Server Component (SidebarContent), mantendo o Server Component tree intacto.
//
// Layout:
//   - Desktop (lg+): sidebar fixo à esquerda (256px) + conteúdo principal
//   - Mobile: barra superior com hamburger → sidebar desliza como overlay
// =============================================================================

'use client'

import { useState, useEffect, useCallback } from 'react'

interface AppShellProps {
  children: React.ReactNode
  sidebar: React.ReactNode
}

// Ícone de menu hambúrguer
function MenuIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
      />
    </svg>
  )
}

// Ícone de fechar (X)
function CloseIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  )
}

export function AppShell({ children, sidebar }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  // Fechar sidebar ao apertar Escape
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && mobileOpen) {
      setMobileOpen(false)
    }
  }, [mobileOpen])

  useEffect(() => {
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [handleEscape])

  // Travar scroll do body quando sidebar mobile está aberto
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* ── OVERLAY MOBILE ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── SIDEBAR ── */}
      {/* Desktop: sempre visível; Mobile: desliza via translate */}
      <aside
        id="main-sidebar"
        className={[
          'fixed top-0 left-0 z-40 h-full w-64 transition-transform duration-200 ease-in-out',
          'lg:static lg:z-auto lg:h-auto lg:translate-x-0 lg:transition-none',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        aria-label="Menu lateral"
      >
        {/* Botão fechar — visível apenas no mobile */}
        <button
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
        >
          <CloseIcon />
        </button>

        {/* Conteúdo do sidebar (vem como Server Component prop) */}
        <div className="h-full">
          {sidebar}
        </div>
      </aside>

      {/* ── ÁREA DE CONTEÚDO ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Barra superior mobile */}
        <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            aria-label="Abrir menu de navegação"
            aria-expanded={mobileOpen}
            aria-controls="main-sidebar"
          >
            <MenuIcon />
          </button>

          <span className="text-sm font-bold text-brand-700">
            🌶️ Pimenta Ousada
          </span>

          {/* Espaçador para centralizar o título */}
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
