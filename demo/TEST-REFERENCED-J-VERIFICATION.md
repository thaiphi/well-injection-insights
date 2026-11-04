# Test-referenced J verification (acceptance evidence for layer phase-1c-test-referenced-j)

Date: 2026-11-04. Branch: `feature/phase-1c-test-referenced-j`, at spec commit 74bd8e6 and plan commit 18b58e5. The code is in the working tree, to be committed after acceptance.
- Design: `docs/superpowers/specs/2026-11-03-test-referenced-j-design.md`, approved by the owner on 2026-11-03.
- Plan: `docs/superpowers/plans/2026-11-03-test-referenced-j.md`.
- The layer is recorded as pending-review until the owner accepts it.

## What changed

- **A new panel, "Test-referenced J (estimate)".** It sits below Test records (PRD ANA-E03 under D5).
  - **Inputs.** Each included BHP test is matched to its containing H-10 month. That month must still be included in the 1a review; the user can move the match to the previous or next month, with a reason.
  - **Formula.** J = q / (P_wf − P_res), where:
    - P_res = BHP + 14.7 under the confirmed psig basis;
    - P_wf comes from `traverseBrineWell`, starting from the H-10 average surface pressure + 14.7 and running to the test depth (MD = TVD, vertical well declared).
  - **Checks shown alongside.** A no-friction value, J_nf = q / H-10 gauge pressure; the J under the other basis reading; and a tubing sensitivity at 3.958, 4.892 and 6.276 in.
  - **Choice of J.** Every J is shown. The latest qualifying test is the default, the user can choose another with a reason, and the min–max range is offered for sweeps.
  - **Round trip.** `segmentedHydraulicPoint` must reproduce the chosen month within 0.5 psi.
  - **Refusals.** A test that cannot give a positive J is refused with a reason; the value is never clamped.
  - **Wording.** The word "calibrated" is never used.
- **Sealed exports** (`test-referenced-j-export/1`, method `test-referenced-j/1`) in JSON, CSV and SVG. The JSON carries the basis, the declared assumptions, units, limitations, the 1b upload list and a content hash. One limitation reads: "The BHP test is treated as a static shut-in reservoir pressure reading (RRC Permian guidance); the source record does not state the test type."
- **"Use in scenario (Hydraulics)".** This button prefills the Hydraulics workspace with an origin line for each value.
  - The bottomhole pressure limit is left empty and must be declared.
  - Editing a prefilled value marks it "User override (was: …)".
  - A Hydraulics export carries `provenance.inputOrigins` only when the values were handed off.
  - The constant-J scenario (`disposalCase.ts`) is unchanged.
- **Panel-gap fix.** A well with tests but no H-10 rows now shows Test records and the J panel. When there is no range, dated tests are labelled "No H-10 range; no timeline markers".
- **Updated 1b readiness sentence.** It now reads: "Calibrated injectivity (J): not available. A test-referenced estimate is shown in the panel below; …"

The changed and new files are listed in `migration/layer-specs/phase-1c-test-referenced-j.json`. The before-images of the 6 changed files are archived under `migration/baselines/phase-1c-test-referenced-j-before/`.

## Commands (direct Node paths only)

All results are from Main's own run on 2026-11-03, after the final fix wave. The code is unchanged since then.

From the nested app folder:
- `node ../node_modules/typescript/bin/tsc -p tsconfig.json`: clean.
- `node --test tests/*.test.mjs`: 578 tests, 578 pass, 0 fail.
  - The baseline was 523.
  - New test files: `injectivity-estimate`, `injectivity-export`, `injectivity-session`, `panel-hooks` and `hydraulics-handoff`, plus the helper `tests/helpers/injectivity-fixture.mjs`.
- `node scripts/check-carried-oracles.mjs`: 248 comparisons, 0 failures.

From the repository root:
- `node scripts/prepare-swd.mjs`: exit 0.
- `node scripts/verify-preservation.mjs .`: exactly one violation, the pending layer itself.
- Root tests: 120 tests, 119 pass. The 1 failure is the live-root preservation test, which fails on that same pending violation and clears on acceptance.

File checks:
- CR bytes are 0 in every new file.
- `web/import-ui.mjs` keeps exactly 4 CR bytes, on its last 4 lines.

## RED to GREEN

| Task | RED | GREEN |
|---|---|---|
| 1. Estimate core | Test file failed before the module existed | 15, then 16 after fix round 1; suite 539 |
| 2. Chart and exports | `ERR_MODULE_NOT_FOUND` for the chart module | 22 (with Task 1); suite 545 |
| 3. Panel hooks, readiness text | No export named `h10Available` | Suite 549 |
| 4. J session and panel | Module missing, 0 tests ran | Suite 561 after fix round 1 |
| 5. Hydraulics hand-off | No export named `applyHandoff` | Suite 567 after fix round 1 |
| 6. Wiring, layer record | (wiring only) | Suite 567; the final fix wave brought it to 578 |

## Synthetic browser check (fictional UIC 000000417)

Re-run on 2026-11-04 against the post-fix code.
- **Setup.** `PORT=4290 node scripts/serve.mjs`, headless Chrome over the DevTools protocol, driver `demo/test-referenced-j-evidence/j-check.mjs`.
- **Package.** Built in memory by the v4 test helper and stored only in the session scratchpad. It holds three BHP tests at one depth, inside a 16-month H-10 range.
- **Viewports.** 1280×900, 390×844 (mobile) and 960×800.
- **Outputs.** Results are in `results-<tag>.json`, screenshots in `<tag>-c<N>-*.png`, and the synthetic downloads in `downloads/<tag>/`.

All rows below gave the same result at all three viewports.

| # | Check | Result |
|---|---|---|
| 1 | Import and adopt; J panel directly after Test records; asks for the basis first | PASS |
| 2 | Confirm psig with a reason. Counts read "BHP tests: 3 · matched: 3 · unmatched: 0 · not usable: 0 · qualifying: 3", the chart has 3 points, and "Round trip: the scenario reproduces the chosen month within 0.5 psi." | PASS |
| 3 | Exclude a matched month in 1a: that test becomes "unmatched: The matched month is excluded in the H-10 review." and qualifying drops to 2. Re-including the month restores 3. | PASS |
| 4 | Choose an earlier test with a reason, then exclude it in 1b: "Your chosen test no longer qualifies; the latest qualifying test is used." Counts read "not usable: 1 · qualifying: 2". | PASS |
| 5 | Download JSON, CSV and SVG: `verifyEstimateSealed` is true, a tampered copy is false, and none of the three files contains "calibrated" | PASS |
| 6 | Hand-off goes to `#fluid/hydraulics` with 17 origin lines. With the limit empty, the calculation is blocked ("Enter bottomhole pressure limit."). Declaring 4000 gives "Calculated depth-dependent brine · 14.379 STB/day selected · 0 flagged curve points." The export carries `provenance.inputOrigins`, with `limitPsia` = "Declared by the user". Editing J shows "User override (was: …)". | PASS |
| 7 | Panel gap (see the note below). Both panels render, all 3 rows read "unmatched: No H-10 months to match.", and Test records shows "No H-10 range; no timeline markers" 3 times. | PASS (page-script path) |
| 8 | No page-level horizontal scroll (390 px: document width 390). Only tables and the chart scroll inside their containers. | PASS |

- **Console.** No application errors and no warnings. One run logged a `favicon.ico` 404, which is not an application error.
- **Chart text.** No chart text is clipped at any viewport. The only flag is the rotated y-axis label, whose bounding box is measured before rotation.

**Note on check 7.** The receiver refuses a package whose H-10 history is empty, with "Package rejected: Manifest history status contradicts canonical source dispositions." That refusal is correct receiver behaviour. The gap was therefore checked with a page script that mounts both panels the way `import-ui` does when `h10Available` is false. The unit tests in `panel-hooks.test.mjs` cover the same branch. A real import without H-10 rows has not been exercised.

## Real artifact checks (run by Main)

- **Source.** Explorer's repository was read only, at texas-rail-sync `0933590`, via `git archive` into the session scratchpad.
- **Import path.** Each artifact was imported through the page's own file input.
- **What was copied or recorded.** Nothing was copied into this repository. No per-test values from real artifacts appear in this record or in the evidence folder.

| Artifact | Import | Counts after confirming psig | Round trip | Hand-off |
|---|---|---|---|---|
| Barbaro 23 v4 (`…uic000125182-d04894d1…`) | accepted, adopted | BHP tests 4 · matched 3 · unmatched 0 · not usable 1 · qualifying 0. Reasons: 1 × "Excluded in the Test records review."; 3 × "Flowing pressure not above reservoir pressure; no J." | none (no J) | button disabled |
| TRIPPET SWD v5 (`…uic000109605-b7628a71…`) | accepted, adopted | BHP tests 0. "No BHP test records for this well; no test-referenced J." | none | none |

There were no console errors on either page. `real-trippet-r-trippet-no-bhp.png` shows the no-tests state.

### Barbaro 23: no qualifying test at the default assumptions (owner decision A, 2026-11-04)

The planned demo result was a test-referenced J on Barbaro 23 and its hand-off to Hydraulics. That did not happen. Following decision A, the outcome is recorded as found, and the method is shown working end to end on the synthetic well (checks 1–8).

**Why no J.**
- The default assumptions are 3.958 in tubing ID, 10 wt% salinity and 70/100 °F.
- Under these assumptions, the modelled flowing bottomhole pressure for each of the three matched months comes out at or below the BHP test's reservoir pressure.
- The reported test pressures imply a static gradient well above any brine gradient. The likely reading is that the well held substantial surface pressure while shut in. The modelled column, which starts from the H-10 surface pressure and loses friction at the reported rates, then lands below P_res.
- The spec requires refusing such a test, never clamping it. The three refusals are therefore correct behaviour, not a defect.
- The fourth test is "not usable" because it is excluded in the Test records review.

**What was not tried.** No assumptions were changed to obtain a J; doing so would mean choosing inputs to get an answer.

**For Explorer.** This is worth noting back to the Explorer side as a data observation about this well's tests. It is not a contract issue.

**Differences from the spec's evidence list.**
- The spec asked for the Barbaro walkthrough to show "hand-off prefilled the Hydraulics workspace" and to include screenshots.
- There was no hand-off, because no test qualified.
- No Barbaro screenshots were taken, because the match table would show per-test values.
- The hand-off is demonstrated on the synthetic well (check 6).

## Review

Each task was reviewed for spec compliance and code quality.

| Task | Outcome |
|---|---|
| 1 | Clean after fix round 1. A plain traverse error escaped `estimate()`; it is now converted to a refusal (`badDepth`, unsupported). |
| 2, 3 | Clean on the first review. |
| 4 | Clean after fix round 1. Fixes: a persistent status element, a guarded render, focus restore, and the spec's panel content (counts; reported BHP, hydrostatic and friction columns; match-origin text). |
| 5 | Clean after fix round 1. Fixes: the sweep-range note survives re-renders, and the workspace now has fake-DOM tests. |

**Final whole-branch review (Opus).** No Critical findings. Four Important findings were fixed in one wave:

| ID | Problem | Fix |
|---|---|---|
| I-1 | The J chart assumed tests were in date order | The chart now plots in date order, with an out-of-order test |
| I-2 | The sealed export said no uploads were used even when they were | The upload list is passed through, and sealing is refused when it is missing |
| I-3 | A numerical error could remove the panel's controls | The forms render outside the guarded block, and changes are checked before they are applied |
| I-4 | The panel-gap label required by the spec was missing | Added |

Minors M-1, M-2, M-4, M-6 and M-7 were fixed in the same wave. The scoped re-review confirmed all 9 fixes and found no new Critical or Important issues.

## Known limits (rulings)

- **Refresh errors (Task 3 ruling).** The J panel's refresh swallows its own errors, so a J failure cannot undo a 1a or 1b decision. If an error occurs, it is visible only in the console, and the panel stays stale until the next change.
- **Hand-off fields (M-3 ruling).** The hand-off also prefills the model, case name and segment count, which have no origin lines.
- **Deferred minors.**
  - M-5: the trend's depth check is pairwise within 20 ft.
  - M-8: the wording of the round-trip bound messages.
  - Others are logged in the build ledger: the CSV omits some JSON fields, and a successful hand-off sets no status text.
- **Untested real import.** The real-import path for a well with tests but no H-10 rows is untested, because the receiver refuses such packages (see the note on check 7).
- **Out of scope.** SRT analysis, a measured flowing BHP (hence no "calibrated" claim), multi-well J, hosted transfer, and any change to `disposalCase.ts`.
