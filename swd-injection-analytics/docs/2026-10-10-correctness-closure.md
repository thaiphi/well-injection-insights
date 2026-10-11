# Numerical and exhibit integrity pass — October 10, 2026

## Outcome and scope

This bounded continuation rejects unrepresentable numerical outputs and contradictory original technical-exhibit bundles. It preserves normal numerical results, retained source fixtures and prior engineering features. **Full product acceptance remains open**, including independent failure recovery by analysis described below. This is not completion of A6, SWD-10, SWD-11 or SWD-12.

Owning root: `C:/Users/thai.phi/Downloads/python/portfolio/swd-injection-analytics`, verified with `git rev-parse --show-toplevel`. Repository `AGENTS.md`, its adopted shared delegation workflow, approved Analytics PRD and existing completion plan were read. Only this repository was changed. The existing plan is in the sibling's `docs/swd-intelligence-lab/2026-10-09-plan-compliance-completion.md`; its historical NOT STARTED statuses are not a current acceptance packet.

Timebox: 2026-10-10 **11:34:07–12:34:07 UTC** (06:34:07–07:34:07 CDT). This is a new continuation after the prior connected-case work had finished, not a restart of a running timebox. Work and reporting finished before that deadline. No commits, staging, pushes, deployment, installs or permission changes. The repository remains unborn and its existing files untracked; a retained before-copy and content hashes were used instead of claiming a Git diff proves preservation.

Final verification and report completed at approximately **12:10 UTC**. Fifteen existing source/test/script files changed, two regression files and this report were added; retained before-manifest comparison found no additional original-file changes.

Main retained integration/browser/final checks. GPT-6.1 Sol/high implemented four owned numerical modules and focused tests. GPT-6 Astra/high performed bounded read-only contract and final reviews, including a short readiness addendum. At most two active subagents were used; slots and disjoint ownership were checked. No worker Git writes or child agents.

## Changes and requirement mapping

| Requirement / plan criterion | Bounded change and evidence | Status limit |
|---|---|---|
| SWD-01/02; A1/A3 | Default seeded history/fit preserved; forecast exponentiation, monthly/cumulative volumes and variance percentages checked for finite results. | No additional forecast model or calibration claim. |
| SWD-03; A3 | Schedule/group/portfolio totals guard overflow; zero active days/rate/availability stay zero; stable products rescue overflowing or subnormal intermediates when the final product is representable. | Shared-bundle failure isolation remains open. |
| SWD-05/06/07; A2 | Guard BHP, J×pressure capacity, curve grid, aggregate capacity, calendar volumes and demand deficits. Preserve 3000/4000 psia and 7500/3750 STB/day anchors and available-expansion semantics. | A finite pressure-limited field must itself be representable even if a subsequent ceiling could cap it. |
| SWD-08; A4 | Reconstruct ordered January–December 2026 rows before hashing; reject contradictory controls, rows, raw fixture or frozen fit. Retain declared aggregate actuals and unverified forecast status when raw history is absent. | Post-build CSV/SVG mutation protection remains open. |
| SWD-09; A5 | Check legacy brine adapter outputs without changing inherited equations/vendor source. Carry existing applicable reference checks. | The inherited Bw pressure-trend defect remains unresolved; finite output is not physical correctness. |
| SWD-13/14; A0/A4 | Exact calculation error reaches readiness, status and analysis paths; failures clear results/exports; mapping/file/unit edits invalidate confirmation; recovery verified. | A numerical failure withholds the whole shared user-analysis bundle, including otherwise valid analyses. |

The exhibit builder verifies fixture cutoff, source identity, full refitted model and training metadata; validates unique injector identities and shared chart datum; checks known availability/J/new-well controls against their target inputs; recomputes forecast, actuals, scheduled demand, variance, capacity, headroom and shortfall. Supported global new-well controls require one unambiguous schedule. Numeric comparison uses `abs(a-b) <= 1e-12 * max(1,abs(a),abs(b))`; identities, calendar/order, null and structure match exactly. Legacy monthly actuals are explicit declared inputs, never fabricated raw training history. Objects are cloned before asynchronous hashing.

Non-finite values, functions, BigInt, cycles, non-plain objects, symbols/accessors/non-enumerable properties and sparse/extended arrays are rejected before exhibit serialization. JSON, CSV, SVG and PDF carry the current legacy verification label. Historical schema-1/2 saved exhibits lacking the new field remain renderable with **“Historical exhibit: raw-history verification status was not recorded”**. No migration or raw-history verification is invented.

Review found and fixed three additional defects: a 33% order-dependent error from a nonzero subnormal product intermediate; chart padding/tick arithmetic overflow for representable maximum values; and a missing-field crash when rendering older SVG exhibits. SVG/PDF axes use finite scaling and fraction-first placement. Imported charts also use normalized axis spans/ticks, including finite signed limits whose difference would overflow. An unrepresentable annual unmet-volume sum explicitly blocks PDF creation instead of displaying Infinity. A final UI review caught a missed readiness refresh on period-application/render failure; the failure handler now refreshes centrally before rethrowing.

## Files changed

Production:

- `src/engineering.ts`
- `src/planning.ts`
- `src/planningFixture.ts`
- `src/importAnalysis.ts`
- `src/exhibit.ts`
- `src/exhibitSvg.ts`
- `web/import-ui.mjs`
- `web/workspace-state.mjs`
- `web/exhibit-pdf.mjs`
- `web/index.html`
- `scripts/export-exhibit.mjs`

Checks and record:

- New `tests/numerical-safety.test.mjs` and `tests/exhibit-integrity.test.mjs`
- Updated `tests/exhibit.test.mjs`, `tests/exhibit-pdf.test.mjs`, `tests/import-demand.test.mjs`, `tests/workspace.test.mjs`
- This record

Scratch snapshots, logs, baseline copies, downloaded exports and screenshots are under `tmp/correctness-closure/`. Normal compiled `dist/` was refreshed for the running local preview. No reference fixture, pinned Explorer data, vendor implementation or earlier documentation was edited.

## Executed gates

| Check | Result |
|---|---|
| `node node_modules/typescript/bin/tsc -p tsconfig.json` | PASS; built current preview modules. |
| `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` | PASS. |
| Isolated snapshot compile using its `tsconfig.json` | PASS. |
| `node --check` for changed browser/export `.mjs` modules | PASS. |
| Isolated full suite (Node runner with an explicit file list) | **150 PASS / 1 FAIL**, 151 total; only `server.test.mjs` fails with `connect EACCES 127.0.0.1:4188` in this sandbox. Not represented as passing. |
| Final isolated non-server suite | **150/150 PASS**; exact file list and exit codes retained in `tmp/correctness-closure/final-gates.json`. |
| New numerical regressions | **24/24 PASS** after observed RED failures and fixes. |
| New exhibit integrity regressions | **10/10 PASS** in the final suite; contradiction, provenance, JSON loss, pre-await mutation, extreme charts and historical compatibility cases. |
| Astra bounded numerical/exhibit re-review | **47/47 PASS**, current source/snapshot hashes match; independent product permutations and historical artifact probe pass. |
| Astra UI addendum failure/recovery probe | PASS; failure clears outputs, retains exact reason, refreshes readiness once; retry clears error. |
| Workspace chart-axis suite and Astra axis addendum | **8/8 PASS**; positive, negative, asymmetric and signed maximum ranges remain finite/monotonic, ordinary [0,100] ticks unchanged. Caller wiring reviewed. |
| `node scripts/check-carried-oracles.mjs` in isolated snapshot | **248 comparisons, 0 failures**, 4 recorded cases and 28 exact pressure points; exclusions preserved. |
| `node scripts/export-exhibit.mjs` in isolated snapshot | PASS; 12 planning months + 28 public rows; raw fixture is now supplied to the builder. Root published exhibits preserved. |
| Retained-before numerical comparison | PASS, exact deep equality for default capacities/curves/brine, frozen forecast, monthly planning/details and imported-history bundle. |
| Protected-file hash audit | **54/54 unchanged**: retained reference/data/vendor/import-fixture files and carried-coverage artifact present in the before manifest. |

Gate-history limitations: initial REDs intentionally failed. An early root-directed snapshot test invocation had the wrong working directory, causing dynamic test imports to see old root dist; that result was discarded and the suite rerun from the snapshot directory. The protected-file audit found no fixture/pin/vendor changes. A scratch legacy run initially lacked a copied UI dependency, then exposed an old test that expected Infinity to reach presentation gating; it was updated to require engine rejection while retaining tampered-result gating. Full upstream Vitest, bare Python and a fresh live MCP run were not performed. No lint configuration/dependency is installed; TypeScript and browser-module syntax checks were used without installing tools.

## Actual browser and export checks

Local preview `http://127.0.0.1:4290/` opened successfully. Browser checks used the existing in-app browser, without changing human tabs or accessing unrelated sites.

- Changed demo: new producer starts May 2026, two-month ramp, monthly availability 0.5. April added demand is zero; May is **1500 STB/day**. Frozen original history/forecast remains unchanged. JSON, CSV, SVG and PDF were actually downloaded; JSON SHA-256 verified and all three serializers reproduced their downloaded bytes exactly. Case hash: `6456141802755a4dba640a6c3d4ea3dac619664fe0f74acce455b0d730ff1727`.
- Extreme user CSV: one finite `1e308` STB/day schedule validates as a finite original rate, but its monthly calculation is rejected with **“2026-01 HUGE schedule volume (bbl) cannot be represented as a finite number”**. Grouped-demand readiness is Not ready and Run is disabled. Applying an edited period preserves that exact reason; result content is empty and all analysis exports remain disabled.
- Replacement safe CSV: selecting a new file invalidates prior confirmation. Remapping, validating and confirming 100 STB/day recovers grouped-demand readiness and produces January **3100 bbl**, February **2800 bbl**; origin remains user, content assertion synthetic.
- XLSX: actual retained `seed417-history.xlsx` selected; Notes and Water data worksheets inspected. Water data previews 48 rows. Mapping water to Month yields **0 accepted / 48 quarantined** and disabled confirmation; correcting to Water yields **48 accepted**. Confirmation retains worksheet/header/hash/units; changing water units invalidates the profile and dependent results.
- Keyboard: Tab from the selected-analysis control reaches Run; Enter runs the imported forecast and displays the calculated monthly table/chart.
- Extreme finite chart: four-row CSV retains a January volume approximately 0.8 × maximum finite number, with three training months at 1e300 STB/day. All four rows validate; single-month reconciliation runs and its SVG contains no NaN/Infinity attributes. Analysis exports are enabled. An earlier exactly-at-limit conversion rounded above the finite boundary and was correctly quarantined. The extreme-magnitude labels remain visually unwieldy/clipped; scientific/compact formatting is still a presentation gap.
- Connected disposal case: explicit illustrative geometry and J multiplier 1.5 still reproduce base **5487.30 STB/day**, first deficit January, unmet **1431058.80 bbl**; compared **7269.67 STB/day**, first deficit April, unmet **919061.56 bbl**. Both retain the same demand/source rows. No browser console warnings/errors observed.

Downloaded files and screenshots are in `tmp/correctness-closure/browser/`. The normal viewport override was reset. The final deliverable tab is left on the calculated connected case.

## Visual comparison to the supplied mockups

Reference: supplied Analytics import/provenance mockup, `ChatGPT Image Oct 9, 2026, 06_26_05 PM.jpg`; engineering reference `06_26_34 PM.jpg`. This pass changes failure/provenance presentation, not the visual system.

Desktop layout was captured at **1536×1024 CSS viewport**, with a **1520×1024** content capture excluding the scrollbar. Mobile used **390×844 CSS viewport**; content has no page-level horizontal overflow (`clientWidth = scrollWidth = 375`). The browser panel initially clipped an ordinary desktop viewport capture; a full-page capture with an explicit content rectangle resolved it. Screenshots are real captures, not reconstructed mockups.

| Area | Current comparison / remaining difference |
|---|---|
| Navigation | Dark 208px left rail and blue active item follow the reference. Product has an additional PVT entry and a small SWD wordmark; icons differ from the reference illustrations. Mobile uses horizontal navigation. |
| Panels / spacing | Three sand/blue/lavender source cards, preview left and requirements right, readiness and lineage below. Persistent dataset banner and explicit five-step workflow add vertical height; readiness/lineage do not all fit in the first desktop screen as in the concept image. |
| Typography / colors | Segoe UI/Tahoma/Arial, dark headings, pale cards and fine table rules retain the engineering-dashboard character. Source icons and body text differ in size/weight; this is not pixel-identical typography. |
| Tables | Real original columns/source row numbers, mapping controls, validation counts and normalized lineage replace illustrative preview values. Requirements change by analysis. Long source hashes wrap. |
| Charts / units | Current charts use computed monthly stock-tank **volumes (bbl)** and explicit calendar-day rates rather than copying the mockup’s inconsistent volume/rate labels. Capacity and frozen forecast remain separate; no fake readiness or calibrated-capacity claim. |
| Mobile | Cards/panels stack; source identity wraps and navigation scrolls horizontally. Long data tables retain their own scroll regions. No supplied mobile reference exists, so mobile is a responsive check, not an exact mockup match. |

Screenshots: `import-desktop.jpg`, `import-desktop-full.jpg`, `import-mobile.jpg`, `overflow-desktop.jpg`, `overflow-analysis.jpg`, `connected-case-desktop.jpg`, `finite-boundary-chart.jpg`.

## Acceptance blockers and next work

1. **SWD-14 calculation-failure isolation remains open.** A valid 100 STB/day training history alone produces a ready forecast and January 3100.0000000000014 bbl. Adding the extreme schedule causes the shared analysis call to throw; the UI honestly withholds the whole bundle, including that otherwise valid forecast. The observed probe is retained in `failure-isolation-gap.json`. This does not satisfy independent unaffected-analysis recovery. The blocker is visible in the app.
2. CSV/SVG serializers still accept post-build mutated exhibits without independently checking their content hash. Builder reconstruction and existing PDF hash verification do not establish universal export tamper protection.
3. Inherited Nexus legacy brine Bw has an incorrect pressure trend. Adapter finite guards do not repair it. The separate source-checked PVT/connected-case method remains distinct.
4. Stored ZIP streaming-descriptor variants remain unsupported; broader XLSX parser/decompression/dependency review remains open.
5. Published engineering study A6, extended/library hydraulics SWD-10, broader sweeps SWD-12 and layering/transient/calibration SWD-11 remain incomplete. The connected uniform-fluid screening case is bounded partial evidence, not completion of these requirements.
6. Server route-confinement test remains unverified because the sandbox denies the test connection. Actual browser opening/downloads pass but do not substitute for that route-security gate.

Next P0 correctness work is independent failure recovery by analysis and export mutation integrity; A6 is the next missing study feature after those gates. No unrelated numerical-model repair or broad refactor was silently included here.
