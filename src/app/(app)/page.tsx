// =============================================================================
// (app)/page.tsx — Dashboard / Homepage
// SPO — Sistema Pimenta Ousada | MVP-007
// =============================================================================
//
// Client Component: necessário para saudação dinâmica por hora do dia e
// relógio atualizado via useEffect + setInterval.
//
// Conteúdo:
//   - Saudação dinâmica ("Bom dia/tarde/noite")
//   - Data e hora atualizadas a cada minuto
//   - Cards de acesso rápido para módulos principais
//   - Placeholders para Alertas de Estoque e Resumo do Dia (Fase 2)
// =============================================================================

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Helpers de data/hora
// ---------------------------------------------------------------------------

function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Bom dia'
  if (hour >= 12 && hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Formata data em pt-BR: "Sábado, 23 de maio de 2026" */
function formatDate(date: Date): string {
  const raw = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  // Capitaliza primeira letra (pt-BR retorna minúsculo)
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

/** Formata hora em pt-BR: "14:35" */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Card de acesso rápido
// ---------------------------------------------------------------------------

interface QuickCardProps {
  href: string
  icon: string
  label: string
  isProtected?: boolean
}

function QuickCard({ href, icon, label, isProtected }: QuickCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-2.5 p-4 sm:p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-brand-200 active:scale-95 transition-all text-center min-h-[5rem]"
    >
      <span className="text-2xl leading-none" aria-hidden="true">{icon}</span>
      <span className="text-sm font-medium text-gray-700 group-hover:text-brand-700 transition-colors leading-tight">
        {label}
      </span>
      {isProtected && (
        <span className="text-xs text-gray-400" title="Requer PIN">🔒</span>
      )}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Seção placeholder para funcionalidades da Fase 2
// ---------------------------------------------------------------------------

interface PlaceholderSectionProps {
  icon: string
  title: string
  subtitle: string
}

function PlaceholderSection({ icon, title, subtitle }: PlaceholderSectionProps) {
  return (
    <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 sm:p-8 text-center bg-white/50">
      <span className="text-3xl mb-3 block" aria-hidden="true">{icon}</span>
      <p className="text-sm font-semibold text-gray-500">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    // Hidrata imediatamente para evitar mismatch de SSR
    setNow(new Date())

    // Atualiza a cada minuto (relógio não precisa de segundos)
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const hour = now?.getHours() ?? 12
  const greeting = getGreeting(hour)
  const dateStr = now ? formatDate(now) : null
  const timeStr = now ? formatTime(now) : null

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 max-w-3xl mx-auto">

      {/* ── SAUDAÇÃO ── */}
      <section className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 leading-tight">
          {greeting}, Pimenta Ousada!{' '}
          <span aria-hidden="true">🌶️</span>
        </h1>
        {dateStr && timeStr ? (
          <p className="text-gray-500 mt-1.5 text-sm sm:text-base">
            {dateStr}
            <span className="mx-1.5 text-gray-300" aria-hidden="true">·</span>
            {timeStr}
          </p>
        ) : (
          /* Skeleton enquanto hidrata */
          <div className="mt-1.5 h-5 w-64 bg-gray-100 rounded animate-pulse" aria-hidden="true" />
        )}
      </section>

      {/* ── ACESSO RÁPIDO ── */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          Acesso Rápido
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickCard
            href="/vendas"
            icon="🛍️"
            label="Nova Venda"
          />
          <QuickCard
            href="/estoque"
            icon="📥"
            label="Entrada de Estoque"
          />
          <QuickCard
            href="/produtos"
            icon="📦"
            label="Produtos"
          />
          <QuickCard
            href="/relatorios"
            icon="📈"
            label="Relatórios"
            isProtected
          />
        </div>
      </section>

      {/* ── ALERTAS DE ESTOQUE ── */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          Alertas de Estoque
        </h2>
        <PlaceholderSection
          icon="📊"
          title="Em breve — Fase 2"
          subtitle="Produtos com estoque abaixo do mínimo aparecerão aqui"
        />
      </section>

      {/* ── RESUMO DO DIA ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          Resumo do Dia
        </h2>
        <PlaceholderSection
          icon="🗓️"
          title="Em breve — Fase 2"
          subtitle="Total de vendas e movimentações do dia aparecerão aqui"
        />
      </section>

    </div>
  )
}
