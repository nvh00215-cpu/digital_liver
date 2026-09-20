import { ACUTE_FAIL_FRAC, CHRONIC_FAIL_LOAD } from './types'
import type { SimResult, VerdictKind } from './types'

export interface Verdict {
  kind: VerdictKind
  label: string
  headline: string
  detail: string
  pathway: 'acute' | 'chronic' | 'both' | 'none'
}

export function judge(result: SimResult): Verdict {
  const {
    fracNecrotic,
    meanFinalZoneDamage,
    meanChronicLoad,
    maxFinalDamage,
    failureType,
  } = result
  const z3First = meanFinalZoneDamage[2] > meanFinalZoneDamage[0] + 0.04
  const acuteToxic =
    fracNecrotic > 0.15 ||
    meanFinalZoneDamage[2] > 0.22 ||
    (maxFinalDamage > 0.45 && z3First)
  const chronicDegeneration = meanChronicLoad > 0.35
  const chronicFail =
    failureType === 'chronic' ||
    failureType === 'both' ||
    meanChronicLoad > CHRONIC_FAIL_LOAD
  const acuteFail =
    failureType === 'acute' ||
    failureType === 'both' ||
    fracNecrotic > ACUTE_FAIL_FRAC

  if (acuteFail && chronicFail) {
    return {
      kind: 'DualFailure',
      label: 'ACUTE + CHRONIC FAILURE',
      headline: 'Both injury pathways crossed their limits',
      detail:
        'Centrilobular necrosis reached the acute tissue-failure cutoff, and cumulative dosing also exhausted regenerative capacity. Two mechanisms, one lattice.',
      pathway: 'both',
    }
  }

  if (acuteFail) {
    return {
      kind: 'AcuteFailure',
      label: 'LIVER FAILURE',
      headline: 'Centrilobular necrosis',
      detail:
        'Necrotic fraction crossed 75%. Zone 3 led; neighbor coupling spread a localized dark wave from damaged lobules — not a uniform fade.',
      pathway: 'acute',
    }
  }

  if (chronicFail) {
    return {
      kind: 'ChronicFailure',
      label: 'CHRONIC LIVER FAILURE',
      headline: 'Cumulative dosing exceeded regenerative capacity',
      detail:
        'Sustained metabolite exposure drove a grid-wide chronic load above 0.6. Repair was suppressed; attrition is diffuse (all zones), not a Zone-3 wave.',
      pathway: 'chronic',
    }
  }

  if (acuteToxic) {
    return {
      kind: 'Toxic',
      label: 'TOXIC',
      headline: z3First
        ? 'Centrilobular necrosis pattern'
        : 'Widespread lobular injury',
      detail: z3First
        ? 'Zone 3 (pericentral) damage leads Zone 1. Neighbor coupling is spreading necrosis across poorly recovering lobules.'
        : 'Tissue damage has crossed the necrotic fraction cutoff for this dose protocol.',
      pathway: 'acute',
    }
  }

  if (chronicDegeneration) {
    return {
      kind: 'Chronic',
      label: 'CHRONIC DEGENERATION',
      headline: 'Diffuse attrition without acute collapse',
      detail:
        'Chronic load is elevated across the lattice. Regeneration is still keeping necrotic fraction below the acute-failure line — a different trajectory from a Zone-3 wave.',
      pathway: 'chronic',
    }
  }

  const safe =
    fracNecrotic < 0.05 &&
    meanFinalZoneDamage[2] < 0.12 &&
    meanChronicLoad < 0.2

  if (safe) {
    return {
      kind: 'Safe',
      label: 'SAFE',
      headline: 'Below injury thresholds',
      detail:
        result.request.dosingPattern === 'repeated'
          ? 'Repeated dosing is cleared with repair keeping pace. Chronic load plateaus instead of drifting to failure.'
          : 'Parent drug is cleared with little Zone-3 metabolite accumulation. Perfusion heterogeneity is visible but necrosis does not spread.',
      pathway: 'none',
    }
  }

  return {
    kind: 'Caution',
    label: 'CAUTION',
    headline: z3First ? 'Early pericentral stress' : 'Borderline tissue stress',
    detail:
      'Load is elevated but neither the acute necrotic-wave cutoff nor chronic regenerative failure has been crossed.',
    pathway: meanChronicLoad > 0.2 ? 'chronic' : 'acute',
  }
}
