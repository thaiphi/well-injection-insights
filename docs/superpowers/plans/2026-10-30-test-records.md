# Phase 1b: BHP and step-rate test records with guided review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Test records panel to Injector history: BHP and step-rate test records arrive from a verified Explorer query-version-4 package or a panel CSV upload, the system flags records that are not comparable, the user decides, and a BHP chart, dated markers on the 1a timeline and sealed exports reflect and record those decisions.

**Architecture:** Three pure TypeScript modules (records, chart, export) compile to `dist/` and are tested in Node. A DOM-free web session handles uploads, decisions, revision and stale-export refusal. The Explorer receiver gains an exact query-version-4 path (new `web/explorer-tests.mjs` holds verbatim copies of Explorer's test-report normalizer, CSV writer and dictionary). The 1a ratio chart gains optional on-screen markers. Protected edits: `web/explorer-evidence.mjs`, `web/explorer-package.mjs`, `web/import-ui.mjs`, plus the accepted 1a files `src/h10DiagnosticsChart.ts` and `web/h10-diagnostics.mjs`. Preservation is registry layer `test-records`.

**Tech Stack:** TypeScript 5.9 (`tsc` → `dist/`), Node `node:test`, plain ES modules in the browser, hand-built SVG.

**Spec:** `docs/superpowers/specs/2026-10-29-test-records-design.md` (owner-approved 2026-10-29; amended 2026-10-30, §10). Producer contract reference: `docs/superpowers/plans/2026-10-30-explorer-v4-contract.md` (cited below as **V4**). Executors read all three.

## Global Constraints

- Paths: repo root `C:\Users\thai.phi\Downloads\python\portfolio\swd-injection-analytics\tmp\lovable-transfer\well-injection-insights`. The app is `swd-injection-analytics/` (written `N/`). Product paths in tasks are relative to `N/`.
- Build from `N/`: `node ../node_modules/typescript/bin/tsc -p tsconfig.json`. Tests import compiled code from `../dist/*.js`.
- Tests from `N/`: `node --test tests/<file>`. Direct `node` paths only; no npm/npx/vitest/bare python.
- New product files only in `N/{src,data,web,tests,scripts,reference,exhibits}`; every one is listed in the layer spec (Task 0).
- Protected files are archived by Main in Task 0 **before any edit**. `N/web/import-ui.mjs` has CRLF on its last four lines (334–337), LF elsewhere: count CR bytes before and after every edit (`4`). The other changed files have 0 CR bytes; keep them at 0.
- No new navigation tab; do not edit `web/navigation.mjs` or `web/index.html` (D19).
- The 1a H-10 panel, its three exports and the Injector history table/charts stay byte-identical, except that the 1a on-screen ratio chart may carry test markers. `ratioOverTimeSvg(state)` with no markers must be byte-identical to today.
- Fixed strings, verbatim:
  - `Calibrated injectivity (J): not ready. Needs a flowing bottomhole pressure with a same-time rate and a reservoir pressure reference (Phase 1c).`
  - `Source field named psia; RRC Permian guidance says PSIG; unresolved, not converted`
  - `Explorer package, verified` and `User upload, not verified`
- Numbers: depth tolerance `10` ft; minimum comparable BHP tests `2`; reason `1–200` characters after trimming (checked only when excluding); upload at most `1000` rows and `2 MB`.
- Explorer query versions accepted: legacy pin, `2`, `4`. Others fail with `Unsupported Explorer query version: <n>`.
- `tests_dictionary.json` SHA-256: `690574e58f75535d546dd14a1ab51c8bf7e480f0b2674e0eb501ef0cfd9699d4`.
- Synthetic test data uses the fictional UIC `000000417`. Never commit a generated v4 package, and never copy Explorer's Barbaro 23 artifact into this repository (the Explorer owner's handoff gate).
- Workers never stage, commit or push. Main commits after owner acceptance.
- This plan is pinned as an approved document by the layer. Track progress in the ledger, not by ticking boxes here.

## Review Focus

1. **Explorer byte format drift** (`"1445.0"` must become `1445`; empty cells; `|`-joined flags; LF endings). A copy that differs by one byte rejects every real package. Pinned by Task 4's dictionary-hash and CSV-writer tests, and by the owner-approved real-artifact check in Task 7.
2. **An uploaded CSV for a different well** (or with a formula-like cell) must be rejected whole, with no partial adoption. Pinned by Task 1 parser tests and Task 5 session tests.
3. **Re-including the off-depth BHP test** changes the chart and the export's `contributes`. Pinned by Task 1 and Task 3; seen in the browser in Task 7.
4. **A decision, upload or well switch while an export is sealing** must refuse the export. Pinned by Task 5.
5. **Markers never alter 1a exports** and are drawn only for included, dated, in-range tests. Pinned by Task 2 (byte identity, out-of-range) and Task 6.

---

### Task 0 (Main): layer spec and archive BEFORE any edit

**Files:**
- Create: `migration/layer-specs/test-records.json` (repo root)
- Archive (generated): `migration/baselines/test-records-before/swd-injection-analytics/{web/explorer-evidence.mjs,web/explorer-package.mjs,web/import-ui.mjs,src/h10DiagnosticsChart.ts,web/h10-diagnostics.mjs}`

- [ ] **Step 1:** Create `migration/layer-specs/test-records.json`:

```json
{
  "purpose": "Phase 1b (PRD ANA-E01, ANA-E02 test overlay): BHP and step-rate test records with guided review in Injector history; Explorer query-version-4 package receiver; panel CSV upload; test markers on the 1a timeline.",
  "acceptanceEvidence": "demo/TEST-RECORDS-VERIFICATION.md",
  "approvedDocs": [
    "docs/superpowers/specs/2026-10-29-test-records-design.md",
    "docs/superpowers/plans/2026-10-30-test-records.md",
    "docs/superpowers/plans/2026-10-30-explorer-v4-contract.md"
  ],
  "changes": ["web/explorer-evidence.mjs", "web/explorer-package.mjs", "web/import-ui.mjs", "src/h10DiagnosticsChart.ts", "web/h10-diagnostics.mjs"],
  "newFiles": [
    "src/testRecords.ts", "src/testRecordsChart.ts", "src/testRecordsExport.ts", "web/test-records.mjs", "web/explorer-tests.mjs",
    "tests/test-records.test.mjs", "tests/test-records-chart.test.mjs", "tests/test-records-export.test.mjs", "tests/test-records-session.test.mjs",
    "tests/explorer-package-v4.test.mjs", "tests/helpers/explorer-v4.mjs"
  ],
  "rootFiles": ["migration/layers/index.json"]
}
```

- [ ] **Step 2:** From the repo root: `node scripts/record-layer.mjs test-records archive` → `archived 5`. Record the CR counts (`import-ui` 4 on lines 334–337; the other four 0).

---

### Task 1: Test-record core (`src/testRecords.ts`)

**Files:**
- Create: `N/src/testRecords.ts`
- Test: `N/tests/test-records.test.mjs`

**Interfaces:**
- Consumes: `type Table` from `src/importProfile.ts`; `type TimelineMarker` from `src/h10DiagnosticsChart.ts` (this task adds that one type line; see the ordering note).
- Produces: `TEST_RECORDS_VERSION`, `DEPTH_TOLERANCE_FT`, `MIN_COMPARABLE_TESTS`, `MAX_REASON_LENGTH`, `MAX_UPLOAD_ROWS`, `BHP_COLUMNS`, `SRT_COLUMNS`, `LABEL_BHP_BASIS`, `LABEL_BHP`, `LABEL_SRT`, `J_READINESS`, `LIMITATIONS`, `FLAG_REASONS`, `ORIGIN_LABELS`, types `TestKind`, `TestOrigin`, `TestRow`, `TestFlag`, `TestRecord`, `Decision`, `MonthRange`, `TestState`, `TestInput`, `TestCoverage`, `BhpPoint`; functions `rowsFromTable(table, expectedUic)`, `referenceDepth(depths)`, `buildTestState(input, range)`, `applyTestDecision(state, key, include, reason?)`, `bhpSeries(state)`, `rangePosition(date, range)`, `outOfRange(state)`, `timelineMarkers(state)`, `testCoverage(state)`.

Ordering note: Task 1 Step 3 adds the single line `export type TimelineMarker=…` to `src/h10DiagnosticsChart.ts` (a type only; no SVG output changes). Task 2 keeps it and changes `ratioOverTimeSvg`.

- [ ] **Step 1: Write the failing test** `N/tests/test-records.test.mjs`:

```js
import test from 'node:test';import assert from 'node:assert/strict';
import {parseCsv} from '../dist/importProfile.js';
import {BHP_COLUMNS,SRT_COLUMNS,rowsFromTable,referenceDepth,buildTestState,applyTestDecision,bhpSeries,outOfRange,timelineMarkers,testCoverage,FLAG_REASONS} from '../dist/testRecords.js';

const UIC='000000417',range={first:'2023-10',last:'2026-09'};
const bhp=(id,date,psia,depth,o={})=>({source_row_key:`rrc:bhp:qxfy-wcfs:aaaa:${id}`,parent_key:'p',parent_join_status:'matched',uic_number:UIC,source_report_id:String(id),tracking_no:'9',test_sequence_no:'1.0',
 report_conducted_date:date,report_conducted_date_text:date??'',report_received_date:null,report_received_date_text:'',bhp_psia:psia,test_depth_ft:depth,gradient_psi_ft:0.7,tested_formation:'SYNTHETIC',source_snapshot_id:'qxfy-wcfs:aaaa',quality_flags:[],...o});
const srt=(id,date,frac,o={})=>({source_row_key:`rrc:srt:h54t-xnbi:bbbb:${id}`,parent_key:'p',parent_join_status:'matched',uic_number:UIC,source_report_id:String(id),tracking_no:'9',srt_received_date:null,srt_received_date_text:'',
 test_date:date,test_date_text:date??'',satisfactory_test_code:'1',top_perf_ft:2395,bottom_perf_ft:4569,formation_tested:'SYNTHETIC',min_inj_rate_bpm:0,max_inj_rate_bpm:26.63,isip_psig:null,formation_frac_press_psig:frac,
 frac_inj_rate_capacity_bpd:null,surface_pressure_firc_psig:null,fracture_gradient_psi_ft:0.693,comments:'',source_snapshot_id:'h54t-xnbi:bbbb',quality_flags:['missing:isip_psig'],...o});
const pkg={bhp:[
 bhp(10,'2022-11-07',1445,2228),            // B1 off-depth, before range
 bhp(11,'2024-03-03',1674,2396),            // B2
 bhp(12,'2024-06-07',1690,2396),            // B3
 bhp(13,'2024-09-19',1732,2400),            // B4 within 10 ft
 bhp(14,'2024-12-01',1700,null),            // B5 no depth
 bhp(15,'2025-02-01',null,2396),            // B6 no pressure
 bhp(16,null,1710,2396,{report_conducted_date_text:'2024-13-40',quality_flags:['parse_failure:report_conducted_date']}) // B7
],srt:[srt(20,'2022-11-07',1544),srt(21,'2025-01-15',null,{quality_flags:[]})]};
const state=()=>buildTestState({package:pkg},range);
const byId=(s,id)=>s.records.find(r=>r.values.source_report_id===String(id));

test('flags follow the spec rules exactly',()=>{
 const s=state(),f=id=>byId(s,id).flags;
 assert.deepEqual(f(10),['depth-differs']);assert.deepEqual(f(11),[]);assert.deepEqual(f(12),[]);assert.deepEqual(f(13),[]);
 assert.deepEqual(f(14),['no-depth']);assert.deepEqual(f(15),['no-pressure']);assert.deepEqual(f(16),['no-date','source-quarantined']);
 assert.deepEqual(f(20),[]);assert.deepEqual(f(21),['no-pressure']);
 assert.equal(s.referenceDepthFt,2396);assert.equal(s.referenceTie,false);
 assert.match(byId(s,10).reasons[0],/reference 2396 ft/);assert.match(byId(s,16).reasons[1],/parse_failure:report_conducted_date/);
 assert.deepEqual(byId(s,20).notes,['missing:isip_psig']);
});
test('flagged records start excluded and unflagged records start included',()=>{
 const s=state();
 for(const r of s.records)assert.equal(s.decisions[r.key].include,r.flags.length===0);
 assert.equal(Object.values(s.decisions).every(d=>d.byUser===false&&d.reason===null),true);
});
test('BHP chart series uses included tests with pressure, date and depth only',()=>{
 const s=state(),sr=bhpSeries(s);
 assert.deepEqual(sr.points.map(p=>p.psia),[1674,1690,1732]);assert.equal(sr.enough,true);assert.equal(sr.needed,2);
});
test('re-including the off-depth test adds it to the series; an unusable test never contributes',()=>{
 let s=state();s=applyTestDecision(s,byId(s,10).key,true);
 assert.deepEqual(bhpSeries(s).points.map(p=>p.depthFt),[2228,2396,2396,2400]);
 s=applyTestDecision(s,byId(s,14).key,true);assert.equal(bhpSeries(s).points.length,4);
});
test('excluding an unflagged test needs a reason; fewer than 2 qualifying tests is not enough',()=>{
 let s=state();
 assert.throws(()=>applyTestDecision(s,byId(s,11).key,false,'  '),/reason/i);
 s=applyTestDecision(s,byId(s,11).key,false,'Gauge problem noted in comments');
 assert.equal(s.decisions[byId(s,11).key].reason,'Gauge problem noted in comments');
 s=applyTestDecision(s,byId(s,12).key,false,'x');assert.equal(bhpSeries(s).enough,false);assert.equal(bhpSeries(s).points.length,1);
 assert.throws(()=>applyTestDecision(s,'package:bhp:999',true),/Not a test record/);
});
test('out-of-range records are listed and get no timeline marker',()=>{
 const s=state(),o=outOfRange(s);
 assert.deepEqual(o.before.map(r=>r.values.source_report_id).sort(),['10','20']);assert.deepEqual(o.after,[]);
 const m=timelineMarkers(s);assert.deepEqual(m.map(x=>x.date),['2024-03-03','2024-06-07','2024-09-19']);
 assert.equal(m.every(x=>x.kind==='bhp'&&/source field named psia/.test(x.label)),true);
 assert.deepEqual(timelineMarkers({...s,range:null}),[]);
});
test('reference depth: a single depth is the reference; a tie gives no reference and flags every BHP test with a depth',()=>{
 assert.deepEqual(referenceDepth([2396]),{reference:2396,tie:false});
 assert.deepEqual(referenceDepth([2228,2396]),{reference:null,tie:true});
 assert.deepEqual(referenceDepth([]),{reference:null,tie:false});
 const s=buildTestState({package:{bhp:[bhp(1,'2024-01-01',1,2228),bhp(2,'2024-02-01',2,2396)],srt:[]}},range);
 assert.equal(s.records.every(r=>r.flags.includes('depth-differs')&&/No single most-common/.test(r.reasons[0])),true);
});
test('duplicate identities are flagged within and across sources',()=>{
 const s=buildTestState({package:{bhp:[bhp(1,'2024-01-01',1,2396)],srt:[]},upload:{bhp:[bhp(1,'2024-01-01',1,2396)]}},range);
 assert.deepEqual(s.records.map(r=>[r.origin,r.flags]),[['package',['duplicate-report']],['upload',['duplicate-report']]]);
 assert.equal(FLAG_REASONS['duplicate-report'],'More than one record with this report identity.');
});
test('coverage counts records, origins and range',()=>{
 const c=testCoverage(state());
 assert.deepEqual(c,{bhpRecords:7,srtRecords:2,packageRecords:9,uploadRecords:0,flagged:5,included:4,comparableBhp:3,referenceDepthFt:2396,referenceTie:false,beforeRange:2,afterRange:0});
});

const csv=(header,rows)=>[header.join(','),...rows.map(r=>header.map(h=>r[h]??'').join(','))].join('\r\n');
const bhpCsvRow={source_row_key:'k1',parent_key:'p',parent_join_status:'matched',uic_number:UIC,source_report_id:'1',tracking_no:'9',test_sequence_no:'1.0',report_conducted_date:'2024-03-03',report_conducted_date_text:'2024-03-03',
 report_received_date:'',report_received_date_text:'',bhp_psia:'1674.0',test_depth_ft:'2396',gradient_psi_ft:'0.699',tested_formation:'SYNTHETIC',source_snapshot_id:'s',quality_flags:'missing:report_received_date'};
test('upload parser accepts Explorer BHP columns in any order and reads values with Explorer rules',()=>{
 const header=[...BHP_COLUMNS].reverse(),{kind,rows}=rowsFromTable(parseCsv(csv(header,[bhpCsvRow])),UIC);
 assert.equal(kind,'bhp');assert.equal(rows[0].bhp_psia,1674);assert.equal(rows[0].report_received_date,null);assert.deepEqual(rows[0].quality_flags,['missing:report_received_date']);
 assert.equal(rows[0].test_sequence_no,'1.0');
 assert.equal(rowsFromTable(parseCsv(csv([...SRT_COLUMNS],[{...bhpCsvRow,test_date:'2022-11-07',formation_frac_press_psig:'1544'}])),UIC).kind,'srt');
});
test('upload parser rejects the whole file for header, size, number, date, formula or well problems',()=>{
 const ok=[...BHP_COLUMNS],run=(h,rows)=>()=>rowsFromTable(parseCsv(csv(h,rows)),UIC);
 assert.throws(run(ok.slice(1),[bhpCsvRow]),/exactly Explorer/);
 assert.throws(run([...ok,'extra'],[bhpCsvRow]),/exactly Explorer/);
 assert.throws(run(ok,[]),/no test rows/);
 assert.throws(run(ok,Array.from({length:1001},()=>bhpCsvRow)),/At most 1000/);
 assert.throws(run(ok,[{...bhpCsvRow,bhp_psia:'1.5e3'}]),/plain number/);
 assert.throws(run(ok,[{...bhpCsvRow,report_conducted_date:'2024-02-30'}]),/valid YYYY-MM-DD/);
 assert.throws(run(ok,[{...bhpCsvRow,tested_formation:'=1+1'}]),/formula/);
 assert.throws(run(ok,[{...bhpCsvRow,uic_number:'000000999'}]),/not the selected well 000000417/);
});
```

- [ ] **Step 2: Run to verify it fails.** From `N/`: `node ../node_modules/typescript/bin/tsc -p tsconfig.json; node --test tests/test-records.test.mjs` → FAIL with `ERR_MODULE_NOT_FOUND` for `dist/testRecords.js`.

- [ ] **Step 3: Implement.** First add this line to `N/src/h10DiagnosticsChart.ts` directly after the `export type ChartSvg=...` line (type only; no output change):

```ts
export type TimelineMarker={kind:'bhp'|'srt';date:string;label:string};
```

Then create `N/src/testRecords.ts`:

```ts
import type { TimelineMarker } from './h10DiagnosticsChart.js';
import type { Table } from './importProfile.js';

/** Phase 1b test records: Explorer-layout BHP/SRT rows, system flags, user decisions. Pure; no DOM. Values stay as published. */
export const TEST_RECORDS_VERSION='test-records/1';
export const DEPTH_TOLERANCE_FT=10;
export const MIN_COMPARABLE_TESTS=2;
export const MAX_REASON_LENGTH=200;
export const MAX_UPLOAD_ROWS=1000;
export const BHP_COLUMNS=Object.freeze(['source_row_key','parent_key','parent_join_status','uic_number','source_report_id','tracking_no','test_sequence_no','report_conducted_date','report_conducted_date_text','report_received_date','report_received_date_text','bhp_psia','test_depth_ft','gradient_psi_ft','tested_formation','source_snapshot_id','quality_flags']);
export const SRT_COLUMNS=Object.freeze(['source_row_key','parent_key','parent_join_status','uic_number','source_report_id','tracking_no','srt_received_date','srt_received_date_text','test_date','test_date_text','satisfactory_test_code','top_perf_ft','bottom_perf_ft','formation_tested','min_inj_rate_bpm','max_inj_rate_bpm','isip_psig','formation_frac_press_psig','frac_inj_rate_capacity_bpd','surface_pressure_firc_psig','fracture_gradient_psi_ft','comments','source_snapshot_id','quality_flags']);
const NUMERIC=new Set(['bhp_psia','test_depth_ft','gradient_psi_ft','top_perf_ft','bottom_perf_ft','min_inj_rate_bpm','max_inj_rate_bpm','isip_psig','formation_frac_press_psig','frac_inj_rate_capacity_bpd','surface_pressure_firc_psig','fracture_gradient_psi_ft']);
const DATES=new Set(['report_conducted_date','report_received_date','srt_received_date','test_date']);
export const LABEL_BHP_BASIS='Source field named psia; RRC Permian guidance says PSIG; unresolved, not converted';
export const LABEL_BHP=`Bottomhole pressure as reported. ${LABEL_BHP_BASIS}. Test type not stated in source. Not a reservoir pressure estimate and not an injectivity index (J).`;
export const LABEL_SRT='Step-rate test values as reported (psig). The satisfactory code is shown verbatim; its meaning is undocumented.';
export const J_READINESS='Calibrated injectivity (J): not ready. Needs a flowing bottomhole pressure with a same-time rate and a reservoir pressure reference (Phase 1c).';
export const LIMITATIONS=Object.freeze([LABEL_BHP,LABEL_SRT,J_READINESS,
  'Test records are one published report row each; they are not pressure series and carry no stabilization data.',
  'Depth basis (measured or true vertical) is not stated in the source; no depth correction is applied.',
  "Test markers sit at the actual test date and are never joined to a month's values."]);
export type TestKind='bhp'|'srt';
export type TestOrigin='package'|'upload';
export const ORIGIN_LABELS:Readonly<Record<TestOrigin,string>>=Object.freeze({package:'Explorer package, verified',upload:'User upload, not verified'});
export type TestValue=string|number|null|readonly string[];
export type TestRow=Readonly<Record<string,TestValue>>;
export type TestFlag='no-pressure'|'no-date'|'no-depth'|'depth-differs'|'duplicate-report'|'source-quarantined';
export const FLAG_REASONS:Readonly<Record<TestFlag,string>>=Object.freeze({
  'no-pressure':'No test pressure reported.',
  'no-date':'Test date missing or not a valid date.',
  'no-depth':'No test depth reported; the test is not placed at any depth.',
  'depth-differs':"Tested at a different depth from this well's other tests; not directly comparable.",
  'duplicate-report':'More than one record with this report identity.',
  'source-quarantined':'Explorer quarantined this row.'});
const QUARANTINE=/^(parse_failure|invalid|inconsistent|duplicate|unmatched|ambiguous|source_scope)/;
export type TestRecord={key:string;kind:TestKind;origin:TestOrigin;identity:string;sourceRowKey:string;uic:string;date:string|null;dateText:string;
  bhpPsia:number|null;depthFt:number|null;pressures:{field:string;value:number|null}[];values:TestRow;qualityFlags:string[];flags:TestFlag[];reasons:string[];notes:string[];usable:boolean};
export type Decision={include:boolean;reason:string|null;byUser:boolean};
export type MonthRange={first:string;last:string};
export type TestState={version:typeof TEST_RECORDS_VERSION;records:TestRecord[];referenceDepthFt:number|null;referenceTie:boolean;range:MonthRange|null;decisions:Readonly<Record<string,Decision>>};
export type TestInput={package?:{bhp:readonly TestRow[];srt:readonly TestRow[]}|null;upload?:{bhp?:readonly TestRow[];srt?:readonly TestRow[]}};
export type BhpPoint={key:string;date:string;psia:number;depthFt:number};
export type TestCoverage={bhpRecords:number;srtRecords:number;packageRecords:number;uploadRecords:number;flagged:number;included:number;comparableBhp:number;referenceDepthFt:number|null;referenceTie:boolean;beforeRange:number;afterRange:number};

const str=(v:unknown)=>v==null?'':String(v);
function validDate(t:string) {
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(t);if(!m) return false;
  const mo=Number(m[2]),d=Number(m[3]);return mo>=1&&mo<=12&&d>=1&&d<=new Date(Date.UTC(Number(m[1]),mo,0)).getUTCDate();
}
const num=(v:TestValue|undefined)=>typeof v==='number'&&Number.isFinite(v)?v:null;
const dateOf=(v:TestValue|undefined)=>typeof v==='string'&&validDate(v)?v:null;

/** Upload boundary: exact Explorer header set (any order), Explorer value rules, one selected well. Any problem rejects the whole file. */
export function rowsFromTable(table:Table,expectedUic:string):{kind:TestKind;rows:TestRow[]} {
  const headers=table.headers.map(h=>String(h)),set=new Set(headers);
  const fits=(cols:readonly string[])=>cols.length===headers.length&&set.size===headers.length&&cols.every(c=>set.has(c));
  const kind:TestKind|null=fits(BHP_COLUMNS)?'bhp':fits(SRT_COLUMNS)?'srt':null;
  if(!kind) throw new Error("The header must be exactly Explorer's BHP or SRT test columns (any order).");
  if(!table.rows.length) throw new Error('The file has no test rows.');
  if(table.rows.length>MAX_UPLOAD_ROWS) throw new Error(`At most ${MAX_UPLOAD_ROWS} rows are accepted.`);
  const rows=table.rows.map(r=>{
    if(r.values.length!==headers.length) throw new Error(`Row ${r.originalRow}: wrong number of cells.`);
    const row:Record<string,TestValue>={};
    headers.forEach((h,i)=>{
      const raw=str(r.values[i]);
      if(NUMERIC.has(h)) {if(raw.trim()===''){row[h]=null;return;}if(!/^-?\d+(\.\d+)?$/.test(raw)) throw new Error(`Row ${r.originalRow}: ${h} is not a plain number.`);row[h]=Number(raw);return;}
      if(DATES.has(h)) {if(raw===''){row[h]=null;return;}if(!validDate(raw)) throw new Error(`Row ${r.originalRow}: ${h} is not a valid YYYY-MM-DD date.`);row[h]=raw;return;}
      if(/^[=+\-@\t\r]/.test(raw)) throw new Error(`Row ${r.originalRow}: ${h} starts with a formula character.`);
      row[h]=h==='quality_flags'?(raw?Object.freeze(raw.split('|')):Object.freeze([])):raw;
    });
    if(row.uic_number!==expectedUic) throw new Error(`Row ${r.originalRow}: UIC ${str(row.uic_number)} is not the selected well ${expectedUic}.`);
    return Object.freeze(row);
  });
  return {kind,rows};
}

/** The depth shared (within the tolerance) by the most tests. Separate equally supported depths are a tie: no reference. */
export function referenceDepth(depths:readonly number[]):{reference:number|null;tie:boolean} {
  if(!depths.length) return {reference:null,tie:false};
  const support=depths.map(d=>depths.filter(e=>Math.abs(e-d)<=DEPTH_TOLERANCE_FT).length),max=Math.max(...support);
  const candidates=[...new Set(depths.filter((_,i)=>support[i]===max))].sort((a,b)=>a-b);
  if(candidates.some(c=>Math.abs(c-candidates[0])>DEPTH_TOLERANCE_FT)) return {reference:null,tie:true};
  const freq=(d:number)=>depths.filter(e=>e===d).length;
  return {reference:candidates.reduce((best,d)=>freq(d)>freq(best)?d:best,candidates[0]),tie:false};
}

export function buildTestState(input:TestInput,range:MonthRange|null):TestState {
  const raw:{kind:TestKind;origin:TestOrigin;row:TestRow}[]=[];
  for(const [origin,src] of [['package',input.package],['upload',input.upload]] as const)
    for(const kind of ['bhp','srt'] as const) for(const row of src?.[kind]??[]) raw.push({kind,origin,row});
  const identity=(k:TestKind,r:TestRow)=>k==='bhp'?`bhp|${str(r.source_report_id)}|${str(r.tracking_no)}|${str(r.test_sequence_no)}`:`srt|${str(r.source_report_id)}|${str(r.tracking_no)}`;
  const counts=new Map<string,number>();for(const x of raw){const id=identity(x.kind,x.row);counts.set(id,(counts.get(id)??0)+1);}
  const {reference,tie}=referenceDepth(raw.filter(x=>x.kind==='bhp').map(x=>num(x.row.test_depth_ft)).filter((d):d is number=>d!==null));
  const seq={package:{bhp:0,srt:0},upload:{bhp:0,srt:0}};
  const records=raw.map(({kind,origin,row}):TestRecord=>{
    const key=`${origin}:${kind}:${++seq[origin][kind]}`,id=identity(kind,row);
    const date=dateOf(kind==='bhp'?row.report_conducted_date:row.test_date),dateText=str(kind==='bhp'?row.report_conducted_date_text:row.test_date_text);
    const pressures=(kind==='bhp'?['bhp_psia']:['isip_psig','formation_frac_press_psig','surface_pressure_firc_psig']).map(field=>({field,value:num(row[field])}));
    const bhpPsia=kind==='bhp'?pressures[0].value:null,depthFt=kind==='bhp'?num(row.test_depth_ft):null;
    const qualityFlags=Array.isArray(row.quality_flags)?[...row.quality_flags as readonly string[]]:[];
    const flags:TestFlag[]=[],reasons:string[]=[],add=(f:TestFlag,text=FLAG_REASONS[f])=>{flags.push(f);reasons.push(text);};
    if(pressures.every(p=>p.value===null)) add('no-pressure');
    if(date===null) add('no-date');
    if(kind==='bhp') {
      if(depthFt===null) add('no-depth');
      else if(tie) add('depth-differs','No single most-common test depth; tests are not directly comparable.');
      else if(reference!==null&&Math.abs(depthFt-reference)>DEPTH_TOLERANCE_FT) add('depth-differs',`Tested at a different depth from this well's other tests (reference ${reference} ft); not directly comparable.`);
    }
    if((counts.get(id)??0)>1) add('duplicate-report');
    const quarantine=qualityFlags.filter(f=>QUARANTINE.test(f));
    if(quarantine.length) add('source-quarantined',`Explorer quarantined this row: ${quarantine.join(', ')}.`);
    const usable=date!==null&&pressures.some(p=>p.value!==null)&&(kind==='srt'||depthFt!==null);
    return {key,kind,origin,identity:id,sourceRowKey:str(row.source_row_key),uic:str(row.uic_number),date,dateText,bhpPsia,depthFt,pressures,values:row,qualityFlags,flags,reasons,notes:qualityFlags.filter(f=>!QUARANTINE.test(f)),usable};
  });
  const decisions:Record<string,Decision>={};for(const r of records) decisions[r.key]={include:r.flags.length===0,reason:null,byUser:false};
  return {version:TEST_RECORDS_VERSION,records,referenceDepthFt:reference,referenceTie:tie,range,decisions:Object.freeze(decisions)};
}

export function applyTestDecision(state:TestState,key:string,include:boolean,reason?:string|null):TestState {
  const record=state.records.find(r=>r.key===key);if(!record) throw new Error(`Not a test record: ${key}`);
  const text=(reason??'').trim();
  if(!include&&text.length>MAX_REASON_LENGTH) throw new Error(`A reason must be at most ${MAX_REASON_LENGTH} characters`);
  if(!include&&record.flags.length===0&&!text) throw new Error('A reason (1-200 characters) is required to exclude a test the system did not flag');
  return {...state,decisions:Object.freeze({...state.decisions,[key]:{include,reason:include?null:(text||null),byUser:true}})};
}
const included=(s:TestState,r:TestRecord)=>s.decisions[r.key]?.include===true;
export function bhpSeries(state:TestState):{points:BhpPoint[];enough:boolean;needed:number} {
  const points=state.records.filter(r=>r.kind==='bhp'&&r.usable&&included(state,r)).map(r=>({key:r.key,date:r.date as string,psia:r.bhpPsia as number,depthFt:r.depthFt as number}))
    .sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  return {points,enough:points.length>=MIN_COMPARABLE_TESTS,needed:MIN_COMPARABLE_TESTS};
}
export function rangePosition(date:string|null,range:MonthRange|null):'before'|'in'|'after'|null {
  if(!date||!range) return null;const m=date.slice(0,7);return m<range.first?'before':m>range.last?'after':'in';
}
export function outOfRange(state:TestState):{before:TestRecord[];after:TestRecord[]} {
  return {before:state.records.filter(r=>rangePosition(r.date,state.range)==='before'),after:state.records.filter(r=>rangePosition(r.date,state.range)==='after')};
}
function markerLabel(r:TestRecord) {
  return r.kind==='bhp'?`BHP ${r.date}: ${r.bhpPsia} (source field named psia) at ${r.depthFt} ft`:`SRT ${r.date}: `+r.pressures.filter(p=>p.value!==null).map(p=>`${p.field} ${p.value}`).join(', ');
}
export function timelineMarkers(state:TestState):TimelineMarker[] {
  return state.records.filter(r=>r.usable&&included(state,r)&&rangePosition(r.date,state.range)==='in').map(r=>({kind:r.kind,date:r.date as string,label:markerLabel(r)}));
}
export function testCoverage(state:TestState):TestCoverage {
  const o=outOfRange(state);
  return {bhpRecords:state.records.filter(r=>r.kind==='bhp').length,srtRecords:state.records.filter(r=>r.kind==='srt').length,
    packageRecords:state.records.filter(r=>r.origin==='package').length,uploadRecords:state.records.filter(r=>r.origin==='upload').length,
    flagged:state.records.filter(r=>r.flags.length).length,included:state.records.filter(r=>included(state,r)).length,comparableBhp:bhpSeries(state).points.length,
    referenceDepthFt:state.referenceDepthFt,referenceTie:state.referenceTie,beforeRange:o.before.length,afterRange:o.after.length};
}
```

- [ ] **Step 4: Run to verify it passes.** `node ../node_modules/typescript/bin/tsc -p tsconfig.json; node --test tests/test-records.test.mjs` → 11 pass. Then `node --test tests/*.test.mjs` → 468 + 11 pass, 0 fail.

---

### Task 2: Charts (`src/testRecordsChart.ts`) and 1a timeline markers

**Files:**
- Create: `N/src/testRecordsChart.ts`
- Modify: `N/src/h10DiagnosticsChart.ts` (`ratioOverTimeSvg`; the `TimelineMarker` type line from Task 1 stays)
- Test: `N/tests/test-records-chart.test.mjs`

**Interfaces:**
- Consumes: Task 1 `bhpSeries`, `buildTestState`, `timelineMarkers`, `LABEL_BHP`, `TestState`; 1a `diagnoseMonthly`.
- Produces: `testPressureSvg(state):{svg,height}`; `ratioOverTimeSvg(state, markers?: readonly TimelineMarker[])`.

- [ ] **Step 1: Confirm the current 1a output hash** (before editing `ratioOverTimeSvg`). From `N/`:

```
node -e "import('./dist/h10Diagnostics.js').then(async d=>{const c=await import('./dist/h10DiagnosticsChart.js');const a=JSON.parse(require('fs').readFileSync('data/explorer/normalized.json','utf8'));console.log(require('crypto').createHash('sha256').update(c.ratioOverTimeSvg(d.diagnoseMonthly(a.injectionMonthly)).svg).digest('hex'))})"
```

It must print `05d287ffbb38fa6286070516306c759964facd132513d0b44a25fdfa72c0ddce` (computed by Main on 2026-10-30 from the accepted 1a code). If it differs, stop and report: the accepted 1a chart has changed.

- [ ] **Step 2: Write the failing test** `N/tests/test-records-chart.test.mjs`:

```js
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {buildTestState,applyTestDecision,timelineMarkers} from '../dist/testRecords.js';
import {testPressureSvg} from '../dist/testRecordsChart.js';
import {diagnoseMonthly} from '../dist/h10Diagnostics.js';
import {ratioOverTimeSvg} from '../dist/h10DiagnosticsChart.js';

const PINNED_RATIO_SHA256='05d287ffbb38fa6286070516306c759964facd132513d0b44a25fdfa72c0ddce';
const artifact=JSON.parse(await readFile('data/explorer/normalized.json','utf8')),h10=diagnoseMonthly(artifact.injectionMonthly);
const sha=s=>createHash('sha256').update(s).digest('hex');
const row=(id,date,psia,depth,o={})=>({source_report_id:String(id),tracking_no:'9',test_sequence_no:'1.0',uic_number:'000020838',report_conducted_date:date,report_conducted_date_text:date,bhp_psia:psia,test_depth_ft:depth,quality_flags:[],...o});
const range={first:'2024-01',last:'2026-04'};
const st=buildTestState({package:{bhp:[row(1,'2024-03-03',1674,2396),row(2,'2024-06-07',1690,2396),row(3,'2024-09-19',1732,2396,{tested_formation:'<b>x</b>'}),row(4,'2022-11-07',1445,2228)],srt:[]}},range);

test('BHP chart plots included comparable tests at their depth with the fixed label',()=>{
 const {svg}=testPressureSvg(st);
 assert.equal((svg.match(/<circle /g)??[]).length,3);assert.match(svg,/2396 ft/);
 assert.match(svg,/Source field named psia; RRC Permian guidance says PSIG; unresolved, not converted/);
 assert.match(svg,/Reference depth: 2396 ft/);assert.doesNotMatch(svg,/<script|href=/);
});
test('fewer than 2 qualifying tests shows the not-enough message',()=>{
 let s=st;for(const r of s.records.slice(0,2))s=applyTestDecision(s,r.key,false,'test');
 assert.match(testPressureSvg(s).svg,/Not enough comparable tests \(1 of 2 needed\)/);
});
test('1a ratio chart without markers is byte-identical to the accepted output',()=>{
 assert.equal(sha(ratioOverTimeSvg(h10).svg),PINNED_RATIO_SHA256);
 assert.equal(ratioOverTimeSvg(h10,[]).svg,ratioOverTimeSvg(h10).svg);
});
test('markers are drawn only inside the H-10 range, escaped, with a note',()=>{
 const markers=[...timelineMarkers(st),{kind:'srt',date:'2022-11-07',label:'out of range'},{kind:'srt',date:'2025-05-02',label:'<SRT & "x">'}];
 const {svg}=ratioOverTimeSvg(h10,markers);
 assert.equal((svg.match(/data-test-marker="bhp"/g)??[]).length,3);assert.equal((svg.match(/data-test-marker="srt"/g)??[]).length,1);
 assert.match(svg,/&lt;SRT &amp; &quot;x&quot;&gt;/);assert.doesNotMatch(svg,/out of range/);
 assert.match(svg,/Test markers \(4\): triangle BHP, diamond SRT, at the actual test date; not joined to any month\./);
});
test('chart text is escaped',()=>{assert.doesNotMatch(testPressureSvg(st).svg,/<b>/);});
```

- [ ] **Step 3: Run to verify it fails** (`ERR_MODULE_NOT_FOUND` for `dist/testRecordsChart.js`).

- [ ] **Step 4: Implement.** In `N/src/h10DiagnosticsChart.ts`:
  1. Change the signature line `export function ratioOverTimeSvg(state:DiagnosticsState):ChartSvg {` to `export function ratioOverTimeSvg(state:DiagnosticsState,markers:readonly TimelineMarker[]=[]):ChartSvg {`.
  2. Replace the last three statements of that function, from `body+=\`<text x="${L}" y="${TOP+PH+16}"` through `return frame(title,lines,body,PH);`, with:

```ts
  body+=`<text x="${L}" y="${TOP+PH+16}" font-size="11">${esc(first)}</text><text x="${L+PW}" y="${TOP+PH+16}" font-size="11" text-anchor="end">${esc(last)}</text>`;
  const day=(d:string)=>Date.UTC(Number(d.slice(0,4)),Number(d.slice(5,7))-1,Number(d.slice(8,10)));
  const shown=markers.filter(m=>{const t=day(m.date);return Number.isFinite(t)&&t>=t0&&t<t1;});
  for(const m of shown) {
    const cx=L+PW*(day(m.date)-t0)/(t1-t0),cy=TOP+10;
    body+=m.kind==='bhp'
      ?`<path data-test-marker="bhp" d="M${n(cx)} ${n(cy-6)} L${n(cx+6)} ${n(cy+5)} L${n(cx-6)} ${n(cy+5)} Z" fill="#6a1b9a"><title>${esc(m.label)}</title></path>`
      :`<rect data-test-marker="srt" x="${n(cx-5)}" y="${n(cy-5)}" width="10" height="10" transform="rotate(45 ${n(cx)} ${n(cy)})" fill="#ef6c00"><title>${esc(m.label)}</title></rect>`;
  }
  const lines=[`Gap months (no report): ${gaps.length?gaps.join(', '):'none'}`,`Excluded months: ${excluded.length?excluded.join(', '):'none'}`,'Lines are not drawn across gaps or excluded months; nothing is interpolated.'];
  if(shown.length) lines.push(`Test markers (${shown.length}): triangle BHP, diamond SRT, at the actual test date; not joined to any month.`);
  return frame(title,lines,body,PH);
```

  Do not touch `diagnosticsSvg` in `h10DiagnosticsExport.ts`: it keeps calling `ratioOverTimeSvg(state)` with no markers, so 1a exports never carry markers.

Create `N/src/testRecordsChart.ts`:

```ts
import { LABEL_BHP, bhpSeries, type TestState } from './testRecords.js';

/** Pure SVG strings; escaped text only; no script, links or external references. */
export type ChartSvg={svg:string;height:number};
const W=960,L=78,R=40,PW=W-L-R,PH=260,TOP=58,DAY=86_400_000;
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
const n=(v:number)=>v.toFixed(2);
const fmt=(v:number)=>Number(v.toPrecision(4)).toLocaleString('en-US');
function niceMax(max:number) {if(!(max>0)) return 1;const pow=10**Math.floor(Math.log10(max));return [1,2,2.5,5,10].map(s=>s*pow).find(s=>s>=max)!;}
const day=(d:string)=>Date.UTC(Number(d.slice(0,4)),Number(d.slice(5,7))-1,Number(d.slice(8,10)));
const labelLines=LABEL_BHP.split('. ').map((s,i,a)=>i<a.length-1?s+'.':s);
function frame(title:string,lines:string[],body:string,bodyHeight:number):ChartSvg {
  const notesY=TOP+bodyHeight+40,height=notesY+lines.length*18+16;
  const notes=lines.map((t,i)=>`<text x="${L}" y="${notesY+i*18}" font-size="12" fill="#37474f">${esc(t)}</text>`).join('');
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${height}" width="${W}" height="${height}" role="img" aria-label="${esc(title)}" font-family="system-ui, sans-serif"><rect width="${W}" height="${height}" fill="#ffffff"/><text x="${L}" y="26" font-size="16" font-weight="600">${esc(title)}</text><text x="${L}" y="46" font-size="12" fill="#455a64">${esc('Test records as reported; points are separate tests, not a series.')}</text>${body}${notes}</svg>`,height};
}

/** Reported BHP at each included comparable test's actual date, labelled with its depth. */
export function testPressureSvg(state:TestState):ChartSvg {
  const title='Reported bottomhole pressure by test date',s=bhpSeries(state);
  const ref=state.referenceTie?'Reference depth: none (no single most-common depth)':state.referenceDepthFt===null?'Reference depth: none (no test depth reported)':`Reference depth: ${state.referenceDepthFt} ft`;
  if(!s.enough) return frame(title,[ref,...labelLines],`<text x="${L}" y="${TOP+40}" font-size="14">${esc(`Not enough comparable tests (${s.points.length} of ${s.needed} needed)`)}</text>`,60);
  const t0=day(s.points[0].date)-30*DAY,t1=day(s.points[s.points.length-1].date)+30*DAY,yMax=niceMax(Math.max(...s.points.map(p=>p.psia)));
  const x=(d:string)=>L+PW*(day(d)-t0)/(t1-t0),y=(v:number)=>TOP+PH-PH*v/yMax;
  let body=`<line x1="${L}" y1="${TOP}" x2="${L}" y2="${TOP+PH}" stroke="#90a4ae"/><line x1="${L}" y1="${TOP+PH}" x2="${L+PW}" y2="${TOP+PH}" stroke="#90a4ae"/>`;
  for(let i=0;i<=4;i++) {const v=yMax*i/4,yy=TOP+PH-PH*i/4;body+=`<line x1="${L}" y1="${n(yy)}" x2="${L+PW}" y2="${n(yy)}" stroke="#eceff1"/><text x="${L-8}" y="${n(yy+4)}" font-size="11" text-anchor="end">${esc(fmt(v))}</text>`;}
  body+=`<text x="16" y="${TOP+PH/2}" font-size="12" transform="rotate(-90 16 ${TOP+PH/2})" text-anchor="middle">${esc('Reported BHP (source field named psia)')}</text>`;
  for(const p of s.points) body+=`<circle cx="${n(x(p.date))}" cy="${n(y(p.psia))}" r="4" fill="#6a1b9a"><title>${esc(`${p.date}: ${fmt(p.psia)} (source field named psia) at ${p.depthFt} ft`)}</title></circle><text x="${n(x(p.date))}" y="${n(y(p.psia)-9)}" font-size="11" text-anchor="middle">${esc(`${p.depthFt} ft`)}</text>`;
  body+=`<text x="${L}" y="${TOP+PH+16}" font-size="11">${esc(s.points[0].date)}</text><text x="${L+PW}" y="${TOP+PH+16}" font-size="11" text-anchor="end">${esc(s.points[s.points.length-1].date)}</text>`;
  return frame(title,[`Points: ${s.points.length} included comparable tests.`,ref,...labelLines],body,PH);
}
```

- [ ] **Step 5: Run to verify it passes.** Compile; `node --test tests/test-records-chart.test.mjs` → 5 pass; `node --test tests/h10-diagnostics*.test.mjs` → unchanged pass; full suite 0 fail.

---

### Task 3: Exports (`src/testRecordsExport.ts`)

**Files:**
- Create: `N/src/testRecordsExport.ts`
- Test: `N/tests/test-records-export.test.mjs`

**Interfaces:**
- Consumes: Task 1 state, constants and functions; Task 2 `testPressureSvg`.
- Produces: types `TestSource`, `SealedTestRecords`; `sealTestRecords(state, source)`, `verifyTestRecordsSealed(sealed)`, `testRecordsJson(sealed)`, `testRecordsCsv(sealed)`, `testRecordsSvg(sealed, state)`.

- [ ] **Step 1: Write the failing test** `N/tests/test-records-export.test.mjs`:

```js
import test from 'node:test';import assert from 'node:assert/strict';
import {buildTestState,applyTestDecision} from '../dist/testRecords.js';
import {sealTestRecords,verifyTestRecordsSealed,testRecordsJson,testRecordsCsv,testRecordsSvg} from '../dist/testRecordsExport.js';

const row=(id,date,psia,depth,o={})=>({source_row_key:`k${id}`,source_report_id:String(id),tracking_no:'9',test_sequence_no:'1.0',uic_number:'000000417',report_conducted_date:date,report_conducted_date_text:date??'',bhp_psia:psia,test_depth_ft:depth,quality_flags:[],...o});
const srt={source_row_key:'s1',source_report_id:'20',tracking_no:'9',uic_number:'000000417',test_date:'2022-11-07',test_date_text:'2022-11-07',satisfactory_test_code:'1',isip_psig:null,formation_frac_press_psig:1544,surface_pressure_firc_psig:null,quality_flags:['missing:isip_psig']};
let state=buildTestState({package:{bhp:[row(1,'2024-03-03',1674,2396),row(2,'2024-06-07',1690,2396),row(3,'2022-11-07',1445,2228)],srt:[srt]}},{first:'2023-10',last:'2026-09'});
state=applyTestDecision(state,'package:bhp:2',false,'=cmd|calc');
const source={uic:'000000417',package:{artifactId:'synthetic',normalizedSha256:'a'.repeat(64),manifestSha256:'b'.repeat(64),files:{'tests.json':'c'.repeat(64)}},uploads:[]};

test('sealed JSON round-trips and detects tampering',async()=>{
 const sealed=await sealTestRecords(state,source);
 assert.equal(sealed.method,'test-records/1');assert.equal(await verifyTestRecordsSealed(JSON.parse(testRecordsJson(sealed))),true);
 assert.equal(await verifyTestRecordsSealed({...sealed,referenceDepthFt:1}),false);
 const r=sealed.records.find(x=>x.key==='package:bhp:3');
 assert.deepEqual([r.flags,r.include,r.decidedBy,r.contributes,r.rangePosition],[['depth-differs'],false,'system',false,'before']);
 assert.equal(sealed.records.find(x=>x.key==='package:bhp:1').contributes,true);
 assert.equal(sealed.readiness,'Calibrated injectivity (J): not ready. Needs a flowing bottomhole pressure with a same-time rate and a reservoir pressure reference (Phase 1c).');
 assert.deepEqual(sealed.outOfRange,{before:['package:bhp:3','package:srt:1'],after:[]});
});
test('re-including the off-depth test changes what contributes',async()=>{
 const s=applyTestDecision(state,'package:bhp:3',true),sealed=await sealTestRecords(s,source);
 assert.equal(sealed.records.find(x=>x.key==='package:bhp:3').contributes,true);
});
test('CSV quotes every cell, writes unavailable for null and neutralizes formula-like text',async()=>{
 const csv=testRecordsCsv(await sealTestRecords(state,source));
 assert.match(csv,/^"Test records export","test-records\/1"\r\n/);assert.match(csv,/"'=cmd\|calc"/);assert.match(csv,/"unavailable"/);
 assert.match(csv,/"Notice","""unavailable"" marks/);
 assert.match(csv,/Source field named psia; RRC Permian guidance says PSIG; unresolved, not converted/);
 assert.equal(csv.split('\r\n').filter(l=>l.startsWith('"package:')).length,4);
});
test('SVG embeds the full sealed JSON as escaped metadata',async()=>{
 const sealed=await sealTestRecords(state,source),svg=testRecordsSvg(sealed,state);
 const meta=/<metadata>([\s\S]*)<\/metadata>/.exec(svg)[1].replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
 assert.deepEqual(JSON.parse(meta),sealed);
});
```

- [ ] **Step 2: Run to verify it fails** (`ERR_MODULE_NOT_FOUND`).

- [ ] **Step 3: Implement** `N/src/testRecordsExport.ts`:

```ts
import { FLAG_REASONS, J_READINESS, LABEL_BHP_BASIS, LIMITATIONS, ORIGIN_LABELS, TEST_RECORDS_VERSION, bhpSeries, rangePosition, testCoverage, timelineMarkers,
  type MonthRange, type TestCoverage, type TestFlag, type TestKind, type TestOrigin, type TestRow, type TestState } from './testRecords.js';
import { testPressureSvg } from './testRecordsChart.js';

export type TestSource={uic:string;package:{artifactId:string;normalizedSha256:string|null;manifestSha256:string|null;files:Record<string,string>}|null;uploads:{kind:TestKind;fileName:string;sha256:string}[]};
export type ExportRecord={key:string;kind:TestKind;origin:TestOrigin;originLabel:string;identity:string;sourceRowKey:string;date:string|null;dateText:string;rangePosition:'before'|'in'|'after'|null;
  pressures:{field:string;value:number|null;unit:string}[];depthFt:number|null;values:TestRow;qualityFlags:string[];flags:TestFlag[];flagReasons:string[];notes:string[];
  include:boolean;reason:string|null;decidedBy:'system'|'user';contributes:boolean};
export type SealedTestRecords={schemaVersion:'test-records-export/1';method:typeof TEST_RECORDS_VERSION;source:TestSource;coverage:TestCoverage;referenceDepthFt:number|null;referenceTie:boolean;
  range:MonthRange|null;records:ExportRecord[];outOfRange:{before:string[];after:string[]};readiness:string;limitations:string[];contentSha256:string};

async function sha256(text:string) {
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
const body=(s:Omit<SealedTestRecords,'contentSha256'>|SealedTestRecords)=>{const {contentSha256:_,...rest}={contentSha256:'',...s};return JSON.stringify(rest);};
const unit=(field:string)=>field==='bhp_psia'?`psia as named (${LABEL_BHP_BASIS})`:'psig as reported';

export async function sealTestRecords(state:TestState,source:TestSource):Promise<SealedTestRecords> {
  const bhpKeys=new Set(bhpSeries(state).points.map(p=>p.key)),markerKeys=new Set(state.records.filter(r=>r.kind==='srt').filter(r=>timelineMarkers({...state,records:[r]}).length).map(r=>r.key));
  const records:ExportRecord[]=state.records.map(r=>{const d=state.decisions[r.key];return {key:r.key,kind:r.kind,origin:r.origin,originLabel:ORIGIN_LABELS[r.origin],identity:r.identity,sourceRowKey:r.sourceRowKey,
    date:r.date,dateText:r.dateText,rangePosition:rangePosition(r.date,state.range),pressures:r.pressures.map(p=>({...p,unit:unit(p.field)})),depthFt:r.depthFt,values:{...r.values},
    qualityFlags:[...r.qualityFlags],flags:[...r.flags],flagReasons:[...r.reasons],notes:[...r.notes],include:d.include,reason:d.reason,decidedBy:d.byUser?'user':'system',
    contributes:r.kind==='bhp'?bhpKeys.has(r.key):markerKeys.has(r.key)};});
  const pos=(p:'before'|'after')=>state.records.filter(r=>rangePosition(r.date,state.range)===p).map(r=>r.key);
  const unsealed={schemaVersion:'test-records-export/1' as const,method:TEST_RECORDS_VERSION as typeof TEST_RECORDS_VERSION,source:JSON.parse(JSON.stringify(source)) as TestSource,coverage:testCoverage(state),
    referenceDepthFt:state.referenceDepthFt,referenceTie:state.referenceTie,range:state.range?{...state.range}:null,records,outOfRange:{before:pos('before'),after:pos('after')},readiness:J_READINESS,limitations:[...LIMITATIONS]};
  return {...unsealed,contentSha256:await sha256(body(unsealed))};
}
export async function verifyTestRecordsSealed(sealed:SealedTestRecords):Promise<boolean> {return /^[a-f0-9]{64}$/.test(sealed?.contentSha256??'')&&await sha256(body(sealed))===sealed.contentSha256;}
export const testRecordsJson=(sealed:SealedTestRecords)=>JSON.stringify(sealed,null,2)+'\n';

const cell=(v:unknown)=>{
  if(v===null||v===undefined) return '"unavailable"';
  if(typeof v==='number') return `"${v}"`;
  let s=String(v);if(/^[=+\-@\t\r]/.test(s)) s="'"+s;
  return `"${s.replace(/"/g,'""')}"`;
};
export function testRecordsCsv(sealed:SealedTestRecords):string {
  const p=sealed.source.package,pv=(r:ExportRecord,f:string)=>r.pressures.find(x=>x.field===f)?.value??null;
  const lines:unknown[][]=[['Test records export',sealed.method],['UIC',sealed.source.uic],['Package artifact',p?.artifactId??null],['Normalized SHA-256',p?.normalizedSha256??null],['Manifest SHA-256',p?.manifestSha256??null],
    ...Object.entries(p?.files??{}).map(([name,hash])=>['Package file SHA-256',`${name} ${hash}`]),...sealed.source.uploads.map(u=>['Upload (not verified)',`${u.kind} ${u.fileName} ${u.sha256}`]),
    ['Content SHA-256',sealed.contentSha256],['Notice','"unavailable" marks a missing value, never zero; pressures are as reported and never converted'],
    ['Reference depth (ft)',sealed.referenceTie?'none: no single most-common depth':sealed.referenceDepthFt],['H-10 range',sealed.range?`${sealed.range.first} to ${sealed.range.last}`:null],
    ['Readiness',sealed.readiness],...sealed.limitations.map(l=>['Limitation',l]),[],
    ['Record','Type','Origin','Report identity','Test date','Date as published','H-10 range position','BHP (source field named psia)','ISIP (psig)','Frac pressure (psig)','FIRC surface pressure (psig)','Depth (ft)','Flags','Explorer quality flags','Included','Decided by','Reason','Contributes','Source row key'],
    ...sealed.records.map(r=>[r.key,r.kind.toUpperCase(),r.originLabel,r.identity,r.date,r.dateText,r.rangePosition,pv(r,'bhp_psia'),pv(r,'isip_psig'),pv(r,'formation_frac_press_psig'),pv(r,'surface_pressure_firc_psig'),
      r.depthFt,r.flags.join('; ')||'none',r.qualityFlags.join('; ')||'none',r.include?'yes':'no',r.decidedBy,r.reason,r.contributes?'yes':'no',r.sourceRowKey])];
  return lines.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
const escXml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
export function testRecordsSvg(sealed:SealedTestRecords,state:TestState):string {
  const a=testPressureSvg(state);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 ${a.height}" width="960" height="${a.height}"><metadata>${escXml(JSON.stringify(sealed))}</metadata><svg y="0" width="960" height="${a.height}">${a.svg}</svg></svg>`;
}
```

- [ ] **Step 4: Run to verify it passes.** Compile; `node --test tests/test-records-export.test.mjs` → 4 pass; full suite 0 fail.

---

### Task 4: Explorer query-version-4 receiver

**Files:**
- Create: `N/web/explorer-tests.mjs`, `N/tests/helpers/explorer-v4.mjs`, `N/tests/explorer-package-v4.test.mjs`
- Modify (archived in Task 0): `N/web/explorer-evidence.mjs`, `N/web/explorer-package.mjs`

**Interfaces:**
- Consumes: V4 (the contract reference); existing `numberField`, `sourceScopeFlags`, `normalizeExplorerRows`, `createExplorerDictionary`, `inventoryColumns`, `monthlyColumns`.
- Produces: `verifyExplorerPackage(...)` result gains `tests` (`null`, or frozen `{bhp, srt, quality, sha256:{'tests.json','tests_bhp.csv','tests_srt.csv','tests_dictionary.json'}}`); exports from `web/explorer-tests.mjs`: `TESTS_DICTIONARY_SHA256`, `officialTestDocuments`, `testColumns`, `normalizeExplorerTests`, `explorerCsv`, `testsDictionary`, re-exported `testReportOrder`; from `web/explorer-evidence.mjs`: `rowDisposition`, `boundedExplorerScope`, `testReportOrder`; `verifyRecordedExplorerEvidence` also returns `rawTests` and `queryVersion`.

- [ ] **Step 1: Write the failing tests.** Create the helper `N/tests/helpers/explorer-v4.mjs`:

```js
// Test-only. Builds an Explorer query-version-4 package IN MEMORY from the committed v2
// fixture. The UIC is rewritten to the fictional 000000417; every test, casing and plugging
// row and every added document is synthetic. Never write its output into tests/fixtures or data/.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {normalizeExplorerRows,createExplorerDictionary,inventoryColumns,monthlyColumns,testReportOrder} from '../../web/explorer-evidence.mjs';
import {normalizeExplorerTests,explorerCsv,testColumns,testsDictionary} from '../../web/explorer-tests.mjs';

export const SYNTHETIC_UIC='000000417';
const FIXTURE_UIC='000056484',RETRIEVED='2026-10-30T00:00:00.000Z';
const DOC='Synthetic stand-in document for receiver tests; not an RRC publication.\n';
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const bytes=v=>Buffer.isBuffer(v)?v:Buffer.from(typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
function checksum(header){header.fill(32,148,156);header.write(header.reduce((sum,value)=>sum+value,0).toString(8).padStart(6,'0')+'\0 ',148);return header;}
export function pack(files){
 const chunks=[];
 for(const [name,value] of files){
  const body=bytes(value),header=Buffer.alloc(512),octal=(v,w)=>v.toString(8).padStart(w-1,'0')+'\0';
  header.write(name,0,100);header.write(octal(0o644,8),100);header.write(octal(0,8),108);header.write(octal(0,8),116);header.write(octal(body.length,12),124);header.write(octal(0,12),136);header[156]=48;header.write('ustar\0',257);header.write('00',263);
  chunks.push(checksum(header),body,Buffer.alloc((512-body.length%512)%512));
 }
 return Buffer.concat([...chunks,Buffer.alloc(1024)]);
}
export function unpack(archive){
 const files=new Map();
 for(let offset=0;archive[offset]!==0;){
  const name=archive.subarray(offset,offset+100).toString().split('\0')[0],size=parseInt(archive.subarray(offset+124,offset+136).toString(),8);
  files.set(name,Buffer.from(archive.subarray(offset+512,offset+512+size)));offset+=512+Math.ceil(size/512)*512;
 }
 return files;
}
const json=(files,name)=>JSON.parse(files.get(name));
const put=(files,name,value)=>files.set(name,bytes(value));

/** Recompute each retrieval sidecar's sha256/bytes from its raw body, then the lookup hash inventory and selection pin. */
export function refreshEvidence(files){
 for(const name of [...files.keys()].filter(n=>n.endsWith('.source.json'))){
  const stem=name.slice(0,-'.source.json'.length),raw=[...files.keys()].find(k=>!k.endsWith('.source.json')&&k.replace(/\.[^./]+$/,'')===stem);
  const meta=json(files,name),body=files.get(raw);meta.sha256=sha(body);meta.bytes=body.length;put(files,name,meta);
 }
 const lookup=json(files,'sources/lookup.json');
 for(const n of ['lookup-inventory.json','lookup-inventory.source.json','lookup-metadata.json','lookup-metadata.source.json'])lookup.files[n]=sha(files.get('sources/'+n));
 put(files,'sources/lookup.json',lookup);
 const selection=json(files,'sources/selection.json');selection.lookupSha256=lookup.files['lookup-inventory.json'];put(files,'sources/selection.json',selection);
}

/** Recompute manifest.files hashes, normalized.manifest and version-pins. Never re-derives content. */
export function repin(files){
 const manifest=json(files,'manifest.json');
 for(const name of Object.keys(manifest.files)){const body=files.get(name);if(body)manifest.files[name]={sha256:sha(body),bytes:body.length};}
 const normalized=json(files,'normalized.json');normalized.manifest=manifest;
 const m=bytes(manifest),n=bytes(normalized);files.set('manifest.json',m);files.set('normalized.json',n);
 put(files,'version-pins.json',{schemaVersion:1,artifactId:manifest.artifact_id,path:`/artifacts/${manifest.artifact_id}/`,manifestSha256:sha(m),normalizedSha256:sha(n),classification:'public_reported',realHistoryStatus:manifest.real_history_status});
}

/** Rebuild every derived file and the manifest from the raw sources, following V4 §2, §3 and §6. */
export function derive(files){
 const hashOf=n=>sha(files.get('sources/'+n)),sid=(id,n)=>`${id}:${hashOf(n).slice(0,16)}`;
 const scope=json(files,'sources/acquisition.json').scope,rawInventory=json(files,'sources/candidate-inventory.json'),rawMonthly=json(files,'sources/candidate-monthly.json');
 const sourceIds={inventory:sid('givw-z9t4','candidate-inventory.json'),monthly:sid('qq2j-f2zm','candidate-monthly.json'),bhp:sid('qxfy-wcfs','candidate-bhp.json'),srt:sid('h54t-xnbi','candidate-srt.json'),
  wellbore_inventory:sid('givw-z9t4','wellbore-inventory.json'),casing:sid('u9m4-xnh6','candidate-casing.json'),plugging:sid('wfzn-9fje','candidate-plugging.json')};
 const canonical=normalizeExplorerRows(rawInventory,rawMonthly,{inventory:sourceIds.inventory,monthly:sourceIds.monthly},scope),dictionary=createExplorerDictionary(canonical,true);
 put(files,'quality_report.json',canonical.quality);put(files,'data_dictionary.json',dictionary);
 files.set('inventory.csv',Buffer.from(explorerCsv(canonical.inventory,inventoryColumns)));files.set('injection_monthly.csv',Buffer.from(explorerCsv(canonical.monthly,monthlyColumns)));
 const manifest=json(files,'manifest.json'),artifactId=manifest.artifact_id;
 const testRows=normalizeExplorerTests({bhp:json(files,'sources/candidate-bhp.json'),srt:json(files,'sources/candidate-srt.json')},sourceIds,canonical.inventory,scope);
 const status=rows=>rows.length?'returned_below_cap':'confirmed_empty';
 const tests={schemaVersion:1,artifactId,scope:{query_version:4,uic_number:scope.monthlyUic,test_report_limit:1000,order:`BHP ${testReportOrder.bhp}; SRT ${testReportOrder.srt}`,bhp_returned:testRows.bhp.length,srt_returned:testRows.srt.length,bhp_status:status(testRows.bhp),srt_status:status(testRows.srt),window:'exact uic_no; not limited to reporting period'},bhp:testRows.bhp,srt:testRows.srt,quality:testRows.quality};
 files.set('tests.json',Buffer.from(JSON.stringify(tests,null,2)+'\n'));
 files.set('tests_bhp.csv',Buffer.from(explorerCsv(testRows.bhp,testColumns.bhp)));files.set('tests_srt.csv',Buffer.from(explorerCsv(testRows.srt,testColumns.srt)));
 files.set('tests_dictionary.json',Buffer.from(JSON.stringify(testsDictionary(),null,2)+'\n'));
 put(files,'casing.json',{artifactId,scope:{query_version:4,source_api_id:scope.sourceApiId},rows:json(files,'sources/candidate-casing.json')});
 put(files,'plugging.json',{artifactId,scope:{query_version:4,source_api_id:scope.sourceApiId},rows:json(files,'sources/candidate-plugging.json')});
 files.set('casing.csv',Buffer.from('synthetic\n'));files.set('plugging.csv',Buffer.from('synthetic\n'));put(files,'wellbore_dictionary.json',{schema_version:1,note:'Synthetic stand-in; receiver tests check hashes only.'});
 const [year,month]=scope.endMonth.split('-').map(Number);
 manifest.transformation_version='rrc-odp-v2.2.0';
 manifest.scope={query_version:4,uic_number:scope.monthlyUic,start:scope.startMonth+'-01',end:`${scope.endMonth}-${new Date(Date.UTC(year,month,0)).getUTCDate()}`,inventory_limit:25,inventory_returned:1,monthly_limit:1000,monthly_returned:rawMonthly.length,pagination:'Complete bounded response below cap; no statewide coverage',test_report_limit:1000,wellbore_limit:1000,wellbore_inventory_limit:25};
 const selection=json(files,'sources/selection.json');manifest.selection=selection;
 const kinds={'candidate-inventory.json':'inventory','candidate-monthly.json':'monthly','candidate-bhp.json':'bhp','candidate-srt.json':'srt','wellbore-inventory.json':'wellbore_inventory','candidate-casing.json':'casing','candidate-plugging.json':'plugging'};
 const entry=file=>{
  const body=files.get('sources/'+file),meta=json(files,'sources/'+file.replace(/\.[^.]+$/,'')+'.source.json'),kind=kinds[file]??(file.endsWith('.json')?'metadata':'documentation'),label=file.endsWith('.json')?file.slice(0,-5):file;
  const title=kind==='metadata'?JSON.parse(body).name:kind==='documentation'?undefined:json(files,`sources/${kind==='wellbore_inventory'?'inventory':kind}-metadata.json`).name;
  return {snapshot_id:sourceIds[kind]??`${label}:${sha(body).slice(0,16)}`,name:label,...(title===undefined?{}:{title}),kind,...Object.fromEntries(Object.entries(meta).filter(([k])=>['url','retrieved_at','http_status','last_modified','etag','sha256','bytes','testFixture'].includes(k))),sha256:sha(body),bytes:body.length,raw_file:'sources/'+file};
 };
 manifest.sources=[...['candidate-inventory.json','candidate-monthly.json','inventory-metadata.json','monthly-metadata.json','uic-manual.pdf','rrc-resources.html','uic-query-help.html'].map(entry),
  {snapshot_id:'lookup:'+selection.lookupSha256.slice(0,16),name:'lookup-inventory',kind:'selection',...json(files,'sources/lookup-inventory.source.json'),raw_file:'sources/lookup-inventory.json'},
  ...['candidate-bhp.json','candidate-srt.json','bhp-metadata.json','srt-metadata.json','srt-guidelines.html','bhp-permian-nto.pdf','wellbore-inventory.json','candidate-casing.json','candidate-plugging.json','casing-metadata.json','plugging-metadata.json','wellbore-wba091.pdf','form-w2.pdf','form-w3.pdf'].map(entry)];
 manifest.files={};for(const name of [...files.keys()].sort())if(!['manifest.json','normalized.json','version-pins.json'].includes(name))manifest.files[name]={sha256:'',bytes:0};
 const payload={schemaVersion:1,artifactId,inventory:canonical.inventory,injectionMonthly:canonical.monthly,qualityReport:canonical.quality,dataDictionary:dictionary};
 manifest.normalized_payload_sha256=sha(Buffer.from(JSON.stringify(payload)));
 put(files,'manifest.json',manifest);put(files,'normalized.json',{...payload,manifest});
 repin(files);
}

/** A complete synthetic v4 package. Rows are raw ODP-shaped objects (strings, as published); uic_no defaults to the synthetic UIC. */
export async function buildV4Files({bhp=[],srt=[],casing=[{record_sequence:'1',id:'1'}],plugging=[]}={}){
 const files=unpack(await readFile(new URL('../fixtures/explorer-packages/public-uic000056484.tar',import.meta.url)));
 for(const [name,body] of [...files])if(/\.(json|csv)$/.test(name))files.set(name,Buffer.from(body.toString('utf8').replaceAll(FIXTURE_UIC,SYNTHETIC_UIC)));
 const acquisition=json(files,'sources/acquisition.json'),rawInventory=json(files,'sources/candidate-inventory.json');
 const apiNo=rawInventory[0].api_no,sourceApiId=/^\d{8}$/.test(apiNo)?apiNo:null;
 if(sourceApiId===null)throw new Error('The v2 fixture inventory api_no must be 8 digits for the wellbore part of the synthetic package.');
 const scope={...acquisition.scope,queryVersion:4,testReportLimit:1000,sourceApiId,wellboreLimit:1000,wellboreInventoryLimit:25};
 const uicQuery=order=>new URLSearchParams({'$where':`uic_no='${SYNTHETIC_UIC}'`,'$limit':'1000','$order':order});
 const apiQuery=new URLSearchParams({'$where':`api_no='${sourceApiId}'`,'$limit':'1000','$order':'record_sequence,id'});
 const apiLookup=new URLSearchParams({'$where':`api_no='${sourceApiId}'`,'$limit':'25','$order':'uic_number,api_no'});
 const withUic=rows=>rows.map(r=>({uic_no:SYNTHETIC_UIC,...r})),withApi=rows=>rows.map(r=>({api_no:sourceApiId,...r}));
 const extra=[ // producer acquisition-target order (V4 §1)
  ['bhp-metadata.json','https://data.texas.gov/api/views/qxfy-wcfs.json',{name:'RRC-UIC Bottom Hole Pressure Test Results'}],
  ['srt-metadata.json','https://data.texas.gov/api/views/h54t-xnbi.json',{name:'RRC-UIC Step Rate Test Results'}],
  ['candidate-bhp.json',`https://data.texas.gov/resource/qxfy-wcfs.json?${uicQuery(testReportOrder.bhp)}`,withUic(bhp)],
  ['candidate-srt.json',`https://data.texas.gov/resource/h54t-xnbi.json?${uicQuery(testReportOrder.srt)}`,withUic(srt)],
  ['srt-guidelines.html','https://www.rrc.texas.gov/oil-and-gas/applications-and-permits/injection-storage-permits/oil-and-gas-waste-disposal/injection-disposal-permit-procedures/technical-review/step-rate-test-guidelines/',DOC],
  ['bhp-permian-nto.pdf','https://www.rrc.texas.gov/media/sm5bzzpg/nto-disposal-well-monitoring-reporting-requirements-in-the-permian-basin-12-19-2023.pdf',DOC],
  ['casing-metadata.json','https://data.texas.gov/api/views/u9m4-xnh6.json',{name:'Synthetic casing dataset'}],
  ['plugging-metadata.json','https://data.texas.gov/api/views/wfzn-9fje.json',{name:'Synthetic plugging dataset'}],
  ['wellbore-inventory.json',`https://data.texas.gov/resource/givw-z9t4.json?${apiLookup}`,[{...rawInventory[0]}]],
  ['candidate-casing.json',`https://data.texas.gov/resource/u9m4-xnh6.json?${apiQuery}`,withApi(casing)],
  ['candidate-plugging.json',`https://data.texas.gov/resource/wfzn-9fje.json?${apiQuery}`,withApi(plugging)],
  ['wellbore-wba091.pdf','https://www.rrc.texas.gov/media/cx2i4xrm/wba091_well-bore-database.pdf',DOC],
  ['form-w2.pdf','https://www.rrc.texas.gov/media/sdbph42m/w-2-0114.pdf',DOC],
  ['form-w3.pdf','https://www.rrc.texas.gov/media/lw0bmny4/w-3p.pdf',DOC]];
 for(const [file,url,body] of extra){put(files,'sources/'+file,body);put(files,'sources/'+file.replace(/\.[^.]+$/,'')+'.source.json',{url,retrieved_at:RETRIEVED,http_status:200,testFixture:false});}
 acquisition.scope=scope;acquisition.targets=[...acquisition.targets,...extra.map(([,url])=>url)];put(files,'sources/acquisition.json',acquisition);
 refreshEvidence(files);derive(files);
 return files;
}
export const buildV4Package=async options=>pack(await buildV4Files(options));
```

Create `N/tests/explorer-package-v4.test.mjs`:

```js
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {verifyExplorerPackage} from '../web/explorer-package.mjs';
import {TESTS_DICTIONARY_SHA256,testsDictionary,explorerCsv,testColumns,normalizeExplorerTests} from '../web/explorer-tests.mjs';
import {buildV4Files,buildV4Package,pack,repin,sha,SYNTHETIC_UIC} from './helpers/explorer-v4.mjs';

const bhpRaw=(id,date,psia,depth,o={})=>({report_id:String(id),tracking_no:'57160000',report_conducted_date:date,report_received_date:'2024-12-01',bhp_psia:psia,test_depth_ft:depth,gradient_psi_ft:'0.7',tested_formation:'SYNTHETIC',test_sequence_no:'1.0',...o});
const srtRaw={report_id:'1108',tracking_no:'57160000',srt_received_date:'2022-12-02',test_date:'2022-11-07',satisfactory_test:'1',top_perf_ft:'2395.0',bottom_perf_ft:'4569.0',formation_tested:'Synthetic',min_inj_rate_bpm:'0.0',max_inj_rate_bpm:'26.63',formation_frac_press_psig:'1544.0',fracture_gradient_psi_ft:'0.693'};
const rows={bhp:[bhpRaw(1430,'2022-11-07','1445.0','2228.0'),bhpRaw(1483,'2024-03-03','1674.0','2396.0'),bhpRaw(1484,'2024-06-07','1690.0','2396.0')],srt:[srtRaw]};

test('the copied Explorer test dictionary is byte-identical to the producer (pinned SHA-256)',()=>{
 assert.equal(sha(Buffer.from(JSON.stringify(testsDictionary(),null,2)+'\n')),TESTS_DICTIONARY_SHA256);
});
test('the copied Explorer CSV writer keeps the producer format',()=>{
 const t=normalizeExplorerTests({bhp:[],srt:[{...srtRaw,uic_no:SYNTHETIC_UIC}]},{bhp:'qxfy-wcfs:x',srt:'h54t-xnbi:y'},[{uic_number:SYNTHETIC_UIC,source_record_key:'rrc:uic:p:1'}],null);
 assert.equal(explorerCsv(t.srt,testColumns.srt).split('\n')[1],'rrc:srt:h54t-xnbi:y:1,rrc:uic:p:1,matched,000000417,1108,57160000,2022-12-02,2022-12-02,2022-11-07,2022-11-07,1,2395,4569,Synthetic,0,26.63,,1544,,,0.693,,h54t-xnbi:y,missing:isip_psig|missing:frac_inj_rate_capacity_bpd|missing:surface_pressure_firc_psig');
 assert.equal(explorerCsv([],testColumns.bhp),testColumns.bhp.join(',')+'\n');
});
test('a complete query-version-4 package verifies and yields its test records',async()=>{
 const r=await verifyExplorerPackage(await buildV4Package(rows));
 assert.equal(r.artifact.injectionMonthly[0].uic_number,SYNTHETIC_UIC);
 assert.deepEqual(r.tests.bhp.map(x=>x.bhp_psia),[1445,1674,1690]);assert.equal(r.tests.srt[0].formation_frac_press_psig,1544);
 assert.deepEqual(Object.keys(r.tests.sha256).sort(),['tests.json','tests_bhp.csv','tests_dictionary.json','tests_srt.csv']);
 assert.equal(Object.isFrozen(r.tests.bhp[0]),true);
 assert.match(r.preview.warnings.join(' '),/Source field named psia; RRC Permian guidance says PSIG/);
});
test('the committed v2 fixture still verifies with no test records',async()=>{
 const r=await verifyExplorerPackage(await readFile(new URL('./fixtures/explorer-packages/public-uic000056484.tar',import.meta.url)));
 assert.equal(r.tests,null);
});
const reject=async(edit,pattern)=>{const files=await buildV4Files(rows);await edit(files);await assert.rejects(verifyExplorerPackage(pack(files)),pattern);};
test('a tampered test CSV is rejected even with fresh manifest hashes',async()=>{
 await reject(f=>{f.set('tests_bhp.csv',Buffer.from(f.get('tests_bhp.csv').toString().replace(',1674,',',1675,')));repin(f);},/tests_bhp\.csv contradicts/);
});
test('tests.json that disagrees with the raw rows is rejected',async()=>{
 await reject(f=>{const t=JSON.parse(f.get('tests.json'));t.bhp[0].test_depth_ft=2396;f.set('tests.json',Buffer.from(JSON.stringify(t,null,2)+'\n'));repin(f);},/tests\.json contradicts/);
});
test('an altered test dictionary is rejected',async()=>{
 await reject(f=>{f.set('tests_dictionary.json',Buffer.from(f.get('tests_dictionary.json').toString().replace('never converted','converted')));repin(f);},/tests_dictionary\.json/);
});
test('a raw test row for another well is rejected',async()=>{
 await assert.rejects(verifyExplorerPackage(await buildV4Package({...rows,bhp:[bhpRaw(1,'2024-01-01','1','1',{uic_no:'000000999'})]})),/contradict the declared query|exact-UIC/);
});
test('a missing test sidecar, an undeclared file, an unsupported version or a changed source API are rejected',async()=>{
 await reject(f=>{f.delete('tests.json');const m=JSON.parse(f.get('manifest.json'));delete m.files['tests.json'];f.set('manifest.json',Buffer.from(JSON.stringify(m)));repin(f);},/missing tests\.json/);
 await reject(f=>{f.set('notes.txt',Buffer.from('x'));},/undeclared/);
 await reject(f=>{const m=JSON.parse(f.get('manifest.json'));m.scope.query_version=3;f.set('manifest.json',Buffer.from(JSON.stringify(m)));repin(f);},/Unsupported Explorer query version: 3/);
 await reject(f=>{const a=JSON.parse(f.get('sources/acquisition.json'));a.scope.sourceApiId='99999999';f.set('sources/acquisition.json',Buffer.from(JSON.stringify(a)));repin(f);},/Acquisition scope/);
});
```

- [ ] **Step 2: Run to verify it fails** (`ERR_MODULE_NOT_FOUND` for `web/explorer-tests.mjs`).

- [ ] **Step 3: Create `N/web/explorer-tests.mjs`** — browser copy of Explorer `src/testReports.mjs` and `csv()` at 3cefa99 (V4 §6). Keep every string and key order verbatim; the dictionary hash test proves the dictionary copy.

```js
// Browser copies of texas-rrc-explorer src/testReports.mjs and normalize.mjs csv() (commit 3cefa99).
// Keep verbatim: the receiver compares Explorer's test sidecars byte for byte. No network or filesystem access.
import {numberField,sourceScopeFlags,rowDisposition,testReportOrder} from './explorer-evidence.mjs';
export {testReportOrder};
export const TESTS_DICTIONARY_SHA256='690574e58f75535d546dd14a1ab51c8bf7e480f0b2674e0eb501ef0cfd9699d4';
export const officialTestDocuments=Object.freeze([
 {name:'srt-guidelines.html',url:'https://www.rrc.texas.gov/oil-and-gas/applications-and-permits/injection-storage-permits/oil-and-gas-waste-disposal/injection-disposal-permit-procedures/technical-review/step-rate-test-guidelines/'},
 {name:'bhp-permian-nto.pdf',url:'https://www.rrc.texas.gov/media/sm5bzzpg/nto-disposal-well-monitoring-reporting-requirements-in-the-permian-basin-12-19-2023.pdf'}
].map(Object.freeze));
export const testColumns=Object.freeze({
 bhp:Object.freeze(['source_row_key','parent_key','parent_join_status','uic_number','source_report_id','tracking_no','test_sequence_no','report_conducted_date','report_conducted_date_text','report_received_date','report_received_date_text','bhp_psia','test_depth_ft','gradient_psi_ft','tested_formation','source_snapshot_id','quality_flags']),
 srt:Object.freeze(['source_row_key','parent_key','parent_join_status','uic_number','source_report_id','tracking_no','srt_received_date','srt_received_date_text','test_date','test_date_text','satisfactory_test_code','top_perf_ft','bottom_perf_ft','formation_tested','min_inj_rate_bpm','max_inj_rate_bpm','isip_psig','formation_frac_press_psig','frac_inj_rate_capacity_bpd','surface_pressure_firc_psig','fracture_gradient_psi_ft','comments','source_snapshot_id','quality_flags'])
});
const str=value=>value==null?'':String(value);
function dateField(value,flags,name){
 const text=str(value);
 if(value===undefined||value===null||text.trim()===''){flags.push(`missing:${name}`);return {date:null,text};}
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
 const valid=match&&Number(match[2])>=1&&Number(match[2])<=12&&Number(match[3])>=1&&Number(match[3])<=new Date(Date.UTC(Number(match[1]),Number(match[2]),0)).getUTCDate();
 if(!valid){flags.push(`parse_failure:${name}`);return {date:null,text};}
 return {date:text,text};
}
const nonNegative=new Set(['bhp_psia','test_depth_ft','top_perf_ft','bottom_perf_ft','min_inj_rate_bpm','max_inj_rate_bpm','frac_inj_rate_capacity_bpd']);
function numbers(row,flags,names){
 const values={};
 for(const name of names){values[name]=numberField(row[name],flags,name);if(nonNegative.has(name)&&values[name]!==null&&values[name]<0)flags.push(`invalid_negative:${name}`);}
 return values;
}
const identity={bhp:row=>`${str(row.report_id)}|${str(row.tracking_no)}|${str(row.test_sequence_no)}`,srt:row=>`${str(row.report_id)}|${str(row.tracking_no)}`};
function normalizeKind(kind,rows,sourceIds,byUic,scope){
 const seen=new Map();for(const row of rows)seen.set(identity[kind](row),(seen.get(identity[kind](row))??0)+1);
 return rows.map((r,i)=>{
  const flags=[],parents=byUic.get(str(r.uic_no))??[];
  const join=parents.length===1?'matched':parents.length===0?'unmatched':'ambiguous';
  if(join!=='matched')flags.push(`${join}:parent`);
  if(!str(r.report_id).trim())flags.push('invalid:source_report_id');
  if(seen.get(identity[kind](r))>1)flags.push('duplicate_report_identity');
  const common={source_row_key:`rrc:${kind}:${sourceIds[kind]}:${i+1}`,parent_key:join==='matched'?parents[0].source_record_key:'',parent_join_status:join,uic_number:str(r.uic_no),source_report_id:str(r.report_id),tracking_no:str(r.tracking_no)};
  let row;
  if(kind==='bhp'){
   const conducted=dateField(r.report_conducted_date,flags,'report_conducted_date'),received=dateField(r.report_received_date,flags,'report_received_date');
   const n=numbers(r,flags,['bhp_psia','test_depth_ft','gradient_psi_ft']);
   row={...common,test_sequence_no:str(r.test_sequence_no),report_conducted_date:conducted.date,report_conducted_date_text:conducted.text,report_received_date:received.date,report_received_date_text:received.text,...n,tested_formation:str(r.tested_formation)};
  }else{
   const received=dateField(r.srt_received_date,flags,'srt_received_date'),tested=dateField(r.test_date,flags,'test_date');
   const perf=numbers(r,flags,['top_perf_ft','bottom_perf_ft']),rate=numbers(r,flags,['min_inj_rate_bpm','max_inj_rate_bpm']),rest=numbers(r,flags,['isip_psig','formation_frac_press_psig','frac_inj_rate_capacity_bpd','surface_pressure_firc_psig','fracture_gradient_psi_ft']);
   if(perf.top_perf_ft!==null&&perf.bottom_perf_ft!==null&&perf.top_perf_ft>perf.bottom_perf_ft)flags.push('inconsistent:top_perf_exceeds_bottom');
   if(rate.min_inj_rate_bpm!==null&&rate.max_inj_rate_bpm!==null&&rate.min_inj_rate_bpm>rate.max_inj_rate_bpm)flags.push('inconsistent:min_rate_exceeds_max');
   row={...common,srt_received_date:received.date,srt_received_date_text:received.text,test_date:tested.date,test_date_text:tested.text,satisfactory_test_code:str(r.satisfactory_test),...perf,formation_tested:str(r.formation_tested),...rate,...rest,comments:str(r.comments)};
  }
  if(scope)flags.push(...sourceScopeFlags(kind,r,scope));
  return {...row,source_snapshot_id:sourceIds[kind],quality_flags:flags};
 });
}
/** inventory: canonical normalized inventory rows; exact UIC join (Explorer ADR 004). */
export function normalizeExplorerTests({bhp,srt},sourceIds,inventory,scope=null){
 const byUic=new Map();for(const r of inventory){const a=byUic.get(r.uic_number)??[];a.push(r);byUic.set(r.uic_number,a);}
 const rows={bhp:normalizeKind('bhp',bhp,sourceIds,byUic,scope),srt:normalizeKind('srt',srt,sourceIds,byUic,scope)};
 const counts=list=>({raw:list.length,parsed:list.length,accepted:list.filter(r=>rowDisposition(r)==='accepted').length,quarantined:list.filter(r=>rowDisposition(r)==='quarantined').length,excluded:0});
 const join=list=>({matched:list.filter(r=>r.parent_join_status==='matched').length,unmatched:list.filter(r=>r.parent_join_status==='unmatched').length,ambiguous:list.filter(r=>r.parent_join_status==='ambiguous').length});
 const issues=list=>{const out={};for(const r of list)for(const flag of r.quality_flags)out[flag]=(out[flag]??0)+1;return out;};
 const dispositions=list=>list.map(r=>({source_row_key:r.source_row_key,disposition:rowDisposition(r),...(rowDisposition(r)==='quarantined'?{reasons:[...r.quality_flags]}:{})}));
 return {...rows,quality:{bhp:counts(rows.bhp),srt:counts(rows.srt),parent_join:{bhp:join(rows.bhp),srt:join(rows.srt)},issue_counts:{bhp:issues(rows.bhp),srt:issues(rows.srt)},dispositions:[...dispositions(rows.bhp),...dispositions(rows.srt)],
  duplicate_policy:'Every source row retained. Rows sharing a report identity (BHP report_id|tracking_no|test_sequence_no; SRT report_id|tracking_no) are all flagged duplicate_report_identity and quarantined; no preferred row is selected or merged.',
  empty_result_policy:'An empty exact-UIC response ([]) is recorded as confirmed_empty: no rows were returned by the query. It does not show that no test was conducted.'}};
}
/** Explorer normalize.mjs csv(): LF, header always followed by \n, quote only on ",\r\n, arrays joined by |. */
export function explorerCsv(rows,columns){return columns.join(',')+'\n'+rows.map(r=>columns.map(k=>{const v=r[k];const s=Array.isArray(v)?v.join('|'):v==null?'':String(v);return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;}).join(',')).join('\n')+(rows.length?'\n':'');}
const NO_DESCRIPTIONS='ODP publishes no column descriptions.';
const SRT_CONCEPT='Concept per official RRC step rate test guidelines (srt-guidelines.html); units from the ODP field name.';
const fieldDefinitions={
 source_row_key:['string','calculated','Dataset snapshot plus 1-based raw response ordinal; retained duplicates stay distinct',null,'calculated',''],
 parent_key:['string','calculated','Inventory source_record_key when the exact uic_no string matches exactly one retained inventory parent (ADR 004 inventory_to_test_report)','uic_no','calculated',''],
 parent_join_status:['enum','calculated','matched / unmatched / ambiguous by exact UIC string','uic_no','calculated',''],
 uic_number:['string','public reported','Original nine-character uic_no; preserves leading zeros','uic_no','odp_field_name',''],
 source_report_id:['string','public reported','Original report_id kept as a string; part of the report identity','report_id','odp_field_name','Identity value; meaning undocumented.'],
 tracking_no:['string','public reported','Original tracking_no kept as a string; part of the report identity','tracking_no','odp_field_name','Identity value; meaning undocumented.'],
 test_sequence_no:['string','public reported','Original test_sequence_no kept as a string; part of the BHP report identity','test_sequence_no','odp_field_name','Identity value; meaning undocumented.'],
 report_conducted_date:['date','public reported','report_conducted_date when it is a valid YYYY-MM-DD date; otherwise empty','report_conducted_date','odp_field_name',''],
 report_conducted_date_text:['text','public reported','Original report_conducted_date text exactly as published','report_conducted_date','odp_field_name',''],
 report_received_date:['date','public reported','report_received_date when it is a valid YYYY-MM-DD date; otherwise empty','report_received_date','odp_field_name',''],
 report_received_date_text:['text','public reported','Original report_received_date text exactly as published','report_received_date','odp_field_name',''],
 bhp_psia:['psia as named by the ODP field','public reported','Reported bottom hole pressure as published','bhp_psia','odp_field_name','Official RRC Permian guidance (bhp-permian-nto.pdf p.1) states BHP is reported in PSIG; the ODP field name says psia. The conflict is unresolved; the value is shown as published and never converted. That guidance covers Permian districts 7C, 8, 8A and Fisher County only.'],
 test_depth_ft:['ft','public reported','Reported test depth as published','test_depth_ft','odp_field_name','Reported depth; depth basis unstated (measured or true vertical depth is not documented).'],
 gradient_psi_ft:['psi/ft','public reported','Reported BHP gradient as published','gradient_psi_ft','odp_field_name','Meaning unstated; not the SRT fracture gradient.'],
 tested_formation:['name','public reported','Original tested_formation text','tested_formation','odp_field_name',''],
 srt_received_date:['date','public reported','srt_received_date when it is a valid YYYY-MM-DD date; otherwise empty','srt_received_date','odp_field_name',''],
 srt_received_date_text:['text','public reported','Original srt_received_date text exactly as published','srt_received_date','odp_field_name',''],
 test_date:['date','public reported','test_date when it is a valid YYYY-MM-DD date; otherwise empty','test_date','odp_field_name',''],
 test_date_text:['text','public reported','Original test_date text exactly as published','test_date','odp_field_name',''],
 satisfactory_test_code:['source code','public reported','Original satisfactory_test value shown verbatim','satisfactory_test','odp_field_name','Values 0/1 shown verbatim; code meaning undocumented.'],
 top_perf_ft:['ft','public reported','Reported top perforation depth as published','top_perf_ft','odp_field_name','Depth basis unstated.'],
 bottom_perf_ft:['ft','public reported','Reported bottom perforation depth as published','bottom_perf_ft','odp_field_name','Depth basis unstated.'],
 formation_tested:['name','public reported','Original formation_tested text','formation_tested','odp_field_name',''],
 min_inj_rate_bpm:['bbl/min (bpm as named)','public reported','Reported minimum step injection rate as published','min_inj_rate_bpm','official_document:srt-guidelines.html',SRT_CONCEPT],
 max_inj_rate_bpm:['bbl/min (bpm as named)','public reported','Reported maximum step injection rate as published','max_inj_rate_bpm','official_document:srt-guidelines.html',SRT_CONCEPT],
 isip_psig:['psig','public reported','Reported instantaneous shut-in pressure as published','isip_psig','official_document:srt-guidelines.html',SRT_CONCEPT+' The guidance records ISIP at both the surface and the bottom hole; which one this column holds is unstated.'],
 formation_frac_press_psig:['psig','public reported','Reported formation fracture (parting) pressure as published','formation_frac_press_psig','official_document:srt-guidelines.html',SRT_CONCEPT],
 frac_inj_rate_capacity_bpd:['bbl/day','public reported','Reported value as published','frac_inj_rate_capacity_bpd','odp_field_name','FIRC is not defined in any RRC document found; meaning unverified. Units from the ODP field name.'],
 surface_pressure_firc_psig:['psig','public reported','Reported value as published','surface_pressure_firc_psig','odp_field_name','FIRC is not defined in any RRC document found; meaning unverified. Units from the ODP field name.'],
 fracture_gradient_psi_ft:['psi/ft','public reported','Reported fracture gradient as published','fracture_gradient_psi_ft','official_document:srt-guidelines.html',SRT_CONCEPT],
 comments:['text','public reported','Original comments text verbatim','comments','odp_field_name','Verbatim text; meaning undocumented.'],
 source_snapshot_id:['string','calculated','Dataset ID plus raw response SHA256 prefix',null,'calculated',''],
 quality_flags:['list','calculated','Pipe-delimited issues; issues may overlap',null,'calculated','']
};
const documentSupport={'srt-guidelines.html':'SRT purpose, fracture (parting) pressure, fracture gradient in psi/ft, ISIP recorded at shut-in, stepped injection rates','bhp-permian-nto.pdf':'BHP method and unit, p.1; Permian districts 7C, 8, 8A and Fisher County only; states "Operator shall report pressure (PSIG)"'};
/** The public (non-fixture) form of Explorer testsDictionary(). */
export function testsDictionary(){
 const fields={};
 for(const column of [...new Set([...testColumns.bhp,...testColumns.srt])]){
  const [units,status,definition,source_field,basis,note]=fieldDefinitions[column];
  fields[column]={units,status,definition,source_field,basis,note:(NO_DESCRIPTIONS+(note?' '+note:'')).trim()};
 }
 return {schema_version:1,row_grain:{bhp:'one retained official BHP report-inventory row (qxfy-wcfs)',srt:'one retained official SRT report-inventory row (h54t-xnbi)'},
  missing_value:'CSV empty cell / JSON null for absent numbers or dates. Zero remains zero. String absence is empty string.',
  date_policy:'Only valid YYYY-MM-DD dates are parsed; the original text is always kept in the matching _text column.',
  unit_policy:'Units come from the ODP field-name suffix unless an entry cites an official document. Values are shown as reported; psia and psig are kept as labelled and never converted.',
  window:'Exact uic_no; not limited to the reporting period.',
  documents:officialTestDocuments.map(document=>({...document,supports:documentSupport[document.name]})),
  not_cited:'Form W-7 (oil and gas wells, not UIC), conference slides and the versioned review spreadsheet are not used as evidence.',
  order:{...testReportOrder},
  tables:{bhp:[...testColumns.bhp],srt:[...testColumns.srt]},
  fields};
}
```

If the dictionary hash test fails, compare against V4 §6 and Explorer `git show 3cefa99:src/testReports.mjs` / `git show 3cefa99:src/sources.mjs` (read-only, in `C:\Users\thai.phi\Downloads\python\portfolio\texas-rrc-explorer`) until it matches. Never change the pinned hash.

- [ ] **Step 4: Edit `N/web/explorer-evidence.mjs`** (protected; archived in Task 0):
  1. Line 3: `const rowDisposition=` → `export const rowDisposition=`. Directly after line 3 add:
```js
// Explorer isBounded(): query versions 2 and 4 share the bounded H-10 rules. Version 3 is not accepted here.
export const boundedExplorerScope=scope=>scope?.queryVersion===2||scope?.queryVersion===4;
export const testReportOrder=Object.freeze({bhp:'report_id,tracking_no,test_sequence_no',srt:'report_id,tracking_no'});
```
  2. In `sourceScopeFlags`, replace `if(scope.queryVersion===2){` with:
```js
 if(boundedExplorerScope(scope)){
  if(kind==='bhp'||kind==='srt'){if(row.uic_no!==scope.monthlyUic)flags.push('source_scope:uic_no');return flags;}
  if(kind==='casing'||kind==='plugging'||kind==='wellbore_inventory'){if(row?.api_no!==scope.sourceApiId)flags.push('source_scope:api_no');return flags;}
```
  (the existing `if(kind==='inventory')…else{…}return flags;}` body of that block follows unchanged).
  3. In `normalizeExplorerRows`, replace `scope?.queryVersion===2&&` with `boundedExplorerScope(scope)&&`.
  4. Replace the whole `verifyRecordedExplorerEvidence` function (from its doc comment's following `export async function` line to its closing `}`) with:

```js
const transformationVersions={2:'rrc-odp-v2.0.0',4:'rrc-odp-v2.2.0'};
// V4 §1: producer acquisition-target order after the 7 v2 targets.
function v4Targets(scope){
 const byUic=order=>new URLSearchParams({'$where':`uic_no='${scope.monthlyUic}'`,'$limit':'1000','$order':order});
 const byApi=new URLSearchParams({'$where':`api_no='${scope.sourceApiId}'`,'$limit':'1000','$order':'record_sequence,id'});
 const apiLookup=new URLSearchParams({'$where':`api_no='${scope.sourceApiId}'`,'$limit':'25','$order':'uic_number,api_no'});
 return [
  ['bhp-metadata.json','https://data.texas.gov/api/views/qxfy-wcfs.json','metadata','bhp-metadata'],
  ['srt-metadata.json','https://data.texas.gov/api/views/h54t-xnbi.json','metadata','srt-metadata'],
  ['candidate-bhp.json',`https://data.texas.gov/resource/qxfy-wcfs.json?${byUic(testReportOrder.bhp)}`,'bhp','candidate-bhp'],
  ['candidate-srt.json',`https://data.texas.gov/resource/h54t-xnbi.json?${byUic(testReportOrder.srt)}`,'srt','candidate-srt'],
  ['srt-guidelines.html','https://www.rrc.texas.gov/oil-and-gas/applications-and-permits/injection-storage-permits/oil-and-gas-waste-disposal/injection-disposal-permit-procedures/technical-review/step-rate-test-guidelines/','documentation','srt-guidelines.html'],
  ['bhp-permian-nto.pdf','https://www.rrc.texas.gov/media/sm5bzzpg/nto-disposal-well-monitoring-reporting-requirements-in-the-permian-basin-12-19-2023.pdf','documentation','bhp-permian-nto.pdf'],
  ['casing-metadata.json','https://data.texas.gov/api/views/u9m4-xnh6.json','metadata','casing-metadata'],
  ['plugging-metadata.json','https://data.texas.gov/api/views/wfzn-9fje.json','metadata','plugging-metadata'],
  ...(scope.sourceApiId===null?[]:[
   ['wellbore-inventory.json',`https://data.texas.gov/resource/givw-z9t4.json?${apiLookup}`,'wellbore_inventory','wellbore-inventory'],
   ['candidate-casing.json',`https://data.texas.gov/resource/u9m4-xnh6.json?${byApi}`,'casing','candidate-casing'],
   ['candidate-plugging.json',`https://data.texas.gov/resource/wfzn-9fje.json?${byApi}`,'plugging','candidate-plugging']]),
  ['wellbore-wba091.pdf','https://www.rrc.texas.gov/media/cx2i4xrm/wba091_well-bore-database.pdf','documentation','wellbore-wba091.pdf'],
  ['form-w2.pdf','https://www.rrc.texas.gov/media/sdbph42m/w-2-0114.pdf','documentation','form-w2.pdf'],
  ['form-w3.pdf','https://www.rrc.texas.gov/media/lw0bmny4/w-3p.pdf','documentation','form-w3.pdf']];
}
// V4 §3: producer loadSource order after the selection entry.
const v4SourceOrder=api=>['candidate-bhp.json','candidate-srt.json','bhp-metadata.json','srt-metadata.json','srt-guidelines.html','bhp-permian-nto.pdf',...(api===null?[]:['wellbore-inventory.json','candidate-casing.json','candidate-plugging.json']),'casing-metadata.json','plugging-metadata.json','wellbore-wba091.pdf','form-w2.pdf','form-w3.pdf'];

/** Checks recorded acquisition evidence, not cryptographic source authenticity.
 * A local archive cannot establish who fetched its bytes or authenticate a
 * self-authored acquisition log. Callers must preserve that distinction. */
export async function verifyRecordedExplorerEvidence(manifest,{json,read,hash}){
 const version=manifest.scope?.query_version;
 if(!transformationVersions[version]||manifest.transformation_version!==transformationVersions[version]||manifest.provenance?.classification!=='public_reported'||manifest.provenance?.basis!=='recorded_official_acquisition_v2'||manifest.testFixture!==false)fail('Package has no supported recorded public acquisition evidence');
 const acquisition=json('sources/acquisition.json'),scope=acquisition.scope;
 if(acquisition.schemaVersion!==2||acquisition.mode!=='live_collection'||acquisition.status!=='succeeded'||acquisition.testFixture!==false||!uuidPattern.test(acquisition.runId)||!object(scope))fail('Public acquisition is incomplete or fixture classified');
 const monthIndex=value=>{const m=/^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);if(!m||+m[1]<1900||+m[1]>9998)fail('Invalid acquisition reporting range');return +m[1]*12 + +m[2]-1;};
 if(typeof scope.startMonth!=='string'||typeof scope.endMonth!=='string'||typeof scope.monthlyUic!=='string'||!/^\d{9}$/.test(scope.monthlyUic))fail('Invalid acquisition scope');
 const start=monthIndex(scope.startMonth),end=monthIndex(scope.endMonth),next=end+1;
 if(end<start||end-start>=36)fail('Acquisition reporting range exceeds 36 months');
 const rawInventory=json('sources/candidate-inventory.json'),rawMonthly=json('sources/candidate-monthly.json');
 // A successful bounded acquisition may canonically return zero monthly rows.
 // Its acquisition, manifest count, retrieval sidecars and source hashes still
 // reconcile below; exact-one selected inventory and the monthly cap stay strict.
 if(!Array.isArray(rawInventory)||rawInventory.length!==1||!Array.isArray(rawMonthly)||rawMonthly.length>=1000||[...rawInventory,...rawMonthly].some(row=>!object(row)))fail('Source row bounds or exact parent identity invalid');
 const api=rawInventory[0].api_no,sourceApiId=typeof api==='string'&&/^\d{8}$/.test(api)?api:null;
 const expectedScope={queryVersion:version,monthlyUic:scope.monthlyUic,startMonth:scope.startMonth,endMonth:scope.endMonth,monthlyStart:scope.startMonth+'-01T00:00:00',monthlyEndExclusive:`${String(Math.floor(next/12)).padStart(4,'0')}-${String(next%12+1).padStart(2,'0')}-01T00:00:00`,inventoryLimit:25,monthlyLimit:1000,
  ...(version===4?{testReportLimit:1000,sourceApiId,wellboreLimit:1000,wellboreInventoryLimit:25}:{})};
 requireSame(scope,expectedScope,'Acquisition scope does not match its bounded query contract');
 const inventoryQuery=new URLSearchParams({'$where':`uic_number='${scope.monthlyUic}'`,'$limit':'25','$order':'uic_number,api_no'});
 const monthlyQuery=new URLSearchParams({'$where':`uic_no='${scope.monthlyUic}' AND formatted_date >= '${scope.monthlyStart}' AND formatted_date < '${scope.monthlyEndExclusive}'`,'$limit':'1000','$order':'formatted_date,id'});
 const actualTargets=[...targets.map(([name,url,kind,label])=>[name,name==='candidate-inventory.json'?`https://data.texas.gov/resource/givw-z9t4.json?${inventoryQuery}`:name==='candidate-monthly.json'?`https://data.texas.gov/resource/qq2j-f2zm.json?${monthlyQuery}`:url,kind,label]),...(version===4?v4Targets(scope):[])];
 requireSame(acquisition.targets,actualTargets.map(item=>item[1]),'Acquisition targets contradict the official bounded query');
 const rawTests=version===4?{bhp:json('sources/candidate-bhp.json'),srt:json('sources/candidate-srt.json')}:null;
 if(rawTests&&Object.values(rawTests).some(rows=>!Array.isArray(rows)||rows.length>=1000||rows.some(row=>!object(row))))fail('Test-report row bounds invalid');
 // Producer publication refuses raw rows outside its declared query even when
 // normalization could retain them with quarantine reasons.
 if(rawInventory.some(row=>sourceScopeFlags('inventory',row,scope).length)||rawMonthly.some(row=>sourceScopeFlags('monthly',row,scope).length)||(rawTests&&['bhp','srt'].some(kind=>rawTests[kind].some(row=>sourceScopeFlags(kind,row,scope).length))))fail('Source rows contradict the declared query predicates');
 if(version===4&&sourceApiId!==null){
  const wellbore=[['wellbore_inventory','wellbore-inventory.json',25],['casing','candidate-casing.json',1000],['plugging','candidate-plugging.json',1000]];
  for(const [kind,name,limit] of wellbore){const rows=json('sources/'+name);if(!Array.isArray(rows)||rows.length>=limit||rows.some(row=>!object(row)||sourceScopeFlags(kind,row,scope).length))fail('Wellbore rows contradict the exact-API query');}
 }
 const [year,month]=scope.endMonth.split('-').map(Number);
 requireSame(manifest.scope,{query_version:version,uic_number:scope.monthlyUic,start:scope.startMonth+'-01',end:`${scope.endMonth}-${new Date(Date.UTC(year,month,0)).getUTCDate()}`,inventory_limit:25,inventory_returned:1,monthly_limit:1000,monthly_returned:rawMonthly.length,pagination:'Complete bounded response below cap; no statewide coverage',
  ...(version===4?{test_report_limit:1000,wellbore_limit:1000,wellbore_inventory_limit:25}:{})},'Manifest scope contradicts preserved acquisition');
 const sid=(id,name)=>hash('sources/'+name).then(h=>`${id}:${h.slice(0,16)}`);
 const sourceIds={inventory:await sid('givw-z9t4','candidate-inventory.json'),monthly:await sid('qq2j-f2zm','candidate-monthly.json'),
  ...(version===4?{bhp:await sid('qxfy-wcfs','candidate-bhp.json'),srt:await sid('h54t-xnbi','candidate-srt.json')}:{}),
  ...(version===4&&sourceApiId!==null?{wellbore_inventory:await sid('givw-z9t4','wellbore-inventory.json'),casing:await sid('u9m4-xnh6','candidate-casing.json'),plugging:await sid('wfzn-9fje','candidate-plugging.json')}:{})};
 async function retrieval(name,url){
  const sidecar=name.replace(/\.[^.]+$/,'')+'.source.json',metadata=json('sources/'+sidecar),body=read('sources/'+name);
  if(metadata.url!==url||metadata.http_status!==200||metadata.testFixture!==false||!Number.isFinite(Date.parse(metadata.retrieved_at))||!hashPattern.test(metadata.sha256)||metadata.sha256!==await hash('sources/'+name)||metadata.bytes!==body.length)fail(`Invalid public retrieval sidecar: ${sidecar}`);
  return metadata;
 }
 async function sourceEntry(filename){
  const [name,url,kind,label]=actualTargets.find(item=>item[0]===filename),metadata=await retrieval(name,url);
  const title=kind==='metadata'?json('sources/'+name).name:kind==='documentation'?undefined:json(`sources/${kind==='wellbore_inventory'?'inventory':kind}-metadata.json`).name;
  return {snapshot_id:sourceIds[kind]??`${label}:${(await hash('sources/'+name)).slice(0,16)}`,name:label,...(title===undefined?{}:{title}),kind,...Object.fromEntries(Object.entries(metadata).filter(([key])=>['url','retrieved_at','http_status','last_modified','etag','sha256','bytes','testFixture'].includes(key))),sha256:await hash('sources/'+name),bytes:read('sources/'+name).length,raw_file:'sources/'+name};
 }
 const expectedSources=[];
 // Producer source order differs from acquisition-request order.
 for(const filename of ['candidate-inventory.json','candidate-monthly.json','inventory-metadata.json','monthly-metadata.json','uic-manual.pdf','rrc-resources.html','uic-query-help.html'])expectedSources.push(await sourceEntry(filename));
 const selection=json('sources/selection.json'),lookup=json('sources/lookup.json');
 if(!object(selection)||!sameExplorerValue(Object.keys(selection).sort(),['lookupId','lookupSha256','ordinal','sourceRecordKey'])||!uuidPattern.test(selection.lookupId)||!Number.isSafeInteger(selection.ordinal)||selection.ordinal<1||selection.sourceRecordKey!==`lookup:${selection.ordinal}`||!hashPattern.test(selection.lookupSha256))fail('Invalid persisted parent selection');
 requireSame(selection,manifest.selection,'Manifest selected identity contradicts preserved lookup');
 const request=lookup.request;
 if(lookup.schemaVersion!==2||lookup.status!=='ready'||lookup.testFixture!==false||lookup.lookupId!==selection.lookupId||!object(request)||!['uic','api'].includes(request.kind)||typeof request.value!=='string'||!(request.kind==='uic'?/^\d{9}$/:/^\d{8}$/).test(request.value)||!sameExplorerValue(Object.keys(request).sort(),['kind','value']))fail('Lookup evidence is incomplete or fixture classified');
 const lookupNames=['lookup-inventory.json','lookup-inventory.source.json','lookup-metadata.json','lookup-metadata.source.json'];
 if(!object(lookup.files))fail('Lookup hash inventory is missing');
 requireSame(Object.keys(lookup.files).sort(),lookupNames,'Lookup hash inventory is incomplete');
 for(const name of lookupNames)if(lookup.files[name]!==await hash('sources/'+name))fail('Lookup evidence hash mismatch');
 const lookupQuery=new URLSearchParams({'$where':`${request.kind==='uic'?'uic_number':'api_no'}='${request.value}'`,'$limit':'25','$order':'uic_number,api_no'});
 const lookupMetadata=await retrieval('lookup-inventory.json',`https://data.texas.gov/resource/givw-z9t4.json?${lookupQuery}`);
 await retrieval('lookup-metadata.json','https://data.texas.gov/api/views/givw-z9t4.json');
 const lookupRows=json('sources/lookup-inventory.json'),field=request.kind==='uic'?'uic_number':'api_no';
 if(!Array.isArray(lookupRows)||!lookupRows.length||lookupRows.length>=25||lookupRows.some(row=>!object(row)||row[field]!==request.value))fail('Lookup candidates contradict their exact identifier query');
 const selected=lookupRows[selection.ordinal-1];
 if(!selected||!/^\d{9}$/.test(selected.uic_number)||lookupRows.filter(row=>row.uic_number===selected.uic_number).length!==1||selection.lookupSha256!==lookup.files['lookup-inventory.json']||rawInventory[0].uic_number!==scope.monthlyUic||identityFields.some(field=>rawInventory[0][field]!==selected[field]))fail('Selected parent is missing, ambiguous or changed');
 expectedSources.push({snapshot_id:'lookup:'+selection.lookupSha256.slice(0,16),name:'lookup-inventory',kind:'selection',...lookupMetadata,raw_file:'sources/lookup-inventory.json'});
 if(version===4)for(const filename of v4SourceOrder(sourceApiId))expectedSources.push(await sourceEntry(filename));
 requireSame(manifest.sources,expectedSources,'Manifest source evidence contradicts preserved retrieval sidecars');
 requireSame(manifest.source_revisions,{inventory_rows_updated_at:json('sources/inventory-metadata.json').rowsUpdatedAt,monthly_rows_updated_at:json('sources/monthly-metadata.json').rowsUpdatedAt},'Source revision evidence mismatch');
 return {scope,sourceIds,rawInventory,rawMonthly,rawTests,queryVersion:version};
}
```

  Behaviour for v2 must not change: the v2 branch adds no keys to either scope and pushes no extra sources; the existing `tests/explorer-package.test.mjs` cases must still pass unchanged.

- [ ] **Step 5: Edit `N/web/explorer-package.mjs`** (protected; archived in Task 0):
  1. After line 2 add: `import {normalizeExplorerTests,explorerCsv,testColumns,testReportOrder,TESTS_DICTIONARY_SHA256} from './explorer-tests.mjs';`
  2. Replace `const dynamic=manifest.scope?.query_version===2;` with:
```js
 const queryVersion=manifest.scope?.query_version,dynamic=queryVersion===2||queryVersion===4;
 if(!legacy&&queryVersion!==undefined&&!dynamic)fail(`Unsupported Explorer query version: ${queryVersion}`);
```
  3. Directly after the CSV parity loop (the `for(const [name,columns,rows] of [['inventory.csv',…` block, before `const payload=`) insert:
```js
 // Query version 4: re-derive Explorer's test sidecars from the hashed raw rows and compare bytes (V4 §6).
 let tests=null;
 if(queryVersion===4&&!legacy){
  for(const name of ['tests.json','tests_bhp.csv','tests_srt.csv','tests_dictionary.json'])if(!Object.hasOwn(manifest.files,name))fail(`Explorer package is missing ${name}`);
  const testRows=normalizeExplorerTests(evidence.rawTests,evidence.sourceIds,canonical.inventory,evidence.scope);
  if([...testRows.bhp,...testRows.srt].some(row=>row.quality_flags.some(flag=>flag.startsWith('source_scope:'))))fail('Test-report rows contradict the exact-UIC query');
  const status=rows=>rows.length?'returned_below_cap':'confirmed_empty';
  const expectedTests={schemaVersion:1,artifactId:manifest.artifact_id,scope:{query_version:4,uic_number:evidence.scope.monthlyUic,test_report_limit:1000,order:`BHP ${testReportOrder.bhp}; SRT ${testReportOrder.srt}`,bhp_returned:testRows.bhp.length,srt_returned:testRows.srt.length,bhp_status:status(testRows.bhp),srt_status:status(testRows.srt),window:'exact uic_no; not limited to reporting period'},bhp:testRows.bhp,srt:testRows.srt,quality:testRows.quality};
  if(decode('tests.json')!==JSON.stringify(expectedTests,null,2)+'\n')fail('tests.json contradicts preserved BHP/SRT source rows');
  for(const kind of ['bhp','srt'])if(decode(`tests_${kind}.csv`)!==explorerCsv(testRows[kind],testColumns[kind]))fail(`tests_${kind}.csv contradicts preserved ${kind.toUpperCase()} source rows`);
  if(await hash('tests_dictionary.json')!==TESTS_DICTIONARY_SHA256)fail("tests_dictionary.json is not Explorer's public test dictionary");
  tests={bhp:testRows.bhp,srt:testRows.srt,quality:testRows.quality,sha256:{'tests.json':await hash('tests.json'),'tests_bhp.csv':await hash('tests_bhp.csv'),'tests_srt.csv':await hash('tests_srt.csv'),'tests_dictionary.json':await hash('tests_dictionary.json')}};
 }
```
  4. In the `preview` object's `warnings` array, append (as the last element): `...(tests?['BHP test values are as published: the source field is named psia but RRC Permian guidance says PSIG (Source field named psia; RRC Permian guidance says PSIG; unresolved, not converted). Test records are report rows, not pressure series.']:[])`.
  5. Change the final `return freeze({artifact,pin,preview,calculationEligibility,files:[...files.keys()].sort()});` to `return freeze({artifact,pin,preview,calculationEligibility,files:[...files.keys()].sort(),tests});`

- [ ] **Step 6: Run to verify it passes.** From `N/`: `node --test tests/explorer-package-v4.test.mjs` → 9 pass. Then `node --test tests/explorer-*.test.mjs` → all existing receiver tests still pass. Then the full suite → 0 fail. If the v4 package is rejected, read the failure message, compare the helper and the receiver against V4 §1–§3 (both must follow it), and fix whichever deviates. Never loosen a check to make the synthetic package pass.

---

### Task 5: Panel session and UI (`web/test-records.mjs`)

**Files:**
- Create: `N/web/test-records.mjs`
- Test: `N/tests/test-records-session.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–3; `parseCsv` from `dist/importProfile.js`.
- Produces: `MAX_UPLOAD_BYTES`, `createTestRecordsSession({selection,gate,range})` → `{state, revision, gate, uic, decide(key,include,reason), upload(fileName, bytes), dispose(), isCurrent(r), exportRequest(format)}`; `mountTestRecords(root,{selection,gate,download,range,onMarkers})` → `{dispose}`.

- [ ] **Step 1: Write the failing test** `N/tests/test-records-session.test.mjs`:

```js
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createTestRecordsSession} from '../web/test-records.mjs';
import {verifyTestRecordsSealed} from '../dist/testRecordsExport.js';
import {BHP_COLUMNS} from '../dist/testRecords.js';

const artifact=JSON.parse(await readFile('data/explorer/normalized.json','utf8')),pin=JSON.parse(await readFile('data/explorer-pin.json','utf8'));
const UIC='000020838',range={first:'2024-01',last:'2026-04'},ready={ready:true,reasons:[]},blocked={ready:false,reasons:['Inspection only: test.']};
const pkgRow=(id,date,psia,depth)=>({source_row_key:`k${id}`,parent_key:'p',parent_join_status:'matched',uic_number:UIC,source_report_id:String(id),tracking_no:'9',test_sequence_no:'1.0',report_conducted_date:date,report_conducted_date_text:date,report_received_date:null,report_received_date_text:'',bhp_psia:psia,test_depth_ft:depth,gradient_psi_ft:0.7,tested_formation:'SYNTHETIC',source_snapshot_id:'s',quality_flags:[]});
const withTests={artifact,pin,tests:{bhp:[pkgRow(1,'2024-03-03',1674,2396),pkgRow(2,'2024-06-07',1690,2396)],srt:[],quality:{},sha256:{'tests.json':'a'.repeat(64)}}};
const csvRow=(id,uic=UIC)=>BHP_COLUMNS.map(c=>({source_row_key:`u${id}`,parent_key:'p',parent_join_status:'matched',uic_number:uic,source_report_id:String(id),tracking_no:'9',test_sequence_no:'1.0',report_conducted_date:'2025-01-10',report_conducted_date_text:'2025-01-10',bhp_psia:'1700',test_depth_ft:'2396',gradient_psi_ft:'0.7',tested_formation:'SYNTHETIC',source_snapshot_id:'s'})[c]??'').join(',');
const file=(...rows)=>new TextEncoder().encode([BHP_COLUMNS.join(','),...rows].join('\r\n'));

test('a selection without package tests starts empty and records the well',()=>{
 const s=createTestRecordsSession({selection:{artifact,pin},gate:ready,range});assert.equal(s.state.records.length,0);assert.equal(s.uic,UIC);assert.equal(s.revision,0);
});
test('package tests are labelled as package records',()=>{
 const s=createTestRecordsSession({selection:withTests,gate:ready,range});assert.deepEqual(s.state.records.map(r=>r.origin),['package','package']);
});
test('a valid upload adds records, bumps the revision and flags a cross-source duplicate',async()=>{
 const s=createTestRecordsSession({selection:withTests,gate:ready,range});
 assert.deepEqual(await s.upload('bhp.csv',file(csvRow(1),csvRow(9))),{kind:'bhp',count:2});assert.equal(s.revision,1);
 assert.deepEqual(s.state.records.filter(r=>r.flags.includes('duplicate-report')).map(r=>r.origin).sort(),['package','upload']);
 await s.upload('bhp.csv',file(csvRow(9)));assert.equal(s.state.records.filter(r=>r.origin==='upload').length,1);
});
test('a rejected upload leaves state and revision unchanged',async()=>{
 const s=createTestRecordsSession({selection:withTests,gate:ready,range}),before=s.state;
 await assert.rejects(s.upload('bhp.csv',file(csvRow(1,'000000999'))),/not the selected well/);
 await assert.rejects(s.upload('bhp.xlsx',file(csvRow(1))),/Only CSV/);
 await assert.rejects(s.upload('bhp.csv',new Uint8Array([0xff,0xfe,0x41])),/not valid UTF-8/);
 assert.equal(s.state,before);assert.equal(s.revision,0);
});
test('a current export resolves to a verifiable sealed JSON',async()=>{
 const s=createTestRecordsSession({selection:withTests,gate:ready,range}),r=await s.exportRequest('json');
 assert.match(r.filename,/^test-records-000020838-[a-f0-9]{12}\.json$/);assert.equal(await verifyTestRecordsSealed(JSON.parse(r.text)),true);
 for(const f of ['csv','svg'])assert.ok((await s.exportRequest(f)).text.length>100);
});
test('a decision or upload during sealing makes that export stale; dispose stales everything',async()=>{
 const s=createTestRecordsSession({selection:withTests,gate:ready,range});
 const p1=s.exportRequest('json');s.decide(s.state.records[0].key,false,'mid-export');assert.equal(await p1,null);
 const r=s.revision;await s.upload('bhp.csv',file(csvRow(9)));assert.equal(s.isCurrent(r),false);
 s.dispose();assert.equal(await s.exportRequest('json'),null);
});
test('a blocked gate refuses exports with its reasons; unknown formats are rejected',async()=>{
 await assert.rejects(createTestRecordsSession({selection:withTests,gate:blocked,range}).exportRequest('json'),/Exports blocked: Inspection only: test\./);
 await assert.rejects(createTestRecordsSession({selection:withTests,gate:ready,range}).exportRequest('pdf'),/Unsupported export format/);
});
```

- [ ] **Step 2: Run to verify it fails** (`ERR_MODULE_NOT_FOUND` for `web/test-records.mjs`).

- [ ] **Step 3: Implement** `N/web/test-records.mjs`:

```js
import {parseCsv} from '../dist/importProfile.js';
import {buildTestState,applyTestDecision,rowsFromTable,bhpSeries,outOfRange,timelineMarkers,testCoverage,ORIGIN_LABELS,LABEL_SRT,J_READINESS} from '../dist/testRecords.js';
import {testPressureSvg} from '../dist/testRecordsChart.js';
import {sealTestRecords,testRecordsJson,testRecordsCsv,testRecordsSvg} from '../dist/testRecordsExport.js';

export const MAX_UPLOAD_BYTES=2_000_000;
const FORMATS={json:['application/json',s=>testRecordsJson(s)],csv:['text/csv;charset=utf-8',s=>testRecordsCsv(s)],svg:['image/svg+xml',(s,state)=>testRecordsSvg(s,state)]};
async function sha256(bytes){const d=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(d),b=>b.toString(16).padStart(2,'0')).join('');}

/** DOM-free session: package and uploaded test records, the user's decisions, a revision counter and stale-export refusal. Nothing runs at import time. */
export function createTestRecordsSession({selection,gate,range}){
 const artifact=selection.artifact,uic=String(artifact.injectionMonthly?.[0]?.uic_number??artifact.inventory?.[0]?.uic_number??'');
 const pkg=selection.tests?{bhp:selection.tests.bhp,srt:selection.tests.srt}:null,uploads={bhp:null,srt:null};
 const build=()=>buildTestState({package:pkg,upload:{bhp:uploads.bhp?.rows??[],srt:uploads.srt?.rows??[]}},range);
 let state=build(),revision=0,alive=true;
 const source=()=>({uic,package:selection.tests?{artifactId:String(artifact.artifactId),normalizedSha256:selection.pin?.normalizedSha256??null,manifestSha256:selection.pin?.manifestSha256??null,files:{...selection.tests.sha256}}:null,
  uploads:['bhp','srt'].filter(k=>uploads[k]).map(k=>({kind:k,fileName:uploads[k].fileName,sha256:uploads[k].sha256}))});
 const session={
  get state(){return state;},get revision(){return revision;},gate,uic,
  decide(key,include,reason){state=applyTestDecision(state,key,include,reason);revision++;},
  async upload(fileName,bytes){
   if(!(bytes instanceof Uint8Array))throw new Error('Upload must be file bytes.');
   if(!/\.csv$/i.test(String(fileName)))throw new Error("Only CSV files in Explorer's BHP or SRT test column layout are accepted.");
   if(bytes.length>MAX_UPLOAD_BYTES)throw new Error('The file is larger than 2 MB.');
   let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new Error('The file is not valid UTF-8 text.');}
   const {kind,rows}=rowsFromTable(parseCsv(text),uic),digest=await sha256(bytes);
   if(!alive)return null;
   uploads[kind]={rows,fileName:String(fileName),sha256:digest};state=build();revision++;
   return {kind,count:rows.length};
  },
  dispose(){alive=false;revision++;},
  isCurrent(r){return alive&&r===revision;},
  async exportRequest(format){
   const kind=FORMATS[format];if(!kind)throw new Error('Unsupported export format: '+format);
   if(!gate.ready)throw new Error('Exports blocked: '+gate.reasons.join(' '));
   const r=revision,snapshot=state,src=source();if(!session.isCurrent(r))return null;
   const sealed=await sealTestRecords(snapshot,src);
   if(!session.isCurrent(r))return null;
   return {filename:`test-records-${uic||'well'}-${sealed.contentSha256.slice(0,12)}.${format}`,mime:kind[0],text:kind[1](sealed,snapshot)};
  }};
 return session;
}

const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function svgNode(svg){const doc=new DOMParser().parseFromString(svg,'image/svg+xml');if(doc.getElementsByTagName('parsererror').length||doc.documentElement.localName!=='svg')throw new Error('Generated test chart could not be parsed.');return document.importNode(doc.documentElement,true);}
const fmt=v=>v===null||v===undefined?'not reported':typeof v==='number'?Number(v.toPrecision(6)).toLocaleString('en-US'):String(v);

/** Panel inside Injector history, below the H-10 panel. import-ui disposes it whenever results are cleared. */
export function mountTestRecords(root,{selection,gate,download,range,onMarkers=()=>{}}){
 const session=createTestRecordsSession({selection,gate,range}),section=el('section',undefined,'panel');section.setAttribute('aria-labelledby','test-records-title');
 root.replaceChildren(section);
 let message='',focusKey=null;
 function controls(r,st,status){
  const d=st.decisions[r.key],box=el('input'),reason=el('input');
  box.type='checkbox';box.checked=d.include;box.setAttribute('aria-label',`Include ${r.kind.toUpperCase()} ${r.date??r.dateText}`);box.dataset.focusKey='box:'+r.key;
  reason.type='text';reason.maxLength=200;reason.value=d.reason??'';reason.placeholder=r.flags.length?'optional':'required to exclude';reason.setAttribute('aria-label',`Reason for ${r.kind.toUpperCase()} ${r.date??r.dateText}`);reason.dataset.focusKey='reason:'+r.key;
  box.onchange=()=>{try{session.decide(r.key,box.checked,reason.value);focusKey='box:'+r.key;message=`${r.kind.toUpperCase()} ${r.date??r.dateText} ${box.checked?'included':'excluded'}.`;render();}catch(e){box.checked=!box.checked;status.textContent=e.message;reason.focus();}};
  reason.onchange=()=>{if(session.state.decisions[r.key].include)return;try{session.decide(r.key,false,reason.value);message=status.textContent=`Reason saved.`;}catch(e){reason.value=session.state.decisions[r.key].reason??'';status.textContent=e.message;}};
  const inc=el('td');inc.append(box);if(d.include&&!r.usable)inc.append(el('small',' included, but it has no usable date, pressure or depth'));
  const rs=el('td');rs.append(reason);return [inc,rs];
 }
 function tableOf(label,heads,records,cells,st,status){
  const wrap=el('div',undefined,'table-scroll');wrap.setAttribute('role','region');wrap.setAttribute('aria-label',label);wrap.tabIndex=0;
  const table=el('table'),head=el('tr');for(const t of [...heads,'Source','Flags','Include','Reason'])head.append(el('th',t));table.append(el('thead'));table.tHead.append(head);
  const body=el('tbody');
  for(const r of records){const tr=el('tr');for(const v of cells(r))tr.append(el('td',fmt(v)));tr.append(el('td',ORIGIN_LABELS[r.origin]));
   tr.append(el('td',[...r.reasons,...r.notes.map(n=>`Note: ${n}`)].join(' ')||'none'));tr.append(...controls(r,st,status));body.append(tr);}
  table.append(body);wrap.append(table);return wrap;
 }
 function render(){
  const st=session.state,cov=testCoverage(st),series=bhpSeries(st),o=outOfRange(st);section.replaceChildren();
  const h=el('h2','Test records: choose comparable tests');h.id='test-records-title';section.append(h);
  section.append(el('p',J_READINESS));
  const ref=st.referenceTie?'no single most-common depth':st.referenceDepthFt===null?'none':`${st.referenceDepthFt} ft`;
  section.append(el('p',`Records: ${cov.bhpRecords} BHP, ${cov.srtRecords} step-rate · ${cov.packageRecords} ${ORIGIN_LABELS.package.toLowerCase()} · ${cov.uploadRecords} ${ORIGIN_LABELS.upload.toLowerCase()} · ${cov.flagged} flagged · ${cov.included} included · reference depth ${ref}.`));
  const status=el('p',message);status.setAttribute('role','status');section.append(status);
  const up=el('label','Add test records (CSV in Explorer\'s BHP or SRT column layout): ');const input=el('input');input.type='file';input.accept='.csv,text/csv';up.append(input);section.append(up);
  input.onchange=async()=>{const f=input.files?.[0];if(!f)return;try{const r=await session.upload(f.name,new Uint8Array(await f.arrayBuffer()));if(!r)return;message=`Added ${r.count} ${r.kind.toUpperCase()} records from ${f.name} (not verified).`;render();}catch(e){status.textContent=e.message;input.value='';}};
  if(!st.records.length)section.append(el('p','No test records for this well.'));
  const bhp=st.records.filter(r=>r.kind==='bhp'),srt=st.records.filter(r=>r.kind==='srt');
  if(bhp.length)section.append(tableOf('BHP test review',['Test date','Date as published','BHP (source field named psia)','Depth (ft)','Gradient (psi/ft)','Formation'],bhp,r=>[r.date,r.dateText,r.bhpPsia,r.depthFt,r.values.gradient_psi_ft??null,r.values.tested_formation??''],st,status));
  if(srt.length)section.append(tableOf('Step-rate test review',['Test date','Date as published','Satisfactory code (meaning undocumented)','Perforations (ft)','Rate range (bbl/min)','ISIP (psig)','Frac pressure (psig)','FIRC surface pressure (psig)','Fracture gradient (psi/ft)','FIRC rate (bbl/day)','Comments'],srt,
   r=>[r.date,r.dateText,r.values.satisfactory_test_code??'',`${fmt(r.values.top_perf_ft)} to ${fmt(r.values.bottom_perf_ft)}`,`${fmt(r.values.min_inj_rate_bpm)} to ${fmt(r.values.max_inj_rate_bpm)}`,r.values.isip_psig??null,r.values.formation_frac_press_psig??null,r.values.surface_pressure_firc_psig??null,r.values.fracture_gradient_psi_ft??null,r.values.frac_inj_rate_capacity_bpd??null,r.values.comments??''],st,status));
  for(const [list,label] of [[o.before,'Before the reported H-10 range (no timeline marker)'],[o.after,'After the reported H-10 range (no timeline marker)']])
   if(list.length)section.append(el('p',`${label}: ${list.map(r=>`${r.kind.toUpperCase()} ${r.date}`).join(', ')}.`));
  if(!gate.ready){section.append(el('p','The test chart, timeline markers and exports are blocked. '+gate.reasons.join(' ')));onMarkers([]);}
  else{
   if(bhp.length){const box=el('div',undefined,'analysis-chart-scroll');box.append(svgNode(testPressureSvg(st).svg));section.append(box);}
   const actions=el('div',undefined,'import-actions');
   for(const [format,label] of [['json','Download test records JSON'],['csv','Download test records CSV'],['svg','Download test records SVG']]){
    const b=el('button',label);b.type='button';
    b.onclick=async()=>{try{const r=await session.exportRequest(format);if(!r){status.textContent='The selection changed while preparing this export. Download again.';return;}download(r.text,r.filename,r.mime);status.textContent=`Downloaded ${r.filename}.`;}catch(e){status.textContent=e.message;}};
    actions.append(b);
   }
   section.append(actions);
   section.append(el('p',bhp.length?(series.enough?`${series.points.length} BHP tests contribute to the chart.`:`Not enough comparable tests (${series.points.length} of ${series.needed} needed).`):'No BHP tests to chart.'));
   onMarkers(timelineMarkers(st));
  }
  if(srt.length)section.append(el('p',LABEL_SRT));
  if(focusKey){const t=section.querySelector(`[data-focus-key="${focusKey}"]`);if(t)t.focus();focusKey=null;}
 }
 render();
 return {dispose(){session.dispose();root.replaceChildren();}};
}
```

- [ ] **Step 4: Run to verify it passes.** `node --test tests/test-records-session.test.mjs` → 7 pass; full suite 0 fail.

---

### Task 6: Wire into Injector history and record the layer

**Files:**
- Modify (archived in Task 0): `N/web/h10-diagnostics.mjs`, `N/web/import-ui.mjs`

**Interfaces:**
- Consumes: `mountTestRecords` (Task 5); `ratioOverTimeSvg(state, markers)` (Task 2).
- Produces: `mountH10Diagnostics(...)` returns `{dispose, setMarkers(markers), range}` where `range` is `{first,last}` from the 1a months or `null`.

- [ ] **Step 1: Edit `N/web/h10-diagnostics.mjs`:**
  1. In `mountH10Diagnostics`, change `let reviewOpen=null,focusKey=null,message='';` to `let reviewOpen=null,focusKey=null,message='',markers=[];`.
  2. Change `for(const chart of [pressureRateSvg(st),ratioOverTimeSvg(st)])` to `for(const chart of [pressureRateSvg(st),ratioOverTimeSvg(st,markers)])`.
  3. Change the final `return {dispose(){session.dispose();root.replaceChildren();}};` to:
```js
 const months=session.state.months;
 return {dispose(){session.dispose();root.replaceChildren();},setMarkers(next){markers=Array.isArray(next)?[...next]:[];render();},range:months.length?{first:months[0].month,last:months[months.length-1].month}:null};
```
  `createDiagnosticsSession` and every export path are untouched, so 1a exports never carry markers.

- [ ] **Step 2: Edit `N/web/import-ui.mjs`** (CR count `4` before; must still be `4` after, on its last four lines):
  1. After `import {mountH10Diagnostics} from './h10-diagnostics.mjs';` add `import {mountTestRecords} from './test-records.mjs';`
  2. `let h10Panel=null;` → `let h10Panel=null,testsPanel=null;`
  3. `function clearResults(){h10Panel?.dispose();h10Panel=null;` → `function clearResults(){testsPanel?.dispose();testsPanel=null;h10Panel?.dispose();h10Panel=null;`
  4. Replace the whole `function mountH10(){…}` line with:
```js
function mountH10(){const p=selectedPublic();if(!p?.artifact)return;const gate=publicCalculationGate(),box=el('div');box.id='h10-diagnostics';$('import-results').append(box);h10Panel=mountH10Diagnostics(box,{selection:p,gate,download});const tests=el('div');tests.id='test-records';$('import-results').append(tests);testsPanel=mountTestRecords(tests,{selection:p,gate,download,range:h10Panel.range,onMarkers:markers=>h10Panel?.setMarkers(markers)});}
```

- [ ] **Step 3: Confirm the edits.** CR counts: `import-ui.mjs` `4` on lines 334–337 (line numbers may shift by +1 because of the added import; record the actual lines, all four must be the file's last four); `h10-diagnostics.mjs` `0`. `node --check web/import-ui.mjs`, `node --check web/h10-diagnostics.mjs`, `node --check web/test-records.mjs`, `node --check web/explorer-tests.mjs`.

- [ ] **Step 4: Full product checks.** From `N/`: compile; `node --test tests/*.test.mjs` → 468 + 36 new (11+5+4+9+7) = 504 pass, 0 fail (record the actual count); `node scripts/check-carried-oracles.mjs` → 248 comparisons, 0 failures. From the repo root: `node scripts/prepare-swd.mjs`.

- [ ] **Step 5: Record pending and run the root gates.** From the repo root:
  - `node scripts/record-layer.mjs test-records` → `pending-review`
  - `node scripts/verify-preservation.mjs .` → exactly one violation: `Layer test-records baseline is pending/not accepted after independent review`
  - `node --test tests/transfer.test.mjs tests/preservation-baseline.test.mjs tests/layer-registry.test.mjs` → only the transfer live-root test fails, on that pending violation.
  If anything else fails, stop and diagnose (superpowers:systematic-debugging).

---

### Task 7: Browser verification, real-artifact check, record, review, acceptance

**Files:**
- Create: `demo/TEST-RECORDS-VERIFICATION.md`, `demo/test-records-evidence/` (screenshots, driver, results; the synthetic v4 package is written only to the session scratchpad, never into the repository)

- [ ] **Step 1: Synthetic package for the browser.** Write `buildV4Package` output (Task 4 helper) with the Task 4 test rows to the session scratchpad as `synthetic-v4-000000417.tar`. Serve with nested `PORT=4174 node scripts/serve.mjs` (from `N/`, background) and use headless Chrome `--remote-debugging-port=9333` with a CDP driver modelled on `demo/h10-diagnostics-evidence/h10-check.mjs`. At 1280px and 390px:
  1. **Import** the synthetic package through Data & sources → Explorer package; adopt; Injector history shows the 1a panel and, below it, Test records with 3 BHP and 1 SRT, labelled `Explorer package, verified`, and the J readiness line.
  2. **Flags:** the 2228 ft test is flagged `depth-differs` (reference 2396 ft) and starts excluded; the chart shows 2 points; the 2022-11-07 BHP and SRT are listed as before the H-10 range.
  3. **Re-include** the off-depth test: chart has 3 points; status announces the change; focus returns to its checkbox.
  4. **Markers:** the 1a ratio chart shows triangles for the in-range included BHP tests; the 1a JSON/CSV/SVG downloads are byte-identical to before the change for the same decisions (compare with a download taken before re-including).
  5. **Upload:** a valid BHP CSV for UIC 000000417 adds records labelled `User upload, not verified`; a CSV for another UIC is rejected with its reason and nothing changes.
  6. **Exports:** JSON, CSV and SVG download as `test-records-000000417-….{json,csv,svg}`; the JSON verifies (`verifyTestRecordsSealed`).
  7. **Reset and stale:** switch to the pinned well → the test panel shows "No test records for this well"; a test-records download started just before switching produces no file.
  8. **Mobile 390px:** tables and charts scroll inside their containers; no page-level horizontal scroll.
- [ ] **Step 2: Real Barbaro 23 artifact check (owner permission required).** Ask the owner first. With permission, Main runs a scratchpad script that reads `artifacts/rrc-2026-10-30-uic000125182-d04894d1-5c27-4392-b3f7-42a399c7fbe1/` from Explorer's repository via `git -C C:/Users/thai.phi/Downloads/python/portfolio/texas-rrc-explorer archive 3cefa99 <path>` into the scratchpad, packs it in USTAR form in memory and calls `verifyExplorerPackage`. Record only: accepted or rejected, the failure message if any, record counts and the four test-file hashes. Copy nothing into this repository. Without permission, record "not run".
- [ ] **Step 3: Write `demo/TEST-RECORDS-VERIFICATION.md`**: commands and counts, CR counts, RED→GREEN per task, browser results with screenshots under `demo/test-records-evidence/`, the real-artifact result, the spec §4 naming map if names differ, rulings.
- [ ] **Step 4: Independent review (D13).** Dispatch a read-only Claude Opus reviewer with a seven-field brief (`handover/context/agent-workflow.md`): the Review Focus list, spec §4–§6 rule by rule, the receiver diff against V4, and the import-ui diff.
- [ ] **Step 5:** Fix confirmed Critical/Important findings with RED→GREEN tests, re-record pending (`node scripts/record-layer.mjs test-records`) and re-run Task 6 Step 5.
- [ ] **Step 6: Owner acceptance.** The owner runs `! cd C:/Users/thai.phi/Downloads/python/portfolio/swd-injection-analytics/tmp/lovable-transfer/well-injection-insights && node scripts/record-layer.mjs test-records accept "Thai Phi" && node scripts/verify-preservation.mjs .` → 0 violations.
- [ ] **Step 7: Main commits** on `feature/phase-1b-test-records`, runs the fresh-clone check (link the main checkout's `node_modules` into the clone before tests), and pushes/merges only on the owner's instruction. Then tell the Explorer session (texas-rrc-explorer-65) that the v4 receiver test passes, so its owner can decide on lifting the handoff gate.
