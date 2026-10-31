# Test records verification (Phase 1b, PRD ANA-E01 and ANA-E02 acceptance evidence)

Date: 2026-10-30. Branch feature/phase-1b-test-records (work uncommitted). Layer test-records is recorded pending-review; owner acceptance, the independent review (Task 7 Step 4) and the commit are separate steps. This record covers Task 7 Step 1 (browser), Step 2 (real-artifact check, run by Main) and Step 3 (this record). Written by the verification worker; no product file, test, doc or migration file was edited.

## Commands

Run from the nested app folder (swd-injection-analytics/) unless noted. Direct Node paths only. Re-run read-only by the verification worker on 2026-10-30.

- `node --test tests/*.test.mjs` : tests 509, pass 509, fail 0.
- `node scripts/check-carried-oracles.mjs` : 4 recorded cases, 28 exact pressure points, 248 comparisons, 0 failures; exclusions preserved.
- Repo root: `node scripts/verify-preservation.mjs .` : checked 182, 1 violation, "Layer test-records baseline is pending/not accepted after independent review" (expected until the owner accepts).
- Browser: `PORT=4174 node scripts/serve.mjs` (from the nested folder) plus headless Chrome 156 (`--remote-debugging-port=9333`, scratchpad profile), driven by demo/test-records-evidence/tr-check.mjs (own CDP script modelled on the accepted 1a driver demo/h10-diagnostics-evidence/h10-check.mjs: downloads captured by wrapping URL.createObjectURL and the anchor click). Run as `node tr-check.mjs 1280 900 0 desktop <tar> <valid.csv> <wrong-uic.csv>` and `node tr-check.mjs 390 844 1 mobile ...`. Afterwards `node verify-evidence.mjs` (output kept in verify-evidence-output.txt) compares the 1a download hashes and verifies the sealed JSON with `verifyTestRecordsSealed` from dist/testRecordsExport.js. Server and Chrome were stopped afterwards (ports 4174 and 9333 free).
- Synthetic package: UIC 000000417, built in memory by the Task 4 helper tests/helpers/explorer-v4.mjs (`buildV4Package`) and written ONLY to the session scratchpad (synthetic-v4-000000417.tar, 1,463,808 bytes; never in the repository). Rows (Ruling 6, same shapes as tests/explorer-package-v4.test.mjs): BHP 7101 2022-05-16 1512.0 @ 3140.0; BHP 7102 2024-02-12 1705.0 @ 3310.0; BHP 7103 2024-07-22 1731.0 @ 3310.0; SRT 7201 2022-05-16 perfs 3305-5120, frac pressure 1610.0. The H-10 range of this package is 2024-01 to 2025-04 (16 months). Upload CSVs (also scratchpad only, built with the Task 4 normalizer and CSV writer): one valid BHP row for 000000417 (report 7104, 2025-01-10, 1768 psia @ 3310 ft) and the same row with the UIC rewritten to 000000999. The package was imported through the page's own file input (Data & sources, Explorer package), confirmed with "Confirm & use this exact dataset", exactly as a user would.

## CR counts

web/import-ui.mjs: 4 CR bytes, on lines 335, 336, 337, 338 (the last four of 338 lines). Before Task 6 they were lines 334-337 of 337 (same count, shifted by the one added import line). All other changed or new files: 0 CR bytes (web/explorer-package.mjs, web/h10-diagnostics.mjs, web/test-records.mjs, web/explorer-tests.mjs, src/h10DiagnosticsChart.ts, src/testRecords.ts, src/testRecordsChart.ts, src/testRecordsExport.ts).

## RED to GREEN per task

Sources: .superpowers/sdd/2026-10-30-test-records/task-*-report.md. All RED runs failed with ERR_MODULE_NOT_FOUND for the not-yet-existing module.

| Task | Test file | RED | GREEN |
|---|---|---|---|
| 1 | tests/test-records.test.mjs | missing dist/testRecords.js | 11 pass; 14 after fix round 1 (full 479/0 at the time) |
| 2 | tests/test-records-chart.test.mjs | missing dist/testRecordsChart.js; pinned 1a ratio-chart hash 05d287ff...0ddce checked before editing | 5 pass (incl. the pinned-hash byte-identity test); 6 after fix round 1; h10-diagnostics* 33/0 |
| 3 | tests/test-records-export.test.mjs | missing dist/testRecordsExport.js | 4 pass; 5 after fix round 1 |
| 1-3 fix round 1 | five Important review findings (synthetic data per Ruling 6, BHP no-pressure reason, no-depth marker, escape test, helper duplication kept as debt) | n/a | full suite 502/0 |
| 4 | tests/explorer-package-v4.test.mjs (+ tests/helpers/explorer-v4.mjs) | missing web/explorer-tests.mjs (1 file-level failure) | 9 pass; explorer-package.test.mjs unchanged 20/20; full 497/0; oracles 248/0 |
| 5 | tests/test-records-session.test.mjs | missing web/test-records.mjs | 7 pass; full 509/0 (fix round 1 changed the panel code and session tests, final suite 509/0) |
| 6 | wiring in web/import-ui.mjs and web/h10-diagnostics.mjs | n/a (no new test file) | full 509/0; oracles 248/0; layer recorded pending-review; verify-preservation 1 (pending) |

## Real artifact result (Task 7 Step 2, run by Main, copied verbatim)

Real Barbaro 23 v4 artifact (Explorer 3cefa99, read via git archive into the scratchpad, packed in memory, nothing copied into this repository): ACCEPTED by verifyExplorerPackage. 65 files; UIC 000125182; 31 monthly rows; 4 BHP and 1 SRT test records. SHA-256: tests.json bf7293dd96b9188edbaa64d93bdaecd1c1f7474cf457cb2ca82735f6e853b8e9; tests_bhp.csv 8d6a20b2953d68036647b482652ef22bec5435f93815e68c89d3897439166b84; tests_srt.csv 68366f9483a435b946a0cb283b47509f85681868a9ad3d154da8b67629e4ccbb; tests_dictionary.json 690574e58f75535d546dd14a1ab51c8bf7e480f0b2674e0eb501ef0cfd9699d4.

(No per-test values from the real artifact appear in this record or in the evidence folder.)

## Browser results

The monthly H-10 rows of the synthetic v4 package are the committed v2 fixture's public rows (UIC 000056484) relabelled to the fictional 000000417 (spec section 9 allows this), so the 1a downloads in the evidence show "public reported" content under the fictional UIC.

Evidence: demo/test-records-evidence/ (screenshots `desktop-*.png` at 1280x900 and `mobile-*.png` at 390x844; raw results `results-desktop.json`, `results-mobile.json`; downloads under `downloads/desktop` and `downloads/mobile`; tr-check.mjs; verify-evidence.mjs and its output). Desktop and mobile gave identical results for every check except the layout numbers in check 8. In the downloads, file prefixes S0 to S4 are the stages: S0 initial import; S1 after re-including the off-depth BHP; S2 with both in-range BHP excluded (0 markers); S3 both re-included (2 markers); S4 after the valid upload (3 markers). To keep the folder small only S0 and S4 files are kept on desktop and only the test-records files on mobile; the sha256 of every download at every stage is in the results JSON.

Result for each check, at 1280 and at 390 (identical unless stated):

1. **Import: PASS (1280 PASS, 390 PASS).** The synthetic package is accepted ("Evidence verification passed..."), adopted (artifact rrc-2026-10-10-uic000000417-df804201-eb4a-4aa5-8ef2-c550c6a70627, "Public history calculations eligible"). Injector history lists the 1a panel, then Test records last. Panel: "Records: 3 BHP, 1 step-rate · 4 explorer package, verified · 0 user upload, not verified · 1 flagged · 3 included · reference depth 3310 ft." Every row labelled `Explorer package, verified`. J readiness line present. Screenshots: desktop-c1-package-preview.png, desktop-c1-top.png, desktop-c1-test-panel.png, mobile-c1-*.png.
2. **Flags: PASS (PASS, PASS).** BHP 2022-05-16 (3140 ft) carries "Tested at a different depth from this well's other tests (reference 3310 ft); not directly comparable." and starts unticked (excluded). The BHP chart has 2 points (labelled 3310 ft each; "Points: 2 included comparable tests."). Panel text: "Before the reported H-10 range (no timeline marker): BHP 2022-05-16, SRT 2022-05-16." Screenshots: c2-flags-bhp, c2-srt-table, c2-bhp-chart-2pts.
3. **Re-include: PASS (PASS, PASS).** Ticking BHP 2022-05-16: status "BHP 2022-05-16 included."; chart 3 points (labels 3140 ft, 3310 ft, 3310 ft); focus stays on the checkbox (aria-label "Include BHP 2022-05-16", data-focus-key box:package:bhp:1). Screenshot c3-bhp-chart-3pts. The re-included BHP is out of the H-10 range, so it gets a chart point but no timeline marker (marker count stayed 2).
4. **Markers and 1a exports: PASS (PASS, PASS).** The 1a ratio chart shows triangles (`[data-test-marker=bhp]`) for the in-range included BHP tests only: 2 (2024-02-12, 2024-07-22), chart note "Test markers (2): triangle BHP, diamond SRT, at the actual test date; not joined to any month."; 0 when both are excluded; 2 again when re-included; 3 after the 2025-01-10 upload. The out-of-range BHP and SRT never get a marker. The six 1a downloads (swd-selected-analysis.json/.csv/.svg from the existing buttons, and the h10-diagnostics-000000417-1e9da7fd6c64.json/.csv/.svg exports) taken at each of five stages with 2, 2, 0, 2 and 3 markers on screen are byte-identical across all stages (sha256 prefixes: legacy json 4eb92e0a3c06, csv feaf52c67e8b, svg 966eb1d59c09; h10 json 063335cde812, csv 6d2eb73a2399, svg 52432cc18156), and none of the SVG exports contains a `data-test-marker` element. Screenshots: c4-ratio-chart-markers, c4-ratio-chart-no-markers, c5-ratio-chart-3-markers. A marker-free "before" for the same 1a decisions was produced by excluding both in-range BHP (stage S2), since the panel adds markers on mount.
5. **Upload: PASS (PASS, PASS).** Valid BHP CSV for 000000417: status "Added 1 BHP records from upload-valid-bhp-000000417.csv (not verified)."; the 2025-01-10 record is labelled `User upload, not verified`; coverage becomes "4 BHP, 1 step-rate · 4 explorer package, verified · 1 user upload, not verified"; markers 3. Per spec section 4.2 an upload resets the decisions, so the off-depth BHP is excluded again and the chart has 3 points (7102, 7103, 7104); this is expected, not a defect. Wrong-UIC CSV: rejected with "Row 2: UIC 000000999 is not the selected well 000000417."; tables, coverage line, chart point count and markers are identical before and after (tablesIdentical true). Screenshots: c5-after-valid-upload, c5-after-rejected-upload.
6. **Exports: PASS (PASS, PASS).** Download names: test-records-000000417-c0985f70f63f.{json,csv,svg} (stage S0, package only, 4 records) and test-records-000000417-7d3c3810b873.{json,csv,svg} (stage S4, with the upload, 5 records). `verifyTestRecordsSealed` returns true for both JSON files at both widths (verify-evidence-output.txt); method `test-records/1`.
7. **Reset and stale: PASS (PASS, PASS).** A test-records JSON download clicked in the same task as "Pinned example" produced 0 downloads (after a 2.5 s wait). The panel on the pinned well shows "No test records for this well." with "Records: 0 BHP, 0 step-rate...", no tables, 0 chart points and 0 markers. Screenshot c7-pinned-well-reset.
8. **Layout: PASS at 390 (page scrollWidth 390 = clientWidth 390, no page-level horizontal scroll); PASS at 1280 (scrollWidth = clientWidth = 1265).** At 390 the test tables and charts scroll inside their containers (overflow-x auto): BHP table scrollWidth 813 in clientWidth 306, SRT table 1376 in 306, charts 650 in 306. Screenshots c8-test-panel-layout, c8-test-tables.

DOM-only items reviewers asked the browser to confirm:

- (i) **BHP basis line after the table: PASS (1280, 390).** "Source field named psia; RRC Permian guidance says PSIG; unresolved, not converted." is the paragraph immediately after the BHP table, visible. With the gate blocked: **NOT REACHED** (no ineligible package exists and this synthetic package's gate is ready; the blocked branch stays covered by inspection and the Task 4/5 unit tests only).
- (ii) **J readiness line: PASS (1280, 390).** Exactly "Calibrated injectivity (J): not ready. Needs a flowing bottomhole pressure with a same-time rate and a reservoir pressure reference (Phase 1c)." (string-equal check in the driver). Also present on the pinned well.
- (iii) **SRT table headers and blanks: PASS (1280, 390).** Headers "ISIP (psig, as reported)", "Frac pressure (psig, as reported)", "FIRC surface pressure (psig, as reported)"; blank ISIP, FIRC surface pressure, FIRC rate and comments show "not reported"; frac pressure shows 1,610.
- (iv) **Re-include note: PASS (1280, 390; re-run after the final fix wave).** The out-of-range SRT 2022-05-16 (ticked by default) was unticked with a reason and re-ticked; the note beside it now reads " Included; dated before the reported H-10 range, so no timeline marker." (the earlier wording "(missing date or pressure)" was inaccurate for a record that has both and was fixed in web/test-records.mjs:61). The same note shows on first render for that SRT and beside the re-included off-depth BHP, which is also dated before the range. Screenshot c3-srt-reinclude-note (replaced).
- (v) **Focus: PASS (1280, 390).** After a decision, focus is on that record's decision checkbox (aria-label "Include BHP 2022-05-16" / "Include SRT 2022-05-16"). After a successful upload and after a rejected upload, focus is on the file input (data-focus-key upload, type file).
- (vi) **1a downloads byte-identical: PASS (1280, 390)**, see check 4.
- (vii) **Sealed JSON verifies: PASS (1280, 390)**, see check 6.
- (viii) **Pinned well and stale download: PASS (1280, 390)**, see check 7.
- (ix) **No page-level horizontal scroll at 390: PASS**, see check 8.
- (x) **No console errors: PASS at 390; PASS at 1280 with one benign entry.** The only error entry is "Failed to load resource: 404" for http://127.0.0.1:4174/favicon.ico (the local static server has no favicon) at 1280; none at 390. No uncaught exceptions, no console.error calls.

Tally (checks 1-8 plus items i-x, 18 each): 1280 PASS 18, FAIL 0; 390 PASS 18, FAIL 0. NOT REACHED: one sub-condition only (item i with the gate blocked), at both widths.

The Node driver prints a harmless libuv "Assertion failed ... async.c" message on exit on Windows, after results are written.

## Spec section 8 naming map

| Spec section 8 name | Implemented |
|---|---|
| `src/testRecordsChart.ts`: `timelineMarkers(records, range)` | `timelineMarkers(state)` lives in `src/testRecords.ts` (takes the TestState; the range is inside the state). The chart module only draws: `testPressureSvg(state)` returning `{svg}`; markers are drawn by `ratioOverTimeSvg(state, markers)` in `src/h10DiagnosticsChart.ts` |
| `testPressureSvg(series)` | `testPressureSvg(state)` |
| `applyDecision` | `applyTestDecision(state, key, include, reason)` |
| Parse BHP/SRT rows, flags, initial decisions | `rowsFromTable(table, expectedUic)` (CSV upload), `buildTestState(input, range)` (flags, reference depth, initial decisions), `referenceDepth`, `bhpSeries`, `rangePosition`, `outOfRange`, `hasMarker`, `testCoverage` |
| `src/testRecordsExport.ts`: seal, verify, JSON, CSV, SVG | `sealTestRecords(state, source)`, `verifyTestRecordsSealed(sealed)`, `testRecordsJson`, `testRecordsCsv`, `testRecordsSvg(sealed, state)` |
| `web/test-records.mjs`: Session and `mountTestRecords(root, {...})` | `createTestRecordsSession({selection, gate, range})`; `mountTestRecords(root, {selection, gate, download, range, onMarkers})` returning `{dispose()}` |
| `web/h10-diagnostics.mjs`: optional marker input | `mountH10Diagnostics` returns `{dispose(), setMarkers(next), range}`; import-ui passes `onMarkers: markers => h10Panel?.setMarkers(markers)` |
| `web/explorer-package.mjs`: accept query version 3 or higher (section 5.1 header) | v4 exactly (amendment 4); the v4 test files are parsed by `web/explorer-tests.mjs` (new) with `web/explorer-evidence.mjs` edited |

## Open items

- The blocked-gate branch of the panel (basis line, blocked notice, exports refused) was not reached in the browser; covered by unit tests and inspection only.
- Final fix wave: after the I1 note-wording fix the full suite, oracles, layer re-record (pending-review) and the browser run (all checks, both widths) were repeated; results above are from the re-run.

## Rulings (copied from .superpowers/sdd/2026-10-30-test-records/progress.md)

- Ruling 1: Workers and Main do not commit per task; changes stay uncommitted until owner acceptance, then Main commits — AGENTS.md + plan Global Constraints override the SDD per-task commit default (as in 1a). Review packages are working-tree diffs via wtdiff.sh. — Cost if wrong: no per-task commit granularity.
- Ruling 2: Model mapping as 1a: implementers sonnet, reviewers opus; Task 4 (receiver, verbatim producer copies) implementer opus per owner-approved recommendation. — Cost if wrong: cost/turns only.
- Ruling 3: Tasks 1-3 dispatched as ONE batch (three pure TS modules with complete code; sequential dependency inside one worker) with one combined opus review. — Cost if wrong: larger single review surface.
- Ruling 4: Task 7 Step 4 independent Opus review is served by the SDD final whole-branch review (seven-field brief); Step 6 owner accept and Step 7 commit/push are owner-gated, run stops there. — Cost if wrong: one extra review.
- Ruling 5: Task 4 implementer (opus) dispatched in parallel with the Tasks 1-3 review — disjoint write sets (explorer-*.mjs + v4 tests vs src/testRecords*), 2 active slots; a Tasks 1-3 fix round waits for a free slot. — Cost if wrong: a delayed fix round.
- Ruling 6: I1 — spec §9 binds over plan values: all tests (Tasks 1-5) and the Task 7 browser package use one synthetic set on UIC 000000417: BHP 2022-05-16 1512@3140 (off-depth, before range), 2024-02-12 1705@3310, 2024-07-22 1731@3310 (+2024-11-05 1768@3310 where 4 are needed); SRT 2022-05-16 perfs 3305–5120 frac 1610 psig max 24.10 bpm grad 0.710, report ids 7101-7104/7201, tracking 90000417/90000418. Task 4 implementer told mid-run. — Cost if wrong: test literal churn only.
- Ruling 7: I2 fix — kind-specific no-pressure reason ("No bottomhole pressure reported." for BHP). — Cost if wrong: one string.
- Ruling 8: I3 — §4.5 binds for markers: marker = included + valid date + inside range + pressure present; depth is required only for the BHP chart (§4.2 "for the BHP chart no depth"). Export `contributes` = point on the BHP chart OR a timeline marker. Marker labels show missing parts as "not reported", never "null". — Cost if wrong: an extra marker for depthless tests.
- Ruling 9: I4 fix — escape test must inject hostile text into a field actually drawn. — Cost if wrong: none.
- Ruling 10: I5 duplication accepted as recorded debt — removing it means exporting helpers from accepted 1a modules (h10DiagnosticsExport.ts is not in this layer's changes); cost if wrong: escaping/CSV-injection fixes must be applied in two places.
- Ruling 11: Minors promoted into this round because the spec requires them: §9 "tests before and after an H-10 range" → fixture gets an after-range record; §4.5 tooltip "pressure with basis" → BHP marker label carries the psia/PSIG basis label wording "as reported", SRT marker label shows frac pressure "psig, as reported". Other minors deferred below.
- Ruling 12 (pre-dispatch, Task 5): the brief's session tests attach invented test rows to the real pinned well 000020838 and use real Barbaro 23 test values. Per Ruling 6 and the global "synthetic test data uses UIC 000000417": the session tests build their selection from the Task 4 helper (buildV4Package → verifyExplorerPackage, UIC 000000417, synthetic BHP 1705/1731 @3310) and derive `range` from that artifact's months; the "without package tests" case may still use the pinned artifact (no invented records attached). Filename regex becomes test-records-000000417-…. — Cost if wrong: slower session tests (in-memory package build).
- Ruling 13: spec §9 `evidence_relations.json` mention is a spec error (producer does not emit it; V4 contract omits it); code stays, spec §9 wording to be corrected with the owner-visible spec repair. — Cost if wrong: none (receiver rejects undeclared files anyway).
- Ruling 14: fix I1 (spec binds) and, in the same round because the spec states them or they are one-liners: M2 SRT "psig, as reported" + blank text → "not reported" (§4.4); M3 note wording "contributes to no chart" made accurate per Ruling 8 (depthless BHP still gets a marker); M4 size check before arrayBuffer; M5 focus after upload; M6 dispose() calls onMarkers([]); M7 tests: package records survive re-upload, >2 MB rejected. Mid-export upload test left (deferred minor). — Cost if wrong: small deviation from plan code.
- Ruling 15: Task 7 Steps 1+3 (browser + record, sonnet) dispatched in parallel with the Task 6 review — writes only demo/ + scratchpad; if Task 6 needs fixes, affected browser checks are re-run. Synthetic package per Ruling 6. — Cost if wrong: one browser re-run.
