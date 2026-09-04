'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Cpu } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

const LOGIN_ERRORS: Record<string, string> = {
  'no-autorizado': 'Esa cuenta no tiene acceso al panel.',
  'sin-configurar': 'El panel no está configurado todavía. Faltan las variables de Supabase.',
}

function LoginForm() {
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(LOGIN_ERRORS[params.get('error') ?? ''] ?? null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError(null)

    const supabase = createSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/panel` },
    })

    if (authError) {
      setError(authError.message)
      setStatus('idle')
      return
    }
    setStatus('sent')
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center justify-center gap-2 mb-8">
        <Cpu className="w-8 h-8 text-cyan-400" />
        <span className="text-2xl font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
          NEXUS
        </span>
      </div>

      {status === 'sent' ? (
        <p className="text-center text-slate-300">
          Te enviamos un enlace de acceso a <span className="text-cyan-400">{email}</span>.
          Ábrelo en este mismo navegador.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm text-slate-400" htmlFor="email">
            Correo autorizado
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:ring-1 focus:ring-cyan-500"
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 font-bold text-white disabled:opacity-50"
          >
            {status === 'sending' ? 'Enviando...' : 'Enviar enlace de acceso'}
          </button>
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        </form>
      )}
    </div>
  )
}

export default function PanelLoginPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  )
}
