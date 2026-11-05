# Phase 2a: WHP/BHP reconciliation and pressure-margin screening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one shared "Well assumptions" block and a "WHP/BHP reconciliation (screening)" panel to Injector history.
- For each reviewed H-10 month, the panel models the flowing bottomhole pressure from the reported surface pressure through the existing traverse.
- It screens three margins: regulatory, permit-equivalent and declared, with the formation margin "not evaluated".
- In months that contain a BHP test, it shows the flowing-minus-static differential and flags a negative one.
- The 1c J estimate is moved onto the shared, user-confirmed H-10 and permit basis.

**Architecture:**
- **New pure module** `src/wellAssumptions.ts` owns:
  - the declared assumptions;
  - the surface-pressure basis confirmation;
  - `toAbsolute`, the only place 14.7 psi is added;
  - `flowingAt`, the 1c traverse helper moved here unchanged.
- **1c J estimate.** `src/injectivityEstimate.ts` reads the confirmed surface basis and moves to method `test-referenced-j/2`. A golden file captured from main 5bc1690 pins that its numbers are unchanged.
- **Three new pure modules** compute the reconciliation, its SVG and its sealed export.
- **Two DOM-free web sessions and panels** (`web/well-assumptions.mjs`, `web/reconciliation.mjs`) are wired by `web/import-ui.mjs` in the order H-10 → Test records → Well assumptions → J → Reconciliation.
- **Unchanged:** `src/disposalCase.ts`, `src/wellboreTraverse.ts` and `web/hydraulics.mjs`.
- **Preservation:** registry layer `phase-2a-pressure-reconciliation`.

**Tech Stack:** TypeScript 5.9 (`tsc` → `dist/`), Node `node:test`, plain ES modules in the browser, hand-built SVG.

**Spec:** `docs/superpowers/specs/2026-11-05-pressure-reconciliation-design.md` (owner-approved 2026-11-05; the 10 ft tolerance correction is in this commit). Executors read the spec and this plan.

## Global Constraints

- **Paths.**
  - The repo root is `C:\Users\thai.phi\Downloads\python\portfolio\swd-injection-analytics\tmp\lovable-transfer\well-injection-insights`.
  - The app is `swd-injection-analytics/` (written `N/`). Product paths in tasks are relative to `N/`.
- **Build and test commands.**
  - Build from `N/` with `node ../node_modules/typescript/bin/tsc -p tsconfig.json`. Tests import compiled code from `../dist/*.js`.
  - Run tests from `N/` with `node --test tests/<file>`, and the full suite with `node --test tests/*.test.mjs`.
  - Use direct `node` paths only: no npm, npx, vitest or bare python.
- **Protected files.**
  - Main archives the protected files in Task 0 **before any edit**.
  - `N/web/import-ui.mjs` has CRLF on its last four lines (336–339) and LF elsewhere. Count its CR bytes with node before and after every edit: the count must stay `4`, all on the last four lines.
  - Every other changed or new file has 0 CR bytes.
- **Files that must not change:**
  - `src/disposalCase.ts`, `src/wellboreTraverse.ts`, `src/disposalSensitivity.ts`;
  - `src/h10Diagnostics.ts`, `src/testRecords.ts`, `src/injectivityEstimateChart.ts`;
  - `web/hydraulics.mjs`, `web/h10-diagnostics.mjs`, `web/test-records.mjs`;
  - `web/navigation.mjs`, `web/index.html` (no new navigation tab);
  - the carried oracles.
- **Fixed strings, verbatim:**
  - the panel title `WHP/BHP reconciliation (screening)`;
  - the screening text `Screening only: not a regulatory approval, compliance finding or safe-operating determination.`;
  - the differential label `flowing minus static differential, not a model error`;
  - the permit-equivalent label `restates the permit limit at depth; not an independent constraint`;
  - the formation text `Not evaluated in this phase`;
  - the surface-basis prompt `Confirm the H-10 and permit pressure basis in Well assumptions.`;
  - the word "calibrated" never appears in any text produced by the new modules, case-insensitively.
- **Numbers:**
  - atmosphere `14.7` psi;
  - traverse floor `100` psia;
  - reason length `1–200` characters after trimming;
  - tubing sensitivity IDs `3.958, 4.892, 6.276` in;
  - test-depth tolerance `DEPTH_TOLERANCE_FT` = `10` ft (from `testRecords.ts`);
  - declared-limit datum tolerance `1` ft;
  - declared limit `100–10000` psia, depth `1–50000` ft.
- **Version strings:**
  - J: method `test-referenced-j/2`, export schema `test-referenced-j-export/2`;
  - reconciliation: method `pressure-reconciliation/1`, export schema `pressure-reconciliation-export/1`.
- **Data.** Synthetic test data uses the fictional UIC `000000417`. Tests and evidence contain no Barbaro 23 per-month or per-test values. Never copy Explorer artifacts into this repository.
- **Git.** Workers never stage, commit or push. Main commits after owner acceptance.
- **Plan and ledger.** The layer pins this plan as an approved document. Track progress in the ledger, not by ticking boxes here.

## Rulings made while planning (owner to confirm when reviewing this plan)

- **P1, J waiting state.** Without a confirmed surface basis, a matched J test gets status `awaiting-basis`, reason `Confirm the H-10 and permit pressure basis in Well assumptions.`, and `surfacePsia: null`. The spec's word "refuses" is met because no J is produced. Keeping the 1c `awaiting-basis` status leaves `statusCounts` and the panel logic unchanged, and matches still show, following 1c ruling R2.
- **P2, static limitation text.** `LIMITATIONS[3]` becomes a fixed sentence ending "…converted on the user-confirmed surface basis." The value and reason are recorded in the new `surfaceBasis` field of the estimate and export. This replaces the spec's inline "(<value>: <reason>)": a frozen limitation list cannot carry per-user text.
- **P3, hand-off limit datum.** The hand-off prefills `limitPsia` when the declared limit's depth is within 1 ft of the **chosen J test's depth**, which is the hand-off's own datum. The spec says "at the report depth". The J datum and the report depth are the same 1b reference depth whenever a J exists, to within `DEPTH_TOLERANCE_FT`.
- **P4, no `hydraulics-handoff.test.mjs` edit.** `web/hydraulics.mjs` is unchanged. The new origin string passes its `checkOrigins` (at most 400 characters) and is pinned in Task 1 through `applyHandoff`. So the accepted Hydraulics test file is not touched, even though the spec listed it.
- **P5, injected traverse.** `reconcile(inputs, deps)` takes an optional `deps.flowingAt`. A test uses it to inject a numerical `TraverseError`, because none is reachable through validated inputs. This is the 1c I-3 lesson, solved without a getter trick.
- **P6, the golden file.** Main captures `tests/fixtures/test-referenced-j-v1-golden.json` from main 5bc1690 in Task 0. The file is synthetic (UIC 000000417) and is the J-equivalence oracle.

## Review Focus

1. **The surface basis is changed after the J panel and the reconciliation are shown.** Both must recompute, J values must shift by the basis, and older exports and hand-offs must be refused. Pinned by Task 4 (J session `update` with `well`) and Task 5 (reconciliation `update` bumps the revision; a stale export resolves `null`).
2. **A real well with months whose average pressure is zero or below 85.3 psig, as TRIPPET has.** Each must get its own refusal reason, the regulatory margin must stay where computable, and nothing may be zero-filled. Pinned by Task 2 (floor, no-injection, no-max and gap tests) and seen on real data in Task 6.
3. **The J estimate fails while the reconciliation is open.** The reconciliation must still render, with no differential column, and the limit form must stay usable. Pinned by Task 5 (`j: null` and the throwing-`j` render test).
4. **A declared limit at the wrong depth.** It must block the comparison with the datum reason and must not prefill the Hydraulics limit. Pinned by Task 2 (1 ft vs 2 ft) and Task 1 (hand-off 3311 vs 3312).
5. **A well with no BHP tests and no permitted top depth.** Every month must show the no-report-depth reason, the regulatory margin must still show, and nothing may throw. Pinned by Task 2 (`reportDepth` none, and the `no report depth` row test).

---

### Task 0 (Main): layer spec, archive and the J golden file BEFORE any edit

**Files:**
- Create: `migration/layer-specs/phase-2a-pressure-reconciliation.json` (repo root).
- Archive (generated): `migration/baselines/phase-2a-pressure-reconciliation-before/swd-injection-analytics/{src/injectivityEstimate.ts,src/injectivityEstimateExport.ts,web/injectivity.mjs,web/import-ui.mjs,tests/injectivity-estimate.test.mjs,tests/injectivity-export.test.mjs,tests/injectivity-session.test.mjs,tests/panel-hooks.test.mjs}`.
- Create: `N/tests/fixtures/test-referenced-j-v1-golden.json`.

- [ ] **Step 1:** Create `migration/layer-specs/phase-2a-pressure-reconciliation.json`:

```json
{
  "purpose": "Phase 2a (PRD ANA-E04): shared well assumptions with a user-confirmed H-10 and permit pressure basis for the J estimate and a new WHP/BHP reconciliation and pressure-margin screening panel (modelled flowing BHP per reviewed H-10 month, regulatory, permit-equivalent and declared margins, formation not evaluated, test-month flowing minus static differential), with sealed exports.",
  "acceptanceEvidence": "demo/PRESSURE-RECONCILIATION-VERIFICATION.md",
  "approvedDocs": [
    "docs/superpowers/specs/2026-11-05-pressure-reconciliation-design.md",
    "docs/superpowers/plans/2026-11-05-pressure-reconciliation.md"
  ],
  "changes": ["src/injectivityEstimate.ts", "src/injectivityEstimateExport.ts", "web/injectivity.mjs", "web/import-ui.mjs",
    "tests/injectivity-estimate.test.mjs", "tests/injectivity-export.test.mjs", "tests/injectivity-session.test.mjs", "tests/panel-hooks.test.mjs"],
  "newFiles": [
    "src/wellAssumptions.ts", "src/pressureReconciliation.ts", "src/pressureReconciliationChart.ts", "src/pressureReconciliationExport.ts",
    "web/well-assumptions.mjs", "web/reconciliation.mjs",
    "tests/well-assumptions.test.mjs", "tests/pressure-reconciliation.test.mjs", "tests/pressure-reconciliation-export.test.mjs", "tests/reconciliation-session.test.mjs",
    "tests/fixtures/test-referenced-j-v1-golden.json"
  ],
  "rootFiles": ["migration/layers/index.json"]
}
```

- [ ] **Step 2:** From the repo root run `node scripts/record-layer.mjs phase-2a-pressure-reconciliation archive`. Expected: `archived 8`.

- [ ] **Step 3:** Capture the golden file from the unchanged 1c code. From `N/`:
  1. Build with `node ../node_modules/typescript/bin/tsc -p tsconfig.json`.
  2. Run:

```bash
node --input-type=module -e "
import {writeFileSync,mkdirSync} from 'node:fs';
import {createEstimateState,confirmBasis,estimate,handoff} from './dist/injectivityEstimate.js';
import {sealEstimate} from './dist/injectivityEstimateExport.js';
import {fixtureInputs} from './tests/helpers/injectivity-fixture.mjs';
const s=confirmBasis(createEstimateState(fixtureInputs()),'psig','RRC Permian guidance'),e=estimate(s);
const sealed=await sealEstimate(e,{uic:'000000417',artifactId:'synthetic',normalizedSha256:null,manifestSha256:null,tests:{packageFiles:{},uploads:[]}});
const h=handoff(s,e,{surfacePsi:1176,volumeBpd:30000},sealed.contentSha256);
mkdirSync('tests/fixtures',{recursive:true});
writeFileSync('tests/fixtures/test-referenced-j-v1-golden.json',JSON.stringify({commit:'5bc1690',note:'Synthetic UIC 000000417; 1c estimate, sealed export and hand-off before Phase 2a.',sealed,handoff:h},null,2)+'\n');
console.log(sealed.schemaVersion,sealed.qualifying.length,sealed.contentSha256.slice(0,12));"
```

  Expected: `test-referenced-j-export/1 2 <sha12>`. Check the file has 0 CR bytes.

- [ ] **Step 4:** Record in the ledger: the archive count, the golden sha12 and the CR count of `web/import-ui.mjs` (expected 4).

---

### Task 1: Shared well assumptions core, and the J estimate on the confirmed surface basis

**Files:**
- Create: `src/wellAssumptions.ts`, `tests/well-assumptions.test.mjs`.
- Replace: `src/injectivityEstimate.ts` (full new content below).
- Modify: `src/injectivityEstimateExport.ts`, `tests/injectivity-estimate.test.mjs`, `tests/injectivity-export.test.mjs`.

**Interfaces:**
- **Consumes:** `traverseBrineWell` and `TraverseError` from `wellboreTraverse.ts`; `segmentedHydraulicPoint` from `disposalCase.ts`; `DiagnosticsState` and `TestState`.
- **Produces, from `wellAssumptions.ts`:**
  - constants `ATMOSPHERE_PSI`, `MIN_TRAVERSE_PSIA`, `MAX_REASON_LENGTH`, `LIMIT_DATUM_TOLERANCE_FT`, `SURFACE_BASIS_PROMPT`, `DEPTH_STATEMENT`, `DEFAULT_ASSUMPTIONS`, `DEFAULT_WELL_ASSUMPTIONS`;
  - types `Basis`, `BasisConfirmation`, `Assumptions`, `WellAssumptions`, `DeclaredLimit`, `Flowing`;
  - functions `reasonText`, `validateAssumptions`, `pickAssumptions`, `confirmBasisValue`, `confirmSurfaceBasis(w,value,reason)`, `setWellAssumptions(w,partial)`, `validateDeclaredLimit(raw)`, `toAbsolute(psi,basis)`, `otherBasis(basis)`, `unsupportedReason(msg)`, `traverseSettings(a)` and `flowingAt(depthFt,a,rateStbd,surfacePsia,idOverride?)`.
- **Produces, from `injectivityEstimate.ts`:**
  - `setSurfaceBasis(state, BasisConfirmation|null)`;
  - `EstimateState.surfaceBasis` and `Estimate.surfaceBasis`;
  - `REASONS.surfaceBasis`;
  - `handoff(state, est, permit, sha, declaredLimit?)`;
  - `J_ESTIMATE_VERSION='test-referenced-j/2'`;
  - re-exports of `ATMOSPHERE_PSI`, `MIN_TRAVERSE_PSIA`, `MAX_REASON_LENGTH`, `DEFAULT_ASSUMPTIONS`, `validateAssumptions`, `Assumptions` and `Basis`, so existing importers keep working.

- [ ] **Step 1: Write the failing test** `tests/well-assumptions.test.mjs`:

```js
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULT_ASSUMPTIONS,DEFAULT_WELL_ASSUMPTIONS,toAbsolute,otherBasis,confirmSurfaceBasis,setWellAssumptions,validateDeclaredLimit,validateAssumptions,flowingAt,
 SURFACE_BASIS_PROMPT,LIMIT_DATUM_TOLERANCE_FT,ATMOSPHERE_PSI} from '../dist/wellAssumptions.js';
import {traverseBrineWell} from '../dist/wellboreTraverse.js';

const direct=(depth,surfacePsia,id=3.958,rate=10000)=>traverseBrineWell({well:{tvdFt:depth,measuredDepthFt:depth,innerDiameterInches:id,roughnessInches:0.0006,bottomholeTemperatureF:100},
 fluid:{referencePressurePsia:surfacePsia,temperatureF:100,salinityWtPercent:10},settings:{model:'segmented-brine',surfaceTemperatureF:70,segments:32},rateStbd:rate,boundary:{location:'surface',pressurePsia:surfacePsia}});

test('defaults are the 1c defaults and the surface basis starts unconfirmed',()=>{
 assert.deepEqual({...DEFAULT_ASSUMPTIONS},{innerDiameterInches:3.958,roughnessInches:0.0006,surfaceTemperatureF:70,bottomholeTemperatureF:100,salinityWtPercent:10,segments:32});
 assert.equal(DEFAULT_WELL_ASSUMPTIONS.surfaceBasis,null);assert.equal(SURFACE_BASIS_PROMPT,'Confirm the H-10 and permit pressure basis in Well assumptions.');assert.equal(LIMIT_DATUM_TOLERANCE_FT,1);
});
test('toAbsolute adds 14.7 psi only for psig; otherBasis flips',()=>{
 assert.equal(toAbsolute(900,'psig'),900+ATMOSPHERE_PSI);assert.equal(toAbsolute(900,'psia'),900);assert.equal(otherBasis('psig'),'psia');assert.equal(otherBasis('psia'),'psig');
});
test('surface basis confirmation needs a known value and a 1-200 character reason',()=>{
 assert.throws(()=>confirmSurfaceBasis(DEFAULT_WELL_ASSUMPTIONS,'bar','x'),/psig or psia/);
 assert.throws(()=>confirmSurfaceBasis(DEFAULT_WELL_ASSUMPTIONS,'psig',' '),/reason/);assert.throws(()=>confirmSurfaceBasis(DEFAULT_WELL_ASSUMPTIONS,'psig','x'.repeat(201)),/reason/);
 assert.deepEqual(confirmSurfaceBasis(DEFAULT_WELL_ASSUMPTIONS,'psig',' RRC reports gauge ').surfaceBasis,{value:'psig',reason:'RRC reports gauge'});
});
test('setWellAssumptions validates, never clamps, and keeps the surface basis',()=>{
 const w=confirmSurfaceBasis(DEFAULT_WELL_ASSUMPTIONS,'psig','x');
 const n=setWellAssumptions(w,{salinityWtPercent:12});assert.equal(n.salinityWtPercent,12);assert.deepEqual(n.surfaceBasis,w.surfaceBasis);
 for(const [k,v] of [['innerDiameterInches',0.1],['roughnessInches',0.2],['surfaceTemperatureF',50],['bottomholeTemperatureF',300],['salinityWtPercent',21],['segments',8.5]])
  assert.throws(()=>setWellAssumptions(w,{[k]:v}));
 assert.deepEqual(validateAssumptions({...DEFAULT_WELL_ASSUMPTIONS}),{...DEFAULT_ASSUMPTIONS});
});
test('declared limit: bounds and a reason; numbers parsed from text',()=>{
 assert.deepEqual(validateDeclaredLimit({psia:'4000',depthFt:'3310',reason:' design '}),{psia:4000,depthFt:3310,reason:'design'});
 assert.throws(()=>validateDeclaredLimit({psia:50,depthFt:3310,reason:'x'}),/Bottomhole limit/);assert.throws(()=>validateDeclaredLimit({psia:'',depthFt:3310,reason:'x'}),/Bottomhole limit/);
 assert.throws(()=>validateDeclaredLimit({psia:4000,depthFt:0,reason:'x'}),/Limit depth/);assert.throws(()=>validateDeclaredLimit({psia:4000,depthFt:3310,reason:''}),/reason/);
});
test('flowingAt equals a direct surface-boundary traverse and honours the ID override',()=>{
 const f=flowingAt(3310,DEFAULT_ASSUMPTIONS,10000,914.7),t=direct(3310,914.7);
 assert.equal(f.pwf,t.bottomholePsia);assert.equal(f.hydro,t.hydrostaticPsi);assert.equal(f.friction,t.frictionPsi);
 assert.equal(flowingAt(3310,DEFAULT_ASSUMPTIONS,10000,914.7,6.276).pwf,direct(3310,914.7,6.276).bottomholePsia);
 assert.ok(Math.abs(f.pwf-(914.7+f.hydro-f.friction))<1e-6,'P_bh = P_wh + hydro - friction');
});
test('flowingAt returns an unsupported reason for domain exits, never a clamp',()=>{
 const low=flowingAt(3310,DEFAULT_ASSUMPTIONS,10000,99.7);assert.match(low.reason,/^Unsupported by the wellbore traverse: /);
 const fast=flowingAt(3310,{...DEFAULT_ASSUMPTIONS,innerDiameterInches:2.441},10000,914.7);assert.match(fast.reason,/5 m\/s/);
});
test('flowingAt is the 1c helper moved, not rewritten: J still passes the same arguments',async()=>{
 const src=await readFile('src/injectivityEstimate.ts','utf8');assert.ok(!src.includes('function flowing('));assert.ok(src.includes("from './wellAssumptions.js'"));
});
```

- [ ] **Step 2:** Build and run `node --test tests/well-assumptions.test.mjs`. Expected: FAIL, `ERR_MODULE_NOT_FOUND` for `dist/wellAssumptions.js`.

- [ ] **Step 3:** Create `src/wellAssumptions.ts`:

```ts
import {traverseBrineWell,TraverseError,type SegmentedBrineSettings,type WellboreGeometry} from './wellboreTraverse.js';

/** Phase 2a shared well assumptions for the J estimate and the WHP/BHP reconciliation. Pure; no DOM. */
export const ATMOSPHERE_PSI=14.7;
export const MIN_TRAVERSE_PSIA=100;
export const MAX_REASON_LENGTH=200;
export const LIMIT_DATUM_TOLERANCE_FT=1;
export const SURFACE_BASIS_PROMPT='Confirm the H-10 and permit pressure basis in Well assumptions.';
export const DEPTH_STATEMENT='Vertical well declared; MD = TVD.';
export type Basis='psig'|'psia';
export type BasisConfirmation={value:Basis;reason:string};
export type Assumptions={innerDiameterInches:number;roughnessInches:number;surfaceTemperatureF:number;bottomholeTemperatureF:number;salinityWtPercent:number;segments:number};
export type WellAssumptions=Assumptions&{surfaceBasis:BasisConfirmation|null};
export type DeclaredLimit={psia:number;depthFt:number;reason:string};
export type Flowing={pwf:number;hydro:number;friction:number};
export const DEFAULT_ASSUMPTIONS:Readonly<Assumptions>=Object.freeze({innerDiameterInches:3.958,roughnessInches:0.0006,surfaceTemperatureF:70,bottomholeTemperatureF:100,salinityWtPercent:10,segments:32});
export const DEFAULT_WELL_ASSUMPTIONS:Readonly<WellAssumptions>=Object.freeze({...DEFAULT_ASSUMPTIONS,surfaceBasis:null});

export function reasonText(reason:unknown,label:string):string{const t=String(reason??'').trim();if(!t||t.length>MAX_REASON_LENGTH)throw new Error(`${label}: a reason of 1-${MAX_REASON_LENGTH} characters is required`);return t;}
function bound(v:number,min:number,max:number,label:string){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error(`${label} must be between ${min} and ${max}`);}
export function validateAssumptions(a:Assumptions):Assumptions{
  bound(a.innerDiameterInches,0.25,30,'Tubing inner diameter (in)');bound(a.roughnessInches,0,0.1,'Absolute roughness (in)');
  if(a.roughnessInches/a.innerDiameterInches>0.05)throw new Error('Relative roughness must not exceed 0.05');
  bound(a.surfaceTemperatureF,60,250,'Surface temperature (°F)');bound(a.bottomholeTemperatureF,60,250,'Bottomhole temperature (°F)');
  bound(a.salinityWtPercent,0,20,'NaCl salinity (wt%)');bound(a.segments,8,256,'Traverse segments');if(!Number.isInteger(a.segments))throw new Error('Traverse segments must be an integer');
  return pickAssumptions(a);
}
export function pickAssumptions(a:Assumptions):Assumptions{return {innerDiameterInches:a.innerDiameterInches,roughnessInches:a.roughnessInches,surfaceTemperatureF:a.surfaceTemperatureF,bottomholeTemperatureF:a.bottomholeTemperatureF,salinityWtPercent:a.salinityWtPercent,segments:a.segments};}
export function confirmBasisValue(value:unknown,reason:unknown,label:string):BasisConfirmation{
  if(value!=='psig'&&value!=='psia')throw new Error('The basis must be psig or psia');
  return {value,reason:reasonText(reason,label)};
}
export function confirmSurfaceBasis(w:WellAssumptions,value:Basis,reason:string):WellAssumptions{return {...pickAssumptions(w),surfaceBasis:confirmBasisValue(value,reason,'Surface basis')};}
export function setWellAssumptions(w:WellAssumptions,partial:Partial<Assumptions>):WellAssumptions{return {...validateAssumptions({...pickAssumptions(w),...partial}),surfaceBasis:w.surfaceBasis};}
export function validateDeclaredLimit(raw:{psia:unknown;depthFt:unknown;reason:unknown}):DeclaredLimit{
  const num=(v:unknown)=>typeof v==='number'?v:typeof v==='string'&&v.trim()!==''?Number(v):NaN;
  const psia=num(raw.psia),depthFt=num(raw.depthFt);
  bound(psia,100,10000,'Bottomhole limit (psia)');bound(depthFt,1,50000,'Limit depth (ft)');
  return {psia,depthFt,reason:reasonText(raw.reason,'Bottomhole limit')};
}
export const toAbsolute=(psi:number,basis:Basis)=>basis==='psig'?psi+ATMOSPHERE_PSI:psi;
export const otherBasis=(basis:Basis):Basis=>basis==='psig'?'psia':'psig';
export const unsupportedReason=(message:string)=>`Unsupported by the wellbore traverse: ${message}`;
export const traverseSettings=(a:Assumptions):SegmentedBrineSettings=>({model:'segmented-brine',surfaceTemperatureF:a.surfaceTemperatureF,segments:a.segments});
const geometry=(depth:number,a:Assumptions,id:number):WellboreGeometry=>({tvdFt:depth,measuredDepthFt:depth,innerDiameterInches:id,roughnessInches:a.roughnessInches,bottomholeTemperatureF:a.bottomholeTemperatureF});
/** Forward surface-boundary traverse: P_bh = P_wh + hydrostatic − friction. Domain and velocity exits become a reason; a numerical failure is rethrown. */
export function flowingAt(depthFt:number,a:Assumptions,rateStbd:number,surfacePsia:number,idOverride?:number):Flowing|{reason:string}{
  try{const t=traverseBrineWell({well:geometry(depthFt,a,idOverride??a.innerDiameterInches),fluid:{referencePressurePsia:surfacePsia,temperatureF:a.bottomholeTemperatureF,salinityWtPercent:a.salinityWtPercent},settings:traverseSettings(a),rateStbd,boundary:{location:'surface',pressurePsia:surfacePsia}});
    return {pwf:t.bottomholePsia,hydro:t.hydrostaticPsi,friction:t.frictionPsi};}
  catch(error){if(error instanceof TraverseError){if(error.code==='numerical')throw error;return {reason:unsupportedReason(error.message)};}return {reason:unsupportedReason(error instanceof Error?error.message:String(error))};}
}
```

- [ ] **Step 4:** Replace `src/injectivityEstimate.ts` with:

```ts
import {segmentedHydraulicPoint,type DisposalWell} from './disposalCase.js';
import type {DiagnosticsState} from './h10Diagnostics.js';
import {DEPTH_TOLERANCE_FT,type TestRecord,type TestState} from './testRecords.js';
import {ATMOSPHERE_PSI,MIN_TRAVERSE_PSIA,MAX_REASON_LENGTH,DEFAULT_ASSUMPTIONS,SURFACE_BASIS_PROMPT,LIMIT_DATUM_TOLERANCE_FT,validateAssumptions,reasonText,confirmBasisValue,
  toAbsolute,flowingAt,traverseSettings,unsupportedReason,type Assumptions,type Basis,type BasisConfirmation,type DeclaredLimit} from './wellAssumptions.js';
export {ATMOSPHERE_PSI,MIN_TRAVERSE_PSIA,MAX_REASON_LENGTH,DEFAULT_ASSUMPTIONS,validateAssumptions};
export type {Assumptions,Basis};

/** Phase 1c test-referenced J estimate, on the Phase 2a shared surface basis. Pure; no DOM. Measured static P_res, modelled P_wf; presented only as an estimate. */
export const J_ESTIMATE_VERSION='test-referenced-j/2';
export const LABEL_J='Test-referenced J (estimate)';
export const BASIS_STATEMENT='Measured static reservoir pressure (BHP test); flowing bottomhole pressure modelled from H-10 surface pressure through the wellbore traverse; declared tubing and fluid assumptions; monthly calendar-day average rate.';
export const ROUND_TRIP_TOLERANCE_PSI=0.5;
export const TUBING_SENSITIVITY_IN=Object.freeze([3.958,4.892,6.276]);
export type Shift=-1|0|1;
export const REASONS=Object.freeze({
  excluded:'Excluded in the Test records review.',noDate:'No valid test date.',noPressure:'No test pressure reported.',nonPositive:'Test pressure is not positive.',badDepth:'Test depth is outside 1-50000 ft; not usable.',noDepth:'No test depth reported.',
  depthTie:'No single reference depth among the tests; not comparable.',
  depthDiffers:(depth:number,ref:number)=>`Tested at ${depth} ft, not the reference depth ${ref} ft; not comparable.`,
  noH10:'No H-10 months to match.',before:'Dated before the H-10 range.',after:'Dated after the H-10 range.',
  gap:'The matched month has no H-10 report (gap).',monthExcluded:'The matched month is excluded in the H-10 review.',
  noRate:'The matched month has no positive rate.',noAvg:'The matched month has no average pressure.',
  surfaceBasis:SURFACE_BASIS_PROMPT,
  basis:'Confirm the pressure basis first.',lowSurface:'Surface pressure is below 100 psia; outside the traverse domain.',
  unsupported:unsupportedReason,
  notAbove:'Flowing pressure not above reservoir pressure; no J.'});
export const LIMITATIONS=Object.freeze([BASIS_STATEMENT,
  'The calendar-day rate understates the onstream rate whenever the well had downtime, so J reads low; no correction is made.',
  'The matched month contains the shut-in of at least 24 hours for the test.',
  'H-10 average pressure is a monthly figure, not a flowing pressure measured at the time of the test; it is converted on the user-confirmed surface basis.',
  'Tubing size, roughness, temperatures and salinity are declared assumptions, not public records; the well is treated as vertical (MD = TVD = test depth).',
  'The basis of the BHP source field is unresolved in the source; the confirmed reading is the user\'s.',
  'No-friction check: P_wf = surface pressure + (test pressure / test depth) x test depth; it equals the fluid column only if the shut-in surface pressure was about zero.',
  'Rate in bbl/day is treated as STB/day.',
  'The BHP test is treated as a static shut-in reservoir pressure reading (RRC Permian guidance); the source record does not state the test type.']);
export type JInputs={h10:DiagnosticsState|null;tests:TestState};
export type EstimateState={version:typeof J_ESTIMATE_VERSION;inputs:JInputs;basis:BasisConfirmation|null;surfaceBasis:BasisConfirmation|null;assumptions:Assumptions;
  shifts:Readonly<Record<string,{shift:Exclude<Shift,0>;reason:string;identity:string}>>;choice:{key:string;reason:string;identity:string}|null};
export type TubingJ={innerDiameterInches:number;j:number|null;reason:string|null};
export type TestEstimate={key:string;date:string|null;depthFt:number|null;reportedPsi:number|null;month:string|null;shift:Shift;shiftReason:string|null;
  status:'qualifies'|'unmatched'|'awaiting-basis'|'refused'|'unsupported';reason:string|null;
  rateStbd:number|null;surfacePsi:number|null;surfacePsia:number|null;pResPsia:number|null;pWfPsia:number|null;hydrostaticPsi:number|null;frictionPsi:number|null;deltaPsi:number|null;
  j:number|null;jNoFriction:number|null;jAlternateBasis:number|null;alternateBasis:Basis|null;jByTubing:TubingJ[]};
export type RoundTripRow={key:string;month:string;rateStbd:number;observedSurfacePsia:number;reproducedSurfacePsia:number|null;residualPsi:number|null;chosen:boolean;reason:string|null};
export type Estimate={version:typeof J_ESTIMATE_VERSION;label:typeof LABEL_J;basis:BasisConfirmation|null;surfaceBasis:BasisConfirmation|null;assumptions:Assumptions;tests:TestEstimate[];qualifying:string[];
  chosenKey:string|null;choiceBy:'system'|'user'|null;choiceReason:string|null;choiceDropped:boolean;range:{min:number;max:number}|null;trend:{date:string;j:number}[]|null;
  roundTrip:RoundTripRow[];roundTripOk:boolean;readiness:string};
export type Permit={surfacePsi:number|null;volumeBpd:number|null};
export type Handoff={values:Record<string,string|number|null>;origins:Record<string,string>;sweep:{min:number;max:number}|null;notes:string[]};

export function createEstimateState(inputs:JInputs):EstimateState{return {version:J_ESTIMATE_VERSION,inputs,basis:null,surfaceBasis:null,assumptions:{...DEFAULT_ASSUMPTIONS},shifts:Object.freeze({}),choice:null};}
export function withInputs(state:EstimateState,inputs:JInputs):EstimateState{
  const ids=new Map(inputs.tests.records.filter(r=>r.kind==='bhp').map(r=>[r.key,r.identity]));
  return {...state,inputs,shifts:Object.freeze(Object.fromEntries(Object.entries(state.shifts).filter(([k,v])=>ids.get(k)===v.identity))),choice:state.choice&&ids.get(state.choice.key)===state.choice.identity?state.choice:null};
}
export function confirmBasis(state:EstimateState,value:Basis,reason:string):EstimateState{return {...state,basis:confirmBasisValue(value,reason,'Basis')};}
/** The shared H-10 and permit pressure basis from Well assumptions; null clears it. */
export function setSurfaceBasis(state:EstimateState,surfaceBasis:BasisConfirmation|null):EstimateState{
  return {...state,surfaceBasis:surfaceBasis===null?null:confirmBasisValue(surfaceBasis.value,surfaceBasis.reason,'Surface basis')};
}
export function setAssumptions(state:EstimateState,partial:Partial<Assumptions>):EstimateState{return {...state,assumptions:validateAssumptions({...state.assumptions,...partial})};}
const bhpRecord=(state:EstimateState,key:string)=>{const r=state.inputs.tests.records.find(x=>x.key===key&&x.kind==='bhp');if(!r)throw new Error(`Not a BHP test: ${key}`);return r;};
export function moveMatch(state:EstimateState,key:string,shift:Shift,reason:string):EstimateState{
  const rec=bhpRecord(state,key);if(shift!==-1&&shift!==0&&shift!==1)throw new Error('A match can move only to the previous or next month');
  const next={...state.shifts};if(shift===0)delete next[key];else next[key]={shift,reason:reasonText(reason,'Moved match'),identity:rec.identity};
  return {...state,shifts:Object.freeze(next)};
}
export function chooseJ(state:EstimateState,key:string,reason:string):EstimateState{
  const text=reasonText(reason,'Chosen J');if(!estimate(state).qualifying.includes(key))throw new Error('Only a qualifying test can be chosen');
  return {...state,choice:{key,reason:text,identity:bhpRecord(state,key).identity}};
}
function shiftMonth(month:string,by:number){const d=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7))-1+by,1));return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;}
const jFrom=(pwf:number,pres:number,q:number)=>pwf>pres?q/(pwf-pres):null;
function evaluate(state:EstimateState,r:TestRecord):TestEstimate{
  const s=state.shifts[r.key],shift:Shift=s?.shift??0,tests=state.inputs.tests,a=state.assumptions;
  const base:TestEstimate={key:r.key,date:r.date,depthFt:r.depthFt,reportedPsi:r.bhpPsia,month:null,shift,shiftReason:s?.reason??null,status:'refused',reason:null,rateStbd:null,surfacePsi:null,surfacePsia:null,
    pResPsia:null,pWfPsia:null,hydrostaticPsi:null,frictionPsi:null,deltaPsi:null,j:null,jNoFriction:null,jAlternateBasis:null,alternateBasis:null,jByTubing:[]};
  const stop=(status:TestEstimate['status'],reason:string,extra:Partial<TestEstimate>={}):TestEstimate=>({...base,...extra,status,reason});
  if(tests.decisions[r.key]?.include!==true)return stop('refused',REASONS.excluded);
  if(r.date===null)return stop('refused',REASONS.noDate);
  if(r.bhpPsia===null)return stop('refused',REASONS.noPressure);
  if(r.bhpPsia<=0)return stop('refused',REASONS.nonPositive);
  if(r.depthFt===null)return stop('refused',REASONS.noDepth);
  if(!Number.isFinite(r.depthFt)||r.depthFt<1||r.depthFt>50000)return stop('refused',REASONS.badDepth);
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
  const q=m.rateBpd,surfacePsi=m.avgPsi;
  if(!state.surfaceBasis)return stop('awaiting-basis',REASONS.surfaceBasis,{month,rateStbd:q,surfacePsi});
  const surfacePsia=toAbsolute(surfacePsi,state.surfaceBasis.value),matched={month,rateStbd:q,surfacePsi,surfacePsia};
  if(!state.basis)return stop('awaiting-basis',REASONS.basis,matched);
  if(surfacePsia<MIN_TRAVERSE_PSIA)return stop('refused',REASONS.lowSurface,matched);
  const psig=state.basis.value==='psig',pResPsia=psig?r.bhpPsia+ATMOSPHERE_PSI:r.bhpPsia,alternatePres=psig?r.bhpPsia:r.bhpPsia+ATMOSPHERE_PSI;
  const f=flowingAt(r.depthFt,a,q,surfacePsia);
  if('reason' in f)return stop('unsupported',f.reason,{...matched,pResPsia});
  const pWfNoFriction=surfacePsia+(r.bhpPsia/r.depthFt)*r.depthFt;
  const jByTubing=TUBING_SENSITIVITY_IN.map((id):TubingJ=>{const t=flowingAt(r.depthFt!,a,q,surfacePsia,id);if('reason' in t)return {innerDiameterInches:id,j:null,reason:t.reason};const j=jFrom(t.pwf,pResPsia,q);return {innerDiameterInches:id,j,reason:j===null?REASONS.notAbove:null};});
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
    const p=segmentedHydraulicPoint(well,{referencePressurePsia:chosen.pResPsia!,temperatureF:a.bottomholeTemperatureF,salinityWtPercent:a.salinityWtPercent},traverseSettings(a),t.rateStbd!);
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
  const readiness=!tests.length?'No BHP test records for this well; no test-referenced J.':!state.surfaceBasis?SURFACE_BASIS_PROMPT:!state.basis?'Confirm the pressure basis to see test-referenced J.':
    !q.length?'No test qualifies for a test-referenced J. Reasons are listed per test.':`${q.length} of ${tests.length} BHP tests give a test-referenced J (estimate).`;
  return {version:J_ESTIMATE_VERSION,label:LABEL_J,basis:state.basis?{...state.basis}:null,surfaceBasis:state.surfaceBasis?{...state.surfaceBasis}:null,assumptions:{...state.assumptions},tests,qualifying:q.map(t=>t.key),
    chosenKey:chosen?.key??null,choiceBy:chosen?(user?'user':'system'):null,choiceReason:user?.reason??null,choiceDropped:state.choice!==null&&user===null,
    range:q.length?{min:Math.min(...js),max:Math.max(...js)}:null,trend:q.length>=2?q.map(t=>({date:t.date!,j:t.j!})):null,
    roundTrip,roundTripOk:!!own&&own.residualPsi!==null&&Math.abs(own.residualPsi)<=ROUND_TRIP_TOLERANCE_PSI,readiness};
}
/** Hydraulics workspace field values (null = leave empty for the user to declare) with an origin label per field. */
export function handoff(state:EstimateState,est:Estimate,permit:Permit,estimateSha256:string,declaredLimit:DeclaredLimit|null=null):Handoff{
  const t=est.tests.find(x=>x.key===est.chosenKey);
  if(!t||t.j===null)throw new Error('No test-referenced J is chosen; nothing to hand off.');
  if(!est.roundTripOk)throw new Error('The round trip does not reproduce the chosen month within 0.5 psi; hand-off refused.');
  const sb=state.surfaceBasis;if(!sb)throw new Error(SURFACE_BASIS_PROMPT);
  const a=state.assumptions,assumed='Declared assumption (test-referenced J estimate)',basis=state.basis!;
  const surface=permit.surfacePsi!==null&&permit.surfacePsi>0?toAbsolute(permit.surfacePsi,sb.value):null,volume=permit.volumeBpd!==null&&permit.volumeBpd>0?permit.volumeBpd:null;
  const limitOk=declaredLimit!==null&&Math.abs(declaredLimit.depthFt-t.depthFt!)<=LIMIT_DATUM_TOLERANCE_FT;
  return {values:{model:'segmented-brine',caseName:LABEL_J,datum:datumFor(t),injectivityStbdPerPsi:t.j,reservoirPsia:t.pResPsia,referencePressurePsia:t.pResPsia,tvdFt:t.depthFt,measuredDepthFt:t.depthFt,
      innerDiameterInches:a.innerDiameterInches,roughnessInches:a.roughnessInches,temperatureF:a.bottomholeTemperatureF,surfaceTemperatureF:a.surfaceTemperatureF,salinityWtPercent:a.salinityWtPercent,segments:a.segments,
      rateStbd:t.rateStbd,curveMaximumStbd:Math.ceil(1.5*t.rateStbd!),surfaceLimitPsia:surface,operatingCeilingStbd:volume,limitPsia:limitOk?declaredLimit!.psia:null},
    origins:{injectivityStbdPerPsi:`${LABEL_J} from BHP test ${t.date} and H-10 ${t.month}; sealed estimate ${estimateSha256.slice(0,12)}`,
      reservoirPsia:`BHP test ${t.date}: ${basis.value} reading${basis.value==='psig'?' + 14.7 psi':''} (basis confirmed: ${basis.reason})`,referencePressurePsia:'Set to the reservoir pressure (fluid reference state, context only)',
      datum:'From the BHP test depth (RRC guidance: top of the completed disposal interval)',tvdFt:'BHP test depth; vertical well declared',measuredDepthFt:'BHP test depth; vertical well declared',
      innerDiameterInches:assumed,roughnessInches:assumed,temperatureF:assumed,surfaceTemperatureF:assumed,salinityWtPercent:assumed,segments:assumed,
      rateStbd:`H-10 ${t.month} calendar-day average rate`,curveMaximumStbd:'1.5 x the matched rate',
      surfaceLimitPsia:surface===null?'No permitted surface pressure in the inventory; declare it.':sb.value==='psig'?`Inventory permitted surface pressure ${permit.surfacePsi} psi + 14.7 psi (permit value)`:`Inventory permitted surface pressure ${permit.surfacePsi} psi, read as psia (permit value; basis confirmed: ${sb.reason})`,
      operatingCeilingStbd:volume===null?'No permitted volume in the inventory; declare it.':`Inventory permitted volume ${volume} bbl/day (permit value)`,
      limitPsia:limitOk?`Declared by the user in WHP/BHP reconciliation (${declaredLimit!.reason})`:'Not set from evidence; declare it.'},
    sweep:est.range?{...est.range}:null,
    notes:[est.range?`J range for sweeps: ${est.range.min.toPrecision(4)} to ${est.range.max.toPrecision(4)} STB/day/psi (enter it in Parameter sweeps).`:'',BASIS_STATEMENT].filter(Boolean)};
}
```

- [ ] **Step 5:** In `src/injectivityEstimateExport.ts` make three exact edits:
  1. `schemaVersion:'test-referenced-j-export/1'` → `schemaVersion:'test-referenced-j-export/2'`. This occurs twice: in the `SealedEstimate` type and in `sealEstimate`.
  2. In `estimateCsv`, directly after the `['Basis',…]` entry, insert:
     `['Surface basis (H-10 and permit)',sealed.surfaceBasis?`${sealed.surfaceBasis.value} (reason: ${sealed.surfaceBasis.reason})`:null],`
  3. Nothing else changes. `verifyEstimateSealed` stays hash-only, so `/1` files still verify.

- [ ] **Step 6:** Update `tests/injectivity-estimate.test.mjs`:
  1. Replace the import lines 1–7 with:

```js
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createEstimateState,withInputs,confirmBasis,setSurfaceBasis,setAssumptions,moveMatch,chooseJ,estimate,handoff,validateAssumptions,datumFor,
 REASONS,DEFAULT_ASSUMPTIONS,TUBING_SENSITIVITY_IN,ATMOSPHERE_PSI,LABEL_J,LIMITATIONS,BASIS_STATEMENT,J_ESTIMATE_VERSION} from '../dist/injectivityEstimate.js';
import {traverseBrineWell} from '../dist/wellboreTraverse.js';
import {applyDecision} from '../dist/h10Diagnostics.js';
import {applyTestDecision} from '../dist/testRecords.js';
import {applyHandoff} from '../web/hydraulics.mjs';
import {fixtureInputs,monthlyRow,bhpRow} from './helpers/injectivity-fixture.mjs';
```

  2. Replace line 11 with:

```js
const SURFACE_PSIG={value:'psig',reason:'RRC H-10 reports gauge pressure'};
const psig=s=>confirmBasis(setSurfaceBasis(s,SURFACE_PSIG),'psig','RRC Permian guidance');
```

  3. Replace the first test (`'matches show before the basis is confirmed, with no J'`) with:

```js
test('matches show before either basis is confirmed, with no J',()=>{
 const e0=estimate(createEstimateState(fixtureInputs())),t0=byKey(e0,1);
 assert.equal(t0.status,'awaiting-basis');assert.equal(t0.reason,REASONS.surfaceBasis);assert.equal(t0.month,'2024-02');assert.equal(t0.surfacePsi,900);assert.equal(t0.surfacePsia,null);
 assert.equal(e0.readiness,'Confirm the H-10 and permit pressure basis in Well assumptions.');
 const e=estimate(setSurfaceBasis(createEstimateState(fixtureInputs()),SURFACE_PSIG)),t1=byKey(e,1);
 assert.equal(t1.status,'awaiting-basis');assert.equal(t1.reason,REASONS.basis);assert.equal(t1.month,'2024-02');
 assert.equal(t1.rateStbd,10000);near(t1.surfacePsia,914.7);assert.equal(t1.j,null);assert.equal(e.chosenKey,null);
 assert.equal(e.readiness,'Confirm the pressure basis to see test-referenced J.');
});
```

  4. In the test `'no-friction check equals q over the gauge surface pressure…'`, change `confirmBasis(createEstimateState(fixtureInputs()),'psia','source field name')` to `confirmBasis(setSurfaceBasis(createEstimateState(fixtureInputs()),SURFACE_PSIG),'psia','source field name')`.
  5. In the test `'withInputs keeps the basis, assumptions and moves…'`, append `assert.deepEqual(next.surfaceBasis,s.surfaceBasis);` before the closing `});`.
  6. Append these tests at the end:

```js
test('2a equivalence: with both bases psig and default assumptions, estimate and hand-off equal the 1c golden from 5bc1690',async()=>{
 const g=JSON.parse(await readFile('tests/fixtures/test-referenced-j-v1-golden.json','utf8'));assert.equal(g.sealed.schemaVersion,'test-referenced-j-export/1');
 const s=psig(createEstimateState(fixtureInputs())),e=JSON.parse(JSON.stringify(estimate(s)));
 for(const k of ['tests','qualifying','chosenKey','choiceBy','choiceReason','choiceDropped','range','trend','roundTrip','roundTripOk','readiness','basis','assumptions'])assert.deepEqual(e[k],g.sealed[k],k);
 const h=handoff(s,estimate(s),{surfacePsi:1176,volumeBpd:30000},g.sealed.contentSha256);
 assert.deepEqual(h.values,g.handoff.values);assert.deepEqual(h.origins,g.handoff.origins);assert.deepEqual(h.notes,g.handoff.notes);assert.deepEqual(h.sweep,g.handoff.sweep);
});
test('2a: a psia surface basis shifts the surface pressure and the permit by exactly -14.7 psi',()=>{
 const g=psig(createEstimateState(fixtureInputs())),a=confirmBasis(setSurfaceBasis(createEstimateState(fixtureInputs()),{value:'psia',reason:'reported as absolute'}),'psig','RRC Permian guidance');
 const ta=byKey(estimate(a),1),tg=byKey(estimate(g),1);near(ta.surfacePsia,900);near(ta.surfacePsia,tg.surfacePsia-14.7);
 const ha=handoff(a,estimate(a),{surfacePsi:1176,volumeBpd:null},'ab'.repeat(32));near(ha.values.surfaceLimitPsia,1176);
 assert.equal(ha.origins.surfaceLimitPsia,'Inventory permitted surface pressure 1176 psi, read as psia (permit value; basis confirmed: reported as absolute)');
});
test('2a: the surface basis needs a known value and a reason; null clears it; the estimate records it',()=>{
 const s=createEstimateState(fixtureInputs());
 assert.throws(()=>setSurfaceBasis(s,{value:'bar',reason:'x'}),/psig or psia/);assert.throws(()=>setSurfaceBasis(s,{value:'psig',reason:' '}),/reason/);
 assert.equal(setSurfaceBasis(setSurfaceBasis(s,SURFACE_PSIG),null).surfaceBasis,null);
 assert.deepEqual(estimate(psig(s)).surfaceBasis,SURFACE_PSIG);
 const e=estimate(psig(s));assert.throws(()=>handoff(setSurfaceBasis(psig(s),null),e,{surfacePsi:null,volumeBpd:null},'x'),/Confirm the H-10 and permit pressure basis/);
});
test('2a: a bottomhole limit declared within 1 ft of the J datum prefills the hand-off; 2 ft away does not',()=>{
 const s=psig(createEstimateState(fixtureInputs())),e=estimate(s),limit={psia:4000,depthFt:3311,reason:'operator design limit'};
 const h=handoff(s,e,{surfacePsi:1176,volumeBpd:30000},'ab'.repeat(32),limit);
 assert.equal(h.values.limitPsia,4000);assert.equal(h.origins.limitPsia,'Declared by the user in WHP/BHP reconciliation (operator design limit)');
 assert.equal(applyHandoff(h).fields.limitPsia,'4000');
 const far=handoff(s,e,{surfacePsi:1176,volumeBpd:30000},'ab'.repeat(32),{...limit,depthFt:3312});
 assert.equal(far.values.limitPsia,null);assert.equal(far.origins.limitPsia,'Not set from evidence; declare it.');
});
test('2a: version and the H-10 limitation refer to the confirmed surface basis',()=>{
 assert.equal(J_ESTIMATE_VERSION,'test-referenced-j/2');
 assert.equal(LIMITATIONS[3],'H-10 average pressure is a monthly figure, not a flowing pressure measured at the time of the test; it is converted on the user-confirmed surface basis.');
});
```

- [ ] **Step 7:** Update `tests/injectivity-export.test.mjs`:
  1. Line 2 becomes `import {createEstimateState,confirmBasis,setSurfaceBasis,estimate} from '../dist/injectivityEstimate.js';`, and add `import {readFile} from 'node:fs/promises';` to line 1.
  2. Line 8 becomes:

```js
const SURFACE_PSIG={value:'psig',reason:'RRC H-10 reports gauge pressure'};
const both=(inputs,bhp='psig')=>confirmBasis(setSurfaceBasis(createEstimateState(inputs),SURFACE_PSIG),bhp,'RRC Permian guidance');
const ready=()=>estimate(both(fixtureInputs()));
```

  3. In the first test, change `'test-referenced-j-export/1'` and `'test-referenced-j/1'` to `/2`.
  4. Line 22 becomes `const none=estimate(both(fixtureInputs({avg:50})));const s=await sealEstimate(none,source);`.
  5. In the I-1 test, `estimate(confirmBasis(createEstimateState(fixtureInputs({bhp:[…]})),'psig','x'))` becomes `estimate(both(fixtureInputs({bhp:[bhpRow(1,'2024-07-22',1731,3310),bhpRow(2,'2024-02-12',1705,3310)]})))`.
  6. Append:

```js
test('2a: the sealed export records the surface basis and the CSV lists it',async()=>{
 const s=await sealEstimate(ready(),source);assert.deepEqual(s.surfaceBasis,SURFACE_PSIG);
 assert.match(estimateCsv(s),/"Surface basis \(H-10 and permit\)","psig \(reason: RRC H-10 reports gauge pressure\)"/);
});
test('2a: a 1c /1 sealed export still verifies',async()=>{
 const g=JSON.parse(await readFile('tests/fixtures/test-referenced-j-v1-golden.json','utf8'));
 assert.equal(await verifyEstimateSealed(g.sealed),true);const t={...g.sealed,readiness:'x'};assert.equal(await verifyEstimateSealed(t),false);
});
```

- [ ] **Step 8:** Build, then run:

```bash
node --test tests/well-assumptions.test.mjs tests/injectivity-estimate.test.mjs tests/injectivity-export.test.mjs
```

  Expected: all pass. Then run the full suite with `node --test tests/*.test.mjs`. `tests/injectivity-session.test.mjs` is **expected to fail** until Task 4, because its sessions have no surface basis. Record the counts. Every other file must pass.

- [ ] **Step 9:** Check CR bytes: 0 in every touched file. Report to the ledger. Do not commit.

---

### Task 2: Reconciliation core (`src/pressureReconciliation.ts`)

**Files:**
- Create: `src/pressureReconciliation.ts`, `tests/pressure-reconciliation.test.mjs`.

**Interfaces:**
- **Consumes:**
  - from Task 1: `flowingAt`, `toAbsolute`, `otherBasis`, `pickAssumptions`, `MIN_TRAVERSE_PSIA`, `SURFACE_BASIS_PROMPT`, `LIMIT_DATUM_TOLERANCE_FT`, `WellAssumptions`, `DeclaredLimit`, `Estimate` and `TUBING_SENSITIVITY_IN`;
  - `DEPTH_TOLERANCE_FT` and `TestState` from `testRecords.ts`;
  - `TraverseError`.
- **Produces:**
  - `reconcile(inputs:ReconInputs, deps?:{flowingAt})` → `Reconciliation`;
  - `reportDepth(tests, permittedTopFt)` → `{depthFt, source}`;
  - constants `RECONCILIATION_VERSION`, `LABEL_RECON`, `SCREENING_TEXT`, `DIFFERENTIAL_LABEL`, `PERMIT_EQ_LABEL`, `FORMATION_TEXT`, `SRT_NOTE`, `RATE_NOTE`, `NEGATIVE_FLAG`, `ABOVE_PERMIT_FLAG`, `CAUSE_CHECKLIST`, `RECON_REASONS`, `FORMULAS` and `LIMITATIONS`;
  - types `ReconInputs`, `Reconciliation`, `MonthRow`, `TestMonth`, `ReportDepth` and `ReconPermit`.

- [ ] **Step 1: Write the failing test** `tests/pressure-reconciliation.test.mjs`:

```js
import test from 'node:test';import assert from 'node:assert/strict';
import {reconcile,reportDepth,RECON_REASONS as R,CAUSE_CHECKLIST,SCREENING_TEXT,FORMATION_TEXT,SRT_NOTE,LABEL_RECON,RECONCILIATION_VERSION,FORMULAS,LIMITATIONS} from '../dist/pressureReconciliation.js';
import {createEstimateState,confirmBasis,setSurfaceBasis,setAssumptions,estimate} from '../dist/injectivityEstimate.js';
import {DEFAULT_WELL_ASSUMPTIONS,flowingAt} from '../dist/wellAssumptions.js';
import {TraverseError,traverseBrineWell} from '../dist/wellboreTraverse.js';
import {applyDecision} from '../dist/h10Diagnostics.js';
import {fixtureInputs,monthlyRow,bhpRow} from './helpers/injectivity-fixture.mjs';

const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const WELL={...DEFAULT_WELL_ASSUMPTIONS,surfaceBasis:{value:'psig',reason:'RRC H-10 reports gauge pressure'}};
const jFor=(inputs,well=WELL,bhp='psig')=>estimate(confirmBasis(setSurfaceBasis(setAssumptions(createEstimateState(inputs),well),well.surfaceBasis),bhp,'RRC Permian guidance'));
const rin=(o={})=>{const inputs=o.inputs??fixtureInputs(),well=o.well??WELL;
 return {h10:inputs.h10,tests:inputs.tests,well,j:'j' in o?o.j:jFor(inputs,well),permit:o.permit??{surfacePsi:1176,topDepthFt:3000},declaredLimit:o.declaredLimit??null};};
const row=(rec,m)=>rec.rows.find(r=>r.month===m);
const pwf=(depth,surfacePsia,id=3.958,rate=10000)=>traverseBrineWell({well:{tvdFt:depth,measuredDepthFt:depth,innerDiameterInches:id,roughnessInches:0.0006,bottomholeTemperatureF:100},
 fluid:{referencePressurePsia:surfacePsia,temperatureF:100,salinityWtPercent:10},settings:{model:'segmented-brine',surfaceTemperatureF:70,segments:32},rateStbd:rate,boundary:{location:'surface',pressurePsia:surfacePsia}});

test('identity and fixed wording',()=>{
 const rec=reconcile(rin());assert.equal(rec.version,RECONCILIATION_VERSION);assert.equal(rec.version,'pressure-reconciliation/1');assert.equal(rec.label,LABEL_RECON);assert.equal(rec.label,'WHP/BHP reconciliation (screening)');
 assert.equal(rec.screening,'Screening only: not a regulatory approval, compliance finding or safe-operating determination.');assert.equal(rec.formation,FORMATION_TEXT);assert.equal(FORMATION_TEXT,'Not evaluated in this phase');
 assert.doesNotMatch(JSON.stringify({rec,FORMULAS,LIMITATIONS,R}),new RegExp('calib'+'rated','i'));assert.ok(LIMITATIONS.includes(SCREENING_TEXT));
});
test('nothing is computed until the surface basis is confirmed',()=>{
 const rec=reconcile(rin({well:DEFAULT_WELL_ASSUMPTIONS,j:null}));
 assert.deepEqual(rec.rows,[]);assert.equal(rec.readiness,'Confirm the H-10 and permit pressure basis in Well assumptions.');assert.equal(rec.counts.months,0);
});
test('report depth: 1b reference depth, then permitted top (with tie note), then none',()=>{
 assert.deepEqual(reportDepth({referenceDepthFt:3310,referenceTie:false},3000),{depthFt:3310,source:'BHP test depth'});
 assert.deepEqual(reportDepth({referenceDepthFt:null,referenceTie:false},3000),{depthFt:3000,source:'permitted top of interval (RRC guidance)'});
 assert.deepEqual(reportDepth({referenceDepthFt:3310,referenceTie:true},3000),{depthFt:3000,source:'permitted top of interval (RRC guidance); BHP test depths tie'});
 assert.deepEqual(reportDepth({referenceDepthFt:null,referenceTie:false},null),{depthFt:null,source:'none'});
 assert.deepEqual(reportDepth({referenceDepthFt:null,referenceTie:false},0),{depthFt:null,source:'none'});
});
test('modelled flowing BHP: P_bh = P_wh + hydro - friction at the report depth, equal to a direct traverse',()=>{
 const r=row(reconcile(rin()),'2024-02'),t=pwf(3310,914.7);
 assert.equal(r.status,'included');near(r.surfacePsia,914.7);assert.equal(r.modelled.pwfPsia,t.bottomholePsia);assert.equal(r.modelled.hydroPsi,t.hydrostaticPsi);assert.equal(r.modelled.frictionPsi,t.frictionPsi);
 near(r.modelled.pwfPsia,914.7+r.modelled.hydroPsi-r.modelled.frictionPsi,1e-6);assert.equal(r.modelled.reason,null);
});
test('regulatory margin = permit - reported maximum on one basis; never the average',()=>{
 const r=row(reconcile(rin()),'2024-02');assert.equal(r.regulatory.marginPsi,1176-950);assert.equal(r.regulatory.abovePermit,false);
 const over=row(reconcile(rin({permit:{surfacePsi:900,topDepthFt:null}})),'2024-02');assert.equal(over.regulatory.marginPsi,-50);assert.equal(over.regulatory.abovePermit,true);
 const none=row(reconcile(rin({permit:{surfacePsi:null,topDepthFt:null}})),'2024-02');assert.equal(none.regulatory.marginPsi,null);assert.equal(none.regulatory.reason,R.noPermit);
 const rows=[monthlyRow('2024-01',10000,900),{...monthlyRow('2024-02',10000,900),reported_max_injection_pressure_psi:null}];
 const nm=row(reconcile(rin({inputs:fixtureInputs({monthly:rows})})),'2024-02');assert.equal(nm.regulatory.marginPsi,null);assert.equal(nm.regulatory.reason,R.noMax);assert.notEqual(nm.modelled.pwfPsia,null);
});
test('every month status and refusal, in order, with nothing zero-filled',()=>{
 const base=fixtureInputs();
 assert.equal(row(reconcile(rin()),'2024-05').status,'excluded');assert.equal(row(reconcile(rin()),'2024-05').modelled.reason,R.excluded);assert.equal(row(reconcile(rin()),'2024-05').regulatory.marginPsi,null);
 const gap=fixtureInputs({monthly:[monthlyRow('2024-01',10000,900),monthlyRow('2024-03',10000,900)]});const g=row(reconcile(rin({inputs:gap})),'2024-02');
 assert.equal(g.status,'gap');assert.equal(g.modelled.pwfPsia,null);assert.equal(g.regulatory.marginPsi,null);assert.equal(g.modelled.reason,R.gap);
 const zero=fixtureInputs({monthly:[monthlyRow('2024-01',10000,900),monthlyRow('2024-02',0,0)]});zero.h10=applyDecision(zero.h10,'2024-02',true);
 const z=row(reconcile(rin({inputs:zero})),'2024-02');assert.equal(z.modelled.reason,R.noInjection);assert.equal(z.regulatory.reason,R.notApplicable);assert.equal(z.regulatory.marginPsi,null);
 const noAvg={...base};noAvg.h10=applyDecision(base.h10,'2024-05',true);assert.equal(row(reconcile(rin({inputs:noAvg})),'2024-05').modelled.reason,R.noAvg);
 const low=row(reconcile(rin({inputs:fixtureInputs({avg:85})})),'2024-02');assert.equal(low.modelled.reason,R.floor);assert.equal(low.regulatory.marginPsi,1176-135);
 const fast=row(reconcile(rin({well:{...WELL,innerDiameterInches:2.441}})),'2024-02');assert.match(fast.modelled.reason,/^Unsupported by the wellbore traverse: .*5 m\/s/);assert.equal(fast.regulatory.marginPsi,226);
 const nodepth=row(reconcile(rin({inputs:fixtureInputs({bhp:[]}),permit:{surfacePsi:1176,topDepthFt:null}})),'2024-02');assert.equal(nodepth.modelled.reason,R.noDepth);assert.equal(nodepth.regulatory.marginPsi,226);
});
test('a numerical traverse failure becomes "Traverse did not converge", never an exception',()=>{
 const boom=()=>{throw new TraverseError('numerical','Wellbore refinement failed to converge');};
 const rec=reconcile(rin(),{flowingAt:boom});const r=row(rec,'2024-02');assert.equal(r.modelled.reason,R.notConverged);assert.equal(r.regulatory.marginPsi,226);
 assert.equal(rec.counts.refused[R.notConverged],7);
});
test('permit-equivalent BHP: same traverse from the permit pressure; margin = permit-equivalent - modelled',()=>{
 const r=row(reconcile(rin()),'2024-02');near(r.permitEquivalent.pwfPsia,pwf(3310,1190.7).bottomholePsia);near(r.permitEquivalent.marginPsi,r.permitEquivalent.pwfPsia-r.modelled.pwfPsia);
 assert.equal(row(reconcile(rin({permit:{surfacePsi:null,topDepthFt:null}})),'2024-02').permitEquivalent.reason,R.noPermit);
 assert.equal(row(reconcile(rin({inputs:fixtureInputs({avg:85})})),'2024-02').permitEquivalent.reason,R.noModel);
});
test('declared limit: compared within 1 ft of the report depth, blocked at 2 ft, "No limit declared" when unset',()=>{
 const at=row(reconcile(rin({declaredLimit:{psia:4000,depthFt:3311,reason:'design'}})),'2024-02');near(at.declared.marginPsi,4000-at.modelled.pwfPsia);
 const off=row(reconcile(rin({declaredLimit:{psia:4000,depthFt:3312,reason:'design'}})),'2024-02');assert.equal(off.declared.marginPsi,null);assert.equal(off.declared.reason,R.limitDatum);
 assert.equal(row(reconcile(rin()),'2024-02').declared.reason,R.noLimit);
});
test('test months: differential = modelled - static, equal to the J estimate delta; positive here',()=>{
 const inputs=fixtureInputs(),j=jFor(inputs),rec=reconcile(rin({inputs,j})),t=row(rec,'2024-02').tests[0],jt=j.tests.find(x=>x.key==='package:bhp:1');
 assert.equal(t.key,'package:bhp:1');near(t.pResPsia,1719.7);near(t.differentialPsi,jt.deltaPsi);assert.equal(t.negative,false);assert.deepEqual(t.checklist,[]);
 near(t.testGradientPsiFt,1705/3310);near(t.columnGradientPsiFt,row(rec,'2024-02').modelled.hydroPsi/3310);
 assert.equal(row(rec,'2024-05').tests.length,0,'an unmatched (excluded-month) test is not attached');
});
test('negative differential is flagged with the cause checklist',()=>{
 const inputs=fixtureInputs({bhp:[bhpRow(1,'2024-02-12',3000,3310)]}),rec=reconcile(rin({inputs})),t=row(rec,'2024-02').tests[0];
 assert.ok(t.differentialPsi<0);assert.equal(t.negative,true);assert.deepEqual(t.checklist,[...CAUSE_CHECKLIST]);assert.equal(CAUSE_CHECKLIST.length,4);assert.equal(rec.counts.negativeDifferentials,1);
});
test('no BHP basis in the J panel: differential waits with its reason',()=>{
 const inputs=fixtureInputs(),j=estimate(setSurfaceBasis(createEstimateState(inputs),WELL.surfaceBasis));
 const t=row(reconcile(rin({inputs,j})),'2024-02').tests[0];assert.equal(t.differentialPsi,null);assert.equal(t.reason,R.bhpBasis);
 const none=reconcile(rin({inputs,j:null}));assert.equal(row(none,'2024-02').tests.length,0);assert.notEqual(row(none,'2024-02').modelled.pwfPsia,null);
});
test('sensitivity band spans the other basis reading and the tubing sizes; larger ID gives a higher modelled BHP',()=>{
 const r=row(reconcile(rin()),'2024-02');
 near(r.modelled.band.min,pwf(3310,900).bottomholePsia);near(r.modelled.band.max,pwf(3310,914.7,6.276).bottomholePsia);
 assert.ok(pwf(3310,914.7,6.276).bottomholePsia>pwf(3310,914.7,4.892).bottomholePsia&&pwf(3310,914.7,4.892).bottomholePsia>pwf(3310,914.7,3.958).bottomholePsia);
 const t=row(reconcile(rin()),'2024-02').tests[0];near(t.band.min,r.modelled.band.min-1719.7);near(t.band.max,r.modelled.band.max-1719.7);
});
test('counts add up; summary takes the smallest margins; formation never evaluated; SRT note only with step-rate rows',()=>{
 const rec=reconcile(rin({declaredLimit:{psia:4000,depthFt:3310,reason:'design'}})),c=rec.counts;
 assert.equal(c.months,8);assert.equal(c.included,7);assert.equal(c.modelled+Object.values(c.refused).reduce((a,b)=>a+b,0),c.included);
 assert.equal(c.testMonths,2);assert.equal(c.abovePermit,0);assert.equal(rec.summary.minRegulatoryPsi,226);
 assert.equal(rec.summary.minDeclaredPsi,Math.min(...rec.rows.filter(r=>r.declared.marginPsi!==null).map(r=>r.declared.marginPsi)));
 assert.equal(rec.srtPresent,false);assert.ok(!rec.notes.includes(SRT_NOTE));
});
test('flowingAt is the shared helper (no second physics path)',()=>{
 const r=row(reconcile(rin()),'2024-02'),f=flowingAt(3310,WELL,10000,914.7);assert.equal(r.modelled.pwfPsia,f.pwf);
});
```

- [ ] **Step 2:** Build and run `node --test tests/pressure-reconciliation.test.mjs`. Expected: FAIL, module not found.

- [ ] **Step 3:** Create `src/pressureReconciliation.ts`:

```ts
import type {DiagnosticsState,MonthRecord} from './h10Diagnostics.js';
import {DEPTH_TOLERANCE_FT,type TestState} from './testRecords.js';
import {TraverseError} from './wellboreTraverse.js';
import {TUBING_SENSITIVITY_IN,type Estimate,type TestEstimate} from './injectivityEstimate.js';
import {flowingAt,toAbsolute,otherBasis,pickAssumptions,MIN_TRAVERSE_PSIA,SURFACE_BASIS_PROMPT,LIMIT_DATUM_TOLERANCE_FT,
  type Assumptions,type BasisConfirmation,type DeclaredLimit,type Flowing,type WellAssumptions} from './wellAssumptions.js';

/** Phase 2a WHP/BHP reconciliation and pressure-margin screening. Pure; no DOM. Screening only. */
export const RECONCILIATION_VERSION='pressure-reconciliation/1';
export const LABEL_RECON='WHP/BHP reconciliation (screening)';
export const SCREENING_TEXT='Screening only: not a regulatory approval, compliance finding or safe-operating determination.';
export const DIFFERENTIAL_LABEL='flowing minus static differential, not a model error';
export const PERMIT_EQ_LABEL='restates the permit limit at depth; not an independent constraint';
export const FORMATION_TEXT='Not evaluated in this phase';
export const SRT_NOTE='Step-rate records carry fracture-pressure fields; this phase does not use them.';
export const RATE_NOTE='Calendar-day average rate; it understates the rate while the well is actually injecting, so friction is understated and the modelled pressure reads high.';
export const NEGATIVE_FLAG='model below measured static pressure: assumptions or test reading inconsistent';
export const ABOVE_PERMIT_FLAG='reported maximum above permit limit (screening, not a compliance finding)';
export const CAUSE_CHECKLIST=Object.freeze(['Shut-in days included in the monthly average pressure.','Brine column density or salinity differs from the declared assumption.',
  'Test taken with pressure held on the tubing.','Calendar-day rate understates the rate while injecting.']);
export const RECON_REASONS=Object.freeze({
  excluded:'Excluded in the H-10 review',gap:'No H-10 report',noPermit:'No permit pressure limit in the inventory',notApplicable:'Not applicable (no injection)',noMax:'No maximum reported',
  noDepth:'No report depth: no test depth and no permitted top depth',noInjection:'No injection in the month',noAvg:'No average pressure reported',
  floor:'Average below the 100 psia traverse floor (D9)',notConverged:'Traverse did not converge',noModel:'No modelled bottomhole pressure for the month',
  noLimit:'No limit declared',limitDatum:'Limit datum differs from report depth; no comparison',bhpBasis:'Confirm the BHP basis in the J panel',
  testDepth:'Test depth differs from report depth; no differential'});
export const FORMULAS=Object.freeze(['P_bh = P_wh + ΔP_hydrostatic − ΔP_friction (forward surface-boundary traverse at the report depth)',
  'Regulatory margin = permit liquid pressure limit (psi) − reported monthly maximum (psi), same basis, no conversion',
  'Permit-equivalent margin = P_bh(permit pressure at surface) − P_bh(reported average at surface), same month rate',
  'Declared margin = declared bottomhole limit (psia) − modelled P_bh',
  'Differential = modelled flowing P_bh − measured static P_res (BHP test on its confirmed basis)']);
export const LIMITATIONS=Object.freeze([SCREENING_TEXT,
  'Surface pressures are H-10 monthly figures read on the user-confirmed basis; the regulatory margin compares the permit limit with the reported monthly maximum on that same basis.',
  RATE_NOTE,
  'Tubing size, roughness, temperatures and salinity are declared assumptions, not public records; the well is treated as vertical (MD = TVD).',
  `BHP tests are treated as static shut-in readings (RRC Permian guidance); the source does not state the test type. The ${DIFFERENTIAL_LABEL}.`,
  `The permit-equivalent bottomhole pressure ${PERMIT_EQ_LABEL}.`,
  `Formation margin: ${FORMATION_TEXT}; no fracture-pressure or formation-limit evidence is used.`,
  'Rate in bbl/day is treated as STB/day.']);
const R=RECON_REASONS;
export type ReportDepth={depthFt:number|null;source:string};
export type ReconPermit={surfacePsi:number|null;topDepthFt:number|null};
export type ReconInputs={h10:DiagnosticsState|null;tests:TestState;well:WellAssumptions;j:Estimate|null;permit:ReconPermit;declaredLimit:DeclaredLimit|null};
export type Deps={flowingAt:typeof flowingAt};
export type Band={min:number;max:number};
export type TestMonth={key:string;date:string;depthFt:number;reportedPsi:number;pResPsia:number|null;differentialPsi:number|null;band:Band|null;negative:boolean;reason:string|null;
  testGradientPsiFt:number;columnGradientPsiFt:number|null;checklist:string[]};
export type MonthRow={month:string;status:'included'|'excluded'|'gap';rateBpd:number|null;avgPsi:number|null;maxPsi:number|null;surfacePsia:number|null;
  regulatory:{marginPsi:number|null;reason:string|null;abovePermit:boolean};
  modelled:{pwfPsia:number|null;hydroPsi:number|null;frictionPsi:number|null;band:Band|null;reason:string|null};
  permitEquivalent:{pwfPsia:number|null;marginPsi:number|null;reason:string|null};declared:{marginPsi:number|null;reason:string|null};tests:TestMonth[]};
export type ReconCounts={months:number;included:number;modelled:number;refused:Record<string,number>;testMonths:number;negativeDifferentials:number;abovePermit:number};
export type Reconciliation={version:typeof RECONCILIATION_VERSION;label:typeof LABEL_RECON;screening:typeof SCREENING_TEXT;surfaceBasis:BasisConfirmation|null;bhpBasis:BasisConfirmation|null;
  assumptions:Assumptions;reportDepth:ReportDepth;permit:ReconPermit;declaredLimit:DeclaredLimit|null;srtPresent:boolean;formation:typeof FORMATION_TEXT;notes:string[];
  rows:MonthRow[];summary:{minRegulatoryPsi:number|null;minPermitEquivalentPsi:number|null;minDeclaredPsi:number|null};counts:ReconCounts;readiness:string};

const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export function reportDepth(tests:Pick<TestState,'referenceDepthFt'|'referenceTie'>,permittedTopFt:number|null):ReportDepth{
  if(tests.referenceDepthFt!==null&&!tests.referenceTie)return {depthFt:tests.referenceDepthFt,source:'BHP test depth'};
  const top=finite(permittedTopFt)&&permittedTopFt>=1&&permittedTopFt<=50000?permittedTopFt:null,tie=tests.referenceTie?'; BHP test depths tie':'';
  return top!==null?{depthFt:top,source:'permitted top of interval (RRC guidance)'+tie}:{depthFt:null,source:'none'+tie};
}
function run(deps:Deps,depth:number,a:Assumptions,rate:number,surfacePsia:number,id?:number):Flowing|{reason:string}{
  if(surfacePsia<MIN_TRAVERSE_PSIA)return {reason:R.floor};
  try{return deps.flowingAt(depth,a,rate,surfacePsia,id);}
  catch(error){if(error instanceof TraverseError&&error.code==='numerical')return {reason:R.notConverged};throw error;}
}
const minOf=(values:(number|null)[])=>{const f=values.filter(finite);return f.length?Math.min(...f):null;};
export function reconcile(inputs:ReconInputs,deps:Deps={flowingAt}):Reconciliation{
  const {h10,tests,well,j,permit,declaredLimit}=inputs,a=pickAssumptions(well),depth=reportDepth(tests,permit.topDepthFt),srtPresent=tests.records.some(r=>r.kind==='srt');
  const head={version:RECONCILIATION_VERSION,label:LABEL_RECON,screening:SCREENING_TEXT,surfaceBasis:well.surfaceBasis?{...well.surfaceBasis}:null,bhpBasis:j?.basis?{...j.basis}:null,
    assumptions:a,reportDepth:depth,permit:{...permit},declaredLimit:declaredLimit?{...declaredLimit}:null,srtPresent,formation:FORMATION_TEXT,notes:[RATE_NOTE,...(srtPresent?[SRT_NOTE]:[])]} as const;
  const empty=(readiness:string):Reconciliation=>({...head,notes:[...head.notes],rows:[],summary:{minRegulatoryPsi:null,minPermitEquivalentPsi:null,minDeclaredPsi:null},
    counts:{months:0,included:0,modelled:0,refused:{},testMonths:0,negativeDifferentials:0,abovePermit:0},readiness});
  if(!h10||!h10.months.length)return empty('No H-10 months; nothing to reconcile.');
  if(!well.surfaceBasis)return empty(SURFACE_BASIS_PROMPT);
  const basis=well.surfaceBasis.value,permitPsi=finite(permit.surfacePsi)&&permit.surfacePsi>0?permit.surfacePsi:null;
  const jTests:TestEstimate[]=(j?.tests??[]).filter(t=>t.month!==null&&t.status!=='unmatched'&&t.date!==null&&finite(t.depthFt)&&finite(t.reportedPsi));
  const rows=h10.months.map((m:MonthRecord):MonthRow=>{
    const status:MonthRow['status']=m.gap?'gap':h10.decisions[m.month]?.include===true?'included':'excluded';
    const why=status==='gap'?R.gap:R.excluded;
    const row:MonthRow={month:m.month,status,rateBpd:m.rateBpd,avgPsi:m.avgPsi,maxPsi:m.maxPsi,surfacePsia:null,regulatory:{marginPsi:null,reason:why,abovePermit:false},
      modelled:{pwfPsia:null,hydroPsi:null,frictionPsi:null,band:null,reason:why},permitEquivalent:{pwfPsia:null,marginPsi:null,reason:why},declared:{marginPsi:null,reason:why},tests:[]};
    if(status!=='included')return row;
    const injecting=finite(m.rateBpd)&&m.rateBpd>0;
    row.regulatory=permitPsi===null?{marginPsi:null,reason:R.noPermit,abovePermit:false}:!injecting?{marginPsi:null,reason:R.notApplicable,abovePermit:false}:
      !finite(m.maxPsi)?{marginPsi:null,reason:R.noMax,abovePermit:false}:{marginPsi:permitPsi-m.maxPsi,reason:null,abovePermit:permitPsi-m.maxPsi<0};
    const refuse=(reason:string)=>{row.modelled={pwfPsia:null,hydroPsi:null,frictionPsi:null,band:null,reason};};
    if(depth.depthFt===null)refuse(R.noDepth);
    else if(!injecting)refuse(R.noInjection);
    else if(!finite(m.avgPsi))refuse(R.noAvg);
    else{
      const d=depth.depthFt,q=m.rateBpd!,surfacePsia=toAbsolute(m.avgPsi,basis);row.surfacePsia=surfacePsia;
      const f=run(deps,d,a,q,surfacePsia);
      if('reason' in f)refuse(f.reason);
      else{
        const values=[f.pwf];
        const alt=run(deps,d,a,q,toAbsolute(m.avgPsi,otherBasis(basis)));if(!('reason' in alt))values.push(alt.pwf);
        for(const id of TUBING_SENSITIVITY_IN){if(id===a.innerDiameterInches)continue;const t=run(deps,d,a,q,surfacePsia,id);if(!('reason' in t))values.push(t.pwf);}
        row.modelled={pwfPsia:f.pwf,hydroPsi:f.hydro,frictionPsi:f.friction,band:{min:Math.min(...values),max:Math.max(...values)},reason:null};
      }
    }
    const pwf=row.modelled.pwfPsia;
    if(pwf===null){row.permitEquivalent={pwfPsia:null,marginPsi:null,reason:R.noModel};row.declared={marginPsi:null,reason:R.noModel};}
    else{
      if(permitPsi===null)row.permitEquivalent={pwfPsia:null,marginPsi:null,reason:R.noPermit};
      else{const pe=run(deps,depth.depthFt!,a,m.rateBpd!,toAbsolute(permitPsi,basis));row.permitEquivalent='reason' in pe?{pwfPsia:null,marginPsi:null,reason:pe.reason}:{pwfPsia:pe.pwf,marginPsi:pe.pwf-pwf,reason:null};}
      row.declared=declaredLimit===null?{marginPsi:null,reason:R.noLimit}:Math.abs(declaredLimit.depthFt-depth.depthFt!)>LIMIT_DATUM_TOLERANCE_FT?{marginPsi:null,reason:R.limitDatum}:{marginPsi:declaredLimit.psia-pwf,reason:null};
    }
    row.tests=jTests.filter(t=>t.month===m.month).map((t):TestMonth=>{
      const out:TestMonth={key:t.key,date:t.date!,depthFt:t.depthFt!,reportedPsi:t.reportedPsi!,pResPsia:null,differentialPsi:null,band:null,negative:false,reason:null,
        testGradientPsiFt:t.reportedPsi!/t.depthFt!,columnGradientPsiFt:row.modelled.hydroPsi===null?null:row.modelled.hydroPsi/depth.depthFt!,checklist:[]};
      if(pwf===null)return {...out,reason:R.noModel};
      if(!j!.basis)return {...out,reason:R.bhpBasis};
      if(Math.abs(t.depthFt!-depth.depthFt!)>DEPTH_TOLERANCE_FT)return {...out,reason:R.testDepth};
      const pRes=toAbsolute(t.reportedPsi!,j!.basis.value),diff=pwf-pRes,band=row.modelled.band;
      return {...out,pResPsia:pRes,differentialPsi:diff,band:band?{min:band.min-pRes,max:band.max-pRes}:null,negative:diff<0,checklist:diff<0?[...CAUSE_CHECKLIST]:[]};
    });
    return row;
  });
  const inc=rows.filter(r=>r.status==='included'),refused:Record<string,number>={};
  for(const r of inc)if(r.modelled.pwfPsia===null)refused[r.modelled.reason!]=(refused[r.modelled.reason!]??0)+1;
  const counts:ReconCounts={months:rows.length,included:inc.length,modelled:inc.filter(r=>r.modelled.pwfPsia!==null).length,refused,testMonths:rows.filter(r=>r.tests.length>0).length,
    negativeDifferentials:rows.reduce((s,r)=>s+r.tests.filter(t=>t.negative).length,0),abovePermit:rows.filter(r=>r.regulatory.abovePermit).length};
  return {...head,notes:[...head.notes],rows,
    summary:{minRegulatoryPsi:minOf(inc.map(r=>r.regulatory.marginPsi)),minPermitEquivalentPsi:minOf(inc.map(r=>r.permitEquivalent.marginPsi)),minDeclaredPsi:minOf(inc.map(r=>r.declared.marginPsi))},
    counts,readiness:`${counts.modelled} of ${counts.included} included months modelled at ${depth.depthFt===null?'no report depth':`${depth.depthFt} ft (${depth.source})`}.`};
}
```

If `MonthRecord` is not exported from `h10Diagnostics.ts`, use `DiagnosticsState['months'][number]` instead. Do not edit `h10Diagnostics.ts`.

- [ ] **Step 4:** Build and run `node --test tests/pressure-reconciliation.test.mjs`. Expected: all pass.
  - **Arithmetic for the `notConverged` count of 7:** the fixture has 8 months, 2024-05 is excluded, and the stub throws for every included month.
  - **If a fixture assertion fails on a number, do not change the expected value.** Report it with the observed value in the ledger.

- [ ] **Step 5:** Check that the full suite passes, except the known `injectivity-session` failures until Task 4. Check CR bytes are 0. Report. Do not commit.

---

### Task 3: Reconciliation chart and sealed export

**Files:**
- Create: `src/pressureReconciliationChart.ts`, `src/pressureReconciliationExport.ts`, `tests/pressure-reconciliation-export.test.mjs`.

**Interfaces:**
- **Consumes:** `Reconciliation`, `LABEL_RECON`, `SCREENING_TEXT`, `RATE_NOTE`, `PERMIT_EQ_LABEL`, `RECONCILIATION_VERSION`, `FORMULAS` and `LIMITATIONS` from Task 2.
- **Produces:**
  - `reconciliationSvg(rec)` → `{svg, height}`;
  - `ReconSource`, `SealedReconciliation`;
  - `sealReconciliation(rec, source)`, `verifyReconciliationSealed(sealed)`;
  - `reconciliationJson(sealed)`, `reconciliationCsv(sealed)`, `reconciliationSvgExport(sealed, rec)`.

- [ ] **Step 1: Write the failing test** `tests/pressure-reconciliation-export.test.mjs`:

```js
import test from 'node:test';import assert from 'node:assert/strict';
import {reconcile} from '../dist/pressureReconciliation.js';
import {reconciliationSvg} from '../dist/pressureReconciliationChart.js';
import {sealReconciliation,verifyReconciliationSealed,reconciliationJson,reconciliationCsv,reconciliationSvgExport} from '../dist/pressureReconciliationExport.js';
import {createEstimateState,confirmBasis,setSurfaceBasis,estimate} from '../dist/injectivityEstimate.js';
import {DEFAULT_WELL_ASSUMPTIONS} from '../dist/wellAssumptions.js';
import {fixtureInputs,monthlyRow,bhpRow} from './helpers/injectivity-fixture.mjs';

const WELL={...DEFAULT_WELL_ASSUMPTIONS,surfaceBasis:{value:'psig',reason:'RRC H-10 reports gauge pressure'}};
const banned=new RegExp('calib'+'rated','i');
const recFor=(inputs=fixtureInputs(),extra={})=>reconcile({h10:inputs.h10,tests:inputs.tests,well:WELL,j:estimate(confirmBasis(setSurfaceBasis(createEstimateState(inputs),WELL.surfaceBasis),'psig','RRC')),
 permit:{surfacePsi:1176,topDepthFt:3000},declaredLimit:null,...extra});
const source={uic:'000000417',artifactId:'synthetic',normalizedSha256:null,manifestSha256:null,h10Decisions:{},tests:{packageFiles:{},uploads:[],inclusions:{}},jMatches:{}};

test('sealed export verifies and records method, screening text, assumptions, formulas and limitations',async()=>{
 const s=await sealReconciliation(recFor(),source);
 assert.equal(s.schemaVersion,'pressure-reconciliation-export/1');assert.equal(s.method,'pressure-reconciliation/1');assert.equal(s.label,'WHP/BHP reconciliation (screening)');
 assert.equal(s.screening,'Screening only: not a regulatory approval, compliance finding or safe-operating determination.');assert.deepEqual(s.surfaceBasis,WELL.surfaceBasis);
 assert.ok(s.formulas.length>=5);assert.ok(s.limitations.length>=8);assert.equal(s.units.pressure,'psia unless named psi (as reported, on the confirmed basis)');
 assert.equal(await verifyReconciliationSealed(JSON.parse(reconciliationJson(s))),true);
});
test('tampering is detected',async()=>{
 const s=JSON.parse(reconciliationJson(await sealReconciliation(recFor(),source)));s.rows[1].regulatory.marginPsi=9999;assert.equal(await verifyReconciliationSealed(s),false);
});
test('CSV escapes formula-like text, marks missing values "unavailable" and carries the screening text',async()=>{
 const csv=reconciliationCsv(await sealReconciliation(recFor(),{...source,artifactId:'=HYPERLINK("x")'}));
 assert.match(csv,/"'=HYPERLINK\(""x""\)"/);assert.match(csv,/"unavailable"/);assert.match(csv,/Screening only: not a regulatory approval/);assert.ok(csv.endsWith('\r\n'));
});
test('no produced text uses the banned word',async()=>{
 const rec=recFor(),s=await sealReconciliation(rec,source);
 assert.doesNotMatch(reconciliationJson(s),banned);assert.doesNotMatch(reconciliationCsv(s),banned);assert.doesNotMatch(reconciliationSvgExport(s,rec),banned);
});
test('chart: title, one diamond per test with a measured-static label, a break at a gap, negative bars marked',()=>{
 const c=reconciliationSvg(recFor());assert.match(c.svg,/WHP\/BHP reconciliation \(screening\) by month/);
 assert.equal((c.svg.match(/data-series="test"/g)??[]).length,2);assert.match(c.svg,/measured static/);
 const gap=fixtureInputs({monthly:[monthlyRow('2024-01',10000,900),monthlyRow('2024-02',10000,900),monthlyRow('2024-04',10000,900),monthlyRow('2024-05',10000,900)]});
 const d=reconciliationSvg(recFor(gap)).svg.match(/data-series="modelled" d="([^"]+)"/)[1];assert.equal((d.match(/M/g)??[]).length,2,'the line breaks at the 2024-03 gap');
 const neg=reconciliationSvg(recFor(fixtureInputs(),{permit:{surfacePsi:900,topDepthFt:null}})).svg;assert.ok((neg.match(/data-negative="true"/g)??[]).length>=1);
 const empty=reconciliationSvg(reconcile({h10:null,tests:fixtureInputs().tests,well:WELL,j:null,permit:{surfacePsi:null,topDepthFt:null},declaredLimit:null}));assert.match(empty.svg,/No months to chart/);
});
test('export SVG embeds the sealed JSON as metadata around the chart',async()=>{
 const rec=recFor(),s=await sealReconciliation(rec,source),svg=reconciliationSvgExport(s,rec);
 assert.match(svg,/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);assert.match(svg,/<metadata>/);assert.match(svg,new RegExp(s.contentSha256));
});
test('sealing is refused before the surface basis is confirmed',async()=>{
 const inputs=fixtureInputs();const rec=reconcile({h10:inputs.h10,tests:inputs.tests,well:DEFAULT_WELL_ASSUMPTIONS,j:null,permit:{surfacePsi:1176,topDepthFt:null},declaredLimit:null});
 await assert.rejects(sealReconciliation(rec,source),/Confirm the H-10 and permit pressure basis/);
});
```

- [ ] **Step 2:** Build and run the test. Expected: FAIL, module not found.

- [ ] **Step 3:** Create `src/pressureReconciliationChart.ts`:

```ts
import {LABEL_RECON,RATE_NOTE,PERMIT_EQ_LABEL,SCREENING_TEXT,type Reconciliation} from './pressureReconciliation.js';

/** Pure SVG; escaped text only. Top: modelled flowing BHP with its sensitivity band, permit-equivalent (dashed), declared limit and BHP tests. Bottom: regulatory margin bars. No thinning; gaps break the lines. */
export type ChartSvg={svg:string;height:number};
const W=960,L=78,R=40,PW=W-L-R,TOP=58,PH1=240,GAP=56,PH2=140;
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
const n=(v:number)=>v.toFixed(2),fmt=(v:number)=>Number(v.toPrecision(4)).toLocaleString('en-US');
const num=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
function niceMax(max:number){if(!(max>0))return 1;const pow=10**Math.floor(Math.log10(max));return [1,2,2.5,5,10].map(s=>s*pow).find(s=>s>=max)!;}
function frame(title:string,lines:string[],body:string,bodyHeight:number):ChartSvg{
  const notesY=TOP+bodyHeight+40,height=notesY+lines.length*18+16;
  const notes=lines.map((t,i)=>`<text x="${L}" y="${notesY+i*18}" font-size="12" fill="#37474f">${esc(t)}</text>`).join('');
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${height}" width="${W}" height="${height}" role="img" aria-label="${esc(title)}" font-family="system-ui, sans-serif"><rect width="${W}" height="${height}" fill="#ffffff"/><text x="${L}" y="26" font-size="16" font-weight="600">${esc(title)}</text>${body}${notes}</svg>`,height};
}
function path(series:string,points:(number|null)[],x:(i:number)=>number,y:(v:number)=>number,style:string){
  let d='',open=false;points.forEach((v,i)=>{if(v===null){open=false;return;}d+=`${open?'L':'M'}${n(x(i))} ${n(y(v))} `;open=true;});
  return d?`<path data-series="${series}" d="${d.trim()}" fill="none" ${style}/>`:'';
}
export function reconciliationSvg(rec:Reconciliation):ChartSvg{
  const title=`${LABEL_RECON} by month`,depth=rec.reportDepth;
  const notes=['Line: modelled flowing BHP; band: tubing and basis sensitivity; diamonds: BHP test (measured static); bars: permit minus reported maximum.',
    `Report depth: ${depth.depthFt===null?'none':`${depth.depthFt} ft`} (${depth.source}).`,RATE_NOTE,`Dashed: permit-equivalent bottomhole pressure (${PERMIT_EQ_LABEL}).`,SCREENING_TEXT];
  const rows=rec.rows;
  if(!rows.length)return frame(title,notes,`<text x="${L}" y="${TOP+40}" font-size="14">${esc(`No months to chart. ${rec.readiness}`)}</text>`,60);
  const x=(i:number)=>L+PW*(i+0.5)/rows.length;
  const tops=rows.flatMap(r=>[r.modelled.band?.max??null,r.modelled.pwfPsia,r.permitEquivalent.pwfPsia,...r.tests.map(t=>t.pResPsia)]).filter(num);
  if(rec.declaredLimit)tops.push(rec.declaredLimit.psia);
  const yMax=niceMax(Math.max(1,...tops)),y=(v:number)=>TOP+PH1-PH1*v/yMax;
  let body=`<line x1="${L}" y1="${TOP}" x2="${L}" y2="${TOP+PH1}" stroke="#90a4ae"/><line x1="${L}" y1="${TOP+PH1}" x2="${L+PW}" y2="${TOP+PH1}" stroke="#90a4ae"/>`;
  for(let i=0;i<=4;i++){const v=yMax*i/4,yy=TOP+PH1-PH1*i/4;body+=`<line x1="${L}" y1="${n(yy)}" x2="${L+PW}" y2="${n(yy)}" stroke="#eceff1"/><text x="${L-8}" y="${n(yy+4)}" font-size="11" text-anchor="end">${esc(fmt(v))}</text>`;}
  body+=`<text x="16" y="${TOP+PH1/2}" font-size="12" transform="rotate(-90 16 ${TOP+PH1/2})" text-anchor="middle">${esc('Bottomhole pressure (psia), modelled')}</text>`;
  rows.forEach((r,i)=>{const b=r.modelled.band;if(b)body+=`<line data-series="band" x1="${n(x(i))}" y1="${n(y(b.min))}" x2="${n(x(i))}" y2="${n(y(b.max))}" stroke="#90caf9" stroke-width="6" stroke-linecap="round"/>`;});
  body+=path('modelled',rows.map(r=>r.modelled.pwfPsia),x,y,'stroke="#1565c0" stroke-width="2"');
  body+=path('permit-equivalent',rows.map(r=>r.permitEquivalent.pwfPsia),x,y,'stroke="#6d4c41" stroke-width="1.5" stroke-dasharray="6 4"');
  if(rec.declaredLimit)body+=`<line data-series="declared" x1="${L}" y1="${n(y(rec.declaredLimit.psia))}" x2="${L+PW}" y2="${n(y(rec.declaredLimit.psia))}" stroke="#c62828" stroke-dasharray="2 3"/><text x="${L+PW}" y="${n(y(rec.declaredLimit.psia)-5)}" font-size="11" text-anchor="end">${esc(`Declared limit ${fmt(rec.declaredLimit.psia)} psia`)}</text>`;
  rows.forEach((r,i)=>{for(const t of r.tests){if(t.pResPsia===null)continue;const cx=x(i),cy=y(t.pResPsia);
    body+=`<path data-series="test" d="M${n(cx)} ${n(cy-6)} L${n(cx+6)} ${n(cy)} L${n(cx)} ${n(cy+6)} L${n(cx-6)} ${n(cy)} Z" fill="${t.negative?'#c62828':'#2e7d32'}"><title>${esc(`${t.date}: BHP test ${fmt(t.pResPsia)} psia (measured static)${t.negative?'; model below measured static pressure':''}`)}</title></path>`;}});
  const top2=TOP+PH1+GAP,margins=rows.map(r=>r.regulatory.marginPsi),mMax=niceMax(Math.max(1,...margins.filter(num).map(Math.abs))),zero=top2+PH2/2,bw=Math.max(2,PW/rows.length*0.6);
  body+=`<line x1="${L}" y1="${top2}" x2="${L}" y2="${top2+PH2}" stroke="#90a4ae"/><line x1="${L}" y1="${zero}" x2="${L+PW}" y2="${zero}" stroke="#90a4ae"/>`;
  body+=`<text x="${L-8}" y="${top2+4}" font-size="11" text-anchor="end">${esc(fmt(mMax))}</text><text x="${L-8}" y="${top2+PH2+4}" font-size="11" text-anchor="end">${esc(fmt(-mMax))}</text>`;
  body+=`<text x="16" y="${top2+PH2/2}" font-size="12" transform="rotate(-90 16 ${top2+PH2/2})" text-anchor="middle">${esc('Regulatory margin (psi)')}</text>`;
  margins.forEach((v,i)=>{if(v===null)return;const h=(PH2/2)*Math.abs(v)/mMax,yy=v>=0?zero-h:zero;
    body+=`<rect data-series="regulatory"${v<0?' data-negative="true"':''} x="${n(x(i)-bw/2)}" y="${n(yy)}" width="${n(bw)}" height="${n(Math.max(h,0.5))}" fill="${v<0?'#c62828':'#2e7d32'}"><title>${esc(`${rows[i].month}: ${fmt(v)} psi${v<0?' (reported maximum above permit limit)':''}`)}</title></rect>`;});
  body+=`<text x="${L}" y="${top2+PH2+16}" font-size="11">${esc(rows[0].month)}</text><text x="${L+PW}" y="${top2+PH2+16}" font-size="11" text-anchor="end">${esc(rows[rows.length-1].month)}</text>`;
  return frame(title,notes,body,PH1+GAP+PH2);
}
```

- [ ] **Step 4:** Create `src/pressureReconciliationExport.ts`:

```ts
import {RECONCILIATION_VERSION,LABEL_RECON,SCREENING_TEXT,FORMULAS,LIMITATIONS,type Reconciliation} from './pressureReconciliation.js';
import {SURFACE_BASIS_PROMPT} from './wellAssumptions.js';
import {reconciliationSvg} from './pressureReconciliationChart.js';

export type ReconSource={uic:string;artifactId:string;normalizedSha256:string|null;manifestSha256:string|null;h10Decisions:Record<string,{include:boolean;reason:string|null;byUser:boolean}>;
  tests:{packageFiles:Record<string,string>;uploads:{kind:string;fileName:string;sha256:string}[];inclusions:Record<string,boolean>};jMatches:Record<string,string|null>};
export type SealedReconciliation=Omit<Reconciliation,'version'>&{schemaVersion:'pressure-reconciliation-export/1';method:typeof RECONCILIATION_VERSION;source:ReconSource;
  units:Record<string,string>;formulas:string[];limitations:string[];contentSha256:string};
const UNITS=Object.freeze({pressure:'psia unless named psi (as reported, on the confirmed basis)',margin:'psi',rate:'bbl/day calendar-day average, treated as STB/day',depth:'ft (MD = TVD declared)',gradient:'psi/ft',diameterAndRoughness:'in',temperature:'°F',salinity:'NaCl wt%'});
async function sha256(text:string){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(h),b=>b.toString(16).padStart(2,'0')).join('');}
const body=(s:Omit<SealedReconciliation,'contentSha256'>|SealedReconciliation)=>{const {contentSha256:_,...rest}={contentSha256:'',...s};return JSON.stringify(rest);};

export async function sealReconciliation(rec:Reconciliation,source:ReconSource):Promise<SealedReconciliation>{
  if(!rec.surfaceBasis)throw new Error(SURFACE_BASIS_PROMPT);
  const {version:_,...rest}=JSON.parse(JSON.stringify(rec)) as Reconciliation;
  const unsealed={schemaVersion:'pressure-reconciliation-export/1' as const,method:RECONCILIATION_VERSION as typeof RECONCILIATION_VERSION,...rest,label:LABEL_RECON as typeof LABEL_RECON,screening:SCREENING_TEXT as typeof SCREENING_TEXT,
    source:JSON.parse(JSON.stringify(source)) as ReconSource,units:{...UNITS},formulas:[...FORMULAS],limitations:[...LIMITATIONS]};
  return {...unsealed,contentSha256:await sha256(body(unsealed))};
}
export async function verifyReconciliationSealed(sealed:SealedReconciliation):Promise<boolean>{return /^[a-f0-9]{64}$/.test(sealed?.contentSha256??'')&&await sha256(body(sealed))===sealed.contentSha256;}
export const reconciliationJson=(sealed:SealedReconciliation)=>JSON.stringify(sealed,null,2)+'\n';
const cell=(v:unknown)=>{
  if(v===null||v===undefined)return '"unavailable"';
  if(typeof v==='number')return `"${v}"`;
  let s=String(v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;
  return `"${s.replace(/"/g,'""')}"`;
};
export function reconciliationCsv(sealed:SealedReconciliation):string{
  const src=sealed.source,d=sealed.reportDepth;
  const lines:unknown[][]=[['WHP/BHP reconciliation export',sealed.method],['Label',sealed.label],['Screening',sealed.screening],['UIC',src.uic],['Package artifact',src.artifactId],
    ['Normalized SHA-256',src.normalizedSha256],['Manifest SHA-256',src.manifestSha256],...Object.entries(src.tests.packageFiles).map(([name,hash])=>['Package file SHA-256',`${name} ${hash}`]),
    ...src.tests.uploads.map(u=>['Upload (not verified)',`${u.kind} ${u.fileName} ${u.sha256}`]),['Content SHA-256',sealed.contentSha256],['Notice','"unavailable" marks a missing value, never zero'],
    ['Surface basis (H-10 and permit)',sealed.surfaceBasis?`${sealed.surfaceBasis.value} (reason: ${sealed.surfaceBasis.reason})`:null],['BHP basis',sealed.bhpBasis?`${sealed.bhpBasis.value} (reason: ${sealed.bhpBasis.reason})`:null],
    ...Object.entries(sealed.assumptions).map(([k,v])=>['Assumption',`${k} ${v}`]),['Report depth (ft)',d.depthFt],['Report depth source',d.source],
    ['Permit pressure limit (psi)',sealed.permit.surfacePsi],['Permitted top depth (ft)',sealed.permit.topDepthFt],
    ['Declared bottomhole limit (psia)',sealed.declaredLimit?.psia??null],['Declared limit depth (ft)',sealed.declaredLimit?.depthFt??null],['Declared limit reason',sealed.declaredLimit?.reason??null],
    ['Formation margin',sealed.formation],['Readiness',sealed.readiness],...sealed.formulas.map(f=>['Formula',f]),...sealed.limitations.map(l=>['Limitation',l]),[],
    ['Month','Status','Rate (bbl/day)','Average (psi)','Maximum (psi)','Surface (psia)','Regulatory margin (psi)','Regulatory reason','Modelled BHP (psia)','Hydrostatic (psi)','Friction (psi)',
      'Band min (psia)','Band max (psia)','Modelled reason','Permit-equivalent BHP (psia)','Permit-equivalent margin (psi)','Permit-equivalent reason','Declared margin (psi)','Declared reason'],
    ...sealed.rows.map(r=>[r.month,r.status,r.rateBpd,r.avgPsi,r.maxPsi,r.surfacePsia,r.regulatory.marginPsi,r.regulatory.reason,r.modelled.pwfPsia,r.modelled.hydroPsi,r.modelled.frictionPsi,
      r.modelled.band?.min??null,r.modelled.band?.max??null,r.modelled.reason,r.permitEquivalent.pwfPsia,r.permitEquivalent.marginPsi,r.permitEquivalent.reason,r.declared.marginPsi,r.declared.reason]),[],
    ['Test','Month','Date','Depth (ft)','Reported BHP (psi, as reported)','P_res (psia)','Differential (psi)','Band min (psi)','Band max (psi)','Negative','Reason','Test gradient (psi/ft)','Column gradient (psi/ft)'],
    ...sealed.rows.flatMap(r=>r.tests.map(t=>[t.key,r.month,t.date,t.depthFt,t.reportedPsi,t.pResPsia,t.differentialPsi,t.band?.min??null,t.band?.max??null,t.negative?'yes':'no',t.reason,t.testGradientPsiFt,t.columnGradientPsiFt]))];
  return lines.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
const escXml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
export function reconciliationSvgExport(sealed:SealedReconciliation,rec:Reconciliation):string{
  const a=reconciliationSvg(rec);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 ${a.height}" width="960" height="${a.height}"><metadata>${escXml(JSON.stringify(sealed))}</metadata><svg y="0" width="960" height="${a.height}">${a.svg}</svg></svg>`;
}
```

- [ ] **Step 5:** Build and run `node --test tests/pressure-reconciliation-export.test.mjs tests/pressure-reconciliation.test.mjs`. Expected: all pass. Check CR bytes are 0. Report. Do not commit.

---

### Task 4: Well assumptions session and panel; the J session and panel on the shared assumptions

**Files:**
- Create: `web/well-assumptions.mjs`.
- Modify: `web/injectivity.mjs`, `tests/injectivity-session.test.mjs`, `tests/panel-hooks.test.mjs`.

**Interfaces:**
- **Consumes:** Task 1 exports.
- **Produces:**
  - `createWellAssumptionsSession(initial?)` → `{state, revision, confirmBasis(value,reason), set(partial)}`;
  - `mountWellAssumptions(root, {onChange})` → `{state, dispose()}`;
  - `ASSUMPTION_FIELDS`;
  - `createInjectivitySession({selection,gate,h10,tests,uploads,well,declaredLimit})`. Its `update(inputs)` accepts optional `well` and `declaredLimit`, and it gains a `declaredLimit` getter.
  - `mountInjectivity(root,{…,well,declaredLimit,onHandoff})` returns `{dispose, update, estimate}`, where `estimate` is a getter that returns `null` on failure.

- [ ] **Step 1: Write the failing tests.**
  1. In `tests/injectivity-session.test.mjs`:
     - Add `import {DEFAULT_WELL_ASSUMPTIONS} from '../dist/wellAssumptions.js';` and `import {createWellAssumptionsSession} from '../web/well-assumptions.mjs';`.
     - Replace line 9 with:

```js
const WELL={...DEFAULT_WELL_ASSUMPTIONS,surfaceBasis:{value:'psig',reason:'RRC H-10 reports gauge pressure'}};
const make=(gate=ready,inputs=fixtureInputs())=>createInjectivitySession({selection,gate,well:WELL,...inputs});
```

     - In the test `'no H-10 rows: every test is unmatched…'`, add `well:WELL,` to the `createInjectivitySession({…})` call.
  2. Append to `tests/injectivity-session.test.mjs`:

```js
test('2a: without the shared surface basis the J waits for it; a well update supplies it and bumps the revision',()=>{
 const s=createInjectivitySession({selection,gate:ready,...fixtureInputs()});s.confirmBasis('psig','x');
 assert.equal(s.estimate.readiness,'Confirm the H-10 and permit pressure basis in Well assumptions.');const r=s.revision;
 s.update({...fixtureInputs(),well:WELL});assert.equal(s.revision,r+1);assert.deepEqual(s.estimate.qualifying,['package:bhp:1','package:bhp:2']);
 s.update({...fixtureInputs(),well:{...WELL,surfaceBasis:{value:'psia',reason:'absolute'}}});assert.ok(Math.abs(s.estimate.tests[0].surfacePsia-900)<1e-9);
 s.update({...fixtureInputs(),well:{...WELL,salinityWtPercent:12}});assert.equal(s.state.assumptions.salinityWtPercent,12);
});
test('2a: an update without well or declaredLimit keeps the current ones',()=>{
 const s=make();s.confirmBasis('psig','x');s.update({...fixtureInputs(),declaredLimit:{psia:4000,depthFt:3310,reason:'design'}});
 s.update(fixtureInputs());assert.deepEqual(s.state.surfaceBasis,WELL.surfaceBasis);assert.deepEqual(s.declaredLimit,{psia:4000,depthFt:3310,reason:'design'});
});
test('2a: the declared limit reaches the hand-off',async()=>{
 const s=make();s.confirmBasis('psig','x');s.update({...fixtureInputs(),declaredLimit:{psia:4000,depthFt:3310,reason:'design'}});
 const h=await s.handoffRequest();assert.equal(h.values.limitPsia,4000);assert.equal(h.origins.limitPsia,'Declared by the user in WHP/BHP reconciliation (design)');
});
test('2a: well-assumptions session confirms the basis, validates edits and counts revisions',()=>{
 const w=createWellAssumptionsSession();assert.equal(w.state.surfaceBasis,null);assert.equal(w.revision,0);
 assert.throws(()=>w.confirmBasis('psig',''),/reason/);assert.equal(w.revision,0);
 w.confirmBasis('psig','RRC gauge');assert.deepEqual(w.state.surfaceBasis,{value:'psig',reason:'RRC gauge'});assert.equal(w.revision,1);
 assert.throws(()=>w.set({salinityWtPercent:25}));assert.equal(w.revision,1);w.set({salinityWtPercent:12});assert.equal(w.state.salinityWtPercent,12);assert.equal(w.revision,2);
});
```

  3. In `tests/panel-hooks.test.mjs`, replace the test `'final review I-3: the basis and assumptions fieldsets are built before the try…'` with:

```js
test('final review I-3 (2a): the J basis fieldset is built before the try; the assumptions form now lives in Well assumptions',async()=>{
 const src=await readFile('web/injectivity.mjs','utf8'),tryAt=src.indexOf('try{\n   const est=session.estimate');
 assert.ok(tryAt>0);assert.ok(src.indexOf("'Pressure basis of the BHP field")>0&&src.indexOf("'Pressure basis of the BHP field")<tryAt);
 assert.ok(!src.includes("'Declared assumptions (not public records)'"));
 const wa=await readFile('web/well-assumptions.mjs','utf8');assert.ok(wa.includes("'Declared assumptions (not public records)'"));assert.ok(wa.includes("'Pressure basis of H-10 and permit pressures (required before any calculation)'"));
});
```

- [ ] **Step 2:** Run `node --test tests/injectivity-session.test.mjs tests/panel-hooks.test.mjs`. Expected: FAIL (`web/well-assumptions.mjs` not found; the `well` input is ignored).

- [ ] **Step 3:** Create `web/well-assumptions.mjs`:

```js
import {DEFAULT_WELL_ASSUMPTIONS,DEFAULT_ASSUMPTIONS,DEPTH_STATEMENT,confirmSurfaceBasis,setWellAssumptions} from '../dist/wellAssumptions.js';
import {TUBING_SENSITIVITY_IN} from '../dist/injectivityEstimate.js';

export const ASSUMPTION_FIELDS=[['innerDiameterInches','Tubing inner diameter (in)'],['roughnessInches','Absolute roughness (in)'],['surfaceTemperatureF','Surface temperature (°F)'],['bottomholeTemperatureF','Bottomhole temperature (°F)'],['salinityWtPercent','NaCl salinity (wt%)'],['segments','Traverse segments']];

/** DOM-free session: one declared set of well assumptions and the H-10 and permit pressure basis, shared by the J estimate and the reconciliation. */
export function createWellAssumptionsSession(initial=DEFAULT_WELL_ASSUMPTIONS){
 let state={...initial},revision=0;
 return {get state(){return state;},get revision(){return revision;},
  confirmBasis(value,reason){state=confirmSurfaceBasis(state,value,reason);revision++;},
  set(partial){state=setWellAssumptions(state,partial);revision++;}};
}

const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};

/** Panel inside Injector history, between Test records and the J panel. import-ui disposes it whenever results are cleared. */
export function mountWellAssumptions(root,{onChange=()=>{}}={}){
 const session=createWellAssumptionsSession(),section=el('section',undefined,'panel');section.setAttribute('aria-labelledby','well-assumptions-title');
 const h=el('h2','Well assumptions');h.id='well-assumptions-title';
 const statusEl=el('p');statusEl.setAttribute('role','status');const body=el('div');
 section.append(h,statusEl,body);root.replaceChildren(section);
 let disposed=false,focusKey=null;const drafts=new Map();
 const setStatus=t=>{statusEl.textContent=t;};
 const draft=(key,input,persisted)=>{input.dataset.focusKey=key;input.value=drafts.has(key)?drafts.get(key):(persisted??'');input.addEventListener('input',()=>drafts.set(key,input.value));return input;};
 const act=(key,fn,ok)=>{let changed=false;try{fn();drafts.delete(key+':reason');setStatus(ok);changed=true;}catch(e){setStatus(e.message);}focusKey=key;render();
  if(changed){try{onChange(session.state);}catch(e){console.error(e);}}};
 function render(){
  if(disposed)return;
  const s=session.state,page=el('div');
  page.append(el('p','One declared set for the test-referenced J estimate and the WHP/BHP reconciliation below.'));
  const basis=el('fieldset');basis.append(el('legend','Pressure basis of H-10 and permit pressures (required before any calculation)'));
  const radios={};for(const [v,label] of [['psig','psig (RRC reports gauge pressure, default)'],['psia','psia']]){const l=el('label'),r=el('input');r.type='radio';r.name='surface-basis';r.value=v;r.checked=(s.surfaceBasis?.value??'psig')===v;r.dataset.focusKey='surface-basis:'+v;radios[v]=r;l.append(r,document.createTextNode(' '+label));basis.append(l);}
  const why=el('input');why.type='text';why.maxLength=200;draft('surface-basis:reason',why,s.surfaceBasis?.reason);why.placeholder='reason (required)';why.setAttribute('aria-label','Reason for the H-10 and permit basis');
  const confirm=el('button',s.surfaceBasis?'Change basis':'Confirm basis');confirm.type='button';confirm.dataset.focusKey='surface-basis';
  confirm.onclick=()=>act('surface-basis',()=>session.confirmBasis(radios.psia.checked?'psia':'psig',why.value),'H-10 and permit basis confirmed.');
  basis.append(why,confirm,el('p',s.surfaceBasis?`Confirmed: ${s.surfaceBasis.value} (${s.surfaceBasis.reason}).`:'Not confirmed: nothing is calculated until you confirm.'));
  const form=el('fieldset');form.append(el('legend','Declared assumptions (not public records)'));
  for(const [key,label] of ASSUMPTION_FIELDS){const l=el('label',label+' — declared assumption '),i=el('input');i.type='number';i.step='any';i.value=String(s[key]);i.setAttribute('aria-label',`${label}, declared assumption`);i.dataset.focusKey='assump:'+key;
   i.onchange=()=>act('assump:'+key,()=>session.set({[key]:Number(i.value)}),`${label} updated.`);l.append(i);form.append(l);}
  form.append(el('p',`Defaults: ${Object.entries(DEFAULT_ASSUMPTIONS).map(([k,v])=>`${k} ${v}`).join(', ')}. ${DEPTH_STATEMENT} Tubing sensitivity always runs ${TUBING_SENSITIVITY_IN.join(', ')} in.`));
  page.append(basis,form);
  body.replaceChildren(...page.childNodes);
  if(focusKey){const t=section.querySelector(`[data-focus-key="${focusKey}"]`);if(t)t.focus();focusKey=null;}
 }
 render();
 return {get state(){return session.state;},dispose(){disposed=true;root.replaceChildren();}};
}
```

- [ ] **Step 4:** Edit `web/injectivity.mjs`.
  1. Replace line 1 with:

```js
import {createEstimateState,withInputs,confirmBasis,setSurfaceBasis,setAssumptions,moveMatch,chooseJ,estimate,handoff,LABEL_J,BASIS_STATEMENT} from '../dist/injectivityEstimate.js';
import {DEFAULT_WELL_ASSUMPTIONS} from '../dist/wellAssumptions.js';
```

  2. Replace lines 9–23, from the session doc comment through the `update(inputs){…},` line, with:

```js
/** DOM-free session: BHP basis, moved matches and the chosen J over the live 1a/1b states and the shared well assumptions; revision counter and stale refusal. */
export function createInjectivitySession({selection,gate,h10,tests,uploads=[],well=DEFAULT_WELL_ASSUMPTIONS,declaredLimit=null}){
 const artifact=selection.artifact,inv=artifact.inventory?.[0]??{},uic=String(artifact.injectionMonthly?.[0]?.uic_number??inv.uic_number??'');
 const permit={surfacePsi:num(inv.permit_liquid_pressure_limit_psi),volumeBpd:num(inv.permit_liquid_volume_limit_bpd)};
 const source={uic,artifactId:String(artifact.artifactId),normalizedSha256:selection.pin?.normalizedSha256??null,manifestSha256:selection.pin?.manifestSha256??null,tests:{packageFiles:{...(selection.tests?.sha256??{})},uploads:[]}};
 const applyWell=(s,w)=>setSurfaceBasis(setAssumptions(s,w),w.surfaceBasis??null);
 let state=applyWell(createEstimateState({h10,tests}),well),revision=0,alive=true,uploadList=copyUploads(uploads),limit=declaredLimit;
 // Compute the estimate before committing: a failing recomputation rejects with its message and leaves state and revision unchanged.
 const change=next=>{estimate(next);state=next;revision++;};
 const sealSource=()=>{
  if(state.inputs.tests.records.some(r=>r.origin==='upload')&&!uploadList.length)throw new Error('Sealing refused: uploaded test records are present but their upload provenance (file name and SHA-256) was not supplied.');
  return {...source,tests:{packageFiles:{...source.tests.packageFiles},uploads:uploadList.map(u=>({...u}))}};
 };
 const session={
  get state(){return state;},get estimate(){return estimate(state);},get revision(){return revision;},get uploads(){return uploadList.map(u=>({...u}));},get declaredLimit(){return limit;},gate,uic,
  update(inputs){let next=withInputs(state,{h10:inputs.h10,tests:inputs.tests});if(inputs.well!==undefined)next=applyWell(next,inputs.well);change(next);
   if(inputs.uploads!==undefined)uploadList=copyUploads(inputs.uploads);if(inputs.declaredLimit!==undefined)limit=inputs.declaredLimit;},
```

  3. In `handoffRequest`, change `return handoff(snapshot,est,permit,sealed.contentSha256);` to `return handoff(snapshot,est,permit,sealed.contentSha256,limit);`.
  4. Delete the line `const ASSUMPTION_FIELDS=[…];`, which is the old line 48.
  5. Change the signature `export function mountInjectivity(root,{selection,gate,download,h10,tests,uploads,onHandoff}){` to `export function mountInjectivity(root,{selection,gate,download,h10,tests,uploads,well,declaredLimit=null,onHandoff}){`, and its first line `createInjectivitySession({selection,gate,h10,tests,uploads})` to `createInjectivitySession({selection,gate,h10,tests,uploads,well,declaredLimit})`.
  6. Replace the whole `// 2. assumptions` block (old lines 78–82, from `// 2. assumptions` through the `form.append(el('p',\`Defaults: …\`));` line) with:

```js
   // 2. assumptions live in Well assumptions above
   const form=el('p','Tubing, fluid and the H-10 and permit pressure basis are declared in Well assumptions above.');
```

  7. The line `page.append(top,basis,form,tail);` stays as it is.
  8. Replace the final `return {dispose(){…},update(inputs){…}};` line with:

```js
 return {dispose(){disposed=true;session.dispose();root.replaceChildren();},get estimate(){try{return session.estimate;}catch{return null;}},
  update(inputs){if(disposed)return;try{session.update(inputs);setStatus('Recalculated after a review change.');}catch(e){setStatus(e&&e.message?e.message:String(e));}render();}};
```

- [ ] **Step 5:** Run `node --test tests/injectivity-session.test.mjs tests/panel-hooks.test.mjs`, then the full suite `node --test tests/*.test.mjs`. Expected: all pass, with no known failures left. Run `node --check web/well-assumptions.mjs web/injectivity.mjs`. Check CR bytes are 0. Report. Do not commit.

---

### Task 5: Reconciliation session and panel (`web/reconciliation.mjs`)

**Files:**
- Create: `web/reconciliation.mjs`, `tests/reconciliation-session.test.mjs`.

**Interfaces:**
- **Consumes:** Tasks 1–3, plus `ASSUMPTION_FIELDS`-free inputs from Task 4.
- **Produces:**
  - `createReconciliationSession({selection,gate,h10,tests,uploads,well,j})` → `{result, revision, reportDepth, declaredLimit, computations, update(inputs), setLimit(raw|null), exportRequest(format), dispose(), isCurrent(r)}`;
  - `mountReconciliation(root,{selection,gate,download,h10,tests,uploads,well,j,onLimitChange})` → `{declaredLimit, update(inputs), dispose()}`.

- [ ] **Step 1: Write the failing test** `tests/reconciliation-session.test.mjs`:

```js
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createReconciliationSession} from '../web/reconciliation.mjs';
import {verifyReconciliationSealed} from '../dist/pressureReconciliationExport.js';
import {createEstimateState,confirmBasis,setSurfaceBasis,estimate} from '../dist/injectivityEstimate.js';
import {DEFAULT_WELL_ASSUMPTIONS} from '../dist/wellAssumptions.js';
import {applyDecision} from '../dist/h10Diagnostics.js';
import {fixtureInputs} from './helpers/injectivity-fixture.mjs';

const ready={ready:true,reasons:[]},blocked={ready:false,reasons:['Inspection only: test.']};
const WELL={...DEFAULT_WELL_ASSUMPTIONS,surfaceBasis:{value:'psig',reason:'RRC H-10 reports gauge pressure'}};
const selection={artifact:{artifactId:'synthetic',inventory:[{uic_number:'000000417',permit_liquid_pressure_limit_psi:1176,permit_liquid_volume_limit_bpd:30000,permitted_top_depth_ft:3000}],injectionMonthly:[{uic_number:'000000417'}]},pin:null,tests:{sha256:{'tests.json':'ab'}}};
const jFor=inputs=>estimate(confirmBasis(setSurfaceBasis(createEstimateState(inputs),WELL.surfaceBasis),'psig','RRC'));
const make=(gate=ready,inputs=fixtureInputs(),well=WELL)=>createReconciliationSession({selection,gate,...inputs,well,j:jFor(inputs)});

test('waits for the surface basis: no rows, downloads refused with the reason',async()=>{
 const s=make(ready,fixtureInputs(),DEFAULT_WELL_ASSUMPTIONS);assert.deepEqual(s.result.rows,[]);assert.match(s.result.readiness,/Confirm the H-10 and permit pressure basis/);
 await assert.rejects(s.exportRequest('json'),/Downloads need the confirmed H-10 and permit pressure basis/);
});
test('permit and report depth come from the package; result is memoised per revision',()=>{
 const s=make();assert.equal(s.result.permit.surfacePsi,1176);assert.deepEqual(s.reportDepth,{depthFt:3310,source:'BHP test depth'});
 s.result;s.result;assert.equal(s.computations,1);s.update(fixtureInputs());s.result;assert.equal(s.computations,2);
});
test('update recomputes after a 1a change and a basis change; keeps well and j when omitted',()=>{
 const s=make(),next=fixtureInputs();next.h10=applyDecision(next.h10,'2024-02',false,'operator note');const r=s.revision;
 s.update(next);assert.equal(s.revision,r+1);assert.equal(s.result.rows.find(x=>x.month==='2024-02').status,'excluded');assert.deepEqual(s.result.surfaceBasis,WELL.surfaceBasis);
 s.update({...fixtureInputs(),well:{...WELL,surfaceBasis:{value:'psia',reason:'absolute'}}});assert.equal(s.result.rows.find(x=>x.month==='2024-02').surfacePsia,900);
 s.update({...fixtureInputs(),j:null});assert.equal(s.result.counts.testMonths,0);
});
test('declared limit: validated, bumps the revision, clears with null',()=>{
 const s=make(),r=s.revision;assert.throws(()=>s.setLimit({psia:'50',depthFt:'3310',reason:'x'}),/Bottomhole limit/);assert.equal(s.revision,r);
 s.setLimit({psia:'4000',depthFt:'3310',reason:'design'});assert.deepEqual(s.declaredLimit,{psia:4000,depthFt:3310,reason:'design'});assert.equal(s.revision,r+1);
 assert.notEqual(s.result.summary.minDeclaredPsi,null);s.setLimit(null);assert.equal(s.declaredLimit,null);
});
test('export: sealed JSON verifies, records the sources; a stale export resolves null',async()=>{
 const s=make();const r=await s.exportRequest('json');assert.match(r.filename,/^pressure-reconciliation-000000417-[a-f0-9]{12}\.json$/);
 const j=JSON.parse(r.text);assert.equal(await verifyReconciliationSealed(j),true);assert.equal(j.source.tests.inclusions['package:bhp:3'],false);assert.equal(j.source.jMatches['package:bhp:1'],'2024-02');
 assert.equal(j.source.h10Decisions['2024-05'].include,false);
 const p=s.exportRequest('csv');s.setLimit({psia:4000,depthFt:3310,reason:'x'});assert.equal(await p,null);
 const d=s.exportRequest('svg');s.dispose();assert.equal(await d,null);
});
test('gate not ready blocks exports; unknown format refused; upload provenance required',async()=>{
 await assert.rejects(make(blocked).exportRequest('json'),/Exports blocked: Inspection only/);await assert.rejects(make().exportRequest('pdf'),/Unsupported export format: pdf/);
 const inputs=fixtureInputs(),base=inputs.tests,rec={...base.records[0],key:'upload:bhp:1',origin:'upload'};
 const s=make(ready,{...inputs,tests:{...base,records:[...base.records,rec],decisions:{...base.decisions,'upload:bhp:1':{include:true,reason:null,byUser:false}}}});
 await assert.rejects(s.exportRequest('json'),/Sealing refused: uploaded test records/);
});
function fakeDom(){
 class N{constructor(t){this.tagName=t;this.children=[];this.dataset={};this._t='';this.style={};}
  set textContent(v){this._t=String(v);this.children=[];}get textContent(){return this._t+this.children.map(c=>typeof c==='string'?c:c.textContent).join('');}
  append(...a){for(const x of a)this.children.push(x);}replaceChildren(...a){this.children=[];this.append(...a);}setAttribute(){}querySelector(){return null;}focus(){}
  get childNodes(){return [...this.children];}get tHead(){return this.children.find(c=>c.tagName==='thead');}}
 globalThis.document={createElement:t=>new N(t),createTextNode:t=>t};return N;
}
test('panel: a failing computation keeps the limit form; waiting text without a basis; screening text present',async()=>{
 const N=fakeDom();const {mountReconciliation}=await import('../web/reconciliation.mjs');
 const inputs=fixtureInputs(),root=new N('div');
 const bad={get tests(){throw new Error('J panel failed');},basis:null};
 const p=mountReconciliation(root,{selection,gate:blocked,download(){},...inputs,well:WELL,j:bad});
 const text=root.textContent;assert.match(text,/Declared bottomhole limit/);assert.match(text,/could not render/);p.dispose();
 const q=mountReconciliation(root,{selection,gate:blocked,download(){},...inputs,well:DEFAULT_WELL_ASSUMPTIONS,j:null});
 assert.match(root.textContent,/Confirm the H-10 and permit pressure basis in Well assumptions\./);assert.match(root.textContent,/Screening only: not a regulatory approval/);q.dispose();
});
test('wiring: import-ui mounts the five panels in order, refreshes J before the reconciliation and disposes all five',async()=>{
 const src=await readFile('web/import-ui.mjs','utf8');
 const at=id=>src.indexOf(`.id='${id}'`);for(const [a,b] of [['test-records','well-assumptions'],['well-assumptions','injectivity-estimate'],['injectivity-estimate','pressure-reconciliation']])assert.ok(at(a)>0&&at(a)<at(b),`${a} before ${b}`);
 const fn=src.slice(src.indexOf('function clearResults()'),src.indexOf('\n',src.indexOf('function clearResults()')));
 for(const p of ['reconPanel?.dispose()','jPanel?.dispose()','wellPanel?.dispose()','testsPanel?.dispose()','h10Panel?.dispose()'])assert.ok(fn.includes(p),p);
 assert.ok(src.indexOf('jPanel?.update(')<src.indexOf('reconPanel?.update('),'J refreshes before the reconciliation');
});
```

The wiring test fails until Task 6 edits `import-ui.mjs`. Record it as an expected failure in this task's report.

- [ ] **Step 2:** Run `node --test tests/reconciliation-session.test.mjs`. Expected: FAIL (module not found).

- [ ] **Step 3:** Create `web/reconciliation.mjs`:

```js
import {reconcile,reportDepth,LABEL_RECON,SCREENING_TEXT,FORMATION_TEXT,DIFFERENTIAL_LABEL,PERMIT_EQ_LABEL,NEGATIVE_FLAG,ABOVE_PERMIT_FLAG} from '../dist/pressureReconciliation.js';
import {validateDeclaredLimit,DEFAULT_WELL_ASSUMPTIONS,SURFACE_BASIS_PROMPT} from '../dist/wellAssumptions.js';
import {reconciliationSvg} from '../dist/pressureReconciliationChart.js';
import {sealReconciliation,reconciliationJson,reconciliationCsv,reconciliationSvgExport} from '../dist/pressureReconciliationExport.js';

const FORMATS={json:['application/json',s=>reconciliationJson(s)],csv:['text/csv;charset=utf-8',s=>reconciliationCsv(s)],svg:['image/svg+xml',(s,rec)=>reconciliationSvgExport(s,rec)]};
const copyUploads=list=>(Array.isArray(list)?list:[]).map(u=>({kind:u.kind,fileName:u.fileName,sha256:u.sha256}));
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;

/** DOM-free session over the live 1a/1b states, the shared well assumptions and the J estimate; memoised per revision; stale refusal. */
export function createReconciliationSession({selection,gate,h10,tests,uploads=[],well=DEFAULT_WELL_ASSUMPTIONS,j=null}){
 const artifact=selection.artifact,inv=artifact.inventory?.[0]??{},uic=String(artifact.injectionMonthly?.[0]?.uic_number??inv.uic_number??'');
 const permit={surfacePsi:num(inv.permit_liquid_pressure_limit_psi),topDepthFt:num(inv.permitted_top_depth_ft)};
 let inputs={h10,tests,well,j},limit=null,revision=0,alive=true,uploadList=copyUploads(uploads),memo=null,computations=0;
 const compute=()=>{if(memo&&memo.revision===revision)return memo.result;const result=reconcile({...inputs,permit,declaredLimit:limit});computations++;memo={revision,result};return result;};
 const sealSource=rec=>{
  if(inputs.tests.records.some(r=>r.origin==='upload')&&!uploadList.length)throw new Error('Sealing refused: uploaded test records are present but their upload provenance (file name and SHA-256) was not supplied.');
  return {uic,artifactId:String(artifact.artifactId),normalizedSha256:selection.pin?.normalizedSha256??null,manifestSha256:selection.pin?.manifestSha256??null,
   h10Decisions:Object.fromEntries(Object.entries(inputs.h10?.decisions??{}).map(([k,d])=>[k,{include:d.include,reason:d.reason,byUser:d.byUser}])),
   tests:{packageFiles:{...(selection.tests?.sha256??{})},uploads:uploadList.map(u=>({...u})),inclusions:Object.fromEntries(Object.entries(inputs.tests.decisions).map(([k,d])=>[k,d.include]))},
   jMatches:Object.fromEntries((inputs.j?.tests??[]).map(t=>[t.key,t.month]))};
 };
 const session={
  get result(){return compute();},get revision(){return revision;},get computations(){return computations;},get declaredLimit(){return limit;},gate,uic,permit,
  get reportDepth(){return reportDepth(inputs.tests,permit.topDepthFt);},
  update(next){inputs={h10:next.h10,tests:next.tests,well:next.well??inputs.well,j:'j' in next?next.j:inputs.j};if(next.uploads!==undefined)uploadList=copyUploads(next.uploads);revision++;},
  setLimit(raw){const next=raw===null?null:validateDeclaredLimit(raw);limit=next;revision++;},
  dispose(){alive=false;revision++;},
  isCurrent(r){return alive&&r===revision;},
  async exportRequest(format){
   const kind=FORMATS[format];if(!kind)throw new Error('Unsupported export format: '+format);
   if(!gate.ready)throw new Error('Exports blocked: '+gate.reasons.join(' '));
   if(!inputs.well.surfaceBasis)throw new Error('Downloads need the confirmed H-10 and permit pressure basis.');
   const r=revision,rec=compute(),src=sealSource(rec);if(!session.isCurrent(r))return null;
   const sealed=await sealReconciliation(rec,src);if(!session.isCurrent(r))return null;
   return {filename:`pressure-reconciliation-${uic||'well'}-${sealed.contentSha256.slice(0,12)}.${format}`,mime:kind[0],text:kind[1](sealed,rec)};
  }};
 return session;
}

const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const fmt=v=>v===null||v===undefined?'—':typeof v==='number'?Number(v.toPrecision(5)).toLocaleString('en-US'):String(v);
function svgNode(svg){const doc=new DOMParser().parseFromString(svg,'image/svg+xml');if(doc.getElementsByTagName('parsererror').length||doc.documentElement.localName!=='svg')throw new Error('Generated reconciliation chart could not be parsed.');return document.importNode(doc.documentElement,true);}
const cellOf=(v,reason)=>v===null||v===undefined?(reason??'—'):fmt(v);

/** Panel inside Injector history, below the J panel. import-ui disposes it whenever results are cleared. */
export function mountReconciliation(root,{selection,gate,download,h10,tests,uploads,well,j,onLimitChange=()=>{}}){
 const session=createReconciliationSession({selection,gate,h10,tests,uploads,well,j}),section=el('section',undefined,'panel');section.setAttribute('aria-labelledby','reconciliation-title');
 const h=el('h2',LABEL_RECON);h.id='reconciliation-title';const statusEl=el('p');statusEl.setAttribute('role','status');const body=el('div');
 section.append(h,statusEl,body);root.replaceChildren(section);
 let disposed=false,focusKey=null;const drafts=new Map();
 const setStatus=t=>{statusEl.textContent=t;};
 const draft=(key,input,persisted)=>{input.dataset.focusKey=key;input.value=drafts.has(key)?drafts.get(key):(persisted??'');input.addEventListener?.('input',()=>drafts.set(key,input.value));return input;};
 const act=(key,fn,ok)=>{let changed=false;try{fn();for(const k of [...drafts.keys()])if(k.startsWith('limit:'))drafts.delete(k);setStatus(ok);changed=true;}catch(e){setStatus(e.message);}focusKey=key;render();
  if(changed){try{onLimitChange(session.declaredLimit);}catch(e){console.error(e);}}};
 function render(){
  if(disposed)return;
  const page=el('div'),top=el('div'),tail=el('div');
  // The limit form is built from session state alone, outside the try that computes the reconciliation, so a failure never removes it.
  const lim=session.declaredLimit,depthNow=session.reportDepth.depthFt;
  const form=el('fieldset');form.append(el('legend','Declared bottomhole limit (optional; your declaration, not evidence)'));
  const pv=el('input');pv.type='number';pv.step='any';draft('limit:psia',pv,lim?String(lim.psia):'');pv.setAttribute('aria-label','Declared bottomhole limit (psia)');
  const dv=el('input');dv.type='number';dv.step='any';draft('limit:depth',dv,lim?String(lim.depthFt):depthNow===null?'':String(depthNow));dv.setAttribute('aria-label','Depth of the declared limit (ft)');
  const rv=el('input');rv.type='text';rv.maxLength=200;draft('limit:reason',rv,lim?.reason);rv.placeholder='reason (required)';rv.setAttribute('aria-label','Reason for the declared limit');
  const set=el('button',lim?'Change limit':'Set limit');set.type='button';set.dataset.focusKey='limit';set.onclick=()=>act('limit',()=>session.setLimit({psia:pv.value,depthFt:dv.value,reason:rv.value}),'Declared bottomhole limit set.');
  const clear=el('button','Clear limit');clear.type='button';clear.dataset.focusKey='limit-clear';clear.disabled=!lim;clear.onclick=()=>act('limit-clear',()=>session.setLimit(null),'Declared bottomhole limit cleared.');
  form.append(el('label','Limit (psia) '),pv,el('label','Depth (ft) '),dv,rv,set,clear);
  page.append(top,form,tail);
  try{
   const rec=session.result,c=rec.counts;
   top.append(el('p',`Months in range: ${c.months} · included: ${c.included} · modelled: ${c.modelled} · refused: ${Object.values(c.refused).reduce((a,b)=>a+b,0)} · test months: ${c.testMonths} · negative differentials: ${c.negativeDifferentials} · months above the permit: ${c.abovePermit}`),
    el('p',rec.readiness));
   if(rec.surfaceBasis&&!rec.bhpBasis&&c.testMonths)top.append(el('p','Confirm the BHP basis in the J panel.'));
   if(Object.keys(c.refused).length)top.append(el('p','Refused: '+Object.entries(c.refused).map(([k,v])=>`${k} (${v})`).join('; ')));
   const sum=el('ul');for(const t of [`Regulatory margin (smallest): ${cellOf(rec.summary.minRegulatoryPsi,'unavailable')} psi`,
     `Permit-equivalent margin (smallest): ${cellOf(rec.summary.minPermitEquivalentPsi,'unavailable')} psi — ${PERMIT_EQ_LABEL}`,
     `Declared limit margin (smallest): ${rec.declaredLimit?cellOf(rec.summary.minDeclaredPsi,'unavailable')+' psi':'No limit declared'}`,`Formation margin: ${FORMATION_TEXT}`])sum.append(el('li',t));
   top.append(sum);for(const n of rec.notes)top.append(el('p',n));
   if(rec.rows.length){
    const wrap=el('div',undefined,'table-scroll');wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Monthly reconciliation');wrap.tabIndex=0;
    const table=el('table'),head=el('tr');for(const t of ['Month','Rate (bbl/day)','Average (psi)','Maximum (psi)','Regulatory margin (psi)','Modelled BHP (psia)','Hydrostatic (psi)','Friction (psi)',
      'Permit-equivalent BHP (psia)','Permit-equivalent margin (psi)','Declared margin (psi)',`Differential (psi), ${DIFFERENTIAL_LABEL}`,'Test gradient (psi/ft)','Column gradient (psi/ft)','Status'])
     {const th=el('th',t);th.scope='col';head.append(th);}
    table.append(el('thead'));table.tHead.append(head);const tb=el('tbody');
    for(const r of rec.rows){const tr=el('tr'),t=r.tests[0];
     for(const v of [r.month,r.rateBpd,r.avgPsi,r.maxPsi])tr.append(el('td',fmt(v)));
     tr.append(el('td',cellOf(r.regulatory.marginPsi,r.regulatory.reason)+(r.regulatory.abovePermit?` — ${ABOVE_PERMIT_FLAG}`:'')));
     for(const v of [r.modelled.pwfPsia,r.modelled.hydroPsi,r.modelled.frictionPsi,r.permitEquivalent.pwfPsia])tr.append(el('td',fmt(v)));
     tr.append(el('td',cellOf(r.permitEquivalent.marginPsi,r.permitEquivalent.reason)),el('td',cellOf(r.declared.marginPsi,r.declared.reason)));
     const dc=el('td');if(t){dc.append(el('p',`${t.date}: ${cellOf(t.differentialPsi,t.reason)}${t.negative?` — ${NEGATIVE_FLAG}`:''}`));if(t.checklist.length){const ul=el('ul');for(const x of t.checklist)ul.append(el('li',x));dc.append(ul);}}else dc.textContent='—';tr.append(dc);
     tr.append(el('td',t?fmt(t.testGradientPsiFt):'—'),el('td',t?fmt(t.columnGradientPsiFt):'—'),el('td',r.status==='included'?(r.modelled.reason??'modelled'):r.modelled.reason));
     tb.append(tr);}
    table.append(tb);wrap.append(table);tail.append(wrap);
    if(gate.ready){const box=el('div',undefined,'analysis-chart-scroll');box.append(svgNode(reconciliationSvg(rec).svg));tail.append(box);}
   }
   if(!gate.ready)tail.append(el('p','Exports are blocked. '+gate.reasons.join(' ')));
   else{
    const dlBlock=rec.surfaceBasis?'':'Downloads need the confirmed H-10 and permit pressure basis.';
    const actions=el('div',undefined,'import-actions');
    for(const [format,label] of [['json','Download reconciliation JSON'],['csv','Download reconciliation CSV'],['svg','Download reconciliation SVG']]){const b=el('button',label);b.type='button';b.disabled=!!dlBlock;b.dataset.focusKey='dl:'+format;
     b.onclick=async()=>{try{const r=await session.exportRequest(format);if(!r){setStatus('The selection changed while preparing this export. Download again.');return;}download(r.text,r.filename,r.mime);setStatus(`Downloaded ${r.filename}.`);}catch(e){setStatus(e.message);}};actions.append(b);}
    tail.append(actions);if(dlBlock)tail.append(el('p',dlBlock));
   }
  }catch(e){
   top.replaceChildren();tail.replaceChildren(el('p','The reconciliation panel could not render: '+(e&&e.message?e.message:String(e))));
  }
  tail.append(el('p',SCREENING_TEXT));
  if(!session.result?.surfaceBasis&&!top.children.length)top.append(el('p',SURFACE_BASIS_PROMPT));
  body.replaceChildren(...page.childNodes);
  if(focusKey){const t=section.querySelector(`[data-focus-key="${focusKey}"]`);if(t)t.focus();focusKey=null;}
 }
 render();
 return {get declaredLimit(){return session.declaredLimit;},dispose(){disposed=true;session.dispose();root.replaceChildren();},
  update(inputs){if(disposed)return;try{session.update(inputs);setStatus('Recalculated after a change.');}catch(e){setStatus(e&&e.message?e.message:String(e));}render();}};
}
```

The line `if(!session.result?.surfaceBasis&&!top.children.length)` must not throw when the computation failed. Wrap it as `try{if(!session.result.surfaceBasis&&!top.children.length)top.append(el('p',SURFACE_BASIS_PROMPT));}catch{}`. That is the form to implement; the version shown above is a simplification.

- [ ] **Step 4:** Run `node --test tests/reconciliation-session.test.mjs`. Expected: all pass except `'wiring: import-ui…'`, which turns green in Task 6. Run `node --check web/reconciliation.mjs`. Check CR bytes are 0. Report. Do not commit.

---

### Task 6: Wire into Injector history, record the layer, verify in the browser (Steps 1–3 worker, Steps 4–9 Main)

**Files:**
- Modify: `web/import-ui.mjs` (lines 13–14 imports, line 25 `let`, line 104 `clearResults`, line 238 `mountH10`).
- Create (Main): `demo/PRESSURE-RECONCILIATION-VERIFICATION.md`, `demo/pressure-reconciliation-evidence/`.

- [ ] **Step 1:** Edit `web/import-ui.mjs` with LF-only edits. Count CR bytes before the edits; the count must be 4.
  1. After `import {mountInjectivity} from './injectivity.mjs';`, add:

```js
import {mountWellAssumptions} from './well-assumptions.mjs';
import {mountReconciliation} from './reconciliation.mjs';
```

  2. Line 25 becomes `let h10Panel=null,testsPanel=null,wellPanel=null,jPanel=null,reconPanel=null;`.
  3. `clearResults` becomes:

```js
function clearResults(){reconPanel?.dispose();reconPanel=null;jPanel?.dispose();jPanel=null;wellPanel?.dispose();wellPanel=null;testsPanel?.dispose();testsPanel=null;h10Panel?.dispose();h10Panel=null;shown=null;$('import-results').replaceChildren();for(const id of ['import-download','import-csv','import-svg'])$(id).disabled=true;}
```

  4. Replace the whole `function mountH10(){…}` line with:

```js
function mountH10(){const p=selectedPublic();if(!p?.artifact)return;const gate=publicCalculationGate(),refresh=()=>{const ts=testsPanel?.state;if(ts==null)return;const inputs={h10:h10Panel?.state??null,tests:ts,uploads:testsPanel.uploads,...(wellPanel?{well:wellPanel.state}:{})};try{jPanel?.update({...inputs,declaredLimit:reconPanel?.declaredLimit??null});}catch(e){console.error(e);}try{reconPanel?.update({...inputs,j:jPanel?.estimate??null});}catch(e){console.error(e);}};if(h10Available(p)){const box=el('div');box.id='h10-diagnostics';$('import-results').append(box);h10Panel=mountH10Diagnostics(box,{selection:p,gate,download,onChange:refresh});}else $('import-results').append(el('p','No H-10 monthly rows for this well; H-10 diagnostics and timeline markers are not available.'));const tests=el('div');tests.id='test-records';$('import-results').append(tests);testsPanel=mountTestRecords(tests,{selection:p,gate,download,range:h10Panel?.range??null,onMarkers:markers=>h10Panel?.setMarkers(markers),onChange:refresh});const w=el('div');w.id='well-assumptions';$('import-results').append(w);wellPanel=mountWellAssumptions(w,{onChange:refresh});const j=el('div');j.id='injectivity-estimate';$('import-results').append(j);jPanel=mountInjectivity(j,{selection:p,gate,download,h10:h10Panel?.state??null,tests:testsPanel.state,uploads:testsPanel.uploads,well:wellPanel.state,declaredLimit:null,onHandoff:payload=>{const ws=document.getElementById('hydraulics-workspace')?.hydraulicsWorkspace;if(!ws)throw new Error('The Hydraulics workspace is not available.');ws.prefill(payload);navigate('hydraulics');}});const r=el('div');r.id='pressure-reconciliation';$('import-results').append(r);reconPanel=mountReconciliation(r,{selection:p,gate,download,h10:h10Panel?.state??null,tests:testsPanel.state,uploads:testsPanel.uploads,well:wellPanel.state,j:jPanel.estimate,onLimitChange:refresh});}
```

  Count CR bytes after the edits: they must be 4, on lines 340–343 or wherever the last four lines now fall. Run `node --check web/import-ui.mjs`.

- [ ] **Step 2:** From `N/`, run:
  - the type check: `node ../node_modules/typescript/bin/tsc -p tsconfig.json`;
  - the app suite: `node --test tests/*.test.mjs`, where every file must pass;
  - the oracles: `node scripts/check-carried-oracles.mjs`, which must give 248 comparisons and 0 failures.

  From the root, run:
  - `node scripts/prepare-swd.mjs`;
  - `node scripts/record-layer.mjs phase-2a-pressure-reconciliation`, which records pending-review;
  - `node scripts/verify-preservation.mjs .`, where the only violation should be the pending layer;
  - the root tests: `node --test tests/*.test.mjs`, where the only failure should be the live-root preservation test.

- [ ] **Step 3:** The worker reports counts and CR bytes to `task-6-report.md`. Do not commit.

- [ ] **Step 4 (Main, browser, synthetic):**
  - **Setup.** Serve with `PORT=4290 node scripts/serve.mjs` from `N/`, and run headless Chrome on CDP port 9333 with a scratchpad profile. Write the driver `demo/pressure-reconciliation-evidence/recon-check.mjs`, modelled on `demo/test-referenced-j-evidence/j-check.mjs`, and use the synthetic `j-main.tar` package built by the v4 helper in the scratchpad.
  - **At 1280×900 and 390×844, check:**
    1. Panel order: Test records → Well assumptions → J → Reconciliation.
    2. Before the basis is confirmed, both J and Reconciliation show the surface-basis prompt, and the reconciliation downloads are disabled.
    3. After confirming psig in Well assumptions and psig in J, J qualifies 2 tests, identical to 1c. The reconciliation counts read months 16, with every included month modelled, and 3 test months.
    4. Set a declared limit at the report depth: the margin shows. Change its depth by 2 ft: the margin shows the datum reason.
    5. Exclude a month in 1a: the reconciliation row shows "Excluded in the H-10 review".
    6. Switch the basis to psia: the J and reconciliation values move, and an export started before the switch is refused.
    7. JSON, CSV and SVG download, the JSON verifies, and none contains "calibrated".
    8. At 390 px there is no page-level horizontal scroll, and there are no console errors.
  - **Screenshots and results:** `demo/pressure-reconciliation-evidence/<tag>-*.png` and `results-<tag>.json`.

- [ ] **Step 5 (Main, real artifacts, counts only):**
  - **Source.** Read Explorer read-only via `git archive` at texas-rail-sync `0933590` into the scratchpad.
  - **Barbaro 23 v4 and TRIPPET v5.** For each, confirm both bases and record:
    - the reconciliation counts and the refusal reasons with their counts;
    - the test months, negative differentials and months above the permit;
    - the report-depth source;
    - console errors.
  - **No per-month or per-test values, and no table screenshots.**

- [ ] **Step 6 (Main):** Write `demo/PRESSURE-RECONCILIATION-VERIFICATION.md`, following `demo/TEST-REFERENCED-J-VERIFICATION.md`: what changed, commands and counts, RED → GREEN per task, the synthetic browser table, the real counts table, review outcomes and known limits.

- [ ] **Step 7 (owner):** Run the acceptance:

  `! cd C:/Users/thai.phi/Downloads/python/portfolio/swd-injection-analytics/tmp/lovable-transfer/well-injection-insights && node scripts/record-layer.mjs phase-2a-pressure-reconciliation accept "Thai Phi" && node scripts/verify-preservation.mjs .`

- [ ] **Step 8 (Main):** Commit on `feature/phase-2a-pressure-reconciliation`. Then do a fresh-clone check: `git -c core.longpaths=true clone`, copy in `node_modules`, and run all of the checks above.

- [ ] **Step 9 (Main):** Push and merge only on the owner's instruction.
