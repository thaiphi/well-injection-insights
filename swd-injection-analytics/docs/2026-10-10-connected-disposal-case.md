# Connected disposal-capacity case — implementation and evidence

Authorized by the human's “do it” following the agreed confirmed-history → fluid/well inputs → pressure calculations → demand comparison → scenario workflow. Owning root: `C:/Users/thai.phi/Downloads/python/portfolio/swd-injection-analytics`. New bounded task started 2026-10-10 06:12:14 UTC (October 10, 1:12:14 AM CDT); checkpoint 07:12:14 UTC. The previous PVT task ended at 05:29 UTC. No restart of an active timebox, commits, pushes, deployment, installation or permission changes.

## Design and ownership

Extend existing data-to-analysis flow with a Disposal capacity case. Select the seeded demonstration or confirmed user profiles; public RRC injection observations alone cannot supply produced-water demand, J or compatible bottomhole pressures. All new fluid/geometry values remain explicit user-entered assumptions. The original PVT view remains independent; the new case evaluates its own declared uniform-fluid reference condition using that source-checked method. The inherited Nexus Bw defect is bypassed and remains disclosed.

Per-well stock-tank J and demand retain STB/day; local pipe flow is qST × Bw. MD controls Darcy–Weisbach friction, TVD controls downward hydrostatic gain. Required wellhead pressure = reservoir pressure + qST/J − hydrostatic gain + friction loss. Uniform properties are an approximation, not a variable-pressure traverse. Maximum capacity is constrained by assumed bottomhole limit, surface limit and operating ceiling, then availability once. Monthly allocations use calendar days and onstream rates; unsupported low flowing pressures must be visibly flagged instead of clamped into readiness. This is a screening envelope, never a sustainable-capacity or field-calibration claim.

Base versus one-well compared J/diameter/availability assumptions use identical frozen demand. Full source inputs/lineage, units, methods, pressure contributions, allocations, limitations and both scenarios travel in the same result snapshot and exports. Source/profile/period edits invalidate dependent cases.

Main sole owner of web integration and evidence. GPT-6.1 Sol/high owns only new `src/disposalCase.ts`, `tests/disposal-case.test.mjs` and engine scratch. GPT-6 Astra/high provides read-only contract/final review under the shared seven-field/two-slot workflow; statuses checked before dispatch. No overlapping writers. Existing files/fixtures/pins/vendor are protected by a before-manifest; only three existing web files are allowlisted for bounded edits.

Primary friction reference: [EPA EPANET hydraulic algorithms](https://usepa.github.io/EPANET2.2/12_analysis_algorithms.html). Laminar 64/Re and turbulent Swamee–Jain; any transition interpolation is explicitly custom, not an EPANET parity claim. The installed historical pyResToolbox snapshot has no `nodal/` directory; modern nodal/VFP parity is unavailable, not invented or installed.

## Execution checks

- [x] Test-first engine: 14 focused tests cover independent hydrostatic, laminar/turbulent friction, rate conversion, monotonic/bounded capacity, low-pressure feasibility, availability, allocation/calendar and invalid/tampered exports.
- [x] Bridge and lifecycle: five focused tests plus actual browser checks cover confirmed histories/profiles, exact source IDs, public-only and stale-input blocking, and unchanged demand between compared controls.
- [x] Actual desktop/mobile case UI, linked pressure/limiting-factor/demand results and JSON/CSV/SVG downloads.
- [x] Direct type/syntax checks, 115 non-server tests, carried references and 88 protected hashes pass. **Full suite FAILED: one server test receives sandbox localhost EACCES.**
- [x] Independent meaningful Astra review completed; bounded checkpoint approved after three review corrections. Full PRD acceptance remains open.

## Requirement mapping

SWD-05/06: compatible pressure-basis/datum and constrained capacity. SWD-08: linked technical outputs/evidence. SWD-09: reused constant-J and source-checked brine. SWD-10: bounded custom single-phase wellbore foundation only; no library VFP/segmented benchmark claim. SWD-12: one-well sensitivity comparison only. SWD-13/14: confirmed input consumption, source separation and actionable case blocking. SWD-11, A6 cited study, broader hydraulics/models and inherited acceptance defects remain open.

## Delivered behavior and engineering value

Open **Capacity scenarios** after selecting a demonstration or confirming user history and injector profiles. The connected case answers which declared pressure constraint limits each well, how much forecast water remains unserved, and what changes under one well's J, tubing diameter or availability assumption. The original demand/constant-J workbook remains accessible through its inspection button; other routes and PVT functionality are preserved.

For the actual demonstration download, holding all demand fixed and changing Injector A's J multiplier from 1 to 1.5 changes available capacity from **5,487.30 to 7,269.67 STB/day**. The first envelope shortfall moves from **January to April 2026**; annual unserved volume falls from **1,431,058.80 to 919,061.56 bbl**. Both well capacities bind on the assumed 1,500 psia surface limit. These are assumption sensitivities, not treatment-response predictions or operating recommendations.

The January forecast is **180,697.6360618436 bbl**; April includes the explicitly scheduled new producer and totals **346,068.8130260831 bbl**. A real browser schedule edit from April to June invalidated exports and moved the compared first shortfall to June. Confirmed history without that schedule produces a different case: base annual shortfall **23,296.91 bbl**, compared shortfall zero. Source lineage retains `user` origin and `synthetic + assumed` content separately.

User geometry begins blank. Applying illustrative geometry is an explicit action, labeled as an assumption. A deep-well check produced a positive envelope but **12 unsupported allocation months**, visibly flagged because required flowing surface pressure fell below the supported range. Zero compared availability produced zero allocation and null flowing pressures for that well, rather than a divide-by-zero or fictitious operating point.

## Visual comparison and actual screenshots

Both owner JPG references were accessible and inspected. The earlier visual pass's comparison and before screenshots remain in [its verification record](2026-10-10-ui-import-provenance-verification.md). This connected-case pass preserves its 208 px navy navigation, compact Segoe UI hierarchy, neutral bordered panels, blue active controls, source colors and explicit dataset bar.

Against the capacity mockup, the main change is a real input-to-result workflow: demand/source evidence first, fluid assumptions beside requirements, two well-geometry panels, then sensitivity controls. Results use three tinted comparison cards, a full-width rate chart, a constraint table and two pressure charts. Monthly volumes and per-well pressure contributions are inspectable tables. Blue denotes demand/base pressure, teal base capacity, lavender the compared case, and amber the assumed surface limit. Labels distinguish stock-tank **STB/day** from calendar-month **bbl**, and absolute pressure **psia** from pressure contributions **psi**. No invented uncertainty band or mockup cohort data was added.

The new case is taller than the reference: input declarations and evidence take space, results sit below the first fold, and wide engineering tables scroll horizontally. Mobile uses the existing horizontal navigation, stacked cards/panels and 360-pixel chart viewBoxes. This is not a pixel-identical dashboard or a newly completed mobile design system.

Current captures were verified at **1536×1024 CSS pixels** and **390×844 CSS pixels**. Document width equaled client width at both sizes; no page-wide horizontal overflow. The case-pass before captures were at the earlier tab's fixed 1280-pixel viewport, so they are not represented as same-viewport comparisons. The original visual-pass before captures and reference comparison are preserved separately.

- [Desktop inputs](../tmp/disposal-case/screenshots/desktop-inputs.jpg)
- [Desktop summary and demand chart](../tmp/disposal-case/screenshots/desktop-summary.jpg)
- [Desktop constraint table and pressure charts](../tmp/disposal-case/screenshots/desktop-framed.jpg)
- [Full desktop](../tmp/disposal-case/screenshots/desktop-full.jpg)
- [Mobile inputs](../tmp/disposal-case/screenshots/mobile-inputs.jpg)
- [Mobile results](../tmp/disposal-case/screenshots/mobile-results.jpg)
- [Mobile focused/scrollable constraint table](../tmp/disposal-case/screenshots/mobile-table.jpg)
- [Full mobile](../tmp/disposal-case/screenshots/mobile-full.jpg)

These are actual browser captures, not composites. Full-page captures can repeat sticky elements; the viewport captures are the primary visual evidence. `mobile-full-attempt.jpg` is a diagnostic fixed-desktop capture and is explicitly excluded from mobile evidence.

## Changed files and requirement outcomes

| File | Change / coverage |
|---|---|
| `src/disposalCase.ts` | New bounded hydraulic/constraint/allocation engine and guarded CSV serialization; SWD-05/06/07/08, partial SWD-10/12 |
| `tests/disposal-case.test.mjs` | 14 numerical, invalid-input and export tests |
| `web/disposal-context.mjs` | Pure bridge to actual confirmed input calculations; demo demand recomputation; user/public separation; SWD-03/06/13/14 |
| `tests/disposal-context.test.mjs` | Five bridge, stale-input and provenance tests |
| `web/disposal-case.mjs` | Case controls, invalidation, constraint/pressure/monthly tables, responsive charts and downloads; SWD-06/08/12/14 |
| `web/index.html` | Added connected case section and module only |
| `web/styles.css` | Appended connected-case styling only |
| `web/import-ui.mjs` | Case route/context/events, retained original workbook route, accurate partial-wellbore readiness wording |
| `dist/disposalCase.js`, `dist/disposalCase.d.ts` | New generated runtime/declarations only; generated dist is ignored as before |
| This record and `tmp/disposal-case/` | Design, before-manifest/backups, isolated builds/checks, downloads and browser evidence |

SWD-05/06 gain connected pressure constraints and demand comparison; SWD-07 has a tested zero-availability sensitivity, with original dated expansion retained only in the original workbook. The connected case intentionally excludes that workbook's lumped expansion because it lacks an explicitly listed well/geometry. SWD-08 gains matching JSON/CSV/SVG for this case; a case-specific PDF export is **not** implemented. SWD-09 reuses the constant-J foundation and source-checked brine adaptation with preserved provenance. SWD-10 remains **partial custom single-phase screening**, SWD-12 remains **partial one-well comparison**, SWD-11 remains open. SWD-13/14 consume the existing confirmed profiles with actual outputs and defect-aware blocking; no new parser claim is made.

## Browser and export verification

| Exercise | Actual observation |
|---|---|
| CSV history selection, mapping, units, validation, confirmation | 48 original rows; 48 accepted after explicit Producer/Group/Month/Water, STB/day and calendar-day mapping |
| Injector CSV | Two wells mapped with stock-tank J, psia, compatible basis/datum and fractional availability; confirmed alongside history |
| Missing geometry | Calculation blocked with `FICTIONAL-INJ-A: declare TVD below wellhead (ft)` |
| Confirmed CSV case | Explicit illustrative geometry enabled real calculations and a separately hashed user-origin JSON download |
| Input edit and invalid temperature | Editing immediately removed results/disabled exports; 400 °F blocked with supported 60–250 °F range |
| XLSX selection | Explicit worksheet required; Notes and Water data offered; 48 rows on Water data |
| Missing mappings/units and corrections | 0 accepted / 48 quarantined; corrected mapping/units enabled confirmation and the connected case |
| File, unit and worksheet changes | Prior profile confirmation/results invalidated; case exports disabled; Notes reset mapping and showed zero data rows |
| Bad CSV rows | Five quarantined rows retained original row numbers; errors for empty producer/group, bad month, negative water and boolean-like text |
| Public RRC selection | Calculation disabled with precise missing producer demand/J/BHP/geometry reason |
| Schedule edit | Source event invalidated exports; real revised demand/shortfall reached the new case |
| Zero availability | Compared well zero allocation, shut-in status and null operating pressures |
| Keyboard | Tab progressed Calculate → JSON → CSV; Enter recalculated the same demo hash; mobile constraint region ArrowRight scrolled 40 pixels; Tab reached monthly results |
| Browser logs | No captured warning/error entries on either test tab at the checked checkpoint |
| Viewport change | Same result hash retained while charts changed from desktop 900/600 to mobile 360 viewBoxes |

Actual downloads: [demo JSON](../tmp/disposal-case/download.json), [CSV](../tmp/disposal-case/download.csv), [SVG](../tmp/disposal-case/download.svg), [mobile SVG](../tmp/disposal-case/mobile-download.svg), [confirmed user case](../tmp/disposal-case/user-download.json), [changed schedule](../tmp/disposal-case/schedule-download.json).

The demo case SHA-256 is `4c8019f5c4355df16c9af228cb1e87658b7132748b0a40172edff35427e7929d`. [Download verification](../tmp/disposal-case/download-verification.json) checks that exact hash, matching complete snapshot metadata, 460 exact CSV numerical values, all 12 monthly and 48 allocation DOM rows, and byte-identical desktop/mobile 900-pixel SVG exports. Independent reconstruction of the demo, user and changed-schedule cases checks 12,154 numerical values within a stated 1e-12 tolerance; maximum observed scaled difference was **3.84e-16**. It also confirms the schedule edit retained original history, appended CSS preserved all prior styles, stripping only the new HTML/module restores the original document, and the served new dist files equal the checked build.

The first exact cross-runtime reconstruction **FAILED** on last-bit browser-versus-Node friction-factor differences. Numerical reconstruction therefore uses the stated tolerance while hashes/metadata remain exact. The current CSV guard requires exact recomputation in its generating runtime; portable re-export from a different runtime is not promised or silently claimed.

## Gates and review

Checks run from the owning root through direct Node, preserving original fixture files by running fixture-writing tests in an isolated snapshot:

| Gate | Command / result |
|---|---|
| Isolated build | `node node_modules/typescript/bin/tsc -p tmp/disposal-case/check-snapshot/tsconfig.json` — PASS |
| Root types | `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` — PASS |
| Module syntax | `node --check web/disposal-case.mjs`, `web/disposal-context.mjs`, `web/import-ui.mjs` — PASS |
| Full suite | Direct `node --test` over all `.test.mjs` in snapshot via `node tmp/disposal-case/checks.mjs` — **FAILED**, 115 pass / one fail: `connect EACCES 127.0.0.1:4188` |
| Non-server suite | Same runner excluding only `tests/server.test.mjs` — **115/115 PASS**, zero skips |
| Carried references | `node scripts/check-carried-oracles.mjs` in snapshot — PASS, 4 cases / 28 anchors / 248 comparisons, zero failures |
| Download/DOM evidence | `node tmp/disposal-case/verify-downloads.mjs` — PASS with explicit cross-runtime tolerance note above |
| Protected original content | Before-manifest check — **88/88 hashes unchanged**; fixtures, pins, vendor and original engine sources preserved |
| Existing-file review | Before-backup comparison shows only the added HTML/module, appended case styles and bounded import routing/readiness/context changes |

No npm/npx, Vitest, Python installation, live MCP or full upstream suite was run or claimed. No configured lint gate exists in this repo. The server gate needs a host outside this sandbox: `node --test tests/server.test.mjs` after the normal build.

Astra/high independently checked the contract and implementation. Review probes covered 1,288 increasing-pressure points, six monotonic surface-limit capacities, allocation conservation, and representative Swamee–Jain versus iterative Colebrook error (maximum 0.2245%). Three P2 findings were corrected: true-relative turbulence-test tolerance, clipping each pressure series at its own envelope, and obsolete wellbore-readiness wording. Final review approved this bounded checkpoint with no open P1/P2 finding. That review does not certify field applicability or full PRD acceptance.

## Acceptance blockers and remaining gaps

- **SWD-10:** no modern library nodal/VFP parity, segmented pressure-dependent PVT traverse, fittings/pump/heat-transfer model or full extended-wellbore acceptance. The locally installed historical pyResToolbox snapshot has no `nodal/` directory; none was invented or installed.
- **SWD-11:** no layered/transient reservoir model, field calibration, interference or sustainable-capacity prediction.
- **A6:** the separately identified published engineering study and its independent anchors remain outstanding.
- **SWD-12:** broader model choices, sweeps/tornado and a predicted physical treatment response remain outstanding.
- The legacy Nexus Bw pressure trend defect remains disclosed and bypassed by this case's source-checked brine method; its original implementation was not repaired. Inherited broad finite-overflow/exhibit-contract defects remain acceptance blockers outside this bounded case.
- The prior producer-demand omission and typed-spreadsheet defects were repaired in earlier authorized passes; this case consumes those calculations and does not substitute hard-coded demonstration output. Inherited unsupported streaming/zero-local-size XLSX forms remain a parser gap.
- Positive envelope headroom is insufficient when an allocation is flagged unsupported. Availability allocation is not a coordinated daily operating schedule. Surface and bottomhole limits are declared assumptions, not inferred regulatory permission.
- No case-specific PDF, automated full accessibility audit, cross-browser matrix, new publication fixture, full upstream tests or live MCP claim. The one localhost server test remains failed in the sandbox.

The source tree remains uncommitted. Its unborn repository reports all original files as untracked; that is not evidence that this pass created them. The explicit before-manifest/backups identify this pass's bounded changes.

Bounded implementation and evidence completed at **2026-10-10 06:42 UTC (1:42 AM CDT)**, before the original 07:12:14 UTC checkpoint. Temporary viewport overrides were reset. The calculated demonstration tab was marked as a deliverable; original user/PVT tabs were preserved and the scratch import tab closed. Full acceptance remains open for the blockers above.
