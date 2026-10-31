import test from 'node:test';import assert from 'node:assert/strict';
import {parseCsv} from '../dist/importProfile.js';
import {BHP_COLUMNS,SRT_COLUMNS,rowsFromTable,referenceDepth,buildTestState,applyTestDecision,bhpSeries,outOfRange,timelineMarkers,testCoverage,FLAG_REASONS} from '../dist/testRecords.js';

const UIC='000000417',range={first:'2023-10',last:'2026-09'};
const bhp=(id,date,psia,depth,o={})=>({source_row_key:`rrc:bhp:qxfy-wcfs:aaaa:${id}`,parent_key:'p',parent_join_status:'matched',uic_number:UIC,source_report_id:String(id),tracking_no:'90000417',test_sequence_no:'1.0',
 report_conducted_date:date,report_conducted_date_text:date??'',report_received_date:null,report_received_date_text:'',bhp_psia:psia,test_depth_ft:depth,gradient_psi_ft:0.7,tested_formation:'SYNTHETIC',source_snapshot_id:'qxfy-wcfs:aaaa',quality_flags:[],...o});
const srt=(id,date,frac,o={})=>({source_row_key:`rrc:srt:h54t-xnbi:bbbb:${id}`,parent_key:'p',parent_join_status:'matched',uic_number:UIC,source_report_id:String(id),tracking_no:'90000418',srt_received_date:null,srt_received_date_text:'',
 test_date:date,test_date_text:date??'',satisfactory_test_code:'1',top_perf_ft:3305,bottom_perf_ft:5120,formation_tested:'SYNTHETIC',min_inj_rate_bpm:0,max_inj_rate_bpm:24.10,isip_psig:null,formation_frac_press_psig:frac,
 frac_inj_rate_capacity_bpd:null,surface_pressure_firc_psig:null,fracture_gradient_psi_ft:0.710,comments:'',source_snapshot_id:'h54t-xnbi:bbbb',quality_flags:['missing:isip_psig'],...o});
const pkg={bhp:[
 bhp(7101,'2022-05-16',1512,3140),          // B1 off-depth, before range
 bhp(7102,'2024-02-12',1705,3310),          // B2
 bhp(7103,'2024-07-22',1731,3310),          // B3
 bhp(7104,'2024-11-05',1768,3314),          // B4 within 10 ft
 bhp(7105,'2024-12-01',1700,null),          // B5 no depth
 bhp(7106,'2025-02-01',null,3310),          // B6 no pressure
 bhp(7107,null,1710,3310,{report_conducted_date_text:'2024-13-40',quality_flags:['parse_failure:report_conducted_date']}), // B7
 bhp(7108,'2026-11-18',1790,3310)           // B8 after range
],srt:[srt(7201,'2022-05-16',1610),srt(7202,'2025-01-15',null,{quality_flags:[]})]};
const state=()=>buildTestState({package:pkg},range);
const byId=(s,id)=>s.records.find(r=>r.values.source_report_id===String(id));

test('flags follow the spec rules exactly',()=>{
 const s=state(),f=id=>byId(s,id).flags;
 assert.deepEqual(f(7101),['depth-differs']);assert.deepEqual(f(7102),[]);assert.deepEqual(f(7103),[]);assert.deepEqual(f(7104),[]);
 assert.deepEqual(f(7105),['no-depth']);assert.deepEqual(f(7106),['no-pressure']);assert.deepEqual(f(7107),['no-date','source-quarantined']);assert.deepEqual(f(7108),[]);
 assert.deepEqual(f(7201),[]);assert.deepEqual(f(7202),['no-pressure']);
 assert.equal(s.referenceDepthFt,3310);assert.equal(s.referenceTie,false);
 assert.match(byId(s,7101).reasons[0],/reference 3310 ft/);assert.match(byId(s,7107).reasons[1],/parse_failure:report_conducted_date/);
 assert.deepEqual(byId(s,7201).notes,['missing:isip_psig']);
});
test('no-pressure reason names the quantity: bottomhole for BHP, test pressure for SRT',()=>{
 const s=state();
 assert.equal(byId(s,7106).reasons[0],'No bottomhole pressure reported.');
 assert.equal(byId(s,7202).reasons[0],'No test pressure reported.');
});
test('flagged records start excluded and unflagged records start included',()=>{
 const s=state();
 for(const r of s.records)assert.equal(s.decisions[r.key].include,r.flags.length===0);
 assert.equal(Object.values(s.decisions).every(d=>d.byUser===false&&d.reason===null),true);
});
test('BHP chart series uses included tests with pressure, date and depth only',()=>{
 const s=state(),sr=bhpSeries(s);
 assert.deepEqual(sr.points.map(p=>p.psia),[1705,1731,1768,1790]);assert.equal(sr.enough,true);assert.equal(sr.needed,2);
});
test('re-including the off-depth test adds it to the series; an unusable test never contributes',()=>{
 let s=state();s=applyTestDecision(s,byId(s,7101).key,true);
 assert.deepEqual(bhpSeries(s).points.map(p=>p.depthFt),[3140,3310,3310,3314,3310]);
 s=applyTestDecision(s,byId(s,7105).key,true);assert.equal(bhpSeries(s).points.length,5);
});
test('excluding an unflagged test needs a reason; fewer than 2 qualifying tests is not enough',()=>{
 let s=state();
 assert.throws(()=>applyTestDecision(s,byId(s,7102).key,false,'  '),/reason/i);
 s=applyTestDecision(s,byId(s,7102).key,false,'Gauge problem noted in comments');
 assert.equal(s.decisions[byId(s,7102).key].reason,'Gauge problem noted in comments');
 s=applyTestDecision(s,byId(s,7103).key,false,'x');s=applyTestDecision(s,byId(s,7104).key,false,'x');
 assert.equal(bhpSeries(s).enough,false);assert.equal(bhpSeries(s).points.length,1);
 assert.throws(()=>applyTestDecision(s,'package:bhp:999',true),/Not a test record/);
});
test('out-of-range records are listed and get no timeline marker',()=>{
 const s=state(),o=outOfRange(s);
 assert.deepEqual(o.before.map(r=>r.values.source_report_id).sort(),['7101','7201']);assert.deepEqual(o.after.map(r=>r.values.source_report_id),['7108']);
 const m=timelineMarkers(s);assert.deepEqual(m.map(x=>x.date),['2024-02-12','2024-07-22','2024-11-05']);
 assert.equal(m.every(x=>x.kind==='bhp'&&/source field named psia/.test(x.label)&&/as reported/.test(x.label)),true);
 assert.deepEqual(timelineMarkers({...s,range:null}),[]);
 const re=applyTestDecision(s,byId(s,7108).key,true);assert.deepEqual(timelineMarkers(re).map(x=>x.date),m.map(x=>x.date));
});
test('markers need date, pressure and range only: a re-included depthless BHP test is marked but not charted; labels never print null',()=>{
 let s=state();s=applyTestDecision(s,byId(s,7105).key,true);s=applyTestDecision(s,byId(s,7106).key,true);s=applyTestDecision(s,byId(s,7107).key,true);
 const m=timelineMarkers(s),dep=m.find(x=>x.date==='2024-12-01');
 assert.ok(dep);assert.match(dep.label,/1700 psia as reported/);assert.match(dep.label,/depth not reported/);
 assert.equal(m.some(x=>/null/.test(x.label)),false);
 assert.equal(m.some(x=>x.date==='2025-02-01'),false); // no pressure
 assert.equal(bhpSeries(s).points.some(p=>p.key===byId(s,7105).key),false);
 s=applyTestDecision(s,byId(s,7202).key,true);assert.equal(timelineMarkers(s).some(x=>x.date==='2025-01-15'),false);
 s=applyTestDecision(s,byId(s,7201).key,true);assert.equal(timelineMarkers(s).some(x=>x.kind==='srt'),false); // before range
});
test('SRT marker tooltip shows each pressure as psig as reported',()=>{
 const s=buildTestState({package:{bhp:[],srt:[srt(7203,'2025-03-03',1610)]}},range),m=timelineMarkers(s);
 assert.equal(m.length,1);assert.match(m[0].label,/formation_frac_press_psig 1610 psig, as reported/);assert.doesNotMatch(m[0].label,/null/);
});
test('reference depth: a single depth is the reference; a tie gives no reference and flags every BHP test with a depth',()=>{
 assert.deepEqual(referenceDepth([3310]),{reference:3310,tie:false});
 assert.deepEqual(referenceDepth([3140,3310]),{reference:null,tie:true});
 assert.deepEqual(referenceDepth([]),{reference:null,tie:false});
 const s=buildTestState({package:{bhp:[bhp(1,'2024-01-01',1,3140),bhp(2,'2024-02-01',2,3310)],srt:[]}},range);
 assert.equal(s.records.every(r=>r.flags.includes('depth-differs')&&/No single most-common/.test(r.reasons[0])),true);
});
test('duplicate identities are flagged within and across sources',()=>{
 const s=buildTestState({package:{bhp:[bhp(1,'2024-01-01',1,3310)],srt:[]},upload:{bhp:[bhp(1,'2024-01-01',1,3310)]}},range);
 assert.deepEqual(s.records.map(r=>[r.origin,r.flags]),[['package',['duplicate-report']],['upload',['duplicate-report']]]);
 assert.equal(FLAG_REASONS['duplicate-report'],'More than one record with this report identity.');
});
test('coverage counts records, origins and range',()=>{
 const c=testCoverage(state());
 assert.deepEqual(c,{bhpRecords:8,srtRecords:2,packageRecords:10,uploadRecords:0,flagged:5,included:5,comparableBhp:4,referenceDepthFt:3310,referenceTie:false,beforeRange:2,afterRange:1});
});

const csv=(header,rows)=>[header.join(','),...rows.map(r=>header.map(h=>r[h]??'').join(','))].join('\r\n');
const bhpCsvRow={source_row_key:'k1',parent_key:'p',parent_join_status:'matched',uic_number:UIC,source_report_id:'7102',tracking_no:'90000417',test_sequence_no:'1.0',report_conducted_date:'2024-02-12',report_conducted_date_text:'2024-02-12',
 report_received_date:'',report_received_date_text:'',bhp_psia:'1705.0',test_depth_ft:'3310',gradient_psi_ft:'0.710',tested_formation:'SYNTHETIC',source_snapshot_id:'s',quality_flags:'missing:report_received_date'};
test('upload parser accepts Explorer BHP columns in any order and reads values with Explorer rules',()=>{
 const header=[...BHP_COLUMNS].reverse(),{kind,rows}=rowsFromTable(parseCsv(csv(header,[bhpCsvRow])),UIC);
 assert.equal(kind,'bhp');assert.equal(rows[0].bhp_psia,1705);assert.equal(rows[0].report_received_date,null);assert.deepEqual(rows[0].quality_flags,['missing:report_received_date']);
 assert.equal(rows[0].test_sequence_no,'1.0');
 assert.equal(rowsFromTable(parseCsv(csv([...SRT_COLUMNS],[{...bhpCsvRow,test_date:'2022-05-16',formation_frac_press_psig:'1610'}])),UIC).kind,'srt');
});
test('upload parser rejects the whole file for header, size, number, date, formula or well problems',()=>{
 const ok=[...BHP_COLUMNS],run=(h,rows)=>()=>rowsFromTable(parseCsv(csv(h,rows)),UIC);
 assert.throws(run(ok.slice(1),[bhpCsvRow]),/exactly Explorer/);
 assert.throws(run([...ok,'extra'],[bhpCsvRow]),/exactly Explorer/);
 assert.throws(run(ok,[]),/no test rows/);
 assert.throws(run(ok,Array.from({length:1001},()=>bhpCsvRow)),/At most 1000/);
 assert.throws(run(ok,[{...bhpCsvRow,bhp_psia:'1.5e3'}]),/plain number/);
 assert.throws(run(ok,[{...bhpCsvRow,report_conducted_date:'2024-02-30'}]),/valid YYYY-MM-DD/);
 assert.throws(run(ok,[{...bhpCsvRow,tested_formation:'=1+1'}]),/formula/);
 assert.throws(run(ok,[{...bhpCsvRow,uic_number:'000000999'}]),/not the selected well 000000417/);
});
