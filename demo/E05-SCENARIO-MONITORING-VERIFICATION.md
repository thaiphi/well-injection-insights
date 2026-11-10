# ANA-E05 scenario and monitoring verification (acceptance evidence for layer phase-2b-scenario-monitoring)

Date: 2026-11-10. Issue: thaiphi/well-injection-insights #6. Branch `feature/e05-scenario-monitoring`.

- Design: `docs/superpowers/specs/2026-11-10-e05-scenario-monitoring-design.md`. The owner approved it on 2026-11-10.
- Plan: `docs/superpowers/plans/2026-11-10-e05-scenario-monitoring.md`.
- The layer stays recorded as pending-review until the owner accepts it.

## What changed

A new panel, **"What the case says"**, sits under the Disposal capacity case results. The calculation engine (`src/disposalCase.ts`) is unchanged.

| Part | Files | What it does |
|---|---|---|
| A, Case summary | `src/caseSummary.ts` | Rules A1–A8: fit, limits, pressure warnings, tightest month, compared case, history (A6), performance cases (A7), and the fixed closing line "Screening estimate from assumed inputs; not proven field capacity." Each line expands to show its cited values and method. |
| B, History vs forecast | `src/wellHistoryCheck.ts` | Volume is the primary check: the peak forecast calendar-day rate against the highest reported H-10 month, with reported bbl/day treated as STB/day, and the counts of months on each side. Pressure is a warning only, and only with a confirmed psig/psia basis (D8). There are separate empty states (no history loaded; no usable month; no injection reported; no forecast allocation), and a missing month is never zero. History is linked only where the case already holds it, which is the sample case. Linking Explorer packages to the user's own cases moves to #9. |
| C, Well-performance cases | `src/performanceCases.ts` | Pessimistic, Base and Optimistic cases. Each applies one J multiplier, one reservoir-pressure offset and one availability multiplier (capped at 1) to every well, as flat end-of-period values. Inputs start neutral. The output shows headroom, the offset as % of headroom, wells with no headroom, unsupported-pressure months, and attribution by single-factor runs, labelled non-additive. |
| Composition and exports | `src/caseInsights.ts` | Seals the insights with a SHA-256 over key-sorted canonical JSON. Verification recomputes everything from the stored inputs; JSON/CSV exports re-verify before download. |
| Panel | `web/case-insights.mjs`, `web/performance-worker.mjs` | A pure session module, mounted from `web/import-ui.mjs`. Performance runs and export verification happen in a Web Worker. Any disposal input change withdraws the panel and its downloads. |

**Protected files changed**, with before-images archived in `migration/baselines/phase-2b-scenario-monitoring-before/`:
- `src/disposalSensitivity.ts`: one word (`export` on `summarize`).
- `web/import-ui.mjs`: 4 added lines (import, module-local sample history link, placement, mount). It still has exactly 4 CR bytes.
- `web/index.html`: one empty container. It still has exactly 3 CR bytes.
- `web/redesign.css`: the sensitivity view also hides `#case-insights`.

## Commands (direct Node paths; Node v24.13.0)

From `swd-injection-analytics/`:
- `node ../node_modules/typescript/bin/tsc -p tsconfig.json`: clean.
- `node --test tests/*.test.mjs`: **738 tests, 738 pass, 0 fail**. The baseline was 638; this layer adds 100 tests in 5 new files.
- `node scripts/check-carried-oracles.mjs`: 248 comparisons, 0 failures.

From the repository root: `node scripts/prepare-swd.mjs` exits 0.

Each task was written test first, and each engineer report records its failing run. The reports are in the git-ignored SDD workspace.

## Acceptance (issue #6)

| Criterion | Result | Evidence |
|---|---|---|
| Cases rerun deterministically | PASS | Determinism tests in all four src test files. Desktop and mobile downloads in Chrome were byte-identical (QA). |
| Availability applied once | PASS | `performance-cases.test.mjs`: the availability-only case equals the engine run with availability halved by hand, zero availability gives zero, and the cap is at 1. Only `well.availability` changes; the engine applies it. |
| Edits invalidate exports | PASS | Browser: editing an input hides the panel and disables the downloads (QA scenario 4). Tamper tests reject edits to the summary, history rows, basis, performance spec and case inputs. |
| Synthetic scenarios retain labels | PASS | Reported / forecast / calculated / "Assumed well-performance case" labels appear on screen and in the JSON and CSV (tests and QA). |
| No future field capacity presented as proven | PASS | The closing line is fixed. A banned-word test (proven, sustainable, calibrated, validated, safe) covers A1–A7 and the history and performance text. |

**Other requirements:**
- Missing history reads "cannot be checked", never zero.
- A well without a basis reads "pressure not checked".
- A well with no headroom is reported.

All three: PASS (tests and QA).

## Browser evidence (QA agent, headless Chrome 157.0.8103.39 over CDP)

Driver: `demo/e05-evidence/e05-check.mjs`. Notes: `demo/e05-evidence/QA-NOTES.md`. Statuses and hashes: `results*.json`.

Every scenario passed at 1280×900 and at 390×844.

| # | Scenario | Result |
|---|---|---|
| 1 | Sample case: panel order (results → this panel → sensitivity sweep), summary lines, both sample wells linked | PASS |
| 2 | Basis confirmation changes the pressure note, shows "Confirmed: psig — QA", focus returns to Confirm | PASS |
| 3 | Performance cases start neutral; Pessimistic run gives the results table, attribution and A7; editing a factor clears them | PASS |
| 4 | Editing a disposal input withdraws everything | PASS |
| 5 | JSON and CSV downloads; JSON verifies in Node | PASS after fix D1 (below) |
| 6 | Panel hidden in the sensitivity view | PASS |
| 7 | Demo case: every well reads "Cannot be checked: no H-10 history loaded for this well." | PASS |
| 8 | No console errors; the performance worker loads | PASS. The only log entry is a favicon 404 from the static server. |
| 9 | Mobile: no horizontal page scroll; the timeline fits its container | PASS |

**Recheck after the final fix wave** (`results-recheck.json`): a Chrome-sealed insights JSON with performance cases, 206,313 bytes, SHA-256 `bf30746fd6ac05ca6dd7a49872a50c2a27b53ebbdc54c07c7b832e83e79fb375`. It verifies in Node, and a summary line edited without resealing is rejected.

**Data rule.** The sample case holds two real public TRRC wells.
- No downloaded file and no screenshot is committed. The 20 screenshots show reported per-month values on screen, so they are kept outside the repository; only their SHA-256 sums are in `demo/e05-evidence/screenshots-SHA256SUMS.txt`.
- The committed evidence holds statuses, counts, well IDs and hashes only.
- All test fixtures are synthetic (fictional UIC `000000417`, wells FICTIONAL-A/B).

## Reviews

- **Per-task reviews** were independent (Opus, read-only) with scoped re-reviews:
  - Tasks 1 and 3 were approved directly.
  - Task 2 needed 2 fix rounds: misleading pressure notes, duplicate-only history read as "no injection", and a guard for a missing allocation.
  - Task 4 needed 1 fix round: a crash on a linked well with zero history rows, plus three tamper tests.
  - Task 5 needed 1 fix round: the panel was visible in the sensitivity view, an export during a calculation was dropped silently, and re-renders collapsed sections, lost focus or lost typed text.
- **Final whole-branch review** returned CHANGES REQUIRED, with two Important findings:
  - the offset as % of headroom and the unsupported-pressure months were not shown;
  - the history counts were not stated.
  It also raised two Minor items: the "treated as STB/day" label, and a ratio of 1.04 printing as "1.0×".
- **QA defects:**
  - D1: a Chrome-sealed JSON failed Node verification, because about 12 friction values differ in the last digit between V8 builds.
  - D2–D5: wording.
- **One fix wave** addressed all eleven items. The scoped re-review was APPROVED with no new breakage.

**D1 decision (Main's ruling):**
- Verification keeps an exact SHA-256 over the stored body.
- It compares the recomputed insights structurally: strings, booleans, nulls, keys and array lengths exactly; numbers within 1e-9 relative.
- Results are not rounded before sealing.
- The reviewer confirmed that no status, month, count or summary sentence can change under this tolerance.
- Chrome and Node may produce different `contentSha256` values for the same inputs; both verify.

**Deferred minors** (the final review triaged all of them as safe to defer; listed for the record):
- A5 echoes its input numbers unformatted.
- `+0` is printed for a +0.4 bbl change.
- The A4 reduce assumes at least one month; the engine guarantees 1–120.
- There is no test of an offset below 100 psia; it takes the same engine path as the upper-bound test.
- `cappedWells` uses `a>1`.
- The raw performance spec is stored.
- CSV numbers skip the formula guard, which is intentional since numbers cannot be formulas.
- The canonical-JSON hash format needs documenting; this record does that.
- The sample basis map is never cleared.
- Status-text overwrite during an export.
- The both-null A5 sentence is redundant.
- A shortfall of −0.4 prints as 0.
- Exact comparison for integer counts.
- The D5 heading could also show the well ID.

## Not covered

- Linking Explorer packages to user or demo cases, which is #9.
- Transient buildup (#7) and interference between wells (#8).
- Publishing on Lovable, which the owner does after merge.
