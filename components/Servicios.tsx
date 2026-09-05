import { servicios } from '@/lib/site-config'

export default function Servicios() {
  return (
    <section id="servicios" className="relative z-10 py-24 bg-slate-900/50">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-sm uppercase tracking-widest text-cyan-400 font-semibold">
            Qué construimos
          </span>
          <h2 className="text-3xl md:text-5xl font-bold mt-4 mb-4">
            Software hecho para tu operación
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Cada proyecto arranca desde tus procesos reales, no desde una plantilla.
            Diseñamos, desarrollamos y ponemos en producción.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servicios.map((serv) => {
            const Icon = serv.icon
            return (
              <div
                key={serv.title}
                className={`group p-8 rounded-2xl bg-slate-800/40 border border-white/10 transition-all duration-300 hover:-translate-y-1 ${serv.borderHover}`}
              >
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${serv.iconBg} ${serv.iconText}`}
                >
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-white">{serv.title}</h3>
                <p className="text-slate-400 leading-relaxed">{serv.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
