# Digital Liver — Full Execution Plan
### AI-Surrogate Organ Simulator for Preclinical Drug-Toxicity Triage

---

## 1. One-Paragraph Pitch (memorize this, say it first in the demo)

> "Drug development takes 10–15 years and often over a billion dollars, and a huge share of failures happen when long-term organ toxicity shows up only after years of investment. We built a digital liver: an AI surrogate model, trained on an ODE-based physiological simulation, that predicts 30-year chronic-dose liver toxicity in milliseconds instead of hours of numerical simulation. Researchers can interactively test dose and exposure frequency and see damage progression instantly — turning a 'wait and see' problem into a 'try it now' tool for candidate triage, before committing to animal studies or Phase I trials. This is organ one of a planned digital-human pipeline."

Keep repeating "triage / prioritization tool for preclinical screening" — never say "replaces clinical trials" or "predicts what happens to a real patient." That framing is both more honest and more credible to judges.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                       │
│  ┌────────────┐  ┌───────────────┐  ┌───────────────────┐    │
│  │ 3D Liver    │  │ Dose/Freq      │  │ Uncertainty band /  │  │
│  │ Viz (R3F)   │  │ Sliders        │  │ ODE-vs-AI compare   │  │
│  └────────────┘  └───────────────┘  └───────────────────┘    │
└─────────────────────────┬──────────────────────────────────┘
                          │ REST/WebSocket
┌─────────────────────────▼──────────────────────────────────┐
│                     BACKEND (FastAPI)                        │
│  ┌────────────────┐   ┌─────────────────┐   ┌─────────────┐  │
│  │ ODE Simulator   │   │ PINN Surrogate   │   │ Ensemble /   │  │
│  │ (ground truth,  │   │ Model (fast      │   │ uncertainty  │  │
│  │ scipy/numpy)    │   │ inference)       │   │ estimator    │  │
│  └────────────────┘   └─────────────────┘   └─────────────┘  │
└───────────────────────────────────────────────────────────┘
```

**Stack recommendation (optimized for 24-hr build speed, not production):**
- Backend: Python, FastAPI, PyTorch (or even a small MLP in scikit-learn if PyTorch setup eats time), `scipy.integrate.odeint`/`solve_ivp` for the ground-truth ODE model
- Frontend: React + `@react-three/fiber` (Three.js wrapper) for the 3D liver, Recharts/D3 for biomarker time-series, Tailwind for the dark biotech UI
- Glue: simple REST endpoints (`/simulate_ode`, `/predict_surrogate`, `/compare`); no need for a database — everything is computed on the fly or cached in memory

---

## 3. The Science Layer (keep this simple, defensible, and clearly labeled as a proxy)

### 3.1 The ODE "ground truth" model
Model liver health as a small compartmental toxicity ODE system. You do not need real hepatology-grade equations — a defensible, literature-inspired simplification is fine as long as you **say so explicitly**. Example minimal system:

- `H(t)` = hepatocyte health fraction (1.0 = fully healthy, 0 = fully damaged)
- `T(t)` = accumulated toxin/metabolite burden
- `R(t)` = regeneration capacity

```
dT/dt = k_absorb * Dose(t) - k_clear * T
dH/dt = -k_damage * T * H + k_regen * R * (1 - H)
dR/dt = -k_fatigue * T + k_recover * (1 - R)
```

Where `Dose(t)` is a periodic dosing function (e.g., daily dose with frequency = user slider). This is a toy pharmacokinetic/pharmacodynamic (PK/PD) model — cite it as inspired by standard one-compartment PK models plus a damage-regeneration term, not as validated hepatology. This honesty is a strength, not a weakness — say it out loud in the demo.

### 3.2 The AI surrogate (the "PINN")
- Train a small feed-forward network (or a lightweight Physics-Informed Neural Network if time allows) to map `(dose, frequency, half_life, k_damage, t)` → `(H(t), T(t), R(t))`, trained on thousands of ODE-solver runs across randomized parameter ranges.
- If true PINN (loss includes the ODE residual, not just supervised MSE) is too much for the time budget: build a supervised surrogate first (fast, safe), and if hours remain, add the physics-residual loss term as a stretch upgrade. **A working supervised surrogate beats a broken PINN.**
- Report inference speed vs. ODE solve time — this becomes your single best "wow" number for judges (e.g., "500× faster").

### 3.3 Uncertainty estimation (Must-build feature #1)
Cheapest defensible method in 24 hrs: train 5 small surrogate models with different random seeds/dropout masks (a "deep ensemble"). At inference time, run all 5, and show mean prediction ± spread as a shaded confidence band. This single feature answers "how do you know your AI isn't just guessing" before a judge even asks it.

---

## 4. Feature Plan — Prioritized

### Must-Build (build these first, in this order)
1. **Core simulation loop**: ODE ground-truth solver + one working surrogate model + basic prediction endpoint.
2. **3D liver visualization**: single 3D mesh (a stylized blob is fine — doesn't need to be anatomically exact) shaded green→yellow→red→black based on `H(t)`, animated over simulated time.
3. **Dose / frequency sliders**: live-updating prediction as the user drags sliders. This is what makes the demo interactive instead of a passive video.
4. **Uncertainty band**: confidence interval visualization on the biomarker time-series chart (see 3.3).
5. **ODE-vs-surrogate comparison panel**: side-by-side numbers — solve time and prediction error — proving the surrogate is a real surrogate, not smoke and mirrors.
6. **Limitations / intended-use screen**: one static screen, clearly stating this is a preclinical triage prototype, not diagnostic or clinical software, and that the ODE model is a simplified proxy.

### Stretch (only if steps 1–6 are solid with time to spare)
7. **Multi-compound comparison**: 2–3 preset parameter sets ("Compound A/B/C") overlaid on the same chart, to sell the "candidate triage" story directly.
8. **Explainability panel**: simple bar chart of input-feature sensitivity (perturb each input slightly, show output delta) — a crude but honest stand-in for SHAP.
9. **Second-organ stub**: a greyed-out kidney model in the UI labeled "Coming next" with one dummy slider — visually proves the "digital human" scalability story.

### Story-Only (mention on a roadmap slide — do not attempt to build)
- Federated/multi-partner training without sharing proprietary compound data
- Full organ-chain digital human (liver → kidney → cardiovascular → …)
- Integration with real toxicology datasets (ToxCast, DrugBank, ChEMBL) as training data
- Regulatory pathway positioning (IND-enabling preclinical tool)

---

## 5. Hour-by-Hour Build Plan (24 hours)

| Hours | Task |
|---|---|
| 0–2 | Set up repo, FastAPI + React skeleton, decide final ODE parameters, write the ODE solver, sanity-check outputs with matplotlib before touching UI |
| 2–5 | Generate synthetic training data (randomized dose/frequency/half-life/k_damage sweeps through the ODE solver), build and train the baseline supervised surrogate model |
| 5–7 | Wrap surrogate + ODE solver in FastAPI endpoints, test with curl/Postman before building UI |
| 7–8 | Add ensemble-of-5 models for uncertainty band, verify sane confidence intervals |
| 8–12 | Build React frontend skeleton: dark theme, layout, dose/frequency sliders wired to backend, biomarker time-series chart (Recharts) with uncertainty band |
| 12–16 | Build 3D liver visualization in React Three Fiber: single mesh, color-shader driven by `H(t)`, animate playback over simulated years |
| 16–18 | Build ODE-vs-surrogate comparison panel (timing + error display) |
| 18–19 | Build limitations/intended-use screen |
| 19–21 | Integration pass: make sure slider → prediction → 3D animation → chart all update together smoothly; fix the inevitable state-sync bugs |
| 21–22 | Stretch features if time allows (multi-compound, explainability, kidney stub) |
| 22–23 | Polish pass: loading states, error handling, responsive layout check, dark/neon aesthetic pass, favicon, title |
| 23–24 | Rehearse the demo script end-to-end at least twice; prepare fallback (screen recording) in case of live-demo failure |

---

## 6. Demo Script (2–3 minutes)

1. **Open with the problem** (10-15 years, cost, late-stage toxicity failures) — 20 sec.
2. **Show the 3D liver at baseline (healthy, green)** — 10 sec.
3. **Drag the dose slider up** → watch the liver visibly shift toward red/black over the simulated 30-year timeline, biomarker chart animates with it — 30 sec. This is your visual "wow" moment.
4. **Point at the uncertainty band**: "we don't just give a number, we show the model's confidence" — 15 sec.
5. **Open the ODE-vs-surrogate panel**: "here's the ground-truth simulation taking 4 seconds, here's our AI doing the same thing in under 10 milliseconds — 500x faster" — 20 sec.
6. **Say the limitation out loud, unprompted**: "This is a proof-of-concept trained on a simplified PK/PD model, meant for preclinical candidate triage — not a diagnostic tool" — 15 sec. This single sentence does more for your credibility score than another polished visual.
7. **Close with the roadmap**: "Same surrogate architecture generalizes to any organ with known compartmental kinetics — kidney and cardiovascular are next, building toward a full digital-human toxicity screen" — 15 sec.

---

## 7. Cursor-Specific Execution Tips

- Start every new file/module with a short comment block stating its single responsibility — Cursor's inline suggestions get noticeably better with clear local context.
- Build and verify the ODE solver and surrogate model **in a plain Python script first**, with matplotlib plots, before wiring up FastAPI — debugging math through a browser UI wastes hours.
- For the 3D visualization, prototype the color-shader logic on a plain sphere/blob mesh before attempting anything anatomically liver-shaped — shape realism buys you nothing on the judging rubric.
- Keep the uncertainty ensemble small (5 models) and train them in parallel in one script — don't over-engineer the ensemble infrastructure.
- Write the "limitations" screen text now, in this plan, so it doesn't get skipped at hour 23 when everyone's tired — copy-paste it directly:

  > "This is a hackathon prototype demonstrating an AI-surrogate approach to physiological simulation. It is trained on a simplified compartmental toxicity model, not validated clinical data, and is intended to illustrate a preclinical candidate-triage workflow — not for diagnostic, clinical, or dosing decisions."

---

## 8. Risk Mitigation

- **3D rendering breaks on the demo machine** → have a pre-recorded screen capture ready as backup, and test on the actual presentation laptop/browser beforehand, not just your dev machine.
- **Live model inference lags during Q&A** → cache a few precomputed scenarios so the slider can snap to precomputed keyframes if live inference stutters.
- **A judge asks about clinical validity** → have the "limitations" sentence ready verbatim; do not improvise a stronger claim under pressure.
- **Ensemble training runs long** → fall back to a single model with a fixed, hand-set uncertainty band (e.g., ±10% widening with time) rather than cutting the feature entirely; label it as "illustrative uncertainty" if you must simplify.

---

## 9. UI/UX Design System & Project-Specific Buttons

Use the accompanying `design_system.json` (Clinical Soft-UI Dashboard) as the visual reference for Cursor. It defines the light, card-based, translucent-3D-illustration aesthetic from the reference screenshot — apply it to the Digital Liver dashboard as follows:

**Layout mapping (3-column grid, per the design system):**
- **Left column** — stacked stat cards: `Toxin Burden` (gauge card), `Regeneration Capacity` (gauge card)
- **Center column** — the focal card: 3D liver visualization, full height, with the segmented pill toggle at the bottom edge (reuse the `<< 3D View >>`-style control, relabeled)
- **Right column** — stacked cards: `Liver Health % ` (sparkline card, mirrors the Oximetry card), `Simulation Log` (list card, mirrors Patient Appointments)

**Project-specific buttons to add (styled per `buttons` tokens in the JSON):**

| Button | Style token | Placement | Function |
|---|---|---|---|
| **Run Simulation** | `primary_pill_button` | Top-right of center card | Triggers surrogate inference for current slider values |
| **Compare to ODE** | `secondary_ghost_button` | Inside comparison panel | Toggles the ODE-vs-surrogate timing/error panel open |
| **Reset Parameters** | `icon_only_button` (circular, refresh icon) | Top-right of slider panel | Resets dose/frequency sliders to baseline |
| **3D View / Chart View** | segmented pill toggle (`secondary_ghost_button` pattern) | Bottom edge of center card | Switches the focal card between 3D liver and biomarker time-series chart |
| **Export Report** | `primary_pill_button` with trailing arrow icon | Top-right of dashboard header | Exports current simulation result as a summary (mirrors "View Records") |
| **Compound Preset chips** (Compound A / B / C) | small `secondary_ghost_button` pills, horizontally grouped | Above the dose slider | Stretch feature — quick-load preset toxicity parameter sets for comparison |
| **Show Uncertainty Band** | toggle switch (motion: `toggle_switch` easing) | Inside biomarker chart card header | Shows/hides the ensemble confidence band on the chart |

**Status color mapping for the liver health states** (use `status` tokens, not custom colors):
- Healthy (`H > 0.7`) → `status.success` green
- Warning (`0.4 < H ≤ 0.7`) → `status.warning` amber
- Damaged (`H ≤ 0.4`) → `status.danger` red, transitioning toward the illustration's dark/black damaged state

**Data table reuse**: the "Simulation Log" list (right column) should follow the `data_table_card` pattern from the design system — each row = timestamp + parameter set label + a text-only category badge (`Mild` / `Moderate` / `Severe`), exactly like the reference screenshot's Diagnostic Result table.

---

## 10. 3D Liver Visualization — Technical Approach (Translucent X-ray + Red Vessels)

**Visual target:** a translucent slate/blue x-ray-style liver shell (matching the reference screenshot's lung/ribcage render) with a bright red branching vessel network visible through it — the classic contrast-angiography look. As simulated damage (`1 - H(t)`) increases, irregular dark/necrotic patches grow across the shell via noise, while the vessels stay the constant red reference structure.

### 10.1 Build order (fits inside the existing hours 12–16 slot)

1. **Base shell geometry** — start with a simple ellipsoid/blob mesh (do not attempt anatomical accuracy). Scale/squash a `SphereGeometry` or use a low-poly liver-silhouette mesh if you find a free one; either works at dashboard scale.
2. **Shell material** — `MeshPhysicalMaterial` (or a custom `ShaderMaterial` if time allows) with:
   - `transparent: true`, `opacity` ~0.3
   - Fresnel-style rim brightening (edges brighter than face-on surface) — either via a small custom shader or by faking it with `MeshPhysicalMaterial`'s `iridescence`/`transmission` + a rim light positioned behind the mesh
   - Base color from the design system's `anatomical_render_palette`
3. **Vessel network (pick ONE based on time remaining):**
   - **Fast path (recommended given the timeline):** bake a branching vein pattern as a 2D emissive texture (procedurally generate once in a script, or hand-draw a branching pattern in any vector tool), map it onto the shell via an `emissiveMap` tinted red. Cheap, robust, looks convincing at dashboard scale.
   - **Higher-fidelity path (only if hours remain):** procedurally generate 3D branch curves (recursive bifurcation from one root point, e.g. 3-4 recursive splits with randomized angle/length falloff), build each branch as a `TubeGeometry` along a `CatmullRomCurve3`, material = emissive red, additive blending so it glows through the shell.
4. **Damage-driven shader uniform** — expose a single `damage` float (0 = healthy, 1 = fully damaged) updated each animation frame from the simulation's `H(t)`. Drive shell patchiness with a noise field (simplex/Perlin, precomputed or via a GLSL noise function) thresholded against `damage`, NOT a flat color lerp:
   ```glsl
   // fragment shader sketch
   float n = snoise(vPosition * noiseScale);
   float patchMask = smoothstep(damage - 0.1, damage + 0.1, n);
   vec3 healthyColor = vec3(0.15, 0.2, 0.35); // slate/blue
   vec3 damagedColor = vec3(0.08, 0.02, 0.02); // near-black necrotic
   vec3 shellColor = mix(healthyColor, damagedColor, patchMask);
   ```
   This produces organic, irregular dark patches that spread as `damage` rises, instead of a uniform "tint slider" look — reads as pathology, not a color filter.
5. **Vessel response to damage (optional polish):** slightly desaturate/dim the emissive red in regions overlapping heavy patch coverage, to suggest impaired blood flow in damaged tissue — reuse the same noise mask from step 4.
6. **Animation loop:** on each simulated timestep (as the user scrubs the dose/frequency sliders or plays back the 30-year timeline), update the `damage` uniform smoothly (lerp over ~300-500ms per the design system's `motion_guidelines.chart_update`) rather than snapping — this keeps the 3D view visually synced with the biomarker chart's own transition timing.

### 10.2 Fallback if shader work overruns

If custom GLSL eats too much time, a safe fallback that still looks intentional: keep the shell on a plain opacity/color `lerp` (healthy slate → damaged dark red/black) driven by `damage`, but keep the red vessel emissive texture layer constant and unaffected — the contrast between a "changing shell" and a "constant red vessel structure" still reads well even without noise-based patchiness. Noise patches are a polish step, not a blocker for the core feature.

---

## 11. Mapping Features to Judging Criteria

| Criterion | What in this plan addresses it |
|---|---|
| Innovation & Originality | AI surrogate for ODE-based organ simulation + real-time interactivity (not just the 3D visual) |
| Problem-Solving Approach | Explicit preclinical-triage framing, backed by real drug-development timeline/cost stats |
| Technical Implementation | ODE ground truth + trained surrogate + ensemble uncertainty + honest speed/error comparison |
| Functionality & Execution | Live interactive sliders driving real-time 3D + chart updates |
| User Experience | Dark biotech aesthetic, instant visual feedback, clear interaction model |
| Real-World Impact | Grounded stats, explicit intended-use and limitations statement |
| Scalability & Future Potential | Kidney stub (if built) + explicit roadmap narrative in the demo close |
