// =============================================================================
// vendas/page.tsx — Página placeholder do módulo Vendas
// SPO — Sistema Pimenta Ousada | MVP-007
// Implementação real: Fase 2 (VEND-001 a VEND-006)
// =============================================================================

import Link from 'next/link'

export default function VendasPage() {
  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <div className="text-center py-16">
        <div className="text-5xl mb-4" aria-hidden="true">🛍️</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Vendas</h1>
        <p className="text-gray-500 text-sm mb-8 max-w-sm mx-auto">
          Este módulo está em desenvolvimento e estará disponível em breve.
          Aqui você poderá registrar vendas, aplicar descontos e gerar comandas.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
        >
          ← Voltar ao Início
        </Link>
      </div>
    </div>
  )
}
