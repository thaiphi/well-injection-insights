# SWD Injection Analytics — owning application specification

**Repository:** `swd-injection-analytics` · **Document date:** October 10, 2026 · **Acceptance:** OPEN / provisional pending Main's final verification.

This document implements D1 documentation for the existing application. It summarizes the approved scope and observed implementation; it is not a new PRD, scope approval, or declaration that every requirement is complete. The authoritative PRD is version 1.3 at the read-only sibling path `../phi-analytics/docs/swd-intelligence-lab/01-swd-injection-analytics.md`; the approved completion matrix is `../phi-analytics/docs/swd-intelligence-lab/2026-10-09-plan-compliance-completion.md`. Their original priorities and acceptance criteria remain authoritative. Their October 9 NOT STARTED statements describe that revision, not later implementation evidence.

Use the [requirement and evidence tracker](docs/agents/issue-tracker.md) for criterion status, exact commands and outstanding work. [AGENTS.md](AGENTS.md) governs repository boundaries and delegated ownership. The [glossary](GLOSSARY.md) defines rate, volume, pressure and provenance terms; the [runtime and pin decision](docs/adr/001-existing-runtime-and-pin.md) records architecture and limits.

## Purpose and intended workflow

Demonstrate a produced-water planning workflow: inspect history, freeze a forecast, reconcile withheld observations, change a development schedule, compare incoming demand with assumed disposal capacity, and download the supporting evidence. A visitor should complete forecast → scenario → evidence in approximately three minutes. That timed integrated acceptance exercise remains a separate gate.

The demonstration does not require private operating data. It does not establish an actual location's viability, measured reservoir properties, safe operating pressure, permitting eligibility, induced-seismicity risk or calibrated sustainable capacity. Live SCADA, autonomous operating recommendations, permitting/GIS and portfolio implementation are outside this repository's current work. P1/P2 engineering extensions remain in the approved full scope at their original priorities.

## Independent input collections

| Collection | Identity and current implementation | Permitted use and boundary |
|---|---|---|
| Seeded synthetic planning | `synthetic-water/seed-417/v1`: two fictional producers × 24 months (2025–2026); fixed seed 417 and forecast cutoff 2025-12. `planning/seed-417/v2` adds inspectable group/cohort/producer/schedule metadata without replacing the original actuals. | Simulated histories and holdout actuals, forecasting, reconciliation and grouped demand; never assign them to a real API/UIC. |
| Fictional injection scenarios | Two explicit absolute bottomhole constant-J cases in [engineering.ts](src/engineering.ts), with declared per-well reservoir/constraint datum, operating ceiling and availability. | Assumed pressure-rate/capacity comparisons; no public-pressure calibration or operating recommendation. |
| Public Explorer snapshot | Local artifact `rrc-2026-10-09-uic000020838-v1`, [pin](data/explorer-pin.json), manifest, dictionary, QC, retained sources and normalized tables. Five inventory parents; 28 parent-linked H-10 periods for one UIC, January 2024–April 2026. | Descriptive monthly public observations after verification. Other parents have no acquired history. Reported pressures are not BHP or reservoir pressure. |
| User files | Browser-local CSV/XLSX selection with explicit profile, worksheet/header, mapping, units, validation and confirmation. Original bytes/hash and row lineage retained. | Acquisition origin is user; asserted measured/synthetic/public content remains unverified. No automatic upload or persistence. Profiles cover history, schedules and injector assumptions. |
| Published example | [Jin et al. fixture](data/scenarios/literature-example.json), DOI 10.3390/en15062101; Table A1 and selected equations documented in [method note](docs/literature-example-method.md). | Independent steady radial skin comparison. Literature parameters, assumed skin and calculated outputs are separate from synthetic/public/user datasets. |

The active-dataset banner does not make independent fluid or literature workspaces consume that dataset. Public source failure leaves synthetic and independently entered study cases usable. Missing fluid/geometry inputs do not become values inferred from a monthly H-10 report.

## Selected calculations and evidence contracts

### Forecast and reconciliation

[planning.ts](src/planning.ts) fits the selected exponential model in log-rate space using only distinct positive observations through the cutoff; at least three training observations are required. Future holdout values cannot affect fitted coefficients. Forecast and actual rate/volume units must be explicit. Monthly volume equals the supported average daily rate multiplied by actual calendar days; leap years are included.

Variance is actual minus forecast; cumulative variance preserves the same sign. Percent variance is unavailable when forecast is zero. Missing actuals remain missing and block affected reconciliation rather than becoming zero. A new producer schedule changes demand independently of frozen existing-producer forecasts and observations.

[planningFixture.ts](src/planningFixture.ts) expresses scheduled rate as `q0 * exp(-D*age) * min(1,(age+1)/rampMonths) * availability(month)`, zero before start. Default rampMonths=1 and availability=1 preserve the existing schedule. The independent 1000 STB/day, D=0, two-month ramp and availability 1/0.5/1 example yields 500/500/1000 STB/day. Producer → group → portfolio sums must agree, with unique, inspectable identities.

### Constant injectivity and capacity

At a compatible per-injector absolute bottomhole pressure basis and datum:

```
Pwf_psia = Pres_psia + q_STB_per_day / J_STB_per_day_per_psi
pressure_limited_rate = max(0, J * (Plimit - Pres))
operating_rate = min(pressure_limited_rate, operating_ceiling)
available_rate = operating_rate * availability
monthly_capacity_bbl = available_rate * calendar_days
shortfall_bbl = max(0, monthly_demand_bbl - monthly_capacity_bbl)
```

Independent PRD anchors: Pres=2000, J=5 and q=5000 give Pwf=3000 psia; J=2.5 gives 4000 psia. Plimit=3500 gives pressure-limited rates 7500/3750 STB/day before availability. Availability is applied once; zero availability contributes zero. Per-well compatible datums can support aggregate stock-tank capacity; a shared pressure chart/exhibit must enforce its declared shared datum. Limits at/below reservoir pressure give zero pressure-limited capacity. Unsupported basis, missing datum, invalid J and nonfinite outputs block affected calculations.

The original workbook's expansion is an additional available-capacity assumption beginning in a stated month. The separate connected disposal case uses individually declared wells and excludes that lumped expansion when no corresponding geometry exists. Neither is a calibrated capacity forecast.

### Fluids and bounded wellbore screening

The current live [engineering adapter](src/engineering.ts) uses the source-checked gas-free NaCl implementation in [brinePvt.ts](src/brinePvt.ts) and [pyrestoolboxBrine.ts](src/pyrestoolboxBrine.ts), retaining exact source hashes and 45 recorded direct-library cases. Engineering salinity input is NaCl **mass ppm**, converted by 10000 ppm = 1 wt%; it is not mg/L TDS. Bounds are 100–10000 psia, 60–250 °F and 0–20 wt% NaCl. Independent PVT sweeps do not alter constant-J capacity.

The legacy Nexus source and fixtures remain preserved. Agreement in 248 carried comparisons establishes historical reference agreement, not correctness of the inherited reversed Bw pressure trend. The modern adapter has separate fidelity, monotonic-compression and mass-consistency checks across bounded temperature/salinity corners. A production import regression gate keeps historical Nexus engineering out of live source dependencies; it is not a runtime access restriction. PVT result/export provenance distinguishes source agreement, bounded physical screening and the excluded historical water-FVF implementation. Full independent fluid-domain validation remains open. No fresh live MCP call, clean-package-release claim or full upstream Vitest run is inferred.

[disposalCase.ts](src/disposalCase.ts) retains the original uniform-fluid downward-injection screen and adds an opt-in [depth-dependent brine traverse](src/wellboreTraverse.ts). Local pressure and prescribed temperature update source-checked Bw, density and viscosity; RK4 integrates gravity and Darcy-Weisbach friction with convergence and domain guards. Nexus Serghides friction is retained with its source hash and explicit Fanning-to-Darcy conversion. Geometry, pressure datums, stock-tank rates, availability, limits and monthly allocations remain explicit. This is bounded SWD-10/P1-A engineering screening, not a producing-fluid VFP claim or calibrated sustainable capacity. See [method and limitations](docs/2026-10-10-wellbore-traverse.md).

[disposalSensitivity.ts](src/disposalSensitivity.ts) implements SWD-12/P1-B one-at-a-time injectivity, tubing-ID and availability sweeps under either fluid model. Finite 3–9-point grids retain endpoints and an exact baseline; any failed point blocks the entire sweep. The base scenario, original comparison context, frozen demand, source identities and units travel into verified JSON/CSV/SVG. Browser workers keep calculation and export verification responsive; edits terminate pending work and invalidate dependent outputs. See [the sensitivity contract](docs/2026-10-10-disposal-sensitivity.md). Full-factorial uncertainty, fitted treatment response and transient/layered/calibrated capacity (SWD-11/P2) are unimplemented.

### Published steady radial example

Jin, Wojtanowicz and Ge (2022), equations 18/21/22 on PDF p10 and Appendix A Table A1 on p18, supplies the selected source. Literal `Iw = 2e-6*pi*h_m*K_D/[mu_cP*(ln(re/rw)+S)]`; pressure rise is `q_m3_per_s/Iw` in kPa. Field-side parameters are converted consistently. The 2e-6 coefficient is retained and its approximately 1.325% difference from exact-SI pressure rises is disclosed.

Skin zero versus user-selected 0–50 and full 15 ft contributing thickness are assumptions. Default q=5000 reservoir bbl/day and skin=5 give a calculated 907.284827 psi penalty. Pressures remain reported psi, absolute/gauge unspecified, at a common formation datum. The published 4334 psi fracturing value is a comparison reference only, never operating/permitted/safe limit. Inconsistent oil-density and depth pairs are unused. No oil-invasion, transient, geomechanical or seismic simulation is implemented.

## Import, readiness and numerical failure behavior

[import-file.mjs](web/import-file.mjs) uses locally pinned SheetJS CE 0.20.3 with source/license hashes. It does not execute formulas or macros. Unsupported workbooks, formulas and spreadsheet errors are rejected/quarantined under the explicit boundary; cached formula values are not accepted as observations. Limits include 10 MiB input, 50 sheets, 100 columns, 100000 rows, 2048 ZIP entries and 40 MiB declared/emitted expanded data. These are implementation limits, not a comprehensive parser security audit. Signed/unsigned stored-streaming ZIP descriptors are supported through a validated private parser copy; original bytes/hashes remain unchanged. STORED and DEFLATE payload CRC and exact expanded-size checks precede workbook parsing. Following native CRC/size validation, the pinned inflater's read head must consume each entire compressed member, rejecting trailing or concatenated streams. Parser-equivalent case/separator/root member aliases are rejected. Actual cells determine worksheet bounds, preserving rows hidden by inaccurate dimension metadata and applying existing limits to their real extent. The endpoint probe briefly allocates an expanded buffer; no hard peak-memory ceiling or comprehensive decompression/dependency review is established. See the [bounded correctness closeout](docs/2026-10-10-brine-parser-correctness.md) and its fresh browser checks; the earlier [compressed-import checks](tmp/project-completion/browser/deflate-browser-checks.json) remain retained evidence.

Mappings and declared units are previewed and confirmed before use. Unsupported date/rate/volume/pressure bases, conflicting duplicates and invalid identities remain visible with original rows and accepted/quarantined/excluded counts. Confirmation, current outputs and exports are invalidated by file, worksheet, mapping, unit or relevant control edits.

[analysisReadiness.ts](src/analysisReadiness.ts) declares ready/not-ready and actionable reasons per analysis. [importAnalysis.ts](src/importAnalysis.ts) separates numerical execution stages. A schedule overflow withholds complete demand/group totals while preserving independent history, forecast and compatible injector details. Failed selected contributions cannot be silently dropped into a partial aggregate. A valid fit without holdout supports forecast while affected reconciliation stays blocked. Readiness is an input/calculation gate, not a guarantee of full product acceptance or field applicability.

## Technical record and exports

Every technical record must preserve original input identity/version, origin and assertions, mapping/unit decisions, pressure datum/basis, forecast cutoff/model, formulas, assumptions, calculated values and relevant source hashes. Missing and zero remain distinct. Hashes establish byte/content consistency, not truth or authenticity.

The original workbook exports JSON/CSV/SVG/PDF, with vector PDF and exact attached JSON. [exhibit.ts](src/exhibit.ts), [exhibitIntegrity.ts](src/exhibitIntegrity.ts), [exhibitSvg.ts](src/exhibitSvg.ts) and [exhibit-pdf.mjs](web/exhibit-pdf.mjs) validate coherent original inputs, outputs and serialization before export. The optional offline PDF path verifies captured original bytes through the shared Node verifier before rendering, using a single file read; raw numeric overflow cannot disappear into a normalized hash. Current live original-workbook engineering version is `constant-j-pyrestoolbox-brine/2`; current declared-input schema 1 stays explicitly unverified against absent raw history, and historical artifacts retain historical labels.

Selected user analyses, independent PVT, connected disposal and literature workflows have their own export contracts. The literature and connected disposal cases have JSON/CSV/SVG and explicitly no dedicated PDF. A successful original-workbook PDF is not proof of PDF coverage for every workflow. Async original-workbook exports must discard stale output when case identity changes.

## Acceptance and delivery state

All SWD-01–SWD-14 remain mapped in the [tracker](docs/agents/issue-tracker.md). Main's updated final facts report 188/188 current Node tests outside the sandbox, 248 carried comparisons and 45 modern brine reference cases; these are component evidence, not whole-project acceptance. Stored-descriptor repair review passed 20/20; Main observed signed/unsigned browser samples with three accepted rows and matching original hashes, and formula/typed-error variants with one accepted/two quarantined and confirmation disabled. Main also observed readable validation columns and desktop/mobile keyboard scrolling. [Offline PDF checks](tmp/project-completion/offline-pdf-gates.log) passed eight cases: six valid current/historical/missing-data cases and corrupt/raw-numeric rejection. Current literature desktop/mobile and actual-download parity evidence is retained under [browser checks](tmp/project-completion/browser/download-checks.json); original-workbook CSV/SVG/PDF parity is under [technical download checks](tmp/project-completion/browser/technical-download-checks.json). These records do not claim every G2 criterion.

Comprehensive parser/decompression review and the two-app G2 acceptance packet remain distinct obligations. Main recorded an automated local forecast → reduced-J scenario → inspected evidence → JSON download walkthrough in 20.025 seconds; this is not a real-user timing study or whole G2 closure. See the [timed record](tmp/project-completion/browser/timed-workflow.json). Explorer implementation and read-only collection-map gates are outside this owning repository; no Explorer completion is inferred. G3 hosting, Git/remote operations and portfolio integration are excluded from current work and require separate authorization and real destinations. This remains a local demonstration until delivered URLs pass fresh-browser verification.
