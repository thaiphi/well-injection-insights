# E05 (#6) QA notes: "What the case says" panel

Branch `feature/e05-scenario-monitoring` at `a7cc15c`. Chrome 157.0.8103.39 (headless, CDP port 9333), Node v24.13.0. Date 2026-11-10.

## Commands

From `swd-injection-analytics/`:
- `node ../node_modules/typescript/bin/tsc -p tsconfig.json` (exit 0)
- `PORT=4174 node scripts/serve.mjs` (background)
- Chrome `--headless=new --remote-debugging-port=9333 --user-data-dir=<scratchpad>/chrome-e05/profile`
- `node demo/e05-evidence/e05-check.mjs 1280 900 0 desktop <scratchpad>/chrome-e05/downloads`
- `node demo/e05-evidence/e05-check.mjs 390 844 1 mobile <scratchpad>/chrome-e05/downloads`
- Downloads verified with a scratchpad script that imports `dist/caseInsights.js` (`verifyCaseInsights`, `caseInsightsJson`, `caseInsightsCsv`).

`scripts/check-all.mjs` was not run, as briefed (the orchestrator runs the gate).

Data rule: the downloads stay in the scratchpad. `results*.json` hold statuses, rule IDs, counts and hashes only, with digits redacted from the sentences. Screenshots hide the history tables (`display:none` during capture). The timeline chart shows bars but no per-month values.

## Results (desktop and mobile both)

| # | Scenario | Result | Evidence |
|---|---|---|---|
| 1 | Sample case: order results → insights → sweep (DOM); A1–A6 (A6 ×2) + A8; closing line exact; both sample wells linked (status "Above reported history", 1 table, 1 basis form, 1 timeline SVG each; no NO_HISTORY) | PASS | `*-s1-summary.png`, `*-s1-history.png`, `results-*.json` `s1` |
| 2 | Confirm psig / "QA" on well 1: note changes to the P1 warning "Requires more surface pressure … than any reported month"; "Confirmed: psig — QA"; focus on that well's Confirm (real mouse click); well 2 stays "Not confirmed"; A6 drops "pressure not checked" for well 1 only | PASS | `*-s2-basis-confirmed.png`, `s2` |
| 3 | Factors start ×1 / +0 / ×1. Pessimistic 0.7 / +300 / 0.9 → 3-row case table, 6-row attribution "Single-factor runs; effects are not additive.", 4 notes, two A7 lines. Editing Optimistic J clears the case tables (headroom table stays) and A7 | PASS | `*-s3-performance*.png`, `*-s3-after-edit.png`, `s3`, `s3_afterEdit` |
| 4 | Edit reference pressure → panel hidden, insights downloads disabled, disposal JSON/CSV/SVG disabled | PASS | `*-s4-invalidated.png`, `s4` |
| 5 | JSON + CSV downloads after a result | PARTIAL (see D1) | `results.json` `downloads` |
| 6 | Sensitivity view: panel `display:none`, height 0; visible again on Scenarios | PASS | `*-s6-sensitivity.png`, `s6` |
| 7 | Demo case: both FICTIONAL-INJ wells read exactly "Cannot be checked: no H-10 history loaded for this well."; no basis form or chart | PASS | `*-s7-demo-history.png`, `s7` |
| 8 | No console errors or exceptions; `performance-worker.mjs`, `dist/caseInsights.js` and `dist/performanceCases.js` load | PASS | `s8` |
| 9 | 390 px: page scrollWidth 390 = clientWidth; timeline SVG 334 px in a 334 px `overflow-x:auto` container; wide tables scroll inside `.table-scroll` | PASS | `mobile-s9-timeline.png`, `mobile-s3-performance-tables.png`, `s9` |

### Downloads

| File | Bytes | SHA-256 |
|---|---|---|
| `swd-case-insights-2d6c1f82dc8b.json` (with performance cases, 1 basis) | 205,923 | `76a595ccf2e2b8399295eef7ada94268fd81e731b609bee70b6f8bcade8e3a0f` |
| `swd-case-insights-2d6c1f82dc8b.csv` | 40,053 | `fa161cee71369bd4bd421e943f416893e38aebda77bcbcbb587e255cbcfb87c8` |

- Desktop and mobile runs produced byte-identical files, so reruns are deterministic in the browser.
- JSON bytes equal `caseInsightsJson(parsed)`. CSV bytes equal `caseInsightsCsv(parsed JSON)`. The filename prefix matches `contentSha256`.
- A tampered summary line is rejected. Banned words in the generated lines (A8 excluded): 0.
- **Node `verifyCaseInsights` on this JSON: FAIL** ("Result changed or stale"). See D1.
- A second JSON without performance cases (91,362 bytes) passes `verifyCaseInsights` in Node.

## Defects

**D1 (medium): sealed insights JSON with performance cases does not verify outside the browser.**
- Reproduce: open the sample case, then Scenarios → Calculate, then set Pessimistic J 0.7 / offset 300 / availability 0.9, then Calculate cases, then Download insights JSON. In Node 24.13, `verifyCaseInsights(JSON.parse(file))` throws "Result changed or stale".
- Cause: rebuilding gives 12 differences, all `performance.cases[0].summary.monthly[*].allocations[1].hydraulics.frictionPsi` (Pessimistic, well 2). Each differs only in the last floating-point digit (18 vs 19 characters) between Chrome V8 15.7 and Node V8 13.6.
- The browser worker's re-verification passes, so the in-app download works. Independent verification in a different JavaScript runtime fails. The base-only export verifies, so the drift arises in the performance-case hydraulics path.
- Possible fixes: verify with a numeric tolerance, or round derived floats before sealing.

**D2 (minor, wording): A5 can state a non-change.** The sample case's compared well has J × 1, so the A5 line reads "moves the first shortfall from 2026-01 to 2026-01 and changes unplaced water by 0 bbl." It should say the compared case does not change the result.

**D3 (minor, wording): A4 can report negative spare capacity.** When every month is short, A4 reads "Least spare capacity: 2026-01, −189,533 bbl." A negative spare figure is hard to read. Suggest "largest shortfall" wording.

**D4 (minor, wording): an unchanged neutral case gets an A7 line.** When Optimistic is left neutral (×1, +0, ×1), A7 still prints "Optimistic: water stops fitting in … (base …)", repeating the base result.

**D5 (cosmetic): repeated well identity in history headings.** Headings show "UIC-000020838 · UIC 000020838": the case well ID and the UIC repeat the same identity.

## Cleanup

Server and Chrome stopped. Ports 4174 and 9333 are not listening. No staging, commits or pushes were made. Downloads remain only in the scratchpad.

## Recheck after final fix wave

Desktop 1280x900 only, Chrome 157.0.8103.39, tsc exit 0, same server/CDP setup. No screenshots; the download stayed in the scratchpad (not the repo). Statuses and hashes in `results-recheck.json`.

- **D1: PASS.** Sample case, Calculate, Pessimistic J 0.7 / offset +300 / availability 0.9, Calculate performance, Download insights JSON: 206,313 bytes, SHA-256 `bf30746fd6ac05ca6dd7a49872a50c2a27b53ebbdc54c07c7b832e83e79fb375`. Node `verifyCaseInsights` (dist/caseInsights.js) resolves. One summary line text altered without resealing: rejected ("Result changed or stale").
- **Wording and columns: PASS.** Case table has "Offset (% of headroom, assumed)" and "Unsupported-pressure months". History sentences read "# bbl/day treated as STB/day" and "# of # included history months at or above the peak forecast rate; # of # forecast months above the reported peak." A5 reads "keeps the first shortfall at #"; no "moves the first shortfall" wording. A4 reads "Least spare capacity: # shortfall of # bbl." Neutral Optimistic reads "Optimistic: same as base (no factors changed)." History headings carry the UIC once.
- **Console: PASS for app code.** The only entry is a 404 for /favicon.ico (static server has no favicon); no exceptions. Not an E05 defect.
- Cleanup: server and Chrome stopped; ports 4174 and 9333 free. No staging or commits.
