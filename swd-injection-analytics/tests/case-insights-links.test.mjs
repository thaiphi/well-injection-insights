import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
const engineDir=process.env.DISPOSAL_ENGINE_DIR??'dist';
const load=f=>import(pathToFileURL(resolve(engineDir,f))).catch(()=>({}));
const ci=await load('caseInsights.js');
const {buildDisposalCase}=await load('disposalCase.js');
const {checkWellHistory}=await load('wellHistoryCheck.js');
const {addPackage,EMPTY_PACKAGE_SET}=await load('historyPackages.js');
const {wellsCompared,J_SOURCE_ASSUMED}=await load('caseHistoryLinks.js');
const {buildPerformanceCases}=await load('performanceCases.js');
const {daysInMonth}=await load('planning.js');
const row=(month,bbl)=>({source_row_key:month,parent_key:'fictional-parent',parent_join_status:'joined',uic_number:'000000417',reporting_year:Number(month.slice(0,4)),reporting_month:Number(month.slice(5,7)),period_start:month+'-01',injected_liquid_bbl:bbl,reported_avg_injection_pressure_psi:500,reported_max_injection_pressure_psi:900,calendar_days:daysInMonth(month),calculated_calendar_day_avg_bpd:bbl/daysInMonth(month)});
const well={id:'FICTIONAL-A',reservoirPsia:2000,limitPsia:3500,injectivityStbdPerPsi:5,operatingCeilingStbd:10000,availability:0.9,datum:'formation',reservoirDatum:'formation',limitDatum:'formation',reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',tvdFt:3000,measuredDepthFt:3500,innerDiameterInches:5,roughnessInches:0.0006,surfaceLimitPsia:5000};
const input=()=>({caseName:'Assumed insights',demand:{id:'synthetic-demand/1',origin:'synthetic',content:'fictional',monthly:[{month:'2028-02',demandBbl:300000},{month:'2028-03',demandBbl:300000}],evidence:{fixture:'seed-417/v1'}},wells:[well,{...well,id:'FICTIONAL-B',injectivityStbdPerPsi:2.5}],fluid:{referencePressurePsia:2000,temperatureF:180,salinityWtPercent:5},comparison:{wellId:'FICTIONAL-A',injectivityMultiplier:0.5,innerDiameterInches:4,availability:0.8}});
const months=['2026-12','2027-01','2027-02'];
const links=[{wellId:'FICTIONAL-A',label:'FICTIONAL-A',uic:'000000417',monthly:months.map((m,i)=>row(m,i===1?0:100000000)),surfaceBasis:null}];
const pkg=(id,sha,start,end,ms)=>({artifactId:id,manifestSha256:sha,uic:'000000417',window:{startMonth:start,endMonth:end,source:'acquisition'},monthly:ms.map(m=>row(m,m==='2027-01'?0:100000000))});
// one package covers 2026-12..2027-03 (2027-03 is a gap), a second adds 2027-05..2027-06 (2027-04 is a gap between packages)
const set=addPackage(addPackage(EMPTY_PACKAGE_SET,pkg('fictional-pkg-1','a'.repeat(64),'2026-12','2027-03',['2026-12','2027-01','2027-02'])),pkg('fictional-pkg-2','b'.repeat(64),'2027-05','2027-06',['2027-05']));
const links2=[{...links[0],monthly:[row('2026-12',100000000),row('2027-01',0),row('2027-02',100000000),row('2027-05',100000000)]}];
const make=()=>{
 const r=buildDisposalCase(input());
 const lk=Object.fromEntries(links2.map(l=>[l.wellId,l.uic]));
 const compared=wellsCompared(r,lk,set,checkWellHistory(r.base,links2),()=>J_SOURCE_ASSUMED);
 return ci.buildCaseInsights(r,links2,null,compared);
};
test('schema constant is /2',()=>assert.equal(ci.CASE_INSIGHTS_SCHEMA,'case-insights-export/2'));
test('seal and verify round-trip with two compared rows',async()=>{
 const c=make();assert.equal(c.compared.length,2);
 const s=await ci.sealCaseInsights(c);
 assert.equal(s.schemaVersion,'case-insights-export/2');
 await ci.verifyCaseInsights(s);
 await ci.verifyCaseInsights(JSON.parse(ci.caseInsightsJson(s)));
});
test('tampered gap count rejected',async()=>{
 const s=JSON.parse(ci.caseInsightsJson(await ci.sealCaseInsights(make())));s.compared[0].coverage.gap+=1;
 await assert.rejects(ci.verifyCaseInsights(s),/Result changed or stale/);
});
test('resealed wrong coverage rejected by recomputation',async()=>{
 const s=JSON.parse(ci.caseInsightsJson(await ci.sealCaseInsights(make())));
 s.compared[0].coverage.gap=0;s.compared[0].gapLabel=null;
 const {contentSha256:_,...rest}=s;
 const resealed=await ci.sealCaseInsights(Object.fromEntries(Object.entries(rest).filter(([k])=>!['schemaVersion','versions'].includes(k))));
 await assert.rejects(ci.verifyCaseInsights(resealed),/Result changed or stale/);
});
test('stored /1 fixture still verifies',async()=>{
 const f=JSON.parse(readFileSync('tests/fixtures/case-insights-v1.json','utf8'));
 assert.equal(f.schemaVersion,'case-insights-export/1');
 await ci.verifyCaseInsights(f);
});
test('/1 file carrying compared is rejected',async()=>{
 const s=JSON.parse(ci.caseInsightsJson(await ci.sealCaseInsights(make())));s.schemaVersion='case-insights-export/1';
 await assert.rejects(ci.verifyCaseInsights(s),/Result changed or stale/);
});
test('CSV carries wells-compared rows in the 4-column format',async()=>{
 const csv=ci.caseInsightsCsv(await ci.sealCaseInsights(make()));
 const lines=csv.trimEnd().split('\r\n');
 assert.equal(lines[0],'"section","rule_or_well","field","value"');
 for(const l of lines)assert.equal((l.match(/"(?:[^"]|"")*"/g)??[]).length,4,l);
 const wc=lines.filter(l=>l.startsWith('"wells-compared"'));
 assert.equal(wc.length,22);
 assert.ok(wc.includes('"wells-compared","FICTIONAL-B","uic","No H-10 package linked to this well."'));
 assert.ok(wc.includes('"wells-compared","FICTIONAL-A","package artifactIds","fictional-pkg-1;fictional-pkg-2"'));
 assert.deepEqual(wc.slice(0,11).map(l=>l.split('","')[2]),['well','wellId','uic','window start','window end','reported months','reported-zero months','gap months','status','J source','package artifactIds']);
});
test('row outside its own package window but inside the span seals and verifies',async()=>{
 const r=buildDisposalCase(input());
 const s2=addPackage(addPackage(EMPTY_PACKAGE_SET,pkg('fictional-pkg-1','a'.repeat(64),'2026-12','2027-01',['2026-12','2027-01','2027-03'])),pkg('fictional-pkg-2','b'.repeat(64),'2027-05','2027-06',['2027-05']));
 const lk=[{...links[0],monthly:[row('2026-12',100000000),row('2027-01',0),row('2027-03',100000000),row('2027-05',100000000)]}];
 const compared=wellsCompared(r,{'FICTIONAL-A':'000000417'},s2,checkWellHistory(r.base,lk),()=>J_SOURCE_ASSUMED);
 assert.equal(compared[0].coverage.gap,3);
 await ci.verifyCaseInsights(await ci.sealCaseInsights(ci.buildCaseInsights(r,lk,null,compared)));
});
test('without compared the output is the old shape plus /2',async()=>{
 const r=buildDisposalCase(input());
 const a=ci.buildCaseInsights(r,links,null);
 assert.ok(!('compared' in a)||a.compared===null);
 const s=await ci.sealCaseInsights(a);
 assert.equal(s.schemaVersion,'case-insights-export/2');
 const f=JSON.parse(readFileSync('tests/fixtures/case-insights-v1.json','utf8'));
 const r2=buildDisposalCase(f.caseInputs);
 const s3=await ci.sealCaseInsights(ci.buildCaseInsights(r2,f.links,f.performanceSpec?buildPerformanceCases(f.caseInputs,f.performanceSpec):null));
 const strip=({schemaVersion:_a,contentSha256:_b,...x})=>x;
 assert.equal(s3.schemaVersion,'case-insights-export/2');
 assert.deepEqual(strip(JSON.parse(JSON.stringify(s3))),strip(f));
 assert.ok(!('compared' in s3));
 await ci.verifyCaseInsights(s);
 assert.ok(!ci.caseInsightsCsv(s).includes('wells-compared'));
});
