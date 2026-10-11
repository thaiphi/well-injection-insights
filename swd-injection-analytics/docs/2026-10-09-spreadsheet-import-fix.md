# Spreadsheet import boundary repair — October 9, 2026

The bounded spreadsheet repair is complete. **Full application acceptance remains open.** Independent review passed for this repair and for the preceding imported-demand correction. No commits, pushes, deployment, permission changes, dependency installation or vendor edits were made.

Human authorization: “do it” after the recommendation to independently review demand and repair the spreadsheet error-cell and archive-directory defects. Work began at **2026-10-10 03:20:21 UTC** (October 9, 10:20:21 PM CDT), with the existing one-hour checkpoint at **04:20:21 UTC**. This report ends this bounded run before that checkpoint; no timebox is renewed.

The owning AGENTS instructions, shared delegation workflow, approved PRD and completion plan were read first. Completion-plan A0 import-boundary validation and A4 provenance invariants govern this correction. Existing source layout and numerical models were retained. Before snapshots and a 48-file SHA-256 manifest preserve evidence of the unrelated uncommitted work, source pins, reference fixtures and vendor files.

## Behavior and causes

Excel error cells previously became strings such as `Spreadsheet error: 7`. Direct normalization could accept that string as a producer identity, while the browser's prefix-based containment also rejected legitimate CSV text. Error cells now remain typed as `{spreadsheetError: originalCode}` through parsing and lineage. Any error cell in a selected data row, including an unmapped column, quarantines the row and prevents confirmation. Standard labels such as `#DIV/0!`, `#REF!` and `#N/A` identify the source defect. Original values, file hash, row, worksheet, field mapping and units remain inspectable. Ordinary CSV text with the same prefix remains ordinary text; zero and missing values remain distinct.

The ZIP guard previously enumerated the EOCD total-entry count, but the pinned parser uses the per-disk count. An unequal total could skip preflight checks. Preflight now reconciles both counts, directory size/extent, every variable-length entry, local member metadata and streaming descriptors before workbook parsing. It rejects unsupported multi-disk/ZIP64/encrypted metadata, duplicate member names, overlapping members and mismatched local size metadata. Existing file, sheet, row/column and declared-expansion limits remain in force.

This is a bounded metadata guard, **not a comprehensive decompression or dependency security audit**. Actual hostile compressed-payload expansion and all ZIP variants have not been independently audited. No vendor parser source was changed.

## Changed files and requirement coverage

| File | Change | Requirements |
|---|---|---|
| `src/importProfile.ts` | Typed spreadsheet error cells | SWD-13 |
| `src/importValidation.ts` | Row quarantine, precise labels and original error lineage | SWD-13/14 |
| `web/import-file.mjs` | Typed XLSX adapter and reconciled ZIP preflight | SWD-13 |
| `web/import-ui.mjs` | Typed-error confirmation gate; accurate bounded-fix and demand-review disclosures | SWD-13/14 |
| `tests/xlsx-boundary.test.mjs` | Thirteen regression/compatibility tests | SWD-13/14; SWD-02 integration |
| `dist/importProfile.js`, `dist/importProfile.d.ts`, `dist/importValidation.js`, `dist/importValidation.d.ts` | Only four generated preview runtime files refreshed | Same as sources |
| This report; `tmp/spreadsheet-import-fix/` | Review, before snapshots, isolated checks, screenshots and downloaded evidence | A0/A4 verification |

Navigation, panel arrangement, typography, spacing, colors, charts and result tables were not redesigned in this correction. The preceding [UI verification report](2026-10-10-ui-import-provenance-verification.md) records the original mockup comparison and broader visual implementation.

## Verification evidence

Tests ran in `tmp/spreadsheet-import-fix/check-snapshot/` so fixture-writing tests could not modify the original fixtures. Direct installed Node entry points were used; npm/npx, Python and Vitest were not attempted.

| Check | Result |
|---|---|
| Initial `node --test tests/xlsx-boundary.test.mjs` reproduction | Expected RED: 2 passed, 8 failed after correcting a test-only reserved worksheet name |
| Label assertions with `node --test --test-name-pattern='Excel error' tests/xlsx-boundary.test.mjs` | Expected RED: 2 failed before implementing human-readable labels |
| `node --test tests/xlsx-boundary.test.mjs` after repair | PASS 13/13 |
| Final `node --test tests/*.test.mjs` | **FAILED: 88 passed / 1 failed / 89 total**; only preview-server fetch denied by sandbox loopback `EACCES 127.0.0.1:4188` |
| `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` | PASS |
| Isolated snapshot compilation through installed TypeScript entry point | PASS |
| `node --check web/import-file.mjs` and `node --check web/import-ui.mjs` | PASS, including final disclosure wording |
| `node scripts/check-carried-oracles.mjs` in snapshot | PASS: 4 recorded cases, 28 exact pressure points, 248 comparisons, zero failures |
| `node tmp/spreadsheet-import-fix/verify-protected.mjs` | PASS: all 48 protected files unchanged |
| `node tmp/spreadsheet-import-fix/verify-browser.mjs` | PASS: actual JSON/CSV/SVG downloads, source hashes, units, dates, calendar-volume arithmetic, validation and invalidation evidence |

No lint script or installed ESLint is configured. The preview-server check could not run successfully in this sandbox; no escalation or permission workaround was attempted. Exact retry gate in an environment permitting loopback: `node --test tests/server.test.mjs` after compilation. The existing running browser preview at port 4290 was exercised successfully through the browser tools.

The first downloaded-CSV evidence checker failed because it treated the blank separator between the established metadata preamble and displayed table as an import row. The checker was corrected to verify both sections separately and passed; production CSV serialization was not changed.

Final full-suite log: [full-tests-final.log](../tmp/spreadsheet-import-fix/full-tests-final.log). Red evidence: [red.log](../tmp/spreadsheet-import-fix/red.log), [labels-red.log](../tmp/spreadsheet-import-fix/labels-red.log).

### Actual browser checks

An isolated background tab was used; the user's existing tab and selected profiles were not reloaded or replaced.

- Error workbook: one accepted row, three quarantined rows; identity, water and unmapped-note error fields remain visible; confirmation disabled.
- Forged directory count: rejected before worksheet selection and validation; confirmation disabled.
- Duplicate field mapping: all four rows quarantined; correction restored four accepted rows and enabled confirmation.
- Valid XLSX: confirmed explicit worksheet and STB/day/calendar-day units, selected frozen forecast, obtained 3100 bbl in January and 2800 bbl in February from constant 100 STB/day training.
- Changing the confirmed worksheet: cleared the confirmed profile and dependent results; analysis run disabled and mappings/units required again.
- CSV literal `Spreadsheet error: 7`: four accepted rows, confirmation and forecast enabled; no false Excel-error classification.
- Downloaded JSON, displayed-table CSV and chart SVG: correct user origin plus separately asserted synthetic content, file hash, original units, coverage and results. All twelve calendar-month volumes independently checked against 100 × actual days in month.
- Keyboard Tab moved from JSON to CSV export with visible focus. Mobile forecast captured at 390×844; desktop error capture used the requested 1536×1024 override. Browser zoom/scaling affects native screenshot pixels. Temporary viewport overrides were reset.

Screenshots:

- [Desktop row errors at reference viewport](../tmp/spreadsheet-import-fix/desktop-errors-1536.png)
- [Desktop confirmed XLSX forecast](../tmp/spreadsheet-import-fix/desktop-workbook-forecast.png)
- [Rejected archive](../tmp/spreadsheet-import-fix/desktop-forged-archive.png)
- [Mobile CSV forecast and export keyboard focus](../tmp/spreadsheet-import-fix/mobile-csv-forecast.png)
- [Final visible acceptance disclosures](../tmp/spreadsheet-import-fix/acceptance-blockers.png)

Machine-readable browser checks and actual downloads: [browser-checks.json](../tmp/spreadsheet-import-fix/browser-checks.json), [valid-workbook-export.json](../tmp/spreadsheet-import-fix/valid-workbook-export.json), [literal-csv-export.json](../tmp/spreadsheet-import-fix/literal-csv-export.json), [displayed-forecast.csv](../tmp/spreadsheet-import-fix/displayed-forecast.csv), [displayed-forecast.svg](../tmp/spreadsheet-import-fix/displayed-forecast.svg).

### Independent review

GPT-6 Astra/high independently reviewed the preceding demand correction: PASS, 24/24 targeted tests, independent centered-covariance forecast arithmetic, selected contributions, holdout isolation and missing-input blocking. The demand source files were unchanged in this run. This supersedes the preceding demand report's pending-review status.

The same released reviewer was reactivated with a separate bounded, read-only assignment for the spreadsheet repair: PASS, 13/13 regressions, 48 protected hashes, 21 error-code cases, cached/uncached formula rejection, error-header rejection and independent zlib-compressed workbook compatibility. The reviewer found an inherited limitation: **stored method-0 ZIP entries with zero local sizes and streaming descriptors fail through the vendor parser directly and through the adapter** (`Bad compressed size: 693 != 1702240364`). Positive streaming tests cover deflated method-8 entries only. Normal non-streaming stored and compressed workbooks pass. The reviewer did not perform a fresh browser run or comprehensive archive audit. The final standard-label wording and disclosure status update followed review and were verified by local tests/browser evidence and syntax checks.

## Remaining acceptance gaps

- Extreme finite inputs can still overflow the calculation engine; display/export containment remains, and the numerical defect is not repaired here.
- The underlying exhibit API can still accept inconsistent input/output bundles. Verified browser assembly does not establish API-wide acceptance.
- Comprehensive parser/decompression/dependency security review and broader malformed/schedule/injector workbook coverage remain open; the inherited stored-streaming limitation remains.
- Compared directly with the supplied import mockup, the expanded importer remains taller, the requirements panel leaves excess vertical space, and validation columns need horizontal scrolling. The error column is narrow and wraps heavily. Mobile retains internal table scrolling. No new typography, palette, navigation or chart treatment was added in this repair.
- SWD-09 published-study evidence, SWD-10 wellbore hydraulics, SWD-12 broader sensitivity and SWD-11 transient/calibrated models remain incomplete. Exhaustive browser-engine/accessibility testing and PDF source-switch races were not repeated in this bounded run.
- The sandbox-denied preview-server test remains an unpassed gate.

The application continues to disclose that full acceptance is open. The demand omission and these two spreadsheet defects have bounded correction evidence; unrelated correctness and visual gaps are not hidden by a blanket Ready state.

Run ended at approximately **03:39 UTC / October 9, 10:39 PM CDT**. The temporary test tab was closed; the user's existing tab and selected dataset were left intact.
