// =============================================================================
// NavItem.tsx — Item de navegação do sidebar (Client Component)
// SPO — Sistema Pimenta Ousada | MVP-007
// =============================================================================
//
// Deve ser 'use client' pois usa usePathname() para detectar rota ativa.
// Extraído como Client Component para manter o Sidebar como Server Component.
// =============================================================================

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItemProps {
  href: string
  label: string
  icon: string
  isProtected?: boolean
}

// Ícone de cadeado SVG inline — sem dependência de biblioteca de ícones
function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  )
}

export function NavItem({ href, label, icon, isProtected }: NavItemProps) {
  const pathname = usePathname()

  // Considera ativo: rota exata para '/', ou pathname começa com href para demais
  const isActive =
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  if (isActive) {
    return (
      <Link
        href={href}
        aria-current="page"
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold bg-brand-50 text-brand-700 border-l-4 border-brand-600 transition-colors"
      >
        <span className="text-base leading-none shrink-0" aria-hidden="true">
          {icon}
        </span>
        <span className="flex-1 min-w-0 truncate">{label}</span>
        {isProtected && (
          <LockIcon className="w-3.5 h-3.5 text-brand-400 shrink-0" />
        )}
      </Link>
    )
  }

  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
    >
      <span className="text-base leading-none shrink-0" aria-hidden="true">
        {icon}
      </span>
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {isProtected && (
        <LockIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      )}
    </Link>
  )
}
