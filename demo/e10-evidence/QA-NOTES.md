# E10 (#9) QA notes: history packages, case well links, Wells compared

Branch `feature/e10-history-linking` at `4b9130a`. Chrome 157.0.8103.39 (headless, CDP 9333), Node v24.13.0. Date 2026-11-15. `scripts/check-all.mjs` not run (orchestrator runs the gate).

## Commands

From `swd-injection-analytics/`: `node ../node_modules/typescript/bin/tsc -p tsconfig.json` (exit 0); `PORT=4174 node scripts/serve.mjs`; Chrome `--headless=new --remote-debugging-port=9333` with a scratchpad profile.
- `node demo/e10-evidence/e10-check.mjs 1280 900 0 desktop <scratch>/e10-qa`
- `node demo/e10-evidence/e10-check.mjs 390 844 1 mobile <scratch>/e10-qa`
- Main-branch comparison: `git archive` of the merge base with main (`5833752`, app code before E10) built in the scratchpad, served on 4175, `... 1280 900 0 main <scratch>/e10-qa 4175 sample`.
- Downloads verified in the driver with `verifyCaseInsights` from `dist/caseInsights.js`; CSV parsed with a quote-aware splitter.
Servers and Chrome stopped; ports 4174, 4175, 9333 confirmed free.

## Data

- User case: `data/samples/seed417-history.csv`, `data/samples/assumed-injectors.csv` (wells FICTIONAL-INJ-A, FICTIONAL-INJ-B) and a scratchpad schedule CSV (FICTIONAL-NEW-01/02, distinct from the history producers, which the app requires). Imported through the real import UI, illustrative geometry applied, then Calculate.
- Packages (scratchpad only, never in the repo): UIC 000000417 from `buildV4Files()` in `tests/helpers/explorer-v4.mjs`. The helper is hard-wired to 417, so UIC 000000418 is the same helper output with 000000417 replaced by 000000418 in every JSON/CSV file, then the helper's own `refreshEvidence()` and `derive()` re-hash and re-seal it. Both pass the real `verifyExplorerPackage` (`calculationEligibility.ready: true`) and `packageFromVerified`; window 2024-01 to 2026-04, 16 reported months, 12 gap months. This is a query-version-4 package, not v5.
- SHA-256 of the two .tar files:
  - *pkg-417.tar 3849b032890619bef7e4ec703b5421455a228155b5614b26b8989c2ecb96e389
  - *pkg-418.tar 665da1cfba86df2d58a6cad1894469ce9af8665fd4be68831ab9be12123afac7
- Screenshots are in the scratchpad (`e10-qa/shots`); only `screenshots-SHA256SUMS.txt` is committed. The sample case holds real TRRC wells, so `results-*.json` redact digits from sample sentences and keep SHA-256 of the full summary lines.

## Results (desktop and mobile both PASS)

| # | Scenario | Result | Evidence |
|---|---|---|---|
| 1 | Load both .tar at once: two packages listed, no alerts. Both wells' dropdown lists 417 and 418. Link A to 417 and B to 418: both rows "Above reported history"; coverage "16 months with reported injection, 0 reported zero, 12 gap months; a gap is never zero"; pressure "Pressure not checked"; J source "assumed (case input)" | PASS | `s1` |
| 2 | Expand A (h5 "...A - UIC 000000417", 1 chart), then B (h5 418, 1 chart), unlink B while expanded: detail text is exactly "No H-10 package linked to this well.", 0 charts, no 417 or A name | PASS | `s2` |
| 3 | Relink B, remove package 418: B's select empty, row "Cannot be checked", 417 option on B disabled (A holds it), packages 2 to 1, downloads stay enabled, exported links change from A+B to A only (JSON hash changes), schema `case-insights-export/2` | PASS | `s3` |
| 4 | Load pkg-417 again: alert "Package ...uic000000417... is already loaded"; package list identical; A still linked | PASS | `s4` |
| 5 | Link A, switch to demo: panel hidden; after calculating demo both rows have no link, options only 417, package list kept (1), loader visible. user to demo to user without calculating demo, then Calculate: links cleared, package kept | PASS (see D1) | `s5_demo`, `s5_user_demo_user` |
| 6 | Sample case: table shows UIC-000020838 and UIC-000056484, J source "Synthetic: you'd gather" for both, loader hidden, row detail works. 8 summary lines; SHA-256 of every line identical to the main-branch build, at both widths | PASS | `s6`, `s6_detail` |
| 7 | JSON (511,353 chars) with links A and B: `verifyCaseInsights` in Node OK. CSV 63 lines, every line 4 fields | PASS | `s7` |
| 8 | Console errors and exceptions | PASS (none, not even a favicon 404) | `s8` |
| 9 | Mobile 390: page scrollWidth 390 = clientWidth, no horizontal page scroll (desktop 1265 = 1265) | PASS | `s9` |

Notes: desktop and mobile JSON/CSV differ in bytes because the import mapping version embeds a random UUID in the case evidence; both verify. Withdrawal then recompute on package removal is synchronous in the UI, so the intermediate "withdrawn" state cannot be observed; the after state (links, table, export) was verified.

## Defects

**D1 (minor): stale loader alert survives a source switch.** Steps: in a user case load pkg-417 twice (alert "...already loaded"), switch to demo or user and back, calculate. The old alert text is still in the Wells compared loader (`s5_user_demo_user.alerts`). Expected: alert cleared when links are withdrawn or the source changes. Actual: message from an earlier action stays until the next load.

**Observation (no defect).** Coverage cell textContent repeats the gap sentence ("12 gap months12 gap months in the window; ..."): the span ends with "12 gap months" and the `small` label repeats it with a line break. Visible text is two lines; screen readers read both.

## Recheck after final fix wave

HEAD `7fd5228`. Same environment as above (Chrome 157.0.8103.39, Node v24.13.0); tsc exit 0. Driver `e10-recheck.mjs`; results `results-recheck.json` (statuses, counts, hashes only); new screenshots (`*-r*.png`) are in the scratchpad with hashes appended to `screenshots-SHA256SUMS.txt`. Run: `node demo/e10-evidence/e10-recheck.mjs 1280 900 0 desktop <scratch>/e10-qa` and `390 844 1 mobile`. Servers and Chrome stopped; ports 4174, 4175, 9333 free.

| Check | Desktop | Mobile |
|---|---|---|
| 1 Load both packages, link A and B: both rows "Above reported history" | PASS | PASS |
| 3 Remove 418: B's link gone, "Cannot be checked", packages 2 to 1, downloads enabled | PASS | PASS |
| 5 Demo switch and user, demo, user: links cleared, package kept, loader visible in demo | PASS | PASS |
| D1: refused duplicate load, then user, demo, user and Calculate: both loader alerts empty | PASS (D1 fixed) | PASS |
| Coverage cell shows the gap sentence once per well | PASS | PASS |
| Sample rows show "window from reported rows" (both wells); J source "Synthetic: you'd gather" | PASS | PASS |
| Re-import injector profile from a copy with one J value changed, then Calculate: links cleared on both wells, 2 packages kept | PASS | PASS |
| 6 Sample summary lines: 8, SHA-256 of every line equal to the main-branch build | PASS | PASS |
| 7 JSON (schema `case-insights-export/2`) verifies in Node; CSV 69 lines, every line 4 fields; `inclusion basis` rows 2, `package <artifactId> manifestSha256` rows 2, `package <artifactId> window` rows 2 | PASS | PASS |
| 8 Console errors | PASS (only the acceptable favicon 404 from the static server) | PASS (none) |
| 9 No horizontal page scroll | PASS (1265 = 1265) | PASS (390 = 390) |

No new defects. The earlier observation (gap sentence repeated in the coverage cell) is also fixed.
