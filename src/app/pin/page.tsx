// =============================================================================
// pin/page.tsx — Tela de entrada de PIN
// SPO — Sistema Pimenta Ousada | MVP-007
// =============================================================================
//
// Server Component wrapper: necessário para envolver PinScreen em <Suspense>.
// O Next.js 14 exige Suspense em torno de componentes que usam useSearchParams().
//
// A tela de PIN está FORA do route group (app), portanto não tem sidebar.
// =============================================================================

import { Suspense } from 'react'
import { PinScreen } from './PinScreen'

// Fallback exibido enquanto o Suspense aguarda a hidratação do Client Component
function PinLoadingFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md border border-gray-200 p-8 text-center">
        <div className="text-4xl mb-4" aria-hidden="true">🌶️</div>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
          <div
            className="w-5 h-5 border-2 border-gray-200 border-t-brand-500 rounded-full animate-spin"
            role="status"
            aria-label="Carregando"
          />
          Carregando…
        </div>
      </div>
    </div>
  )
}

export default function PinPage() {
  return (
    <Suspense fallback={<PinLoadingFallback />}>
      <PinScreen />
    </Suspense>
  )
}
