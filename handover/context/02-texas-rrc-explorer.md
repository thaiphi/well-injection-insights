# PRD 02 — Texas RRC Data Pipeline and Explorer

**Version:** 1.2, confirmed read-only collection map and run evidence, October 9, 2026

**Repository:** texas-rrc-explorer (new, separate application)

**Priority:** P0 data foundation

**Status:** One bounded public snapshot/export and dated checks are reusable; full P0 inspection acceptance is open. Read-only workflow visualization and run-event instrumentation are NOT STARTED. See the [measurable completion plan](2026-10-09-plan-compliance-completion.md).

**Target:** Bounded reproducible public-data export before October 14, 2026

## 1. Purpose

Collect, parse, validate and export relevant official TRRC well/permit and injection-monitoring records for swd-injection-analytics. A lightweight explorer makes those records inspectable. County GIS and maps are optional; they do not block injection-history or forecasting work.

## 2. Core sources

| Source | Desired fields, subject to actual validation | Use |
|---|---|---|
| UIC inventory | Original control/API/operator identifiers, county, available well/permit attributes, permitted intervals and authorized volume/pressure | Well/report identity and regulatory-constraint context |
| H-10 reports | Year/month, injected barrels, reported average/maximum injection pressure and available annulus fields | Descriptive monthly injection histories |
| County GIS, optional | Locations, CRS, surface/bottom role and reliability | Geographic features if a concrete workflow needs them |

Prefer documented official downloads/exports; use bounded public web acquisition only where access/usage permits. Preserve raw source files/records and exact URL, retrieval time, revision where available and hash. Do not bypass access controls or limits.

Initial target: one verified well/report history and a small inventory; Reeves is a starting candidate. The [reconnaissance](feasibility/2026-10-08-data-findings.md) verified a Reeves GIS archive but did not parse UIC/H-10 rows. That October 8 evidence did not establish the core pipeline. The subsequently acquired artifact `rrc-2026-10-09-uic000020838-v1` contains five inventory records and 28 parent-matched reports for UIC `000020838`, January 2024–April 2026, with raw sources, dictionary, quality report and hashes. This is bounded reusable evidence, not statewide coverage, current operating-status proof or acceptance of the new visualization.

## 3. P0 workflow

1. Run repeatable acquisition/import scripts for the selected official snapshot or documented export.
2. Inspect quality summary and inventory table; filter county/operator only where supported.
3. Inspect original identity, source fields, monthly history and provenance for a selected record.
4. Download a pinned artifact and data dictionary for Analytics.
5. Reimport pinned inputs and reproduce normalized values/counts without a live query.
6. Inspect the confirmed read-only collection map and a selected run's actual recorded events, status, errors, outputs and source lineage. The map does not edit or trigger collection.

No GIS/map dependency, live cross-service API or shared database is required.

## 4. Identity, grain and transformations

- Keep namespaced string identifiers and leading zeros. Shortened API is not assumed unique.
- Verify UIC parent/control linkage for H-10 children. Year/month is not a complete well identity.
- Separate inventory from monthly observations. Preserve source record/revision and reporting period; do not silently deduplicate conflicts.
- Preserve reported pressure fields/units. They are not inferred BHP, reservoir pressure or formal injectivity-test data.
- Barrels divided by actual calendar days is a calculated calendar-day average; do not invent daily measurements.
- Distinguish zero, missing, parsing failure, unmatched parent and ambiguous join. Count exclusions and unresolved records.
- Label permit maxima as regulatory constraints; do not infer sustainable capacity or current operating status.
- Optional GIS retains CRS, location role and reliability. Missing/invalid coordinates remain in the table and are excluded from map placement.

## 5. Versioned export

Deliver inventory.csv, injection_monthly.csv, manifest.json, quality_report.json and a data dictionary under [Architecture and Integration](05-architecture-integration.md). Explicit column names/dictionary carry units. Manifest records source/schema/transformation versions and hashes. Quality report accounts for raw, accepted, excluded, unmatched and ambiguous records.

Analytics consumes a pinned artifact. Refreshes create a new version and retain old exhibit reproducibility. Optional locations may be an additional table, not mandatory core columns.

## 6. Requirements

| ID | Requirement | Priority | Acceptance |
|---|---|---|---|
| RRC-01 | Repeatable official UIC import | P0 | Raw source/manifest preserved; original record resolves to normalized inventory |
| RRC-02 | Real H-10 parsing/parent linkage | P0 source gate | One real well's monthly rows trace to actual parent; volumes/pressures manually reconciled |
| RRC-03 | Identity/normalization audit | P0 | Leading zeros, revisions and ambiguous matches retained |
| RRC-04 | Quality report/dictionary | P0 | Counts reconcile; missing versus zero and units documented |
| RRC-05 | Versioned Analytics export | P0 | Consumer loads same artifact; values trace to source or stated calculation |
| RRC-06 | Searchable table/details | P0 | Filters/export agree with source-derived counts/values |
| RRC-07 | Optional GIS/map | P1 | Sourced CRS/coordinates validated; symbology does not establish SWD/active status |
| RRC-08 | Scheduled refresh/statewide coverage | P2 | Reviewed access limits, version comparisons and expanded validation |
| RRC-09 | Read-only collection workflow visualization | P0, owner-added October 9 | Map shows actual fixed collection stages and evidence for the selected run; selecting a node inspects details only; no editing, rearranging, arbitrary authoring or drag/drop |
| RRC-10 | Actual run-event/status/error/output provenance | P0, owner-added October 9 | Unique run/stage events trace status and errors to execution and source/output hashes; historical unavailable events stay unrecorded; failed/skipped stages cannot appear successful |

## 7. Deadline cuts and done

Prove UIC/H-10 before geographic polish. If H-10 linkage fails, deliver the verified UIC inventory/provenance slice with injection history incomplete. If inventory is also unverified, show source/method evidence and in-development status. Synthetic rows never substitute for public records. Analytics continues its independent synthetic/study slice.

Done means repeatable source-traceable export and lightweight inspection, with real injection history claimed only after its gate passes. GIS, statewide scraping, produced-water acquisition, compliance monitoring and approval prediction are not core deadline requirements.

## 8. Confirmed read-only collection map and run record

**Owner-confirmed October 9:** “The workflow map is just show what we did. Not something that user can edit.” The map visualizes the existing fixed executable pipeline. It has no node editing/rearrangement, arbitrary workflow authoring or drag/drop builder. It does not add a Run, Retry or Schedule control; viewing history/status is separate from triggering collection. Collection continues through the existing documented CLI/manual invocation unless the owner separately requests trigger controls. Scheduled refresh remains RRC-08/P2.

Show the actual applicable stages: official acquisition (or explicitly identified offline source loading), raw/metadata preservation, parsing/normalization, parent linkage/quality checks, and versioned export. Show the contract handoff to Analytics as an external consumer boundary. An Analytics pin acknowledgement may appear only when that consumer supplies verifiable evidence; exporting alone cannot mark consumer loading successful. Collapse combined stages only when that matches the real execution instrumentation, retaining their evidence details.

RRC-10 records run ID, invocation mode/time, pipeline/schema/transformation versions, stage/event ID, timestamps and status (pending/running/succeeded/failed/skipped), input snapshot/source URLs and hashes, output paths/hashes/counts, row dispositions, and structured error code/message. Status follows actual events. Redact secrets/internal-sensitive values from displayed diagnostics. A failed stage leaves downstream stages skipped/unexecuted and does not label a partial artifact verified. A retry/refresh is a separately identified invocation with its own record; preserve earlier failures and artifact versions.

For the current historical artifact, display manifest/source evidence that actually exists and label absent execution timing/status events **unrecorded**. Do not synthesize a successful historical run from timestamps or reconstruct unsupported stage events. An offline replay after instrumentation supplies real replay events but remains labeled offline, not fresh public acquisition. Synthetic failure/event fixtures can test presentation only when explicitly marked **test fixture**; they never populate actual-run history as real runs.

Acceptance: inspect one real instrumented offline replay and one bounded controlled failure; node states, chronological events, counts, source/output hashes and error evidence agree with the recorded execution. Historical unrecorded fields remain unrecorded; a failing required stage cannot pass the export/source gate. Complete keyboard/mobile node-detail inspection and confirm there are no editing or execution-trigger controls. Implementation of RRC-09/RRC-10 is **NOT STARTED**.
