import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDisposalCase} from '../dist/disposalCase.js';
import {buildPerformanceCases} from '../dist/performanceCases.js';
import {daysInMonth} from '../dist/planning.js';
import {sealCaseInsights,verifyCaseInsights,caseInsightsJson,caseInsightsCsv} from '../dist/caseInsights.js';
import {createInsightsSession,historyTimelineSvg} from '../web/case-insights.mjs';

// Synthetic, fictional inputs only (FICTIONAL-A/B, UIC 000000417).
const row=(month,bbl,max=900)=>({source_row_key:month,parent_key:'fictional-parent',parent_join_status:'joined',uic_number:'000000417',reporting_year:Number(month.slice(0,4)),reporting_month:Number(month.slice(5,7)),period_start:month+'-01',injected_liquid_bbl:bbl,reported_avg_injection_pressure_psi:500,reported_max_injection_pressure_psi:max,calendar_days:daysInMonth(month),calculated_calendar_day_avg_bpd:bbl/daysInMonth(month)});
const well={id:'FICTIONAL-A',reservoirPsia:2000,limitPsia:3500,injectivityStbdPerPsi:5,operatingCeilingStbd:10000,availability:0.9,datum:'formation',reservoirDatum:'formation',limitDatum:'formation',reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',tvdFt:3000,measuredDepthFt:3500,innerDiameterInches:5,roughnessInches:0.0006,surfaceLimitPsia:5000};
const input=()=>({caseName:'Assumed session case',demand:{id:'synthetic-demand/1',origin:'synthetic',content:'fictional',monthly:[{month:'2028-02',demandBbl:300000},{month:'2028-03',demandBbl:300000}],evidence:{fixture:'seed-417/v1'}},wells:[well,{...well,id:'FICTIONAL-B',injectivityStbdPerPsi:2.5}],fluid:{referencePressurePsia:2000,temperatureF:180,salinityWtPercent:5},comparison:{wellId:'FICTIONAL-A',injectivityMultiplier:0.5,innerDiameterInches:4,availability:0.8}});
const N={injectivityMultiplier:1,reservoirOffsetPsi:0,availabilityMultiplier:1};
const spec={pessimistic:{...N,injectivityMultiplier:0.5},optimistic:{...N,injectivityMultiplier:2}};
const monthly=['2026-11','2026-12','2027-01','2027-03'].map(m=>row(m,30000));
const sampleLinks=()=>[{wellId:'FICTIONAL-A',label:'FICTIONAL-A',uic:'000000417',monthly}];
const realPerformance=async({caseInput,spec})=>buildPerformanceCases(caseInput,spec);

test('case result produces summary and history with no links',()=>{
 const s=createInsightsSession({getLinks:()=>[],runPerformance:realPerformance});
 s.onCaseResult(buildDisposalCase(input()));
 const snap=s.snapshot();
 assert.equal(snap.status,'ready');assert.equal(snap.error,null);
 assert.ok(snap.insights.summary.length>0);
 assert.equal(snap.insights.history.length,2);
 assert.ok(snap.insights.history.every(h=>h.status==='cannot-check'));
 assert.equal(snap.insights.performance,null);
});
test('basis confirmation rebuilds history pressure',()=>{
 const s=createInsightsSession({getLinks:sampleLinks,runPerformance:realPerformance});
 s.onCaseResult(buildDisposalCase(input()));
 const before=s.snapshot().insights.history.find(h=>h.wellId==='FICTIONAL-A');
 assert.equal(before.pressure.status,'not-checked');assert.notEqual(before.status,'cannot-check');
 assert.throws(()=>s.setBasis('FICTIONAL-A','psig',''),/reason/);
 s.setBasis('FICTIONAL-A','psig','Fictional H-10 form states psig');
 const after=s.snapshot().insights.history.find(h=>h.wellId==='FICTIONAL-A');
 assert.notEqual(after.pressure.status,'not-checked');assert.equal(after.pressure.basis,'psig');
 assert.equal(s.snapshot().insights.links[0].surfaceBasis.value,'psig');
});
test('confirmed basis is kept for the next case result',()=>{
 const s=createInsightsSession({getLinks:sampleLinks,runPerformance:realPerformance});
 s.onCaseResult(buildDisposalCase(input()));s.setBasis('FICTIONAL-A','psia','Fictional reason');
 s.onInvalidated();s.onCaseResult(buildDisposalCase(input()));
 assert.equal(s.snapshot().insights.history.find(h=>h.wellId==='FICTIONAL-A').pressure.basis,'psia');
});
test('invalidated clears insights',()=>{
 const s=createInsightsSession({getLinks:()=>[],runPerformance:realPerformance});
 s.onCaseResult(buildDisposalCase(input()));const g=s.snapshot().generation;
 s.onInvalidated();
 const snap=s.snapshot();assert.equal(snap.insights,null);assert.equal(snap.status,'idle');assert.ok(snap.generation>g);
});
test('stale performance result dropped',async()=>{
 let release;const gate=new Promise(r=>{release=r;});
 const s=createInsightsSession({getLinks:()=>[],runPerformance:async({caseInput,spec})=>{await gate;return buildPerformanceCases(caseInput,spec);}});
 s.onCaseResult(buildDisposalCase(input()));
 const pending=s.requestPerformance(spec);
 assert.equal(s.snapshot().status,'calculating');
 s.onInvalidated();s.onCaseResult(buildDisposalCase(input()));
 release();
 assert.equal(await pending,null);
 assert.equal(s.snapshot().insights.performance,null);
 assert.equal(s.snapshot().status,'ready');
});
test('performance result adds A7',async()=>{
 const s=createInsightsSession({getLinks:()=>[],runPerformance:realPerformance});
 s.onCaseResult(buildDisposalCase(input()));
 assert.ok(!s.snapshot().insights.summary.some(l=>l.rule==='A7'));
 const out=await s.requestPerformance(spec);
 assert.ok(out);const snap=s.snapshot();
 assert.equal(snap.insights.performance.cases.length,3);
 assert.ok(snap.insights.summary.some(l=>l.rule==='A7'));
 assert.deepEqual(snap.insights.performanceSpec,spec);
});
test('editing performance inputs clears results and A7',async()=>{
 const s=createInsightsSession({getLinks:()=>[],runPerformance:realPerformance});
 s.onCaseResult(buildDisposalCase(input()));await s.requestPerformance(spec);
 s.clearPerformance();
 const snap=s.snapshot();assert.equal(snap.insights.performance,null);assert.ok(!snap.insights.summary.some(l=>l.rule==='A7'));
});
test('clearPerformance during an in-flight calculation drops the late result',async()=>{
 let release;const gate=new Promise(r=>{release=r;});
 const s=createInsightsSession({getLinks:()=>[],runPerformance:async({caseInput,spec})=>{await gate;return buildPerformanceCases(caseInput,spec);}});
 s.onCaseResult(buildDisposalCase(input()));
 const pending=s.requestPerformance(spec);s.clearPerformance();release();
 assert.equal(await pending,null);
 assert.equal(s.snapshot().insights.performance,null);assert.equal(s.snapshot().status,'ready');
 assert.ok(!s.snapshot().insights.summary.some(l=>l.rule==='A7'));
});
const workerVerify=async(sealed,format)=>{const v=await verifyCaseInsights(structuredClone(sealed));return format==='json'?caseInsightsJson(v):caseInsightsCsv(v);};
test('export returns verified text with a hash-named file',async()=>{
 const s=createInsightsSession({getLinks:sampleLinks,runPerformance:realPerformance});
 s.onCaseResult(buildDisposalCase(input()));await s.requestPerformance(spec);
 const out=await s.exportInsights('csv',workerVerify);
 assert.equal(out.cancelled,false);assert.match(out.filename,/^swd-case-insights-[a-f0-9]{12}\.csv$/);assert.equal(out.mime,'text/csv;charset=utf-8');
 assert.ok(out.text.includes('"metadata","export","contentSha256"'));
 await assert.rejects(s.exportInsights('svg',workerVerify),/Unsupported/);
});
test('export is refused while a performance calculation runs',async()=>{
 let release;const gate=new Promise(r=>{release=r;});
 const s=createInsightsSession({getLinks:()=>[],runPerformance:async({caseInput,spec})=>{await gate;return buildPerformanceCases(caseInput,spec);}});
 s.onCaseResult(buildDisposalCase(input()));const pending=s.requestPerformance(spec);
 await assert.rejects(s.exportInsights('json',workerVerify),/Wait for the well-performance calculation/);
 release();await pending;
 assert.equal((await s.exportInsights('json',workerVerify)).cancelled,false);
});
test('export overtaken by a change is cancelled, not downloaded',async()=>{
 const s=createInsightsSession({getLinks:sampleLinks,runPerformance:realPerformance});
 s.onCaseResult(buildDisposalCase(input()));
 const basisDuring=await s.exportInsights('json',async(sealed,f)=>{s.setBasis('FICTIONAL-A','psig','Fictional reason');return workerVerify(sealed,f);});
 assert.deepEqual(basisDuring,{cancelled:true});
 const invalidDuring=await s.exportInsights('json',async()=>{s.onInvalidated();throw new Error('Calculation replaced by newer inputs');});
 assert.deepEqual(invalidDuring,{cancelled:true});
 await assert.rejects(s.exportInsights('json',workerVerify),/Calculate the disposal case first/);
});
test('invalid performance factors are refused before any run',async()=>{
 let calls=0;const s=createInsightsSession({getLinks:()=>[],runPerformance:async a=>{calls++;return buildPerformanceCases(a.caseInput,a.spec);}});
 s.onCaseResult(buildDisposalCase(input()));
 await assert.rejects(s.requestPerformance({...spec,pessimistic:{...N,injectivityMultiplier:0}}),/Pessimistic injectivityMultiplier/);
 assert.equal(calls,0);assert.equal(s.snapshot().insights.performance,null);
});
test('performance needs a case result',async()=>{
 const s=createInsightsSession({getLinks:()=>[],runPerformance:realPerformance});
 await assert.rejects(s.requestPerformance(spec),/Calculate the disposal case first/);
});
test('session insights seal, survive a structured clone and re-verify (the download path)',async()=>{
 const s=createInsightsSession({getLinks:sampleLinks,runPerformance:realPerformance});
 s.onCaseResult(buildDisposalCase(input()));s.setBasis('FICTIONAL-A','psig','Fictional H-10 form states psig');await s.requestPerformance(spec);
 const sealed=structuredClone(await sealCaseInsights(s.snapshot().insights));
 const verified=await verifyCaseInsights(sealed);
 assert.ok(caseInsightsJson(verified).includes(verified.contentSha256));
 assert.ok(caseInsightsCsv(verified).includes('"history","FICTIONAL-A","pressure_status"'));
});
test('history timeline: reported and forecast bars, dashed boundary, gaps left empty, every month drawn',()=>{
 const s=createInsightsSession({getLinks:sampleLinks,runPerformance:realPerformance});
 s.onCaseResult(buildDisposalCase(input()));
 const h=s.snapshot().insights.history.find(x=>x.wellId==='FICTIONAL-A');
 const svg=historyTimelineSvg(h);
 assert.match(svg,/^<svg /);assert.match(svg,/stroke-dasharray/);
 const reportedBars=(svg.match(/class="reported"/g)??[]).length,forecastBars=(svg.match(/class="forecast"/g)??[]).length;
 assert.equal(reportedBars,h.series.reported.filter(r=>!r.gap&&r.bbl!==null).length);
 assert.equal(forecastBars,h.series.forecast.length);
 assert.ok(h.series.reported.some(r=>r.gap),'fixture has a gap month');
 assert.equal((svg.match(/class="month"/g)??[]).length,17,'2026-11 through 2028-03, no decimation');
 assert.ok(!svg.includes('<script'));
});
test('index.html has the case-insights mount',async()=>{
 const html=await readFile('web/index.html','utf8');
 assert.match(html,/<\/section><section id="case-insights" class="panel" hidden aria-labelledby="case-insights-title"><\/section>/);
 assert.ok(html.indexOf('id="disposal-results"')<html.indexOf('id="case-insights"'));
 assert.ok(!html.includes('case-insights.mjs'),'no new script tag');
 const css=await readFile('web/redesign.css','utf8');
 assert.ok(css.includes('main[data-view="sensitivity"] #disposal-results,main[data-view="sensitivity"] #case-insights{display:none}'),'hidden with the results in the sensitivity view');
});
test('panel source: no rebuild on status-only changes, details kept open, confirmed basis shown, downloads off while calculating',async()=>{
 const panel=await readFile('web/case-insights.mjs','utf8');
 for(const x of ['if(ins!==rendered)','openDetails.has(key)','Confirmed: ${link.surfaceBasis.value} — ${link.surfaceBasis.reason}',"exporting||snap.status==='calculating'",'Export cancelled: results changed. Download again.','basisButtons.get(link.wellId)?.focus()'])assert.ok(panel.includes(x),x);
});
test('import-ui mounts case insights with the sample link',async()=>{
 const src=await readFile('web/import-ui.mjs','utf8');
 assert.match(src,/import \{mountCaseInsights\} from '\.\/case-insights\.mjs';/);
 assert.ok(src.includes("mountCaseInsights($('case-insights'),{getLinks:linkedWellHistories})"));
 assert.ok(src.includes("$('disposal-results').after($('case-insights'))"));
 assert.match(src,/function linkedWellHistories\(\)\{if\(source!=='sample'\|\|!sampleSession\)return \[\];/);
 assert.ok(!/export[^;]*linkedWellHistories/.test(src));
 const panel=await readFile('web/case-insights.mjs','utf8');
 assert.ok(!/from '\.\/import-ui/.test(panel),'panel must not import import-ui');assert.match(panel,/new Worker\('\/performance-worker\.mjs',\{type:'module'\}\)/);
});
test('performance worker mirrors the sweep worker',async()=>{
 const w=await readFile('web/performance-worker.mjs','utf8');
 for(const x of ["action==='calculate'","action==='verify'",'buildPerformanceCases','verifyCaseInsights','caseInsightsJson','caseInsightsCsv','self.postMessage({error'])assert.ok(w.includes(x),x);
});
