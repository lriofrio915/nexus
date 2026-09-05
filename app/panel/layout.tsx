import Link from 'next/link'
import { Cpu, LogOut } from 'lucide-react'

const navItems = [
  { href: '/panel/trading', label: 'Trading' },
  { href: '/panel/trading/cuentas', label: 'Cuentas' },
  { href: '/panel/trading/gastos', label: 'Gastos' },
  { href: '/panel/desarrollo', label: 'Desarrollo' },
  { href: '/panel/leads', label: 'Leads' },
]

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-900">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          {/* Brand row: on a phone the nav cannot fit beside it, so it drops to
              its own scrollable row underneath instead of squeezing. */}
          <div className="flex items-center justify-between gap-4">
            <Link href="/panel" className="flex items-center gap-2">
              <Cpu className="w-6 h-6 text-cyan-400 flex-shrink-0" />
              <span className="font-bold tracking-wider">NEXUS</span>
            </Link>

            <div className="flex items-center gap-4 sm:gap-6">
              <Link
                href="/"
                className="text-sm text-slate-400 hover:text-cyan-400 hidden sm:inline"
              >
                Ver sitio
              </Link>
              <form action="/api/panel/logout" method="post">
                <button
                  type="submit"
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-400"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Salir</span>
                </button>
              </form>
            </div>
          </div>

          {/* Bleeds to the screen edges so the scrolled-off links are not cut
              mid-word by the container padding. */}
          <nav className="mt-3 flex gap-5 sm:gap-6 text-sm text-slate-300 overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap py-1 hover:text-cyan-400"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
    </div>
  )
}
