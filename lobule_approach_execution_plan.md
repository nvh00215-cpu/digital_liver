# Digital Liver — Lobule Approach Execution Plan
### Mesoscale tissue simulator for preclinical dose-toxicity triage

This is the **spatial / lobule** build. It is not the AI-surrogate + 3D-blob plan in `digital_liver_execution_plan.md`.
UI reference: `ui-mock/digital-liver-lobule-ui.png`. Visual tokens: `design_system.json`.

---

## 1. One-paragraph pitch (say this first)

> Drug candidates often fail on liver safety after huge spend. We built a digital liver at the scale that histology actually uses: each agent is one hepatic lobule with an internal Zone 1 → Zone 2 → Zone 3 gradient, so CYP-driven toxicity hits the pericentral zone first. Thousands of those lobules sit on a tissue grid with uneven perfusion, and necrosis can spread to neighbors. A researcher changes dose and watches the injury pattern in seconds — a preclinical triage tool, not a diagnostic, not a trial replacement. This is organ one of a planned digital-human pipeline.

Keep repeating **preclinical triage / candidate screening**. Never say “replaces clinical trials” or “predicts a real patient.”

---

## 2. The biological rule you must not get wrong

Zonation lives **inside every lobule**, not between lobules.

A classic lobule is a hexagon: portal triads at the corners, central vein in the middle. Blood flows **inward**.

| Zone | Anatomy | Condition | Role in this model |
|---|---|---|---|
| **Zone 1** | Periportal (near portal triad) | High oxygen | Lower CYP bioactivation; more resilient in APAP-like injury |
| **Zone 2** | Midzonal | Intermediate | Transition |
| **Zone 3** | Pericentral (near central vein) | Low oxygen | Higher CYP; toxic metabolite builds here first |

Every hex on the map has **all three zones at once**. There is no “portal lobule” vs “central lobule.”

The **grid of hexes** is for a different real phenomenon: **perfusion heterogeneity** and **local damage spread** (congestion, inflammation, neighbor stress). That is what makes the dark wave move across the lattice.

A lobule has on the order of **10⁵ hepatocytes**, not ~1,000. Do not put “~1,000 cells per lobule” in the README. The agent is a **functional unit**, not a cell.

---

## 3. System architecture

```
Dose / compound / time window
            │
            ▼
┌───────────────────────────────────────────────┐
│  MACRO — tissue ABM grid (~24 × 32 hexes)     │
│  each agent = 1 lobule                        │
│  • perfusion weight (uneven blood flow)       │
│  • inlet drug concentration                   │
│  • neighbor coupling (damage / congestion)    │
│  • one health color for the hex               │
└─────────────────────┬─────────────────────────┘
                      │ per agent, every timestep
                      ▼
┌───────────────────────────────────────────────┐
│  MICRO — 3-compartment ODE inside the lobule  │
│  Zone1 (periportal) → Zone2 → Zone3           │
│  state per zone: oxygen, parent drug,         │
│  CYP metabolite, glutathione proxy, damage    │
└───────────────────────────────────────────────┘
                      │
                      ▼
        hex color + verdict + charts
```

**Stack (24-hour, demo cannot die):**

- Vite + React + TypeScript (already in this repo)
- All simulation in the browser (`src/model/*`)
- Hex lattice on `<canvas>` (must-have visual)
- Recharts for zonal time-series
- CSS tokens from `design_system.json` (light clinical Soft-UI)
- No FastAPI, no PINN, no PyTorch for v0

The whole loop is a few thousand ODE states. Explicit Euler in JS is real-time.

---

## 4. Science layer (proxy, labeled as such)

### 4.1 Grid (macro)

- Lattice: **24 rows × 32 cols ≈ 768 lobules** (hex stagger). Stretch: 32 × 40.
- Each lobule `i` has:
  - `perfusion_i` ∈ [0.5, 1.5] — sampled once (smooth noise, not independent white noise)
  - `inlet_i(t) = perfusion_i * C_plasma(t)`
  - `damage_i` = mean of the three internal zone damages (or max of Zone 3 — pick one and document it)
  - neighbor set: 6 hex neighbors

**Neighbor coupling (keep one mechanism, name it):**

When a lobule is badly damaged, neighbors get extra stress — a stand-in for sinusoidal congestion / local hypoxia / inflammatory signal.

```
stress_i = k_n * mean( max(0, damage_j - 0.4)  for neighbors j )
```

Add `stress_i` to Zone 3 damage rate (or reduce local perfusion). Do **not** describe this as “lobules near the central vein.” Describe it as **tissue-level spread**.

### 4.2 Plasma (one-compartment PK, feeds the grid)

```
dC_plasma / dt = (F * Dose_rate / Vd) - kel * C_plasma
```

- `Dose_rate` from the slider (single bolus or repeated)
- `kel` from compound half-life
- Horizon default **72 hours** (acute DILI demo), not 30-year chronic

This is enough to turn “mg/kg” into an inlet concentration. Do not claim full-body PBPK.

### 4.3 Inside each lobule (micro, 3 zones)

Blood/drug flows Zone 1 → 2 → 3.

Per zone `z ∈ {1,2,3}`:

| Symbol | Meaning |
|---|---|
| `C_z` | parent drug |
| `M_z` | toxic metabolite (NAPQI-class proxy) |
| `G_z` | glutathione / detox reserve (1 = full, 0 = depleted) |
| `D_z` | damage 0–1 |
| `O_z` | oxygen (almost static gradient) |

**Oxygen (fixed gradient, not a full ODE unless time remains):**

```
O1 = 1.00    O2 = 0.70    O3 = 0.40
```

**CYP activity higher toward Zone 3:**

```
CYP1 = 0.35    CYP2 = 0.70    CYP3 = 1.00
```

**GSH baseline higher toward Zone 1:**

```
G1_0 = 1.00    G2_0 = 0.75    G3_0 = 0.50
```

**Update (explicit Euler, dt ≈ 0.05–0.1 h):**

```
flow into Z1 from inlet; Z2 from Z1; Z3 from Z2; leftover clears

dC_z/dt = flow_in - flow_out - (k_cyp * CYP_z * C_z) / (Km + C_z)   # saturable bioactivation
dM_z/dt = bioactivation - k_detox * G_z * M_z - k_mclear * M_z
dG_z/dt = -k_detox * G_z * M_z + k_gsyn * (G0_z - G_z)              # depleted by metabolite
dD_z/dt = k_dmg * M_z * (1 - D_z) * (1.2 - O_z) + neighbor_stress     # Zone 3 dies first
```

Michaelis–Menten on CYP is what makes **overdose** look different from therapeutic dose (pathway saturates, more parent spills into Zone 3).

Acetaminophen-class story you must be able to say out loud:

1. Therapeutic dose → glucuronidation/sulfation-like clearance dominates (lump into `k_clear` on plasma + low `M`)
2. Overdose → CYP path produces more `M` in Zone 3
3. Zone 3 GSH depletes first
4. `D_3` rises while `D_1` stays low
5. If many lobules hit high `D_3`, neighbor stress starts the **dark wave**

### 4.4 Verdict

Aggregate:

- `peak_z3` = max over time of mean Zone-3 metabolite
- `frac_necrotic` = fraction of hexes with `damage > 0.5`
- `time_above` = hours Zone-3 mean metabolite > threshold

| Verdict | Rule (tune until the four demo stories work) |
|---|---|
| **Safe** | `frac_necrotic < 0.05` and `peak_z3` below threshold |
| **Caution** | between |
| **Toxic** | `frac_necrotic > 0.20` **or** sustained Zone-3 overload |

Always pair color with the word (design system accessibility rule).

### 4.5 Honesty block (on screen + README)

> Simplified spatial prototype. Each hex is a lobule with a 3-zone gradient inspired by hepatic zonation and APAP-type centrilobular injury. Parameters are illustrative, not fitted to a clinical dataset. For preclinical candidate triage illustration only — not diagnostic, not a dosing device, not a trial replacement.

---

## 5. Four stories the model must always show

These are the acceptance tests. If they fail, do not polish UI.

| # | Input | Must see |
|---|---|---|
| 1 | Acetaminophen, **therapeutic** | Mostly pink grid, Zone 3 only slightly above Zone 1, **Safe** or mild **Caution** |
| 2 | Acetaminophen, **high / overdose** | Zone 3 chart spikes, selected-lobule inset shows Z3 dark / Z1 pink, then a **black wave** on the lattice, **Toxic** |
| 3 | Custom compound, tiny dose, high threshold | **Safe**, almost no black hexes |
| 4 | Custom compound, huge dose, low threshold | **Toxic**, fast spread |

If overdose does not hit **Zone 3 first**, the biology is wrong — fix CYP/GSH gradients before adding buttons.

---

## 6. UI (match `ui-mock/digital-liver-lobule-ui.png`)

Use **Clinical Soft-UI** from `design_system.json`: light canvas `#BFD9F2` / `#EDEFF2`, white 20px cards, thin numerals, pill buttons. Focal visual is the **hex lattice**, not a 3D x-ray liver.

### 6.1 Layout (3 columns)

**Header**

- Title: `Digital Liver`
- Subtitle: `Lobule-scale tissue model · Preclinical dose triage`
- Right: `Export Report` (stretch), circular reset

**Left — Dose Protocol**

- Compound chips: Acetaminophen (default) / Ibuprofen / Custom
- Custom fields (if Custom): name, half-life, CYP strength, toxicity threshold
- Weight (kg)
- Segmented dose: Low / Therapeutic / High
- Optional exact mg/kg slider
- Horizon: 24h / 48h / 72h (default 72)
- `Run Simulation` (`primary_pill_button`)
- `Reset` (`secondary_ghost_button`)
- Legend: Z1 periportal / Z2 midzonal / Z3 pericentral

**Center — Hepatic lobule lattice** (focal card)

- Canvas hex grid, color = lobule `damage` (healthy salmon/pink → amber → dark necrotic)
- Playback: after Run, animate hexes over simulated time (or a time scrubber)
- Bottom segmented toggle: **Grid View** | **Charts** (reuse focal-card pill)
- Caption: `Each hex = one lobule. Color = aggregated damage. Necrosis can spread to neighbors.`
- **Selected-lobule inset** (must-have): click a hex → enlarged hex split into Z1 / Z2 / Z3, Z3 labeled pericentral. This is how you prove zonation to a judge in 5 seconds.

**Right**

- Verdict card: **SAFE / CAUTION / TOXIC** + one line (“Centrilobular necrosis pattern” on APAP overdose)
- Metrics: Peak Zone 3 load, time above threshold, tissue damage %
- Chart: Zone 1 vs Zone 3 concentration (0–72 h). Zone 3 must read higher on overdose
- Small note: `Perfusion heterogeneity · Neighbor coupling on`

**Footer**

- Limitations sentence from §4.5

### 6.2 Color mapping (use `status` tokens + tissue colors)

| State | Hex fill | Status token |
|---|---|---|
| Healthy (`D < 0.2`) | warm pink / light salmon | `status.success` on verdict |
| Stressed (`0.2–0.5`) | amber | `status.warning` |
| Necrotic (`D > 0.5`) | dark red / near-black | `status.danger` |

Do not use a uniform green→red 3D tint as the hero. That is the other plan.

### 6.3 Buttons

| Button | Token | Function |
|---|---|---|
| Run Simulation | `primary_pill_button` | Step the model, play the grid |
| Reset | `secondary_ghost_button` or icon refresh | Baseline therapeutic acetaminophen |
| Grid / Charts | segmented pill | Swap focal card |
| Compound chips | ghost pills, selected = blue fill | Load parameter sets |
| (Stretch) Export Report | `primary_pill_button` | Dump current verdict + parameters as text/JSON |
| (Stretch) Compare two doses | ghost | Overlay two grid snapshots |

---

## 7. Feature priority

### Must-build (in this order)

1. Types + compound presets + plasma PK + 3-zone ODE for **one** lobule (prove Zone 3 dies first on a chart)
2. Tile that to ~768 agents with perfusion noise
3. Neighbor damage coupling + hex canvas
4. Click-to-select lobule inset (Z1/Z2/Z3)
5. Dose controls + verdict + Zone 1 vs Zone 3 chart
6. Limitations footer + README (equations, limits, next organs)

### Stretch (only if 1–6 work)

7. Time scrubber / play-pause on the wave
8. Ibuprofen vs acetaminophen qualitative difference
9. Compare two doses side by side
10. Greyed-out **kidney** card: “Coming next”
11. 3D liver shell that **tints from the grid average** — optional skin, not the model

### Story-only (roadmap slide, do not code)

- Patient-specific vascular trees / 10⁵ lobules
- Fit to ToxCast / clinical ALT / histopathology
- Full PBPK
- Other organs chained on one plasma compartment
- Regulatory / IND tool

---

## 8. Folder plan

```
src/
  App.tsx
  styles/tokens.css          ← design_system.json colors
  model/
    types.ts                 ← Zone, Lobule, Compound, SimResult
    compounds.ts             ← acetaminophen, ibuprofen, custom
    plasma.ts                ← one-compartment PK
    lobuleOde.ts             ← 3-zone step
    grid.ts                  ← hex neighbors, perfusion field, coupling
    simulate.ts              ← run horizon, collect series
    verdict.ts               ← Safe / Caution / Toxic
  components/
    Header.tsx
    DosePanel.tsx
    LobuleGrid.tsx           ← canvas
    SelectedLobule.tsx       ← Z1/Z2/Z3 inset
    VerdictCard.tsx
    ZoneChart.tsx
    Limitations.tsx
    Roadmap.tsx
```

The file judges should be able to open: **`src/model/lobuleOde.ts`**.

---

## 9. Hour-by-hour (24h)

| Hours | Task |
|---|---|
| 0–1 | Repo, tokens.css from design system, empty 3-column shell |
| 1–4 | `lobuleOde.ts` + matplotlib-style debug (or a tiny React dump): one lobule, overdose vs therapeutic |
| 4–6 | `grid.ts` + canvas hexes, perfusion noise, no UI polish yet |
| 6–8 | Neighbor coupling; overdose produces a visible dark cluster/wave |
| 8–12 | Dose panel, Run/Reset, verdict, Zone 1/3 chart, selected-lobule inset |
| 12–14 | Tune the four stories; legend; limitations footer |
| 14–18 | Clinical polish: cards, type scale, badges, loading state |
| 18–20 | README + demo script rehearsal |
| 20–22 | Stretch only (scrubber, second compound, kidney stub) |
| 22–23 | Deploy (Vercel/Netlify) if possible |
| 23–24 | Fallback screen recording; do not start 3D or PINN |

If hour 8 has no Zone-3-first chart, **stop UI and fix the ODE**.

---

## 10. Demo script (2–3 minutes)

1. **Problem (20s):** late liver toxicity kills programs; we need a spatial screen before animal studies.
2. **Point at one hex (15s):** “Every tile is a lobule. Inside it: Zone 1, 2, 3. Blood flows portal → central. Zone 3 is where CYP-activated toxins hit.”
3. **Therapeutic acetaminophen (20s):** Run. Grid stays mostly pink. “Safe / mild caution.”
4. **High dose (40s) — wow:** drag High, Run. Inset shows Z3 going dark while Z1 holds. Grid grows a necrotic wave. Verdict **Toxic**. “That’s centrilobular injury plus tissue spread — not a color filter.”
5. **Limitation unprompted (15s):** read the footer sentence.
6. **Close (15s):** kidney/heart next, same pattern (functional unit + internal gradient + spatial coupling) → digital-human toxicity screen.

Backup: pre-recorded clip of the overdose wave if the live canvas hiccups.

---

## 11. Mapping to judging criteria

| Criterion | What this plan puts on screen |
|---|---|
| Innovation & Originality | Spatial digital organ with **correct zonation**, not a chatbot, not a single health % |
| Problem-Solving Approach | Explicit question: low vs high dose → where does the liver fail? |
| Technical Implementation | `lobuleOde.ts` + grid coupling in GitHub; parameters documented |
| Functionality & Execution | Therapeutic vs overdose **look different** |
| User Experience | One Run button, hex map, inset that teaches zonation, clinical light UI |
| Real-World Impact | Preclinical DILI triage; limitations stated |
| Scalability & Future Potential | Same agent pattern for kidney nephrons / heart units; organ 1 of a digital human |

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Bio judge asks “are some lobules Zone 3?” | Inset + the sentence in §2 |
| Overdose looks like uniform grey | Raise CYP3, lower G3, add MM saturation |
| Wave looks like Game of Life | Tie coupling to damage/hypoxia; mention it is a proxy |
| Canvas too slow | 24×32 max; draw only dirty hexes; don’t re-layout every Euler step |
| Too much like the 3D plan | Do not lead with a blob liver; the lattice is the product |
| Overclaim | Footer + README; “illustrative parameters” |

---

## 13. What this plan is not

- Not PINN / ensemble / “500× faster than hours of ODE”
- Not 30-year chronic toxicity as the main demo
- Not a 3D angiography liver as the must-have
- Not cell-resolution ABM
- Not FDA-grade PBPK

Those belong to `digital_liver_execution_plan.md` or to later funding work.

---

## 14. README outline (write during hours 18–20)

1. Title + one-line pitch  
2. Problem  
3. What a lobule/zone is (one diagram in markdown or screenshot of the inset)  
4. Macro vs micro  
5. How to run (`npm i`, `npm run dev`)  
6. The four demo stories  
7. Limitations  
8. Next: kidney, heart, shared plasma, then digital human  

---

## 15. Go / no-go

**Ship this approach if** you want a judge-defensible spatial organ and the hex map in `ui-mock/digital-liver-lobule-ui.png`.

**Do not mix** this engine with the PINN + 30-year 3D plan in one weekend. One model, one hero visual, one pitch.
