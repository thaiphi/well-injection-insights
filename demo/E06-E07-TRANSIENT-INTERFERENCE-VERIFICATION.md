# ANA-E06 transient buildup + ANA-E07 interference screening verification (acceptance evidence for layer phase-3a-transient-and-interference)

Date: 2026-11-16. Issues: thaiphi/well-injection-insights #7 and #8. Branch `feature/e06-e07-transient-interference`.

- Designs:
  - `docs/superpowers/specs/2026-11-10-e06-transient-buildup-design.md` (#7, approved 2026-11-10, with its #8 amendment note).
  - `docs/superpowers/specs/2026-11-15-e07-interference-screening-design.md` (#8, approved 2026-11-15).
- Plan: `docs/superpowers/plans/2026-11-15-transient-and-interference.md`.
- The layer stays recorded as pending-review until the owner accepts it.

## What changed

A new panel, **"Pressure buildup over time (assumed rock)"**, sits under "What the case says" in the Disposal capacity workspace.

- **The subject well (#7).** For one well of the user's disposal case, the user types an assumed rock and boundary. They then type a monthly schedule, or copy the well's Base forecast allocation into one. The panel returns:
  - bottomhole pressure against time, compared with the limit;
  - the first month the limit is reached;
  - the skin part of the rise;
  - pressure-against-distance tables;
  - the average rise and the hand-off note (closed boundary only);
  - warnings and a one-at-a-time sensitivity table.
- **The section inside the panel, "Nearby wells (interference screening)" (#8).** The user loads Explorer H-10 packages for offset wells into the panel's own package set. For each well the user types a distance and states whether the well is connected, how reported zero months count, the gap rates, an optional prior rate and the after-window choice. The section then:
  - ranks the offsets by the signed pressure each adds at the subject well;
  - shows three views ("all connected", "your selection", "none");
  - shows the limit month and the effect of removing each well, but only with a "pressure as of" month (t_ref);
  - runs the sensitivity on k, c_f and each distance.
- **Display only.** Nothing feeds back into `buildDisposalCase`. The hand-off to Well-performance cases is a typed note only.

| Part | Files | What it does |
|---|---|---|
| Maths | `src/transientMath.ts` | Constants derived from SI units: 141.2055, 70.603, 0.00026368, 948.12, 0.074466 and 5.6146 (rounded textbook values are for display only). Also E1, I0/I1/K0/K1 plus their exponentially scaled forms, and the Gaver–Stehfest inversion (N = 12). |
| Model | `src/transientModel.ts` | The line-source unit response at any distance (no skin), the wellbore response (infinite: E1 with additive skin, or r_wa when s < 0; closed circle: van Everdingen–Hurst finite wellbore in scaled-Bessel ratio form, inverted by Stehfest), rate-step superposition, t_D, r_inv and the material-balance average rise. |
| #7 case | `src/transientCase.ts` | Every input bound; the t_D ≥ 100 guard; the 100–10,000 psia fluid-model block; `limitStatus` (reached / not reached / not determined); profiles; average rise and hand-off; warnings; sensitivity; assumptions; labels. Fluid properties come from `brineAtPressure(P_i, T, salinity)`, with c_t = c_w + c_f. |
| Offset histories | `src/offsetHistory.ts` | Builds each offset's monthly schedule from the merged loader (`historyPackages.ts`): reported months, confirmed zeros, typed gap rates, prior rate, and the after-window choice. A gap or an unconfirmed zero is never a 0 rate; it makes the well *incomplete*. |
| #8 screening | `src/interference.ts` | One calendar clock for the subject and the offsets. "Pressure as of" subtraction. Three views. Signed order. A share shown only when every sign is the same. The limit month with removal effects that carry their "not determined" reason. A per-view monthly series, whose absolute value is blocked outside 100–10,000 psia. Sensitivity with rank change and "order not distinguishable". |
| Exports | `src/transientExport.ts` | Schema `transient-interference-export/1`, sealed with SHA-256 over key-sorted canonical JSON. Verify rebuilds the case, the buildup and the screening from the stored inputs, with a 1e-9 relative tolerance. The CSV uses the existing 4-column long format and carries every assumed input and choice, every manifest SHA-256 and window, the reported permitted interval, and both closing lines. |
| Panel | `web/transient-buildup.mjs`, `web/transient-worker.mjs` | A pure session plus the DOM, in the E05 pattern: generation and sequence counters, the worker actions `calculate`, `interference` and `verify`, and downloads re-verified in the worker before saving. |

**What withdraws results:**
- **Every result is withdrawn by:**
  - any subject input;
  - any disposal-case change;
  - a source switch, which also clears the inputs (packages are kept).
- **Only the screening is withdrawn by:**
  - any offset input;
  - any package change.

**Protected files changed**, with before-images in `migration/baselines/phase-3a-transient-and-interference-before/`:
- `web/index.html`: one empty `<section id="transient-buildup">` after `case-insights`. It still has exactly 3 CR bytes.
- `web/import-ui.mjs`: two lines, the import plus the mount and `$('case-insights').after($('transient-buildup'))`. The page moves `case-insights` at runtime, so the `.after` is needed. It still has exactly 4 CR bytes.
- `web/redesign.css`: one selector added to the sensitivity-view hide rule. It has 0 CR bytes.

All 16 new files have 0 CR bytes.

## Commands (direct Node paths; Node v24.13.0)

From `swd-injection-analytics/`:
- `node ../node_modules/typescript/bin/tsc -p tsconfig.json`: clean.
- `node --test tests/*.test.mjs`: **960 tests, 960 pass, 0 fail**. The baseline was 789.
- `node scripts/check-carried-oracles.mjs`: 248 comparisons, 0 failures.

From the repository root:
- `node scripts/prepare-swd.mjs` exits 0.
- `node scripts/check-all.mjs` gives 6 of 8 before the accept. The two failures are the pending-layer checks, by design.

Each task was written test first; the engineer reports record the failing runs.

## Benchmarks (achieved error)

### #7 (spec §Benchmarks 1–10)

| # | Check | Tolerance | Achieved |
|---|---|---|---|
| 1 | E1 against −γ − ln x, for x < 0.004 | 1e-3 | 7.8e-4 (worst, at x = 0.0039) |
| 1 | E1 series against continued fraction across the switch, x ≤ 5 | 1e-10 | 1.4e-13 |
| 1 | E1 against an 80-digit reference at 7 points up to x = 20 (replaces the series check at x = 20, where the series loses all digits in double precision) | 1e-10 | pass |
| 2 | Infinite-acting: (s = 3) − (s = 0) against 141.2055·Bμ/(kh)·3 | 1e-9 | 4.3e-16 |
| 2 | Closed circle: the same shift (skin added after the inversion) | 1e-9 | 4.3e-16 |
| 2 | s = −3, late time, against 141.2055·Bμ/(kh)·(−3) | 1e-3 | 3.5e-6 |
| 2 | s = −5: every rise ≥ 0 for t_D(r_wa) ≥ 100 | ≥ 0 | holds |
| 3 | Two-rate superposition against the hand sum | 1e-12 | 0 |
| 4 | Falloff against the Horner form; residual at Δt = 2e6 h | 1e-12; < 1% | 1.3e-16; 0.0038% |
| 5 | Closed late-time slope against material balance | 1e-4 | 1.6e-5 |
| 5 | Intercept against 141.2055·Bμ/(kh)·[ln(r_e/r_w) − 0.75 + s] | 1e-3 | 1.4e-5 |
| 5 | `averageRiseClosed` against material balance | 1e-9 | 0 |
| 6 | Linearity (doubling, halves) and monotonicity | 1e-14 | 0 / holds |
| 7 | Closed circle against the independent radial finite-difference helper (`tests/helpers/radial-fd.mjs`): 200, 400 and 800 cells, t_D 100 to 2e6. The grid converges at second order (each refinement reduces the change about 4×). | 0.5% | 8.3e-6 (400 cells) |
| 7 | Closed-boundary distance profile against an FD cell-pressure probe (task review) | 0.5% | 1e-6 to 1e-4 |
| 8 | Closed against infinite before the boundary is felt (t_D ≥ 1e4; see "Rulings") | 1e-4 | 3.5e-5 |
| 9 | Constants re-derived from SI factors | 1e-4 | < 4e-6 |
| 9 | Bessel Wronskian, x from 1e-3 to 100, and scaled forms at x from 1e3 to 1e8 | 1e-10 | 4.4e-16 |
| 9 | Stehfest on K0(√s)/s against ½E1(1/(4t)) | 1e-5 | 2.0e-6 |
| 10 | Every bound, the t_D guard, a negative rate, negative-skin r_wa, and the PVT block each give their message, never a number | exact | pass |

### #8 (spec §Benchmarks 1–10)

| # | Check | Tolerance | Achieved |
|---|---|---|---|
| 1 | One offset against `lineSourceRise` superposed over its schedule (hand sum on a calendar clock) | 1e-12 | pass |
| 2 | N offsets against the hand sum; order-independent | exact | pass |
| 3 | Reciprocity with swapped schedules; the rise depends only on distance | exact | equal |
| 4 | Similarity, (r, t) against (2r, 4t) | 1e-14 | 0 |
| 5 | Late-time log difference against 141.2055·Bμ/(kh)·ln(r₂/r₁) | 1e-3 | 5.5e-5 |
| 6 | Point source against the Stehfest inversion of 2K0(r_D√s)/s (multi-step schedule) | 1e-5 | 3.4e-7 |
| 7 | A gap, a missing after-choice, or connected = null is incomplete or refused, never a number. A confirmed zero gives a falloff. | exact | pass |
| 8 | A not-connected offset changes nothing; "none" equals #7 row for row | exact | pass |
| 9 | "Pressure as of" subtraction; t_ref before every offset equals the undisturbed rise; no t_ref gives no limit month | exact | pass |
| 10 | The subject's skin changes only its own term | exact | pass |

## Acceptance

| Criterion | Result | Evidence |
|---|---|---|
| #7: bottomhole against time, the limit month, skin part, profiles, average rise and hand-off | PASS | Browser scenario 1, plus `transient-case.test.mjs` |
| #7: a step too short for the model gives the guard sentence, never a number | PASS | Browser scenario 2 (low k), plus Review Focus 1 tests |
| #7: negative skin is bounded by the effective-radius rule, and the rise is never negative | PASS | Review Focus 2 tests |
| #7: a copied forecast with missing months stays blocked until filled; nothing defaults to 0 | PASS | Browser scenario 1, plus Review Focus 3 tests |
| #7: absolute pressure outside 100–10,000 psia is blocked from that month on, in #7 and in every #8 view | PASS | Review Focus 6 tests, plus recheck item 5 |
| #7: any input or case change withdraws results and downloads | PASS | Browser scenario 3, plus session tests |
| #8: incomplete offsets show no number and no rank; the view is incomplete | PASS | Browser scenario 4, plus Review Focus 4 tests |
| #8: signed contributions; "share not shown: mixed signs"; "direction unknown" | PASS | Review Focus 5 tests |
| #8: three views; "none" equals #7; excluded wells read "excluded by assumption"; "none" rows read "not counted in this view (subject alone)" | PASS | Browser scenario 4 and recheck item 3 |
| #8: limit month and removal effects with t_ref only; "not determined" is never shown as "not found" | PASS | Browser scenario 5 and recheck item 1 |
| #8: no defaults on connectivity or zero months; no inferred connectivity | PASS | Browser scenario 4 |
| Exports: sealed JSON verifies in Node; every CSV line has 4 fields; both closing lines; every assumed input and choice | PASS | Browser scenario 6 and recheck item 6, plus `transient-export.test.mjs` |
| The sample case works, and the E05 and E10 output is unchanged | PASS | Browser scenario 7: SHA-256 of the E05 summary lines and E10 rows equal a main `bdced55` build, before and after a panel run |
| No banned words; no skin-as-J wording | PASS | Tests in every module |

## Browser evidence (QA agent, headless Chrome over CDP)

Driver: `demo/e06-e07-evidence/e0607-check.mjs`; recheck: `e0607-recheck.mjs`. Notes: `QA-NOTES.md`. Statuses and hashes: `results-desktop.json`, `results-mobile.json` and `results-recheck.json`.

Every scenario passed at 1280×900 and at 390×844, both on the first pass (93357c7) and on the recheck after the final fix wave. The recheck items are D1, D2, the "none" wording, the pre-run checks, high pressure, CSV/JSON, the full re-run, and console/layout.

| # | Scenario | Result |
|---|---|---|
| 1 | Fictional example, closed boundary, copied forecast with a missing month (blocked until filled). Calculate: limit month, skin part, profiles, average rise, hand-off | PASS |
| 2 | Low k: the exact guard sentence and no number; "not determined", never "not reached" | PASS |
| 3 | An edit withdraws results and downloads; focus is kept while typing; a refused copy during a run does not stop the run | PASS |
| 4 | Two fictional packages at 1,000 and 3,000 ft: refused before "connected"; incomplete with gaps unfilled; three views once complete | PASS |
| 5 | With t_ref: limit month and removal effects. Without t_ref: no limit month and no absolute values | PASS |
| 6 | Both JSON files verify in Node; every CSV line has 4 fields; both closing lines | PASS |
| 7 | Sample case: the panel works; E05 and E10 hashes equal main | PASS |
| 8 | No console errors (favicon 404 only) | PASS |
| 9 | Mobile: no horizontal page scroll; the three views stack | PASS |

The gate output in `QA-NOTES.md` was taken before the final fix wave (944 tests). The counts above are after it.

**Data rule:**
- The QA packages are fictional, built from `tests/helpers/explorer-v4.mjs`. They are kept in the session scratchpad only.
- No downloaded file and no screenshot is committed; only `screenshots-SHA256SUMS.txt` is.
- The sample case holds real TRRC wells. Its text is digit-redacted in the results, and its E05 and E10 lines are kept as SHA-256 only.
- All test fixtures are fictional.

## Reviews

**Per-task reviews.** Each task had an independent Opus or Sonnet reviewer, plus a scoped re-review.

| Task | Fix rounds | What was fixed |
|---|---|---|
| 1 | 1 | Bessel overflow above x ≈ 700. Scaled forms were added. |
| 2 | 1 | Minors: a fragile convergence check, skin added after the inversion, NaN time, and the reciprocity test. |
| 3 | 1 | Blocked months carry null; `limitStatus` added; profiles clamped; r_inv measured from the first injection; named messages. |
| 4 | 1 | A ranking month before a well's window is refused. |
| 5 | 1 | A fluid-model block with counted offsets; the per-view monthly series and labels were added. |
| 6 | none | Approved on the first pass. |
| 7 | 1 | Displayed inputs could drift from the calculated draft; the example label rule. |
| 8 | 1 | Permitted interval added to exports; a refused load no longer cancels a run. |

**The final whole-branch review** returned "with fixes": three Important findings and no Critical ones.
- **I1:** the absolute pressure in a view was not range-blocked.
- **I2:** a removal effect read "not found" when the result was in fact not determined. QA found the same issue as D1.
- **I3:** the CSV lacked the input values and choices.

**One fix wave** covered I1–I3, M1 (the partial-history note), M3 (pre-run t_ref checks), QA D2 (the copy date now uses the local date), and the "none" wording ruling. A follow-up hides the offsets' rise in view-blocked months. The scoped re-review returned "Ready to merge: Yes", and the QA recheck passed.

**Main's rulings** (the full list is in the SDD ledger):
- **Fixed copy:** the #7 closing line contains "calibrated" in the negative ("not a calibrated or permitted pressure"). It is fixed copy, so the banned-word test exempts only that exact line.
- **Stehfest N:** N stays 12. Stehfest is weak on exponentials (e^(−t) reaches only 4.3e-4 at N = 12, and it is tested at N = 18); the model's own transforms meet 1e-5 at N = 12.
- **Early-time difference:** the no-edge option uses the line source at the wellbore, while the closed option uses the finite wellbore. They differ by up to about 0.5% at t_D = 100. This is physics, not an error, and the assumptions say so. Benchmark 8 is therefore asserted at t_D ≥ 1e4.
- **Limit status:** a month blocked above 10,000 psia counts as reaching the limit (the limit is at most 10,000). A guard block before any crossing gives "not determined", never "not reached".
- **Unread package fields:** a resealed edit to a package field the calculation never reads is not detectable by recomputation. This is the same integrity model as E05.
- **Schema version:** the schema stays at `/1`, because it was never released.

**Deferred minors** (each judged safe to defer by the final review):
- The guard message names the scaled Bessel function.
- Before the first injection, a closed profile gives 25 zeros and a no-edge profile gives none (the panel shows "no injection yet" for both).
- copiedAt `0000-01-01` passes.
- Stray gap-rate keys are ignored.
- A later block above 10,000 psia after an earlier own crossing stays "not determined" (conservative).
- Quoted newlines in CSV text cells.
- "unavailable" is used for unchosen optional CSV choices.
- The order rule can mark "order not distinguishable" more often than the rank change does.

## Not covered

- **The subject's own prior injection before t_ref.** The #8 spec allows an optional assumed prior rate for the subject well. The plan did not schedule it, so the screen states "The subject's own injection before t_ref is not modelled". Whether to add it is an owner decision.
- **Profiles are tables, not a chart.** The spec leaves the layout to the builder.
- **"Load fictional example" fills rock and boundary only.** The example has no schedule, and the user copies or types one.
- **Publishing on Lovable,** which the owner does after merge.
