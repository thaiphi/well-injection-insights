# SWD Injection Analytics: feature inventory

As built at commit `4722d81` on main (2026-10-17). The site is live at https://swdinjectionanalytics.lovable.app.

Purpose: this report lets another agent see what the site does today and judge where new features could fit. File references are relative to the repo root. `N/` means the nested engineering app `swd-injection-analytics/`, and `web/`/`src/` mean `N/web/`/`N/src/`.

## 1. At a glance

```
Browser
  └─ / (outer TanStack shell, src/routes/index.tsx)
       └─ full-page redirect → /analytics/index.html  (the engineering app, built by scripts/prepare-swd.mjs)
            ├─ Source modes: none · Synthetic demo (seed-417) · RRC Explorer (pinned / imported .tar / handoff) · User upload · Sample case
            ├─ 6 areas, 21 workspaces (hash routes #area/id, web/navigation.mjs)
            ├─ Calculations in the browser (N/src/*.ts compiled to N/dist/, one Web Worker for sweeps)
            ├─ Exports: JSON / CSV / SVG per tool; PDF for the original workbook only
            └─ "Data storage · Portfolio" panel → API health check only (no saving)
```

- **Session only:** nothing is saved and there is no sign-in. The header always shows "Session only · no saved case".
- **Calculation:** all of it runs in the browser. The only network calls fetch pinned data files and run an optional Supabase health check.

## 2. Tools (workspaces)

Source modes: **D** = synthetic demo, **P** = public TRRC Explorer, **S** = sample case, **U** = user upload, **any** = independent of the source.

| Area | Tool (id) | What it does | Key inputs | Outputs | Modes | Main module |
|---|---|---|---|---|---|---|
| Start | Assessment (`start`) | Landing page: guided assessment, "Try it with sample data", "Take the guided tour", tool cards | — | Navigation | any | `web/import-ui.mjs` |
| Start | Original workbook (`legacyCapacity`) | Synthetic demand vs injection capacity planning case | Producer start, availability, Injector A J, expansion month and STB/d, ramp | Shortfall summary, 3 charts, reconciliation table, PDF | D | `planning.ts`, `exhibit.ts` |
| Start | Worked pressure/skin study (`literature`) | Steady radial skin-penalty comparison (Jin, Wojtanowicz & Ge 2022) | Skin 0–50, rate 2,000–10,000 rb/d | Psi added, chart, table | any | `literatureExample.ts` |
| Data | Sources & import (`data`) | Choose a source; receive an Explorer package; 5-step CSV/XLSX import wizard; requirements per analysis; templates | File ≤10 MiB, profile, content assertion, sheet, header, mapping, units, time basis | Preview, validation table (accepted/quarantined/excluded) | any | `importProfile.ts`, `importValidation.ts` |
| Data | Readiness (`readiness`) | Ready/not-ready card per analysis (10 analyses), with reasons and a fix button | — | Readiness cards | any | `web/workspace-state.mjs` |
| Data | Source lineage (`lineage`) | File, origin, SHA-256, mapping, units and coverage per input | — | Lineage cards | any | `web/import-ui.mjs` |
| Production | Histories (`history`) | Producer water history, filterable | — | Table and chart | D, S, U | `importAnalysis.ts` |
| Production | Fit & forecast (`forecast`) | Exponential log-rate fit, frozen forecast vs holdout | Cutoff, first/last month (U) | Fit chart and parameters | D, S, U | `planning.ts` |
| Production | Reconciliation (`reconciliation`) | Actual minus forecast, running variance | — | Variance table | D, S, U (U needs holdout actuals) | `planning.ts` |
| Production | Curve library (`curveLibrary`) | Read-only list of fitted snapshots | — | Table | D, S, U | `web/workspace-views.mjs` |
| Production | Schedules (`schedules`) | Producer schedules (D/S: mirrored controls; U: imported rows) | Start, ramp, availability | Schedule table | D, S, U | `web/workspace-views.mjs` |
| Production | Demand (`groupedPlanning`) | Frozen forecast plus additions = total demand per month | — | Contribution table, assembly chart | D, S, U | `planning.ts` |
| Production | Pressure-support context (`pressureSupport`) | Producer rates, water cut, injector volumes and frac dates on one time axis (pinned synthetic example) | Producer, injectors, months | Chart, monthly table, events, sealed exports | any (own example) | `pressureSupport.ts` |
| Injection | Injector history (`publicTrends`) | TRRC H-10 monthly injected bbl, calendar-day rate, reported pressure (basis unspecified) | Well switch (S) | 3 charts and a table | P, S | `publicArtifact.ts` |
| Injection | Injectivity (`capacity`) | Declared constant J, pressure-limited and available rate, BHP vs rate | J, pressures (D/U) | Table, chart per injector | D, U (S redirects) | `engineering.ts` |
| Injection | Capacity assessment (`comparison`) | Connected disposal case: demand evidence → fluid → well geometry and limits → compare one changed well | Fluid (P, T, NaCl), uniform or segmented model, TVD/MD/ID/roughness/surface limit, comparison | Base/compared cards, demand vs capacity envelope, limiting constraints, WHP vs rate, depth profiles, monthly allocations | D, S, U (P blocked) | `disposalCase.ts`, `wellboreTraverse.ts`, `brinePvt.ts` |
| Injection | Scenarios (`scenarios`) | Same workspace as Capacity assessment, titled "Compare operating scenarios" | as above | as above | D, S, U | `disposalCase.ts` |
| Injection | Parameter sweeps (`sensitivity`) | One-at-a-time sweep of J, tubing ID or availability (3–9 points) in a Web Worker | Parameter, min/max, points | Capacity and unmet-volume charts, table | needs a calculated case | `disposalSensitivity.ts` |
| Injection | Model scope (`transient`) | Read-only ledger of implemented vs proposed capabilities | — | Table | any | `web/workspace-views.mjs` |
| Fluid | Brine PVT (`pvt`) | Gas-free NaCl brine properties vs pressure (pyResToolbox port, 45 reference cases) | Min/max psia, T 60–250 °F, NaCl 0–20 wt%, points | Bw, density, viscosity and compressibility charts and table | any | `brinePvt.ts`, `pyrestoolboxBrine.ts` |
| Fluid | Hydraulics / Profiles (`hydraulics`, `profiles`) | Standalone wellbore calculation for one assumed injector | Rate, J, pressures, geometry, fluid, segment count | Required WHP/BHP, gravity and friction terms, curves, depth profiles | any | `disposalCase.ts`, `wellboreTraverse.ts` |
| Reports | Reports (`reports`) | 8 report cards linking to each tool's exports; the sample "what you'd gather" checklist | — | Downloads | any | `web/workspace-views.mjs` |
| Reports | Evidence & limitations (`evidence`) | Evidence-boundary table | — | Table | any | `web/workspace-views.mjs` |

Global elements:
- A "Guided capacity assessment" strip runs Data → Forecast → Schedules → Demand → Injectivity → Capacity → Reports.
- An "Acceptance blockers" disclosure.

## 3. Data sources and provenance

| Source | What it is | How it is checked |
|---|---|---|
| Synthetic demo | Seed-417: 2 fictional producers (2025 used for training, 2026 as holdout) and 2 fictional constant-J injectors | Fixed fixtures |
| Pinned TRRC Explorer artifact | UIC 000020838: 28 monthly H-10 rows (2024-01 to 2026-04) and 5 inventory candidates | SHA-256 pin plus `validatePublicArtifact`; missing wells are shown as "not zero" |
| Imported Explorer package | A `.tar` file of 1 KB–81 MB | Verified and previewed, then adopted only on confirmation and only for the session; calculations fail closed unless eligible |
| One-click Explorer handoff | `postMessage` from the companion Explorer app | Origins are hard-coded to localhost (127.0.0.1:4391 → :4290), so it is likely not usable on the hosted site (unverified) |
| User upload | CSV/XLSX profiles for history, schedule and injector | Mapping, units and time basis; limits of 10 MiB, 50 sheets, 100 columns and 100k rows; no formulas or macros; recorded with origin `user`, its SHA-256 and `verified:false` |
| Sample case | Two real wells from TRRC plus labelled synthetic gaps (section 4) | SHA pin `aab8129f…` |

**Content assertions for uploads:** Synthetic · Measured — unverified · Public reported — unverified · Literature-derived · Assumed.

**Sample value classes** (`src/sampleCase.ts`):
- TRRC public record
- Calculated
- Derived from TRRC with a stated assumption
- Synthetic: you'd gather
- Raw TRRC field, not verified

The code enforces that a TRRC value can never be relabelled as BHP or reservoir pressure.

## 4. Sample case and guided tour

**"Try it with sample data"** loads `swd-sample-case/uic000020838+uic000056484/v1`:
- **Wells:** UIC 000020838 and SAND BEND 2D (UIC 000056484).
- **Derived values:** surface limit = permit pressure + 14.7 psi; datum = top of the permitted interval.
- **Synthetic values:** reservoir/limit pressures, J, MD, tubing ID, roughness, fluid inputs.

The 7 loading steps, with progress shown and Cancel available:
1. Verify the sample and both TRRC records.
2. Select the sample as the planning source.
3. Load and calculate the pressure-support example.
4. Calculate the capacity assessment.
5. Run the default parameter sweep.
6. Calculate brine PVT.
7. Calculate hydraulics.

Other behaviour:
- Every filled field shows its class, which changes to "Edited by you" after an edit.
- "Clear sample" restores the page defaults.

**Guided tour:** 7 stops. It is non-modal, Escape exits, and exiting keeps the sample loaded. Each stop lists what came "From TRRC" and what "You'd gather".
1. Injector history
2. Produced-water histories
3. Fit and forecast
4. Capacity assessment
5. Scenarios and parameter sweeps
6. Pressure-support context
7. Reports and your checklist

## 5. Exports

| Tool | Files | Notes |
|---|---|---|
| Original workbook | `swd-technical-exhibit.json/.csv/.svg/.pdf` | The PDF is 4+ pages with the JSON attached, built in the browser by pdf-lib; demo mode only |
| Any selected analysis | `swd-selected-analysis.json/.csv/.svg` | Schema `workspace-exhibit/1`; blocked outputs are nulled |
| Capacity assessment | `swd-disposal-case.json/.csv/.svg` | Includes the case SHA; re-checks the source before writing; sample exports list derived inputs and their assumptions |
| Parameter sweep | `swd-capacity-sweep.json/.csv/.svg` | Hash re-verified |
| Brine PVT | `swd-brine-pvt.json/.csv/.svg` | |
| Hydraulics | `swd-standalone-hydraulics.json/.csv/.svg` | Blocked if the inputs changed |
| Literature study | `swd-literature-entrada-skin.json/.csv/.svg` | |
| Pressure-support context | `pressure-support-context-{hash}.json/.csv/.svg` | Sealed with the source bytes |
| Gather checklist | `swd-sample-gather-checklist.csv` | Sample mode only |
| Import templates | `swd-{history,schedule,injector}-template.csv` | Plus sample files under `/data/samples/` |
| Explorer package | `{artifactId}-complete-version.tar` | Only after adoption |

There is no PDF for the capacity case, the sweep or the study. An offline Python PDF script exists (`N/scripts/export-pdf.py`) but is not part of the site.

## 6. Rules a new feature must follow

| Rule | Meaning | Source |
|---|---|---|
| Agreed scope | SWD Analytics demonstration only. No permitting, GIS, private operating data, live SCADA, site-viability, safe-operating-pressure, seismicity or calibrated real-asset capacity claims. | `N/AGENTS.md`, `N/product-spec.md:13` |
| Preserve the engineering app | Never regenerate calculations, drop reference fixtures or replace exports with illustrative output. The outer project is only a host. | `AGENTS.md` |
| Preservation gate | `node scripts/verify-preservation.mjs .` checks 182 originals plus reviewed changes. Editing a protected file needs a new chained baseline: plan doc, before-archives, independent review, owner acceptance. Existing layers: pressure-support, sample-tour, line-ending, sample-minors. | `scripts/verify-preservation.mjs`, `migration/` |
| TRRC labelling | Synthetic data is never shown as an Explorer record. Null is not zero. Reported pressure is never BHP. A permit wellhead maximum is not a BHP limit without a justified conversion. API number is never a join key. | Sample-tour spec section 3, `N/GLOSSARY.md` |
| Invalidation | Any input edit invalidates dependent results and exports. Availability is applied once. | `N/HANDOVER.md:85`, `N/product-spec.md:50` |
| Backend | Use only the existing Portfolio Supabase (`phxiqnsebqaalvkanljb`), not Lovable Cloud. Schema, upload or permission changes need an explicit scope. Only publishable keys may appear in the browser. | `AGENTS.md`, `integrations/portfolio/` |
| Navigation | Full-document navigation only, no iframes. Generated `public/` is rebuilt by `scripts/prepare-swd.mjs`, never hand-edited. | `AGENTS.md` |
| Checks | Use direct Node only. Nested `node --test tests/*.test.mjs` (435 tests) and `node scripts/check-carried-oracles.mjs` (248 comparisons). Root `node --test tests/transfer.test.mjs tests/preservation-baseline.test.mjs` (69 tests). | `AGENTS.md` |
| Delivery | `main` syncs to Lovable; the site goes live only when the owner publishes. Merge and push each need an explicit owner instruction. | Owner process |

## 7. Extension points already named in the repo

These are listed as proposed or deferred, which makes them the most natural candidates:

| Candidate | Current state | Where it is noted |
|---|---|---|
| Curve library CRUD (name, save, revise, clone, compare, assign) | Read-only, labelled "Proposed" | `web/workspace-views.mjs:9-10`, `N/HANDOVER.md:140` |
| Imported schedule ramps/downtime, "Add producer" editor, graphical schedule timeline | Proposed | `web/workspace-views.mjs:29` |
| Diagnostic J fitting from injection history | Proposed | `web/workspace-views.mjs:72`, `N/HANDOVER.md:142` |
| Transient, layered or calibrated capacity (SWD-11 / P2) | Not implemented | `web/workspace-views.mjs:73`, `N/HANDOVER.md:137` |
| Customer + TRRC source composition, including real-data pressure support | Proposed | `web/workspace-views.mjs:74`, `web/pressure-support.mjs:84-88` |
| PVT temperature/salinity sweeps and correlation comparisons | Proposed | `N/HANDOVER.md:142`, `N/DEMO.md:64` |
| PDFs for the capacity case, sweep and study | Deferred | `N/DEMO.md:5`, `web/workspace-views.mjs:65` |
| Saved cases, sign-in, uploads, curve storage on Portfolio Supabase | Needs a schema and access model, explicitly scoped | `N/HANDOVER.md:144` |
| Hosted Explorer handoff (non-localhost origins) | Needs a contract review | `N/HANDOVER.md:145` |
| Partial use of accepted rows in an incomplete Explorer package | Future work | receiver-correctness doc, line 47 |
| Decline-curve analysis (pyResToolbox DCA), cohort fitting | Not integrated | `web/import-ui.mjs:178`, `web/workspace-views.mjs:14` |
| Open acceptance items: full parser review, broader physics validation, hosted/mobile acceptance | Open | `N/HANDOVER.md:138-146` |

## 8. Known quirks

- `index.html` still contains 8 legacy sidebar buttons. They are replaced at runtime, but the aliases `exhibit`→`reports` and `wellbore`→`hydraulics` still work.
- Capacity assessment and Scenarios are one workspace with two titles.
- In sample mode, Injectivity and Original workbook show redirect messages instead of results.
- `N/HANDOVER.md:12` says the site is unpublished; that is stale. It has been live since the sample-tour publish.

Inventory compiled from a read-only source sweep, with each claim tied to a file reference. Items marked "unverified" were not exercised in a browser.
