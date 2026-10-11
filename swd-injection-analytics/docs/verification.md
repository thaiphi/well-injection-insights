# Verification record — October 9, 2026

## Delivered local slice

The Analytics workbook runs at http://127.0.0.1:4173 using the standalone preview script. It demonstrates synthetic forecast/reconciliation, two fictional injector pressure/rate curves, schedule/availability/expansion capacity planning, pinned public monthly injection and technical PDF/CSV/JSON/SVG exports. **Download PDF** directly generates the current case in the browser with the exact JSON attached. An optional offline script remains available. The separate Explorer workspace produces the copied file artifact; neither app requires the other server at runtime.

The calculation source was extracted from the owner's **local Nexus main**, commit `de631ad2952bf42b80a6738ff980992975be4cdc`. Sixteen engineering/reference files have source/destination hashes; every destination hash was rechecked successfully. PVT/table calculation bodies are unchanged. Import aliases and two type selections are documented in reference/nexus-source-manifest.json.

## Actual gates

| Check | Result |
|---|---|
| `node node_modules/typescript/bin/tsc -p tsconfig.json` | PASS; compiled standalone ES modules |
| `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` | PASS |
| `node --test tests/*.test.mjs` | PASS, 26 tests after direct PDF integration and wrapping refinements |
| `node --check web/app.mjs` | PASS |
| `node scripts/import-explorer.mjs` | PASS, 11 source/export checksums, CSV/JSON parity and UIC joins |
| `node scripts/export-exhibit.mjs` | PASS, 12 planning months and 28 public rows; verifies current files and stored pin before export |
| Extracted/reference destination SHA256 check | PASS, all 16 files |
| Chrome desktop and 390×844 mobile inspection | PASS, usable controls/charts, no horizontal document overflow on mobile |
| Chrome schedule + availability/expansion controls | PASS, July start shifts demand; zero availability and zero expansion give 12 zero-capacity months; frozen forecast unchanged |
| Chrome half-injectivity control | PASS, Injector A available capacity changes from 6,750 to 3,375 STB/day at 90% availability |
| Chrome public load | PASS, 28 rows with original UIC/API and 432,198 reported liquid barrels |
| Chrome missing pin and changed-byte cases | PASS, explicit unavailable state; public table hidden; synthetic case remains usable; restored artifact loads all 28 rows |
| Browser JSON download inspected with Node | PASS, July/zero-capacity controls, 28 public rows and independently recomputed SHA256 match |
| Browser CSV download inspected with Node | PASS, 12 zero-capacity months, public API/parent identity, dictionary/quality evidence and daily-rate units |
| Browser SVG download inspected with Node | PASS, actual saved file matches July/zero-availability/zero-expansion controls; exact SHA256, 28 public rows, chart-series values and independent constant-J pressure calculation |
| Standalone SVG visual inspection | PASS, labeled charts, monthly output table, sources and assumptions visible without overlap |
| Independent runtime | PASS, Explorer stopped and port 4176 confirmed `ECONNREFUSED`; fresh Analytics reload loads 28 pinned rows and enables exports; Explorer restored |
| `node scripts/check-carried-oracles.mjs` | PASS, 248 applicable comparisons over all 28 recorded pressures in four cases; original exclusions preserved |
| `node scripts/check-pdf-export.mjs <explicit bundled Python executable>` | PASS, default, partial-missing, all-missing, no-public and invalid-SHA cases |
| PDF visual/content inspection | PASS, four landscape pages rendered and inspected; all 28 public source report IDs and exact original JSON attachment verified |
| Browser-case PDF | PASS, downloaded July/zero-capacity exhibit renders in four pages with the original JSON attachment and correct unmet-volume anchor; two repeated renders byte-identical |
| Current preview browser console | PASS, no captured errors or warnings |

Negative browser cases use `node scripts/qa-fixture-server.mjs` on temporary ports 4180/4181 without modifying pinned data. These QA servers were stopped after inspection. The primary Analytics preview remains running for review.

Browser event capture timed out for a Blob download, but the actual saved JSON/CSV/SVG files were independently checked. Clicking native print opened a modal that blocked browser instrumentation; that tab was closed and a fresh default workbook restored. **Native browser print pagination remains unchecked.** The separately generated technical PDF passed four-page/content/attachment checks and visual inspection; this does not establish native browser print behavior. No physical printing was performed.

The optional report runs with `C:\Users\thai.phi\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`, which contains ReportLab and pypdf. No bare Python/py launcher or runtime application dependency was introduced. The initial report layout FAILED its four-page gate by producing five pages; compact public-table rows corrected it. Poppler emitted missing-font warnings while rasterizing, but all four resulting page images were inspected and legible. Corrupt exhibit SHA256 is rejected before output writing; missing liquid volumes remain explicitly missing, including partial and all-missing cases.

A first strict Chrome-versus-Node forecast array comparison FAILED by at most `2.9103830456733704e-11` bbl. Numerical parity then passed with an explicit absolute `1e-9` bbl tolerance. Within the browser, scenario edits preserve the frozen forecast exactly. Each exported artifact verifies its own exact serialized hash; cross-engine floating-point calculations are not claimed to produce identical bytes. Rendering the same serialized exhibit twice produces identical PDF bytes.

## Numerical and source evidence

- Constant-J: 2,000 psia reservoir, J=5 STB/day/psi, 5,000 STB/day gives 3,000 psia. Half J gives 4,000 psia. A 3,500 psia limit gives 7,500 / 3,750 STB/day pressure-limited capacities, before operating ceiling and availability.
- Carried Nexus references cover eight water-FVF pressure points, spreadsheet bubble point, explicit bubble-point grid, Pb/Rsb reconciliation and water viscosity independence from oil/gas tuning. The additional literal-fixture audit covers four recorded April 16, 2026 black-oil cases (API 15/25/35/45) and every one of their 28 pressures, yielding 248 applicable comparisons. It evaluates each exact oracle pressure as the first point of a two-row table. Rs below 100 psia, effectively skipped original oil-compressibility tolerance, ideal/real gas-compressibility difference and absent water-compressibility oracles remain explicit exclusions. No fresh MCP response is claimed. Details: `exhibits/carried-oracle-coverage.json`.
- Forecast tests exclude future actuals from training, preserve frozen coefficients under future changes, use real calendar days including leap years and reconcile actual minus forecast.
- Public source anchors: UIC `000020838`, source API `38910201`; January 2024 = 17,173 bbl and separately 900 psi average/maximum. February = 17,927 bbl / 29 calendar days = 618.1724137931035 calculated bbl/day. All 28 raw rows were separately reconciled during review.

Pinned artifact: `rrc-2026-10-09-uic000020838-v1`. Final manifest SHA256: `3a523cadca4c7a35d667ccd53629d63e5afc6de382be670cba1d61743baef61f`. Final normalized SHA256: `4f243138c833f09a5be6a970e85f76f3f73e95040c69677a10b8c3b2fe03ca5b`. Explorer added official source titles and a noncircular typed-payload hash during finalization; Analytics reimported the final files and reran all 14 tests and the technical export successfully. Source values/CSVs did not change.

Final default technical JSON content SHA256: `40eecb1020b29b66513d2c395529905d5c7edc5a1311802b1cb4d27db4421bec`.

## Review and limits

Astra's first read-only review found three P2 gaps: accepted-history dispositions, runtime pin verification and CSV public lineage/units. All three were fixed and independently reviewed. The continuation review found selected-route containment and PDF missing-volume presentation gaps; both were fixed. Root's final executable gates cover the corrected paths; Astra's final review reported no remaining P1/P2 findings. Both previews now confine decoded paths to their selected file roots; HTTP tests include encoded slash/backslash escapes.

Luna used local Graphify for the original 36-file Nexus wellbore slice (489 nodes/1,199 edges). The refreshed bounded Analytics flow map contains 335 nodes/645 edges from 33 allowlisted files, including the browser PDF serializer and its tests; Explorer contains 49 nodes/69 edges from 10 allowlisted files. All 33/33 Analytics and 10/10 Explorer current source/staged/manifest hashes match. Five Analytics supporting files are separately hash-accounted outside the AST corpus: the vendored PDF library, license, provenance, updated HTML and delayed-import QA fixture. Their source/staged/manifest hashes also match. Queries located artifact verification, browser pin loading, frozen planning, SVG rendering and PDF verification/rendering paths. Compiled dist imports remain unresolved, so graph topology does not prove TS-to-JS correspondence; compilation and executable checks provide that evidence. Top-level browser-handler edges are incomplete, HTML/CSS are hash-accounted but skipped by code extraction, and server test files yield no symbols. Metadata has no directed flag, so call-direction claims use source reads. Graphs remain local under .graphify-local, with no ancestor Git revision attributed to the new app folders. The manifest records the successful refresh command and current graph hash; the build output did not record an exact timestamp.

The full upstream Vitest suites and a fresh live pyResToolbox MCP call have **not** run. Original upstream test files are retained as references, not represented as passed suites. Source libraries' existing simplifications remain documented. There is no wellbore-friction/surface-pressure injection model in this first slice; no production IPR inversion or fixed-density traversal was transplanted. No statewide coverage, field calibration, deployment or Git hosting is claimed.

Permitting, GIS, portfolio implementation and advanced models remain outside this work. Separate app directories are created; Git initialization/push was not attempted under the standing host restriction.

## Owner follow-up: direct PDF and confirmed CSV save

The owner supplied the actual saved Explorer CSV at `C:\Users\thai.phi\Downloads\injection_monthly.csv`. Its SHA256 exactly matches the pinned artifact (`1831e77daa33af7bcb49ee62d36d170c40031e2603b1e0015ae20144fe94f3a3`), closing the browser-save uncertainty in the earlier checkpoint.

The owner then requested a PDF download instead of native printing. `web/exhibit-pdf.mjs` verifies and snapshots the displayed exhibit, formats vector charts/text, attaches the exact JSON and uses fixed metadata for deterministic bytes. The browser handler lazily imports it and discards results if controls changed while it was preparing. No Python/backend/default-file dependency was introduced. The local pdf-lib 1.17.1 bundle and MIT license hashes match `web/vendor/pdf-lib-provenance.json`.

| Follow-up gate | Actual result |
|---|---|
| Full Analytics suite | PASS 26/26, including seven new PDF cases: exact decoded attachment, metadata, default/changed cases, tamper rejection, missing vs zero, no public history, Unicode preservation and continuation pages |
| TypeScript build and JS syntax | PASS; TypeScript does not type-check `.mjs`, so direct Node checks cover exporter/app syntax |
| Default native Chrome PDF download | PASS, actual file saved and read with independent pypdf; four pages, default controls, 28 public source IDs and correct 128,120 bbl unmet-volume anchor |
| Changed native Chrome PDF download | PASS, actual file saved; July start, zero availability/expansion and half injectivity retained, all monthly capacities zero, 28 public IDs, correct 2,976,313 bbl anchor |
| Exact attached exhibit hashes | PASS, Node recomputed SHA256 for default, changed and final browser-saved attachments |
| Async stale-export browser case | PASS, dev-only port 4189 delays the PDF module 1.5 seconds; editing the start month during preparation cancels the old result, no extra file appears, and the next download matches new controls |
| PDF visual review | PASS, all four pages of default and changed fixtures inspected after final word-wrapping refinement; final browser-saved deliverable also rendered and inspected |
| Review | Astra reported no actionable P1/P2 issues in PDF integration, capture/version guard, source evidence or local dependency provenance |
| Temporary QA service cleanup | PASS, port 4189 returns `ECONNREFUSED` after stopping the three-mode QA server |

Initial visual inspection identified mid-word prose wrapping; it was corrected before final delivery. Poppler again emitted Symbol/ArialUnicode font warnings; the rendered standard-font pages were legible. The normal report contains four pages; oversized content deliberately adds readable continuation pages. Unsupported display glyphs are substituted explicitly when needed, while attached JSON preserves original Unicode losslessly. Native browser print pagination is now historical coverage only: the workbook button no longer invokes `window.print()`.

## 2026-10-09 SWD-13 / SWD-14 bounded import foundation

Authorized by the owner in this thread after clarification that the task is reservoir/disposal-injection analytics. Owning Git root verified as `C:/Users/thai.phi/Downloads/python/portfolio/swd-injection-analytics`. Actual start: **19:18:35 UTC**; one-hour checkpoint: **20:18:35 UTC**. Runtime model/reasoning settings are not independently exposed; the requested `gpt-6.1-sol / medium` routing is not claimed verified.

Applied the owning AGENTS/shared delegation workflow and executing-plans/TDD/verification skills within the explicit brief. Scope ruling: this is the first bounded A0 foundation, not the whole A0/UI milestone. The approved existing root, no-Git/no-helper ownership and allowlist take precedence over generic skill worktree/commit/reviewer-script steps. This record is the task ledger; no extra skill workspace or Git mutations were performed. Independent review remains for the coordinating owner to arrange.

**Written files:** `src/importProfile.ts`, `src/importValidation.ts`, `src/analysisReadiness.ts`, `tests/import.test.mjs`, `tests/readiness.test.mjs`, `tests/fixtures/import/{generate.mjs,README.md,seed417-history.csv,invalid-history.csv,assumed-injectors.csv,parsed-sheet-contract.json,public-reported-observations.csv,provenance.json}`, and this record. The normal compiler regenerated ignored `dist/` outputs for executable checks. The existing server test writes/removes its temporary exhibit as part of its gate. No dependency/config, source calculations, public pin/data, reference fixture, sibling repository or browser application file was edited. No staging/commit/push/deploy or default persistence was performed.

### Bounded acceptance and current status

| Criterion | Evidence / result |
|---|---|
| Explicit versioned/confirmed column and unit mapping for history, schedule and constant-J inputs | Implemented typed profiles and row-level validation; no automatic header/unit inference |
| CSV parser | Implemented strict comma/quote handling, multiline physical row IDs, UTF-8 BOM handling, duplicate-header/width rejection, 10 MiB/100000-row/100-column limits; caller decodes UTF-8 |
| XLSX | **Schema/parsed-sheet boundary only. Binary parser, parser/dependency selection, actual .xlsx samples and binary-format tests are NOT IMPLEMENTED.** Multi-sheet JSON fixture proves boundary selection/equivalence and formula rejection only. All formula cells are rejected, even with caches; no formulas/macros execute |
| Identity/calendar/numeric/pressure validation | Tested ISO months/dates, IDs/groups, missing vs zero, decimal validation, leap-month volumes, hourly rates, ambiguous units, duplicates/conflicts, positive J, compatible absolute bottomhole basis/datums within each injector |
| Source lineage | Original-byte SHA256/name/reference, selected sheet/header, original physical row/values/headers, mapping/version/declared units, dispositions and calculated-field lineage retained. Normalization identity includes source hash, selected table and entire mapping, not merely a caller-reused mapping version |
| Origin/content separation | User acquisition and unverified content assertion stay independent; synthetic/public-reported/literature/assumed labels remain distinct. Calculated fields retain original-row source links. No measured/calibration claim |
| Readiness | Library gates for descriptive history, exponential fit/frozen forecast, complete independent holdout reconciliation, schedules/groups and constant-J injector selection. Invalid unrelated producers/future rows do not block valid selected training; different valid injector datums do not block capacity. Zero is valid descriptive/actual data but cannot satisfy positive log-fit training |
| Public and extended-model readiness | New generic-import readiness gate deliberately stays unavailable; bridge to existing verified Explorer consumer is still open. Existing public pin/contract tests pass. SWD-10 readiness remains unavailable |
| Browser preview/confirmation and export/calculation integration | NOT IMPLEMENTED in this slice. `confirmed` is a library precondition, not evidence that a user confirmation UI exists. Existing calculations/exporters are preserved, not newly connected to imports |
| Fixtures | 48-row seed417 history, fixed invalid rows, two assumed injector cases, parsed-sheet contract and exact public CSV copy. Regeneration is byte-identical; sources are read-only |

### Checks run

All commands run from the owning root through direct Node paths. Final passing checks:

- `node node_modules/typescript/bin/tsc -p tsconfig.json` — PASS, generated executable/declaration outputs.
- `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` — PASS.
- `node tests/fixtures/import/generate.mjs` — PASS. PowerShell captured each fixture's SHA256 before/after regeneration and verified all existing fixture bytes unchanged.
- `node --test tests/import.test.mjs tests/readiness.test.mjs` — PASS **20/20**.
- `node --test --test-reporter=spec tests/black-oil-integration.test.mjs tests/engineering.test.mjs tests/exhibit-pdf.test.mjs tests/exhibit-svg.test.mjs tests/exhibit.test.mjs tests/import.test.mjs tests/planning.test.mjs tests/public-artifact.test.mjs tests/readiness.test.mjs` — PASS **45/45**.
- `node --test tests/server.test.mjs` — PASS **1/1**, approval-backed outside the sandbox, both after the loopback denial and after final changes. Across the split final suite, **46/46** pass.
- `node --check tests/fixtures/import/generate.mjs`, `node --check tests/import.test.mjs`, `node --check tests/readiness.test.mjs` — PASS.
- Lint: **COULD NOT RUN**: no installed `node_modules/eslint/bin/eslint.js` or owning lint script. No tool installation was attempted.

Failures retained as evidence:

- Initial focused red run: **0/13**, missing import/readiness APIs. Subsequent red regressions exposed missing original headers, selected-producer/training isolation and normalization-ID collisions; each was fixed and passes. One initial test wrongly expected unchanged file-hash IDs after changed holdout bytes; corrected to require stable readiness but changed file lineage. Existing frozen-coefficient tests continue to prove no fit leakage.
- `node --test --test-reporter=spec tests/*.test.mjs` — **FAILED 40/41** in sandbox before the final added cases. Sole failure was loopback access, not a reported application assertion:

```text
TypeError: fetch failed
at tests/server.test.mjs:21:15
[cause]: Error: connect EACCES 127.0.0.1:4188
errno: -4092
code: 'EACCES'
syscall: 'connect'
address: '127.0.0.1'
port: 4188
```

The supported escalation rerun passed. The earlier read-only sandbox required individual write approvals; the owner later enabled workspace writes. One requested patch was rejected before execution; its unchanged state was checked and the same authorized fix subsequently ran under workspace-write permissions. No restriction was bypassed.

**Review request:** independent reviewer should inspect schema/mapping/origin boundaries (`src/importProfile.ts`, `src/importValidation.ts`), readiness selection and training/holdout isolation (`src/analysisReadiness.ts`), and the clearly partial XLSX/public/UI claims above. No fresh browser/UI import check, XLSX binary check, upstream Vitest, live pyResToolbox MCP call or deployed check was run. Full SWD-13/SWD-14 acceptance remains open; this bounded foundation is ready for independent review. STOP after delivery; no next goal is authorized by this record.


## 2026-10-09 active full-goal continuation and checkpoint handoff

The owner registered the full native Goal after the first bounded foundation. `get_goal` independently confirmed its exact full SWD objective and ACTIVE status; it was not narrowed to A0. The coordinating thread twice relayed the human's explicit “fresh hour” instruction, reference `Sentinel_1e5ffab921f88191a778e2e2fe31c83c`, with the shared window **20:08:50–21:08:50 UTC**. The parent reader did not independently expose that user item; the revised checkpoint was adopted as an instruction relayed by the authorized coordinator, not claimed independently retrieved. No permission change or pending tool approval was inferred from that update.

### New implementation and evidence

- **SWD-13, partial acceptance advanced:** Added the real binary XLSX adapter `web/import-file.mjs`, locally vendored official SheetJS CE **0.20.3**, Apache-2.0 license and module/license SHA256 provenance in `web/vendor/xlsx-provenance.json`. Official installation source: https://docs.sheetjs.com/docs/getting-started/installation/standalone/ . Original module and license URLs are retained. UTF-8 CSV and XLSX bytes are hashed together with the parsed source; user acquisition never becomes measured/public verification. XLSX formulas (cached or uncached), VBA-bearing workbooks, encrypted ZIP entries and ZIP64 are rejected. Limits: 10 MiB input, 50 sheets, 100 columns, 100000 data rows, 2048 ZIP entries and 40 MiB central-directory-declared uncompressed sizes. Adversarial decompression/ZIP-bomb handling is not independently audited. Formula/macro execution is not introduced.
- **Real XLSX evidence:** `tests/xlsx-import.test.mjs` generates `tests/fixtures/import/seed417-history.xlsx` and `invalid-formulas.xlsx` from the existing seed417 generator. Equivalent real CSV/XLSX normalize to the same 48 typed rows. Both formula rows are quarantined, including one with a cached numeric value. Multiple sheets require explicit selection. Injector/schedule XLSX binary-equivalence cases remain open.
- **SWD-13/SWD-14 browser flow:** `web/import-ui.mjs`, `web/index.html` and `web/styles.css` provide local file selection, profile/sheet/header selection, explicit field/unit mapping, explicit confirmation, original/normalized row previews, accepted/quarantined/excluded counts, per-analysis readiness and downloadable analysis/lineage. No automatic upload, server persistence or measurement verification was added. Mapping/analysis-period edits invalidate prior results. Raw identity selection includes quarantined identities, so invalid source producers are not silently dropped from whole-file readiness.
- **SWD-01/SWD-03, A1 calculation evidence:** `src/planningFixture.ts` and `tests/planning-fixture.test.mjs` add `planning/seed-417/v2` metadata while retaining the unchanged `synthetic-water/seed-417/v1` actuals/generator. Producers/groups/cohorts, start dates, explicit ramp and monthly availability are inspectable. Independent 500/500/1000 STB/day ramp/downtime anchors pass. Shifting one new producer leaves existing producer forecasts and actuals unchanged; group sums equal portfolio demand within numerical tolerance. Unknown/duplicate identities cannot silently drop demand.
- **SWD-05/SWD-06, A2:** `src/engineering.ts` and import normalization now require structured absolute-bottomhole bases and equal reservoir/limit/display datums within each injector. Incompatible inputs are rejected before calculations. Individually compatible injectors at different datums still sum to 10125 STB/day. The shared-datum exhibit rejects contradictory cross-injector chart declarations. Original 3000/4000 psia and 7500/3750 STB/day anchors pass.
- **SWD-02/SWD-03/SWD-06/SWD-14 imported analysis:** `src/importAnalysis.ts`, `tests/import-analysis.test.mjs`, `src/planning.ts` and readiness updates connect validated records to independent frozen forecast/reconciliation, explicit scheduled demand, grouping and compatible injector calculations. Imported forecast IDs retain imported input identity; no synthetic kind is fabricated by the mathematical adapter. Missing actuals/metrics stay null. A mid-February start produces 1400 STB for a 100 STB/day case; zero availability remains zero. Explicit schedule curves can be ready independently of forecast training. These import results have their own tables/chart and downloaded source lineage rather than silently replacing the demonstration fixture.
- **SWD-02/SWD-03/SWD-08, A3/A4 advancement:** Main browser displays signed monthly and cumulative variance, underlying raw histories, producer/group contributions and metadata, plus editable ramp/monthly availability. Version-2 JSON/CSV/SVG metadata and PDF attachment retain fixture inputs, hashes and grouped outputs. PDF adds raw history/producer/schedule/contribution tables. Legacy schema-1 examples still render four pages. Version-2 PDF raw-input/attachment tests pass; visual pagination review and expanded asynchronous stale-export browser checks are still open.

Additional authored paths in this continuation: `src/planningFixture.ts`, `src/importAnalysis.ts`, `web/import-file.mjs`, `web/import-ui.mjs`, `web/vendor/xlsx.mjs`, `web/vendor/xlsx-LICENSE.txt`, `web/vendor/xlsx-provenance.json`, `tests/planning-fixture.test.mjs`, `tests/import-analysis.test.mjs`, `tests/xlsx-import.test.mjs`; edits to `src/planning.ts`, `src/engineering.ts`, `src/importValidation.ts`, `src/analysisReadiness.ts`, `src/exhibit.ts`, `web/app.mjs`, `web/index.html`, `web/styles.css`, `web/exhibit-pdf.mjs`, `tests/engineering.test.mjs`, `tests/exhibit.test.mjs`, `tests/exhibit-pdf.test.mjs`, plus this record. Compiler outputs were regenerated in ignored `dist/`. The carried-oracle script regenerated its existing report under `exhibits/`. No sibling repository, Nexus vendor source, public pin/source data, Git index/history/remotes or deployment was modified.

### Actual continuation checks

- `node node_modules/typescript/bin/tsc -p tsconfig.json` — PASS.
- `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` — PASS, final check at 21:06 UTC.
- `node --check web/import-file.mjs`, `node --check web/import-ui.mjs`, `node --check web/app.mjs` — PASS.
- `node --test --test-reporter=dot tests/black-oil-integration.test.mjs tests/engineering.test.mjs tests/exhibit-pdf.test.mjs tests/exhibit-svg.test.mjs tests/exhibit.test.mjs tests/import.test.mjs tests/import-analysis.test.mjs tests/planning.test.mjs tests/planning-fixture.test.mjs tests/public-artifact.test.mjs tests/readiness.test.mjs tests/xlsx-import.test.mjs` — PASS **58/58**, final run at 21:06 UTC.
- `node --test tests/server.test.mjs` — PASS **1/1**, final approval-backed rerun at 21:06 UTC. All current test files therefore pass across the split execution (**59/59**).
- `node scripts/check-carried-oracles.mjs` — PASS: four recorded cases, 28 exact pressure points, **248 comparisons, zero failures**; preserved exclusions. This is a fresh run against saved references, not a fresh MCP call or full upstream Vitest suite.
- Native in-app browser at `http://127.0.0.1:4173/`: selected the real synthetic XLSX through the file chooser, selected `Water data`, explicitly mapped four columns and stock-tank/calendar units, confirmed and validated. Visible result: **48 accepted / 0 quarantined / 0 excluded**, `user / asserted synthetic / unverified`, history/forecast/reconciliation ready, independent missing schedules/injectors blocked. After reloading the integrated version, visible calculated forecast/actual/variance/cumulative rows matched the export. No browser screenshot artifact was retained, so the screenshot acceptance criterion is still open.
- Browser saved `C:/Users/thai.phi/Downloads/swd-import-analysis-and-lineage.json`. PowerShell independently read that actual file and checked 12 output periods, 48 original input rows, source origin/content/unverified state and January forecast **180697.6360618436 STB**, tolerance 1e-8. PASS. The browser download is a test deliverable in Downloads, not an authored sibling-repository edit.
- Browser operations were unexpectedly slow: first file chooser call took approximately 803 seconds; download call took approximately 1532 seconds despite a bounded requested REPL timeout. They completed with actual handles/results; no duplicate process/file workflow was started on timeout. This consumed most of the fresh hour. The preview server was stopped safely via its live session handle after final checks.
- Red tests were observed before the XLSX adapter, planning fixture, engineering pressure contract, imported analysis and version-2 export changes. XLSX fixture setup initially used Excel's reserved `History` sheet name; it was corrected to `Water data`. Imported constant-rate assertions were changed to an explicit 1e-8 STB tolerance after observing the expected log/exp floating-point difference of 1.4e-12 STB. One PowerShell text-replacement attempted command substitution on `$(id)` and FAILED with an unknown `id` command; the unchanged target was inspected, corrected using literal here-strings, then syntax/tests passed. No sensitive value was substituted or exposed.

### Remaining full-goal work; NOT complete

1. Connect generic per-analysis public readiness to the independently verified pinned Explorer consumer. The existing public source section and pin/identity/hash tests pass, but the import workspace's public gate still stays unavailable and should not imply that a user assertion verifies public observations.
2. Complete malformed/schedule/injector binary XLSX fixture coverage, unsupported archive/dependency review, browser CSV/invalid-row/conflict/pressure flows and multiple-profile aggregation. Imported JSON export is verified; dedicated imported CSV/PDF/exhibit wiring beyond the JSON analysis bundle is not yet delivered.
3. Finish A3 desktop/mobile/keyboard/overflow and approximately three-minute walkthrough gates; retain actual screenshots. Imported plot axis/date readability needs review. No complete accessibility audit or end-to-end multiple-profile scenario acceptance is claimed.
4. Complete A4 expanded input export visual checks, default/changed downloaded schema-2 PDFs, saved-file source/hash reconciliation, and asynchronous stale-export cancellation with the new ramp/availability/fixture fields. Schema-2 SVG embeds the full contract, but full raw input presentation and review across formats remain to be checked.
5. Complete A5 selected source/destination hash reconciliation and independent review, plus D1 requirement tracker/glossary/ADR evidence reconciliation. Fresh carried numerical evidence is available; full SWD-09 completion is not inferred from that alone.
6. A6 published Jin et al. educational example has not been implemented or independently equation/unit-benchmarked. SWD-10/P1 wellbore hydraulics, SWD-12/P1 additional model/sensitivity acceptance and SWD-11/P2 separate model/evidence planning retain their original scope/priorities and remain open.
7. Independent advisor/reviewer gate is pending with Main; no helper or reviewer was spawned by this implementer. No Git operations, hosting/deployment or permission changes are authorized by these results.

The original full native Goal is retained unchanged. At the authorized **21:08:50 UTC** checkpoint, pause for owner direction; do not mark this goal complete and do not automatically renew the hour.
