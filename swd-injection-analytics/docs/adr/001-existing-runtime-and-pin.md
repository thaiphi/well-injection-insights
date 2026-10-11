# ADR 001 — retain TypeScript/browser runtime and explicit Explorer file pin

**Status:** Documents the existing implementation decision; not a new deployment authorization. **Date:** October 10, 2026. **Scope:** `swd-injection-analytics` only. **Related:** [specification](../../product-spec.md), [original decisions](../decisions.md), [requirement tracker](../agents/issue-tracker.md).

## Context

The approved PRD adopts the existing ESP Nexus engineering foundation and a versioned public Explorer artifact. Calculations, public observations, synthetic histories and user assertions need inspectable provenance. The demonstration must continue without a live Explorer service and must not require private fixtures, a shared database, a Python web service or automatic file upload.

The [repository instructions](../../AGENTS.md) retain Main's integration/final verification responsibility and prohibit worker Git writes. Current local implementation does not authorize remotes, hosting or portfolio changes. D1 records the actual architecture and evidence boundaries; the authoritative PRD/completion plan remain the read-only sibling documents identified in the specification.

## Decision

Retain TypeScript calculation modules compiled as ESM, static browser modules and direct Node scripts. [package.json](../../package.json) declares Node ≥24 and TypeScript 5.9.3; [tsconfig.json](../../tsconfig.json) uses strict NodeNext/ES2022 compilation from `src` to `dist`. [serve.mjs](../../scripts/serve.mjs) is a local preview/static file server, not an upload or data-processing API.

User CSV/XLSX bytes are read locally by the browser. Explicit mapping, unit declaration, validation and confirmation precede analysis. No automatic server upload or persistence is added. File/worksheet/mapping/control edits invalidate relevant confirmed outputs. The [import boundary](../../src/importProfile.ts), [validation](../../src/importValidation.ts), [readiness](../../src/analysisReadiness.ts) and [browser adapter](../../web/import-file.mjs) preserve original input identity and assertions independently of calculated results.

Consume an explicitly selected local Explorer export with hashes and schema/QC/parent-link validation. [data/explorer-pin.json](../../data/explorer-pin.json) identifies `rrc-2026-10-09-uic000020838-v1`; [artifact-files.mjs](../../scripts/artifact-files.mjs) verifies files and normalized/CSV parity; [publicArtifact.ts](../../src/publicArtifact.ts) checks structured public identity, dispositions and period/calendar consistency. The browser does not need an active Explorer process for this pin.

Immutable artifact/version identity is the **contract and preservation procedure**, not a complete technical overwrite guarantee. [import-explorer.mjs](../../scripts/import-explorer.mjs) verifies a source then copies into `data/explorer` and rewrites the selected pin; it does not refuse every conflicting destination or preserve every prior version automatically. Current authorized work does not invoke it or change retained pins. Explorer E1 immutable-export hardening belongs to its owning repository and is not claimed complete here.

Maintain distinct synthetic, assumed, user-acquired/asserted, public-reported, literature and calculated origins. A technical exhibit must retain full input/method/unit/source identity and reject inconsistent/tampered serialization. Content hashes are consistency checks, not authenticity proofs. The [literature fixture](../../data/scenarios/literature-example.json) has its own exact UTF-8 pin and does not join the public dataset.

## Dependencies and engineering source identity

| Retained component | Identity / evidence | Limit |
|---|---|---|
| Nexus extraction | [source manifest](../../reference/nexus-source-manifest.json), local main revision `de631ad2952bf42b80a6738ff980992975be4cdc`, original/rewritten import hashes and retained reference tests | Source mapping/recorded comparison agreement is not proof of every inherited equation. Legacy reversed Bw trend remains preserved as a known defect. |
| Modern gas-free NaCl adapter | [pyResToolbox source record](../../reference/pyrestoolbox-pvt/provenance.json), package metadata 2.5.0, exact brine/IAPWS/license hashes and [45-case oracles](../../reference/pyrestoolbox-pvt/oracles.json); [source notes](../../reference/pyrestoolbox-pvt/README.md) | Exact files identify the snapshot, not a claimed clean release. Historical MCP lockfile 3.1.4 is not the installed snapshot identity. No fresh MCP call is claimed. GPL-3.0-or-later source/license must accompany distribution of the adaptation. |
| SheetJS CE | [0.20.3 provenance](../../web/vendor/xlsx-provenance.json), official local ESM module, Apache-2.0 license, exact module/license hashes | Signed/unsigned stored-streaming descriptors use a validated private parser copy, preserving original bytes/hashes. STORED and native DEFLATE payload CRC/size checks precede parsing. Emitted-byte bounds do not guarantee native peak memory or trailing-input consumption; comprehensive decompression/dependency review remains open. No dynamic CDN loading or formula/macro evaluation. |
| PDF-lib | [1.17.1 provenance](../../web/vendor/pdf-lib-provenance.json), MIT license, local ESM and exact hashes | Original-workbook vector PDF and attached JSON do not imply dedicated PDF coverage for every other workflow. |
| Published study | [method/source note](../literature-example-method.md), Jin et al., DOI 10.3390/en15062101, CC BY 4.0 | Literal rounded radial coefficient and externally assumed skin; no full-paper transient/geomechanical/seismic simulation. |

## Consequences and alternatives

The selected design keeps the local demo reproducible and the public consumer independent, without adding services or credentials. Explicit units/datums and per-analysis readiness reduce silent interpretation. Retained source hashes, originals and fixtures permit comparison without rewriting history. Browser-local processing avoids an automatic upload path but does not establish support for every workbook or real user format.

Public refresh remains a deliberate verified file operation, not a live service or scheduler. Parser/source/version hardening and source acquisition remain distinct acceptance work. Historical exports retain their original verification labels; current source snapshots and calculation versions must not be backdated into them.

A live shared database/API, automatic refresh, backend upload/storage, Python runtime rewrite and additional AI platform were not selected for this scope. P1 library/variable-PVT wellbore work and P2 transient/calibration work require their own evidence/design gates; retaining this runtime does not remove them.

## Verification and open gates

Run the direct Node acceptance commands in the [tracker](../agents/issue-tracker.md). Main reports the current outside-sandbox suite passing 188/188, stored-descriptor review 20/20 and actual signed/unsigned/formula/error browser checks; the broader parser gaps above and integrated acceptance remain open. Offline PDF verification now uses shared `verifiedExhibit` on captured original bytes through Node stdin before rendering; a single file read avoids a verification/render read race and raw numeric overflow is rejected. Its eight-case gate passed; see [recorded outcomes](../../tmp/project-completion/offline-pdf-gates.log). Server/HTTP checks require actual localhost connectivity; sandbox denial must be reported as unavailable rather than passed. No full upstream Vitest, new live MCP, deployed URL or two-app G2 completion is established by this ADR.

No production code, source pin, package/license file or retained fixture is changed by recording this decision. G3 remains excluded pending separate authorization and actual delivery destinations.
