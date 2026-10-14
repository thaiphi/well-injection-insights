# Engineering demo verification — October 12, 2026

Owning repository: `well-injection-insights`, branch `main`, revision `c7a1cae76bc11013fdcb0951bfc942d5ed7a80b6`. The engineering app is the preserved nested `swd-injection-analytics/` tree. This is local demo evidence, not full product or hosted-release acceptance.

The original engineering window was 12:02:22–1:02:22 p.m. CDT. Its browser work ended earlier. The owner's later “continue” resumes scope inspection and verification closeout; no new implementation window or engineering scope is inferred. Original evidence is retained, including corrected findings and unrun checks.

## What changed

New [DEMO.md](DEMO.md), eight fictional CSV/XLSX demo inputs and [their manifest](demo/manifest.json), this verification record, and a `.gitattributes` rule preserving `demo/**` bytes across clone. No application/calculation source changed. All 182 transferred original files still match their preserved hashes, including datasets, reference evidence, tests and artifacts. Phi Analytics and Texas RRC Explorer are untouched. No commits, pushes, deployments, migrations, permission or billing changes.

## Gates and evidence

All direct Node commands below use `C:/Program Files/nodejs/node.exe`. Current closeout checks ran at approximately 5:42–5:43 p.m. CDT. [Machine-readable closeout](tmp/demo-readiness-2026-10-12/closeout-gates.json).

| Check | Result | Evidence and boundary |
|---|---|---|
| `node --test tests/portfolio-connection.test.mjs tests/transfer.test.mjs` | PASS 11/11, 0 skipped | Fresh current-tree run. Optional Auth-health boundary uses controlled tests; no actual backend connection or cloud persistence is claimed. |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS | Fresh adapter check, exit 0. |
| `node node_modules/typescript/bin/tsc -p swd-injection-analytics/tsconfig.json --noEmit` | PASS | Fresh engineering check, exit 0. |
| `node tmp/demo-readiness-2026-10-12/closeout-audit.mjs` | PASS | All 182 original hashes, eight demo hashes, exact final raster sizes and local HTTP 200. |
| Engineering build and isolated `node --test` | PASS 350/350, 0 skipped | Earlier same-day same-source run; not rerun at closeout. Exact compiler/test arguments and outputs in [gates.json](tmp/analytics-check-8rv5a2/gates.json). No fixture-writing tests run against originals. |
| `node scripts/check-carried-oracles.mjs` in isolated snapshot | PASS 248 comparisons | Four cases, 28 points; historical agreement is not independent full-domain physics validation. Recorded in the same gates file. |
| Offline public pin verification | PASS | Five inventory entries, 28 parent-linked monthly rows for one UIC, Jan 2024–Apr 2026; [pin check](tmp/demo-readiness-2026-10-12/public-pin-gate.json). No live reacquisition or new statewide coverage. |
| Independent demo-demand arithmetic | PASS | Separate centered-covariance OLS and calendar-volume checks; [anchors and overlap guard](tmp/demo-readiness-2026-10-12/user-demo-evidence.json). No field calibration. |
| Actual downloaded connected-case JSON/CSV/SVG | PASS | User history + injector case, no schedule: displayed case hash agrees with JSON, CSV serializer and SVG metadata; reconstruction within absolute 1e-9 + relative 1e-12. [Parity record](tmp/demo-readiness-2026-10-12/download-parity.json). Default/half-J downloads were not checked here. |
| Original workbook PDF, fresh download | UNRUN | Earlier golden/unit evidence retained; no new PDF implemented. |
| Timed guided run in this browser pass | UNRUN | No reliable timestamps. Earlier historical timing does not substitute for a fresh run. |
| Live two-app receiver handoff, clean new-computer install, hosted release | UNRUN | Offline package checks and local core UI do not close these gates. |

Scratch evidence links are local ignored files and are not promised to exist after a GitHub clone. The demo instructions, input pack and manifest are new reviewable working-tree files; they have not been committed or pushed.

## Actual UI walkthrough and requirement coverage

Opus 5.5/high used an isolated Chrome 154 profile through cached Chrome DevTools MCP 1.9.0, at `http://127.0.0.1:4317/` only. Haiku 5.5/xhigh investigated source; Fable 5.1/high independently reviewed source and evidence. Its [final review](tmp/demo-readiness-2026-10-12/fable-final-review.md) found no P0/P1 blocker in the scripted demo, with documentation-precision notes now reflected here and in DEMO.md. The reviewer closed its session after completion. Main performed preservation, type, transfer and downloaded-byte checks. This used the owner-selected backup workflow and included Claude Team access. The initial Codex CUA startup failed; the alternative browser capability was separately proven. No sibling session was stopped.

[Initial browser report](tmp/demo-readiness-2026-10-12/opus-browser.md), [corrections and downloads](tmp/demo-readiness-2026-10-12/opus-browser-followup.md), [final XLSX check](tmp/demo-readiness-2026-10-12/opus-xlsx.md).

| Approved requirement | Observed coverage | Limits |
|---|---|---|
| SWD-01 / A1: histories | Producer selection/history and source identity inspected | Current imported producer history is water only; no oil/total-liquid rate or water-cut workflow. |
| SWD-02 / A1/A3: fit/reconcile | Local exponential fit, frozen identity, holdout table and reconciliation | No pyResToolbox DCA or statistical cohort fit is claimed. |
| SWD-03 / A1/A3: schedules/demand | Contributions, calendar totals, overlap block and profile replacement recovery | Customer schema has constant availability and declared initial rate/decline; synthetic workbook ramp/downtime is a separate supported path. |
| SWD-04: public observations | Preserved pin/source contract verified offline | One disposal history, no matched nearby producer overlay or spatial relationship. |
| SWD-05/06/07 / A2: injectivity/capacity/scenarios | Default/half-J, zero availability, invalid J rejection, constraints/deficits; workbook expansion-date/availability | Conditional screening, no sustainable-capacity or pressure-evolution claim. Limit at/below reservoir gives approved zero capacity. |
| SWD-08 / A4: exports | Actual user-case JSON/CSV/SVG byte/metadata parity and stale disabling | Fresh workbook PDF and default/half-J download parity unrun; connected-case/study/sweep PDFs deferred. |
| SWD-09 / A5: source/PVT reuse | Carried oracle evidence, four live properties and invalid pressure range/recovery | Preserved legacy Bw defect remains reference evidence; comprehensive independent physics validation open. |
| SWD-10 / P1-A: hydraulics/profiles | Uniform/depth-dependent tools, MD/TVD checks, unsupported points retained | Bounded gas-free brine model; no multiphase or field calibration. |
| SWD-11 / P2: transient/layered/calibrated | NOT IMPLEMENTED | Remains acceptance scope; screenshots do not deliver it. |
| SWD-12 / P1-B: sweeps | J, tubing ID, availability and invalid ranges | Tried sweep ranges generated no failed points; failed-sweep-point UI behavior not exercised. Hydraulic flagged-point retention was observed separately. |
| SWD-13 / A0: CSV/XLSX import | File/worksheet selection, mapping/units, preview, validation/quarantine, confirmation and recovery | XLSX 48 accepted rows; formula fixture 46 accepted/2 quarantined, confirmation blocked. Downstream capacity invalidation after that specific XLSX file change was not separately inspected. |
| SWD-14 / A0: origin/readiness | User origin plus synthetic/assumed content, blank geometry blocker, independent forecast with invalid aggregate demand | General public/customer composition and persistence not delivered. |
| G2: navigation/accessibility | Back/Forward, refresh clearing session, h1 focus, logical Tab order, one exact mobile view | Dialog Enter/Escape, all-screen mobile and full accessibility acceptance unrun. The exact mobile capture shows the primary navigation partly clipped; discoverability on narrow screens still needs review. |

## Screenshots

The browser produced 37 actual screenshots in [the evidence directory](tmp/claude-devtools-2026-10-12/demo). Captures 01–35 used a 1536×1024 CSS viewport at DPR 1.5; do not call those 1536×1024 rasters. Final captures used explicit emulation at DPR 1 and their PNG headers confirm exact pixel dimensions.

- [Capacity, half J](tmp/claude-devtools-2026-10-12/demo/11-capacity-injA-halfJ.png)
- [Invalid J, results blocked](tmp/claude-devtools-2026-10-12/demo/13-capacity-invalid-J0-blocked.png)
- [User three-profile capacity](tmp/claude-devtools-2026-10-12/demo/33-user-3profile-capacity.png)
- [Overlapping producer contribution blocks demand](tmp/claude-devtools-2026-10-12/demo/34-overlap-blocks-demand.png)
- [Mobile, 390×844](tmp/claude-devtools-2026-10-12/demo/36-mobile-390x844-emulated-data.png)
- [Desktop, 1536×1024](tmp/claude-devtools-2026-10-12/demo/37-desktop-1536x1024-restored.png)

The final browser state was a user history + injector dataset, not the synthetic half-J screen. Refresh clears the session; use DEMO.md to select the intended dataset before presenting. A local core server returned HTTP 200 at closeout; this does not establish hosted adapter readiness.

## Corrected findings, failures and remaining acceptance

The first browser report's geometry-button failure was an action-ordering error: click and Calculate were batched in parallel. Sequential retry passed. The conditional holdout explanation did not block observed reconciliation. Workbook edits correctly invalidate a connected case using those shared planning assumptions. Preserve those dependency guards. Earlier reports remain intact and these corrections supersede their three findings.

A favicon request returned 404. Early resize-only mobile captures do not prove a mobile CSS viewport; only the explicit emulation captures do. Initial scratch arithmetic probes failed from incorrect probe assumptions about row shape and the shortfall property; corrected probes passed, without application changes. No reproduced P0/P1 calculation or workflow defect requiring code repair was established in the exercised paths. Unexercised paths remain unverified.

The owner additionally requested nearby H-10 injection volumes on each producer's rate/water-cut history, with frac dates on the decline curve, using TRRC or synthetic data. This is NOT IMPLEMENTED. The current import contract has producer/group/month/water fields only (`src/importProfile.ts:12–16`); the normalized history contains rate/volume for water, no oil/liquid denominator, frac events or distance relationship (`src/importValidation.ts:3`). The public pin has only one acquired disposal history. No “rung 1” implementation or frac-event dataset was found in the transferred governing documents/current product paths inspected. Vendor water-cut type declarations are not a usable workflow.

The proposed next slice is an explicitly synthetic, matched example with producer oil/water rates, water cut, nearby fictional injection volumes and dated frac events on aligned charts, retaining missing/zero distinctions, units and source-row evidence. Real-source mode must require supported producer/event inputs, identity/coverage checks and declared distance associations; it must never infer frac dates or assign this public disposal history to fictional producers. An overlay is contextual evidence for investigating possible support, not proof of pressure support, connectivity or causation. This new schema/composition/visualization work needs its design and plan review; it has not begun.

Full product acceptance remains OPEN for SWD-11, comprehensive parser/dependency and broader physics validation, source composition, persistence/curve maintenance, full two-app G2 and hosted/mobile acceptance. PDF expansion remains deferred. Numerical validation, UI readiness and release acceptance are separate.


Visual comparison: the desktop retains the concepts' navy navigation, blue active item, light workspace and three colored source cards. The actual receiver/package panel is additional preserved functionality and pushes mapping/readiness lower than the concept. The narrow-screen cards stack, but primary navigation clips at the right edge. The final desktop screenshot also retains its actual scrolled/focused state. These captures are not a full 12-screen pixel-fidelity acceptance.


## October 13 pressure-support checkpoint

The separate synthetic context view and its scoped desktop/mobile/SVG layout corrections are implemented. Independent correction review PASS; complete plan acceptance FAIL because mandatory browser coverage remains unrun. Fresh frozen-source gates: 390/390 engineering tests, 248 carried comparisons, both type checks, assembly/syntax, and actual JSON/CSV/regenerated-SVG parity PASS. Root gates 33/34; the only failure is the intentionally pending preservation baseline. No acceptance flip, commit, push or deployment.

Current screenshots, exact changed files, requirement coverage, source hashes, saved downloads and remaining checks: [PRESSURE-SUPPORT-VERIFICATION.md](demo/PRESSURE-SUPPORT-VERIFICATION.md). The local preview remains at http://127.0.0.1:4317/#production/pressureSupport. The final 194-file stability check at22:38:31UTC has zero changes and its CSS hash84c00e23... matches the sealed baseline. All worker assignments and test-only servers/profiles closed; the user preview server remains running.
