# Shared history-package loader + #9 (ANA-E10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal.** Let the user load Explorer H-10 packages next to their own (`user`) or `demo` disposal case and link each case well to one UIC. E05's history-against-forecast check then runs for every linked well, and a "Wells compared" table with an in-panel row detail sits inside "What the case says".

**Architecture.**
- **Pure modules, all `src/` TypeScript compiled to `dist/`:**
  - `historyPackages.ts`: the package set, refusals, joined history, window gaps. This is the shared loader from the #8 design, minus #8's offset-only rules.
  - `caseHistoryLinks.ts`: well→UIC links, `HistoryLink` assembly, table rows.
- **Exports:** `caseInsights.ts` gains link provenance and export schema `/2`.
- **Panel:** `web/case-insights.mjs` gains the loader control, link dropdowns, the table and row detail.
- **Mount:** `web/import-ui.mjs` changes only on the mount line.
- **Unchanged:** the disposal engine, `wellHistoryCheck.ts` and the sample path.

**Tech stack:** TypeScript 5.9.3 (`node ../node_modules/typescript/bin/tsc -p tsconfig.json`), `node:test`, plain ES modules in `web/`, Web Crypto. No new dependencies.

**Specs:**
- `docs/superpowers/specs/2026-11-15-e10-multiwell-assessment-design.md` (#9, binding).
- `docs/superpowers/specs/2026-11-15-e07-interference-screening-design.md`: its sections "Multi-package loader" and "Offset-well history" (window and gap rules) only.

**Issue:** thaiphi/well-injection-insights #9. The PR uses "Closes #9" only if the owner accepts the layer; the loader parts of #8 stay referenced as "Refs #8".

**Branch:** `feature/e10-history-linking` from main `5833752`.

## Global Constraints

**Commands.**
- Direct Node paths only; no npm, npx, vitest or bare python. Work from `swd-injection-analytics/`:
  - `node ../node_modules/typescript/bin/tsc -p tsconfig.json`
  - `node --test tests/<file>.test.mjs`
  - Full gate, from the repo root: `node scripts/check-all.mjs`.

**Git and agents.**
- Workers never stage, commit or push; the orchestrator commits after each task review.
- At most 2 active subagents.

**Data.**
- Fictional data only in tests: UIC `000000417`, plus fictional UICs `000000418` and `000000419`, and wells FICTIONAL-A/B.
- Never copy an Explorer artifact into the repo.
- Screenshots showing real package values stay outside the repo, with hashes only.

**Bytes.**
- CR bytes: `web/import-ui.mjs` keeps exactly 4, `web/index.html` exactly 3, and every new or changed file has 0.

**Protected files.** These are pinned by `migration/source-manifest.json` or an earlier layer. Change them only after the layer spec and before-image archive exist (Task 0):
- `src/caseInsights.ts`
- `web/case-insights.mjs`
- `web/import-ui.mjs`

**Behaviour rules.**
- **A link is evidence only.** It never changes J, limits, availability, allocation or demand; `buildDisposalCase` input is untouched.
- **No name matching.** No auto-suggest and no pre-selection; every link is picked by the user.
- **Missing data is never zero.** A missing month, missing package or unlinked well never reads as zero.
- **Banned words:** generated text must not contain `proven|sustainable|calibrated|validated|safe` (the E05 banned-word regex `BANNED` in `src/caseSummary.ts`).
- **Shared limits:** 10 UICs per package set, and 20 packages per UIC. A package covers at most 36 months; the existing verifier already enforces that.

**Existing wording reused verbatim:**
- `NO_HISTORY`
- `PRESSURE_NOT_CHECKED`
- `RATE_CAVEAT`
- the `HistoryStatus` values `within | above | cannot-check | no-injection`

**New fixed copy:**
- Gap label: `"<N> gap months in the window; a gap is never zero."` (N formatted with `fmtNumber`).
- Unlinked: `"No H-10 package linked to this well."`
- J source: `"assumed (case input)"`.
- Link note: `"Reported history is evidence only; it does not change any case input."`

## Review Focus

1. **The same package loaded twice, or the same UIC with overlapping windows.** It is refused with a message, and the set is unchanged. (Task 1)
2. **A package removed after it was linked.** The link and every derived result and download are withdrawn; no stale row remains. (Tasks 2 and 4)
3. **Switching source user → demo → user.** Links are cleared and loaded packages are kept. (Task 4)
4. **A calculation-ready package with zero monthly rows** (acquisition allows it). The whole window counts as gaps, the well reads `cannot-check` with no crash, and the gap label shows. (Tasks 1 and 2)
5. **A recalculated case where a linked well was removed or renamed.** That well's link is pruned and nothing crashes. (Task 2)
6. **The sample case.** Its results, summary and exports are byte-identical to before. (Tasks 3 and 4: regression tests)

---

### Task 0 (orchestrator): branch, layer spec, archive

- [ ] `git checkout -b feature/e10-history-linking` from main `5833752`.
- [ ] Write `migration/layer-specs/phase-3c-history-linking.json`:
  - `purpose`: "#9 (ANA-E10): shared Explorer history-package loader and links from the user's own case wells to H-10 history, evidence only; Wells compared table".
  - `acceptanceEvidence`: `demo/E10-HISTORY-LINKING-VERIFICATION.md`.
  - `approvedDocs`: the E10 spec, the E07 spec and this plan.
  - `changes`: `src/caseInsights.ts`, `web/case-insights.mjs`, `web/import-ui.mjs`.
  - `newFiles`: `src/historyPackages.ts`, `src/caseHistoryLinks.ts`, `tests/history-packages.test.mjs`, `tests/case-history-links.test.mjs`, `tests/case-insights-links.test.mjs`.
  - `rootFiles`: `migration/layers/index.json`.
- [ ] Archive the before-images with `node scripts/record-layer.mjs phase-3c-history-linking archive`, run from the repo root. If it refuses because archives exist, byte-copy the three files into `migration/baselines/phase-3c-history-linking-before/` and verify them identical. This is the E05 precedent.
- [ ] With the unchanged code, seal a fictional two-well insights export. Use `buildDisposalCase` on fictional inputs, with no performance cases. Save it as `swd-injection-analytics/tests/fixtures/case-insights-v1.json` and add it to the layer's `newFiles`. Task 3 uses it to prove that `/1` files still verify.
- [ ] Commit: "E10 (#9): layer spec, before-images and /1 export fixture".

### Task 1: `historyPackages.ts`, the package set

**Files:**
- Create `swd-injection-analytics/src/historyPackages.ts`.
- Test: `swd-injection-analytics/tests/history-packages.test.mjs`.

**Interfaces:**
- **Consumes:**
  - `PublicMonthly` (`src/publicArtifact.ts`).
  - The frozen result of `verifyExplorerPackage` (`web/explorer-package.mjs`): `{artifact, pin:{artifactId, manifestSha256}, calculationEligibility:{ready, reasons}}`. Tests build this shape directly; they do not build TARs.
- **Produces:**
  ```ts
  export const HISTORY_PACKAGES_VERSION='history-packages/1';
  export const MAX_UICS=10, MAX_PACKAGES_PER_UIC=20;
  export type HistoryWindow={startMonth:string;endMonth:string;source:'acquisition'|'rows'}; // 'YYYY-MM'
  export type LoadedPackage={artifactId:string;manifestSha256:string;uic:string;window:HistoryWindow;monthly:readonly PublicMonthly[]};
  export type PackageSet={readonly packages:readonly LoadedPackage[]};
  export const EMPTY_PACKAGE_SET:PackageSet;
  export function packageFromVerified(v:{artifact:PublicArtifact;pin:{artifactId:string;manifestSha256:string};calculationEligibility:{ready:boolean;reasons:string[]}}):LoadedPackage;
  export function addPackage(set:PackageSet,p:LoadedPackage):PackageSet;      // throws Error with the refusal message; never mutates
  export function removePackage(set:PackageSet,artifactId:string):PackageSet;
  export function uics(set:PackageSet):string[];                             // sorted
  export type MonthState='reported'|'reported-zero'|'gap';
  export type JoinedHistory={uic:string;packages:readonly LoadedPackage[];window:{startMonth:string;endMonth:string};monthly:readonly PublicMonthly[];
    months:readonly {month:string;state:MonthState}[];counts:{reported:number;reportedZero:number;gap:number}};
  export function joinedHistory(set:PackageSet,uic:string):JoinedHistory;    // throws if uic not in set
  ```

**Rules:**
- **Window.** For a dynamic package, read it from `artifact.manifest.scope.start` and `.end` (`'YYYY-MM-01'` and the end-month first day; take `YYYY-MM`), with `source:'acquisition'`. If those keys are absent (the legacy pin), use the span of `period_start` of the rows, with `source:'rows'`. That case is labelled "window from reported rows (legacy package)" in the UI (Task 4).
- **`packageFromVerified` refuses:**
  - `ready:false`, with the message `"Package not calculation-ready: "` + reasons joined by `"; "`;
  - more than one distinct `uic_number` in `injectionMonthly` or `inventory`;
  - zero inventory rows.
  - A package with zero monthly rows is **allowed**: its uic comes from `inventory[0].uic_number`.
- **`addPackage` refuses** (message texts are the implementer's choice, but each must name the artifact or UIC):
  - the same `artifactId` or `manifestSha256` already in the set;
  - a window that overlaps another package of the same UIC;
  - an 11th UIC;
  - a 21st package for one UIC.
- **`joinedHistory`:**
  - Packages are sorted by `window.startMonth`, and the monthly rows are concatenated in month order.
  - The window runs from the earliest start to the latest end.
  - Each month in the window is classed:
    - `reported` when it has a row with `injected_liquid_bbl > 0`;
    - `reported-zero` when it has a row with `injected_liquid_bbl === 0`;
    - otherwise `gap`. That includes a missing row, a null volume, and months between windows.

- [ ] **Step 1: Write the failing tests** in `tests/history-packages.test.mjs`, using a helper `verified({artifactId, sha, uic, start, end, rows})` that builds the shape above:
  - `packageFromVerified` refuses `ready:false`, and the error message includes the reason text.
  - Two UICs in one package → throws.
  - Zero monthly rows → accepted; `uic` comes from the inventory.
  - Legacy, with no `manifest.scope.start`/`end` → `window.source==='rows'`.
  - Duplicate `artifactId` → throws. Duplicate `manifestSha256` → throws. The original set is unchanged (deepEqual before and after).
  - Same UIC, windows `2023-01..2023-12` and `2023-12..2024-06` → throws (overlap). Windows `2023-01..2023-12` and `2024-03..2024-08` → accepted, and `joinedHistory` reports 2024-01 and 2024-02 as `gap`.
  - An 11th UIC throws; a 21st package for one UIC throws.
  - A row with `injected_liquid_bbl:null` is `gap`; `0` is `reported-zero`; `>0` is `reported`; the counts add up to the window length.
  - Zero-row package with window `2024-01..2024-03` → 3 gaps, and `monthly` is empty.
  - Determinism: the same adds in a different order give a deepEqual `joinedHistory`.
- [ ] **Step 2:** Run `node ../node_modules/typescript/bin/tsc -p tsconfig.json; node --test tests/history-packages.test.mjs`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `src/historyPackages.ts` per the interfaces and rules.
- [ ] **Step 4:** Rerun. Expected: PASS. tsc is clean.
- [ ] **Step 5 (orchestrator):** commit "E10 (#9): history package set (shared loader core)".

### Task 2: `caseHistoryLinks.ts`, links, HistoryLink assembly and table rows

**Files:**
- Create `swd-injection-analytics/src/caseHistoryLinks.ts`.
- Test: `swd-injection-analytics/tests/case-history-links.test.mjs`.

**Interfaces:**
- **Consumes:**
  - Task 1's `PackageSet`, `joinedHistory` and `JoinedHistory`.
  - `HistoryLink`, `checkWellHistory`, `WellHistoryCheck` and `NO_HISTORY` (`src/wellHistoryCheck.ts`).
  - `BasisConfirmation` (`src/wellAssumptions.ts`).
  - `DisposalCase` (`src/disposalCase.ts`).
  - `fmtNumber` (`src/caseSummary.ts`).
- **Produces:**
  ```ts
  export const LINKS_VERSION='case-history-links/1';
  export const UNLINKED='No H-10 package linked to this well.';
  export const J_SOURCE_ASSUMED='assumed (case input)';
  export const EVIDENCE_ONLY='Reported history is evidence only; it does not change any case input.';
  export type WellLinks=Readonly<Record<string,string>>;            // wellId -> uic
  export function setLink(links:WellLinks,wellId:string,uic:string|null):WellLinks;   // null removes; throws if uic already linked to another well
  export function pruneLinks(links:WellLinks,wellIds:readonly string[],set:PackageSet):WellLinks; // drops unknown wells and UICs no longer in the set
  export function gapLabel(n:number):string;                        // `${fmtNumber(n)} gap months in the window; a gap is never zero.`
  export function historyLinksFor(wells:readonly {id:string;label:string}[],links:WellLinks,set:PackageSet,bases:Readonly<Record<string,BasisConfirmation|null>>):HistoryLink[];
  export type ComparedRow={wellId:string;label:string;uic:string|null;coverage:{startMonth:string;endMonth:string;reported:number;reportedZero:number;gap:number}|null;
    gapLabel:string|null;check:WellHistoryCheck|null;jSource:string;packages:{artifactId:string;manifestSha256:string;window:HistoryWindow}[]};
  export function wellsCompared(result:DisposalCase,links:WellLinks,set:PackageSet,checks:readonly WellHistoryCheck[],jSourceFor:(wellId:string)=>string):ComparedRow[];
  ```

**Rules:**
- **`historyLinksFor`** returns one `HistoryLink` per *linked* well, in the case's well order: `{wellId, label, uic, monthly: joinedHistory(...).monthly, surfaceBasis: bases[wellId] ?? null}`. Unlinked wells are omitted, so `checkWellHistory` gives them its existing `NO_HISTORY` result.
- **`wellsCompared`** gives one row per case well, in case order, with no sorting.
  - An unlinked well gets `uic:null`, `coverage:null`, `gapLabel:null` and `packages:[]`; the UI shows `UNLINKED`.
  - `gapLabel` is set only when `gap > 0`.
  - `jSource` comes from the caller. The panel passes `J_SOURCE_ASSUMED` for user and demo. For the sample, it passes `sampleCase.ts`'s injectivity input class when one exists, otherwise `J_SOURCE_ASSUMED`.

- [ ] **Step 1: Write the failing tests:**
  - `setLink` puts a UIC on a second well → throws, and the original is unchanged. `null` removes the link.
  - `pruneLinks` drops a link whose well is not in `wellIds` (Review Focus 5) and one whose UIC was removed from the set (Review Focus 2).
  - `historyLinksFor` gives an unlinked well no entry, and `checkWellHistory` then returns `reason===NO_HISTORY` for it.
  - Two packages joined → `monthly.length` equals the sum of both packages' rows, in month order.
  - Built on a fictional two-well `buildDisposalCase` result (reuse the E05 test-fixture helpers): well A linked to fictional UIC `000000417`, well B unlinked.
    - Row A has `check.status` `within` or `above`, its coverage and `jSource==='assumed (case input)'`.
    - Row B has `uic===null` and `check.reason===NO_HISTORY`.
  - A zero-row package linked → row coverage `gap` equals the window length, `gapLabel(3)==='3 gap months in the window; a gap is never zero.'`, and `check.status==='cannot-check'` with no throw (Review Focus 4).
  - **Evidence only:** `buildDisposalCase` input deepEquals before and after any link operation; none of the functions takes or returns case input.
  - **Banned words:** `BANNED` matches none of `UNLINKED`, `EVIDENCE_ONLY`, `gapLabel(5)` or `J_SOURCE_ASSUMED`.
- [ ] **Step 2:** tsc, then `node --test tests/case-history-links.test.mjs`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Rerun → PASS. Then run `node --test tests/well-history-check.test.mjs` → still PASS (unchanged).
- [ ] **Step 5 (orchestrator):** commit "E10 (#9): case well links and Wells compared rows".

### Task 3: exports with link provenance, schema `/2` (protected `src/caseInsights.ts`)

**Files:**
- Modify `swd-injection-analytics/src/caseInsights.ts`.
- Test: create `swd-injection-analytics/tests/case-insights-links.test.mjs`.

**Interfaces:**
- **Consumes:** Task 2's `ComparedRow`.
- **Produces:**
  - `CASE_INSIGHTS_SCHEMA='case-insights-export/2'`.
  - `buildCaseInsights(result, links, performance, compared?: readonly ComparedRow[])`. `compared` is stored as `CaseInsights.compared: ComparedRow[] | null`, and the default is `null`.
  - The CSV gains a "Wells compared" block with columns: well, wellId, UIC or `UNLINKED`, window start, window end, reported months, reported-zero months, gap months, status, J source, package artifactIds joined by `;`.
  - `verifyCaseInsights` accepts both `/1` (exactly as today, with `compared` absent) and `/2`. **Old files still verify** (my call).

**Rules:**
- Verification recomputes `compared` from the stored inputs: links, package provenance and monthly rows.
  - The stored `links` already carry monthly rows.
  - Store `compared[].packages` and `coverage`. Recompute coverage from the stored rows plus the stored windows, using Task 1's `joinedHistory` logic over stored `LoadedPackage`-shaped records. Compare structurally, with the existing 1e-9 relative tolerance.
- **Old shape kept:** with `compared` absent or null, a newly sealed `/2` file for the sample (no compared rows) has exactly the old fields plus `schemaVersion` `/2`.

- [ ] **Step 1: Write the failing tests:**
  - Seal and verify round-trip with two compared rows.
  - Tamper with one `gap` count without resealing → rejected. Tamper and reseal by hand with a wrong `coverage` → rejected by recomputation.
  - The stored `/1` fixture `tests/fixtures/case-insights-v1.json` (made in Task 0) still verifies.
  - The CSV has the "Wells compared" header and the `UNLINKED` text for an unlinked row.
  - Sample regression: for the sample-shaped links with `compared` null, every field except `schemaVersion` and `contentSha256` deepEquals the pre-change output (Review Focus 6).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Keep the diff to `caseInsights.ts` minimal, and keep CR at 0.
- [ ] **Step 4:** Rerun the new test, plus `tests/case-insights.test.mjs` and `tests/case-insights-session.test.mjs` → all PASS.
- [ ] **Step 5 (orchestrator):** commit "E10 (#9): insights export carries links (schema /2; /1 still verifies)".

### Task 4: the panel (protected `web/case-insights.mjs`, `web/import-ui.mjs`)

**Files:**
- Modify `swd-injection-analytics/web/case-insights.mjs`.
- Modify `swd-injection-analytics/web/import-ui.mjs`: the mount line only.
- Test: extend `swd-injection-analytics/tests/case-insights-session.test.mjs`.

**Interfaces:**
- **Consumes:**
  - Tasks 1–3.
  - `verifyExplorerPackage` (`web/explorer-package.mjs`, unchanged).
  - The `disposal-case-result` event detail `{result, contentSha256}` and `disposal-case-invalidated`.
- **Produces:**
  - `mountCaseInsights(root, {getLinks, getSource})`. `getSource(): 'user'|'demo'|'sample'|'public'|null`.
  - In `import-ui.mjs`, the mount becomes `mountCaseInsights($('case-insights'),{getLinks:linkedWellHistories,getSource:()=>source})`. That one line is the whole change; `linkedWellHistories()` stays as is.
  - `createInsightsSession({getLinks, runPerformance, onChange})` gains:
    ```js
    session.loadPackage(verified)   // packageFromVerified + addPackage; on refusal returns {error} and leaves state unchanged
    session.removePackage(artifactId)
    session.setLink(wellId, uicOrNull)
    session.packages()              // LoadedPackage[]
    session.links()                 // WellLinks
    session.compared()              // ComparedRow[] | null
    ```

**Rules:**
- **Which links feed the check:**
  - `sample`: `getLinks()` (unchanged).
  - `user` / `demo`: `historyLinksFor(...)` from the session's own set and links.
  - `public` or `null`: none.
- **Source switch:** the session remembers the source of the last result. On a new result whose `getSource()` differs, links are cleared and packages kept (Review Focus 3).
- **Withdrawing results:** any `loadPackage` (which may make results stale), `removePackage`, `setLink` or basis change withdraws the current insights, the `compared` rows and the downloads, then recomputes them from the current case result, as E05 already does on a basis change. After `removePackage`, `pruneLinks` runs first (Review Focus 2).
- **UI, inside the existing panel, in a new `section` "Wells compared" between the summary and "Reported history vs forecast":**
  - **Loader control**, for `user`/`demo` only: a file input with label "Load history packages (Explorer .tar)". It calls `verifyExplorerPackage(bytes)` and then `session.loadPackage`. It shows the refusal message in an `role="alert"` paragraph, and lists the loaded packages (UIC, window, `artifactId`, a "window from reported rows (legacy package)" note where `source==='rows'`, and a Remove button).
  - **Per case well:** a `<select>` with "No history" plus each loaded UIC. A UIC already linked to another well is disabled in the other selects. There is no pre-selection.
  - **The table:**
    - Headers: Well, Linked UIC, Coverage, Rate check, Pressure check, J source, Status.
    - The Rate and Pressure cells use the existing check `reason` and pressure `note` sentences.
    - An unlinked row shows `UNLINKED`.
    - `gapLabel` is shown under Coverage.
    - The `EVIDENCE_ONLY` note sits under the table.
  - **Row detail:** clicking a row (a `button` in the Well cell, `aria-expanded`) opens a detail region below the table, one well at a time. It shows:
    - `historyTimelineSvg(check)`;
    - the coverage months list (gap months named);
    - the packages (`artifactId`, `manifestSha256` first 12 characters, window);
    - that well's basis form, reusing the existing `basisForm`.
    - Switching rows replaces the detail; it never shows the previous well's data.
    - An unlinked well's detail shows `UNLINKED` and nothing else.
  - **Sample source:** the table shows the sample's two linked wells (from `getLinks`), with no loader control and no selects. The sample's rendered output is otherwise unchanged.

- [ ] **Step 1: Write the failing session tests** (DOM-free, like the existing session tests):
  - `loadPackage` twice with the same package → second returns `{error}`; `packages().length===1`.
  - `setLink` then `removePackage` → `links()` has no entry, and `compared()` recomputes with that well unlinked.
  - Source switch user → demo → user across results → `links()` is empty and `packages()` is kept.
  - `getSource()==='sample'` → the links come from `getLinks`, and `compared()` rows match the sample wells.
  - The insights generation changes on every link change, so an export started before a link change is refused, matching the existing export-after-invalidation test pattern.
- [ ] **Step 2:** Run `node --test tests/case-insights-session.test.mjs` → FAIL.
- [ ] **Step 3:** Implement the session additions, then the DOM render.
  - Keep re-render behaviour: open details, focus and typed text survive re-render, as in the E05 fix round.
  - Keep `import-ui.mjs` at exactly 4 CR bytes.
- [ ] **Step 4:** Rerun the session tests → PASS. Then run the full app suite: `node --test tests/*.test.mjs` → 0 failures. Then `node scripts/check-carried-oracles.mjs` → 248 comparisons, 0 failures.
- [ ] **Step 5 (orchestrator):** commit "E10 (#9): Wells compared panel, package loader control, links".

### Task 5 (orchestrator + qa agent): verification, evidence, layer

- [ ] **Browser check** (skill `browser-check`, agent `qa`), at 1280×900 and 390×844. Each scenario must PASS:
  1. A `user` case built from fictional injector and history CSVs, with two fictional packages generated in the test helpers for UIC `000000417` and `000000418` and served from the scratchpad, never committed.
     - Load both, link them to wells A and B; both rows show a verdict.
  2. Expand row A, then row B (unlinked) → the detail shows B's `UNLINKED` only.
  3. Remove package `000000418` → B's link is gone, and results and downloads are withdrawn and then recomputed.
  4. Load the same package twice → refusal alert, and the list is unchanged.
  5. Switch to demo → links are cleared and packages are kept.
  6. Sample case → its table matches its two wells, and its summary lines are unchanged.
  7. JSON and CSV downloads → the JSON verifies in Node.
  8. No console errors.
  9. Mobile: no horizontal page scroll.
- [ ] **Write `demo/E10-HISTORY-LINKING-VERIFICATION.md`** in the E05 format: what changed, commands, acceptance table against the E10 spec, browser evidence, reviews, deferred minors, not covered.
- [ ] **Run the full gate:** `node scripts/check-all.mjs`. Before the owner accepts, it shows 6/8, with only the pending-layer checks failing, as by design. Check the CR byte counts.
- [ ] **Record the layer pending:** `node scripts/record-layer.mjs phase-3c-history-linking`. Commit.
- [ ] **The owner accepts** with `! node scripts/record-layer.mjs phase-3c-history-linking accept "<owner>"`. Then run `node scripts/verify-preservation.mjs` → 0 violations, and check-all → 8/8. Commit.
- [ ] **Push and PR only on the owner's instruction:** "Closes #9", "Refs #8". After the merge, a Lovable publish is required, because the app changes.
