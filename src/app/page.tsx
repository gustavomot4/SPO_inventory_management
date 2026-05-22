export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center px-4">
        {/* Logo / Título */}
        <div className="mb-6">
          <span className="text-5xl">🌶️</span>
        </div>

        <h1 className="text-3xl font-bold text-gray-800 mb-1">
          Pimenta Ousada
        </h1>
        <p className="text-gray-500 text-lg mb-6">
          Sistema de Gestão de Estoque
        </p>

        {/* Status do sistema */}
        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-full px-4 py-2 text-sm font-medium mb-8">
          <span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span>
          Sistema iniciado com sucesso
        </div>

        {/* Informações de desenvolvimento */}
        <div className="max-w-sm mx-auto bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-left space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Informações
          </h2>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Versão</span>
              <span className="font-mono text-gray-800">0.1.0-MVP</span>
            </div>
            <div className="flex justify-between">
              <span>Ambiente</span>
              <span className="font-mono text-gray-800">Desenvolvimento</span>
            </div>
            <div className="flex justify-between">
              <span>Banco de dados</span>
              <span className="font-mono text-gray-800">SQLite</span>
            </div>
          </div>
        </div>

        <p className="mt-8 text-xs text-gray-400">
          MVP-001 — Fundação técnica do projeto
        </p>
      </div>
    </main>
  )
}
