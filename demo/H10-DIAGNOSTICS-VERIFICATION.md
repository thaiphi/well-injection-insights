# H-10 diagnostics verification (Phase 1a, PRD ANA-E02)

Date: 2026-10-29. Branch feature/phase-1a-h10-diagnostics (work uncommitted). Layer h10-diagnostics is recorded pending-review; owner acceptance and commit are separate steps (Task 6 Steps 3-6).

## Commands

Run from the nested app folder (swd-injection-analytics/) unless noted. Direct Node paths only.

- `node --test tests/*.test.mjs` : tests 468, pass 468, fail 0.
- `node scripts/check-carried-oracles.mjs` : 4 recorded cases, 28 exact pressure points, 248 comparisons, 0 failures.
- Repo root: `node scripts/verify-preservation.mjs .` : 1 violation, "Layer h10-diagnostics baseline is pending/not accepted after independent review" (expected until the owner accepts).
- Repo root: `node --test tests/transfer.test.mjs tests/preservation-baseline.test.mjs tests/layer-registry.test.mjs` : 112 tests, 111 pass, 1 fail (the transfer live-root preservation test, failing only on the pending-layer violation above). `tests/portfolio-connection.test.mjs`: 8/8.
- Browser: `PORT=4174 node scripts/serve.mjs` plus headless Chrome 156 (`--remote-debugging-port=9333`), driven by demo/h10-diagnostics-evidence/h10-check.mjs (own CDP script; downloads captured by wrapping URL.createObjectURL and the anchor click). Run as `node h10-check.mjs 1280 900 0 desktop` and `node h10-check.mjs 390 844 1 mobile`. Downloaded JSON verified by demo/h10-diagnostics-evidence/verify-json.mjs using verifySealed from dist/h10DiagnosticsExport.js. Server and Chrome were stopped afterwards (ports 4174 and 9333 free).

## CR counts

web/import-ui.mjs: 4 CR bytes, on lines 334, 335, 336, 337 (the last four lines; 338 lines in total). Same count as before Task 5 (4, then on lines 330-333).

## RED to GREEN per task

All RED runs failed with ERR_MODULE_NOT_FOUND ("Cannot find module") for the not-yet-existing module (see .superpowers/sdd/2026-10-29-h10-diagnostics/task-1-3-report.md and task-4-report.md).

| Task | Test file | RED | GREEN |
|---|---|---|---|
| 1 | tests/h10-diagnostics.test.mjs | missing dist/h10Diagnostics.js | 15 pass (14 plus 1 fix-round test) |
| 2 | tests/h10-diagnostics-chart.test.mjs | missing dist/h10DiagnosticsChart.js | 6 pass |
| 3 | tests/h10-diagnostics-export.test.mjs | missing dist/h10DiagnosticsExport.js | 4 pass |
| 4 | tests/h10-diagnostics-session.test.mjs | missing web/h10-diagnostics.mjs | 8 pass |
| 5 | wiring in web/import-ui.mjs, layer spec | n/a (no new test file) | suite 468/0, oracles 248/0, layer pending-review |

## Browser results

Evidence: demo/h10-diagnostics-evidence/ (screenshots `desktop-*.png` at 1280x900 and `mobile-*.png` at 390x844; raw results `results-desktop.json`, `results-mobile.json`; downloads under `downloads/desktop` and `downloads/mobile`). Desktop and mobile gave identical results for every check except the layout numbers in check 6.

1. **Pinned well, Injector history: PASS.** The panel is the last child of the results area, below the three existing chart frames, the existing table and its details. Coverage text: "2024-01 to 2026-04 · 28 months in span · 28 reported · 0 gap months · 0 flagged · 28 included · 28 comparable." The three existing downloads are still enabled and produce swd-selected-analysis.json/.csv/.svg (on-disk bytes 52513 / 3413 / 41918; the JSON is 52507 characters because it has 3 non-ASCII characters). Screenshots: desktop-c1-top.png, desktop-c1-panel.png, mobile-c1-top.png, mobile-c1-panel.png.
   - Month review starts open by default (owner decision 2026-10-29, after the final review; it was previously open only when a month was flagged). Re-run at both widths after the change: c1_reviewDefault open=true; every other check unchanged, same download hashes. desktop-c1-review-open.png.
2. **Exclude and re-include: PASS.** Month 2024-03 (no system flag), month review opened first.
   - Untick with empty reason: status "A reason (1-200 characters) is required to exclude a month the system did not flag"; box stays ticked; focus moves to the reason field. desktop-c2-empty-reason-error.png.
   - Reason "Workover shut-in" then untick: comparable 28 to 27; the ratio chart shows one `×` marker (text[data-excluded], chart note "Excluded months: 2024-03"); status "2024-03 excluded."; focus stays on the "Include 2024-03" checkbox after the re-render. desktop-c2-excluded.png, desktop-c2-excluded-charts.png.
   - Lost-click check: clicked into the excluded month's reason field, typed " (edited)", then clicked "Download diagnostics JSON" directly with real mouse events (reason field still focused). The click was not lost: h10-diagnostics-000020838-d5c0f13c050c.json downloaded, and its 2024-03 record carries the edited reason.
   - Re-tick: comparable back to 28, 0 markers, "2024-03 included."
3. **Downloads: PASS.** From the clean state: h10-diagnostics-000020838-4b2b48454ba7.json (18135 on-disk bytes), .csv (6081), .svg (30357); the sealed JSON of the edited run is 18032 bytes. All JSON files (4b2b... and the edited d5c0...) verify: `verifySealed` returned true, desktop and mobile copies. desktop-c3-after-downloads.png.
4. **Sample case well B: PASS.** Well A: 28 months. After excluding 2024-03 in A (27 comparable) and switching to well B: 16 months (2024-01 to 2025-04), 16 comparable, nothing unticked, empty status. Switching back to A: 28 comparable, nothing unticked (review reset). desktop-c4-well-b.png.
5. **Stale export: PASS.** Clicked the JSON download and switched wells in the same task, and again after one microtask: no file downloaded either time (0 downloads); the panel was disposed and remounted for the new well with an empty status.
6. **Mobile 390px: PASS.** document.documentElement.scrollWidth 390 = clientWidth 390 (no page-level horizontal scroll). Month table container scrollWidth 620 inside clientWidth 306 (overflow-x auto); each of the two chart containers 650 inside 306. Desktop 1280: no overflow (scrollWidth = clientWidth = 1265). mobile-c6-panel.png, mobile-c6-charts.png. Note: the script's "unscrolledOverflowers" list names a few BUTTON/SPAN elements outside the diagnostics panel that extend past 390px (not investigated; presumably off-canvas navigation); they cause no page-level scroll.
7. **Blocked gate: NOT RUN IN BROWSER.** Only tests/fixtures/explorer-packages/public-uic000056484.tar and provenance.json exist (no ineligible package), so this is covered by the Task 4 unit test only.

Additional observation (reviewer flag, recorded only): with source set to the pinned public example, the **Producer histories** view also routes through renderPublicResult, so the H-10 panel appears there too (page title "Public injection trends"). Screenshots: desktop-histories-public.png, mobile-histories-public.png. Whether that is acceptable is an owner/reviewer decision.

No failures found. The Node driver prints a harmless libuv "Assertion failed ... async.c" message on exit on Windows, after results are written.

## Evidence notes (post final review)

- The "bytes" fields in results-desktop.json and results-mobile.json are JavaScript string lengths (characters), not on-disk bytes; h10-check.mjs now emits them as "chars". On-disk sizes are the ones quoted in the browser results above (differences arise only for the 3 non-ASCII characters in swd-selected-analysis.json).
- verify-json.mjs output (verifySealed true on all four files): the clean-state JSON (4b2b48454ba7) lists excluded= none; the edited-run JSON (d5c0f13c050c) lists excluded= 2024-03: Workover sh (edited)ut-in, for both desktop and mobile copies. It now reads months[].include and months[].reason.

## Spec section 4 naming (Ruling 2)

| Spec name | Implemented |
|---|---|
| buildCalendar / flagMonths / initialDecisions | diagnoseMonthly |
| screeningSeries | screening |
| mountH10Diagnostics({root,getSelection,getGate}) returning {render(),reset()} | mountH10Diagnostics(root,{selection,gate,download}) returning {dispose()}; re-mounted after every clearResults |
| diagnosticsSvg(sealed) | diagnosticsSvg(sealed,state) |

## Final review

Independent Opus final review verdict: Ready for owner acceptance: Yes. 0 Critical, 0 Important. Minors left and recorded: (1) the ratio chart has no marker for re-included unusable months; (2) pressure-rate points are labelled by month only through the SVG title tooltip (spec section 3.4 says points labelled by month); (3) the blocked-gate on-screen branch is verified by inspection and the unit test only.

## Owner decisions after the final review (2026-10-29)

- Month review open by default even with 0 flags (one-line change in web/h10-diagnostics.mjs: review.open=reviewOpen??true). Layer re-recorded pending; nested 468/0, oracles 248/0, verify-preservation 1 violation (pending), browser checks 1-6 re-run at 1280 and 390 with identical results.
- Panel also showing in the public Histories view (follows the existing renderPublicResult route): accepted as is.

## Rulings (copied from .superpowers/sdd/2026-10-29-h10-diagnostics/progress.md)

- Ruling 1: Workers (and Main) do NOT commit per task; changes stay uncommitted until owner acceptance, then Main commits — plan Global Constraints + AGENTS.md ("Workers never stage, commit or push"; "Main commits after owner acceptance") override the SDD default of per-task commits. Review packages are working-tree diffs via wtdiff.sh. — Cost if wrong: no per-task commit granularity; trivially fixable at commit time.
- Ruling 2: Follow the plan's function names/signatures over the spec §4 table — the spec table is architectural sketch, behaviour (§3) is what binds and the plan implements it; plan is owner-reviewed. — Cost if wrong: renaming exports.
- Ruling 3: Tasks 1-3 dispatched as ONE batch (three pure modules, complete code in plan, transcription + tests) with one combined review — same-shape work. — Cost if wrong: a larger review surface for one reviewer.
- Ruling 4: Task 6 Step 3 "independent Opus review (D13)" is served by the SDD final whole-branch review on Opus with the seven-field brief; Step 5 (owner accept) and Step 6 (commit/push) are owner-gated, so the run stops there. — Cost if wrong: one extra review.
- Ruling 5: Task 5 Step 1 (layer spec + `record-layer.mjs h10-diagnostics archive`) done by Main BEFORE Task 1 — archive only copies `changes` (import-ui), so earlier is strictly safer ("archive before editing"). Output `archived 1`, archive byte-identical to import-ui (CR=4 on lines 330-333, verified by byte count). Task 5 implementer skips Step 1. — Cost if wrong: none; archive is the same bytes.
- Ruling 6: Global Constraint "existing Injector history table, three charts and their exports must stay unchanged" vs Task 5 Step 7 (CSV/SVG gate change for the sample case) — spec §4 mandates the gate fix; "unchanged" binds export CONTENT, not the readiness gate, which now matches the JSON handler at import-ui:311. — Cost if wrong: revert one line pair.
- Ruling 7: Model mapping — the shared workflow names GPT roles (Codex); this Claude session maps implementer→sonnet (medium), reviewer/Astra-equivalent→opus, mechanical→haiku. Recorded per dispatch below. — Cost if wrong: cost/turns only.
- Ruling 8: spec §3.7 binds over plan code — add coverage rows + an "unavailable" notice row to the CSV, with a test. — Cost if wrong: a few extra CSV header rows.
- Ruling 9: Minor #2 (firstInjection ignores duplicate months, so a zero-volume month after a positive-volume duplicate month is mislabelled before-first-injection) contradicts spec §3.2's rule "no earlier month has positive volume" — fix it in the same round, with a test. — Cost if wrong: label only.
- Ruling 10: fix the plan-mandated Important (UX/accessibility the spec's "guided month review" depends on) plus Minor #2 (blocked-case footer claims months "contribute to the screening views") and Minor #3 (reason edits on an already-excluded month silently dropped) in the same round — all in one file, cheap. — Cost if wrong: small deviation from plan code.
