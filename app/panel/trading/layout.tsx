import Link from 'next/link'

// The trading section is three pages, not three top-level sections: the summary
// and the two tables that feed it. They hang off the section itself so the main
// nav stays one entry per business.
const subNavItems = [
  { href: '/panel/trading', label: 'Resumen' },
  { href: '/panel/trading/cuentas', label: 'Cuentas' },
  { href: '/panel/trading/gastos', label: 'Gastos' },
]

export default function TradingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      {/* Bleeds to the container edges on a phone for the same reason as the
          main nav: a scrolled-off link must not be clipped mid-word. */}
      <nav className="flex gap-5 sm:gap-6 text-sm text-slate-400 border-b border-white/10 pb-3 overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {subNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap hover:text-cyan-400"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  )
}
