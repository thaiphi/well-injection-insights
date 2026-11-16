# #7 (ANA-E06) and #8 (ANA-E07) QA notes: Pressure buildup over time, Nearby wells

Branch `feature/e06-e07-transient-interference` at `93357c7`. Chrome 157.0.8103.39 (headless, CDP 9333), Node v24.13.0. Date 2026-11-15.

## Commands

From `swd-injection-analytics/`: `node ../node_modules/typescript/bin/tsc -p tsconfig.json` (exit 0); `PORT=4174 node scripts/serve.mjs`; Chrome `--headless=new --remote-debugging-port=9333` with a scratchpad profile.
- `node demo/e06-e07-evidence/e0607-check.mjs 1280 900 0 desktop <scratch>/e0607-qa`
- `node demo/e06-e07-evidence/e0607-check.mjs 390 844 1 mobile <scratch>/e0607-qa`
- Main-branch comparison: `git archive bdced55 swd-injection-analytics` (main, the merge base) built in the scratchpad with the same tsc, served on 4175, then `... 1280 900 0 main <scratch>/e0607-qa 4175 sample` and `... 390 844 1 mainm <scratch>/e0607-qa 4175 sample`.
- Downloads are verified in the driver with `verifyTransient` from `dist/transientExport.js` (JSON). CSVs are parsed with a quote-aware splitter that treats CRLF as a line end.
- Gate: `node scripts/check-all.mjs` from the repo root.

Servers (4174, 4175) and Chrome were stopped. Ports 4174, 4175 and 9333 were confirmed free, and no Chrome process with the QA profile was left running.

## Data (fictional only)

- **User case.** Imported through the real import UI, then "Use illustrative geometry" and Calculate:
  - `data/samples/seed417-history.csv`;
  - `data/samples/assumed-injectors.csv`, with wells FICTIONAL-INJ-A and FICTIONAL-INJ-B;
  - a scratchpad schedule CSV, FICTIONAL-NEW-01/02, starting 2026-01.
  - The forecast spans 2026-01 to 2026-12.
- **Packages** (scratchpad only, built by `mkpkg.mjs` from `buildV4Files()` in `tests/helpers/explorer-v4.mjs`):
  - **UIC 000000417:** the helper output.
  - **UIC 000000418:** the same output with every 417 replaced by 418, and `vol_liq` of the 2024-06 row set to `0`, so the well has one reported-zero month. It was then re-hashed and re-sealed with the helper's `refreshEvidence()` and `derive()`.
  - Both pass the app's `verifyExplorerPackage` (`calculationEligibility.ready: true`).
  - Window 2024-01 to 2026-04, 16 reported months, 12 gap months.
  - SHA-256:
    - pkg-417.tar `3849b032890619bef7e4ec703b5421455a228155b5614b26b8989c2ecb96e389`
    - pkg-418.tar `1ca1775e3454d5e8698fe763762f76a71ea23fef77656603f6bf0b07bd00b0a7`
- **Missing-month case.** I found no user-import path that produces non-consecutive demand months; planning months are built as a continuous first-to-last range. The missing-month DOM path was therefore driven by dispatching a `disposal-case-result` event with a fictional case built in the page by `dist/disposalCase.js`.
  - The demand months are 2028-01, 2028-02 and 2028-04, the same shape as the session test.
  - Wells: FICTIONAL-GAP-A and FICTIONAL-GAP-B.
  - The calculation then runs through the real worker.
- **Where things are kept.** Screenshots and downloads stay in the scratchpad (`e0607-qa/shots`, `e0607-qa/dl`); only `screenshots-SHA256SUMS.txt` is committed. The sample case holds real TRRC wells, so sample text in `results-*.json` is digit-redacted, and the E05 and E10 lines are kept as SHA-256 only.

## Results (desktop 1280×900 and mobile 390×844, identical outcomes)

| # | Scenario | Result | Evidence (`results-<tag>.json` key) |
|---|---|---|---|
| 1 | **No case.** The panel is hidden and reads "Load or calculate a disposal case to choose a well". | PASS | `s0_noCase` |
| 1 | **After the user case.** The wells are A and B. Nothing is pre-filled; Calculate is disabled and every rock and boundary input is listed. The nearby section shows only "Set up the subject well's buildup first". | PASS | `s1_afterCase` |
| 1 | **Example and copy.** Well A, Load fictional example ("fictional example — not typical values", closed boundary), then Copy forecast: 12 months, 2026-01 to 2026-12, origin "Forecast (copied from disposal case …)". | PASS | `s1_copy` |
| 1 | **Missing month** (fictional case event). After the copy, 2028-03 is empty with placeholder "required". Its aria-label reads "Rate for 2028-03 (not in the disposal case: enter a rate (0 = shut in))". Calculate stays disabled and the message is listed. After typing `0`, Calculate is enabled, the calculation runs, and the limit reads "not reached within the schedule". | PASS | `s1b_missingMonth` |
| 1 | **Calculate.** All of these show: "First month at the limit: 2026-05", end pressure, "of which skin: 82 psi", 3 profile tables captioned "rise above initial; excludes skin", the average-rise table, "Average rise at month 2026-12: 2,651.6 psi (closed boundary)", the hand-off note, warnings and the closing line. | PASS | `s1_result` |
| 2 | **Low k.** Inputs: k 0.01, c_f 1e-4, φ 0.4, r_w 2, closed.<br>• Every month is blocked with exactly "the step is too short for this model (wellbore storage and early-time effects are not modelled)". Each of the 12 blocked rows has 2 cells, with no digits outside the month.<br>• The chart has 0 points.<br>• The limit reads "not determined: 2026-01: the step is too short…", and "not reached" appears nowhere.<br>• "Average pressure rise: not shown (2026-01: …)" shows, with no average table. | PASS | `s2_lowK` |
| 3 | **Editing after a result.** Typing `1234` into the 2026-02 rate keeps focus on every keystroke. The result is withdrawn (0 result headings) and both #7 downloads are disabled. The origin switches to "Synthetic/assumed (typed)". Typing `50.5` into k keeps focus. | PASS | `s3_editWithdraws`, `s3_M1` |
| 3 | **M1, refused forecast copy during a run.** Set-up:<br>• a fictional case event whose well FICTIONAL-GAP-B has no Base allocations;<br>• well B selected, 6 typed months.<br>Calculate was clicked, then Copy while the status read "Calculating the pressure buildup…". The copy was refused with "Well FICTIONAL-GAP-B has no Base forecast months to copy", and the calculation completed ("Calculated…", limit "not reached within the schedule"), with no "replaced" error. | PASS | `s3_M1_refusedCopy` |
| 3 | **M1, refused set-up during a run** (the same rule, from a real user case). "Set up typed months" was clicked with empty fields during a calculation. The refusal was listed and the calculation completed. | PASS | `s3_M1` |
| 3 | **Nearby withdrawal.** An offset edit withdraws only the screening; the buildup result is kept. A subject edit (h) withdraws both. Each withdrawal disables the matching downloads. | PASS | `s3_nearbyWithdrawal` |
| 4 | **Loading packages.** Both packages are listed with no alert. No radio is checked, and each "after last report" select shows "Choose… (no default)". The interval line ("3,028–3,118 ft, as reported; depth basis unknown") is shown. The reported-zero question appears for 418 only. | PASS | `s4_loaded` |
| 4 | **Before "connected".** Distances are typed at 1,000 and 3,000 ft; focus is kept while typing. Run stays disabled, listing "choose connected or not connected (there is no default)" for both wells and the zero-month question for 418. | PASS | `s4_refusedBeforeConnected` |
| 4 | **One connected, gaps unfilled.** 417 connected, 418 not connected, zeros answered.<br>• 417 reads "incomplete: 12 gap months without a typed rate" with "no number".<br>• 418 reads "excluded by assumption" in "Your selection".<br>• The total reads "incomplete: no total while a counted offset has no number". | PASS | `s4_incomplete` |
| 4 | **Zero-month question for 418.**<br>• Before the answer: the 418 evidence reads "15 reported, 1 reported zero, 12 with no H-10 row", and 13 gap inputs show ("13 of 13 gap months to fill").<br>• After answering "yes, shut in": 12 gap inputs show, because the zero month left the gap table. | PASS | `s4_loaded`, `s4_incomplete.gapInputsAfterZeros` |
| 4 | **Gaps filled, both connected.** The run shows all three views, each with a ranking table: 417 at 14.6 psi (60.1%) and 418 at 9.7 psi (39.9%), "partial history (lower bound)", total 24.3 psi. The closing line is correct. | PASS | `s4_complete` |
| 4 | **Gaps filled, 417 connected and 418 not connected.** The three views differ:<br>• *All connected*: 14.6 and 9.7, total 24.3 psi.<br>• *Your selection*: 417 at 14.6 psi (100.0%) and 418 "excluded by assumption", total 14.6 psi.<br>• *No offsets*: both rows excluded, "no offsets counted". | PASS | `s4_mixed` |
| 5 | **With t_ref 2025-12** and "after last report" set to shut in.<br>• Each view shows "First month at the limit: 2026-05".<br>• The removal list reads "Without UIC 000000417: 2026-05" and "Without UIC 000000418: 2026-05".<br>• A Bottomhole (psia) column is present.<br>• The sensitivity table and "order not distinguishable" are shown. | PASS | `s5_withTref` |
| 5 | **Wrong t_ref** (2026-01). Shows the core refusal "…must start the month after … expected 2026-02, got 2026-01", with no results. | PASS | `s5_wrongTref` |
| 5 | **Without t_ref.** No limit month, no removal list, no Bottomhole column, 0 "psia" strings in the nearby results, and the rise-only label is shown. | PASS | `s5_withoutTref` |
| 6 | **#7 downloads.**<br>• `swd-transient-buildup-<sha12>.json`: `verifyTransient` OK in Node, `interference: null`.<br>• The CSV has 184 lines, every line with 4 fields, and the closing #7 line.<br>• The **interference** JSON passes `verifyTransient` OK with interference present.<br>• The interference CSV has 408 lines, all with 4 fields, and **both** closing lines (#7 and #8). | PASS | `s6_transient`, `s6_interference` |
| 7 | **Sample case.**<br>• The panel offers both sample wells. Example plus Copy gives 12 months with none empty, and the calculation completes with the closing line.<br>• E05 has 8 summary lines and E10 has 2 "Wells compared" rows. Their SHA-256 (and the status line) are identical to the main `bdced55` build at both widths, both before and after the panel calculation. | PASS | `s7_panel`, `s7_e05e10`, `s7_e05e10_afterPanel`, main `results-sample-main*-port4175.json` (scratch) |
| 8 | **Console errors.** At each width the only entry was the acceptable favicon 404 from the static server. There were no exceptions and no console.error calls. | PASS | `s8` |
| 9 | **Mobile layout.** No horizontal page scroll (390 = 390; desktop 1265 = 1265), also checked after the nearby results. On mobile the three views stack: all at left 27, tops 2370, 3043 and 3716, width 336. On desktop they sit side by side (lefts 251, 580, 909). | PASS | `s9`, `s9_afterNearby`, `s4_complete.views[].rect` |
| extra | **Closed run with every month blocked.** Shows "Average pressure rise: not shown (…)" and no empty table. | PASS | `s2_lowK.checks` |

**Note on M1.** I found no user-import path in which a copy is refused, because every case well gets an allocation in every month. The refused-copy branch was therefore driven by a dispatched fictional case result with well B's allocations removed. The click handler, the session and the worker are the real ones.

### Engineer-requested DOM paths NOT CHECKED in this run

From the Task 7 and Task 8 lists:
- refusals for loading the same package twice, an overlapping window or a non-ready package, and the Remove button;
- typing in a nearby field while a #7 calculation runs;
- a source switch or a case recalculation keeping the packages and clearing the choices;
- "Export cancelled" when an edit lands during re-verify;
- the example label for typed values that happen to match, and after a source switch;
- a well change clearing a copied schedule and the start and count fields;
- focus returning after the zero-radio and after-select rebuilds;
- the "partial" example label.

Session tests cover most of these. A follow-up browser run can add them.

## Gate: `node scripts/check-all.mjs` (6 of 8 pass, as expected)

```
FAIL  Preservation gate (182 protected files)
PASS  Assemble analytics app
FAIL  Root transfer, preservation and connection tests   (120/121; the 1 failure is the preservation assertion)
PASS  Hosting adapter unit tests (vitest)
PASS  Type-check hosting adapter
PASS  Type-check analytics app
PASS  Build site
PASS  Analytics engineering suite and carried oracles (944/944 tests; 248 comparisons, 0 failures)
```

Both failures are the unrecorded preservation layer.
- Unapproved bytes in `web/import-ui.mjs`, `web/index.html` and `web/redesign.css`.
- Unlisted new paths: `src/interference.ts`, `offsetHistory.ts`, `transientCase.ts`, `transientExport.ts` and the other new files.

This is by design until the layer is recorded.

## Defects

**D1 (minor to moderate): a removal effect that is "not determined" reads as "no limit month found within the schedule".**
- **Steps:**
  1. User case, well A, example, Copy forecast, Calculate.
  2. Load both packages, type distances, mark both connected, answer zeros and fill all gaps.
  3. Set t_ref to 2025-12 and leave "After last report" at "Choose… (no default)".
  4. Run.
- **Actual:**
  - Each counted view reads "First month at the limit: limit month not determined: UIC 000000417 has no complete schedule through 2026-12 (no choice for after last report (2026-04))".
  - The removal list underneath reads "Without UIC 000000417: no limit month found within the schedule" and the same for 418 (`s5_withTrefNoAfterChoice`).
  - The view itself says why the limit cannot be determined: a connected offset has no after-last-report choice. The offset that remains after each removal has the same missing choice, so each removal result is also undetermined, not "not reached".
  - The wording reads like "not reached", which the #7 rule forbids for a blocked or undetermined result.
  - With the after-last-report choice set to shut in (`s5_withTref`), the same removals read "2026-05".
- **Expected:** "not determined: …" (or no removal list) when the remaining set cannot be determined.
- **Cause:** `removalText` in `web/transient-buildup.mjs` maps every null `limitMonth` to "no limit month found within the schedule". Task 8 interpretation 8 notes that the core gives no reason.

**D2 (minor): the copy date uses the UTC date, not the user's local date.**
- **Steps:** Copy the forecast after 18:00 local time in a UTC−6 zone.
- **Actual:** The origin note and the schedule label read "copied from disposal case, 2026-11-16" while the local date was 2026-11-15 (`s1_copy.originNote`). The date is also sealed into the export.
- **Cause:** the default `today` is `new Date().toISOString().slice(0,10)`.

## Observations (not defects)

- **"No offsets" view wording.** Every row reads "excluded by assumption" in both the Status and the Added psi columns, even for wells the user marked connected. A user may read it as "I excluded these" rather than "this view leaves all offsets out by definition". A wording such as "not counted in this view" would avoid that. The repeated text in two columns also widens the table.
- **The after-last-report choice is not required before a t_ref run.** The run is allowed and the limit month reads "not determined: … (no choice for after last report)". That is correct, but the user only learns it after running, and it is what leads to D1. Listing it as a live message when t_ref is set (as the spec's "needs an 'after last report' choice") would be clearer.
- **A wrong t_ref is listed only after Run.** Run stays enabled, and after the refusal the status line still reads "Ready to run." while the refusal is listed below.
- **Desktop column width.** At 1280 each view is about 313 px wide, so the ranking table scrolls horizontally inside its region and the Distance column is cut off until scrolled. There is no page scroll.
- **Distance sensitivity with t_ref.** The range for UIC 000000417 is "0.9 to 0.9" between 500 and 2,000 ft. This is plausible: since t_ref, the late-time rise difference is almost independent of distance. Noted so a reviewer is not surprised.
- **Low-k case with r_w 1.** In an earlier exploratory run (results overwritten, not evidence) r_w 1 did not trigger the guard. That run read "First month at the limit: 2026-01", with the end of the schedule blocked by "outside the 100–10,000 psia range of the fluid model". The recorded run uses r_w 2.
- **Download bytes differ between desktop and mobile** (the import mapping embeds a random UUID in the case evidence). Both verify.

## Slot

QA complete. The slot can be released.

## Recheck after the final fix wave

**Setup.** HEAD `93357c7` plus the uncommitted fixes:
- `src/interference.ts`, `src/transientExport.ts` and `web/transient-buildup.mjs`;
- 3 test files.

`node scripts/prepare-swd.mjs` (exit 0), then tsc (exit 0). Same Chrome 157.0.8103.39 and Node v24.13.0, on 2026-11-16.

**Drivers.**
- **New driver `e0607-recheck.mjs`:** `node demo/e06-e07-evidence/e0607-recheck.mjs 1280 900 0 desktop <scratch>/e0607-qa` and `390 844 1 mobile`. Its results go to `results-recheck.json` under `desktop` and `mobile`.
- **Original driver, re-run in full:** `e0607-check.mjs ... rcfull-desktop|rcfull-mobile`. Its raw output stays in the scratchpad; the summary is in `results-recheck.json` under `fullRerun`.

**New fictional packages** (`mkpkg-hi.mjs`, scratchpad only), for item 5:
- UIC 000000419, every month 360,000 bbl: `6e7d7aa54dbc10c62d378672dc996bded2b6763e45c8733955000eac9dc331f0`
- UIC 000000420, every month 30,000 bbl: `1212b95daa7e0b24e1342707bf323cd4dbb68565f6fe566b15d40b64ee0e54ac`

Screenshot hashes (`r-*` and `rcfull-*`) are appended to `screenshots-SHA256SUMS.txt`. Servers and Chrome were stopped, and ports 4174, 4175 and 9333 are free.

| # | Check | Desktop | Mobile | Evidence |
|---|---|---|---|---|
| 1 | **D1.** t_ref 2025-12, both offsets connected, no after-window choice.<br>• Every removal line reads "Without UIC 000000417: not determined: UIC 000000418 has no complete schedule through 2026-12 (no choice for after last report (2026-04))", and the same with the wells swapped.<br>• "no limit month found" appears nowhere.<br>• Each counted view also shows "includes partial-history wells; direction unknown". | PASS | PASS | `d1_noAfterChoice` |
| 2 | **D2.** The page ran under a timezone override of Pacific/Pago_Pago (UTC−11), so its local date differed from the UTC date. The copy note reads "…, 2026-11-15)", equal to the page's local date and not the UTC date 2026-11-16. | PASS | PASS | `d2_copyDate` |
| 3 | **The 'none' view.** Both rows read "not counted in this view (subject alone)" in Status and Added psi, with no "excluded by assumption". In "Your selection", 418 (not connected) still reads "excluded by assumption". The full re-run shows the same (`fullRerun.s4.mixedRows`). | PASS | PASS | `i3_views` |
| 4 | **Pre-run checks.** Each of these is listed before Run, with the status "Complete the inputs listed above to run." and Run disabled:<br>• wrong t_ref 2026-01: "…must start the month after … expected 2026-02, got 2026-01";<br>• ranking month 2025-11 against t_ref 2025-12;<br>• ranking month equal to t_ref ("Ranking month … must be after …").<br>Clearing the ranking month gives "Ready to run." | PASS | PASS | `i4_preRun` |
| 5 | **High pressure.** A dispatched fictional case: P_i 9,000, limit 9,900, the probe1 rock, no-edge boundary, 12 typed months at 100 STB/day. Offsets 419 at 500 ft and 420 at 3,000 ft, both connected, gaps typed, after-window "shut in", t_ref 2025-12.<br>• In both counted views the Bottomhole column reads 9,659.8, 9,813.7 and 9,970.2, then "not shown (outside the 100–10,000 psia range of the fluid model)" from 2026-04 on.<br>• The largest bottomhole number shown is 9,970.2.<br>• The limit is 2026-03.<br>• The 'none' view is not blocked and reads "not reached within the schedule". | PASS | PASS | `i5_highPressure` |
| 6 | **CSV and JSON.**<br>• The #7 CSV has 129 lines, all with 4 fields, including 20 `inputs` rows.<br>• The interference CSV has 425 lines, all with 4 fields: 20 `inputs`, 38 `offset-inputs` and 12 `packages` rows (artifact_id, manifest_sha256, window and permitted_interval), plus both closing lines.<br>• Both JSONs verify with `verifyTransient`. | PASS | PASS | `i6_downloads` |
| 7 | **Scenarios 1–9 re-run in full; all unchanged:**<br>• limit 2026-05 and skin 82 psi;<br>• the missing month blocks until filled;<br>• low-k guard exact, with "Average pressure rise: not shown";<br>• focus kept, results withdrawn, M1 set-up and copy;<br>• three views;<br>• t_ref limit and removals;<br>• exports verify.<br>The sample's E05 summary lines and E10 rows hash the same as the main `bdced55` build, both before and after the panel calculation. The wrong t_ref is now refused before Run (Run disabled). | PASS | PASS | `fullRerun` |
| 8 | **Console and layout.**<br>• Console: no errors, apart from an occasional favicon 404 from the static server.<br>• Horizontal scroll: none (desktop 1265 = 1265, mobile 390 = 390).<br>• Views: stacked on mobile (left 27). | PASS | PASS | `i8_console`, `i8_scroll`, `fullRerun.s8/s9` |

**Recheck observation (new, not a defect against the brief).** In the high-pressure views, the months where Bottomhole is blocked by the fluid-model range still show the two rise columns, 9 months per counted view (`risesShownInBlockedMonths`).
- The own rise is about 542–554 psi. Offsets added runs from 570.8 psi to −10,115.8 and −12,368.8 psi after the offsets shut in.
- This differs from #7, which hides the whole row of a PVT-blocked month.
- The rises are basis-free, so this may be intended. A user could still add them to P_i, and the large negative falloff since t_ref looks odd next to a blocked absolute. Main to decide.

D1 and D2 are fixed; the wording, pre-run and high-pressure items are confirmed. No new defects.
