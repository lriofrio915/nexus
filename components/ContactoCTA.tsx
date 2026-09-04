import { siteConfig } from '@/lib/site-config'

export default function ContactoCTA() {
  return (
    <section id="contacto" className="relative z-10 py-24 text-center">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 p-12 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-[80px]" />

          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
            ¿Listo para el siguiente nivel?
          </h2>
          <p className="text-xl text-slate-400 mb-10">
            Deja de perder clientes por no responder a tiempo. Automatiza tu WhatsApp hoy
            mismo con {siteConfig.name}.
          </p>

          <a
            href={siteConfig.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-10 py-5 bg-white text-slate-900 font-bold text-xl rounded-full hover:bg-cyan-50 hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)]"
          >
            Comenzar Ahora
          </a>
          <p className="mt-6 text-sm text-slate-500">
            Consulta gratuita inicial • Implementación rápida
          </p>
        </div>
      </div>
    </section>
  )
}
