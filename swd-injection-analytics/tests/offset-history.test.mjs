import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const engineDir=process.env.DISPOSAL_ENGINE_DIR??'dist';
const load=f=>import(pathToFileURL(resolve(engineDir,f))).catch(()=>({}));
const {addPackage,packageFromVerified,EMPTY_PACKAGE_SET}=await load('historyPackages.js');
const {offsetSchedule,OFFSET_HISTORY_VERSION}=await load('offsetHistory.js');
const {BANNED}=await load('caseSummary.js');
const UIC='000000418';
const row=(month,bbl,uic=UIC)=>({source_row_key:month+uic,parent_key:'fictional-parent',parent_join_status:'joined',uic_number:uic,reporting_year:Number(month.slice(0,4)),reporting_month:Number(month.slice(5,7)),period_start:month+'-01',injected_liquid_bbl:bbl,reported_avg_injection_pressure_psi:500,reported_max_injection_pressure_psi:900,calendar_days:30,calculated_calendar_day_avg_bpd:bbl===null?null:bbl/30});
const months=(a,b)=>{const out=[];let [y,m]=a.split('-').map(Number);for(;;){const s=`${y}-${String(m).padStart(2,'0')}`;out.push(s);if(s===b)return out;m++;if(m>12){m=1;y++;}}};
const pkg=({id,start,end,vol={},def=3000,uic=UIC})=>packageFromVerified({
 artifact:{schemaVersion:1,artifactId:id,inventory:[{source_record_key:'inv-'+id,uic_number:uic,api_no:'00000000000000'}],
  injectionMonthly:months(start,end).filter(m=>vol[m]!==undefined?true:def!==undefined).map(m=>row(m,vol[m]!==undefined?vol[m]:def,uic)).filter(r=>!(r.period_start.slice(0,7) in vol&&vol[r.period_start.slice(0,7)]==='missing')),
  manifest:{scope:{uic_number:uic,start:start+'-01',end:end+'-28'}},qualityReport:{},dataDictionary:{}},
 pin:{artifactId:id,manifestSha256:'sha-'+id},calculationEligibility:{ready:true,reasons:[]}});
const setOf=(...ps)=>ps.reduce(addPackage,EMPTY_PACKAGE_SET);
const choices=(o={})=>({uic:UIC,distanceFt:2000,connected:true,zerosAreShutIn:false,gapRates:{},prior:null,after:null,...o});

test('module exists',()=>{assert.equal(typeof offsetSchedule,'function');assert.equal(OFFSET_HISTORY_VERSION,'offset-history/1');});
test('gap without rate is incomplete and listed; filling completes',()=>{
 const s=setOf(pkg({id:'a',start:'2023-01',end:'2023-04',vol:{'2023-03':null}}));
 const r=offsetSchedule(s,choices(),'2023-04');
 assert.equal(r.status,'incomplete');assert.deepEqual(r.gapMonths,['2023-03']);
 assert.deepEqual(r.steps.map(x=>x.month),['2023-01','2023-02','2023-04']);
 const f=offsetSchedule(s,choices({gapRates:{'2023-03':120}}),'2023-04');
 assert.equal(f.status,'complete');
 assert.deepEqual(f.steps.map(x=>[x.month,x.origin]),[['2023-01','reported'],['2023-02','reported'],['2023-03','assumed-gap'],['2023-04','reported']]);
 assert.equal(f.steps[2].rateStbd,120);assert.equal(f.steps[0].rateStbd,100);
 assert.equal(offsetSchedule(s,choices({gapRates:{'2023-03':0}}),'2023-04').status,'complete');
 assert.throws(()=>offsetSchedule(s,choices({gapRates:{'2023-03':-1}}),'2023-04'));
});
test('reported zero is a gap until zerosAreShutIn',()=>{
 const s=setOf(pkg({id:'a',start:'2023-01',end:'2023-03',vol:{'2023-02':0}}));
 const a=offsetSchedule(s,choices(),'2023-03');
 assert.equal(a.status,'incomplete');assert.deepEqual(a.gapMonths,['2023-02']);
 const b=offsetSchedule(s,choices({zerosAreShutIn:true}),'2023-03');
 assert.equal(b.status,'complete');assert.deepEqual(b.gapMonths,[]);
 assert.deepEqual(b.steps[1],{month:'2023-02',rateStbd:0,origin:'reported'});
});
test('throughMonth past window needs after choice',()=>{
 const s=setOf(pkg({id:'a',start:'2023-01',end:'2023-03'}));
 const n=offsetSchedule(s,choices(),'2023-05');
 assert.equal(n.status,'incomplete');assert.equal(n.steps.length,3);
 const sh=offsetSchedule(s,choices({after:{kind:'shut-in'}}),'2023-05');
 assert.equal(sh.status,'complete');assert.deepEqual(sh.steps.slice(3),[{month:'2023-04',rateStbd:0,origin:'assumed-after'},{month:'2023-05',rateStbd:0,origin:'assumed-after'}]);
 const ty=offsetSchedule(s,choices({after:{kind:'typed',rateStbd:55}}),'2023-05');
 assert.deepEqual(ty.steps.slice(3).map(x=>x.rateStbd),[55,55]);assert.equal(ty.steps[4].origin,'assumed-after');
 assert.equal(offsetSchedule(s,choices({after:{kind:'typed',rateStbd:55}}),'2023-03').status,'complete');
});
test('hold-average averages last N reported months and cites them',()=>{
 const s=setOf(pkg({id:'a',start:'2023-01',end:'2023-04',vol:{'2023-01':3000,'2023-02':6000,'2023-03':9000,'2023-04':12000}}));
 const r=offsetSchedule(s,choices({after:{kind:'hold-average',lastN:2}}),'2023-06');
 assert.equal(r.status,'complete');
 assert.deepEqual(r.steps.slice(4).map(x=>x.rateStbd),[350,350]);
 assert.match(r.afterLabel,/assumed, from reported months 2023-03.2023-04/);
 assert.ok(r.labels.includes(r.afterLabel));
 assert.throws(()=>offsetSchedule(s,choices({after:{kind:'hold-average',lastN:0}}),'2023-06'));
 assert.equal(offsetSchedule(s,choices({after:{kind:'hold-average',lastN:9}}),'2023-06').status,'incomplete');
});
test('hold-average skips gaps and unconfirmed zeros',()=>{
 const s=setOf(pkg({id:'a',start:'2023-01',end:'2023-04',vol:{'2023-01':3000,'2023-02':6000,'2023-03':0,'2023-04':null}}));
 const r=offsetSchedule(s,choices({gapRates:{'2023-04':1},after:{kind:'hold-average',lastN:2}}),'2023-05');
 assert.equal(r.status,'incomplete');
 const r2=offsetSchedule(s,choices({gapRates:{'2023-03':1,'2023-04':1},after:{kind:'hold-average',lastN:2}}),'2023-05');
 assert.equal(r2.steps[4].rateStbd,150);assert.match(r2.afterLabel,/2023-01.2023-02/);
 const r3=offsetSchedule(s,choices({zerosAreShutIn:true,gapRates:{'2023-04':1},after:{kind:'hold-average',lastN:2}}),'2023-05');
 assert.equal(r3.steps[4].rateStbd,100);
});
test('prior null gives partialHistory; prior fills before window',()=>{
 const s=setOf(pkg({id:'a',start:'2023-03',end:'2023-04'}));
 const n=offsetSchedule(s,choices(),'2023-04');
 assert.equal(n.partialHistory,true);assert.equal(n.steps[0].month,'2023-03');
 assert.equal(n.windowStart,'2023-03');assert.equal(n.windowEnd,'2023-04');
 const p=offsetSchedule(s,choices({prior:{startMonth:'2022-12',rateStbd:40}}),'2023-04');
 assert.equal(p.partialHistory,false);
 assert.deepEqual(p.steps.slice(0,3).map(x=>[x.month,x.rateStbd,x.origin]),[['2022-12',40,'assumed-prior'],['2023-01',40,'assumed-prior'],['2023-02',40,'assumed-prior']]);
 assert.equal(p.steps[3].origin,'reported');assert.equal(p.status,'complete');
 assert.throws(()=>offsetSchedule(s,choices({prior:{startMonth:'2023-03',rateStbd:40}}),'2023-04'
));
});
test('months between package windows are gaps',()=>{
 const s=setOf(pkg({id:'a',start:'2023-01',end:'2023-02'}),pkg({id:'b',start:'2023-05',end:'2023-06'}));
 const r=offsetSchedule(s,choices(),'2023-06');
 assert.deepEqual(r.gapMonths,['2023-03','2023-04']);assert.equal(r.status,'incomplete');
 const f=offsetSchedule(s,choices({gapRates:{'2023-03':10,'2023-04':20}}),'2023-06');
 assert.equal(f.status,'complete');assert.equal(f.steps.length,6);assert.equal(f.windowEnd,'2023-06');
});
test('through before window end stops there',()=>{
 const s=setOf(pkg({id:'a',start:'2023-01',end:'2023-06'}));
 const r=offsetSchedule(s,choices(),'2023-03');
 assert.equal(r.status,'complete');assert.equal(r.steps.length,3);assert.equal(r.steps[2].month,'2023-03');
});
test('over 600 months throws; 600 allowed',()=>{
 const s=setOf(pkg({id:'a',start:'2023-01',end:'2023-03'}));
 assert.throws(()=>offsetSchedule(s,choices({after:{kind:'shut-in'}}),'2073-01'),/600/);
 assert.throws(()=>offsetSchedule(s,choices({prior:{startMonth:'1900-01',rateStbd:1},after:{kind:'shut-in'}}),'2023-03'),/600/);
 assert.equal(offsetSchedule(s,choices({after:{kind:'shut-in'}}),'2072-12').steps.length,600);
});
test('connected false is excluded; null connected is not excluded',()=>{
 const s=setOf(pkg({id:'a',start:'2023-01',end:'2023-03',vol:{'2023-02':null}}));
 const r=offsetSchedule(s,choices({connected:false}),'2023-05');
 assert.equal(r.status,'excluded');assert.equal(r.uic,UIC);
 assert.equal(offsetSchedule(s,choices({connected:null}),'2023-03').status,'incomplete');
});
test('deterministic, no mutation, labels clear of banned words',()=>{
 const s=setOf(pkg({id:'a',start:'2023-01',end:'2023-03',vol:{'2023-02':null}}));
 const c=choices({gapRates:{'2023-02':5},prior:{startMonth:'2022-11',rateStbd:2},after:{kind:'typed',rateStbd:9}});
 const before=structuredClone(c);
 const a=offsetSchedule(s,c,'2023-05'),b=offsetSchedule(s,c,'2023-05');
 assert.deepEqual(a,b);assert.deepEqual(c,before);
 assert.ok(a.labels.length>0);
 for(const l of [...a.labels,a.afterLabel])assert.doesNotMatch(l,BANNED);
 assert.ok(a.labels.some(l=>/^reported/.test(l)));assert.ok(a.labels.some(l=>/assumed/.test(l)));
});
test('unknown uic throws',()=>assert.throws(()=>offsetSchedule(setOf(pkg({id:'a',start:'2023-01',end:'2023-03'})),choices({uic:'000000999'}),'2023-03')));
test('throughMonth before window start throws, with and without prior',()=>{
 const s=setOf(pkg({id:'a',start:'2023-03',end:'2023-04'}));
 const re=/ranking month 2023-01 is before the reported window of 000000418 \(2023-03\)/;
 assert.throws(()=>offsetSchedule(s,choices(),'2023-01'),re);
 assert.throws(()=>offsetSchedule(s,choices({prior:{startMonth:'2022-10',rateStbd:5}}),'2023-01'),re);
 assert.equal(offsetSchedule(s,choices(),'2023-03').status,'complete');
});
test('hold-average label notes non-contiguous months used',()=>{
 const s=setOf(pkg({id:'a',start:'2023-01',end:'2023-04',vol:{'2023-03':null}}));
 const r=offsetSchedule(s,choices({gapRates:{'2023-03':1},after:{kind:'hold-average',lastN:3}}),'2023-05');
 assert.match(r.afterLabel,/from reported months 2023-01.2023-04 \(3 months used\)$/);
 const c=setOf(pkg({id:'b',start:'2023-01',end:'2023-04'}));
 assert.doesNotMatch(offsetSchedule(c,choices({after:{kind:'hold-average',lastN:3}}),'2023-05').afterLabel,/months used/);
});
test('excluded well is not blocked by invalid choices',()=>{
 const s=setOf(pkg({id:'a',start:'2023-03',end:'2023-04'}));
 const bad=choices({connected:false,prior:{startMonth:'2023-05',rateStbd:-1},after:{kind:'hold-average',lastN:0},gapRates:{'2023-03':-5}});
 assert.equal(offsetSchedule(s,bad,'2073-01').status,'excluded');
 assert.throws(()=>offsetSchedule(s,{...bad,uic:'000000999'},'2023-04'));
});
