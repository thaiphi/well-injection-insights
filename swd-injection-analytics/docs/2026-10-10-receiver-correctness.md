# Bounded Explorer receiver correctness — October 10, 2026

The owner requested this repair within the already running brine/parser correctness task. The original **10:37 p.m. CDT / October 11 03:37 UTC** stop remained unchanged. Only Analytics was edited; Explorer was inspected read-only. No commits, deployment, permission changes, dependency installation or published-data replacement occurred.

## Contract findings and repair

| Requirement | Finding and resulting behavior |
|---|---|
| SWD-04 — Explorer consumer | Whole-version offers previously required every history UIC to appear in inventory, although the sender describes all retained rows. That subset condition is removed. Scope is recomputed from the verified complete archive without filtering. Sender-valid empty history now uses paired null coverage. Identifier/month validation, dense rows, sender bounds, exact origin/opener, identities and all three offered hashes remain enforced. |
| SWD-13 — import correctness | A complete archive can be valid evidence while failing the stricter calculation contract. Successful bounded empty collections and canonical quarantine/duplicate rows can now preview and be explicitly adopted for inspection. Every source sidecar, hash, byte count, query predicate, selected-parent proof, canonical normalization, CSV and dictionary still reconcile. Canonical producer history status must match the manifest and publication pins; schema1 is checked independently. |
| SWD-14 — readiness/invalidation | Original evidence remains immutable, with separate calculation eligibility from the unchanged strict public-artifact validator. Ineligible selections retain their identity without falling back to the stored pin. Confirmation clears dependent results. Readiness, direct navigation/rendering and JSON/CSV/SVG handlers all fail closed. Raw source-row dispositions and reasons remain visible; no accepted-row subset is silently substituted. |
| SWD-08 — evidence/export | The original adopted TAR remains separately downloadable with its original bytes/hash. Empty coverage is unavailable, not zero activity. Preview captions say retained source rows. Result metadata includes calculation eligibility. No result export is enabled for inspection-only evidence. |

Transport offer acceptance is not proof that an unmatched package can be published. Current dynamic Explorer acquisition requires exactly one selected raw parent and query-matching rows. Out-of-query UIC/date rows and missing/ambiguous raw parents still reject; malformed identifiers/months remain ineligible for handoff. No source composition, new acquisition, accepted-row calculation projection or source-authentication service was implemented.

## Changed files

- `web/explorer-package.mjs`, `web/explorer-evidence.mjs`: evidence/calculation boundary and preserved producer proof.
- `web/explorer-scope.mjs` (new), `web/explorer-handoff.mjs`, `web/explorer-receiver.mjs`: scope alignment, exact archive comparison and truthful preview.
- `web/explorer-eligibility.mjs` (new), `web/import-ui.mjs`: fail-closed readiness, rendering, exports and row labels.
- `tests/explorer-scope.test.mjs`, `tests/explorer-evidence-eligibility.test.mjs` (new), `tests/explorer-handoff.test.mjs`: bounded semantic/transport regressions.
- This report, appended completion ledger and the earlier correctness report: continuation evidence only.

`src/publicArtifact.ts` and its generated validator remain unchanged. Existing data, reference evidence, vendor sources and fixture archives were preserved.

## Verification and independent review

Final executable results and exact commands are recorded in [gates.json](../tmp/correctness-2026-10-10/receiver/gates.json). The complete non-listener suite runs in an isolated snapshot because some existing tests write fixtures. Historical artifact-writing reproduction also runs only there. [Preservation audit](../tmp/correctness-2026-10-10/receiver/preservation.json) compares the continuation baseline, including protected validator/data/reference/vendor/fixture paths.

Final results: **349/349 tests PASS**, zero failed/skipped; TypeScript no-emit and all seven edited/new browser-module syntax checks **PASS**; historical reproduction **248 comparisons PASS**, four cases/28 pressure points/zero failures. Preservation **PASS: 224 existing paths checked, 61 protected paths unchanged**. A second check against the original brine/parser baseline confirmed all **58 original protected evidence paths unchanged**. Expected pre-fix RED regressions are retained in worker records; no final failing gate remains.

Independent GPT-6 Astra/high review found no scoped P1/P2 defect. It ran 74 focused checks, 20 package checks including legacy evidence, then 54 scope/handoff checks after aligning the offer cap to the sender's 1000-row contract. Its separate in-memory integration checked empty/quarantine preview, single explicit adoption, retained bytes, cancellation and scope-mismatch preservation. [Review record](../tmp/correctness-2026-10-10/receiver/independent-review.md).

Actual browser checks used a separate temporary tab, preserving existing user tabs/cases:

- Quarantined-volume preview retained the negative source value and exact quarantine reason; adoption kept the selected evidence and blocked charts/result exports.
- Empty history showed unavailable coverage and no acquired activity claim; keyboard confirmation and direct injection navigation remained inspection-only.
- The original accepted fixture produced its actual 16 rows and three charts, with eligible result downloads enabled.
- Cancelling an empty preview retained the previously adopted accepted dataset. Replacing it with confirmed empty evidence cleared prior results and disabled all three result export controls; Back/Forward did not restore stale calculations.
- Reports showed no current selected-analysis result for inspection-only evidence. Raw TAR preservation is covered by executable exact-byte/hash checks; fresh browser downloads were **UNRUN**.
- Refresh cleared the temporary imported selection to “None selected,” with no result charts or pending confirmation. Only the new verification tab was closed; existing tabs/cases were preserved.

The altered archives are explicitly **self-authored consistency probes**, not new public pins or evidence of a fresh official acquisition. Their manifests cannot establish source authenticity. Screenshots/DOM evidence: [quarantine blocked](../tmp/correctness-2026-10-10/receiver/quarantine-blocked.jpg), [empty blocked](../tmp/correctness-2026-10-10/receiver/empty-blocked.jpg), [accepted results](../tmp/correctness-2026-10-10/receiver/accepted-results.jpg), [browser checks](../tmp/correctness-2026-10-10/receiver/browser-checks.json).

## Remaining boundaries

- All public calculations are blocked for an incomplete package, including otherwise accepted rows. A separately validated accepted-row projection is future work.
- Worst-case synchronous parser/normalizer execution remains unmeasured; asynchronous deadlines cannot preempt synchronous work. Existing byte/member/row/depth caps remain.
- No fresh two-window Explorer handoff or browser download parity was exercised in this continuation; actual archive/scope/transport integration tests and portable-file browser flows passed.
- Listener tests could not run under the known sandbox EACCES restriction. ESLint is absent. No full upstream/live-MCP or independent fluid-domain validation was added.
- Overall product acceptance remains **OPEN**, including SWD-11, broader parser/dependency review and full two-app acceptance. The preserved historical Nexus volume-factor defect remains excluded from live calculations as described in the preceding brine report.
