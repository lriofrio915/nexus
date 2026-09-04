import { Cpu } from 'lucide-react'
import { siteConfig } from '@/lib/site-config'

export default function Footer() {
  return (
    <footer className="relative z-10 bg-slate-950 py-12 border-t border-white/5 text-slate-400 text-sm">
      <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
          <Cpu className="w-6 h-6 text-cyan-600" />
          <span className="text-xl font-bold text-white">NEXUS</span>
        </div>
        <div className="flex gap-8">
          <a href="/terminos" className="hover:text-cyan-400 transition-colors">
            Términos
          </a>
          <a href="/privacidad" className="hover:text-cyan-400 transition-colors">
            Privacidad
          </a>
          <a
            href={siteConfig.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-cyan-400 transition-colors"
          >
            Soporte
          </a>
        </div>
        <div>
          © {new Date().getFullYear()} {siteConfig.legalName}.
        </div>
      </div>
    </footer>
  )
}
