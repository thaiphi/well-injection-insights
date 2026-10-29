# Phase 1a: H-10 diagnostics with guided month review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an H-10 diagnostics panel to the Injector history workspace. The system flags months that distort a pressure-vs-rate comparison, the user decides which months count, and screening views and sealed exports reflect and record those decisions.

**Architecture:** There are three pure TypeScript modules: calculations, SVG charts and exports. They compile to `dist/` and are tested in Node. A web module adds a DOM-free session (decisions, revision, stale-export refusal) and a mount function. The only protected-file edit is `web/import-ui.mjs`: mount the panel, dispose it wherever results are cleared, and fix the sample-case CSV/SVG download gate. Preservation is a registry layer `h10-diagnostics`, with no checker change.

**Tech Stack:** TypeScript 5.9 (`tsc` → `dist/`), Node `node:test`, plain ES modules in the browser, hand-built SVG.

**Spec:** `docs/superpowers/specs/2026-10-29-h10-diagnostics-design.md` (owner-approved 2026-10-29). Executors read both.

## Global Constraints

- Paths: the repo root is `C:\Users\thai.phi\Downloads\python\portfolio\swd-injection-analytics\tmp\lovable-transfer\well-injection-insights`. The app is `swd-injection-analytics/` (written `N/` below). Product paths in tasks are relative to `N/`.
- Build: from `N/`, run `node ../node_modules/typescript/bin/tsc -p tsconfig.json`. Tests import compiled code from `../dist/*.js`.
- Tests: from `N/`, run `node --test tests/<file>`. Direct `node` paths only; no npm/npx/vitest/bare python.
- New product files may only live in `N/{src,data,web,tests,scripts,reference,exhibits}`. Every new file is listed in the layer spec (Task 5).
- `N/web/import-ui.mjs` is protected. Archive it **before** editing (Task 5 Step 1). It has CRLF on its last four lines (330–333) and LF elsewhere. The Edit tool flattens CRLF, so count CR bytes before and after (`4`).
- No new navigation tab; do not edit `web/navigation.mjs` or `web/index.html` (D19; the spec says index.html only if needed, and this plan doesn't need it).
- The existing Injector history table, three charts and their exports must stay unchanged.
- Fixed labels, verbatim: `Surface-reported pressure (basis as reported), not bottomhole pressure` and `Screening indicator only; not an injectivity index (J)`.
- Low-rate rule: rate > 0 and < `0.25 ×` the median positive calendar-day rate. Minimum comparable months: `3`. Reason length after trimming: `1–200` characters.
- Workers never stage, commit or push. Main commits after owner acceptance.
- This plan is pinned as an approved document by the layer. After acceptance it is frozen; track progress in the ledger, not by ticking boxes here.

## Review Focus

1. An imported package whose gate is not ready: the review list shows, and no screening view or download exists. Pinned by the Task 4 "blocked gate" test.
2. Switching the sample well, or the source, mid-export: the pending download is refused. Pinned by the Task 4 stale-export test; checked in the browser in Task 6.
3. A month with two report rows is never merged or averaged. Pinned by the Task 1 duplicate test.
4. The leading no-volume months before the first injection are labelled differently from a mid-history shut-in. Pinned by the Task 1 fixture.
5. CSV injection: a user reason starting with `=` is written as text. Pinned by the Task 3 CSV test.

---

### Task 1: Diagnostics core (`src/h10Diagnostics.ts`)

**Files:**
- Create: `N/src/h10Diagnostics.ts`
- Test: `N/tests/h10-diagnostics.test.mjs`

**Interfaces:**
- Consumes: `monthIndex`, `monthsBetween`, `daysInMonth` from `src/planning.ts`; `PublicMonthly` type from `src/publicArtifact.ts`.
- Produces:
  - Constants: `H10_DIAGNOSTICS_VERSION`, `LOW_RATE_FRACTION`, `MIN_COMPARABLE_MONTHS`, `MAX_REASON_LENGTH`, `FLAG_REASONS`, `FORMULAS`, `LIMITATIONS`, `CHECKLIST`, `LABEL_SURFACE`, `LABEL_SCREENING`.
  - Types: `FlagCode`, `MonthRecord`, `Decision`, `DiagnosticsState`, `ScreeningPoint`, `Screening`, `Coverage`.
  - `diagnoseMonthly(rows:readonly PublicMonthly[]):DiagnosticsState`
  - `applyDecision(state,month:string,include:boolean,reason?:string|null):DiagnosticsState`
  - `screening(state):Screening`
  - `coverage(state):Coverage`

- [ ] **Step 1: Write the failing test** `N/tests/h10-diagnostics.test.mjs`

```js
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {diagnoseMonthly,applyDecision,screening,coverage,FLAG_REASONS,MIN_COMPARABLE_MONTHS} from '../dist/h10Diagnostics.js';
import {verifyExplorerPackage} from '../web/explorer-package.mjs';

const days=m=>new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7),0)).getUTCDate();
const row=(month,bbl,avg,max,key=month)=>({source_row_key:'r-'+key,parent_key:'p',parent_join_status:'joined',uic_number:'000000001',reporting_year:+month.slice(0,4),reporting_month:+month.slice(5,7),period_start:month+'-01',injected_liquid_bbl:bbl,reported_avg_injection_pressure_psi:avg,reported_max_injection_pressure_psi:max,calendar_days:days(month),calculated_calendar_day_avg_bpd:bbl===null?null:bbl/days(month)});
// Synthetic fixture covering every flag; 2024-05 is a gap (no row).
export const FIXTURE=[row('2024-01',null,null,null),row('2024-02',0,null,null),row('2024-03',31000,800,900),row('2024-04',30000,820,900),
 row('2024-06',30000,null,null),row('2024-07',0,500,500),row('2024-08',3100,600,700),row('2024-09',30000,850,800),
 row('2024-10',31000,830,900,'10a'),row('2024-10',31000,830,900,'10b'),row('2024-11',30000,830,900),row('2024-12',31000,840,900)];
const flagsOf=s=>Object.fromEntries(s.months.filter(m=>!m.gap).map(m=>[m.month,m.flags]));

test('every flag type is raised with the specified rule',()=>{
 const s=diagnoseMonthly(FIXTURE);
 assert.deepEqual(flagsOf(s),{'2024-01':['before-first-injection','no-average-pressure'],'2024-02':['before-first-injection','no-average-pressure'],'2024-03':[],'2024-04':[],
  '2024-06':['no-average-pressure'],'2024-07':['no-volume'],'2024-08':['low-rate'],'2024-09':['max-below-average'],'2024-10':['duplicate-report'],'2024-11':[],'2024-12':[]});
 assert.equal(s.medianRateBpd,1000);
 for(const code of Object.keys(FLAG_REASONS))assert.ok(FLAG_REASONS[code].length>10);
});
test('a missing month is a gap, never zero and never flagged',()=>{
 const gap=diagnoseMonthly(FIXTURE).months.find(m=>m.month==='2024-05');
 assert.equal(gap.gap,true);assert.equal(gap.injectedBbl,null);assert.equal(gap.rateBpd,null);assert.deepEqual(gap.flags,[]);assert.equal(gap.usable,false);
});
test('duplicate report rows are kept separate and never merged',()=>{
 const m=diagnoseMonthly(FIXTURE).months.find(x=>x.month==='2024-10');
 assert.deepEqual(m.sourceRowKeys,['r-10a','r-10b']);assert.equal(m.injectedBbl,null);assert.equal(m.avgPsi,null);assert.equal(m.usable,false);
});
test('flagged months start excluded and unflagged months start included',()=>{
 const s=diagnoseMonthly(FIXTURE);
 assert.equal(s.decisions['2024-03'].include,true);assert.equal(s.decisions['2024-08'].include,false);assert.equal(s.decisions['2024-08'].byUser,false);
 assert.equal(s.decisions['2024-05'],undefined);
});
test('coverage counts span, gaps, flags, included and comparable months',()=>{
 assert.deepEqual(coverage(diagnoseMonthly(FIXTURE)),{firstMonth:'2024-01',lastMonth:'2024-12',spanMonths:12,reportedMonths:11,gapMonths:['2024-05'],flaggedMonths:7,includedMonths:4,comparableMonths:4,medianRateBpd:1000,lowRateEvaluated:true});
});
test('screening ratio is reported average pressure divided by calendar-day rate, included usable months only',()=>{
 const sc=screening(diagnoseMonthly(FIXTURE));
 assert.deepEqual(sc.points.map(p=>p.month),['2024-03','2024-04','2024-11','2024-12']);
 assert.equal(sc.points[0].ratio,800/(31000/31));assert.equal(sc.enough,true);assert.equal(sc.needed,MIN_COMPARABLE_MONTHS);
});
test('re-including a flagged usable month adds it; re-including an unusable month adds no point',()=>{
 let s=applyDecision(diagnoseMonthly(FIXTURE),'2024-09',true);
 assert.equal(screening(s).points.length,5);assert.deepEqual(s.decisions['2024-09'],{include:true,reason:null,byUser:true});
 s=applyDecision(s,'2024-06',true);assert.equal(screening(s).points.length,5);
});
test('excluding an unflagged month requires a 1-200 character reason',()=>{
 const s=diagnoseMonthly(FIXTURE);
 assert.throws(()=>applyDecision(s,'2024-03',false),/reason/i);
 assert.throws(()=>applyDecision(s,'2024-03',false,'   '),/reason/i);
 assert.throws(()=>applyDecision(s,'2024-03',false,'x'.repeat(201)),/200/);
 const t=applyDecision(s,'2024-03',false,'  workover month  ');
 assert.deepEqual(t.decisions['2024-03'],{include:false,reason:'workover month',byUser:true});
 assert.equal(s.decisions['2024-03'].include,true,'original state is not mutated');
});
test('decisions on gap or unknown months are rejected',()=>{
 const s=diagnoseMonthly(FIXTURE);
 assert.throws(()=>applyDecision(s,'2024-05',true),/Not a reported month/);assert.throws(()=>applyDecision(s,'2030-01',true),/Not a reported month/);
});
test('fewer than three comparable months is not enough for a trend',()=>{
 let s=diagnoseMonthly(FIXTURE);for(const m of ['2024-03','2024-04'])s=applyDecision(s,m,false,'test');
 const sc=screening(s);assert.equal(sc.points.length,2);assert.equal(sc.enough,false);
});
test('no positive-rate month: low-rate is not evaluated and every month is before first injection',()=>{
 const s=diagnoseMonthly([row('2024-01',0,500,600),row('2024-02',null,null,null)]);
 assert.equal(s.medianRateBpd,null);assert.equal(coverage(s).lowRateEvaluated,false);
 assert.deepEqual(flagsOf(s)['2024-01'],['before-first-injection']);
});
test('empty input is rejected',()=>{assert.throws(()=>diagnoseMonthly([]),/No H-10 monthly rows/);});
test('real pinned well: 28 months, no gaps, no flags',async()=>{
 const a=JSON.parse(await readFile('data/explorer/normalized.json','utf8')),c=coverage(diagnoseMonthly(a.injectionMonthly));
 assert.equal(c.spanMonths,28);assert.deepEqual(c.gapMonths,[]);assert.equal(c.flaggedMonths,0);assert.equal(c.comparableMonths,28);
});
test('real sample well B: 16 months, no gaps, no flags',async()=>{
 const pkg=await verifyExplorerPackage(new Uint8Array(await readFile('tests/fixtures/explorer-packages/public-uic000056484.tar')));
 const c=coverage(diagnoseMonthly(pkg.artifact.injectionMonthly));
 assert.equal(c.spanMonths,16);assert.deepEqual(c.gapMonths,[]);assert.equal(c.flaggedMonths,0);
});
```

- [ ] **Step 2: Build and run; confirm RED**

Run (in `N/`): `node ../node_modules/typescript/bin/tsc -p tsconfig.json && node --test tests/h10-diagnostics.test.mjs`
Expected: FAIL, with `Cannot find module '../dist/h10Diagnostics.js'`.

- [ ] **Step 3: Implement** `N/src/h10Diagnostics.ts`

```ts
import { daysInMonth, monthIndex, monthsBetween } from './planning.js';
import type { PublicMonthly } from './publicArtifact.js';

/** Screening-only review of monthly H-10 reports: the system flags months, the user decides which are comparable. Never BHP, J, damage or capacity. */
export const H10_DIAGNOSTICS_VERSION='h10-diagnostics/1';
export const LOW_RATE_FRACTION=0.25;
export const MIN_COMPARABLE_MONTHS=3;
export const MAX_REASON_LENGTH=200;
export const LABEL_SURFACE='Surface-reported pressure (basis as reported), not bottomhole pressure';
export const LABEL_SCREENING='Screening indicator only; not an injectivity index (J)';
export type FlagCode='before-first-injection'|'no-volume'|'no-average-pressure'|'low-rate'|'max-below-average'|'duplicate-report';
export const FLAG_REASONS:Readonly<Record<FlagCode,string>>=Object.freeze({
  'before-first-injection':'No volume reported before the first reported injection; the well was probably not yet injecting.',
  'no-volume':'No injected volume reported this month (shut-in or missing report).',
  'no-average-pressure':'No average injection pressure reported.',
  'low-rate':"Rate is under 25% of this well's median; likely a partial or shut-in month.",
  'max-below-average':'Reported maximum is below the reported average: a reporting inconsistency.',
  'duplicate-report':'More than one report row for this month.',
});
export const FORMULAS=Object.freeze([
  'calendar-day rate (bbl/day) = injected liquid (bbl/month) / calendar days in the month, as carried in the verified artifact',
  'screening ratio (psi per bbl/day) = reported average injection pressure (psi) / calendar-day rate (bbl/day)',
  'low-rate threshold = 0.25 x median positive calendar-day rate of single-report months',
]);
export const LIMITATIONS=Object.freeze([LABEL_SURFACE,LABEL_SCREENING,
  'Monthly calendar-day averages are not observed daily or stabilized test rates.',
  'Missing reports are gaps, never zero; nothing is interpolated.',
  'Month decisions are the user\'s screening choices, recorded with reasons; they are not data corrections.',
  'No reservoir pressure, injectivity index, damage, integrity or capacity is inferred.']);
export const CHECKLIST=Object.freeze([
  {cause:'Reservoir pressure buildup',evidence:'Repeated bottomhole or static pressure tests at the same depth and datum'},
  {cause:'Near-wellbore damage or skin',evidence:'Pressure transient or step-rate tests; treatment history'},
  {cause:'Fluid viscosity or density change',evidence:'Water analyses and temperature over time'},
  {cause:'Tubing friction or geometry',evidence:'Completion records, tubing size and rate-dependent surface pressure'},
  {cause:'Mechanical restriction',evidence:'Workover, scale or fill records; tubing inspection'},
  {cause:'Reporting quality',evidence:'Original filings, revisions and the month review above'},
  {cause:'Competing nearby injection',evidence:'H-10 histories of nearby wells (selected explicitly) and their timing'},
]);
export type MonthRecord={month:string;gap:boolean;sourceRowKeys:string[];injectedBbl:number|null;calendarDays:number;rateBpd:number|null;avgPsi:number|null;maxPsi:number|null;flags:FlagCode[];usable:boolean};
export type Decision={include:boolean;reason:string|null;byUser:boolean};
export type DiagnosticsState={version:typeof H10_DIAGNOSTICS_VERSION;months:MonthRecord[];medianRateBpd:number|null;decisions:Readonly<Record<string,Decision>>};
export type ScreeningPoint={month:string;rateBpd:number;avgPsi:number;ratio:number};
export type Screening={points:ScreeningPoint[];enough:boolean;needed:number};
export type Coverage={firstMonth:string;lastMonth:string;spanMonths:number;reportedMonths:number;gapMonths:string[];flaggedMonths:number;includedMonths:number;comparableMonths:number;medianRateBpd:number|null;lowRateEvaluated:boolean};

const positive=(v:number|null):v is number=>v!==null&&Number.isFinite(v)&&v>0;
function median(values:number[]):number|null {
  if(!values.length) return null;
  const s=[...values].sort((a,b)=>a-b),mid=Math.floor(s.length/2);
  return s.length%2?s[mid]:(s[mid-1]+s[mid])/2;
}

export function diagnoseMonthly(rows:readonly PublicMonthly[]):DiagnosticsState {
  if(!rows.length) throw new Error('No H-10 monthly rows to diagnose');
  const byMonth=new Map<string,PublicMonthly[]>();
  for(const row of rows) {
    const month=String(row.period_start).slice(0,7);monthIndex(month);
    const list=byMonth.get(month);if(list) list.push(row);else byMonth.set(month,[row]);
  }
  const keys=[...byMonth.keys()].sort();
  const base:MonthRecord[]=monthsBetween(keys[0],keys[keys.length-1]).map(month=>{
    const list=byMonth.get(month)??[],one=list.length===1?list[0]:null;
    return {month,gap:list.length===0,sourceRowKeys:list.map(r=>r.source_row_key),injectedBbl:one?one.injected_liquid_bbl:null,calendarDays:daysInMonth(month),
      rateBpd:one?one.calculated_calendar_day_avg_bpd:null,avgPsi:one?one.reported_avg_injection_pressure_psi:null,maxPsi:one?one.reported_max_injection_pressure_psi:null,flags:[],usable:false};
  });
  const single=(m:MonthRecord)=>m.sourceRowKeys.length===1;
  const medianRateBpd=median(base.filter(single).map(m=>m.rateBpd).filter(positive));
  const firstInjection=base.findIndex(m=>single(m)&&positive(m.injectedBbl));
  const months=base.map((m,i)=>{
    if(m.gap) return m;
    const flags:FlagCode[]=[];
    if(!single(m)) flags.push('duplicate-report');
    else {
      if(!positive(m.injectedBbl)) flags.push(firstInjection===-1||i<firstInjection?'before-first-injection':'no-volume');
      if(m.avgPsi===null) flags.push('no-average-pressure');
      const rate=m.rateBpd;
      if(medianRateBpd!==null&&positive(rate)&&rate<LOW_RATE_FRACTION*medianRateBpd) flags.push('low-rate');
      if(m.avgPsi!==null&&m.maxPsi!==null&&m.maxPsi<m.avgPsi) flags.push('max-below-average');
    }
    return {...m,flags,usable:single(m)&&positive(m.injectedBbl)&&positive(m.rateBpd)&&m.avgPsi!==null};
  });
  const decisions:Record<string,Decision>={};
  for(const m of months) if(!m.gap) decisions[m.month]={include:m.flags.length===0,reason:null,byUser:false};
  return {version:H10_DIAGNOSTICS_VERSION,months,medianRateBpd,decisions:Object.freeze(decisions)};
}

export function applyDecision(state:DiagnosticsState,month:string,include:boolean,reason?:string|null):DiagnosticsState {
  const record=state.months.find(m=>m.month===month);
  if(!record||record.gap) throw new Error(`Not a reported month: ${month}`);
  const text=(reason??'').trim();
  if(text.length>MAX_REASON_LENGTH) throw new Error(`A reason must be at most ${MAX_REASON_LENGTH} characters`);
  if(!include&&record.flags.length===0&&!text) throw new Error('A reason (1-200 characters) is required to exclude a month the system did not flag');
  return {...state,decisions:Object.freeze({...state.decisions,[month]:{include,reason:include?null:(text||null),byUser:true}})};
}

export function screening(state:DiagnosticsState):Screening {
  const points=state.months.filter(m=>m.usable&&state.decisions[m.month]?.include).map(m=>({month:m.month,rateBpd:m.rateBpd as number,avgPsi:m.avgPsi as number,ratio:(m.avgPsi as number)/(m.rateBpd as number)}));
  return {points,enough:points.length>=MIN_COMPARABLE_MONTHS,needed:MIN_COMPARABLE_MONTHS};
}

export function coverage(state:DiagnosticsState):Coverage {
  const reported=state.months.filter(m=>!m.gap);
  return {firstMonth:state.months[0].month,lastMonth:state.months[state.months.length-1].month,spanMonths:state.months.length,reportedMonths:reported.length,
    gapMonths:state.months.filter(m=>m.gap).map(m=>m.month),flaggedMonths:reported.filter(m=>m.flags.length>0).length,
    includedMonths:reported.filter(m=>state.decisions[m.month]?.include).length,comparableMonths:screening(state).points.length,
    medianRateBpd:state.medianRateBpd,lowRateEvaluated:state.medianRateBpd!==null};
}
```

- [ ] **Step 4: Build and run; confirm GREEN**

Run (in `N/`): `node ../node_modules/typescript/bin/tsc -p tsconfig.json && node --test tests/h10-diagnostics.test.mjs`
Expected: all 14 tests pass.

### Task 2: Charts (`src/h10DiagnosticsChart.ts`)

**Files:**
- Create: `N/src/h10DiagnosticsChart.ts`
- Test: `N/tests/h10-diagnostics-chart.test.mjs`

**Interfaces:**
- Consumes: `DiagnosticsState`, `screening`, `LABEL_SURFACE`, `LABEL_SCREENING` from Task 1.
- Produces: `type ChartSvg={svg:string;height:number}`; `pressureRateSvg(state):ChartSvg`; `ratioOverTimeSvg(state):ChartSvg`. Both return complete, escaped `<svg>` strings with `width="960"` and `height` equal to `.height`.

- [ ] **Step 1: Write the failing test** `N/tests/h10-diagnostics-chart.test.mjs`

```js
import test from 'node:test';import assert from 'node:assert/strict';
import {diagnoseMonthly,applyDecision,LABEL_SURFACE,LABEL_SCREENING} from '../dist/h10Diagnostics.js';
import {pressureRateSvg,ratioOverTimeSvg} from '../dist/h10DiagnosticsChart.js';

const days=m=>new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7),0)).getUTCDate();
const row=(month,bbl,avg,max)=>({source_row_key:'r-'+month,parent_key:'p',parent_join_status:'joined',uic_number:'1',reporting_year:+month.slice(0,4),reporting_month:+month.slice(5,7),period_start:month+'-01',injected_liquid_bbl:bbl,reported_avg_injection_pressure_psi:avg,reported_max_injection_pressure_psi:max,calendar_days:days(month),calculated_calendar_day_avg_bpd:bbl===null?null:bbl/days(month)});
const state=()=>diagnoseMonthly([row('2024-01',31000,800,900),row('2024-02',29000,810,900),row('2024-04',30000,820,900),row('2024-05',31000,830,900),row('2024-06',300,900,950)]);

test('both charts carry the fixed labels and declare their height',()=>{
 for(const c of [pressureRateSvg(state()),ratioOverTimeSvg(state())]){
  assert.match(c.svg,/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);assert.ok(c.svg.includes(`height="${c.height}"`));
  assert.ok(c.svg.includes(LABEL_SURFACE));assert.ok(c.svg.includes(LABEL_SCREENING));
  assert.doesNotMatch(c.svg,/<script|href=|javascript:/i);
 }
});
test('pressure-rate chart plots one point per comparable month with its month as title',()=>{
 const c=pressureRateSvg(state());
 assert.equal((c.svg.match(/<circle /g)??[]).length,4);for(const m of ['2024-01','2024-02','2024-04','2024-05'])assert.ok(c.svg.includes(`<title>${m}`));
});
test('ratio chart breaks the line at the gap and marks it',()=>{
 const c=ratioOverTimeSvg(state());
 const d=c.svg.match(/<path d="([^"]*)"/)[1];assert.equal((d.match(/M/g)??[]).length,2,'two segments: 2024-01..02 and 2024-04..05');
 assert.ok(c.svg.includes('data-gap="2024-03"'));assert.ok(c.svg.includes('Gap months (no report): 2024-03'));
});
test('excluded months are marked, not plotted',()=>{
 const c=ratioOverTimeSvg(state());
 assert.ok(c.svg.includes('data-excluded="2024-06"'));assert.ok(c.svg.includes('Excluded months: 2024-06'));
});
test('fewer than three comparable months shows the not-enough message instead of a trend',()=>{
 let s=state();for(const m of ['2024-01','2024-02'])s=applyDecision(s,m,false,'test');
 for(const c of [pressureRateSvg(s),ratioOverTimeSvg(s)]){assert.ok(c.svg.includes('Not enough comparable months (2 of 3 needed)'));assert.doesNotMatch(c.svg,/<circle |<path /);}
});
test('text is escaped',()=>{
 let s=state();s=applyDecision(s,'2024-01',false,'<b>&"x"</b>');
 assert.doesNotMatch(ratioOverTimeSvg(s).svg,/<b>/);
});
```

- [ ] **Step 2: Build and run; confirm RED**

Run (in `N/`): `node ../node_modules/typescript/bin/tsc -p tsconfig.json && node --test tests/h10-diagnostics-chart.test.mjs`
Expected: FAIL, with `Cannot find module '../dist/h10DiagnosticsChart.js'`.

- [ ] **Step 3: Implement** `N/src/h10DiagnosticsChart.ts`

```ts
import { LABEL_SCREENING, LABEL_SURFACE, screening, type DiagnosticsState } from './h10Diagnostics.js';

/** Pure SVG strings for display and export alike: escaped text only, no script, links or external references; no decimation. */
export type ChartSvg={svg:string;height:number};
const W=960,L=78,R=40,PW=W-L-R,PH=260,TOP=58;
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
const n=(v:number)=>v.toFixed(2);
const fmt=(v:number)=>Number(v.toPrecision(4)).toLocaleString('en-US');
function niceMax(max:number) {if(!(max>0)) return 1;const pow=10**Math.floor(Math.log10(max));return [1,2,2.5,5,10].map(s=>s*pow).find(s=>s>=max)!;}
const monthStart=(m:string)=>Date.UTC(Number(m.slice(0,4)),Number(m.slice(5,7))-1,1);
const nextMonth=(m:string)=>Date.UTC(Number(m.slice(0,4)),Number(m.slice(5,7)),1);
function frame(title:string,lines:string[],body:string,bodyHeight:number):ChartSvg {
  const notesY=TOP+bodyHeight+40,height=notesY+lines.length*18+16;
  const notes=lines.map((t,i)=>`<text x="${L}" y="${notesY+i*18}" font-size="12" fill="#37474f">${esc(t)}</text>`).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${height}" width="${W}" height="${height}" role="img" aria-label="${esc(title)}" font-family="system-ui, sans-serif"><rect width="${W}" height="${height}" fill="#ffffff"/><text x="${L}" y="26" font-size="16" font-weight="600">${esc(title)}</text><text x="${L}" y="46" font-size="12" fill="#455a64">${esc(LABEL_SURFACE)}. ${esc(LABEL_SCREENING)}.</text>${body}${notes}</svg>`;
  return {svg,height};
}
function notEnough(title:string,count:number,needed:number):ChartSvg {
  return frame(title,[LABEL_SURFACE,LABEL_SCREENING],`<text x="${L}" y="${TOP+40}" font-size="14">${esc(`Not enough comparable months (${count} of ${needed} needed)`)}</text>`,60);
}
function yAxis(max:number,label:string) {
  let s=`<line x1="${L}" y1="${TOP}" x2="${L}" y2="${TOP+PH}" stroke="#90a4ae"/>`;
  for(let i=0;i<=4;i++) {const v=max*i/4,y=TOP+PH-PH*i/4;s+=`<line x1="${L}" y1="${n(y)}" x2="${L+PW}" y2="${n(y)}" stroke="#eceff1"/><text x="${L-8}" y="${n(y+4)}" font-size="11" text-anchor="end">${esc(fmt(v))}</text>`;}
  return s+`<text x="16" y="${TOP+PH/2}" font-size="12" transform="rotate(-90 16 ${TOP+PH/2})" text-anchor="middle">${esc(label)}</text>`;
}

/** Reported average pressure against calendar-day rate for included comparable months. */
export function pressureRateSvg(state:DiagnosticsState):ChartSvg {
  const title='Reported average pressure vs calendar-day rate',sc=screening(state);
  if(!sc.enough) return notEnough(title,sc.points.length,sc.needed);
  const xMax=niceMax(Math.max(...sc.points.map(p=>p.rateBpd))),yMax=niceMax(Math.max(...sc.points.map(p=>p.avgPsi)));
  let body=yAxis(yMax,'Reported average pressure (psi)')+`<line x1="${L}" y1="${TOP+PH}" x2="${L+PW}" y2="${TOP+PH}" stroke="#90a4ae"/>`;
  for(let i=0;i<=4;i++) {const v=xMax*i/4,x=L+PW*i/4;body+=`<text x="${n(x)}" y="${TOP+PH+16}" font-size="11" text-anchor="middle">${esc(fmt(v))}</text>`;}
  body+=`<text x="${L+PW/2}" y="${TOP+PH+32}" font-size="12" text-anchor="middle">Calendar-day rate (bbl/day)</text>`;
  for(const p of sc.points) body+=`<circle cx="${n(L+PW*p.rateBpd/xMax)}" cy="${n(TOP+PH-PH*p.avgPsi/yMax)}" r="4" fill="#1262b5"><title>${esc(`${p.month}: ${fmt(p.rateBpd)} bbl/day, ${fmt(p.avgPsi)} psi`)}</title></circle>`;
  return frame(title,[`Points: ${sc.points.length} included comparable months.`],body,PH);
}

/** Screening ratio over a real time axis; gaps and excluded months break the line and are marked. */
export function ratioOverTimeSvg(state:DiagnosticsState):ChartSvg {
  const title='Reported pressure per unit rate over time (psi per bbl/day)',sc=screening(state);
  if(!sc.enough) return notEnough(title,sc.points.length,sc.needed);
  const first=state.months[0].month,last=state.months[state.months.length-1].month,t0=monthStart(first),t1=nextMonth(last);
  const x=(m:string)=>L+PW*((monthStart(m)+nextMonth(m))/2-t0)/(t1-t0);
  const byMonth=new Map(sc.points.map(p=>[p.month,p])),yMax=niceMax(Math.max(...sc.points.map(p=>p.ratio)));
  let body=yAxis(yMax,'psi per bbl/day')+`<line x1="${L}" y1="${TOP+PH}" x2="${L+PW}" y2="${TOP+PH}" stroke="#90a4ae"/>`;
  let d='',open=false;const gaps:string[]=[],excluded:string[]=[];
  for(const m of state.months) {
    const p=byMonth.get(m.month);
    if(p) {d+=`${open?' L':(d?' M':'M')}${n(x(m.month))} ${n(TOP+PH-PH*p.ratio/yMax)}`;open=true;continue;}
    open=false;
    const x0=L+PW*(monthStart(m.month)-t0)/(t1-t0),w=PW*(nextMonth(m.month)-monthStart(m.month))/(t1-t0);
    if(m.gap) {gaps.push(m.month);body+=`<rect data-gap="${esc(m.month)}" x="${n(x0)}" y="${TOP}" width="${n(w)}" height="${PH}" fill="#ffe0b2" opacity="0.6"><title>${esc(m.month)}: no report (gap)</title></rect>`;}
    else if(!state.decisions[m.month]?.include) {excluded.push(m.month);body+=`<text data-excluded="${esc(m.month)}" x="${n(x0+w/2)}" y="${TOP+PH-4}" font-size="11" text-anchor="middle" fill="#78909c">×<title>${esc(`${m.month}: excluded — ${state.decisions[m.month]?.reason??m.flags.join(', ')}`)}</title></text>`;}
  }
  body+=`<path d="${d}" fill="none" stroke="#1262b5" stroke-width="2"/>`;
  for(const p of sc.points) body+=`<circle cx="${n(x(p.month))}" cy="${n(TOP+PH-PH*p.ratio/yMax)}" r="3" fill="#1262b5"><title>${esc(`${p.month}: ${fmt(p.ratio)} psi per bbl/day`)}</title></circle>`;
  body+=`<text x="${L}" y="${TOP+PH+16}" font-size="11">${esc(first)}</text><text x="${L+PW}" y="${TOP+PH+16}" font-size="11" text-anchor="end">${esc(last)}</text>`;
  const lines=[`Gap months (no report): ${gaps.length?gaps.join(', '):'none'}`,`Excluded months: ${excluded.length?excluded.join(', '):'none'}`,'Lines are not drawn across gaps or excluded months; nothing is interpolated.'];
  return frame(title,lines,body,PH);
}
```

- [ ] **Step 4: Build and run; confirm GREEN**

Run (in `N/`): `node ../node_modules/typescript/bin/tsc -p tsconfig.json && node --test tests/h10-diagnostics-chart.test.mjs`
Expected: all 6 tests pass.

### Task 3: Exports (`src/h10DiagnosticsExport.ts`)

**Files:**
- Create: `N/src/h10DiagnosticsExport.ts`
- Test: `N/tests/h10-diagnostics-export.test.mjs`

**Interfaces:**
- Consumes: Task 1 (`DiagnosticsState`, `coverage`, `screening`, `FORMULAS`, `LIMITATIONS`, `CHECKLIST`, `FLAG_REASONS`, `H10_DIAGNOSTICS_VERSION`) and Task 2 (`ChartSvg`, both chart functions).
- Produces:
  - Types: `DiagnosticsSource={artifactId:string;uic:string|null;normalizedSha256:string|null;manifestSha256:string|null}` and `SealedDiagnostics`.
  - `sealDiagnostics(state,source):Promise<SealedDiagnostics>`
  - `verifySealed(sealed):Promise<boolean>`
  - `diagnosticsJson(sealed):string`
  - `diagnosticsCsv(sealed):string`
  - `diagnosticsSvg(sealed,state):string`

- [ ] **Step 1: Write the failing test** `N/tests/h10-diagnostics-export.test.mjs`

```js
import test from 'node:test';import assert from 'node:assert/strict';
import {diagnoseMonthly,applyDecision} from '../dist/h10Diagnostics.js';
import {sealDiagnostics,verifySealed,diagnosticsJson,diagnosticsCsv,diagnosticsSvg} from '../dist/h10DiagnosticsExport.js';

const days=m=>new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7),0)).getUTCDate();
const row=(month,bbl,avg,max)=>({source_row_key:'r-'+month,parent_key:'p',parent_join_status:'joined',uic_number:'000000001',reporting_year:+month.slice(0,4),reporting_month:+month.slice(5,7),period_start:month+'-01',injected_liquid_bbl:bbl,reported_avg_injection_pressure_psi:avg,reported_max_injection_pressure_psi:max,calendar_days:days(month),calculated_calendar_day_avg_bpd:bbl===null?null:bbl/days(month)});
const source={artifactId:'test-artifact',uic:'000000001',normalizedSha256:'a'.repeat(64),manifestSha256:'b'.repeat(64)};
const state=()=>applyDecision(diagnoseMonthly([row('2024-01',31000,800,900),row('2024-02',29000,null,null),row('2024-04',30000,820,900),row('2024-05',31000,830,900),row('2024-06',30000,840,900)]),'2024-06',false,'=HYPERLINK("x")');

test('sealed export records every month, decision, gap, formula and limitation with a verifiable hash',async()=>{
 const s=await sealDiagnostics(state(),source);
 assert.equal(s.schemaVersion,'h10-diagnostics-export/1');assert.equal(s.method,'h10-diagnostics/1');assert.deepEqual(s.source,source);
 assert.equal(s.months.length,6);assert.deepEqual(s.coverage.gapMonths,['2024-03']);
 const jun=s.months.find(m=>m.month==='2024-06');assert.equal(jun.include,false);assert.equal(jun.reason,'=HYPERLINK("x")');assert.equal(jun.decidedBy,'user');assert.equal(jun.contributes,false);
 const feb=s.months.find(m=>m.month==='2024-02');assert.deepEqual(feb.flags,['no-average-pressure']);assert.equal(feb.decidedBy,'system');assert.ok(feb.flagReasons[0].includes('average'));
 assert.equal(s.screening.length,3);assert.ok(s.formulas.length>=3);assert.ok(s.limitations.some(l=>l.includes('not bottomhole')));assert.equal(s.checklist.length,7);
 assert.match(s.contentSha256,/^[a-f0-9]{64}$/);assert.equal(await verifySealed(s),true);
 assert.equal(await verifySealed({...s,months:s.months.slice(1)}),false);
});
test('JSON round-trips and stays verifiable',async()=>{const s=await sealDiagnostics(state(),source);assert.equal(await verifySealed(JSON.parse(diagnosticsJson(s))),true);});
test('CSV quotes every cell, writes unavailable for missing values and neutralizes formula-like text',async()=>{
 const csv=diagnosticsCsv(await sealDiagnostics(state(),source));
 assert.ok(csv.includes('"Surface-reported pressure (basis as reported), not bottomhole pressure"'));
 assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));assert.ok(csv.includes('"unavailable"'));
 assert.match(csv,/"2024-03","gap"/);assert.ok(csv.endsWith('\r\n'));
});
test('SVG embeds the sealed JSON in metadata and contains both charts',async()=>{
 const st=state(),s=await sealDiagnostics(st,source),svg=diagnosticsSvg(s,st);
 assert.match(svg,/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);assert.ok(svg.includes('<metadata>'));
 const meta=svg.slice(svg.indexOf('<metadata>')+10,svg.indexOf('</metadata>')).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
 assert.equal(JSON.parse(meta).contentSha256,s.contentSha256);
 assert.ok(svg.includes('Reported average pressure vs calendar-day rate'));assert.ok(svg.includes('Reported pressure per unit rate over time'));
});
```

- [ ] **Step 2: Build and run; confirm RED**

Run (in `N/`): `node ../node_modules/typescript/bin/tsc -p tsconfig.json && node --test tests/h10-diagnostics-export.test.mjs`
Expected: FAIL, with `Cannot find module '../dist/h10DiagnosticsExport.js'`.

- [ ] **Step 3: Implement** `N/src/h10DiagnosticsExport.ts`

```ts
import { CHECKLIST, FLAG_REASONS, FORMULAS, H10_DIAGNOSTICS_VERSION, LIMITATIONS, coverage, screening, type Coverage, type DiagnosticsState, type FlagCode, type ScreeningPoint } from './h10Diagnostics.js';
import { pressureRateSvg, ratioOverTimeSvg } from './h10DiagnosticsChart.js';

export type DiagnosticsSource={artifactId:string;uic:string|null;normalizedSha256:string|null;manifestSha256:string|null};
export type ExportMonth={month:string;status:'gap'|'reported';sourceRowKeys:string[];injectedBbl:number|null;calendarDays:number;rateBpd:number|null;avgPsi:number|null;maxPsi:number|null;
  flags:FlagCode[];flagReasons:string[];include:boolean|null;reason:string|null;decidedBy:'system'|'user'|null;contributes:boolean};
export type SealedDiagnostics={schemaVersion:'h10-diagnostics-export/1';method:typeof H10_DIAGNOSTICS_VERSION;source:DiagnosticsSource;coverage:Coverage;months:ExportMonth[];screening:ScreeningPoint[];
  formulas:string[];limitations:string[];checklist:{cause:string;evidence:string}[];contentSha256:string};

async function sha256(text:string) {
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
const body=(s:Omit<SealedDiagnostics,'contentSha256'>|SealedDiagnostics)=>{const {contentSha256:_,...rest}={contentSha256:'',...s};return JSON.stringify(rest);};

export async function sealDiagnostics(state:DiagnosticsState,source:DiagnosticsSource):Promise<SealedDiagnostics> {
  const points=screening(state).points,contributing=new Set(points.map(p=>p.month));
  const months:ExportMonth[]=state.months.map(m=>{const d=state.decisions[m.month];return {month:m.month,status:m.gap?'gap':'reported',sourceRowKeys:[...m.sourceRowKeys],injectedBbl:m.injectedBbl,calendarDays:m.calendarDays,
    rateBpd:m.rateBpd,avgPsi:m.avgPsi,maxPsi:m.maxPsi,flags:[...m.flags],flagReasons:m.flags.map(f=>FLAG_REASONS[f]),include:d?d.include:null,reason:d?d.reason:null,
    decidedBy:d?(d.byUser?'user':'system'):null,contributes:contributing.has(m.month)};});
  const unsealed={schemaVersion:'h10-diagnostics-export/1' as const,method:H10_DIAGNOSTICS_VERSION,source:{...source},coverage:coverage(state),months,screening:points,
    formulas:[...FORMULAS],limitations:[...LIMITATIONS],checklist:CHECKLIST.map(c=>({...c}))};
  return {...unsealed,contentSha256:await sha256(body(unsealed))};
}
export async function verifySealed(sealed:SealedDiagnostics):Promise<boolean> {return /^[a-f0-9]{64}$/.test(sealed?.contentSha256??'')&&await sha256(body(sealed))===sealed.contentSha256;}
export const diagnosticsJson=(sealed:SealedDiagnostics)=>JSON.stringify(sealed,null,2)+'\n';

const cell=(v:unknown)=>{
  if(v===null||v===undefined) return '"unavailable"';
  if(typeof v==='number') return `"${v}"`;
  let s=String(v);if(/^[=+\-@\t\r]/.test(s)) s="'"+s;
  return `"${s.replace(/"/g,'""')}"`;
};
export function diagnosticsCsv(sealed:SealedDiagnostics):string {
  const lines:unknown[][]=[['H-10 diagnostics export',sealed.method],['Artifact',sealed.source.artifactId],['UIC',sealed.source.uic],['Normalized SHA-256',sealed.source.normalizedSha256],
    ['Manifest SHA-256',sealed.source.manifestSha256],['Content SHA-256',sealed.contentSha256],...sealed.limitations.map(l=>['Limitation',l]),...sealed.formulas.map(f=>['Formula',f]),[],
    ['Month','Status','Injected liquid (bbl/month)','Calendar days','Calendar-day rate (bbl/day)','Reported average pressure (psi)','Reported maximum pressure (psi)','Flags','Included','Decided by','Reason','Contributes to screening','Source row IDs'],
    ...sealed.months.map(m=>[m.month,m.status,m.injectedBbl,m.calendarDays,m.rateBpd,m.avgPsi,m.maxPsi,m.flags.join('; ')||'none',m.include===null?null:m.include?'yes':'no',m.decidedBy,m.reason,m.contributes?'yes':'no',m.sourceRowKeys.join('; ')||null])];
  return lines.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
const escXml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
export function diagnosticsSvg(sealed:SealedDiagnostics,state:DiagnosticsState):string {
  const a=pressureRateSvg(state),b=ratioOverTimeSvg(state),height=a.height+b.height;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 ${height}" width="960" height="${height}"><metadata>${escXml(JSON.stringify(sealed))}</metadata>`+
    `<svg y="0" width="960" height="${a.height}">${a.svg}</svg><svg y="${a.height}" width="960" height="${b.height}">${b.svg}</svg></svg>`;
}
```

- [ ] **Step 4: Build and run; confirm GREEN**

Run (in `N/`): `node ../node_modules/typescript/bin/tsc -p tsconfig.json && node --test tests/h10-diagnostics-export.test.mjs`
Expected: all 4 tests pass.

### Task 4: Panel session and UI (`web/h10-diagnostics.mjs`)

**Files:**
- Create: `N/web/h10-diagnostics.mjs`
- Test: `N/tests/h10-diagnostics-session.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–3 via `../dist/*.js`. A selection object `{artifact:{artifactId,injectionMonthly}, pin?:{normalizedSha256,manifestSha256}}` (as returned by `selectedPublic()` in `web/import-ui.mjs`). A gate `{ready:boolean,reasons:string[]}`.
- Produces:
  - `createDiagnosticsSession(selection,gate)` returns `{state, revision, gate, source, decide(month,include,reason), dispose(), isCurrent(revision), exportRequest(format)}`.
    - `exportRequest(format)` resolves to `{filename,mime,text}`, or to `null` when stale.
    - It throws `Exports blocked: …` when the gate is not ready.
  - `mountH10Diagnostics(root,{selection,gate,download})` returns `{dispose()}`. `download(text,name,type)` is supplied by import-ui.

- [ ] **Step 1: Write the failing test** `N/tests/h10-diagnostics-session.test.mjs`

```js
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createDiagnosticsSession} from '../web/h10-diagnostics.mjs';
import {verifySealed} from '../dist/h10DiagnosticsExport.js';

const artifact=JSON.parse(await readFile('data/explorer/normalized.json','utf8')),pin=JSON.parse(await readFile('data/explorer-pin.json','utf8'));
const selection={artifact,pin},ready={ready:true,reasons:[]},blocked={ready:false,reasons:['Inspection only: test.']};

test('session starts from the system flags with revision 0 and records the source identity',()=>{
 const s=createDiagnosticsSession(selection,ready);
 assert.equal(s.revision,0);assert.equal(s.source.artifactId,artifact.artifactId);assert.equal(s.source.uic,'000020838');assert.equal(s.source.normalizedSha256,pin.normalizedSha256);
 assert.equal(Object.values(s.state.decisions).every(d=>d.include),true);
});
test('each decision increments the revision',()=>{
 const s=createDiagnosticsSession(selection,ready);s.decide('2024-01',false,'test reason');assert.equal(s.revision,1);assert.equal(s.state.decisions['2024-01'].include,false);
});
test('an invalid decision leaves state and revision unchanged',()=>{
 const s=createDiagnosticsSession(selection,ready);assert.throws(()=>s.decide('2024-01',false,''),/reason/i);assert.equal(s.revision,0);assert.equal(s.state.decisions['2024-01'].include,true);
});
test('a current export resolves to a verifiable sealed JSON',async()=>{
 const s=createDiagnosticsSession(selection,ready),r=await s.exportRequest('json');
 assert.match(r.filename,/^h10-diagnostics-000020838-[a-f0-9]{12}\.json$/);assert.equal(r.mime,'application/json');assert.equal(await verifySealed(JSON.parse(r.text)),true);
 for(const f of ['csv','svg'])assert.ok((await s.exportRequest(f)).text.length>100);
});
test('a decision made while an export is sealing makes that export stale',async()=>{
 const s=createDiagnosticsSession(selection,ready),pending=s.exportRequest('json');s.decide('2024-01',false,'changed mid-export');assert.equal(await pending,null);
});
test('dispose makes every pending and later export stale',async()=>{
 const s=createDiagnosticsSession(selection,ready),pending=s.exportRequest('csv');s.dispose();assert.equal(await pending,null);assert.equal(await s.exportRequest('csv'),null);
});
test('a blocked gate refuses exports with its reasons',async()=>{
 const s=createDiagnosticsSession(selection,blocked);await assert.rejects(s.exportRequest('json'),/Exports blocked: Inspection only: test\./);
});
test('unknown export formats are rejected',async()=>{await assert.rejects(createDiagnosticsSession(selection,ready).exportRequest('pdf'),/Unsupported export format/);});
```

- [ ] **Step 2: Run; confirm RED**

Run (in `N/`): `node --test tests/h10-diagnostics-session.test.mjs`
Expected: FAIL, with `Cannot find module '../web/h10-diagnostics.mjs'`.

- [ ] **Step 3: Implement** `N/web/h10-diagnostics.mjs`

```js
import {diagnoseMonthly,applyDecision,screening,coverage,FLAG_REASONS,CHECKLIST,LABEL_SURFACE,LABEL_SCREENING} from '../dist/h10Diagnostics.js';
import {pressureRateSvg,ratioOverTimeSvg} from '../dist/h10DiagnosticsChart.js';
import {sealDiagnostics,diagnosticsJson,diagnosticsCsv,diagnosticsSvg} from '../dist/h10DiagnosticsExport.js';

const FORMATS={json:['application/json',s=>diagnosticsJson(s)],csv:['text/csv;charset=utf-8',s=>diagnosticsCsv(s)],svg:['image/svg+xml',(s,state)=>diagnosticsSvg(s,state)]};

/** DOM-free session: the user's month decisions, a revision counter and stale-export refusal. Nothing runs at import time. */
export function createDiagnosticsSession(selection,gate){
 let state=diagnoseMonthly(selection.artifact.injectionMonthly),revision=0,alive=true;
 const source=Object.freeze({artifactId:String(selection.artifact.artifactId),uic:selection.artifact.injectionMonthly[0]?.uic_number??null,normalizedSha256:selection.pin?.normalizedSha256??null,manifestSha256:selection.pin?.manifestSha256??null});
 const session={
  get state(){return state;},get revision(){return revision;},gate,source,
  decide(month,include,reason){state=applyDecision(state,month,include,reason);revision++;},
  dispose(){alive=false;revision++;},
  isCurrent(r){return alive&&r===revision;},
  async exportRequest(format){
   const kind=FORMATS[format];if(!kind)throw new Error('Unsupported export format: '+format);
   if(!gate.ready)throw new Error('Exports blocked: '+gate.reasons.join(' '));
   const r=revision,snapshot=state;if(!session.isCurrent(r))return null;
   const sealed=await sealDiagnostics(snapshot,source);
   if(!session.isCurrent(r))return null;
   return {filename:`h10-diagnostics-${source.uic??'well'}-${sealed.contentSha256.slice(0,12)}.${format}`,mime:kind[0],text:kind[1](sealed,snapshot)};
  }};
 return session;
}

const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function svgNode(svg){const doc=new DOMParser().parseFromString(svg,'image/svg+xml');if(doc.getElementsByTagName('parsererror').length||doc.documentElement.localName!=='svg')throw new Error('Generated diagnostics chart could not be parsed.');return document.importNode(doc.documentElement,true);}
const fmt=v=>v===null||v===undefined?'not reported':Number(Number(v).toPrecision(6)).toLocaleString('en-US');

/** Panel inside Injector history. import-ui disposes it whenever results are cleared, so a well or source change always starts fresh. */
export function mountH10Diagnostics(root,{selection,gate,download}){
 const session=createDiagnosticsSession(selection,gate),section=el('section',undefined,'panel');section.setAttribute('aria-labelledby','h10-diagnostics-title');
 root.replaceChildren(section);
 function render(){
  const st=session.state,cov=coverage(st),sc=screening(st);section.replaceChildren();
  const h=el('h2','H-10 diagnostics: choose comparable months');h.id='h10-diagnostics-title';section.append(h);
  section.append(el('p',`${LABEL_SURFACE}. ${LABEL_SCREENING}.`));
  section.append(el('p',`Coverage: ${cov.firstMonth} to ${cov.lastMonth} · ${cov.spanMonths} months in span · ${cov.reportedMonths} reported · ${cov.gapMonths.length} gap months${cov.gapMonths.length?' ('+cov.gapMonths.join(', ')+')':''} · ${cov.flaggedMonths} flagged · ${cov.includedMonths} included · ${cov.comparableMonths} comparable.${cov.lowRateEvaluated?'':' Low-rate check not evaluated: no month has a positive rate.'}`));
  const status=el('p','','');status.setAttribute('role','status');section.append(status);
  const review=el('details');review.open=cov.flaggedMonths>0;review.append(el('summary',`Month review (${cov.flaggedMonths} flagged by the system; you decide)`));
  const wrap=el('div',undefined,'table-scroll');wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Month review');wrap.tabIndex=0;
  const table=el('table'),head=el('tr');for(const t of ['Month','Injected (bbl)','Rate (bbl/day)','Avg psi','Max psi','Flags','Include','Reason'])head.append(el('th',t));table.append(el('thead'));table.tHead.append(head);
  const body=el('tbody');
  for(const m of st.months){
   const tr=el('tr'),d=st.decisions[m.month];tr.append(el('th',m.month));
   if(m.gap){const td=el('td','No report (gap): not zero, not interpolated');td.colSpan=7;tr.append(td);body.append(tr);continue;}
   for(const v of [m.injectedBbl,m.rateBpd,m.avgPsi,m.maxPsi])tr.append(el('td',fmt(v)));
   tr.append(el('td',m.flags.length?m.flags.map(f=>FLAG_REASONS[f]).join(' '):'none'));
   const box=el('input');box.type='checkbox';box.checked=d.include;box.setAttribute('aria-label',`Include ${m.month}`);
   const reason=el('input');reason.type='text';reason.maxLength=200;reason.value=d.reason??'';reason.placeholder=m.flags.length?'optional':'required to exclude';reason.setAttribute('aria-label',`Reason for ${m.month}`);
   box.onchange=()=>{try{session.decide(m.month,box.checked,reason.value);render();}catch(e){box.checked=!box.checked;status.textContent=e.message;reason.focus();}};
   const inc=el('td');inc.append(box);if(d.include&&!m.usable)inc.append(el('small',' included, but its values cannot be compared'));tr.append(inc);
   const rs=el('td');rs.append(reason);tr.append(rs);body.append(tr);
  }
  table.append(body);wrap.append(table);review.append(wrap);section.append(review);
  if(!gate.ready){section.append(el('p','Screening views and exports are blocked. '+gate.reasons.join(' ')));}
  else{
   for(const chart of [pressureRateSvg(st),ratioOverTimeSvg(st)]){const box=el('div',undefined,'analysis-chart-scroll');box.append(svgNode(chart.svg));section.append(box);}
   const actions=el('div',undefined,'import-actions');
   for(const [format,label] of [['json','Download diagnostics JSON'],['csv','Download diagnostics CSV'],['svg','Download diagnostics SVG']]){
    const b=el('button',label);b.type='button';
    b.onclick=async()=>{try{const r=await session.exportRequest(format);if(!r){status.textContent='The selection changed while preparing this export. Download again.';return;}download(r.text,r.filename,r.mime);status.textContent=`Downloaded ${r.filename}.`;}catch(e){status.textContent=e.message;}};
    actions.append(b);
   }
   section.append(actions);
  }
  const check=el('details');check.append(el('summary','Possible causes: questions to investigate, not conclusions'));const ul=el('ul');
  for(const c of CHECKLIST)ul.append(el('li',`${c.cause}: check ${c.evidence.charAt(0).toLowerCase()+c.evidence.slice(1)}.`));check.append(ul);section.append(check);
  section.append(el('p',sc.enough?`${sc.points.length} months contribute to the screening views.`:`Not enough comparable months (${sc.points.length} of ${sc.needed} needed).`));
 }
 render();
 return {dispose(){session.dispose();root.replaceChildren();}};
}
```

- [ ] **Step 4: Run; confirm GREEN**

Run (in `N/`): `node --test tests/h10-diagnostics-session.test.mjs`
Expected: all 8 tests pass. The module does no DOM work at import time, so it loads in Node.

### Task 5: Wire into Injector history (protected `web/import-ui.mjs`) and record the layer

**Files:**
- Create: `migration/layer-specs/h10-diagnostics.json` (repo root)
- Archive (generated): `migration/baselines/h10-diagnostics-before/swd-injection-analytics/web/import-ui.mjs`
- Modify: `N/web/import-ui.mjs` (lines 10, 21, 100, 237, 244, 312–313)

**Interfaces:**
- Consumes: `mountH10Diagnostics` (Task 4); existing `selectedPublic`, `publicCalculationGate`, `download`, `el`, `$` in import-ui.

- [ ] **Step 1: Spec and archive BEFORE any edit.** Create `migration/layer-specs/h10-diagnostics.json` at the repo root:

```json
{
  "purpose": "Phase 1a (PRD ANA-E02): H-10 diagnostics panel with guided month review in Injector history; fixes the sample-case CSV/SVG download gate.",
  "acceptanceEvidence": "demo/H10-DIAGNOSTICS-VERIFICATION.md",
  "approvedDocs": [
    "docs/superpowers/specs/2026-10-29-h10-diagnostics-design.md",
    "docs/superpowers/plans/2026-10-29-h10-diagnostics.md"
  ],
  "changes": ["web/import-ui.mjs"],
  "newFiles": [
    "src/h10Diagnostics.ts", "src/h10DiagnosticsChart.ts", "src/h10DiagnosticsExport.ts", "web/h10-diagnostics.mjs",
    "tests/h10-diagnostics.test.mjs", "tests/h10-diagnostics-chart.test.mjs", "tests/h10-diagnostics-export.test.mjs", "tests/h10-diagnostics-session.test.mjs"
  ],
  "rootFiles": ["migration/layers/index.json"]
}
```

Then, at the repo root: `node scripts/record-layer.mjs h10-diagnostics archive` → `archived 1`. Record `CR=4` for `N/web/import-ui.mjs`.

- [ ] **Step 2: Edit import-ui.** Make exactly these changes, in this order:

1. After line 10 (`import {mountPressureContext} from './pressure-support.mjs';`), add:
```js
import {mountH10Diagnostics} from './h10-diagnostics.mjs';
```
2. After the line `const pressureContext=mountPressureContext($('pressure-support-workspace'));`, add:
```js
let h10Panel=null;
```
3. Replace `function clearResults(){shown=null;` with:
```js
function clearResults(){h10Panel?.dispose();h10Panel=null;shown=null;
```
4. Add this function immediately before `function renderPublicResult(){`:
```js
function mountH10(){const p=selectedPublic();if(!p?.artifact)return;const box=el('div');box.id='h10-diagnostics';$('import-results').append(box);h10Panel=mountH10Diagnostics(box,{selection:p,gate:publicCalculationGate(),download});}
```
5. In `renderPublicResult`, the not-ready branch: replace
`$('import-results').append(el('p','Preserved evidence remains available in Data & sources. No public-history calculations or result exports were generated.'));return;}`
with
`$('import-results').append(el('p','Preserved evidence remains available in Data & sources. No public-history calculations or result exports were generated.'));mountH10();return;}`
6. At the end of `renderPublicResult`, insert `mountH10();` on a new line just before its closing `}`. Anchor on the unique boundary `}
function mappingControls(){` (lines 244–245): replace it with `mountH10();
}
function mappingControls(){`. Do not anchor on `composite.append(part)…`, which occurs 3 times in the file.
7. Lines 312–313: in both the `import-csv` and `import-svg` handlers, replace `(source!=='public'||publicCalculationGate().ready)` with `!((source==='public'||source==='sample'&&view==='publicTrends')&&!publicCalculationGate().ready)`. This matches the JSON handler at line 311.

`mountH10()` runs after `present()`/`clearResults()` within `renderPublicResult`, so the panel always appears after the existing charts. Every path that clears results (navigation, source switch, sample-well change, package adoption, `demo-updated`) disposes it.

- [ ] **Step 3: Confirm the edit.** `CR` count of `N/web/import-ui.mjs` is still `4`, on its last four lines. `git diff --stat` shows only import-ui among existing product files. Then, in `N/`, run `node --check web/import-ui.mjs` (syntax only).

- [ ] **Step 4: Full product checks**

Run (in `N/`):
- `node ../node_modules/typescript/bin/tsc -p tsconfig.json`
- `node --test tests/*.test.mjs` → 435 + 32 new = 467 pass (record the actual count)
- `node scripts/check-carried-oracles.mjs` → 248 comparisons, 0 failures

Run (repo root): `node scripts/prepare-swd.mjs`.

- [ ] **Step 5: Record pending and run the root gates**

Run (repo root):
- `node scripts/record-layer.mjs h10-diagnostics` → `pending-review`
- `node scripts/verify-preservation.mjs .` → exactly one violation: `Layer h10-diagnostics baseline is pending/not accepted after independent review`
- `node --test tests/transfer.test.mjs tests/preservation-baseline.test.mjs tests/layer-registry.test.mjs` → only the transfer live-root test fails, on that pending violation

If `tests/preservation-baseline.test.mjs` or `tests/layer-registry.test.mjs` fail for another reason, stop and diagnose (systematic-debugging). The Phase A fixture rules were designed for this case, and a different failure means a real gap.

### Task 6: Browser verification, record, review, acceptance

**Files:**
- Create: `demo/H10-DIAGNOSTICS-VERIFICATION.md` (repo root)

- [ ] **Step 1: Browser checks.** Serve with nested `PORT=4174 node scripts/serve.mjs` (from `N/`, background). Use headless Chrome `--remote-debugging-port=9333` and the cdp driver in `demo/sample-minors-evidence/` (the Chrome DevTools MCP is usually held by another session). Check, at desktop 1280px and mobile 390px:
  1. **Pinned well**, Injector history: the panel appears below the existing charts, showing coverage "28 months … 0 gap months … 0 flagged". The existing three charts and their downloads are unchanged.
  2. **Exclude and re-include:**
     - Untick a month with an empty reason → the status shows the reason error and the box stays ticked.
     - Enter a reason, then untick → the comparable count drops by 1 and the ratio chart shows an `×` marker.
     - Re-tick → the count is restored.
  3. **Downloads:** JSON, CSV and SVG each download with an `h10-diagnostics-000020838-…` filename. The JSON verifies (`verifySealed`).
  4. **Sample case well B:** the panel shows 16 months, and switching back to well A resets the review.
  5. **Stale export:** start a JSON download and immediately switch wells → no file. Either the panel is gone (disposed) or the status says the selection changed.
  6. **Mobile 390px:** the table and charts scroll horizontally inside their containers, with no page-level horizontal scroll.
  7. **Blocked gate:** import an ineligible package if a fixture exists under `N/tests/fixtures/explorer-packages/`. Otherwise mark this check as covered by the Task 4 unit test only.
- [ ] **Step 2: Write `demo/H10-DIAGNOSTICS-VERIFICATION.md`.** Include commands, counts, the CR counts, the RED→GREEN list per task, the browser results with screenshots under `demo/h10-diagnostics-evidence/`, and any rulings.
- [ ] **Step 3: Independent review (D13).** Dispatch a read-only Claude Opus reviewer with a seven-field brief (`handover/context/agent-workflow.md`). Ask it to check the Review Focus list, the spec's §3 rules one by one, and the import-ui diff.
- [ ] **Step 4:** Fix confirmed Critical/Important findings with RED→GREEN tests, then re-record pending (`node scripts/record-layer.mjs h10-diagnostics`) and re-run Task 5 Step 5.
- [ ] **Step 5: Owner acceptance.** The owner runs `! cd <repo root> && node scripts/record-layer.mjs h10-diagnostics accept "Thai Phi" && node scripts/verify-preservation.mjs .` → 0 violations.
- [ ] **Step 6: Main commits** on `feature/phase-1a-h10-diagnostics`, runs the fresh-clone check, and pushes/merges only on the owner's instruction.
