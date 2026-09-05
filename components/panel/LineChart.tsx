import { money } from '@/lib/trading-metrics'

export interface LinePoint {
  label: string
  value: number
}

interface Props {
  data: LinePoint[]
  height?: number
  emptyMessage?: string
  /** Draws a dashed reference line, typically at zero or at starting capital. */
  reference?: number
}

/**
 * Cumulative curve as server-rendered SVG, with the area under it filled.
 *
 * The stroke and fill turn red when the series ends below the reference, so a
 * losing run is obvious without reading the axis.
 */
export default function LineChart({ data, height = 200, emptyMessage, reference }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-8 text-center">
        {emptyMessage ?? 'Sin datos para este periodo.'}
      </p>
    )
  }

  const width = 300
  const values = data.map((d) => d.value)
  const candidates = reference === undefined ? values : [...values, reference]
  let max = Math.max(...candidates)
  let min = Math.min(...candidates)

  // A flat series would divide by zero; pad it so the line sits mid-height.
  if (max === min) {
    max += 1
    min -= 1
  }
  const span = max - min

  // A single point has no segment to draw, so it is pinned to the right edge
  // and shown as a dot below.
  const x = (i: number) => (data.length === 1 ? width : (i / (data.length - 1)) * width)
  const y = (v: number) => height - ((v - min) / span) * height

  const points = data.map((d, i) => `${x(i).toFixed(2)},${y(d.value).toFixed(2)}`)
  const last = data[data.length - 1].value
  const positive = reference === undefined ? last >= 0 : last >= reference
  const stroke = positive ? 'stroke-emerald-400' : 'stroke-red-400'
  const fill = positive ? 'fill-emerald-500/10' : 'fill-red-500/10'

  const areaPath = `M ${x(0).toFixed(2)},${height} L ${points.join(' L ')} L ${x(
    data.length - 1
  ).toFixed(2)},${height} Z`

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="Curva acumulada"
      >
        {reference !== undefined && (
          <line
            x1="0"
            y1={y(reference)}
            x2={width}
            y2={y(reference)}
            stroke="currentColor"
            className="text-white/20"
            strokeWidth="1"
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {data.length > 1 && <path d={areaPath} className={fill} />}

        <polyline
          points={points.join(' ')}
          fill="none"
          className={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        <circle
          cx={x(data.length - 1)}
          cy={y(last)}
          r="3"
          className={positive ? 'fill-emerald-400' : 'fill-red-400'}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="flex justify-between gap-2 text-[10px] text-slate-500 font-mono">
        <span className="truncate">{data[0].label}</span>
        <span
          className={`whitespace-nowrap ${positive ? 'text-emerald-400' : 'text-red-400'}`}
        >
          {money(last)}
        </span>
        {data.length > 1 && <span className="truncate">{data[data.length - 1].label}</span>}
      </div>
    </div>
  )
}
