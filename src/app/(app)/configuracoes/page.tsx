// =============================================================================
// configuracoes/page.tsx — Página placeholder do módulo Configurações
// SPO — Sistema Pimenta Ousada | MVP-007 v2
// Rota protegida por PIN (middleware.ts + ADR-003)
// Implementação real: Fase 2 (MAQU-002) e Fase 3
// =============================================================================

import Link from 'next/link'
import { Settings, ArrowLeft, Lock, CreditCard, KeyRound, Store } from 'lucide-react'

export default function ConfiguracoesPage() {
  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <div className="flex flex-col items-center py-14 text-center">

        {/* Ícone principal */}
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 mb-5">
          <Settings className="h-7 w-7 text-gray-500" aria-hidden="true" strokeWidth={1.5} />
        </div>

        {/* Título */}
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
          Configurações
        </h1>

        {/* Badge de rota protegida */}
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 mb-6">
          <Lock className="h-3 w-3" aria-hidden="true" strokeWidth={2} />
          Área protegida por PIN
        </div>

        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-8">
          Configure maquininhas de cartão, altere o PIN e personalize a loja.
          Este módulo estará disponível na Fase 2.
        </p>

        {/* Preview das features que virão */}
        <div className="w-full max-w-xs space-y-2 mb-8">
          {[
            { icon: CreditCard, label: 'Maquininha de cartão', fase: 'Fase 2' },
            { icon: KeyRound,   label: 'Alterar PIN de acesso',  fase: 'Fase 2' },
            { icon: Store,      label: 'Nome e dados da loja',   fase: 'Fase 3' },
          ].map(({ icon: Icon, label, fase }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-lg border border-dashed border-gray-200 bg-white/50 px-4 py-2.5"
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" strokeWidth={1.5} />
              <span className="text-sm text-gray-500">{label}</span>
              <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400">
                {fase}
              </span>
            </div>
          ))}
        </div>

        {/* Voltar */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Voltar ao Início
        </Link>
      </div>
    </div>
  )
}
