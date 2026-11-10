import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const engineDir=process.env.DISPOSAL_ENGINE_DIR??'dist';
const {caseSummary,fmtNumber,CLOSING_LINE,BANNED}=await import(pathToFileURL(resolve(engineDir,'caseSummary.js')));
const {buildDisposalCase}=await import(pathToFileURL(resolve(engineDir,'disposalCase.js')));
const well={id:'FICTIONAL-A',reservoirPsia:2000,limitPsia:3500,injectivityStbdPerPsi:5,operatingCeilingStbd:10000,availability:0.9,datum:'formation',reservoirDatum:'formation',limitDatum:'formation',reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',tvdFt:3000,measuredDepthFt:3500,innerDiameterInches:5,roughnessInches:0.0006,surfaceLimitPsia:5000};
const build=(monthly,extra={})=>buildDisposalCase({caseName:'Assumed summary',demand:{id:'synthetic-demand/1',origin:'synthetic',content:'fictional',monthly,evidence:{fixture:'seed-417/v1'}},wells:[well,{...well,id:'FICTIONAL-B',injectivityStbdPerPsi:2.5}],fluid:{referencePressurePsia:2000,temperatureF:180,salinityWtPercent:5},comparison:{wellId:'FICTIONAL-A',injectivityMultiplier:0.5,innerDiameterInches:4,availability:0.8},...extra});
const fits=build([{month:'2028-02',demandBbl:1000}]);
const short=build([{month:'2028-02',demandBbl:10_000_000},{month:'2028-03',demandBbl:10_000_000}]);
test('A1 reports no shortfall when demand fits',()=>{
 assert.deepEqual(caseSummary(fits)[0],{rule:'A1',text:'All demand is placed in every month.',cites:[],method:fits.methods.allocation});
});
test('A1 reports first month, total and count',()=>{
 const l=caseSummary(short)[0];assert.equal(l.rule,'A1');
 assert.equal(l.text,`Unplaced water starts in 2028-02: ${fmtNumber(short.base.totalShortfallBbl)} bbl over 2 months.`);
 assert.equal(l.method,short.methods.allocation);assert.ok(l.cites.length>0);
});
test('A2 lists every well with its limiting constraints',()=>{
 const l=caseSummary(short).find(x=>x.rule==='A2');assert.equal(l.method,short.methods.capacity);
 for(const w of short.base.wells){assert.ok(l.text.includes(w.well.id));for(const c of w.capacity.limitingConstraints)assert.ok(l.text.includes(c));}
});
test('A3 reports none for a supported base case',()=>{
 const l=caseSummary(short).find(x=>x.rule==='A3');assert.equal(l.text,'No unsupported allocated pressures in the base case.');assert.equal(l.method,short.methods.surface);
});
test('A3 lists wells with unsupported allocations',()=>{
 const r=build([{month:'2028-02',demandBbl:29}],{hydraulics:{model:'segmented-brine',surfaceTemperatureF:80,segments:16},wells:[{...well,tvdFt:5000,measuredDepthFt:5500}]});
 const bad=r.base.monthly[0].allocations.find(a=>!a.operatingFeasible);assert.ok(bad,'fixture must contain an unsupported allocation');
 const l=caseSummary(r).find(x=>x.rule==='A3');
 assert.ok(l.text.startsWith('FICTIONAL-A: 1 month need a pressure the model does not support (first 2028-02: '));assert.ok(l.text.includes(bad.reason));assert.equal(l.method,r.methods.surface);
});
test('A4 picks the minimum headroom, earliest on ties',()=>{
 const r=build([{month:'2028-02',demandBbl:100},{month:'2028-03',demandBbl:100}]);
 const l=caseSummary(r).find(x=>x.rule==='A4');assert.ok(l.text.startsWith('Least spare capacity: 2028-02,'));assert.equal(l.method,null);
});
test('A5 describes the compared change',()=>{
 const l=caseSummary(short).find(x=>x.rule==='A5');assert.ok(l.text.includes('J × 0.5'));assert.ok(l.text.endsWith('bbl.'));assert.ok(l.text.includes('FICTIONAL-A'));
});
test('A8 is last and exact',()=>assert.equal(caseSummary(short).at(-1).text,CLOSING_LINE));
test('lines are in rule order',()=>assert.deepEqual(caseSummary(short).map(l=>l.rule),['A1','A2','A3','A4','A5','A8']));
test('generated lines avoid banned words',()=>{
 for(const r of [fits,short])for(const l of caseSummary(r).slice(0,-1))assert.doesNotMatch(l.text,BANNED);
});
test('deterministic',()=>assert.equal(JSON.stringify(caseSummary(short)),JSON.stringify(caseSummary(buildDisposalCase(short.inputs)))));
test('fmtNumber is locale-independent',()=>{
 assert.equal(fmtNumber(1234567.6),'1,234,568');assert.equal(fmtNumber(-1500),'−1,500');assert.equal(fmtNumber(0.456,2),'0.46');
});
const {checkWellHistory,HISTORY_CHECK_VERSION}=await import(pathToFileURL(resolve(engineDir,'wellHistoryCheck.js')));
const hrow=(month,bbl,avg=500,max=900)=>({source_row_key:month,parent_key:'p',parent_join_status:'joined',uic_number:'000000417',reporting_year:Number(month.slice(0,4)),reporting_month:Number(month.slice(5,7)),period_start:month+'-01',injected_liquid_bbl:bbl,reported_avg_injection_pressure_psi:avg,reported_max_injection_pressure_psi:max,calendar_days:30,calculated_calendar_day_avg_bpd:bbl/30});
const hlink=(bbl,avg)=>({wellId:'FICTIONAL-A',label:'A',uic:'000000417',monthly:['2027-01','2027-02'].map(m=>hrow(m,bbl,avg)),surfaceBasis:null});
test('A6 lines follow A5 and precede A8',()=>{
 const checks=checkWellHistory(short.base,[hlink(300)]);
 const lines=caseSummary(short,{history:checks});
 assert.deepEqual(lines.map(l=>l.rule),['A1','A2','A3','A4','A5','A6','A6','A8']);
 const a6=lines.filter(l=>l.rule==='A6');
 assert.equal(a6[0].method,HISTORY_CHECK_VERSION);
 assert.equal(a6[0].text,`FICTIONAL-A: ${checks[0].reason} ${checks[0].pressure.note}`);
 assert.equal(a6[1].text,`FICTIONAL-B: ${checks[1].reason}`);
});
test('A6 is absent without history',()=>{
 assert.ok(!caseSummary(short).some(l=>l.rule==='A6'));
 assert.ok(!caseSummary(short,{}).some(l=>l.rule==='A6'));
});
test('A6 lines avoid banned words',()=>{
 const sets=[checkWellHistory(short.base,[]),checkWellHistory(short.base,[hlink(300)]),checkWellHistory(short.base,[hlink(900_000_000)]),checkWellHistory(short.base,[hlink(0)]),checkWellHistory(short.base,[hlink(300,null)])];
 const statuses=new Set(sets.flat().map(c=>c.status));
 for(const s of ['within','above','cannot-check','no-injection'])assert.ok(statuses.has(s),s);
 for(const h of sets)for(const l of caseSummary(short,{history:h}).filter(x=>x.rule==='A6'))assert.doesNotMatch(l.text,BANNED);
});
