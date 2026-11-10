# Phase 3a: ANA-E06 transient single-well pressure buildup — design

Date: 2026-11-10. Issue: thaiphi/well-injection-insights #7 (PRD `docs/project-2-swd-injection-analytics-expansion-prd.md` §4, ANA-E06).

**Status.** The purpose, the scope and the three owner calls below come from an independent Fable recommendation, which the owner accepted on 2026-11-10 ("ok"). The owner approved this document as a whole on 2026-11-10, after the builder check.

**Deliverable.** Owner decision D6 (`docs/project-2-decisions-2026-10-20.md`): "design spec first, code later; the spec must add the wellbore radius r_w, an explicit skin treatment and a benchmark list."
- This document is that spec.
- Building it is a separate, later go-ahead from the owner.
- Merging this document does not close #7. It is referenced as "Refs #7".

## Why

**The question it answers:** "If this well injects this rate schedule for months or years, how much does pressure rise at the well and in the rock around it, and in which month does it use up the room under my bottomhole limit?"

**Why the current engine can't answer it.** The engine (`src/engineering.ts`, `src/disposalCase.ts`) uses a constant J against a fixed reservoir pressure, `P_bh = P_res + q/J`, so capacity never shrinks over time. E05 Part C lets the user type a flat reservoir-pressure offset, and kept any buildup calculation out for #7. E06 shows where such an offset could come from.

**Questions it deliberately does not answer:**
- "What are k and skin from a falloff test?" That is calibration; the PRD forbids it without reviewed field evidence.
- "What pressure does a neighbouring well feel?" That is #8.
- "Make J vary with time." The PRD forbids a silent change to the constant-J engine.

## Goals

A separate, versioned, pure transient-screening model with a panel. For one well and one assumed rock description, it shows:
1. **Bottomhole pressure against time** at the well's declared datum, against the bottomhole limit line, with the first month above the limit.
2. **Pressure rise against distance** from the well at times the user picks.
3. **Average reservoir pressure rise against time**, for the closed boundary only.
4. **One-at-a-time sensitivity** on permeability, thickness, formation compressibility (c_t recomputed), skin and boundary radius.
5. **Warnings:** the boundary is reached, the radius of investigation passes a stated extent, the limit is exceeded, or a step is too short for the method.

## Non-goals

- **No change to the disposal engine or its results.** Nothing feeds back into `buildDisposalCase` (owner call 1).
- **No history matching** and no estimate of k, skin or J from H-10 or test records.
- **No real H-10 rate history as an input** (owner call 3).
- **No constant-pressure (aquifer-supported) boundary** (owner call 2).
- **No wellbore storage, partial penetration, layering, two-phase, thermal, geomechanics or fracturing.** Each is listed as an exclusion on screen and in exports.
- **No new navigation tab** (D19), and no saved cases (D10).

## Anti-goals (a failure even if it works)

- **Any wording that implies a safe, permitted, sustainable, calibrated, validated or proven pressure or capacity.** The banned-word test from E05 (`proven|sustainable|calibrated|validated|safe`) is extended to this text.
- **Skin derived from, equated to, or shown next to the J multiplier as if they were the same thing.**
- **Transient bottomhole pressure fed back into the disposal case as reservoir pressure.** That would count the near-well pressure drop twice, because q/J already holds it.
- **A pre-filled rock value that reads as typical.**
- **A missing month treated as zero injection.** Only an explicit zero-rate (shut-in) step is zero.
- **Pre-empting #8** (another well's effect, distances, summing wells) **or #9** (Explorer package linking).

## Constraints

- **Determinism:** the same inputs give byte-identical results and exports. Editing any input withdraws the results and downloads, as in the disposal case.
- **Labels (E01, D12):** every rock and boundary value is labelled *assumed*. The rate schedule is *synthetic/assumed*, or *forecast (copied from disposal case)*. Every pressure output is *calculated*.
- **Pressure basis (D8):** see "Pressure basis and datum" below.
- **Data:** fictional values only in tests and evidence (fictional UIC `000000417`, wells FICTIONAL-A/B). Never copy an Explorer artifact into the repo.
- **Preservation:** one reviewed layer, `phase-3a-transient-buildup`, covering every protected file changed and every new file pinned (skill `.claude/skills/preservation-layer`).
- **Checks:** direct Node paths only. CR bytes: `web/import-ui.mjs` keeps exactly 4, `web/index.html` exactly 3, and new files 0.

## Model

### Assumptions (shown on screen and in exports)

- One vertical well, fully penetrating a single homogeneous, isotropic layer of uniform thickness.
- Single-phase, slightly compressible water. Viscosity, Bw and total compressibility are held constant at reference conditions.
- Darcy radial flow, with gravity ignored within the layer.
- The well is at the centre of the reservoir for the closed boundary.
- **Initial pressure is uniform and equal to the well's declared reservoir pressure** at the declared datum.

### Sign convention

- Injection rate q > 0 means water into the formation.
- The model computes the pressure rise Δp ≥ 0 for injection.
- A zero-rate step is a shut-in, and pressure falls back toward initial.
- Negative rates (production) are rejected with a message. This is an injection tool.

### Governing solution (oilfield units)

**Constants (Main's call after the builder check).** Computation uses constants derived exactly from SI: 141.2055, 70.603, 0.00026368, 948.12, 0.074466 and 5.6146. The rounded textbook values below are for display only. All of them come from one constants module, and benchmark 9 derives each from SI.

Units:
- q: STB/day
- B: rb/STB
- μ: cP
- k: md
- h: ft
- r: ft
- t: hours
- φ: fraction
- c_t: 1/psi

**Infinite-acting, line source (Ei solution):**

    Δp(r, t) = 70.6 · q·B·μ / (k·h) · E1( 948·φ·μ·c_t·r² / (k·t) )

**At the well (r = r_w), including skin:**

    Δp_w(t) = 70.6 · q·B·μ / (k·h) · [ E1( 948·φ·μ·c_t·r_w² / (k·t) ) + 2s ]

**Closed circular boundary of radius r_e:** use a solution valid at all times, either the van Everdingen–Hurst bounded-reservoir solution (eigenvalue series) or its Laplace-space form inverted by Stehfest. The builder chooses which is primary; the other is the independent check (benchmark 7). It must reduce to:
- the line source while the boundary is not yet felt; and
- the pseudo-steady state at late time:

      Δp_w(t) = 0.0744 · q·B·t / (φ·c_t·h·r_e²) + 141.2 · q·B·μ / (k·h) · [ ln(r_e/r_w) − 3/4 + s ]

**Average pressure rise (closed boundary only), by material balance:**

    Δp_avg = 5.615 · Q_cum · B / (c_t · π·(r_e² − r_w²)·h·φ)

where Q_cum is cumulative injection in STB. In an infinite-acting reservoir the average rise is not defined, so it is not shown.

### Rate steps (superposition in time)

- The schedule is 1–120 monthly steps, the disposal case's range.
- Each step's rate is the calendar-day average in STB/day.
- Pressure at time t is the sum of step changes `(q_j − q_{j−1}) · unit response(t − t_{j−1})`. The unit response includes skin only at r = r_w.
- Month lengths are the calendar lengths of the schedule's months, so the result is deterministic.
- **Output times:** the end of each month. The builder may add interior points for a smooth curve if they are deterministic.

### Wellbore radius r_w

- r_w is a required, assumed input, in ft, with bounds 0.1–2 ft. The reservoir must satisfy r_e ≥ 100 · r_w (Main's call after the builder check: finite-wellbore terms are then below about 1e-4).
- It sets where bottomhole pressure is evaluated and where skin applies.
- It is not the tubing inner diameter, which stays in Well assumptions for the traverse. Never derive one from the other.

### Skin (the D6 explicit treatment)

- **Definition:** a dimensionless steady-state additional pressure drop in a thin zone at the wellbore, `Δp_skin = 141.2 · q·B·μ / (k·h) · s`, carried by the current step rate through superposition.
- **Where it applies:**
  - It is applied only at r = r_w.
  - The pressure-against-distance curve at r > r_w never includes it.
  - Average pressure never includes it.
- **Sign:** positive skin (damage) raises injection bottomhole pressure; negative skin (stimulation) lowers it.
- **Form (Main's call after the builder check).**
  - **s ≥ 0:** the additive form above.
  - **s < 0:** the effective-radius form. The at-well response is evaluated at r_wa = r_w·e^(−s) with no added skin term, and the t_D ≥ 100 guard uses r_wa.
  - The additive form with negative s can give a negative rise during injection at early t_D; the effective-radius form cannot.
  - At late time the two agree, because E1 is in its log range.
- **Bounds:** s from −5 to 50.
  - The upper bound matches `literatureExample.ts`.
  - A negative s is accepted only if the effective radius `r_w · e^(−s)` stays below 0.1 · r_e (closed boundary) and below 1,000 ft. Otherwise it is blocked with a message.
- **Never** computed from, converted to, or labelled as the E05 J multiplier or the disposal case's injectivity J.

### Validity guards

- **Line-source validity at the wellbore:** every evaluated time since each rate change must satisfy `t_D = 0.0002637·k·t / (φ·μ·c_t·r_w²) ≥ 100`. This is the conservative textbook criterion; it is my call, and a looser 25 was also suggested.
  - Monthly steps satisfy this by a wide margin for realistic inputs.
  - Where it fails, the result is blocked with "the step is too short for this model (wellbore storage and early-time effects are not modelled)". It is never silently shown.
- **Radius of investigation:** `r_inv = sqrt( k·t / (948·φ·μ·c_t) )`.
  - **Closed boundary:** warn "boundary reached" from the first month in which r_inv ≥ r_e.
  - **Infinite-acting:** the user may state a known reservoir extent (optional, assumed). Warn when r_inv passes it: "results assume no edge, but pressure has reached the extent you stated".
- **Input bounds.** Each failing input is blocked with a message naming it:
  - k: 0.01–10,000 md
  - h: 1–5,000 ft
  - φ: 0.01–0.40
  - c_f: 1e-7 to 1e-4 /psi
  - r_e: 100 ft – 50 miles, and ≥ 100 · r_w (and ≥ 100 · r_wa when s < 0)
- c_f low/high in the sensitivity table: the same bounds as c_f
  - schedule rates: 0–100,000 STB/day per step
  - Resulting absolute pressures must stay within the PVT bounds of 100–10,000 psia. Outside them the output is blocked.

### Fluid properties

- Viscosity μ, Bw and water compressibility c_w come from `brinePvt.ts` `brineAtPressure`, evaluated at the well's reservoir pressure and held constant.
- **Temperature and salinity (Main's call after the builder check):** the disposal case's own fluid values. That is the well's `bottomholeTemperatureF` where set, otherwise the case's `fluid.temperatureF`, plus the case's `fluid.salinityWtPercent`. The Phase 2a Well assumptions panel is not linked to case wells, so it is not used.
- `c_t = c_w + c_f`, with formation compressibility c_f an assumed input. The panel shows c_w, c_f and c_t separately.

### Pressure basis and datum (D8)

- The pressure rise Δp is a difference and carries no basis.
- **Absolute outputs:**
  - `P = P_i + Δp`, in psia (`bottomhole-absolute`), at the well's declared datum (`Injector.datum`, `reservoirDatum`).
  - P_i is the well's `reservoirPsia`, already psia by the engine's validation.
  - The limit line is the well's `limitPsia` at `limitDatum`. These must equal `reservoirDatum`, as the engine already requires.
- No surface pressure is computed in E06; the wellbore traverse is out of scope.

## Inputs and where they come from

| Input | Source | Label |
|---|---|---|
| Initial pressure P_i, limit, datum, temperature, salinity | the selected case well (read-only here) | as in the case |
| k, h, φ, c_f, r_w, s | typed by the user; no defaults | assumed |
| Boundary: infinite-acting, or closed circular with r_e | chosen by the user | assumed |
| Stated extent (infinite-acting only, optional) | typed | assumed |
| Rate schedule | typed, or "copy this well's Base forecast allocation" from the current disposal case (calendar-day average, so availability is already included). The copy is one-way and is not live-linked. | synthetic/assumed, or "forecast (copied from disposal case, \<date\>)" |
| Sensitivity low/high for k, h, c_f, s, r_e | typed; no defaults. c_t is recomputed as c_w + c_f (Main's call after the builder check) | assumed |

**Consecutive months (Main's call after the builder check).**
- A schedule must be consecutive months.
- The disposal case allows non-consecutive months. A copy fills the span from the first to the last month and leaves any month missing from the case as an empty, required field marked "not in the disposal case: enter a rate (0 = shut in)".
- The calculation stays blocked until every month has a typed value.
- A missing month is never zero by default.

**A labelled fictional example.** A "Load fictional example" button fills every field with a fictional set labelled "fictional example — not typical values", as the existing literature example does. It is the only pre-fill. (My call, so the panel can be demonstrated without implying typical values.)

## Outputs

**Calculated results:**
- **Bottomhole pressure against time:** psia at the datum, with the limit line. Also reported:
  - the first month in which P ≥ limit, or "not reached within the schedule";
  - the pressure at the end of the schedule;
  - the skin part, as a separate line ("of which skin: N psi").
- **Pressure rise against distance:** at up to 3 user-picked months, from r_w to r_e (closed) or to 2 · r_inv (infinite-acting). It is labelled "rise above initial; excludes skin".
- **Average pressure rise against time:** closed boundary only.
- **Sensitivity table:** one factor at a time, low and high, giving the first month above the limit and the end-of-schedule bottomhole pressure. Labelled "one at a time; not additive".
- **Warnings and blocks** as listed under Validity guards.

**Manual hand-off to E05 (display only):**
- The panel shows "Average rise at month N: X psi (closed boundary)" with a note: "You may type this as an assumed reservoir-pressure offset in Well-performance cases. It is not applied automatically. That offset applies to every well in the case, not only this one."
- The last sentence is Main's call after the builder check: the E05 offset is uniform across wells.
- Bottomhole pressure is never offered for this, because of the double count.

**Exports:** JSON and CSV, built from the result object and sealed like the other exports (SHA-256 over key-sorted canonical JSON). Verification recomputes everything from the stored inputs, with the same exact-hash plus 1e-9 relative numeric tolerance as E05. Exports re-verify before download.

**Fixed closing line:** "Screening estimate from assumed rock and fluid properties; not a calibrated or permitted pressure."

## Placement (Main's call)

- **Where:** a panel inside the existing Disposal capacity case workspace, under "What the case says". It shows a well picker over the case's wells.
- **Why there:** it needs a case well's P_i, limit and datum, and the forecast copy. That keeps D19 (no new tab).
- **No case loaded:** the panel reads "Load or calculate a disposal case to choose a well".
- **Runtime:** the calculation runs in a Web Worker, like the sweep and E05.

## Benchmarks (the D6 list)

These are closed-form identities and independent methods. No textbook example numbers are quoted from memory. Tolerances are stated in each test.

1. **E1 accuracy.** E1(x) against its log approximation `−γ − ln x` for x < 0.004 (relative error < 1e-3; at 0.01 the approximation is 2.5e-3 off), and against the series and continued-fraction forms across the switch-over (relative 1e-10).
2. **Skin is a pure additive shift** (for s ≥ 0; for s < 0 the test checks the effective-radius form and that the late-time difference tends to `141.2·qBμ/(kh)·s`).
   - Bottomhole pressure with skin s minus with s = 0 equals `141.2·qBμ/(kh)·s` at every time.
   - There is no difference at any r > r_w.
   - The difference is linear in q.
3. **Two-rate superposition** against a hand sum of two Ei terms.
4. **Shut-in falloff, infinite-acting.**
   - After injection for t_p, then shut-in, the rise equals the Horner form `70.6·qBμ/(kh)·[E1(…t_p+Δt) − E1(…Δt)]`.
   - It tends to 0 as Δt grows.
   - Skin vanishes after shut-in.
5. **Closed circle, late time.**
   - Tested at r_e/r_w ≥ 1,000.
   - The slope dΔp_w/dt equals the material-balance slope with the exact constant 0.074466 and pore volume π·(r_e² − r_w²)·h·φ, within 1e-4 relative.
   - The intercept equals `141.2055·qBμ/(kh)·[ln(r_e/r_w) − 3/4 + s]` within 1e-3 relative.
   - Average pressure equals material balance with the same pore volume and exact constants, within 1e-9 relative.
6. **Linearity and symmetry.**
   - Doubling every rate doubles Δp.
   - A schedule with two equal halves equals one constant-rate schedule.
   - Δp is monotone non-decreasing in time at constant injection, and monotone in k, h and c_t in the expected direction.
7. **Independent numerical check.** The closed-circle primary solution against the other method (eigenvalue series against Stehfest-inverted Laplace solution), or against a radial finite-difference run with grid refinement showing convergence. Agreement within a stated tolerance across early, transition and late time.
8. **Early-time limit of the closed solution.** Before the boundary is felt, the closed solution equals the line source.
9. **Units and basis.** A unit-consistency test of the constants (70.6, 141.2, 948, 0.0002637, 0.0744, 5.615) derived from SI. Outputs are labelled psia `bottomhole-absolute` at the declared datum. A well whose datums disagree is refused, as the engine refuses it.
10. **Guards.** Every input bound, the t_D ≥ 100 block, a negative rate, the negative-skin effective-radius block, and the PVT bounds each give their message, never a number.

## Acceptance (from issue #7)

| Criterion | How it is shown |
|---|---|
| Verified analytical benchmark cases and unit tests | Benchmarks 1–8 as unit tests |
| Convergence and monotonicity sanity checks | Benchmarks 6 and 7 |
| Sign and units checks | Benchmarks 2, 6 and 9 |
| Invalid parameter guards | Benchmark 10 |
| Baseline and predicted pressure kept separate | P_i (case input, reported or assumed) and the calculated rise are shown and exported as separate fields; the absolute pressure is labelled calculated |
| No real-well calibration claims | Banned-word test, fixed closing line, no H-10 input, no fit |

**Also required:**
- the full gate (`node scripts/check-all.mjs`): app tests, 248 carried oracles, `tsc`, preservation;
- browser evidence at desktop and mobile widths (skill `browser-check`), recorded in `demo/E06-TRANSIENT-BUILDUP-VERIFICATION.md`;
- independent review (agent `reviewer`), then QA (agent `qa`), then the owner accepts the layer.

## Kept out of E06

- **#8 (ANA-E07):**
  - another well's pressure at this well, or this well's at another;
  - distances between wells;
  - summing several wells.
  - The pressure-against-distance curve is this well's own pressure spread only.
- **#9 (ANA-E10):** linking Explorer packages to case wells.
- **Later, separately reviewed:**
  - real H-10 rates as model input;
  - a constant-pressure boundary;
  - any fit to test data.

## Left to the builder (plan)

- Module names and file split. Expect pure `src/` modules (E1 and solutions, schedule superposition, result/export), a `web/` panel and a worker. Follow the E05 pattern.
- Which closed-boundary method is primary and which is the check, including the series truncation and Stehfest N, with stated tolerances.
- The exact sentence templates, within the banned words.
- The chart layout. There is no thinning (D16). Gaps cannot reach the calculation, because the schedule must be consecutive and complete.
- The list of protected files touched. Keep it minimal; most likely `web/import-ui.mjs`, `web/index.html` and possibly `web/redesign.css`.
