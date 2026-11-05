# WHP/BHP reconciliation verification (acceptance evidence for layer phase-2a-pressure-reconciliation)

Date: 2026-11-05. Branch: `feature/phase-2a-pressure-reconciliation`, at spec commit 5c39c00 and plan commit 1ff044b (after the rebase onto main 7cce61c). The code is in the working tree and will be committed after acceptance. Tracked as GitHub issue #5 (PRD ANA-E04).
- Design: `docs/superpowers/specs/2026-11-05-pressure-reconciliation-design.md`, approved by the owner on 2026-11-05.
- Plan: `docs/superpowers/plans/2026-11-05-pressure-reconciliation.md`, approved by the owner on 2026-11-05 together with subagent-driven execution.
- The layer stays recorded as pending-review until the owner accepts it.

## What changed

- **Well assumptions (new panel, between Test records and the J panel).**
  - One declared set of assumptions: tubing ID, roughness, temperatures, salinity and segments.
  - A required, user-confirmed pressure basis for the H-10 and permit pressures (psig or psia, with a reason). This basis is shared by the J estimate and the reconciliation.
  - `src/wellAssumptions.ts` is the only place that adds 14.7 psi. `flowingAt` is the 1c traverse helper, moved there unchanged.
- **Test-referenced J on the shared basis.**
  - The method is now `test-referenced-j/2` and the export schema `test-referenced-j-export/2`.
  - Until the surface basis is confirmed, a matched test waits with "Confirm the H-10 and permit pressure basis in Well assumptions."
  - With both bases set to psig and the default assumptions, the estimate, the sealed fields and the hand-off are identical to 1c. A golden file captured from 5bc1690 pins this (`tests/fixtures/test-referenced-j-v1-golden.json`, sha12 `d8859736adf5`).
  - A `/1` sealed export still verifies.
  - A declared bottomhole limit within 1 ft of the J datum prefills the Hydraulics `limitPsia`.
- **WHP/BHP reconciliation (screening), a new panel below J.** For each H-10 month in range it shows:
  - the regulatory margin: permit minus the reported maximum, on one basis;
  - the modelled flowing BHP at the report depth, from P_bh = P_wh + hydrostatic − friction through the existing traverse, with a sensitivity band over the other basis reading and the tubing IDs;
  - the permit-equivalent margin, labelled "restates the permit limit at depth; not an independent constraint";
  - the declared-limit margin, compared only within 1 ft of the report depth;
  - the formation margin, "Not evaluated in this phase".
  - In months that hold a BHP test, it shows the "flowing minus static differential, not a model error". A negative differential is flagged and carries a four-item cause checklist.
  - Every refusal has its own reason, and nothing is zero-filled.
- **Sealed exports** (`pressure-reconciliation-export/1`, method `pressure-reconciliation/1`) in JSON, CSV and SVG. The JSON carries the bases, assumptions, report depth and its source, the permit values, the declared limit, the 1a decisions, the 1b inclusions and uploads, the J matches, units, formulas, limitations and a content hash. An export started before any change resolves to "The selection changed while preparing this export. Download again."
- **Wiring.** `web/import-ui.mjs` mounts the panels in the order H-10 → Test records → Well assumptions → J → Reconciliation. One refresh updates J first, then the reconciliation. A J-panel action refreshes the reconciliation only. `clearResults` disposes all five panels.
- **Unchanged.** `src/disposalCase.ts`, `src/wellboreTraverse.ts`, `web/hydraulics.mjs`, `web/navigation.mjs`, `web/index.html` and the carried oracles.

The changed and new files are listed in `migration/layer-specs/phase-2a-pressure-reconciliation.json`. The before-images of the 8 changed files are archived under `migration/baselines/phase-2a-pressure-reconciliation-before/`.

## Commands (direct Node paths only)

From the nested app folder:
- `node ../node_modules/typescript/bin/tsc -p tsconfig.json`: clean.
- `node --test tests/*.test.mjs`: 636 tests, 636 pass, 0 fail. The baseline was 578.
- `node scripts/check-carried-oracles.mjs`: 248 comparisons, 0 failures.

From the repository root:
- `node scripts/prepare-swd.mjs`: exit 0.
- `node scripts/record-layer.mjs phase-2a-pressure-reconciliation`: pending-review.
- `node scripts/verify-preservation.mjs .`: 182 checked; exactly one violation, the pending layer itself.
- Root tests: 120 tests, 119 pass. The 1 failure is the live-root preservation test, which fails on that same pending violation and clears on acceptance.

File checks:
- CR bytes are 0 in every new or changed file except `web/import-ui.mjs`.
- `web/import-ui.mjs` keeps exactly 4 CR bytes, on its last four lines (now 338–341).

## RED to GREEN

| Task | RED | GREEN (full suite after the task) |
|---|---|---|
| 0. Layer spec, archive, golden | n/a | `archived 8`; golden `test-referenced-j-export/1 2 d8859736adf5`; 578/578 |
| 1. Well assumptions core; J on the shared basis | `ERR_MODULE_NOT_FOUND` for `dist/wellAssumptions.js` | 588/593; the 5 known session failures were expected until Task 4 |
| 2. Reconciliation core | Module not found | 604/609 after fix round 1 |
| 3. Chart and sealed export | Module not found | 611/616 after fix round 1 |
| 4. Well assumptions panel; J session on the shared basis | Module not found | 620/620 |
| 5. Reconciliation session and panel | Module not found | 628/629 after fix round 1; only the wiring test failed, as expected until Task 6 |
| 6. Wiring and layer record | Wiring test failing | 631/631 after fix round 1; 636/636 after the final-review fix wave |

## Synthetic browser check (fictional UIC 000000417)

- **Setup.** `PORT=4290 node scripts/serve.mjs`, headless Chrome over the DevTools protocol, driver `demo/pressure-reconciliation-evidence/recon-check.mjs`.
- **Package.** Built in memory by the v4 test helper and stored only in the session scratchpad. It holds four BHP tests at 3310 ft and one step-rate row, inside a 16-month H-10 range. One test (2024-11-15, 3000 psi) is set high on purpose so that its differential comes out negative.
- **Viewports.** 1280×900 and 390×844 (mobile).
- **Outputs.** Results are in `results-desktop.json` and `results-mobile.json`, screenshots in `<tag>-c<N>-*.png`, and the synthetic downloads in `downloads/<tag>/`. `verify-recon-downloads.mjs` checks the JSON.

Both viewports gave the same result for every row.

| # | Check | Result |
|---|---|---|
| 1 | Panel order: Test records → Well assumptions → J → Reconciliation | PASS |
| 2 | Before the surface basis is confirmed, J and the reconciliation both show "Confirm the H-10 and permit pressure basis in Well assumptions." The reconciliation shows no counts line, no margin summary and no rows, and its downloads are disabled | PASS |
| 3 | Confirm psig in Well assumptions and psig in J. J reads "BHP tests: 4 · matched: 4 · unmatched: 0 · not usable: 0 · qualifying: 3"; the high test is refused as "not above". The reconciliation reads "Months in range: 16 · included: 16 · modelled: 16 · refused: 0 · test months: 4 · negative differentials: 1 · months above the permit: 0", with "16 of 16 included months modelled at 3310 ft (BHP test depth)." The chart notes state both bases | PASS |
| 3b | The negative test month shows "model below measured static pressure: assumptions or test reading inconsistent" once, with the cause checklist ("Shut-in days included in the monthly average pressure." …) | PASS |
| 4 | A declared limit of 4000 psia at the report depth shows a margin. The status reads "Declared bottomhole limit set." and focus stays on the Set/Change limit button. Moving the limit depth 2 ft gives "Limit datum differs from report depth; no comparison" | PASS |
| 5 | Excluding 2024-09 in 1a: that row reads "Excluded in the H-10 review" and included/modelled drop to 15; re-including restores 16 | PASS |
| 6 | Switching the surface basis to psia moves the surface and modelled values. A JSON export started just before the switch is refused with "The selection changed while preparing this export. Download again." | PASS |
| 7 | JSON, CSV and SVG download as `pressure-reconciliation-000000417-<sha12>.<ext>`. The JSON verifies (true), a tampered copy fails (false), and none of the three files contains "calibrated" | PASS |
| 8 | No page-level horizontal scroll at 390 px or 1280 px. No console errors | PASS |

**A defect found by this check and fixed (ruling R6-1).** On the first run, confirming the BHP basis in the J panel did not refresh the reconciliation. The reconciliation's chart read "BHP tests read as not confirmed" and the differentials were missing until another panel changed. The fix: the J panel now raises `onChange` after a successful user action (but not on `update`), and import-ui uses it to refresh only the reconciliation, so the two cannot loop. Behavioural and source-level tests pin it.

The table above is from the final run, after the final-review fix wave. The JSON from that run verifies, as `pressure-reconciliation-000000417-b514c1808ef2.json`.

**J equivalence.** The J equivalence to 1c (both bases psig, default assumptions) is pinned by the golden unit test, not by a browser comparison. That test checks the estimate, the sealed fields and the hand-off against `tests/fixtures/test-referenced-j-v1-golden.json`. In the browser, J behaves as 1c did: three tests at the reference depth qualify, and the high test is refused.

## Real artifact checks (run by Main; counts only)

- **Source.** Explorer's repository was read only, at texas-rail-sync `0933590`, via `git -c core.autocrlf=false archive` into the session scratchpad. The archive was repacked as a plain USTAR file by the v4 test helper's `pack`, because the receiver refuses the archive's pax header. File bytes were not changed.
- **Import path.** Each artifact was imported through the page's own file input.
- **What was copied or recorded.** Nothing was copied into this repository. No per-month or per-test values appear in this record or the evidence folder, and there are no screenshots of real data.
- **Bases.** Both bases were confirmed psig, with the default assumptions.

| Artifact | Import | J | Reconciliation counts | Report depth source | Console |
|---|---|---|---|---|---|
| Barbaro 23 v4 (`…uic000125182-d04894d1…`) | accepted, adopted | 4 tests · matched 3 · not usable 1 · qualifying 0 (as in 1c) | months 31 · included 31 · modelled 31 · refused 0 · test months 3 · negative differentials 3 · above permit 0; step-rate note shown | BHP test depth | clean |
| TRIPPET SWD v5 (`…uic000109605-b7628a71…`) | accepted, adopted | 0 BHP tests | months 16 · included 1 · modelled 1 · refused 0 (15 months excluded by the 1a default review) · test months 0 · above permit 0 | permitted top of interval (RRC guidance) | clean |

**Barbaro 23.** All three matched test months show a negative differential with the cause checklist. This is consistent with the 1c observation, recorded on 2026-11-04: the reported static gradients imply surface pressure held while shut in, and the BHP source carries no shut-in surface pressure (Explorer confirmed this). It is shown as found. No assumptions were changed.

**TRIPPET (plan Review Focus 2).** With the default 1a decisions, 15 months show "Excluded in the H-10 review". The driver then included all 15 in 1a, with a reason. The result was: months 16 · included 16 · modelled 1 · refused 15, all with the reason "No injection in the month (15)". The regulatory margin for those months reads "Not applicable (no injection)". Nothing is zero-filled and the console stays clean. The floor and no-maximum refusals are pinned by unit tests on synthetic data (Task 2). Barbaro had no excluded months, so including them changed nothing.

The driver counts the negative-flag phrase in the page text, and that text includes the chart's tooltip titles. So `negativeFlags` in `results-real-barbaro-v4.json` reads 6 for 3 negative differentials. The counts line (3) is the authoritative figure.

## Review

Each task was reviewed for spec compliance and code quality. Task 2 was reviewed by Opus as a calculation-contract checkpoint.

| Task | Outcome |
|---|---|
| 1 | Clean on the first review. |
| 2 | Clean after fix round 1 (R2-1). For a test within 10 ft of the report depth but not at it, the differential now uses a traverse at the test's own depth. It equals the J estimate's ΔP, as the spec requires. |
| 3 | Clean after fix round 1 (R3-1). The chart notes now include the spec's basis statement. |
| 4 | Clean on the first review. |
| 5 | Clean after fix round 1 (R5-1). Every test matched to a month is rendered, not only the first. The report-depth read for the limit form is guarded. |
| 6 | Clean after fix round 1 (R6-1, found in the browser). J-panel actions now refresh the reconciliation. |

**Final whole-branch review (Opus).** The verdict was "with fixes": 0 Critical and 4 Important findings, all of which were fixed in one wave (ruling RF-1). A scoped re-review found every finding addressed and no new breakage. The app suite went to 636/636, with oracles 248/0.

| ID | Problem | Fix |
|---|---|---|
| I1 | Setting or clearing the declared limit re-rendered the reconciliation twice, losing focus and the status message | The limit change now updates only the J panel (for the hand-off). The reconciliation has already recomputed itself |
| I2 | The synthetic browser run had no negative differential (spec evidence item) | A synthetic high test was added; check 3b |
| I3 | Review Focus 2 was not seen on real data | The TRIPPET run with all months included (above) |
| I4 | Before the basis was confirmed, the counts line showed zeros as if they were facts | The counts and summary are hidden until the basis is confirmed |
| triage | The J export's unit text said "gauge"; two fixed labels were not pinned | Unit text is now "psia unless named psi (as reported, on the confirmed basis)"; both labels are asserted |
| minor | A stale J estimate could attach a test the user has just excluded in 1b | The reconciliation attaches only tests that are present and included in the current 1b state |

**Deferred minors (reviewed and left for later; none blocks acceptance):**
- The permit-equivalent traverse floor reuses the reason "Average below the 100 psia traverse floor".
- The sensitivity band narrows without a note when a sensitivity run refuses.
- The "Test depth differs from report depth" reason is unreachable, because J refuses tests more than 10 ft off before they are matched.
- After a failed J recompute, the J session can keep an older declared limit, and the Well assumptions panel can disagree with the J panel. The spec's swallow-and-log rule accepts this.
- The chart uses colour alone to mark negatives in a static export (tooltips and `data-negative` exist). A 200-character basis reason can overflow the chart width.
- The CSV omits the counts, summary and checklist; the JSON has them.
- There is no behavioural test for consumer isolation, a failing `update` with all inputs, or the Well assumptions panel DOM.
- Small duplicated helpers (`esc`, `sha256`, `cell`, `el`/`draft`/`act`), an unused test import, and a `body()` style nit.

## Known limits

- The panel is screening only: "Screening only: not a regulatory approval, compliance finding or safe-operating determination."
- The formation margin is not evaluated in this phase. Step-rate fracture fields are noted, not used.
- The calendar-day rate understates the rate while injecting, so the modelled pressure reads high. The note is shown with the results.
- The BHP tests' type is not stated in the source. They are treated as static shut-in readings (RRC Permian guidance).
