# Phase 1c: test-referenced injectivity (J) estimate — design

Status: design approved section by section in chat on 2026-11-03; this written spec awaits owner review. Demo well: Barbaro 23 SWD (UIC 000125182). Requirement: PRD ANA-E03 under decision D5.

## Goal

Estimate an injectivity index J = q / (P_wf − P_res) for one well from its BHP test records (1b) and its reviewed H-10 months (1a). Show every estimate with its full basis, datum, uncertainty and assumptions. Let the user carry a chosen estimate into the existing Hydraulics workspace (constant-J injection curve). The phase also fixes the 1b gap where the Test records panel is absent when a well has tests but no H-10 rows.

## Claim and wording (D5)

- The result is always called **"Test-referenced J (estimate)"**. The word "calibrated" is never applied to it, in the UI, exports or SVG.
- Basis statement shown with every value: measured static reservoir pressure (BHP test), modelled flowing bottomhole pressure (from H-10 surface pressure through the wellbore traverse), declared tubing and fluid assumptions, monthly calendar-day average rate.
- `J_READINESS` in `src/testRecords.ts` is rewritten to:
  `Calibrated injectivity (J): not available. A test-referenced estimate is shown in the panel below; a calibrated J needs a measured flowing bottomhole pressure at a known rate, for example from step-rate test analysis, which is out of scope.`
  `LABEL_BHP` and `LABEL_BHP_BASIS` stay unchanged on the raw 1b records.

## Owner decisions (from brainstorming)

| # | Decision |
|---|---|
| Q1 | Estimate J, show it with all its evidence, and allow its use in the existing constant-J scenario. |
| Q2 | P_wf comes from the scenario's own `traverseBrineWell` (surface boundary), so the estimate round-trips. A no-friction check (fluid column at the test's own reported gradient) is shown alongside. Tubing size is a sensitivity. |
| Q3 | Each BHP test is matched to the H-10 month containing its date; that month must still be included in the 1a review. The user may move a match to the previous or next month with a recorded reason. One J per test. Unmatched tests are listed with reasons. |
| Q4 | BHP is psig by default (RRC Permian guidance) but the user must confirm the basis, with a reason, before any J is shown. J under the psia reading is shown as a sensitivity. The scenario receives psia (psig + 14.7, sea-level atmosphere, declared). |
| Q5 | Every J is shown; the user chooses which goes to the scenario (default: the latest matched test), with the choice and reason recorded. The min–max of the matched J values is offered as the injectivity sensitivity sweep. A trend is shown when two or more values are comparable. |
| Q6 | Wording as above; never "calibrated". |
| Approach | New estimate module and panel; `disposalCase.ts` and the scenario calculation are not changed. |

## Architecture

New units:

| Unit | Responsibility | Depends on |
|---|---|---|
| `src/injectivityEstimate.ts` | Pure: build state, match tests to months, apply decisions (basis, moved match, chosen J), per-test J, sensitivities, round-trip check, hand-off payload. Method `test-referenced-j/1`. | `h10Diagnostics` state, `testRecords` state, `wellboreTraverse` |
| `src/injectivityEstimateChart.ts` | One SVG: J per test over time, with bars spanning the basis and tubing sensitivities | estimate state |
| `src/injectivityEstimateExport.ts` | Sealed JSON/CSV/SVG export, verify function, same sealing pattern as 1a/1b | estimate state |
| `web/injectivity.mjs` | DOM-free session (revision counter, stale-export refusal, gate) and the panel | the three modules above |

Changed units:

- `web/import-ui.mjs`: mount the J panel after Test records with live H-10 and test states; panel-gap fix. The file's 4 CR bytes on its last 4 lines are preserved.
- `web/h10-diagnostics.mjs`, `web/test-records.mjs`: each exposes a read-only `state` getter and an on-change callback so the J panel recomputes after any 1a or 1b decision. Their existing behaviour and exports are unchanged.
- `src/testRecords.ts`: `J_READINESS` text only. This changes the 1b sealed export text; the 1b export tests are updated for that string only.
- `web/hydraulics.mjs`: a prefill entry point that accepts the hand-off payload and labels each prefilled field with its origin.

Not changed: `src/disposalCase.ts`, `src/wellboreTraverse.ts`, `src/disposalSensitivity.ts`, the carried oracles.

## Data flow

1. User reviews H-10 months (1a) and includes BHP tests (1b).
2. The estimate state matches each included BHP test to a month (default: containing month).
3. User confirms the basis and the declared assumptions.
4. For each qualifying test:
   - P_res (psia) = test pressure + 14.7 under the psig reading; = test pressure under the psia reading.
   - P_wf from `traverseBrineWell({well, fluid, settings, rateStbd: q, boundary: {location: 'surface', pressurePsia: H-10 average + 14.7}})`, with TVD = MD = test depth.
   - J = q / (P_wf − P_res), STB/day/psi.
   - No-friction check: P_wf,nf = H-10 surface pressure (psia) + G × test depth, where G = reported test pressure / test depth (psi/ft). G is the fluid-column gradient only if the shut-in surface pressure was about zero; this is stated with the check. J_nf = q / (P_wf,nf − P_res). The check is independent of tubing and fluid assumptions.
   - J for each tubing size in the sensitivity list.
5. User chooses the J to use (default latest).
6. "Use in scenario" prefills the Hydraulics workspace; the round-trip check is shown.

Datum: P_res and P_wf are both at the test depth (top of the completed interval, per the RRC guidance), so they share one datum, which is carried to the scenario.

## Qualifying conditions

A test gets a J only when all hold; otherwise it is listed with the first failing reason (exact reason strings fixed in the plan):

1. BHP record, included in 1b, with a valid date, pressure and depth.
2. Depth within the 1b reference-depth tolerance (`DEPTH_TOLERANCE_FT`, 10 ft) of the 1b reference depth.
3. Basis confirmed.
4. The matched month is a reported month (not a gap), still included in 1a, with rate > 0 and an average pressure.
5. H-10 average pressure + 14.7 ≥ 100 psia.
6. The traverse succeeds. A `TraverseError` other than `numerical` (velocity > 5 m/s, pressure outside domain) is reported as "unsupported" with the traverse message; a `numerical` error blocks the estimate. Nothing is clamped.
7. P_wf > P_res; otherwise "Flowing pressure not above reservoir pressure; no J."

A test dated outside the H-10 range is unmatched ("before / after the H-10 range"). With no H-10 rows at all, every test is unmatched with "No H-10 months to match."

## Declared assumptions (editable, exported as user assumptions)

| Value | Default | Note |
|---|---|---|
| Tubing ID | 3.958 in (4½″) | No public tubing record. Sensitivity always runs 3.958, 4.892 (5½″) and 6.276 (7″) in. |
| Roughness | 0.0006 in | Coated tubing |
| Geometry | MD = TVD = test depth | Vertical well |
| Surface temperature | 70 °F | |
| Bottomhole temperature | 100 °F | |
| Salinity | 10 wt% NaCl | |
| Rate | H-10 calendar-day average, bbl/day treated as STB/day | |
| Atmosphere | 14.7 psi | Sea level |

Bounds follow the existing validators (`validateSegmentedSettings`, Hydraulics field bounds).

Stated limitations (exported):

- The calendar-day rate understates the onstream rate whenever the well had downtime, so J reads low; no correction is made.
- The matched month contains the ≥ 24 h shut-in for the test.
- H-10 average pressure is a monthly figure, not a flowing pressure measured at the time of the test.
- Tubing, temperatures and salinity are not from public records.
- The basis of the BHP field is unresolved in the source; the confirmed reading is the user's.

## Results shown per test

P_res (psig + 14.7, and as reported), P_wf with its hydrostatic and friction parts, Δp, J, J_nf, J under the psia reading, J per tubing size, the matched month and its rate and surface pressure, and the match origin (default or moved, with reason).

Trend: shown only when two or more J values share depth (within tolerance), basis and assumptions.

## Round-trip check

For each matched month, run `segmentedHydraulicPoint` (existing scenario code) with P_res and the chosen J at that month's rate. For the test whose J was chosen, the reproduced surface pressure must be within 0.5 psi of the observed H-10 average + 14.7; otherwise exports and the hand-off are refused with the residual shown. For the other matched months the residual is shown, making the spread between tests visible.

## Panel

"Test-referenced J (estimate)", below Test records, in the 1a/1b style:

1. Status line: matched, unmatched and qualifying counts, plus the readiness text.
2. Basis confirmation: required radio choice, psig (default, RRC guidance) or psia (as the source field is named), with a reason. No J is displayed until confirmed.
3. Assumptions form, each field labelled "declared assumption".
4. Match table: date, depth, matched month (move to previous/next with reason), q, surface pressure, P_res, P_wf, Δp, J, J_nf, J (psia reading), J range across tubing sizes, "use this J" choice. Unmatched tests listed below with reasons.
5. Chart.
6. Round-trip table: observed vs reproduced surface pressure and residual for each matched month.
7. Actions: Download JSON / CSV / SVG and "Use in scenario", blocked with the reason while stale or while the calculation gate is not ready.

Stale state: any change to a 1a or 1b decision, an assumption, the basis, a moved match or the chosen J increments the revision; an export or hand-off from an older revision is refused. When the gate is not ready, matches and reasons still display but exports and the hand-off are blocked.

## Hand-off to the Hydraulics workspace

Prefilled, each with an origin label:

- `injectivityStbdPerPsi`: chosen J.
- `reservoirPsia`: chosen test's P_res in psia.
- `datum`: "Top of completed interval at <depth> ft TVD, from BHP test <date>".
- `tvdFt`, `measuredDepthFt`: test depth.
- `innerDiameterInches`, `roughnessInches`, `temperatureF`, `surfaceTemperatureF`, `salinityWtPercent`: declared assumptions.
- `surfaceLimitPsia`: inventory permitted surface pressure + 14.7, labelled as the permit value; left unset with a flag when the inventory has none.
- `rateStbd`: the chosen test's matched-month rate.
- `limitPsia` (bottomhole limit): not prefilled; flagged "Not set from evidence; declare it."

A field the user edits afterwards is labelled "user override". The matched-J min–max is offered as the injectivity sweep in the existing sensitivity tool. No new tabs and no scenario calculation change. The capacity-against-demand route through the disposal-case workspace is confirmed during planning; if it needs more than its existing import path, scope returns to the owner first.

## Panel-gap fix

The Test records panel no longer depends on the H-10 diagnostics panel's range. With no H-10 rows it mounts with `range: null`, lists every dated test labelled "No H-10 range; no timeline markers", and the J panel shows "No H-10 months to match." The exact failing line is pinned by a failing test before the fix.

## Testing

All tests synthetic on UIC 000000417; no Barbaro values. Tests import from `dist/` after `tsc`.

- Matching: default containing month; moved match requires a reason and is recorded; excluded-in-1a and gap months refused; out-of-range and depth-mismatch tests listed with reasons.
- Basis: no J before confirmation; psig adds 14.7; psia reading as a sensitivity.
- Every refusal reason above has a test (below 100 psia, velocity > 5 m/s, P_wf ≤ P_res, no rate, no pressure, no depth).
- J arithmetic against an independent hand calculation for a no-friction case and a known traverse case.
- Tubing sensitivity ordering: larger ID, less friction.
- Round trip within 0.5 psi; a forced mismatch refuses export.
- Selection: latest is the default; the user's choice is recorded with its reason.
- Revisions: every 1a/1b decision change yields a new revision; stale exports and hand-offs are refused.
- Export: sealed `test-referenced-j/1` verifies; tampering refused; CSV formula injection escaped; SVG text contains "estimate" and never "calibrated".
- Web session: gate not ready blocks exports and the hand-off; hand-off payload has the exact fields and origin labels, bottomhole limit unset; user edits labelled as overrides.
- Panel gap: a package with tests but no H-10 rows renders both panels (shown RED first).
- Existing suites pass: 1b export tests change only for the new `J_READINESS` string; everything else unchanged (currently 523 app tests, 112 root tests, 248 carried-oracle comparisons).

## Preservation and evidence

- New layer `phase-1c-test-referenced-j`, archived before any edit, listing the changed and new files above and pinning this spec and the plan. The owner runs the acceptance.
- `demo/TEST-REFERENCED-J-VERIFICATION.md`: commands and counts, RED → GREEN, review outcomes, and two walkthroughs:
  - Barbaro 23 v4 package (read-only via Explorer `git archive` into the scratchpad): counts only (matched, unmatched with reason), round-trip pass/fail, hand-off prefilled the Hydraulics workspace, screenshots. No per-test values recorded.
  - TRIPPET SWD v5 (no tests): the "no qualifying tests" state.

## Out of scope

SRT analysis; measured flowing BHP (hence no "calibrated" claim); multi-well J; hosted transfer; any change to `disposalCase.ts` or the scenario calculation.
