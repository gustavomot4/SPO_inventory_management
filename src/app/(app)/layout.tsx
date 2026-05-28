// =============================================================================
// (app)/layout.tsx — App shell com sidebar
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// Server Component — layout persistente para todas as rotas dentro de (app).
// Sidebar fixa à esquerda (desktop) + área de conteúdo scrollável.
// Mobile: sidebar oculta, conteúdo ocupa tela toda (drawer futuro).
// =============================================================================

import { SidebarContent } from '@/components/layout/SidebarContent'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* Sidebar — visível apenas em telas md+ */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:shrink-0 bg-white border-r border-border">
        <SidebarContent />
      </aside>

      {/* Área principal scrollável */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

    </div>
  )
}
