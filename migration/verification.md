# Transfer verification — 2026-10-11

Scope: preserve the existing SWD working application in the new private Lovable-linked repository, adding a hosting adapter. This is not whole-product acceptance or permission to publish.

## Passed before transfer commit

- Source preservation: all 182 manifested files match original bytes and SHA-256, including the original-workbook PDF. An independent read-only review confirmed the same count and no omitted files in the carried source directories.
- `node scripts/check-analytics.mjs --include-server`: preserved TypeScript compilation passed; all 350 original Node tests passed, zero skipped; carried numerical oracle passed all 248 comparisons across four cases and 28 pressure points. Checks ran in a disposable snapshot so retained reference evidence was not rewritten.
- `node --test tests/transfer.test.mjs`: three transfer checks passed, covering source hashes, static runtime assembly and query/fragment forwarding.
- `node node_modules/typescript/bin/tsc --noEmit`: outer hosting type check passed.
- `node node_modules/vite/bin/vite.js build`: production compilation passed. Existing plugin-option deprecation warnings remain; no publish/deploy command was run.
- Targeted direct ESLint check passed for the adapter, route and test changes. Adapter script syntax checks and `git diff --check` passed.
- Local browser smoke: the home route preserved `?transferCheck=1#fluid/pvt` when opening the original application. The original PVT tool calculated 21 pressure points, displayed four properties/charts/table and enabled exports. Changing minimum pressure invalidated the displayed result and disabled all three exports.
- Independent Astra review found no functional hosting-adapter blocker. Its staging guard and formatting-isolation recommendations are incorporated: force-include the four ignored deliverables, verify indexed hashes, and exclude preserved/generated trees from root formatting.

## Resolved failures

The initial incomplete dependency installation caused a missing-Tailwind build failure. Completing the official dependency installation resolved it. The first outer ESLint check reported formatting/line-ending errors; formatting only edited outer scaffold/adapter files resolved those errors. Preserved engineering files were not formatted or rewritten.

The full staged whitespace check reports existing CRLF/trailing-whitespace in the byte-preserved application and captured source evidence. Those files are deliberately unchanged. The outer adapter-only staged whitespace check is run separately. Indexed preservation passed for all 182 files, including the four explicitly force-staged exhibit/PDF deliverables.

## Unrun or separately gated

- The outer scaffold Vitest test was not run because of the documented Windows traversal limitation. Original Node tests and browser route smoke ran successfully.
- This transfer does not repeat the complete twelve-screen/customer acceptance walkthrough, broader parser/dependency audit, or hosted two-app integration review.
- Hosted synchronization and preview are checked after the additive push. Local checks alone do not establish remote build/preview success.
- Original localhost-only Explorer handshake remains intentionally bounded; hosted origin expansion needs separate review.
- Overall engineering acceptance remains open as described in `README.md`; a successful transfer does not complete SWD-11 or establish field calibration.

## Repository integrity

The transfer preserves Lovable's initial commit as its parent. No source repository history, local datasets, reference fixtures or phi-analytics files are changed. Generated assets, dependency installs and local QA scratch output are excluded. Staged source bytes must match the manifest before committing, including files ignored by the preserved application's own ignore rules.
