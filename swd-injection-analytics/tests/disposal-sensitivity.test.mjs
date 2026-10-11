import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const engineDir=process.env.DISPOSAL_ENGINE_DIR??'dist';
const engine=await import(pathToFileURL(resolve(engineDir,'disposalSensitivity.js'))).catch(()=>({}));
const {buildDisposalCase}=await import(pathToFileURL(resolve(engineDir,'disposalCase.js')));
const well={id:'FICTIONAL-A',reservoirPsia:2000,limitPsia:3500,injectivityStbdPerPsi:5,operatingCeilingStbd:10000,availability:0.9,datum:'formation',reservoirDatum:'formation',limitDatum:'formation',reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',tvdFt:3000,measuredDepthFt:3500,innerDiameterInches:5,roughnessInches:0.0006,surfaceLimitPsia:5000};
const caseInput={caseName:'Assumed sensitivity',demand:{id:'synthetic-demand/1',origin:'synthetic',content:'fictional',monthly:[{month:'2028-02',demandBbl:300000},{month:'2028-03',demandBbl:0}],evidence:{fixture:'seed-417/v1'}},wells:[well,{...well,id:'FICTIONAL-B',injectivityStbdPerPsi:2.5}],fluid:{referencePressurePsia:2000,temperatureF:180,salinityWtPercent:5},comparison:{wellId:'FICTIONAL-A',injectivityMultiplier:0.5,innerDiameterInches:4,availability:0.8}};
const spec={wellId:'FICTIONAL-A',parameter:'injectivityStbdPerPsi',minimum:2.5,maximum:10,points:3};
const near=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('base-only bounded sensitivity engine exists',()=>assert.equal(typeof engine.buildDisposalSensitivity,'function'));
test('baseline is inserted exactly and agrees with the original uniform base scenario',()=>{
 const result=engine.buildDisposalSensitivity(caseInput,spec),base=buildDisposalCase(caseInput).base;
 assert.deepEqual(result.points.map(p=>p.value),[2.5,5,6.25,10]);assert.equal(result.points.filter(p=>p.isBaseline).length,1);assert.equal(result.points.find(p=>p.isBaseline).isGridPoint,false);
 assert.equal(result.baseline.value,5);near(result.baseline.summary.totalAvailableStbd,10125);near(result.baseline.summary.totalAvailableStbd,base.totalAvailableStbd);near(result.baseline.summary.totalShortfallBbl,base.totalShortfallBbl);assert.deepEqual(result.baseline.summary,result.points.find(p=>p.isBaseline).summary);
 assert.equal(result.parameter.unit,'STB/day/psi');assert.equal(result.caseMethodVersion,'constant-j-uniform-brine-darcy-weisbach/1');assert.equal(result.caseProvenance.pvt.liveMcpCall,false);
});
test('grid endpoints and an existing baseline are retained without duplicate rows',()=>{
 const result=engine.buildDisposalSensitivity(caseInput,{...spec,minimum:2.5,maximum:7.5});assert.deepEqual(result.points.map(p=>p.value),[2.5,5,7.5]);assert.equal(result.points[1].isBaseline,true);assert.equal(result.points[1].isGridPoint,true);
 const edge=engine.buildDisposalSensitivity(caseInput,{...spec,minimum:5});assert.equal(edge.points[0].isBaseline,true);assert.equal(edge.points[0].value,5);assert.equal(edge.points.at(-1).value,10);
});
test('range too narrow for distinct floating-point grid values is rejected before duplicated baseline rows',()=>{
 assert.throws(()=>engine.buildDisposalSensitivity(caseInput,{...spec,minimum:5,maximum:5.000000000000001}),/distinct|resolution|narrow/i);
});
test('selected well changes alone and comparison settings cannot leak into base sweep',()=>{
 const result=engine.buildDisposalSensitivity(caseInput,spec);
 for(const point of result.points){
  const modified=structuredClone(caseInput);modified.wells[0].injectivityStbdPerPsi=point.value;const actual=buildDisposalCase(modified).base;
  near(point.summary.totalAvailableStbd,actual.totalAvailableStbd);assert.deepEqual(point.summary.wells[1],result.baseline.summary.wells[1]);
  assert.equal(point.summary.firstShortfallMonth,actual.firstShortfallMonth);near(point.summary.totalShortfallBbl,actual.totalShortfallBbl);
  for(let i=0;i<actual.monthly.length;i++)near(point.summary.monthly[i].shortfallBbl,actual.monthly[i].shortfallBbl);
 }
 const changedComparison={...caseInput,comparison:{wellId:'FICTIONAL-B',injectivityMultiplier:1,innerDiameterInches:5,availability:0}};
 assert.deepEqual(engine.buildDisposalSensitivity(changedComparison,spec).points,result.points);assert.deepEqual(result.inputs.caseInput.comparison,caseInput.comparison);assert.match(result.limitations.join(' '),/comparison.*not|not.*comparison/i);
});
test('unused comparison calculations cannot block a valid base sweep',()=>{
 const original={...caseInput,comparison:{...caseInput.comparison,injectivityMultiplier:10}};
 const range={...spec,minimum:5,maximum:2000};
 const changed=structuredClone(original);changed.wells[0].injectivityStbdPerPsi=2000;assert.throws(()=>buildDisposalCase(changed),/Injectivity/i);
 const r=engine.buildDisposalSensitivity(original,range);assert.equal(r.points.at(-1).value,2000);assert.deepEqual(r.inputs.caseInput.comparison,original.comparison);assert.deepEqual(r.caseProvenance.sensitivity.originalComparison,original.comparison);
});
test('constant-J sweep follows independent pressure capacity anchors and declared ceiling',()=>{
 const r=engine.buildDisposalSensitivity(caseInput,spec),expected=[3375,6750,8437.5,9000];
 r.points.forEach((p,i)=>near(p.summary.wells[0].availableStbd,expected[i]));for(let i=1;i<r.points.length;i++){assert.ok(r.points[i].summary.totalAvailableStbd>=r.points[i-1].summary.totalAvailableStbd);assert.ok(r.points[i].summary.totalShortfallBbl<=r.points[i-1].summary.totalShortfallBbl);}
 assert.ok(r.points.at(-1).summary.wells[0].limitingConstraints.includes('operating ceiling'));
});
test('availability changes calendar capacity once without changing onstream capacity',()=>{
 const r=engine.buildDisposalSensitivity(caseInput,{...spec,parameter:'availability',minimum:0,maximum:1});assert.equal(r.parameter.unit,'fraction of calendar time');
 for(const p of r.points){near(p.summary.wells[0].maximumStbd,7500);near(p.summary.wells[0].availableStbd,7500*p.value);near(p.summary.totalAvailableStbd,7500*p.value+3375);}
});
test('diameter sweep has inch units and preserves unrelated well capacity',()=>{
 const input=structuredClone(caseInput);input.wells[0].innerDiameterInches=2;input.wells[0].surfaceLimitPsia=1600;
 const r=engine.buildDisposalSensitivity(input,{...spec,parameter:'innerDiameterInches',minimum:1.5,maximum:3.5});assert.equal(r.parameter.unit,'in');
 for(let i=1;i<r.points.length;i++)assert.ok(r.points[i].summary.totalAvailableStbd>=r.points[i-1].summary.totalAvailableStbd);for(const p of r.points)near(p.summary.wells[1].availableStbd,3375);
});
test('segmented baseline agreement and unsupported allocation flags survive compact summaries',()=>{
 const input={...caseInput,hydraulics:{model:'segmented-brine',surfaceTemperatureF:80,segments:16},wells:[{...well,tvdFt:5000,measuredDepthFt:5500}],demand:{...caseInput.demand,monthly:[{month:'2028-02',demandBbl:29}]}};
 const r=engine.buildDisposalSensitivity(input,{...spec,parameter:'availability',minimum:0.8,maximum:1}),base=buildDisposalCase(input).base;
 near(r.baseline.summary.totalAvailableStbd,base.totalAvailableStbd);assert.equal(r.baseline.summary.monthly[0].operatingFeasible,false);assert.equal(r.baseline.summary.monthly[0].unsupportedAllocations[0].wellId,well.id);assert.ok(r.baseline.summary.monthly[0].unsupportedAllocations[0].reasons.length>0);assert.match(r.caseMethodVersion,/segmented/);
 const allocation=r.baseline.summary.monthly[0].allocations[0];assert.equal(allocation.hydraulics.status,'unsupported');assert.equal(allocation.hydraulics.requiredSurfacePsia,null);assert.equal(allocation.operatingFeasible,false);assert.ok(allocation.reasons.length>0);near(allocation.allocatedBbl,29);
});
test('one failed point blocks the complete sweep with its parameter value',()=>{
 const input={...caseInput,hydraulics:{model:'segmented-brine',surfaceTemperatureF:80,segments:16},wells:[{...well,surfaceLimitPsia:10000,operatingCeilingStbd:100000}]};
 assert.throws(()=>engine.buildDisposalSensitivity(input,{...spec,minimum:5,maximum:100}),/point|value|injectivity.*100/i);
});
test('bounded parameter domains, distinct ranges, exact baseline containment and integer grid count are enforced',()=>{
 for(const change of [{wellId:'missing'},{parameter:'reservoirPsia'},{parameter:['availability']},{minimum:0},{minimum:6},{maximum:4},{minimum:10,maximum:2.5},{minimum:NaN},{maximum:Infinity},{points:2},{points:10},{points:3.5},{minimum:2.5,maximum:10001}])assert.throws(()=>engine.buildDisposalSensitivity(caseInput,{...spec,...change}));
 assert.throws(()=>engine.buildDisposalSensitivity(caseInput,{...spec,parameter:'availability',minimum:0,maximum:1.1}));assert.throws(()=>engine.buildDisposalSensitivity(caseInput,{...spec,parameter:'innerDiameterInches',minimum:0.2,maximum:6}));
 assert.throws(()=>engine.buildDisposalSensitivity(caseInput,{...spec,parameter:['availability'],minimum:0,maximum:1}));
});
test('compact allocations retain positive and zero operation, calendar conservation and endpoint hydraulics',()=>{
 const r=engine.buildDisposalSensitivity(caseInput,spec);
 for(const p of r.points)for(const month of p.summary.monthly){
  near(month.allocations.reduce((sum,a)=>sum+a.allocatedBbl,0)+month.shortfallBbl,month.demandBbl);
  for(const a of month.allocations){near(a.allocatedBbl,a.averageStbd*month.days);near(a.onstreamStbd,a.averageStbd/0.9);assert.ok(Array.isArray(a.reasons));assert.equal(Object.hasOwn(a.hydraulics,'traverse'),false);}
 }
 assert.equal(r.baseline.summary.monthly[0].allocations[0].hydraulics.status,'flowing');assert.ok(r.baseline.summary.monthly[0].allocations[0].hydraulics.bottomholePsia>2000);assert.equal(r.baseline.summary.monthly[1].allocations[0].hydraulics.status,'shut-in');assert.equal(r.baseline.summary.monthly[1].allocations[0].hydraulics.bottomholePsia,null);
});
test('inputs are cloned and exact original JSON validation rejects lossy evidence and accessors',()=>{
 const copy=structuredClone(caseInput),r=engine.buildDisposalSensitivity(copy,spec);copy.demand.evidence.fixture='changed';copy.wells[0].injectivityStbdPerPsi=7;assert.equal(r.inputs.caseInput.wells[0].injectivityStbdPerPsi,5);assert.equal(r.inputs.caseInput.demand.evidence.fixture,'seed-417/v1');
 const extra=[];extra.note='lost';assert.throws(()=>engine.buildDisposalSensitivity({...caseInput,demand:{...caseInput.demand,evidence:extra}},spec),/JSON|evidence/i);
 let reads=0;const bad={...spec};Object.defineProperty(bad,'minimum',{get(){reads++;return 2.5;},enumerable:true});assert.throws(()=>engine.buildDisposalSensitivity(caseInput,bad),/JSON|accessor/i);assert.equal(reads,0);
});
test('verified JSON and CSV reject stale, omitted, hidden or tampered rows and retain source lineage',()=>{
 const r=engine.buildDisposalSensitivity({...caseInput,caseName:'=formula'},spec),csv=engine.disposalSensitivityCsv(r);assert.ok(csv.includes("'=formula"));assert.ok(csv.includes(r.caseProvenance.pvt.referenceFixture.sha256));assert.ok(csv.includes('isBaseline'));assert.ok(csv.includes('STB/day/psi'));assert.deepEqual(engine.verifiedDisposalSensitivity(JSON.parse(JSON.stringify(r))),r);
 for(const mutate of [x=>x.points[0].summary.totalAvailableStbd++,x=>x.points.pop(),x=>x.inputs.spec.maximum=11,x=>x.baseline.value=6,x=>x.points.note='lost',x=>Object.defineProperty(x,'secret',{value:'lost'}),x=>x.caseProvenance.pvt.referenceFixture.sha256='wrong']){const bad=structuredClone(r);mutate(bad);assert.throws(()=>engine.disposalSensitivityCsv(bad),/stale|changed|tamper|JSON|evidence/i);}
});
