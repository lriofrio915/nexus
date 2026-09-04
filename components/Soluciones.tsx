import { CheckCircle } from 'lucide-react'
import { soluciones } from '@/lib/site-config'

export default function Soluciones() {
  return (
    <section id="soluciones" className="relative z-10 py-24 bg-slate-900/50">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Soluciones Especializadas
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Nuestros agentes de IA están entrenados específicamente para tu industria.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {soluciones.map((sol) => {
            const Icon = sol.icon
            return (
              <div
                key={sol.title}
                className={`group relative p-8 rounded-2xl bg-slate-800/50 border border-white/10 transition-all duration-500 hover:-translate-y-2 ${sol.borderHover}`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-b to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl ${sol.gradientFrom}`}
                />
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${sol.iconBg} ${sol.iconText}`}
                >
                  <Icon className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-white">{sol.title}</h3>
                <p className="text-slate-400 mb-6">{sol.description}</p>
                <ul className="space-y-2 text-sm text-slate-300">
                  {sol.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <CheckCircle className={`w-4 h-4 ${sol.checkText}`} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
