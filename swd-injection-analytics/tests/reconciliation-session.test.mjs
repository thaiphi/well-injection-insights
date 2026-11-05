import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createReconciliationSession} from '../web/reconciliation.mjs';
import {verifyReconciliationSealed} from '../dist/pressureReconciliationExport.js';
import {createEstimateState,confirmBasis,setSurfaceBasis,estimate} from '../dist/injectivityEstimate.js';
import {DEFAULT_WELL_ASSUMPTIONS} from '../dist/wellAssumptions.js';
import {applyDecision} from '../dist/h10Diagnostics.js';
import {fixtureInputs,bhpRow} from './helpers/injectivity-fixture.mjs';

const ready={ready:true,reasons:[]},blocked={ready:false,reasons:['Inspection only: test.']};
const WELL={...DEFAULT_WELL_ASSUMPTIONS,surfaceBasis:{value:'psig',reason:'RRC H-10 reports gauge pressure'}};
const selection={artifact:{artifactId:'synthetic',inventory:[{uic_number:'000000417',permit_liquid_pressure_limit_psi:1176,permit_liquid_volume_limit_bpd:30000,permitted_top_depth_ft:3000}],injectionMonthly:[{uic_number:'000000417'}]},pin:null,tests:{sha256:{'tests.json':'ab'}}};
const jFor=inputs=>estimate(confirmBasis(setSurfaceBasis(createEstimateState(inputs),WELL.surfaceBasis),'psig','RRC'));
const make=(gate=ready,inputs=fixtureInputs(),well=WELL)=>createReconciliationSession({selection,gate,...inputs,well,j:jFor(inputs)});

test('waits for the surface basis: no rows, downloads refused with the reason',async()=>{
 const s=make(ready,fixtureInputs(),DEFAULT_WELL_ASSUMPTIONS);assert.deepEqual(s.result.rows,[]);assert.match(s.result.readiness,/Confirm the H-10 and permit pressure basis/);
 await assert.rejects(s.exportRequest('json'),/Downloads need the confirmed H-10 and permit pressure basis/);
});
test('permit and report depth come from the package; result is memoised per revision',()=>{
 const s=make();assert.equal(s.result.permit.surfacePsi,1176);assert.deepEqual(s.reportDepth,{depthFt:3310,source:'BHP test depth'});
 s.result;s.result;assert.equal(s.computations,1);s.update(fixtureInputs());s.result;assert.equal(s.computations,2);
});
test('update recomputes after a 1a change and a basis change; keeps well and j when omitted',()=>{
 const s=make(),next=fixtureInputs();next.h10=applyDecision(next.h10,'2024-02',false,'operator note');const r=s.revision;
 s.update(next);assert.equal(s.revision,r+1);assert.equal(s.result.rows.find(x=>x.month==='2024-02').status,'excluded');assert.deepEqual(s.result.surfaceBasis,WELL.surfaceBasis);
 s.update({...fixtureInputs(),well:{...WELL,surfaceBasis:{value:'psia',reason:'absolute'}}});assert.equal(s.result.rows.find(x=>x.month==='2024-02').surfacePsia,900);
 s.update({...fixtureInputs(),j:null});assert.equal(s.result.counts.testMonths,0);
});
test('declared limit: validated, bumps the revision, clears with null',()=>{
 const s=make(),r=s.revision;assert.throws(()=>s.setLimit({psia:'50',depthFt:'3310',reason:'x'}),/Bottomhole limit/);assert.equal(s.revision,r);
 s.setLimit({psia:'4000',depthFt:'3310',reason:'design'});assert.deepEqual(s.declaredLimit,{psia:4000,depthFt:3310,reason:'design'});assert.equal(s.revision,r+1);
 assert.notEqual(s.result.summary.minDeclaredPsi,null);s.setLimit(null);assert.equal(s.declaredLimit,null);
});
test('export: sealed JSON verifies, records the sources; a stale export resolves null',async()=>{
 const s=make();const r=await s.exportRequest('json');assert.match(r.filename,/^pressure-reconciliation-000000417-[a-f0-9]{12}\.json$/);
 const j=JSON.parse(r.text);assert.equal(await verifyReconciliationSealed(j),true);assert.equal(j.source.tests.inclusions['package:bhp:3'],false);assert.equal(j.source.jMatches['package:bhp:1'],'2024-02');
 assert.equal(j.source.h10Decisions['2024-05'].include,false);
 const p=s.exportRequest('csv');s.setLimit({psia:4000,depthFt:3310,reason:'x'});assert.equal(await p,null);
 const d=s.exportRequest('svg');s.dispose();assert.equal(await d,null);
});
test('gate not ready blocks exports; unknown format refused; upload provenance required',async()=>{
 await assert.rejects(make(blocked).exportRequest('json'),/Exports blocked: Inspection only/);await assert.rejects(make().exportRequest('pdf'),/Unsupported export format: pdf/);
 const inputs=fixtureInputs(),base=inputs.tests,rec={...base.records[0],key:'upload:bhp:1',origin:'upload'};
 const s=make(ready,{...inputs,tests:{...base,records:[...base.records,rec],decisions:{...base.decisions,'upload:bhp:1':{include:true,reason:null,byUser:false}}}});
 await assert.rejects(s.exportRequest('json'),/Sealing refused: uploaded test records/);
});
function fakeDom(){
 class N{constructor(t){this.tagName=t;this.children=[];this.dataset={};this._t='';this.style={};}
  set textContent(v){this._t=String(v);this.children=[];}get textContent(){return this._t+this.children.map(c=>typeof c==='string'?c:c.textContent).join('');}
  append(...a){for(const x of a)this.children.push(x);}replaceChildren(...a){this.children=[];this.append(...a);}setAttribute(){}querySelector(){return null;}focus(){}
  get childNodes(){return [...this.children];}get tHead(){return this.children.find(c=>c.tagName==='thead');}}
 globalThis.document={createElement:t=>new N(t),createTextNode:t=>t};return N;
}
test('panel: a failing computation keeps the limit form; waiting text without a basis; screening text present',async()=>{
 const N=fakeDom();const {mountReconciliation}=await import('../web/reconciliation.mjs');
 const inputs=fixtureInputs(),root=new N('div');
 const bad={get tests(){throw new Error('J panel failed');},basis:null};
 const p=mountReconciliation(root,{selection,gate:blocked,download(){},...inputs,well:WELL,j:bad});
 const text=root.textContent;assert.match(text,/Declared bottomhole limit/);assert.match(text,/could not render/);p.dispose();
 const q=mountReconciliation(root,{selection,gate:blocked,download(){},...inputs,well:DEFAULT_WELL_ASSUMPTIONS,j:null});
 assert.match(root.textContent,/Confirm the H-10 and permit pressure basis in Well assumptions\./);assert.match(root.textContent,/Screening only: not a regulatory approval/);q.dispose();
});
test('panel: every test matched to a month is rendered, with its negative flag and checklist',async()=>{
 const N=fakeDom();const {mountReconciliation}=await import('../web/reconciliation.mjs');
 const inputs=fixtureInputs({bhp:[bhpRow(1,'2024-02-12',1705,3310),bhpRow(2,'2024-02-20',3000,3310)]}),root=new N('div');
 const p=mountReconciliation(root,{selection,gate:blocked,download(){},...inputs,well:WELL,j:jFor(inputs)});
 const text=root.textContent;assert.match(text,/2024-02-12/);assert.match(text,/2024-02-20/);
 assert.ok(text.includes('model below measured static pressure: assumptions or test reading inconsistent'));assert.ok(text.includes('Shut-in days included in the monthly average pressure.'));p.dispose();
});
test('wiring: import-ui mounts the five panels in order, refreshes J before the reconciliation and disposes all five',async()=>{
 const src=await readFile('web/import-ui.mjs','utf8');
 const at=id=>src.indexOf(`.id='${id}'`);for(const [a,b] of [['test-records','well-assumptions'],['well-assumptions','injectivity-estimate'],['injectivity-estimate','pressure-reconciliation']])assert.ok(at(a)>0&&at(a)<at(b),`${a} before ${b}`);
 const fn=src.slice(src.indexOf('function clearResults()'),src.indexOf('\n',src.indexOf('function clearResults()')));
 for(const p of ['reconPanel?.dispose()','jPanel?.dispose()','wellPanel?.dispose()','testsPanel?.dispose()','h10Panel?.dispose()'])assert.ok(fn.includes(p),p);
 assert.ok(src.indexOf('jPanel?.update(')<src.indexOf('reconPanel?.update('),'J refreshes before the reconciliation');
});
test('R6-1: confirming the J basis calls onChange once on success only; update() and a refused confirm do not',async()=>{
 const N=fakeDom();N.prototype.addEventListener=function(){};const {mountInjectivity}=await import('../web/injectivity.mjs');
 const inputs=fixtureInputs(),root=new N('div');let calls=0;
 const p=mountInjectivity(root,{selection,gate:blocked,download(){},...inputs,well:WELL,declaredLimit:null,onChange:()=>{calls++;}});
 const walk=(n,out=[])=>{if(n&&typeof n==='object'){out.push(n);for(const c of n.children)walk(c,out);}return out;};
 const find=pred=>walk(root).find(pred);
 const btn=()=>find(n=>n.tagName==='button'&&n.textContent==='Confirm basis');
 assert.ok(btn(),'confirm button rendered');
 btn().onclick();assert.equal(calls,0,'empty reason is refused: no onChange');
 find(n=>n.tagName==='input'&&n.dataset.focusKey==='basis:reason').value='RRC';
 find(n=>n.tagName==='input'&&n.dataset.focusKey==='basis:psig').checked=true;
 find(n=>n.tagName==='input'&&n.dataset.focusKey==='basis:psia').checked=false;
 btn()?.onclick?.();
 const again=find(n=>n.tagName==='button'&&n.textContent==='Change basis');
 assert.ok(again,'basis confirmed');assert.equal(calls,1);
 p.update(fixtureInputs());assert.equal(calls,1,'update() never calls onChange');p.dispose();
});
test('RF-1: with no basis the panel shows the prompt once and no counts, readiness or margins',async()=>{
 const N=fakeDom();const {mountReconciliation}=await import('../web/reconciliation.mjs');
 const inputs=fixtureInputs(),root=new N('div');
 const q=mountReconciliation(root,{selection,gate:blocked,download(){},...inputs,well:DEFAULT_WELL_ASSUMPTIONS,j:null});
 const text=root.textContent;assert.ok(!/Months in range:/.test(text));assert.ok(!/Regulatory margin/.test(text));
 assert.equal(text.split('Confirm the H-10 and permit pressure basis in Well assumptions.').length-1,1);assert.match(text,/Screening only/);assert.match(text,/Declared bottomhole limit/);q.dispose();
});
