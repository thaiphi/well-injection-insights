# Sample case and guided tour: verification

Date: October 14, 2026. Branch `feature/sample-tour` (local, not pushed). Spec `docs/superpowers/specs/2026-10-14-sample-case-guided-tour-design.md`; plan `docs/superpowers/plans/2026-10-14-sample-case-guided-tour.md`.

## Automated gates

Run from the repository root on Node 24.13.0, with TypeScript 5.9.3.

| Gate | Command | Result |
|---|---|---|
| Static assembly | `node scripts/prepare-swd.mjs` | PASS |
| Root type check | `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| App type check | `node node_modules/typescript/bin/tsc -p swd-injection-analytics/tsconfig.json --noEmit` | PASS |
| Production build | `node node_modules/vite/bin/vite.js build` | PASS |
| Nested suite, including the server test | `node scripts/check-analytics.mjs --include-server` | PASS: build PASS; **432/432** engineering tests; carried oracles **248 comparisons, 0 failures** (4 cases, 28 exact pressure points) |
| Root tests | `node --test tests/portfolio-connection.test.mjs tests/preservation-baseline.test.mjs tests/transfer.test.mjs` | **45/46**. The one failure is the expected preservation red state (see below). |

**Expected red, pending owner approval.** `tests/transfer.test.mjs` test 1 (preservation) fails until the owner accepts the new chained baseline (`migration/sample-tour-baseline.json`, plan Task 10). `node scripts/verify-preservation.mjs .` checks all 182 originals and reports only the reviewed paths:
- the 5 changed UI files;
- the 2 changed root checker files;
- the 18 new product files listed in the plan.

There are no other violations. All 35 preservation-checker tests pass, including the 12 for the chained baseline.

## Browser acceptance

**Tooling deviation.** The Chrome DevTools MCP browser was held by another session, and the Claude in Chrome extension was not connected. The checks therefore ran on a separate headless Chrome (`--headless=new`, isolated profile) driven over the DevTools protocol by a small local script. Accessibility snapshots (`.txt`, from the full accessibility tree) and screenshots (`.jpg`) are in `demo/sample-tour-evidence/browser/`. The app was served by Vite at `http://127.0.0.1:4290/analytics/index.html`.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Start → **Try it with sample data** completes all 7 steps | PASS: 7/7 done in about 9 s, ending on Injector history | `01-start.*`, `02-one-click-progress.json` |
| 2 | Every main tool shows results; Reports cards are current | PASS: Histories, Fit & forecast, Reconciliation, Demand, Capacity assessment (base 5,715 STB/day, first shortfall 2026-01), Parameter sweeps, Pressure-support context, Brine PVT, Hydraulics; Reports shows current downloads for the capacity case, sweep, PVT, hydraulics and pressure-support, plus the gather-checklist card | `02`–`14-*.txt/.jpg` |
| 3 | Banner and provenance labels are visible | PASS: banner on every page; Data preview lists 50 inputs, each with one class; Capacity assessment, PVT and Hydraulics fields carry class labels | `07-injection-comparison.*`, `14-data-data.*`, `21-mobile-provenance-table.*` |
| 4 | Each Injector history export carries exactly one artifact and its pin | PASS: UIC 000020838 has 28 rows and its pinned artifact; SAND BEND 2D has 16 rows, its artifact and package SHA-256. The other well's ID appears only inside the sample case ID. | `10-exports-and-downloads.json` |
| 5 | Keyboard-only tour; Exit keeps the sample | PASS: Enter on **Take the guided tour** loads the sample and opens step 1 with focus on its heading; Tab/Enter reach steps 1→7 with the correct routes and highlights; Back, Escape and Finish work; focus returns to the banner button; the sample stays loaded | `15-tour-step1-*`, `16-tour-step4-*` |
| 6 | **Clear sample** → "None selected" | PASS | `23-clear-sample.json` |
| 7 | A customer upload after the sample never mixes values | PASS: Your upload plus `seed417-history.csv` gives user-path blocking text only; no `UIC-0000…` anywhere; switch and banner hidden | `11-*` |
| 8 | Downloads are byte-exact | PASS: gather checklist SHA-256 `e430496a…6111` (10,230 bytes) equals the Node-generated `checklistCsv`; all 5 sample files equal their `data/samples/` sources | `10-exports-and-downloads.json` |
| 9a | Producer schedule edited after loading | PASS: Capacity assessment says "The synthetic producer schedule changed after the sample loaded. Reload the sample case to restore it." | `11-schedule-edit-and-user-upload.json` |
| 9b | Illustrative defaults / editing a field | PASS: an edited field shows "Edited by you — no longer the sample value"; Illustrative defaults changes every well label | Task 6 run (ledger) |
| 9c | Fast first click, double click, cancel | PASS: a click 382 ms after page load completes; a double click gives one completed run; Cancel during step 5 stops before step 6 and says the load was cancelled | Task 6 run (ledger) |
| 9d | Refresh mid-tour | PASS: the tour and sample are gone; "None selected" | `17-refresh-mid-tour.json` |
| M | Mobile 390×844 | PASS: 7/7 load; the tour is a full-width bottom sheet (0–390 px, bottom 844); page scrollWidth 390 | `20`–`22-mobile-*` |

## Notes

- The compared scenario in Capacity assessment equals the base scenario (J factor 1, same tubing and availability), so "Compared effect" is 0 until the visitor changes a comparison input.
- On mobile, the Data provenance table scrolls sideways inside its own container. That is the app's existing table pattern.
- Independent review: see the final-review entry in the ledger and the owner summary.
