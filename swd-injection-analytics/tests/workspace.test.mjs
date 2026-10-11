import test from 'node:test';
import * as workspace from '../web/workspace-state.mjs';
import assert from 'node:assert/strict';
import {parseCsv} from '../dist/importProfile.js';
const m=await import('../web/workspace-state.mjs').catch(()=>({}));
test('editing any import input revokes confirmation and dependent results while retaining other profiles',()=>{
 const state=m.createImportState();
 state.confirm('history',{id:'h1'});state.confirm('injector',{id:'i1'});state.result={monthly:[1]};
 state.invalidate('history');
 assert.equal(state.inputs.history,undefined);assert.equal(state.inputs.injector.id,'i1');assert.equal(state.result,null);
});
test('known existing-producer omission blocks combined planning without blocking an independent forecast',()=>{
 const gates=m.presentationGates({readiness:{forecast:{ready:true,reasons:[]},groupedPlanning:{ready:true,reasons:[]},capacity:{ready:true,reasons:[]}},inputs:{producerIds:['OLD'],planningProducerIds:['NEW']},monthly:[]});
 assert.equal(gates.forecast.ready,true);assert.equal(gates.groupedPlanning.ready,false);assert.match(gates.groupedPlanning.reasons.join(' '),/OLD/);assert.equal(gates.comparison.ready,false);
});
test('nonfinite calculation output is blocked before JSON can turn it into null',()=>{
 const gates=m.presentationGates({readiness:{forecast:{ready:true,reasons:[]},capacity:{ready:true,reasons:[]},groupedPlanning:{ready:true,reasons:[]}},inputs:{producerIds:[],planningProducerIds:['N']},monthly:[{demandBbl:Infinity}]});
 assert.equal(gates.groupedPlanning.ready,false);assert.equal(gates.comparison.ready,false);
});
test('CSV retains metadata and neutralizes user formula-like identifiers',()=>{
 const csv=m.tableCsv({dataset:'user.csv',origin:'user',content:'synthetic',sha256:'abc'},['Producer','Volume (bbl)'],[['=BAD()',3100]]);
 assert.match(csv,/synthetic/);assert.match(csv,/abc/);assert.match(csv,/'=BAD/);assert.match(csv,/3100/);
});
test('overflow inside injector curve or pressure-limited capacity blocks injection results',()=>{
 const b={readiness:{capacity:{ready:true,reasons:[]},groupedPlanning:{ready:true,reasons:[]}},inputs:{producerIds:[],planningProducerIds:[]},monthly:[{availableCapacityBbl:10}],injectors:[{capacity:{pressureLimitedStbd:Infinity,availableStbd:10},curve:[{bottomholePsia:Infinity}]}]};
 assert.equal(m.presentationGates(b).capacity.ready,false);
});
test('blank input template uses a directly importable header on the first row',()=>{
 const csv=m.tableCsv({},['producerId','groupId','month','water'],[]);
 assert.deepEqual(parseCsv(csv).headers,['producerId','groupId','month','water']);
});
test('export evidence withholds blocked demand while preserving source inputs and valid forecasts',()=>{
 const b={readiness:{forecast:{ready:true,reasons:[]},reconciliation:{ready:false,reasons:['missing actual']},groupedPlanning:{ready:true,reasons:[]},capacity:{ready:true,reasons:[]}},inputs:{producerIds:['OLD'],planningProducerIds:['NEW'],history:{id:'h1'}},monthly:[{forecastBbl:3100,demandBbl:0,shortfallBbl:0}],producerMonths:[{}],groups:[{}],injectors:[]};
 const e=m.exportEvidence(b);assert.equal(e.monthly[0].forecastBbl,3100);assert.equal(e.monthly[0].demandBbl,null);assert.equal(e.monthly[0].shortfallBbl,null);assert.equal(e.inputs.history.id,'h1');assert.equal(b.monthly[0].demandBbl,0);
});
test('import chart axes retain finite ticks and positions at the numerical limits',()=>{
 assert.equal(typeof workspace.chartAxis,'function');
 for(const values of [[Number.MAX_VALUE],[-Number.MAX_VALUE,Number.MAX_VALUE]]){const axis=workspace.chartAxis(values);assert.ok(axis.ticks.every(Number.isFinite));assert.equal(axis.position(axis.min),0);assert.equal(axis.position(axis.max),1);assert.ok(Number.isFinite(axis.position(0)));}
 assert.deepEqual(workspace.chartAxis([-Number.MAX_VALUE,Number.MAX_VALUE]).ticks,[-Number.MAX_VALUE,-Number.MAX_VALUE/2,0,Number.MAX_VALUE/2,Number.MAX_VALUE]);
 assert.deepEqual(workspace.chartAxis([100]).ticks,[0,25,50,75,100]);
});
