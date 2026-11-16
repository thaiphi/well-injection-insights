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
