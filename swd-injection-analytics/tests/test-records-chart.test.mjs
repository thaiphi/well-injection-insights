import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {buildTestState,applyTestDecision,timelineMarkers} from '../dist/testRecords.js';
import {testPressureSvg} from '../dist/testRecordsChart.js';
import {diagnoseMonthly} from '../dist/h10Diagnostics.js';
import {ratioOverTimeSvg} from '../dist/h10DiagnosticsChart.js';

const PINNED_RATIO_SHA256='05d287ffbb38fa6286070516306c759964facd132513d0b44a25fdfa72c0ddce';
const artifact=JSON.parse(await readFile('data/explorer/normalized.json','utf8')),h10=diagnoseMonthly(artifact.injectionMonthly);
const sha=s=>createHash('sha256').update(s).digest('hex');
const row=(id,date,psia,depth,o={})=>({source_report_id:String(id),tracking_no:'90000417',test_sequence_no:'1.0',uic_number:'000000417',report_conducted_date:date,report_conducted_date_text:date,bhp_psia:psia,test_depth_ft:depth,quality_flags:[],...o});
const srt=(id,date,frac)=>({source_row_key:'s'+id,source_report_id:String(id),tracking_no:'90000418',uic_number:'000000417',test_date:date,test_date_text:date,satisfactory_test_code:'1',isip_psig:null,formation_frac_press_psig:frac,surface_pressure_firc_psig:null,quality_flags:[]});
const range={first:'2024-01',last:'2026-04'};
const st=buildTestState({package:{bhp:[row(7102,'2024-02-12',1705,3310),row(7103,'2024-07-22',1731,3310),row(7104,'2024-11-05',1768,3310,{tested_formation:'<b>x</b>'}),row(7101,'2022-05-16',1512,3140)],srt:[srt(7201,'2026-09-14',1610)]}},range);

test('BHP chart plots included comparable tests at their depth with the fixed label',()=>{
 const {svg}=testPressureSvg(st);
 assert.equal((svg.match(/<circle /g)??[]).length,3);assert.match(svg,/3310 ft/);
 assert.match(svg,/Source field named psia; RRC Permian guidance says PSIG; unresolved, not converted/);
 assert.match(svg,/Reference depth: 3310 ft/);assert.doesNotMatch(svg,/<script|href=/);
});
test('fewer than 2 qualifying tests shows the not-enough message',()=>{
 let s=st;for(const r of s.records.slice(0,2))s=applyTestDecision(s,r.key,false,'test');
 assert.match(testPressureSvg(s).svg,/Not enough comparable tests \(1 of 2 needed\)/);
});
test('1a ratio chart without markers is byte-identical to the accepted output',()=>{
 assert.equal(sha(ratioOverTimeSvg(h10).svg),PINNED_RATIO_SHA256);
 assert.equal(ratioOverTimeSvg(h10,[]).svg,ratioOverTimeSvg(h10).svg);
});
test('markers are drawn only inside the H-10 range, escaped, with a note',()=>{
 const markers=[...timelineMarkers(st),{kind:'srt',date:'2022-05-16',label:'out of range'},{kind:'srt',date:'2025-05-02',label:'<SRT & "x">'}];
 const {svg}=ratioOverTimeSvg(h10,markers);
 assert.equal((svg.match(/data-test-marker="bhp"/g)??[]).length,3);assert.equal((svg.match(/data-test-marker="srt"/g)??[]).length,1);
 assert.match(svg,/&lt;SRT &amp; &quot;x&quot;&gt;/);assert.doesNotMatch(svg,/out of range/);
 assert.match(svg,/Test markers \(4\): triangle BHP, diamond SRT, at the actual test date; not joined to any month\./);
});
test('hostile text in a drawn marker label is escaped on the ratio chart',()=>{
 const {svg}=ratioOverTimeSvg(h10,[{kind:'bhp',date:'2025-05-02',label:'<b>x</b>'}]);
 assert.match(svg,/&lt;b&gt;x&lt;\/b&gt;/);assert.doesNotMatch(svg,/<b>/);
});
test('the record dated after the range gets no marker',()=>{
 assert.equal(timelineMarkers(st).some(m=>m.date==='2026-09-14'),false);
 assert.equal((ratioOverTimeSvg(h10,timelineMarkers(st)).svg.match(/data-test-marker=/g)??[]).length,3);
});
