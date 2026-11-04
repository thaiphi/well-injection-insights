import test from 'node:test';import assert from 'node:assert/strict';
import {createInjectivitySession,statusCounts} from '../web/injectivity.mjs';
import {verifyEstimateSealed} from '../dist/injectivityEstimateExport.js';
import {applyTestDecision} from '../dist/testRecords.js';
import {fixtureInputs} from './helpers/injectivity-fixture.mjs';

const ready={ready:true,reasons:[]},blocked={ready:false,reasons:['Inspection only: test.']};
const selection={artifact:{artifactId:'synthetic',inventory:[{uic_number:'000000417',permit_liquid_pressure_limit_psi:1176,permit_liquid_volume_limit_bpd:30000}],injectionMonthly:[{uic_number:'000000417'}]},pin:null,tests:{sha256:{'tests.json':'ab'}}};
const make=(gate=ready,inputs=fixtureInputs())=>createInjectivitySession({selection,gate,...inputs});

test('starts at revision 0 awaiting the basis; each change bumps the revision; a rejected change does not',()=>{
 const s=make();assert.equal(s.revision,0);assert.equal(s.uic,'000000417');assert.match(s.estimate.readiness,/Confirm the pressure basis/);
 assert.throws(()=>s.confirmBasis('psig',''),/reason/);assert.equal(s.revision,0);
 s.confirmBasis('psig','RRC guidance');assert.equal(s.revision,1);s.setAssumptions({salinityWtPercent:12});assert.equal(s.revision,2);
 s.move('package:bhp:4',-1,'month end');assert.equal(s.revision,3);s.choose('package:bhp:1','planning period');assert.equal(s.revision,4);
});
test('a 1a or 1b change arrives through update and recomputes',()=>{
 const s=make();s.confirmBasis('psig','x');const next=fixtureInputs();next.tests=applyTestDecision(next.tests,'package:bhp:2',false,'operator note');
 s.update(next);assert.equal(s.revision,2);assert.deepEqual(s.estimate.qualifying,['package:bhp:1']);
});
test('no H-10 rows: every test is unmatched with the reason',()=>{
 const s=createInjectivitySession({selection,gate:ready,h10:null,tests:fixtureInputs().tests});s.confirmBasis('psig','x');
 assert.ok(s.estimate.tests.filter(t=>t.status==='unmatched').every(t=>t.reason==='No H-10 months to match.'));
});
test('export: sealed JSON verifies; filename carries the UIC and hash; a stale export resolves null',async()=>{
 const s=make();s.confirmBasis('psig','x');const r=await s.exportRequest('json');
 assert.match(r.filename,/^test-referenced-j-000000417-[a-f0-9]{12}\.json$/);assert.equal(await verifyEstimateSealed(JSON.parse(r.text)),true);
 const p=s.exportRequest('csv');s.setAssumptions({salinityWtPercent:11});assert.equal(await p,null);
 const d=s.exportRequest('svg');s.dispose();assert.equal(await d,null);
});
test('gate not ready blocks exports and the hand-off',async()=>{
 const s=make(blocked);s.confirmBasis('psig','x');
 await assert.rejects(s.exportRequest('json'),/Exports blocked: Inspection only/);await assert.rejects(s.handoffRequest(),/Hand-off blocked: Inspection only/);
});
test('hand-off carries permit values, the estimate hash and the bottomhole limit unset; stale resolves null',async()=>{
 const s=make();s.confirmBasis('psig','x');const h=await s.handoffRequest();
 assert.equal(h.values.limitPsia,null);assert.ok(Math.abs(h.values.surfaceLimitPsia-1190.7)<1e-9);assert.equal(h.values.operatingCeilingStbd,30000);assert.match(h.origins.injectivityStbdPerPsi,/sealed estimate [a-f0-9]{12}$/);
 const p=s.handoffRequest();s.choose('package:bhp:1','x');assert.equal(await p,null);
});
test('unknown export format is refused',async()=>{await assert.rejects(make().exportRequest('pdf'),/Unsupported export format: pdf/);});
test('statusCounts on the fixture: T1 and T2 match; T3 is off depth (refused, no month); T4 hits the 2024-05 gap (unmatched)',()=>{
 const s=make();
 assert.deepEqual(statusCounts(s.estimate),{bhp:4,matched:2,unmatched:1,notUsable:1,qualifying:0});
 s.confirmBasis('psig','x');
 assert.deepEqual(statusCounts(s.estimate),{bhp:4,matched:2,unmatched:1,notUsable:1,qualifying:2});
});
const upload={kind:'bhp',fileName:'bhp.csv',sha256:'cd'.repeat(32)};
test('final review I-2: the 1b upload list is recorded in the sealed source and the CSV',async()=>{
 const s=make(ready,{...fixtureInputs(),uploads:[upload]});s.confirmBasis('psig','x');assert.deepEqual(s.uploads,[upload]);
 const j=JSON.parse((await s.exportRequest('json')).text);assert.deepEqual(j.source.tests.uploads,[upload]);assert.equal(await verifyEstimateSealed(j),true);
 assert.match((await s.exportRequest('csv')).text,/Upload \(not verified\)","bhp bhp\.csv cdcd/);
 const none=make();none.confirmBasis('psig','x');assert.deepEqual(JSON.parse((await none.exportRequest('json')).text).source.tests.uploads,[]);
 const s2=make();s2.confirmBasis('psig','x');s2.update({...fixtureInputs(),uploads:[upload]});assert.deepEqual(JSON.parse((await s2.exportRequest('json')).text).source.tests.uploads,[upload]);
});
test('final review I-2: sealing is refused when upload-origin records exist but no upload list was supplied',async()=>{
 const inputs=fixtureInputs(),base=inputs.tests,rec={...base.records[0],key:'upload:bhp:1',origin:'upload'};
 const withUpload={...base,records:[...base.records,rec],decisions:{...base.decisions,'upload:bhp:1':{include:true,reason:null,byUser:false}}};
 const s=make(ready,{...inputs,tests:withUpload});s.confirmBasis('psig','x');
 await assert.rejects(s.exportRequest('json'),/Sealing refused: uploaded test records/);await assert.rejects(s.handoffRequest(),/Sealing refused/);
 s.update({...inputs,tests:withUpload,uploads:[upload]});assert.ok(await s.exportRequest('json'));
});
test('final review I-3: a failing recomputation rejects with its message and leaves state and revision unchanged',()=>{
 // No numerical traverse failure is reachable through validated inputs, so the failure is injected through the H-10 months getter.
 const inputs=fixtureInputs(),real=inputs.h10.months;let boom=false;
 const h10=Object.create(inputs.h10,{months:{get(){if(boom)throw new Error('Wellbore refinement failed to converge');return real;}}});
 const s=make(ready,{...inputs,h10});s.confirmBasis('psig','x');s.choose('package:bhp:1','first');const before=s.state,rev=s.revision;boom=true;
 assert.throws(()=>s.confirmBasis('psia','y'),/failed to converge/);assert.throws(()=>s.setAssumptions({salinityWtPercent:12}),/failed to converge/);
 assert.throws(()=>s.move('package:bhp:4',-1,'z'),/failed to converge/);assert.throws(()=>s.choose('package:bhp:2','z'),/failed to converge/);
 assert.equal(s.state,before);assert.equal(s.revision,rev);boom=false;s.setAssumptions({salinityWtPercent:12});assert.equal(s.revision,rev+1);
});
