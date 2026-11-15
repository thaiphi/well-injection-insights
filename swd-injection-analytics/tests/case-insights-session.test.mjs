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
 assert.ok(src.includes("mountCaseInsights($('case-insights'),{getLinks:linkedWellHistories,getSource:()=>source})"));
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
// ---- final fix wave: panel case table (I1) and history heading (D5) ----
const panelMod=await import('../web/case-insights.mjs');
const {fmtNumber}=await import('../dist/caseSummary.js');
test('D5: history heading does not repeat the well identity',()=>{
 const {historyHeading}=panelMod;
 assert.equal(historyHeading({wellId:'UIC-000000417',label:'UIC-000000417',uic:'000000417'}),'UIC-000000417');
 assert.equal(historyHeading({wellId:'FICTIONAL-A',label:'FICTIONAL-A',uic:'000000417'}),'FICTIONAL-A · UIC 000000417');
 assert.equal(historyHeading({wellId:'FICTIONAL-A',label:'Fictional A (UIC 000000417)',uic:'000000417'}),'Fictional A (UIC 000000417)');
 assert.equal(historyHeading({wellId:'FICTIONAL-B',label:null,uic:null}),'FICTIONAL-B');
 assert.equal(historyHeading({wellId:'FICTIONAL-A',label:'Fictional A',uic:null}),'Fictional A');
 const panel=readFile('web/case-insights.mjs','utf8');
 return panel.then(src=>assert.ok(src.includes('historyHeading(h)'),'renderHistory uses historyHeading'));
});
test('I1: panel case table shows offset as % of headroom and unsupported-pressure months',()=>{
 const {performanceCaseHeaders,performanceCaseRows}=panelMod;
 const offsetSpec={pessimistic:{...N,reservoirOffsetPsi:750},optimistic:{...N,injectivityMultiplier:2}};
 const p=buildPerformanceCases(input(),offsetSpec);
 const headers=performanceCaseHeaders(),rows=performanceCaseRows(p);
 const oi=headers.indexOf('Offset (% of headroom, assumed)'),ui=headers.indexOf('Unsupported-pressure months');
 assert.ok(oi>0&&ui>0,headers.join('|'));assert.equal(rows.length,3);
 assert.equal(rows[0][oi],`FICTIONAL-A: ${fmtNumber(50,1)}%; FICTIONAL-B: ${fmtNumber(50,1)}%`);
 assert.equal(rows[1][oi],`FICTIONAL-A: ${fmtNumber(0,1)}%; FICTIONAL-B: ${fmtNumber(0,1)}%`);
 assert.equal(rows[0][ui],'None');
 const fake=structuredClone(p);fake.cases[0].offsetPercentOfHeadroom[1].percent=null;
 fake.cases[0].summary.monthly[0].unsupportedAllocations=[{wellId:'FICTIONAL-B'}];fake.cases[0].summary.monthly[1].unsupportedAllocations=[{wellId:'FICTIONAL-B'}];
 const fr=performanceCaseRows(fake)[0];
 assert.equal(fr[oi],`FICTIONAL-A: ${fmtNumber(50,1)}%; FICTIONAL-B: no headroom`);
 assert.equal(fr[ui],`FICTIONAL-B: 2 months (first ${fake.cases[0].summary.monthly[0].month})`);
});
test('I1: renderPerformance uses the shared case-table rows',async()=>{
 const src=await readFile('web/case-insights.mjs','utf8');
 assert.ok(src.includes('table(performanceCaseHeaders(),performanceCaseRows(p),'));
});
// ---- E10 (#9): session packages, links and Wells compared rows (fictional packages, UICs 000000417/000000418) ----
const {UNLINKED,J_SOURCE_ASSUMED}=await import('../dist/caseHistoryLinks.js');
const {buildCaseInsights}=await import('../dist/caseInsights.js');
const span=(a,b)=>{const out=[];let [y,m]=a.split('-').map(Number);for(;;){const s=`${y}-${String(m).padStart(2,'0')}`;out.push(s);if(s===b)return out;m++;if(m>12){m=1;y++;}}};
const pkgRow=(month,bbl,uic)=>({...row(month,bbl),source_row_key:month+uic,uic_number:uic});
const verifiedPkg=({artifactId,sha,uic='000000417',start,end,skip=[]})=>({
 artifact:{schemaVersion:1,artifactId,inventory:[{source_record_key:'inv-'+artifactId,uic_number:uic,api_no:'00000000000000'}],
  injectionMonthly:span(start,end).filter(m=>!skip.includes(m)).map(m=>pkgRow(m,30000,uic)),manifest:{scope:{uic_number:uic,start:start+'-01',end:end+'-28'}},qualityReport:{},dataDictionary:{}},
 pin:{artifactId,manifestSha256:sha},calculationEligibility:{ready:true,reasons:[]}});
const P1=verifiedPkg({artifactId:'fictional-pkg-1',sha:'a'.repeat(64),start:'2026-11',end:'2027-01',skip:['2026-12']});
const P2=verifiedPkg({artifactId:'fictional-pkg-2',sha:'b'.repeat(64),start:'2027-02',end:'2027-04'});
const P3=verifiedPkg({artifactId:'fictional-pkg-3',sha:'c'.repeat(64),uic:'000000418',start:'2026-11',end:'2027-04'});
const userSession=(extra={})=>{let src='user';const s=createInsightsSession({getLinks:()=>[],getSource:()=>src,runPerformance:realPerformance,...extra});return {s,set:v=>{src=v;}};};
test('E10: loading the same package twice is refused and leaves one package',()=>{
 const {s}=userSession();s.onCaseResult(buildDisposalCase(input()));
 const first=s.loadPackage(P1);assert.equal(first.error,undefined);
 const before=s.snapshot().insights;
 const second=s.loadPackage(P1);
 assert.match(second.error,/already loaded/);
 assert.equal(s.packages().length,1);
 assert.equal(s.snapshot().insights,before,'a refused load leaves state unchanged');
 assert.match(s.loadPackage({...P2,calculationEligibility:{ready:false,reasons:['Fictional reason']}}).error,/not calculation-ready/);
 assert.equal(s.packages().length,1);
});
test('E10: setLink then removePackage prunes the link and recomputes the row as unlinked',()=>{
 const {s}=userSession();s.onCaseResult(buildDisposalCase(input()));
 s.loadPackage(P1);s.loadPackage(P2);s.setLink('FICTIONAL-A','000000417');
 let rows=s.compared();
 assert.equal(rows.length,2);assert.equal(rows[0].uic,'000000417');assert.equal(rows[0].packages.length,2);
 assert.equal(rows[0].coverage.gap,1);assert.equal(rows[0].jSource,J_SOURCE_ASSUMED);
 assert.notEqual(s.snapshot().insights.history.find(h=>h.wellId==='FICTIONAL-A').status,'cannot-check');
 s.removePackage('fictional-pkg-1');
 assert.deepEqual(s.links(),{'FICTIONAL-A':'000000417'},'one package of the UIC is still loaded');
 assert.equal(s.compared()[0].packages.length,1);
 s.removePackage('fictional-pkg-2');
 assert.deepEqual(s.links(),{});
 rows=s.compared();
 assert.equal(rows[0].uic,null);assert.equal(rows[0].coverage,null);assert.equal(rows[0].check.status,'cannot-check');
 assert.deepEqual(s.snapshot().insights.links,[]);
});
test('E10: source switch user -> demo -> user clears links and keeps packages',()=>{
 const {s,set}=userSession();s.onCaseResult(buildDisposalCase(input()));
 s.loadPackage(P1);s.loadPackage(P3);s.setLink('FICTIONAL-A','000000417');s.setLink('FICTIONAL-B','000000418');
 set('demo');s.onInvalidated();s.onCaseResult(buildDisposalCase(input()));
 assert.deepEqual(s.links(),{});assert.equal(s.packages().length,2);
 s.setLink('FICTIONAL-B','000000417');
 set('user');s.onCaseResult(buildDisposalCase(input()));
 assert.deepEqual(s.links(),{});assert.equal(s.packages().length,2);
 assert.ok(s.compared().every(r=>r.uic===null));
});
test('E10: a new case result prunes links to wells no longer in the case',()=>{
 const {s}=userSession();s.onCaseResult(buildDisposalCase(input()));
 s.loadPackage(P1);s.loadPackage(P3);s.setLink('FICTIONAL-A','000000417');s.setLink('FICTIONAL-B','000000418');
 const one=input();one.wells=[one.wells[0]];
 s.onCaseResult(buildDisposalCase(one));
 assert.deepEqual(s.links(),{'FICTIONAL-A':'000000417'});assert.equal(s.compared().length,1);
});
test('E10: one UIC cannot be linked to two wells; linking is refused on a public source',()=>{
 const {s,set}=userSession();s.onCaseResult(buildDisposalCase(input()));s.loadPackage(P1);
 s.setLink('FICTIONAL-A','000000417');
 assert.throws(()=>s.setLink('FICTIONAL-B','000000417'),/already linked/);
 assert.deepEqual(s.links(),{'FICTIONAL-A':'000000417'});
 assert.throws(()=>s.setLink('FICTIONAL-B','000000999'),/not loaded/);
 set('public');
 assert.throws(()=>s.setLink('FICTIONAL-B',null),/user or demo case/);
});
test('E10: sample source takes links from getLinks; compared rows match the sample wells; insights unchanged',async()=>{
 const s=createInsightsSession({getLinks:sampleLinks,getSource:()=>'sample',runPerformance:realPerformance});
 const result=buildDisposalCase(input());s.onCaseResult(result);
 const rows=s.compared();
 assert.deepEqual(rows.map(r=>r.wellId),result.base.wells.map(w=>w.well.id));
 assert.equal(rows[0].uic,'000000417');assert.equal(rows[1].uic,null);
 assert.deepEqual(rows[0].packages,[],'no package provenance is invented for the sample');
 assert.deepEqual(rows[0].coverage,{startMonth:'2026-11',endMonth:'2027-03',reported:4,reportedZero:0,gap:1});
 const baseline=buildCaseInsights(result,sampleLinks().map(l=>({...l,surfaceBasis:null})),null);
 const shown=s.snapshot().insights;
 assert.deepEqual(shown,baseline);assert.ok(!('compared' in shown));
 assert.equal((await sealCaseInsights(shown)).contentSha256,(await sealCaseInsights(baseline)).contentSha256);
 assert.throws(()=>s.setLink('FICTIONAL-B','000000417'),/user or demo case/);
 assert.match(s.loadPackage(P1).error??'',/user or demo case/);
});
test('E10: public or null source feeds no links and no compared rows',()=>{
 for(const src of ['public',null]){
  const s=createInsightsSession({getLinks:sampleLinks,getSource:()=>src,runPerformance:realPerformance});
  s.onCaseResult(buildDisposalCase(input()));
  assert.deepEqual(s.snapshot().insights.links,[]);assert.equal(s.compared(),null);
 }
});
test('E10: every link or package change makes a new insights object, so an export started before it is cancelled',async()=>{
 const {s}=userSession();s.onCaseResult(buildDisposalCase(input()));s.loadPackage(P1);
 for(const change of [()=>s.setLink('FICTIONAL-A','000000417'),()=>s.setLink('FICTIONAL-A',null),()=>s.loadPackage(P3),()=>s.removePackage('fictional-pkg-3')]){
  const out=await s.exportInsights('json',async(sealed,f)=>{change();return workerVerify(sealed,f);});
  assert.deepEqual(out,{cancelled:true});
 }
 assert.equal((await s.exportInsights('json',workerVerify)).cancelled,false);
});
test('E10: a link change during a performance calculation keeps the result',async()=>{
 let release;const gate=new Promise(r=>{release=r;});
 const {s}=userSession({runPerformance:async({caseInput,spec})=>{await gate;return buildPerformanceCases(caseInput,spec);}});
 s.onCaseResult(buildDisposalCase(input()));s.loadPackage(P1);
 const pending=s.requestPerformance(spec);s.setLink('FICTIONAL-A','000000417');release();
 assert.ok(await pending);
 const snap=s.snapshot();assert.equal(snap.status,'ready');assert.ok(snap.insights.performance);
 assert.equal(s.compared()[0].uic,'000000417');
});
test('E10: user case export with two packages on one UIC, a link and a basis verifies; case inputs unchanged',async()=>{
 const {s}=userSession();const result=buildDisposalCase(input());s.onCaseResult(result);
 const unlinked=s.snapshot().insights.caseInputs;
 s.loadPackage(P1);s.loadPackage(P2);s.setLink('FICTIONAL-A','000000417');
 s.setBasis('FICTIONAL-A','psig','Fictional H-10 form states psig');
 const ins=s.snapshot().insights;
 assert.deepEqual(ins.caseInputs,unlinked);assert.deepEqual(ins.caseInputs,result.inputs);
 assert.equal(ins.links[0].surfaceBasis.value,'psig');assert.equal(ins.compared.length,2);
 assert.equal(ins.compared[1].uic,null);
 const json=await s.exportInsights('json',workerVerify);assert.equal(json.cancelled,false);
 assert.ok(json.text.includes('fictional-pkg-2'));
 const csv=await s.exportInsights('csv',workerVerify);assert.ok(csv.text.includes(`"wells-compared","FICTIONAL-B","uic","${UNLINKED}"`));
});
test('E10: a basis is kept per well and UIC; relinking to another UIC does not inherit it',()=>{
 const {s}=userSession();s.onCaseResult(buildDisposalCase(input()));s.loadPackage(P1);s.loadPackage(P3);
 assert.throws(()=>s.setBasis('FICTIONAL-A','psig','Fictional'),/No H-10 history is linked/);
 s.setLink('FICTIONAL-A','000000417');s.setBasis('FICTIONAL-A','psig','Fictional');
 s.setLink('FICTIONAL-A','000000418');
 assert.equal(s.snapshot().insights.links[0].surfaceBasis,null);
 s.setLink('FICTIONAL-A','000000417');
 assert.equal(s.snapshot().insights.links[0].surfaceBasis.value,'psig');
});
// ---- E10 fix round 1 ----
test('E10 fix 1+3: a source switch seen only through invalidation withdraws links and bases; packages kept',()=>{
 const {s,set}=userSession();s.onCaseResult(buildDisposalCase(input()));
 s.loadPackage(P1);s.setLink('FICTIONAL-A','000000417');s.setBasis('FICTIONAL-A','psig','Fictional');
 set('demo');s.onInvalidated();
 set('user');s.onCaseResult(buildDisposalCase(input()));
 assert.deepEqual(s.links(),{});assert.equal(s.packages().length,1);
 s.setLink('FICTIONAL-A','000000417');
 assert.equal(s.snapshot().insights.links[0].surfaceBasis,null,'an earlier confirmed basis is not silently restored');
 // Same-source invalidation (an input edit) keeps links and bases.
 s.setBasis('FICTIONAL-A','psia','Fictional');s.onInvalidated();s.onCaseResult(buildDisposalCase(input()));
 assert.deepEqual(s.links(),{'FICTIONAL-A':'000000417'});assert.equal(s.snapshot().insights.links[0].surfaceBasis.value,'psia');
 // Switch through onCaseResult also clears bases.
 set('demo');s.onCaseResult(buildDisposalCase(input()));set('user');s.onCaseResult(buildDisposalCase(input()));
 s.setLink('FICTIONAL-A','000000417');assert.equal(s.snapshot().insights.links[0].surfaceBasis,null);
});
test('E10 fix 2: sample J source is the sample injectivity class label; sample insights unchanged',async()=>{
 const {CLASS_LABELS}=await import('../dist/sampleCase.js');
 const withClass=()=>sampleLinks().map(l=>({...l,jClass:'synthetic'}));
 const s=createInsightsSession({getLinks:withClass,getSource:()=>'sample',runPerformance:realPerformance});
 const result=buildDisposalCase(input());s.onCaseResult(result);
 assert.equal(s.compared()[0].jSource,CLASS_LABELS.synthetic);assert.equal(CLASS_LABELS.synthetic,"Synthetic: you'd gather");
 assert.equal(s.compared()[1].jSource,J_SOURCE_ASSUMED,'no link item for the well: falls back');
 const baseline=buildCaseInsights(result,sampleLinks().map(l=>({...l,surfaceBasis:null})),null);
 assert.deepEqual(s.snapshot().insights,baseline);
 assert.equal((await sealCaseInsights(s.snapshot().insights)).contentSha256,(await sealCaseInsights(baseline)).contentSha256);
 const plain=createInsightsSession({getLinks:sampleLinks,getSource:()=>'sample',runPerformance:realPerformance});plain.onCaseResult(result);
 assert.equal(plain.compared()[0].jSource,J_SOURCE_ASSUMED,'absent class falls back');
 const src=await readFile('web/import-ui.mjs','utf8');
 assert.ok(src.includes("jClass:sampleSession.sample?.wells?.find(w=>w.id===s.wellId)?.inputs.find(i=>i.key==='injectivityStbdPerPsi')?.class??null"));
 const sample=JSON.parse(await readFile('data/sample-case/sample-case.json','utf8'));
 for(const w of sample.wells)assert.ok(CLASS_LABELS[w.inputs.find(i=>i.key==='injectivityStbdPerPsi').class],w.id);
});
test('E10 panel source: Wells compared section, loader label, table headers and row detail',async()=>{
 const src=await readFile('web/case-insights.mjs','utf8');
 for(const x of ["'Wells compared'","'Load history packages (Explorer .tar)'","['Well','Linked UIC','Coverage','Rate check','Pressure check','J source','Status']",'EVIDENCE_ONLY','gapLabel','UNLINKED','verifyExplorerPackage',"'aria-expanded'",'historyTimelineSvg(','window from reported rows (legacy package)',"'No history'"])assert.ok(src.includes(x),x);
 assert.ok(src.indexOf('summary,compareSection,historySection')>0,'Wells compared sits between the summary and the history section');
});
