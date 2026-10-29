import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createDiagnosticsSession} from '../web/h10-diagnostics.mjs';
import {verifySealed} from '../dist/h10DiagnosticsExport.js';

const artifact=JSON.parse(await readFile('data/explorer/normalized.json','utf8')),pin=JSON.parse(await readFile('data/explorer-pin.json','utf8'));
const selection={artifact,pin},ready={ready:true,reasons:[]},blocked={ready:false,reasons:['Inspection only: test.']};

test('session starts from the system flags with revision 0 and records the source identity',()=>{
 const s=createDiagnosticsSession(selection,ready);
 assert.equal(s.revision,0);assert.equal(s.source.artifactId,artifact.artifactId);assert.equal(s.source.uic,'000020838');assert.equal(s.source.normalizedSha256,pin.normalizedSha256);
 assert.equal(Object.values(s.state.decisions).every(d=>d.include),true);
});
test('each decision increments the revision',()=>{
 const s=createDiagnosticsSession(selection,ready);s.decide('2024-01',false,'test reason');assert.equal(s.revision,1);assert.equal(s.state.decisions['2024-01'].include,false);
});
test('an invalid decision leaves state and revision unchanged',()=>{
 const s=createDiagnosticsSession(selection,ready);assert.throws(()=>s.decide('2024-01',false,''),/reason/i);assert.equal(s.revision,0);assert.equal(s.state.decisions['2024-01'].include,true);
});
test('a current export resolves to a verifiable sealed JSON',async()=>{
 const s=createDiagnosticsSession(selection,ready),r=await s.exportRequest('json');
 assert.match(r.filename,/^h10-diagnostics-000020838-[a-f0-9]{12}\.json$/);assert.equal(r.mime,'application/json');assert.equal(await verifySealed(JSON.parse(r.text)),true);
 for(const f of ['csv','svg'])assert.ok((await s.exportRequest(f)).text.length>100);
});
test('a decision made while an export is sealing makes that export stale',async()=>{
 const s=createDiagnosticsSession(selection,ready),pending=s.exportRequest('json');s.decide('2024-01',false,'changed mid-export');assert.equal(await pending,null);
});
test('dispose makes every pending and later export stale',async()=>{
 const s=createDiagnosticsSession(selection,ready),pending=s.exportRequest('csv');s.dispose();assert.equal(await pending,null);assert.equal(await s.exportRequest('csv'),null);
});
test('a blocked gate refuses exports with its reasons',async()=>{
 const s=createDiagnosticsSession(selection,blocked);await assert.rejects(s.exportRequest('json'),/Exports blocked: Inspection only: test\./);
});
test('unknown export formats are rejected',async()=>{await assert.rejects(createDiagnosticsSession(selection,ready).exportRequest('pdf'),/Unsupported export format/);});
