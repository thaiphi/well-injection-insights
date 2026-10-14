# SWD Injection Analytics — engineering demo

The demo answers: **How does forecast produced-water demand compare with an assumed disposal envelope, what limits that envelope, and how does the answer change under a declared scenario?** Results are educational screening, not calibrated sustainable capacity or a prediction of reservoir-pressure evolution.

The new connected-case PDF is deferred. Existing calculations and exports remain in use. Full product acceptance stays open for the unfinished scope and verification boundaries below.

## Open the application

On the current computer, the dedicated engineering server is at **http://127.0.0.1:4317/**. Its terminal must remain running. This serves the preserved engineering app directly; it does not verify the Lovable hosting adapter or Portfolio Supabase connection.

For the GitHub/Lovable adapter or another computer, follow [HANDOVER.md](HANDOVER.md). Its route is `/analytics/index.html`. No installation, hosted release, database migration or publishing is part of this demo preparation.

## Main walkthrough

1. **Start → Start guided assessment → Data & sources → Load demo dataset.** Point out the active synthetic dataset and browser-session-only state. Public observations and customer uploads are separate selections.
2. **Production & demand → Fit & forecast.** Inspect the producer history, training cutoff, local exponential method and frozen forecast identity. In Reconciliation, show the independent holdout and actual-minus-forecast monthly/cumulative differences. This is not pyResToolbox DCA integration or statistical cohort fitting.
3. **Schedules → Demand.** Show existing frozen forecasts and distinct scheduled additions, then their contributions to total calendar-month volume. The original synthetic workbook provides declared ramp and availability assumptions. Moving a new-producer start must not alter the existing frozen forecasts.
4. **Injection & capacity → Capacity assessment.** Keep the declared uniform-fluid assumptions and geometry initially. Set the compared injectivity multiplier to **0.5** for the selected first injector, then calculate. Inspect the demand chart, binding constraints, first shortfall and unmet volume. Compare the same demand in both scenarios.
5. **Explain the sensitivity.** The current default uniform case gives base capacity about **5,487.30 STB/day** and half-J compared capacity about **3,670.85 STB/day**. Both first shortfalls are January 2026; the comparison adds about **663,007.16 bbl** of unmet volume. These are conditional results for these demonstration inputs, not operating recommendations.
6. **Reports & evidence.** Use the existing connected-case JSON/CSV/SVG, or open the original workbook for its existing PDF. Show units, source identity, assumptions and limitations. Change an input and show that dependent results/downloads become stale; recalculate before downloading again.

Do not present the original workbook and connected hydraulic case as numerically identical. The workbook includes a dated lumped capacity expansion; the connected case counts only its explicitly listed wells and hydraulic constraints.

## Independent engineering tools

- **Brine PVT:** calculate Bw, density, viscosity and compressibility over the declared pressure range at the selected temperature/NaCl composition. The live source-attributed adapter is separate from the retained historical Nexus Bw defect. Source agreement does not establish full-domain physics validation.
- **Hydraulics / Profiles:** calculate gas-free downward brine flow from declared geometry, rate, fluid and pressure inputs. MD and TVD remain distinct; gravity adds pressure downward and friction removes it. Compare uniform and depth-dependent models; inspect unsupported operating points instead of treating them as valid capacity.
- **Parameter sweeps:** vary J, tubing diameter or availability one at a time around a current case. Keep the baseline, units, failed/unsupported points and assumptions visible. These are sensitivities, not probability percentiles.
- **Worked pressure / skin study:** open the separately cited Jin et al. steady example, equations, input units and limitations. It is neither transient simulation nor field calibration.
- **Public injector history:** explicitly select the verified pinned Explorer artifact. Monthly bbl, calculated calendar-day bbl/day and reported pressure are different quantities. Reported monthly pressure has unspecified basis/datum and is not fitted bottomhole injectivity.

## Customer-import demonstration

The files in [demo/inputs](demo/inputs) are fictional demonstration inputs. Uploading them gives acquisition origin **user**; content remains **synthetic** or **assumed**, unverified. [demo/manifest.json](demo/manifest.json) records exact hashes, mapping units and independent demand checks. Five files are byte-identical copies of preserved fixtures; three demonstrate the existing schedule/injector contract. Original fixtures are untouched.

| Profile | File | Content assertion | Mapping and units |
|---|---|---|---|
| Produced-water history | [seed417-history.csv](demo/inputs/seed417-history.csv) or [seed417-history.xlsx](demo/inputs/seed417-history.xlsx) | Synthetic | Producer→producer, Group→group, Month→reporting month, Water→water; STB/day and calendar-day basis. Cutoff 2025-12; analysis 2026-01 through 2026-12. |
| Producer schedule | [demo-schedule.csv](demo/inputs/demo-schedule.csv) | Assumed | Producer, Group, Start, InitialRate, Decline, Availability; STB/day, fraction/month and fraction. NEW starts 2026-04-01 at 6,000 STB/day. |
| Constant-J injector | [demo-50-stbd-injector.csv](demo/inputs/demo-50-stbd-injector.csv) | Assumed | id, j, pres, limit, rb, lb, rd, ld, ceiling, availability; STB/day/psi, psia, STB/day and fraction. Explicit matching bottomhole-absolute basis/datum. |

For each profile: choose file/worksheet, inspect preview, map columns and units, review validation, then confirm. Other confirmed profiles remain in the user dataset. Imported schedules use a declared initial rate, exponential decline and constant availability; they do not support the synthetic workbook's ramp editor or month-varying downtime.

For this deliberately low 50 STB/day ceiling example, the independently checked monthly anchors are:

| Month | Existing forecast bbl | Addition bbl | Total demand bbl | Constant-J capacity bbl | Shortfall bbl |
|---|---:|---:|---:|---:|---:|
| Jan 2026 | 180,697.636062 | 0 | 180,697.636062 | 1,550 | 179,147.636062 |
| Apr 2026 | 166,068.813026 | 180,000 | 346,068.813026 | 1,500 | 344,568.813026 |

These anchors check the import analysis's constant-J timeline. A connected hydraulic case additionally needs geometry and surface/fluid assumptions. Customer geometry starts blank; illustrative geometry must be an explicit choice and stays an assumption.

## Failure and recovery checks

- [demo-overlap-schedule.csv](demo/inputs/demo-overlap-schedule.csv) repeats an existing producer ID. Total demand must be blocked, with the existing forecast still independently inspectable. Restore the distinct NEW schedule by re-uploading, validating and confirming it. Do not rename real existing production merely to bypass the guard.
- [invalid-history.csv](demo/inputs/invalid-history.csv) and [invalid-formulas.xlsx](demo/inputs/invalid-formulas.xlsx) must show row errors/quarantine and prevent confirmation. Restore a valid file and repeat mapping, units, validation and confirmation.
- A file, worksheet, mapping, unit or content-assertion change must invalidate dependent confirmation/results. Missing values must remain distinct from zero; this is a contract/test check, not a separately exercised live step in this demo pack.
- J multiplier 0, reversed PVT pressure range and MD less than TVD must reject the affected calculation. Restore valid inputs and recalculate; independent tools retain their own inputs.
- Zero availability contributes zero capacity once. A bottomhole pressure limit at/below reservoir pressure gives zero formation capacity; this is engine-tested, but not exercised by a supplied demo input or this browser pass. It must not be described as missing data or a positive injection envelope.
- Refresh preserves the route but clears the session dataset, assumptions and results. Re-select/import intentionally; no saved case is claimed.

## Scope still unfinished

SWD-11 transient/layered/calibrated capacity is not implemented. General TRRC/customer source composition, maintained persistent curve revisions, saved cases, diagnostic-history J fitting, temperature/salinity PVT sweeps and new PDF families remain proposals or separately scoped work. Comprehensive parser/dependency and broader physics validation, whole two-app G2 and full hosted/mobile acceptance remain open until their actual gates pass. Existing local test/browser evidence is narrower than full product acceptance.

Current local results and their limits are in [DEMO-VERIFICATION.md](DEMO-VERIFICATION.md). Actual user-case JSON/CSV/SVG parity passed; timed walkthrough, fresh workbook PDF and hosted release checks remain unrun. A screenshot or enabled download alone does not establish release readiness.

The requested producer rate/water-cut overlay, synthetic H-10-like monthly injection context and frac-date annotations are implemented in a separate **Production & demand → Pressure-support context** view. Verification and remaining limits are recorded in [PRESSURE-SUPPORT-VERIFICATION.md](demo/PRESSURE-SUPPORT-VERIFICATION.md). The existing producer importer remains water-only; real TRRC/customer producer/event matching and source composition require separate work. This investigation view must not be presented as proof of reservoir pressure support.


