// =============================================================================
// (app)/layout.tsx — App Shell: layout com sidebar para todas as páginas
// SPO — Sistema Pimenta Ousada | MVP-007
// =============================================================================
//
// Route Group (app): agrupa todas as páginas que precisam do sidebar.
// A tela de PIN (/pin) fica FORA deste group — sem sidebar.
//
// Server Component: compõe SidebarContent (server) + AppShell (client).
// O padrão "server component passado como prop para client component" é
// suportado pelo Next.js App Router e mantém o máximo de rendering no server.
// =============================================================================

import { SidebarContent } from '@/components/layout/SidebarContent'
import { AppShell } from '@/components/layout/AppShell'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppShell sidebar={<SidebarContent />}>
      {children}
    </AppShell>
  )
}
