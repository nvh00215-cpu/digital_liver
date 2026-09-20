import type { Verdict } from '../model/verdict'

interface VerdictCardProps {
  verdict: Verdict | null
  peakZone3: number
  timeAbove: number
  fracNecrotic: number
  meanChronic: number
  threshold: number
  failedAt: number | null
  failureType: string | null
}

export function VerdictCard({
  verdict,
  peakZone3,
  timeAbove,
  fracNecrotic,
  meanChronic,
  threshold,
  failedAt,
  failureType,
}: VerdictCardProps) {
  return (
    <section className="card verdict">
      <div className="card-title">
        <span className="icon-chip">▣</span>
        Verdict
      </div>
      {verdict ? (
        <>
          <div className={`verdict-kind ${verdict.kind}`}>{verdict.label}</div>
          <p className="pathway-tag">{pathwayTag(verdict.pathway)}</p>
          <h3>{verdict.headline}</h3>
          <p>{verdict.detail}</p>
          <div className="metrics">
            <div className="metric">
              <span>Peak Zone 3 metabolite</span>
              <strong>{peakZone3.toFixed(2)}</strong>
            </div>
            <div className="metric">
              <span>Threshold</span>
              <strong>{threshold.toFixed(2)}</strong>
            </div>
            <div className="metric">
              <span>Time above threshold</span>
              <strong>{timeAbove.toFixed(1)} h</strong>
            </div>
            <div className="metric">
              <span>Acute necrotic fraction</span>
              <strong>{(fracNecrotic * 100).toFixed(1)}%</strong>
            </div>
            <div className="metric">
              <span>Mean chronic load</span>
              <strong>{meanChronic.toFixed(2)}</strong>
            </div>
            <div className="metric">
              <span>Early stop</span>
              <strong>
                {failedAt !== null
                  ? `${failureType} @ ${failedAt.toFixed(0)} h`
                  : 'none'}
              </strong>
            </div>
          </div>
        </>
      ) : (
        <p className="muted">Run a simulation to score acute vs chronic pathways.</p>
      )}
    </section>
  )
}

function pathwayTag(pathway: Verdict['pathway']): string {
  if (pathway === 'acute') return 'Pathway: acute centrilobular necrosis'
  if (pathway === 'chronic') return 'Pathway: diffuse chronic degeneration'
  if (pathway === 'both') return 'Pathway: acute wave + chronic attrition'
  return 'Pathway: neither injury threshold crossed'
}
