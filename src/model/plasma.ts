import type { CompoundParams, DosingPattern } from './types'

/** First-order elimination rate from half-life (1/h). */
export function kelFromHalfLife(halfLifeHours: number): number {
  return Math.LN2 / Math.max(0.35, halfLifeHours)
}

export function bolusDelta(doseMgPerKg: number, compound: CompoundParams): number {
  return (compound.bioavailability * doseMgPerKg) / compound.vdLPerKg
}

export function initialPlasma(
  doseMgPerKg: number,
  compound: CompoundParams,
): number {
  return bolusDelta(doseMgPerKg, compound)
}

/**
 * Clearance-only plasma step. Dosing is applied separately via injectIfDue
 * so Single dose is one bolus at t=0 and Repeated daily re-injects every 24 h.
 */
export function stepPlasma(c: number, compound: CompoundParams, dt: number): number {
  const kel = 0.16 * kelFromHalfLife(compound.halfLifeHours)
  const phase2 = (compound.kPhase2Vmax * c) / (compound.kmPhase2 + c)
  const next = c + dt * (-kel * c - phase2)
  return next < 0 ? 0 : next
}

/** Re-inject the same bolus when simulated time crosses a 24 h boundary. */
export function injectIfDue(
  c: number,
  tHours: number,
  dt: number,
  pattern: DosingPattern,
  bolus: number,
): number {
  if (pattern !== 'repeated') return c
  const prev = tHours - dt
  if (Math.floor(tHours / 24 + 1e-9) > Math.floor(prev / 24 + 1e-9)) {
    return c + bolus
  }
  return c
}
