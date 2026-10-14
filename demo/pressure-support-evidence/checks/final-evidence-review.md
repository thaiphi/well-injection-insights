No further material is needed: every in-scope snapshot, image, the parity record and the retained JSON have been read; the remaining questions are answered by what Main did not produce (CSV/SVG files, unrun states), not by anything else on disk.

BEGIN_PRESSURE_FINAL_EVIDENCE_REVIEW

**Summary**

- Read-only final evidence review of `tmp/pressure-support-execution-2026-10-12/browser-resume/` (16 snapshots, 14 images inspected as images), `download-verification.json`, the retained `downloads/pressure-support-context.json`, `final-source-review.md`, prior `final-gates.json` and the baseline. No checks run by me.
- **What the evidence establishes (observed):** the context tab is reachable with the six areas and all old tabs intact (every snapshot `:6-46`); dataset identity, verified SHA `dfb32bed…`, classification and "separate from the active planning dataset" are shown (`pressure-support-ready.txt:51-64`); the Feb-2024 anchor row reads `1,000 / 250 / 1,250 / 20 / 87,000 / 58,000 / 145,000` (`:164-173`); P01 Jun-2024 missing water and I02 Aug-2024 missing injection appear as `Unavailable` with named reasons, never zero (`:204-213,:224-233`); P02 Sep-2024 zero denominator gives `0/0/0/Unavailable` (`p02-zero-denominator.txt:232-241`); empty injector selection keeps the producer series, aggregate `Unavailable`, notice shown (`no-injectors.txt:94,:170-177`); reversed period is blocked with downloads disabled (`invalid-period.txt:93-98`); out-of-coverage event listed not plotted (`ready:135,:397`); source rows exposed (`context-with-planning-demo.txt:398-1166`); the accepted context survives selecting the planning demo and the demo stays separate (`context-with-planning-demo.txt:33-34,:64,:1180`); the Reports card exists with its own controls (`12-reports.txt:108-116`). The retained JSON download carries `resultSha256 dadb99ea…`, source hash/bytes `dfb32bed…/30351`, the Feb anchor and null gaps (`downloads/pressure-support-context.json:20-29,:1157-1209`); Main's `download-verification.json` records JSON parity PASS after correcting its own harness input (`:3,:15-16`).
- **Required gates that fail or remain blocked (observed):**
  1. **CSV and SVG download parity BLOCKED** — `download-verification.json:4-5` "no saved file observed"; the plan requires actual JSON/CSV/SVG downloads verified against displayed hash and metadata (plan Task 5 `:128`). UI button clicks are not file evidence.
  2. **Responsive/layout FAIL** — `pressure-support-desktop.jpg` shows a horizontal scrollbar across the main area, the chart subtitle clipped at the right edge ("…investigation view, not a p") and the "Calculate context" button rendered as a full-width pale bar with near-invisible white text; Main's measurements (desktop client 1265 px vs scroll 1325 px; mobile document scroll 1422 px at 390 px) agree. `pressure-support-mobile.jpg` is a shrunken wide capture rather than a 390-px stacked layout. Plan Task 3 `:69` required panels to stack at 390 px with scrolling contained inside regions and visible, labelled controls; Task 5 `:126` required passing 1536×1024 and 390×844 captures. Contrast of the primary action is an accessibility defect.
  3. **UNRUN required checks** — refresh, repeated load/cancel/retry, corrupt/slow load, slow-export interruption, browser-saved CSV/SVG, and the old-workspace error states; the 12 old workspaces were navigated and captured (`01-start`…`12-reports`, all with "Acceptance blockers — full acceptance remains open" visible) but not recalculated: Capacity/Sweeps show "Source inputs changed… downloads disabled" (`08-capacity.txt:130-133`, `09-sweeps.txt:75-80`), PVT/Hydraulics uncalculated (`10-pvt.txt:72-75`, `11-hydraulics.txt:119-123`), and only the workbook/worked-study cards are enabled (`12-reports.txt:48,:93`). The Reports card for the context was never observed enabled with a current result.
- No application code changed after resumption (`snapshot-stability.json`: 194 files, none changed); the source verdict (PASS) stands and is not reopened by these findings — they are browser/layout/evidence gaps, not source defects reviewed earlier, except that the CSS/table containment issue is a real rendering defect that will need a scoped, owner-approved fix and a re-review.
- **FINAL_VERDICT: FAIL.** No full acceptance; baseline must remain `pending-review`; no `accepted` flip until items 1–3 are resolved and re-reviewed.

**Files touched:** none.

**Needs judgment**

1. Owner-scoped fix question (pending): the layout defect is in new files only (`web/pressure-support.css` grid children keep `min-width:auto`; table region needs contained scrolling; button contrast). Any fix changes a new-file hash and requires re-sealing the 12-file inventory and a focused re-review; no writer is currently approved and the auto-review rejected an implementer restart. This is a process decision for the owner, not something this review can waive.
2. CSV/SVG parity: Main must locate or re-download the files from the isolated profile and verify them with the same harness used for JSON (hash of embedded `resultSha256`, SVG `<metadata>` equals artifact, CSV monthly rows vs independent arithmetic). Until then SWD-08 for this slice is not evidenced.
3. Reports-card enablement for a current context (and its `click()` path) and keyboard focus on the chart region are asserted by Main but have no snapshot; include in the rerun.
4. The old-workspace pass is navigation-only; SWD-05/06/10 numeric behaviour was already evidenced in the earlier Opus demo pass and the 390/390 suite, but the brief's "all old errors" states remain UNRUN in this resumed browser and should be listed as such in the verification record rather than implied.
5. Not a defect but worth recording: `12-reports.txt:111-114` shows the context card disabled at capture time; if a context was calculated beforehand, the ordering (source change/reload) should be stated so the disabled state is not misread.

**Gates**

- Observed by me (evidence read): context numerics/nulls/notice/blocked/source-rows/separation — PASS as listed above; JSON download artifact contents — consistent with pin and displayed values; desktop layout — FAIL (visible overflow and contrast); mobile layout — FAIL (per Main's measurement; image consistent); CSV/SVG parity — BLOCKED; Reports card enabled state — UNVERIFIED.
- Attributed to Main/Opus (not rerun): 390/390 suite, 248 oracle comparisons, both type gates, static assembly, 182-file preservation with pending-status-only violation.
- UNRUN: refresh, repeated cancel/retry, corrupt and slow loads, slow-export interruption, browser-saved CSV/SVG, old-workspace error states, keyboard chart focus capture.
- Checks personally run: none.

END_PRESSURE_FINAL_EVIDENCE_REVIEW

Assignment complete; slot released. No baseline acceptance until the missing browser/download gates are resolved and re-reviewed.
