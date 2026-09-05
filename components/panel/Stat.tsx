interface Props {
  label: string
  value: string
  /** Small line under the value: context, not decoration. */
  hint?: string
  /** Tailwind text colour for the value, e.g. from pnlClass(). */
  valueClass?: string
}

/** One KPI tile. Kept dumb so the pages decide colour and formatting. */
export default function Stat({ label, value, hint, valueClass }: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-2xl font-bold mt-2 ${valueClass ?? 'text-white'}`}>{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}
