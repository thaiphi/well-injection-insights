import test from 'node:test';import assert from 'node:assert/strict';
import {buildTestState,applyTestDecision} from '../dist/testRecords.js';
import {sealTestRecords,verifyTestRecordsSealed,testRecordsJson,testRecordsCsv,testRecordsSvg} from '../dist/testRecordsExport.js';

const row=(id,date,psia,depth,o={})=>({source_row_key:`k${id}`,source_report_id:String(id),tracking_no:'90000417',test_sequence_no:'1.0',uic_number:'000000417',report_conducted_date:date,report_conducted_date_text:date??'',bhp_psia:psia,test_depth_ft:depth,quality_flags:[],...o});
const srt={source_row_key:'s1',source_report_id:'7201',tracking_no:'90000418',uic_number:'000000417',test_date:'2022-05-16',test_date_text:'2022-05-16',satisfactory_test_code:'1',isip_psig:null,formation_frac_press_psig:1610,surface_pressure_firc_psig:null,quality_flags:['missing:isip_psig']};
let state=buildTestState({package:{bhp:[row(7102,'2024-02-12',1705,3310),row(7103,'2024-07-22',1731,3310),row(7101,'2022-05-16',1512,3140),row(7108,'2026-11-18',1790,3310),row(7105,'2024-12-01',1700,null)],srt:[srt]}},{first:'2023-10',last:'2026-09'});
state=applyTestDecision(state,'package:bhp:2',false,'=cmd|calc');
const source={uic:'000000417',package:{artifactId:'synthetic',normalizedSha256:'a'.repeat(64),manifestSha256:'b'.repeat(64),files:{'tests.json':'c'.repeat(64)}},uploads:[]};

test('sealed JSON round-trips and detects tampering',async()=>{
 const sealed=await sealTestRecords(state,source);
 assert.equal(sealed.method,'test-records/1');assert.equal(await verifyTestRecordsSealed(JSON.parse(testRecordsJson(sealed))),true);
 assert.equal(await verifyTestRecordsSealed({...sealed,referenceDepthFt:1}),false);
 const r=sealed.records.find(x=>x.key==='package:bhp:3');
 assert.deepEqual([r.flags,r.include,r.decidedBy,r.contributes,r.rangePosition],[['depth-differs'],false,'system',false,'before']);
 assert.equal(sealed.records.find(x=>x.key==='package:bhp:1').contributes,true);
 assert.equal(sealed.readiness,'Calibrated injectivity (J): not available. A test-referenced estimate is shown in the panel below; a calibrated J needs a measured flowing bottomhole pressure at a known rate, for example from step-rate test analysis, which is out of scope.');
 assert.deepEqual(sealed.outOfRange,{before:['package:bhp:3','package:srt:1'],after:['package:bhp:4']});
});
test('re-including the off-depth test changes what contributes',async()=>{
 const s=applyTestDecision(state,'package:bhp:3',true),sealed=await sealTestRecords(s,source);
 assert.equal(sealed.records.find(x=>x.key==='package:bhp:3').contributes,true);
});
test('a re-included depthless BHP test in range contributes through its timeline marker (no chart point; see test-records.test.mjs)',async()=>{
 const s=applyTestDecision(state,'package:bhp:5',true),sealed=await sealTestRecords(s,source);
 assert.equal(sealed.records.find(x=>x.key==='package:bhp:5').contributes,true);
 assert.equal(sealed.records.find(x=>x.key==='package:bhp:4').contributes,true); // charted, after range: no marker
 assert.equal(sealed.records.find(x=>x.key==='package:bhp:5').pressures[0].value,1700);
 assert.equal((await sealTestRecords(state,source)).records.find(x=>x.key==='package:bhp:5').contributes,false);
});
test('CSV quotes every cell, writes unavailable for null and neutralizes formula-like text',async()=>{
 const csv=testRecordsCsv(await sealTestRecords(state,source));
 assert.match(csv,/^"Test records export","test-records\/1"\r\n/);assert.match(csv,/"'=cmd\|calc"/);assert.match(csv,/"unavailable"/);
 assert.match(csv,/"Notice","""unavailable"" marks/);
 assert.match(csv,/Source field named psia; RRC Permian guidance says PSIG; unresolved, not converted/);
 assert.equal(csv.split('\r\n').filter(l=>l.startsWith('"package:')).length,6);
});
test('SVG embeds the full sealed JSON as escaped metadata',async()=>{
 const sealed=await sealTestRecords(state,source),svg=testRecordsSvg(sealed,state);
 const meta=/<metadata>([\s\S]*)<\/metadata>/.exec(svg)[1].replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
 assert.deepEqual(JSON.parse(meta),sealed);
});
