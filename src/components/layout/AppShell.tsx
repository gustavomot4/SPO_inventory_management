'use client'
// =============================================================================
// AppShell.tsx — Shell do app com suporte a drawer mobile
// SPO — Sistema Pimenta Ousada
// =============================================================================

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { SidebarContent } from '@/components/layout/SidebarContent'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()

  // Fechar drawer ao trocar de rota
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  // Bloquear scroll do body quando drawer está aberto
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* ── Sidebar desktop — md+ ── */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:shrink-0 bg-white border-r border-border no-print">
        <SidebarContent />
      </aside>

      {/* ── Drawer mobile overlay ── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Drawer mobile panel ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-border
          transform transition-transform duration-200 ease-in-out
          md:hidden no-print
          ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-end px-3 pt-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* ── Área principal ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Topbar mobile */}
        <header className="flex md:hidden items-center gap-3 px-4 h-14 border-b border-border bg-white shrink-0 no-print">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600">
              <span className="text-[10px] font-bold text-white">PO</span>
            </div>
            <span className="text-sm font-semibold text-foreground">Pimenta Ousada</span>
          </div>
        </header>

        {/* Conteúdo principal scrollável */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

    </div>
  )
}
