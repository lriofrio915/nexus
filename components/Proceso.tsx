import { chatDemo, proceso } from '@/lib/site-config'

export default function Proceso() {
  return (
    <section
      id="proceso"
      className="relative z-10 py-24 border-y border-white/5 bg-slate-950"
    >
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-sm uppercase tracking-widest text-cyan-400 font-semibold">
              Cómo trabajamos
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mt-4 mb-8">
              De la idea al sistema en producción
            </h2>

            <div className="space-y-8">
              {proceso.map((paso) => {
                const Icon = paso.icon
                return (
                  <div key={paso.step} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-cyan-500/15 text-cyan-400 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="mt-2 text-xs font-mono text-slate-600">
                        {paso.step}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold mb-2 text-white">{paso.title}</h4>
                      <p className="text-slate-400 leading-relaxed">{paso.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-2xl blur-2xl opacity-20 animate-pulse" />
            <div className="relative bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-4">
                Así empieza una conversación con Nexus
              </p>
              <div className="space-y-4 font-mono text-sm">
                {chatDemo.map((msg, i) =>
                  msg.from === 'user' ? (
                    <div key={i} className="flex items-end gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                        U
                      </div>
                      <div className="bg-slate-800 p-3 rounded-2xl rounded-bl-none max-w-[80%] text-slate-300">
                        {msg.text}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex items-end gap-2 flex-row-reverse">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-black font-bold flex-shrink-0">
                        N
                      </div>
                      <div className="bg-cyan-900/40 border border-cyan-500/30 p-3 rounded-2xl rounded-br-none max-w-[80%] text-cyan-100">
                        {msg.text}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
