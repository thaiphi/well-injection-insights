# PRD 01 — SWD Forecasting, Injection Analytics and Capacity Scenarios

**Version:** 1.3, sample-backed milestone and user-import requirements, October 9, 2026

**Repository:** swd-injection-analytics (new, separate application)

**Priority:** P0 flagship

**Status:** Bounded local components and dated checks are reusable. Full P0 acceptance is open; new user imports, readiness gates and completion features are NOT STARTED. See the [measurable completion plan](2026-10-09-plan-compliance-completion.md).

**Target:** Small connected engineering demonstration before October 14, 2026

## 1. Engineering purpose

Demonstrate the planning/reservoir workflow: forecast incoming produced water, reconcile forecasts with actuals, inspect disposal performance, compare demand with scenario capacity, and export the supporting technical record. Inputs are reproducible synthetic production histories and schedules, verified public injection records from texas-rrc-explorer, and a separately identified published engineering example.

Private operating data is not a prerequisite for this demonstration. Actual asset capacity and subsurface viability conclusions require evidence and calibration beyond the prototype.

## 2. Input collections

| Collection | Content and identity | Use |
|---|---|---|
| Synthetic planning portfolio | Fictional asset groups, producer start dates, water histories and development schedules; fixed generation seed | Type curves, reconciliation, schedule changes and portfolio demand |
| Public injection observations | Versioned Explorer UIC inventory and parent-linked H-10 monthly volumes/reported pressures | Descriptive history and source inspection |
| Detailed injector scenarios | At least two fictional cases with explicit reservoir pressure, injectivity, pressure constraint and availability; one may use cited study inputs | Injection curves, deterioration/expansion scenarios and capacity planning |

Do not assign synthetic histories or published formation properties to a real RRC API. Synthetic actuals are simulated observations. H-10 barrels/calendar days are calculated calendar-day averages, not measured daily rates. Monthly reported pressures are not BHP, reservoir pressure or controlled injection-test observations.

## 3. P0 demonstration

1. Inspect the small fictional planning portfolio's histories and type curve.
2. Freeze a forecast at a displayed cutoff; compare it with synthetic actuals in a withheld period. Show monthly and cumulative variance.
3. Change one development schedule and inspect grouped incoming water volume. Low/base/high cases are assumptions, not probabilistic percentiles unless an uncertainty model supports those labels.
4. Inspect verified public monthly injection volume and reported-pressure history when the Explorer artifact passes its gate. Keep this separate from fictional detailed injectors.
5. Plot required bottomhole pressure versus injection rate for baseline and reduced injectivity/increased reservoir pressure.
6. Aggregate assumed injector capacity over time, compare with the same portfolio's demand, and identify first deficit period and deficit volume.
7. Change one expansion/availability case; download the scenario tables, charts, formulas, assumptions and sources.

Use one method/example per workflow before adding model choices. Synthetic planning/scenarios proceed while real H-10 integration is unfinished, with that status visible.

## 4. Calculations and evidence boundaries

### Forecast and reconciliation

Select and state the type-curve method. Fit only through the displayed cutoff; preserve a future holdout. Model ramp-up/downtime explicitly. Rate-to-volume conversions use consistent time units and actual calendar day counts. Define variance as actual minus forecast; percent variance is unavailable when forecast is zero. Shifting a new-well start date shifts that well's forecast before asset-group aggregation. Expose any oil-to-water/WOR assumptions if that method is selected.

### Constant-injectivity curve

At a common pressure basis/datum:

\[
J=\frac{q_{inj}}{P_{wf}-P_{res}}, \qquad
P_{wf,scenario}=P_{res,assumed}+\frac{q_{scenario}}{J_{assumed}}
\]

Rate is bbl/day, pressure psi, and J bbl/day/psi. A lower J makes a steeper pressure-versus-rate curve. Reject invalid/missing injectivity and inconsistent datums. Do not substitute monthly H-10 surface pressures for BHP/reservoir pressure.

### Assumed capacity timeline

For an assumed bottomhole pressure constraint and declared J(t) and reservoir pressure:

\[
q_{scenario,max}(t)=\max\left(0,J(t)[P_{limit}(t)-P_{res}(t)]\right)
\]

Apply availability and any independently specified operating ceiling. This is a pressure-constrained scenario, not a calibrated sustainable-capacity forecast. A permitted wellhead-pressure maximum cannot become the bottomhole constraint without a justified conversion. Distinguish regulatory limits, assumed engineering constraints and facility/pump constraints.

Aggregate compatible period volumes, then deficit = max(0, demand minus available capacity). Changes in J, reservoir pressure, downtime and expansion remain stated assumptions unless a separately validated physical model supplies them.

### Optional wellbore hydraulics

Adapt Nexus wellbore/PVT components and the existing MCP injection tools. Expose density, depth/datum, geometry, friction, temperature and pressure basis. Check downward injection hydraulics against explicit reference cases during implementation. Preserve the constant-injectivity scenario if the extended geometry feature is incomplete; this feature fallback does not defer the shared engineering foundation.

## 5. Nexus and pyResToolbox engineering reuse

Owner-confirmed October 9: build on the existing ESP Nexus calculator and its separate Black Oil Tables tab, shared PVT engine and pyResToolbox MCP. Local source inspection found IPR/VLP reference tests and black-oil table tests containing values from recorded MCP calls. The configured local MCP already wraps brine, DCA, sensitivities and water-injection calculations. Its lockfile records pyResToolbox 3.1.4; this is a reuse baseline, not a claim that SWD has installed or tested that version. See [the source map, dependencies and extraction plan](feasibility/2026-10-09-nexus-engineering-reuse.md).

Nexus runs its calculator in TypeScript and uses pyResToolbox/MCP as an engineering reference. Carry that architecture and the relevant reference fixtures into `swd-injection-analytics`; select direct Python/library execution only where the owning application's needs justify it. Reuse pressure sweeps, brine/PVT functions, input validation, charts and technical-export patterns. The [upstream project](https://github.com/mwburgoyne/pyResToolbox) also provides:

- [DCA](https://github.com/mwburgoyne/pyResToolbox/blob/main/pyrestoolbox/docs/dca.rst): decline/type-curve fitting, uptime and secondary WOR forecasting. Select a suitable water model and explicitly normalize rate/time units.
- [Brine](https://github.com/mwburgoyne/pyResToolbox/blob/main/pyrestoolbox/docs/brine.rst): density, viscosity, compressibility and volume factor. These library docs are engineering references, separate from permitting authority.
- [Sensitivity](https://github.com/mwburgoyne/pyResToolbox/blob/main/pyrestoolbox/docs/sensitivity.rst): parameter sweeps/tornado calculations for selected models.
- [Simulation tools](https://github.com/mwburgoyne/pyResToolbox/blob/main/pyrestoolbox/docs/simtools.rst): make_vfpinj water-injection BHP tables, supporting wellbore calculations.

During extraction record the source revision/files, retain attribution and reference fixtures, and pin the versions actually used. Run carried tests and add focused checks for SWD units, injection direction, pressure datum and forecast/capacity integration. This is implementation verification of an established foundation, not a fresh whole-library adoption gate. Do not transfer oil/gas production IPR/Vogel assumptions into SWD models without a justified formulation. Layering, relative permeability, aquifer/transient and hydrocarbon material balance are later extensions.

## 6. Requirements and acceptance

| ID | Requirement | Priority | Focused acceptance |
|---|---|---|---|
| SWD-01 | Reproducible synthetic history/type curve | P0 | Same seed reproduces fixture; fictional identity and units visible |
| SWD-02 | Frozen forecast/reconciliation | P0 | Holdout cannot affect fit; variance sign and calendar volumes independently checked |
| SWD-03 | Schedule change/grouped demand | P0 | Shifted start date moves that well's demand; group sums match individual volumes |
| SWD-04 | Public history consumer | P0 goal, source-gated | Pinned artifact loads; monthly values reconcile to actual source; missingness/provenance visible |
| SWD-05 | Two fictional injector cases/curves | P0 | Pres 2000 psi, J 5 bbl/day/psi, q 5000 bbl/day gives BHP 3000 psi; halving J gives 4000 psi |
| SWD-06 | Capacity timeline/demand comparison | P0 | Assumed BHP limit 3500 psi gives baseline 7500 bbl/day and half-J 3750 bbl/day; deficits use matching period volumes |
| SWD-07 | One expansion/availability case | P0 | Added capacity starts on specified date; zero availability contributes zero |
| SWD-08 | Downloadable technical exhibit | P0 | Tables/charts match UI; export includes units, method, input provenance and scenario label |
| SWD-09 | Reused Nexus/PVT/pyResToolbox foundation | P0 | Extracted source/dependencies recorded; relevant reference fixtures carried; SWD unit and scenario checks pass |
| SWD-10 | Library wellbore hydraulics | P1 | Geometry, pressure basis and hydrostatic/friction direction benchmark pass |
| SWD-11 | Layering/transient/calibrated capacity | P2 | Separate method/evidence/validation plan |
| SWD-12 | Additional sensitivity/model choices | P1 | Selected parameters, units and sweep results agree with the base scenario |
| SWD-13 | User CSV/XLSX import with explicit column/unit mapping and validation | P0, owner-added October 9 | Equivalent CSV/XLSX samples normalize to the same typed rows; mapping is previewed/confirmed; invalid identities, dates, values, units and conflicts are reported without silent coercion |
| SWD-14 | Source provenance and readiness by analysis | P0, owner-added October 9 | Synthetic/public/user origins remain visible through tables and exports; each analysis lists ready/not-ready inputs and reasons; insufficient inputs block only the affected calculation |

Numerical examples are synthetic bottomhole cases, not field or permit observations. Handle zero forecasts, invalid J, missing pressures, pressure limits at/below reservoir pressure and zero availability explicitly.

## 7. Technical record and done

Consume the [versioned Explorer contract](05-architecture-integration.md). Keep scenario inputs separate with fictional IDs, seed/generator version or paper/table citation, units, datum, forecast cutoff, parameters and calculation version. Identify inputs/results as public reported, literature-derived, synthetic, assumed or calculated.

A visitor completes forecast -> capacity scenario -> evidence export in approximately three minutes. Calculations pass independent examples. Public observations appear only after source validation; otherwise the functioning synthetic/study demo marks public injection integration incomplete. Advanced transient simulation, actual location viability ranking, live SCADA, autonomous operating recommendations and calibrated real-asset capacity are later work. Deployment claims require fresh-browser verification.

## 8. User imports and analysis readiness — owner-added core

SWD-13 and SWD-14 are additions; SWD-01 through SWD-12 retain their original scope and priorities. Implementation is **NOT STARTED**. Existing CSV downloads are output exhibits, not a general input importer.

Accept CSV and XLSX files through a preview -> sheet/header selection where needed -> explicit column and unit mapping -> validation -> normalized-input preview workflow. Recommended default: browser-local parsing with no automatic server upload or persistence. Select and review an XLSX parser during implementation; this planning update installs nothing. Never evaluate spreadsheet formulas/macros or fabricate missing cached values. Reject unsupported or ambiguous units rather than infer a pressure basis, rate/volume basis or date convention.

Support two initial input profiles: (1) produced-water history/schedule rows with producer/group identity, reporting month or start date and declared rate/volume/time units; (2) fictional/user-supplied injector scenario inputs with J, reservoir and limiting pressures, each calculation's pressure basis/datum, operating ceiling and availability. A wellbore profile belongs to SWD-10/P1. Display row-level errors, original values and accepted/quarantined/excluded counts; require explicit resolution of conflicting duplicates. Empty, missing and zero remain distinct. Normalize rates to stock-tank bbl/day and period volumes to bbl only when the mapped basis and conversion are supported. Retain original columns/units and transformation decisions.

Record file hash/name, selected sheet/header, mapping version, declared units, original row identity, normalized-input ID/version and dispositions. A user-uploaded file has acquisition origin **user**, with any user assertion of measured/synthetic/public content stored separately; that assertion does not establish verification. A validated pinned Explorer artifact retains **public reported** provenance. Seeded fixture rows retain **synthetic** provenance. Literature-derived and assumed parameters stay separately labeled; **calculated** outputs retain links to their input origins.

Readiness is evaluated for each analysis, not as one global file-valid flag:

| Analysis | Required inputs and passing readiness | If insufficient |
|---|---|---|
| History/type curve | Valid producer/month identity, declared compatible units, usable ordered history; selected fit meets its stated minimum positive distinct observations | Show valid descriptive rows; disable fit and identify the missing/invalid requirement |
| Frozen forecast/reconciliation | Declared cutoff/model; sufficient training through cutoff; independent dated actuals for the selected holdout comparison | Forecast may run with sufficient training; reconciliation stays unavailable where actuals are absent; no leakage or invented actuals |
| Grouped planning | Explicit producer/group mapping, start dates, curve parameters and compatible month volumes | Do not silently assign an unknown group or drop its demand |
| Public injection trends | Validated Explorer/public-observation contract, original identity/period, units and provenance; no-history distinct from zero | Mark public analysis unavailable without blocking the independent synthetic planning case |
| Injection pressure/capacity | Positive J, finite reservoir/limit inputs with compatible pressure basis/datum within each injector; stock-tank rate basis, availability and operating ceiling | Block that injector calculation; do not substitute monthly surface reports for BHP |
| Extended wellbore model | SWD-10/P1 geometry, depth, fluids, temperature and independent injection-direction benchmarks | Keep the supported constant-J case; do not claim extended hydraulics readiness |

Generate representative valid and malformed CSV/XLSX test samples **during implementation**, using seed-417 histories and fictional injector presets. Include equivalent units, zero/missing, conflicting duplicates, unsupported pressure bases, multiple sheets and formula cells without cached values. Real user files are optional for the demonstration; they are needed only to validate that user's actual formats. Measured field inputs/calibration are required for actual field conclusions, which the demonstration does not claim.

## 9. Available sample and reference basis

The authorized [demo-data strategy](feasibility/2026-10-08-demo-data-strategy.md) remains controlling. Current reusable assets are seed-417/v1 (two fictional producers, 48 monthly rows spanning 2025–2026), frozen 2025-12 training cutoff, two fictional constant-J injector presets, Nexus brine/PVT source/reference fixtures, existing exhibit exports, and the pinned Explorer artifact `rrc-2026-10-09-uic000020838-v1` (five inventory records and 28 monthly reports, January 2024–April 2026). The saved 248-comparison reference report is recorded evidence, not a new live MCP run. Existing tests do not complete the new import/readiness or expanded planning requirements.

Jin et al. (2022) paper/table links and parameters are researched inputs; a cited executable study fixture still needs selected-equation/unit verification and implementation. Private operating data is not a dependency for any educational planning/scenario milestone. Every new feature begins **NOT STARTED** in the completion tracker; status changes require criterion-level evidence.
