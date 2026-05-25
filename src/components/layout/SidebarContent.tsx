// =============================================================================
// SidebarContent.tsx — Conteúdo do sidebar (Server Component)
// SPO — Sistema Pimenta Ousada | MVP-007
// =============================================================================
//
// Server Component: renderiza a estrutura do sidebar.
// Os NavItems filhos são Client Components (usePathname), mas o wrapper é server.
// =============================================================================

import { NavItem } from './NavItem'

// ---------------------------------------------------------------------------
// Definição dos itens de navegação
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { href: '/',              label: 'Início',        icon: '🏠', isProtected: false },
  { href: '/produtos',      label: 'Produtos',      icon: '📦', isProtected: false },
  { href: '/estoque',       label: 'Estoque',       icon: '📊', isProtected: false },
  { href: '/vendas',        label: 'Vendas',        icon: '🛍️', isProtected: false },
  { href: '/relatorios',    label: 'Relatórios',    icon: '📈', isProtected: true  },
  { href: '/configuracoes', label: 'Configurações', icon: '⚙️', isProtected: true  },
] as const

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function SidebarContent() {
  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Cabeçalho: nome da loja */}
      <div className="px-5 py-5 border-b border-gray-100">
        <h1 className="text-lg font-bold text-brand-700 leading-tight">
          🌶️ Pimenta Ousada
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">Sistema de Estoque</p>
      </div>

      {/* Itens de navegação */}
      <nav
        className="flex-1 overflow-y-auto px-3 py-4 space-y-1"
        aria-label="Navegação principal"
      >
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            isProtected={item.isProtected}
          />
        ))}
      </nav>

      {/* Rodapé */}
      <div className="px-5 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">v0.1.0-MVP</p>
        <p className="text-xs text-gray-300 mt-0.5">🔒 PIN protege relatórios</p>
      </div>
    </div>
  )
}
