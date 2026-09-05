import Link from 'next/link'
import { Cpu, LogOut } from 'lucide-react'

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-900">
        <div className="container mx-auto px-6 py-4 flex items-center gap-8">
          <Link href="/panel" className="flex items-center gap-2">
            <Cpu className="w-6 h-6 text-cyan-400" />
            <span className="font-bold tracking-wider">NEXUS</span>
          </Link>
          <nav className="flex gap-6 text-sm text-slate-300">
            <Link href="/panel/trading" className="hover:text-cyan-400">
              Trading
            </Link>
            <Link href="/panel/trading/cuentas" className="hover:text-cyan-400">
              Cuentas
            </Link>
            <Link href="/panel/trading/gastos" className="hover:text-cyan-400">
              Gastos
            </Link>
            <Link href="/panel/desarrollo" className="hover:text-cyan-400">
              Desarrollo
            </Link>
            <Link href="/panel/leads" className="hover:text-cyan-400">
              Leads
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-6">
            <Link href="/" className="text-sm text-slate-400 hover:text-cyan-400">
              Ver sitio
            </Link>
            <form action="/api/panel/logout" method="post">
              <button
                type="submit"
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-400"
              >
                <LogOut className="w-4 h-4" />
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
