import { beneficios, chatDemo, siteConfig } from '@/lib/site-config'

export default function Beneficios() {
  return (
    <section
      id="beneficios"
      className="relative z-10 py-20 border-y border-white/5 bg-slate-950"
    >
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              ¿Por qué elegir <span className="text-cyan-400">{siteConfig.name}</span>?
            </h2>
            <div className="space-y-8">
              {beneficios.map((ben) => {
                const Icon = ben.icon
                return (
                  <div key={ben.title} className="flex gap-4">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${ben.iconBg}`}
                    >
                      <Icon className={`w-6 h-6 ${ben.iconText}`} />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold mb-2">{ben.title}</h4>
                      <p className="text-slate-400">{ben.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-2xl blur-2xl opacity-20 animate-pulse" />
            <div className="relative bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">
              {/* Chat Simulation */}
              <div className="space-y-4 font-mono text-sm">
                {chatDemo.map((msg, i) =>
                  msg.from === 'user' ? (
                    <div key={i} className="flex items-end gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                        U
                      </div>
                      <div className="bg-slate-800 p-3 rounded-2xl rounded-bl-none max-w-[80%] text-slate-300">
                        {msg.text}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex items-end gap-2 flex-row-reverse">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-black font-bold">
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
