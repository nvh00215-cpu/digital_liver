import { GRID_COLS, GRID_ROWS } from './types'

/** even-q (flat-top): odd columns shifted down. */
const EVEN_Q_EVEN: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [-1, -1],
]

const EVEN_Q_ODD: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
]

export function idx(col: number, row: number): number {
  return row * GRID_COLS + col
}

export function colOf(i: number): number {
  return i % GRID_COLS
}

export function rowOf(i: number): number {
  return Math.floor(i / GRID_COLS)
}

export function neighborsOf(i: number): number[] {
  const c = colOf(i)
  const r = rowOf(i)
  const dirs = c & 1 ? EVEN_Q_ODD : EVEN_Q_EVEN
  const out: number[] = []
  for (const [dc, dr] of dirs) {
    const nc = c + dc
    const nr = r + dr
    if (nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS) {
      out.push(idx(nc, nr))
    }
  }
  return out
}

export function buildNeighborTable(): number[][] {
  const table: number[][] = new Array(GRID_COLS * GRID_ROWS)
  for (let i = 0; i < table.length; i++) table[i] = neighborsOf(i)
  return table
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Smooth perfusion field so exposure is spatially heterogeneous. */
export function buildPerfusion(seed = 42): Float32Array {
  const rand = mulberry32(seed)
  const gw = 8
  const gh = 6
  const knots: number[] = []
  for (let i = 0; i < gw * gh; i++) knots.push(rand())

  const field = new Float32Array(GRID_COLS * GRID_ROWS)
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const u = (c / (GRID_COLS - 1)) * (gw - 1)
      const v = (r / (GRID_ROWS - 1)) * (gh - 1)
      const c0 = Math.floor(u)
      const r0 = Math.floor(v)
      const c1 = Math.min(gw - 1, c0 + 1)
      const r1 = Math.min(gh - 1, r0 + 1)
      const fu = u - c0
      const fv = v - r0
      const a = knots[r0 * gw + c0]
      const b = knots[r0 * gw + c1]
      const cc = knots[r1 * gw + c0]
      const d = knots[r1 * gw + c1]
      const s =
        a * (1 - fu) * (1 - fv) +
        b * fu * (1 - fv) +
        cc * (1 - fu) * fv +
        d * fu * fv
      field[idx(c, r)] = 0.32 + 1.35 * s
    }
  }
  return field
}

export function hexCenter(
  col: number,
  row: number,
  size: number,
): { x: number; y: number } {
  const x = size * 1.5 * col
  const y = size * Math.sqrt(3) * (row + 0.5 * (col & 1))
  return { x, y }
}

export function hexCorners(cx: number, cy: number, size: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i)
    pts.push({
      x: cx + size * Math.cos(angle),
      y: cy + size * Math.sin(angle),
    })
  }
  return pts
}

export function gridPixelSize(size: number): { width: number; height: number } {
  const width = size * 1.5 * (GRID_COLS - 1) + 2 * size
  const height = size * Math.sqrt(3) * (GRID_ROWS + 0.5)
  return { width, height }
}
