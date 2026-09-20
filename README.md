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


### ⚔️ Dual-Pathway Injury Modeling
The simulation explicitly differentiates between two distinct biological failure modes:
1.  **Acute Toxicity (The Necrotic Wave):** High-dose exposure causes CYP bioactivation and Glutathione (GSH) depletion. Damage peaks in Zone 3. Neighbor-coupling allows this damage to spread, creating a **localized, dark necrotic wave** moving across the tissue.
2.  **Chronic Degeneration (The Silent Attrition):** Repeated daily dosing creates a 24-hour moving average of metabolite load. This diffuse load suppresses cellular repair (`k_regen`). Over 30 days, this causes **grid-wide, diffuse chronic attrition** without an acute overdose spike.

---

## 🗺️ The Pipeline Roadmap

This liver model is just the beginning. The architecture is explicitly designed to be modular.

*   ✅ **Phase 1: Digital Liver (Current)** - Spatial hex-lattice, Z1/Z2/Z3 zonation, acute vs. chronic pathways.
*   🚧 **Phase 2: Digital Kidney** - Nephron-level spatial modeling, cortex vs. medulla gradients, filtration dynamics.
*   🚧 **Phase 3: Digital Heart** - Cardiomyocyte spatial lattice, electrical propagation, and ischemic injury modeling.
*   🚧 **Phase 4: Systemic Integration** - A shared 1-compartment plasma network linking all organs, enabling true multi-organ crosstalk and systemic toxicity screening.

---

## ⚡ Key Features

*   **Spatial Hex-Lattice Visualization:** Interactive HTML5 Canvas rendering of the tissue. Watch injury unfold in real-time (healthy pink → amber → dark necrotic).
*   **Interactive Micro-Diagnostics:** Click any individual hex on the grid to isolate and inspect the exact concentration curves of the parent drug, metabolite, GSH, and damage for Zones 1, 2, and 3 within that specific lobule.
*   **Zero-Backend, Instant Execution:** The entire multi-scale simulation runs locally in the browser. No server latency, no API costs, and no complex ML inference. A 30-day horizon renders interactively in seconds.
*   **Automated Clinical Verdicts:** Translates complex spatial data into clear, actionable preclinical outcomes (Safe, Caution, Toxic, Chronic Degeneration, Liver Failure).

---

## 🛠️ Technology Stack

### Core Application
*   **TypeScript & React 19:** Strict type safety for complex biological state management and a responsive clinical dashboard.
*   **Vite:** Lightning-fast local development and optimized production bundling.

### Custom Simulation Engine (Built from Scratch)
*   **Spatial Agent-Based Model (ABM):** Custom algorithms managing the 24×32 hexagonal grid, perfusion fields, and neighbor-coupling stress propagation.
*   **Explicit Euler ODE Solver:** High-performance math calculating the micro-scale metabolic state for every lobule at `dt = 0.1 h`.
*   **1-Compartment PK Model:** Custom pharmacokinetic math handling single bolus and repeated 24-hour sawtooth dosing.

### Graphics & Infrastructure
*   **HTML5 Canvas API:** High-performance 2D rendering for the lobule lattice.
*   **Vercel:** Deployed as a static site on the global edge network.

> **🛑 What we intentionally did NOT use:**
> *   **No AI/ML Black Boxes:** We use pure mechanistic ODEs for 100% biological interpretability.
> *   **No Backend/Databases:** 100% client-side execution ensures zero latency and complete data privacy.
> *   **No Three.js/WebGL:** 2D Canvas provides vastly superior spatial clarity for tissue zonation without 3D performance overhead.

---

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
