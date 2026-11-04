# Phase 1c: test-referenced injectivity (J) estimate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Test-referenced J (estimate)" panel to Injector history. For each included BHP test it matches a reviewed H-10 month, models P_wf from the H-10 surface pressure through the existing wellbore traverse, and calculates J = q / (P_wf − P_res). It shows every J with its basis, sensitivities and a round-trip check, seals JSON/CSV/SVG exports, and can prefill the Hydraulics workspace. The phase also fixes the missing Test records panel when a well has tests but no H-10 rows.

**Architecture:** Three pure TypeScript modules (estimate, chart, export) compile to `dist/` and are tested in Node. A DOM-free web session in `web/injectivity.mjs` holds the basis, assumptions, moved matches and chosen J, with a revision counter and stale-export refusal. The 1a and 1b panels gain an `onChange` callback and a `state` getter. `web/hydraulics.mjs` gains a pure hand-off mapper, a `prefill` API and optional `provenance.inputOrigins`. `import-ui.mjs` mounts the new panel and no longer lets an empty H-10 history stop the Test records panel. `src/disposalCase.ts` and `src/wellboreTraverse.ts` are not changed. Preservation is registry layer `phase-1c-test-referenced-j`.

**Tech Stack:** TypeScript 5.9 (`tsc` → `dist/`), Node `node:test`, plain ES modules in the browser, hand-built SVG.

**Spec:** `docs/superpowers/specs/2026-11-03-test-referenced-j-design.md` (owner-approved 2026-11-03). Executors read the spec and this plan.

## Global Constraints

- Paths: the repo root is `C:\Users\thai.phi\Downloads\python\portfolio\swd-injection-analytics\tmp\lovable-transfer\well-injection-insights`. The app is `swd-injection-analytics/` (written `N/`), and product paths in tasks are relative to `N/`.
- Build from `N/` with `node ../node_modules/typescript/bin/tsc -p tsconfig.json`. Tests import compiled code from `../dist/*.js`.
- Run tests from `N/` with `node --test tests/<file>`. Use direct `node` paths only: no npm, npx, vitest or bare python.
- New product files go only in `N/{src,web,tests}`, and each one is listed in the layer spec (Task 0).
- Main archives the protected files in Task 0 **before any edit**.
  - `N/web/import-ui.mjs` has CRLF on its last four lines and LF elsewhere. Count its CR bytes with node before and after every edit; the count must stay `4`, all on the last four lines.
  - Every other changed or new file has 0 CR bytes.
- No new navigation tab. Do not edit `web/navigation.mjs` or `web/index.html`.
- Do not edit `src/disposalCase.ts`, `src/wellboreTraverse.ts`, `src/disposalSensitivity.ts`, `src/h10Diagnostics.ts`, `src/h10DiagnosticsChart.ts`, `src/h10DiagnosticsExport.ts`, `src/testRecordsChart.ts`, `src/testRecordsExport.ts` or the carried oracles.
- Fixed strings, verbatim:
  - The label is `Test-referenced J (estimate)`. The word "calibrated" never appears in any text produced by the new modules, case-insensitively.
  - The new `J_READINESS` is `Calibrated injectivity (J): not available. A test-referenced estimate is shown in the panel below; a calibrated J needs a measured flowing bottomhole pressure at a known rate, for example from step-rate test analysis, which is out of scope.`
  - The basis statement is `Measured static reservoir pressure (BHP test); flowing bottomhole pressure modelled from H-10 surface pressure through the wellbore traverse; declared tubing and fluid assumptions; monthly calendar-day average rate.`
- Numbers:
  - atmosphere `14.7` psi;
  - round-trip tolerance `0.5` psi;
  - traverse floor `100` psia;
  - reason length `1–200` characters after trimming;
  - tubing sensitivity IDs `3.958, 4.892, 6.276` in;
  - defaults: tubing ID `3.958` in, roughness `0.0006` in, surface `70` °F, bottomhole `100` °F, salinity `10` wt% NaCl, traverse segments `32`;
  - depth tolerance: reuse `DEPTH_TOLERANCE_FT` (`10` ft) from `testRecords.ts`.
- Method `test-referenced-j/1`; export schema `test-referenced-j-export/1`.
- Synthetic test data uses the fictional UIC `000000417`. Tests and evidence contain no Barbaro 23 per-test values. Never copy Explorer artifacts into this repository.
- Workers never stage, commit or push. Main commits after owner acceptance.
- The layer pins this plan as an approved document. Track progress in the ledger, not by ticking boxes here.

## Rulings made while planning (owner to confirm when reviewing this plan)

- **R1, the capacity and sweep route.** The spec offers the matched-J range "as the injectivity sweep in the existing sensitivity tool" and asks for confirmation that capacity against demand can take the values.
  - Both the Capacity assessment (`web/disposal-case.mjs`) and the Parameter sweeps tool take their wells from `capacityWorkspaceContext` in `import-ui.mjs`, which reads the declared-injector import path, not a prefill.
  - Wiring J into them is more than a prefill. Following the spec, scope comes back to the owner rather than widening.
  - This plan therefore hands off to the **Hydraulics workspace only**. The matched-J min–max is carried in the hand-off and shown in the Hydraulics origin panel as "J range for sweeps: min–max STB/day/psi (enter it in Parameter sweeps)". There is no automatic sweep.
- **R2, check order.** Per-test checks run in the order record → depth → month match → basis → surface domain → traverse → sign. This lets the panel show matches before the basis is confirmed. The spec lists the basis third, but it fixes only that the first failing reason is shown.
- **R3, alternate basis.** "J under the psia reading" is implemented as `jAlternateBasis`: the J under whichever reading the user did not confirm. With the default psig confirmation, that is the psia reading.
- **R4, the no-friction identity.** With G = reported test pressure / test depth, `G × depth` equals the reported BHP. So P_wf,nf = surface psia + reported BHP, and under the psig reading J_nf = q / (H-10 average surface pressure). This is the intended tubing-free check (shut-in surface pressure about zero, no friction), and the panel and export state it.
- **R5, tubing ordering.** A larger ID gives less friction, a higher P_wf and therefore a **lower** J. A planning run on the synthetic fixture gave J ≈ 15.05, 14.12 and 13.79 for 3.958, 4.892 and 6.276 in.
- **R6, extra hand-off fields.** The hand-off also sets three fields the spec does not name:
  - `operatingCeilingStbd`, from the inventory permitted volume (labelled as the permit value), or empty when the inventory has none;
  - `curveMaximumStbd` = ceil(1.5 × matched rate);
  - `referencePressurePsia` = P_res.

  Without these the Hydraulics workspace would flag or clip the matched rate against fictional defaults.

## Review Focus

1. **A 1a or 1b decision changed while the J panel is open** must recompute J and refuse an older export or hand-off. Pinned by Task 4 session tests (`update` bumps the revision; stale export resolves `null`) and seen in the browser in Task 6.
2. **A well with BHP tests but no H-10 rows** (the 1b gap) must show the Test records panel and the J panel's "No H-10 months to match.". Pinned by Task 3 (`h10Available`) and Task 4 (session with `h10: null`), and seen in the browser in Task 6.
3. **The user's chosen test stops qualifying** (excluded in 1b, or its month excluded in 1a). The latest qualifying test must become the chosen J and the panel must say why. Pinned by Task 1 (`choiceDropped`).
4. **Unrealistic declared assumptions** (a tubing ID that pushes velocity above 5 m/s, or a salinity above 20 wt%) must be refused with a reason and never clamped. Pinned by Task 1 (traverse-unsupported and `validateAssumptions` tests).
5. **A user edit after the hand-off** must be labelled "User override", and the Hydraulics export must carry the origins. Pinned by Task 5 (`markOverride`, `calculateHydraulics` with `inputOrigins`).

---

### Task 0 (Main): layer spec and archive BEFORE any edit

**Files:**
- Create: `migration/layer-specs/phase-1c-test-referenced-j.json` (repo root)
- Archive (generated): `migration/baselines/phase-1c-test-referenced-j-before/swd-injection-analytics/{src/testRecords.ts,web/h10-diagnostics.mjs,web/test-records.mjs,web/hydraulics.mjs,web/import-ui.mjs,tests/test-records-export.test.mjs}`

- [ ] **Step 1:** Create `migration/layer-specs/phase-1c-test-referenced-j.json`:

```json
{
  "purpose": "Phase 1c (PRD ANA-E03 under D5): test-referenced injectivity (J) estimate from reviewed H-10 months and included BHP tests, with sensitivities, a round-trip check, sealed exports and a Hydraulics workspace hand-off; fixes the Test records panel being absent when a well has tests but no H-10 rows.",
  "acceptanceEvidence": "demo/TEST-REFERENCED-J-VERIFICATION.md",
  "approvedDocs": [
    "docs/superpowers/specs/2026-11-03-test-referenced-j-design.md",
    "docs/superpowers/plans/2026-11-03-test-referenced-j.md"
  ],
  "changes": ["src/testRecords.ts", "web/h10-diagnostics.mjs", "web/test-records.mjs", "web/hydraulics.mjs", "web/import-ui.mjs", "tests/test-records-export.test.mjs"],
  "newFiles": [
    "src/injectivityEstimate.ts", "src/injectivityEstimateChart.ts", "src/injectivityEstimateExport.ts", "web/injectivity.mjs",
    "tests/injectivity-estimate.test.mjs", "tests/injectivity-export.test.mjs", "tests/injectivity-session.test.mjs",
    "tests/panel-hooks.test.mjs", "tests/hydraulics-handoff.test.mjs", "tests/helpers/injectivity-fixture.mjs"
  ],
  "rootFiles": ["migration/layers/index.json"]
}
```

- [ ] **Step 2:** From the repo root, run `node scripts/record-layer.mjs phase-1c-test-referenced-j archive`. Expected: `archived 6`. Record the CR counts (`import-ui.mjs` has 4, on its last four lines; the other five have 0) and the baseline test counts: 523 app tests, 112 root tests (after `node scripts/prepare-swd.mjs`) and 248 oracle comparisons.

---

### Task 1: Estimate core (`src/injectivityEstimate.ts`) and the shared fixture

**Files:**
- Create: `N/src/injectivityEstimate.ts`
- Create: `N/tests/helpers/injectivity-fixture.mjs`
- Test: `N/tests/injectivity-estimate.test.mjs`

**Interfaces:**
- Consumes:
  - `traverseBrineWell`, `TraverseError`, `SegmentedBrineSettings`, `WellboreGeometry` (`src/wellboreTraverse.ts`);
  - `segmentedHydraulicPoint`, `DisposalWell` (`src/disposalCase.ts`);
  - `DiagnosticsState` (`src/h10Diagnostics.ts`);
  - `DEPTH_TOLERANCE_FT`, `TestRecord`, `TestState` (`src/testRecords.ts`).
- Produces (later tasks use these exact names):
  - constants: `J_ESTIMATE_VERSION`, `LABEL_J`, `BASIS_STATEMENT`, `ATMOSPHERE_PSI`, `ROUND_TRIP_TOLERANCE_PSI`, `MIN_TRAVERSE_PSIA`, `MAX_REASON_LENGTH`, `TUBING_SENSITIVITY_IN`, `DEFAULT_ASSUMPTIONS`, `REASONS`, `LIMITATIONS`;
  - types: `Basis`, `Shift`, `Assumptions`, `JInputs`, `EstimateState`, `TestEstimate`, `RoundTripRow`, `Estimate`, `Permit`, `Handoff`;
  - functions: `validateAssumptions(a)`, `createEstimateState(inputs)`, `withInputs(state, inputs)`, `confirmBasis(state, value, reason)`, `setAssumptions(state, partial)`, `moveMatch(state, key, shift, reason)`, `chooseJ(state, key, reason)`, `estimate(state): Estimate`, `datumFor(t)`, `handoff(state, est, permit, estimateSha256): Handoff`.
  - fixture: `fixtureInputs(options)`, `monthlyRow(month, rate, avg)`, `bhpRow(id, date, psi, depth)`, `SYNTHETIC_UIC`.

- [ ] **Step 1: Write the fixture** `N/tests/helpers/injectivity-fixture.mjs`:

```js
import {diagnoseMonthly} from '../../dist/h10Diagnostics.js';
import {buildTestState} from '../../dist/testRecords.js';

/** Fictional UIC 000000417. Values are synthetic; no real well's test values appear here. */
export const SYNTHETIC_UIC='000000417';
const days=m=>new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5,7)),0)).getUTCDate();
export function monthlyRow(month,rate,avg){const d=days(month);
 return {source_row_key:`m:${month}`,parent_key:'p',parent_join_status:'matched',uic_number:SYNTHETIC_UIC,reporting_year:Number(month.slice(0,4)),reporting_month:Number(month.slice(5,7)),period_start:`${month}-01`,
  injected_liquid_bbl:rate===null?null:rate*d,reported_avg_injection_pressure_psi:avg,reported_max_injection_pressure_psi:avg===null?null:avg+50,calendar_days:d,calculated_calendar_day_avg_bpd:rate};}
export function bhpRow(id,date,psi,depth){
 return Object.freeze({source_row_key:`b${id}`,parent_key:'p',parent_join_status:'matched',uic_number:SYNTHETIC_UIC,source_report_id:String(id),tracking_no:'9',test_sequence_no:'1',
  report_conducted_date:date,report_conducted_date_text:date,report_received_date:null,report_received_date_text:'',bhp_psia:psi,test_depth_ft:depth,gradient_psi_ft:null,tested_formation:'SYNTHETIC',source_snapshot_id:'s',quality_flags:Object.freeze([])});}
const MONTHS=['2024-01','2024-02','2024-03','2024-04','2024-05','2024-06','2024-07','2024-08'];
/** Default: 8 months at 10000 bbl/day and 900 psi; 2024-05 has no average pressure (flagged, excluded by default).
 * Tests: T1 2024-02-12 1705 psi @3310 ft; T2 2024-07-22 1731 @3310; T3 2023-11-07 1500 @3100 (off depth, excluded by default); T4 2024-05-10 1720 @3310. */
export function fixtureInputs({avg=900,rate=10000,monthly=null,bhp=null}={}){
 const rows=monthly??MONTHS.map(m=>monthlyRow(m,rate,m==='2024-05'?null:avg));
 const h10=rows.length?diagnoseMonthly(rows):null;
 const tests=buildTestState({package:{bhp:bhp??[bhpRow(1,'2024-02-12',1705,3310),bhpRow(2,'2024-07-22',1731,3310),bhpRow(3,'2023-11-07',1500,3100),bhpRow(4,'2024-05-10',1720,3310)],srt:[]}},
  h10?{first:h10.months[0].month,last:h10.months[h10.months.length-1].month}:null);
 return {h10,tests};
}
```

Record keys from `buildTestState` are `package:bhp:1` … `package:bhp:4`, in row order.

- [ ] **Step 2: Write the failing tests** `N/tests/injectivity-estimate.test.mjs`:

```js
import test from 'node:test';import assert from 'node:assert/strict';
import {createEstimateState,withInputs,confirmBasis,setAssumptions,moveMatch,chooseJ,estimate,handoff,validateAssumptions,datumFor,
 REASONS,DEFAULT_ASSUMPTIONS,TUBING_SENSITIVITY_IN,ATMOSPHERE_PSI,LABEL_J,LIMITATIONS,BASIS_STATEMENT} from '../dist/injectivityEstimate.js';
import {traverseBrineWell} from '../dist/wellboreTraverse.js';
import {applyDecision} from '../dist/h10Diagnostics.js';
import {applyTestDecision} from '../dist/testRecords.js';
import {fixtureInputs,monthlyRow,bhpRow} from './helpers/injectivity-fixture.mjs';

const K=n=>`package:bhp:${n}`;
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const psig=s=>confirmBasis(s,'psig','RRC Permian guidance');
const byKey=(est,n)=>est.tests.find(t=>t.key===K(n));
const pwf=(depth,surfacePsia,id=3.958,rate=10000)=>traverseBrineWell({well:{tvdFt:depth,measuredDepthFt:depth,innerDiameterInches:id,roughnessInches:0.0006,bottomholeTemperatureF:100},
 fluid:{referencePressurePsia:surfacePsia,temperatureF:100,salinityWtPercent:10},settings:{model:'segmented-brine',surfaceTemperatureF:70,segments:32},rateStbd:rate,boundary:{location:'surface',pressurePsia:surfacePsia}});

test('matches show before the basis is confirmed, with no J',()=>{
 const e=estimate(createEstimateState(fixtureInputs())),t1=byKey(e,1);
 assert.equal(t1.status,'awaiting-basis');assert.equal(t1.reason,REASONS.basis);assert.equal(t1.month,'2024-02');
 assert.equal(t1.rateStbd,10000);near(t1.surfacePsia,914.7);assert.equal(t1.j,null);assert.equal(e.chosenKey,null);
 assert.equal(e.readiness,'Confirm the pressure basis to see test-referenced J.');
});
test('psig basis: P_res = reported + 14.7; P_wf from the surface traverse; J = q/(P_wf - P_res)',()=>{
 const t1=byKey(estimate(psig(createEstimateState(fixtureInputs()))),1),t=pwf(3310,914.7);
 assert.equal(t1.status,'qualifies');near(t1.pResPsia,1705+ATMOSPHERE_PSI);near(t1.pWfPsia,t.bottomholePsia);
 near(t1.hydrostaticPsi,t.hydrostaticPsi);near(t1.frictionPsi,t.frictionPsi);near(t1.deltaPsi,t.bottomholePsia-1719.7);near(t1.j,10000/(t.bottomholePsia-1719.7));
});
test('no-friction check equals q over the gauge surface pressure (R4) and alternate basis uses the reported value',()=>{
 const t1=byKey(estimate(psig(createEstimateState(fixtureInputs()))),1),t=pwf(3310,914.7);
 near(t1.jNoFriction,10000/900);near(t1.jAlternateBasis,10000/(t.bottomholePsia-1705));assert.equal(t1.alternateBasis,'psia');
 const a=byKey(estimate(confirmBasis(createEstimateState(fixtureInputs()),'psia','source field name')),1);
 near(a.pResPsia,1705);near(a.jAlternateBasis,10000/(t.bottomholePsia-1719.7));assert.equal(a.alternateBasis,'psig');
});
test('tubing sensitivity: larger ID, less friction, lower J (R5); first entry equals the default J',()=>{
 const t1=byKey(estimate(psig(createEstimateState(fixtureInputs()))),1);
 assert.deepEqual(t1.jByTubing.map(x=>x.innerDiameterInches),[...TUBING_SENSITIVITY_IN]);
 assert.ok(t1.jByTubing.every(x=>x.j!==null&&x.reason===null));near(t1.jByTubing[0].j,t1.j);
 assert.ok(t1.jByTubing[0].j>t1.jByTubing[1].j&&t1.jByTubing[1].j>t1.jByTubing[2].j);
 const fr=TUBING_SENSITIVITY_IN.map(id=>pwf(3310,914.7,id).frictionPsi);assert.ok(fr[0]>fr[1]&&fr[1]>fr[2]);
});
test('every refusal reason, with nothing clamped',()=>{
 const s=psig(createEstimateState(fixtureInputs()));let e=estimate(s);
 assert.equal(byKey(e,3).status,'refused');assert.equal(byKey(e,3).reason,REASONS.excluded);
 assert.equal(byKey(e,4).status,'unmatched');assert.equal(byKey(e,4).reason,REASONS.monthExcluded);assert.equal(byKey(e,4).month,'2024-05');
 const in3={...fixtureInputs()};in3.tests=applyTestDecision(in3.tests,K(3),true);
 assert.equal(byKey(estimate(psig(createEstimateState(in3))),3).reason,REASONS.depthDiffers(3100,3310));
 const in4={...fixtureInputs()};in4.h10=applyDecision(in4.h10,'2024-05',true);
 assert.equal(byKey(estimate(psig(createEstimateState(in4))),4).reason,REASONS.noAvg);
 const zero=fixtureInputs({monthly:['2024-01','2024-02','2024-03'].map(m=>monthlyRow(m,m==='2024-02'?0:10000,900))});zero.h10=applyDecision(zero.h10,'2024-02',true);
 assert.equal(byKey(estimate(psig(createEstimateState(zero))),1).reason,REASONS.noRate);
 const gap=fixtureInputs({monthly:[monthlyRow('2024-01',10000,900),monthlyRow('2024-03',10000,900)]});
 assert.equal(byKey(estimate(psig(createEstimateState(gap))),1).reason,REASONS.gap);
 const late=fixtureInputs({bhp:[bhpRow(1,'2025-01-05',1705,3310),bhpRow(2,'2023-06-01',1705,3310)]});const le=estimate(psig(createEstimateState(late)));
 assert.equal(byKey(le,1).reason,REASONS.after);assert.equal(byKey(le,2).reason,REASONS.before);
 assert.equal(byKey(estimate(psig(createEstimateState({...fixtureInputs(),h10:null}))),1).reason,REASONS.noH10);
 const low=byKey(estimate(psig(createEstimateState(fixtureInputs({avg:50})))),1);assert.equal(low.status,'refused');assert.equal(low.reason,REASONS.lowSurface);assert.equal(low.j,null);
 const fast=byKey(estimate(setAssumptions(s,{innerDiameterInches:2.441})),1);assert.equal(fast.status,'unsupported');assert.match(fast.reason,/^Unsupported by the wellbore traverse: .*5 m\/s/);assert.equal(fast.pWfPsia,null);
 const high=byKey(estimate(psig(createEstimateState(fixtureInputs({bhp:[bhpRow(1,'2024-02-12',3000,3310)]})))),1);
 assert.equal(high.status,'refused');assert.equal(high.reason,REASONS.notAbove);assert.equal(high.j,null);assert.ok(high.pWfPsia<high.pResPsia);
});
test('a test with no depth, no date or no pressure is refused before matching',()=>{
 const inputs=fixtureInputs({bhp:[bhpRow(1,'2024-02-12',1705,null),bhpRow(2,null,1705,3310),bhpRow(3,'2024-03-12',null,3310)]});
 for(const k of [1,2,3])inputs.tests=applyTestDecision(inputs.tests,K(k),true);
 const e=estimate(psig(createEstimateState(inputs)));
 assert.equal(byKey(e,1).reason,REASONS.noDepth);assert.equal(byKey(e,2).reason,REASONS.noDate);assert.equal(byKey(e,3).reason,REASONS.noPressure);
});
test('a moved match needs a reason, is recorded and changes the matched month',()=>{
 const s=psig(createEstimateState(fixtureInputs()));
 assert.throws(()=>moveMatch(s,K(4),-1,' '),/reason/);assert.throws(()=>moveMatch(s,K(4),2,'x'),/previous or next/);assert.throws(()=>moveMatch(s,'nope',1,'x'),/Not a BHP test/);
 const moved=moveMatch(s,K(4),-1,'shut-in spanned the month end'),t4=byKey(estimate(moved),4);
 assert.equal(t4.month,'2024-04');assert.equal(t4.shift,-1);assert.equal(t4.shiftReason,'shut-in spanned the month end');assert.equal(t4.status,'qualifies');
 assert.equal(byKey(estimate(moveMatch(moved,K(4),0,'')),4).month,'2024-05');
});
test('basis confirmation requires a reason and a known value',()=>{
 const s=createEstimateState(fixtureInputs());
 assert.throws(()=>confirmBasis(s,'psig',''),/reason/);assert.throws(()=>confirmBasis(s,'bar','x'),/psig or psia/);assert.throws(()=>confirmBasis(s,'psig','x'.repeat(201)),/reason/);
 assert.deepEqual(psig(s).basis,{value:'psig',reason:'RRC Permian guidance'});
});
test('choice: latest by default; a user choice needs a reason; a dropped choice falls back to the latest',()=>{
 const s=psig(createEstimateState(fixtureInputs())),e=estimate(s);
 assert.deepEqual(e.qualifying,[K(1),K(2)]);assert.equal(e.chosenKey,K(2));assert.equal(e.choiceBy,'system');assert.equal(e.choiceDropped,false);
 assert.throws(()=>chooseJ(s,K(1),''),/reason/);assert.throws(()=>chooseJ(s,K(4),'x'),/qualifying/);
 const c=chooseJ(s,K(1),'nearest to the planning period'),ce=estimate(c);assert.equal(ce.chosenKey,K(1));assert.equal(ce.choiceBy,'user');assert.equal(ce.choiceReason,'nearest to the planning period');
 const changed=fixtureInputs();changed.tests=applyTestDecision(changed.tests,K(1),false,'operator note');
 const de=estimate(withInputs(c,changed));assert.equal(de.chosenKey,K(2));assert.equal(de.choiceBy,'system');assert.equal(de.choiceDropped,true);
});
test('range, trend and readiness',()=>{
 const e=estimate(psig(createEstimateState(fixtureInputs()))),js=[byKey(e,1).j,byKey(e,2).j];
 assert.deepEqual(e.range,{min:Math.min(...js),max:Math.max(...js)});assert.deepEqual(e.trend,[{date:'2024-02-12',j:js[0]},{date:'2024-07-22',j:js[1]}]);
 assert.equal(e.readiness,'2 of 4 BHP tests give a test-referenced J (estimate).');
 const none=estimate(psig(createEstimateState(fixtureInputs({avg:50}))));assert.equal(none.range,null);assert.equal(none.trend,null);assert.equal(none.chosenKey,null);
 assert.equal(none.readiness,'No test qualifies for a test-referenced J. Reasons are listed per test.');
 assert.equal(estimate(createEstimateState(fixtureInputs({bhp:[]}))).readiness,'No BHP test records for this well; no test-referenced J.');
});
test('round trip: the scenario reproduces the chosen month within 0.5 psi; other months show their residual',()=>{
 const e=estimate(psig(createEstimateState(fixtureInputs())));assert.equal(e.roundTrip.length,2);
 const chosen=e.roundTrip.find(r=>r.chosen),other=e.roundTrip.find(r=>!r.chosen);
 assert.equal(chosen.key,K(2));assert.ok(Math.abs(chosen.residualPsi)<=0.5);near(chosen.observedSurfacePsia,914.7);assert.equal(e.roundTripOk,true);
 assert.equal(typeof other.residualPsi,'number');assert.equal(other.month,'2024-02');
});
test('withInputs keeps the basis, assumptions and moves for tests that still exist',()=>{
 const s=moveMatch(setAssumptions(psig(createEstimateState(fixtureInputs())),{salinityWtPercent:12}),K(4),-1,'reason');
 const next=withInputs(s,fixtureInputs({bhp:[bhpRow(1,'2024-02-12',1705,3310)]}));
 assert.deepEqual(next.basis,s.basis);assert.equal(next.assumptions.salinityWtPercent,12);assert.deepEqual(Object.keys(next.shifts),[]);
});
test('assumptions are validated, never clamped',()=>{
 assert.deepEqual(validateAssumptions({...DEFAULT_ASSUMPTIONS}),{...DEFAULT_ASSUMPTIONS});
 for(const [k,v] of [['innerDiameterInches',0.1],['roughnessInches',0.2],['surfaceTemperatureF',50],['bottomholeTemperatureF',300],['salinityWtPercent',21],['segments',8.5]])
  assert.throws(()=>validateAssumptions({...DEFAULT_ASSUMPTIONS,[k]:v}));
 assert.throws(()=>setAssumptions(createEstimateState(fixtureInputs()),{innerDiameterInches:0.01}));
});
test('hand-off: exact fields and origins, bottomhole limit unset, permit values labelled',()=>{
 const s=psig(createEstimateState(fixtureInputs())),e=estimate(s),t2=byKey(e,2),h=handoff(s,e,{surfacePsi:1176,volumeBpd:30000},'ab'.repeat(32));
 assert.deepEqual(Object.keys(h.values).sort(),['caseName','curveMaximumStbd','datum','innerDiameterInches','injectivityStbdPerPsi','limitPsia','measuredDepthFt','model','operatingCeilingStbd','rateStbd','referencePressurePsia','reservoirPsia','roughnessInches','salinityWtPercent','segments','surfaceLimitPsia','surfaceTemperatureF','temperatureF','tvdFt'].sort());
 assert.equal(h.values.model,'segmented-brine');assert.equal(h.values.limitPsia,null);near(h.values.surfaceLimitPsia,1190.7);assert.equal(h.values.operatingCeilingStbd,30000);
 near(h.values.injectivityStbdPerPsi,t2.j);near(h.values.reservoirPsia,1745.7);assert.equal(h.values.tvdFt,3310);assert.equal(h.values.rateStbd,10000);assert.equal(h.values.curveMaximumStbd,15000);
 assert.equal(h.values.datum,datumFor(t2));assert.equal(h.values.datum,'Top of completed interval at 3310 ft TVD (RRC guidance), from BHP test 2024-07-22');
 assert.equal(h.origins.limitPsia,'Not set from evidence; declare it.');assert.match(h.origins.injectivityStbdPerPsi,/^Test-referenced J \(estimate\) from BHP test 2024-07-22 and H-10 2024-07; sealed estimate abab/);
 assert.equal(h.origins.surfaceLimitPsia,'Inventory permitted surface pressure 1176 psi + 14.7 psi (permit value)');
 assert.deepEqual(h.sweep,e.range);
 const bare=handoff(s,e,{surfacePsi:null,volumeBpd:null},'ab'.repeat(32));assert.equal(bare.values.surfaceLimitPsia,null);assert.equal(bare.values.operatingCeilingStbd,null);
 assert.equal(bare.origins.surfaceLimitPsia,'No permitted surface pressure in the inventory; declare it.');
 assert.throws(()=>handoff(createEstimateState(fixtureInputs()),estimate(createEstimateState(fixtureInputs())),{surfacePsi:null,volumeBpd:null},'x'),/No test-referenced J/);
 assert.throws(()=>handoff(s,{...e,roundTripOk:false},{surfacePsi:null,volumeBpd:null},'x'),/round trip/);
});
test('wording: the label is an estimate and no produced text says calibrated',()=>{
 assert.equal(LABEL_J,'Test-referenced J (estimate)');
 const e=estimate(psig(createEstimateState(fixtureInputs())));
 assert.doesNotMatch(JSON.stringify({e,LIMITATIONS,BASIS_STATEMENT,REASONS:Object.values(REASONS).map(String)}),/calibrated/i);
});
```

- [ ] **Step 3:** Run `node ../node_modules/typescript/bin/tsc -p tsconfig.json; node --test tests/injectivity-estimate.test.mjs` from `N/`. Expected: FAIL, because `../dist/injectivityEstimate.js` is not found.

- [ ] **Step 4: Write `N/src/injectivityEstimate.ts`:**

```ts
import {segmentedHydraulicPoint,type DisposalWell} from './disposalCase.js';
import type {DiagnosticsState} from './h10Diagnostics.js';
import {DEPTH_TOLERANCE_FT,type TestRecord,type TestState} from './testRecords.js';
import {traverseBrineWell,TraverseError,type SegmentedBrineSettings,type WellboreGeometry} from './wellboreTraverse.js';

/** Phase 1c test-referenced J estimate. Pure; no DOM. Measured static P_res, modelled P_wf; never described as calibrated. */
export const J_ESTIMATE_VERSION='test-referenced-j/1';
export const LABEL_J='Test-referenced J (estimate)';
export const BASIS_STATEMENT='Measured static reservoir pressure (BHP test); flowing bottomhole pressure modelled from H-10 surface pressure through the wellbore traverse; declared tubing and fluid assumptions; monthly calendar-day average rate.';
export const ATMOSPHERE_PSI=14.7;
export const ROUND_TRIP_TOLERANCE_PSI=0.5;
export const MIN_TRAVERSE_PSIA=100;
export const MAX_REASON_LENGTH=200;
export const TUBING_SENSITIVITY_IN=Object.freeze([3.958,4.892,6.276]);
export type Basis='psig'|'psia';
export type Shift=-1|0|1;
export type Assumptions={innerDiameterInches:number;roughnessInches:number;surfaceTemperatureF:number;bottomholeTemperatureF:number;salinityWtPercent:number;segments:number};
export const DEFAULT_ASSUMPTIONS:Readonly<Assumptions>=Object.freeze({innerDiameterInches:3.958,roughnessInches:0.0006,surfaceTemperatureF:70,bottomholeTemperatureF:100,salinityWtPercent:10,segments:32});
export const REASONS=Object.freeze({
  excluded:'Excluded in the Test records review.',noDate:'No valid test date.',noPressure:'No test pressure reported.',noDepth:'No test depth reported.',
  depthTie:'No single reference depth among the tests; not comparable.',
  depthDiffers:(depth:number,ref:number)=>`Tested at ${depth} ft, not the reference depth ${ref} ft; not comparable.`,
  noH10:'No H-10 months to match.',before:'Dated before the H-10 range.',after:'Dated after the H-10 range.',
  gap:'The matched month has no H-10 report (gap).',monthExcluded:'The matched month is excluded in the H-10 review.',
  noRate:'The matched month has no positive rate.',noAvg:'The matched month has no average pressure.',
  basis:'Confirm the pressure basis first.',lowSurface:'Surface pressure is below 100 psia; outside the traverse domain.',
  unsupported:(message:string)=>`Unsupported by the wellbore traverse: ${message}`,
  notAbove:'Flowing pressure not above reservoir pressure; no J.'});
export const LIMITATIONS=Object.freeze([BASIS_STATEMENT,
  'The calendar-day rate understates the onstream rate whenever the well had downtime, so J reads low; no correction is made.',
  'The matched month contains the shut-in of at least 24 hours for the test.',
  'H-10 average pressure is a monthly figure, not a flowing pressure measured at the time of the test; it is treated as psig and 14.7 psi is added.',
  'Tubing size, roughness, temperatures and salinity are declared assumptions, not public records; the well is treated as vertical (MD = TVD = test depth).',
  'The basis of the BHP source field is unresolved in the source; the confirmed reading is the user\'s.',
  'No-friction check: P_wf = surface pressure + (test pressure / test depth) x test depth; it equals the fluid column only if the shut-in surface pressure was about zero.',
  'Rate in bbl/day is treated as STB/day.']);
export type JInputs={h10:DiagnosticsState|null;tests:TestState};
export type EstimateState={version:typeof J_ESTIMATE_VERSION;inputs:JInputs;basis:{value:Basis;reason:string}|null;assumptions:Assumptions;
  shifts:Readonly<Record<string,{shift:Exclude<Shift,0>;reason:string}>>;choice:{key:string;reason:string}|null};
export type TubingJ={innerDiameterInches:number;j:number|null;reason:string|null};
export type TestEstimate={key:string;date:string|null;depthFt:number|null;reportedPsi:number|null;month:string|null;shift:Shift;shiftReason:string|null;
  status:'qualifies'|'unmatched'|'awaiting-basis'|'refused'|'unsupported';reason:string|null;
  rateStbd:number|null;surfacePsi:number|null;surfacePsia:number|null;pResPsia:number|null;pWfPsia:number|null;hydrostaticPsi:number|null;frictionPsi:number|null;deltaPsi:number|null;
  j:number|null;jNoFriction:number|null;jAlternateBasis:number|null;alternateBasis:Basis|null;jByTubing:TubingJ[]};
export type RoundTripRow={key:string;month:string;rateStbd:number;observedSurfacePsia:number;reproducedSurfacePsia:number|null;residualPsi:number|null;chosen:boolean;reason:string|null};
export type Estimate={version:typeof J_ESTIMATE_VERSION;label:typeof LABEL_J;basis:{value:Basis;reason:string}|null;assumptions:Assumptions;tests:TestEstimate[];qualifying:string[];
  chosenKey:string|null;choiceBy:'system'|'user'|null;choiceReason:string|null;choiceDropped:boolean;range:{min:number;max:number}|null;trend:{date:string;j:number}[]|null;
  roundTrip:RoundTripRow[];roundTripOk:boolean;readiness:string};
export type Permit={surfacePsi:number|null;volumeBpd:number|null};
export type Handoff={values:Record<string,string|number|null>;origins:Record<string,string>;sweep:{min:number;max:number}|null;notes:string[]};

function reasonText(reason:unknown,label:string){const t=String(reason??'').trim();if(!t||t.length>MAX_REASON_LENGTH)throw new Error(`${label}: a reason of 1-${MAX_REASON_LENGTH} characters is required`);return t;}
function bound(v:number,min:number,max:number,label:string){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error(`${label} must be between ${min} and ${max}`);}
export function validateAssumptions(a:Assumptions):Assumptions{
  bound(a.innerDiameterInches,0.25,30,'Tubing inner diameter (in)');bound(a.roughnessInches,0,0.1,'Absolute roughness (in)');
  if(a.roughnessInches/a.innerDiameterInches>0.05)throw new Error('Relative roughness must not exceed 0.05');
  bound(a.surfaceTemperatureF,60,250,'Surface temperature (°F)');bound(a.bottomholeTemperatureF,60,250,'Bottomhole temperature (°F)');
  bound(a.salinityWtPercent,0,20,'NaCl salinity (wt%)');bound(a.segments,8,256,'Traverse segments');if(!Number.isInteger(a.segments))throw new Error('Traverse segments must be an integer');
  return {innerDiameterInches:a.innerDiameterInches,roughnessInches:a.roughnessInches,surfaceTemperatureF:a.surfaceTemperatureF,bottomholeTemperatureF:a.bottomholeTemperatureF,salinityWtPercent:a.salinityWtPercent,segments:a.segments};
}
export function createEstimateState(inputs:JInputs):EstimateState{return {version:J_ESTIMATE_VERSION,inputs,basis:null,assumptions:{...DEFAULT_ASSUMPTIONS},shifts:Object.freeze({}),choice:null};}
export function withInputs(state:EstimateState,inputs:JInputs):EstimateState{
  const keys=new Set(inputs.tests.records.filter(r=>r.kind==='bhp').map(r=>r.key));
  return {...state,inputs,shifts:Object.freeze(Object.fromEntries(Object.entries(state.shifts).filter(([k])=>keys.has(k)))),choice:state.choice&&keys.has(state.choice.key)?state.choice:null};
}
export function confirmBasis(state:EstimateState,value:Basis,reason:string):EstimateState{
  if(value!=='psig'&&value!=='psia')throw new Error('The basis must be psig or psia');
  return {...state,basis:{value,reason:reasonText(reason,'Basis')}};
}
export function setAssumptions(state:EstimateState,partial:Partial<Assumptions>):EstimateState{return {...state,assumptions:validateAssumptions({...state.assumptions,...partial})};}
const bhpRecord=(state:EstimateState,key:string)=>{const r=state.inputs.tests.records.find(x=>x.key===key&&x.kind==='bhp');if(!r)throw new Error(`Not a BHP test: ${key}`);return r;};
export function moveMatch(state:EstimateState,key:string,shift:Shift,reason:string):EstimateState{
  bhpRecord(state,key);if(shift!==-1&&shift!==0&&shift!==1)throw new Error('A match can move only to the previous or next month');
  const next={...state.shifts};if(shift===0)delete next[key];else next[key]={shift,reason:reasonText(reason,'Moved match')};
  return {...state,shifts:Object.freeze(next)};
}
export function chooseJ(state:EstimateState,key:string,reason:string):EstimateState{
  const text=reasonText(reason,'Chosen J');if(!estimate(state).qualifying.includes(key))throw new Error('Only a qualifying test can be chosen');
  return {...state,choice:{key,reason:text}};
}
function shiftMonth(month:string,by:number){const d=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7))-1+by,1));return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;}
const settings=(a:Assumptions):SegmentedBrineSettings=>({model:'segmented-brine',surfaceTemperatureF:a.surfaceTemperatureF,segments:a.segments});
const geometry=(depth:number,a:Assumptions,id:number):WellboreGeometry=>({tvdFt:depth,measuredDepthFt:depth,innerDiameterInches:id,roughnessInches:a.roughnessInches,bottomholeTemperatureF:a.bottomholeTemperatureF});
function flowing(depth:number,a:Assumptions,id:number,rate:number,surfacePsia:number):{pwf:number;hydro:number;friction:number}|{reason:string}{
  try{const t=traverseBrineWell({well:geometry(depth,a,id),fluid:{referencePressurePsia:surfacePsia,temperatureF:a.bottomholeTemperatureF,salinityWtPercent:a.salinityWtPercent},settings:settings(a),rateStbd:rate,boundary:{location:'surface',pressurePsia:surfacePsia}});
    return {pwf:t.bottomholePsia,hydro:t.hydrostaticPsi,friction:t.frictionPsi};}
  catch(error){if(error instanceof TraverseError&&error.code!=='numerical')return {reason:REASONS.unsupported(error.message)};throw error;}
}
const jFrom=(pwf:number,pres:number,q:number)=>pwf>pres?q/(pwf-pres):null;
function evaluate(state:EstimateState,r:TestRecord):TestEstimate{
  const s=state.shifts[r.key],shift:Shift=s?.shift??0,tests=state.inputs.tests,a=state.assumptions;
  const base:TestEstimate={key:r.key,date:r.date,depthFt:r.depthFt,reportedPsi:r.bhpPsia,month:null,shift,shiftReason:s?.reason??null,status:'refused',reason:null,rateStbd:null,surfacePsi:null,surfacePsia:null,
    pResPsia:null,pWfPsia:null,hydrostaticPsi:null,frictionPsi:null,deltaPsi:null,j:null,jNoFriction:null,jAlternateBasis:null,alternateBasis:null,jByTubing:[]};
  const stop=(status:TestEstimate['status'],reason:string,extra:Partial<TestEstimate>={}):TestEstimate=>({...base,...extra,status,reason});
  if(tests.decisions[r.key]?.include!==true)return stop('refused',REASONS.excluded);
  if(r.date===null)return stop('refused',REASONS.noDate);
  if(r.bhpPsia===null)return stop('refused',REASONS.noPressure);
  if(r.depthFt===null)return stop('refused',REASONS.noDepth);
  if(tests.referenceTie)return stop('refused',REASONS.depthTie);
  if(tests.referenceDepthFt!==null&&Math.abs(r.depthFt-tests.referenceDepthFt)>DEPTH_TOLERANCE_FT)return stop('refused',REASONS.depthDiffers(r.depthFt,tests.referenceDepthFt));
  const h10=state.inputs.h10;if(!h10||!h10.months.length)return stop('unmatched',REASONS.noH10);
  const month=shiftMonth(r.date.slice(0,7),shift);
  if(month<h10.months[0].month)return stop('unmatched',REASONS.before,{month});
  if(month>h10.months[h10.months.length-1].month)return stop('unmatched',REASONS.after,{month});
  const m=h10.months.find(x=>x.month===month)!;
  if(m.gap)return stop('unmatched',REASONS.gap,{month});
  if(h10.decisions[month]?.include!==true)return stop('unmatched',REASONS.monthExcluded,{month});
  if(m.rateBpd===null||!Number.isFinite(m.rateBpd)||m.rateBpd<=0)return stop('unmatched',REASONS.noRate,{month});
  if(m.avgPsi===null||!Number.isFinite(m.avgPsi))return stop('unmatched',REASONS.noAvg,{month});
  const q=m.rateBpd,surfacePsi=m.avgPsi,surfacePsia=surfacePsi+ATMOSPHERE_PSI,matched={month,rateStbd:q,surfacePsi,surfacePsia};
  if(!state.basis)return stop('awaiting-basis',REASONS.basis,matched);
  if(surfacePsia<MIN_TRAVERSE_PSIA)return stop('refused',REASONS.lowSurface,matched);
  const psig=state.basis.value==='psig',pResPsia=psig?r.bhpPsia+ATMOSPHERE_PSI:r.bhpPsia,alternatePres=psig?r.bhpPsia:r.bhpPsia+ATMOSPHERE_PSI;
  const f=flowing(r.depthFt,a,a.innerDiameterInches,q,surfacePsia);
  if('reason' in f)return stop('unsupported',f.reason,{...matched,pResPsia});
  const pWfNoFriction=surfacePsia+(r.bhpPsia/r.depthFt)*r.depthFt;
  const jByTubing=TUBING_SENSITIVITY_IN.map((id):TubingJ=>{const t=flowing(r.depthFt!,a,id,q,surfacePsia);if('reason' in t)return {innerDiameterInches:id,j:null,reason:t.reason};const j=jFrom(t.pwf,pResPsia,q);return {innerDiameterInches:id,j,reason:j===null?REASONS.notAbove:null};});
  const values:Partial<TestEstimate>={...matched,pResPsia,pWfPsia:f.pwf,hydrostaticPsi:f.hydro,frictionPsi:f.friction,deltaPsi:f.pwf-pResPsia,
    jNoFriction:jFrom(pWfNoFriction,pResPsia,q),jAlternateBasis:jFrom(f.pwf,alternatePres,q),alternateBasis:psig?'psia':'psig',jByTubing};
  const j=jFrom(f.pwf,pResPsia,q);
  if(j===null)return stop('refused',REASONS.notAbove,values);
  return {...base,...values,j,status:'qualifies',reason:null};
}
export const datumFor=(t:TestEstimate)=>`Top of completed interval at ${t.depthFt} ft TVD (RRC guidance), from BHP test ${t.date}`;
function reproduce(a:Assumptions,t:TestEstimate,chosen:TestEstimate):RoundTripRow{
  const row={key:t.key,month:t.month!,rateStbd:t.rateStbd!,observedSurfacePsia:t.surfacePsia!,chosen:t.key===chosen.key};
  const datum=datumFor(chosen);
  const well:DisposalWell={id:'TEST-REFERENCED-J',reservoirPsia:chosen.pResPsia!,limitPsia:10000,injectivityStbdPerPsi:chosen.j!,operatingCeilingStbd:1_000_000,availability:1,datum,reservoirDatum:datum,limitDatum:datum,
    reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',tvdFt:chosen.depthFt!,measuredDepthFt:chosen.depthFt!,innerDiameterInches:a.innerDiameterInches,roughnessInches:a.roughnessInches,surfaceLimitPsia:10000,bottomholeTemperatureF:a.bottomholeTemperatureF};
  try{
    const p=segmentedHydraulicPoint(well,{referencePressurePsia:chosen.pResPsia!,temperatureF:a.bottomholeTemperatureF,salinityWtPercent:a.salinityWtPercent},settings(a),t.rateStbd!);
    if(p.status!=='flowing'||p.requiredSurfacePsia===null)return {...row,reproducedSurfacePsia:null,residualPsi:null,reason:p.reasons.join(' ')||'No flowing solution.'};
    return {...row,reproducedSurfacePsia:p.requiredSurfacePsia,residualPsi:p.requiredSurfacePsia-t.surfacePsia!,reason:null};
  }catch(error){return {...row,reproducedSurfacePsia:null,residualPsi:null,reason:error instanceof Error?error.message:String(error)};}
}
export function estimate(state:EstimateState):Estimate{
  const tests=state.inputs.tests.records.filter(r=>r.kind==='bhp').map(r=>evaluate(state,r));
  const q=tests.filter(t=>t.status==='qualifies').sort((x,y)=>x.date!<y.date!?-1:x.date!>y.date!?1:0);
  const user=state.choice&&q.some(t=>t.key===state.choice!.key)?state.choice:null,chosen=user?q.find(t=>t.key===user.key)!:q[q.length-1]??null;
  const js=q.map(t=>t.j!),roundTrip=chosen?q.map(t=>reproduce(state.assumptions,t,chosen)):[];
  const own=roundTrip.find(r=>r.chosen);
  const readiness=!tests.length?'No BHP test records for this well; no test-referenced J.':!state.basis?'Confirm the pressure basis to see test-referenced J.':
    !q.length?'No test qualifies for a test-referenced J. Reasons are listed per test.':`${q.length} of ${tests.length} BHP tests give a test-referenced J (estimate).`;
  return {version:J_ESTIMATE_VERSION,label:LABEL_J,basis:state.basis?{...state.basis}:null,assumptions:{...state.assumptions},tests,qualifying:q.map(t=>t.key),
    chosenKey:chosen?.key??null,choiceBy:chosen?(user?'user':'system'):null,choiceReason:user?.reason??null,choiceDropped:state.choice!==null&&user===null,
    range:q.length?{min:Math.min(...js),max:Math.max(...js)}:null,trend:q.length>=2?q.map(t=>({date:t.date!,j:t.j!})):null,
    roundTrip,roundTripOk:!!own&&own.residualPsi!==null&&Math.abs(own.residualPsi)<=ROUND_TRIP_TOLERANCE_PSI,readiness};
}
/** Hydraulics workspace field values (null = leave empty for the user to declare) with an origin label per field. */
export function handoff(state:EstimateState,est:Estimate,permit:Permit,estimateSha256:string):Handoff{
  const t=est.tests.find(x=>x.key===est.chosenKey);
  if(!t||t.j===null)throw new Error('No test-referenced J is chosen; nothing to hand off.');
  if(!est.roundTripOk)throw new Error('The round trip does not reproduce the chosen month within 0.5 psi; hand-off refused.');
  const a=state.assumptions,assumed='Declared assumption (test-referenced J estimate)',basis=state.basis!;
  const surface=permit.surfacePsi!==null&&permit.surfacePsi>0?permit.surfacePsi+ATMOSPHERE_PSI:null,volume=permit.volumeBpd!==null&&permit.volumeBpd>0?permit.volumeBpd:null;
  return {values:{model:'segmented-brine',caseName:LABEL_J,datum:datumFor(t),injectivityStbdPerPsi:t.j,reservoirPsia:t.pResPsia,referencePressurePsia:t.pResPsia,tvdFt:t.depthFt,measuredDepthFt:t.depthFt,
      innerDiameterInches:a.innerDiameterInches,roughnessInches:a.roughnessInches,temperatureF:a.bottomholeTemperatureF,surfaceTemperatureF:a.surfaceTemperatureF,salinityWtPercent:a.salinityWtPercent,segments:a.segments,
      rateStbd:t.rateStbd,curveMaximumStbd:Math.ceil(1.5*t.rateStbd!),surfaceLimitPsia:surface,operatingCeilingStbd:volume,limitPsia:null},
    origins:{injectivityStbdPerPsi:`${LABEL_J} from BHP test ${t.date} and H-10 ${t.month}; sealed estimate ${estimateSha256.slice(0,12)}`,
      reservoirPsia:`BHP test ${t.date}: ${basis.value} reading${basis.value==='psig'?' + 14.7 psi':''} (basis confirmed: ${basis.reason})`,referencePressurePsia:'Set to the reservoir pressure (fluid reference state, context only)',
      datum:'From the BHP test depth (RRC guidance: top of the completed disposal interval)',tvdFt:'BHP test depth; vertical well declared',measuredDepthFt:'BHP test depth; vertical well declared',
      innerDiameterInches:assumed,roughnessInches:assumed,temperatureF:assumed,surfaceTemperatureF:assumed,salinityWtPercent:assumed,segments:assumed,
      rateStbd:`H-10 ${t.month} calendar-day average rate`,curveMaximumStbd:'1.5 x the matched rate',
      surfaceLimitPsia:surface===null?'No permitted surface pressure in the inventory; declare it.':`Inventory permitted surface pressure ${permit.surfacePsi} psi + 14.7 psi (permit value)`,
      operatingCeilingStbd:volume===null?'No permitted volume in the inventory; declare it.':`Inventory permitted volume ${volume} bbl/day (permit value)`,
      limitPsia:'Not set from evidence; declare it.'},
    sweep:est.range?{...est.range}:null,
    notes:[est.range?`J range for sweeps: ${est.range.min.toPrecision(4)} to ${est.range.max.toPrecision(4)} STB/day/psi (enter it in Parameter sweeps).`:'',BASIS_STATEMENT].filter(Boolean)};
}
```

- [ ] **Step 5:** From `N/`, run `node ../node_modules/typescript/bin/tsc -p tsconfig.json; node --test tests/injectivity-estimate.test.mjs`. Expected: 15 pass, 0 fail. If a test's numerical expectation disagrees with the code, check it against the spec's formula and the R1–R6 rulings first. Change a test only when the test itself is wrong, and say so in the report.

- [ ] **Step 6:** Check that CR bytes are 0 in the three new files.

---

### Task 2: Chart and sealed export

**Files:**
- Create: `N/src/injectivityEstimateChart.ts`, `N/src/injectivityEstimateExport.ts`
- Test: `N/tests/injectivity-export.test.mjs`

**Interfaces:**
- Consumes: `Estimate`, `TestEstimate`, `LABEL_J`, `BASIS_STATEMENT`, `LIMITATIONS`, `J_ESTIMATE_VERSION` (Task 1).
- Produces:
  - `jEstimateSvg(est): {svg:string;height:number}`;
  - `type JSource={uic:string;artifactId:string;normalizedSha256:string|null;manifestSha256:string|null;tests:{packageFiles:Record<string,string>;uploads:{kind:string;fileName:string;sha256:string}[]}}`;
  - `type SealedEstimate`;
  - `sealEstimate(est, source): Promise<SealedEstimate>`, which throws `Round trip failed: export refused.` when `est.chosenKey!==null && !est.roundTripOk`;
  - `verifyEstimateSealed(sealed): Promise<boolean>`;
  - `estimateJson(sealed)`, `estimateCsv(sealed)`, `estimateSvg(sealed, est)`.

- [ ] **Step 1: Write the failing tests** `N/tests/injectivity-export.test.mjs`:

```js
import test from 'node:test';import assert from 'node:assert/strict';
import {createEstimateState,confirmBasis,estimate} from '../dist/injectivityEstimate.js';
import {jEstimateSvg} from '../dist/injectivityEstimateChart.js';
import {sealEstimate,verifyEstimateSealed,estimateJson,estimateCsv,estimateSvg} from '../dist/injectivityEstimateExport.js';
import {fixtureInputs,bhpRow} from './helpers/injectivity-fixture.mjs';

const source={uic:'000000417',artifactId:'synthetic',normalizedSha256:null,manifestSha256:null,tests:{packageFiles:{},uploads:[]}};
const ready=()=>estimate(confirmBasis(createEstimateState(fixtureInputs()),'psig','RRC Permian guidance'));

test('sealed export verifies, records method, basis, assumptions, units and limitations',async()=>{
 const s=await sealEstimate(ready(),source);
 assert.equal(s.schemaVersion,'test-referenced-j-export/1');assert.equal(s.method,'test-referenced-j/1');assert.equal(s.label,'Test-referenced J (estimate)');
 assert.equal(s.basis.value,'psig');assert.equal(s.assumptions.innerDiameterInches,3.958);assert.equal(s.units.j,'STB/day/psi');assert.ok(s.limitations.length>=8);
 assert.equal(await verifyEstimateSealed(JSON.parse(estimateJson(s))),true);
});
test('tampering is detected',async()=>{
 const s=JSON.parse(estimateJson(await sealEstimate(ready(),source)));s.tests[0].j=999;assert.equal(await verifyEstimateSealed(s),false);
});
test('a failed round trip refuses the export; a state with no J still exports its reasons',async()=>{
 await assert.rejects(sealEstimate({...ready(),roundTripOk:false},source),/Round trip failed: export refused\./);
 const none=estimate(confirmBasis(createEstimateState(fixtureInputs({avg:50})),'psig','x'));const s=await sealEstimate(none,source);
 assert.equal(s.chosenKey,null);assert.ok(s.tests.every(t=>t.reason));
});
test('CSV escapes formula-like text and marks missing values',async()=>{
 const csv=estimateCsv(await sealEstimate(ready(),{...source,artifactId:'=HYPERLINK("x")'}));
 assert.match(csv,/"'=HYPERLINK\(""x""\)"/);assert.match(csv,/"unavailable"/);assert.ok(csv.endsWith('\r\n'));
});
test('chart: estimate wording, one point per qualifying test, never "calibrated"',()=>{
 const c=jEstimateSvg(ready());assert.match(c.svg,/Test-referenced J \(estimate\)/);assert.equal((c.svg.match(/<circle /g)??[]).length,2);assert.doesNotMatch(c.svg,/calibrated/i);
 const empty=jEstimateSvg(estimate(createEstimateState(fixtureInputs({bhp:[bhpRow(1,'2024-02-12',1705,3310)]}))));assert.match(empty.svg,/No Test-referenced J \(estimate\) to chart/);
});
test('export SVG embeds the sealed JSON as metadata around the chart',async()=>{
 const est=ready(),s=await sealEstimate(est,source),svg=estimateSvg(s,est);
 assert.match(svg,/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);assert.match(svg,/<metadata>/);assert.match(svg,new RegExp(s.contentSha256));
});
```

- [ ] **Step 2:** Compile and run. Expected: FAIL, because the modules are missing.

- [ ] **Step 3: Write `N/src/injectivityEstimateChart.ts`:**

```ts
import {BASIS_STATEMENT,LABEL_J,type Estimate} from './injectivityEstimate.js';

/** Pure SVG; escaped text only. J per qualifying test at its date; the bar spans the basis and tubing sensitivities. */
export type ChartSvg={svg:string;height:number};
const W=960,L=78,R=40,PW=W-L-R,PH=260,TOP=58,DAY=86_400_000;
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
const n=(v:number)=>v.toFixed(2),fmt=(v:number)=>Number(v.toPrecision(4)).toLocaleString('en-US');
const day=(d:string)=>Date.UTC(Number(d.slice(0,4)),Number(d.slice(5,7))-1,Number(d.slice(8,10)));
function niceMax(max:number){if(!(max>0))return 1;const pow=10**Math.floor(Math.log10(max));return [1,2,2.5,5,10].map(s=>s*pow).find(s=>s>=max)!;}
const NOTES=[BASIS_STATEMENT.split('; ').slice(0,2).join('; ')+';',BASIS_STATEMENT.split('; ').slice(2).join('; '),'Bars span J under the other basis reading and the tubing sizes 3.958, 4.892 and 6.276 in.'];
function frame(title:string,lines:string[],body:string,bodyHeight:number):ChartSvg{
  const notesY=TOP+bodyHeight+40,height=notesY+lines.length*18+16;
  const notes=lines.map((t,i)=>`<text x="${L}" y="${notesY+i*18}" font-size="12" fill="#37474f">${esc(t)}</text>`).join('');
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${height}" width="${W}" height="${height}" role="img" aria-label="${esc(title)}" font-family="system-ui, sans-serif"><rect width="${W}" height="${height}" fill="#ffffff"/><text x="${L}" y="26" font-size="16" font-weight="600">${esc(title)}</text>${body}${notes}</svg>`,height};
}
export function jEstimateSvg(est:Estimate):ChartSvg{
  const title=`${LABEL_J} by test date`,q=est.tests.filter(t=>t.status==='qualifies');
  if(!q.length)return frame(title,NOTES,`<text x="${L}" y="${TOP+40}" font-size="14">${esc(`No ${LABEL_J} to chart. ${est.readiness}`)}</text>`,60);
  const spans=q.map(t=>{const all=[t.j!,t.jAlternateBasis,...t.jByTubing.map(x=>x.j)].filter((v):v is number=>v!==null);return {t,lo:Math.min(...all),hi:Math.max(...all)};});
  const t0=day(q[0].date!)-30*DAY,t1=day(q[q.length-1].date!)+30*DAY,yMax=niceMax(Math.max(...spans.map(s=>s.hi)));
  const x=(d:string)=>L+PW*(day(d)-t0)/(t1-t0),y=(v:number)=>TOP+PH-PH*v/yMax;
  let body=`<line x1="${L}" y1="${TOP}" x2="${L}" y2="${TOP+PH}" stroke="#90a4ae"/><line x1="${L}" y1="${TOP+PH}" x2="${L+PW}" y2="${TOP+PH}" stroke="#90a4ae"/>`;
  for(let i=0;i<=4;i++){const v=yMax*i/4,yy=TOP+PH-PH*i/4;body+=`<line x1="${L}" y1="${n(yy)}" x2="${L+PW}" y2="${n(yy)}" stroke="#eceff1"/><text x="${L-8}" y="${n(yy+4)}" font-size="11" text-anchor="end">${esc(fmt(v))}</text>`;}
  body+=`<text x="16" y="${TOP+PH/2}" font-size="12" transform="rotate(-90 16 ${TOP+PH/2})" text-anchor="middle">${esc('J (STB/day/psi), estimate')}</text>`;
  for(const {t,lo,hi} of spans){const cx=n(x(t.date!)),chosen=t.key===est.chosenKey;
    body+=`<line x1="${cx}" y1="${n(y(lo))}" x2="${cx}" y2="${n(y(hi))}" stroke="#8e24aa" stroke-width="2"/><circle cx="${cx}" cy="${n(y(t.j!))}" r="${chosen?6:4}" fill="${chosen?'#4a148c':'#ab47bc'}"><title>${esc(`${t.date}: J ${fmt(t.j!)} STB/day/psi (estimate), H-10 ${t.month}${chosen?', chosen':''}`)}</title></circle><text x="${cx}" y="${n(y(hi)-9)}" font-size="11" text-anchor="middle">${esc(fmt(t.j!))}</text>`;}
  body+=`<text x="${L}" y="${TOP+PH+16}" font-size="11">${esc(q[0].date)}</text><text x="${L+PW}" y="${TOP+PH+16}" font-size="11" text-anchor="end">${esc(q[q.length-1].date)}</text>`;
  return frame(title,[`Points: ${q.length} qualifying tests; the larger point is the chosen J.`,...NOTES],body,PH);
}
```

- [ ] **Step 4: Write `N/src/injectivityEstimateExport.ts`:**

```ts
import {J_ESTIMATE_VERSION,LABEL_J,LIMITATIONS,type Estimate} from './injectivityEstimate.js';
import {jEstimateSvg} from './injectivityEstimateChart.js';

export type JSource={uic:string;artifactId:string;normalizedSha256:string|null;manifestSha256:string|null;tests:{packageFiles:Record<string,string>;uploads:{kind:string;fileName:string;sha256:string}[]}};
export type SealedEstimate=Omit<Estimate,'version'>&{schemaVersion:'test-referenced-j-export/1';method:typeof J_ESTIMATE_VERSION;label:typeof LABEL_J;source:JSource;
  units:Record<string,string>;limitations:string[];contentSha256:string};
const UNITS=Object.freeze({j:'STB/day/psi',rate:'bbl/day calendar-day average, treated as STB/day',pressure:'psia unless named psi (gauge, as reported)',depth:'ft (MD = TVD declared)',diameterAndRoughness:'in',temperature:'°F',salinity:'NaCl wt%'});
async function sha256(text:string){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(h),b=>b.toString(16).padStart(2,'0')).join('');}
const body=(s:Omit<SealedEstimate,'contentSha256'>|SealedEstimate)=>{const {contentSha256:_,...rest}={contentSha256:'',...s};return JSON.stringify(rest);};

export async function sealEstimate(est:Estimate,source:JSource):Promise<SealedEstimate>{
  if(est.chosenKey!==null&&!est.roundTripOk)throw new Error('Round trip failed: export refused.');
  const {version:_,...rest}=JSON.parse(JSON.stringify(est)) as Estimate;
  const unsealed={schemaVersion:'test-referenced-j-export/1' as const,method:J_ESTIMATE_VERSION as typeof J_ESTIMATE_VERSION,...rest,label:LABEL_J as typeof LABEL_J,source:JSON.parse(JSON.stringify(source)) as JSource,units:{...UNITS},limitations:[...LIMITATIONS]};
  return {...unsealed,contentSha256:await sha256(body(unsealed))};
}
export async function verifyEstimateSealed(sealed:SealedEstimate):Promise<boolean>{return /^[a-f0-9]{64}$/.test(sealed?.contentSha256??'')&&await sha256(body(sealed))===sealed.contentSha256;}
export const estimateJson=(sealed:SealedEstimate)=>JSON.stringify(sealed,null,2)+'\n';
const cell=(v:unknown)=>{
  if(v===null||v===undefined)return '"unavailable"';
  if(typeof v==='number')return `"${v}"`;
  let s=String(v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;
  return `"${s.replace(/"/g,'""')}"`;
};
export function estimateCsv(sealed:SealedEstimate):string{
  const lines:unknown[][]=[['Test-referenced J export',sealed.method],['Label',sealed.label],['UIC',sealed.source.uic],['Package artifact',sealed.source.artifactId],['Normalized SHA-256',sealed.source.normalizedSha256],['Manifest SHA-256',sealed.source.manifestSha256],
    ...Object.entries(sealed.source.tests.packageFiles).map(([name,hash])=>['Package file SHA-256',`${name} ${hash}`]),...sealed.source.tests.uploads.map(u=>['Upload (not verified)',`${u.kind} ${u.fileName} ${u.sha256}`]),
    ['Content SHA-256',sealed.contentSha256],['Notice','"unavailable" marks a missing value, never zero'],
    ['Basis',sealed.basis?`${sealed.basis.value} (reason: ${sealed.basis.reason})`:null],...Object.entries(sealed.assumptions).map(([k,v])=>['Assumption',`${k} ${v}`]),
    ['Chosen test',sealed.chosenKey],['Chosen by',sealed.choiceBy],['Choice reason',sealed.choiceReason],['J range (STB/day/psi)',sealed.range?`${sealed.range.min} to ${sealed.range.max}`:null],['Round trip within 0.5 psi',sealed.roundTripOk?'yes':'no'],
    ['Readiness',sealed.readiness],...sealed.limitations.map(l=>['Limitation',l]),[],
    ['Test','Date','Depth (ft)','Reported BHP (psi, as reported)','Matched month','Move','Move reason','Status','Reason','Rate (bbl/day)','Surface (psi)','P_res (psia)','P_wf (psia)','Hydrostatic (psi)','Friction (psi)','Delta p (psi)','J','J no-friction','J other basis','Other basis',
      ...[0,1,2].map(i=>`J at ${sealed.tests[0]?.jByTubing[i]?.innerDiameterInches??['3.958','4.892','6.276'][i]} in`)],
    ...sealed.tests.map(t=>[t.key,t.date,t.depthFt,t.reportedPsi,t.month,t.shift,t.shiftReason,t.status,t.reason,t.rateStbd,t.surfacePsi,t.pResPsia,t.pWfPsia,t.hydrostaticPsi,t.frictionPsi,t.deltaPsi,t.j,t.jNoFriction,t.jAlternateBasis,t.alternateBasis,
      ...[0,1,2].map(i=>t.jByTubing[i]?.j??null)]),[],
    ['Round trip','Month','Rate (bbl/day)','Observed surface (psia)','Reproduced surface (psia)','Residual (psi)','Chosen','Reason'],
    ...sealed.roundTrip.map(r=>[r.key,r.month,r.rateStbd,r.observedSurfacePsia,r.reproducedSurfacePsia,r.residualPsi,r.chosen?'yes':'no',r.reason])];
  return lines.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
const escXml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
export function estimateSvg(sealed:SealedEstimate,est:Estimate):string{
  const a=jEstimateSvg(est);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 ${a.height}" width="960" height="${a.height}"><metadata>${escXml(JSON.stringify(sealed))}</metadata><svg y="0" width="960" height="${a.height}">${a.svg}</svg></svg>`;
}
```

- [ ] **Step 5:** Compile and run `node --test tests/injectivity-export.test.mjs tests/injectivity-estimate.test.mjs`. Expected: 21 pass, 0 fail.

---

### Task 3: 1a and 1b panel hooks, the panel-gap guard and the readiness text

**Files:**
- Modify (archived in Task 0): `N/src/testRecords.ts` (line 17), `N/tests/test-records-export.test.mjs` (line 18), `N/web/h10-diagnostics.mjs`, `N/web/test-records.mjs`
- Test: `N/tests/panel-hooks.test.mjs`

**Interfaces:**
- Produces:
  - `h10Available(selection): boolean`, exported from `web/h10-diagnostics.mjs`;
  - `mountH10Diagnostics(root, {selection, gate, download, onChange})` returns `{dispose, setMarkers, range, get state}`;
  - `mountTestRecords(root, {selection, gate, download, range, onMarkers, onChange})` returns `{dispose, get state}`;
  - `onChange` defaults to `()=>{}` and is called with no arguments after every successful decision or upload.

- [ ] **Step 1: Write the failing tests** `N/tests/panel-hooks.test.mjs`:

```js
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {h10Available,createDiagnosticsSession} from '../web/h10-diagnostics.mjs';
import {createTestRecordsSession} from '../web/test-records.mjs';
import {J_READINESS,LIMITATIONS} from '../dist/testRecords.js';

const artifact=JSON.parse(await readFile('data/explorer/normalized.json','utf8')),ready={ready:true,reasons:[]};
test('the 1b readiness line now points to the estimate and keeps "calibrated" for the measured case only',()=>{
 assert.equal(J_READINESS,'Calibrated injectivity (J): not available. A test-referenced estimate is shown in the panel below; a calibrated J needs a measured flowing bottomhole pressure at a known rate, for example from step-rate test analysis, which is out of scope.');
 assert.ok(LIMITATIONS.includes(J_READINESS));
});
test('H-10 availability: a well with no monthly rows has no H-10 panel (the 1b gap)',()=>{
 assert.equal(h10Available({artifact}),true);
 const empty={artifact:{...artifact,injectionMonthly:[]}};assert.equal(h10Available(empty),false);assert.equal(h10Available(null),false);
 assert.throws(()=>createDiagnosticsSession(empty,ready),/No H-10 monthly rows/);// why the panel used to vanish
});
test('the Test records session works with no H-10 range',()=>{
 const s=createTestRecordsSession({selection:{artifact:{...artifact,injectionMonthly:[]}},gate:ready,range:null});assert.equal(s.state.range,null);
});
test('both panel modules accept and call onChange (source check: no DOM in Node)',async()=>{
 for(const f of ['web/h10-diagnostics.mjs','web/test-records.mjs']){const src=await readFile(f,'utf8');assert.match(src,/onChange=\(\)=>\{\}/);assert.match(src,/get state\(\)\{return session\.state;\}/);}
});
```

- [ ] **Step 2:** Run it. Expected: FAIL (`h10Available` is not exported; the readiness text differs).

- [ ] **Step 3: Edit `N/src/testRecords.ts` line 17** to the exact new `J_READINESS` from Global Constraints. **Edit `N/tests/test-records-export.test.mjs` line 18** so the expected string is the new text. Change nothing else in either file.

- [ ] **Step 4: Edit `N/web/h10-diagnostics.mjs`:**
  1. After the `FORMATS` line, add:
```js
/** False when the selection has no H-10 monthly rows; diagnoseMonthly would throw, so no 1a panel is mounted. */
export const h10Available=selection=>Array.isArray(selection?.artifact?.injectionMonthly)&&selection.artifact.injectionMonthly.length>0;
```
  2. `export function mountH10Diagnostics(root,{selection,gate,download}){` → `export function mountH10Diagnostics(root,{selection,gate,download,onChange=()=>{}}){`
  3. In `box.onchange`, after `session.decide(m.month,box.checked,reason.value);`, insert `onChange();`. In `reason.onchange`, after `session.decide(m.month,false,reason.value);`, insert `onChange();`.
  4. In the final `return {…}` object, add `get state(){return session.state;},` as the first member.

- [ ] **Step 5: Edit `N/web/test-records.mjs`:**
  1. `export function mountTestRecords(root,{selection,gate,download,range,onMarkers=()=>{}}){` → `export function mountTestRecords(root,{selection,gate,download,range,onMarkers=()=>{},onChange=()=>{}}){`
  2. In `controls` → `box.onchange`, after `session.decide(r.key,box.checked,reason.value);`, insert `onChange();`. In `reason.onchange`, after `session.decide(r.key,false,reason.value);`, insert `onChange();`.
  3. In `input.onchange`, after `if(!r)return;`, insert `onChange();`.
  4. Change the final return to `return {get state(){return session.state;},dispose(){try{onMarkers([]);}catch{}session.dispose();root.replaceChildren();}};`

- [ ] **Step 6:** Compile. Run `node --check web/h10-diagnostics.mjs; node --check web/test-records.mjs; node --test tests/panel-hooks.test.mjs tests/test-records*.test.mjs tests/h10-diagnostics*.test.mjs`. Expected: all pass, and the existing 1a and 1b tests are unchanged except for the one updated string. CR bytes stay 0.

---

### Task 4: Injectivity session and panel (`web/injectivity.mjs`)

**Files:**
- Create: `N/web/injectivity.mjs`
- Test: `N/tests/injectivity-session.test.mjs`

**Interfaces:**
- Consumes: everything Task 1 and Task 2 produce; `ORIGIN_LABELS` is not needed.
- Produces:
  - `createInjectivitySession({selection, gate, h10, tests})`, returning:
    - getters `state`, `estimate`, `revision`, `gate`, `uic`;
    - methods `update({h10, tests})`, `confirmBasis(value, reason)`, `setAssumptions(partial)`, `move(key, shift, reason)`, `choose(key, reason)`, `dispose()`, `isCurrent(r)`;
    - `exportRequest(format)`, resolving to `{filename, mime, text}` or `null`;
    - `handoffRequest()`, resolving to a `Handoff` or `null`.
  - `mountInjectivity(root, {selection, gate, download, h10, tests, onHandoff})`, returning `{dispose, update({h10, tests})}`.

- [ ] **Step 1: Write the failing tests** `N/tests/injectivity-session.test.mjs`:

```js
import test from 'node:test';import assert from 'node:assert/strict';
import {createInjectivitySession} from '../web/injectivity.mjs';
import {verifyEstimateSealed} from '../dist/injectivityEstimateExport.js';
import {applyTestDecision} from '../dist/testRecords.js';
import {fixtureInputs} from './helpers/injectivity-fixture.mjs';

const ready={ready:true,reasons:[]},blocked={ready:false,reasons:['Inspection only: test.']};
const selection={artifact:{artifactId:'synthetic',inventory:[{uic_number:'000000417',permit_liquid_pressure_limit_psi:1176,permit_liquid_volume_limit_bpd:30000}],injectionMonthly:[{uic_number:'000000417'}]},pin:null,tests:{sha256:{'tests.json':'ab'}}};
const make=(gate=ready,inputs=fixtureInputs())=>createInjectivitySession({selection,gate,...inputs});

test('starts at revision 0 awaiting the basis; each change bumps the revision; a rejected change does not',()=>{
 const s=make();assert.equal(s.revision,0);assert.equal(s.uic,'000000417');assert.match(s.estimate.readiness,/Confirm the pressure basis/);
 assert.throws(()=>s.confirmBasis('psig',''),/reason/);assert.equal(s.revision,0);
 s.confirmBasis('psig','RRC guidance');assert.equal(s.revision,1);s.setAssumptions({salinityWtPercent:12});assert.equal(s.revision,2);
 s.move('package:bhp:4',-1,'month end');assert.equal(s.revision,3);s.choose('package:bhp:1','planning period');assert.equal(s.revision,4);
});
test('a 1a or 1b change arrives through update and recomputes',()=>{
 const s=make();s.confirmBasis('psig','x');const next=fixtureInputs();next.tests=applyTestDecision(next.tests,'package:bhp:2',false,'operator note');
 s.update(next);assert.equal(s.revision,2);assert.deepEqual(s.estimate.qualifying,['package:bhp:1']);
});
test('no H-10 rows: every test is unmatched with the reason',()=>{
 const s=createInjectivitySession({selection,gate:ready,h10:null,tests:fixtureInputs().tests});s.confirmBasis('psig','x');
 assert.ok(s.estimate.tests.filter(t=>t.status==='unmatched').every(t=>t.reason==='No H-10 months to match.'));
});
test('export: sealed JSON verifies; filename carries the UIC and hash; a stale export resolves null',async()=>{
 const s=make();s.confirmBasis('psig','x');const r=await s.exportRequest('json');
 assert.match(r.filename,/^test-referenced-j-000000417-[a-f0-9]{12}\.json$/);assert.equal(await verifyEstimateSealed(JSON.parse(r.text)),true);
 const p=s.exportRequest('csv');s.setAssumptions({salinityWtPercent:11});assert.equal(await p,null);
 const d=s.exportRequest('svg');s.dispose();assert.equal(await d,null);
});
test('gate not ready blocks exports and the hand-off',async()=>{
 const s=make(blocked);s.confirmBasis('psig','x');
 await assert.rejects(s.exportRequest('json'),/Exports blocked: Inspection only/);await assert.rejects(s.handoffRequest(),/Hand-off blocked: Inspection only/);
});
test('hand-off carries permit values, the estimate hash and the bottomhole limit unset; stale resolves null',async()=>{
 const s=make();s.confirmBasis('psig','x');const h=await s.handoffRequest();
 assert.equal(h.values.limitPsia,null);assert.ok(Math.abs(h.values.surfaceLimitPsia-1190.7)<1e-9);assert.equal(h.values.operatingCeilingStbd,30000);assert.match(h.origins.injectivityStbdPerPsi,/sealed estimate [a-f0-9]{12}$/);
 const p=s.handoffRequest();s.choose('package:bhp:1','x');assert.equal(await p,null);
});
test('unknown export format is refused',async()=>{await assert.rejects(make().exportRequest('pdf'),/Unsupported export format: pdf/);});
```

- [ ] **Step 2:** Run it. Expected: FAIL (the module is missing).

- [ ] **Step 3: Write `N/web/injectivity.mjs`:**

```js
import {createEstimateState,withInputs,confirmBasis,setAssumptions,moveMatch,chooseJ,estimate,handoff,LABEL_J,BASIS_STATEMENT,DEFAULT_ASSUMPTIONS,TUBING_SENSITIVITY_IN} from '../dist/injectivityEstimate.js';
import {jEstimateSvg} from '../dist/injectivityEstimateChart.js';
import {sealEstimate,estimateJson,estimateCsv,estimateSvg} from '../dist/injectivityEstimateExport.js';

const FORMATS={json:['application/json',s=>estimateJson(s)],csv:['text/csv;charset=utf-8',s=>estimateCsv(s)],svg:['image/svg+xml',(s,est)=>estimateSvg(s,est)]};
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;

/** DOM-free session: basis, assumptions, moved matches and the chosen J over the live 1a/1b states; revision counter and stale refusal. */
export function createInjectivitySession({selection,gate,h10,tests}){
 const artifact=selection.artifact,inv=artifact.inventory?.[0]??{},uic=String(artifact.injectionMonthly?.[0]?.uic_number??inv.uic_number??'');
 const permit={surfacePsi:num(inv.permit_liquid_pressure_limit_psi),volumeBpd:num(inv.permit_liquid_volume_limit_bpd)};
 const source={uic,artifactId:String(artifact.artifactId),normalizedSha256:selection.pin?.normalizedSha256??null,manifestSha256:selection.pin?.manifestSha256??null,tests:{packageFiles:{...(selection.tests?.sha256??{})},uploads:[]}};
 let state=createEstimateState({h10,tests}),revision=0,alive=true;
 const change=next=>{state=next;revision++;};
 const session={
  get state(){return state;},get estimate(){return estimate(state);},get revision(){return revision;},gate,uic,
  update(inputs){change(withInputs(state,inputs));},
  confirmBasis(value,reason){change(confirmBasis(state,value,reason));},
  setAssumptions(partial){change(setAssumptions(state,partial));},
  move(key,shift,reason){change(moveMatch(state,key,shift,reason));},
  choose(key,reason){change(chooseJ(state,key,reason));},
  dispose(){alive=false;revision++;},
  isCurrent(r){return alive&&r===revision;},
  async exportRequest(format){
   const kind=FORMATS[format];if(!kind)throw new Error('Unsupported export format: '+format);
   if(!gate.ready)throw new Error('Exports blocked: '+gate.reasons.join(' '));
   const r=revision,est=estimate(state);if(!session.isCurrent(r))return null;
   const sealed=await sealEstimate(est,source);if(!session.isCurrent(r))return null;
   return {filename:`test-referenced-j-${uic||'well'}-${sealed.contentSha256.slice(0,12)}.${format}`,mime:kind[0],text:kind[1](sealed,est)};
  },
  async handoffRequest(){
   if(!gate.ready)throw new Error('Hand-off blocked: '+gate.reasons.join(' '));
   const r=revision,snapshot=state,est=estimate(snapshot);const sealed=await sealEstimate(est,source);if(!session.isCurrent(r))return null;
   return handoff(snapshot,est,permit,sealed.contentSha256);
  }};
 return session;
}

const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const fmt=v=>v===null||v===undefined?'—':typeof v==='number'?Number(v.toPrecision(5)).toLocaleString('en-US'):String(v);
function svgNode(svg){const doc=new DOMParser().parseFromString(svg,'image/svg+xml');if(doc.getElementsByTagName('parsererror').length||doc.documentElement.localName!=='svg')throw new Error('Generated J chart could not be parsed.');return document.importNode(doc.documentElement,true);}
const ASSUMPTION_FIELDS=[['innerDiameterInches','Tubing inner diameter (in)'],['roughnessInches','Absolute roughness (in)'],['surfaceTemperatureF','Surface temperature (°F)'],['bottomholeTemperatureF','Bottomhole temperature (°F)'],['salinityWtPercent','NaCl salinity (wt%)'],['segments','Traverse segments']];

/** Panel inside Injector history, below Test records. import-ui disposes it whenever results are cleared. */
export function mountInjectivity(root,{selection,gate,download,h10,tests,onHandoff}){
 const session=createInjectivitySession({selection,gate,h10,tests}),section=el('section',undefined,'panel');section.setAttribute('aria-labelledby','injectivity-title');
 root.replaceChildren(section);
 let message='',error='',disposed=false;
 const act=(fn,ok)=>{try{fn();message=ok;error='';}catch(e){error=e.message;}render();};
 function render(){
  if(disposed)return;let est;
  try{est=session.estimate;}catch(e){section.replaceChildren(el('h2',LABEL_J),el('p','The estimate is blocked: '+e.message));return;}
  section.replaceChildren();
  const h=el('h2',LABEL_J);h.id='injectivity-title';section.append(h,el('p',est.readiness),el('p',BASIS_STATEMENT));
  const status=el('p',error||message);status.setAttribute('role','status');section.append(status);
  // 1. basis
  const basis=el('fieldset');basis.append(el('legend','Pressure basis of the BHP field (required before any J)'));
  const radios={};for(const [v,label] of [['psig','psig (RRC Permian guidance, default)'],['psia','psia (as the source field is named)']]){const l=el('label'),r=el('input');r.type='radio';r.name='j-basis';r.value=v;r.checked=(session.state.basis?.value??'psig')===v;radios[v]=r;l.append(r,document.createTextNode(' '+label));basis.append(l);}
  const why=el('input');why.type='text';why.maxLength=200;why.value=session.state.basis?.reason??'';why.placeholder='reason (required)';why.setAttribute('aria-label','Reason for the basis');
  const confirm=el('button',session.state.basis?'Change basis':'Confirm basis');confirm.type='button';confirm.onclick=()=>act(()=>session.confirmBasis(radios.psia.checked?'psia':'psig',why.value),'Basis confirmed.');
  basis.append(why,confirm);section.append(basis);
  // 2. assumptions
  const form=el('fieldset');form.append(el('legend','Declared assumptions (not public records)'));
  for(const [key,label] of ASSUMPTION_FIELDS){const l=el('label',label+' — declared assumption '),i=el('input');i.type='number';i.step='any';i.value=String(session.state.assumptions[key]);i.setAttribute('aria-label',label);
   i.onchange=()=>act(()=>session.setAssumptions({[key]:Number(i.value)}),`${label} updated.`);l.append(i);form.append(l);}
  form.append(el('p',`Defaults: ${Object.entries(DEFAULT_ASSUMPTIONS).map(([k,v])=>`${k} ${v}`).join(', ')}. MD = TVD = test depth (vertical well declared). Tubing sensitivity always runs ${TUBING_SENSITIVITY_IN.join(', ')} in.`));
  section.append(form);
  // 3. match table
  const wrap=el('div',undefined,'table-scroll');wrap.setAttribute('role','region');wrap.setAttribute('aria-label','BHP test matches');wrap.tabIndex=0;
  const table=el('table'),head=el('tr');for(const t of ['Test date','Depth (ft)','Matched month','Move','Rate (bbl/day)','Surface (psi)','P_res (psia)','P_wf (psia)','Δp (psi)','J','J no-friction','J other basis','J by tubing','Status','Use this J'])head.append(el('th',t));
  table.append(el('thead'));table.tHead.append(head);const tb=el('tbody');
  for(const t of est.tests){const tr=el('tr');
   for(const v of [t.date,t.depthFt,t.month])tr.append(el('td',fmt(v)));
   const mv=el('td');if(t.month){const sel=el('select');sel.setAttribute('aria-label',`Move the match for ${t.date}`);for(const [v,l] of [['-1','previous month'],['0','containing month'],['1','next month']]){const o=el('option',l);o.value=v;o.selected=Number(v)===t.shift;sel.append(o);}
    const mr=el('input');mr.type='text';mr.maxLength=200;mr.value=t.shiftReason??'';mr.placeholder='reason to move';mr.setAttribute('aria-label',`Reason to move the match for ${t.date}`);
    sel.onchange=()=>act(()=>session.move(t.key,Number(sel.value),mr.value),`Match for ${t.date} moved.`);mv.append(sel,mr);}tr.append(mv);
   for(const v of [t.rateStbd,t.surfacePsi,t.pResPsia,t.pWfPsia,t.deltaPsi,t.j,t.jNoFriction,t.jAlternateBasis])tr.append(el('td',fmt(v)));
   tr.append(el('td',t.jByTubing.length?t.jByTubing.map(x=>`${x.innerDiameterInches} in: ${x.j===null?x.reason:fmt(x.j)}`).join('; '):'—'));
   tr.append(el('td',t.status==='qualifies'?'qualifies':`${t.status}: ${t.reason}`));
   const use=el('td');if(t.status==='qualifies'){const r=el('input');r.type='radio';r.name='j-choice';r.checked=t.key===est.chosenKey;r.setAttribute('aria-label',`Use the J from ${t.date}`);
    const cr=el('input');cr.type='text';cr.maxLength=200;cr.placeholder='reason';cr.setAttribute('aria-label',`Reason to use the J from ${t.date}`);
    r.onchange=()=>act(()=>session.choose(t.key,cr.value),`J from ${t.date} chosen.`);use.append(r,cr);}tr.append(use);tb.append(tr);}
  table.append(tb);wrap.append(table);section.append(wrap);
  if(est.choiceDropped)section.append(el('p','Your chosen test no longer qualifies; the latest qualifying test is used.'));
  if(est.chosenKey)section.append(el('p',`Chosen: ${est.chosenKey} (${est.choiceBy==='user'?'your choice: '+est.choiceReason:'latest qualifying test, default'}).${est.range?` J range across matched tests: ${fmt(est.range.min)} to ${fmt(est.range.max)} STB/day/psi.`:''}${est.trend?' Trend shown: tests share depth, basis and assumptions.':''}`));
  // 4. chart and round trip
  if(gate.ready){const box=el('div',undefined,'analysis-chart-scroll');box.append(svgNode(jEstimateSvg(est).svg));section.append(box);}
  if(est.roundTrip.length){const rw=el('div',undefined,'table-scroll');rw.setAttribute('role','region');rw.setAttribute('aria-label','Round trip');rw.tabIndex=0;const rt=el('table'),rh=el('tr');
   for(const t of ['Month','Rate (bbl/day)','Observed surface (psia)','Reproduced (psia)','Residual (psi)','Chosen'])rh.append(el('th',t));rt.append(el('thead'));rt.tHead.append(rh);const rb=el('tbody');
   for(const r of est.roundTrip){const tr=el('tr');for(const v of [r.month,r.rateStbd,r.observedSurfacePsia,r.reproducedSurfacePsia,r.residualPsi===null?r.reason:r.residualPsi,r.chosen?'yes':'no'])tr.append(el('td',fmt(v)));rb.append(tr);}
   rt.append(rb);rw.append(rt);section.append(rw,el('p',est.roundTripOk?'Round trip: the scenario reproduces the chosen month within 0.5 psi.':'Round trip failed for the chosen month; exports and the hand-off are refused.'));}
  // 5. actions
  if(!gate.ready){section.append(el('p','Exports and the hand-off are blocked. '+gate.reasons.join(' ')));return;}
  const actions=el('div',undefined,'import-actions');
  for(const [format,label] of [['json','Download J estimate JSON'],['csv','Download J estimate CSV'],['svg','Download J estimate SVG']]){const b=el('button',label);b.type='button';
   b.onclick=async()=>{try{const r=await session.exportRequest(format);if(!r){status.textContent='The selection changed while preparing this export. Download again.';return;}download(r.text,r.filename,r.mime);status.textContent=`Downloaded ${r.filename}.`;}catch(e){status.textContent=e.message;}};actions.append(b);}
  const use=el('button','Use in scenario (Hydraulics)');use.type='button';use.disabled=!est.chosenKey||!est.roundTripOk;
  use.onclick=async()=>{try{const h=await session.handoffRequest();if(!h){status.textContent='The selection changed while preparing the hand-off. Try again.';return;}onHandoff(h);}catch(e){status.textContent=e.message;}};
  actions.append(use);section.append(actions);
 }
 render();
 return {dispose(){disposed=true;session.dispose();root.replaceChildren();},update(inputs){if(disposed)return;try{session.update(inputs);message='Recalculated after a review change.';error='';}catch(e){error=e.message;}render();}};
}
```

- [ ] **Step 4:** Compile. Run `node --check web/injectivity.mjs; node --test tests/injectivity-session.test.mjs`. Expected: 7 pass.

---

### Task 5: Hydraulics hand-off (`web/hydraulics.mjs`)

**Files:**
- Modify (archived in Task 0): `N/web/hydraulics.mjs`
- Test: `N/tests/hydraulics-handoff.test.mjs`

**Interfaces:**
- Consumes: the `Handoff` shape from Task 1 (`{values, origins, sweep, notes}`).
- Produces:
  - `applyHandoff(handoff)`, returning `{fields: Record<string,string>, origins: Record<string,string>, notes: string[]}`;
  - `markOverride(origins, key)`, returning new origins;
  - `calculateHydraulics(raw)`, which adds `provenance.inputOrigins` only when `raw.inputOrigins` is given;
  - workspace API `prefill(handoff)`.

- [ ] **Step 1: Write the failing tests** `N/tests/hydraulics-handoff.test.mjs`:

```js
import test from 'node:test';import assert from 'node:assert/strict';
import {HYDRAULICS_DEFAULTS,calculateHydraulics,applyHandoff,markOverride} from '../web/hydraulics.mjs';

const h={values:{model:'segmented-brine',caseName:'Test-referenced J (estimate)',datum:'Top of completed interval at 3310 ft TVD (RRC guidance), from BHP test 2024-07-22',injectivityStbdPerPsi:15.05,reservoirPsia:1745.7,referencePressurePsia:1745.7,tvdFt:3310,measuredDepthFt:3310,
 innerDiameterInches:3.958,roughnessInches:0.0006,temperatureF:100,surfaceTemperatureF:70,salinityWtPercent:10,segments:32,rateStbd:10000,curveMaximumStbd:15000,surfaceLimitPsia:1190.7,operatingCeilingStbd:30000,limitPsia:null},
 origins:{injectivityStbdPerPsi:'Test-referenced J (estimate) from BHP test 2024-07-22 and H-10 2024-07; sealed estimate abcdefabcdef',limitPsia:'Not set from evidence; declare it.'},sweep:{min:14.9,max:15.1},notes:['J range for sweeps: 14.90 to 15.10 STB/day/psi (enter it in Parameter sweeps).']};

test('applyHandoff maps every value to a form string and leaves null fields empty',()=>{
 const r=applyHandoff(h);assert.equal(r.fields.limitPsia,'');assert.equal(r.fields.injectivityStbdPerPsi,'15.05');assert.equal(r.fields.model,'segmented-brine');assert.equal(r.fields.datum,h.values.datum);
 assert.deepEqual(r.origins,h.origins);assert.deepEqual(r.notes,h.notes);
 assert.throws(()=>applyHandoff({values:{notAField:1},origins:{},notes:[]}),/Unknown hand-off field: notAField/);
});
test('markOverride labels an edited prefilled field once',()=>{
 const o=markOverride(h.origins,'injectivityStbdPerPsi');assert.match(o.injectivityStbdPerPsi,/^User override \(was: Test-referenced J/);
 assert.equal(markOverride(o,'injectivityStbdPerPsi').injectivityStbdPerPsi,o.injectivityStbdPerPsi);assert.deepEqual(markOverride(h.origins,'tvdFt'),h.origins);
});
test('calculateHydraulics carries inputOrigins only when supplied; existing output unchanged otherwise',()=>{
 const base=calculateHydraulics({...HYDRAULICS_DEFAULTS,curvePoints:5});assert.equal('inputOrigins' in base.provenance,false);
 const withO=calculateHydraulics({...HYDRAULICS_DEFAULTS,curvePoints:5,inputOrigins:{injectivityStbdPerPsi:'x'}});assert.deepEqual(withO.provenance.inputOrigins,{injectivityStbdPerPsi:'x'});
 assert.deepEqual({...withO,provenance:{...withO.provenance,inputOrigins:undefined}},{...base,provenance:{...base.provenance,inputOrigins:undefined}});
 assert.throws(()=>calculateHydraulics({...HYDRAULICS_DEFAULTS,inputOrigins:{bogus:'x'}}),/input origin/);
 assert.throws(()=>calculateHydraulics({...HYDRAULICS_DEFAULTS,inputOrigins:{tvdFt:'x'.repeat(401)}}),/input origin/);
});
test('a prefilled case with the bottomhole limit still empty cannot calculate until it is declared',()=>{
 const fields=applyHandoff(h).fields;const raw=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,['caseName','datum','model'].includes(k)?v:v===''?NaN:Number(v)]));
 assert.throws(()=>calculateHydraulics({...HYDRAULICS_DEFAULTS,...raw,curvePoints:5}),/Bottomhole pressure limit/);
 const r=calculateHydraulics({...HYDRAULICS_DEFAULTS,...raw,limitPsia:4000,curvePoints:5});assert.equal(r.inputs.tvdFt,3310);
});
```

- [ ] **Step 2:** Run it. Expected: FAIL (`applyHandoff` is not exported).

- [ ] **Step 3: Edit `N/web/hydraulics.mjs`:**
  1. After the `numericFields` array (and after `fieldByKey` if it is defined there), add:
```js
const HANDOFF_FIELDS=new Set([...numericFields.map(([key])=>key),'caseName','datum','model']);
/** Test-referenced J hand-off → form strings. Null leaves a field empty so the user must declare it. */
export function applyHandoff(handoff){
  const fields={};
  for(const [key,value] of Object.entries(handoff?.values??{})){if(!HANDOFF_FIELDS.has(key))throw Error(`Unknown hand-off field: ${key}`);fields[key]=value===null||value===undefined?'':String(value);}
  return {fields,origins:{...(handoff?.origins??{})},notes:[...(handoff?.notes??[])]};
}
export function markOverride(origins,key){
  if(!(key in origins)||origins[key].startsWith('User override'))return origins;
  return {...origins,[key]:`User override (was: ${origins[key]})`};
}
function checkOrigins(origins){
  if(!origins||typeof origins!=='object'||Array.isArray(origins))throw Error('Each input origin must be a labelled string.');
  const out={};for(const [key,value] of Object.entries(origins)){if(!HANDOFF_FIELDS.has(key)||typeof value!=='string'||!value||value.length>400)throw Error(`Invalid input origin for ${key}.`);out[key]=value;}
  return out;
}
```
  2. In `calculateHydraulics`, change `provenance:{inputs:'User-entered assumptions; initial defaults are explicitly assumed fictional values.',` to `provenance:{inputs:'User-entered assumptions; initial defaults are explicitly assumed fictional values.',...(raw?.inputOrigins!==undefined?{inputOrigins:checkOrigins(raw.inputOrigins)}:{}),`.
  3. In `mountHydraulicsWorkspace`:
     - after `let current=null,revision=0,…;`, add `let origins=null,prefilled=null;`;
     - in `snapshot()`, before `return values;`, add `if(origins)values.inputOrigins={...origins};`;
     - add a function after `snapshot`:
```js
  function renderOrigins(notes=[]){
    let box=$('hyd-origins');if(!origins){box?.remove();return;}
    if(!box){box=doc.createElement('div');box.id='hyd-origins';box.className='hyd-origins';box.setAttribute('role','region');box.setAttribute('aria-label','Where the prefilled values came from');form.prepend(box);}
    box.replaceChildren();const h=doc.createElement('h3');h.textContent='Prefilled from the test-referenced J estimate';box.append(h);
    const ul=doc.createElement('ul');for(const [key,text] of Object.entries(origins)){const li=doc.createElement('li');li.textContent=`${fieldByKey.get(key)?.[1]??key}: ${text}`;ul.append(li);}box.append(ul);
    for(const note of notes){const p=doc.createElement('p');p.textContent=note;box.append(p);}
  }
```
     - change `form.addEventListener('input',()=>{modelControls();invalidate();});` to `form.addEventListener('input',event=>{const key=event.target?.name;if(origins&&prefilled&&key in prefilled&&event.target.value!==prefilled[key]){origins=markOverride(origins,key);renderOrigins();}modelControls();invalidate();});`;
     - in the `$('hyd-reset')` handler, before `modelControls();`, add `origins=null;prefilled=null;renderOrigins();`;
     - add `prefill` to `api`:
```js
prefill(handoff){const r=applyHandoff(handoff);for(const [key,value] of Object.entries(r.fields)){const input=form.elements.namedItem(key);if(input)input.value=value;}
  origins=r.origins;prefilled={...r.fields};modelControls();renderOrigins(r.notes);invalidate('Prefilled from the test-referenced J estimate. Declare the bottomhole limit, review every value and calculate.');switchTab('hydraulics');},
```
  If `fieldByKey` is not defined at module level, define it next to `numericFields` as `const fieldByKey=new Map(numericFields.map(f=>[f[0],f]));`. First check whether it already exists; the existing `validateHydraulicsInputs` uses it.

- [ ] **Step 4:** Compile. Run `node --check web/hydraulics.mjs; node --test tests/hydraulics-handoff.test.mjs tests/hydraulics-workspace.test.mjs`. Expected: 4 new tests pass, and every existing hydraulics test passes unchanged.

---

### Task 6: Wire into Injector history, record the layer, verify in the browser

**Files:**
- Modify (archived in Task 0): `N/web/import-ui.mjs`
- Create: `demo/TEST-REFERENCED-J-VERIFICATION.md`, `demo/test-referenced-j-evidence/` (screenshots, driver, results; synthetic packages go only to the session scratchpad)

**Interfaces:**
- Consumes: `h10Available`, the panel `state` getters and `onChange` (Task 3); `mountInjectivity` (Task 4); `hydraulicsWorkspace.prefill` (Task 5).

- [ ] **Step 1: Edit `N/web/import-ui.mjs`.** The CR count is `4` before the edit and must still be `4` afterwards, on the file's last four lines. Count with node.
  1. Change `import {mountH10Diagnostics} from './h10-diagnostics.mjs';` to `import {mountH10Diagnostics,h10Available} from './h10-diagnostics.mjs';`, and after the `mountTestRecords` import add `import {mountInjectivity} from './injectivity.mjs';`
  2. Change `let h10Panel=null,testsPanel=null;` to `let h10Panel=null,testsPanel=null,jPanel=null;`
  3. Change `function clearResults(){testsPanel?.dispose();` to `function clearResults(){jPanel?.dispose();jPanel=null;testsPanel?.dispose();`
  4. Replace the whole `function mountH10(){…}` line with:
```js
function mountH10(){const p=selectedPublic();if(!p?.artifact)return;const gate=publicCalculationGate(),refreshJ=()=>jPanel?.update({h10:h10Panel?.state??null,tests:testsPanel.state});if(h10Available(p)){const box=el('div');box.id='h10-diagnostics';$('import-results').append(box);h10Panel=mountH10Diagnostics(box,{selection:p,gate,download,onChange:refreshJ});}else $('import-results').append(el('p','No H-10 monthly rows for this well; H-10 diagnostics and timeline markers are not available.'));const tests=el('div');tests.id='test-records';$('import-results').append(tests);testsPanel=mountTestRecords(tests,{selection:p,gate,download,range:h10Panel?.range??null,onMarkers:markers=>h10Panel?.setMarkers(markers),onChange:refreshJ});const j=el('div');j.id='injectivity-estimate';$('import-results').append(j);jPanel=mountInjectivity(j,{selection:p,gate,download,h10:h10Panel?.state??null,tests:testsPanel.state,onHandoff:payload=>{const ws=document.getElementById('hydraulics-workspace')?.hydraulicsWorkspace;if(!ws)throw new Error('The Hydraulics workspace is not available.');ws.prefill(payload);navigate('hydraulics');}});}
```
  5. Confirm that `navigate('hydraulics')` exists with that signature (`function navigate(next,{record=true,focus=true}={})`) and shows the Hydraulics workspace. If it does not, stop and report.

- [ ] **Step 2: Checks.**
  - CR counts: `import-ui.mjs` is `4`, on its last four lines; every other changed or new file is `0`.
  - `node --check` on `web/import-ui.mjs`, `web/injectivity.mjs`, `web/hydraulics.mjs`, `web/h10-diagnostics.mjs` and `web/test-records.mjs`.
  - From `N/`: compile; `node --test tests/*.test.mjs` should give 523 + 15 + 6 + 4 + 7 + 4 = 559 passes and 0 failures (record the actual count); `node scripts/check-carried-oracles.mjs` should give 248 comparisons and 0 failures.
  - From the repo root: `node scripts/prepare-swd.mjs`.

- [ ] **Step 3: Record pending and run the root gates.** From the repo root:
  - `node scripts/record-layer.mjs phase-1c-test-referenced-j` → `pending-review`
  - `node scripts/verify-preservation.mjs .` → exactly one violation, the pending layer
  - the root tests → only the transfer live-root test fails, on that pending violation.

  If anything else fails, stop and diagnose (superpowers:systematic-debugging).

- [ ] **Step 4: Browser check with a synthetic package** (headless Chrome over CDP, modelled on `demo/test-records-evidence/`):
  - Write a v4 package to the scratchpad with `buildV4Package` (from `tests/helpers/explorer-v4.mjs`), with BHP rows at 3310 ft dated inside its H-10 range. Serve `N/` with `PORT=4290 node scripts/serve.mjs`.
  - Run each step at 1280 px and at 390 px:
    1. Import and adopt the package. The J panel appears below Test records and says "Confirm the pressure basis…".
    2. Confirm psig with a reason. J values appear, the chart shows one point per qualifying test, and the round trip passes.
    3. Exclude a matched month in 1a. The J panel recomputes, and that test is shown as unmatched with "excluded in the H-10 review".
    4. Choose an earlier test with a reason, then exclude it in 1b. The panel says the latest qualifying test is used.
    5. Download JSON, CSV and SVG. The JSON verifies.
    6. Press "Use in scenario". The Hydraulics workspace opens prefilled, with the origins list, the bottomhole limit empty, and calculation blocked until it is declared. Declare 4000, calculate, and export JSON: `provenance.inputOrigins` is present. Edit J: the origin line shows "User override".
    7. **Panel gap:** a v4 package with the same tests but an empty `sources/candidate-monthly.json`, re-derived with the helper's `refreshEvidence` and `derive`. Both the Test records panel and the J panel render, the J panel shows "No H-10 months to match.", and there is no console error. If the receiver refuses that package, record the refusal message, then test the gap through a page script that calls `mountTestRecords` and `mountInjectivity` with `range:null` and `h10:null`.
    8. At 390 px there is no page-level horizontal scroll.
- [ ] **Step 5: Real artifacts (read-only).**
  - Read the Explorer repository only with `git -C C:/Users/thai.phi/Downloads/python/portfolio/texas-rrc-explorer archive <commit> <artifact path>` into the scratchpad. Use the Barbaro 23 v4 artifact (`…uic000125182-d04894d1…`) and the TRIPPET v5 artifact (`…uic000109605-b7628a71…`).
  - Two-window or manual import on the local server.
  - For Barbaro, record only: matched and unmatched counts with the unmatched reasons, round-trip pass or fail, that the hand-off prefilled the Hydraulics workspace, and screenshots with J values cropped or blurred. Record no per-test values.
  - For TRIPPET, record the "No BHP test records for this well; no test-referenced J." state.
  - Copy nothing into this repository.
- [ ] **Step 6: Write `demo/TEST-REFERENCED-J-VERIFICATION.md`.** It records: the commands and counts, the CR counts, RED → GREEN for each task, the browser results with screenshots, the real-artifact results, the rulings R1–R6 and any rulings made during execution.
- [ ] **Step 7: Independent review.** Dispatch a read-only Claude Opus reviewer with a seven-field brief (`handover/context/agent-workflow.md`). It covers the Review Focus list, the spec rule by rule, the `import-ui.mjs` and `hydraulics.mjs` diffs, and a check that no produced text says "calibrated" except the 1b `J_READINESS`.
- [ ] **Step 8:** Fix any confirmed Critical or Important findings with RED → GREEN tests. Then re-record the pending layer and re-run Step 3.
- [ ] **Step 9: Owner acceptance.** The owner runs `! cd C:/Users/thai.phi/Downloads/python/portfolio/swd-injection-analytics/tmp/lovable-transfer/well-injection-insights && node scripts/record-layer.mjs phase-1c-test-referenced-j accept "Thai Phi" && node scripts/verify-preservation.mjs .`. Expected: 0 violations.
- [ ] **Step 10: Main commits** on `feature/phase-1c-test-referenced-j` and runs the fresh-clone check. It pushes or merges only when the owner says to.
