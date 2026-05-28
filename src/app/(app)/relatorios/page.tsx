// =============================================================================
// relatorios/page.tsx — Relatórios (placeholder, protegido por PIN)
// SPO — Sistema Pimenta Ousada
// =============================================================================

import { BarChart2 } from 'lucide-react'

export default function RelatoriosPage() {
  return (
    <div className="px-4 py-7 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
        Relatórios
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Análises e relatórios financeiros
      </p>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
          <BarChart2 className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-foreground">Em desenvolvimento</p>
        <p className="mt-1 text-xs text-muted-foreground max-w-xs">
          Os relatórios de vendas por período estarão disponíveis em breve (REL-001).
        </p>
      </div>
    </div>
  )
}
