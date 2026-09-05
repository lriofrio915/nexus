import { CheckCircle } from 'lucide-react'
import { especialidades, siteConfig } from '@/lib/site-config'

export default function Especialidades() {
  return (
    <section
      id="especialidades"
      className="relative z-10 py-16 sm:py-24 border-y border-white/5 bg-slate-950"
    >
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-10 sm:mb-16">
          <span className="text-sm uppercase tracking-widest text-purple-400 font-semibold">
            Dónde somos especialistas
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mt-4 mb-4 text-balance">
            Dos dominios, conocimiento profundo
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Construimos para cualquier industria, pero hay dos donde conocemos el negocio
            tan bien como el código.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {especialidades.map((esp) => {
            const Icon = esp.icon
            return (
              <div
                key={esp.title}
                className={`relative overflow-hidden p-6 sm:p-8 md:p-10 rounded-3xl bg-slate-900/70 border border-white/10 transition-all duration-300 ${esp.borderHover}`}
              >
                <div
                  className={`absolute -top-16 -right-16 w-64 h-64 rounded-full blur-[90px] opacity-60 pointer-events-none ${esp.glow}`}
                />
                <div className="relative">
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${esp.accentBg} ${esp.accentText}`}
                  >
                    <Icon className="w-8 h-8" />
                  </div>
                  <span
                    className={`text-xs uppercase tracking-widest font-semibold ${esp.accentText}`}
                  >
                    {esp.eyebrow}
                  </span>
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mt-3 mb-4 text-white">
                    {esp.title}
                  </h3>
                  <p className="text-slate-400 mb-6 sm:mb-8 leading-relaxed">{esp.description}</p>
                  <ul className="space-y-3">
                    {esp.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-3 text-slate-300 text-sm md:text-base"
                      >
                        <CheckCircle
                          className={`w-5 h-5 flex-shrink-0 mt-0.5 ${esp.accentText}`}
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-center text-slate-500 mt-10 sm:mt-12 max-w-2xl mx-auto">
          ¿Tu proyecto es de otro rubro? {siteConfig.name} igual lo desarrolla: el proceso
          es el mismo y el software sigue siendo tuyo.
        </p>
      </div>
    </section>
  )
}
