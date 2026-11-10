# E05 Scenario and Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rule-based case summary, a history-vs-forecast check and Pessimistic/Base/Optimistic well-performance cases to the existing Disposal capacity case (issue #6, ANA-E05).

**Architecture:**
- Pure TypeScript modules in `swd-injection-analytics/src/` consume the unchanged `buildDisposalCase` result: summary, history check, performance cases, and composition with sealing.
- One new panel module, `web/case-insights.mjs`, listens to the existing `disposal-case-result` and `disposal-case-invalidated` events.
- Performance cases run in a Web Worker, as the sensitivity sweep does.
- History links come from the sample case's existing `selections[]` through one new export in `web/import-ui.mjs`.

**Tech Stack:**
- TypeScript 5.9.3, compiled to `dist/`;
- vanilla ES modules in `web/`;
- `node:test`;
- headless Chrome over CDP for evidence.

**Spec:** `docs/superpowers/specs/2026-11-10-e05-scenario-monitoring-design.md` (read it first; it is the authority).

## Global Constraints

- **Paths:** all app paths are relative to `swd-injection-analytics/`; run app commands from there.
- **Checks use direct Node paths only:**
  - `node ../node_modules/typescript/bin/tsc -p tsconfig.json`
  - `node --test tests/<file>.test.mjs`
  - `node --test tests/*.test.mjs`
  - `node scripts/check-carried-oracles.mjs`
  - From the repo root: `node scripts/check-all.mjs`.
  - No npm, npx, Vitest shims or bare Python.
- **No engine change:** `src/disposalCase.ts` is not modified.
- **Determinism:** the same inputs give byte-identical summary lines, history results, performance results and exports. Never use `Date.now()` or `Math.random()`; format numbers only through the helper defined in Task 1.
- **Availability is applied once:** only `well.availability` is changed, and the engine applies it.
- **Banned words:**
  - Generated text other than the fixed closing line must not match `/\b(proven|sustainable|calibrated|validated|safe)\b/i`.
  - The closing line is exactly `Screening estimate from assumed inputs; not proven field capacity.`
- **Missing is never zero:** missing history and gap months never count as zero.
- **No advice wording:** no "drill", "raise the limit" or "acidize".
- **Labels:** history months are labelled `reported`, forecast months `forecast`, Part C values `assumed well-performance case`, and outputs `calculated`.
- **Pressure basis (D8):** without a confirmed basis, the pressure check reads `Pressure not checked: confirm this well's H-10 pressure basis (psig or psia).`
- **Test data:** synthetic and fictional only (UIC `000000417`, well IDs `FICTIONAL-A` and `FICTIONAL-B`). Never copy rows from `data/explorer/` or the sample case into a test.
- **Line endings:**
  - `web/import-ui.mjs` keeps exactly 4 CR bytes;
  - `web/index.html` keeps exactly 3 CR bytes;
  - every new file is LF with 0 CR bytes.
  - Check with `tr -cd '\r' < FILE | wc -c`.
- **Git:** workers never stage, commit or push; the orchestrator commits after each task's review.
- **Preservation:** layer `phase-2b-scenario-monitoring`, recorded by the orchestrator only (skill `.claude/skills/preservation-layer`).
  - The before-image is archived **before Task 3 edits `src/disposalSensitivity.ts`**. The orchestrator runs `node scripts/record-layer.mjs phase-2b-scenario-monitoring archive` from the repo root after writing the layer spec (Task 6, step 1, done first).

## Review Focus

1. **Every month excluded.** A sample well whose reported months are all excluded by default flags reads `cannot-check`, never "within" or zero. Test in Task 2.
2. **Zero allocation.** A well whose forecast allocation is zero in every month (shut-in, or zero availability) gives ratio 0 and `within`, with no division by zero. Test in Task 2.
3. **Duplicate reports.** A month with two H-10 rows (`duplicate-report`) is excluded from the history set and cannot become the reported peak. Test in Task 2.
4. **Offset out of bounds.** A reservoir offset that pushes any well outside 100–10,000 psia throws the engine's message, with no partial result. Test in Task 3.
5. **Stale worker result.** A case edited while the performance worker runs must drop the old result, using the same generation-token pattern as `web/disposal-sensitivity.mjs`. Test in Task 5, in the session test.

---

### Task 1: Case summary core (Part A rules A1–A5, A8)

**Files:**
- Create: `src/caseSummary.ts`
- Test: `tests/case-summary.test.mjs`

**Interfaces:**
- Consumes: `DisposalCase` from `src/disposalCase.ts`.
- Produces:
  ```ts
  export const CASE_SUMMARY_VERSION='case-summary/1';
  export const CLOSING_LINE='Screening estimate from assumed inputs; not proven field capacity.';
  export const BANNED=/\b(proven|sustainable|calibrated|validated|safe)\b/i;
  export type SummaryRule='A1'|'A2'|'A3'|'A4'|'A5'|'A6'|'A7'|'A8';
  export type Cite={label:string;value:number|string|null;unit:string};
  export type SummaryLine={rule:SummaryRule;text:string;cites:Cite[];method:string|null};
  export function fmtNumber(v:number,digits?:number):string; // Math.round to digits (default 0), then 'en-US' grouping; '−' for negatives
  export function caseSummary(result:DisposalCase,extras?:{history?:unknown;performance?:unknown}):SummaryLine[];
  ```
  In this task `extras` is loosely typed and ignored, because the modules of Tasks 2 and 3 do not exist yet (`tsc` fails on a missing module even for `import type`). Task 2 tightens `history` to `readonly WellHistoryCheck[]` and Task 3 tightens `performance` to `PerformanceCases|null`.

**Rules.** Lines come in rule order A1, A2, A3, A4, A5, then A6 and A7 when present, then A8.

| Rule | Text | `method` |
|---|---|---|
| A1, no shortfall | `All demand is placed in every month.` | `result.methods.allocation` |
| A1, shortfall | `Unplaced water starts in ${first}: ${fmt(total)} bbl over ${n} month${s}.` (n = months with `shortfallBbl>0`) | `result.methods.allocation` |
| A2 | `${id} is limited by its ${constraints.join(' and ')}` for each well, joined with `'; '`, then `.` Empty constraints read `has no single binding limit`. | `result.methods.capacity` |
| A3, warnings | Per well with unsupported allocations: `${id}: ${k} month${s} need a pressure the model does not support (first ${month}: ${reason}).`, joined with a space | `result.methods.surface` |
| A3, none | `No unsupported allocated pressures in the base case.` | `result.methods.surface` |
| A4 | `Least spare capacity: ${month}, ${fmt(headroomBbl)} bbl.` (minimum `headroomBbl` in `base.monthly`; ties go to the earliest month) | none |
| A5 | `The compared case (${wellId}: J × ${m}, ID ${id} in, availability ${a}) moves the first shortfall from ${b??'none'} to ${c??'none'} and changes unplaced water by ${fmtSigned(Δ)} bbl.` | none |
| A8 | `CLOSING_LINE` | none |

- A1 cites the first shortfall month's `demandBbl` and `capacityBbl`, or nothing when there is no shortfall.
- A5 takes its values from `result.inputs.comparison`. `fmtSigned` prefixes `+` to positive values.

- [ ] **Step 1: Write the failing tests** in `tests/case-summary.test.mjs`, importing `dist/caseSummary.js` and `dist/disposalCase.js`. Build the case input like `tests/disposal-sensitivity.test.mjs`: two fictional wells, uniform model, synthetic demand. Tests:
  - `A1 reports no shortfall when demand fits`: demand `[{month:'2028-02',demandBbl:1000}]`; `lines[0]` deep-equals `{rule:'A1',text:'All demand is placed in every month.',cites:[],method:result.methods.allocation}`.
  - `A1 reports first month, total and count`: demand `2028-02: 10_000_000` and `2028-03: 10_000_000`. Text equals ``Unplaced water starts in 2028-02: ${fmtNumber(r.base.totalShortfallBbl)} bbl over 2 months.``
  - `A2 lists every well with its limiting constraints`: the text contains each `w.well.id` and each `limitingConstraints` entry.
  - `A4 picks the minimum headroom, earliest on ties`: two months with identical demand; the text starts `Least spare capacity: 2028-02,`.
  - `A5 describes the compared change`: with comparison `injectivityMultiplier:0.5`, the text contains `J × 0.5` and ends with `bbl.`
  - `A8 is last and exact`: `lines.at(-1).text===CLOSING_LINE`.
  - `generated lines avoid banned words`: for every line except A8, `assert.doesNotMatch(text,BANNED)`.
  - `deterministic`: `JSON.stringify(caseSummary(r))===JSON.stringify(caseSummary(buildDisposalCase(r.inputs)))`.
  - `fmtNumber is locale-independent`: `fmtNumber(1234567.6)==='1,234,568'`, `fmtNumber(-1500)==='−1,500'`, `fmtNumber(0.456,2)==='0.46'`.
- [ ] **Step 2: Run and confirm it fails.** Run `node ../node_modules/typescript/bin/tsc -p tsconfig.json; node --test tests/case-summary.test.mjs`. Expected: FAIL, because the module is not found.
- [ ] **Step 3: Implement** `src/caseSummary.ts` per the Interfaces and Rules above.
- [ ] **Step 4: Run and confirm it passes.** Run the same command. Expected: all pass, `tsc` clean.
- [ ] **Step 5:** The orchestrator commits `src/caseSummary.ts` and `tests/case-summary.test.mjs` with `E05 (#6): case summary rules A1-A5, A8`.

### Task 2: History vs forecast check (Part B, plus rule A6)

**Files:**
- Create: `src/wellHistoryCheck.ts`
- Modify: `src/caseSummary.ts` (add A6)
- Test: `tests/well-history-check.test.mjs`, plus A6 tests appended to `tests/case-summary.test.mjs`

**Interfaces:**
- Consumes:
  - `fmtNumber` from `src/caseSummary.ts`, the only number formatter (do not define another);
  - `diagnoseMonthly` and `DiagnosticsState` from `src/h10Diagnostics.ts`;
  - `toAbsolute`, `Basis` and `BasisConfirmation` from `src/wellAssumptions.ts`;
  - `PublicMonthly` from `src/publicArtifact.ts`;
  - `DisposalCase`.
- Produces:
  ```ts
  export const HISTORY_CHECK_VERSION='history-vs-forecast/1';
  export const NO_HISTORY='Cannot be checked: no H-10 history loaded for this well.';
  export const PRESSURE_NOT_CHECKED="Pressure not checked: confirm this well's H-10 pressure basis (psig or psia).";
  export const RATE_CAVEAT='Reported pressures are monthly figures at other rates; this is not a pressure match.';
  export type HistoryLink={wellId:string;label:string;uic:string;monthly:readonly PublicMonthly[];surfaceBasis:BasisConfirmation|null};
  export type HistoryStatus='within'|'above'|'cannot-check'|'no-injection';
  export type PressureCheck={status:'not-checked'|'above-reported'|'not-above';month:string|null;requiredSurfacePsia:number|null;highestReportedPsia:number|null;highestReportedMonth:string|null;basis:Basis|null;note:string};
  export type WellHistoryCheck={wellId:string;label:string|null;uic:string|null;status:HistoryStatus;reason:string;includedMonths:number;
    peakReported:{month:string;rateBpd:number}|null;peakForecast:{month:string;averageStbd:number;onstreamStbd:number}|null;
    ratio:number|null;historyMonthsAtOrAbovePeakForecast:number|null;forecastMonthsAbovePeakReported:number|null;onstreamNote:string|null;
    pressure:PressureCheck;series:{reported:{month:string;bbl:number|null;gap:boolean;included:boolean}[];forecast:{month:string;bbl:number}[]}};
  export function checkWellHistory(base:DisposalCase['base'],links:readonly HistoryLink[]):WellHistoryCheck[];
  ```

**Rules.** One result per `base.wells`, in order, matched by `link.wellId===well.id` only.

- **No link:** status `cannot-check`, reason `NO_HISTORY`, every other field `null` or empty, `pressure.status 'not-checked'`.
- **History set:** `state=diagnoseMonthly(link.monthly)`. The included months are those that are not gaps, have `decisions[m].include`, and have `rateBpd>0`.
  - If no month that is not a gap has `injectedBbl>0`: status `no-injection`, reason `No injection reported in the loaded H-10 history.`
  - Otherwise, if the included set is empty: status `cannot-check`, reason `Cannot be checked: no H-10 month passes the default inclusions.`
- **Peaks:**
  - `peakReported` is the included month with the maximum `rateBpd`.
  - `peakForecast` is the base allocation for this well with the maximum `averageStbd`. Ties go to the earliest month in both.
  - `ratio = peakForecast.averageStbd / peakReported.rateBpd`.
  - Status is `within` if `ratio<=1`, otherwise `above`.
- **Reason text:**
  - within: `Within reported history: peak forecast ${fmt} STB/day vs highest reported ${fmt} bbl/day (${month}).`
  - above: `${fmtNumber(ratio,1)}× the highest reported month (${fmt} bbl/day, ${month}); not shown in reported history.`
- **Counts:** `historyMonthsAtOrAbovePeakForecast` counts the included months with `rateBpd >= peakForecast.averageStbd`. `forecastMonthsAbovePeakReported` counts the forecast months with `averageStbd > peakReported.rateBpd`.
- **`onstreamNote`** applies when the well's availability is below 1: `Onstream rate ${fmt} STB/day while available; H-10 monthly data cannot show onstream rates.`
- **Pressure:**
  - If `surfaceBasis` is null: `not-checked`, note `PRESSURE_NOT_CHECKED`.
  - Otherwise take `highest = max(maxPsi)` over the included months with non-null `maxPsi`. If there is none: `not-checked`, note `No reported maximum pressure in the included months.`
  - Take `required = max(requiredSurfacePsia)` over this well's base allocations with `onstreamStbd>0` and a non-null value. If there is none: `not-checked`, note `No supported required surface pressure in the forecast.`
  - If `required > toAbsolute(highest,basis)`: `above-reported`, note `Requires more surface pressure (${fmt} psia, ${month}) than any reported month (${fmt} psia, ${month}).`
  - Otherwise: `not-above`, note `RATE_CAVEAT`.
- **Series:** reported comes from `state.months`, with `bbl = injectedBbl`, `gap`, and `included` from the history set. Forecast comes from the base allocations' `allocatedBbl`.
- **A6 in `caseSummary`:** one line per check, `${wellId}: ${reason}`. Append ` ${pressure.note}` when the status is `above-reported` or `not-checked`, and only when there is a link. Method: `HISTORY_CHECK_VERSION`. A6 is omitted when `extras.history` is absent.

**Test fixture:** a helper `row(month,bbl,avg,max,key?)` makes a synthetic `PublicMonthly` with `uic_number:'000000417'`, `period_start:month+'-01'`, `calculated_calendar_day_avg_bpd: bbl/daysInMonth` and `source_row_key: key ?? month`. Fill the other required fields with fixed fictional values, enough for `diagnoseMonthly` (`src/h10Diagnostics.ts`), which reads only `period_start`, `source_row_key`, `injected_liquid_bbl`, `calculated_calendar_day_avg_bpd`, `reported_avg_injection_pressure_psi` and `reported_max_injection_pressure_psi`.

- [ ] **Step 1: Write the failing tests** in `tests/well-history-check.test.mjs`:
  - `unlinked well cannot be checked`: links `[]`, so each status is `cannot-check` and each reason is `NO_HISTORY`.
  - `within when the forecast peak is at or below the reported peak`: the reported peak `rateBpd` is above the case's peak `averageStbd` (choose demand so that peak forecast < peak reported). Expect `status==='within'` and `ratio<=1`.
  - `above when the forecast peak exceeds the reported peak`: expect status `above`, a reason matching `/× the highest reported month \(.+, 2027-\d\d\); not shown in reported history\./`, and ratio `peakForecast.averageStbd/peakReported.rateBpd` to within 1e-12.
  - `gap months are never zero`: history 2027-01 and 2027-03 with no 2027-02. `series.reported` holds a 2027-02 entry with `{bbl:null,gap:true,included:false}`, and `includedMonths===2`.
  - `all months excluded gives cannot-check` (Review Focus 1): every row has a null avg pressure (`no-average-pressure` flag). Expect status `cannot-check` and the reason starting `Cannot be checked: no H-10 month`.
  - `reported zero injection gives no-injection`: every row has bbl 0, so status is `no-injection`.
  - `zero forecast allocation is within, no division error` (Review Focus 2): the well has availability 0, so the ratio is 0 and the status is `within`.
  - `duplicate month is excluded from the peak` (Review Focus 3): two rows for 2027-05 with different keys, one with the largest bbl. `peakReported.month!=='2027-05'`.
  - `pressure not checked without basis`: `pressure.status==='not-checked'` and `pressure.note===PRESSURE_NOT_CHECKED`.
  - `pressure above reported`: basis `{value:'psig',reason:'test'}`, with reported max far below the required surface pressure. Expect `above-reported`; the comparison uses `max+14.7`.
  - `pressure not above gives only the caveat`: a reported max far above the required pressure gives `not-above` with note `RATE_CAVEAT`.
  - `onstream note when availability < 1`.
  - `deterministic`: two calls are equal by `JSON.stringify`.
  - Appended to `case-summary.test.mjs`: `A6 lines follow A5 and precede A8`, `A6 is absent without history`, and `A6 lines avoid banned words` (every status).
- [ ] **Step 2: Run and confirm it fails.** Run `tsc`, then `node --test tests/well-history-check.test.mjs tests/case-summary.test.mjs`. Expected: the new tests fail.
- [ ] **Step 3: Implement** `src/wellHistoryCheck.ts` per the Rules, and add A6 to `caseSummary`.
- [ ] **Step 4: Run and confirm it passes.** Run the same command. Expected: all pass.
- [ ] **Step 5:** The orchestrator commits with `E05 (#6): history vs forecast check and summary rule A6`.

### Task 3: Well-performance cases (Part C, plus rule A7)

**Files:**
- Create: `src/performanceCases.ts`
- Modify: `src/disposalSensitivity.ts`: export the existing `summarize` unchanged as `export function summarize`. **Protected; archive first, see Global Constraints.**
- Modify: `src/caseSummary.ts` (add A7)
- Test: `tests/performance-cases.test.mjs`, plus A7 tests appended to `tests/case-summary.test.mjs`

**Interfaces:**
- Consumes: `buildDisposalCase`, `DisposalCaseInput`, `DisposalWell`, `summarize` from `src/disposalSensitivity.ts`, and `fmtNumber` from `src/caseSummary.ts`.
- Checked before planning: with the uniform model, `buildDisposalCase` accepts `reservoirPsia >= limitPsia` and returns `maximumStbd 0` rather than throwing.
- Produces:
  ```ts
  export const PERFORMANCE_CASES_VERSION='well-performance-cases/1';
  export const CASE_LABEL='Assumed well-performance case';
  export const FLAT_NOTE='End-of-period condition held for every month; not a pressure or decline forecast.';
  export const FLUID_NOTE='Fluid reference pressure is unchanged in every case.';
  export const ATTRIBUTION_NOTE='Single-factor runs; effects are not additive.';
  export type PerformanceFactors={injectivityMultiplier:number;reservoirOffsetPsi:number;availabilityMultiplier:number};
  export type PerformanceCasesSpec={pessimistic:PerformanceFactors;optimistic:PerformanceFactors};
  export const NEUTRAL_FACTORS:Readonly<PerformanceFactors>; // {injectivityMultiplier:1,reservoirOffsetPsi:0,availabilityMultiplier:1}
  export type Headroom={wellId:string;reservoirPsia:number;limitPsia:number;headroomPsi:number};
  export type CaseRun={label:'Pessimistic'|'Base'|'Optimistic';factors:PerformanceFactors;cappedWells:string[];noHeadroomWells:string[];
    summary:ReturnType<typeof summarize>;offsetPercentOfHeadroom:{wellId:string;percent:number|null}[];
    attribution:{factor:'injectivity'|'reservoir'|'availability';totalShortfallBbl:number;changeBbl:number}[]};
  export type PerformanceCases={version:typeof PERFORMANCE_CASES_VERSION;inputs:{caseInput:DisposalCaseInput;spec:PerformanceCasesSpec};headroom:Headroom[];cases:CaseRun[];notes:string[]};
  export function validateFactors(f:PerformanceFactors,label:string):PerformanceFactors;
  export function applyFactors(input:DisposalCaseInput,f:PerformanceFactors):{input:DisposalCaseInput;cappedWells:string[];noHeadroomWells:string[]};
  export function buildPerformanceCases(input:DisposalCaseInput,spec:PerformanceCasesSpec):PerformanceCases;
  ```

**Rules:**
- **Bounds** (`validateFactors`, which throws `${label} ${name} must be finite between min and max`):
  - `injectivityMultiplier` 0.01–10;
  - `reservoirOffsetPsi` −5000 to 5000;
  - `availabilityMultiplier` 0–10.
- **`applyFactors`** clones the input. For every well:
  - `injectivityStbdPerPsi *= m`;
  - `reservoirPsia += offset`;
  - `availability = min(1, availability × a)`. The well goes in `cappedWells` when `availability × a > 1`.
  - The well goes in `noHeadroomWells` when the new `reservoirPsia >= limitPsia`.
  - Set `comparison={wellId:wells[0].id,injectivityMultiplier:1,innerDiameterInches:wells[0].innerDiameterInches,availability:wells[0].availability}` (neutral, as in `disposalSensitivity.ts`).
- **`buildPerformanceCases`:**
  - Compute `headroom` from the original wells: `limitPsia−reservoirPsia`.
  - Cases come in the order Pessimistic, Base (`NEUTRAL_FACTORS`), Optimistic. Each takes `summary = summarize(buildDisposalCase(applied.input).base)`.
  - `offsetPercentOfHeadroom` is `100×offset/headroomPsi`, or null when `headroomPsi<=0`.
  - **Attribution**, for non-Base cases only: three runs, each changing one factor with the others neutral. `changeBbl = run.totalShortfallBbl − baseCase.summary.totalShortfallBbl`.
  - Any engine error propagates; there are no partial results.
  - `notes = [CASE_LABEL, FLAT_NOTE, FLUID_NOTE, ATTRIBUTION_NOTE]`.
- **A7 in `caseSummary`:** one line per non-Base case:
  - text: `${label}: ${first ? `water stops fitting in ${first}` : 'all demand is placed'} (base ${baseFirst ?? 'none'}), ${fmt(total)} bbl unplaced.`;
  - if `noHeadroomWells` is non-empty, append ` No headroom: ${ids.join(', ')}.`;
  - method `PERFORMANCE_CASES_VERSION`;
  - omitted when `extras.performance` is null or absent.

- [ ] **Step 1: Write the failing tests** in `tests/performance-cases.test.mjs`:
  - `neutral factors equal the engine base`: the Base `summary` deep-equals `summarize(buildDisposalCase(neutralised input).base)` (`summarize` imported from `dist/disposalSensitivity.js`).
  - `availability applied once`: with `availabilityMultiplier:0.5` only, the Pessimistic `summary.totalAvailableStbd` equals the engine run with each well's availability manually halved, within 1e-9 relative.
  - `zero availability contributes zero`: `availabilityMultiplier:0` gives `summary.totalAvailableStbd===0`.
  - `availability cap`: a well at 0.9 with multiplier 2 gives availability 1, and `cappedWells` includes its ID.
  - `no headroom well reported, capacity zero`: an offset with `reservoirPsia>=limitPsia` (still ≤10000) puts the well in `noHeadroomWells`, and its `summary.wells[i].maximumStbd===0`.
  - `offset outside engine bounds throws, no partial result` (Review Focus 4): an offset pushing reservoir above 10000 makes `assert.throws(()=>buildPerformanceCases(...),/Reservoir pressure \(psia\)/)`.
  - `invalid factor rejected`: `injectivityMultiplier:0` throws `/must be finite between 0.01 and 10/`.
  - `attribution has three single-factor runs, not additive`: the Pessimistic attribution factors are `['injectivity','reservoir','availability']`, and `notes` includes `ATTRIBUTION_NOTE`.
  - `deterministic`.
  - `existing sweep unchanged`: `node --test tests/disposal-sensitivity.test.mjs` still passes (run in Step 4).
  - Appended to `case-summary.test.mjs`: `A7 per non-base case, no-headroom appended`, and `A7 lines avoid banned words`.
- [ ] **Step 2: Run and confirm it fails.** Run `tsc`, then `node --test tests/performance-cases.test.mjs tests/case-summary.test.mjs`. Expected: the new tests fail.
- [ ] **Step 3: Implement** the code. Add `export` to `summarize` in `src/disposalSensitivity.ts` (a one-word change) and write `src/performanceCases.ts`.
- [ ] **Step 4: Run and confirm it passes.** Run `node --test tests/performance-cases.test.mjs tests/case-summary.test.mjs tests/disposal-sensitivity.test.mjs`. Expected: all pass.
- [ ] **Step 5:** The orchestrator commits with `E05 (#6): well-performance cases and summary rule A7`.

### Task 4: Insights composition, sealing and exports

**Files:**
- Create: `src/caseInsights.ts`
- Test: `tests/case-insights.test.mjs`

**Interfaces:**
- Consumes:
  - `caseSummary` (Task 1);
  - `checkWellHistory` and `HistoryLink` (Task 2);
  - `PerformanceCases` and `buildPerformanceCases` (Task 3);
  - `buildDisposalCase` and `DisposalCase`.
- Produces:
  ```ts
  export const CASE_INSIGHTS_SCHEMA='case-insights-export/1';
  export type CaseInsights={caseInputs:DisposalCase['inputs'];links:HistoryLink[];performanceSpec:PerformanceCasesSpec|null;
    history:WellHistoryCheck[];performance:PerformanceCases|null;summary:SummaryLine[]};
  export function buildCaseInsights(result:DisposalCase,links:readonly HistoryLink[],performance:PerformanceCases|null):CaseInsights;
  export type SealedCaseInsights=CaseInsights&{schemaVersion:typeof CASE_INSIGHTS_SCHEMA;versions:Record<string,string>;contentSha256:string};
  export async function sealCaseInsights(i:CaseInsights):Promise<SealedCaseInsights>;
  export async function verifyCaseInsights(s:SealedCaseInsights):Promise<SealedCaseInsights>; // throws 'Result changed or stale: …'
  export const caseInsightsJson=(s:SealedCaseInsights)=>string; // JSON.stringify(s,null,2)+'\n'
  export function caseInsightsCsv(s:SealedCaseInsights):string;
  ```

**Rules:**
- **`buildCaseInsights`:**
  - Requires `performance===null` or `performance.inputs.caseInput` canonically equal to `result.inputs`. Otherwise it throws `Result changed or stale: performance cases were built from other inputs`.
  - `summary = caseSummary(result,{history,performance})`.
- **Sealing:** follow `src/pressureReconciliationExport.ts`, a SHA-256 over the JSON body without `contentSha256`. `versions` holds `CASE_SUMMARY_VERSION`, `HISTORY_CHECK_VERSION` and `PERFORMANCE_CASES_VERSION`.
- **`verifyCaseInsights`:**
  - Recompute `buildDisposalCase(s.caseInputs)`.
  - Recompute `buildPerformanceCases(s.caseInputs, s.performanceSpec)` when `performanceSpec` is non-null.
  - Rebuild the insights and require `JSON.stringify` equality on everything except `contentSha256`, plus a valid hash.
  - Throw `Result changed or stale: recompute before export` on any mismatch.
- **CSV:** CRLF rows, cells quoted like `reconciliation.csv` (formula-injection guard).
  - The header row is `section,rule_or_well,field,value`.
  - Sections: `summary` (one row per line's text, then one row per cite), `history`, `performance`, `metadata` (schema, versions, contentSha256).

- [ ] **Step 1: Write the failing tests** in `tests/case-insights.test.mjs`:
  - `seal and verify round-trip`: `verifyCaseInsights(await sealCaseInsights(x))` resolves.
  - `tampered summary rejected`: change `summary[0].text`, and expect rejection `/Result changed or stale/`.
  - `edited input rejected (edits invalidate exports)`: change `caseInputs.wells[0].injectivityStbdPerPsi` while keeping the rest, and expect rejection.
  - `performance from other inputs rejected at build`.
  - `JSON export carries labels`: the text includes `"reported"`, `"forecast"`, `Assumed well-performance case` and `CLOSING_LINE`.
  - `CSV guards formula cells and ends with CRLF`.
  - `deterministic export`: two seals of the same insights give an equal `contentSha256`.
- [ ] **Step 2: Run and confirm it fails.** Run `tsc`, then `node --test tests/case-insights.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/caseInsights.ts`.
- [ ] **Step 4: Run and confirm it passes.** Run the same command. Expected: all pass.
- [ ] **Step 5:** The orchestrator commits with `E05 (#6): insights composition, sealing and exports`.

### Task 5: Panel, worker and wiring

**Files:**
- Create: `web/case-insights.mjs`. It is **pure**: no import of `web/import-ui.mjs` and no top-level `document` access, so `node:test` can import it, like `web/h10-diagnostics.mjs`.
- Create: `web/performance-worker.mjs`
- Modify: `web/import-ui.mjs`. **Protected**; keep exactly 4 CR bytes. This is the only file that imports `case-insights.mjs`: it calls `mountCaseInsights(...)` next to the existing `mountReconciliation` import.
- Modify: `web/index.html`. **Protected**; keep exactly 3 CR bytes.
- Test: `tests/case-insights-session.test.mjs`

**Interfaces:**
- Consumes: `buildCaseInsights`, `sealCaseInsights`, `verifyCaseInsights`, `caseInsightsJson` and `caseInsightsCsv` (Task 4), `validateFactors` and `NEUTRAL_FACTORS` (Task 3), and `confirmBasisValue` from `src/wellAssumptions.ts`.
- Produces:
  - In `web/import-ui.mjs`: a module-local `linkedWellHistories()` (not exported), passed to `mountCaseInsights($('case-insights'),{getLinks:linkedWellHistories})`.
    - Returns `[]` unless `source==='sample'&&sampleSession`.
    - Otherwise returns `sampleSession.selections.map(s=>({wellId:s.wellId,label:s.label,uic:s.artifact.injectionMonthly[0]?.uic_number??'',monthly:s.artifact.injectionMonthly}))`. There is no `surfaceBasis`; the panel adds it.
  - In `web/case-insights.mjs`: `export function createInsightsSession({getLinks,runPerformance})`.
    - It is a DOM-free state machine with `onCaseResult(result)`, `onInvalidated()`, `setBasis(wellId,value,reason)`, `requestPerformance(spec)` and `snapshot()`.
    - `snapshot()` returns `{status, insights|null, error|null, generation}`.
    - It also exports `mountCaseInsights(root,{getLinks})`, which wires the DOM and the two document events. It is called only from `import-ui.mjs`.
  - In `web/performance-worker.mjs`: messages `{action:'calculate',caseInput,spec}` → `{result}`, and `{action:'verify',sealed,format:'json'|'csv'}` → `{text}`; either can answer `{error}`. It mirrors `web/sensitivity-worker.mjs`.

**Rules:**
- **Mount point** in `index.html`:
  - `<section id="case-insights" class="panel" hidden aria-labelledby="case-insights-title"></section>` goes directly after the closing tag of `#disposal-results`.
  - No new script tag: `import-ui.mjs` imports the module.
- **Events:**
  - On `disposal-case-result`, take `event.detail.result`, build the insights with `getLinks()`, any confirmed bases and `performance:null`, show the panel, and enable the downloads.
  - On `disposal-case-invalidated`, increment `generation`, discard the insights and the in-flight performance work, hide the panel, and disable the downloads.
- **Panel order:**
  1. Title "What the case says";
  2. `role=status` line;
  3. summary lines, each a `<details>` whose `<summary>` is the text and whose body lists cites and method;
  4. history section: one table per well (reported and forecast rows with labels), a basis form per linked well (psig/psia select, reason input, Confirm), and an SVG timeline per linked well (reported bars, forecast bars, a dashed boundary line, gaps left empty, no thinning, as in D16);
  5. performance section: headroom table, a form with three inputs each for Pessimistic and Optimistic prefilled from `NEUTRAL_FACTORS`, a Calculate button, a results table with columns case / first unplaced month / unplaced bbl / limiting constraints / capped / no headroom, an attribution table, and the notes;
  6. downloads: JSON and CSV. Each is re-verified with `verifyCaseInsights` **in the performance worker** (action `verify`, as the sweep does), because verification reruns the engine up to 9 times. The worker returns the verified text or an error.
- **Changes after a result:**
  - Confirming a basis rebuilds the insights.
  - A new performance result rebuilds the insights.
  - Editing any performance input clears the performance results and their summary line A7.
- **Uploaded and demo cases:** `getLinks()` returns `[]`, so every well reads `NO_HISTORY`.

- [ ] **Step 1: Write the failing tests** in `tests/case-insights-session.test.mjs` (DOM-free, importing `web/case-insights.mjs`, as `tests/panel-hooks.test.mjs` does):
  - `case result produces summary and history with no links`: every history status is `cannot-check`.
  - `basis confirmation rebuilds history pressure`: `pressure.status` changes from `not-checked`.
  - `invalidated clears insights`: `snapshot().insights===null`.
  - `stale performance result dropped` (Review Focus 5): a stub `runPerformance` resolves only after `onInvalidated()` and a new `onCaseResult()`; the old result is ignored (`insights.performance===null`).
  - `performance result adds A7`.
  - In `tests/panel-hooks.test.mjs` style, read file text:
    - `index.html has the case-insights mount`;
    - `import-ui mounts case insights with the sample link`, which checks that `web/import-ui.mjs` contains `mountCaseInsights(`.
- [ ] **Step 2: Run and confirm it fails.** Run `node --test tests/case-insights-session.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement.** Write both web modules. Make the two protected edits, then confirm the CR counts (`tr -cd '\r' < web/import-ui.mjs | wc -c` → 4; `web/index.html` → 3).
- [ ] **Step 4: Run the checks and confirm they pass.** Run `node --test tests/*.test.mjs`, which must show all pass (the baseline is 638 tests plus the new ones). Run `node scripts/check-carried-oracles.mjs` → 248 comparisons, 0 failures. Then from the repo root, `node scripts/prepare-swd.mjs` → exit 0.
- [ ] **Step 5:** The orchestrator commits with `E05 (#6): case insights panel, performance worker and sample history link`.

### Task 6: Evidence, review, QA and preservation layer (orchestrator, reviewer, QA, owner)

**Files:**
- Create: `migration/layer-specs/phase-2b-scenario-monitoring.json` (**step 1 happens before Task 3**)
- Create: `demo/E05-SCENARIO-MONITORING-VERIFICATION.md` and `demo/e05-evidence/`

- [ ] **Step 1 (before Task 3).** The orchestrator writes the layer spec:
  - `changes`: `src/disposalSensitivity.ts`, `web/import-ui.mjs`, `web/index.html`;
  - `newFiles`: `src/caseSummary.ts`, `src/wellHistoryCheck.ts`, `src/performanceCases.ts`, `src/caseInsights.ts`, `web/case-insights.mjs`, `web/performance-worker.mjs`, `tests/case-summary.test.mjs`, `tests/well-history-check.test.mjs`, `tests/performance-cases.test.mjs`, `tests/case-insights.test.mjs`, `tests/case-insights-session.test.mjs`;
  - `approvedDocs`: the spec and this plan;
  - `acceptanceEvidence`: `demo/E05-SCENARIO-MONITORING-VERIFICATION.md`;
  - `rootFiles`: `migration/layers/index.json`.
  Then run `node scripts/record-layer.mjs phase-2b-scenario-monitoring archive` → `archived 3`.
- [ ] **Step 2.** Dispatch the agent `reviewer` on `git diff 2b33a22..HEAD` against the spec. Fix all critical, high and medium findings with the engineer, and record them in the verification document.
- [ ] **Step 3.** Dispatch the agent `qa` with the issue #6 acceptance table (spec, section "Acceptance") and the skill `browser-check`, on the sample case at 1280×900 and 390×844. The checks:
  - the summary, history and performance panels are visible;
  - a basis confirmation changes the pressure note;
  - editing an input withdraws everything;
  - the JSON and CSV downloads re-verify;
  - there are no console errors.
  Evidence goes in `demo/e05-evidence/`.
  - **Data rule:** the sample case holds two real TRRC wells, and the sealed downloads embed their raw H-10 rows in `links[].monthly`. QA records only download SHA-256 hashes, row counts, statuses and screenshots. The downloaded JSON/CSV files are **not** committed. Screenshots must not show per-month values in a readable table: crop or collapse the history tables.
- [ ] **Step 4.** The orchestrator writes `demo/E05-SCENARIO-MONITORING-VERIFICATION.md`:
  - the commands and counts;
  - the acceptance table with PASS/FAIL;
  - the review findings;
  - the browser evidence.
  Then run `node scripts/record-layer.mjs phase-2b-scenario-monitoring` → pending-review.
- [ ] **Step 5.** The owner runs `! node scripts/record-layer.mjs phase-2b-scenario-monitoring accept "<owner>"` and `! node scripts/verify-preservation.mjs .` → 0 violations. Then run `node scripts/check-all.mjs` → all checks pass. Push, the PR (`Closes #6`) and the merge each wait for the owner's instruction.
