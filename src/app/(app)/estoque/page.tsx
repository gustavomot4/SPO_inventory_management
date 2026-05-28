// =============================================================================
// estoque/page.tsx — Gestão de Estoque (placeholder)
// SPO — Sistema Pimenta Ousada
// =============================================================================

import { Layers } from 'lucide-react'

export default function EstoquePage() {
  return (
    <div className="px-4 py-7 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
        Estoque
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Entradas e movimentações de estoque
      </p>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
          <Layers className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-foreground">Em desenvolvimento</p>
        <p className="mt-1 text-xs text-muted-foreground max-w-xs">
          A gestão de entradas de estoque estará disponível em breve (EST-001).
        </p>
      </div>
    </div>
  )
}
