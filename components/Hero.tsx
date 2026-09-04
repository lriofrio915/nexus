import { Bot, ArrowRight } from 'lucide-react'
import { siteConfig } from '@/lib/site-config'

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative z-10 min-h-screen flex items-center justify-center pt-20"
    >
      <div className="container mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-sm animate-fade-in-up">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-cyan-300 tracking-wider">
            IA DE ÚLTIMA GENERACIÓN
          </span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          El Futuro de la <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600">
            Automatización
          </span>
        </h1>

        <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          {siteConfig.description}
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
              Crear mi Asistente <Bot className="w-5 h-5" />
            </span>
          </a>
          <a
            href="#soluciones"
            className="px-8 py-4 bg-transparent border border-white/20 text-white font-bold text-lg rounded-full hover:bg-white/5 transition-all flex items-center gap-2"
          >
            Ver Demos <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </div>
    </section>
  )
}
