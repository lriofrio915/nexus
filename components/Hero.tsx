import { ArrowRight, MessageCircle } from 'lucide-react'
import { heroStats, siteConfig } from '@/lib/site-config'

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative z-10 min-h-screen flex items-center justify-center pt-32 pb-20"
    >
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-sm animate-fade-in-up">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-cyan-300 tracking-wider">
              DESARROLLO DE SOFTWARE A MEDIDA
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.1]">
            Tu negocio no cabe en <br className="hidden md:block" />
            una plantilla.{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600">
              Lo construimos.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 mb-4 max-w-3xl mx-auto leading-relaxed">
            {siteConfig.name} desarrolla proyectos de software a medida para todo tipo de
            negocio: personas con una idea, profesionales independientes, estudios y
            empresas.
          </p>
          <p className="text-lg md:text-xl text-slate-300 mb-10 max-w-3xl mx-auto leading-relaxed">
            Especialistas en{' '}
            <span className="text-cyan-400 font-semibold">software de gestión médica</span> y en{' '}
            <span className="text-purple-400 font-semibold">
              algoritmos de trading cuantitativo
            </span>
            .
          </p>

          <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
            <a
              href={siteConfig.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative px-8 py-4 bg-cyan-500 text-black font-bold text-lg rounded-full overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(6,182,212,0.6)]"
            >
              <div className="absolute inset-0 w-full h-full bg-white/20 transform -translate-x-full skew-x-12 group-hover:animate-shine" />
              <span className="flex items-center gap-2">
                Cuéntame tu proyecto <MessageCircle className="w-5 h-5" />
              </span>
            </a>
            <a
              href="#especialidades"
              className="px-8 py-4 bg-transparent border border-white/20 text-white font-bold text-lg rounded-full hover:bg-white/5 transition-all flex items-center gap-2"
            >
              Ver especialidades <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {heroStats.map((stat) => (
            <div
              key={stat.value}
              className="rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm p-6 text-center"
            >
              <div className="text-2xl font-bold text-white mb-2">{stat.value}</div>
              <p className="text-sm text-slate-400 leading-relaxed">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
