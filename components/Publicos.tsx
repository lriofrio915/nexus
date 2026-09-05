import { publicos, stack } from '@/lib/site-config'

export default function Publicos() {
  return (
    <section className="relative z-10 py-16 sm:py-20 bg-slate-900/50">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-balance">Para quién trabajamos</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Desde una persona con una idea hasta empresas con equipos y sistemas ya
            andando.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-12 sm:mb-16">
          {publicos.map((pub) => {
            const Icon = pub.icon
            return (
              <div
                key={pub.title}
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 text-center"
              >
                <Icon className={`w-8 h-8 mx-auto mb-4 ${pub.iconText}`} />
                <h3 className="text-lg font-bold text-white mb-2">{pub.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{pub.description}</p>
              </div>
            )
          })}
        </div>

        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-slate-500 mb-6">
            Tecnologías que usamos
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {stack.map((tech) => (
              <span
                key={tech}
                className="px-4 py-2 rounded-full bg-slate-800/60 border border-white/10 text-sm text-slate-300"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
