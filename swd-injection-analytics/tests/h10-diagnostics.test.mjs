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
test('a zero-volume month after a duplicate month with positive volume is no-volume, not before-first-injection',()=>{
 const s=diagnoseMonthly([row('2024-01',30000,800,900,'a'),row('2024-01',30000,800,900,'b'),row('2024-02',0,500,600),row('2024-03',31000,800,900)]);
 assert.deepEqual(flagsOf(s)['2024-02'],['no-volume']);
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
