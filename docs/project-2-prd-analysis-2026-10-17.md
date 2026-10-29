# Project 2 expansion PRD: requirements analysis

Read-only review by Fable 5.1, 2026-10-17, of `docs/project-2-swd-injection-analytics-expansion-prd.md` against `docs/feature-inventory-2026-10-17.md` and the governing documents. Repo HEAD `4722d81`. Nothing was built or modified.

## Conventions and checks

- `N/` = `swd-injection-analytics/`.
- Each point is labelled **FACT** (verified in source or docs), **ASSUMPTION** (not verified) or **REC** (recommendation).
- Read-only check: `node scripts/verify-preservation.mjs .` → `{"checked":182,"violations":[]}`.
- External links in PRD §10:
  - Opened and verified: #1 (resources page), #2 (Permian review page), #3 (permit-procedures page).
  - Not opened: #4 (the GitHub repo).
  - Not fetched: the V1.3 workbook `.xlsx` itself.

## 1. Objective and final deliverable

- **FACT (PRD §1):** The objective is to reposition the app.
  - From: a synthetic and user-supplied workbook.
  - To: a source-aware injection-performance and pressure-screening workflow that consumes Project 1 evidence.
  - Every existing workflow is preserved.
  - The app must refuse to claim measured reservoir pressure, calibrated J, sustainable capacity, compliance or safe pressure without evidence (§1 "Success standard").
- **FACT (PRD §4, §7, §8):** The deliverable is:
  - ten backlog items, E00–E09, across phases 0–5;
  - a recommended first release covering phases 0–2 (§7);
  - ten must-pass acceptance scenarios (§8);
  - no regressions against the current baseline (§8 #10).
- **FACT (PRD §10, last line):** The PRD places itself below AGENTS.md, the preservation specs and owner-approved scope.

## 2. Requirements extracted per ANA item

### E00 (P0): hosted Explorer handoff

- **Functional:**
  - versioned sender/receiver contract
  - allowed hosted and local origins
  - readiness map per workflow
  - data-aware case composition with conspicuous assumptions
  - cancel, fallback and replay
- **Technical:**
  - verify manifest and content hashes, origin, schema, size and identity
  - hosted saving is not a prerequisite
- **Constraints:**
  - explicit user confirmation
  - calibrated capabilities stay blocked
- **Acceptance:**
  - a real browser handoff works at local and deployed origins
  - the old TAR import still works
  - a bad origin, bad hash, bad schema or missing acknowledgment fails closed
  - an H-10-only case never shows a calibrated capacity
- **Maps to:** FACT: HANDOVER.md:145 ("hosted origin expansion needs separate contract review"); consumer of SWD-04.

### E01 (P0): evidence data model

- **Functional:** a typed evidence schema with these fields:
  - `well_uic`, snapshot and hash, test id, time
  - pressure type (5 enums), psia/psig, gauge depth and datum
  - temperature, fluid density, test method, units, confidence, original mapping
  - rate type (3 enums), stock-tank vs reservoir volumes
  - per-analysis prerequisites with the states `ready`, `screening_only`, `not_ready` and `invalid`
- **Technical:**
  - layered on the existing origin labels
  - versioned calculation settings
- **Acceptance:**
  - import rejects or marks incompatible units, psig/psia ambiguity, a missing datum and unaligned tests
  - test data alone does not imply reservoir pressure or J
  - existing classification stays intact
- **Maps to:** REC: extension of SWD-13/SWD-14 (01-swd-injection-analytics.md:103-104).

### E02 (P0): injection-performance diagnostics

- **Functional:**
  - monthly H-10 bbl, calendar-day rate, and reported average and maximum pressure, with coverage
  - rate-vs-pressure and pressure-per-unit-rate trends, as screening only
  - BHP/SRT overlay with date, basis, depth, method and uncertainty
  - a candidate-cause checklist
- **Technical:** handle shut-ins, reporting changes and days-in-month effects.
- **Constraints:** no automatic damage or integrity diagnosis.
- **Acceptance:**
  - missing is not zero, and gaps are marked
  - original units and basis are kept
  - WHP data never implies BHP
  - every diagnostic carries a formula or assumption label
- **Maps to:** REC: SWD-04 extension. The repo already lists "Diagnostic injectivity-history fitting — Proposed" (N/web/workspace-views.mjs:72; HANDOVER.md:142).

### E03 (P0/P1): qualified J estimate

- **Functional:**
  - J = q/(Pwf−Pres), with Pwf > Pres and q > 0
  - explicit volumetric basis
  - test-point selection, uncertainty and sensitivity
  - J over time only when there is repeated comparable evidence
  - H-10-only cases get exploratory plots without a calibrated J
- **Technical:**
  - psig↔psia and datum checks
  - reject incompatible data
- **Constraints:** only with a contemporaneous rate, flowing BHP and reservoir-pressure estimate.
- **Acceptance:**
  - unit tests pass
  - ΔP ≤ 0 is rejected
  - a single unmatched test, or H-10 alone, cannot produce a field-calibrated J
  - no unique skin is inferred
- **Maps to:** REC: SWD-05 extension (GLOSSARY.md:22 "not fitted from H-10").

### E04 (P0/P1): WHP/BHP reconciliation and margin screening

- **Functional:**
  - Pbh = Pwh + ΔP_hyd − ΔP_fric
  - pressure at selected depths
  - basis-matched comparisons only (for example, WHP vs the permitted surface maximum)
  - three separate margins: regulatory, modeled hydraulic, and unknown formation
  - uncertainty bands
- **Technical:** reuse brinePvt and wellboreTraverse; no competing physics.
- **Constraints:**
  - never compare an unconverted WHP with fracture stress or a BHP limit
  - missing tests block formation-safety claims
- **Acceptance:**
  - matches the existing oracles within tolerance
  - datum is consistent
  - a basis mismatch blocks the comparison
  - the UI labels results "screening"
- **Maps to:** REC: SWD-10 extension (issue-tracker.md:28).

### E05 (P1): scenario and monitoring workflow

- **Functional:**
  - extend the demand-vs-capacity case: schedule, demand, availability, constraints, implied WHP/BHP, allocation, unmet volume
  - compare a base case with a changed J, geometry or availability
  - historical-vs-forecast view
  - deterministic narrative
- **Technical:** business rules, not an LLM; the narrative cites inputs and equations.
- **Constraints:** not a separate dashboard.
- **Acceptance:**
  - deterministic rerun
  - availability applied once
  - edits invalidate exports
  - labels retained
  - no future capacity presented as proven
- **Maps to:** REC: SWD-06/07/12 extension.

### E06 (P1): transient single-well buildup

- **Functional:**
  - inputs: h, k, φ, c_t, μ, B, Pi, rate history, boundaries
  - radial-flow assumptions with rate-step superposition
  - pressure at (r, t) and at the injector datum
  - sensitivity and boundary warnings
- **Technical:**
  - a separate, validated, versioned module
  - closed-form references plus independent numerical checks
- **Constraints:** needs explicit model-scope approval.
- **Acceptance:**
  - benchmark cases, convergence and monotonicity checks
  - sign and unit checks, invalid-parameter guards
  - baseline and predicted pressure kept separate
  - no real-well calibration
- **Maps to:** FACT: SWD-11 / P2-A "owner-approved evidence/model design" (2026-10-09-plan-compliance-completion.md:106,322; HANDOVER.md:137).

### E07 (P1/P2): multiwell interference screening

- **Functional:**
  - superposition from Project 1 offset histories, coordinates and intervals
  - closeness is not treated as connectivity
  - per-well evidence, distance and time window
  - connected and disconnected scenarios
- **Constraints:** missing histories make the case incomplete; they never count as zero.
- **Acceptance:**
  - point-source benchmarks
  - incomplete status when data is missing
  - uncertainties carried into exports
- **Maps to:** REC: SWD-11-adjacent. It depends on Explorer RRC-07 (GIS, P1) plus a new Explorer requirement (02-texas-rrc-explorer.md:67).

### E08 (P1/P2): Permian MSIP/MDIV workbook support

- **Functional:**
  - support the RRC Permian Basin Disposal Well Review V1.3 workbook (Well, AOR, and MSIP & MDIV sheets)
  - Project 1 supplies AOR, isolation and jurisdiction evidence
  - track geomechanical, pore-pressure, density and depth inputs
  - draft tables plus a source index
- **Technical:**
  - pin the regulatory version
  - cell mapping with gold cases
- **Constraints:**
  - explicit regulatory scope authorization
  - qualified-engineer review
  - no estimates just to fill cells
  - outputs labelled "engineer review required / not a permit submission"
- **Acceptance:**
  - jurisdiction-restricted controls
  - traceable source pages
  - blockers for missing values
  - no auto-filing
- **Maps to:** FACT: excluded today by N/AGENTS.md:3 ("No permitting, GIS…"), N/product-spec.md:13 and handover/context/05-architecture-integration.md:14,37 (permitting belongs to `ai-swd-permitting`).

### E09 (P2): saved cases and richer reports

- **Functional:**
  - save, load, revise and compare cases
  - expanded PDFs for capacity, pressure and sweeps
  - each case records identity, inputs, hash, version, coverage, edits and parents
- **Technical:**
  - browser-local storage first, if policy allows
  - Supabase needs separate approval
  - PDFs render from the validated exhibit, with no recalculation
- **Constraints:**
  - reopen only after digest and schema verification
  - an unverified import can never be relabelled as public afterwards
- **Acceptance:**
  - pinned data unaltered
  - JSON/export parity
  - stale results invalidated
  - a failed integrity check never opens a case
- **Maps to:** FACT: HANDOVER.md:144 (persistence needs a schema and access model); DEMO.md:5 (connected-case PDF deferred).

### Cross-cutting requirements (PRD §5–§6)

- five import classes
- a readiness matrix
- a placeholder exhibit contract, `swd-analysis-case/2`
- no second ingestion pipeline: reuse `importProfile.ts`, `importValidation.ts` and the receiver
- no duplicate physics
- a Web Worker for expensive grids
- pressure semantics: absolute vs gauge, density, depths, measured vs modeled, rate basis
- sensitivity is not the same as statistical confidence
- test gates: 435 / 248 / 69
- the preservation and release process
- Supabase stays read-only

## 3. Gaps, ambiguities, conflicts, assumptions

### Conflicts with governing documents

- **G1 FACT:** E08 conflicts with N/AGENTS.md:3, N/product-spec.md:13 and 05-architecture-integration.md:14,37. N/AGENTS.md, N/product-spec.md and N/GLOSSARY.md are also hash-pinned in the 182-file manifest (`migration/source-manifest.json`, checked by `verify-preservation.mjs:119-121`). So amending the scope for E08 itself requires a new baseline layer.
- **G2 FACT:** E02/E03 analysis of real H-10 data goes beyond the current scope wording:
  - "fictional injection curves/capacity, public Explorer artifact import" (N/AGENTS.md:3);
  - "descriptive monthly public observations after verification" (N/product-spec.md:21).

  This is a smaller change than E08, but it still needs owner-approved wording.
- **G3 FACT:** PRD §1 "Product decision" rewrites the purpose in N/product-spec.md:9-13, which is pinned. The authoritative PRD v1.3 lives in `phi-analytics` (N/product-spec.md:5). Where this expansion PRD sits in that chain is undecided.
- **G4 FACT:** E09's browser-local save reverses the documented session-only posture (HANDOVER.md:13; header text "Session only" at N/web/import-ui.mjs:115). Root AGENTS.md does not forbid browser-local storage, but it requires explicit scoping for any persistence.

### Missing information and internal gaps

- **G5 FACT:** E06's required inputs (PRD §4 E06) omit the wellbore radius r_w, which any line-source/Ei solution needs for pressure at the injector datum. The PRD is also silent on how skin is treated and which boundary set is used.
- **G6 FACT:** There are already overlapping provenance vocabularies:
  - N/src/importProfile.ts:3-6: origin (user/synthetic/public/literature/assumed) × ContentKind (synthetic/public-reported/measured/literature/assumed);
  - N/src/sampleCase.ts:6-8: trrc-public-record/calculated/derived-with-assumption/synthetic/raw-not-verified;
  - PRD §2 rule 3: six named classes plus "another existing reviewed category";
  - PRD §5 inputClasses: public_reported/measured_unverified/assumed/calculated/unavailable.

  E01 must map onto the existing vocabularies, not introduce a fourth.
- **G7 FACT:** Hosted handoff is *unavailable by construction*, not merely "unverified" (PRD §2 l.36, §4 E00; inventory §3).
  - N/web/explorer-handoff.mjs:2-3 hard-codes `http://127.0.0.1:4391` and `:4290`.
  - Line 74 rejects any other origin.
  - Line 109 publishes `unavailable` when `url.origin!==ANALYTICS_ORIGIN`.
  - The sender hard-codes the same origins: `C:/Users/thai.phi/Downloads/python/portfolio/texas-rrc-explorer/public/analytics-handoff.js:4`.

  Both repos must change.
- **G8 FACT:** No Project 1 contract covers the evidence that E01–E03 and E07 need.
  - The recorded-evidence contract is one UIC, at most 36 months, with caps of 25 inventory rows and 1,000 monthly rows (N/web/explorer-evidence.mjs:112-113,123).
  - The Explorer PRD (RRC-01…10) has no BHP/SRT or multi-UIC item.
  - RRC-07 (GIS) is P1 and "not built" (sample-tour spec §3 l.51).
  - The RRC ODP *does* publish "UIC Bottom Hole Pressure Test Results", "UIC Step Rate Test Results" and "UIC well location" (fetched resources page). The data exists; the acquisition scope does not.
- **G9 ASSUMPTION:** It is unknown whether Explorer has a hosted URL. The PRD §7 Phase 0 gate requires a "verified published Explorer".
- **G10 ASSUMPTION:** E00 relies on two things that have not been checked in a hosted browser:
  - that the cross-origin `window.opener` survives the outer `/` → `/analytics/index.html` redirect (HANDOVER.md:12);
  - that Lovable hosting sets no COOP header (`_headers` only expresses no-store/nosniff, migration/README.md:11).

  If COOP severs the opener, E00 is impossible without a different transport.
- **G11 FACT:** The policy for converting permit pressure from gauge to absolute is inconsistent and unstated for real wells.
  - The sample assumes gauge and adds 14.7 psi (N/src/sampleCase.ts:25; spec §3 l.54).
  - The constant-J import boundary refuses to infer an atmospheric conversion (GLOSSARY.md:17; N/src/importValidation.ts:25-26 require `psia`).
  - PRD E01/E04 are silent on the policy for real wells.
- **G12 FACT:** The existing physics has domain limits that real wells will hit:
  - PVT domain: 100–10,000 psia, 60–250 °F, 0–20 wt% NaCl (N/src/brinePvt.ts:5);
  - the traverse exits below 100 psia (N/src/wellboreTraverse.ts:49);
  - TDS in mg/L is never converted to NaCl wt% (GLOSSARY.md:34).

  Real wells with low or vacuum WHP, or high-TDS brine, will be "unsupported" in E04. The PRD is silent on this.
- **G13 FACT:** A reported 0 psi is a value; a blank is null (N/web/explorer-evidence.mjs:27-29). E02 must keep "reported 0" distinct from "missing", which matters for vacuum or gravity-fed wells.
- **G14 FACT/ASSUMPTION:** E08 would require re-implementing the workbook formulas, because the app refuses to execute spreadsheet formulas (N/product-spec.md:72). The workbook was not fetched, so its cell semantics are unverified.
- **G15 FACT:** The test counts (435/248/69) were not rerun. The root preservation test writes to `tmp/` (tests/preservation-baseline.test.mjs:21) and the nested tests write fixtures (HANDOVER.md:65); the read-only brief excluded both. A grep plausibility check found 401 top-level `test(` calls in the nested tests and 22 in the root (loops expand these). The preservation gate itself passed (182 checked, 0 violations).
- **G16 FACT:** The inventory cites `N/HANDOVER.md`, but the file is at the repo root.
- **G17 FACT:** The PRD's workbook claims match the RRC page:
  - "UIC PERMIAN REVIEW V1.3", with sheets Well Template, AOR Template and MSIP & MDIV;
  - MSIP = Maximum Surface Injection Pressure; MDIV = Maximum Daily Injection Volume;
  - a 0.05 psi/ft penalty is deducted from the MSIP *gradient* for unremedied unknown or orphaned wells in the 2-mile AOR;
  - a 0.50 psi/ft administrative cap;
  - Districts 7C, 8A and 08.

  PRD E08 wording is consistent with this.
- **G18 FACT:** The delegation workflow's reviewer role (GPT-6 Astra) is unavailable. The last accepted layer used "independent Opus review" (migration/sample-minors-baseline.json:5). Who reviews each layer is still open.

## 4. Challenge: technical soundness, weaknesses, risks, alternatives

### Sound

- **FACT:** The E03 equation matches existing code and units.
  - It matches GLOSSARY.md:22 and N/src/engineering.ts:22 (`Pwf = Pres + q/J`).
  - The current unit is STB/day (engineering.ts:19; disposalCase.ts:170 `injectivity:'STB/day/psi'`).
  - A reservoir→stock-tank conversion rule exists (GLOSSARY.md:11, `reservoir rate = standard rate × Bw`).
- **FACT:** The E04 sign convention matches the code:
  - N/src/disposalCase.ts:46: `requiredSurface = Pbh − hydrostatic + friction`, which is equivalent to `Pbh = Pwh + hyd − fric`;
  - N/src/wellboreTraverse.ts:58-60: `dP/dMD = gravity − friction`, positive downward.
- **FACT:** E04's WHP→BHP is a wrapper, UI and export extension, not new physics.
  - The traverse engine already accepts `boundary.location:'surface'` (wellboreTraverse.ts:6, :63).
  - The connected case always integrates backward from bottomhole (disposalCase.ts:79, :96).
  - The standalone UI prescribes a bottomhole datum (N/web/hydraulics.mjs:174).
  - `capacity.limitingConstraints` already separates the bottomhole limit, surface limit and operating ceiling (disposalCase.ts:66, :124-127).
- **FACT:** E01 can build on existing readiness and blocking patterns:
  - N/src/analysisReadiness.ts;
  - public-mode blocking in N/web/import-ui.mjs:62-65 and N/web/disposal-context.mjs:13;
  - the pressure-basis label "Reported psi; datum unspecified" (N/web/explorer-evidence.mjs:76; import-ui.mjs:238,242).
- **FACT:** E09's export-parity pattern exists.
  - `disposalCaseCsv` recomputes and canonically compares before export (disposalCase.ts:202).
  - The original-workbook PDF renders from the validated exhibit (N/product-spec.md:82).
- **FACT:** "Old compatible TAR remains supported" is already true.
  - The receiver verifies offer identity, byte count, three hashes and whole-version scope (N/web/explorer-receiver.mjs:21-26).
  - Portable TAR import is independent of the handoff (explorer-receiver.mjs:11-30).

### Weaknesses and risks

- **E02, "pressure per unit rate" (WHP/q), REC:**
  - WHP/q is confounded by hydrostatic head, friction, and calendar-vs-onstream averaging (GLOSSARY.md:13-14). It is fine as a labelled screening indicator.
  - The conventional SWD screening tool is a Hall-plot-style cumulative diagnostic: Σ(p̄_wh − p_ref)·Δt plotted against cumulative injection. It needs only H-10 data plus a declared reference pressure.
  - This is optional and an owner decision, not a requirement.
- **E03:**
  - FACT (per PRD): J conflates kh and skin, and a single test cannot separate them.
  - ASSUMPTION: the schema of the RRC BHP/SRT dataset (gauge depth, datum, stabilization) is unknown until Project 1 inspects it.
- **E04:** the real-well domain limits (G12) and the gauge policy (G11) will make many real months "unsupported". That is correct behaviour, but it has to be designed for, not discovered.
- **E06:**
  - r_w is missing (G5).
  - Monthly calendar-average rate steps only approximate the true rate history.
  - Single-phase constant μ ignores the temperature contrast of injected water.
  - c_t needs a formation-compressibility input beyond brine PVT.
  - The benchmarks the PRD asks for (closed-form plus independent numerical) are appropriate.
  - Web Worker isolation (PRD §6) matches the existing sweep worker (N/web/sensitivity-worker.mjs).
- **E07:**
  - Linear superposition is valid only for a homogeneous, shared reservoir.
  - Without completion-interval evidence, connectivity can only be a scenario toggle, which the PRD acknowledges.
  - It depends entirely on G8.
- **E00:**
  - Both repos must change.
  - The v1 envelope uses exact-key validation (explorer-handoff.mjs:15, :78), so v2 has to be negotiated rather than extended ad hoc.
  - COOP/opener risk (G10).
  - Explorer hosting is unknown (G9).
- **E08:**
  - Beyond the scope conflict, the four-repo ownership model assigns permitting to `ai-swd-permitting` (05-architecture-integration.md:14) and says permitting does not infer requirements from Analytics results (:37).
  - REC: the natural split is that Analytics supplies reviewed engineering inputs and the worksheet mechanics belong elsewhere.
- **Preservation gate scaling, FACT:**
  - `scripts/verify-preservation.mjs:6-18` hard-codes every layer's allowlists.
  - Line 130 flags *any* unlisted new file under `src`, `data`, `web`, `tests`, `scripts`, `reference` or `exhibits`; line 131 flags new files at the app root.
  - Each layer chains its parent's SHA (:76, :95, :104).
  - Each layer lists both the script and `tests/preservation-baseline.test.mjs` as root changes (migration/sample-minors-baseline.json:43-54).
  - Each layer also needs before-archives, CRLF-normalized approved-doc hashes (:21-22) and owner acceptance.
  - New files under `N/docs/` are *not* walked, so method notes are free.

  At one layer per feature, ten features means about ten hand-written chained layers. REC: a one-time, data-driven "layer registry" refactor (an ordered layer index, with per-layer JSON and an archive directory, so the script stays unchanged afterwards). It would be reviewed and accepted as its own layer, followed by one layer per phase.
- **Phase ordering:**
  - FACT: PRD §7 puts Phase 0 first, yet it is the only phase blocked on Project 1 and a hosting decision.
  - REC: decouple the phases. Phases 1–2 can proceed on the H-10 data already pinned in the repo (`rrc-2026-10-09-uic000020838-v1` and the UIC 000056484 package), plus user-uploaded test evidence via the SWD-13 pattern, which PRD §3 explicitly permits.

## 5. Proposed implementation plan

**Phase A: Governance (first)**
- **Scope:**
  - PRD positioning
  - scope amendments to N/AGENTS.md:3 and the N/product-spec.md purpose, via a "governance" baseline layer
  - the gate layer-registry refactor, as its own layer
  - an E01 schema design note under N/docs (needs no layer)
- **Depends on:** owner decisions D1, D2, D3, D5, D12 and D13.
- **Deliverables:** approved docs hash-pinned; a registry-based `verify-preservation.mjs`; the design note.
- **Verification:**
  - `verify-preservation` reports 0 violations
  - root transfer and preservation tests give unchanged outcomes
  - independent review
  - owner `accepted` status

**Phase 1: Evidence-aware analysis** (can start after A; does not need Project 1)
- **Scope:**
  - E01 typed schema, mapped onto the existing classes
  - a user-upload BHP/SRT test profile, following the SWD-13 pattern
  - E02 diagnostics on the pinned and sample H-10 data
  - E03 qualified J from user-supplied tests only
  - readiness states
- **Depends on:** D5, D8 and D12.
- **Deliverables:** new `src/` modules and tests; readiness reasons; exports with formula and assumption labels.
- **Verification:**
  - nested suite in an isolated snapshot (`scripts/check-analytics.mjs`)
  - 248 oracle comparisons, `tsc`, and `prepare-swd`
  - §8 scenarios #1, #3, #4 and #5
  - browser evidence on desktop and mobile
  - independent review and a baseline layer

**Phase 2: Pressure interpretation** (does not need Project 1)
- **Scope:**
  - E04: a surface-boundary wrapper over `traverseBrineWell`, margin classes, basis-mismatch blocking, exports
  - E05: case extension plus the deterministic narrative
- **Depends on:** D8 and D9.
- **Deliverables:** wrapper module, UI, exports, method note.
- **Verification:**
  - oracle and traverse reference tests within documented tolerance
  - §8 #2, #4 and #5
  - browser evidence
  - independent review and a baseline layer

**Phase 0′: Hosted handoff** (runs in parallel; currently blocked)
- **Scope:** contract v2 (origin allowlist, versioned envelope) in both repos; readiness map; hosted acceptance.
- **Depends on:** Project 1 work; D4; resolving G9 and G10.
- **Deliverables:** Analytics receiver changes; Explorer sender changes, made by the other session.
- **Verification:**
  - §8 #7
  - a real browser handoff at local and deployed origins
  - all fail-closed cases
  - independent review and a baseline layer

**Phase 3: Advanced pressure modeling**
- **Scope:**
  - E06: transient module in a worker, after a D6 design spec that includes r_w
  - E07: only after a Project 1 contract for multi-UIC histories and coordinates (D7)
- **Depends on:** D6, D7 and Project 1.
- **Deliverables:** versioned modules, benchmark fixtures, method notes.
- **Verification:**
  - closed-form and independent numerical benchmarks
  - §8 #6 and #8
  - independent review and a baseline layer

**Phase 4: Regulatory**
- **Scope:** E08.
- **Depends on:** D1.
- **Recommendation:** not in this repo.

**Phase 5: Persistence and reports**
- **Scope:** E09 saved cases; PDFs for the capacity case, sweep and study, rendered from validated exhibits.
- **Depends on:** D10.
- **Deliverables:** a storage contract and PDF families.
- **Verification:**
  - §8 #5 plus integrity tests
  - export parity
  - independent review and a baseline layer

**Process for every phase** (the existing sequence, sample-tour spec §10):
1. plan doc
2. implementation on a feature branch
3. gates
4. browser evidence
5. independent read-only review
6. owner baseline acceptance
7. merge, push and publish only on explicit owner instruction

Workers never stage or commit.

## 6. Success criteria per phase

- **A:**
  - `node scripts/verify-preservation.mjs .` → 0 violations, with the new layer at `status:"accepted"`.
  - `tests/preservation-baseline.test.mjs` and `tests/transfer.test.mjs` pass, and the registry refactor gives identical outcomes for the four existing layers.
  - The amended N/AGENTS.md and product-spec hashes are pinned.
  - The independent reviewer's sign-off is recorded in the baseline.
- **1:**
  - The nested suite is green in an isolated snapshot, with the count recorded and at least the current count.
  - 248 oracle comparisons pass; `tsc --noEmit` passes; `prepare-swd` assembles.
  - New tests prove that:
    - ΔP ≤ 0 is rejected;
    - psig/psia ambiguity blocks;
    - a missing datum blocks;
    - H-10 alone yields no calibrated J;
    - a reported 0 is not treated as missing.
  - §8 #1, #3, #4 and #5 are exercised in a real browser (desktop 1536×1024, mobile 390×844), with captured evidence.
  - The existing sample tour and demo are unchanged.
  - The layer is accepted.
- **2:**
  - The forward (surface-boundary) traverse round-trips against the existing backward traverse within the 0.001 psi convergence tolerance (wellboreTraverse.ts:13).
  - It reproduces manufactured-solution tests.
  - A basis-mismatch comparison is blocked in both the UI and the exports.
  - The three margin classes are visible and labelled "screening".
  - Browser evidence for §8 #2, #4 and #5.
  - The layer is accepted.
- **0′:**
  - The handoff adopts a package from the deployed Explorer origin and from localhost, in a fresh browser.
  - A tampered TAR, wrong origin, wrong schema and missing acknowledgment all fail closed, with the prior case preserved (§8 #7).
  - Portable TAR import is unchanged.
  - Both repos' tests are green.
  - The layer is accepted.
- **3:**
  - Ei/line-source benchmarks and log-approximation limits match to the stated tolerance.
  - Monotonicity and parameter guards are tested.
  - Invalid ranges are rejected or labelled (§8 #8).
  - A two-well case with one missing history reports incomplete, never zero (§8 #6).
  - Real-data mode shows `not_ready` with no silent defaults.
  - The layer is accepted.
- **5:**
  - Save and restore leave the pinned hashes unchanged.
  - Reopening with a failed digest never shows a valid case.
  - Exports are identical before and after a reload.
  - PDFs are byte-stable from the same exhibit.
  - The layer is accepted.
- **All phases:** §8 #10 holds. The demo, sample tour, import workflow, current exports, 182 source hashes and numerical references all still pass.

## 7. Decisions the owner must make

1. **E08 permitting scope.**
   - Options:
     - (a) decline it in this repo;
     - (b) defer it to `ai-swd-permitting`, with Analytics supplying only reviewed engineering inputs;
     - (c) accept it here, amending N/AGENTS.md:3 and N/product-spec.md:13 via a governance layer plus qualified-engineer review.
   - REC: (a) for the first release; (b) if it is ever wanted.
2. **Preservation-gate strategy.**
   - Options:
     - (a) one hand-written layer per feature (about 10);
     - (b) one layer per phase;
     - (c) a one-time, data-driven layer registry accepted as its own reviewed layer, then one layer per phase.
   - REC: (c).
3. **Where the PRD lives.**
   - Options:
     - (a) amend PRD v1.3 in `phi-analytics` (another repo);
     - (b) keep it as a standalone expansion PRD in this repo's `docs/`, updating the N/product-spec.md purpose via the governance layer.
   - REC: (b).
4. **Phase 0 timing and Explorer hosting.**
   - Options:
     - (a) keep the §7 order, with Phase 0 first;
     - (b) decouple: start Phases A, 1 and 2 now, and run 0′ once Project 1 is hosted and the COOP/opener check passes.
   - Also confirm whether Explorer has, or will have, a hosted URL.
   - REC: (b).
5. **E02/E03 scope wording for real H-10 data.**
   - Options:
     - (a) descriptive screening plots on verified public H-10, with calibrated J only from user-supplied or Project 1 test evidence;
     - (b) exclude real-H-10 diagnostics entirely.
   - REC: (a), written into the amended scope line.
6. **E06 P2-A approval.**
   - Decide the bounded design:
     - line-source/Ei with time superposition;
     - infinite-acting, plus an optional single boundary via image wells;
     - required inputs including r_w, and an explicit skin treatment;
     - a benchmark list;
     - execution in a worker;
     - no real-well calibration.
   - REC: approve a design spec first, code after.
7. **New Project 1 contracts.**
   - Decide whether to open Explorer requirements for BHP/SRT datasets, multi-UIC offset histories and coordinates (RRC-07).
   - REC: open them before E03 on real tests and before E07. Phases 1–2 don't need to wait for them.
8. **Gauge→absolute policy for permit pressure.**
   - Options:
     - (a) keep "+14.7 psi, stated per value" as the only supported conversion;
     - (b) require a user-declared basis on each record and block otherwise.
   - REC: (b) for imported evidence, keeping (a) for the sample case.
9. **PVT and traverse domain for real wells.**
   - Options:
     - (a) block with explicit reasons (WHP below 100 psia, NaCl above 20 wt%, TDS without a conversion);
     - (b) extend the correlation bounds, with new validation.
   - REC: (a) now; (b) later as a separately validated item.
10. **E09 persistence.**
    - Options:
      - (a) none, staying session-only;
      - (b) browser-local storage with digest verification and corrected header wording;
      - (c) a Portfolio Supabase schema (separate approval, per root AGENTS.md).
    - REC: defer; if any, (b).
11. **Optional alternative diagnostic for E02.** Add a Hall-plot-style cumulative indicator (screening only, with a declared reference pressure)? REC: ask the owner; include it only if wanted.
12. **Provenance vocabulary.** REC: E01 maps onto the existing importProfile and sampleCase classes and drops PRD §5's new snake_case list.
13. **Independent reviewer for each layer.** GPT-6 Astra is unavailable, and Opus was used last time. REC: name one reviewer per phase before dispatch.
