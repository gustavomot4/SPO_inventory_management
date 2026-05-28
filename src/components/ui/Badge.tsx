// =============================================================================
// Badge.tsx — Badge de status reutilizável
// SPO — Sistema Pimenta Ousada
// =============================================================================

import { cn } from '@/lib/utils'

export interface BadgeProps {
  variant: 'success' | 'warning' | 'danger' | 'muted' | 'brand'
  children: React.ReactNode
  className?: string
}

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variant === 'success' &&
          'bg-green-50 text-green-700 border border-green-200',
        variant === 'warning' &&
          'bg-amber-50 text-amber-700 border border-amber-200',
        variant === 'danger' &&
          'bg-red-50 text-red-700 border border-red-200',
        variant === 'muted' &&
          'bg-gray-100 text-gray-500',
        variant === 'brand' &&
          'bg-brand-50 text-brand-700 border border-brand-200',
        className
      )}
    >
      {children}
    </span>
  )
}
