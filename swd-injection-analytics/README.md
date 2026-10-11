# SWD Injection Analytics

An educational, local demonstration of produced-water planning and fictional injector capacity. It consumes a pinned, source-traceable public export from Texas RRC Explorer. The two workspaces run independently; neither requires a database or the other server.

**Purpose:** Demonstrate reservoir-engineering and disposal/injection-well analysis skill and knowledge through reproducible engineering calculations and source-backed technical records.

**Deadline:** Before October 14, 2026; delivery must be complete before that date.

## Run

Node 24 or newer. A single development dependency is pinned in package-lock.json. On this Windows host use the actual npm CLI through Node to avoid the broken shell shims:

```powershell
node 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' ci --ignore-scripts --no-audit --no-fund
node node_modules/typescript/bin/tsc -p tsconfig.json
node --test tests/*.test.mjs
node scripts/serve.mjs
```

Open http://127.0.0.1:4173. Shift the new-producer start, change injector availability/injectivity, inspect the pressure/rate and monthly capacity/demand curves, then download the current case as PDF, JSON, CSV or a standalone SVG chart sheet.

## Repeat the data handoff

```powershell
node scripts/import-explorer.mjs ../texas-rrc-explorer/artifacts/rrc-2026-10-09-uic000020838-v1
node scripts/export-exhibit.mjs
```

Import checks every manifest-listed source/export checksum, CSV/JSON value parity and UIC parent identity before pinning the artifact. The copied artifact and its hashes live in data/explorer and data/explorer-pin.json. Export writes exhibits/default.json, default.csv and default.svg. JSON contains inputs, output tables, model versions, formulas, units, assumptions, source manifest and a deterministic content SHA256; CSV preserves the same technical context in long form. SVG carries the exact JSON in its metadata and formats the already calculated chart values.

## Download PDF

The workbook's **Download PDF** button replaces the native print dialog. It generates a four-page report directly from the displayed exhibit: scenario/capacity chart, forecast and pressure curves with monthly outputs, public records, then methods and source lineage. The exact JSON export is attached. A scenario edit during generation cancels the old result; the next download uses the updated case. Unexpected long text or larger tables receive continuation pages.

PDF generation stays in the browser and needs no Python service or external request. The locally bundled [pdf-lib 1.17.1](https://pdf-lib.js.org/docs/api/classes/pdfdocument) is loaded only when requested; its MIT license and bundle hashes are retained under web/vendor. Each input exhibit is SHA256-verified before generation. The same serialized input produces deterministic PDF bytes.

## Optional offline report script

The application needs only Node and the browser. A separate offline report script accepts any exported exhibit JSON and uses an explicitly selected Python executable with ReportLab and pypdf. On this host the bundled executable is available at:

```powershell
$pdfPython = 'C:\Users\thai.phi\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $pdfPython scripts/export-pdf.py exhibits/default.json output/pdf/swd-technical-exhibit.pdf
node scripts/check-pdf-export.mjs $pdfPython
```

The script verifies the exhibit's JavaScript-canonical SHA256 before rendering, preserves the original JSON as an attachment and verifies four pages before writing the PDF. It does not rerun the engineering model. A saved report is available at http://127.0.0.1:4173/output/pdf/swd-technical-exhibit.pdf after generation. For another case, pass that case's downloaded JSON and a chosen output path. This script is separate from the browser's current-case PDF download.

## What is demonstrated

- Reproducible synthetic histories (seed 417), exponential log-rate fit frozen at December 2025, independent synthetic future actuals, and actual-minus-forecast reconciliation.
- Calendar-day monthly volumes, a fictional new-producer schedule and assumed additional available capacity.
- Two fictional constant-J injectors, a common bottomhole psia datum, assumed pressure/operating limits and availability. `Pwf = Pres + q/J`; `qmax = max(0, J*(Plimit-Pres))`. J is defined against stock-tank bbl/day. Monthly RRC pressures are displayed separately and never used as BHP or calibration inputs.
- Owner-authorized Nexus PVT/brine and black-oil engine reuse from local main, with source hashes and numerical reference cases.
- One actual UIC parent, 28 reported H-10 monthly rows (January 2024–April 2026), and five bounded inventory candidates. Public liquid injection is not asserted to be produced water from the fictional producers. Only one candidate has an acquired monthly history.

## Nexus lineage and limits

Source is the owner's local main at `de631ad2952bf42b80a6738ff980992975be4cdc`. scripts/extract-nexus.mjs copies the explicit engineering closure, rewrites only imports and selects two required type definitions; calculation bodies remain unchanged. reference/nexus-source-manifest.json records original and copied SHA256 hashes. reference/nexus contains unmodified upstream tests, including recorded pyResToolbox MCP reference responses. Tests under tests/ independently execute selected carried numerical references and SWD integration examples using Node's test runner. `node scripts/check-carried-oracles.mjs` additionally audits all 28 recorded pressure points across four carried black-oil cases: 248 applicable comparisons, with the original exclusions recorded in exhibits/carried-oracle-coverage.json. The full upstream Vitest suite has **not** been run here; a live MCP invocation is **not** claimed.

Luna/Graphify mapping identified no dedicated injection API in the selected Nexus source. The SWD constant-J layer is new integration code on the reused engineering foundation. Production Vogel/composite IPR is not inverted into an injection model. Surface pressure traversal, friction, transient/layered/fracture models and real-well calibration are outside this first slice. The source Hazen-Williams traversal has a fixed-density fallback, so it is not imported as a water-specific injection model.

The live brine adapter uses the source-checked gas-free NaCl browser method shared with the PVT view. Pressure remains absolute psia; salinity is explicitly NaCl mass ppm (50000 = 5 wt%), not legacy mg/L TDS. Its bounded demonstration domain is 100–10000 psia, 60–250 °F and 0–200000 mass ppm. New engineering version and provenance identify this method; retained historical artifacts preserve their original source and salinity semantics. The legacy Nexus vendor correlation and its reference fixtures remain unchanged and are not evidence that its Bw pressure trend is correct. These properties are inspectable examples, not field calibration. The separate black-oil table engine is preserved/tested for reuse, not substituted into the water-rate capacity formula.

## Status

This directory is an owning application workspace. Git hosting and deployment are not claimed. No permitting, GIS, employer operational fixtures, saved Nexus cases or portfolio implementation are included. See docs/verification.md for actual gates and remaining limitations.
