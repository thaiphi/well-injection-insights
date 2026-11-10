import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const engineDir=process.env.DISPOSAL_ENGINE_DIR??'dist';
const load=f=>import(pathToFileURL(resolve(engineDir,f))).catch(()=>({}));
const ci=await load('caseInsights.js');
const {buildDisposalCase}=await load('disposalCase.js');
const {buildPerformanceCases}=await load('performanceCases.js');
const {CLOSING_LINE}=await load('caseSummary.js');
const {daysInMonth}=await load('planning.js');
const row=(month,bbl)=>({source_row_key:month,parent_key:'fictional-parent',parent_join_status:'joined',uic_number:'000000417',reporting_year:Number(month.slice(0,4)),reporting_month:Number(month.slice(5,7)),period_start:month+'-01',injected_liquid_bbl:bbl,reported_avg_injection_pressure_psi:500,reported_max_injection_pressure_psi:900,calendar_days:daysInMonth(month),calculated_calendar_day_avg_bpd:bbl/daysInMonth(month)});
const well={id:'FICTIONAL-A',reservoirPsia:2000,limitPsia:3500,injectivityStbdPerPsi:5,operatingCeilingStbd:10000,availability:0.9,datum:'formation',reservoirDatum:'formation',limitDatum:'formation',reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',tvdFt:3000,measuredDepthFt:3500,innerDiameterInches:5,roughnessInches:0.0006,surfaceLimitPsia:5000};
const input=(extra={})=>({caseName:'Assumed insights',demand:{id:'synthetic-demand/1',origin:'synthetic',content:'fictional',monthly:[{month:'2028-02',demandBbl:300000},{month:'2028-03',demandBbl:300000}],evidence:{fixture:'seed-417/v1'}},wells:[well,{...well,id:'FICTIONAL-B',injectivityStbdPerPsi:2.5}],fluid:{referencePressurePsia:2000,temperatureF:180,salinityWtPercent:5},comparison:{wellId:'FICTIONAL-A',injectivityMultiplier:0.5,innerDiameterInches:4,availability:0.8},...extra});
const N={injectivityMultiplier:1,reservoirOffsetPsi:0,availabilityMultiplier:1};
const spec={pessimistic:{...N,injectivityMultiplier:0.5},optimistic:{...N,injectivityMultiplier:2}};
const links=[{wellId:'FICTIONAL-A',label:'FICTIONAL-A',uic:'000000417',monthly:['2026-12','2027-01','2027-02'].map(m=>row(m,100000000)),surfaceBasis:null}];
const make=()=>{const r=buildDisposalCase(input());return ci.buildCaseInsights(r,links,buildPerformanceCases(input(),spec));};
test('module exists',()=>assert.equal(typeof ci.sealCaseInsights,'function'));
test('seal and verify round-trip',async()=>{
 const s=await ci.sealCaseInsights(make());
 assert.equal(s.schemaVersion,'case-insights-export/1');
 await ci.verifyCaseInsights(s);
 await ci.verifyCaseInsights(JSON.parse(ci.caseInsightsJson(s)));
});
test('tampered summary rejected',async()=>{
 const s=JSON.parse(ci.caseInsightsJson(await ci.sealCaseInsights(make())));s.summary[0].text+=' x';
 await assert.rejects(ci.verifyCaseInsights(s),/Result changed or stale/);
});
test('edited input rejected (edits invalidate exports)',async()=>{
 const s=JSON.parse(ci.caseInsightsJson(await ci.sealCaseInsights(make())));s.caseInputs.wells[0].injectivityStbdPerPsi=6;
 await assert.rejects(ci.verifyCaseInsights(s),/Result changed or stale/);
});
test('performance from other inputs rejected at build',()=>{
 const other=input({caseName:'Other'});
 assert.throws(()=>ci.buildCaseInsights(buildDisposalCase(input()),links,buildPerformanceCases(other,spec)),/Result changed or stale: performance cases were built from other inputs/);
});
test('key order does not cause false mismatch',async()=>{
 const s=await ci.sealCaseInsights(make());
 await ci.verifyCaseInsights(Object.fromEntries(Object.entries(s).reverse()));
});
test('works without performance cases',async()=>{
 const s=await ci.sealCaseInsights(ci.buildCaseInsights(buildDisposalCase(input()),[],null));
 await ci.verifyCaseInsights(s);assert.equal(s.performance,null);
});
test('JSON export carries labels',async()=>{
 const t=ci.caseInsightsJson(await ci.sealCaseInsights(make()));
 for(const x of ['"reported"','"forecast"','Assumed well-performance case',CLOSING_LINE])assert.ok(t.includes(x),x);
 assert.ok(t.endsWith('}\n'));
});
test('CSV guards formula cells and ends with CRLF',async()=>{
 const s=await ci.sealCaseInsights(make());
 const csv=ci.caseInsightsCsv(s);
 assert.ok(csv.startsWith('"section","rule_or_well","field","value"\r\n'));assert.ok(csv.endsWith('\r\n'));
 for(const sec of ['summary','history','performance','metadata'])assert.ok(csv.includes(`"${sec}",`),sec);
 const bad=structuredClone(s);bad.summary[0].text='=HYPERLINK("x")';
 assert.match(ci.caseInsightsCsv(bad),/"'=HYPERLINK\(""x""\)"/);
});
test('deterministic export',async()=>{
 const a=await ci.sealCaseInsights(make()),b=await ci.sealCaseInsights(make());
 assert.equal(a.contentSha256,b.contentSha256);assert.match(a.contentSha256,/^[a-f0-9]{64}$/);
});
test('buildCaseInsights succeeds with a linked well that has no monthly rows',()=>{
 const r=buildDisposalCase(input());
 const x=ci.buildCaseInsights(r,[{...links[0],monthly:[]}],null);
 assert.equal(x.history[0].status,'cannot-check');
});
const sealedJson=async()=>JSON.parse(ci.caseInsightsJson(await ci.sealCaseInsights(make())));
test('tampered link monthly rejected',async()=>{
 const s=await sealedJson();s.links[0].monthly[0].injected_liquid_bbl+=1;
 await assert.rejects(ci.verifyCaseInsights(s),/Result changed or stale/);
});
test('tampered link surfaceBasis rejected',async()=>{
 const s=await sealedJson();s.links[0].surfaceBasis={value:'psig',reason:'x'};
 await assert.rejects(ci.verifyCaseInsights(s),/Result changed or stale/);
});
test('tampered performanceSpec rejected',async()=>{
 const s=await sealedJson();s.performanceSpec.optimistic.injectivityMultiplier=3;
 await assert.rejects(ci.verifyCaseInsights(s),/Result changed or stale/);
});
