# ANA-E11 depth view (review aid): browser verification (QA evidence)

Date: 2026-11-17. Issue: thaiphi/well-injection-insights #10. Branch `feature/e11-depth-context`, head 0405d70.

- Design: `docs/superpowers/specs/2026-11-16-e11-depth-pressure-context-design.md` (owner-approved 2026-11-16).
- Scope of this file: the browser acceptance evidence only (QA task 5). The full gate (`node scripts/check-all.mjs`) and the preservation layer are recorded elsewhere.

## Method

- Chrome 157.0.8103.39, headless, isolated profile, driven over the DevTools protocol.
- Node v24.13.0. Direct node paths only.
- Build: `node ../node_modules/typescript/bin/tsc -p tsconfig.json` from `swd-injection-analytics/` (exit 0).
- Server: `PORT=4174 node scripts/serve.mjs`. Chrome on port 9333.
- Driver: `demo/e11-evidence/e11-check.mjs`. Run from `demo/e11-evidence/`:
  - `node e11-check.mjs 1280 900 0 desktop <scratchDir>`
  - `node e11-check.mjs 390 844 1 mobile <scratchDir>`
- Results: `results-desktop.json` and `results-mobile.json` (51 named checks each; `allPass: true` at both widths).
- Screenshots: kept outside the repo; only `screenshots-SHA256SUMS.txt` is committed.
- Downloads are verified inside the driver with the app's own verifiers from `dist/depthContextExport.js` (`verifyDepth` for JSON, `verifyDepthSvg` for SVG).

## Data rule

- Every input is fictional or synthetic: the app's fictional example profile (wells FICTIONAL-INJ-A and FICTIONAL-INJ-B, fictional UIC `000000417` fixtures) and two hand-written fictional profiles kept in the QA scratchpad (`user-profile.csv`, `bad-profile.csv`) plus a fictional producer schedule.
- No Explorer artifact was used. No real TRRC value appears anywhere.
- Records here are statuses, counts, depths of fictional wells and hashes. No downloaded file and no screenshot is in the repo.

## Results

Every scenario passed at 1280×900 and at 390×844.

| # | Scenario | Result | What was checked |
|---|---|---|---|
| 1 | Demo case: example, tick A and B, TVD, Draw | PASS | Panel is hidden before a result, then shown directly after `#transient-buildup`, with no well and no basis pre-selected. Nothing is drawn until Draw. On A: casing 1, packer 1, perforated interval 1, formation tops 2 (one with a sourced band), test points 2, and a curve from 18.0 ft to 3018.0 ft (the declared pressure datum) with the limit marker at 3018 ft. On B the gaps list reads "no survey for this well; cannot convert MD to TVD" (row 13), "depth basis not stated" (row 15) and "pressure basis not stated" (row 16). The review-aid sentence is on the panel. |
| 2 | Withdrawal | PASS | Switching TVD to MD removes the drawing and disables the three downloads until Draw. The same for changing the scenario and for changing the month. Draw restores the drawing; the MD drawing's curve ends at 3318 ft. |
| 3 | Flagged curve and shut-in | PASS | Shut-in: comparison availability 0 on the compared well (A), recalculate, scenario Compared, Draw: A has no curve and the gap reads "modelled curve: shut in this month; no modelled curve". B keeps its curve. Flagged: with A at TVD 8000 / MD 8300 and the uniform model, the profile (16 rows, wells ticked, TVD) survived the recalculation, and A's curve is drawn dashed red with the case reason "Required flowing surface pressure is below 100 psia..." listed and the limit marker at 8018 ft. See note 1. |
| 4 | A's TVD edited to 2980, recalculate | PASS | The note "survey TVD at the case's pressure datum differs from the case TVD by 20 ft; the curve is not moved" appears. It is absent at TVD 3000 (difference under 10 ft). |
| 5 | JSON, CSV and SVG downloads | PASS | Checked for three drawings (base TVD, flagged, survey note). JSON: `verifyDepth` passes (schema `depth-context-export/1`) and the hash matches. SVG: `verifyDepthSvg` passes and its `contentSha256` equals the JSON's. CSV: every one of 221 lines has exactly 4 fields (quoted cells parsed). The three file names share one 12-character hash prefix. A JSON with its month altered is refused by `verifyDepth`. |
| 6 | `user` case | PASS | The example button is disabled and the note and tooltip read "The fictional example is only for the demo case." A hand-written fictional profile uploads ("7 profile rows loaded.", the row for FICTIONAL-OTHER listed as "not a well in this case") and draws. A bad profile with `"3,250"` in a depth column is refused with "row 3: top_depth_ft is not a plain number ("3,250")", the status "The profile was refused; nothing was loaded...", and the earlier drawing withdrawn. |
| 7 | Source switch clears the profile | PASS | After a user to demo switch, the panel is hidden, and after the demo calculation the status is empty, Clear is disabled, no well is ticked, no basis is chosen, no drawing and no dropped rows. |
| 8 | Sample case | PASS | "What the case says" (Wells compared, Reported history vs forecast, Assumed well-performance cases) and the buildup panels (Pressure buildup over time, Nearby wells) are present. The SHA-256 of all 8 summary lines equals the E10 baseline (`demo/e10-evidence/results-*.json`) at both widths. The depth panel is offered with no example. On the sensitivity view (`#injection/sensitivity`) `#depth-context` is not displayed. |
| 9 | Console | PASS | No console error or exception. The only log is the static server's favicon 404 (desktop run). |
| 10 | Mobile 390 px | PASS | `document.scrollingElement.scrollWidth` 390 <= `innerWidth` 390, with the drawing on screen. The drawing is 722 px wide inside a 336 px wrapper (`overflow-x: auto`); setting `scrollLeft` to 200 scrolls the wrapper and not the page. |

## Notes

1. **Flagged curve depth.** The brief suggested TVD 5000 with the uniform model. At 5000 ft the case stays feasible (required surface pressure about 837 psia, because the allocated rate rises), so the curve is not flagged. TVD 8000 / MD 8300 does raise the case reason (required surface pressure below 100 psia), so the check uses that. This is a property of the fictional inputs, not a defect.
2. **Example in the `user` case.** The UI disables the example button and shows the refusal text next to it; a click cannot reach the session. The session's own refusal (`createDepthSession.loadExample`) is covered by the unit tests, not exercised here.
3. **Cosmetic observations (not blocking).**
   - The depth axis title ("TVD depth below the depth reference (ft)") is right-aligned at the axis and its left part is clipped in the SVG ("reference (ft)" is what shows).
   - With the dense example, labels for the casing, packer, perforation and test points on well A overlap. The data is complete in the detail lists and the export.

## Defects

None.

## Evidence files

- `demo/e11-evidence/e11-check.mjs`: the driver.
- `demo/e11-evidence/results-desktop.json`, `results-mobile.json`: per-check results with the measured values.
- `demo/e11-evidence/screenshots-SHA256SUMS.txt`: SHA-256 of the 24 screenshots (12 per width; two names per width show the same image).
- The screenshots, the downloaded JSON/CSV/SVG and the three scratchpad profiles stay in the QA scratchpad and are not committed.
