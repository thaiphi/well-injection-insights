# Pressure-support context — verification checkpoint

October 13, 2026. This record covers the owner-approved synthetic context slice and its scoped layout corrections. Full engineering/product acceptance remains open; no deployment, Git write, backend migration or permission change was performed.

## Scope and current status

Open `http://127.0.0.1:4317/#production/pressureSupport`. Select **Load synthetic example**, then **Calculate context**. This tool is independent of the selected planning dataset, PVT and hydraulics. It does not feed demand/capacity or determine pressure support, causation, connectivity, sustainable capacity or reservoir-pressure evolution.

The view includes producer oil/water/liquid rates, water cut, selected assumed nearby injectors' monthly volumes, exact dated frac annotations, original rows, methods and evidence exports. Public/customer composition stays blocked with explicit missing-input reasons. No public UIC is assigned to a fictional producer, and the existing customer import schema is unchanged.

**Independent correction review: PASS. Plan acceptance: PASS on October 14, 2026, after independent re-review of the resumed browser evidence (see the last section). Preservation baseline: pending-review (owner decision).** Earlier status, kept for the record: plan acceptance FAIL because required browser coverage was unrun. Numerical verification, UI readiness and product acceptance are separate statuses.

## Identity and protected evidence

| Item | Observed identity |
|---|---|
| Owning root | `swd-injection-analytics/tmp/lovable-transfer/well-injection-insights` |
| Branch / starting revision | `main` / `c7a1cae76bc11013fdcb0951bfc942d5ed7a80b6` |
| Context dataset | `pressure-support-demo/seed-20261012/v1`, synthetic; two fictional producers and two injectors |
| Fixture coverage | January 2024–December 2025 |
| Exact fixture bytes / SHA-256 | 30,351 / `dfb32bed82341a78f54490754e13d01784b2e9ac670b9218160ea5af0a3b75ab` |
| Default result SHA-256 | `dadb99eaf2281467f8e06fdba327c28dbd865bb768ead7e56401790c88e54352` |
| Immutable original transfer manifest SHA-256 | `8e7ef57c763817a3ab77ea1baf7e2ddf5687d51c753b33e4245f47f580ea237b` |
| Original transferred evidence | 182 files / 6,200,915 bytes; four deliberate UI deltas have exact archived before bytes. The other originals, calculations, references, pins, fixtures and PDFs are preserved. |

The new seed is separate from planning seed 417. Source association distances are declared assumptions, not GIS inference. JSON retains exact source bytes, original text, identifiers, units, row dispositions, classification, assumptions, coverage and model/result identity. Sealing recomputes the result from the verified source bytes and rejects forged or stale outputs.

## Requirement coverage

Requirement definitions remain in [the governing PRD](../handover/context/01-swd-injection-analytics.md), with current limitations in [the completion ledger](../swd-injection-analytics/docs/project-completion-ledger.md). The new capability is the separately approved [pressure-support design](PRESSURE-SUPPORT-DESIGN.md), not an invented new SWD requirement number.

| Requirement | Effect and preservation check |
|---|---|
| SWD-01 | New reproducible synthetic context; exact seed/bytes, identities and calendar units tested. Existing history/type-curve fixture preserved. |
| SWD-02–03 | Frozen forecasts, holdout reconciliation and grouped/scheduled demand unchanged. New context selection never edits these calculations. Existing tests and navigation/source inspection cover preservation. |
| SWD-04 | Public consumer remains separate. Public-history link reaches the existing route; missing public source blocks that view without substituting the context fixture. Real matched producer/event overlays remain unavailable. |
| SWD-05–07 | Injector cases, conditional capacity, expansion and availability calculations preserved; no new capacity model is claimed. |
| SWD-08 | New JSON/CSV/SVG carry source/result identity, original rows, units and assumptions; actual downloaded-file parity verified. Existing export families remain present. |
| SWD-09–10 | Existing source-attributed brine foundation/reference evidence and bounded wellbore calculations preserved; 248 carried comparisons and current numerical tests. Actual independent PVT/hydraulics calculation, input rejection and recovery checked. |
| SWD-11 | OPEN. No layering, transient pressure evolution, field calibration or causal pressure-support determination. |
| SWD-12 | Existing one-at-a-time sweeps retained; no probabilistic percentile or new sweep method introduced. |
| SWD-13 | Existing CSV/XLSX profiles, mapping, unit handling, validation and confirmation unchanged. This slice does not add producer oil/frac fields to that importer. |
| SWD-14 | Independent context identity, precise unavailable states, null/zero distinctions, source rows, pending-load cancellation and stale export blocking. Six primary areas and secondary tabs retained. |

## Checks and observed results

Commands use `C:/Program Files/nodejs/node.exe` directly. The complete source inventory, exact test arguments and outputs are retained with the evidence record; fixture-writing tests run in the isolated snapshot.

| Check | Result |
|---|---|
| Full nested suite / snapshot compilation | PASS 390/390, zero skipped, plus compiler exit 0. Repeat after final source freeze is recorded in `final-gates.json`. |
| Carried reference comparison | PASS 4 recorded cases, 28 points, 248 comparisons, zero failures. Historical agreement alone is not full-domain physics validation. |
| Hosting adapter and engineering type checks | PASS `node node_modules/typescript/bin/tsc --noEmit` and `node node_modules/typescript/bin/tsc -p swd-injection-analytics/tsconfig.json --noEmit`. |
| Static assembly / syntax | PASS `node scripts/prepare-swd.mjs` and eight direct `node --check` gates. Final root checks run only after assembly finishes. |
| Preservation regression suite | PASS 23/23. Actual preservation checks all 182 originals and currently reject only the unaccepted baseline status. |
| Initial root checks | FAILED 2/34: pending baseline and old assembled CSS observed while assembly was still running. This was an ordering error in verification, not waived or counted as a pass. Final sequential rerun: 33/34; only the intentional pending-baseline gate fails. The stale-assembly mismatch is resolved. |
| Default February 2024 arithmetic | PASS: 29,000/29 = 1,000 oil STB/day; 7,250/29 = 250 water STB/day; liquid 1,250; water cut 20%; selected injection 87,000 + 58,000 = 145,000 bbl/month. |
| Missing/zero values | PASS: P01 June water stays unavailable; I02 August injection blocks the complete total for that month. P02 September oil/water/liquid = zero, water cut unavailable. Gaps are not interpolated or replaced by zero. |
| Selections / period / stale state | PASS: producer edit disables downloads; empty injector selection leaves independently usable producer history and unavailable injection totals; reversed period blocks all context values; recalculation recovers. |
| Dates / original rows / keyboard | PASS: April 15 frac annotation, outside-coverage January 2026 event listed only, source rows expandable, keyboard focus reaches labelled chart scrolling region. |
| Navigation / refresh / repeated loading | PASS: direct route, Back/Forward retaining the current context; refresh retains route and clears session inputs/results; explicit repeated loading works. |
| Corrupt / delayed loads | PASS: altered bytes reject before decoding; delayed load can be cancelled and retried; changing planning source during an actually pending load cancels it. Test-only loopback proxies never modify original files. |
| Independent results / Reports | PASS: PVT, hydraulics and context Reports controls remain current after inspecting other tools. Context Reports JSON action saves an artifact identical to the context's own JSON. |
| Actual downloads | PASS JSON/CSV/SVG through Chrome after in-app download tracking failed. Exact raw bytes are retained; source/result hashes and independent arithmetic match. Regenerated SVG parity PASS: 210,733 bytes, SHA-256 `2fad23b463e917c5f9c19f6a5f3b1de191be9acd63afb68bfdaac35587e87779`. |
| Desktop layout | Initial FAIL fixed: workspace client/scroll 1265/1325 becomes 1265/1265 at CSS viewport 1536×1024. Calculate hover now has readable white text on dark blue. |
| Mobile layout | Initial FAIL fixed: document width 1422 becomes 375 at CSS viewport 390×844; workspace client/scroll 351/351. Charts/tables scroll within labelled regions. Final chart width 960px inside the 349px region gives native text scale 1; keyboard ArrowRight scrolls it by 40px without document overflow. |
| SVG label containment / Unicode | PASS all 44 rendered text elements fit in the current SVG. Wrapping preserves text, markup escaping and Unicode grapheme boundaries. Scales, dates and values remain unchanged; wrapping changes presentation bytes only. |
| Console observation | No error/warning observed in the bounded in-app check; this is not comprehensive browser or hosted monitoring. |
| ESLint | UNRUN: engineering paths are excluded by the repository ESLint configuration; this scoped CSS change has no configured CSS lint gate. No dependencies installed. |

## Visual comparison and limits

Fresh desktop captures cover all 12 original design workspaces. The actual application retains the six navy navigation areas, light workspace, active secondary tabs, source header, bounded inputs, tables and contextual warnings. It deliberately keeps real engineering workflows rather than illustrative controls: separate reconciliation, inspection-only curve library, real source package handling, coupled J/hydraulic constraints and current-format report cards. Existing histories are line charts rather than the mockup's bars, and panels are longer than the concept drawings. Sample chart shapes, case revisions and persistent saving are not copied as features.

The new context has its own tab. Its missing-month gaps, water-cut denominator handling and source evidence are actual calculated states. Desktop and mobile captures use CSS viewports 1536×1024 and 390×844; reported DPR is approximately 1 (`1.0000000298`). Screenshot content widths exclude the 15px vertical scrollbar. The SVG text-width estimate is not a general font model; actual bounding boxes establish this pinned fixture's fit.

Broader acceptance stays open for SWD-11, real TRRC/customer composition, maintained persistent curves/saved cases and separately proposed diagnostic fitting/PVT comparisons. Existing deferred PDF work remains deferred. Fresh CSV/XLSX worksheet/mapping flows, every older error state, a browser-timed slow-export interruption, the hosted Lovable adapter, actual Portfolio backend and the full two-app release were not re-exercised in this pass. Unit tests cover the export race and importer contracts; they do not substitute for unrun browser/hosted checks.

## Changed files and roles

New nested files: `src/pressureSupport.ts`, `src/pressureSupportChart.ts`, `src/pressureSupportExport.ts`; `data/pressure-support/example.json`, `pin.json`; `scripts/create-pressure-support-example.mjs`; `web/pressure-support.mjs`, `pressure-support-chart.mjs`, `pressure-support.css`; three `tests/pressure-support*.test.mjs` files.

Existing nested UI changes: `web/navigation.mjs`, `index.html`, `import-ui.mjs`, `workspace-views.mjs`. Exact original bytes remain under `migration/baselines/pressure-support-before/`.

Main-owned preservation changes: `scripts/verify-preservation.mjs`, `tests/preservation-baseline.test.mjs`, root `tests/transfer.test.mjs`, `.gitattributes`, and the new reviewed-delta baseline. Main-owned demo documents/evidence are additive; original inputs and their manifest remain intact.

Opus 5.5/high implemented the feature and scoped layout corrections; Fable 5.1/high reviewed independently, read-only; Main Codex performed integration, browser/download verification and preservation checks. Existing Claude Team authentication was used, with additional advisors/customizations disabled for these processes. No worker helpers, Git operations, purchases, billing changes or backend/permission changes were authorized or performed. The two-slot rule was checked procedurally.

The first resumed verification checkpoint was delayed by browser download API calls that failed to return within their requested timeouts; work stopped when the tool returned. The explicitly approved fix checkpoint runs from 21:43:15 to 22:43:15 UTC, without renewal for fix rounds.

## Final evidence and next verification

[Evidence manifest](pressure-support-evidence/manifest.json) records file hashes, screenshots, source inventories, checks and saved downloads. [Independent final correction review](pressure-support-evidence/checks/final-correction-review.md) passes the fixes but rejects plan acceptance for the explicitly unrun checks. [Desktop](pressure-support-evidence/browser/pressure-support-final-desktop.jpg) and [mobile](pressure-support-evidence/browser/pressure-support-final-mobile.jpg) are actual captures.

The reviewer initially read the earlier stability record while the final verification was running. The final record is dated **22:38:31 UTC**, checks **194 files**, and reports **zero changes after snapshot**, after the last CSS/source freeze. The accepted-status gate remains closed; no root transfer failure is omitted. Next checks are the fresh CSV/XLSX worksheet/mapping/validation walkthrough, remaining older error states, browser-timed slow-export interruption and separately authorized hosted/two-app verification.

## Resumed verification — October 13–14, 2026

Resumed from the handover at revision `c7a1cae` with the same uncommitted working tree. Evidence: [resume-2026-10-13/manifest.json](pressure-support-evidence/resume-2026-10-13/manifest.json); step-by-step record: [walkthrough.json](pressure-support-evidence/resume-2026-10-13/checks/walkthrough.json).

**Fresh gates (04:12 UTC, October 14):** the same gate runner on a fresh snapshot of the 194 files: compilation PASS, 390/390 engineering tests with none skipped, 248 carried comparisons with zero failures, both type checks, assembly and eight syntax checks PASS. `snapshot-stability.json` shows 194 files and **zero changes after snapshot**. This closes the reviewer's note that the stability check came before the final CSS/baseline. Root suite is 33/34; the only failure is the intentional pending-baseline gate.

Browser: local origin `http://127.0.0.1:4317`, CSS viewport 1536×1024 at DPR 1. The served CSS, controller, compiled module and fixture bytes match the working tree.

| Previously UNRUN check | Result | Observed |
|---|---|---|
| CSV/XLSX selection, worksheet, mapping, units, validation, quarantine, confirmation | **PASS** | XLSX lists `Notes`/`Water data`. The wrong sheet has no mappable rows. Unmapped columns quarantine all 48 rows, and so do STB/day + calendar-month. STB/day + calendar-day accepts 48 rows (3,753.34 STB/d × 31 d = 116,353.57 bbl). Confirmation hash `2a4cb53e…07925` equals the fixture. Malformed CSV quarantines all 5 rows with exact reasons, and Confirm stays disabled. Captured: [r01] (Notes sheet, before validation); after validation:(pressure-support-evidence/resume-2026-10-14-captures/browser/r01-notes-sheet.txt), [r03](pressure-support-evidence/resume-2026-10-14-captures/browser/r03-unmapped-validated.txt), [r04](pressure-support-evidence/resume-2026-10-14-captures/browser/r04-incompatible-units-validated.txt), [r05](pressure-support-evidence/resume-2026-10-14-captures/browser/r05-valid-validated.txt) (normalized 116353.5668 / 99710.6072 bbl), [r06](pressure-support-evidence/resume-2026-10-14-captures/browser/r06-xlsx-confirmed.txt), [r16](pressure-support-evidence/resume-2026-10-14-captures/browser/r16-invalid-csv-validated.txt). |
| Dependent-result invalidation | **PASS** | Changing the content assertion of a confirmed profile shows "Content assertion changed. Review validation and confirm again" ([r12](pressure-support-evidence/resume-2026-10-14-captures/browser/r12-assertion-changed-data.txt)). Fit & forecast then has no table and all three downloads are disabled ([r13](pressure-support-evidence/resume-2026-10-14-captures/browser/r13-production-after-invalidation.txt)). The independent context stays "Ready for inspection" with downloads enabled ([r14](pressure-support-evidence/resume-2026-10-14-captures/browser/r14-context-after-invalidation.txt)). |
| Customer/frozen forecast survive context inspection | **PASS** | Forecast table SHA-256 `f185f471…` and identity SHA-256 `4b8f25f0…` are identical before and after calculating context and using browser Back. The context labels the user dataset as separate and never substituted. Second pass: [r07](pressure-support-evidence/resume-2026-10-14-captures/browser/r07-forecast-fingerprint-before.json) and [r10](pressure-support-evidence/resume-2026-10-14-captures/browser/r10-forecast-fingerprint-after.json) have identical full table text and hashes, around the calculated context [r09](pressure-support-evidence/resume-2026-10-14-captures/browser/r09-context-calculated.txt). |
| Older-workspace insufficient data / zero availability | **PASS (listed scope)** | A cutoff with two training months blocks per-producer fitting: no table, downloads disabled, no NaN. With injector availability at 0%, all 12 months have a shortfall and 3,127,925 bbl is unmet. This equals 3,433,925 demand − 2,000 STB/d × 153 expansion days, and capacity is explicitly 0 before expansion. Not re-exercised: disposal-case compared availability 0 and sweep edge ranges. |
| Browser-timed slow-export interruption | **PASS** | Test-only page instrumentation delayed Web Crypto digests by 6 s; no source file changed. The producer changed about 7 s into sealing, and every download button disabled immediately. The result was "Context changed during export; nothing was downloaded", and no blob or download was created. |
| Stale programmatic export | **PASS** | `click()`, a direct `onclick()` and dispatched clicks on the disabled stale buttons produced no download. Recalculation recovered with a fresh export (`e32b2b9c…csv`). The positive-control JSON before interruption carried the recorded result `dadb99ea…`. |

Console: two browser "form field should have an id or name" issues, with no errors or warnings. Two steps used scripted, rather than accessibility-tree, interaction; `walkthrough.json` records both. After the independent review found that the import and invalidation states existed only as inline script output, a second UI-only pass captured them as snapshots: [resume-2026-10-14-captures](pressure-support-evidence/resume-2026-10-14-captures/manifest.json), with [the addendum](pressure-support-evidence/resume-2026-10-14-captures/checks/walkthrough-addendum.json) and [the exact slow-export instrumentation](pressure-support-evidence/resume-2026-10-14-captures/checks/slow-export-init-script.js). The addendum also corrects the first walkthrough's `recordedAt`.

Still not run: hosted Lovable adapter, Portfolio backend, two-app release, ESLint (engineering paths are excluded by its configuration), fresh upstream Vitest/Python checks, and a mobile re-capture in this pass (earlier 390×844 evidence stands). Independent plan acceptance is recorded in the next paragraph. The preservation baseline remains `pending-review`, and no commit, push or deployment was made.

**Independent plan-acceptance review (Fable 5.1/high, read-only).** First pass: PLAN_ACCEPTANCE FAIL on a single evidence gap. The import quarantine/validation and dependent-invalidation states had been read only as inline script output. It found no product defect and verified every other row against the files. After the second UI-only capture pass, the re-review gave **PLAN_ACCEPTANCE: PASS**, **BASELINE_APPROVAL_SUPPORTED_BY_EVIDENCE: YES** (the owner decides) and **WHOLE_PRODUCT_ACCEPTANCE: OPEN**. It checked both evidence manifests (30/30 and 19/19) and found zero differences between the 194-file inventory and the working tree. Known record defects that cannot be fixed in sealed files: the `recordedAt` values in `walkthrough.json` (04:45Z) and `walkthrough-addendum.json` (05:20Z) are later than when the files were written (about 04:23Z and 04:42Z). The r07/r10 fingerprints are script-computed measurements of UI-driven states. The x02–x04 "downloads" counted intercepted anchor clicks; real saved-download parity remains `checks/download-verification.json`.
