import {
  ACUTE_FAIL_FRAC,
  CHRONIC_FAIL_HOLD_H,
  CHRONIC_FAIL_LOAD,
  DT,
  GRID_COLS,
  GRID_COUNT,
  GRID_ROWS,
  NECROTIC,
} from './types'
import type { ChartPoint, FailureType, SimFrame, SimRequest, SimResult } from './types'
import { buildNeighborTable, buildPerfusion } from './grid'
import {
  aggregateDamage,
  freshZones,
  meanMetabolite,
  stepChronicLoad,
  stepLobule,
} from './lobuleOde'
import type { ZoneState } from './lobuleOde'
import { bolusDelta, initialPlasma, injectIfDue, stepPlasma } from './plasma'

let neighborCache: number[][] | null = null

function neighbors(): number[][] {
  neighborCache ??= buildNeighborTable()
  return neighborCache
}

/** Fewer stored frames on long horizons; dt itself stays fixed. */
export function frameStrideHours(horizonHours: number): number {
  if (horizonHours <= 96) return 0.5
  if (horizonHours <= 336) return 2
  return 6
}

export function simulate(request: SimRequest): SimResult {
  const { compound, doseMgPerKg, horizonHours, dosingPattern, seed } = request
  const perfusion = buildPerfusion(seed)
  const nbrs = neighbors()
  const lobules: [ZoneState, ZoneState, ZoneState][] = Array.from(
    { length: GRID_COUNT },
    () => freshZones(),
  )
  const chronic = new Float32Array(GRID_COUNT)
  const emaM = new Float32Array(GRID_COUNT)
  const bolus = bolusDelta(doseMgPerKg, compound)

  let plasma = initialPlasma(doseMgPerKg, compound)
  const damages = new Float32Array(GRID_COUNT)
  const frames: SimFrame[] = []
  const series: ChartPoint[] = []
  const stress = new Float32Array(GRID_COUNT)

  let peakZone3Metabolite = 0
  let timeAbove = 0
  let timeChronicHigh = 0
  let consecutiveChronicHigh = 0
  let failedAt: number | null = null
  let failureType: FailureType = null
  const stride = frameStrideHours(horizonHours)
  let lastSample = -stride

  const snapshot = (t: number) => {
    const damage = new Float32Array(GRID_COUNT)
    const zoneDamage = new Float32Array(GRID_COUNT * 3)
    const chronicLoad = new Float32Array(GRID_COUNT)
    let c1 = 0
    let c3 = 0
    let m1 = 0
    let m3 = 0
    let d1 = 0
    let d3 = 0
    let meanD = 0
    let meanC = 0
    for (let i = 0; i < GRID_COUNT; i++) {
      const z = lobules[i]
      const d = damages[i]
      damage[i] = d
      chronicLoad[i] = chronic[i]
      zoneDamage[i * 3] = z[0].d
      zoneDamage[i * 3 + 1] = z[1].d
      zoneDamage[i * 3 + 2] = z[2].d
      c1 += z[0].c
      c3 += z[2].c
      m1 += z[0].m
      m3 += z[2].m
      d1 += z[0].d
      d3 += z[2].d
      meanD += d
      meanC += chronic[i]
    }
    const n = GRID_COUNT
    frames.push({ t, damage, zoneDamage, chronicLoad })
    series.push({
      t,
      plasma,
      zone1C: c1 / n,
      zone3C: c3 / n,
      zone1M: m1 / n,
      zone3M: m3 / n,
      zone1D: d1 / n,
      zone3D: d3 / n,
      meanDamage: meanD / n,
      meanChronic: meanC / n,
    })
  }

  snapshot(0)

  const steps = Math.round(horizonHours / DT)
  for (let s = 1; s <= steps; s++) {
    const t = s * DT
    plasma = injectIfDue(plasma, t, DT, dosingPattern, bolus)
    for (let i = 0; i < GRID_COUNT; i++) {
      const list = nbrs[i]
      let acc = 0
      for (const j of list) acc += Math.max(0, damages[j] - 0.4)
      stress[i] = compound.kNeighbor * (acc / Math.max(1, list.length))
    }

    let meanM3 = 0
    let meanL = 0
    let necrotic = 0
    for (let i = 0; i < GRID_COUNT; i++) {
      const z = lobules[i]
      const instantM = meanMetabolite(z)
      const nextC = stepChronicLoad(chronic[i], emaM[i], instantM, DT)
      chronic[i] = nextC.load
      emaM[i] = nextC.emaM
      const inlet = perfusion[i] * plasma
      stepLobule(z, inlet, stress[i], perfusion[i], chronic[i], compound, DT)
      damages[i] = aggregateDamage(z)
      meanM3 += z[2].m
      meanL += chronic[i]
      if (damages[i] > NECROTIC) necrotic++
    }
    meanM3 /= GRID_COUNT
    meanL /= GRID_COUNT
    const fracN = necrotic / GRID_COUNT
    if (meanM3 > peakZone3Metabolite) peakZone3Metabolite = meanM3
    if (meanM3 > compound.metaboliteThreshold) timeAbove += DT

    if (meanL > CHRONIC_FAIL_LOAD) {
      consecutiveChronicHigh += DT
      timeChronicHigh += DT
    } else {
      consecutiveChronicHigh = 0
    }

    const acuteHit = fracN > ACUTE_FAIL_FRAC
    const chronicHit = consecutiveChronicHigh >= CHRONIC_FAIL_HOLD_H
    if (acuteHit || chronicHit) {
      failedAt = t
      failureType = acuteHit && chronicHit ? 'both' : acuteHit ? 'acute' : 'chronic'
    }

    plasma = stepPlasma(plasma, compound, DT)

    if (t - lastSample >= stride - 1e-9 || s === steps || failedAt !== null) {
      snapshot(t)
      lastSample = t
    }

    if (failedAt !== null) break
  }

  const last = frames[frames.length - 1]
  let necrotic = 0
  let hottest = 0
  let hottestD = -1
  let meanFinal = 0
  let meanL = 0
  const meanZ: [number, number, number] = [0, 0, 0]
  for (let i = 0; i < GRID_COUNT; i++) {
    const d = last.damage[i]
    meanFinal += d
    meanL += last.chronicLoad[i]
    if (d > NECROTIC) necrotic++
    if (d > hottestD) {
      hottestD = d
      hottest = i
    }
    meanZ[0] += last.zoneDamage[i * 3]
    meanZ[1] += last.zoneDamage[i * 3 + 1]
    meanZ[2] += last.zoneDamage[i * 3 + 2]
  }
  meanFinal /= GRID_COUNT
  meanL /= GRID_COUNT
  meanZ[0] /= GRID_COUNT
  meanZ[1] /= GRID_COUNT
  meanZ[2] /= GRID_COUNT

  return {
    request,
    cols: GRID_COLS,
    rows: GRID_ROWS,
    perfusion,
    frames,
    series,
    peakZone3Metabolite,
    timeAboveThresholdHours: timeAbove,
    fracNecrotic: necrotic / GRID_COUNT,
    meanFinalDamage: meanFinal,
    maxFinalDamage: hottestD,
    meanFinalZoneDamage: meanZ,
    meanChronicLoad: meanL,
    timeChronicHighHours: timeChronicHigh,
    hottestIndex: hottest,
    failedAt,
    failureType,
    dt: DT,
  }
}
