import Link from 'next/link'
import { LineChart, Users, Wallet, Landmark, Code2 } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase-server'
import {
  portfolioTotals,
  type ClientRow,
  type InvoiceItemRow,
  type InvoiceRow,
  type PaymentRow,
  type ProjectRow,
} from '@/lib/dev-metrics'
import {
  accrueExpenses,
  excludeInactive,
  isExcluded,
  money,
  pnlClass,
  signedMoney,
  sumMoney,
  type AccountMapRow,
  type ExpenseRow,
} from '@/lib/trading-metrics'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Panel', robots: { index: false, follow: false } }

async function overview() {
  try {
    const db = supabaseAdmin()
    const [leads, trades, expenses, accounts, map] = await Promise.all([
      db.from('nexus_leads').select('*', { count: 'exact', head: true }),
      db.from('nexus_nt_trades').select('account, pnl_currency'),
      db
        .from('nexus_biz_expenses')
        .select('id, concept, category, amount, kind, recurrence, starts_on, ends_on, account'),
      db.from('nexus_nt_accounts').select('name, cash_value'),
      db.from('nexus_biz_accounts').select('account, label, prop_firm, strategy_id, active'),
    ])

    // Inactive accounts (NinjaTrader's Sim101 and anything else switched off)
    // are excluded so the headline capital is money that actually exists.
    const accountMap = (map.data ?? []) as AccountMapRow[]
    const liveTrades = excludeInactive(
      (trades.data ?? []) as { account: string; pnl_currency: number | null }[],
      accountMap
    )
    const liveAccounts = ((accounts.data ?? []) as { name: string; cash_value: number | null }[])
      .filter((a) => !isExcluded(a.name, accountMap))

    const pnl = sumMoney(liveTrades.map((t) => t.pnl_currency))
    const invested = sumMoney(
      accrueExpenses((expenses.data ?? []) as ExpenseRow[], null, new Date()).map(
        (c) => c.amount
      )
    )
    const capital = sumMoney(liveAccounts.map((a) => a.cash_value))

    return {
      leads: leads.count ?? 0,
      pnl,
      invested,
      capital,
      net: pnl - invested,
      error:
        leads.error?.message ??
        trades.error?.message ??
        expenses.error?.message ??
        accounts.error?.message ??
        map.error?.message ??
        null,
    }
  } catch (err) {
    return {
      leads: 0,
      pnl: 0,
      invested: 0,
      capital: 0,
      net: 0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/** The software side of the business: what has been invoiced and what is owed. */
async function devOverview() {
  try {
    const db = supabaseAdmin()
    const [clients, projects, invoices, items, payments] = await Promise.all([
      db.from('nexus_dev_clients').select('*'),
      db.from('nexus_dev_projects').select('*'),
      db.from('nexus_dev_invoices').select('*'),
      db.from('nexus_dev_invoice_items').select('*'),
      db.from('nexus_dev_payments').select('*'),
    ])

    return portfolioTotals(
      (projects.data ?? []) as ProjectRow[],
      (invoices.data ?? []) as InvoiceRow[],
      (items.data ?? []) as InvoiceItemRow[],
      (payments.data ?? []) as PaymentRow[],
      (clients.data ?? []) as ClientRow[]
    )
  } catch {
    // The trading figures must still render if the dev tables are not migrated yet.
    return {
      invoiced: 0,
      collected: 0,
      outstanding: 0,
      recurringYearly: 0,
      activeProjects: 0,
      clients: 0,
    }
  }
}

export default async function PanelHome() {
  const [{ leads, pnl, invested, capital, net, error }, dev] = await Promise.all([
    overview(),
    devOverview(),
  ])

  const cards = [
    {
      href: '/panel/trading',
      icon: LineChart,
      label: 'Utilidad del negocio',
      value: signedMoney(net),
      valueClass: pnlClass(net),
      hint: 'Resultado operativo menos lo invertido',
    },
    {
      href: '/panel/trading',
      icon: Landmark,
      label: 'Capital en cuentas',
      value: money(capital),
      hint: 'Suma de saldos reportados por NinjaTrader',
    },
    {
      href: '/panel/trading/gastos',
      icon: Wallet,
      label: 'Invertido a la fecha',
      value: money(invested),
      hint: 'Pagos únicos y recurrentes devengados',
    },
    {
      href: '/panel/desarrollo',
      icon: Code2,
      label: 'Por cobrar en desarrollo',
      value: money(dev.outstanding),
      valueClass: dev.outstanding > 0 ? 'text-amber-400' : 'text-emerald-400',
      hint: `${money(dev.invoiced)} facturados a clientes`,
    },
    {
      href: '/panel/leads',
      icon: Users,
      label: 'Leads',
      value: String(leads),
      hint: 'Contactos capturados en el sitio',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Panel</h1>
        <p className="text-slate-400 mt-2">
          Resumen del negocio. El detalle vive en{' '}
          <Link href="/panel/trading" className="text-cyan-400 hover:underline">
            Trading
          </Link>
          .
        </p>
      </div>

      {error && (
        <p className="text-sm text-amber-400 bg-amber-950/40 border border-amber-500/30 rounded-lg px-4 py-3">
          No se pudo leer la base de datos: {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.label}
              href={card.href}
              className="p-6 rounded-2xl bg-slate-900 border border-white/10 hover:border-cyan-500/50 transition-colors"
            >
              <Icon className="w-6 h-6 text-cyan-400 mb-4" />
              <p className="text-slate-400 text-sm">{card.label}</p>
              <p className={`text-2xl font-bold mt-1 ${card.valueClass ?? 'text-white'}`}>
                {card.value}
              </p>
              <p className="text-xs text-slate-500 mt-1">{card.hint}</p>
            </Link>
          )
        })}
      </div>

      <p className="text-xs text-slate-500">
        Resultado operativo acumulado: <span className={pnlClass(pnl)}>{signedMoney(pnl)}</span>
      </p>
    </div>
  )
}
