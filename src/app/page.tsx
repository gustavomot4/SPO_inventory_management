// =============================================================================
// app/page.tsx — Redireciona raiz para /produtos
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// A rota "/" não tem conteúdo próprio — redireciona direto para /produtos.
// O app shell (sidebar) é aplicado via src/app/(app)/layout.tsx.
// =============================================================================

import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/produtos')
}
