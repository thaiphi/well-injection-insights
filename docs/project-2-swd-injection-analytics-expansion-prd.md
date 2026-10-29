# Project 2 — SWD Injection Analytics
## Expansion PRD and implementation plan

**Project:** SWD Intelligence Lab · Engineering calculations and decision support  
**Repository:** `thaiphi/well-injection-insights`  
**Live site:** https://swdinjectionanalytics.lovable.app  
**Document date:** October 17, 2026  
**Revision:** v1.1 — SPE Volve repository design review incorporated October 17, 2026  
**Status:** Proposed expansion, subject to repository preservation/scope approval  
**Baseline:** `feature-inventory-2026-10-17.md`, `main` at commit `4722d81`; behaviors not browser-verified in that inventory remain unverified.

## Revision notes — external architecture review (v1.1)

**External reference:** [gabrielserrao/spe-2026-challenge](https://github.com/gabrielserrao/spe-2026-challenge), a Volve drilling-intelligence application reviewed on October 17, 2026. It demonstrates bounded multiwell correlation queries, synchronized well/depth/pressure panels, and structured chart/table evidence artifacts. These are **UX and architecture inspirations only**. Its ROP/BHA calculations, drilling domain assumptions, AI pipelines and knowledge graph have not been imported or validated against our SWD engineering models.

**Additions to this PRD:** ANA-E10 Integrated Multiwell Assessment workspace and ANA-E11 Depth & Pressure Context workspace; linked cross-project well selection and reusable typed evidence cards; preservation of pressure extremes and reported/test/model distinctions. The core handoff, fluid/hydraulic model, measured-J prerequisites, transient pressure benchmarks and permit scope gates retain priority.

**Decision:** Keep Project 2's in-browser TypeScript model and preservation gate. Do not replace engineering calculations with generic agent/graph computations or add Neo4j, LangGraph, FastAPI or a new frontend. **Do not copy GPL-3.0 source** from the reference without a separate license review (the reference notes an AGPL-3.0 dependency). Project 3 chatbot remains deferred.

## 1. Product decision

Move from a broad **synthetic and user-supplied SWD engineering workbook** to a **source-aware injection performance and pressure screening workflow** that can consume the enriched, verified evidence from Project 1. Preserve existing forecasting, brine PVT, hydraulic traverse, well profiles, injectivity, capacity/demand comparison, scenario sensitivity, and source-lineage functionality.

Project 2 owns **numerical analysis and technical reports**, not web scraping, RRC data ingestion from scratch, GIS inventory production, permit filing, or an AI chatbot. Project 1 supplies authoritative-as-retrieved regulatory evidence with coverage caveats; Project 2 makes only calculations justified by available evidence and declared assumptions.

### Primary use case

> As an SWD engineer, I want to evaluate whether changes in injection pressure and rate reflect potential injectivity decline, modeled reservoir-pressure growth, operational configuration, or other hypotheses; compare scenarios; and produce a defensible report showing all measured, public-reported, calculated, assumed and unavailable inputs.

### Success standard

Given eligible source records and declared engineering inputs, the app produces reproducible **diagnostic** results, pressure/rate comparisons, sensitivity ranges, and a source-linked report. It refuses to claim measured reservoir pressure, calibrated J, sustainable capacity, regulatory compliance, or safe injection pressure where required evidence is absent.

## 2. Existing baseline — do not rebuild it

The October 17 feature inventory describes **6 functional areas and 21 workspaces**, with calculations performed in-browser and the original app mounted at `/analytics/index.html`. Source modes include synthetic demo, pinned/imported RRC Explorer data, CSV/XLSX user uploads, and sample cases.

Implemented:

- Production water-history analysis, exponential forecast, holdout reconciliation, schedules and grouped water-demand planning.
- Injector H-10 history with volumes and *reported* average/maximum pressure (basis not established as BHP), initial constant-J injectivity, and capacity-versus-demand simulation.
- Brine PVT (pressure/temperature/NaCl-salinity), uniform/segmented wellbore pressure traverse, gravity/friction profiles, scenarios and J/tubing-ID/availability sweeps.
- Sample case with two TRRC wells and **explicitly synthetic** gaps; inline field-origin labels and seven-step guided tour.
- CSV/XLSX import wizard with user-declared measurement/assumption class; checksum-bound Explorer TAR adoption; readiness cards; source lineage; JSON/CSV/SVG exports and a PDF for the original synthetic workbook.
- **Session-only storage**; no saved cases. The public-data (`P`) source mode is presently **blocked** for the complete capacity assessment. Hosted handoff is unverified and the current origin allowlist is localhost-only.

Evidence: user-provided October 17 feature inventory, particularly §§2–7. This PRD does not claim that a listed future feature is already live.

### Protected engineering rules

1. Reported H-10 pressure is **not** bottomhole pressure or reservoir pressure. A permit surface-pressure maximum is not automatically a BHP or fracture-pressure limit.
2. Missing values are not zeros, and an API number is not a substitute for UIC as the H-10 join key.
3. A value must retain its classification: `TRRC public record`, `calculated`, `derived from TRRC with a stated assumption`, `synthetic`, `raw unverified`, `user supplied/unverified`, or another existing reviewed category.
4. Changes to inputs must invalidate dependent calculations and exports. Availability must not be applied twice. Synthetic cases must never masquerade as calibrated real wells.
5. Preserve the application, Nexus/pyResToolbox carried references, test fixtures, deterministic exhibits, exported methods, and baseline hashes.
6. No real-asset site viability, safe-operating-pressure decision, approved permitted volume, or regulatory filing claim without independently reviewed additional scope, source evidence and validation.

## 3. Boundaries with Projects 1 and 3

| Task | Project 1: RRC Explorer | Project 2: Injection Analytics |
|---|---|---|
| Acquire UIC, H-10, casing, plugging, BHP/SRT, source documents | Owns | Consume verified package only |
| Geospatial well inventory and AOR completeness | Owns | Consume geometry/evidence if needed |
| Record matching, original raw bytes, retrieval proof | Owns | Re-verify incoming hashes and report lineage |
| Brine fluid-property and wellbore pressure traverse | Does not compute | Owns |
| J diagnostics, pressure-rate trends, scenario model | Does not compute | Owns |
| Transient reservoir pressure and multiwell interference | Supplies well histories and coordinates | Owns later modeled estimates |
| RRC MSIP/MDIV worksheet support | Supplies regime, worksheet references, supporting evidence | Calculates only in separately approved, reviewed extension |
| AI/chatbot, permit submission | Not in scope | Not in scope |

**Dependency:** Project 2 should not scrape RRC records or develop a parallel UIC data warehouse to compensate for gaps in Project 1. It may continue to accept explicitly labeled user CSV/XLSX uploads when Project 1 does not provide a field.

## 4. Feature backlog and acceptance criteria

### ANA-E00 — Hosted Explorer handoff and source-mode readiness · P0

**Problem.** The existing one-click handoff allowlist points to local ports; its hosted use is unverified. Full capacity assessment is blocked in source mode `P`.

**Build.**

- Negotiate a **versioned sender/receiver evidence contract** with Project 1. Accept only explicitly allowed hosted/local origins; verify manifest and content hashes, application origin, schema, package size and identity. Require user confirmation before adopting a case.
- Make the user-visible readiness map explain which analytical workflows the received package can support; it must never equate verified public H-10 with complete engineering calibration.
- Enable *data-aware case composition* only for workflows whose required inputs can be satisfied by eligible measured values and/or **conspicuously accepted assumptions**. Keep calibrated/field-validated capabilities blocked until criteria are met.
- Maintain cancel/fallback/replay, changed-session and tampered-package rejection; do not make hosted saving a prerequisite.

**Acceptance:** Local and deployed origins complete a real browser handoff; old compatible TAR remains supported; malicious origin/bad hash/incompatible schema/no receiver acknowledgment fail closed; existing sample/upload/demo behavior is unchanged. An H-10-only case cannot display a calibrated field capacity.

### ANA-E01 — Measurement-aware engineering data model · P0

**Build.** Define a typed and reviewed schema for pressure/rate/test evidence, layered on existing origin labels:

- `well_uic`, source snapshot ID/hash, test ID, date/time, pressure type (`wellhead`, `flowing_bottomhole`, `shut_in_bottomhole`, `reservoir_estimate`, `unknown`), `absolute_psia` versus `gauge_psig`, gauge depth/datum, temperature, fluid density, test method, reported units, confidence/coverage, and original field mapping.
- Rate type (`calendar_day_average`, `operating_day_average`, `test_stabilized_rate`), stock-tank versus reservoir volumes and time alignment.
- Fluid and wellbore input sources; synthetic/assumed/user-supplied labels and versioned calculation settings.
- Data prerequisites for each analysis and reasons for `ready`, `screening_only`, `not_ready`, and `invalid`.

**Acceptance:** Import rejects/marks incompatible units, ambiguous psig/psia, missing depth/datum and unaligned tests. Test data availability by itself does **not** imply measured reservoir pressure or identifiable J. Existing source-classification behavior remains intact.

### ANA-E02 — Injection-performance diagnostics · P0

**Build.** An analysis workflow with well-specific charts and tables:

- Monthly H-10 injected barrels, calendar-day rates, average/maximum **reported** pressure and time coverage; explicit separation of reported maximum from monthly average.
- Trends in rate-versus-pressure and apparent pressure per unit rate as **screening indicators only**; handle shut-ins, reporting changes and days-in-month effects.
- Overlay appropriately matched BHP/step-rate tests when collected, with actual test date, basis, gauge/reference depth, test method and uncertainty; do not join unrelated dates as if simultaneous.
- A candidate-cause interpretation checklist for lower injection performance: reservoir pressure buildup, near-wellbore skin/formation damage, viscosity/density changes, friction/geometry, mechanical restriction, reporting quality, or competing offset injection. Do **not** automatically diagnose damage or integrity failure.

**Acceptance:** Missing reports are not zero; incomplete history creates gap markers; pressure series retain original units and basis; charts do not imply measured BHP when only WHP was reported; every calculated diagnostic has a formula/assumption label.

### ANA-E03 — Diagnostic injectivity index (J) estimation · P0/P1

**Build.** Support J estimation **only when a defensible contemporaneous rate, flowing injection BHP and reservoir-pressure estimate** are available and compatible:

\[
J = \frac{q}{P_{wf}-P_{res}}, \quad P_{wf} > P_{res},\; q>0
\]

- Make the volumetric basis explicit (existing constant-J model uses stock-tank bbl/day; a test reported in reservoir bbl/day needs appropriate conversion when defensible).
- Support test-point selection, pressure datum/psig–psia checks, uncertainty and sensitivity; fit steady pressure-rate data where appropriate, but expose the model assumptions and reject incompatible data.
- Show change in *estimated* injectivity over time only when repeated comparable evidence exists; where only H-10 monthly pressures exist, offer exploratory rate/pressure plots **without a field-calibrated J value**.
- Assess whether field/test operating regimes satisfy assumptions; identify insufficient stabilization/unknown reservoir reference.

**Acceptance:** Unit/inverse conversion reference tests pass; a zero/negative pressure differential is rejected for the stated J equation; single unmatched tests or H-10 alone cannot produce labeled field-calibrated J; no skin factor is uniquely inferred from J without additional reservoir/test information.

### ANA-E04 — WHP/BHP reconciliation and pressure-margin screening · P0/P1

**Build.** Reuse the existing brine PVT and wellbore traverse rather than creating competing physics:

- Explicit pressure relation and sign convention for injection:

\[
P_{bh} = P_{wh} + \Delta P_{hydrostatic} - \Delta P_{friction}
\]

- Show pressure at selected depth(s), fluid pressure/temperature/density assumptions, geometry, roughness, rate and segment calculation. Document friction treatment and actual pressure reference.
- Compare modeled/observed conditions with **documented constraints of the same physical basis**, e.g. wellhead to permitted maximum surface injection pressure when appropriate; do not compare unconverted WHP to fracture stress or a BHP limit.
- Separate **regulatory margin**, **modeled equipment/hydraulic limit**, and **unknown formation/confinement margin**. Missing tests must explicitly block formation-safety claims.
- Carry uncertainty bands or sensitivity to fluid density, salinity, J and geometry where supported.

**Acceptance:** Reference calculations match existing hydraulic/PVT oracles within documented tolerances, pressure datum is consistent, basis mismatches block numeric comparisons, and the UI labels screening results rather than regulatory approval/safe operations.

### ANA-E05 — Injection scenario and monitoring workflow · P1

**Build.** Extend the current demand-versus-capacity case rather than making a separate dashboard:

- Side-by-side rate schedule, expected produced-water demand, availability, facility/well constraints, implied WHP/BHP response, monthly injection allocation, and unmet volume.
- User-selected operating assumptions, historical-vs-forecast view and uncertainty scenarios; ability to compare a base case to a changed J/geometry/fluid availability case.
- Optional *engineering diagnostic narrative* generated from deterministic business rules, not an LLM; always cite inputs and equations.

**Acceptance:** Cases rerun deterministically; availability applied once; edits invalidate exports; synthetic scenarios retain labels; no future field capacity is presented as proven.

### ANA-E06 — Transient single-well pressure buildup · P1, **requires explicit model-scope approval**

**Build.** Introduce a separate validated transient-screening model, not a silent change to the constant-J engine:

- Required rock/fluid properties: thickness, permeability, porosity, total compressibility, viscosity, formation volume factor, initial pressure, injected-rate history and selected boundaries.
- Document governing radial-flow assumptions and injection sign convention. Support bounded rate steps with superposition where mathematically appropriate; early-time wellbore storage/skin/partial penetration etc. must be excluded or explicitly modeled.
- Provide pressure at selected radius/time, pressure at injector datum, pressure buildup trends, sensitivity and pressure-boundary warnings.
- Use closed-form reference problems and independent numerical checks. Clearly label **synthetic/assumed** inputs and uncertainty.

**Acceptance:** Verified analytical benchmark cases and unit tests, convergence/monotonicity sanity checks where applicable, sign/units checks, invalid parameter guards, baseline/predicted pressure separation, and no real-well calibration claims without reviewed field evidence.

### ANA-E07 — Multiwell interference screening · P1/P2

**Build.** Consume bounded nearby UIC histories and coordinate/interval evidence from Project 1, including incomplete coverage indicators:

- Support pressure superposition under clearly stated shared-reservoir, homogeneity, geometry, boundary and viscosity assumptions.
- Distinguish **spatial closeness** from **hydraulic connectivity**. Differences in injection interval, stratigraphy, sealing faults, and unknown permeability are material caveats.
- Surface each contributing well's assumed/observed history, offsets, distance, time window and injection volume; highlight missing rate histories and uncertain completion overlap.
- Provide alternate connected/disconnected scenarios rather than silently treating all nearby wells as pressure-connected.

**Acceptance:** Benchmark independent point-source tests; missing well histories yield incomplete-case status rather than zero contribution; uncertainties and alternate scenario assumptions appear in exports.

### ANA-E08 — Permian MSIP/MDIV workbook support · P1/P2, **requires explicit regulatory scope authorization**

**Build.** This is a new, owner-approved extension; the existing product specification expressly excludes permitting.

- Take the **official RRC Permian Basin Disposal Well Review workbook** as the reviewed template (current RRC webpage describes V1.3, sheets `Well Template`, `AOR Template`, `MSIP & MDIV`). Do not invent a substitute formula or claim statewide applicability.
- Project 1 supplies ½-mile/2-mile AOR evidence, isolation/plugging concerns, actual source references and jurisdiction; Project 2 supplies only source-backed, reviewed calculations and scenario comparisons.
- Track required geomechanical inputs, pore pressure, fluid density, depth/stress references, reference pages and unsupported values. **Do not estimate missing values merely to fill a cell**.
- Review official current workbook formulas/validation against known references with a qualified engineer before reproducing calculations; handle the qualifying unknown/orphaned-well penalty as the official methodology directs (not a guessed generic subtraction from measured WHP).
- Export **draft workbook-support tables and source index** only after implementation review; explicitly label them *engineer review required / not a permit submission*.

**Acceptance:** Jurisdiction-restricted controls, traceable source pages, workbook cell mapping with independently reviewed numerical gold cases, clear missing-value blockers, regulatory-version pin and no auto-filing or permit approval status.

### ANA-E09 — Saved cases and richer technical reports · P2

**Build.** Add explicit case save/load/revision/compare and expanded PDF reports for capacity, pressure and sweeps. Prefer browser-local save first if policy allows; a Supabase account/schema/security design requires separate approval.

- Case identity, dated scenario inputs, source exhibit hash, calculation version, assumptions, coverage, user edits, and comparison parents.
- Reopen only after digest/schema verification; user cannot retroactively make an unverified import into a public source.
- Expand PDF output beyond the original synthetic workbook; the PDF must render from the same validated exhibit rather than recalculating model results.

**Acceptance:** Save/restore changes do not alter original pinned data; deterministic JSON/export parity preserved; edited inputs invalidate old outputs; failed integrity never opens an apparently valid case.

### ANA-E10 — Integrated Multiwell Pressure & Injection Assessment · P1

**Purpose.** Build on existing scenarios, pressure profiles, injection history and sensitivity tools to offer one connected **multiwell analysis workspace** inspired by the Volve project's selection-and-correlation interaction, *not* its drilling calculations.

**Build.**

- Select a **bounded explicit group** of verified UIC/wellbore identities supplied by Project 1; keep case ID, source artifact/version, location/depth roles, time range and coverage for each well. Keep the existing public-data eligibility gates: H-10 by itself must not unlock a calibrated or complete capacity case.
- Use coordinated panels for **well selection/map reference**, H-10 rate/pressure trends, test markers, field-calibrated versus assumed J, per-well source/quality status, and modeled pressure/interference scenarios only when their individual prerequisites are satisfied.
- Map and correlation highlights should follow an explicit stable well ID/record key, never fragile display-name matching. Do not duplicate a GIS AOR engine in Project 2; consume the Project 1 distance/geometry/evidence object when available.
- Extend the existing capacity/scenarios workflow with multiwell case adapters, **not** a parallel physics engine or replacement dashboard. Allow a selected well to focus the existing PVT/traverse/calculation details. All comparison tables and artifacts carry source class, unit, pressure basis, date window, model version and missing-coverage status.

**Acceptance:** A two-well case can open and compare eligible historical observations without fabricating pressure-model outputs. Switching wells updates every panel or explicitly marks its missing dataset; unexpected source changes invalidate dependent results and exports. The second well's missing H-10 or test records show `incomplete/not_ready`, not zero. Handoff to/from Project 1 remains hash-verified and user-confirmed.

### ANA-E11 — Depth-aligned geology, wellbore and pressure context · P1, source-dependent

**Purpose.** Adapt synchronized depth tracks (wellbores, casings, formation markers, injection zones and pressure-test points) as a **review aid** next to the already implemented surface-to-bottomhole hydraulic models.

**Build.**

- Read only reviewed, source-attested depth evidence from Project 1's casing, bottom-location, approved log/pick, completion/interval and test records, or suitably labelled user inputs. Support a bounded set of wells and a clearly declared MD/TVD depth basis, units and datum.
- Overlay Project 2's **modeled** hydraulic pressure-vs-depth curve separately from **measured test points**. Do not show monthly H-10 reported pressure as a continuous downhole pressure log, and do not re-label step-rate data as a fracture-gradient log without a justified derivation.
- Unknown formation bottoms stay unknown; a picked top is a point until the true bottom comes from a verified record. Do not infer formation correlations across offset wells from geography alone. A missing deviation survey must block unsupported MD/TVD conversion or alignment.
- Show consistent highlighted depth/rate/pressure references across selected wells and permit a user to inspect exact input evidence, assumptions, numerical method and original source. Preserve extrema and breakpoint markers when rendering downsampled curves.

**Acceptance:** For two independently sourced wells, known casing depths, injection intervals and pressure-test points appear on a consistent declared depth scale; absent or incompatible depth data show gaps and reasons. Modeled curves and public test observations are visually and semantically distinct; exported JSON/CSV/SVG retains full-resolution data, original units, calculation versions and source references. No diagram is represented as a verified field-calibrated correlation or regulatory geologic cross-section.

## 5. Data contracts and calculation prerequisites

### Import classes

**Project 1 evidence:** verified, immutable, public *as retrieved*; it is not automatically site-calibrated or regulator-certified.  
**User measurements:** claimed measured, *unverified until specifically audited*.  
**Assumptions:** transparent hypothetical parameters and bounds.  
**Calculated:** derived values with method, units, time basis and parameter provenance.  
**Unavailable:** explicit missing inputs; never coerced to zero.

### Suggested analysis readiness matrix

| Analysis | Required evidence | If absent |
|---|---|---|
| H-10 trends | Valid public or verified user time series, source dates, rate/pressure basis | No trend, explain missing coverage |
| WHP/BHP model | Geometry, fluid inputs, rate, wellhead datum, assumptions | Block result; can show input checklist |
| Field J estimate | Comparable rate, flowing BHP and reservoir pressure with common datum | Block calibrated J; offer uncalibrated plots |
| Constant-J scenario | Explicit J and reservoir/reference pressure; declare synthetic/assumed or calibrated | Only screening if assumptions used |
| Transient pressure | Rock/fluid properties, injection schedule, boundary assumption, initial pressure | Not ready, no silent defaults in real-data mode |
| Multiwell interference | Offset rate histories, location/interval evidence, connectivity assumptions | Incomplete case, no implicit zero contribution |
| Integrated multiwell panels | Versioned stable well IDs, comparable time/pressure/rate bases and source coverage | Show accessible history/evidence only; block ineligible model panel |
| Depth/pressure context | Actual wellbore MD/TVD evidence, casing/interval depths and test datum, or explicitly labeled user inputs | Unknown tracks/gaps; no silent MD/TVD conversion or fabricated formation interval |
| MSIP/MDIV worksheet | Applicable regime; complete reviewed source/stress/pore-pressure/AOR inputs | Source-gap checklist; no derived permit result |

### Example conceptual exhibit contract (to be designed/versioned)

```json
{
  "schemaVersion": "swd-analysis-case/2",
  "sourceEvidence": {"artifactId": "<actual verified ID>", "manifestSha256": "<digest>"},
  "wellSelection": {"selectedUicIds": ["<verified UIC>"]},
  "depthContext": {"basis": "TVD_or_MD", "reference": "<datum or unknown>", "sourceRef": "<verified or null>"},
  "wellIdentity": {"uic": "<nine-digit string>", "wellboreCrosswalk": "<verified reference or null>"},
  "inputClasses": ["public_reported", "measured_unverified", "assumed", "calculated", "unavailable"],
  "analysisReadiness": {"status": "screening_only", "missing": ["reservoir_pressure_test"]},
  "calculation": {"methodVersion": "<reviewed version>", "pressureDatum": "<declared datum>"},
  "limitations": ["Not a field-calibrated or permitting determination"]
}
```

Placeholders are not actual values or committed interface names. A final schema requires version negotiation and preservation review; current exports remain valid.

## 6. Technical architecture and engineering validation

- **No second ingestion pipeline:** use the existing Explorer package receiver, `importProfile.ts`/`importValidation.ts`, and existing source lineage. Apply a versioned adapter for new Project 1 evidence.
- **No duplicate physics:** extend reviewed `engineering.ts`, `disposalCase.ts`, `wellboreTraverse.ts`, `brinePvt.ts` and PVT reference code where suitable. Isolate new transient/multiwell computation in distinct versioned modules; do not overwrite frozen cases.
- **Calculation performance:** browser-side work is the current architecture; compute potentially expensive sweeps/transient grids in a Web Worker, enforce bounded inputs and cancellation, record model version and parameter domain.
- **Linked views:** use the existing workspace/navigation state and versioned evidence-package identifiers to synchronize well selection across pressure/volume charts, depth tracks, assumption panels and report exports. Reuse current graph/chart helpers instead of replacing the 21-workspace application.
- **Data preservation in plots:** any visualization downsampling must preserve injection/pressure extrema, step-rate breakpoints, shut-in events and regulatory reference levels, with full-resolution source values available for inspection/export. Never interpolate missing source values as observations.
- **Pressure semantics:** carry absolute/gauge basis, fluid density, wellhead/gauge/bottomhole depth, measured vs modeled status and rate volume basis. Never fit on non-contemporaneous H-10 maxima and monthly averages as though they are stabilized test points.
- **Sensitivity and confidence:** differentiate numerical sensitivity to assumed parameters from statistical confidence derived from actual observations.
- **Tests:** preexisting gates are **435 nested Node tests**, **248 carried numerical oracle comparisons**, and **69 root transfer/preservation tests** as described in the October 17 inventory; re-run the exact repository-prescribed commands at each change (counts may evolve). Include new independent reference checks and scenario snapshots.

### Required preservation/release process

The repo has a **182-file transfer preservation gate** (`node scripts/verify-preservation.mjs .`). Protected changes require a plan, before-archives, independent review, owner acceptance and a chained baseline. The original engineering app cannot be regenerated from the Lovable placeholder. Edit the nested sources, not generated `public/`. Current site publication is separately controlled by the owner; **merge, push and publication each require explicit owner authorization**.

Supabase integration is currently a read-only health check. Use the existing Portfolio Supabase only if a new, explicitly reviewed database access model is authorized; do not switch to Lovable Cloud or add exposed privileged keys.

## 7. Phased roadmap: dependencies on Project 1

| Phase | Project 2 deliverable | Project 1 dependency | Release gate |
|---|---|---|---|
| 0 — interoperability | Hosted evidence handoff, source-mode compatibility and truthful readiness | Verified published Explorer + agreed v1/v2 contract | Real receiver/sender browser acceptance |
| 1 — evidence-aware analysis | Test/pressure schema; pressure and injection-rate diagnostics; qualified J workflow | Source-linked H-10 + BHP/SRT data or labeled user uploads | No unearned measured/calibrated labels |
| 2 — pressure interpretation | WHP/BHP reconciliation, permit-vs-physics margin screening and expanded scenarios | Permit/geometry/test evidence and declared inputs | Independent hydraulic reference tests |
| 3 — advanced pressure modeling | Transient single-well model; bounded multiwell interference; integrated multiwell assessment and conditional depth-context views | Offset histories, approved coordinates/intervals, source-linked depth/test evidence | Approved model spec, benchmarks, source/display parity |
| 4 — regulatory calculations | Optional Permian workbook support, separate authorization | Validated AOR, sources and regulatory methodology | Independent qualified-engineer review |
| 5 — usability and persistence | Saved cases, scenario comparison, PDF reports, linked source/evidence cards | Stable contracts/versioning | Security and preservation review |

**Recommended first release (practical minimum):** phases 0–2, excluding any regulatory permission to calculate a filing-ready limit. This already demonstrates direct value using existing PVT/hydraulics without overclaiming reservoir calibration.

## 8. Acceptance scenarios (must pass)

1. **RRC-only H-10:** App displays sourced volume/pressure history, but **does not** compute labeled measured reservoir pressure, calibrated J, or sustainable disposal capacity.
2. **Public H-10 + assumed PVT/geometry/J:** Scenario is allowed only as **screening with transparent assumed inputs**, and all exports repeat the limitation.
3. **Qualified test case:** A matched pressure/rate/reservoir datum supports J with checked `psig↔psia` and surface/reservoir volume basis; sensitivity and test provenance appear in the output.
4. **Conflicting pressure references:** Explicitly block comparison until a consistent datum is provided.
5. **Well switch or source edit:** Dependent calculations and prior exports invalidate immediately; no stale result remains downloadable.
6. **Two offset wells, missing one history:** Multiwell pressure screen reports incomplete coverage, never zero contribution for the absent well.
7. **Tampered Explorer TAR or unsupported schema:** Receiver rejects and preserves previously active case.
8. **Known analytical model benchmarks:** Transient/pressure solutions match independent reference calculations; unrealistic parameter ranges are rejected or clearly labelled.
9. **Permian workbook data gap:** Output is an unresolved-input and source checklist, **not** invented MSIP/MDIV figures.
10. **Baseline regression:** Existing synthetic demo, sample tour, imported-file workflow, current exports, transferred source hashes and numerical references still pass.
11. **Linked multiwell selection:** Change well in one panel; charts, source identities, units, table and corresponding export remain synchronized. Where a selected well has no valid measurement, the associated analysis is disabled with a reason.
12. **Depth correlation without evidence:** A top-only formation pick, missing survey, or pressure point with unknown gauge depth never generates a fabricated interval, model calibration or continuous downhole series.
13. **Plot fidelity:** For a full-resolution series with an isolated pressure maximum, step-rate discontinuity and one missing month, rendering optimization retains the extreme/event and gap. Exports never replace original values with downsampled chart points.

## 9. Non-goals and deferred ideas

Not part of the first expansion: LLM chatbot/RAG, autonomous permit filing, remote operational control, live SCADA, full CMG-class compositional simulation, reservoir property inversion from underdetermined observations, pressure-front maps presented as validated hydraulic connectivity, seismic hazard certification, or guaranteed well capacity. Curve-library CRUD, broad DCA/cohort fitting and elaborate UI redesign should follow the engineering/source integrity work, not displace it.

## 10. Official and project reference links (verified October 17, 2026)

1. RRC UIC sources and test datasets: https://www.rrc.texas.gov/oil-and-gas/applications-and-permits/injection-storage-permits/resources/
2. Permian Basin Disposal Well Review, RRC V1.3 workbook description: https://www.rrc.texas.gov/oil-and-gas/applications-and-permits/injection-storage-permits/oil-and-gas-waste-disposal/injection-disposal-permit-procedures/pb-disposal-review/
3. General RRC injection/disposal permit procedures: https://rrc.texas.gov/oil-and-gas/applications-and-permits/injection-storage-permits/oil-and-gas-waste-disposal/injection-disposal-permit-procedures/
4. Existing repository: https://github.com/thaiphi/well-injection-insights
5. User-provided baseline: `feature-inventory-2026-10-17.md` (source sweep at `4722d81`, not equivalent to full current browser acceptance).

### External implementation patterns (not copied)

- [Volve multiwell correlation API](https://github.com/gabrielserrao/spe-2026-challenge/blob/main/src/volve/api/routes/correlation.py) and [pressure context endpoint](https://github.com/gabrielserrao/spe-2026-challenge/blob/main/src/volve/api/routes/pressure.py).
- [Correlation canvas](https://github.com/gabrielserrao/spe-2026-challenge/blob/main/ui/components/correlation/CorrelationCanvas.tsx), [casing track](https://github.com/gabrielserrao/spe-2026-challenge/blob/main/ui/components/correlation/tracks/CasingTrack.tsx) and [source license](https://github.com/gabrielserrao/spe-2026-challenge/blob/main/LICENSE).

**These are external software design references, not evidence that any SWD analytics capability exists or is field-validated. Source code copying requires license review and explicit authorization.**

**Current `AGENTS.md`, preservation specifications and owner-approved engineering scope always take precedence over this proposed PRD.**
