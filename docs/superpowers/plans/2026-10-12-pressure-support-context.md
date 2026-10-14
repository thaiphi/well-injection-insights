# Pressure-Support Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The owner's existing Claude backup workflow governs model selection, bounded ownership and independent review; no implementation begins until this plan is reviewed.

**Goal:** Add an explicitly synthetic producer/injector context view with oil/water rates, water cut, monthly injection overlays and frac-date annotations, preserving every existing engineering workflow and evidence artifact.

**Architecture:** A separate versioned context dataset, pure validation/calculation module and isolated browser controller supply one secondary Production & demand tab. It neither extends the current customer-import schema nor supplies inputs to existing forecasts/capacity. Public/customer mode shows precise missing-input reasons until a separately supported matching-source contract exists.

**Tech Stack:** Existing Node 24+, TypeScript 5.9.3, native browser modules/DOM/SVG, Web Crypto and Node test runner. No new dependency, external acquisition, backend, cloud persistence or PDF.

**Spec:** [Owner-approved design](../../../demo/PRESSURE-SUPPORT-DESIGN.md), approved October 12, 2026. Owning root: `C:/Users/thai.phi/Downloads/python/portfolio/swd-injection-analytics/tmp/lovable-transfer/well-injection-insights`, `main`, starting HEAD `c7a1cae76bc11013fdcb0951bfc942d5ed7a80b6`. The application is nested under `swd-injection-analytics/`.

## Global Constraints

- “The first slice uses a fully synthetic matched example” and “No actual public UIC is assigned to a fictional producer.”
- “This is an investigation view, not a numerical determination of pressure support, causation or interwell connectivity.”
- “Injection bbl/month uses its own explicitly labeled scale; producer rates remain stock-tank bbl/day.”
- “Water cut is water/(oil+water), shown as a percentage; gas is excluded, zero total liquid gives unavailable water cut, and a missing numerator/denominator stays unavailable.”
- “Frac markers are annotations”: no fitting changes, erased training points, cutoff edits, frozen-forecast updates or calibrated treatment response.
- “A multi-injector total is available only for compatible periods with complete selected contributions.”
- Preserve the original import schema, calculations, public pin, references, tests, datasets, licenses and source evidence. No silent source composition, synthetic substitution, GIS inference or SWD-11 completion claim.
- No commits, pushes, deployment, permissions, billing changes, installations, Supabase migration or Phi/TRRC edits. Existing uncommitted demo files remain intact. Do not edit generated `public/` or original fixture/PDF outputs.
- Commands use `C:/Program Files/nodejs/node.exe` and installed compiler directly. No npm/npx shims, bare Python or Vitest. Fixture-writing regression tests run in an isolated snapshot.
- Execute under the approved backup workflow with at most two active assignments. Opus 5.5/high owns implementation; Fable 5.1/high reviews read-only. Main owns integration, preservation baselines and final verification. No worker helpers or Git operations.
- Start a new one-hour implementation checkpoint only after approval/resumption of execution; record the actual start/deadline. No switch/review renews a running checkpoint. Stop sooner when finished or blocked.

## Review Focus

1. A missing injector period must not become zero or disappear from a multi-injector total; Task 2 pins this.
2. Water-cut denominator zero, missing water and finite-value overflow must never produce a plausible percentage; Task 2 pins this.
3. A slow fixture load completing after source/selection changes must not revive stale results or downloads; Tasks 3–4 pin this.
4. Duplicate identities, conflicting month records, malformed dates and event text containing markup must remain errors/text; Tasks 2–3 pin this.
5. Dataset/selection hashes and source rows in downloads must match the visible chart, including excluded/out-of-range events; Tasks 4–5 pin this.

## File structure and ownership

All proposed new paths below are deliverables, not claims that they already exist. Existing integration points were read from the current source before planning.

| Owner | Files | Responsibility |
|---|---|---|
| Main | New `migration/pressure-support-baseline.json`, `migration/baselines/pressure-support-before/*`, `scripts/verify-preservation.mjs`; modify root `tests/transfer.test.mjs`, `.gitattributes`; new `tests/preservation-baseline.test.mjs` | Reviewed evolution of strict transfer preservation, with original manifest untouched. |
| Opus implementer | New nested `src/pressureSupport.ts`, `src/pressureSupportChart.ts`, `src/pressureSupportExport.ts` | Context schema, validation, monthly calculations and export evidence. |
| Opus implementer | New nested `data/pressure-support/example.json`, `data/pressure-support/pin.json`, `scripts/create-pressure-support-example.mjs` | One deterministic, fictional, independent dataset and exact hash pin. |
| Opus implementer | New nested `web/pressure-support.mjs`, `web/pressure-support-chart.mjs`, `web/pressure-support.css` | Isolated state/controller, charts, accessible controls and responsive styling. |
| Opus implementer | Modify nested `web/navigation.mjs`, `web/index.html`, `web/import-ui.mjs`, `web/workspace-views.mjs` only | One tab/section/controller hookup and existing Reports integration. No unrelated refactor. |
| Opus implementer | New nested `tests/pressure-support.test.mjs`, `tests/pressure-support-state.test.mjs`, `tests/pressure-support-export.test.mjs` | Numerical, async invalidation, navigation/isolation and export tests. Original tests unchanged. |
| Main | Update existing root `DEMO.md`, `DEMO-VERIFICATION.md`; new `demo/PRESSURE-SUPPORT-VERIFICATION.md` | Actual screenshots/download evidence and final acceptance ledger. |
| Fable reviewer | Read only above paths plus governing documents and original protected evidence | Contract review, preservation and final evidence review; no shared write ownership. |

Do not modify old `src/importProfile.ts`, `src/importValidation.ts`, `src/planning.ts`, `src/disposalCase.ts`, `src/publicArtifact.ts`, reference/vendor code, pinned Explorer data or `migration/source-manifest.json`. Root `scripts/prepare-swd.mjs` already copies nested data/web/dist recursively; no assembly change is planned.

### Task 1: Establish reviewed preservation for intentional UI changes

**Files:** Main-owned preservation files above; read the original transfer manifest, root AGENTS and transfer tests. No product feature edit in this task.

**Interfaces:** `verifyPreservation(root: string): Promise<{checked:number;violations:string[]}>`, exported from the new root script. The new baseline records the immutable parent-manifest SHA, reviewed design/plan SHA, original paths/before hashes/archives and final after hashes; it explicitly lists all new product files and hashes. Only the four listed original UI files may differ from the original manifest. Archives contain their exact pre-edit bytes, relative to `migration/baselines/pressure-support-before/swd-injection-analytics/`.

- [ ] Capture current status and all 182 original hashes; fail if any unexpected starting delta appears. Capture the four original UI files before any writer edits them. Preserve original manifest bytes/hash.
- [ ] Write failing root tests proving an unlisted change, protected-reference change, missing original archive, incorrect before/after hash, unexpected baseline entry and extra new product path reject. A valid approved four-file delta must pass without skipping any original entry. Positive/negative checker tests construct throwaway fixture trees under their own temporary directory; they do not edit the live repository or require its future after hashes.
- [ ] Test name `approved delta preserves all originals`: assert.equal(valid.violations.length,0). Test name `unapproved reference change rejects`: assert.ok(tampered.violations.some(v=>v.includes("reference/"))). Use the throwaway fixtures from the preceding step, not the live tree.
- [ ] Implement the checker: each untouched original matches its original hash; each changed allowed UI path matches its reviewed after hash AND its original archive matches the original hash. Reject path traversal, duplicate paths and edits outside the exact allowlist. New product files match the explicit reviewed inventory; enumerate new product files only within the nested app's `src/`, `data/`, `web/`, `tests/`, `scripts/`; explicitly exclude `tmp/`, `dist/`, `output/`, `node_modules/` and reject new product paths outside those five trees. Root-owned preservation/doc deliverables have their separate exact allowlist; do not scan snapshot source copies as product additions.
- [ ] Retain the original transfer test's complete 182-entry coverage, now using this explicit baseline checker rather than weakening assertions. Add `migration/baselines/** -text` so archived original bytes survive clones. Keep static assembly byte comparisons and backend/handoff tests intact.
- [ ] Before code edits, review the baseline format/allowlist independently. Populate final after hashes only after final source review; do not label the baseline accepted while after hashes are provisional. During implementation, the live-tree transfer check is expected FAILED/pending after Task 3 until reviewed Task 5 after hashes are recorded; report that failure explicitly rather than hiding or bypassing it.
- [ ] Run `node --test tests/preservation-baseline.test.mjs`; expected positive/negative preservation cases PASS. Final transfer gates run after source assembly and reviewed after hashes in Task 5. No commit step.

### Task 2: Build the independent synthetic context and calculation contract

**Files:** New nested context model, example generator/pin/JSON and numerical test file.

**Interfaces:**

- `ContextDataset`: version `pressure-support-input/1`, dataset ID/name, classification, declared coverage, source declarations, producer/injector records, associations and events. Every raw row carries `rowId` and `sourceId`; retain original values. Producer monthly rows contain `producerId`, `month`, `oilVolumeBbl:number|null`, `waterVolumeBbl:number|null`, units/basis. Injector rows contain `injectorId`, `month`, `volumeBbl:number|null`, units/basis. IDs are separate namespaces.
- Association rows contain `producerId`, `injectorId`, `distance`, `distanceUnit:'mi'`, origin/classification and source row; no coordinates or computed proximity. Event rows contain `eventId`, `producerId`, `date`, `kind:'frac'`, source row/citation, classification and optional uncertainty text.
- `validatePressureContext(raw:unknown): ContextValidation`, where the result retains input/row issues and per-producer/per-injector readiness. Malformed root/version or unsupported units/bases block the dataset; duplicate/conflicting or invalid rows block affected selections rather than silently disappearing. Null measurements are permitted missing observations.
- `buildPressureContext(validated:ContextValidation, selection:ContextSelection): ContextResult`. Selection is producer ID, sorted distinct declared associated injector IDs, first/last month. `ContextResult` declares `ready:boolean`, `reasons:string[]`, `monthly:ContextMonth[]`, events, source rows and identity/method/selection metadata. Selection months must be ordered and within declared coverage; reject unknown or unassociated injector IDs rather than dropping them. `ContextMonth` uses exact fields `month`, `oilRateStbd`, `waterRateStbd`, `liquidRateStbd`, `waterCutPct`, `injectorVolumesBbl` (by injector ID), `completeInjectionVolumeBbl`, `missingReasons`; measurement fields are number|null. Invalid selected inputs return ready:false, precise reasons and monthly:[], not a throw or a partial numeric total. Valid missing observations yield ready:true with null fields/reasons in affected months. Events include all selected-producer events (inside/outside coverage).
- `ContextResult` method version `pressure-support-context/1`, source:{datasetId:string,sha256:string}, selection and assumptions; no existing planning/engineering type is changed. Dataset hash comes from verified original fixture bytes, not regenerated normalized values.

- [ ] Write failing tests for Feb 2024: oil 29,000 STB and water 7,250 STB produce 1,000/250/1,250 STB/day and 20% water cut. Selected injectors 87,000 + 58,000 bbl give 145,000 bbl/month. Jan 31-day and Feb 2025 28-day conversions are checked independently.
- [ ] Test name `February 2024 rates and water cut`: assert.deepEqual([feb.oilRateStbd,feb.waterRateStbd,feb.liquidRateStbd,feb.waterCutPct,feb.completeInjectionVolumeBbl],[1000,250,1250,20,145000]); feb is the matching monthly result for the explicit anchor above.
- [ ] Pin zero total liquid → both rates 0, water cut null; null water → water/total rate and water cut null while valid oil rate remains inspectable. A missing selected injector period → total null with the precise injector/month reason. Empty selection → “Select an associated injector,” never zero aggregate.
- [ ] Pin bad/duplicate month rows, duplicate IDs/events, impossible dates, negative/nonfinite values, arithmetic overflow and incompatible units/bases. Explicitly assert that a blocked selection returns ready:false, nonempty reasons and monthly:[], while valid missing values retain usable independent series. One invalid producer does not hide independent valid producer history; no invalid selected contribution appears in a total.
- [ ] Implement validation and pure calculations. Reuse `daysInMonth` and `monthIndex` by importing them from the protected existing `src/planning.ts`; do not edit it or duplicate its calendar implementation. Calendar arithmetic uses UTC month/year values, not local timestamps or onstream-day inference. Date validation uses actual calendar days. No regression/refit/interference calculation is added.
- [ ] Generate a deterministic two-producer/two-injector, 2024-01–2025-12 example, fixture version 1 and seed 20261012. Use identities `PS-DEMO-P01/P02` and `PS-DEMO-I01/I02`, never real APIs/UICs or current planning producer IDs. Include the exact Feb anchor above; P01 Jun 2024 missing water, P02 Sep 2024 zero oil/water, I02 Aug 2024 missing injection. Distances are assumed 1.5/3 mi; events include P01 2024-04-15, P02 2025-03-09 and out-of-range P01 2026-01-10. P01 associates with I01 at 1.5 mi and I02 at 3 mi; P02 associates with I01 at 3 mi and I02 at 1.5 mi. All observations/events are labeled synthetic; association distances are explicitly assumed. Other histories are deterministic illustrative sequences, not response predictions or copied chart shapes.
- [ ] Generate only these NEW fixture/pin files; never regenerate seed417/public/reference fixtures. Pin exact bytes, version, coverage, classifications, counts and units. Validate the prepared example, then run the focused numerical tests in an isolated snapshot; expected PASS.

### Task 3: Integrate an isolated accessible context workspace

**Files:** New browser controller/chart/CSS, pure SVG module `src/pressureSupportChart.ts` and state test; the four listed existing UI files. Do not modify old calculation modules or global styling.

**Interfaces:**

- `createPressureContextState()` returns `{beginLoad():{revision:number;signal:AbortSignal}, acceptLoad(revision,input):boolean, changeSelection(selection):void, invalidate(reason):void, calculate():ContextResult|null, snapshot():ContextSnapshot}`. A snapshot declares current selection/revision/result and blocked reasons. `calculate()` returns null only when no input/selection is accepted; invalid accepted selections return Task 2's ready:false result. Only current revision can accept async work. Selection/input edits clear dependent result/export immediately.
- `mountPressureContext(root:HTMLElement): PressureContextController` with `{open():void, invalidate(reason):void, exportSnapshot():ContextResult|null}`. It loads only the pinned local example after an explicit click; fixture bytes ≤1 MiB, enforced on fetched arrayBuffer.byteLength before hashing, then matching exact SHA/version. Decode using fatal UTF-8 after byte verification. Abort duplicate/old loads; errors remain visible with retry. No default auto-load or arbitrary URL. On accepted example load, initialize the first producer and all its explicitly associated injectors over full declared coverage, but require Calculate before results/export. A new load invalidates the prior accepted context; Cancel aborts and clears pending input/result, requiring explicit reload.
- `pressureContextChartSvg(result:ContextResult):string` in the new pure TypeScript chart module returns self-contained, escaped SVG with no script, external references or active links. `renderPressureContextChart(result:ContextResult):SVGSVGElement` in the browser wrapper parses only this generated SVG with DOMParser and imports its root, rejecting parser errors; no untrusted markup is assigned to innerHTML. Both live and exported charts use that same pure SVG generator: aligned date axes, producer-rate left axis and injection-monthly-volume right axis, separate 0–100% water-cut panel, dated event markers with text descriptions. Null series break lines; markers use continuous UTC dates within the month, not misleading month-start snapping. Out-of-range events remain listed.
- Workspace ID `pressureSupport`, route `#production/pressureSupport`, label `Pressure-support context`; existing six primary areas and all existing routes remain unchanged. Mount in new section `#pressure-support-workspace`; hide it in the existing navigation reset and call `open()` only for this workspace. Keep the existing navigate focus/history behavior.

- [ ] Write failing tests for the route roundtrip, retained six areas/all existing workspace IDs, load A completing after load B, selection edits disabling results/downloads synchronously, source changes/cancellation while loading and retry after corrupt/hash-mismatched fixture. Use controlled promises, not timing sleeps.
- [ ] Test name `context route roundtrips`: assert.equal(viewFromHash(routeFor("pressureSupport")),"pressureSupport"). Test name `old load cannot revive state`: assert.equal(state.acceptLoad(oldRevision,validatedInput),false); assert.equal(state.snapshot().result,null) after a newer load/selection invalidates it.
- [ ] Add tab/section and scoped CSS link; hook the new controller in `import-ui.mjs`. Reuse the established heading focus behavior; add `pressure-support` to the hide-all list at import-ui.mjs:99. Put the pressureSupport early-return branch beside existing branches at :109–115, BEFORE :121 assigns analysis-select or calls readiness (pressureSupport is not in its names map). Add pressureSupport to both separate-tool dataset-label lists at :98 and :116; retain the current planning identity. Do not modify `switchSource()` or `state.inputs` to adopt the context fixture. Use `workspace-source` only to invalidate pending context work and show the new active-planning identity; avoid global/source/forecast event emission from this tool.
- [ ] Render explicit context dataset name/hash, source classification and “separate from the active planning dataset.” A renderable partial history must explicitly disclose missing observations/unavailable aggregate months; context readiness is not engineering/product acceptance. Provide producer selector, associated injector checkboxes, coverage inputs, Calculate, Cancel load (enabled only while pending), source rows, assumptions/events and a real-data availability panel. Real mode is not an enabled fake button: list missing producer oil/water series, association evidence, dated frac inputs and composition contract; preserve access to public injector history.
- [ ] Implement aligned charts with clear independent axes/legends. Chart caption/table exposes numeric values; no smoothed illustrative trend, interpolated missing data or inferred effect. Treat event labels/citations as text (`textContent`), never HTML.
- [ ] Use labeled native controls, visible focus, keyboard-operable checkboxes/links, headings/status regions and scroll regions with descriptive labels. Stack panels at 390px; necessary wide table/chart scrolling stays inside its region. Chart width adapts; do not reproduce the old global primary-navigation clipping as a new context layout requirement. Broader sidebar repair remains separately tracked.
- [ ] Confirm context changes leave serialized confirmed import profiles, state.result, frozen forecast identity, original scenario controls and existing calculation hashes unchanged. Existing navigate() clears the displayed Selected data analysis exhibit/download buttons when entering any non-report tool; preserve that existing presentation behavior rather than promising unchanged displayed downloads. Returning to its analysis rerenders the same accepted inputs/results. Test empty/blocked public and water-only user states without synthetic fallback.
- [ ] Run state/numerical/navigation focused tests in the snapshot and syntax checks on new browser modules; expected PASS. No fixture/pre-existing test rewrites.

### Task 4: Export current context evidence and integrate Reports

**Files:** New nested export module and tests; existing `web/workspace-views.mjs` report-card addition; controller/chart snapshot integration.

**Interfaces:**

- `sealPressureContext(result:ContextResult, evidence:{originalBytes:Uint8Array;sha256:string;pin:ContextPin}):Promise<ContextArtifact>` recomputes SHA-256 over originalBytes, rejects disagreement with pin.sha256, evidence.sha256 or result.source.sha256, then derives originalText using new TextDecoder("utf-8",{fatal:true}).decode(originalBytes). It rejects result.ready:false before preparing any result artifact. It also computes resultSha256 over UTF-8 bytes of JSON.stringify(result), compact and without a trailing newline; hash only the frozen result body, never its artifact wrapper or pretty download formatting. ContextArtifact exposes {result, resultSha256, evidence}; browser and Node verification use the same serialization. Artifact includes schema/method versions, dataset/selection identity, byte-exact source encoded as base64 plus decoded original UTF-8 fixture text/hash, complete validated source input, row dispositions, assumptions, units, missing reasons, associations, all selected-producer events and coverage.
- `pressureContextCsv(artifact:ContextArtifact):string` returns metadata plus typed monthly/source/event rows, including unavailable reasons, not empty cells mistaken for zero; spreadsheet-like text is exported safely using the existing CSV conventions.
- `pressureContextSvg(artifact:ContextArtifact):string` calls Task 3's `pressureContextChartSvg(artifact.result)` and adds escaped full-artifact metadata, retaining identical plotted values/scales and visible units/identity/limitations. XML text/metadata is escaped; JSON/SVG unsafe literals cannot create active content. No executable script, external image or link is embedded.
- Controller exports from an immutable result/selection revision. During hashing, an edit invalidates pending downloads; after completion, recheck revision before displaying an artifact or triggering Blob download. Current-result CSV/JSON/SVG share exactly one artifact ID/hash. Download control IDs are `pressure-support-json`, `pressure-support-csv`, `pressure-support-svg`; REPORTS adds prefix:'pressure-support', view:'pressureSupport', formats:['json','csv','svg']. Reports uses these controls' disabled state and routes back to pressureSupport; no active-case export is replaced.

- [ ] Write failing tests for JSON hash identity, retained exact source bytes, CSV units/null reasons, complete per-row lineage, in/out-of-range events, XML/CSV hostile text and stale hashing interrupted by a selection/source edit.
- [ ] Test name `blocked result cannot be sealed`: await assert.rejects(sealPressureContext(blocked,evidence),/blocked/i). Test name `export embeds current snapshot`: assert.deepEqual(extractedSvgMetadata,artifact); assert.equal(hashUtf8(JSON.stringify(artifact.result)),artifact.resultSha256). Test helpers independently decode the actual metadata/hash using native Node primitives.
- [ ] Implement the three formats and local downloads. A disabled/stale snapshot cannot export even if a handler is invoked programmatically. Export limits follow fixture bound; do not silently truncate rows/events or introduce an asynchronous PDF job.
- [ ] Add a distinct Reports card “Pressure-support context” using only current context controls. Explain “Synthetic context, separate from capacity; not a pressure-support determination.” Existing report cards/formats/disabled semantics remain intact.
- [ ] Run export/state tests, independently recompute the result hash and extract/parse escaped `<metadata>` from produced SVG in Node following the existing regex/unescape precedent in tests/exhibit-svg.test.mjs; do not require DOMParser or a new Node dependency. Verify CSV monthly values against independent arithmetic, not just its own serializer. Expected PASS.

### Task 5: Final regression, browser evidence and independent acceptance

**Files:** New verification record, existing new demo documentation, final Main-reviewed baseline. Read all changed/new files; do not modify source references/old tests/output fixtures to force a pass.

- [ ] Snapshot original fixture/reference/public evidence and current working files before execution. Build/test in `tmp/pressure-support-check-<unique>/`, preserving directory layout and using the installed compiler. Execute every existing nested `tests/*.test.mjs` plus the three new files through `node --test` with explicit enumerated file arguments; save exact commands/outputs and isolate generated artifacts. Run `node scripts/check-carried-oracles.mjs` in that snapshot. Compare protected originals afterward.
- [ ] Run both type gates from root: `node node_modules/typescript/bin/tsc --noEmit` and `node node_modules/typescript/bin/tsc -p swd-injection-analytics/tsconfig.json --noEmit`. Use direct Node `--check` for changed/new browser/script modules. Run installed ESLint only if present/applicable, otherwise report unrun; do not install it.
- [ ] Have Fable independently review the numerical/source/export/state contracts and the exact four-file UI delta. Main records reviewed final after hashes/new-file inventory while preserving original archives. Then build the actual local static assembly with direct `node scripts/prepare-swd.mjs` (its verified cleanup is confined to generated paths) and run root transfer/preservation/Portfolio-boundary tests. Check copied new data/web/dist bytes and unchanged backend/handoff behavior. Do not edit `public/` manually.
- [ ] Verify the browser capability/actual model separately. Under the owner-approved Claude DevTools alternative, use an isolated Chrome profile and only the local origin. Review source before browsing; no arbitrary JS/source acquisition/sign-in. Capture actual 1536×1024 and 390×844 CSS viewports at DPR1. Record origin, app revision/fixture hash, dimensions and steps.
- [ ] Exercise direct route, Back/Forward, refresh, repeated load/cancel/retry, all producer/injector selections, coverage changes, missing month, zero denominator, event locations/out-of-range listing, source-row access and keyboard navigation. A slow/corrupt load shows no current result; edits disable exports. Show real-data missing-input reasons without combining public and synthetic observations.
- [ ] Download actual JSON/CSV/SVG and verify displayed hash, full source bytes/lineage, independent Feb arithmetic and SVG metadata. Verify stale programmatic/normal export blocks and recovery. Keep downloaded artifacts; buttons or screenshots alone are not parity evidence.
- [ ] Re-exercise the existing 12 design workspaces and important errors with screenshots: Start/Import, History/Fit, Curve/Schedules, Injectivity/Capacity, Sweeps/PVT, Hydraulics/Reports. Keep the curve-maintenance proposed state and SWD-11 blocker visible. Existing confirmed customer inputs/frozen results survive context inspection; no broader app acceptance follows from this slice.
- [ ] Fable final read-only review compares the changed-file list, plan/design, actual tests/screenshots/downloads and protected hashes. If a required gate fails, report FAILED and repair/re-review only its owned paths; if blocked/unrun, keep acceptance open. No commit/push/deployment.
- [ ] Write `demo/PRESSURE-SUPPORT-VERIFICATION.md` with passed/failed/blocked/unrun checks separately, exact changed paths, roles/models, screenshots and real-data limits. Update DEMO.md to add this independently usable tool only when actual acceptance passes. Close worker assignments and report at the checkpoint without extending it.

## Coverage and execution handoff

| Design requirement | Tasks | Acceptance evidence |
|---|---|---|
| Synthetic matched view and no real-UIC assignment | 2–3 | Distinct IDs/classification, explicit load, preserved public pin |
| Oil/water rates, water cut, injection overlay | 2–3 | Independent calendar/20% anchor, distinct axes, null cases |
| Declared “nearby” associations | 2–3 | Source/distance table, no GIS/connection inference |
| Frac markers and outside-coverage events | 2–4 | Exact dates, UTC alignment, source rows/export; original fits unchanged |
| Real data availability without composition claims | 3, 5 | Specific missing inputs and usable standalone public history |
| Identity/hash, state invalidation and all exports | 1, 3–5 | Original byte preservation, revision guard and actual download parity |
| Accessible responsive direct tools | 3, 5 | Keyboard, exact viewport screenshots, all old workspaces retained |
| Independent review and remaining scope ledger | 1, 5 | Contract/final review, no SWD-11/full product/deployment claim |

Independent contract review: Fable 5.1/high inspected the original plan, requested five mandatory and five precision corrections, and then verified 10/10 closed with READY FOR OWNER PLAN REVIEW. Main subsequently named the compact result-hash serialization recommended in that review and added explicit test-name/assertion examples without changing feature scope. Actual product gates remain unrun.

Self-review: every design section maps above; function/type names match across interfaces; the five Review Focus cases have explicit owning tests. New real-source acquisition/customer composition and SWD-11 are deliberately not implementation tasks. Original dataset/test/reference bytes remain protected; intentional UI edits require a reviewed delta baseline, not a replaced original manifest.

**Execution method:** Preserve the owner's selected backup workflow: one Opus implementer, bounded Fable contract/final reviews, owner-authorized Claude DevTools browser verification and Main integration. No fresh worker per trivial step, no parallel writes or global trust/settings changes. This plan requires owner review before that execution starts. Each dispatch/resumption carries Project, Task class, Brief, Scope, Validation, Report and Return with exact root/ownership/checkpoint.

Owner review of this plan also covers its necessary root preservation files/gate changes, calendar-month-volume-only first slice (unsupported onstream rates remain blocked), context-local readiness rather than altering the general analysis-readiness cards, and full original-fixture evidence embedded in JSON/SVG within the source size bound. Real customer/TRRC composition remains excluded.




