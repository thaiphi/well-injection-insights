# Bounded brine and parser correctness — October 10, 2026

**Receiver continuation:** the owner subsequently authorized correcting the Explorer receiver mismatch within the same deadline. [Receiver correctness report](2026-10-10-receiver-correctness.md) records the additional changes, preservation checks and final gates. The earlier verification below remains the brine/parser checkpoint record.

Owner authorized this bounded continuation with a hard stop of **10:37 p.m. CDT October 10 / 03:37 UTC October 11**. Work started at 02:52:25 UTC. Only `swd-injection-analytics` changed. No deployment, permission changes, Git writes, dependency installation, sibling edits or existing-data replacement occurred. The broader redesign/feature inventory is outside this continuation.

## Outcomes and requirement coverage

| Requirement / completion gate | Result |
|---|---|
| SWD-09 / A5 — engineering reuse and brine correctness | Live application paths already used the corrected source-checked gas-free brine method. No equation or numerical model was replaced. Added 60-point physical screening and a source-import regression gate keeping retained defective Nexus engineering out of production dependencies. |
| SWD-08 — technical evidence | PVT result provenance, JSON, CSV and SVG embedded metadata distinguish 45-case source agreement, limited physical screening and excluded historical water-FVF evidence. Serializer/value/provenance tests pass. Fresh browser downloads were not performed in this continuation. |
| SWD-13 / A0 — CSV/XLSX input boundary | Reject trailing/concatenated DEFLATE data and parser-equivalent ZIP-member aliases. Derive worksheet bounds from actual cells so inaccurate dimensions cannot hide rows or bypass existing extent limits. |
| SWD-14 — provenance, invalidation, independent readiness | Original upload bytes/hashes preserved. Browser confirmation retained user origin plus synthetic classification; CSV replacement invalidated XLSX confirmation; one-row history remained usable while fitting/capacity stayed blocked. |
| SWD-04 — preserved public-source evidence | No public pin, artifact, acquisition evidence or Explorer package contract changed. Existing public-consumer and transfer regressions pass in the integrated suite; no new Explorer implementation claim. |

The governing PRD and completion plan remain authoritative. **Overall product acceptance stays OPEN.** This continuation closes the reproduced boundary defects; it does not close comprehensive parser/dependency auditing, full fluid-domain validation, SWD-11 or all two-app acceptance criteria.

## Brine finding and retained evidence

The live `brineProperties` adapter, standalone PVT, connected disposal model and variable-pressure/temperature wellbore traverse already use `brineAtPressure`/the attributed pyResToolbox adaptation. At fixed temperature/salinity, live Bw decreases and density increases with absolute pressure. No live numerical defect requiring a new correlation was found in this bounded review.

Retained `src/vendor/nexus/utils/pvt/correlations.ts:922–930` uses a negative pressure term with `(1-A)`, producing the wrong increasing Bw trend. Its pressure conversion is not the defect. At 180°F and 100→10000 psia, historical freshwater Bw rises 1.032020→1.065740 while live Bw falls 1.029292→1.000142. That legacy implementation and the original tolerance fixtures remain byte-for-byte preserved. The historical black-oil table's callers are reference tests and the carried-oracle script; no unused replacement black-oil model was introduced.

The new dependency test examines literal imports/re-exports/dynamic imports in production source, including vendor dependencies outside the historical Nexus tree. It is a regression gate when tests run, not a runtime prohibition or an independent security boundary. Historical reference tests remain explicitly separate.

New physical screening covers four temperatures (60, 100, 180, 250°F), three NaCl concentrations (0, 5, 20 wt%) and five pressures (100, 1000, 3000, 6000, 10000 psia): decreasing Bw, increasing density, positive Cw and constant `density × Bw` at fixed composition/temperature (relative tolerance 1e-12). Existing 45 recorded source-library cases still check four properties. These establish bounded invariants and source fidelity, not independently validated physics across the entire fluid domain. Cw remains the documented Spivey formulation, not a required derivative of the IAPWS-adjusted density.

## Parser repairs and limits

1. Native raw-DEFLATE decoding can accept trailing compressed input without reporting consumption. After the existing incremental expanded-size and CRC checks, the pinned SheetJS/CFB inflater's read head must equal the member length. Normal/streaming, empty, fixed/dynamic/stored blocks and multiblock forms are covered; trailing bytes and concatenated streams fail. No new decoder or dependency was added.
2. Raw ZIP names that resolve to the same pinned-parser member through case, separators or parser-root normalization fail before workbook selection.
3. `nodim:true` derives worksheet extent from actual cells. Tests preserve rows hidden by an understated dimension and sparse physical row positions, reject hidden out-of-limit cells, and preserve empty worksheets as empty.

The endpoint probe depends on pinned internal CFB behavior and briefly allocates a private compressed copy plus expanded output (within the existing validated 40 MiB expanded-member limit). Together with native validation and workbook parsing this adds a decode pass. **There is no hard peak-memory guarantee.** Broader XML/workbook ambiguities, parser dependency security and resource exhaustion remain outside this bounded audit. Native trailing-data observation remains unchanged as a test of the native API; the application boundary now rejects the corresponding archive.

## Verification

| Check | Actual result |
|---|---|
| Build | PASS — `node node_modules/typescript/bin/tsc -p tsconfig.json` |
| Type check | PASS — `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` |
| Import syntax | PASS — `node --check web/import-file.mjs`; worker also checked the new parser test. |
| Integrated tests | **PASS 329/329**, zero failures/skips, in a complete isolated snapshot. Exact command/cwd and logs: [gates.json](../tmp/correctness-2026-10-10/gates.json), [suite log](../tmp/correctness-2026-10-10/gate-2.log). |
| Historical reference reproduction | **PASS 248 comparisons**, 28 pressure points, four cases, zero failures. Ran the artifact-writing script only in the snapshot; original coverage artifact preserved. [Log](../tmp/correctness-2026-10-10/gate-3.log). |
| Independent review | GPT-6 Astra/high independently ran **54/54** focused tests plus a hidden-row probe and baseline hash inspection; no remaining scoped P1/P2 findings. [Review record](../tmp/correctness-2026-10-10/independent-review.md). |
| Fresh actual browser | PASS — malformed compressed workbook blocked; inaccurate-dimension workbook recovered source row 2 and normalized 100 STB/day to 3100 bbl for October 2025; confirmation hash matched original bytes. CSV selection invalidated prior confirmation; missing mappings quarantined the row; corrected CSV reached history analysis. PVT five-point Bw decreased 1.030683→1.003660 at 180°F/5 wt%, input edit cleared results/disabled exports, equal endpoints blocked calculation. [Checks](../tmp/correctness-2026-10-10/browser/checks.json). |
| Preservation | Original source/vendor/reference/data/fixture bytes checked against starting hashes; see [preservation audit](../tmp/correctness-2026-10-10/preservation.json). Only explicitly listed implementation/generated/documentation changes are allowed. |
| Local listener test | **COULD NOT RUN** — known sandbox listener EACCES; no denied retry, escalation or permission change. Existing running app verified through supported browser controls. |
| Lint / upstream / new browser downloads | **UNRUN** — no installed ESLint assumed; no full upstream Vitest/live MCP, fresh browser-download parity or measured-fluid calibration performed. Serializer/export regressions pass; this does not turn an unrun download check into a pass. |

Initial regression tests deliberately failed before repair: native trailing/alias acceptance and missing worksheet rows were reproduced. The new brine disclosure test also failed before metadata was added; the physical and live-call-path checks already passed. These expected RED results are not unresolved final failures.

One evidence assertion initially failed because a collapsed lineage disclosure was absent from the retained DOM text. Main opened the real disclosure, saved a separate expanded snapshot and verified the CSV hash there; the original snapshot and [failed-check explanation](../tmp/correctness-2026-10-10/browser/evidence-check-history.md) remain retained. This required no application change. Final retained-DOM/hash/history assertions pass.

## Changed files and ownership

Main: `src/brinePvt.ts`, new `tests/brine-physics-boundary.test.mjs`, `product-spec.md`, this note and the completion-ledger append. Rebuilt outputs: `dist/brinePvt.js`, `dist/brinePvt.d.ts`, `dist/disposalCase.d.ts`, `dist/disposalSensitivity.d.ts` (inferred provenance types only for the latter two).

GPT-6.1 Sol/high: `web/import-file.mjs`, new `tests/parser-correctness.test.mjs`. GPT-6 Astra/high supplied bounded brine advice and independent final review. At most two active subagents; exclusive writes, no children. Scratch fixtures, screenshots and verification scripts are under `tmp/correctness-2026-10-10/`; no reference fixture was repurposed as test output.

Screenshots: [PVT results](../tmp/correctness-2026-10-10/browser/brine-results.jpg), [blocked PVT](../tmp/correctness-2026-10-10/browser/brine-blocked.jpg), [rejected workbook](../tmp/correctness-2026-10-10/browser/import-rejected.jpg), [recovered XLSX/readiness](../tmp/correctness-2026-10-10/browser/import-recovered.jpg), [mapping failure](../tmp/correctness-2026-10-10/browser/mapping-blocked.jpg), [imported CSV history](../tmp/correctness-2026-10-10/browser/imported-history.jpg). Existing user tabs/cases remain intact; the separate verification tab is temporary.
