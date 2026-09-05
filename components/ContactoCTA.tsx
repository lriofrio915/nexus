import { siteConfig } from '@/lib/site-config'

export default function ContactoCTA() {
  return (
    <section id="contacto" className="relative z-10 py-24 text-center">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 p-12 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-[80px]" />

          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
            Cuéntanos qué necesitas construir
          </h2>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            Un sistema de gestión médica, una estrategia de trading automatizada o el
            software que tu negocio nunca encontró en el mercado. Escríbenos y lo
            evaluamos contigo.
          </p>

          <a
            href={siteConfig.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-10 py-5 bg-white text-slate-900 font-bold text-xl rounded-full hover:bg-cyan-50 hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)]"
          >
            Agendar diagnóstico gratuito
          </a>
          <p className="mt-6 text-sm text-slate-500">
            Diagnóstico sin costo • Alcance y precio cerrado antes de empezar
          </p>
        </div>
      </div>
    </section>
  )
}
