// =============================================================================
// configuracoes/page.tsx — Página placeholder do módulo Configurações
// SPO — Sistema Pimenta Ousada | MVP-007
// Rota protegida por PIN (middleware.ts + ADR-003)
// Implementação real: Fase 2 (MAQU-002) e Fase 3
// =============================================================================

import Link from 'next/link'

export default function ConfiguracoesPage() {
  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <div className="text-center py-16">
        <div className="text-5xl mb-4" aria-hidden="true">⚙️</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Configurações</h1>

        {/* Badge de rota protegida */}
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 mb-6">
          <span aria-hidden="true">🔒</span>
          Área protegida por PIN
        </div>

        <p className="text-gray-500 text-sm mb-8 max-w-sm mx-auto">
          Este módulo está em desenvolvimento e estará disponível em breve.
          Aqui você poderá configurar maquininhas de cartão, alterar o PIN e o nome da loja.
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
