import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDisposalCase} from '../dist/disposalCase.js';
import {BANNED} from '../dist/caseSummary.js';
import {buildTransientCase,FICTIONAL_EXAMPLE,FICTIONAL_EXAMPLE_LABEL,CLOSING_7,GUARD_TOO_SHORT,PVT_BLOCK} from '../dist/transientCase.js';
import {sealTransient,verifyTransient,transientJson,transientCsv} from '../dist/transientExport.js';
const panel=await import('../web/transient-buildup.mjs').catch(e=>({loadError:e}));
const {createTransientSession,limitText,skinText,profileState,buildupChartSvg,parseNumber,shapeKey,exampleLabel,NO_CASE,PANEL_TITLE,MISSING_LABEL,NO_INJECTION,EXAMPLE_PARTIAL_LABEL}=panel;

// Fictional data only (fictional wells FICTIONAL-A/B; no real well values).
const WELL={id:'FICTIONAL-A',reservoirPsia:2000,limitPsia:3500,injectivityStbdPerPsi:5,operatingCeilingStbd:10000,availability:0.9,datum:'formation',reservoirDatum:'formation',limitDatum:'formation',reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',tvdFt:3000,measuredDepthFt:3500,innerDiameterInches:5,roughnessInches:0.0006,surfaceLimitPsia:5000};
// Demand months 2028-01, 2028-02 and 2028-04: 2028-03 is not in the disposal case.
const caseInput=(over={})=>({caseName:'Fictional transient case',demand:{id:'synthetic-demand/1',origin:'synthetic',content:'fictional',monthly:[{month:'2028-01',demandBbl:60000},{month:'2028-02',demandBbl:90000},{month:'2028-04',demandBbl:30000}],evidence:{fixture:'fictional'}},
 wells:[WELL,{...WELL,id:'FICTIONAL-B',injectivityStbdPerPsi:2.5,bottomholeTemperatureF:200}],fluid:{referencePressurePsia:2000,temperatureF:180,salinityWtPercent:5},comparison:{wellId:'FICTIONAL-A',injectivityMultiplier:0.5,innerDiameterInches:5,availability:0.8},...over});
const CASE=buildDisposalCase(caseInput());
const today=()=>'2026-11-15';
/** The worker's calculate action, run in-process (same three calls as web/transient-worker.mjs). */
const realCalculate=async({caseInput,input})=>{const result=buildDisposalCase(caseInput);return sealTransient({caseInputs:caseInput,transient:buildTransientCase(result,input),interference:null,packages:[]});};
/** The worker's verify action, run in-process. */
const realVerify=async(sealed,format)=>{const s=await verifyTransient(structuredClone(sealed));return format==='json'?transientJson(s):transientCsv(s);};
const make=(extra={})=>createTransientSession({getSource:()=>'demo',runCalculate:realCalculate,today,...extra});
/** Fill a ready-to-calculate typed input: example rock, closed boundary, 6 months at 4,000 STB/day. */
function fillTyped(s){
 s.loadExample();
 s.setScheduleMonths('2028-01',6);
 for(const m of s.snapshot().draft.schedule.months)s.setRate(m.month,4000);
}

test('module loads with the panel copy',()=>{
 assert.equal(panel.loadError,undefined,String(panel.loadError));
 assert.equal(PANEL_TITLE,'Pressure buildup over time (assumed rock)');
 assert.equal(NO_CASE,'Load or calculate a disposal case to choose a well');
 assert.equal(MISSING_LABEL,'not in the disposal case: enter a rate (0 = shut in)');
 assert.equal(NO_INJECTION,'no injection yet in this month');
});

test('brief 1: no case result means not ready; calculation is refused',async()=>{
 const s=make();const snap=s.snapshot();
 assert.equal(snap.ready,false);assert.equal(snap.status,'idle');assert.equal(snap.canCalculate,false);
 assert.deepEqual(snap.wells,[]);assert.deepEqual(snap.messages,[NO_CASE]);assert.equal(snap.output,null);
 await assert.rejects(()=>s.calculate(),/Load or calculate a disposal case/);
 await assert.rejects(()=>s.exportTransient('json',realVerify),/Calculate the pressure buildup first/);
});

test('brief 2: copying the forecast with a missing month blocks calculation until that month is typed',async()=>{
 const s=make();s.onCaseResult(CASE);s.loadExample();
 assert.equal(s.copyForecast(),null);
 const snap=s.snapshot(),rows=snap.draft.schedule.months;
 assert.deepEqual(rows.map(r=>r.month),['2028-01','2028-02','2028-03','2028-04']);
 assert.equal(rows[2].rateStbd,null,'the missing month is never 0 by default');
 assert.ok(rows.filter(r=>r.month!=='2028-03').every(r=>typeof r.rateStbd==='number'));
 assert.deepEqual(snap.missingMonths,['2028-03']);
 assert.deepEqual(snap.draft.schedule.origin,{copiedFrom:'Fictional transient case',copiedAt:'2026-11-15'});
 assert.equal(snap.canCalculate,false);
 assert.ok(snap.messages.includes('Rate for 2028-03 is not entered (not in the disposal case: enter a rate (0 = shut in))'),snap.messages.join('|'));
 await assert.rejects(()=>s.calculate(),/Rate for 2028-03 is not entered/);
 assert.equal(s.snapshot().output,null);
 s.setRate('2028-03',0);
 assert.deepEqual(s.snapshot().messages,[]);assert.equal(s.snapshot().canCalculate,true);
 const out=await s.calculate();
 assert.ok(out);assert.equal(s.snapshot().status,'calculated');
 assert.equal(s.snapshot().output.labels.schedule,'forecast (copied from disposal case, 2026-11-15)');
 assert.equal(s.snapshot().output.inputs.schedule.months[2].rateStbd,0);
});

test('brief 2b: a well with no Base forecast months reports the refusal and leaves the schedule as it was',()=>{
 const s=make();s.onCaseResult(CASE);s.selectWell('FICTIONAL-B');
 const empty={...CASE,base:{...CASE.base,monthly:CASE.base.monthly.map(m=>({...m,allocations:m.allocations.filter(a=>a.wellId!=='FICTIONAL-B')}))}};
 s.onCaseResult(empty);
 assert.match(s.copyForecast(),/Well FICTIONAL-B has no Base forecast months to copy/);
 assert.deepEqual(s.snapshot().draft.schedule.months,[]);
});

test('brief 3: any input edit withdraws the result and refuses an in-flight export',async()=>{
 const s=make();s.onCaseResult(CASE);fillTyped(s);await s.calculate();
 assert.ok(s.snapshot().output);
 let release;const gate=new Promise(r=>{release=r;});
 const pending=s.exportTransient('json',async(sealed,f)=>{await gate;return realVerify(sealed,f);});
 s.setRock('k',60);
 assert.equal(s.snapshot().output,null);assert.equal(s.snapshot().status,'ready');
 release();
 assert.deepEqual(await pending,{cancelled:true});
 await assert.rejects(()=>s.exportTransient('json',realVerify),/Calculate the pressure buildup first/);
 // Every kind of edit withdraws.
 const edits=[x=>x.setRock('h',120),x=>x.setBoundaryKind('infinite'),x=>x.setBoundaryValue('statedExtentFt',5000),x=>x.setRate('2028-02',3000),x=>x.setProfileMonth(0,'2028-02'),x=>x.setSensitivity('k','low',10),x=>x.loadExample(),x=>x.selectWell('FICTIONAL-B'),x=>x.setScheduleMonths('2028-01',3)];
 for(const edit of edits){
  const t=make();t.onCaseResult(CASE);fillTyped(t);await t.calculate();assert.ok(t.snapshot().output);
  edit(t);assert.equal(t.snapshot().output,null,edit.toString());
 }
});

test('brief 3b: an edit during a calculation drops the late result',async()=>{
 let release;const gate=new Promise(r=>{release=r;});
 const s=make({runCalculate:async a=>{await gate;return realCalculate(a);}});
 s.onCaseResult(CASE);fillTyped(s);
 const pending=s.calculate();assert.equal(s.snapshot().status,'calculating');
 s.setRock('skin',3);release();
 assert.equal(await pending,null);assert.equal(s.snapshot().output,null);assert.equal(s.snapshot().status,'ready');
});

test('brief 3c: a disposal-case invalidation or new case result withdraws the result and bumps the generation',async()=>{
 const s=make();s.onCaseResult(CASE);fillTyped(s);await s.calculate();
 const g=s.snapshot().generation;
 s.onInvalidated();
 assert.equal(s.snapshot().output,null);assert.equal(s.snapshot().ready,false);assert.ok(s.snapshot().generation>g);
 assert.deepEqual(s.snapshot().messages,[NO_CASE]);
 s.onCaseResult(CASE);assert.equal(s.snapshot().output,null);
 assert.equal(s.snapshot().draft.rock.k,FICTIONAL_EXAMPLE.k,'same source: typed inputs are kept for the recalculated case');
});

test('brief 4: a source switch (getSource change or workspace-source) clears the inputs',async()=>{
 let src='demo';const s=make({getSource:()=>src});
 s.onCaseResult(CASE);fillTyped(s);await s.calculate();
 src='sample';s.onInvalidated();s.onCaseResult(CASE);
 const snap=s.snapshot();
 assert.equal(snap.draft.rock.k,null);assert.deepEqual(snap.draft.schedule.months,[]);assert.equal(snap.draft.boundary.kind,null);
 assert.equal(snap.example,null);assert.equal(snap.output,null);assert.equal(snap.draft.wellId,'FICTIONAL-A');
 // The workspace-source event path, seen without an invalidation.
 fillTyped(s);s.onSourceSwitch();
 assert.equal(s.snapshot().draft.rock.k,null);assert.deepEqual(s.snapshot().draft.schedule.months,[]);
});

test('brief 5: the snapshot is deterministic for the same inputs',async()=>{
 const run=async()=>{const s=make();s.onCaseResult(CASE);fillTyped(s);s.setProfileMonth(0,'2028-03');s.setSensitivity('k','low',25);s.setSensitivity('k','high',100);await s.calculate();return s.snapshot();};
 const a=await run(),b=await run();
 assert.deepEqual(a,b);assert.equal(JSON.stringify(a),JSON.stringify(b));
 assert.match(a.contentSha256,/^[a-f0-9]{64}$/);assert.equal(a.contentSha256,b.contentSha256);
 assert.equal(a.output.sensitivity.length,1);
});

test('the sample source: case wells are offered and the calculation runs',async()=>{
 const s=make({getSource:()=>'sample'});s.onCaseResult(CASE);
 assert.deepEqual(s.snapshot().wells,['FICTIONAL-A','FICTIONAL-B']);
 s.selectWell('FICTIONAL-B');fillTyped(s);
 const out=await s.calculate();assert.equal(out.well.id,'FICTIONAL-B');
});

test('changing the well clears a copied schedule and keeps a typed one',()=>{
 const s=make();s.onCaseResult(CASE);s.copyForecast();
 s.selectWell('FICTIONAL-B');assert.deepEqual(s.snapshot().draft.schedule.months,[]);assert.deepEqual(s.snapshot().missingMonths,[]);
 s.setScheduleMonths('2028-01',2);s.setRate('2028-01',100);
 s.selectWell('FICTIONAL-A');assert.equal(s.snapshot().draft.schedule.months[0].rateStbd,100);
 assert.throws(()=>s.selectWell('NOT-A-WELL'),/not in the disposal case/);
});

test('overwriting a copied rate makes the schedule typed; filling a missing month keeps it copied',()=>{
 const s=make();s.onCaseResult(CASE);s.copyForecast();
 s.setRate('2028-03',0);assert.equal(typeof s.snapshot().draft.schedule.origin,'object');
 const copied=s.snapshot().draft.schedule.months[0].rateStbd;
 s.setRate('2028-01',copied);assert.equal(typeof s.snapshot().draft.schedule.origin,'object','same value keeps the copy');
 s.setRate('2028-01',copied+1);assert.equal(s.snapshot().draft.schedule.origin,'typed');
 assert.deepEqual(s.snapshot().missingMonths,['2028-03'],'the missing-month label stays on its row');
});

test('empty fields stay empty: parseNumber never turns blank into 0, and r_e sensitivity is dropped for no edge',async()=>{
 assert.equal(parseNumber(''),null);assert.equal(parseNumber('  '),null);assert.equal(parseNumber('0'),0);assert.equal(parseNumber('1e-6'),1e-6);assert.ok(Number.isNaN(parseNumber('abc')));
 const s=make();s.onCaseResult(CASE);fillTyped(s);
 s.setBoundaryKind('infinite');s.setBoundaryValue('statedExtentFt',null);s.setSensitivity('re','low',2000);s.setSensitivity('re','high',4000);
 assert.deepEqual(s.snapshot().messages,[]);
 const out=await s.calculate();assert.deepEqual(out.inputs.boundary,{kind:'infinite',statedExtentFt:null});assert.equal(out.sensitivity.length,0);
 s.setRate('2028-02',null);assert.ok(s.snapshot().messages.some(m=>/Rate for 2028-02 is not entered/.test(m)));
 s.setSensitivity('k','low',10);assert.ok(s.snapshot().messages.some(m=>/Sensitivity k high/.test(m)),'half-filled pair is refused, not dropped');
});

test('export: JSON and CSV re-verified, hash-named; null never exported as 0',async()=>{
 const s=make();s.onCaseResult(CASE);fillTyped(s);await s.calculate();
 const j=await s.exportTransient('json',realVerify);
 assert.equal(j.cancelled,false);assert.match(j.filename,/^swd-transient-buildup-[a-f0-9]{12}\.json$/);assert.equal(j.mime,'application/json');
 assert.equal(JSON.parse(j.text).contentSha256,s.snapshot().contentSha256);
 const c=await s.exportTransient('csv',realVerify);assert.match(c.filename,/\.csv$/);assert.ok(c.text.includes('"transient-monthly"'));
 await assert.rejects(()=>s.exportTransient('xml',realVerify),/Unsupported/);
});

test('limit text: reached, not reached, not determined (never "not reached" when a block exists)',()=>{
 assert.equal(limitText('reached','2028-04',null),'2028-04');
 assert.equal(limitText('not-reached',null,null),'not reached within the schedule');
 assert.equal(limitText('not-determined',null,'2028-03: step too short'),'not determined: 2028-03: step too short');
 assert.ok(!/not reached/.test(limitText('not-determined',null,'x')));
});

test('skin text: only for numbers; negative skin stated plainly',()=>{
 assert.equal(skinText(null),null);assert.equal(skinText(undefined),null);
 assert.equal(skinText(85.4),'of which skin: 85 psi');
 assert.equal(skinText(-120),'of which skin: −120 psi (negative skin)');
 assert.equal(skinText(0),'of which skin: 0 psi');
});

test('profiles: months before injection read "no injection yet" for both boundaries; blocked months show the block',()=>{
 const sched={months:[{month:'2028-01',rateStbd:0},{month:'2028-02',rateStbd:4000},{month:'2028-03',rateStbd:4000}],origin:'typed'};
 const base={wellId:'FICTIONAL-A',rock:{...FICTIONAL_EXAMPLE,re:undefined},schedule:sched,profileMonths:['2028-01','2028-03'],sensitivity:{}};
 delete base.rock.re;
 const closed=buildTransientCase(CASE,{...base,boundary:{kind:'closed',re:3000}});
 const open=buildTransientCase(CASE,{...base,boundary:{kind:'infinite',statedExtentFt:null}});
 assert.equal(closed.profiles[0].points.length,25);assert.equal(open.profiles[0].points.length,0);
 for(const t of [closed,open]){
  assert.deepEqual(profileState(t,'2028-01'),{kind:'no-injection',text:NO_INJECTION});
  assert.equal(profileState(t,'2028-03').kind,'points');
 }
 // Blocked months: step too short (tiny k, large r_w, high c_f).
 const blocked=buildTransientCase(CASE,{...base,rock:{k:0.01,h:100,phi:0.4,cf:1e-4,rw:2,skin:0},boundary:{kind:'infinite',statedExtentFt:null}});
 const row=blocked.monthly.find(m=>m.month==='2028-03');
 assert.ok(row.blocked,'fixture must block');assert.equal(row.bottomholePsia,null);
 assert.deepEqual(profileState(blocked,'2028-03'),{kind:'blocked',text:row.blocked});
 assert.equal(blocked.limitStatus,'not-determined');
});

test('chart: SVG with a title and the limit line; blocked months leave gaps, every month drawn',()=>{
 const t=buildTransientCase(CASE,{wellId:'FICTIONAL-A',rock:{k:50,h:100,phi:0.15,cf:4e-6,rw:0.35,skin:2},boundary:{kind:'closed',re:3000},schedule:{months:['2028-01','2028-02','2028-03'].map(month=>({month,rateStbd:4000})),origin:'typed'},profileMonths:[],sensitivity:{}});
 const svg=buildupChartSvg(t,600);
 assert.match(svg,/^<svg[^>]*role="img"/);assert.match(svg,/<title>[^<]*FICTIONAL-A[^<]*<\/title>/);
 assert.match(svg,/class="limit"/);assert.equal((svg.match(/class="month"/g)??[]).length,3);
 const gap={...t,monthly:t.monthly.map((m,i)=>i===1?{...m,risePsi:null,skinPsi:null,bottomholePsia:null,blocked:'blocked here'}:m)};
 const g=buildupChartSvg(gap,600);assert.equal((g.match(/class="point"/g)??[]).length,2);
 assert.ok(!/NaN/.test(g));
});

test('brief 6: protected files keep their CR bytes; new files have none; mount and placement are in place',async()=>{
 const cr=s=>(s.match(/\r/g)??[]).length;
 assert.equal(cr(await readFile('web/import-ui.mjs','utf8')),4);
 assert.equal(cr(await readFile('web/index.html','utf8')),3);
 assert.equal(cr(await readFile('web/redesign.css','utf8')),0);
 for(const f of ['web/transient-buildup.mjs','web/transient-worker.mjs','tests/transient-session.test.mjs'])assert.equal(cr(await readFile(f,'utf8')),0,f);
 const html=await readFile('web/index.html','utf8');
 assert.ok(html.includes('<section id="case-insights" class="panel" hidden aria-labelledby="case-insights-title"></section><section id="transient-buildup" class="panel" hidden aria-labelledby="transient-buildup-title"></section>'));
 assert.ok(!html.includes('transient-buildup.mjs'),'no new script tag');
 const css=await readFile('web/redesign.css','utf8');
 assert.ok(css.includes('main[data-view="sensitivity"] #transient-buildup,main[data-view="sensitivity"] #disposal-results,main[data-view="sensitivity"] #case-insights{display:none}'));
 const ui=await readFile('web/import-ui.mjs','utf8');
 assert.match(ui,/import \{mountTransientBuildup\} from '\.\/transient-buildup\.mjs';/);
 assert.ok(ui.includes("$('case-insights').after($('transient-buildup'));mountTransientBuildup($('transient-buildup'),{getSource:()=>source});"));
 assert.ok(ui.indexOf("$('disposal-results').after($('case-insights'))")<ui.indexOf("$('case-insights').after($('transient-buildup'))"));
});

test('panel and worker source: worker actions, no import-ui import, fixed copy imported, no banned words',async()=>{
 const src=await readFile('web/transient-buildup.mjs','utf8'),w=await readFile('web/transient-worker.mjs','utf8');
 assert.ok(!/from '\.\/import-ui/.test(src));assert.match(src,/new Worker\('\/transient-worker\.mjs',\{type:'module'\}\)/);
 for(const x of ["action==='calculate'","action==='verify'","action==='interference'",'buildDisposalCase','buildTransientCase','sealTransient','verifyTransient','transientJson','transientCsv','interference:null','self.postMessage({error'])assert.ok(w.includes(x),x);
 assert.match(w,/from '\/dist\/transientCase\.js'/);
 for(const x of ['disposal-case-result','disposal-case-invalidated','workspace-source','table-scroll','aria-label','CLOSING_7','HANDOFF_NOTE'])assert.ok(src.includes(x),x);
 assert.ok(!src.includes(CLOSING_7),'closing line is imported, not retyped');
 assert.ok(!BANNED.test(src),'panel copy has no banned words');assert.ok(!BANNED.test(w));
 assert.ok(!/\bJ\b/.test(src),'no J wording in the panel');
});

// ---- Fix round 1 ----
test('I1: every programmatic change bumps the shape key; typing does not',()=>{
 const s=make();s.onCaseResult(CASE);
 const key=()=>shapeKey(s.snapshot());
 // Load the example twice, also when the boundary is already closed.
 s.setBoundaryKind('closed');let k=key();s.loadExample();assert.notEqual(key(),k,'loadExample over a closed boundary');
 k=key();s.loadExample();assert.notEqual(key(),k,'loadExample a second time');
 // Re-copy over the same months.
 assert.equal(s.copyForecast(),null);k=key();assert.equal(s.copyForecast(),null);assert.notEqual(key(),k,'re-copy over the same months');
 // Set up typed months over a copy with no missing months (FICTIONAL-A at 2028-01..02 only).
 const two=buildDisposalCase(caseInput({demand:{...caseInput().demand,monthly:[{month:'2028-01',demandBbl:60000},{month:'2028-02',demandBbl:90000}]}}));
 s.onCaseResult(two);assert.equal(s.copyForecast(),null);assert.deepEqual(s.snapshot().missingMonths,[]);
 k=key();s.setScheduleMonths('2028-01',2);assert.notEqual(key(),k,'typed months over a copy with the same months');
 // A workspace-source event that keeps everything else equal.
 const t=make();t.onCaseResult(CASE);k=shapeKey(t.snapshot());t.onSourceSwitch();assert.notEqual(shapeKey(t.snapshot()),k,'workspace-source');
 // Typing keeps the key.
 k=key();
 s.setRock('k',60);s.setRock('skin',-1);s.setBoundaryValue('re',4000);s.setRate('2028-01',123);s.setSensitivity('h','low',50);s.setProfileMonth(0,'2028-02');s.setScheduleSetup('count','7');s.setScheduleSetup('start','2029-01');
 assert.equal(key(),k,'typing never rebuilds the inputs');
});
test('I3: example label: all fields match, some match, none match',()=>{
 const s=make();s.onCaseResult(CASE);
 assert.equal(s.snapshot().example,null);assert.equal(exampleLabel(s.snapshot()),null);
 s.loadExample();assert.equal(s.snapshot().example,'full');assert.equal(exampleLabel(s.snapshot()),FICTIONAL_EXAMPLE_LABEL);
 s.setRock('k',60);assert.equal(s.snapshot().example,'partial');assert.equal(exampleLabel(s.snapshot()),EXAMPLE_PARTIAL_LABEL);
 assert.equal(EXAMPLE_PARTIAL_LABEL,'partly from the fictional example — not typical values');
 s.setRock('k',FICTIONAL_EXAMPLE.k);assert.equal(s.snapshot().example,'full','back to all example values');
 s.setBoundaryKind('infinite');assert.equal(s.snapshot().example,'partial','r_e no longer applies');
 for(const [key,v] of [['h',101],['phi',0.2],['cf',5e-6],['rw',0.4],['skin',1],['k',51]])s.setRock(key,v);
 assert.equal(s.snapshot().example,null);assert.equal(exampleLabel(s.snapshot()),null);
});
test('M2: a schedule derived from a copy is cleared on a well change, even after an edit made it typed',()=>{
 const s=make();s.onCaseResult(CASE);s.copyForecast();
 const r=s.snapshot().draft.schedule.months[0].rateStbd;s.setRate('2028-01',r+5);
 assert.equal(s.snapshot().draft.schedule.origin,'typed');
 s.selectWell('FICTIONAL-B');assert.deepEqual(s.snapshot().draft.schedule.months,[]);assert.deepEqual(s.snapshot().missingMonths,[]);
});
test('M3: the sensitivity "not determined" reason is built from the core block messages',()=>{
 const t=limitText('not-determined',null,null);
 assert.ok(t.startsWith('not determined: '));assert.ok(t.includes(GUARD_TOO_SHORT),t);assert.ok(t.includes(PVT_BLOCK),t);
});
test('M4: start month and month count are held by the session and survive rebuilds',()=>{
 const s=make();s.onCaseResult(CASE);
 s.setScheduleSetup('start','2029-03');s.setScheduleSetup('count','4');
 assert.deepEqual(s.snapshot().setup,{start:'2029-03',count:'4'});
 assert.equal(s.snapshot().status,'ready');
 s.copyForecast();assert.deepEqual(s.snapshot().setup,{start:'2028-01',count:'4'},'a copy shows its span');
 s.setScheduleMonths('2029-03',2);assert.deepEqual(s.snapshot().setup,{start:'2029-03',count:'2'});
 s.onSourceSwitch();assert.deepEqual(s.snapshot().setup,{start:'',count:''});
});
test('M1/M5/M6 panel source: cancel only after an accepted change, messageerror rejects, no empty average-rise table',async()=>{
 const src=await readFile('web/transient-buildup.mjs','utf8');
 assert.ok(src.includes("const refused=session.copyForecast();if(refused===null)cancel();"),'M1 copy');
 assert.ok(src.includes("try{session.setScheduleMonths(start.value,count.value);cancel();}"),'M1 setup');
 assert.ok(!src.includes('copy.onclick=()=>{cancel()')&&!src.includes('setup.onclick=()=>{cancel()'),'no cancel before the session accepts');
 assert.ok(src.includes('w.onmessageerror=()=>{finish();reject('),'M5');
 assert.ok(src.includes('if(t.averageRise?.length)'),'M6');
});

// ---- Task 7 review nits ----
test('nit (a): the example label shows only after loadExample since the last reset, not because values match',()=>{
 const s=make();s.onCaseResult(CASE);
 for(const k of ['k','h','phi','cf','rw','skin'])s.setRock(k,FICTIONAL_EXAMPLE[k]);
 s.setBoundaryKind('closed');s.setBoundaryValue('re',FICTIONAL_EXAMPLE.re);
 assert.equal(s.snapshot().example,null,'typed values equal to the example are not labelled');assert.equal(exampleLabel(s.snapshot()),null);
 s.loadExample();assert.equal(s.snapshot().example,'full');
 s.onSourceSwitch();assert.equal(s.snapshot().example,null);
 for(const k of ['k','h','phi','cf','rw','skin'])s.setRock(k,FICTIONAL_EXAMPLE[k]);
 assert.equal(s.snapshot().example,null,'a reset forgets the example');
});
test('nit (b): clearing a copied schedule on a well change also resets the set-up fields',()=>{
 const s=make();s.onCaseResult(CASE);s.copyForecast();
 assert.deepEqual(s.snapshot().setup,{start:'2028-01',count:'4'});
 s.selectWell('FICTIONAL-B');
 assert.deepEqual(s.snapshot().draft.schedule.months,[]);assert.deepEqual(s.snapshot().setup,{start:'',count:''});
});

// ---- Task 8: Nearby wells (interference screening), fictional UICs 000000418 to 000000420 ----
const {SETUP_FIRST,NEARBY_TITLE,rankingCells,totalText,limitMonthText,nearbyShapeKey,runInterferenceCore}=panel;
const ix=await import('../dist/interference.js');
const {addPackage,packageFromVerified,EMPTY_PACKAGE_SET}=await import('../dist/historyPackages.js');
const U1='000000418',U2='000000419';
const span=(a,b)=>{const out=[];let [y,m]=a.split('-').map(Number);for(;;){const s=`${y}-${String(m).padStart(2,'0')}`;out.push(s);if(s===b)return out;if(++m>12){m=1;y++;}}};
const mrow=(month,bbl,uic)=>({source_row_key:month+uic,parent_key:'fictional-parent',parent_join_status:'joined',uic_number:uic,reporting_year:Number(month.slice(0,4)),reporting_month:Number(month.slice(5,7)),period_start:month+'-01',injected_liquid_bbl:bbl,reported_avg_injection_pressure_psi:500,reported_max_injection_pressure_psi:900,calendar_days:30,calculated_calendar_day_avg_bpd:bbl===null?null:bbl/30});
/** A verified-shaped fictional package (as verifyExplorerPackage returns: artifact, pin, calculationEligibility). */
const verified=({id,uic,start,end,vol={},def=60000,interval=true,ready=true})=>({
 artifact:{schemaVersion:1,artifactId:id,inventory:[{source_record_key:'inv-'+id,uic_number:uic,api_no:'00000000000000',...(interval?{permitted_top_depth_ft:4000,permitted_bottom_depth_ft:4500}:{})}],
  injectionMonthly:span(start,end).filter(m=>vol[m]!=='missing').map(m=>mrow(m,vol[m]!==undefined?vol[m]:def,uic)),
  manifest:{scope:{uic_number:uic,start:start+'-01',end:end+'-28'}},qualityReport:{},dataDictionary:{}},
 pin:{artifactId:id,manifestSha256:'sha-'+id},calculationEligibility:{ready,reasons:ready?[]:['fictional refusal']}});
const V1=verified({id:'p418',uic:U1,start:'2027-06',end:'2027-12'});
// UIC 000000419: a reported-zero month (2027-05) and a missing month (2027-08); no interval in the package.
const V2=verified({id:'p419',uic:U2,start:'2027-01',end:'2028-02',vol:{'2027-05':0,'2027-08':'missing'},interval:false});
/** The worker's interference action, run in-process through the shared core the worker imports. */
const realInterference=async payload=>runInterferenceCore(structuredClone(payload));
const makeN=(extra={})=>make({runInterference:realInterference,...extra});
/** Subject ready, both packages loaded, every choice answered (U2 gaps filled), ranking month default. */
function nearbyReady(s){
 s.onCaseResult(CASE);fillTyped(s);
 assert.equal(s.loadPackage(V1).error,undefined);assert.equal(s.loadPackage(V2).error,undefined);
 s.setOffset(U1,'distanceFt',1500);s.setOffset(U1,'connected',true);
 s.setOffset(U2,'distanceFt',3000);s.setOffset(U2,'connected',false);s.setOffset(U2,'zerosAreShutIn',true);s.setGapRate(U2,'2027-08',1000);
}
const nb=s=>s.snapshot().nearby;

test('task 8: module exports the section copy and helpers',()=>{
 assert.equal(NEARBY_TITLE,'Nearby wells (interference screening)');
 assert.equal(SETUP_FIRST,"Set up the subject well's buildup first");
 for(const f of [rankingCells,totalText,limitMonthText,nearbyShapeKey,runInterferenceCore])assert.equal(typeof f,'function');
});

test('task 8: before the subject has inputs the section asks for the buildup set-up first',()=>{
 const s=makeN();s.onCaseResult(CASE);
 assert.deepEqual(nb(s).messages,[SETUP_FIRST]);assert.equal(nb(s).canRun,false);
 fillTyped(s);assert.ok(!nb(s).messages.includes(SETUP_FIRST));
 assert.ok(nb(s).messages.some(m=>/Load at least one offset well package/.test(m)));
});

test('task 8: packages load through the #9 path with refusals; evidence is the window and the interval as reported',()=>{
 const s=makeN();s.onCaseResult(CASE);fillTyped(s);
 assert.equal(s.loadPackage(V1).package.uic,U1);
 assert.match(s.loadPackage(V1).error,/already loaded/);
 assert.match(s.loadPackage(verified({id:'bad',uic:U2,start:'2027-01',end:'2027-02',ready:false})).error,/not calculation-ready/);
 assert.match(s.loadPackage(verified({id:'over',uic:U1,start:'2027-10',end:'2028-01'})).error,/overlaps/);
 assert.deepEqual(nb(s).packages.map(p=>p.artifactId),['p418']);
 s.loadPackage(V2);
 const [o1,o2]=nb(s).offsets;
 assert.equal(o1.uic,U1);assert.deepEqual(o1.window,{startMonth:'2027-06',endMonth:'2027-12'});
 assert.deepEqual(o1.intervals,['4,000–4,500 ft, as reported; depth basis unknown']);
 assert.deepEqual(o2.intervals,[],'no interval in the package: none shown, never 0');
 // No defaults, no automatic decision.
 assert.equal(o1.choice.connected,null);assert.equal(o1.choice.distanceFt,null);assert.equal(o1.choice.zerosAreShutIn,null);assert.equal(o1.choice.afterKind,null);
 assert.deepEqual(o2.zeroMonths,['2027-05']);assert.deepEqual(o2.gapMonths,['2027-05','2027-08'],'reported zero is a gap until answered');assert.equal(o2.unfilled,2);
 assert.equal(o1.needsZeros,false);assert.equal(o2.needsZeros,true);
 s.setOffset(U2,'zerosAreShutIn',true);assert.deepEqual(nb(s).offsets[1].gapMonths,['2027-08']);assert.equal(nb(s).offsets[1].unfilled,1);
 s.setGapRate(U2,'2027-08',0);assert.equal(nb(s).offsets[1].unfilled,0,'0 is an allowed typed gap rate');
 s.setGapRate(U2,'2027-08',null);assert.equal(nb(s).offsets[1].unfilled,1,'blank is unfilled, never 0');
});

test('task 8 brief 1: the run is refused while any offset has connected===null',async()=>{
 let called=0;const s=makeN({runInterference:async p=>{called++;return realInterference(p);}});
 nearbyReady(s);s.setOffset(U2,'connected',null);
 assert.ok(nb(s).messages.includes(`UIC ${U2}: choose connected or not connected (there is no default)`));assert.equal(nb(s).canRun,false);
 await assert.rejects(()=>s.runInterference(),/choose connected or not connected/);assert.equal(called,0);
 // The core refuses the same input on its own.
 assert.throws(()=>ix.buildInterference(CASE,[V1,V2].reduce((set,v)=>addPackage(set,packageFromVerified(v)),EMPTY_PACKAGE_SET),s.interferenceInput()),/there is no default/);
});

test('task 8: the reported-zero answer is required (no default) and a half-filled prior or after choice is refused',async()=>{
 const s=makeN();nearbyReady(s);s.setOffset(U2,'zerosAreShutIn',null);
 assert.ok(nb(s).messages.some(m=>m===`UIC ${U2}: answer whether reported zero months are treated as shut in (there is no default)`));
 await assert.rejects(()=>s.runInterference(),/reported zero months/);
 s.setOffset(U2,'zerosAreShutIn',false);assert.ok(!nb(s).messages.some(m=>/reported zero/.test(m)),'unchecked is an answer');
 s.setOffset(U1,'priorRate',500);assert.ok(nb(s).messages.some(m=>/UIC 000000418: prior rate and start month/.test(m)));
 s.setOffset(U1,'priorRate',null);s.setOffset(U1,'afterKind','hold-average');assert.ok(nb(s).messages.some(m=>/UIC 000000418: type N/.test(m)));
 s.setOffset(U1,'afterLastN',3);assert.ok(!nb(s).messages.some(m=>/UIC 000000418/.test(m)));
 const i=s.interferenceInput();assert.deepEqual(i.offsets.find(o=>o.uic===U1).after,{kind:'hold-average',lastN:3});assert.equal(i.offsets.find(o=>o.uic===U1).prior,null);
 assert.deepEqual(i.offsets.find(o=>o.uic===U2).gapRates,{'2027-08':1000});
 // Gap rates are passed only for months that are gaps now; a blank is an absent key.
 s.setGapRate(U2,'2027-05',5);assert.deepEqual(s.interferenceInput().offsets.find(o=>o.uic===U2).gapRates,{'2027-05':5,'2027-08':1000});
 s.setOffset(U2,'zerosAreShutIn',true);assert.deepEqual(s.interferenceInput().offsets.find(o=>o.uic===U2).gapRates,{'2027-08':1000},'2027-05 is no longer a gap');
 s.setGapRate(U2,'2027-08',null);assert.deepEqual(s.interferenceInput().offsets.find(o=>o.uic===U2).gapRates,{});
 assert.throws(()=>s.setGapRate(U2,'2027-03',1),/not a gap month/);
});

test('task 8: ranking month defaults to the last month covered by every package; a typed month overrides; t_ref is optional',()=>{
 const s=makeN();nearbyReady(s);
 assert.equal(nb(s).rankingMonth,'2027-12');assert.equal(nb(s).rankingTyped,false);
 s.setRankingMonth('2028-03');assert.equal(nb(s).rankingMonth,'2028-03');assert.equal(s.interferenceInput().rankingMonth,'2028-03');
 s.setRankingMonth(null);assert.equal(nb(s).rankingMonth,'2027-12');
 assert.equal(s.interferenceInput().tRef,null);s.setTRef('2027-12');assert.equal(s.interferenceInput().tRef,'2027-12');
});

test('task 8 brief 3: without t_ref no limit month and no absolute values; the rise-only label is shown',async()=>{
 const s=makeN();nearbyReady(s);
 const r=await s.runInterference();assert.ok(r);assert.equal(nb(s).status,'done');
 assert.equal(r.mode,'rise-above-undisturbed');
 for(const v of r.views){assert.equal(limitMonthText(r,v,nb(s).transient),null);assert.deepEqual(v.removalEffects,[]);assert.ok(v.monthly.every(m=>m.bottomholePsia===null));}
 assert.ok(r.labels.some(l=>/no absolute pressure, limit line or limit month/.test(l)));
 assert.equal(r.closing,ix.CLOSING_8);assert.ok(r.labels.includes(ix.RANKING_LABEL));
});

test('task 8: with t_ref the limit month is shown per view; a schedule not starting after t_ref is refused with the core message',async()=>{
 const s=makeN();nearbyReady(s);s.setOffset(U1,'afterKind','shut-in');s.setOffset(U2,'afterKind','typed');s.setOffset(U2,'afterRate',500);
 s.setTRef('2027-11');
 await assert.rejects(()=>s.runInterference(),/must start the month after the pressure-as-of month/);
 assert.match(nb(s).error,/must start the month after/);
 s.setTRef('2027-12');s.setRankingMonth('2028-03');
 const r=await s.runInterference();assert.equal(r.mode,'since-t-ref');
 for(const v of r.views){const t=limitMonthText(r,v,nb(s).transient);assert.equal(typeof t,'string');assert.ok(t.length>0);}
 const sel=r.views.find(v=>v.name==='your-selection');assert.equal(sel.removalEffects.length,1);
});

test('task 8 brief 4: an excluded row reads EXCLUDED; incomplete rows have no number; null totals read their state',async()=>{
 const s=makeN();nearbyReady(s);s.setGapRate(U2,'2027-08',null);
 const r=await s.runInterference();
 const sel=r.views.find(v=>v.name==='your-selection'),all=r.views.find(v=>v.name==='all-connected'),none=r.views.find(v=>v.name==='none');
 const ex=rankingCells(sel.rows.find(x=>x.uic===U2));
 assert.equal(ex[0],U2);assert.equal(ex[1],ix.EXCLUDED);assert.equal(ex[2],ix.EXCLUDED);assert.ok(!ex.includes('0'));
 const inc=all.rows.find(x=>x.uic===U2);assert.equal(inc.status,'incomplete');
 const ic=rankingCells(inc);assert.match(ic[1],/^incomplete: 1 gap month/);assert.equal(ic[2],'no number');assert.equal(ic[3],'—');
 assert.equal(all.totalPsi,null);assert.equal(totalText(all),'incomplete: no total while a counted offset has no number');
 assert.equal(totalText(none),'no offsets counted');
 const ok=rankingCells(sel.rows.find(x=>x.uic===U1));assert.match(ok[2],/^[−+]?[\d,]+\.\d$/);assert.match(ok[4],/1,500 ft \(assumed\)/);
 assert.match(totalText(sel),/psi \(calculated\)$/);
 for(const v of r.views)for(const row of v.rows)for(const c of rankingCells(row))assert.ok(!/NaN|undefined|null/.test(String(c)));
});

test('task 8 brief 2: removing a package withdraws its offset row inputs and the result',async()=>{
 const s=makeN();nearbyReady(s);await s.runInterference();assert.ok(nb(s).output);
 s.removePackage('p419');
 assert.equal(nb(s).output,null);assert.deepEqual(nb(s).offsets.map(o=>o.uic),[U1]);
 s.loadPackage(V2);const o2=nb(s).offsets.find(o=>o.uic===U2);
 assert.equal(o2.choice.connected,null);assert.equal(o2.choice.distanceFt,null);assert.equal(o2.choice.zerosAreShutIn,null);assert.deepEqual(o2.choice.gapRates,{});
 assert.equal(nb(s).offsets.find(o=>o.uic===U1).choice.distanceFt,1500,'the other UIC keeps its inputs');
});

test('task 8 brief 5: a source switch clears the offset choices and keeps the packages (both paths)',async()=>{
 let src='demo';const s=makeN({getSource:()=>src});nearbyReady(s);s.setTRef('2027-12');s.setRankingMonth('2028-02');
 src='sample';s.onInvalidated();s.onCaseResult(CASE);
 const n=nb(s);assert.deepEqual(n.packages.map(p=>p.artifactId),['p418','p419']);
 assert.ok(n.offsets.every(o=>o.choice.connected===null&&o.choice.distanceFt===null&&o.choice.zerosAreShutIn===null&&Object.keys(o.choice.gapRates).length===0));
 assert.equal(n.tRef,null);assert.equal(n.rankingTyped,false);assert.equal(n.output,null);
 fillTyped(s);s.setOffset(U1,'connected',true);s.setOffset(U1,'distanceFt',900);
 s.onSourceSwitch();
 assert.equal(nb(s).offsets[0].choice.connected,null);assert.equal(nb(s).offsets[0].choice.distanceFt,null);assert.equal(nb(s).packages.length,2);
});

test('task 8: invalidation: offset edits withdraw only the interference; subject edits and case events withdraw both; late runs are dropped',async()=>{
 const s=makeN();nearbyReady(s);await s.calculate();await s.runInterference();
 s.setOffset(U1,'distanceFt',1600);assert.equal(nb(s).output,null);assert.ok(s.snapshot().output,'the buildup result is kept');
 const edits=[x=>x.setOffset(U1,'connected',false),x=>x.setGapRate(U2,'2027-08',5),x=>x.setTRef('2027-12'),x=>x.setRankingMonth('2028-01'),x=>x.setNearbySensitivity('k','low',10),
  x=>x.removePackage('p418'),x=>x.loadPackage(verified({id:'p420',uic:'000000420',start:'2027-01',end:'2027-12'})),x=>x.setRock('k',60),x=>x.setRate('2028-02',3000),x=>x.onCaseResult(CASE),x=>x.onInvalidated()];
 for(const edit of edits){const t=makeN();nearbyReady(t);await t.runInterference();assert.ok(nb(t).output);edit(t);assert.equal(nb(t).output,null,edit.toString());}
 let release;const gate=new Promise(r=>{release=r;});
 const late=makeN({runInterference:async p=>{await gate;return realInterference(p);}});nearbyReady(late);
 const pending=late.runInterference();assert.equal(nb(late).status,'running');
 late.setOffset(U1,'distanceFt',1700);release();assert.equal(await pending,null);assert.equal(nb(late).output,null);
});

test('task 8: the worker core seals the interference run; it verifies and downloads re-verify the shown export',async()=>{
 const s=makeN();nearbyReady(s);
 const payload=s.interferencePayload();
 const sealed=await realInterference(payload);
 assert.ok(sealed.interference);assert.equal(sealed.packages.length,2);assert.deepEqual(sealed.transient.inputs,sealed.interference.inputs.subject);
 assert.equal((await verifyTransient(structuredClone(sealed))).contentSha256,sealed.contentSha256);
 await s.runInterference();
 const j=await s.exportInterference('json',realVerify);
 assert.match(j.filename,/^swd-interference-screening-[a-f0-9]{12}\.json$/);assert.ok(JSON.parse(j.text).interference);
 const c=await s.exportInterference('csv',realVerify);assert.match(c.filename,/\.csv$/);
 await assert.rejects(()=>makeN().exportInterference('json',realVerify),/Run the interference screening first/);
 // An edit during the verify cancels the download.
 let release;const gate=new Promise(r=>{release=r;});
 const pending=s.exportInterference('json',async(x,f)=>{await gate;return realVerify(x,f);});s.setOffset(U1,'distanceFt',1234);release();
 assert.deepEqual(await pending,{cancelled:true});
});

test('task 8: sensitivity inputs reach the core; half-filled pairs are refused; rank notes come from the result',async()=>{
 const s=makeN();nearbyReady(s);s.setOffset(U2,'connected',true);
 s.setNearbySensitivity('k','low',10);assert.ok(nb(s).messages.some(m=>/Sensitivity k high/.test(m)));
 s.setNearbySensitivity('k','high',200);s.setOffset(U1,'sensLow',1000);s.setOffset(U1,'sensHigh',2000);
 const i=s.interferenceInput();assert.deepEqual(i.sensitivity,{k:{low:10,high:200},distance:{[U1]:{low:1000,high:2000}}});
 const r=await s.runInterference();assert.equal(r.sensitivity.length,2);
});

test('task 8: nearby shape key changes on package, gap-list, after-kind or programmatic changes, never on typing',()=>{
 const s=makeN();nearbyReady(s);const key=()=>nearbyShapeKey(s.snapshot());
 let k=key();s.setOffset(U1,'distanceFt',1501);s.setGapRate(U2,'2027-08',7);s.setOffset(U1,'priorRate',4);s.setNearbySensitivity('k','low',3);s.setOffset(U1,'connected',false);s.setTRef('2027-12');s.setRankingMonth('2028-01');
 assert.equal(key(),k,'typing and radios keep the inputs');
 s.setOffset(U1,'afterKind','typed');assert.notEqual(key(),k);k=key();
 s.setOffset(U2,'zerosAreShutIn',false);assert.notEqual(key(),k,'the gap-month list changed');k=key();
 s.removePackage('p418');assert.notEqual(key(),k);k=key();
 s.onSourceSwitch();assert.notEqual(key(),k);
});

test('task 8 source: worker interference action uses the shared core; no innerHTML; imported fixed copy; no banned words',async()=>{
 const src=await readFile('web/transient-buildup.mjs','utf8'),w=await readFile('web/transient-worker.mjs','utf8');
 assert.ok(w.includes("action==='interference'")&&w.includes('runInterferenceCore'));assert.ok(!w.includes('not available yet'));
 for(const x of ['buildInterference','addPackage','EMPTY_PACKAGE_SET','verifyExplorerPackage','packageFromVerified','CLOSING_8','RANKING_LABEL','INDISTINGUISHABLE','REMOVAL_LABEL'])assert.ok(src.includes(x),x);
 assert.ok(!src.includes(ix.CLOSING_8)&&!src.includes(ix.RANKING_LABEL),'fixed lines imported, not retyped');
 assert.ok(!/innerHTML/.test(src));assert.ok(!BANNED.test(src));assert.ok(!BANNED.test(w));
 assert.ok(src.includes("'/transient-worker.mjs'"));
});

test('task 8: every counted row shows all its own labels (sources, partial history, each incomplete reason); excluded rows are not repeated',async()=>{
 const {rowLabelLines}=panel;
 const s=makeN();nearbyReady(s);s.setGapRate(U2,'2027-08',null);
 const r=await s.runInterference();
 const all=r.views.find(v=>v.name==='all-connected'),sel=r.views.find(v=>v.name==='your-selection');
 const a=rowLabelLines(all);assert.equal(a.length,2);
 const l1=a.find(x=>x.startsWith(`UIC ${U1}: `)),l2=a.find(x=>x.startsWith(`UIC ${U2}: `));
 assert.ok(l1.includes('reported, public H-10 monthly volumes'),l1);assert.ok(l1.includes('partial history'),l1);assert.ok(l1.includes('distance 1,500 ft (assumed, typed)'),l1);
 assert.ok(/incomplete: 1 gap month/.test(l2),l2);
 assert.deepEqual(rowLabelLines(sel).map(x=>x.slice(0,14)),[`UIC ${U1}: `.slice(0,14)],'the excluded row reads EXCLUDED in its table and is not repeated');
 const src=await readFile('web/transient-buildup.mjs','utf8');assert.ok(src.includes('rowLabelLines(v)'),'rendered under each view');
});

test('task 8: a real verified package (in-memory v4 helper, fictional UIC 000000417) loads, runs and verifies',async()=>{
 const {buildV4Package,SYNTHETIC_UIC}=await import('./helpers/explorer-v4.mjs');
 const {verifyExplorerPackage}=await import('../web/explorer-package.mjs');
 const s=makeN();s.onCaseResult(CASE);fillTyped(s);
 const out=s.loadPackage(await verifyExplorerPackage(await buildV4Package()));
 assert.equal(out.error,undefined);assert.equal(out.package.uic,SYNTHETIC_UIC);
 const o=nb(s).offsets[0];assert.equal(o.intervals.length,1);assert.match(o.intervals[0],/ ft, as reported; depth basis unknown$/);
 s.setOffset(SYNTHETIC_UIC,'distanceFt',2500);s.setOffset(SYNTHETIC_UIC,'connected',true);if(o.needsZeros)s.setOffset(SYNTHETIC_UIC,'zerosAreShutIn',false);
 assert.deepEqual(nb(s).messages,[]);
 const r=await s.runInterference();assert.ok(r);
 const row=r.views.find(v=>v.name==='your-selection').rows[0];
 if(o.gapMonths.length){assert.equal(row.status,'incomplete');assert.equal(row.addedPsi,null,'unfilled gaps give no number, never 0');}
 const sealed=structuredClone(s.snapshot().nearby);assert.match(sealed.contentSha256,/^[a-f0-9]{64}$/);
 const j=await s.exportInterference('json',realVerify);assert.equal(j.cancelled,false);
 const c=await s.exportInterference('csv',realVerify);
 assert.ok(c.text.includes(`"interference-your-selection","${SYNTHETIC_UIC}","status"`));assert.ok(c.text.includes('"closing","interference","closing"'));
});

// ---- Task 8 fix round 1 ----
test('fix 1: the panel export carries each package permitted interval as reported, or null',async()=>{
 const s=makeN();nearbyReady(s);
 const p=s.interferencePayload().packages;
 assert.deepEqual(p.find(x=>x.uic===U1).permittedInterval,{permitted_top_depth_ft:4000,permitted_bottom_depth_ft:4500,label:'as reported; depth basis unknown'});
 assert.equal(p.find(x=>x.uic===U2).permittedInterval,null);
 await s.runInterference();
 const j=JSON.parse((await s.exportInterference('json',realVerify)).text);
 assert.equal(j.packages.find(x=>x.uic===U1).permittedInterval.permitted_bottom_depth_ft,4500);
 const c=(await s.exportInterference('csv',realVerify)).text;
 assert.ok(c.includes(`"packages","${U1}","permitted_interval p418","top 4,000 ft; bottom 4,500 ft; as reported; depth basis unknown"`));
 assert.ok(c.includes(`"packages","${U2}","permitted_interval p419","unavailable"`));
});
test('fix M1: a refused package load does not cancel an in-flight screening run (cancel only after an accepted load)',async()=>{
 const src=await readFile('web/transient-buildup.mjs','utf8');
 assert.ok(src.includes("const out=session.loadPackage(v);if(out.error)errs.push(`${f.name}: ${out.error}`);else cancel('nearby');"),'cancel after success only');
 assert.ok(!src.includes("cancel('nearby');const out=session.loadPackage(v)"));
 // Session side: a refusal leaves a finished result in place.
 const s=makeN();nearbyReady(s);await s.runInterference();
 assert.match(s.loadPackage(V1).error,/already loaded/);assert.ok(nb(s).output,'refused load keeps the result');
});
test('fix M3: gap months to fill cover only months the core reads (through the ranking month, or the subject schedule end when later)',async()=>{
 // UIC 000000421: window 2027-01..2028-06 with gaps in 2027-03, 2028-02 and 2028-05. Subject schedule 2028-01..2028-06 (fillTyped).
 const V3=verified({id:'p421',uic:'000000421',start:'2027-01',end:'2028-06',vol:{'2027-03':'missing','2028-02':'missing','2028-05':'missing'}});
 const s=makeN();s.onCaseResult(CASE);s.loadExample();s.setScheduleMonths('2028-01',2);for(const m of ['2028-01','2028-02'])s.setRate(m,4000);
 s.loadPackage(V3);
 const o=()=>nb(s).offsets[0];
 // Default ranking month = window end 2028-06: every window gap is read.
 assert.deepEqual(o().gapMonths,['2027-03','2028-02','2028-05']);
 s.setRankingMonth('2027-12');assert.deepEqual(o().gapMonths,['2027-03','2028-02'],'through the subject schedule end (2028-02), later than the ranking month');
 assert.equal(o().unfilled,2);
 assert.throws(()=>s.setGapRate('000000421','2028-05',1),/not a gap month/);
 s.setScheduleMonths('2028-01',1);s.setRate('2028-01',4000);assert.deepEqual(o().gapMonths,['2027-03'],'through the ranking month 2027-12');
 // The panel's count matches the core: with the one remaining gap filled, the row has a number.
 s.setGapRate('000000421','2027-03',0);assert.equal(o().unfilled,0);
 const key=nearbyShapeKey(s.snapshot());s.setRankingMonth('2028-03');assert.notEqual(nearbyShapeKey(s.snapshot()),key,'a ranking month change rebuilds the gap list');
 const src=await readFile('web/transient-buildup.mjs','utf8');
 assert.ok(src.includes("rk.addEventListener('change',"),'the ranking month applies on change (not while typing)');
});
