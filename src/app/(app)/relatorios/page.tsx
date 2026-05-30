// =============================================================================
// relatorios/page.tsx — Relatórios (REL-003 + REL-004)
// SPO — Sistema Pimenta Ousada
// =============================================================================
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Printer,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Package,
  TrendingUp,
  ShoppingBag,
  Tag,
  ReceiptText,
  BarChart2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn, formatCurrency } from '@/lib/utils'
import type {
  StockReportItem,
  StockReportMeta,
  SalesReportData,
  ApiSuccess,
} from '@/types'

// ---------------------------------------------------------------------------
// Tipos locais
// ---------------------------------------------------------------------------

type Tab = 'stock' | 'sales'
type PeriodFilter = 'today' | 'week' | 'month' | 'custom'
type StatusFilter = 'all' | 'ok' | 'low' | 'out'

// ---------------------------------------------------------------------------
// Helpers de data
// ---------------------------------------------------------------------------

function getDateRange(period: PeriodFilter): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const toDate = (d: Date) =>
    d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  const today = toDate(now)

  if (period === 'today') return { dateFrom: today, dateTo: today }
  if (period === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    return { dateFrom: toDate(start), dateTo: today }
  }
  if (period === 'month') {
    return {
      dateFrom: now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-01',
      dateTo: today,
    }
  }
  return { dateFrom: '', dateTo: '' }
}

function formatDateBR(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR')
}

// ---------------------------------------------------------------------------
// SummaryCard
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  icon: React.ElementType
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-white p-4 flex flex-col gap-3',
        accent && 'border-brand-200 bg-brand-50/30'
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <div
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg',
            accent ? 'bg-brand-100' : 'bg-muted'
          )}
        >
          <Icon
            className={cn(
              'h-3.5 w-3.5',
              accent ? 'text-brand-600' : 'text-muted-foreground'
            )}
            aria-hidden="true"
          />
        </div>
      </div>
      <p
        className={cn(
          'text-2xl font-bold tracking-tight',
          accent ? 'text-brand-700' : 'text-foreground'
        )}
      >
        {value}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StockStatusBadge
// ---------------------------------------------------------------------------

function StockStatusBadge({ status }: { status: 'ok' | 'low' | 'out' }) {
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        OK
      </span>
    )
  }
  if (status === 'low') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Alerta
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
      <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      Zerado
    </span>
  )
}

// ---------------------------------------------------------------------------
// Aba Estoque
// ---------------------------------------------------------------------------

function StockTab() {
  const [items, setItems] = useState<StockReportItem[]>([])
  const [meta, setMeta] = useState<StockReportMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    if (loaded) return
    setLoading(true)
    fetch('/api/reports/stock')
      .then(r => r.json())
      .then((j: ApiSuccess<StockReportItem[]> & { meta?: StockReportMeta }) => {
        if ('data' in j) {
          setItems(j.data)
          if (j.meta) setMeta(j.meta as StockReportMeta)
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false)
        setLoaded(true)
      })
  }, [loaded])

  const filtered =
    statusFilter === 'all' ? items : items.filter(i => i.status === statusFilter)

  const pillOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Todos' + (meta ? ' (' + meta.total + ')' : '') },
    { value: 'ok', label: 'OK' + (meta ? ' (' + meta.okCount + ')' : '') },
    { value: 'low', label: 'Alerta' + (meta ? ' (' + meta.lowCount + ')' : '') },
    { value: 'out', label: 'Zerado' + (meta ? ' (' + meta.outCount + ')' : '') },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">Carregando estoque...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {meta && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="Total" value={String(meta.total)} icon={Package} />
          <SummaryCard label="OK" value={String(meta.okCount)} icon={CheckCircle2} />
          <SummaryCard label="Alerta" value={String(meta.lowCount)} icon={AlertTriangle} />
          <SummaryCard label="Zerado" value={String(meta.outCount)} icon={XCircle} />
        </div>
      )}

      <div className="no-print flex flex-wrap gap-2">
        {pillOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={cn(
              'rounded-full px-3.5 py-1 text-xs font-medium transition-colors border',
              statusFilter === opt.value
                ? 'bg-foreground text-white border-foreground'
                : 'bg-white text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Package className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhum item encontrado</p>
          <p className="mt-1 text-xs text-muted-foreground">Tente outro filtro de status.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Produto</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Tam / Cor</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">SKU</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">Estoque</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">Min.</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr
                  key={item.variationId}
                  className={cn(
                    'border-b border-border last:border-0 transition-colors',
                    item.status === 'out' && 'bg-red-50/40',
                    item.status === 'low' && 'bg-amber-50/30'
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">{item.categoryName}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {(item.size || item.color)
                      ? [item.size, item.color].filter(Boolean).join(' / ')
                      : <span className="text-muted-foreground/40">--</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-muted-foreground">{item.variationSku}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn(
                      'text-sm font-semibold',
                      item.status === 'out' && 'text-red-600',
                      item.status === 'low' && 'text-amber-600',
                      item.status === 'ok' && 'text-foreground'
                    )}>
                      {item.stockQuantity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{item.minStock}</td>
                  <td className="px-4 py-3 text-center">
                    <StockStatusBadge status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Aba Vendas
// ---------------------------------------------------------------------------

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  today: 'Hoje',
  week: 'Esta semana',
  month: 'Este mes',
  custom: 'Personalizado',
}

function SalesTab() {
  const [data, setData] = useState<SalesReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState<PeriodFilter>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const loadSales = useCallback((dateFrom: string, dateTo: string) => {
    if (!dateFrom || !dateTo) return
    setLoading(true)
    fetch('/api/reports/sales?dateFrom=' + dateFrom + '&dateTo=' + dateTo)
      .then(r => r.json())
      .then((j: ApiSuccess<SalesReportData>) => {
        if ('data' in j) setData(j.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (period === 'custom') return
    const range = getDateRange(period)
    loadSales(range.dateFrom, range.dateTo)
  }, [period, loadSales])

  const handleCustomApply = () => {
    if (customFrom && customTo) loadSales(customFrom, customTo)
  }

  const summary = data?.summary

  return (
    <div className="space-y-6">
      <div className="no-print space-y-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'rounded-full px-3.5 py-1 text-xs font-medium transition-colors border',
                period === p
                  ? 'bg-foreground text-white border-foreground'
                  : 'bg-white text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground'
              )}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">De</label>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Ate</label>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button size="sm" onClick={handleCustomApply} disabled={!customFrom || !customTo}>
              Aplicar
            </Button>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div
              className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">Carregando relatorio...</p>
          </div>
        </div>
      )}

      {!loading && data && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Vendas" value={String(summary!.totalSales)} icon={ShoppingBag} accent />
            <SummaryCard label="Receita" value={formatCurrency(summary!.totalRevenue)} icon={TrendingUp} accent />
            <SummaryCard label="Ticket medio" value={formatCurrency(summary!.averageTicketCents)} icon={Tag} />
            <SummaryCard label="Canceladas" value={String(summary!.cancelledCount)} icon={XCircle} />
          </div>

          {summary!.totalSales === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <BarChart2 className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-foreground">Nenhuma venda no periodo</p>
              <p className="mt-1 text-xs text-muted-foreground">Escolha outro periodo para ver os dados.</p>
            </div>
          )}

          {summary!.totalSales > 0 && (
            <>
              {data.byPaymentMethod.length > 0 && (
                <section>
                  <h2 className="mb-3 text-sm font-semibold text-foreground">Por metodo de pagamento</h2>
                  <div className="overflow-x-auto rounded-xl border border-border bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Metodo</th>
                          <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">Vendas</th>
                          <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.byPaymentMethod.map(row => (
                          <tr key={row.paymentMethod} className="border-b border-border last:border-0">
                            <td className="px-4 py-3 font-medium text-foreground">{row.paymentMethodLabel}</td>
                            <td className="px-4 py-3 text-right text-muted-foreground">{row.count}</td>
                            <td className="px-4 py-3 text-right font-medium text-foreground">{formatCurrency(row.totalCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {data.topVariations.length > 0 && (
                <section>
                  <h2 className="mb-3 text-sm font-semibold text-foreground">
                    Top {Math.min(data.topVariations.length, 10)} mais vendidas
                  </h2>
                  <div className="overflow-x-auto rounded-xl border border-border bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          <th className="w-8 px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">#</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Produto</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Tam / Cor</th>
                          <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">Qtd</th>
                          <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">Receita</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topVariations.slice(0, 10).map((v, idx) => (
                          <tr key={v.variationId} className="border-b border-border last:border-0">
                            <td className="px-4 py-3">
                              <span className={cn(
                                'text-xs font-bold',
                                idx === 0 && 'text-amber-500',
                                idx === 1 && 'text-zinc-400',
                                idx === 2 && 'text-amber-700',
                                idx > 2 && 'text-muted-foreground'
                              )}>
                                {idx + 1}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-foreground">{v.productName}</p>
                              <p className="font-mono text-xs text-muted-foreground">{v.variationSku}</p>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {(v.size || v.color)
                                ? [v.size, v.color].filter(Boolean).join(' / ')
                                : <span className="text-muted-foreground/40">--</span>
                              }
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-foreground">{v.quantitySold}</td>
                            <td className="px-4 py-3 text-right font-medium text-foreground">{formatCurrency(v.revenueCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {data.byDay.length > 0 && (
                <section>
                  <h2 className="mb-3 text-sm font-semibold text-foreground">Vendas por dia</h2>
                  <div className="overflow-x-auto rounded-xl border border-border bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Data</th>
                          <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">Vendas</th>
                          <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">Receita</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.byDay.map(row => (
                          <tr key={row.date} className="border-b border-border last:border-0">
                            <td className="px-4 py-3 text-foreground">{formatDateBR(row.date)}</td>
                            <td className="px-4 py-3 text-right text-muted-foreground">{row.count}</td>
                            <td className="px-4 py-3 text-right font-medium text-foreground">{formatCurrency(row.revenueCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {!loading && !data && period === 'custom' && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ReceiptText className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-foreground">Selecione o periodo</p>
          <p className="mt-1 text-xs text-muted-foreground">Informe as datas e clique em Aplicar.</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pagina principal
// ---------------------------------------------------------------------------

export default function RelatoriosPage() {
  const [activeTab, setActiveTab] = useState<Tab>('stock')

  return (
    <div className="px-4 py-7 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Relatorios</h1>
          <p className="mt-1 text-sm text-muted-foreground">Analises e relatorios do sistema</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="no-print shrink-0"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          Imprimir
        </Button>
      </div>

      <div className="no-print mb-6 flex gap-1 rounded-xl border border-border bg-muted/40 p-1 w-fit">
        <button
          onClick={() => setActiveTab('stock')}
          className={cn(
            'rounded-lg px-4 py-1.5 text-sm font-medium transition-all',
            activeTab === 'stock'
              ? 'bg-white text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Estoque
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={cn(
            'rounded-lg px-4 py-1.5 text-sm font-medium transition-all',
            activeTab === 'sales'
              ? 'bg-white text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Vendas
        </button>
      </div>

      {activeTab === 'stock' && <StockTab />}
      {activeTab === 'sales' && <SalesTab />}
    </div>
  )
}
