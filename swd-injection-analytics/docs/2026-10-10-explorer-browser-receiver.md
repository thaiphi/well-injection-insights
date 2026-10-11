# Explorer package browser receiver — bounded delivery record

Actual start: **2026-10-10 23:12:08 UTC**. Fixed deadline: **2026-10-11 00:10:54 UTC** (October 10, 7:10:54 PM America/Chicago). This task does not restart the previous redesign timebox.

Owner authorization: implement only the Analytics receiver for the actual Explorer exported package. No curve-library persistence, sibling changes, commits, deployment, credentials or permission changes.

## Contract inspected before integration

Explorer's `src/versionArchive.mjs` produces uncompressed regular-file USTAR `complete-version.tar`: root manifest, normalized JSON, manifest-listed CSV/quality/dictionary/retained sources, and publication pins for newer versions. Legacy default has no acquisition sidecars/publication pins. Dynamic packages retain the schema-1 wrapper with transformation `rrc-odp-v2.0.0`, query-version-2 scope and schema-2 acquisition/selection/lookup evidence.

The pre-existing Analytics directory importer (`scripts/artifact-files.mjs`, `scripts/import-explorer.mjs`) verifies a directory and changes the installed pin. It is preserved. Browser import does not call it or write server data. The new receiver supplements `src/publicArtifact.ts` with bounded archive, source-evidence and complete representation checks.

Requirements: **SWD-04** public-history consumer; **SWD-14** analysis-specific readiness/provenance; **SWD-13** preservation of the independent customer CSV/XLSX path. This is an owner-authorized browser-package extension, not a claim that SWD-13 originally specified TAR.

## Session workflow and source boundary

Data & sources → Choose Explorer package → local checks → exact inventory/acquired wells, reporting period, quality, hashes and source preview → **Confirm & use this exact dataset** → public injection history and analysis exports. No adoption on file selection. Rejection/cancel clears the candidate without changing active case/results; asynchronous generations prevent late work from resurrecting a cancelled candidate. A replacement candidate requires new confirmation.

Acquisition origin is **user-provided Explorer package**, separately from **recorded public-reported content**. Calendar-day rate is calculated from monthly volume; reported pressure is not BHP, injectivity or reservoir pressure. Public injection history alone does not enable producer forecasts/demand, engineering capacity or source composition. Missing values remain unavailable; wells lacking acquired history are not zero-injection wells.

Offline checks establish internal package consistency and supported recorded source evidence. Dynamic publication pins are not an external trust anchor and do not authenticate the claimed acquisition. Missing-provenance legacy imports require the exact existing trusted digest pair. Unsupported formats/contracts, contradictory fixture evidence and incomplete/unresolved histories fail closed.

Adoption selects a browser-session dataset and clears dependent displayed results. Existing customer profile records are retained for explicit reselection. The original installed artifact/pin and the fictional workbook's separate public reference remain unchanged. Reload clears the imported session, as before. The original adopted TAR can be downloaded byte-for-byte; analysis exports retain dataset/hash/coverage/unit/source evidence. Original workbook exports remain their own separately identified demonstration.

## Future one-click handoff — proposal, not implemented

Explorer currently exposes version-specific package downloads, not Analytics receipt acknowledgement. A future “Use in Injection Analytics” action needs an agreed receiver URL and transport/origin policy. A validated offer should carry contract version, exact artifact ID, expected package/manifest/normalized hashes, intended scope (whole dataset, selected wells and reporting period) and package bytes or an explicitly allowed version-specific download URL. The receiver must verify payload against the offer and producer evidence, show actual scope and quality, and await adoption. Never infer selection from a label or silently fetch arbitrary supplied URLs.

An acknowledgement should identify offer ID, adopted artifact/hashes and confirmed scope, distinguishing received/validated/previewed/adopted/rejected/cancelled. Cross-origin URL fetching requires producer CORS/hosting agreement; message transfer requires allowlisted origins and exact sender/receiver binding. Neither is bypassed by shared local storage. Portable TAR import remains independently usable. No producer, hosting, authentication, persistence or origin policy change was made here.

## Workflow and preservation

Main owns integration/UI/evidence; GPT-6.1 Sol/high owns bounded package/evidence modules and focused tests; GPT-6 Astra/high provides independent contract/final review. At most two active subagents; no overlapping write ownership or child agents.

Implementation rulings: use the existing authorized checkout to preserve uncommitted work; retain evidence instead of committing/deleting it; direct Node gates rather than shell shims; no dependency installation. Session-only adoption avoids introducing saved cases, shared storage or automatic repinning.

Baseline hashes: `tmp/receiver/baseline.json`. This document does not claim comprehensive parser security, source authentication, cross-app acceptance or full engineering acceptance.

## Delivered paths

Changed existing files: `web/index.html`, `web/import-ui.mjs`, `web/workspace-views.mjs`. Added production files: `web/explorer-package.mjs`, `web/explorer-evidence.mjs`, `web/explorer-receiver.mjs`, `web/explorer-receiver.css`. Added tests: `tests/explorer-package.test.mjs`, `tests/explorer-receiver.test.mjs`. Added an unmodified actual producer-exported public TAR fixture and its provenance record under `tests/fixtures/explorer-packages/`. This report is new; task evidence is isolated under `tmp/receiver/`.

Preservation comparison: **148 original files checked, 145 unchanged, three intended existing browser files changed, no missing or unexpected changes.** Original `data/`, pin, `reference/`, `src/`, tests and scripts remain unchanged. Existing uncommitted work was retained. No sibling files, Git index/history, deployment or persistent permission configuration was changed.

## Executed gates and actual browser evidence

- Direct TypeScript no-emit check and five browser-module syntax checks: **PASS**.
- Full explicit owning-app suite in an isolated snapshot: **264/264 PASS**, no failed/skipped tests. `node tmp/receiver/gates.mjs` invokes the direct compiler and every `tests/*.test.mjs` path; it does not discover/run preserved upstream Vitest files or mutate original test-writing fixtures.
- Focused parser/public consumer checks: **23/23 PASS**, including 20 package tests. Controller: **5/5 PASS**, including cancellation/replacement abort signals and late read/verification suppression.
- Actual producer `buildVersionArchive` → receiver compatibility: **PASS** for legacy UIC 000020838 (28 months), newer UIC 000020838 (28 months), and newer UIC 000056484 (16 months). Exporting read the preserved producer files and wrote only the owning Analytics fixture/evidence; no producer files changed.
- Actual browser file chooser: corrupt TAR rejection; legacy valid preview and cancel; newer UIC 000056484 exact preview/adopt; 48-row customer CSV confirmation; failed package preserves customer identity; customer forecast regenerates identically; confirmed customer profiles survive public adoption and can be explicitly restored; adoption clears dependent displayed exports; refresh clears session and leaves the original pin selectable: **PASS**.
- Keyboard Enter opened file selection and explicitly confirmed/adopted the checked version; Back/Forward retained current adopted session identity: **PASS**. Desktop 1536×1024 and mobile 390×844 CSS viewports showed contained page width. Tables/charts retain local scrolling. Screenshot raster sizes reflect the existing browser zoom/scrollbar handling.
- Four actual UI downloads (analysis JSON, CSV, three-chart SVG, original TAR): **7/7 exact consistency checks PASS**. The returned TAR is byte-identical to the actual producer archive. JSON contains the exact adopted artifact and pin; CSV values/metadata match JSON; all three SVG metadata blocks match JSON. Newer UIC 000056484 exports have their actual January 2024–April 2025 coverage, not the installed example's April 2026 endpoint.
- GPT-6 Astra/high independent bounded static review and evidence/screenshot review: **no unresolved P1/P2 finding established**. Review fixed an undefined helper default, added abort forwarding on replacement/cancellation, and corrected the imported lineage title. Reviewer did not independently execute tests or browser interactions.

Evidence: [screenshot/download gallery](../tmp/receiver/index.html), [browser checks](../tmp/receiver/browser-checks.json), [download checks](../tmp/receiver/download-checks.json), [final gates](../tmp/receiver/gates.json), [full test log](../tmp/receiver/full-suite.log), [preservation comparison](../tmp/receiver/preservation-checks.json), [desktop adopted history](../tmp/receiver/06-adopted-history-desktop.jpg), [mobile exact preview](../tmp/receiver/04-dynamic-preview-mobile.jpg).

### Failed attempts and corrected harness assumptions

The first full-suite attempt **FAILED** its preview-server test because the sandbox denied localhost connection (`EACCES 127.0.0.1:4188`): 263 passed, one failed. The approved localhost retry passed all 264. Initial actual producer export inspection through Node `realpath` **FAILED** with sandbox `EPERM`; an approved read-only retry passed without producer writes. [Initial failed suite record](../tmp/receiver/gates-sandbox-failure.json).

Two initial browser assertions **failed because their baseline was invalid**: they compared a rendered forecast before navigation with state after the existing Data navigation had already cleared the displayed cache. This was not caused by package selection. The original false records remain, marked `INVALID_TEST_BASELINE`; corrected checks measure immediately before file selection, and the forecast regenerates identically afterward. Current behavior still clears the rendered analysis on ordinary workspace navigation; this task preserves that contract and does not add result caching or saved-case persistence. The gallery reports **18 valid browser checks passed, zero valid failures, two invalid initial baselines**.

Other recovered tooling attempts: one customer time-basis label lookup had no match, resolved by inspecting and selecting the existing control; a page-body keyboard shortcut could not focus, resolved through the focusable heading; one shell-quoted title-edit attempt failed before writing, then the exact change was applied normally. An early reviewer checkpoint stopped when the package test file was not yet written; the final review inspected it after delivery. None of these attempts is represented as a passed gate.

## Remaining limits and dependencies

The offline receiver does not authenticate the acquisition, establish statewide completeness, support every historical/future producer contract, or independently prove the physics of public observations. Unsupported/no-history artifacts fail closed under the existing Analytics trend contract; no demo substitution occurs. Copied producer normalization/dictionary/scope contracts require coordinated version maintenance. Resource caps cover input/member/count/JSON structure, not an independently measured hard browser peak-memory guarantee. Comprehensive parser/security review remains open.

Touch dragging, screen-reader operation, maximum-size concurrent browser cancellation timing, every adversarial package in a real browser, every browser engine and a complete producer-refresh/shutdown two-app acceptance run are **UNRUN** in this pass. Unit/regression checks cover supported cancellation generations/abort signals and malformed-package cases. No automatic one-click producer transfer was built; the exact producer/origin/transport dependencies are proposed above.

Existing project blockers remain: SWD-11 modelling, retained legacy volume-factor correctness issue, broader parser/dependency review and full cross-app acceptance. Saved curve maintenance, source composition, diagnostic fitting and extra report formats are outside this task. This delivery is the bounded portable package receiver, not full product acceptance.

Completed and reported **2026-10-10 23:30 UTC (6:30 PM America/Chicago)**, ahead of the fixed 7:10:54 PM checkpoint. The browser remains on the actual imported public history at `http://127.0.0.1:4290/#injection/publicTrends`; temporary viewport overrides were reset. No new goal or follow-on implementation was started.
