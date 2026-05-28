// =============================================================================
// configuracoes/page.tsx — Tela de Configurações (MAQU-002)
// SPO — Sistema Pimenta Ousada
// =============================================================================
//
// 'use client': CRUD inline de maquininhas, state local.
//
// Seções:
//   - Maquininhas de Cartão  ← implementada
//   - Segurança (PIN)        ← placeholder "Em breve"
//   - Dados da Loja          ← placeholder "Em breve"
// =============================================================================

'use client'

import { useState, useEffect, useCallback } from 'react'
import { CreditCard, Lock, Store, Plus, Pencil, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatBasisPoints, parseBasisPoints, cn } from '@/lib/utils'
import type { CardMachineResponse } from '@/types'
import type { ApiResponse } from '@/types'

// ---------------------------------------------------------------------------
// Tipos locais
// ---------------------------------------------------------------------------

interface FormState {
  name: string
  fee: string // percentual digitado pelo usuário, ex: "1,99"
}

interface FormErrors {
  name?: string
  fee?: string
  general?: string
}

// ---------------------------------------------------------------------------
// Sub-componente: Linha de maquininha
// ---------------------------------------------------------------------------

interface CardMachineRowProps {
  machine: CardMachineResponse
  onToggleActive: (id: string, isActive: boolean) => Promise<void>
  onUpdate: (id: string, data: FormState) => Promise<string | null>
}

function CardMachineRow({ machine, onToggleActive, onUpdate }: CardMachineRowProps) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<FormState>({
    name: machine.name,
    fee: (machine.feeBasisPoints / 100).toFixed(2).replace('.', ','),
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)

  function validate(): boolean {
    const errs: FormErrors = {}
    if (!form.name.trim()) errs.name = 'Nome obrigatório'
    if (!form.fee.trim()) {
      errs.fee = 'Taxa obrigatória'
    } else {
      try {
        parseBasisPoints(form.fee)
      } catch {
        errs.fee = 'Taxa inválida (ex: 1,99)'
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    const errMsg = await onUpdate(machine.id, form)
    setSaving(false)
    if (errMsg) {
      setErrors({ general: errMsg })
    } else {
      setEditing(false)
      setErrors({})
    }
  }

  async function handleToggle() {
    setToggling(true)
    await onToggleActive(machine.id, machine.isActive)
    setToggling(false)
  }

  if (editing) {
    return (
      <div className={cn(
        'border-b border-border last:border-0 px-6 py-4 bg-brand-50/30',
        !machine.isActive && 'opacity-60'
      )}>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div className="flex-1 min-w-0">
            <Input
              label="Nome"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              error={errors.name}
              placeholder="Ex: Cielo"
              autoFocus
            />
          </div>
          <div className="w-full sm:w-36">
            <Input
              label="Taxa (%)"
              value={form.fee}
              onChange={e => setForm(p => ({ ...p, fee: e.target.value }))}
              error={errors.fee}
              placeholder="1,99"
            />
          </div>
          <div className="flex items-center gap-2 pb-0.5">
            <Button
              size="sm"
              onClick={handleSave}
              loading={saving}
              aria-label="Salvar"
            >
              <Check className="h-3.5 w-3.5" />
              Salvar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setEditing(false); setErrors({}) }}
              aria-label="Cancelar"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {errors.general && (
          <p className="mt-2 text-xs text-destructive">{errors.general}</p>
        )}
      </div>
    )
  }

  return (
    <div className={cn(
      'border-b border-border last:border-0 px-6 py-4',
      'flex items-center gap-4 hover:bg-muted/50 transition-colors',
      !machine.isActive && 'opacity-60'
    )}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{machine.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatBasisPoints(machine.feeBasisPoints)} por transação
        </p>
      </div>
      <Badge variant={machine.isActive ? 'success' : 'muted'}>
        {machine.isActive ? 'Ativa' : 'Inativa'}
      </Badge>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setEditing(true)}
          aria-label={`Editar ${machine.name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant={machine.isActive ? 'secondary' : 'ghost'}
          loading={toggling}
          onClick={handleToggle}
          className="text-xs"
        >
          {machine.isActive ? 'Inativar' : 'Ativar'}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function ConfiguracoesPage() {
  const [machines, setMachines] = useState<CardMachineResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [addForm, setAddForm] = useState<FormState>({ name: '', fee: '' })
  const [addErrors, setAddErrors] = useState<FormErrors>({})
  const [adding, setAdding] = useState(false)

  // ── Carregar maquininhas ──
  const loadMachines = useCallback(async () => {
    try {
      const res = await fetch('/api/card-machines?includeInactive=true', { cache: 'no-store' })
      const json: ApiResponse<CardMachineResponse[]> = await res.json()
      if ('data' in json) setMachines(json.data)
    } catch {
      // silencioso — lista fica vazia
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadMachines() }, [loadMachines])

  // ── Adicionar maquininha ──
  function validateAdd(): boolean {
    const errs: FormErrors = {}
    if (!addForm.name.trim()) errs.name = 'Nome obrigatório'
    if (!addForm.fee.trim()) {
      errs.fee = 'Taxa obrigatória'
    } else {
      try { parseBasisPoints(addForm.fee) }
      catch { errs.fee = 'Taxa inválida (ex: 1,99)' }
    }
    setAddErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleAdd() {
    if (!validateAdd()) return
    setAdding(true)
    try {
      const res = await fetch('/api/card-machines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name.trim(),
          feeBasisPoints: parseBasisPoints(addForm.fee),
        }),
      })
      const json: ApiResponse<CardMachineResponse> = await res.json()
      if (!res.ok) {
        const msg = 'error' in json ? json.error : 'Erro ao adicionar maquininha'
        setAddErrors({ general: msg })
        return
      }
      if ('data' in json) setMachines(prev => [...prev, json.data])
      setAddForm({ name: '', fee: '' })
      setAddErrors({})
    } catch {
      setAddErrors({ general: 'Erro de conexão. Tente novamente.' })
    } finally {
      setAdding(false)
    }
  }

  // ── Atualizar maquininha ──
  async function handleUpdate(id: string, form: FormState): Promise<string | null> {
    try {
      const res = await fetch(`/api/card-machines/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          feeBasisPoints: parseBasisPoints(form.fee),
        }),
      })
      const json: ApiResponse<CardMachineResponse> = await res.json()
      if (!res.ok) return 'error' in json ? json.error : 'Erro ao salvar'
      if ('data' in json) {
        setMachines(prev => prev.map(m => m.id === id ? json.data : m))
      }
      return null
    } catch {
      return 'Erro de conexão. Tente novamente.'
    }
  }

  // ── Inativar / Ativar maquininha ──
  async function handleToggleActive(id: string, isActive: boolean) {
    try {
      if (isActive) {
        // Inativar via DELETE
        await fetch(`/api/card-machines/${id}`, { method: 'DELETE' })
        setMachines(prev => prev.map(m => m.id === id ? { ...m, isActive: false } : m))
      } else {
        // Reativar via PATCH
        const res = await fetch(`/api/card-machines/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: true }),
        })
        const json: ApiResponse<CardMachineResponse> = await res.json()
        if ('data' in json) setMachines(prev => prev.map(m => m.id === id ? json.data : m))
      }
    } catch {
      // silencioso — reload resolve
      loadMachines()
    }
  }

  // ── Render ──
  return (
    <div className="px-4 py-7 sm:px-6 lg:px-8 max-w-3xl mx-auto">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Configurações
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie maquininhas e preferências da loja
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
          <Lock className="h-3 w-3" aria-hidden="true" strokeWidth={2} />
          Área protegida
        </span>
      </div>

      {/* ── Seção: Maquininhas de Cartão ── */}
      <section className="mb-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Maquininhas de Cartão
        </p>

        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">

          {/* Formulário de adição */}
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <p className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4 text-brand-600" aria-hidden="true" />
              Adicionar maquininha
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
              <div className="flex-1 min-w-0">
                <Input
                  label="Nome"
                  value={addForm.name}
                  onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                  error={addErrors.name}
                  placeholder="Ex: Cielo, Stone, PagSeguro"
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <div className="w-full sm:w-36">
                <Input
                  label="Taxa (%)"
                  value={addForm.fee}
                  onChange={e => setAddForm(p => ({ ...p, fee: e.target.value }))}
                  error={addErrors.fee}
                  placeholder="1,99"
                  hint="Por transação"
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <div className="pb-0.5">
                <Button onClick={handleAdd} loading={adding} size="md">
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar
                </Button>
              </div>
            </div>
            {addErrors.general && (
              <p className="mt-2 text-xs text-destructive">{addErrors.general}</p>
            )}
          </div>

          {/* Lista de maquininhas */}
          {loading ? (
            <div className="divide-y divide-border">
              {[1, 2].map(i => (
                <div key={i} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="h-5 w-14 bg-muted animate-pulse rounded-full" />
                </div>
              ))}
            </div>
          ) : machines.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="Nenhuma maquininha cadastrada"
              description="Adicione uma maquininha acima para começar."
            />
          ) : (
            <div>
              {machines.map(machine => (
                <CardMachineRow
                  key={machine.id}
                  machine={machine}
                  onToggleActive={handleToggleActive}
                  onUpdate={handleUpdate}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Seção: Segurança ── */}
      <section className="mb-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Segurança
        </p>
        <div className="flex items-start gap-4 rounded-xl border border-dashed border-border bg-white/50 p-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-medium text-gray-500">Alterar PIN de acesso</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Troque o PIN para proteger Relatórios e Configurações
            </p>
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400">
            Em breve
          </span>
        </div>
      </section>

      {/* ── Seção: Dados da Loja ── */}
      <section>
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Dados da Loja
        </p>
        <div className="flex items-start gap-4 rounded-xl border border-dashed border-border bg-white/50 p-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Store className="h-4 w-4 text-muted-foreground" aria-hidden="true" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-medium text-gray-500">Nome e dados da loja</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Personalize o nome da loja exibido no sistema
            </p>
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400">
            Em breve
          </span>
        </div>
      </section>

    </div>
  )
}
