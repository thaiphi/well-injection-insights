# Phase 2a: WHP/BHP reconciliation and pressure-margin screening — design

**Status.** The design was approved section by section in chat on 2026-11-05. This written spec awaits owner review.
**Requirement.** PRD ANA-E04, with acceptance scenarios §8 #4 and #5, under decisions D5, D8, D9, D16 and D19.
**Demo wells.** Barbaro 23 SWD (UIC 000125182, v4, with BHP tests) and TRIPPET SWD (UIC 000109605, v5, no tests).
**Base.** main 5bc1690. Branch `feature/phase-2a-pressure-reconciliation`.

## Goal

For each H-10 month kept in the 1a review, the panel models the flowing bottomhole pressure from the reported surface pressure. It uses the existing traverse: P_bh = P_wh + ΔP_hydrostatic − ΔP_friction. It then screens three separate margins:
- **regulatory:** the reported surface pressure against the permit;
- **modelled hydraulic:** at depth, against the permit-equivalent pressure and an optional declared limit;
- **formation:** not evaluated.

In months containing an included BHP test, the panel shows the modelled flowing pressure next to the measured static pressure. It flags the case where the model falls below the measurement.

The phase also makes one set of declared well assumptions, including the H-10 and permit pressure basis, shared by the 1c J panel and this panel. This removes 1c's unconfirmed "+14.7 psi" on H-10 and permit pressures.

## Claim and wording

- **Panel title:** "WHP/BHP reconciliation (screening)".
- **Fixed text, on the panel and in every export:** "Screening only: not a regulatory approval, compliance finding or safe-operating determination."
- **Test-month differential:** labelled "flowing minus static differential, not a model error".
- **Permit-equivalent margin:** labelled "restates the permit limit at depth; not an independent constraint".
- **Formation margin:** always "Not evaluated in this phase". It never says "safe", and it never says "no evidence" when step-rate records exist.
- **Banned word:** "calibrated" never appears in the panel, its exports or its SVG.

## Owner decisions (from brainstorming)

| # | Decision |
|---|---|
| Q1 | B: model the flowing bottomhole pressure monthly. In test months, show modelled flowing − measured static, and flag a negative value as "model below measured static pressure: assumptions or test reading inconsistent". |
| Q2 | A: H-10 pressures and the permit liquid pressure limit are psig by default. The user confirms the basis with a reason, and the psia reading is a sensitivity. The traverse uses gauge + 14.7. The regulatory margin compares the permit with the monthly maximum on the same basis, with no conversion. |
| Q3 | B: the modelled hydraulic margin is measured against the permit surface limit carried to depth at the month's rate (permit-equivalent BHP), plus an optional user-declared bottomhole limit. The formation margin is never evaluated. |
| Q4 | A: one shared set of declared well assumptions (surface-pressure basis, tubing, fluid, temperatures, segments, depth basis) drives both the 1c J panel and this panel. |
| Approach | 1: a shared well-assumptions module and a new reconciliation panel. A Fable review (2026-11-05) added two refinements: 1c's flowing-pressure helper moves into the shared module so both panels use one physics path, and the J session API is kept, with the shared panel calling it. |

## Architecture

### New units

| Unit | Responsibility | Depends on |
|---|---|---|
| `src/wellAssumptions.ts` | Pure. `WellAssumptions`, `DEFAULT_WELL_ASSUMPTIONS`, `validateWellAssumptions`, `confirmSurfaceBasis`, `toAbsolute(psi, basis)`, and `flowingAt(depthFt, a, rateStbd, surfacePsia, idOverride?)`. `flowingAt` is moved byte-for-byte in behaviour from 1c's private `flowing()`. | `wellboreTraverse` |
| `src/pressureReconciliation.ts` | Pure. Report depth, per-month rows, margins, test-month differentials, sensitivities and counts. Method `pressure-reconciliation/1`. | `wellAssumptions`, `h10Diagnostics` state, `testRecords` state, `injectivityEstimate` (BHP basis and matches) |
| `src/pressureReconciliationChart.ts` | One SVG with two plots on a shared month axis | reconciliation result |
| `src/pressureReconciliationExport.ts` | `sealReconciliation`, `verifyReconciliationSealed`, JSON/CSV/SVG, using the 1a/1b/1c sealing pattern | reconciliation result |
| `web/well-assumptions.mjs` | DOM-free session, with a revision counter and `onChange`, plus the shared form | `wellAssumptions` |
| `web/reconciliation.mjs` | DOM-free session (revision, stale-export refusal, gate, memoised result per revision) and the panel | the units above |

### Changed accepted units (all in the new layer)

- **`src/injectivityEstimate.ts`:**
  - `flowing()` is removed in favour of `flowingAt`.
  - `Assumptions` and `DEFAULT_ASSUMPTIONS` are re-exported from `wellAssumptions`, so the tubing, fluid and segments assumptions are a subset of the shared ones.
  - `evaluate()` converts the H-10 average with `toAbsolute`, using the confirmed surface basis.
  - `handoff()` converts the permit with `toAbsolute`.
  - `estimate()` refuses all tests with "Confirm the H-10 and permit pressure basis in Well assumptions" while the surface basis is unconfirmed.
  - `LIMITATIONS[3]` is rewritten to: "H-10 average pressure is a monthly figure, not a flowing pressure measured at the time of the test; it is converted on the user-confirmed surface basis (<value>: <reason>)."
  - Method and export schema become `test-referenced-j/2` and `test-referenced-j-export/2`. The sealed JSON gains `surfaceBasis`.
  - `verifyEstimateSealed` accepts `/1` and `/2`.
  - When a bottomhole limit is declared at the report depth, the hand-off `limitPsia` is prefilled from it, with origin "Declared by the user in WHP/BHP reconciliation (<reason>)". Otherwise it stays "Not set from evidence; declare it."
- **`web/injectivity.mjs`:**
  - The assumptions fieldset moves out of the panel.
  - `createInjectivitySession` takes `wellAssumptions` and `reconciliationLimit` inputs. Its existing calls (`setAssumptions`, `update`, `confirmBasis`) are kept, and the shared panel drives `setAssumptions`.
  - The BHP basis form stays in the J panel.
- **`web/import-ui.mjs`:**
  - Mount order: H-10 → Test records → Well assumptions (`#well-assumptions`) → J (`#injectivity-estimate`) → Reconciliation (`#pressure-reconciliation`).
  - `clearResults` disposes all five panels.
  - One refresh fans out in a fixed order (assumptions → J → reconciliation). Each consumer swallows and logs its own errors, following the 1c `refreshJ` ruling.
  - The 4 CR bytes on the last 4 lines are preserved.
- **Tests updated in this layer:**
  - `tests/injectivity-estimate.test.mjs`, `tests/injectivity-export.test.mjs` and `tests/injectivity-session.test.mjs`: shared basis inputs, `/2`, and the hand-off limit.
  - `tests/panel-hooks.test.mjs`: the I-3 marker check moves to the shared form.
  - `tests/hydraulics-handoff.test.mjs`: the `limitPsia` origin.

**Not changed:** `src/disposalCase.ts`, `src/wellboreTraverse.ts`, `src/disposalSensitivity.ts`, `src/h10Diagnostics.ts`, `src/testRecords.ts`, `web/hydraulics.mjs` and the carried oracles.

## Shared well assumptions

| Field | Default | Bounds and rules |
|---|---|---|
| `surfaceBasis` | `null` (psig preselected in the form) | `{value:'psig'\|'psia', reason}`. The reason is required, at most 200 characters. It covers H-10 average and maximum pressures and the permit liquid pressure limit. |
| `innerDiameterInches` | 3.958 | as in 1c `validateAssumptions` |
| `roughnessInches` | 0.0006 | as in 1c |
| `surfaceTemperatureF`, `bottomholeTemperatureF` | 70, 100 | as in 1c |
| `salinityWtPercent` | 10 | 0–20 (D9) |
| `segments` | 32 | integer 8–256 |
| depth basis | "Vertical well declared; MD = TVD" | fixed statement |

- **`toAbsolute(psi, basis)`** returns psi + 14.7 (`ATMOSPHERE_PSI`) for psig and psi for psia. It is the only place a surface or permit pressure is converted.
- **The form:** each input is labelled "declared assumption", and focus is restored after re-render.
- **Changes:** any change increments the revision and notifies J, then the reconciliation panel.

**Equivalence requirement.** With `surfaceBasis = psig` confirmed and the default assumptions, every 1c J value, refusal reason, round-trip row and hand-off value is identical to 1c at 5bc1690. Only the method string, schema string, `surfaceBasis` field and the limitation text change.

## Reconciliation

### Inputs

- the 1a `DiagnosticsState` (months and decisions);
- the 1b test state, including `referenceDepthFt` and `referenceTie`;
- the shared `WellAssumptions`;
- from the J estimate: the BHP basis confirmation and each test's matched month, including user moves;
- from the inventory: `permit_liquid_pressure_limit_psi` and `permitted_top_depth_ft`;
- optionally, `declaredLimit = {psia, depthFt, reason}`.

### Report depth (one per well, with its source shown)

1. The 1b reference test depth (`referenceDepthFt`) when it is not null and `referenceTie` is false. Source: "BHP test depth".
2. Otherwise `permitted_top_depth_ft` when it is a finite number from 1 to 50000. Source: "permitted top of interval (RRC guidance)". When a tie caused the fallback, the source text says so.
3. Otherwise none. Every traverse is refused with "No report depth: no test depth and no permitted top depth".

Using the 1b reference depth matches the J estimate's own depth rule, so the test-month differential matches the J estimate's pressure difference.

### Per month

The panel lists every month in the H-10 range. Months excluded in 1a are listed with the status "Excluded in the H-10 review", and gap months with "No H-10 report"; neither gets a margin. Nothing is shown as zero when it is missing.

For each included month:
- **Regulatory margin = permit psi − `maxPsi`**, as reported, on one basis.
  - Statuses: "No permit pressure limit in the inventory"; "No maximum reported" (the average is never substituted); "Not applicable (no injection)" when the rate is zero or missing.
  - A negative value is flagged "reported maximum above permit limit (screening, not a compliance finding)".
- **Modelled flowing BHP = `flowingAt(reportDepth, a, rateBpd, toAbsolute(avgPsi, basis))`.** The result carries `pwf`, `hydro` and `friction`.
  - Refusals, in this order:
    1. "No report depth" (as above);
    2. "No injection in the month" (rate zero or missing);
    3. "No average pressure reported";
    4. "Average below the 100 psia traverse floor (D9)";
    5. the traverse's unsupported reason (domain or velocity).
  - A numerical traverse error is converted to the refusal "Traverse did not converge", so a panel never loses its controls.
  - A refusal never removes the month's regulatory margin.
  - Rate note: "Calendar-day average rate; it understates the rate while the well is actually injecting, so friction is understated and the modelled pressure reads high."
- **Permit-equivalent BHP = `flowingAt(reportDepth, a, rateBpd, toAbsolute(permitPsi, basis))`.** The margin is permit-equivalent minus modelled, with the label from "Claim and wording". It is computed only when both traverses succeed.
- **Declared margin = `declaredLimit.psia` − modelled.** It is computed only when |declaredLimit.depthFt − reportDepth| ≤ 1 ft. Otherwise the status is "Limit datum differs from report depth; no comparison" (§8 #4). When no limit is set, the status is "No limit declared".
- **Formation margin:** "Not evaluated in this phase". When step-rate rows exist, the panel adds: "Step-rate records carry fracture-pressure fields; this phase does not use them."

### Test months

For each included BHP test whose matched month (from the J estimate, including moves) is an included month with a modelled BHP:
- **Differential = modelled pwf − P_res,** where P_res = `toAbsolute(bhp, bhpBasis)`.
  - The BHP basis is the J panel's confirmed basis. Until it is confirmed, the status is "Confirm the BHP basis in the J panel".
  - With the shared tubing ID, the value equals the J estimate's `deltaPsi` for that test, and a test pins this.
- **Depth check:** a test more than 10 ft (`DEPTH_TOLERANCE_FT` in `testRecords.ts`) from the report depth gets "Test depth differs from report depth; no differential".
- **Negative differential:** flagged with the Q1 wording and a cause checklist:
  1. "Shut-in days included in the monthly average pressure."
  2. "Brine column density or salinity differs from the declared assumption."
  3. "Test taken with pressure held on the tubing."
  4. "Calendar-day rate understates the rate while injecting."
- **Gradients shown side by side:**
  - the test gradient, `bhpPsia / depthFt` (the record's own gradient field is not substituted);
  - the modelled column gradient, `hydro / reportDepth`.

### Sensitivities

For the modelled BHP and the differential, the panel computes values:
- under the other surface-basis reading;
- for tubing IDs 3.958, 4.892 and 6.276 in (`TUBING_SENSITIVITY_IN`).

A larger ID means less friction and a higher modelled BHP. The chart band and the table show the minimum and maximum.

### Counts

Months in range · included · modelled · refused (by reason) · test months · negative differentials · months above the permit.

## Panel

- **Order of elements:**
  1. Title.
  2. A persistent `role=status` element.
  3. The counts line.
  4. Waiting states:
     - "Confirm the H-10 and permit pressure basis in Well assumptions." — nothing computed;
     - "Confirm the BHP basis in the J panel." — differential column only.
  5. The margin summary: the smallest regulatory, permit-equivalent and declared margins, with the formation line.
  6. The declared-limit form (psia, depth prefilled with the report depth, reason, Clear).
  7. The month table.
  8. The chart.
  9. Downloads.
  10. The screening text.
- **Month table:** scrolls inside its container, with `th scope=col`. Columns:
  - month, rate, average, maximum, regulatory margin;
  - modelled BHP, hydrostatic, friction;
  - permit-equivalent BHP and its margin;
  - declared margin;
  - differential, test gradient, column gradient;
  - status or reason.
  Flagged rows show the checklist.
- **Interaction:** focus is restored after re-render. The render is guarded so a failure keeps the forms, as in 1c I-3.
- **Downloads:** disabled with the reason shown until the surface basis is confirmed.

## Chart

One SVG, with two plots on a shared month axis. There is no thinning, and missing months stay as gaps (D16).

- **Top plot:**
  - modelled flowing BHP (line), with a band spanning the tubing and basis sensitivities;
  - permit-equivalent BHP (dashed);
  - the declared limit (horizontal line), if set;
  - BHP tests as distinct markers labelled "measured static".
- **Bottom plot:** regulatory margin bars, with negative bars marked.
- **Notes:** the basis statement, the report depth and its source, and the rate note.
- **Banned word:** none of the chart text contains "calibrated".

## Exports

- **Files:** JSON, CSV and SVG, named `pressure-reconciliation-<uic>-<sha12>.<ext>`.
- **Sealed JSON:** schema `pressure-reconciliation-export/1`, method `pressure-reconciliation/1`. It contains:
  - the label and the screening text;
  - the assumptions with the surface basis and its reason;
  - the BHP basis;
  - the report depth and its source;
  - the permit values and the declared limit;
  - the rows, sensitivities, counts, units, formulas and limitations;
  - `source`: package and artifact hashes, the 1a decisions, the 1b inclusions and upload list, and the J matches;
  - `contentSha256`.
- **Verification:** `verifyReconciliationSealed` recomputes the hash.
- **CSV:** escapes formula-leading cells and writes "unavailable" for missing values.
- **Stale exports:** an export is refused when the revision has changed since render.

## Testing

All test data is synthetic, using fictional UIC 000000417. No real-package values appear. Checks run through direct Node paths.

- **`tests/well-assumptions.test.mjs`:**
  - `toAbsolute`;
  - the validation bounds;
  - `flowingAt` equals the previous 1c helper on the fixture (values pinned from 5bc1690).
- **J equivalence:**
  - With psig confirmed and the defaults, every J value, refusal, round-trip row and hand-off value matches 5bc1690.
  - With psia confirmed, the surface pressures and the permit in the hand-off shift by exactly −14.7.
  - With the basis unconfirmed, the J estimate refuses with the shared-basis message.
  - A `/1` export from the fixture still verifies.
- **`tests/pressure-reconciliation.test.mjs`:**
  - Sign convention: P_bh = P_wh + hydro − friction. Results match a direct `traverseBrineWell` call to 1e-9.
  - Report-depth fallback: reference depth → tie → permitted top → none.
  - Every refusal and status listed above, including the floor at an average of 85 psig and a numerical error converted to a refusal.
  - The regulatory margin never uses the average, and is not applicable with zero rate.
  - The declared-limit datum check, at depths 1 ft and 2 ft off.
  - The differential equals the J estimate's `deltaPsi`. A negative differential carries the flag and the checklist.
  - Sensitivity ordering: a larger ID gives a higher modelled BHP.
  - Gap and excluded months are never zero.
  - Counts add up.
- **`tests/pressure-reconciliation-export.test.mjs`:** seal and verify; a tampered copy fails; CSV escaping and "unavailable"; screening text present; no "calibrated" in the JSON, CSV or SVG; chart gaps preserved.
- **`tests/reconciliation-session.test.mjs`:**
  - the waiting states;
  - the fan-out order;
  - a throwing consumer doesn't block the others;
  - the memoised result is reused within a revision;
  - stale export refusal;
  - render-guard and focus behaviour (fake DOM, as in 1c);
  - `clearResults` disposes all five panels.
- **Hand-off:** the declared limit at the report depth prefills `limitPsia` with its origin; at another depth it does not.
- **Existing suites:**
  - all existing app and root tests pass, apart from the updated 1c tests named above;
  - the carried oracles stay at 248/0;
  - CR bytes are 0 in new files, and `import-ui.mjs` keeps exactly 4.

## Preservation and evidence

- **New layer:** `phase-2a-pressure-reconciliation`.
  - It is archived before any edit.
  - It lists the changed accepted files and the new files, and pins this spec and the plan.
  - The owner runs the acceptance.
- **Evidence record:** `demo/PRESSURE-RECONCILIATION-VERIFICATION.md`, with:
  - commands and counts, RED → GREEN, and review outcomes;
  - a browser check at 1280 and 390 px on a synthetic package: basis waiting states; margins and the declared limit including a datum mismatch; a negative-differential flag in a synthetic test month; exports verify; no page-level horizontal scroll; no console errors;
  - J equivalence on the synthetic package after psig is confirmed.
- **Real artifacts:** Explorer is read only, via `git archive` at texas-rail-sync `0933590`, into the scratchpad. Counts only: no per-month or per-test values and no table screenshots.
  - Barbaro 23 v4: counts and refusal reasons, test months and negative differentials.
  - TRIPPET v5: counts, including the no-injection and floor refusals.

## Out of scope

- using step-rate fracture-pressure fields for a formation margin;
- transient or multiwell analysis (E06, E07, E10);
- scenario expansion (2b, E05);
- any change to `disposalCase.ts`, the scenario calculation or `web/hydraulics.mjs`;
- regulatory or compliance determinations;
- hosted transfer;
- licensing changes, which are tracked separately.
