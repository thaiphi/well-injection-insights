# Preservation redesign — local implementation and evidence

Date: October 10, 2026. Scope: `swd-injection-analytics` only. Started **20:14:14 UTC**, checkpoint **21:14:14 UTC**. This record covers the approved implementation continuation, following the read-only feature/design audit. It does not close full product acceptance.

## Delivered experience

Six primary navigation areas now contain the engineering workspaces, with secondary tabs, active states, hash routes and Back/Forward support. Start offers a guided capacity assessment and independent tools. Original workbook and cited pressure/skin study remain separate entries. Imported data is never replaced implicitly with a demo. The header identifies the planning source and distinguishes independent assumed tools. It states that cases are session-only; refresh restores the route but clears files, assumptions and results.

The source/import engine and calculation modules were preserved. CSV/XLSX file and worksheet selection, profile roles, original preview, mappings, units, row validation/quarantine, exclusion, correction and confirmation remain available. Each analysis retains its own readiness and remedy. File/sheet/mapping/unit changes invalidate the affected confirmation and dependent results. History can be inspected independently of fitting, holdout or complete aggregate demand.

Producer history has search/well/group filters, accepted-row tables and source evidence. Selected-well missing calendar months render unavailable values and chart gaps; accepted zero remains zero. Training charts withhold incomplete producer aggregates and wholly missing months. These are display changes; fitting parameters and frozen identity remain owned by the existing local exponential engine.

Schedules expose the existing demo start/ramp/availability controls and confirmed imported additions. Demand charts distinguish frozen existing forecasts, scheduled additions and complete demand, with inspectable contributions. Injector history retains reported volume, calculated calendar-day rate, reported pressure and source-record keys. Public pressure remains unspecified-basis evidence, never inferred bottomhole pressure or diagnostic J.

Capacity keeps pressure constraints, availability, hydraulic limits, first deficit, unmet volume and allocated operating checks. Inputs collapse after calculation; limiting constraints sit beside the chart. Scenarios and J/diameter/availability sweeps retain the existing bounded backend. A new standalone hydraulics frontend connects the already implemented uniform/depth-dependent engines to independent inputs, pressure curves, local profiles and JSON/CSV/SVG exports. No forecast or planning source is required for that tool.

Reports centralizes all **seven existing/current export families**, retaining their actual availability. Original workbook supports JSON/CSV/SVG/PDF; selected analysis, connected capacity, sweep, PVT, cited study and standalone hydraulics support JSON/CSV/SVG. Dedicated new PDF families remain unavailable.

## Requirement coverage and preservation

Authority remains the approved PRD v1.3 and completion plan referenced by [the governing tracker](agents/issue-tracker.md). This table maps the redesign; it does not promote provisional engineering evidence to acceptance.

| Requirement / plan | Current workspace and preserved contract | Evidence / remaining scope |
|---|---|---|
| SWD-01 / A1 | Production → Histories, Fit & forecast; Start → Original workbook. Seeded identities/history and fitted snapshot retained. | Actual demo/customer history and forecast exercised; calendar-gap regression tests. Statistical cohort fitting/normalization are absent. |
| SWD-02 / A1/A3 | Fit & forecast and Reconciliation retain cutoff, horizon, model parameters, frozen identity and independent holdout. | Node fit/isolation/reconciliation checks pass. No pyResToolbox DCA substitution. Percentage unavailable at zero forecast remains engine contract. |
| SWD-03 / A1/A3 | Schedules and Demand retain existing frozen forecasts plus distinct additions, producer/group contribution tables and calendar proration. | Actual three-profile customer import produced January existing demand before the later addition. Invalid contributions remain blocking. Imported ramp editor and reusable curve assignment are proposed. |
| SWD-04 / E1/A4 | Data → pinned Explorer source; Injection → Injector history. Verification, dictionary, quality and source-row evidence retained. | Actual public view checked. Pins unchanged. No arbitrary artifact composition or Explorer package changes. External immutable refresh/two-app acceptance remains open. |
| SWD-05 / A2 | Injectivity and Original workbook retain two fictional J curves, declared reservoir/limiting pressure and datum. | Original controls mirrored, not replaced; engineering/source modules unchanged. Diagnostic-history fitting remains proposed. |
| SWD-06 / A3 | Capacity assessment retains demand, base/compared envelope, constraints, first deficit and unmet volume. | Demo and confirmed customer calculations exercised. Conditional screening only; sustainable capacity/pressure evolution unclaimed. |
| SWD-07 / A3 | Original workbook retains expansion date/rate and availability scenario; connected case retains explicit listed wells. | Original 157 HTML IDs retained. Lumped expansion is explicitly excluded from connected case; it is not silently converted to a new injector. |
| SWD-08 / A4 | Reports forwards all seven actual export families; original workbook PDF preserved. | 22 real downloaded formats; 22 export checks pass. Connected/sweep/study PDFs remain proposed. |
| SWD-09 / A5 | Brine PVT, capacity and hydraulic tools retain attributed local source adaptation, method versions, units and hashes. | Four properties and pressure sweep preserved. Live adapter/source-oracle suite passes. Retained historical Nexus Bw defect remains disclosed and untouched. No new physical model. |
| SWD-10 / P1-A | Fluid → Hydraulics/Profiles; Capacity model selection retains uniform and depth-dependent options. | Independent frontend added on existing engines; both models exercised. MD/TVD, gravity/friction signs, pressure datum, local properties and unsupported states retained. Gas-free bounded brine only. |
| SWD-11 / P2 | Injection → Model scope; acceptance disclosure and readiness remain blocked. | **Not implemented:** transient/layered/calibrated capacity still requires separate approved model/evidence work. |
| SWD-12 / P1-B | Injection → Scenarios / Parameter sweeps. | All three OAT parameters exercised; numerical/export tests pass. Failed calculation blocks complete sweep; unsupported allocations remain flagged. No probabilistic percentiles or full-factorial uncertainty. |
| SWD-13 / A0 | Data → Sources & import. | Actual CSV/XLSX/worksheet/mapping/unit/validation/confirmation and corrupt-file recovery checked. Comprehensive dependency/decompression audit remains open. |
| SWD-14 / A0/A4 | Dataset header, Readiness, Source lineage, chart/table metadata, Reports → Evidence. | User acquisition plus synthetic content preserved separately; precise blockers and dependent invalidation retained. Readiness, numerical checks and full acceptance remain distinct. |
| D1 / A6 / G2 / G3 | Governing documents preserved; separate cited study and workbook accessible. | Study downloads/source checks pass. This local review does not close full two-app G2. G3 deployment excluded. |

Features beyond the pictures remain accessible: original expansion workbook; separate constant-J view; selected-analysis exports; input templates; row pagination/exclusion; cutoff/period controls; source hashes and mapping versions; legacy reference evidence; complete constraints/allocation tables; independent uniform hydraulics and its profile-unavailable state. CLI/reference verification paths and pinned artifacts are unchanged.

## Visual comparison with all six concepts

All six actual images were inspected. They are copied without modification into the evidence gallery in logical screen order (uploaded Photo 6 is screens 01–02, Photo 5 is 03–04, through Photo 1 for 11–12). The implementation uses their navy sidebar, light workspace, clear active areas, secondary tabs, pale panels, readable tables, charts and contextual warnings.

Desktop captures use a measured **1535 × 1024 CSS viewport** (one pixel narrower than 1536), and mobile **390 × 844**. The browser's existing zoom means raster dimensions differ; metadata beside each capture records the actual viewport. The initial before capture used a different desktop viewport and is retained as historical evidence, not pixel-matched comparison. Final desktop/mobile initial viewports and full-page captures cover all twelve numbered workspaces, with extra demand, profile, scenario, source-missing and error views.

Deliberate corrections/differences:

- Real source identities and session-only state replace fictitious saved case/revision text.
- Curve library is current fitted-snapshot inspection with proposed maintenance clearly stated; no fake save/clone/assign controls.
- Start preserves engineering workbook and cited study workflows, instead of a generic spreadsheet viewer.
- History charts use existing line presentation with explicit missing-month gaps rather than copying generated bars. Schedule tables preserve real controls; a graphical development timeline is not added.
- PVT retains four working property charts/tables rather than adding mockup-only methods or copying illustrative trends. The legacy Bw disclosure does not falsely label the separate live adapter broken.
- Constant-J and wellbore hydraulic constraints stay coupled according to the engineering dependency; they are not mutually exclusive radio choices.
- Reports has seven real families rather than four illustrative cards. Unavailable PDF formats are stated honestly.
- On mobile, panels stack and primary/secondary navigation, necessary tables and charts scroll within their containers. Horizontal navigation uses an accessible rail rather than a new menu.

Remaining visual gaps: engineering pages are longer than the concepts; some charts/results require scrolling, especially on mobile. Curve previews/CRUD and graphical schedule timelines are not implemented. Extreme finite-magnitude labels retain the previously documented readability limitation. No pixel-diff or screen-reader audit was performed.

## Observed verification

| Check | Result |
|---|---|
| Final owning-app Node suite, isolated snapshot, direct Node paths | **PASS 239/239**, no skipped tests; final log in `tmp/redesign/final-suite.log`. |
| TypeScript `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` | **PASS**. |
| Syntax checks: app, import-ui, navigation, workspace-views, hydraulics, fit-display | **PASS**. |
| Download checks `node tmp/redesign/verify-exports.mjs` | **PASS 22/22**: exact CSV/JSON tables, SVG provenance, workbook content hash, embedded PDF JSON, and numerical reconstruction. Workbook PDF has ten landscape pages for this fixture. |
| Source/fixture preservation | **PASS** 148 baseline files: only three existing browser files changed; 145 unchanged, none missing. All 157 original HTML IDs retained. Source/reference/data/vendor/pins preserved. |
| Independent Astra preservation review | **PASS bounded review:** no remaining P1/P2 findings after repairs; source, desktop/mobile initial captures and eight full-page engineering captures reviewed. Reviewer did not rerun live browser or tests. |
| CSV/XLSX import | **PASS observed:** user+synthetic classification, role selection, worksheet change, mapping correction, unit invalidation, row errors/quarantine, formula rejection, confirmation and recovery. |
| Customer analysis integration | **PASS observed:** history + schedule + injector profiles; existing forecasts and additions both contribute; imported 50 STB/day ceiling yields capacity/shortfall based on those inputs. No hard-coded demo substitution. |
| Navigation/state | **PASS observed:** direct tools, guided entry, secondary navigation, Back/Forward, Profiles deep-link refresh, keyboard Enter/Tab/focus. Refresh clears session; route remains. |
| Invalid/partial engineering states | **PASS observed:** zero compared availability; stale export disabling; PVT reversed range; invalid TVD/MD; unsupported hydraulic point; uniform profile unavailable; segmented property selection; absent public source. |
| Browser-specific failures during verification | File chooser timed out while its details panel was closed; expanding the panel recovered. A long full-page capture batch timed out; shorter batches completed. One mobile click did not navigate; observed state and a retry recovered. These were not accepted as passes. |

Failures and limits retained explicitly:

1. Inside-sandbox suite **FAILED** solely on denied localhost access (`EACCES 127.0.0.1:4188`); approved final explicit owning-app run passed all 239 tests.
2. Unrestricted `node --test` discovery **FAILED** by including five preserved upstream TypeScript tests requiring unavailable Vitest. The owning package defines the narrower `tests/*.test.mjs` suite. Upstream runner was not installed or run.
3. Initial exact browser-to-Node reconstruction **FAILED** on the already documented last-bit hydraulic arithmetic difference. Exact artifact consistency checks remain exact; portable numerical reconstruction uses the existing **1e-12 scaled tolerance** (maximum observed hydraulic scaled difference 2.274e-13). This is not independent full-domain physics validation.
4. Initial download-check harness assumed four PDF pages and omitted UI export-hash metadata. Corrected harness matches the actual dynamic ten-page PDF and full exported record; application calculations/exports were not altered to satisfy those assumptions.
5. Horizontal chart keyboard focus was observed, but the attempted key-scroll check did not establish horizontal movement. Touch/drag scrolling, screen-reader behavior, cancellation timing under a long-running browser calculation, every possible parser artifact and full Explorer consumer verification were **UNRUN / UNVERIFIED** in this pass. Existing relevant unit tests pass; that is separate evidence.

## Remaining functionality and acceptance

Curve creation/naming/saving/revising/cloning/comparison/assignment, persistent saved cases, combined TRRC/customer source composition and conflict checks, diagnostic-history injectivity fitting, temperature/salinity sweep comparisons and additional PDF families remain proposals requiring their own coherent scope. None is presented as delivered by the redesign.

SWD-11, comprehensive parser/dependency review, immutable public refresh and full two-app G2 remain acceptance blockers. Retained legacy Nexus Bw behavior remains an unresolved historical/reference defect, disclosed separately from the source-checked live brine adapter. The previous producer-demand omission was already repaired before this pass; current Node and actual customer-flow checks confirm existing January forecast contributions are present. That bounded confirmation is not blanket acceptance of every demand input.

No commits, pushes, deployments, permission changes, installations or sibling edits were made. No persistent saved-case system or new reservoir physics was introduced.

## Changed files

Existing browser files: `web/index.html`, `web/import-ui.mjs`, `web/app.mjs`.

New production files: `web/navigation.mjs`, `web/workspace-views.mjs`, `web/redesign.css`, `web/fit-display.mjs`, `web/hydraulics.mjs`, `web/hydraulics.css`.

New regression files: `tests/navigation.test.mjs`, `tests/fit-display.test.mjs`, `tests/hydraulics-workspace.test.mjs`.

This new report and `tmp/redesign/` contain snapshots, screenshots, reference-image copies, actual downloads, scripts, logs, manifests and independent review records. Governing PRD/plan/ledger and existing datasets/calculation files were not rewritten.

Ownership: Main handled navigation/import/display integration and final verification. Sol/high owned the standalone hydraulics module/style/tests. Astra/high performed independent read-only preservation review; no overlapping writers.

Final control verification: mirrored schedule/injectivity inputs now update immediately, keep their DOM nodes mounted during recalculation, and preserve ordinary decimal editing and repeated range-key adjustments. Actual sequential `0.5` entry and three ArrowRight adjustments passed; the reviewer found no remaining P1/P2 issue. The edited May schedule (two-month ramp, 50% availability) produced **1500 STB/day / 46,500 bbl** while existing frozen forecasts remained separate. Final checked code passed **239/239** tests, syntax and type checks. Browser is left on a separately calculated 1.5×J comparison: base **5487.30**, compared **7269.67 STB/day**, conditional first deficit January versus April. Recorded export fixtures retain their own input snapshots; they are not silently relabelled as this later comparison.

Local redesign verification completed at approximately **21:11 UTC**, before the original 21:14:14 checkpoint. Remaining engineering/product acceptance items above are uncompleted scope, not claimed as delivered.
