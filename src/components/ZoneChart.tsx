import type { ChartPoint } from '../model/types'

interface ZoneChartProps {
  series: ChartPoint[]
}

export function ZoneChart({ series }: ZoneChartProps) {
  const w = 280
  const h = 180
  const pad = { l: 36, r: 8, t: 16, b: 36 }
  const innerW = w - pad.l - pad.r
  const innerH = h - pad.t - pad.b

  if (series.length < 2) {
    return <p className="muted">Zone 1 vs Zone 3 parent-drug concentration will plot here.</p>
  }

  const tMax = series[series.length - 1].t || 1
  const yMax = Math.max(
    0.08,
    ...series.map((p) => Math.max(p.plasma, p.zone1C, p.zone3C)),
  )

  const x = (t: number) => pad.l + (t / tMax) * innerW
  const y = (v: number) => pad.t + innerH - (v / yMax) * innerH

  const path = (key: 'plasma' | 'zone1C' | 'zone3C') =>
    series
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.t).toFixed(1)} ${y(p[key]).toFixed(1)}`)
      .join(' ')

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" role="img" aria-label="Zonal concentration">
        {[0, 0.5, 1].map((g) => {
          const yy = pad.t + innerH * (1 - g)
          return (
            <g key={g}>
              <line x1={pad.l} x2={w - pad.r} y1={yy} y2={yy} stroke="#e5e9f0" />
              <text x={4} y={yy + 4} fontSize="9" fill="#9ca3af">
                {(yMax * g).toFixed(2)}
              </text>
            </g>
          )
        })}
        <path d={path('plasma')} fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d={path('zone1C')} fill="none" stroke="#2f6fed" strokeWidth="2" />
        <path d={path('zone3C')} fill="none" stroke="#ef4444" strokeWidth="2" />
        <text x={pad.l} y={h - 20} fontSize="9" fill="#9ca3af">
          Plasma
        </text>
        <text x={pad.l} y={h - 8} fontSize="10" fill="#2f6fed">
          Zone 1
        </text>
        <text x={w - 8} y={h - 8} fontSize="10" fill="#ef4444" textAnchor="end">
          Zone 3
        </text>
      </svg>
    </div>
  )
}
