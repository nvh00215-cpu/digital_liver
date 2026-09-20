/**
 * Three-zone lobule ODE (explicit Euler) plus a slow chronic-load state.
 *
 * Acute path: parent flows Z1 → Z2 → Z3; CYP / injury is pericentral.
 * Neighbor stress on Zone 3 only — that is the localized necrosis wave.
 *
 * Chronic path: a per-lobule load driven by a 24 h EMA of metabolite, not
 * spikes. Above 0.5 it raises an equal damage floor in all three zones
 * (diffuse attrition) and suppresses regeneration.
 */
import { CYP, GSH0, OXYGEN } from './types'
import type { CompoundParams } from './types'

export const K_REGEN = 0.055
export const K_CHRONIC = 0.13
export const K_CHRONIC_RECOVER = 0.0016
export const CHRONIC_EMA_HOURS = 24
export const CHRONIC_FLOOR_ON = 0.5
export const K_CHRONIC_FLOOR = 0.4

export interface ZoneState {
  c: number
  m: number
  g: number
  d: number
}

export function freshZones(): [ZoneState, ZoneState, ZoneState] {
  return [
    { c: 0, m: 0, g: GSH0[0], d: 0 },
    { c: 0, m: 0, g: GSH0[1], d: 0 },
    { c: 0, m: 0, g: GSH0[2], d: 0 },
  ]
}

function clamp01(x: number): number {
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

export function meanMetabolite(zones: [ZoneState, ZoneState, ZoneState]): number {
  return (zones[0].m + zones[1].m + zones[2].m) / 3
}

/** EMA of metabolite (~24 h window) plus chronic load recovery/accumulation. */
export function stepChronicLoad(
  load: number,
  emaM: number,
  instantMeanM: number,
  dt: number,
): { load: number; emaM: number } {
  const alpha = 1 - Math.exp(-dt / CHRONIC_EMA_HOURS)
  const nextEma = emaM + alpha * (instantMeanM - emaM)
  // Saturating accumulation: dL/dt = k M (1-L) - k_r L. A single bolus
  // EMA collapses and load decays; daily dosing holds EMA up.
  const dL = K_CHRONIC * nextEma * (1 - load) - K_CHRONIC_RECOVER * load
  return { load: clamp01(load + dt * dL), emaM: Math.max(0, nextEma) }
}

export function stepLobule(
  zones: [ZoneState, ZoneState, ZoneState],
  inlet: number,
  neighborStress: number,
  perfusion: number,
  chronicLoad: number,
  p: CompoundParams,
  dt: number,
): void {
  const k = p.kFlow
  const c0 = zones[0].c
  const c1 = zones[1].c
  const inflows = [k * inlet, k * c0, k * c1]
  const damageFloor =
    chronicLoad > CHRONIC_FLOOR_ON
      ? (K_CHRONIC_FLOOR * (chronicLoad - CHRONIC_FLOOR_ON)) / (1 - CHRONIC_FLOOR_ON)
      : 0

  let nc0 = 0
  let nm0 = 0
  let ng0 = 0
  let nd0 = 0
  let nc1 = 0
  let nm1 = 0
  let ng1 = 0
  let nd1 = 0
  let nc2 = 0
  let nm2 = 0
  let ng2 = 0
  let nd2 = 0

  for (let z = 0; z < 3; z++) {
    const prev = zones[z]
    const outflow = k * prev.c
    const bio = (p.kCyp * CYP[z] * prev.c) / (p.km + prev.c + 1e-9)
    const detox = p.kDetox * prev.g * prev.m
    const dc = inflows[z] - outflow - bio
    const dm = bio - detox - p.kMClear * prev.m
    const dg = -p.kGUse * prev.m * prev.g + p.kGSyn * (GSH0[z] - prev.g)
    const hypoxia = 1.2 - OXYGEN[z]
    const perfScale = 0.2 + 0.9 * Math.max(0.15, Math.min(1.8, perfusion))
    const extra = z === 2 ? neighborStress : 0
    const excess = Math.max(0, prev.m - 0.045)
    const regen = K_REGEN * prev.d * (1 - chronicLoad)
    const dd =
      p.kDmg * excess * (1 - prev.d) * hypoxia * perfScale + extra - regen
    const nc = Math.max(0, prev.c + dt * dc)
    const nm = Math.max(0, prev.m + dt * dm)
    const ng = clamp01(prev.g + dt * dg)
    const nd = clamp01(Math.max(prev.d + dt * dd, damageFloor))
    if (z === 0) {
      nc0 = nc
      nm0 = nm
      ng0 = ng
      nd0 = nd
    } else if (z === 1) {
      nc1 = nc
      nm1 = nm
      ng1 = ng
      nd1 = nd
    } else {
      nc2 = nc
      nm2 = nm
      ng2 = ng
      nd2 = nd
    }
  }

  zones[0].c = nc0
  zones[0].m = nm0
  zones[0].g = ng0
  zones[0].d = nd0
  zones[1].c = nc1
  zones[1].m = nm1
  zones[1].g = ng1
  zones[1].d = nd1
  zones[2].c = nc2
  zones[2].m = nm2
  zones[2].g = ng2
  zones[2].d = nd2
}

/** Display damage: Zone 3 weighted so centrilobular injury reads on the hex. */
export function aggregateDamage(zones: [ZoneState, ZoneState, ZoneState]): number {
  return 0.15 * zones[0].d + 0.25 * zones[1].d + 0.6 * zones[2].d
}
