'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Cpu, Lock } from 'lucide-react'

/** Only allow same-origin paths, so `next` cannot bounce to another site. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/panel'
  return raw
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setIsSending(true)
    setError(null)

    try {
      const res = await fetch('/api/panel/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'No se pudo iniciar sesión.')
        setPassword('')
        return
      }

      router.replace(safeNext(params.get('next')))
      router.refresh()
    } catch {
      setError('No se pudo conectar. Inténtalo de nuevo.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center justify-center gap-2 mb-8">
        <Cpu className="w-8 h-8 text-cyan-400" />
        <span className="text-2xl font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
          NEXUS
        </span>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm text-slate-400" htmlFor="password">
          Contraseña del panel
        </label>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            id="password"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-800 border border-white/10 rounded-lg pl-11 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
        <button
          type="submit"
          disabled={isSending || !password}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 font-bold text-white disabled:opacity-50"
        >
          {isSending ? 'Entrando...' : 'Entrar'}
        </button>
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      </form>
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
