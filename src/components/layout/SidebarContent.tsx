'use client'

// =============================================================================
// SidebarContent.tsx — Navegação lateral do app
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// 'use client': necessário pois usa usePathname() para destacar item ativo.
// Lucide React icons — zero emojis.
// =============================================================================

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  Layers,
  ShoppingBag,
  BarChart2,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/',              label: 'Painel',        icon: LayoutDashboard },
  { href: '/produtos',      label: 'Produtos',      icon: Package },
  { href: '/estoque',       label: 'Estoque',       icon: Layers },
  { href: '/vendas',        label: 'Vendas',        icon: ShoppingBag },
  { href: '/relatorios',    label: 'Relatórios',    icon: BarChart2 },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
] as const

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: typeof Package
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'bg-brand-50 text-brand-700'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon
        className={cn('h-4 w-4 shrink-0', active ? 'text-brand-600' : 'text-muted-foreground')}
        strokeWidth={active ? 2.5 : 1.75}
        aria-hidden="true"
      />
      {label}
    </Link>
  )
}

export function SidebarContent() {
  const pathname = usePathname()

  const navItemsWithActive = NAV_ITEMS.map(item => ({
    href: item.href,
    label: item.label,
    icon: item.icon,
    active: item.href === '/'
      ? pathname === '/'
      : pathname === item.href || pathname.startsWith(item.href + '/'),
  }))

  return (
    <div className="flex h-full flex-col">
      {/* Logo / marca */}
      <div className="flex h-14 items-center border-b border-border px-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600">
            <span className="text-xs font-bold text-white">PO</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-none">
              Pimenta Ousada
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Gestão de Estoque</p>
          </div>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navItemsWithActive.map(item => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={item.active}
          />
        ))}
      </nav>

      {/* Rodapé da sidebar */}
      <div className="shrink-0 border-t border-border p-3">
        <p className="text-[10px] text-muted-foreground text-center">
          SPO v0.1.0-MVP
        </p>
      </div>
    </div>
  )
}
