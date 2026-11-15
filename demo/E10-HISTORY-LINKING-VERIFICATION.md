# ANA-E10 history linking verification (acceptance evidence for layer phase-3c-history-linking)

Date: 2026-11-15. Issue: thaiphi/well-injection-insights #9; the shared loader is also part of #8. Branch `feature/e10-history-linking`.

- Design: `docs/superpowers/specs/2026-11-15-e10-multiwell-assessment-design.md`, approved by the owner on 2026-11-15. The loader rules come from `docs/superpowers/specs/2026-11-15-e07-interference-screening-design.md`.
- Plan: `docs/superpowers/plans/2026-11-15-history-loader-and-e10.md`.
- The layer stays recorded as pending-review until the owner accepts it.

## What changed

A new **"Wells compared"** section sits inside "What the case says", under the Disposal capacity case results.
- The user loads Explorer H-10 packages next to their own (`user`) or `demo` case and links each case well to one UIC.
- E05's history-against-forecast check then runs for every linked well, as it already did for the sample.
- **Reported history is evidence only:** a link never changes any case input, and the calculation engine is unchanged.

| Part | Files | What it does |
|---|---|---|
| Package set (shared loader core) | `src/historyPackages.ts` | Loads calculation-ready packages only. Refuses a duplicate package (artifactId or manifest SHA-256), overlapping windows for one UIC, more than 10 UICs and more than 20 packages per UIC. Joins a UIC's packages in month order. Classes every month in the acquisition window as reported, reported-zero or **gap**; a missing row, a null volume and the months between windows are gaps, never zero. A legacy package with no acquisition window uses its row span, labelled. |
| Links and table rows | `src/caseHistoryLinks.ts` | One UIC per case well, chosen by the user with no pre-selection. Links are pruned when a well or a package goes away. Builds the E05 `HistoryLink`s and the "Wells compared" rows: coverage, gap label, check, J source, inclusion basis and packages. |
| Exports | `src/caseInsights.ts` | Schema `case-insights-export/2`; `/1` files still verify. Per linked well, the JSON and CSV carry the UIC, artifactId, manifest SHA-256, window (with its source) and inclusion basis, with the CSV in its existing 4-column long format. Verification recomputes the rows, including coverage, check and J source, from the stored links and windows. |
| Panel | `web/case-insights.mjs` | The loader control (`verifyExplorerPackage`, then the package set), per-well link selects, the 7-column table, and an in-panel row detail for one well at a time (timeline, coverage months, packages, basis). |

**What withdraws links and results:**
- **The links themselves and their confirmed bases are withdrawn** on a source switch and on an injector-profile re-import. Loaded packages are kept.
- **Results are withdrawn and recomputed** on any link, package or basis change.

**Sample case:** the sample rows show the sample's own J class ("Synthetic: you'd gather") and are labelled "window from reported rows". The sample's insights and exports are unchanged except for the schema version.

**Protected files changed**, with before-images in `migration/baselines/phase-3c-history-linking-before/`:
- `src/caseInsights.ts`: export provenance, `/2`, and recomputation of the rows.
- `web/case-insights.mjs`: the session additions and the "Wells compared" section.
- `web/import-ui.mjs`: two lines only, `linkedWellHistories()` (adds the sample J class) and the mount line (`getSource`, `getCaseOrigin`). It still has exactly 4 CR bytes.
- `tests/case-insights.test.mjs`: one schema assertion, `/1` → `/2`.
- `tests/case-insights-session.test.mjs`: E10 session tests added; one mount-line assertion updated.

`web/index.html` is untouched and still has 3 CR bytes. New files have 0 CR bytes.

## Commands (direct Node paths; Node v24.13.0)

From `swd-injection-analytics/`:
- `node ../node_modules/typescript/bin/tsc -p tsconfig.json`: clean.
- `node --test tests/*.test.mjs`: **789 tests, 789 pass, 0 fail**. The baseline was 738.
- `node scripts/check-carried-oracles.mjs`: 248 comparisons, 0 failures.

From the repository root: `node scripts/prepare-swd.mjs` exits 0.

Each task was written test first; the engineer reports record the failing runs. The two fix rounds within tasks were tested after the fix. The reports are in the git-ignored SDD workspace.

## Acceptance (issue #9 and the design)

| Criterion | Result | Evidence |
|---|---|---|
| A two-well case opens and compares eligible historical observations without fabricating pressure-model outputs | PASS | Browser scenario 1, with two fictional packages and both rows showing a verdict. No modelled pressure appears in the table. `case-history-links.test.mjs` |
| Switching wells updates every panel or marks its missing dataset | PASS | Browser scenario 2: the detail for an unlinked well shows only "No H-10 package linked to this well.", never the other well's data |
| Unexpected source changes invalidate dependent results and exports | PASS | Browser scenarios 3 and 5, and the recheck re-import scenario. Session tests cover package removal, link change, source switch through a result or through invalidation, and re-import |
| The second well's missing H-10 or tests show incomplete/not_ready, not zero | PASS | An unlinked well, or one with no usable month, reads "cannot be checked". Gap months carry "N gap months in the window; a gap is never zero." |
| The handoff stays hash-verified and user-confirmed | PASS | Only packages that pass `verifyExplorerPackage` and are calculation-ready load. Every link is picked by the user. Refusal tests cover duplicates, overlap and limits |
| A link is evidence only | PASS | Case input deep-equals before and after link operations (tests). The engine is not called by the panel |
| The sample path is unchanged | PASS | Sample insights deep-equal the pre-branch `/1` fixture apart from `schemaVersion` (tests). In the browser, the SHA-256 of all 8 summary lines matches a main-branch build at both widths |

## Browser evidence (QA agent, headless Chrome over CDP)

Driver: `demo/e10-evidence/e10-check.mjs`, with the recheck in `e10-recheck.mjs`. Notes: `QA-NOTES.md`. Statuses and hashes: `results-desktop.json`, `results-mobile.json`, `results-recheck.json`.

Every scenario passed at 1280×900 and at 390×844, on the first pass (4b9130a) and on the recheck after the final fix wave (7fd5228).

| # | Scenario | Result |
|---|---|---|
| 1 | Load two fictional packages (UICs 000000417 and 000000418) and link wells A and B: both rows show a verdict | PASS |
| 2 | Expand A then B (unlinked): B's detail shows only the unlinked text | PASS |
| 3 | Remove package 418: B's link is gone, and results and exports are recomputed | PASS |
| 4 | Load the same package twice: refusal alert, list unchanged | PASS |
| 5 | Switch to demo, and user → demo → user without calculating demo: links cleared, packages kept | PASS |
| 6 | Sample case: two wells, J source "Synthetic: you'd gather", "window from reported rows", summary lines identical to main | PASS |
| 7 | JSON (`/2`) verifies in Node; every CSV line has 4 fields, with the inclusion basis, manifest SHA-256 and window rows present | PASS |
| 8 | No console errors (only a favicon 404 from the static server) | PASS |
| 9 | Mobile: no horizontal page scroll | PASS |
| Recheck | The refusal alert clears after a switch; the gap sentence appears once; a re-import with one changed J value clears the links and keeps the packages | PASS |

**Data rule:**
- The two QA packages are fictional, built from the repo's test helper (`tests/helpers/explorer-v4.mjs`). They are kept in the session scratchpad only, with their SHA-256 values in `QA-NOTES.md`.
- No downloaded file and no screenshot is committed; only `screenshots-SHA256SUMS.txt` is.
- The sample case's public well IDs appear in the results; no per-month values do.
- All test fixtures are fictional.

## Reviews

- **Per-task reviews** were independent (Opus, read-only) with scoped re-reviews.
  - Tasks 1 and 2 were approved directly.
  - Task 3 needed 1 fix round: a per-window row filter in verification could reject a valid export, and the CSV was ruled into the existing 4-column long format.
  - Task 4 needed 1 fix round: links survived a switch made through invalidation alone, and the sample J source was wrong.
- **QA first pass:** one minor defect (a stale refusal alert after a source switch) and one observation (the gap sentence was shown twice).
- **The final whole-branch review** returned changes required, with three Important findings and no Critical ones:
  - **I1:** an injector-profile re-import must withdraw the links.
  - **I2:** the exports lacked the manifest SHA-256, the per-package window and the inclusion basis.
  - **I3:** the sample's row-based window was not labelled.
  It also raised M1 (a basis restored after unlinking and relinking) and M2 (verification trusted the stored J source).
- **One fix wave** covered I1–I3, M1–M3, QA D1 and the observation. The scoped re-review was APPROVED, and the QA recheck passed.

**Main's rulings** (full list in the SDD ledger; the main ones):
- The CSV stays in the 4-column long format.
- The sample's J class is carried through `linkedWellHistories()`.
- A source switch, or a changed profile import, clears links and bases. An identical re-import keeps them.
- Removing one of two packages on a UIC keeps the link.
- The sample's coverage uses a minimum fix: a "window from reported rows" label rather than the acquisition window.
- `/2` files sealed during development before the final wave no longer verify, which is acceptable because `/2` was never released.

**Deferred minors**, each judged safe to defer by the final review and listed for the record:
- loose refusal regexes in the tests;
- a half-present acquisition scope falls back to rows;
- untested legacy zero-row and inverted-window refusals;
- the JSDoc does not state the prune precondition;
- the `load()` helper swallows import errors (an existing pattern);
- the export builder does not cross-check `compared` against the links;
- the `/1` fixture path is relative to the working directory;
- extra tamper tests;
- `basisButtons` holds whichever form rendered last;
- the sample J-class wiring is covered by a source-text test only;
- the legacy fixed scope start is ignored;
- the sample J source can fall back silently;
- the package list can go stale before a result exists (unreachable today);
- a user → demo switch counts two withdrawals, which is harmless;
- the D1 panel clearing is tested at source level only.

## Not covered

- Wiring the existing single-well tools (H-10 diagnostics, test records, pressure reconciliation, well assumptions) to the user's own case. This is a later piece by owner decision (design call 4).
- #8's offset-only rules: connectivity, after-history choices and confirmed shut-ins. Those are built with #7 and #8.
- Publishing on Lovable, which the owner does after merge.
