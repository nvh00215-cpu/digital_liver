# Digital Liver

Lobule-scale tissue model for **preclinical dose triage**.

Each agent is one hepatic **lobule** with an internal Zone 1 → Zone 2 → Zone 3 gradient. Two injury pathways:

- **Acute** — CYP-driven **Zone 3** damage, then a **localized necrotic wave** via neighbor coupling.
- **Chronic** — a slow **chronic_load** from sustained metabolite exposure. It dulls the whole lattice (amber/brown + hatch), suppresses repair, and can fail without a Zone-3 wave.

This is organ one of a planned digital-human pipeline — not a diagnostic, not a trial replacement.

## Problem

Drug candidates often fail on liver safety after large spend. A spatial screen that shows *where* and *how* injury starts (centrilobular wave vs diffuse attrition) is more useful than a single health percentage.

## What a lobule and a zone are

A classic lobule is a hexagonal functional unit: portal triads at the corners, central vein in the middle. Blood flows inward.

| Zone | Location | This model |
|---|---|---|
| Zone 1 | Periportal | High oxygen, lower CYP |
| Zone 2 | Midzonal | Transition |
| Zone 3 | Pericentral | Low oxygen, higher CYP — APAP-type **acute** injury starts here |

**Every hex contains all three zones.** The grid is *not* “portal lobules vs central lobules.”

A lobule has on the order of 10⁵ hepatocytes. The agent is a functional unit, not a cell.

## Macro vs micro

1. **Plasma** — one-compartment PK. **Single dose** = one bolus at t = 0. **Repeated daily dose** = the same bolus every 24 h (plasma sawtooth).
2. **Micro** — 3-zone ODE per lobule (`src/model/lobuleOde.ts`) plus a per-lobule `chronic_load` (24 h EMA of metabolite). Repair `k_regen * D * (1 - chronic_load)` lets safe daily dosing plateau.
3. **Macro** — 24×32 hex agents, perfusion field, neighbor stress **only on the acute Zone-3 path**.

Horizon is entered in **days** (1–30), converted to hours internally. Time step stays 0.1 h; long runs store fewer frames.

## How to run

```bash
npm install
npm run dev
```

Open the local URL Vite prints. Click **Run Simulation**.

### Demo stories

| # | Protocol | Expect |
|---|---|---|
| 1 | Acetaminophen, therapeutic, **single**, 3 days | Pink lattice, **Safe**. No hatch wave. |
| 2 | Acetaminophen, **high**, single, 3 days | Zone 3 first, **localized dark wave**, **Toxic** / acute pattern. |
| 3 | Custom, tiny dose, high threshold, single, 3 days | **Safe**. |
| 4 | Custom, huge dose, low threshold, single, 3 days | **Toxic** / acute failure pattern. |
| 5a | Acetaminophen, **therapeutic**, **repeated daily**, **30 days** | No Zone-3 wave. Chronic load rises then **plateaus** below 0.6 → **CHRONIC DEGENERATION** (repair keeps pace; not failure). |
| 5b | Acetaminophen, **~32 mg/kg** (between therapeutic and high), **repeated daily**, **30 days** | Still no acute CYP-saturating wave, but chronic load crosses 0.6 → **CHRONIC LIVER FAILURE** (diffuse brown/hatch, not a point-source wave). |

5a vs 5b is the point of regeneration: the same daily mechanism, two outcomes depending on whether repair keeps up.

Click a hex for the Z1/Z2/Z3 inset. Solid dark = acute necrosis; hatch/brown = chronic load.

## Limitations

Simplified spatial prototype. Parameters are illustrative, not fitted to a clinical dataset. For preclinical candidate-triage illustration only — not diagnostic, not a dosing device, not a trial replacement.

## Next

Kidney (nephron + cortex–medulla gradient), then heart, then a shared plasma compartment toward a digital-human toxicity screen.
