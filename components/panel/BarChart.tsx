import { money } from '@/lib/trading-metrics'

export interface BarDatum {
  label: string
  value: number
}

interface Props {
  data: BarDatum[]
  height?: number
  /** Shown when there is nothing to plot. */
  emptyMessage?: string
}

/**
 * Vertical bars for signed values, drawn as server-rendered SVG.
 *
 * Bars grow up from a zero line for gains and down for losses, so a losing day
 * reads as a loss at a glance rather than as a shorter green bar. The zero line
 * sits proportionally: an all-positive series puts it at the bottom.
 */
export default function BarChart({ data, height = 180, emptyMessage }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-8 text-center">
        {emptyMessage ?? 'Sin datos para este periodo.'}
      </p>
    )
  }

  const max = Math.max(0, ...data.map((d) => d.value))
  const min = Math.min(0, ...data.map((d) => d.value))
  const span = max - min || 1

  // Viewport is in arbitrary units; preserveAspectRatio="none" stretches it to
  // the container width so bars always fill the card.
  const barWidth = 10
  const gap = 4
  const width = data.length * (barWidth + gap) - gap
  const zeroY = (max / span) * height

  // Labels get crowded past a couple dozen bars, so only some are drawn. A
  // phone fits about a third of what a desktop card does, so the extra ones are
  // rendered but hidden below `sm` rather than dropped: the same markup serves
  // both widths without measuring the viewport on the server.
  const labelEvery = Math.ceil(data.length / 12)
  const mobileEvery = Math.ceil(data.length / 4)

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="Resultado por periodo"
      >
        <line
          x1="0"
          y1={zeroY}
          x2={width}
          y2={zeroY}
          stroke="currentColor"
          className="text-white/20"
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
        />
        {data.map((d, i) => {
          const x = i * (barWidth + gap)
          const magnitude = (Math.abs(d.value) / span) * height
          const y = d.value >= 0 ? zeroY - magnitude : zeroY
          return (
            <rect
              key={d.label + i}
              x={x}
              // A zero-height rect renders nothing, so flat periods keep a
              // 1-unit sliver to stay visible on the axis.
              y={magnitude < 1 ? zeroY - 0.5 : y}
              width={barWidth}
              height={Math.max(magnitude, 1)}
              rx="1"
              className={d.value >= 0 ? 'fill-emerald-500' : 'fill-red-500'}
            >
              <title>{`${d.label}: ${money(d.value)}`}</title>
            </rect>
          )
        })}
      </svg>

      <div className="flex justify-between gap-1 text-[10px] text-slate-500 font-mono">
        {data
          .map((d, i) => ({ ...d, index: i }))
          .filter((d) => d.index % labelEvery === 0)
          .map((d) => (
            <span
              key={d.label + d.index}
              className={d.index % mobileEvery === 0 ? '' : 'hidden sm:inline'}
            >
              {d.label}
            </span>
          ))}
      </div>
    </div>
  )
}
