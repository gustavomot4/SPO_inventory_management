// =============================================================================
// (app)/page.tsx — Dashboard / Homepage
// SPO — Sistema Pimenta Ousada | MVP-007 v2
// =============================================================================
//
// 'use client' necessário para relógio dinâmico (useEffect + setInterval).
//
// Design (v2) — decisões documentadas:
//   - Tipografia hierárquica: saudação 3xl bold + data sm muted (contraste intencional)
//   - "Nova Venda" como ação primária visualmente dominante (md:col-span-2, mais padding,
//     bg primary tintado) — a dona registra vendas dezenas de vezes por dia.
//   - Ações secundárias: cards menores, fundo branco neutro
//   - Relatórios: badge "PIN" ao invés de apenas ícone Lock — comunicação mais clara
//   - Empty states de Fase 2: icon em círculo muted + label tipográfico, não apenas texto
//   - Zero emojis — todos os ícones são Lucide React
//   - Skeleton durante hidratação do relógio para evitar CLS
// =============================================================================

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ShoppingBag,
  PackagePlus,
  Package,
  BarChart2,
  AlertCircle,
  CalendarDays,
  Lock,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Helpers de data/hora
// ---------------------------------------------------------------------------

function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Bom dia'
  if (hour >= 12 && hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** "Sábado, 24 de maio de 2026" */
function formatFullDate(date: Date): string {
  const raw = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

/** "09:14" */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ---------------------------------------------------------------------------
// Card de ação rápida
// ---------------------------------------------------------------------------

interface QuickActionProps {
  href: string
  icon: LucideIcon
  label: string
  description?: string
  variant?: 'primary' | 'default'
  isProtected?: boolean
  className?: string
}

function QuickAction({
  href,
  icon: Icon,
  label,
  description,
  variant = 'default',
  isProtected,
  className,
}: QuickActionProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex flex-col justify-between gap-4 rounded-xl border p-5 transition-all',
        'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        variant === 'primary'
          ? // Ação primária: fundo tintado com cor da marca
            'border-brand-200 bg-brand-50 hover:border-brand-300 hover:bg-brand-100/60'
          : // Ação secundária: fundo branco neutro
            'border-gray-200 bg-white hover:border-gray-300',
        className
      )}
    >
      {/* Ícone */}
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-lg',
          variant === 'primary'
            ? 'bg-brand-600 text-white'
            : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" strokeWidth={2} />
      </div>

      {/* Texto */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p
            className={cn(
              'text-sm font-semibold leading-tight',
              variant === 'primary' ? 'text-brand-800' : 'text-gray-800'
            )}
          >
            {label}
          </p>
          {isProtected && (
            <Lock
              className="h-3 w-3 shrink-0 text-muted-foreground"
              aria-label="Requer PIN"
              strokeWidth={2}
            />
          )}
        </div>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Seção placeholder (Fase 2)
// ---------------------------------------------------------------------------

interface PlaceholderCardProps {
  icon: LucideIcon
  title: string
  description: string
}

function PlaceholderCard({ icon: Icon, title, description }: PlaceholderCardProps) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-dashed border-gray-200 bg-white/50 p-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" strokeWidth={1.5} />
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <span className="ml-auto shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400">
        Fase 2
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const hour = now?.getHours() ?? 12
  const greeting = getGreeting(hour)
  const dateStr = now ? formatFullDate(now) : null
  const timeStr = now ? formatTime(now) : null

  return (
    <div className="px-4 py-7 sm:px-6 lg:px-8 max-w-3xl mx-auto">

      {/* ── Saudação ──────────────────────────────────────────────────── */}
      {/*
       * Decisão de design: forte contraste entre saudação (3xl bold) e
       * data/hora (sm muted). Não é "greeting + big clock" genérico —
       * é hierarquia intencional que coloca a pessoa no topo.
       */}
      <section className="mb-8" aria-label="Saudação">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {greeting},
          <br />
          Pimenta Ousada.
        </h1>

        {dateStr && timeStr ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {dateStr}
            <span aria-hidden="true">·</span>
            {timeStr}
          </p>
        ) : (
          // Skeleton para evitar layout shift durante hidratação
          <div
            className="mt-2 h-5 w-56 animate-pulse rounded bg-muted"
            aria-hidden="true"
          />
        )}
      </section>

      {/* ── Acesso Rápido ─────────────────────────────────────────────── */}
      <section className="mb-8" aria-label="Acesso rápido">
        {/*
         * Rótulo: padrão metadata — uppercase + tracking-widest + text-xs.
         * Não é um heading — é um organizador visual.
         */}
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Acesso Rápido
        </p>

        {/*
         * Grid: "Nova Venda" (ação mais frequente na loja) ocupa 2 colunas
         * em md+ para comunicar hierarquia. As demais 3 ações são secundárias.
         * Não é um grid uniforme — é comunicação visual de prioridade.
         */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <QuickAction
            href="/vendas"
            icon={ShoppingBag}
            label="Nova Venda"
            description="Registrar venda"
            variant="primary"
            className="md:col-span-2 lg:col-span-1"
          />
          <QuickAction
            href="/estoque"
            icon={PackagePlus}
            label="Entrada de Estoque"
            description="Receber mercadoria"
          />
          <QuickAction
            href="/produtos"
            icon={Package}
            label="Produtos"
            description="Catálogo da loja"
          />
          <QuickAction
            href="/relatorios"
            icon={BarChart2}
            label="Relatórios"
            description="Vendas e estoque"
            isProtected
          />
        </div>
      </section>

      {/* ── Fase 2: Alertas + Resumo ──────────────────────────────────── */}
      <section aria-label="Funcionalidades em desenvolvimento">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Painel
        </p>

        <div className="space-y-3">
          <PlaceholderCard
            icon={AlertCircle}
            title="Alertas de Estoque"
            description="Produtos com estoque abaixo do mínimo aparecerão aqui"
          />
          <PlaceholderCard
            icon={CalendarDays}
            title="Resumo do Dia"
            description="Total de vendas e movimentações do dia aparecerão aqui"
          />
        </div>
      </section>

    </div>
  )
}
