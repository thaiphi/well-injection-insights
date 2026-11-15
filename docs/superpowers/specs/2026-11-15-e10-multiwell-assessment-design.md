# Phase 3c: ANA-E10 multiwell assessment — attach reported history to the user's own case — design

Date: 2026-11-15. Issue: thaiphi/well-injection-insights #9 (PRD `docs/project-2-swd-injection-analytics-expansion-prd.md` §4, ANA-E10).

**Status.** The owner asked to brainstorm this "as an engineer" with Fable. Fable's recommendation, including the four owner calls below, was accepted on 2026-11-15 ("yes"). The owner approved this document as a whole on 2026-11-15 ("ok"), after the builder check and owner call 4 ("option1").

**Deliverable.** This document is the design. Building it is a later go-ahead, and so is the build order (owner call 2): the shared package loader first, then #9, then #7 and #8 together.

## Why

**The question it answers:** "For each well in my own disposal case, does its reported injection history make my assumed performance and forecast believable, and which well is least supported?"

**When an engineer reaches for it:**
1. **Before signing off a forecast:** which well is the weak link, and does its history back up what was assumed?
2. **When one well is down and water has to move:** has the receiving well ever taken this rate, and for how long?
3. **Before trusting the case at all:** is the evidence comparable across wells (months of history, gaps, pressure basis, where J came from)?

**What exists today.**
- E05 Part B (`src/wellHistoryCheck.ts`) already runs the history-against-forecast check, but only for the **sample** case, through `linkedWellHistories()` (`web/import-ui.mjs`).
- The user's own (`user`) and `demo` cases read "cannot be checked: no H-10 history loaded" for every well.
- E05 deferred the linking of Explorer packages to the user's own case wells to this issue, as its first step (E05 "option 2").

## Owner decisions

| # | Decision |
|---|---|
| Brainstorm | Fable's engineer-view recommendation, accepted 2026-11-15. |
| 1 | **#9 attaches reported history to the user's existing case.** It is not a separate multiwell case built from Explorer data. Demand comes only from the case the user already has: their uploaded or typed forecast, or the labelled demo or sample. A public-only case stays `not_ready` with the existing reason (`web/disposal-context.mjs`). This closes open question G28 (D14). |
| 2 | **Build order:** the package loader (designed in #8, owner call C) is built first as a shared piece, then #9, then #7 and #8 together. |
| 3 | **Several packages per case well** are joined as in #8 (non-overlapping windows; months between windows are gaps). Each UIC can be linked to only one case well. |
| 4 | **First version:** one comparison table; clicking a row expands that well's detail **inside the same panel** (owner, 2026-11-15, "option1", after the builder check). The existing single-well tools (H-10 diagnostics, test records, pressure reconciliation, well assumptions) exist only in the Explorer and sample views and are built around one package, so wiring them to the user's own case is a later, separate piece. No side-by-side charts; small per-well charts come later only if the table is not enough. |

## Goals

1. **Load packages:** load Explorer packages next to a `user` or `demo` case with the shared loader.
   - The loader is a "Load history packages" control inside this panel. It sits beside the existing single-package Explorer receiver and **does not switch the data source**.
   - The existing receiver keeps its behaviour: adopting a package there switches to `public` and withdraws every link.
   - Loaded packages stay in the session list across a source switch; only the links are withdrawn.
   - Main's call after the builder check.
2. **Link:** beside each case well, the user picks a loaded UIC from a dropdown, or "no history".
3. **Run E05 Part B for every linked well:**
   - the rate check (V1);
   - the onstream note (V2);
   - the pressure warning (P1, only with a confirmed basis, D8);
   - the case summary's A6 lines.
   This works for the user's own and demo cases, exactly as it does for the sample today.
4. **A "Wells compared" table:** one row per case well, inside the disposal case under "What the case says".
5. **Detail:** clicking a row expands that well's detail inside the panel (owner call 4).

## Non-goals

- **No map,** no distances and no nearby-well discovery (D14).
- **No "wells move together" highlights or correlation.** They suggest connectivity, which is #8's territory and which the tool never infers.
- **No pressure modelling or interference** in this view (#7 and #8).
- **No new navigation tab or workspace** (D19).
- **No public-only multiwell capacity case** (owner call 1).
- **No saved links** (D10); links live in the session only.
- **No two-way handoff** (D18).

- **No change to the existing single-well tools** in v1 (owner call 4).

## Anti-goals (a failure even if it works)

- **A link that changes a calculation input.** A link is **evidence only**: it never changes J, limits, availability, allocation or demand. H-10 alone never unlocks a calibrated or complete capacity case. A calibrated J still comes only from qualifying test records (D5).
- **Matching by name.** No fuzzy matching and no auto-suggest; the user picks every link.
- **A missing month, missing package or unlinked well shown as zero.**
- **A ranking or wording that reads as risk, advice, or proven, safe or sustainable capacity.** The E05 banned-word test applies.
- **Real TRRC values committed to the repo.**

## Linking

- **Shape:** case `wellId` → one UIC → that UIC's loaded packages (each identified by `artifactId` and manifest SHA-256), joined in month order (owner call 3).
  - This feeds the same `HistoryLink {wellId, label, uic, monthly, surfaceBasis}` that E05's `checkWellHistory` already consumes.
  - `linkedWellHistories()` gains a branch for `user` and `demo` cases; the sample branch is unchanged.
- **Who decides:** the user, through a dropdown per case well listing the loaded UICs plus "no history". There is no pre-selection.
- **Refused:**
  - one UIC on two case wells;
  - linking on a `public` source (no case exists).
- **Month inclusions:** each linked well uses E05's "default H-10 month inclusions" (`diagnoseMonthly` default decisions), labelled as such. The live single-well H-10 diagnostics session is not the source; this is E05's existing call, kept.
- **Pressure basis:** asked per linked well in the panel, as E05 does for the sample (D8). A well without a confirmed basis reads "pressure not checked".

**What withdraws the links' results** (the E05 summary, the "Wells compared" table and the exports):
- **Withdraws the link itself:**
  - the case well is removed, or the injector profile is re-imported;
  - a linked package is removed, or its manifest hash changes;
  - the data source is switched.
- **Keeps the link, but withdraws the checks and recomputes them:**
  - any link or basis change;
  - any disposal case input change (as in E05).

## "Wells compared" table

One row per case well. The columns:
- **Well:** the case label and `wellId`.
- **Linked UIC,** or "no history linked".
- **Coverage:** the window, months with reported injection, and gap months.
  - Gaps are counted against the packages' acquisition windows (`scope.startMonth` to `scope.endMonth`), joined as in #8, so edge months with no rows count as gaps.
  - This is a table-only figure. `HistoryLink` and `checkWellHistory` stay unchanged and row-based, so sample results do not change.
  - Default month inclusions are computed over the joined history.
  - Main's call after the builder check.
- **Rate check (V1):** the forecast peak allocated rate against the highest reported month, the ratio, and the counts of months on each side, in E05's exact wording.
- **Pressure check (P1),** or "pressure not checked".
- **J source:**
  - `user` and `demo` cases: always "assumed (case input)". A disposal-case well has no J-origin field, and a test-referenced J never reaches the disposal case today.
  - The sample: its existing input class from `src/sampleCase.ts`.
  - #9 adds no path for a test J into the case, because that would be a new calculation input. Never from H-10.
  - Main's call after the builder check.
- **Status:**
  - within or above reported history (E05's V1 verdict);
  - cannot be checked (no history or no usable month);
  - no injection reported;
  - These are E05's `HistoryStatus` values, reused verbatim.
  - Gaps are **not** a status. As in E05, they are a label beside the verdict: "N gap months in the window; a gap is never zero" (Main's call after the builder check). E05's check uses only reported months, so gaps never make up a value.

**Behaviour:**
- **Row order:** the case's own well order. There is no ranking or "least supported" sort, to avoid reading as risk; the user reads the statuses. (My call.)
- **Clicking a row** expands that well's detail inside the panel. One well is expanded at a time. The detail shows:
  - E05's history-against-forecast timeline (`historyTimelineSvg`);
  - its coverage, with the windows and the gap months;
  - the rate and pressure check sentences, with their cited values;
  - its pressure-basis confirmation;
  - the packages behind it (`artifactId`, manifest SHA-256, window).
- **Missing data:** each part with no data for that well shows its missing state explicitly ("no H-10 package linked to this well", "pressure not checked: no confirmed basis"), never a previous well's data.
  - This meets the PRD rule "switching wells updates every panel or explicitly marks its missing dataset" within this panel.
- **Not changed:** the existing single-well tools. Wiring them to the user's own case is out of #9 v1 (owner call 4).
- **Exports:** the E05 JSON and CSV exports gain the links, with UIC, `artifactId`, manifest SHA-256, window and inclusion basis per well. They are sealed and verified as in E05 (SHA-256 over key-sorted canonical JSON, recompute on verify, re-verified before download).
  - **Format version:** the schema version moves from `case-insights-export/1` to `/2`. That is left to the plan, which also decides whether old files still verify.

## Constraints

- **Determinism:** the same case, packages, links, inclusions and bases give byte-identical results and exports.
- **Labels (E01, D12):**
  - H-10 volumes are *reported*;
  - forecasts are *forecast*;
  - case inputs keep their existing class;
  - links and bases are *user-declared*.
- **Reuse, don't duplicate:**
  - one loader (the #8 design);
  - one eligibility path (`calculationEligibility.ready`);
  - one history check (`wellHistoryCheck.ts`).
- **Data:** fictional only in tests (fictional UIC `000000417` and other fictional UICs). No Explorer artifact in the repo. Screenshots that show real package values stay outside the repo, with hashes only, as in E05.
- **Preservation:** one reviewed layer for the loader and #9 (name chosen at plan time).
- **Checks:** direct Node paths only. CR bytes: `web/import-ui.mjs` keeps exactly 4, `web/index.html` exactly 3, and new files 0.

## Acceptance (from issue #9)

| Criterion | How it is shown |
|---|---|
| A two-well case opens and compares eligible historical observations without fabricating pressure-model outputs | A fictional two-well `user` case with two fictional packages: both rows checked; no modelled pressure anywhere in the table (tests and browser) |
| Switching wells updates every panel or marks its missing dataset | Browser: expand well 1, then well 2 with no linked package; the detail shows well 2's data or its missing state, never well 1's |
| Unexpected source changes invalidate dependent results and exports | Tests and browser: remove a package, change a link, switch source; results and downloads are withdrawn |
| The second well's missing H-10 or tests show incomplete/not_ready, not zero | An unlinked well, or one with no usable month, reads "cannot be checked"; a well with gaps carries the gap label; no zero anywhere (tests) |
| The handoff stays hash-verified and user-confirmed | Loader refusals (bad hash, overlap, not calculation-ready) and user-picked links only (tests) |

**Also required:**
- the full gate (`node scripts/check-all.mjs`);
- browser evidence at desktop and mobile widths;
- independent review, then QA, then the owner accepts the layer.

## Left to the builder (plan)

- **Code layout:** module split and the exact mount point. Follow the E05 panel pattern.
- **The detail layout** inside the panel. Keep protected-file edits minimal: `web/import-ui.mjs` should change only in `linkedWellHistories()` and the mount.
- **Sentence templates,** within E05's wording and the banned words.
- **The export schema version,** and whether old files still verify.
- **How the loader and #9 split into plan tasks.**
