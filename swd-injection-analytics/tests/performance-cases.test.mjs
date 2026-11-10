import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const engineDir=process.env.DISPOSAL_ENGINE_DIR??'dist';
const load=f=>import(pathToFileURL(resolve(engineDir,f))).catch(()=>({}));
const pc=await load('performanceCases.js');
const {summarize}=await load('disposalSensitivity.js');
const {buildDisposalCase}=await load('disposalCase.js');
const well={id:'FICTIONAL-A',reservoirPsia:2000,limitPsia:3500,injectivityStbdPerPsi:5,operatingCeilingStbd:10000,availability:0.9,datum:'formation',reservoirDatum:'formation',limitDatum:'formation',reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',tvdFt:3000,measuredDepthFt:3500,innerDiameterInches:5,roughnessInches:0.0006,surfaceLimitPsia:5000};
const caseInput={caseName:'Assumed performance',demand:{id:'synthetic-demand/1',origin:'synthetic',content:'fictional',monthly:[{month:'2028-02',demandBbl:300000},{month:'2028-03',demandBbl:300000}],evidence:{fixture:'seed-417/v1'}},wells:[well,{...well,id:'FICTIONAL-B',injectivityStbdPerPsi:2.5}],fluid:{referencePressurePsia:2000,temperatureF:180,salinityWtPercent:5},comparison:{wellId:'FICTIONAL-A',injectivityMultiplier:0.5,innerDiameterInches:4,availability:0.8}};
const N={injectivityMultiplier:1,reservoirOffsetPsi:0,availabilityMultiplier:1};
const spec=(p={},o={})=>({pessimistic:{...N,...p},optimistic:{...N,...o}});
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const neutral=input=>{const m=structuredClone(input);m.comparison={wellId:m.wells[0].id,injectivityMultiplier:1,innerDiameterInches:m.wells[0].innerDiameterInches,availability:m.wells[0].availability};return m;};
test('module exists',()=>assert.equal(typeof pc.buildPerformanceCases,'function'));
test('neutral factors equal the engine base',()=>{
 const r=pc.buildPerformanceCases(caseInput,spec({injectivityMultiplier:0.5},{injectivityMultiplier:2}));
 assert.deepEqual(r.cases.map(c=>c.label),['Pessimistic','Base','Optimistic']);
 assert.deepEqual(r.cases[1].summary,summarize(buildDisposalCase(neutral(caseInput)).base));
 assert.deepEqual(r.cases[1].factors,pc.NEUTRAL_FACTORS);assert.equal(r.version,pc.PERFORMANCE_CASES_VERSION);
});
test('availability applied once',()=>{
 const r=pc.buildPerformanceCases(caseInput,spec({availabilityMultiplier:0.5}));
 const m=neutral(caseInput);for(const w of m.wells)w.availability*=0.5;
 near(r.cases[0].summary.totalAvailableStbd,buildDisposalCase(m).base.totalAvailableStbd);
});
test('zero availability contributes zero',()=>{
 const r=pc.buildPerformanceCases(caseInput,spec({availabilityMultiplier:0}));
 assert.equal(r.cases[0].summary.totalAvailableStbd,0);
});
test('availability cap',()=>{
 const r=pc.buildPerformanceCases(caseInput,spec({},{availabilityMultiplier:2}));
 const a=pc.applyFactors(caseInput,{...N,availabilityMultiplier:2});
 assert.equal(a.input.wells[0].availability,1);assert.deepEqual(a.cappedWells,['FICTIONAL-A','FICTIONAL-B']);
 assert.deepEqual(r.cases[2].cappedWells,['FICTIONAL-A','FICTIONAL-B']);assert.equal(caseInput.wells[0].availability,0.9);
});
test('no headroom well reported, capacity zero',()=>{
 const r=pc.buildPerformanceCases(caseInput,spec({reservoirOffsetPsi:1600}));
 const c=r.cases[0];assert.deepEqual(c.noHeadroomWells,['FICTIONAL-A','FICTIONAL-B']);
 assert.equal(c.summary.wells[0].maximumStbd,0);
 assert.deepEqual(r.headroom[0],{wellId:'FICTIONAL-A',reservoirPsia:2000,limitPsia:3500,headroomPsi:1500});
 near(c.offsetPercentOfHeadroom[0].percent,100*1600/1500);
});
test('percent of headroom null when no headroom',()=>{
 const i=structuredClone(caseInput);i.wells[0].reservoirPsia=3500;
 const r=pc.buildPerformanceCases(i,spec({reservoirOffsetPsi:-100}));
 assert.equal(r.cases[0].offsetPercentOfHeadroom[0].percent,null);
});
test('offset outside engine bounds throws, no partial result',()=>{
 const i=structuredClone(caseInput);for(const w of i.wells){w.reservoirPsia=8000;w.limitPsia=9500;}
 assert.throws(()=>pc.buildPerformanceCases(i,spec({},{reservoirOffsetPsi:5000})),/Reservoir pressure \(psia\)/);
});
test('invalid factor rejected',()=>{
 assert.throws(()=>pc.buildPerformanceCases(caseInput,spec({injectivityMultiplier:0})),/must be finite between 0.01 and 10/);
 assert.throws(()=>pc.validateFactors({...N,reservoirOffsetPsi:6000},'Optimistic'),/Optimistic reservoirOffsetPsi must be finite between -5000 and 5000/);
 assert.throws(()=>pc.validateFactors({...N,availabilityMultiplier:11},'Pessimistic'),/availabilityMultiplier must be finite between 0 and 10/);
});
test('attribution has three single-factor runs, not additive',()=>{
 const r=pc.buildPerformanceCases(caseInput,spec({injectivityMultiplier:0.5,reservoirOffsetPsi:-200,availabilityMultiplier:0.8}));
 const c=r.cases[0];assert.deepEqual(c.attribution.map(a=>a.factor),['injectivity','reservoir','availability']);
 assert.deepEqual(r.cases[1].attribution,[]);
 const baseTotal=r.cases[1].summary.totalShortfallBbl;
 for(const a of c.attribution)near(a.changeBbl,a.totalShortfallBbl-baseTotal);
 assert.ok(r.notes.includes(pc.ATTRIBUTION_NOTE));assert.deepEqual(r.notes,[pc.CASE_LABEL,pc.FLAT_NOTE,pc.FLUID_NOTE,pc.ATTRIBUTION_NOTE]);
});
test('deterministic and input not mutated',()=>{
 const before=JSON.stringify(caseInput),s=spec({injectivityMultiplier:0.5},{injectivityMultiplier:2});
 assert.deepEqual(pc.buildPerformanceCases(caseInput,s),pc.buildPerformanceCases(caseInput,s));assert.equal(JSON.stringify(caseInput),before);
});
