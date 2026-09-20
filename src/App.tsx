import { useEffect, useMemo, useState } from 'react'
import { Header } from './components/Header'
import { DosePanel } from './components/DosePanel'
import { LobuleGrid } from './components/LobuleGrid'
import { SelectedLobule } from './components/SelectedLobule'
import { VerdictCard } from './components/VerdictCard'
import { ZoneChart } from './components/ZoneChart'
import { Limitations } from './components/Limitations'
import { Roadmap } from './components/Roadmap'
import { COMPOUNDS, DEFAULT_CUSTOM, customToCompound, doseForMode } from './model/compounds'
import { simulate } from './model/simulate'
import { judge } from './model/verdict'
import { parseHorizonDays } from './model/horizon'
import type {
  CompoundId,
  CustomOverrides,
  DoseMode,
  DosingPattern,
  SimResult,
} from './model/types'
import './styles/tokens.css'
import './styles/dashboard.css'

export default function App() {
  const [compoundId, setCompoundId] = useState<CompoundId>('acetaminophen')
  const [custom, setCustom] = useState<CustomOverrides>(DEFAULT_CUSTOM)
  const [doseMode, setDoseMode] = useState<DoseMode>('therapeutic')
  const [doseMgPerKg, setDoseMgPerKg] = useState(
    doseForMode(COMPOUNDS.acetaminophen, 'therapeutic'),
  )
  const [weightKg, setWeightKg] = useState(70)
  const [horizonDaysText, setHorizonDaysText] = useState('3')
  const [dosingPattern, setDosingPattern] = useState<DosingPattern>('single')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SimResult | null>(null)
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [selected, setSelected] = useState(0)
  const [view, setView] = useState<'grid' | 'charts'>('grid')

  const compound = useMemo(() => {
    if (compoundId === 'custom') return customToCompound(custom)
    return COMPOUNDS[compoundId]
  }, [compoundId, custom])

  useEffect(() => {
    const c = compoundId === 'custom' ? customToCompound(custom) : COMPOUNDS[compoundId]
    setDoseMgPerKg(doseForMode(c, doseMode))
  }, [compoundId, doseMode])

  useEffect(() => {
    if (!playing || !result) return
    if (frame >= result.frames.length - 1) {
      setPlaying(false)
      return
    }
    const id = window.setTimeout(() => setFrame((f) => f + 1), 55)
    return () => window.clearTimeout(id)
  }, [playing, frame, result])

  const current = result?.frames[Math.min(frame, (result?.frames.length ?? 1) - 1)]
  const zoneDamage: [number, number, number] | null = current
    ? [
        current.zoneDamage[selected * 3],
        current.zoneDamage[selected * 3 + 1],
        current.zoneDamage[selected * 3 + 2],
      ]
    : null

  const atFailure = Boolean(
    result?.failedAt != null && current && current.t + 1e-4 >= result.failedAt,
  )

  useEffect(() => {
    if (atFailure) setPlaying(false)
  }, [atFailure])

  const verdict = result ? judge(result) : null
  const caption = 'Each hex = one lobule. Color = aggregated damage. Necrosis can spread to neighbors.'

  function run() {
    const parsed = parseHorizonDays(horizonDaysText)
    if (!parsed.ok) return
    setRunning(true)
    setPlaying(false)
    window.setTimeout(() => {
      const next = simulate({
        compound,
        doseMgPerKg,
        weightKg,
        horizonHours: parsed.days * 24,
        dosingPattern,
        seed: 42,
      })
      setResult(next)
      setSelected(next.hottestIndex)
      setFrame(0)
      setPlaying(true)
      setRunning(false)
    }, 30)
  }

  function reset() {
    setCompoundId('acetaminophen')
    setCustom(DEFAULT_CUSTOM)
    setDoseMode('therapeutic')
    setDoseMgPerKg(doseForMode(COMPOUNDS.acetaminophen, 'therapeutic'))
    setWeightKg(70)
    setHorizonDaysText('3')
    setDosingPattern('single')
    setResult(null)
    setFrame(0)
    setPlaying(false)
    setSelected(0)
  }

  function exportReport() {
    if (!result || !verdict) return
    const days = (result.request.horizonHours / 24).toFixed(0)
    const lines = [
      'Digital Liver — lobule-scale triage report',
      `Compound: ${compound.name}`,
      `Dose: ${doseMgPerKg.toFixed(1)} mg/kg · ${weightKg} kg · ${days} d · ${result.request.dosingPattern}`,
      `Verdict: ${verdict.label} — ${verdict.headline}`,
      `Pathway: ${verdict.pathway}`,
      verdict.detail,
      `Peak Zone 3 metabolite: ${result.peakZone3Metabolite.toFixed(3)}`,
      `Time above threshold: ${result.timeAboveThresholdHours.toFixed(2)} h`,
      `Necrotic fraction: ${(result.fracNecrotic * 100).toFixed(1)}%`,
      `Mean chronic load: ${result.meanChronicLoad.toFixed(3)}`,
      `Failure: ${result.failureType ?? 'none'}${result.failedAt !== null ? ` at ${result.failedAt.toFixed(1)} h` : ''}`,
      `Final mean zone damage Z1/Z2/Z3: ${result.meanFinalZoneDamage.map((x) => x.toFixed(3)).join(' / ')}`,
      '',
      'Prototype only. Not for diagnostic or clinical use.',
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'digital-liver-report.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="shell">
      <Header onExport={exportReport} canExport={Boolean(result)} />
      <div className="layout">
        <DosePanel
          compoundId={compoundId}
          custom={custom}
          doseMode={doseMode}
          doseMgPerKg={doseMgPerKg}
          weightKg={weightKg}
          horizonDaysText={horizonDaysText}
          dosingPattern={dosingPattern}
          running={running}
          onCompound={setCompoundId}
          onCustom={setCustom}
          onDoseMode={setDoseMode}
          onDose={setDoseMgPerKg}
          onWeight={setWeightKg}
          onHorizonDaysText={setHorizonDaysText}
          onDosingPattern={setDosingPattern}
          onRun={run}
          onReset={reset}
        />

        <section className="card focal">
          <div className="card-title">
            <span className="icon-chip">⬡</span>
            Hepatic lobule lattice
          </div>
          {view === 'grid' && (
            <div className="focal-canvas-wrap">
              <LobuleGrid
                damage={current?.damage ?? null}
                chronicLoad={current?.chronicLoad ?? null}
                selected={selected}
                caption={caption}
                onSelect={setSelected}
              />
              <SelectedLobule index={selected} zoneDamage={zoneDamage} />
            </div>
          )}
          {view === 'charts' && (
            <div className="focal-canvas-wrap" style={{ padding: '8px 8px 0' }}>
              {result ? (
                <ZoneChart series={result.series} />
              ) : (
                <div className="empty">Run a simulation to plot Zone 1 vs Zone 3.</div>
              )}
            </div>
          )}
          {result && (
            <div className="scrubber">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setPlaying((p) => !p)}
                disabled={atFailure && frame >= (result.frames.length - 1)}
              >
                {playing ? 'Pause' : 'Play'}
              </button>
              <input
                type="range"
                min={0}
                max={Math.max(0, result.frames.length - 1)}
                value={frame}
                onChange={(e) => {
                  setPlaying(false)
                  setFrame(Number(e.target.value))
                }}
              />
              <span className="muted">{current ? `${current.t.toFixed(1)} h` : ''}</span>
            </div>
          )}
          <div className="toggle">
            <button type="button" className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>
              Grid View
            </button>
            <button
              type="button"
              className={view === 'charts' ? 'active' : ''}
              onClick={() => setView('charts')}
            >
              Charts
            </button>
          </div>
        </section>

        <div className="stack">
          <VerdictCard
            verdict={verdict}
            peakZone3={result?.peakZone3Metabolite ?? 0}
            timeAbove={result?.timeAboveThresholdHours ?? 0}
            fracNecrotic={result?.fracNecrotic ?? 0}
            meanChronic={result?.meanChronicLoad ?? 0}
            threshold={compound.metaboliteThreshold}
            failedAt={result?.failedAt ?? null}
            failureType={result?.failureType ?? null}
          />
          <section className="card">
            <div className="card-title">
              <span className="icon-chip">∿</span>
              Zonal concentration
            </div>
            {result ? <ZoneChart series={result.series} /> : <p className="muted">Awaiting run.</p>}
            <p className="note">
              Perfusion heterogeneity · Neighbor coupling (acute) · Chronic EMA load
              {dosingPattern === 'repeated' ? ' · Daily bolus (plasma sawtooth)' : ''}
            </p>
          </section>
          <Roadmap />
        </div>
      </div>
      <Limitations />
    </div>
  )
}
