'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, Send, X } from 'lucide-react'
import { siteConfig } from '@/lib/site-config'

interface Turn {
  role: 'user' | 'assistant'
  content: string
}

const GREETING =
  '¡Hola! Soy el asistente de Nexus. Cuéntame qué te gustaría automatizar en tu negocio.'

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([{ role: 'assistant', content: GREETING }])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const conversationId = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, isOpen])

  async function send() {
    const message = input.trim()
    if (!message || isSending) return

    setInput('')
    setError(null)
    setIsSending(true)

    const history = turns.slice(1) // drop the canned greeting
    setTurns((prev) => [...prev, { role: 'user', content: message }, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history, conversationId: conversationId.current }),
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'No pudimos conectar con el agente.')
      }

      conversationId.current = res.headers.get('X-Conversation-Id') ?? conversationId.current

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setTurns((prev) => {
          const next = [...prev]
          next[next.length - 1] = {
            role: 'assistant',
            content: next[next.length - 1].content + chunk,
          }
          return next
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Algo salió mal.'
      setError(msg)
      // Remove the empty assistant placeholder so the thread stays clean.
      setTurns((prev) => (prev[prev.length - 1].content === '' ? prev.slice(0, -1) : prev))
    } finally {
      setIsSending(false)
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'Cerrar chat' : 'Abrir chat con el asistente'}
        className="fixed bottom-6 right-24 z-50 flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:shadow-[0_0_30px_rgba(6,182,212,0.8)] hover:scale-110 transition-all"
      >
        {isOpen ? <X className="w-7 h-7" /> : <Bot className="w-8 h-8" />}
      </button>

      {isOpen && (
        <div className="fixed bottom-28 right-6 z-50 w-[calc(100vw-3rem)] max-w-sm h-[30rem] flex flex-col rounded-2xl bg-slate-900 border border-cyan-500/30 shadow-2xl overflow-hidden">
          <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-slate-950">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-black font-bold">
              N
            </div>
            <div>
              <p className="font-bold text-white text-sm">Asistente Nexus</p>
              <p className="text-xs text-cyan-400">En línea</p>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {turns.map((turn, i) => (
              <div
                key={i}
                className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                    turn.role === 'user'
                      ? 'bg-cyan-600 text-white rounded-br-none'
                      : 'bg-slate-800 text-slate-200 rounded-bl-none'
                  }`}
                >
                  {turn.content || (
                    <span className="inline-flex gap-1 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse delay-150" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse delay-300" />
                    </span>
                  )}
                </div>
              </div>
            ))}

            {error && (
              <p className="text-xs text-red-400 text-center">
                {error}{' '}
                <a
                  href={siteConfig.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-red-300"
                >
                  Escríbenos por WhatsApp
                </a>
                .
              </p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
            className="flex items-center gap-2 p-3 border-t border-white/10 bg-slate-950"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu mensaje..."
              maxLength={2000}
              className="flex-1 bg-slate-800 text-white text-sm rounded-full px-4 py-2 outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-cyan-500"
            />
            <button
              type="submit"
              disabled={isSending || !input.trim()}
              aria-label="Enviar mensaje"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-cyan-500 text-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cyan-400 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
