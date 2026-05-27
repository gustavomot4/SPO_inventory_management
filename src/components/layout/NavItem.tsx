// =============================================================================
// NavItem.tsx — Item de navegação do sidebar (Client Component)
// SPO — Sistema Pimenta Ousada | MVP-007 v2
// =============================================================================
//
// 'use client' necessário apenas para usePathname().
// Extraído como Client Component para manter SidebarContent como Server Component.
//
// Design (v2):
//   - Ícones Lucide React — sistema único de ícones, sem emojis
//   - Item ativo: borda esquerda brand-600 + bg brand-50 + texto brand-700
//   - Lock: ícone Lock (Lucide) nos itens protegidos, não texto/emoji
//   - Tipografia: text-sm font-medium — consistente com hierarquia do sidebar
// =============================================================================

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NavItemProps {
  href: string
  label: string
  icon: LucideIcon
  isProtected?: boolean
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function NavItem({ href, label, icon: Icon, isProtected }: NavItemProps) {
  const pathname = usePathname()

  // Ativo: rota exata para '/', prefixo para todas as outras
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        // Base — mobile-first, tamanho mínimo de toque 44px
        'group flex min-h-[2.75rem] items-center gap-3 rounded-r-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? // Ativo: borda esquerda colorida + fundo tintado
            'border-l-2 border-brand-600 bg-brand-50 pl-[calc(0.75rem-2px)] text-brand-700'
          : // Inativo: neutro, hover sutil
            'border-l-2 border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      )}
    >
      {/* Ícone — tamanho fixo, herda cor do texto */}
      <Icon
        className="h-4 w-4 shrink-0"
        aria-hidden="true"
        strokeWidth={isActive ? 2.5 : 2}
      />

      {/* Label */}
      <span className="flex-1 truncate">{label}</span>

      {/* Indicador de rota protegida */}
      {isProtected && (
        <Lock
          className={cn(
            'h-3 w-3 shrink-0',
            isActive ? 'text-brand-400' : 'text-gray-300 group-hover:text-gray-400'
          )}
          aria-label="Requer PIN"
          strokeWidth={2}
        />
      )}
    </Link>
  )
}
