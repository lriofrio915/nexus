import Link from 'next/link'
import { CheckCircle2, Cpu } from 'lucide-react'
import { siteConfig } from '@/lib/site-config'

export const metadata = {
  title: 'Solicitud enviada',
  robots: { index: false, follow: false },
}

export default function OnboardingGraciasPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-900">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Cpu className="w-6 h-6 text-cyan-400" />
            <span className="font-bold tracking-wider">NEXUS</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-16 max-w-xl text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
        <h1 className="text-2xl sm:text-3xl font-bold mt-4">Solicitud enviada</h1>
        <p className="text-slate-400 mt-3">
          Ya tenemos tus datos. Vamos a revisarlos y te escribimos para continuar con la apertura
          de tu cuenta en Interactive Brokers. Si falta algún documento te lo pedimos por WhatsApp.
        </p>
        <a
          href={siteConfig.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-6 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg px-6 py-3 text-sm"
        >
          Escribir por WhatsApp
        </a>
      </main>
    </div>
  )
}
