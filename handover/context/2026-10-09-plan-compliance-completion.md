# Analytics and Explorer Plan-Compliance Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans only after the owner authorizes implementation. Steps use checkbox syntax. This document does not authorize feature work, staging, commits, remote creation, pushing or deployment.

**Goal:** Demonstrate reservoir-engineering and disposal/injection-well analysis skill and knowledge by completing the original Analytics and Explorer requirements with independent repository ownership, inspectable planning inputs, source-traceable exports and verified delivery.

**Deadline:** Deliver the agreed engineering demonstration before October 14, 2026; October 14 is not part of the delivery window.

**Architecture:** Keep `swd-injection-analytics`, `texas-rrc-explorer` and `phi-analytics` as independent sibling Git repositories. Explorer owns official acquisition, normalization and immutable versioned artifacts; Analytics consumes an explicitly pinned artifact and keeps fictional planning/engineering inputs separate from real observations. The existing portfolio owns project narratives and verified application links.

**Tech Stack:** Existing TypeScript/Nexus PVT and black-oil modules, browser ES modules, Node >=24, pinned Analytics TypeScript 5.9.3 and locally bundled pdf-lib 1.17.1; Explorer has no third-party runtime dependency.

**Spec:** [Analytics PRD](01-swd-injection-analytics.md), [Explorer PRD](02-texas-rrc-explorer.md), [Architecture and Integration](05-architecture-integration.md), [Delivery Roadmap](06-delivery-roadmap.md), [Repository setup](2026-10-09-repository-setup.md), [Demo data/study strategy](feasibility/2026-10-08-demo-data-strategy.md), [Nexus reuse](feasibility/2026-10-09-nexus-engineering-reuse.md).

**Prepared:** October 9, 2026; revised after reconciliation of the existing samples/synthetic strategy and owner confirmation of the read-only workflow map. This revision authorizes documentation only.

## Global constraints

- Current request authorizes planning-document revisions only. New app implementation, import sample generation, dependency installation, staging, commits, remotes, pushing and deployment are NOT STARTED/excluded from this request. Existing local components are reusable, not universally complete.
- Preserve SWD-01 through SWD-12 and RRC-01 through RRC-08, their full scope and original priorities. Add SWD-13/SWD-14 (user imports/readiness) and RRC-09/RRC-10 (read-only workflow/run evidence) as owner-added core. The earlier connected-demo minimum does not complete the PRDs.
- Use public reported, literature-derived, synthetic, user-supplied, assumed and calculated labels with input lineage. Private data is not a demo dependency; generate import samples during later implementation from existing seeded/preset assets. Never assign fictional histories or study properties to a real UIC/API.
- Keep actual calendar days, actual-minus-forecast variance and explicit zero/missing distinctions. Percent variance is unavailable when forecast is zero.
- Keep compatible pressure basis/datum; monthly public pressures and permit wellhead maxima cannot become BHP or sustainable capacity.
- Keep source/fixture/artifact IDs, hashes, versions, provenance and old reproducible versions. Preserve Nexus attribution, relevant types/helpers and recorded reference-fixture versions.
- Preserve all existing work in phi-analytics and the sibling apps. Do not rewrite published Lovable history.
- Follow supported direct-Node checks. Do not silently install tools or bypass standing restrictions on npm/npx shims, bare Python or upstream Vitest.
- P1 hydraulics/model choices and P2 layered/transient/calibrated models, GIS expansion and statewide refresh remain on the plan at their original priorities; they are not silently removed.
- Permitting remains a separate application/workstream. This two-app plan does not claim the entire four-repository initiative is complete.
- The workflow map is owner-confirmed READ-ONLY: actual recorded stages/evidence/status/errors/outputs, no editing/rearranging/drag-drop authoring. It does not authorize new Run/Retry/Schedule controls.
- Only criterion-level evidence changes status. No invented percentage complete or guarantee of delivery before October 14; risks and failed gates stay visible. Any scope addition, removal, priority change or acceptance relaxation requires an explicit owner decision recorded against requirement IDs.

## Review focus

1. Pressures used within each injector calculation must have compatible bases/datums; a nonempty datum string alone cannot establish that compatibility. A shared-datum chart/export declaration must match the supported scenario. Distinct per-well datums do not by themselves invalidate a sum of individually valid stock-tank capacities.
2. Training histories, independent actuals, producer/group identities and schedule assumptions must stay inspectable and stable when future scenarios change.
3. Reprocessing a changed source under an existing artifact ID must not overwrite the old version.
4. Filtering, selected-record identity and whole-snapshot downloads must clearly agree about scope; missing histories must never appear as zero injection.
5. Scenario edits during asynchronous export must cancel stale output, including newly added planning input/provenance fields.

---

## 1. Verified repository setup

- [x] Initialize Analytics as an independent LOCAL repository on main.
- [x] Initialize Explorer as an independent LOCAL repository on main.
- [x] Verify each top level and absolute Git directory point to its own sibling folder; each common Git directory is local, with one worktree.
- [x] Verify phi-analytics rejects both sibling paths as outside its repository.
- [x] Leave both new indexes empty, with no commits and no remotes.
- [x] Keep existing phi-analytics HEAD and existing modified/untracked work unchanged by repository initialization.
- [x] Add project-specific dependency, secret and generated-output ignores without hiding required source/provenance assets.

| Repository | Top level | Git directory | Branch | Commit/remote state |
|---|---|---|---|---|
| Analytics | C:/Users/thai.phi/Downloads/python/portfolio/swd-injection-analytics | same folder/.git | main | Unborn; no commits, staged files or remotes |
| Explorer | C:/Users/thai.phi/Downloads/python/portfolio/texas-rrc-explorer | same folder/.git | main | Unborn; no commits, staged files or remotes |
| Portfolio | C:/Users/thai.phi/Downloads/python/portfolio/phi-analytics | same folder/.git | main | Existing repository preserved |

**Ignore decisions:** Both apps ignore dependencies, local environments/credentials/private keys, local Graphify copies, caches and temporary output. Analytics ignores compiled dist and generated exhibits except `exhibits/carried-oracle-coverage.json`. Explorer continues to ignore unreviewed `raw-refresh-*/` scratch directories. There is no blanket CSV, JSON or PDF ignore.

**Assets retained as commit candidates:** Analytics `data/explorer/`, `data/explorer-pin.json`, `reference/`, source/tests, compiler lockfile and PDF vendor/license/provenance; Explorer `raw/`, versioned `artifacts/`, source proof, dictionary, quality reports, source/tests and public assets. They remain UNTRACKED until separately approved staging/committing.

For any future Git operation, specify the exact owning root with `git -C <app-root> ...`. The umbrella portfolio directory remains outside any Git repository. Do not initialize a combined parent repository or link these apps as worktrees.

## 2. Evidence and status interpretation

**Reusable evidence** means an existing component has implementation and dated focused checks for a bounded case; it is an input to the next milestone, not current acceptance of changed features or application delivery. **Partial** identifies implemented and remaining parts. **NOT STARTED** means the newly planned implementation has not begun. **Unverified** means evidence has not established the gate. Earlier “complete” statements below apply only to the explicitly bounded historical criterion; all new task/milestone statuses remain NOT STARTED until verified.

The prior review ran 18 non-writing Analytics calculation/artifact/SVG tests, five non-writing PDF cases, all eight Explorer tests, Analytics no-emit checking and in-memory compilation comparing 32 generated files. These passed before repository setup. They are dated evidence, not a fresh run for future feature changes. The owning verification records contain historical full-suite and browser evidence.

No fresh deployed-browser gate exists. During the review the documented local preview ports 4173 and 4176 returned ECONNREFUSED. A stopped preview is not proof of an application defect. Full upstream Vitest and a fresh live pyResToolbox MCP run remain unverified.

A read-only datum-label probe confirmed that the current planning function accepts different injector datum strings and calculates 10,125 STB/d aggregate availability. Each current Injector has one datum label for its reservoir/limit pair; the probe does not establish incompatible pressure subtraction or an invalid capacity sum. The preset cases share a declared datum. A2 makes per-calculation compatibility and any shared-datum display contract explicit.

### Independent review record

On October 9, Main dispatched the prescribed read-only advisor/reviewer with model `gpt-6-astra`, reasoning effort `high`, a fresh-context brief containing Project, Task class, Brief, Scope, Validation, Report and Return. The supported collaboration tool accepted that exact selection. Only one subagent was active; no feature, mechanical or Graphify worker was needed for this bounded review.

Astra independently confirmed both separate Git roots/common directories/one-worktree states, empty indexes, unborn main branches, absent commits/remotes, retained required assets and representative ignore behavior. Analytics no-emit checking and seven engineering/planning tests passed; seven Explorer normalization/source/hash tests passed. It inspected original requirements and current source manually, without edits, a Graphify run, acquisition, browser/deployment, full upstream suite or fresh live MCP.

Main checked the cited source/requirements and corrected four draft findings: the overstatement of the different-datum-label probe; the distinction between SWD-09 acceptance and extra upstream/MCP coverage; current manual Explorer versioning versus automatic overwrite enforcement; and the conditional relationship of wellbore hydraulics to future transient models. A6 sequencing is also labeled as a preference. These are documentation corrections only; repository setup passes, while full application and delivery completion remain open.
### Confirmed inputs available now

- Public sample: Analytics `data/explorer/` and `data/explorer-pin.json`; Explorer `artifacts/rrc-2026-10-09-uic000020838-v1/`. Five inventory records; 28 parent-matched H-10 rows for one UIC, January 2024–April 2026; raw sources, units/dictionary, QC and hashes retained. Retrieval on October 9 does not extend reporting coverage beyond April.
- Synthetic planning: `src/planning.ts`, seed-417/v1, two fictional producers × 24 months (48 rows), fixed cutoff 2025-12, frozen fit/independent holdout, one start/expansion scenario. Extend this basis; do not wait for private histories.
- Fictional engineering: `src/engineering.ts` two constant-J injectors and Nexus brine/PVT modules. Reuse 3000/4000 psia and 7500/3750 STB/d anchors; these are assumed educational cases, not calibrated field conclusions.
- References/exports: attributed local Nexus main `de631ad2`, carried fixtures and saved 248-comparison report (zero recorded failures, no live MCP call), CSV/JSON/SVG/PDF exports. New inputs/features still need fresh focused checks.
- Literature: researched Jin et al. Appendix A Table A1 parameters/links; an executable cited fixture still needs equation/unit validation. Optional regional datasets are researched links, not acquired calibration data.
- Import test files do not exist as a general importer suite. A0 will generate valid/malformed CSV/XLSX samples from the existing synthetic histories/presets during implementation. Real user files are optional format-validation inputs; measured inputs/calibration are required only for actual field conclusions.

## 3. Analytics requirement-by-requirement plan

Authoritative sections: Analytics PRD §3 P0 workflow, §4 calculations, §6 acceptance table, §7 done; shared contract §3.

| ID / original priority | Current status and exact gap | Completion acceptance | Task / dependency |
|---|---|---|---|
| SWD-01 / P0 | Partial. Fixed seed reproduces two producer histories; underlying training histories and individual/type-curve inspection are absent from the UI. | Inspect 2025 histories, individual curves and fictional IDs/units; regenerate identical fixture from declared seed/version. | A1, then A3 |
| SWD-02 / P0 | Focused holdout/calendar/sign gate complete. UI supplies monthly percent variance and annual cumulative total; broader inspectable reconciliation remains partial. | Show monthly absolute/percent and cumulative variance alongside training/holdout; changing future actuals cannot change fitted parameters; forecast zero yields unavailable percent. | A1/A3; retain existing tests |
| SWD-03 / P0 | Partial. One new-producer start shifts aggregate demand. Producer/cohort/group metadata and individual/group breakdowns are absent. | Shift only the selected producer's demand; group and portfolio volumes equal individual sums; frozen original forecast/actuals stay unchanged. | A1 -> A3 |
| SWD-04 / P0 source-gated | Complete for the current pinned artifact: 28 months for one UIC, source hashes/identities and public labels retained. | Revalidate pin and source values after A1/A4/E1; missing/failed pin leaves fictional workflow usable and clearly labels public evidence unavailable. | E1/E2 -> A4/G2 |
| SWD-05 / P0 | Preset curves and numeric examples pass; explicit per-pressure basis/datum validation and truthful scenario declarations remain completion work. The different-label probe does not prove invalid subtraction. | Pres=2000, J=5, q=5000 -> BHP=3000; half J -> 4000; reject nonpositive J, missing pressures and incompatible bases/datums within an injector calculation. Enforce the supported shared-datum display contract where selected. | A2 |
| SWD-06 / P0 | Complete for preset arithmetic. A2 will make each pressure calculation and its chart/export declaration explicit; different valid per-well datums do not alone invalidate aggregation. | J=5 and limit=3500 -> 7500; half J -> 3750; limit<=Pres -> zero; matching month volumes, first deficit and deficit total agree. | A2 then A3/A4 |
| SWD-07 / P0 | Complete for one expansion/availability case. | Zero availability -> zero base contribution; expansion starts exactly in the selected month; available expansion is not multiplied twice. | Retain tests; G2 |
| SWD-08 / P0 | Partial. CSV/JSON/SVG/PDF reflect current calculated outputs. Raw planning input tables, separate actuals identity and full fixture contract are absent. | Exports retain input tables, IDs/hashes/versions, selected controls, date range, formulas/units, source evidence and exact displayed outputs; stale preparation is cancelled. | A1/A3 -> A4 |
| SWD-09 / P0 | Bounded reuse evidence supported: selected source/dependency provenance, carried relevant oracles and focused numerical/scenario checks exist. A5 revalidates specific SWD integration changes. Full upstream/live-MCP runs are unperformed coverage, not unmet P0 prerequisites. | Source/dependency/fixture versions verified; carried applicable oracles run through supported checks; explicit SWD unit/datum/calendar/scenario checks pass; exclusions remain visible. | A2/A4 -> A5 |
| SWD-10 / P1 | Missing extended injection wellbore hydraulics; no surface/friction model. | Declared depth/datum/geometry/fluid basis; downward hydrostatic/friction benchmarks pass before surface-to-BHP or geometry claims. | P1-A; depends A2/A5 |
| SWD-11 / P2 | Missing layering/transient/calibrated capacity. | Separate original-scope method, input/evidence and validation plan; independent benchmarks; calibration claims require actual support. | P2-A; owner-approved evidence/model design; P1-A only when the chosen model requires wellbore coupling |
| SWD-12 / P1 | Partial: base/half-J choice exists; general additional sensitivity/model choices are missing. | Selected parameter values/units and sweep results agree with the base case and exact exports; preserve one-method default. | P1-B; depends A2/A4 |
| SWD-13 / owner-added P0 | NOT STARTED: CSV/XLSX upload, column/unit mapping and row-validation interface. | Equivalent generated CSV/XLSX cases normalize identically; mapping/units previewed; conflicts/invalids reported without silent coercion. | A0 -> A1/A4 |
| SWD-14 / owner-added P0 | NOT STARTED: user-origin lineage and per-analysis readiness. Existing synthetic/public labels are reusable. | File/row/mapping provenance reaches outputs; each analysis declares ready/not-ready and actionable reasons; unsupported pressure/rate bases block affected calculations. | A0/A2 -> A3/A4 |

Additional PRD obligations:
- §1 and the demo-data strategy require a separately identified published engineering example. Current injector inputs are assumed; no cited study case is implemented. A6 retains this planned work. The October 9 fictional-case minimum did not complete this broader obligation.
- §4 calls for explicit ramp-up/downtime treatment. Injector availability is implemented; producer ramp/downtime is not represented. A1 addresses this.
- Shared §3 requires producer/cohort/group IDs, generator/actuals IDs and versions. A1/A4 address the missing metadata.
- A3 records a timed approximately three-minute forecast -> capacity -> evidence workflow; G2 supplies the fresh browser gate.

## 4. Explorer requirement-by-requirement plan

Authoritative sections: Explorer PRD §3 workflow, §4 identity/transformations, §5 versioning, §6 requirement table, §7 done; shared contract §2.

| ID / original priority | Current status and exact gap | Completion acceptance | Task / dependency |
|---|---|---|---|
| RRC-01 / P0 | Complete bounded snapshot proof. Script acquires five inventory candidates and one fixed UIC history; no fresh acquisition was run in the audit. | Document and reproduce the selected official query; raw bytes/URLs/retrieval metadata resolve to normalized inventory. Use a NEW snapshot directory. | E1; live run only when authorized |
| RRC-02 / P0 source gate | Complete pinned proof: UIC 000020838, 28 months with original identifiers and independently documented anchors. | Source-parent/monthly values reconcile; no synthetic substitution; current revision/annulus limitations stay explicit. | Retain E1/G2 evidence |
| RRC-03 / P0 | Complete covered normalization behavior; source lacks a complete original-document revision ledger. | Preserve leading zeros/all conflicting rows; duplicate/revised/ambiguous/unmatched cases have mutually exclusive dispositions and no silent preference. | E1 validation plus existing normalize tests |
| RRC-04 / P0 | Complete dictionary/quality record for current schema. | Raw = accepted + quarantined + excluded; issue counts may overlap; missing, zero, parse failures and units remain distinct. | E1/E2 |
| RRC-05 / P0 | Current pinned export verified. Refresh uses a documented manual new-version procedure; automatic immutability enforcement is absent. The fixed exporter can overwrite if that procedure is violated, but no overwritten artifact was observed. | Preserve source snapshot identity and old reproducible versions; Analytics pins/copies/verifies a new artifact independently. E1 proposes automatic refusal of conflicting writes as reliability hardening. | E1 -> A4/G2 |
| RRC-06 / P0 | Search/select/details and monthly table implemented; full inventory-table presentation and fresh complete browser acceptance remain partial/unverified. | Inspect inventory columns and QC; county/operator filtering where supported; selected identity/history consistent; downloads clearly contain the complete pinned snapshot, independent of filters. | E2 -> G2 |
| RRC-07 / P1 optional | Missing GIS/map. Original plan marks it optional for core delivery, but it remains planned. | Source CRS, coordinates, surface/bottom role and reliability validated; missing coordinates retained in tables; no inferred SWD/current status. | P1-E; depends E1/E2 |
| RRC-08 / P2 | Missing scheduled refresh/statewide expansion. | Reviewed access limits, pagination/completeness, version differences and expanded QC; preserve bounded first slice and old artifacts. | P2-E; depends E1/G2 |
| RRC-09 / owner-added P0 | NOT STARTED: read-only collection node map. Scope is CONFIRMED, not a pending designer decision. | Actual fixed stages and selected-run details; no editing/rearranging/drag-drop or execution controls. | E3 -> G2 |
| RRC-10 / owner-added P0 | NOT STARTED: instrumented run/stage events and viewable status/errors/lineage. Existing manifests are reusable evidence only. | Real replay/failure events drive states; historical absent events remain unrecorded; counts/hashes/errors trace to execution; consumer handoff is evidenced separately. | E3 -> G2 |

A full revision ledger and annulus acquisition cannot be invented from the current ODP schema. Record source limitations rather than mark unavailable fields as implemented. GIS/statewide coverage are not prerequisites for the P0 one-history gate.

## 5. Shared requirements and dependencies

| Requirement / plan reference | Current status | Completion / owner |
|---|---|---|
| Separate owning repositories, architecture §1 | Complete LOCAL setup only. Remotes/first commits remain excluded from current authorization. | G1 verifies boundaries; later owner-approved Git work stays per repo. |
| Product spec, agent instructions, glossary, decisions, ticket convention, setup table | Partial. Analytics has AGENTS and design/decision records; Explorer has SPEC/DESIGN/source-proof records and its own AGENTS workflow entrypoint; neither has a completed glossary/requirement evidence tracker. | D1 adds useful owning-app docs with explicit PRD mappings; do not create empty placeholders. |
| Pinned file contract and independent runtimes, architecture §2 | Current pin implemented. Immutable refresh enforcement partial; independence historically tested. | E1 -> A4 -> G2; no required shared database/live service. |
| Planning/study/exhibit contract, architecture §3 | Partial; IDs/input tables and cited case missing as above. | A1/A4/A6. |
| Portfolio metadata and separate app/return URLs, architecture §5 | Missing delivery. Portfolio has modal previews, no demo URLs/return destinations; statuses are dated. | G3 after working deployments and owner-supplied destinations. |
| Fresh-browser/source/export/return gate, architecture §6 and roadmap Delivery | Unverified for deployed apps; historical local/browser export evidence exists. | G2/G3; label fallback accurately if a gate fails. |
| Requirements/checklist status reconciliation, roadmap §6 | This revision identifies reusable bounded evidence and NOT STARTED additions; full acceptance remains open. | D1/G2 record criterion-level outcomes without declaring unpassed gates complete. |

No database, live cross-service API, Python runtime rewrite, new LLM platform or statewide collection is added by this completion plan. Course examples remain workflow references; CI/container/persistence choices require a separate agreed service/delivery design when those are actually selected.

## 6. Execution tasks for later authorization

All paths below are relative to the named owning repository. **Every new/completion task D1, A0–A6, E1–E3, G2 and G3 is NOT STARTED by this revision.** Existing functions/files/tests are reusable inputs. Exact helper/interface names are proposed implementation decisions, not work performed by this plan. Each task produces its stated acceptance evidence; a passing existing suite alone does not close it.

### D1: Owning-app specification and evidence tracker

**Files:** Analytics `product-spec.md`, `GLOSSARY.md`, `docs/adr/001-existing-runtime-and-pin.md`, `docs/agents/issue-tracker.md`; Explorer equivalents, retaining its existing `AGENTS.md`. Reuse Analytics decisions and Explorer SPEC/source proof rather than discard them.

**Consumes/produces:** The original PRDs and this matrix -> one tracker declaring requirement ID, owner, task dependency, acceptance command, evidence path and outcome.

- [ ] Record each P0/P1/P2 item and its current implemented/missing/unverified parts.
- [ ] Document units, datum, fixture/version terms and selected runtime; add scoped Explorer agent rules.
- [ ] Check every matrix ID resolves to an owning task/evidence location. Keep initial statuses truthful.
**Dependency:** G1 LOCAL setup complete; no feature dependency.

### A0: User imports, mapping, validation and readiness

**Owner/requirements:** Analytics; SWD-13/SWD-14, preserving SWD-01–SWD-09 input/evidence boundaries. **Status: NOT STARTED.**

**Files:** Create `src/importProfile.ts`, `src/importValidation.ts`, `src/analysisReadiness.ts`, browser import adapter `web/import.mjs`, `tests/import.test.mjs`, `tests/readiness.test.mjs` and `tests/fixtures/import/`; modify `web/index.html`, `web/app.mjs` and the owning dependency/license record only when implementation is authorized. Parser choice is a later reviewed dependency decision, not an installed tool.

**Interfaces:** ImportProfile declares target analysis/profile, sheet/header, column mappings, original units/bases and version. ImportResult retains original rows/columns, normalized typed rows, file hash/name, mapping/input ID/version, acquisition origin, asserted content kind, row dispositions and structured validation issues. AnalysisReadiness returns analysis ID, ready/not-ready, required inputs and actionable reasons. It does not mark an uploaded claim verified.

- [ ] Generate equivalent valid CSV/XLSX history and injector samples from seed-417/presets; include malformed identity/date/value/unit cases, duplicate conflicts, zeros/blanks, multiple sheets and uncached formula cells. This generation is implementation work, not a prerequisite user delivery.
- [ ] Preview/confirm mappings and declared units; retain raw values. Apply documented supported conversions only; never infer a surface/bottomhole basis or silently coerce conflicting rows. Counts must reconcile.
- [ ] Parse XLSX without evaluating formulas/macros. A formula without a usable cached value is unavailable/invalid, never guessed. Enforce explicit file/row limits selected and documented during parser review.
- [ ] Keep uploads local by recommended default; no automatic server upload/persistence. Retain synthetic/public/user acquisition origins plus separate measured/synthetic assertions, literature/assumed parameter origins and calculated lineage.
- [ ] Pin equivalent-format/units tests and per-analysis readiness tests from PRD §8: valid histories can be inspected when a fit lacks sufficient points; absent holdout actuals block reconciliation only; missing public evidence leaves synthetic planning usable; unsupported injector pressure basis blocks its capacity calculation.
- [ ] Inspect browser mapping/error/readiness flows and exported lineage; retain generated fixtures, focused test output and screenshots in the owning verification record.
**Depends:** D1 and existing sample/schema/preset assets. A1 consumes normalized planning rows; A2 validates injector inputs. No private-user file dependency.

### A1: Inspectable planning fixture, groups and schedule inputs

**Files:** Modify `src/planning.ts`, `web/app.mjs`, `web/index.html`; extend `tests/planning.test.mjs`. Create `src/planningFixture.ts` for input metadata/generation if needed; keep calculations separate from rendering.

**Interfaces:** Retain `syntheticActuals(seed)`, `freezeForecast(actuals, cutoff)`, `forecastRate(frozen, month)`. Introduce a versioned `PlanningFixture` with fixture/actuals/generator IDs, seed, declared units, groups/cohorts/producers, training/holdout rows and independent schedule inputs. Expose individual and grouped month volumes; the portfolio total is the sum of its groups.

- [ ] Pin failing cases for absent/duplicate producer/group identity, stable holdout/forecast IDs, group sum equality and shifted single-producer starts.
- [ ] Make ramp and producer monthly availability explicit. For a new declared curve use q = q0 * exp(-D*age) * min(1,(age+1)/max(1,rampMonths)) * availability(month); zero before start. Default rampMonths=1/availability=1 preserves the existing curve. For q0=1000, D=0, rampMonths=2 and availabilities 1/0.5/1, require rates 500/500/1000.
- [ ] Version any changed fixture/generator; preserve seed-417/v1 and old serialized evidence instead of changing it under the same ID.
- [ ] Display underlying histories, fitted curves, training cutoff/holdout and per-producer/group input tables with provenance.
- [ ] Run direct Node planning tests; prove future actuals/schedule edits do not rewrite the frozen original forecast or historical observations.
**Depends:** D1; A0 for uploaded rows (existing seeded-fixture extension can proceed independently). Produces inputs for A3/A4.

### A2: Explicit pressure-basis and datum validation

**Files:** `src/engineering.ts`, `src/planning.ts`, `src/exhibit.ts`, `tests/engineering.test.mjs`, `tests/planning.test.mjs`.

**Interfaces:** Make reservoir/constraint pressure basis and datum compatibility explicit within each Injector calculation, using structured pressure metadata or an enforced supported common-datum input contract. Validate before pressure subtraction, curve construction and exhibit creation. If a scenario claims a shared datum in its chart/export, enforce that declaration. Preserve the existing numeric functions for valid cases; do not impose universal cross-well datum equality on independently valid stock-tank capacities.

- [ ] Pin failing tests for missing datum/basis, incompatible reservoir/constraint datums or bases within one injector, unsupported wellhead/gauge inputs and a scenario that violates its declared shared-datum chart/export contract.
- [ ] Reject incompatible per-injector inputs before returning that calculation or export; give an actionable validation message. If the input model supports distinct per-well datums, include a positive case proving individually valid capacities still aggregate correctly.
- [ ] Retain independent PRD examples 3000/4000 psia and 7500/3750 STB/d; check J<=0, nonfinite/missing values, pressure limit<=reservoir and zero availability.
- [ ] Compile and run direct Node engineering/planning/exhibit tests; verify valid default results unchanged.
**Depends:** D1; independent of A1.

### A3: Complete planning and reconciliation inspection

**Files:** `web/index.html`, `web/app.mjs`, `web/styles.css`; focused browser checks and planning tests.

**Consumes:** A1 fixture/individual/group outputs and A2 compatible injector results -> coherent view of history/type curve, monthly reconciliation, grouped demand, capacity and deficits.

- [ ] Show monthly signed absolute variance and percent, plus running cumulative variance; zero forecast must display unavailable percent.
- [ ] Keep current annual summary, capacity charts and source section while exposing producer/group contributions and declared ramp/downtime assumptions.
- [ ] Verify one start-date change moves only that producer; group/portfolio and calendar volumes agree with the displayed tables.
- [ ] Check desktop/mobile/keyboard/table overflow and a timed approximately three-minute forecast -> scenario -> export walkthrough.
**Depends:** A1/A2; produces finalized display inputs for A4.

### A4: Complete exhibit input/provenance contract

**Files:** `src/exhibit.ts`, `src/exhibitSvg.ts`, `web/exhibit-pdf.mjs`, `web/app.mjs`; `tests/exhibit.test.mjs`, `tests/exhibit-svg.test.mjs`, `tests/exhibit-pdf.test.mjs`, `tests/public-artifact.test.mjs`.

**Interfaces:** `buildExhibit` consumes the complete PlanningFixture, frozen forecast, displayed outputs, compatible injectors, controls and optional validated PublicArtifact. Preserve a versioned schema and exact serialized SHA256; old examples stay reproducible.

- [ ] Add failing assertions for raw planning input tables, group/cohort/producer IDs, actuals/generator IDs, versions, date range and input hashes.
- [ ] Extend JSON/CSV/SVG/PDF and attached JSON consistently; keep public reported data separate.
- [ ] Verify default/changed cases and every displayed output against exported values, including missing vs zero and unloaded public evidence.
- [ ] Repeat the asynchronous scenario-edit cancellation gate with the expanded fixture fields; no stale file may be delivered.
- [ ] Recheck source pin, download files and readable continuation pages using the supported gate tools.
**Depends:** A1/A2/A3 and E1 for refreshed artifacts.

### A5: Reuse/reference evidence closeout

**Files:** `reference/nexus-source-manifest.json`, `reference/nexus/`, `scripts/check-carried-oracles.mjs`, applicable numerical tests and `docs/verification.md`.

- [ ] Recheck selected source/destination hashes and original fixture versions; do not reclassify old MCP values as fresh calls.
- [ ] Run applicable carried-reference checks through supported direct Node commands; record exclusions and SWD datum/unit/integration checks.
- [ ] Keep unperformed live MCP/full-upstream coverage explicitly unverified; neither is required to satisfy SWD-09. Perform such additional coverage only if separately useful, callable and allowed.
- [ ] Review A2/A4 changes with numerical/source evidence and publish criterion-level outcomes in the tracker.
**Depends:** A2/A4. Does not require copying every hydrocarbon feature.

### A6: Separately identified published engineering example

**Files:** Create `data/scenarios/literature-example.json`, supporting citation/equation note in `docs/`; extend owning scenario/UI/exhibit adapters and engineering tests.

- [ ] Start from the already identified Jin, Wojtanowicz and Ge (2022) example in the demo-data strategy, Appendix A Table A1/PDF page 18. Independently retrieve/check equations and paired units before selecting the example's actual formula.
- [ ] Retain page/table/DOI and original/selected unit decisions. Keep published parameters separate from added assumptions, particularly any J not supplied by the paper.
- [ ] Implement only the selected explicitly benchmarked educational example; do not claim the full paper simulation or transfer it to the real Reeves UIC.
- [ ] Verify independent numeric anchors and export literature/assumed/calculated provenance; preserve the existing fictional cases.
**Depends:** A2/A4 where the selected example uses those interfaces. Scheduling A5 before A6 is a proposed sequencing preference, not an original PRD prerequisite; literature/method planning can start independently. This retains the broader PRD obligation; it is not a declaration that the original daily minimum required a regional simulator.

### E1: Immutable explicit snapshot-to-artifact export

**Files:** `scripts/export.mjs`, `scripts/acquire.mjs`, `src/normalize.mjs`, `test/normalize.test.mjs`; create `test/versioning.test.mjs`; update SPEC/source-proof/run instructions.

**Implementation choice:** E1 is reliability hardening for the original reproducible-versioning and old-artifact retention contract. The PRD does not mandate a particular parameterized API or automatic-refusal mechanism. The current manual procedure and intact pinned artifact remain valid evidence.

**Interfaces:** Accept explicit source directory and artifact ID, with current raw/ and current pinned ID available only as a compatibility/default replay. Implement `exportArtifact({sourceDir, artifactId, outputRoot})` with existing normalized contract shape. New writes may target only a new version; identical existing reprocessing may return success after byte/hash comparison without rewriting.

- [ ] Pin failing tests: changed source + old ID rejected, old artifact hashes unchanged, identical replay accepted, invalid/path-traversing ID rejected, incomplete/failed acquisition not labeled verified.
- [ ] Assemble/verify bytes and source metadata before publication of a new artifact directory. Refuse a partially existing/conflicting version rather than overwrite it.
- [ ] Create a new ID for a refreshed source; retain old raw evidence/artifact. Verify dictionary/counts/dispositions, original identifiers and 28-row baseline anchors.
- [ ] Re-run offline normalization, versioning and consumer pin checks; any live acquisition stays bounded and uses a new scratch directory.
**Depends:** D1. Produces the versioned contract consumed by A4/G2.

### E2: Complete source inspection and table acceptance

**Files:** `public/index.html`, `public/app.js`, `public/style.css`, server/normalization tests where behavior warrants them.

- [ ] Provide the PRD's inspectable inventory table with relevant original IDs, county/operator, constraint fields and QC; retain lightweight selected-record details.
- [ ] Verify county/operator identifier filtering only from supported fields; selected records cannot silently point at a different filtered identity.
- [ ] Label whole-snapshot downloads explicitly and verify full artifact counts independent of view filters. Do not invent a filtered-export requirement.
- [ ] Preserve no-history messaging for the other four parents, distinct average/max psi, calendar averages and missing-vs-zero behavior.
- [ ] Check desktop/mobile/keyboard focus and both table scroll directions; inspect actual saved downloads, source anchors and byte hashes.
**Depends:** E1; independent of A1-A3.

### E3: Actual run evidence and confirmed read-only node map

**Owner/requirements:** Explorer; RRC-09/RRC-10, with RRC-01–RRC-06 provenance/versioning retained. **Status: NOT STARTED.**

**Files:** Instrument existing `scripts/acquire.mjs`, `scripts/export.mjs` and `src/normalize.mjs`; create `src/runEvents.mjs`, `test/run-events.test.mjs` and `public/workflow.js`; modify existing public view/server adapter only to expose recorded history and node details. Proposed run-record storage location is `runs/<run-id>/`; no scheduler or trigger endpoint is introduced.

**Interfaces:** Versioned RunRecord/Event ties run/stage/event IDs, invocation mode, source/schema/transformation versions, timestamps and pending/running/succeeded/failed/skipped states to actual source/input/output hashes, row counts/dispositions and structured errors. Pipeline stages match real code execution. External Analytics pin acknowledgement is distinct from Explorer export success.

- [ ] Pin state/sequence/count/hash tests for real offline replay, controlled failure, skipped downstream work, independent invocation IDs and preserved earlier runs/artifacts. Incomplete acquisition cannot pass verified export.
- [ ] Instrument actual execution; redact sensitive diagnostics; distinguish acquisition from offline replay. Never manufacture historical success/timing or fake consumer acknowledgement from the presence of an export.
- [ ] Render the fixed stage map and selected run's chronological evidence. Historical manifests without events show **unrecorded**, while explicitly labeled test fixtures remain outside actual history.
- [ ] Selecting a node inspects status/errors/source/output/count details. Provide keyboard/mobile inspection; prove no node editing, rearranging, drag/drop, arbitrary authoring or new Run/Retry/Schedule controls.
- [ ] Record one instrumented offline replay and controlled failure plus focused checks/screenshots. Live source refresh is unnecessary to prove the map and must stay bounded/separately authorized if selected.
**Depends:** D1 and existing executable pipeline; coordinate E1 event/versioning interfaces before either task edits shared scripts. E3 can use the preserved current snapshot; automatic overwrite hardening is not a prerequisite to viewing genuine replay evidence.

### G2: Connected P0 acceptance and evidence packet

**Files:** Owning verification records/trackers and dated portfolio coordination record.

- [ ] Run applicable Analytics build/tests and Explorer normalization/version/server tests after the feature changes; distinguish in-memory, filesystem and browser evidence.
- [ ] Stop the identified Explorer process, reload Analytics with its locally pinned artifact, and verify public rows/export; restore only the process owned by this check.
- [ ] Compare exact displayed/exported values and input provenance, with declared floating-point tolerance where cross-browser/Node calculations differ.
- [ ] Complete desktop/mobile/keyboard and three-minute walkthrough gates. Record no-history, corrupt pin, missing values and asynchronous export behavior.
- [ ] Verify generated CSV/XLSX mapping/validation/readiness and source-origin lineage; inspect actual read-only node replay/failure evidence and absence of trigger/editor controls.
- [ ] Mark each acceptance passed/failed/not-started/unverified using its actual evidence, not a suite total or percentage.
**Depends:** A0–A5, A6 for the broader study requirement, E1/E2/E3 and D1. The two-app core closure does not claim permitting/whole-initiative completion.

### G3: Delivery and portfolio integration after separate authorization

**Files:** Owning app deployment/run documents and portfolio `src/lib/portfolio.ts`, project routes/case studies when authorized.

- [ ] Select actual hosting and owner-confirmed portfolio destination; create remotes/push/deploy only after explicit authorization.
- [ ] Verify independently deployed app URLs, data/source/export paths and working portfolio return links in a fresh browser.
- [ ] Update project technologies, status, provenance, limitations and case-study URLs from delivered behavior; do not claim public availability before the gate.
- [ ] If delivery cannot pass, retain an accurately labeled local demonstration and recording as the roadmap's fallback, with the delivery requirement still open.
**Depends:** G2 plus owner-approved destinations/deployment/Git scope.

## 7. Original planned extensions

These tasks remain planned at their original priorities and cannot be counted as delivered or removed without owner approval.

| Task | Requirements | Deliverable and acceptance | Dependencies |
|---|---|---|---|
| P1-A | SWD-10 | Injection wellbore geometry/fluid/temperature/depth/basis input model; independent downward hydrostatic and friction benchmarks; justified surface-to-BHP conversion. Preserve constant-J default. | A2/A5; authoritative injection references |
| P1-B | SWD-12 | Additional model/sensitivity choice with declared parameters and units; sweep/tornado values reproduce base case and exports. | A2/A4/P1-A as applicable |
| P1-E | RRC-07 optional GIS | Sourced locations and CRS/roles/reliability; missing coordinates remain in table; map labels avoid status/capacity inference. | E1/E2; validated location source |
| P2-A | SWD-11 | Separately scoped layering/transient/calibration method and benchmarks, input sufficiency, supported calibration evidence and limitations. | Owner-approved evidence/model design; P1-A only if the chosen model requires wellbore coupling |
| P2-E | RRC-08 | Reviewed statewide/refresh access limits and completeness/pagination, version comparisons, expanded QC and schedule ownership. | E1/G2; authorized source/automation scope |

## 8. Bounded milestones and evidence ledger

Status at this documentation revision: repository setup G1 has recorded local evidence; all new/completion implementation below is **NOT STARTED**. Reusable components do not count as milestone acceptance. Dates are not promises; the delivery constraint remains strictly **before October 14, 2026**. Use these gates to report useful progress and surface deadline risk early.

| Goal / owning repository | Requirement IDs / tasks | Concrete deliverable | Pass/fail check | Evidence to retain | Dependencies | Current status |
|---|---|---|---|---|---|---|
| M0 — Main coordination / each owning app | All SWD-01–SWD-14, RRC-01–RRC-10; D1 | Requirement tracker, unit glossary, file ownership and selected task/acceptance command | Every original/additional ID has owner, priority, task and gate; original P1/P2 retained; no unauthorized app work | Tracker/spec/glossary paths and checked coverage record | Existing PRDs/workflow/local roots | NOT STARTED; existing instructions/specs reusable |
| M1 — Analytics import contract | SWD-13/SWD-14; A0 | Generated CSV/XLSX samples, mapping/validation preview, typed inputs and readiness reasons | Equivalent formats/units yield equal normalized rows; invalid/conflicting cases are explicit; per-analysis readiness and provenance rules pass | Import fixtures, focused test logs, mapping/error/readiness screenshots | M0; existing seed/presets/schema; reviewed parser choice | NOT STARTED |
| M2 — Analytics planning inspection | SWD-01/SWD-02/SWD-03; A1/A3 | Histories/type curves, producer/group metadata, ramp/downtime, frozen holdout, monthly/cumulative reconciliation and schedule breakdown | Same seed/version repeats; no holdout leakage; group/portfolio sums agree; variance/zero/calendar/ramp anchors pass; start edit affects selected producer only | Versioned fixture, planning tests, input/curve/reconciliation screenshots | M0; M1 only for uploaded rows; A2 before combined capacity view | NOT STARTED; current seed/fit/start control reusable |
| M3 — Analytics engineering and cited example | SWD-05/SWD-06/SWD-07/SWD-09 plus PRD §§1–2 study example; A2/A5/A6 | Explicit compatible per-injector pressure inputs, reference-checked curves/capacity, cited selected study case | 3000/4000 psia, 7500/3750 STB/d and zero-availability anchors; invalid basis/datum/J blocked; selected paper equations/units and independent anchor verified; no field calibration claim | Numerical/reference logs, source manifest, cited parameter/equation note and scenario fixture | M0; M1 for uploads; A5 integration rerun after A4; study research already available | NOT STARTED; preset arithmetic/reference files reusable |
| M4 — Explorer inspection and observable collection | RRC-01–RRC-06/RRC-09/RRC-10; E1/E2/E3 | Version-safe artifact handling, inspectable inventory/history/QC, actual run ledger and read-only fixed node map | Source anchors/28-row linkage and dispositions repeat; old versions unchanged; full downloads agree with scope; actual replay/failure states/counts/hashes/errors agree; no editor/trigger controls | Normalization/version/event tests, source/hash record, saved downloads and node/table screenshots | M0; existing preserved raw/artifact; sequence shared E1/E3 file ownership | NOT STARTED; current bounded export/manual version procedure reusable |
| M5 — Analytics exhibits and public consumer | SWD-04/SWD-08/SWD-14; A4/A5 | Expanded input/provenance contract and CSV/JSON/SVG/PDF consistent with UI; verified pin consumed independently | Display/export/input hashes/IDs/units/mapping match default and changed cases; stale asynchronous output cancelled; corrupt/unavailable public pin shown accurately; public/user/synthetic inputs kept distinct | Focused artifact/exhibit/PDF tests, exact downloads, reference rerun and display/export comparisons | M1/M2/A2; M4 for refreshed artifacts (current verified pin reusable) | NOT STARTED; current pin/export machinery reusable |
| M6 — Main integrated core gate / both apps | SWD P0 incl. 13/14; RRC P0 incl. 09/10; G2 | Criterion-level acceptance packet and independent Astra review | Applicable build/tests pass; Analytics pin works with Explorer stopped; fresh desktop/mobile/keyboard walkthrough passes; import and actual-run map gates pass; cited-study gate met | Owning verification records, per-ID outcomes, fresh browser/export evidence and Astra findings/resolution | M1–M5; A6; two-slot review procedure | NOT STARTED |
| M7 — Delivery, separately authorized | Architecture §§5–6; G3; owning apps + phi-analytics | Verified hosted URLs/return links and truthful portfolio status, or explicitly labeled local fallback | Fresh browser opens actual app/source/export/return paths; no invented URL or shipped status; unresolved deployment gate remains open with fallback | Approved destinations, deployment/link checks and walkthrough record | M6 plus explicit Git/hosting/portfolio authorization | NOT STARTED; authorization/destinations not selected here |

Each milestone closes only after its checks and retained evidence pass. Where requirements overlap, reuse the same evidence but record the specific criterion it establishes. P1-A/P1-B/P1-E and P2-A/P2-E remain in §7 and outside core acceptance; they are NOT STARTED and require their own listed dependencies/benchmarks. No deadline-driven omission changes full scope without an explicit owner decision.

## 9. Per-goal one-hour checkpoint and scope control

Each active task/goal has a bounded maximum one-hour work window. Main reports completion as soon as the goal passes its evidence gate. If unfinished at one hour, report the current evidence/status/blocker/next step and **pause that goal for owner direction**. Do not automatically renew the timebox, begin another hour, continue in the background, or replace it with a wider goal. A new timebox requires explicit owner direction. Material blockers/drift are reported sooner. The parent/main coordinator owns any one-shot reminder; this document installs no scheduler and requests no recurring reports through the deadline. This plan-revision goal began 18:07 UTC on October 9; its checkpoint is 19:07 UTC if unfinished.

```text
Report time, goal start/checkpoint and current authorization:
Completed evidence: requirement/milestone, changed paths, exact check outcome, retained evidence location; or none.
Current goal: one bounded milestone/task, owner, concrete deliverable and next pass/fail check; status NOT STARTED/IN PROGRESS/PASSED/FAILED/BLOCKED/UNVERIFIED.
Blockers: missing decision, failed check/tool, dependency and impact; distinguish demo inputs already available from actual field/format validation needs.
Scope drift: none, or requirement/file/priority/acceptance deviation, why, and owner decision required. Stop dependent expansion until recorded approval; continue unaffected authorized work.
Next step: bounded recommendation with dependency/evidence gate; if unfinished at one hour, state PAUSED FOR OWNER DIRECTION and do not execute the proposed continuation automatically. State deadline risk without percentage complete or a guaranteed finish time.
```

Main keeps an owner-decision log (date, decision, affected requirement IDs, changed scope/priority/acceptance, next timebox and source instruction). No worker changes scope or drops a failed gate. Apply the existing [seven-field workflow](agent-workflow.md), prescribed models and strict maximum two active subagents including Astra. Sequence shared-file writers; use short Astra design/contract/final checkpoints and release its slot after review. At the goal's hour mark, stop/pause any unfinished worker assignment and confirm it has stopped; report retained state rather than let it continue silently. Do not start any app implementation under this documentation-only request.

## 10. Resolved inputs, recommended defaults and genuine open choices

**Resolved:** separate app repositories; public sample/pinned contract; synthetic histories/schedules and fictional engineering inputs; Nexus/reference reuse; no private-data demo dependency; read-only fixed collection map with no editing or new trigger controls; original P1/P2 priorities; deadline strictly before October 14. These are not questions to reopen.

| Open implementation/delivery choice | Recommended default | When it matters / blocking effect |
|---|---|---|
| Import profiles, file limits and XLSX dependency | Start with produced-water history/schedule and constant-J injector profiles; browser-local parsing, no automatic upload/persistence; select supported limits/parser with license/security check | Implementation design detail for A0; not a request for real user files. Owner confirmation is required only if changing this bounded scope or adding persistence/backend services. |
| Optional live acquisition versus offline map proof | Instrument/replay the preserved snapshot first; label offline and historical unrecorded fields | E3 can proceed without a new public fetch. New trigger controls/scheduler are outside scope and require a separate owner decision. |
| Actual user format and calibrated field applicability | Generated equivalent-format/malformed samples for demo; treat supplied real files as optional later format-validation cases | Neither blocks the demo. Actual field conclusions require measured inputs/calibration and separate validation scope. |
| Hosting, remote/Git operations and portfolio/return destinations | Finish local core acceptance before proposing concrete delivery targets; retain truthful local fallback | G3 is blocked until separately authorized and destinations confirmed; this does not block local design/implementation if separately authorized. |

Implementation itself remains outside the current documentation-only authorization. This revision neither creates import samples nor starts app features. Preserve every original/additional ID and record any later owner-approved change explicitly.
