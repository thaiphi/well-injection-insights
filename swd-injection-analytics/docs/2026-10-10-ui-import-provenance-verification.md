# Analytics import/provenance UI verification

This is a bounded UI and data-to-analysis revision. **Full acceptance remains OPEN.** Known calculation and parser defects were contained in presentation/readiness, not repaired in the engines. Work stayed in `swd-injection-analytics`; no commits, pushes, deployment, dependency installation, or permission changes were made. Existing uncommitted work was preserved.

The original timebox started **2026-10-09 23:29:41 UTC**, with a hard stop of **2026-10-10 00:29:41 UTC**. It was not restarted. The PRD, owner AGENTS instructions, and `2026-10-09-plan-compliance-completion.md` were read before changes. Current user authorization governs this implementation despite the plan's historical documentation-only status.

## Reference comparison and visual scope

Both supplied JPGs were accessible and inspected. The import/provenance reference is `ChatGPT Image Oct 9, 2026, 06_26_05 PM.jpg`; the capacity reference is `ChatGPT Image Oct 9, 2026, 06_26_34 PM.jpg`. Neither image was treated as an instruction source.

Before edits, the app used a broad workbook layout, oversized editorial heading, top-row scenario controls, and separate low-priority imports/public-history sections. It lacked the reference's persistent navy navigation, three source cards, paired import/requirements panels, readiness band, and source-lineage hierarchy. These differences and the intended files were reported before implementation.

| Reference element | Implemented change | Remaining difference |
|---|---|---|
| 209 px navy left navigation; six destinations | 208 px navy sidebar, active item, six destinations; horizontal mobile navigation | Navigation symbols are simpler than the reference's icon set |
| Compact sans-serif heading and reservoir/disposal subtitle | Segoe UI/Arial hierarchy; persistent active-dataset bar | Added dataset identity consumes more height |
| Amber demo, blue RRC, lavender upload cards | Matching source color families; explicit selection; real selected-source sample rows | Uses the actual pinned RRC export, not an invented version selector; file chooser instead of a decorative drop zone |
| Import table on left, requirements on right | Five-stage import, original preview, field/unit mapping, paginated row validation; per-analysis requirements table | Expanded import controls and truthful validation make the working view taller |
| Readiness and lineage beneath imports | Separate gates/reasons, source hashes, origin/content, units, dates, assumptions | Eight principal readiness cards; lineage follows below the first desktop fold |
| Capacity KPIs, large main plot, assumptions at right, two lower plots | Navy/teal calculated plots, compact KPI cards, right-hand assumptions; lower forecast/pressure plots | Preserves actual monthly volume calculations and existing KPIs; lower plots extend below the first fold |
| Illustrative rates, uncertainty, cohorts | Correct bbl monthly-volume and STB/day rate labels; actual engine outputs | No invented P10–P90 envelope or mockup cohort curves; producer histories remain inspectable tables |

Desktop was captured with the initial 1536×1024 browser override and later aligned to **1535×1024 CSS pixels** against the 1536×1024 reference. The browser's existing 90% zoom and integer-only viewport control prevented an exact one-pixel width match. Mobile was verified at **390×844 CSS pixels** (373 px content width plus scrollbar). Screenshots are original browser captures, not mockups or edited composites. Native screenshot pixel dimensions include browser scaling.

## Actual screenshots

- [Before — original top](../tmp/ui-revision/before-desktop-top.jpg)
- [Before — original import area](../tmp/ui-revision/before-desktop.jpg)
- [Final desktop imports and sample preview](../tmp/ui-revision/final-imports-desktop.jpg)
- [Full desktop import/readiness/lineage page](../tmp/ui-revision/final-imports-desktop-full.jpg)
- [Final desktop capacity and assumptions](../tmp/ui-revision/final-capacity-desktop.jpg)
- [Final mobile source selection](../tmp/ui-revision/final-imports-mobile.jpg)
- [Mobile table keyboard focus and horizontal scrolling](../tmp/ui-revision/final-mobile-table-keyboard.jpg)
- [Real malformed-row validation](../tmp/ui-revision/malformed-row-errors-desktop.jpg)
- [XLSX confirmed forecast](../tmp/ui-revision/xlsx-forecast-desktop.jpg)
- [Final public analysis](../tmp/ui-revision/final-public-desktop.jpg)

The XLSX and malformed-row captures were taken during workflow testing before the last caption/spacing polish. Final desktop/mobile captures reflect the finished visual pass.

## Changed files and requirement coverage

| File | Responsibility | Requirement IDs |
|---|---|---|
| `web/index.html` | Navigation, source cards, staged importer, requirements/readiness/lineage, acceptance-blocker disclosure, capacity panel arrangement | SWD-13, SWD-14; A0/A3 |
| `web/styles.css` | Reference palette, typography, panels/tables, responsive layout, keyboard focus | SWD-01–08 presentation; A3 |
| `web/import-ui.mjs` | File/sheet/mapping/unit workflow, confirmation invalidation, actual calculation routes, source-specific rendering and exports | SWD-13/14; SWD-01–08 integration; A0/A3/A4 |
| `web/workspace-state.mjs` | Confirmation lifecycle, defect-aware readiness, safe CSV serialization, withholding blocked export outputs | SWD-13/14, SWD-03/06/08 |
| `web/app.mjs` | Source-aware demo/public evidence, current-revision readiness, stale export protection, chart styling, accessible table labels | SWD-01–08/14 |
| `tests/workspace.test.mjs` | Seven lifecycle, readiness, overflow, CSV/template and export-containment tests | SWD-03/06/08/13/14 |
| This document | Criterion-level evidence and remaining gaps | SWD-09/13/14 |

Scratch evidence, original file backups, downloaded exhibits, hashes and isolated test snapshots are under `tmp/ui-revision/`. Engine source, pinned Explorer files, recorded reference fixtures and vendor files were not changed. SWD-09 was revalidated through the carried reference checks. SWD-10/P1, SWD-11/P2 and the broader SWD-12/P1 remain explicitly unavailable; their priorities were not changed.

## Browser checks

| Exercise | Observed result |
|---|---|
| CSV choose → original preview | Seed-417 sample exposed 48 original rows; no automatic confirmation |
| Missing mapping/units | 0 accepted / 48 quarantined; confirmation disabled |
| Mapping correction and declared units | Producer/group/month/water with STB/day and calendar-day yielded 48 accepted rows; confirmation enabled real history/forecast/reconciliation |
| XLSX choose and worksheet selection | Worksheet required; Notes and Water data selectable; Water data normalized to the same 48 observations |
| XLSX calculation and downloaded JSON | January forecast **180,697.6360618436 bbl**, matching the calculation; origin `user`, content `synthetic`, file hash and worksheet retained |
| Units after confirmation | Changing to STB/hour invalidated confirmation, readiness and results |
| Mapping after confirmation | Mapping month to Water exposed duplicate-column/48-row errors; correction and re-confirmation restored results |
| Worksheet after confirmation | Switching to Notes cleared prior confirmation/results; switching back required new mapping/confirmation |
| Header row | Invalid header produced a specific validation error; header input now invalidates immediately |
| Malformed CSV | Five rows quarantined with missing producer, missing group, invalid month, negative volume and nonnumeric value reasons; no confirmation |
| Analysis selection | Imported history/forecast/reconciliation, demo reconciliation/grouped demand, capacity scenarios, and pinned public trends rendered actual data |
| Invalid demo scenario | RED: ramp=0 previously left grouped demand ready. GREEN: not ready, exact minimum/ramp reason, old generic rows removed; correcting to3 restored valid output |
| Source change | Active identity, sample, lineage and analysis routes changed together; public observations stayed separate from synthetic forecasts |
| Mobile/keyboard | No document horizontal overflow; Tab moved navigation focus with visible outline; wide data table was focusable and scrolled within its panel |
| Exports | Actual JSON, CSV, SVG and existing demo PDF downloads saved and inspected |

Browser coverage limits: a complete schedule-plus-injector upload sequence was not repeated through the browser; those paths have engine/unit coverage. Exhaustive keyboard traversal, screen-reader testing, all browser engines, and an induced asynchronous PDF source-switch race were not performed. The source/version guards were inspected; normal PDF download was exercised. New user/public result routes provide CSV/JSON/SVG, not a new PDF layout; the existing synthetic technical PDF is preserved.

## Gates and downloaded evidence

| Command / check | Result |
|---|---|
| `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` | PASS |
| `node --check web/app.mjs` | PASS |
| `node --check web/import-ui.mjs` | PASS |
| `node --check web/workspace-state.mjs` | PASS |
| `node --test tests/*.test.mjs` in `tmp/ui-revision/check-snapshot` | **PASS 66/66**; 0 failed/skipped. Snapshot isolates pre-existing fixture-writing tests. Existing loopback tests ran with approved local execution. |
| `node scripts/check-carried-oracles.mjs` in that snapshot | **PASS 248 comparisons**, 4 recorded cases, 28 pressure points, 0 failures |
| `node tmp/ui-revision/verify-downloads.mjs` | PASS: real XLSX forecast value; 28 public rows; pin hashes retained in JSON/CSV/SVG; 10-page PDF with valid embedded JSON content SHA-256; all 30 protected files unchanged |
| Downloaded SVG parsed as XML | PASS; SVG namespace, source hash, coverage, units and assumptions present |
| Astra review | Initial findings fixed; final read-only review PASS for current-revision demo gating, result clearing and source separation. Browser coverage was performed by the primary agent, not independently repeated. |

No configured ESLint gate exists in this package. No upstream Vitest or live Python/pyResToolbox run was attempted; the supported carried-reference comparison was used. Full test output: [final-tests.log](../tmp/ui-revision/final-tests.log).

Downloaded evidence: [public JSON](../tmp/ui-revision/download-public-analysis.json), [public CSV](../tmp/ui-revision/download-public-history-final.csv), [public SVG](../tmp/ui-revision/download-public-history.svg), [demo PDF](../tmp/ui-revision/download-demo-exhibit.pdf), [XLSX result JSON](../tmp/ui-revision/download-xlsx-analysis.json). The XLSX JSON was captured before the final export-containment change; the new withholding behavior is covered by tests and review probes.

## Acceptance blockers and remaining gaps

1. **SWD-03/06:** imported scheduled planning can omit existing producer demand. The UI lists omitted identities and blocks affected portfolio demand/deficit results; exports withhold blocked outputs. The calculation defect remains.
2. **SWD-13:** spreadsheet error cells may enter the engine as text identifiers; the UI prevents confirming those cells. The XLSX ZIP directory-count guard remains defective. Parser correctness/security acceptance is still open.
3. **SWD-05/06/08:** extreme finite inputs can overflow. Affected analysis gates now reject non-finite monthly/engineering output and exports withhold it; engine overflow handling remains unresolved.
4. **SWD-08:** the underlying exhibit API can accept contradictory input/output bundles. Current browser assembly uses consistent calculated inputs; the API defect remains.
5. The cited executable literature example, extended hydraulics, broader sensitivity and transient/calibrated models remain incomplete. Wider completion-plan documentation/delivery gates were not silently closed by this pass.
6. Visual fidelity is improved but not pixel-identical: more vertical space, below-fold lineage/lower charts, simplified icons, and table-based producer histories. No unsupported uncertainty or cohort data was fabricated.
7. UI controller source is JavaScript checked for syntax and behavior; the TypeScript gate covers the existing TypeScript project, not a new static type-check of all browser modules.

These are acceptance limitations, not a claim that the entire approved PRD is complete.
