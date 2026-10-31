# Phase 1b: BHP and step-rate test records with guided review

Date: 2026-10-29. Status: design approved in conversation by the owner (sections 1–3); written spec approved 2026-10-29; amended 2026-10-30 from Explorer's actual v4 contract (§10), amendments await owner review with the plan.
Requirement: Project 2 PRD v1.1 **ANA-E01** (measurement-aware evidence model) and the test-overlay part of **ANA-E02** (`docs/project-2-swd-injection-analytics-expansion-prd.md`); acceptance scenarios §8 #1, #3 (provenance part), #4, #5, #12, #13. Decisions: D7, D8, D12, D19 (`docs/project-2-decisions-2026-10-20.md`). Label mapping: `swd-injection-analytics/docs/2026-10-28-e01-data-labels.md`.

## 1. Purpose

Let a visitor bring public bottomhole-pressure (BHP) and step-rate test (SRT) records for the selected injector into the app, see each record labelled honestly (basis, depth, date, source), and **choose which tests are comparable** before reading any pressure trend. Same pattern as Phase 1a: the system flags, the user decides, every decision is recorded.

The evidence well is **Barbaro 23 SWD (UIC 000125182)**. Explorer collected it on 2026-10-30 (texas-rail-sync main 3cefa99, query version 4): 4 BHP tests (2022-11-07 1445 psia at 2228 ft; 2024-03-03, 2024-06-07, 2024-09-19 at 2396 ft: 1674, 1690, 1732 psia) and 1 SRT (2022-11-07, perforations 2395–4569 ft, frac pressure 1544 psig, ISIP blank). Its first BHP test was taken at a different depth on the SRT date, before the H-10 range (2023-10 to 2026-09): that is the data choice this phase teaches. The Explorer owner kept the handoff gate, so Barbaro is **not** a built-in sample in this phase (see §7).

This is evidence review only. No depth correction, no psig↔psia conversion, no reservoir pressure, no injectivity index (J). Test availability does not imply a measured reservoir pressure or an identifiable J (E01 acceptance).

## 2. Where it lives

A new **Test records** panel in the **Injector history** workspace (`publicTrends`), directly below the Phase 1a H-10 diagnostics panel. No new navigation tab (D19). Hidden when no artifact is selected, like the 1a panel.

Records come from two sources for the selected well:
- **Explorer package:** `tests_bhp.csv` / `tests_srt.csv` inside a verified package of query version 3 or later (§5.1).
- **Panel upload:** a CSV in Explorer's column layout (§5.2).

With neither, the panel shows "No test records for this well" and the upload control.

## 3. Record model (E01, mapped per D12)

Each row becomes one typed record:

| Field | BHP | SRT |
|---|---|---|
| well | `uic_number` | `uic_number` |
| identity (Explorer's rule) | `source_report_id` + `tracking_no` + `test_sequence_no` | `source_report_id` + `tracking_no` |
| date | `report_conducted_date` (ISO) + `_text` (verbatim) | `test_date` (ISO) + `_text` |
| pressures | `bhp_psia` | `isip_psig`, `formation_frac_press_psig`, `surface_pressure_firc_psig` |
| basis | `psia as named by the source field`: RRC Permian guidance (bhp-permian-nto.pdf p.1) says BHP is reported in PSIG; the conflict is unresolved and the value is never converted | `gauge_psig` (from the column name) |
| pressure type | `not stated in source` (never inferred) | `not stated in source` |
| depth | `test_depth_ft` (or missing; never guessed) | `top_perf_ft`–`bottom_perf_ft` |
| other values as reported | `gradient_psi_ft`, `tested_formation` | `satisfactory_test_code` (shown verbatim; meaning undocumented), `formation_tested`, `min/max_inj_rate_bpm`, `frac_inj_rate_capacity_bpd`, `fracture_gradient_psi_ft`, `comments` |
| lineage | `source_row_key`, `source_snapshot_id`, `quality_flags`, original column names | same |
| origin | package: `public` / `public-reported`, label "Explorer package, verified"; upload: `user` / `raw-not-verified`, label "User upload, not verified", with the file SHA-256 | same |

Values are kept exactly as published. Nothing is converted. Every displayed pressure carries its unit and basis ("psia, as reported" / "psig, as reported").

## 4. Behaviour

### 4.1 Flags (the system proposes)

| Flag | Applies to | Rule | Reason shown |
|---|---|---|---|
| `no-pressure` | BHP | `bhp_psia` blank | "No bottomhole pressure reported." |
| `no-pressure` | SRT | ISIP, frac pressure and FIRC surface pressure all blank | "No test pressure reported." |
| `no-date` | both | ISO date missing or invalid (source text still shown) | "Test date missing or not a valid date." |
| `no-depth` | BHP | `test_depth_ft` blank | "No test depth reported; the test is not placed at any depth." |
| `depth-differs` | BHP | depth differs by more than 10 ft from the reference depth | "Tested at a different depth from this well's other tests (reference N ft); not directly comparable." |
| `duplicate-report` | both | same identity more than once, within or across sources | "More than one record with this report identity." |
| `source-quarantined` | both | Explorer's `quality_flags` contain a quarantine reason (prefix `parse_failure`, `invalid`, `inconsistent`, `duplicate`, `unmatched`, `ambiguous` or `source_scope`) | "Explorer quarantined this row: <its flags>." |

- **Reference depth:** the depth shared (within 10 ft) by the most BHP tests that have a depth. With a tie for most, there is no reference and every BHP test with a depth is flagged `depth-differs` with the reason "No single most-common test depth; tests are not directly comparable."
- There is no "not satisfactory" flag: Explorer's dictionary states the `satisfactory_test` code meaning is undocumented (values 0/1 shown verbatim), so the code is displayed as published with "meaning undocumented" and never interpreted.
- Explorer's non-quarantine flags (for example `missing:isip_psig`) are shown beside the record as notes, without a decision effect.

### 4.2 Decisions (the user chooses)
- Flagged records start **excluded** with the reason; unflagged records start **included**.
- The user can re-include a flagged record, or exclude an unflagged one with a reason (1–200 characters after trimming).
- A record without a usable value (no pressure, no date, or for the BHP chart no depth) can be re-included in the list but contributes to no chart; this is stated beside it.
- Decisions are session-only and reset when the well, the source, the package or the uploaded file changes.

### 4.3 Test-pressure chart (BHP only)
- Reported BHP (psia) against the actual test date on a real time axis, for included BHP tests with a pressure, a date and a depth. Each point is labelled with its depth.
- Fixed label: "Bottomhole pressure as reported. Source field named psia; RRC Permian guidance says PSIG; unresolved, not converted. Test type not stated in source. Not a reservoir pressure estimate and not an injectivity index (J)."
- With fewer than **2** qualifying tests: "Not enough comparable tests (n of 2 needed)".
- SRT values (psig, different quantities) are never placed on this axis.

### 4.4 SRT table
Date (ISO and text), satisfactory code as published (meaning undocumented), perforations, rate range, ISIP, frac pressure, FIRC surface pressure, fracture gradient, frac rate capacity, comments. Pressures labelled "psig, as reported"; blanks shown as "not reported".

### 4.5 Markers on the 1a timeline
Each included BHP or SRT record with a valid date inside the H-10 calendar range gets a dated tick on the 1a "pressure per unit rate over time" chart, with a distinct shape per test type and a tooltip (type, date, pressure with basis). A marker is never joined to a month's values. Records dated outside the H-10 range get no marker; the panel lists them as "before the reported H-10 range" or "after the reported H-10 range". Markers are on screen only: the 1a exports (JSON, CSV, SVG) stay exactly as they are and never include test markers.

### 4.6 Readiness
- A fixed line: "Calibrated injectivity (J): not ready. Needs a flowing bottomhole pressure with a same-time rate and a reservoir pressure reference (Phase 1c)."
- The panel uses the workspace gate (`publicCalculationGate()`) as 1a does: when not ready, records, flags and decisions still show for inspection, but the chart, markers and exports are blocked with the gate's reasons.

## 5. Inputs

### 5.1 Explorer package receiver (`web/explorer-package.mjs`)
- The legacy pin and query version 2 packages behave exactly as today.
- Query version **4** is accepted (Explorer's current producer, `rrc-odp-v2.2.0`). Versions 3 and 5 are refused as "Unsupported Explorer query version" until their exact contracts are added. The H-10 verification runs with the v4 acquisition scope, targets, manifest scope and source list rebuilt exactly as the producer builds them (Explorer `src/sources.mjs`, `src/artifact.mjs` at 3cefa99); normalized rows, quality report and dictionary are re-derived as for v2.
- Every file must still be declared in `manifest.files` with a matching SHA-256 and size; an undeclared file still rejects the package.
- Declared files that 1b does not use (`casing.*`, `plugging.*`, `wellbore_dictionary.json`, `evidence_relations.json`, and any other declared file) are hash-checked and otherwise ignored.
- In a v4 package `tests.json`, `tests_bhp.csv`, `tests_srt.csv` and `tests_dictionary.json` are required. They are re-derived from the hashed raw `sources/candidate-bhp.json` and `sources/candidate-srt.json` with Explorer's `normalizeTests` rules and must match **byte for byte**; `tests_dictionary.json` must equal Explorer's constant public dictionary (SHA-256 `690574e58f75535d546dd14a1ab51c8bf7e480f0b2674e0eb501ef0cfd9699d4`). Every raw test row must have `uic_no` equal to the package UIC, and fewer than 1,000 rows per dataset.
- Wellbore files (`casing.*`, `plugging.*`, `wellbore_dictionary.json`) and their raw sources and documents are checked by hash, byte count and retrieval sidecar (`.source.json`: URL, HTTP 200, not a fixture, SHA-256, bytes) only.
- Any test-file failure rejects the whole package with a reason. Nothing is partly adopted.
- `normalized.json` keeps its 7 keys and `schemaVersion` 1.

### 5.2 Panel upload (CSV only)
- One file at a time, BHP or SRT, detected from its header. Strict UTF-8 via the existing `parseCsv`. Values are read with Explorer's rules: numbers must match `^-?\d+(\.\d+)?$` (blank means not reported), dates must be valid `YYYY-MM-DD` (blank means missing), `quality_flags` is split on `|`. An uploaded `quality_flags` column is taken as supplied and labelled unverified.
- The header must be exactly Explorer's BHP or SRT column set (any order). Missing or extra columns, more than 1,000 rows, formula-like cells (`=`, `+`, `-`, `@` prefixes on non-numeric text) or a `uic_number` different from the selected well reject the whole file with a reason.
- A new upload of the same type replaces the previous upload of that type; package records stay.
- XLSX is not accepted (owner decision: Explorer's layout is CSV).

## 6. Exports
Three downloads: JSON (sealed), CSV and SVG, following the 1a `h10DiagnosticsExport.ts` pattern.
- **Content:** method version `test-records/1`; well; source identity (package artifact ID, normalized and manifest SHA-256, test file SHA-256s; or the upload file name and SHA-256); every record with values as reported, unit and basis, depth, flags, decision, reason, whether it contributed; reference depth; out-of-range list; the J readiness line; fixed limitations.
- **Integrity:** JSON carries its own content SHA-256; CSV has metadata, notice and limitation headers, quotes every cell, prefixes formula-like text with `'`, writes `unavailable` for null; SVG embeds the full JSON in an escaped `<metadata>` block.
- **Invalidation:** a revision counter increments on any decision, well, source, package or upload change; a download whose revision is no longer current is refused (§8 #5).

## 7. Out of scope
- Barbaro 23 as a built-in sample or bundled fixture: a follow-up after this phase passes and the owner lifts Explorer's handoff gate (Explorer requires our v4 receiver test first).
- Depth correction using the reported gradient; psig↔psia conversion; reservoir pressure; J and its readiness beyond the fixed line (Phase 1c; E03/E04).
- Casing, plugging and evidence relations content (received and ignored).
- XLSX upload; saved decisions (D10).

## 8. Architecture

| Unit | Responsibility | Depends on |
|---|---|---|
| `src/testRecords.ts` (new) | Parse BHP/SRT rows (exact headers) into typed records; reference depth; flags; initial decisions; `applyDecision`; chart series; out-of-range split against an H-10 month range; coverage counts. Pure, no DOM. | `src/importProfile.ts` types/labels, `src/planning.ts` month helpers |
| `src/testRecordsChart.ts` (new) | `testPressureSvg(series)`; `timelineMarkers(records, range)` returning marker data for the 1a chart. Escaped text, real time axis. | patterns from `src/h10DiagnosticsChart.ts` |
| `src/testRecordsExport.ts` (new) | seal, verify, JSON, CSV, SVG. | `src/testRecords.ts` |
| `web/test-records.mjs` (new) | Session (revision, decide, upload, dispose, exportRequest) and `mountTestRecords(root, {...})`. No DOM work at import time. | compiled `dist/*` |
| `web/explorer-package.mjs` (protected; edit) | Accept query version ≥3; verify declared extra files; parse and re-derive test files (§5.1). | — |
| `web/import-ui.mjs` (protected; edit) | Mount the panel below the 1a panel; dispose wherever results are cleared; pass package test records and the H-10 range. | — |
| `src/h10DiagnosticsChart.ts`, `web/h10-diagnostics.mjs` (accepted layer files; edit) | Optional marker input on the ratio-over-time chart. With no markers, output is byte-identical to today. | — |

Data flow: selected well → test rows (package and/or upload) → records → flags → decisions → chart, markers, SRT table → sealed export. A change at any step clears everything downstream.

## 9. Testing and acceptance
- **Unit (Node, `tests/test-records*.test.mjs`):**
  - **Synthetic well** in Explorer's exact layout (not Barbaro's data; fictional UIC 000000417): 3 BHP tests at one depth, 1 at another, 1 SRT; plus rows that trigger every flag, the reference-depth tie, and tests before and after an H-10 range. Checks exact flags, initial decisions, reference depth, out-of-range lists.
  - **Parser:** exact-header acceptance in any order; missing/extra column, formula-like cell, wrong UIC, over 1,000 rows each rejected with a reason.
  - **Decisions:** re-include a flagged test; exclude an unflagged test without a reason is rejected; a re-included unusable test contributes no point; fewer than 2 qualifying tests gives "not enough".
  - **Export:** sealed JSON hash round-trip; CSV escaping and `unavailable`; SVG metadata holds the JSON; stale revision refused; blocked gate refuses exports.
  - **1a markers:** ratio chart with no markers is byte-identical to the current output; markers appear only for in-range included tests.
- **Receiver (`tests/explorer-package*.test.mjs`):** a query-version-4 package built in memory by a test-only helper from the committed v2 fixture, with the UIC rewritten to the fictional 000000417 and synthetic test, casing and plugging rows (no fabricated package is committed), with `tests.*`, `casing.*`, `plugging.*` and `wellbore_dictionary.json` declared (Explorer 3cefa99 does not emit `evidence_relations.json`) is accepted and yields the test records; an undeclared file, a tampered `tests_bhp.csv` (hash), and a test row that does not match its raw source are each rejected; the existing v2 fixture and the legacy pin still pass unchanged. This test is the evidence Explorer's owner needs to lift the handoff gate. With the owner's permission, Main also runs the receiver once, locally, against the real Barbaro 23 v4 artifact read from Explorer's repository (nothing copied or committed) and records the result.
- **Regression:** nested suite `node --test tests/*.test.mjs` (468 + new); `node scripts/check-carried-oracles.mjs` (248/0); root suites (transfer, preservation-baseline, layer-registry); `node scripts/prepare-swd.mjs` then the transfer static-assembly test; the 1a panel, its exports and the Injector history table/charts unchanged apart from the markers.
- **Browser (desktop and 390px):** import the synthetic v4 package; check flags and the off-depth test excluded; re-include it and see the chart change; upload a valid CSV and a rejected CSV; export all three formats; switch wells and confirm the review resets and the old export is refused; no page-level horizontal scroll.
- **Preservation:** registry layer `test-records`. `changes`: `web/explorer-package.mjs`, `web/import-ui.mjs`, `src/h10DiagnosticsChart.ts`, `web/h10-diagnostics.mjs` (archived before editing). `newFiles`: the units in §8 and their tests and fixtures. `approvedDocs`: this spec and its plan. Then an independent Opus review (D13) and owner acceptance.

## 10. Amendments (2026-10-30, from Explorer's v4 producer at commit 3cefa99)
1. **BHP basis conflict.** Explorer's dictionary records that the source field is named psia while RRC Permian guidance says BHP is reported in PSIG. The basis is labelled as that unresolved conflict; nothing is converted.
2. **No "not satisfactory" flag.** The `satisfactory_test` code meaning is undocumented, so the code is shown verbatim and never interpreted.
3. **Explorer quarantine.** A new `source-quarantined` flag carries Explorer's own row quarantine; record identity follows Explorer's rule (BHP adds `tracking_no`).
4. **Query version 4 exactly.** v3 and v5 are refused until their contracts are added; the v4 contract is rebuilt exactly and the test sidecars are compared byte for byte.
5. **Test package.** Built in memory from the v2 fixture with a fictional UIC; optional owner-approved local check against the real Barbaro 23 artifact.
