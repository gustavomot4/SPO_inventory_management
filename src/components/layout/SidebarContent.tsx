// =============================================================================
// SidebarContent.tsx — Conteúdo do sidebar (Client Component)
// SPO — Sistema Pimenta Ousada | MVP-007 v2
// =============================================================================
//
// 'use client' necessário: NAV_ITEMS passa LucideIcon references (forwardRef
// components) como prop para NavItem (Client). Funções/componentes React não
// são serializáveis na boundary Server→Client — tornar Client resolve o erro
// "Functions cannot be passed directly to Client Components".
// Sem custo real: o sidebar não tem data fetching nem operações async.
//
// Design (v2):
//   - Flame (Lucide) como marca visual — representa o "pimenta" da marca
//   - Tipografia hierárquica: nome da loja bold + subtitle muted
//   - Rótulo de seção: uppercase tracking-widest text-xs (padrão metadata)
//   - NavItems com ícones Lucide — sistema único, sem emojis
//   - Rodapé com versão e nota discreta sobre PIN
// =============================================================================

'use client'

import {
  Flame,
  Home,
  Package,
  Layers,
  ShoppingBag,
  BarChart2,
  Settings,
} from 'lucide-react'
import { NavItem } from './NavItem'

// ---------------------------------------------------------------------------
// Itens de navegação
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { href: '/',              label: 'Início',        icon: Home,       isProtected: false },
  { href: '/produtos',      label: 'Produtos',      icon: Package,    isProtected: false },
  { href: '/estoque',       label: 'Estoque',       icon: Layers,     isProtected: false },
  { href: '/vendas',        label: 'Vendas',        icon: ShoppingBag,isProtected: false },
  { href: '/relatorios',    label: 'Relatórios',    icon: BarChart2,  isProtected: true  },
  { href: '/configuracoes', label: 'Configurações', icon: Settings,   isProtected: true  },
] as const

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function SidebarContent() {
  return (
    <div className="flex h-full flex-col bg-white border-r border-gray-200">

      {/* ── Marca ── */}
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          {/*
           * Flame = identidade visual da marca "Pimenta Ousada" (calor/sabor).
           * Decisão de design: ícone semântico ao invés de emoji 🌶️.
           * brand-700 para contraste adequado no fundo branco.
           */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50">
            <Flame className="h-4 w-4 text-brand-700" aria-hidden="true" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight text-gray-900 leading-tight">
              Pimenta Ousada
            </p>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">
              Sistema de Estoque
            </p>
          </div>
        </div>
      </div>

      {/* ── Navegação ── */}
      <nav
        className="flex-1 overflow-y-auto px-2 py-4"
        aria-label="Navegação principal"
      >
        {/* Rótulo de seção — padrão metadata label */}
        <p className="mb-2 px-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Menu
        </p>

        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              isProtected={item.isProtected}
            />
          ))}
        </div>
      </nav>

      {/* ── Rodapé ── */}
      <div className="px-4 py-3 border-t border-gray-100">
        <p className="text-xs font-medium text-muted-foreground">
          v0.1.0-MVP
        </p>
        <p className="mt-0.5 text-xs text-gray-300">
          Relatórios e configurações protegidos
        </p>
      </div>

    </div>
  )
}
