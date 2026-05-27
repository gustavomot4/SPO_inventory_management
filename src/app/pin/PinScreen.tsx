// =============================================================================
// PinScreen.tsx — Lógica e UI da tela de PIN (Client Component)
// SPO — Sistema Pimenta Ousada | MVP-007 v2
// =============================================================================
//
// Separado de page.tsx para permitir Suspense wrapping no page.tsx
// (necessário por usar useSearchParams() — requisito do Next.js 14).
//
// Fluxo ao carregar:
//   1. GET /api/auth/status
//   2a. isVerified → redireciona para ?redirect ou /
//   2b. pinConfigured: false → tela de "acesso livre"
//   2c. default → tela de entrada de PIN
//
// Teclado numérico virtual:
//   - Submissão automática ao digitar 6 dígitos
//   - Botão "OK" disponível com 4+ dígitos
//   - Suporte a teclado físico (números + Backspace + Enter)
//   - PIN exibido como bolinhas (● nunca mostra os números)
//
// Design (v2):
//   - Flame como marca visual — sem emojis
//   - Loader2 (animate-spin) substitui spinner manual
//   - Delete para backspace — ícone semântico claro
//   - ShieldCheck para estado sem PIN — positivo, não genérico
//   - AlertCircle para erros — consistência com resto do sistema
// =============================================================================

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Flame,
  Loader2,
  Delete,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiResponse } from '@/types'
import type { AuthStatusResponse } from '@/app/api/auth/status/route'

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const MIN_PIN_LENGTH = 4
const MAX_PIN_LENGTH = 6

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type ScreenState =
  | 'loading'      // verificando sessão
  | 'no_pin'       // PIN não configurado → acesso livre
  | 'input'        // aguardando digitação do PIN
  | 'verifying'    // chamada POST em andamento
  | 'redirecting'  // POST bem-sucedido, aguardando redirect

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

/** Exibe o PIN digitado como bolinhas */
function PinDots({ length, filled }: { length: number; filled: number }) {
  return (
    <div
      className="flex items-center justify-center gap-3 my-6"
      aria-label={`${filled} de ${length} dígitos digitados`}
    >
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-3.5 h-3.5 rounded-full border-2 transition-all duration-150',
            i < filled
              ? 'bg-brand-600 border-brand-600 scale-110'
              : 'bg-transparent border-gray-300'
          )}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

/** Botão individual do teclado numérico */
function PinKey({
  label,
  onClick,
  disabled,
  variant = 'digit',
  isBackspace = false,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  variant?: 'digit' | 'action' | 'backspace'
  isBackspace?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isBackspace ? 'Apagar último dígito' : label}
      className={cn(
        'flex items-center justify-center rounded-xl text-sm font-semibold',
        'transition-all active:scale-95 min-h-[3.5rem] select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        variant === 'digit' &&
          'bg-white border border-gray-200 text-gray-800 shadow-sm',
        variant === 'digit' && !disabled &&
          'hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700',
        variant === 'action' &&
          'bg-brand-600 text-white shadow-sm',
        variant === 'action' && !disabled &&
          'hover:bg-brand-700',
        variant === 'backspace' &&
          'bg-gray-100 text-gray-600',
        variant === 'backspace' && !disabled &&
          'hover:bg-gray-200',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      {isBackspace ? (
        <Delete className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
      ) : (
        <span className="text-base">{label}</span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function PinScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/'

  const [screenState, setScreenState] = useState<ScreenState>('loading')
  const [pin, setPin] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // ── Verificar status da sessão ao montar ──
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/auth/status', { cache: 'no-store' })
        const json: ApiResponse<AuthStatusResponse> = await res.json()

        if (!('data' in json)) {
          setScreenState('input')
          return
        }

        if (json.data.isVerified) {
          setScreenState('redirecting')
          router.replace(redirectTo)
          return
        }

        setScreenState(json.data.pinConfigured ? 'input' : 'no_pin')
      } catch {
        // Em caso de erro de rede, assume que o PIN pode ser necessário
        setScreenState('input')
      }
    }

    checkStatus()
  }, [router, redirectTo])

  // ── Submeter PIN à API ──
  const submitPin = useCallback(async (pinValue: string) => {
    setScreenState('verifying')
    setErrorMsg('')

    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinValue }),
      })

      if (res.ok) {
        setScreenState('redirecting')
        router.replace(redirectTo)
        return
      }

      const json: ApiResponse<never> = await res.json()
      const msg =
        'error' in json && json.error === 'PIN incorreto'
          ? 'PIN incorreto. Tente novamente.'
          : 'Não foi possível verificar o PIN. Tente novamente.'

      setErrorMsg(msg)
      setPin('')
      setScreenState('input')
    } catch {
      setErrorMsg('Erro de conexão. Tente novamente.')
      setPin('')
      setScreenState('input')
    }
  }, [router, redirectTo])

  // ── Acesso livre (sem PIN configurado) ──
  const handleFreeAccess = useCallback(async () => {
    setScreenState('verifying')
    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '0000' }),
      })
      if (res.ok) {
        setScreenState('redirecting')
        router.replace(redirectTo)
      } else {
        setScreenState('no_pin')
      }
    } catch {
      setScreenState('no_pin')
    }
  }, [router, redirectTo])

  // ── Digitar um número ──
  const handleDigit = useCallback(
    (digit: string) => {
      if (screenState !== 'input') return

      setPin((prev) => {
        if (prev.length >= MAX_PIN_LENGTH) return prev
        const next = prev + digit
        if (next.length === MAX_PIN_LENGTH) {
          setTimeout(() => submitPin(next), 80)
        }
        return next
      })
      setErrorMsg('')
    },
    [screenState, submitPin]
  )

  // ── Apagar último dígito ──
  const handleBackspace = useCallback(() => {
    if (screenState !== 'input') return
    setPin((prev) => prev.slice(0, -1))
    setErrorMsg('')
  }, [screenState])

  // ── Confirmar PIN (botão manual) ──
  const handleConfirm = useCallback(() => {
    if (pin.length >= MIN_PIN_LENGTH && screenState === 'input') {
      submitPin(pin)
    }
  }, [pin, screenState, submitPin])

  // ── Suporte ao teclado físico ──
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (screenState !== 'input') return
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key)
      } else if (e.key === 'Backspace') {
        handleBackspace()
      } else if (e.key === 'Enter' && pin.length >= MIN_PIN_LENGTH) {
        handleConfirm()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [screenState, pin.length, handleDigit, handleBackspace, handleConfirm])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isDisabled = screenState === 'verifying' || screenState === 'redirecting'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-10">

      {/* ── Card principal ── */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">

        {/* Cabeçalho */}
        <div className="px-8 pt-8 pb-5 text-center border-b border-gray-100">
          {/*
           * Decisão de design: Flame em container brand-50 substitui emoji 🌶️.
           * Mesmo padrão do SidebarContent — identidade visual consistente.
           */}
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-50 mb-4">
            <Flame className="h-6 w-6 text-brand-700" aria-hidden="true" strokeWidth={2.5} />
          </div>

          <h1 className="text-lg font-bold tracking-tight text-gray-900">
            Pimenta Ousada
          </h1>

          <p className="text-sm text-muted-foreground mt-1">
            {screenState === 'loading' || screenState === 'redirecting'
              ? 'Verificando acesso…'
              : screenState === 'no_pin'
              ? 'Nenhum PIN configurado'
              : 'Digite o PIN para acessar'}
          </p>
        </div>

        {/* Corpo */}
        <div className="px-8 py-6">

          {/* ── Estado: carregando / redirecionando ── */}
          {(screenState === 'loading' || screenState === 'redirecting') && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2
                className="h-8 w-8 text-brand-600 animate-spin"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground" role="status">
                {screenState === 'loading' ? 'Verificando sessão…' : 'Entrando…'}
              </p>
            </div>
          )}

          {/* ── Estado: sem PIN configurado ── */}
          {screenState === 'no_pin' && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="text-center">
                {/*
                 * ShieldCheck: transmite "acesso liberado / sem bloqueio"
                 * Cor green-600 para diferenciação semântica (positivo).
                 */}
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-50 mb-3">
                  <ShieldCheck
                    className="h-7 w-7 text-green-600"
                    aria-hidden="true"
                    strokeWidth={1.5}
                  />
                </div>
                <p className="text-sm font-medium text-gray-700">
                  Nenhum PIN configurado.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Acesso livre a todas as áreas.
                </p>
              </div>
              <button
                type="button"
                onClick={handleFreeAccess}
                disabled={isDisabled}
                className={cn(
                  'w-full py-3 px-4 text-sm font-semibold rounded-xl transition-colors',
                  'bg-brand-600 text-white hover:bg-brand-700',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'flex items-center justify-center gap-2'
                )}
              >
                {isDisabled ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Entrando…
                  </>
                ) : (
                  'Continuar'
                )}
              </button>
            </div>
          )}

          {/* ── Estado: entrada do PIN ── */}
          {(screenState === 'input' || screenState === 'verifying') && (
            <>
              {/* Mensagem de erro */}
              {errorMsg && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" strokeWidth={2} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Bolinhas do PIN */}
              <PinDots length={MAX_PIN_LENGTH} filled={pin.length} />

              {/* Verificando... */}
              {screenState === 'verifying' && (
                <div className="flex items-center justify-center gap-2 mb-4 text-sm text-brand-600">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Verificando…</span>
                </div>
              )}

              {/* Teclado numérico virtual */}
              <div
                className="grid grid-cols-3 gap-2.5 mt-2"
                role="group"
                aria-label="Teclado numérico"
              >
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                  <PinKey
                    key={d}
                    label={d}
                    onClick={() => handleDigit(d)}
                    disabled={isDisabled || pin.length >= MAX_PIN_LENGTH}
                  />
                ))}

                {/* Linha 4: ← 0 OK */}
                <PinKey
                  label="del"
                  onClick={handleBackspace}
                  disabled={isDisabled || pin.length === 0}
                  variant="backspace"
                  isBackspace
                />
                <PinKey
                  label="0"
                  onClick={() => handleDigit('0')}
                  disabled={isDisabled || pin.length >= MAX_PIN_LENGTH}
                />
                <PinKey
                  label="OK"
                  onClick={handleConfirm}
                  disabled={isDisabled || pin.length < MIN_PIN_LENGTH}
                  variant="action"
                />
              </div>

              {/* Dica de teclado físico */}
              <p className="text-center text-xs text-muted-foreground mt-4">
                Você também pode usar o teclado físico
              </p>
            </>
          )}
        </div>
      </div>

      {/* Rodapé */}
      <p className="mt-6 text-xs text-muted-foreground">
        v0.1.0-MVP · Pimenta Ousada
      </p>
    </div>
  )
}
