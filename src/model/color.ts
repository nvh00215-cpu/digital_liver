function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function hexRgb(hex: string): [number, number, number] {
  const n = hex.replace('#', '')
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ]
}

function rgb([r, g, b]: [number, number, number]): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

const HEALTHY = hexRgb('#f3c4b8')
const STRESSED = hexRgb('#e08a3c')
const NECROTIC = hexRgb('#1a080a')
const CHRONIC_BROWN = hexRgb('#8a5a32')

export function damageToCss(d: number): string {
  const x = Math.min(1, Math.max(0, d))
  const [from, to, t] =
    x < 0.45
      ? [HEALTHY, STRESSED, x / 0.45]
      : [STRESSED, NECROTIC, (x - 0.45) / 0.55]
  return rgb([
    lerp(from[0], to[0], t),
    lerp(from[1], to[1], t),
    lerp(from[2], to[2], t),
  ])
}

/** Acute necrosis is a dark solid; chronic load is a dull brown with hatch. */
export function tissueFill(
  acute: number,
  chronic: number,
): { fill: string; hatch: boolean } {
  const c = Math.min(1, Math.max(0, chronic))
  const a = Math.min(1, Math.max(0, acute))
  const dull: [number, number, number] = [
    lerp(HEALTHY[0], CHRONIC_BROWN[0], c),
    lerp(HEALTHY[1], CHRONIC_BROWN[1], c),
    lerp(HEALTHY[2], CHRONIC_BROWN[2], c),
  ]
  const [from, to, t] =
    a < 0.45 ? [dull, STRESSED, a / 0.45] : [STRESSED, NECROTIC, (a - 0.45) / 0.55]
  return {
    fill: rgb([lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t)]),
    hatch: c > 0.22,
  }
}
