import { GRID_COLS } from '../model/types'
import { damageToCss } from '../model/color'

interface SelectedLobuleProps {
  index: number
  zoneDamage: [number, number, number] | null
}

function hexPath(cx: number, cy: number, size: number): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i)
    pts.push(`${cx + size * Math.cos(a)},${cy + size * Math.sin(a)}`)
  }
  return pts.join(' ')
}

export function SelectedLobule({ index, zoneDamage }: SelectedLobuleProps) {
  const d = zoneDamage ?? [0.08, 0.1, 0.12]
  const col = index % GRID_COLS
  const row = Math.floor(index / GRID_COLS)
  return (
    <aside className="inset">
      <h3>
        Selected lobule · ({col}, {row})
      </h3>
      <svg viewBox="0 0 160 150" width="180" height="168">
        <polygon points={hexPath(80, 78, 64)} fill={damageToCss(d[0])} stroke="#fff" strokeWidth="1" />
        <polygon points={hexPath(80, 78, 42)} fill={damageToCss(d[1])} stroke="#fff" strokeWidth="1" />
        <polygon points={hexPath(80, 78, 22)} fill={damageToCss(d[2])} stroke="#fff" strokeWidth="1" />
        <text x="80" y="18" textAnchor="middle" fontSize="10" fill="#6b7280">
          Z1 periportal
        </text>
        <text x="80" y="82" textAnchor="middle" fontSize="9" fill="#111318">
          Z3
        </text>
        <text x="80" y="144" textAnchor="middle" fontSize="10" fill="#6b7280">
          pericentral
        </text>
      </svg>
      <p>
        Zonation is inside every lobule. Zone 3 (center) dies first in CYP-activated injury.
        D1 {(d[0] * 100).toFixed(0)}% · D2 {(d[1] * 100).toFixed(0)}% · D3 {(d[2] * 100).toFixed(0)}%
      </p>
    </aside>
  )
}
