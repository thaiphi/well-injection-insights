# Shared Architecture and Portfolio Integration

**Version:** 1.2, October 9, 2026. Current owner scope is defined by PRDs 01-03 and the delivery roadmap, including owner-authorized Nexus engineering reuse; feasibility reports preserve dated evidence, not superseded scope restrictions.

## 1. Repository ownership

Owner-confirmed: three new application repositories plus the existing portfolio, four repositories total.

| Repository | Owns | Integration |
|---|---|---|
| phi-analytics | Professional landing page, project cards/detail pages, WPX DMG narrative | Verified links to independently deployed applications |
| texas-rrc-explorer | Public UIC/H-10 acquisition, parsing, identity/quality checks, versioned export and lightweight explorer | Pinned file artifact consumed by Analytics; GIS optional |
| swd-injection-analytics | Synthetic water planning, public injection displays, fictional engineering/capacity scenarios and exhibits | Consumes Explorer artifact; downloads example technical records |
| ai-swd-permitting | Official disposal-permitting corpus, retrieval, grounded research/checklist, source viewer and evaluation | Independent runtime; can reference a downloaded Analytics exhibit as an example |

SWD Intelligence Lab names the initiative/documentation folder, not a combined application repo. WPX remains a case study in phi-analytics. Application code, pipelines, tests and deployment belong in their own repositories. Target names do not establish repo creation or deployment.

Every task brief names the owning repo and permitted paths. Main owns Git/integration/final checks; Astra advises; at most two active subagents.

~~~mermaid
flowchart LR
    R[Official UIC and H-10 sources] --> E[texas-rrc-explorer]
    E -->|Pinned versioned export| A[swd-injection-analytics]
    S[Synthetic water histories and schedules] --> A
    L[Cited study inputs and explicit assumptions] --> A
    A --> X[Downloadable example technical exhibit]
    T[Official TRRC rules forms guidance notices] --> P[ai-swd-permitting]
    X -. User-supplied example reference .-> P
    F[phi-analytics portfolio and WPX narrative] -->|Verified demo link| E
    F -->|Verified demo link| A
    F -->|Verified demo link| P
    E -->|Return link| F
    A -->|Return link| F
    P -->|Return link| F
~~~

GIS/location data may extend Explorer later. No GIS or live-service dependency is required for the core data/engineering story. Permitting does not infer procedural requirements from Analytics results.

## 2. Explorer -> Analytics artifact contract

Use schema version 1 for the initial file contract. Validate actual source fields before the real-source gate; a development fixture can exercise the consumer but cannot certify acquisition.

| File | Grain and required metadata |
|---|---|
| manifest.json | Artifact ID, schema version, source snapshot IDs, official URLs, retrieval times, source revisions where known, hashes and transformation version |
| inventory.csv | One retained source well/permit record; string source-record key and namespaced original IDs including UIC parent/control ID where present; available county/operator/permit fields; source snapshot reference and quality flags |
| injection_monthly.csv | One retained source report row/revision; source-row key, validated parent key or explicit unmatched status, reporting year/month, monthly injected barrels, separate reported average/maximum injection pressures and available annulus fields, source reference, units and quality flags |
| quality_report.json | Source/parsed/accepted/quarantined counts, parsing/null/duplicate/revision issues, parent join cardinalities and unmatched/ambiguous results |
| data_dictionary.json | Field definitions, units, raw/reported/calculated status, missing-value convention, row grain and revision/conflict treatment |

Required column names are settled in the first source-proof task and then pinned in the schema fixture; these metadata/grain requirements are fixed. Preserve original IDs and leading zeros. Never assume shortened API uniquely connects UIC, reports and GIS. Retain conflicts or quarantine them visibly, with mutually exclusive dispositions accounting for parsed rows; issue counts may overlap.

Pressure fields retain source terminology and actual units. Calendar-day average, if calculated, carries its formula and complete reporting-period status. Do not invent daily data, BHP or reservoir pressure. A permit pressure limit retains its source pressure basis and is a regulatory constraint, not an engineering capacity value.

Optional locations are an additional table with CRS, surface/bottom role and reliability. They are not mandatory fields.

Analytics pins an artifact ID/hash. Old artifacts remain reproducible when a refresh creates a new version. A missing monthly table is explicitly marked incomplete and cannot pass the real-history acceptance gate.

## 3. Synthetic, study and exhibit contracts

Planning fixture: fictional producer/cohort/group IDs, dates/resolution, histories, schedules, seed/generator version, frozen forecast ID/cutoff, independently generated actuals ID, model version and units. Future schedule edits cannot rewrite the frozen forecast or historical actuals.

Engineering fixture: fictional injector/scenario IDs, J/pressure/availability/expansion schedules, datum/basis, units, citations or assumption statements, original/selected units and conversions. A paper with inconsistent paired units requires an explicit unit decision; do not silently import contradictions.

Exhibit: selected artifact/fixture/scenario IDs and hashes, date range, input tables, output tables/chart, formulas/model version, units, provenance, assumptions and scope. CSV plus a printable chart is sufficient for the initial slice; elaborate multipage reports are later.

Use provenance labels public reported, literature-derived, synthetic, assumed and calculated. Calculated values retain input lineage; synthetic values retain seed/method; literature values retain paper/table/page and conversions. Do not blend these categories under a real well identifier.

## 4. Corpus contract

Manifest contains stable source/version IDs, title, official URL, publisher, rule/form/guidance/notice type, retrieval time, publication/revision/effective dates where available, hash, extraction status and currentness/conflict notes. Count logical sources once under a declared convention; chunks and duplicate snapshots do not inflate the 20-25 target.

Chunks reference source-version ID plus PDF page or HTML heading/section and excerpt. Generated claims resolve to supporting passages and official links. URL validity alone does not prove support. The permitting corpus remains separate from engineering papers/library docs.

One PDF and one HTML source-to-citation proof precede corpus expansion. A failed generation gate retains labeled deterministic search. Unresolved currentness limits current-requirement claims.

## 5. Portfolio and deployment contract

Each project records slug, title, short description, actual readiness status, thumbnail, technologies, case-study URL, data provenance, last update and limitations. Add demo URL only when functional. The three app URLs are separate deployments and each links back to the portfolio.

Suggested portfolio detail routes: /projects/swd-injection-analytics, /projects/texas-rrc-explorer, /projects/ai-swd-permitting, /projects/dmg-reservoir-modeling. Do not invent hosts or publish placeholder demo links. Preserve Lovable-connected history; no rewrite of published commits.

Analytics reuses the existing Nexus TypeScript calculator/PVT/black-oil modules and pyResToolbox MCP reference workflow; the owner has authorized extraction into `swd-injection-analytics`. Carry required types/helpers and reference tests, and replace Nexus layout/authentication/persistence bindings with the receiving application's interfaces. See [the reuse record](feasibility/2026-10-09-nexus-engineering-reuse.md). MCP is the development/reference workflow in the inspected implementation, not an established browser runtime dependency; new direct Python execution is an owning-repo implementation choice.

Other implementation choices remain proposals until selected in each owning repo: Python acquisition, versioned CSV/JSON, a lightweight standalone UI, server-side retrieval/inference. The existing portfolio remains its React/TypeScript/Tailwind app. A shared database, statewide ingestion and live cross-service calls are unnecessary. SWD-specific integration and numerical checks accompany reuse; no fresh whole-library adoption spike is required.

## 6. Acceptance gates

- Reprocess pinned official inputs; verify original record identity and one real UIC/H-10 history.
- Keep source counts, record dispositions, nulls/revisions and calculations inspectable.
- Prove forecast holdout, calendar arithmetic and injection/capacity fixtures independently.
- Keep synthetic/study assumptions separate from real public records and regulatory constraints.
- Verify citation passage support/currentness, including unsupported/conflicting/injected cases.
- Inspect downloaded exhibits and fresh-browser app/portfolio/return links.
- Keep credentials server-side, bound public LLM requests and preserve the private legacy checkout.
- Mark local/search/synthetic fallbacks accurately; none is evidence of a passed missing gate.
