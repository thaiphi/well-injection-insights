# Imported existing-producer demand — bounded critical fix

Completed October 10, 2026, before the existing 02:02:41 UTC deadline. This is the Analytics portion of the authorized critical-fix round. It does not restart the project timebox, close the project Goal, or constitute independent acceptance. No commits, pushes, deployment, permission changes or helper agents were used.

## Scope and governing evidence

Read the owning AGENTS.md, shared agent workflow, approved Analytics PRD, integration architecture, roadmap, existing A0–A4 completion plan, prior UI verification and independent acceptance probes before editing. The two supplied Analytics mockups and the prior UI comparison remain the visual reference. The current revision preserves the preceding UI work.

Requirement coverage: **SWD-02** frozen training boundaries; **SWD-03** existing plus scheduled grouped demand; **SWD-06** same-period capacity deficits; **SWD-08** consistent displayed/exported results; **SWD-13/14** confirmed typed inputs, source lineage and per-analysis readiness. SWD-13 parser acceptance is not closed by this fix.

Declared source allowlist: `src/importAnalysis.ts`, `src/analysisReadiness.ts`, `web/workspace-state.mjs`, `web/import-ui.mjs`, `tests/import-analysis.test.mjs`, `tests/import-demand.test.mjs`, `tests/readiness.test.mjs`, `tests/workspace.test.mjs`, this dated report, and scratch evidence under `tmp/import-demand-fix/`. The existing import-analysis and workspace tests were not edited. The only additional generated-runtime writes were explicitly declared before emission: `dist/importAnalysis.js`, `dist/importAnalysis.d.ts`, `dist/analysisReadiness.js`, `dist/analysisReadiness.d.ts`, allowing the already-approved preview to serve the corrected engine. Other root dist files were not emitted.

## Finding and corrected behavior

The imported engine fitted selected existing producers but previously assembled producer/group demand from schedules only. The seed-417 reproduction therefore produced a January frozen forecast of 180,697.6360618436 bbl while reporting zero demand and zero deficit before the April addition.

The import engine now creates one contribution per selected existing producer and analysis month from its frozen forecast, plus one contribution per distinct selected scheduled addition. Monthly demand and group totals sum those contributions. Existing contributions carry the frozen forecast ID and every accepted through-cutoff training row ID; additions carry their schedule row IDs. Calendar rates, monthly volumes and active days remain separate. Independent future actuals remain reconciliation inputs and cannot change training or demand.

The approved fixture implementation (`src/planningFixture.ts:19`) rejects a producer present both in the frozen models and schedules. The import implementation follows that contract: an existing identity cannot also be a scheduled addition, even if its scheduled start lies outside the selected analysis period. It does not invent restart/replacement semantics. An invalid existing fit or ambiguous producer/group mapping blocks total demand, while a valid forecast, injector analysis or explicitly selected schedule-only analysis can remain available. An unspecified schedule selection includes quarantined raw identities so invalid additions cannot silently disappear; an explicit empty selection excludes schedules deliberately.

The result-level safety gate remains in place. A method-version label alone is insufficient: selected IDs, contribution kind, source row IDs, group identity, calendar units, frozen forecast total, group totals and portfolio totals must reconcile. Legacy omitted-demand results and inconsistent current bundles remain blocked, and exports withhold blocked demand and deficit values. The additive result lineage is identified by `validated-import-analysis/2`.

UI changes are confined to result bindings and truthful text: the demand chart legend says “Existing forecast + scheduled additions”; the producer table distinguishes existing forecasts and assumed additions and displays source-row counts. Full source IDs remain in JSON. The existing acceptance disclosure describes the corrected demand guard and retains the other unresolved blockers. Navigation, panel arrangement, typography, spacing, colors and chart implementation were not restyled in this critical-fix round.

## Independent arithmetic and actual browser evidence

The independent check uses centered-covariance OLS of the log history rates; it does not call the engine's freezeForecast helper. January has 31 days and April has 30. The fictional injector has J=5 STB/day/psi, compatible absolute bottomhole pressures 2000/3500 psia, operating ceiling 50 STB/day, and availability 1. NEW starts April 1 at 6000 STB/day with monthly decline 0.025.

| Month | Existing frozen demand (bbl) | Addition (bbl) | Total demand (bbl) | Capacity (bbl) | Deficit (bbl) |
|---|---:|---:|---:|---:|---:|
| 2026-01 | 180,697.63606184363 | 0 | 180,697.63606184363 | 1,550 | 179,147.63606184363 |
| 2026-04 | 166,068.81302608328 | 180,000 | 346,068.8130260833 | 1,500 | 344,568.8130260833 |

The running app at `http://127.0.0.1:4290/` was exercised through its real file chooser, mapping, units, validation and confirmation controls using history.csv (48 rows), schedule.csv and injector.csv. Origin remained user-provided; history content remained synthetic and schedule/injector content remained assumed. All three file hashes and original units appeared in lineage.

The demand comparison rendered 12 monthly rows and 36 producer contributions. Actual downloaded JSON, CSV and SVG were inspected against the DOM and independent arithmetic. All 12 CSV rows retain exact JSON numbers, displayed table and chart values agree to displayed precision, both anchor months agree with the independent calculation, and all three source hashes survive the exports. Acceptance remains explicitly Open in the JSON.

The browser then confirmed an overlapping FICTIONAL-PROD-01 schedule. Grouped demand and comparison became Not ready with the precise overlapping-ID reason and the run control disabled; forecast and injector analysis remained Ready. Replacing the file invalidated results until units, validation and confirmation were repeated. Restoring the distinct NEW schedule restored correct results. Keyboard Tab from the CSV export reached the SVG export with a visible solid focus outline.

Artifacts under `tmp/import-demand-fix/`:

- `desktop-comparison.png`: actual chart/table, matching monthly **volume (bbl)** labels rather than the reference's illustrative volume/rate confusion.
- `mobile-comparison.png`: actual 390×844 responsive capture; document width 375 px, no document horizontal overflow; viewport override reset afterward.
- `desktop-overlap-blocked.png`, `browser-overlap.json`: blocked overlap evidence.
- `desktop-contributions.png`: per-producer contribution and source-row-count labels.
- `browser-analysis.json`, `.csv`, `.svg`: actual application downloads.
- `browser-dom.json`, `browser-verification.json`, `calculation-evidence.json`, `engine-exhibit.json`: comparison and independent arithmetic evidence.

Relative to the mockup, the inherited vertical workspace, below-fold lineage, simpler icons and table-based histories remain. The mobile chart is compressed and its labels are small; the wide table remains in its scrolling panel. This round verifies the new result bindings and captures both sizes but does not claim pixel fidelity or a new full visual acceptance pass.

## Regression gates

Tests run in `tmp/import-demand-fix/check-snapshot` isolate existing fixture-writing tests from the protected root artifacts. Source and existing test artifacts are copied from the owning project; installed Node dependencies are reused. The direct installed TypeScript compiler emits only into that snapshot for gates.

| Command / check | Result |
|---|---|
| Initial new regression run against old behavior | Expected RED: 1/8 passed, 7 failed; omitted demand, history-only planning and overlapping IDs reproduced (`red.log`). A later quarantined implicit-selection regression also failed before its correction. |
| `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` | PASS |
| `node --check web/import-ui.mjs` | PASS |
| `node --check web/workspace-state.mjs` | PASS |
| `node --test tests/import-demand.test.mjs tests/import-analysis.test.mjs tests/readiness.test.mjs tests/workspace.test.mjs` in snapshot | PASS **27/27**, including 10 new demand regressions (`focused-green.log`). |
| `node --test tests/*.test.mjs` in snapshot | **FAILED: 75 passed, 1 failed**, only preview server test; sandbox connection EACCES 127.0.0.1:4188 (`full-tests.log`). No approval/permission workaround attempted. |
| `$demandTestFiles = @(rg --files tests -g '*.test.mjs' \| Where-Object { $_ -ne 'tests\server.test.mjs' }); node --test $demandTestFiles` in snapshot | PASS **75/75**, zero skipped (`non-server-green.log`). |
| `node scripts/check-carried-oracles.mjs` in snapshot | PASS **248 comparisons, 4 cases, 28 pressure points, 0 failures**; exclusions preserved. |
| `node tmp/import-demand-fix/evidence.mjs` | PASS independent January/April arithmetic; **43 protected files unchanged** by SHA-256. |
| `node tmp/import-demand-fix/verify-browser.mjs` | PASS actual DOM/JSON/CSV/SVG agreement, all 12 months, 36 contributions, 3 source hashes, both independent anchor months. |

Server failure evidence (last portion of output):

```text
    [cause]: Error: connect EACCES 127.0.0.1:4188
        at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1637:16) {
      errno: -4092,
      code: 'EACCES',
      syscall: 'connect',
      address: '127.0.0.1',
      port: 4188
    }
  }
```

COULD NOT RUN successfully in this sandbox: `node --test tests/server.test.mjs`. It requires a permitted local loopback connection. The existing approved browser preview was independently usable and the browser result/export workflow passed. A newly started isolated preview was inaccessible and was stopped; no new server remains running from this round. No configured ESLint gate exists. No Vitest, Python/py, live upstream refresh or permission escalation was attempted.

Coverage limits: XLSX/worksheet invalidation has passing existing Node tests and prior UI-pass evidence, but was not manually repeated in this bounded demand fix. Exhaustive keyboard/screen-reader/browser-engine testing and PDF source-switch races were not repeated. The exhibit API, XLSX parser/ZIP guard, wellbore and P2 modules were not modified. Independent review of this fix is still pending.

## Remaining acceptance blockers

The imported existing-demand omission is corrected in the engine and checked in the running UI, with the result-level safeguard retained. This supersedes only blocker 1 in the dated prior UI verification; it does not silently close that report's other findings.

- Spreadsheet error-cell handling and the XLSX archive directory-count guard remain unresolved engine/parser issues.
- Extreme finite values can still overflow in the engine. Non-finite results remain gated/withheld; this is containment, not a numerical-method repair.
- The underlying exhibit API can still accept contradictory input/output bundles. This round verifies the current browser assembly only.
- The published engineering example, extended wellbore hydraulics, broader sensitivities and calibrated/transient models remain incomplete.
- Independent acceptance review and the sandbox-blocked server gate remain outstanding; full project acceptance is not claimed.

All 43 protected hashes passed again after implementation and browser verification. Reference fixtures, pinned artifacts, vendor parser, existing planning/engineering modules, UI layout/styles and prior uncommitted work were preserved.
