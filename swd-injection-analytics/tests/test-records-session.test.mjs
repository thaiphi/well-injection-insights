import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createTestRecordsSession,MAX_UPLOAD_BYTES} from '../web/test-records.mjs';
import {verifyExplorerPackage} from '../web/explorer-package.mjs';
import {verifyTestRecordsSealed} from '../dist/testRecordsExport.js';
import {BHP_COLUMNS} from '../dist/testRecords.js';
import {buildV4Package,SYNTHETIC_UIC} from './helpers/explorer-v4.mjs';

// The "with tests" selection is a verified synthetic query-version-4 package (fictional UIC 000000417).
const artifact=JSON.parse(await readFile('data/explorer/normalized.json','utf8')),pin=JSON.parse(await readFile('data/explorer-pin.json','utf8'));
const UIC=SYNTHETIC_UIC,range={first:'2024-01',last:'2025-04'},ready={ready:true,reasons:[]},blocked={ready:false,reasons:['Inspection only: test.']};
const rawBhp=(id,date,psia,depth)=>({report_id:String(id),tracking_no:'9',report_conducted_date:date,report_received_date:'2024-10-15',bhp_psia:psia,test_depth_ft:depth,gradient_psi_ft:'0.68',tested_formation:'SYNTHETIC',test_sequence_no:'1.0'});
const withTests=await verifyExplorerPackage(await buildV4Package({bhp:[rawBhp(1,'2024-02-12','1705.0','3310.0'),rawBhp(2,'2024-07-22','1731.0','3310.0')],srt:[]}));
const csvRow=(id,uic=UIC)=>BHP_COLUMNS.map(c=>({source_row_key:`u${id}`,parent_key:'p',parent_join_status:'matched',uic_number:uic,source_report_id:String(id),tracking_no:'9',test_sequence_no:'1.0',report_conducted_date:'2025-01-10',report_conducted_date_text:'2025-01-10',bhp_psia:'1768',test_depth_ft:'3310',gradient_psi_ft:'0.7',tested_formation:'SYNTHETIC',source_snapshot_id:'s'})[c]??'').join(',');
const file=(...rows)=>new TextEncoder().encode([BHP_COLUMNS.join(','),...rows].join('\r\n'));

test('a selection without package tests starts empty and records the well',()=>{
 const s=createTestRecordsSession({selection:{artifact,pin},gate:ready,range});assert.equal(s.state.records.length,0);assert.equal(s.uic,'000020838');assert.equal(s.revision,0);
});
test('package tests are labelled as package records',()=>{
 const s=createTestRecordsSession({selection:withTests,gate:ready,range});assert.equal(s.uic,UIC);assert.deepEqual(s.state.records.map(r=>r.origin),['package','package']);
});
test('a valid upload adds records, bumps the revision and flags a cross-source duplicate',async()=>{
 const s=createTestRecordsSession({selection:withTests,gate:ready,range});
 assert.deepEqual(await s.upload('bhp.csv',file(csvRow(1),csvRow(9))),{kind:'bhp',count:2});assert.equal(s.revision,1);
 assert.deepEqual(s.state.records.filter(r=>r.flags.includes('duplicate-report')).map(r=>r.origin).sort(),['package','upload']);
 await s.upload('bhp.csv',file(csvRow(9)));assert.equal(s.state.records.filter(r=>r.origin==='upload').length,1);assert.equal(s.state.records.filter(r=>r.origin==='package').length,2);
});
test('a rejected upload leaves state and revision unchanged',async()=>{
 const s=createTestRecordsSession({selection:withTests,gate:ready,range}),before=s.state;
 await assert.rejects(s.upload('bhp.csv',file(csvRow(1,'000000999'))),/not the selected well/);
 await assert.rejects(s.upload('bhp.xlsx',file(csvRow(1))),/Only CSV/);
 await assert.rejects(s.upload('bhp.csv',new Uint8Array([0xff,0xfe,0x41])),/not valid UTF-8/);
 await assert.rejects(s.upload('bhp.csv',new Uint8Array(MAX_UPLOAD_BYTES+1)),/larger than 2 MB/);
 assert.equal(s.state,before);assert.equal(s.revision,0);
});
test('a current export resolves to a verifiable sealed JSON',async()=>{
 const s=createTestRecordsSession({selection:withTests,gate:ready,range}),r=await s.exportRequest('json');
 assert.match(r.filename,/^test-records-000000417-[a-f0-9]{12}\.json$/);assert.equal(await verifyTestRecordsSealed(JSON.parse(r.text)),true);
 for(const f of ['csv','svg'])assert.ok((await s.exportRequest(f)).text.length>100);
});
test('a decision or upload during sealing makes that export stale; dispose stales everything',async()=>{
 const s=createTestRecordsSession({selection:withTests,gate:ready,range});
 const p1=s.exportRequest('json');s.decide(s.state.records[0].key,false,'mid-export');assert.equal(await p1,null);
 const r=s.revision;await s.upload('bhp.csv',file(csvRow(9)));assert.equal(s.isCurrent(r),false);
 s.dispose();assert.equal(await s.exportRequest('json'),null);
});
test('a blocked gate refuses exports with its reasons; unknown formats are rejected',async()=>{
 await assert.rejects(createTestRecordsSession({selection:withTests,gate:blocked,range}).exportRequest('json'),/Exports blocked: Inspection only: test\./);
 await assert.rejects(createTestRecordsSession({selection:withTests,gate:ready,range}).exportRequest('pdf'),/Unsupported export format/);
});
