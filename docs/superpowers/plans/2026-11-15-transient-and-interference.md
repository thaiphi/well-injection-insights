# Transient buildup (#7) + interference screening (#8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal.** Two features built together on one shared pressure-transient calculator:
- **#7:** a separate pressure-buildup calculator for one disposal-case well.
- **#8:** a "Nearby wells" section that ranks user-loaded offset wells by the pressure each adds at that well.

**Architecture.**
- **Pure TypeScript modules in `src/`, compiled to `dist/`.**
  - **Math:** constants, E1, Bessel functions, Stehfest.
  - **Model:** unit responses and superposition.
  - **#7 case:** validation, outputs and sensitivity.
  - **#8 offset histories:** built on the merged `historyPackages.ts`.
  - **#8 interference:** ranking and views.
  - **Sealed export.**
- **A web panel and worker** follow the E05 pattern, mounted under "What the case says" in the Disposal capacity workspace.
- **Display only.** Nothing feeds `buildDisposalCase`.

**Tech stack:** TypeScript 5.9.3, `node:test`, plain ES modules, Web Workers, Web Crypto. No new dependencies.

**Specs** (binding; read both before any task):
- `docs/superpowers/specs/2026-11-10-e06-transient-buildup-design.md` (#7, with its #8 amendment note).
- `docs/superpowers/specs/2026-11-15-e07-interference-screening-design.md` (#8).

**Issues:** thaiphi/well-injection-insights #7 and #8. The PR says "Closes #7" and "Closes #8" only after the owner accepts the layer.

**Branch:** `feature/e06-e07-transient-interference` from main `bdced55`.

## Global Constraints

**Commands.**
- Direct Node paths only; no npm, npx, vitest or bare python. From `swd-injection-analytics/`:
  - `node ../node_modules/typescript/bin/tsc -p tsconfig.json`
  - `node --test tests/<file>.test.mjs`
- Full gate, from the repo root: `node scripts/check-all.mjs`.

**Git and agents.**
- Workers never stage, commit or push; the orchestrator commits after each task review.
- At most 2 active subagents.

**Data.**
- Fictional data only in tests and evidence: UIC `000000417` and other fictional UICs, wells FICTIONAL-A/B.
- Never copy an Explorer artifact into the repo.
- Screenshots showing real values stay outside the repo, with hashes only.

**Bytes.** CR bytes: `web/import-ui.mjs` keeps exactly 4, `web/index.html` exactly 3, and every new file has 0.

**Constants.** Computation uses the SI-derived constants **141.2055, 70.603, 0.00026368, 948.12, 0.074466, 5.6146**, from one module. Rounded textbook values (141.2, 70.6, 948, 0.0002637, 0.0744, 5.615) are for display only.

**Units:**
- q: STB/day
- B: rb/STB
- μ: cP
- k: md
- h: ft
- r: ft
- t: hours
- φ: fraction
- c_t: 1/psi
- Month length is the calendar days of the month × 24 h.

**Sign.** Injection q ≥ 0; a negative rate is refused with a message.

**Bounds** (each failure is refused with a message naming the input):
- k: 0.01–10,000 md
- h: 1–5,000 ft
- φ: 0.01–0.40
- c_f: 1e-7 to 1e-4 /psi
- r_w: 0.1–2 ft
- s: −5 to 50
- r_e: 100 ft to 50 miles (264,000 ft), and ≥ 100·r_w (≥ 100·r_wa when s < 0)
- A negative s requires r_w·e^(−s) < 0.1·r_e (closed boundary) and < 1,000 ft
- Subject schedule: 1–120 consecutive months, rates 0–100,000 STB/day
- Offset schedule: up to 600 months
- Offset distance: 100·r_w to 264,000 ft
- Absolute pressures must stay within 100–10,000 psia; outside that, the output is blocked

**Guard.**
- Every evaluated time since a rate change at the subject wellbore satisfies `t_D = 0.00026368·k·t/(φ·μ·c_t·r_w²) ≥ 100`, using r_wa when s < 0.
- Otherwise the result is blocked with: "the step is too short for this model (wellbore storage and early-time effects are not modelled)".

**Skin.**
- **s ≥ 0:** an additive term at r_w only.
- **s < 0:** the effective radius r_wa = r_w·e^(−s), with no added term.
- Skin is never applied at r > r_w, to the average pressure, or to offset contributions.
- Skin is never derived from, converted to, or labelled as J or the E05 J multiplier.

**Fluid.**
- μ, Bw and c_w come from `brineAtPressure(P_i, T, salinity)`.
- T is the well's `bottomholeTemperatureF`, otherwise the case's `fluid.temperatureF`.
- Salinity is the case's `fluid.salinityWtPercent`.
- c_t = c_w + c_f.

**Pressure basis.** Absolute outputs are `P = P_i + Δp` in psia (`bottomhole-absolute`) at the well's declared datum. The limit is `limitPsia`.

**Labels:**
- Rock, boundary, distances, connectivity, gap/after/prior rates and t_ref are *assumed*.
- Offset volumes are *reported*.
- Pressures and rates are *calculated*.
- A copied forecast is labelled "forecast (copied from disposal case, \<date\>)".

**Banned words.** Generated text must not contain `proven|sustainable|calibrated|validated|safe` (`BANNED` in `src/caseSummary.ts`).

**Fixed copy:**
- **#7 closing line:** "Screening estimate from assumed rock and fluid properties; not a calibrated or permitted pressure."
- **#8 closing line:** "Screening ranking from assumed reservoir properties and typed distances; closeness is not connectivity."
- **Hand-off note:** "You may type this as an assumed reservoir-pressure offset in Well-performance cases. It is not applied automatically. That offset applies to every well in the case, not only this one."
- **Ranking label:** "screening ranking under the stated assumptions; not a pressure forecast".
- **Fictional example label:** "fictional example — not typical values".

**Display only.** Nothing is fed back into `buildDisposalCase`; the E05 offset hand-off is a typed note only.

**Exports:**
- Sealed SHA-256 over key-sorted canonical JSON.
- Verify recomputes from the stored inputs, with an exact hash plus 1e-9 relative numeric tolerance.
- Downloads re-verify before saving.
- CSV in the 4-column long format `section,rule_or_well,field,value`.

## Review Focus

1. **Low-k, high-c_t inputs where the first month violates t_D ≥ 100.** The result is blocked with the exact guard sentence, never a number. (Task 3)
2. **Negative skin at −5 with a small r_e.** It is blocked by the effective-radius rule, and the rise is never negative during injection. (Tasks 2 and 3)
3. **A copied forecast with non-consecutive months.** Missing months become required empty fields, the run stays blocked until they are filled, and nothing defaults to 0. (Task 3)
4. **An offset with gaps, unconfirmed zero months, and no after-window choice, at a ranking date past its window.** The status is *incomplete*: no number and no rank; the view is incomplete. (Tasks 4 and 5)
5. **t_ref set, an offset with partial history, and falloff after its window.** It shows negative psi, "direction unknown", and "share not shown: mixed signs". (Task 5)
6. **Absolute pressure above 10,000 psia mid-schedule.** The output is blocked from that month with a message; nothing is extrapolated. (Task 3)

---

### Task 0 (orchestrator): branch, layer spec, archive

- [ ] `git checkout -b feature/e06-e07-transient-interference` from main `bdced55`.
- [ ] Write `migration/layer-specs/phase-3a-transient-and-interference.json`:
  - `purpose`: "#7 (ANA-E06) transient single-well buildup and #8 (ANA-E07) interference screening on one shared, display-only calculator inside the disposal case".
  - `acceptanceEvidence`: `demo/E06-E07-TRANSIENT-INTERFERENCE-VERIFICATION.md`.
  - `approvedDocs`: both specs and this plan.
  - `changes`: `web/import-ui.mjs`, `web/index.html`, `web/redesign.css`.
  - `newFiles`: every new `src/`, `web/` and `tests/` file named in Tasks 1–8.
  - `rootFiles`: `migration/layers/index.json`.
- [ ] Archive the before-images with `node scripts/record-layer.mjs phase-3a-transient-and-interference archive` from the repo root. If it refuses, byte-copy them and verify.
- [ ] Commit the plan, the layer spec and the archive.

### Task 1: `src/transientMath.ts`, constants and special functions

**Files:**
- Create `src/transientMath.ts`.
- Test: `tests/transient-math.test.mjs`.

**Interfaces.** Produces:
```ts
export const TRANSIENT_MATH_VERSION='transient-math/1';
export const C={pressure:141.2055,lineSource:70.603,tD:0.00026368,rinv:948.12,pss:0.074466,ft3PerBbl:5.6146} as const; // SI-derived
export const DISPLAY={pressure:141.2,lineSource:70.6,tD:0.0002637,rinv:948,pss:0.0744,ft3PerBbl:5.615} as const;
export function deriveConstants():typeof C;   // recomputes each from SI factors (md=9.869233e-16 m², ft=0.3048 m, cP=1e-3 Pa·s, bbl=0.158987294928 m³, day=86400 s, h=3600 s, psi=6894.757293168 Pa)
export function e1(x:number):number;          // x>0; series for x<=1, continued fraction above; throws on x<=0 or non-finite
export function besselI0(x:number):number; export function besselI1(x:number):number;
export function besselK0(x:number):number; export function besselK1(x:number):number; // x>0, relative accuracy <=1e-10
export function stehfest(F:(s:number)=>number,t:number,N?:number):number;      // N default 12, even
```

- [ ] **Step 1: Write the failing tests** (benchmarks 1 and 9):
  - **E1:**
    - For x < 0.004, |e1(x) − (−0.5772156649015329 − ln x)| / e1(x) < 1e-3.
    - Across x ∈ {0.5, 0.99, 1, 1.01, 2, 5, 20}, the series and continued-fraction forms agree (relative 1e-10). Expose the two internal forms for test as `_e1Series` and `_e1Cf`, or check continuity at x = 1.
  - **Bessel:**
    - The Wronskian `I0(x)K1(x)+I1(x)K0(x)=1/x` holds to 1e-10 for x ∈ {1e-3, 0.1, 1, 5, 20, 100}.
    - K0 and K1 are positive and decreasing.
  - **Stehfest:** L⁻¹[1/s²] = t, L⁻¹[1/(s+1)] = e^(−t) (t = 1, 2), and L⁻¹[K0(√s)/s] = ½E1(1/(4t)) for t ∈ {1, 10, 100}, each to relative 1e-5.
  - **Constants:** `deriveConstants()` equals `C` to relative 1e-4. Each `DISPLAY` value is within 0.1% of its `C` value.
  - **Guards:** e1(0), e1(−1), e1(NaN) and besselK0(0) throw.
- [ ] **Step 2:** tsc, then `node --test tests/transient-math.test.mjs` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** → PASS, and the full suite still passes.
- [ ] **Step 5 (orchestrator):** commit "E06/E07: transient math (constants, E1, Bessel, Stehfest)".

### Task 2: `src/transientModel.ts`, unit responses and superposition

**Files:**
- Create `src/transientModel.ts`.
- Test: `tests/transient-model.test.mjs`.
- Create the test helper `tests/helpers/radial-fd.mjs`: an implicit radial finite-difference solver, independent of the model (benchmark 7).

**Interfaces.** Consumes Task 1. Produces:
```ts
export const TRANSIENT_MODEL_VERSION='line-source-closed-circle-stehfest/1';
export type Rock={k:number;h:number;phi:number;ct:number;mu:number;B:number};            // ct total
export type Boundary={kind:'infinite'}|{kind:'closed';re:number};
export type Step={startHours:number;rateStbd:number};                                     // rate from startHours until next step
export function lineSourceRise(rock:Rock,r:number,tHours:number):number;                  // unit response u(r,t) per STB/day, no skin; 0 for t<=0
export function wellboreUnitRise(rock:Rock,b:Boundary,rw:number,skin:number,tHours:number):number; // per STB/day at r_w; s>=0 additive, s<0 r_wa form; closed via Stehfest
export function riseFromSteps(unit:(t:number)=>number,steps:readonly Step[],tHours:number):number; // Σ (q_j−q_{j−1})·unit(t−t_j)
export function tD(rock:Rock,r:number,tHours:number):number;
export function radiusOfInvestigation(rock:Rock,tHours:number):number;                   // sqrt(k t/(948.12 φ μ c_t))
export function averageRiseClosed(rock:Rock,re:number,rw:number,cumulativeStb:number):number; // 5.6146·Q·B/(c_t·π(re²−rw²)·h·φ)
```

**Rules:**
- **Infinite-acting wellbore:** `C.lineSource·B·μ/(k·h)·[e1(x_w)+2s]` with `x_w = C.rinv·φμc_t·r_w²/(k t)` for s ≥ 0. For s < 0, use e1 evaluated at r_wa with no skin term.
- **Closed circle:** the finite-wellbore, closed-outer, constant-rate solution in Laplace space (modified Bessel form), with skin added as `2s·(1/s_L)` for s ≥ 0 and r_wa for s < 0, inverted with `stehfest`. Use N = 12, raising it only if the tests require.

- [ ] **Step 1: Write the failing tests:**
  - **Benchmark 2, skin:**
    - Infinite-acting, s = 3 minus s = 0 equals `C.pressure·B·μ/(k·h)·3` at t ∈ {720, 8760} h (relative 1e-9).
    - `lineSourceRise` at r = 2·r_w is unchanged by skin, because it takes no skin parameter.
    - At s = −3 (effective radius), the late-time difference against s = 0 tends to `C.pressure·Bμ/(kh)·(−3)` within 1e-3 relative at t = 87,600 h.
    - Every rise at s = −5 is ≥ 0 for t_D(r_wa) ≥ 100.
  - **Benchmark 3, two rates:** steps `[{0,1000},{720,1500}]` at t = 1440 equals `1000·u(1440)+500·u(720)`, by a hand sum.
  - **Benchmark 4, falloff:** steps `[{0,1000},{2000,0}]`. At t = 2000 + Δt it equals `1000·(u(2000+Δt)−u(Δt))` (Horner). It tends to 0 as Δt grows (below 1% of peak at Δt = 2,000,000 h), and the skin term vanishes after shut-in.
  - **Benchmark 5, closed late time.** With r_e/r_w ≥ 1000:
    - The slope `d(rise)/dt` between t₁ and t₂ deep in pseudo-steady state, per hour and per STB/day, equals the material-balance slope `C.ft3PerBbl·B/(24·c_t·π·(r_e²−r_w²)·h·φ)`, within 1e-4 relative. This equals `C.pss·B/(φ·c_t·h·r_e²)` when r_e ≫ r_w.
    - The intercept equals `C.pressure·Bμ/(kh)·[ln(r_e/r_w)−0.75+s]` within 1e-3 relative.
    - `averageRiseClosed` equals the material balance within 1e-9.
  - **Benchmark 6, linearity:**
    - Doubling every rate doubles the rise.
    - Two equal halves equal one constant step.
    - The rise is non-decreasing in t at constant q, and non-increasing in k, h and c_t (except c_t at early time; test at late time).
  - **Benchmark 7, independent check:** the closed-circle wellbore response against `tests/helpers/radial-fd.mjs`, with a log-spaced grid of 200 and 400 cells and implicit time steps. The 400-cell run is closer than the 200-cell run (convergence). Agreement is within 0.5% at early, transition and late t_D.
  - **Benchmark 8:** before the boundary is felt (r_inv < 0.3·r_e), the closed and infinite responses agree within 1e-4 relative.
  - **#8 benchmark 6, point source:** `lineSourceRise` equals the Stehfest inversion of `C.lineSource·Bμ/(kh)·2K0(r_D√s)/s`, within 1e-5 relative, for a multi-step schedule through `riseFromSteps`.
  - **#8 benchmarks 3–5:**
    - Reciprocity: `lineSourceRise` at A–B equals B–A, which is trivially symmetric; assert this through `riseFromSteps` with swapped schedules of equal rate.
    - Similarity: equal r²/t gives an equal rise.
    - Late-time log difference: u(r₁) − u(r₂) tends to `C.pressure·Bμ/(kh)·ln(r₂/r₁)` within 1e-3.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implement. The FD helper lives only under `tests/helpers/`.
- [ ] **Step 4:** → PASS. Report each benchmark's achieved error in the report.
- [ ] **Step 5 (orchestrator):** commit.

### Task 3: `src/transientCase.ts`, the #7 case (inputs, guards, outputs, sensitivity)

**Files:**
- Create `src/transientCase.ts`.
- Test: `tests/transient-case.test.mjs`.

**Interfaces.**
- **Consumes:** Tasks 1 and 2; `brineAtPressure` (`src/brinePvt.ts`); `DisposalCase`/`DisposalWell` (`src/disposalCase.ts`); `BANNED`/`fmtNumber` (`src/caseSummary.ts`).
- **Produces:**
```ts
export const TRANSIENT_CASE_VERSION='transient-buildup/1';
export const CLOSING_7='Screening estimate from assumed rock and fluid properties; not a calibrated or permitted pressure.';
export const HANDOFF_NOTE='You may type this as an assumed reservoir-pressure offset in Well-performance cases. It is not applied automatically. That offset applies to every well in the case, not only this one.';
export const GUARD_TOO_SHORT='the step is too short for this model (wellbore storage and early-time effects are not modelled)';
export const FICTIONAL_EXAMPLE_LABEL='fictional example — not typical values';
export type RockInput={k:number;h:number;phi:number;cf:number;rw:number;skin:number};
export type TransientInput={wellId:string;rock:RockInput;boundary:{kind:'infinite';statedExtentFt:number|null}|{kind:'closed';re:number};
  schedule:{months:{month:string;rateStbd:number|null}[];origin:'typed'|{copiedFrom:string;copiedAt:string}};   // null = not yet typed
  profileMonths:string[];                                   // up to 3 months for the distance curve
  sensitivity:{[K in 'k'|'h'|'cf'|'skin'|'re']?:{low:number;high:number}}};
export const FICTIONAL_EXAMPLE:RockInput&{re:number};      // k 50, h 100, phi 0.15, cf 4e-6, rw 0.35, skin 2, re 3000 — fictional
export function scheduleFromForecast(result:DisposalCase,wellId:string,copiedAt:string):TransientInput['schedule']; // Base allocations[].averageStbd; fills the first..last month span, missing months rateStbd:null
export function validateTransientInput(result:DisposalCase,input:TransientInput):string[];  // [] when ready; else messages naming each input
export type TransientResult={inputs:TransientInput;well:{id:string;reservoirPsia:number;limitPsia:number;datum:string};fluid:{mu:number;B:number;cw:number;cf:number;ct:number;temperatureF:number;salinityWtPercent:number};
  monthly:{month:string;endHours:number;risePsi:number;skinPsi:number;bottomholePsia:number|null;blocked:string|null}[];
  firstMonthAtLimit:string|null;endBottomholePsia:number|null;profiles:{month:string;points:{rFt:number;risePsi:number}[]}[];
  averageRise:{month:string;psi:number}[]|null;handoff:{month:string;psi:number;note:string}|null;
  warnings:string[];sensitivity:{factor:string;low:{firstMonthAtLimit:string|null;endBottomholePsia:number|null};high:{…same}}[];
  assumptions:string[];closing:string;versions:Record<string,string>};
export function buildTransientCase(result:DisposalCase,input:TransientInput):TransientResult;    // throws Error(messages.join('; ')) if validate fails
```

**Rules:**
- **Validation** covers every bound in the Global Constraints. In addition:
  - the schedule must be consecutive, 1–120 months, with every rate non-null;
  - the case well must exist;
  - its datums must agree (reuse `validateInjector`).
- **Guard:** if any month's t_D at the end of its first step since a rate change is below 100, then that month and all later months get `blocked:GUARD_TOO_SHORT`, and from there `bottomholePsia` is null. Evaluate the guard per rate change at the first output time after it.
- **Absolute pressure:** `P_i + rise`. If it falls outside 100–10,000 psia, `blocked` reads "outside the 100–10,000 psia range of the fluid model" for that month and onward.
- **Distance profiles:** 25 log-spaced points from r_w·2 to r_e (closed) or to 2·r_inv (infinite). They are labelled "rise above initial; excludes skin".
- **Hand-off:** closed boundary only. It uses the average rise at the last schedule month with `HANDOFF_NOTE`.
- **Warnings:**
  - closed: "boundary reached" from the first month with r_inv ≥ r_e;
  - infinite with a stated extent: "results assume no edge, but pressure has reached the extent you stated".
- **Sensitivity:** one factor at a time, at low and high, with c_t recomputed from c_f. It is labelled "one at a time; not additive".
- **Assumptions:** the assumption bullets from spec §Assumptions, the c_w/c_f/c_t breakdown, and "reported/forecast rates are calendar-day averages (availability included)".

- [ ] **Step 1: Write the failing tests** (benchmark 10 and the review focus):
  - **Each bound refused with the input named:** k = 0.001, h = 0, φ = 0.5, c_f = 1e-3, r_w = 3, s = −6, r_e = 50, and r_e = 30 with r_w = 0.35 (the 100·r_w rule). A negative-skin effective radius ≥ 0.1·r_e is refused. A negative rate is refused.
  - **Review Focus 1:** k = 0.01, c_f = 1e-4, φ = 0.4 with a first month that fails t_D → `monthly[0].blocked===GUARD_TOO_SHORT`, and `bottomholePsia` is null.
  - **Review Focus 3:** `scheduleFromForecast` on a fictional case whose demand months are 2028-01, 2028-02 and 2028-04 → three months 01, 02, 03, 04 are required, with 03 null. `validateTransientInput` names the missing month, and nothing defaults to 0.
  - **Review Focus 6:** P_i 9,500 psia with a large rate → the month crossing 10,000 is blocked onward.
  - **First month at the limit:** a fictional case reaches its limit in a known month. The test asserts the month string, and that it equals the first month where `bottomholePsia ≥ limitPsia`. With an unreachable limit → null.
  - **Skin part:** `skinPsi` at a month equals `C.pressure·Bμ/(kh)·s·q_current`.
  - **Average rise:** closed only; infinite gives `averageRise===null` and `handoff===null`.
  - **Sensitivity:** high k gives a later or equal limit month; the `low`/`high` keys are present for each requested factor.
  - **Determinism:** two builds are deepEqual.
  - **Evidence only:** the case `result` deepEquals before and after.
  - **Banned words:** `BANNED` matches nothing in `assumptions`, `warnings`, `closing`, `HANDOFF_NOTE` or `FICTIONAL_EXAMPLE_LABEL`. No string contains "J multiplier", and no string equates skin with J.
  - **Fluid:** T comes from the well's `bottomholeTemperatureF` when set, otherwise from the case fluid. `ct = cw + cf` exactly.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5 (orchestrator):** commit.

### Task 4: `src/offsetHistory.ts`, #8 offset-well schedules

**Files:**
- Create `src/offsetHistory.ts`.
- Test: `tests/offset-history.test.mjs`.

**Interfaces.**
- **Consumes:** `PackageSet`, `joinedHistory`, `JoinedHistory` (`src/historyPackages.ts`, merged).
- **Produces:**
```ts
export const OFFSET_HISTORY_VERSION='offset-history/1';
export type AfterChoice={kind:'shut-in'}|{kind:'hold-average';lastN:number}|{kind:'typed';rateStbd:number};
export type OffsetChoices={uic:string;distanceFt:number;connected:boolean|null;zerosAreShutIn:boolean;gapRates:Readonly<Record<string,number>>;
  prior:{startMonth:string;rateStbd:number}|null;after:AfterChoice|null};
export type OffsetStatus='complete'|'incomplete'|'excluded';
export type OffsetSchedule={uic:string;status:OffsetStatus;gapMonths:string[];partialHistory:boolean;windowStart:string;windowEnd:string;
  steps:{month:string;rateStbd:number;origin:'reported'|'assumed-gap'|'assumed-prior'|'assumed-after'}[];afterLabel:string|null;labels:string[]};
export function offsetSchedule(set:PackageSet,c:OffsetChoices,throughMonth:string):OffsetSchedule;
```

**Rules:**
- **Reported months:** rate = `calculated_calendar_day_avg_bpd`.
- **Reported zero:** a zero step only if `zerosAreShutIn`; otherwise the month is a gap.
- **Gaps:** each gap needs `gapRates[month]` (≥ 0).
- **Before the window:** `prior` fills from its start month to the window start − 1. Without `prior`, `partialHistory:true`.
- **After the window, up to `throughMonth`:** an `after` choice is required.
  - `hold-average` averages the last N *reported* (> 0 or confirmed-zero) months and is labelled "assumed, from reported months X–Y".
- **Status:**
  - `excluded` if `connected===false`;
  - otherwise `incomplete` if any gap is unfilled, or if after-window months are needed without a choice;
  - otherwise `complete`.
- **Length:** a schedule over 600 months is refused.

- [ ] **Step 1: Write the failing tests:**
  - A gap month with no `gapRates` → `incomplete`, and the gap is listed. Filling it → `complete`.
  - A reported-zero month is a gap until `zerosAreShutIn`; then it is a zero step.
  - `throughMonth` past the window with `after:null` → `incomplete`. Each `AfterChoice` produces the expected steps, and `hold-average` cites its months.
  - `prior` null → `partialHistory:true`; with `prior` → steps start at `prior.startMonth` with origin `assumed-prior`.
  - Two packages with a gap between their windows → the between-months are gaps.
  - More than 600 months → throws.
  - `connected:false` → `excluded`.
  - Determinism.
- [ ] **Steps 2–5:** as before.

### Task 5: `src/interference.ts`, #8 views, ranking, limit month and sensitivity

**Files:**
- Create `src/interference.ts`.
- Test: `tests/interference.test.mjs`.

**Interfaces.**
- **Consumes:** Tasks 2, 3 and 4.
- **Produces:**
```ts
export const INTERFERENCE_VERSION='interference-screening/1';
export const CLOSING_8='Screening ranking from assumed reservoir properties and typed distances; closeness is not connectivity.';
export const RANKING_LABEL='screening ranking under the stated assumptions; not a pressure forecast';
export const EXCLUDED='excluded by assumption';
export type InterferenceInput={subject:TransientInput;tRef:string|null;rankingMonth:string;offsets:OffsetChoices[];
  sensitivity:{k?:{low:number;high:number};cf?:{low:number;high:number};distance?:Record<string,{low:number;high:number}>}};
export type OffsetRow={uic:string;status:'complete'|'incomplete'|'partial-history'|'not-felt-yet'|'excluded';addedPsi:number|null;share:number|null;
  distanceFt:number;directionUnknown:boolean;lowerBound:boolean;labels:string[]};
export type View={name:'all-connected'|'your-selection'|'none';status:'complete'|'incomplete';rows:OffsetRow[];totalPsi:number|null;shareNote:string|null;
  limitMonth:string|null;removalEffects:{uic:string;limitMonth:string|null}[]};
export type InterferenceResult={inputs:InterferenceInput;mode:'since-t-ref'|'rise-above-undisturbed';views:View[];
  sensitivity:{factor:string;rankChanged:boolean;rangeByUic:Record<string,{low:number|null;high:number|null}>}[];
  indistinguishable:[string,string][];warnings:string[];assumptions:string[];closing:string;versions:Record<string,string>};
export function buildInterference(result:DisposalCase,set:PackageSet,input:InterferenceInput):InterferenceResult;
```

**Rules:**
- **Rock and fluid:** the subject's (Task 3). Offsets use `lineSourceRise` at their distance, with no skin and no guard (spec amendment 3).
- **Modes:**
  - **With t_ref** (`mode:'since-t-ref'`): an offset's added psi is `Δp(t_rank) − Δp(t_ref)` from its full schedule.
    - The subject schedule must start the month after t_ref; otherwise refuse with a message.
    - Absolute values and limit months are reported.
  - **Without t_ref** (`mode:'rise-above-undisturbed'`): rises only; `limitMonth` null everywhere, and no absolute values.
- **Views:**
  - **`all-connected`:** every loaded offset counts as connected.
  - **`your-selection`:** each offset's own `connected`. Excluded rows read `EXCLUDED` with `addedPsi:null`, never 0.
  - **`none`:** the subject alone, equal to #7.
- **The run is refused until every offset has `connected!==null`.**
- **Row statuses:**
  - `incomplete` rows get `addedPsi:null` and no rank; a view with any incomplete counted row is `incomplete`.
  - `not-felt-yet` when distance > r_inv from that offset's first injection to `rankingMonth`. It is information only, and the number is still shown.
  - `partial-history` sets `lowerBound` without t_ref and `directionUnknown` with t_ref.
- **Order:** rows with a number, by signed `addedPsi` descending, then the rest by status.
- **Share:** `share` only when every counted contribution is ≥ 0 and the total is > 0. Otherwise `shareNote` = "share not shown: mixed signs".
- **Limit month** (with t_ref): the first month in which P_i + own rise + counted offsets' rise since t_ref ≥ `limitPsia`, searched to the subject schedule's end. `removalEffects` recomputes it with each counted offset removed in turn; label it one at a time, not additive.
- **Ranking month:** the default is the last month covered by every loaded package. A later month requires every connected offset to have an `after` choice, which Task 4's status enforces.
- **Sensitivity:**
  - k, c_f and each distance at low and high, one at a time.
  - `rankChanged` reports whether the order of numbered rows changes.
  - Two wells whose [low, high] ranges overlap are listed in `indistinguishable` and labelled "order not distinguishable".
- **Distance:** below 100·r_w or above 264,000 ft is refused.
- **Warnings:**
  - the subject's #7 boundary is closed → "interference uses the no-edge assumption";
  - an offset's r_inv passes the stated extent.
- **Assumptions:** the spec §Model assumption bullets, plus "reported bbl/day treated as STB/day; Bw from the subject's fluid".

- [ ] **Step 1: Write the failing tests** (#8 benchmarks 1, 2, 7–10 and Review Focus 4–5):
  - **B1:** one offset at distance r equals `lineSourceRise` × schedule at r. B2: N offsets equal the hand sum and are order-independent.
  - **B7:** a gap left unfilled, a missing after-choice past the window, or `connected:null` → incomplete or refused, never a number. A confirmed reported zero produces a falloff.
  - **B8:** a not-connected offset changes nothing; `none` deepEquals the #7 own rise.
  - **B9:**
    - With t_ref, an offset's `addedPsi` = Δp(t) − Δp(t_ref).
    - With t_ref before every offset's first month, the result equals the undisturbed rise.
    - With no t_ref, `limitMonth` is null in all views.
  - **B10:** changing the subject's skin changes only the subject's own term; every offset's `addedPsi` is unchanged.
  - **Review Focus 5:** an offset with t_ref, a partial history and a shut-in after its window → negative `addedPsi`, `directionUnknown`, `shareNote==="share not shown: mixed signs"`.
  - **Labels and order:** an excluded row reads `EXCLUDED` with `addedPsi===null`. The order is by signed psi.
  - **Indistinguishable:** two offsets at 1,000 and 1,050 ft with distance ±20% → listed as indistinguishable.
  - **Distance floor:** refused below the floor.
  - **Banned words** in all text; `CLOSING_8` and `RANKING_LABEL` are exact.
  - **Determinism.**
- [ ] **Steps 2–5:** as before.

### Task 6: `src/transientExport.ts`, sealed JSON and CSV

**Files:**
- Create `src/transientExport.ts`.
- Test: `tests/transient-export.test.mjs`.

**Interfaces.**
- **Consumes:** Tasks 3 and 5; the canonical-JSON, seal and tolerant-compare approach of `src/caseInsights.ts` (copy the pattern; do not import its private helpers unless exported).
- **Produces:**
  ```ts
  export const TRANSIENT_EXPORT_SCHEMA='transient-interference-export/1';
  export type TransientExport={caseInputs:DisposalCase['inputs'];transient:TransientResult;interference:InterferenceResult|null;packages:{uic:string;artifactId:string;manifestSha256:string;window:{startMonth:string;endMonth:string;source:string};monthly:PublicMonthly[]}[]};
  export async function sealTransient(x:TransientExport):Promise<SealedTransient>;
  export async function verifyTransient(s:SealedTransient):Promise<SealedTransient>;
  export function transientJson(s):string;
  export function transientCsv(s):string;
  ```
- **Verify** rebuilds the case with `buildDisposalCase(caseInputs)`, the transient with `buildTransientCase`, and the interference from a PackageSet rebuilt from `packages`. It compares structurally with 1e-9 relative tolerance, and requires an exact hash.
- **The CSV** uses the 4-column long format, with sections `assumptions`, `transient-monthly`, `transient-profile`, `sensitivity`, `interference-<view>`, `warnings` and `closing`.

- [ ] **Step 1: Write the failing tests:**
  - A round trip verifies, with and without interference.
  - Rejected:
    - a tampered rise without resealing;
    - a resealed tampered rise (recomputation);
    - an edited distance;
    - an edited package monthly row.
  - Every CSV line has 4 fields, and the CSV includes both closing lines.
  - Determinism: two seals of the same input are byte-identical.
- [ ] **Steps 2–5:** as before.

### Task 7: the panel for #7 (protected `web/import-ui.mjs`, `web/index.html`, `web/redesign.css`)

**Files:**
- Create `web/transient-buildup.mjs`: a pure session, `createTransientSession`, plus `mountTransientBuildup(root,{getSource})`.
- Create `web/transient-worker.mjs`, with the actions `calculate`, `interference` and `verify`.
- Modify `web/index.html`: one empty container, `<section id="transient-buildup" class="panel" hidden aria-labelledby="transient-buildup-title"></section>`.
- Modify `web/import-ui.mjs`: import plus mount, and `$('case-insights').after($('transient-buildup'))`. Add as few lines as possible.
- Modify `web/redesign.css`: add `#transient-buildup` to the sensitivity-view hide rule.
- Test: `tests/transient-session.test.mjs`.

**Behaviour:**
- The panel title is "Pressure buildup over time (assumed rock)".
- **Before any case result:** the panel is hidden and shows "Load or calculate a disposal case to choose a well".
- **Controls:**
  - a well picker over the case wells;
  - rock inputs, empty by default;
  - "Load fictional example" (fills `FICTIONAL_EXAMPLE`, label `FICTIONAL_EXAMPLE_LABEL`);
  - a boundary choice, with r_e or a stated extent;
  - a schedule table, either typed or filled by "Copy this well's Base forecast allocation". Copied missing months are empty required fields labelled "not in the disposal case: enter a rate (0 = shut in)";
  - up to 3 profile months;
  - sensitivity low/high.
- **Calculate** runs in the worker.
- **Output:**
  - a bottomhole-against-time SVG with the limit line (no thinning, D16);
  - the first month at the limit or "not reached within the schedule";
  - the end pressure, with "of which skin: N psi";
  - the profiles;
  - the average rise and the hand-off note (closed boundary);
  - warnings and blocks verbatim;
  - the sensitivity table "one at a time; not additive";
  - assumptions and the closing line;
  - JSON and CSV downloads, re-verified in the worker.
- **Invalidation:** any input or disposal-case change withdraws the results and downloads (`disposal-case-invalidated`, plus a generation as in E05).

- [ ] **Step 1: Write the failing session tests** (DOM-free):
  - No result → not ready.
  - Copying the forecast with a missing month → calculation blocked until it is filled.
  - Any input edit withdraws the result and refuses an in-flight export.
  - A source switch (getSource) clears the inputs.
  - Determinism of the snapshot.
  - `import-ui.mjs` CR count is 4, and `index.html` is 3 (read the files in the test).
- [ ] **Steps 2–4:** as before. Then run the full suite and `node scripts/check-carried-oracles.mjs` (248/0).
- [ ] **Step 5 (orchestrator):** commit.

### Task 8: the "Nearby wells" section for #8, inside the #7 panel

**Files:**
- Modify `web/transient-buildup.mjs` (new in Task 7; not protected).
- Test: extend `tests/transient-session.test.mjs`.

**Behaviour.** Section title: "Nearby wells (interference screening)".
- **Before the subject's buildup has inputs:** "Set up the subject well's buildup first".
- **Its own package set** (`historyPackages.ts`), with the loader control as in #9: `verifyExplorerPackage`, then `packageFromVerified`, then `addPackage`, with refusal alerts.
- **Per offset UIC:**
  - distance (ft, *assumed*);
  - a connected / not-connected radio with no default;
  - a "treat reported zero months as shut in" checkbox with no default;
  - gap-month rate inputs;
  - an optional prior rate and start month;
  - an after-window choice: shut in, hold the average of the last N, or a typed rate.
  - The evidence beside each well is the typed distance, the permitted interval "as reported; depth basis unknown" when present, and the window. There is no field number and no auto-decision.
- **"Pressure as of" month,** optional; without it, the stated rise-only mode applies.
- **Ranking month,** defaulting to the last month covered by every loaded package.
- **Run** goes to the worker `interference` action.
- **Output:**
  - the three views side by side (stacked on mobile), with the ranking table columns UIC, status, added psi, share, distance;
  - `RANKING_LABEL`, the limit month and the removal effects;
  - the sensitivity "rank changes" and "order not distinguishable" notes;
  - warnings, assumptions and `CLOSING_8`.
- **Exports** include the interference.
- **Invalidation:** any offset input, package change or subject change withdraws the results. A source switch clears the offsets' inputs and keeps the packages.

- [ ] **Step 1: Write the failing session tests:**
  - The run is refused while any offset has `connected===null`.
  - Removing a package withdraws its offset row inputs.
  - Without t_ref, no limit month is shown.
  - An excluded row's text is `EXCLUDED`.
  - A source switch clears the offset choices and keeps the packages.
- [ ] **Steps 2–5:** as before. Then run the full suite and the oracles.

### Task 9 (orchestrator + qa): verification, evidence, layer

- [ ] **Browser check** (skill `browser-check`, agent `qa`), at 1280×900 and 390×844, with fictional packages from `tests/helpers/explorer-v4.mjs` built in the scratchpad:
  1. A `user` case: well A, the fictional example, closed boundary, forecast copied with a missing month → blocked until filled → calculate shows the limit month, the skin part, the profile, the average rise and the hand-off note.
  2. Low k → the guard sentence shows and no number appears.
  3. Edit an input → results and downloads are withdrawn.
  4. Nearby wells: two fictional packages at 1,000 and 3,000 ft. One is connected with gaps unfilled → incomplete, no number. Fill the gaps and run → three views.
  5. With t_ref: the limit month and the removal effects show. Without t_ref: no limit month.
  6. JSON verifies in Node, and every CSV line has 4 fields.
  7. Sample case → the panel works on the sample wells, and the existing E05 and E10 output is unchanged.
  8. No console errors.
  9. Mobile: no horizontal page scroll.
- [ ] **Write `demo/E06-E07-TRANSIENT-INTERFERENCE-VERIFICATION.md`** in the E10 format. Include a benchmark table listing every #7 benchmark (1–10) and #8 benchmark (1–10) with its achieved error.
- [ ] **Full gate:** expect 6/8 before the accept; the two failures are the pending-layer checks, as by design. Check the CR byte counts.
- [ ] **Record the layer pending,** then commit.
- [ ] **The owner accepts** with `! cd tmp/lovable-transfer/well-injection-insights && node scripts/record-layer.mjs phase-3a-transient-and-interference accept "<owner>"`. Then run verify (0 violations) and check-all (8/8), and commit.
- [ ] **Push and PR only on the owner's instruction:** "Closes #7", "Closes #8". After the merge, a Lovable publish is required.
