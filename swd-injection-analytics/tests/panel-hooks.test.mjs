import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {h10Available,createDiagnosticsSession} from '../web/h10-diagnostics.mjs';
import {createTestRecordsSession} from '../web/test-records.mjs';
import {J_READINESS,LIMITATIONS} from '../dist/testRecords.js';

const artifact=JSON.parse(await readFile('data/explorer/normalized.json','utf8')),ready={ready:true,reasons:[]};
test('the 1b readiness line now points to the estimate and keeps "calibrated" for the measured case only',()=>{
 assert.equal(J_READINESS,'Calibrated injectivity (J): not available. A test-referenced estimate is shown in the panel below; a calibrated J needs a measured flowing bottomhole pressure at a known rate, for example from step-rate test analysis, which is out of scope.');
 assert.ok(LIMITATIONS.includes(J_READINESS));
});
test('H-10 availability: a well with no monthly rows has no H-10 panel (the 1b gap)',()=>{
 assert.equal(h10Available({artifact}),true);
 const empty={artifact:{...artifact,injectionMonthly:[]}};assert.equal(h10Available(empty),false);assert.equal(h10Available(null),false);
 assert.throws(()=>createDiagnosticsSession(empty,ready),/No H-10 monthly rows/);// why the panel used to vanish
});
test('the Test records session works with no H-10 range',()=>{
 const s=createTestRecordsSession({selection:{artifact:{...artifact,injectionMonthly:[]}},gate:ready,range:null});assert.equal(s.state.range,null);
});
test('both panel modules accept and call onChange (source check: no DOM in Node)',async()=>{
 for(const f of ['web/h10-diagnostics.mjs','web/test-records.mjs']){const src=await readFile(f,'utf8');assert.match(src,/onChange=\(\)=>\{\}/);assert.match(src,/get state\(\)\{return session\.state;\}/);}
});
const csvOf=(cols,row)=>new TextEncoder().encode([cols.join(','),cols.map(c=>row[c]??'').join(',')].join('\r\n'));
test('final review I-2: the Test records session exposes its uploads read-only',async()=>{
 const {BHP_COLUMNS}=await import('../dist/testRecords.js');
 const s=createTestRecordsSession({selection:{artifact:{...artifact,injectionMonthly:[]}},gate:ready,range:null});assert.deepEqual(s.uploads,[]);
 const row={source_row_key:'u1',parent_key:'p',parent_join_status:'matched',uic_number:s.uic,source_report_id:'1',tracking_no:'9',test_sequence_no:'1.0',report_conducted_date:'2025-01-10',report_conducted_date_text:'2025-01-10',bhp_psia:'1768',test_depth_ft:'3310'};
 await s.upload('bhp.csv',csvOf(BHP_COLUMNS,row));
 assert.equal(s.uploads.length,1);assert.deepEqual(Object.keys(s.uploads[0]),['kind','fileName','sha256']);assert.equal(s.uploads[0].fileName,'bhp.csv');assert.match(s.uploads[0].sha256,/^[a-f0-9]{64}$/);
 s.uploads[0].fileName='changed';s.uploads.pop();assert.equal(s.uploads[0].fileName,'bhp.csv');
});
test('final review I-3 (2a): the J basis fieldset is built before the try; the assumptions form now lives in Well assumptions',async()=>{
 const src=await readFile('web/injectivity.mjs','utf8'),tryAt=src.indexOf('try{\n   const est=session.estimate');
 assert.ok(tryAt>0);assert.ok(src.indexOf("'Pressure basis of the BHP field")>0&&src.indexOf("'Pressure basis of the BHP field")<tryAt);
 assert.ok(!src.includes("'Declared assumptions (not public records)'"));
 const wa=await readFile('web/well-assumptions.mjs','utf8');assert.ok(wa.includes("'Declared assumptions (not public records)'"));assert.ok(wa.includes("'Pressure basis of H-10 and permit pressures (required before any calculation)'"));
});
function fakeDom(){
 class N{constructor(t){this.tagName=t;this.children=[];this.dataset={};this._t='';this.style={};}
  set textContent(v){this._t=String(v);this.children=[];}get textContent(){return this._t+this.children.map(c=>typeof c==='string'?c:c.textContent).join('');}
  append(...a){for(const x of a)this.children.push(x);}replaceChildren(...a){this.children=[];this.append(...a);}setAttribute(){}querySelector(){return null;}focus(){}
  get tHead(){return this.children.find(c=>c.tagName==='thead');}}
 globalThis.document={createElement:t=>new N(t)};return N;
}
function collect(n,tag,out=[]){if(typeof n==='string')return out;if(n.tagName===tag)out.push(n.textContent);for(const c of n.children)collect(c,tag,out);return out;}
test('final review I-4: with no H-10 range every included dated record is labelled with the spec string',async()=>{
 const N=fakeDom();const {mountTestRecords}=await import('../web/test-records.mjs');
 const bhp=(id,date,psi,depth)=>({source_row_key:'b'+id,uic_number:'000000417',source_report_id:String(id),tracking_no:'9',test_sequence_no:'1',report_conducted_date:date,report_conducted_date_text:date,bhp_psia:psi,test_depth_ft:depth,quality_flags:[]});
 const srt={source_row_key:'s1',uic_number:'000000417',source_report_id:'5',tracking_no:'9',test_date:'2024-03-01',test_date_text:'2024-03-01',isip_psig:1000,quality_flags:[]};
 const root=new N('div');
 const selection={artifact:{artifactId:'x',injectionMonthly:[],inventory:[{uic_number:'000000417'}]},tests:{bhp:[bhp(1,'2024-02-12',1705,3310),bhp(2,'2024-07-22',1731,3310)],srt:[srt],sha256:{}}};
 const p=mountTestRecords(root,{selection,gate:{ready:false,reasons:['x']},download(){},range:null});
 const small=collect(root,'small');assert.equal(small.filter(t=>t==='No H-10 range; no timeline markers').length,3);
 assert.ok(!small.some(t=>/contributes to no chart|before the reported|after the reported|no test-pressure chart point/.test(t)));p.dispose();
});
test('final review M-2: the panel tells the user to download the sealed JSON before opening Hydraulics',async()=>{
 const src=await readFile('web/injectivity.mjs','utf8');
 assert.ok(src.includes("Download the J estimate JSON first: opening Hydraulics clears this review, and the hand-off cites the sealed estimate's hash."));
});
test('R6-1 (source): the J panel calls onChange only on a successful act; import-ui refreshes the reconciliation from it',async()=>{
 const j=await readFile('web/injectivity.mjs','utf8');assert.match(j,/onChange=\(\)=>\{\}/);
 const act=j.slice(j.indexOf('const act='),j.indexOf('function render()'));assert.ok(act.includes('onChange()')&&act.indexOf('onChange()')>act.indexOf('render();'));
 const upd=j.slice(j.indexOf('update(inputs){if(disposed)'));assert.ok(!upd.includes('onChange'),'update() must not call onChange');
 const u=await readFile('web/import-ui.mjs','utf8'),at=u.indexOf('mountInjectivity(j,{'),cb=u.slice(u.indexOf('onChange:',at),u.indexOf('onHandoff:',at));
 assert.ok(cb.startsWith('onChange:'));assert.ok(cb.includes('reconPanel?.update('));assert.ok(!cb.includes('jPanel?.update('));
});
test('RF-1 (source): the reconciliation limit callback updates only the J panel',async()=>{
 const u=await readFile('web/import-ui.mjs','utf8'),at=u.indexOf('mountReconciliation(r,{'),cb=u.slice(u.indexOf('onLimitChange:',at));
 const end=cb.indexOf('});',0),body=cb.slice(0,end);assert.ok(body.startsWith('onLimitChange:'));assert.ok(body.includes('jPanel?.update('));assert.ok(!body.includes('reconPanel?.update('));
});
