// =============================================================================
// (app)/loading.tsx — Skeleton de carregamento para todas as rotas do grupo (app)
// SPO — Sistema Pimenta Ousada
// QA-017: sem loading.tsx, páginas Server Component ficam congeladas durante fetch
// =============================================================================

export default function AppLoading() {
  return (
    <div className="px-4 py-7 sm:px-6 lg:px-8 max-w-5xl mx-auto animate-pulse">
      {/* Cabeçalho */}
      <div className="mb-6">
        <div className="h-7 w-48 rounded-lg bg-muted" />
        <div className="mt-2 h-4 w-72 rounded bg-muted/60" />
      </div>
      {/* Conteúdo */}
      <div className="space-y-3">
        <div className="h-12 rounded-xl bg-muted" />
        <div className="h-12 rounded-xl bg-muted/80" />
        <div className="h-12 rounded-xl bg-muted/60" />
        <div className="h-12 rounded-xl bg-muted/40" />
      </div>
    </div>
  )
}
