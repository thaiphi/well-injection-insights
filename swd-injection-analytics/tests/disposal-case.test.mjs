import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const engineDir=process.env.DISPOSAL_ENGINE_DIR??'dist';
const engine=await import(pathToFileURL(resolve(engineDir,'disposalCase.js'))).catch(()=>({}));
const brine=await import(pathToFileURL(resolve(engineDir,'brinePvt.js')));
const well={id:'FICTIONAL-A',reservoirPsia:2000,limitPsia:3500,injectivityStbdPerPsi:5,operatingCeilingStbd:10000,availability:0.9,datum:'formation',reservoirDatum:'formation',limitDatum:'formation',reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',tvdFt:3000,measuredDepthFt:3500,innerDiameterInches:5,roughnessInches:0.0006,surfaceLimitPsia:5000};
const input={caseName:'Assumed connected disposal',demand:{id:'synthetic-demand/1',origin:'synthetic',content:'fictional',monthly:[{month:'2028-02',demandBbl:300000},{month:'2028-03',demandBbl:0}],evidence:{fixture:'seed-417/v1'}},wells:[well,{...well,id:'FICTIONAL-B',injectivityStbdPerPsi:2.5}],fluid:{referencePressurePsia:2000,temperatureF:180,salinityWtPercent:5},comparison:{wellId:'FICTIONAL-A',injectivityMultiplier:0.5,innerDiameterInches:5,availability:0.8}};
const near=(actual,expected,tolerance=1e-10)=>assert.ok(Math.abs(actual-expected)<=tolerance*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);
const props={pressurePsia:2000,bwRbPerStb:1,densityKgPerM3:1000,densityLbPerFt3:1000/16.01846337396014,viscosityCp:1,compressibilityPerPsi:0.000003};
test('connected disposal feature exists',()=>assert.equal(typeof engine.buildDisposalCase,'function'));
test('downward hydrostatic and SI rate conversion agree with hand calculation',()=>{
 const p=engine.hydraulicPoint(well,props,1000),q=1000*0.158987294928/86400,d=5*0.0254;
 near(p.hydrostaticPsi,1000*9.80665*3000*0.3048/6894.757293168);near(p.bottomholePsia,2200);near(p.localFlowM3PerSecond,q);near(p.velocityMPerSecond,q/(Math.PI*d*d/4));
 near(p.requiredSurfacePsia,p.bottomholePsia-p.hydrostaticPsi+p.frictionPsi);assert.ok(p.frictionPsi>0);
 const expanded=engine.hydraulicPoint(well,{...props,bwRbPerStb:1.2},1000);near(expanded.velocityMPerSecond,p.velocityMPerSecond*1.2);
});
test('laminar Darcy-Weisbach equals independent Hagen-Poiseuille',()=>{
 const p=engine.hydraulicPoint({...well,measuredDepthFt:3000},props,1),q=0.158987294928/86400,d=5*0.0254;
 assert.equal(p.regime,'laminar');near(p.darcyFrictionFactor,64/p.reynolds);near(p.frictionPsi,128*0.001*(3000*0.3048)*q/(Math.PI*d**4)/6894.757293168);
});
test('turbulent explicit factor agrees with independent Colebrook iteration within 2 percent',()=>{
 for(const rate of [1000,5000,10000]){
  const p=engine.hydraulicPoint(well,props,rate),relative=well.roughnessInches/well.innerDiameterInches;
  let f=0.02;for(let i=0;i<100;i++)f=1/(-2*Math.log10(relative/3.7+2.51/(p.reynolds*Math.sqrt(f))))**2;
  assert.equal(p.regime,'turbulent');
  const relativeError=Math.abs(p.darcyFrictionFactor-f)/f;
  assert.ok(relativeError<=0.02,`Rate ${rate} STB/day: Swamee-Jain f=${p.darcyFrictionFactor}, independent Colebrook f=${f}, relative error ${relativeError*100}% exceeds 2%`);
 }
});
test('transition is continuous at 2000 and 4000 Reynolds',()=>{
 const anchor=engine.hydraulicPoint(well,props,1000);
 for(const re of [2000,4000]){
  const q=1000*re/anchor.reynolds,a=engine.hydraulicPoint(well,props,q*(1-1e-8)),b=engine.hydraulicPoint(well,props,q*(1+1e-8));
  near(a.darcyFrictionFactor,b.darcyFrictionFactor,1e-7);
 }
});
test('constant-J anchors, maximum bounds and availability applied once',()=>{
 const r=engine.buildDisposalCase(input),a=r.base.wells[0],b=r.compared.wells[0];
 near(engine.hydraulicPoint(well,r.fluidProperties,5000).bottomholePsia,3000);near(engine.hydraulicPoint({...well,injectivityStbdPerPsi:2.5},r.fluidProperties,5000).bottomholePsia,4000);
 near(a.capacity.bottomholeLimitedStbd,7500);near(a.capacity.maximumStbd,7500);near(a.capacity.availableStbd,6750);near(b.capacity.maximumStbd,3750);near(b.capacity.availableStbd,3000);
 assert.equal(r.compared.wells[1].well.injectivityStbdPerPsi,2.5);
 assert.deepEqual(r.compared.wells[1],r.base.wells[1]);
 assert.equal(r.base.monthly[0].days,29);near(r.base.monthly[0].capacityBbl,r.base.totalAvailableStbd*29);
 const m=r.base.monthly[0];near(m.allocations.reduce((s,a)=>s+a.allocatedBbl,0)+m.shortfallBbl,m.demandBbl);for(const a of m.allocations)near(a.onstreamStbd,a.averageStbd/0.9);
 assert.equal(r.base.firstShortfallMonth,'2028-02');near(r.base.totalShortfallBbl,m.shortfallBbl);
});
test('surface bound uses monotonic bisection and produces pressure at declared maximum',()=>{
 const r=engine.buildDisposalCase({...input,wells:[{...well,surfaceLimitPsia:1600,innerDiameterInches:2}],comparison:{...input.comparison,innerDiameterInches:2}}),w=r.base.wells[0];
 assert.ok(w.capacity.maximumStbd<7500);near(engine.hydraulicPoint(w.well,r.fluidProperties,w.capacity.maximumStbd).requiredSurfacePsia,1600,1e-10);
 assert.ok(engine.hydraulicPoint(w.well,r.fluidProperties,w.capacity.maximumStbd).requiredSurfacePsia<=1600);assert.ok(w.capacity.surfaceResidualPsi>=0);
 const positive=w.curve.filter(p=>p.status==='flowing');for(let i=1;i<positive.length;i++)assert.ok(positive[i].requiredSurfacePsia>positive[i-1].requiredSurfacePsia);
});
test('selected diameter sensitivity changes only its well and operating ceiling remains binding',()=>{
 const tight={...well,innerDiameterInches:2,surfaceLimitPsia:1600};
 const r=engine.buildDisposalCase({...input,wells:[tight,{...well,id:'FICTIONAL-B'}],comparison:{...input.comparison,injectivityMultiplier:1,innerDiameterInches:4,availability:0.9}});
 assert.ok(r.compared.wells[0].capacity.maximumStbd>r.base.wells[0].capacity.maximumStbd);assert.deepEqual(r.compared.wells[1],r.base.wells[1]);
 const capped=engine.buildDisposalCase({...input,wells:[{...well,operatingCeilingStbd:2000}]}).base.wells[0];near(capped.capacity.maximumStbd,2000);assert.ok(capped.capacity.limitingConstraints.includes('operating ceiling'));
});
test('low surface pressure is explicit unsupported operation and never clamped',()=>{
 const r=engine.buildDisposalCase({...input,wells:[{...well,tvdFt:5000,measuredDepthFt:5500}],demand:{...input.demand,monthly:[{month:'2028-02',demandBbl:29}]}});
 assert.ok(r.base.wells[0].capacity.maximumStbd>0);const m=r.base.monthly[0],a=m.allocations[0];assert.equal(m.operatingFeasible,false);assert.equal(a.operatingFeasible,false);assert.ok(a.hydraulics.requiredSurfacePsia<100);assert.match(a.reason,/gravity|control|minimum/i);
});
test('shut-in and unavailable wells have no flowing pressures and safe zero allocation',()=>{
 const r=engine.buildDisposalCase({...input,wells:[{...well,availability:0},{...well,id:'FICTIONAL-B',limitPsia:1900}]});
 near(r.base.totalAvailableStbd,0);for(const m of r.base.monthly)for(const a of m.allocations){near(a.averageStbd,0);near(a.onstreamStbd,0);assert.equal(a.hydraulics.status,'shut-in');assert.equal(a.hydraulics.requiredSurfacePsia,null);}
 const r2=engine.buildDisposalCase(input);assert.equal(r2.base.monthly[1].allocations[0].hydraulics.bottomholePsia,null);
});
test('bounded inputs, unique identities and months reject malformed or ambiguous data',()=>{
 for(const change of [{caseName:''},{wells:[]},{wells:[well,well]},{wells:[{...well,tvdFt:3501}]},{wells:[{...well,innerDiameterInches:0}]},{wells:[{...well,roughnessInches:5}]},{wells:[{...well,reservoirPsia:Infinity}]},{wells:[{...well,limitDatum:'elsewhere'}]},{wells:[{...well,measuredDepthFt:1e300}]},{fluid:{...input.fluid,referencePressurePsia:99}},{comparison:{...input.comparison,wellId:'missing'}},{comparison:{...input.comparison,injectivityMultiplier:0}},{demand:{...input.demand,monthly:[{month:'2028-02',demandBbl:NaN}]}},{demand:{...input.demand,monthly:[{month:'2028-02',demandBbl:1},{month:'2028-02',demandBbl:2}]}}])assert.throws(()=>engine.buildDisposalCase({...input,...change}));
 assert.throws(()=>engine.hydraulicPoint(well,{...props,viscosityCp:0},1));assert.throws(()=>engine.hydraulicPoint(well,props,-1));
});
test('cloned assumptions, fixed reference PVT and pinned source provenance are retained',()=>{
 const copy=structuredClone(input),r=engine.buildDisposalCase(copy);copy.wells[0].reservoirPsia=3000;copy.demand.evidence.fixture='mutated';
 assert.equal(r.inputs.wells[0].reservoirPsia,2000);assert.equal(r.inputs.demand.evidence.fixture,'seed-417/v1');assert.deepEqual(r.fluidProperties,brine.brineAtPressure(2000,180,5));assert.equal(r.provenance.pvt.liveMcpCall,false);assert.match(r.provenance.pvt.referenceFixture.sha256,/^[a-f0-9]{64}$/);assert.ok(r.provenance.pvt.files.length>=3);assert.match(r.limitations.join(' '),/uniform|fixed/i);assert.match(r.limitations.join(' '),/sustainable/i);
 for(const pin of [...r.provenance.pvt.files,r.provenance.pvt.referenceFixture])assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../reference/pyrestoolbox-pvt/'+pin.name,import.meta.url))).digest('hex'),pin.sha256);
});
test('full confirmed import demand identity survives without truncation',()=>{
 const id=JSON.stringify({source:'confirmed-import',mapping:'x'.repeat(5000)}),r=engine.buildDisposalCase({...input,demand:{...input.demand,id}});
 assert.equal(r.inputs.demand.id,id);assert.equal(r.provenance.demand.id,id);assert.ok(engine.disposalCaseCsv(r).includes(id.replaceAll('"','""')));
});
test('CSV contains complete matching scenarios and neutralizes arbitrary formula text',()=>{
 const r=engine.buildDisposalCase({...input,caseName:'=1+1',demand:{...input.demand,id:'@demand',origin:'+user',content:'-assumed'},wells:input.wells.map(w=>({...w,datum:'=formation',reservoirDatum:'=formation',limitDatum:'=formation'}))}),csv=engine.disposalCaseCsv(r);
 assert.ok(csv.includes("'=1+1"));assert.ok(csv.includes("'@demand"));assert.ok(csv.includes("'+user"));assert.ok(csv.includes("'-assumed"));assert.ok(csv.includes(r.provenance.pvt.referenceFixture.sha256));
 for(const s of [r.base,r.compared]){for(const m of s.monthly){assert.ok(csv.includes(String(m.demandBbl)));for(const a of m.allocations)assert.ok(csv.includes(String(a.onstreamStbd)));}for(const w of s.wells)for(const p of w.curve)if(p.requiredSurfacePsia!==null)assert.ok(csv.includes(String(p.requiredSurfacePsia)));}
 for(const mutate of [x=>x.base.totalAvailableStbd++,x=>x.inputs.wells[0].availability=0,x=>x.base.monthly[0].demandBbl++,x=>x.base.wells[0].curve[1].requiredSurfacePsia++,x=>x.provenance.pvt.referenceFixture.sha256='bad',x=>x.base.monthly[0].allocations[0].reason=NaN]){const bad=structuredClone(r);mutate(bad);assert.throws(()=>engine.disposalCaseCsv(bad),/changed|match|stale|tamper/i);}
});
