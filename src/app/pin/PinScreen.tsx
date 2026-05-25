// =============================================================================
// PinScreen.tsx — Lógica e UI da tela de PIN (Client Component)
// SPO — Sistema Pimenta Ousada | MVP-007
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
//   - Botão "Confirmar" disponível com 4+ dígitos
//   - Suporte a teclado físico (números + Backspace + Enter)
//   - PIN exibido como bolinhas (● nunca mostra os números)
// =============================================================================

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  | 'loading'    // verificando sessão
  | 'no_pin'     // PIN não configurado → acesso livre
  | 'input'      // aguardando digitação do PIN
  | 'verifying'  // chamada POST em andamento
  | 'redirecting' // POST bem-sucedido, aguardando redirect

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

/** Exibe o PIN digitado como bolinhas */
function PinDots({ length, filled }: { length: number; filled: number }) {
  return (
    <div className="flex items-center justify-center gap-3 my-6" aria-label={`${filled} de ${length} dígitos digitados`}>
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={[
            'w-4 h-4 rounded-full border-2 transition-all duration-150',
            i < filled
              ? 'bg-brand-600 border-brand-600 scale-110'
              : 'bg-transparent border-gray-300',
          ].join(' ')}
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
}: {
  label: string
  onClick: () => void
  disabled: boolean
  variant?: 'digit' | 'action' | 'backspace'
}) {
  const base = 'flex items-center justify-center rounded-xl text-lg font-semibold transition-all active:scale-95 min-h-[3.5rem] min-w-[4rem] select-none'

  const styles: Record<string, string> = {
    digit:     'bg-white border border-gray-200 text-gray-800 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed',
    action:    'bg-brand-600 text-white hover:bg-brand-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed',
    backspace: 'bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles[variant]}`}
      aria-label={variant === 'backspace' ? 'Apagar último dígito' : label}
    >
      {label}
    </button>
  )
}

/** Spinner de carregamento */
function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }
  return (
    <div
      className={`${sizes[size]} border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin`}
      role="status"
      aria-label="Carregando"
    />
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
      const msg = 'error' in json && json.error === 'PIN incorreto'
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
  const handleDigit = useCallback((digit: string) => {
    if (screenState !== 'input') return

    setPin((prev) => {
      if (prev.length >= MAX_PIN_LENGTH) return prev
      const next = prev + digit
      if (next.length === MAX_PIN_LENGTH) {
        // Auto-submit ao completar o PIN máximo
        setTimeout(() => submitPin(next), 80)
      }
      return next
    })
    setErrorMsg('')
  }, [screenState, submitPin])

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

  // Layout base: tela cheia centralizada, sem sidebar
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 py-10">

      {/* Card principal */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">

        {/* Cabeçalho */}
        <div className="px-8 pt-8 pb-4 text-center border-b border-gray-100">
          <div className="text-4xl mb-3" aria-hidden="true">🌶️</div>
          <h1 className="text-xl font-bold text-gray-800">Pimenta Ousada</h1>

          {screenState === 'loading' || screenState === 'redirecting' ? (
            <p className="text-sm text-gray-400 mt-1">Verificando acesso…</p>
          ) : screenState === 'no_pin' ? (
            <p className="text-sm text-gray-500 mt-1">Nenhum PIN configurado</p>
          ) : (
            <p className="text-sm text-gray-500 mt-1">
              Digite o PIN para acessar
            </p>
          )}
        </div>

        {/* Corpo */}
        <div className="px-8 py-6">

          {/* ── Estado: carregando / redirecionando ── */}
          {(screenState === 'loading' || screenState === 'redirecting') && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Spinner size="lg" />
              <p className="text-sm text-gray-400">
                {screenState === 'loading' ? 'Verificando sessão…' : 'Entrando…'}
              </p>
            </div>
          )}

          {/* ── Estado: sem PIN configurado ── */}
          {screenState === 'no_pin' && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-50 mb-3">
                  <span className="text-2xl" aria-hidden="true">✅</span>
                </div>
                <p className="text-sm font-medium text-gray-700">
                  Nenhum PIN configurado.
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Acesso livre a todas as áreas.
                </p>
              </div>
              <button
                type="button"
                onClick={handleFreeAccess}
                disabled={isDisabled}
                className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDisabled ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" /> Entrando…
                  </span>
                ) : (
                  'Continuar →'
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
                  <span aria-hidden="true">⚠️</span>
                  {errorMsg}
                </div>
              )}

              {/* Bolinhas do PIN */}
              <PinDots length={MAX_PIN_LENGTH} filled={pin.length} />

              {/* Verificando... */}
              {screenState === 'verifying' && (
                <div className="flex items-center justify-center gap-2 mb-4 text-sm text-brand-600">
                  <Spinner size="sm" />
                  <span>Verificando…</span>
                </div>
              )}

              {/* Teclado numérico virtual */}
              <div
                className="grid grid-cols-3 gap-2.5 mt-2"
                role="group"
                aria-label="Teclado numérico"
              >
                {/* Linha 1: 1 2 3 */}
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                  <PinKey
                    key={d}
                    label={d}
                    onClick={() => handleDigit(d)}
                    disabled={isDisabled || pin.length >= MAX_PIN_LENGTH}
                  />
                ))}

                {/* Linha 4: ← 0 ✓ */}
                <PinKey
                  label="⌫"
                  onClick={handleBackspace}
                  disabled={isDisabled || pin.length === 0}
                  variant="backspace"
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
              <p className="text-center text-xs text-gray-400 mt-4">
                Você também pode usar o teclado físico
              </p>
            </>
          )}
        </div>
      </div>

      {/* Rodapé */}
      <p className="mt-6 text-xs text-gray-400">
        v0.1.0-MVP · Pimenta Ousada
      </p>
    </div>
  )
}
