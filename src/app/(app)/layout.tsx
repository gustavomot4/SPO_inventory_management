// =============================================================================
// (app)/layout.tsx — App shell com sidebar
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// Server Component envolve AppShell (client) para suportar drawer mobile.
// Desktop: sidebar fixa à esquerda.
// Mobile: botão hambúrguer no topo abre drawer com overlay.
// =============================================================================

import { AppShell } from '@/components/layout/AppShell'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
