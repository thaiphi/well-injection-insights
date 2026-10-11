import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const directory=process.env.DISPOSAL_ENGINE_DIR??'dist';
const engine=await import(pathToFileURL(resolve(directory,'wellboreTraverse.js'))).catch(()=>({}));
const disposal=await import(pathToFileURL(resolve(directory,'disposalCase.js')));
const pvt=await import(pathToFileURL(resolve(directory,'brinePvt.js')));
const well={id:'FICTIONAL-A',reservoirPsia:2000,limitPsia:3500,injectivityStbdPerPsi:5,operatingCeilingStbd:10000,availability:0.9,datum:'formation',reservoirDatum:'formation',limitDatum:'formation',reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',tvdFt:3000,measuredDepthFt:3500,innerDiameterInches:5,roughnessInches:0.0006,surfaceLimitPsia:5000};
const fluid={referencePressurePsia:2000,temperatureF:180,salinityWtPercent:5};
const settings={model:'segmented-brine',surfaceTemperatureF:80,segments:32};
const input={caseName:'Segmented fictional case',demand:{id:'synthetic-demand/1',origin:'synthetic',content:'fictional',monthly:[{month:'2028-02',demandBbl:300000},{month:'2028-03',demandBbl:0}],evidence:{fixture:'seed-417/v1'}},wells:[well],fluid,hydraulics:settings,comparison:{wellId:well.id,injectivityMultiplier:1,innerDiameterInches:5,availability:0.8}};
const props={pressurePsia:2000,bwRbPerStb:1,densityKgPerM3:1000,densityLbPerFt3:1000/16.01846337396014,viscosityCp:1,compressibilityPerPsi:0.000003};
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const constant=(rate,boundary={location:'surface',pressurePsia:1500},geometry=well)=>engine.integrateWellbore({well:geometry,rateStbd:rate,surfaceTemperatureF:80,bottomholeTemperatureF:80,segments:16,boundary},()=>props);
test('segmented engine exists before opt-in can be used',()=>assert.equal(typeof engine.traverseBrineWell,'function'));
test('constant fluid laminar gravity and friction follow independent Hagen-Poiseuille',()=>{
 const r=constant(1),q=0.158987294928/86400,d=5*0.0254;
 const gravity=1000*9.80665*3000*0.3048/6894.757293168;
 const friction=128*0.001*(3500*0.3048)*q/(Math.PI*d**4)/6894.757293168;
 near(r.hydrostaticPsi,gravity);near(r.frictionPsi,friction);near(r.bottomholePsia,1500+gravity-friction);assert.equal(r.points.at(-1).regime,'laminar');
 const flat=constant(1,undefined,{...well,tvdFt:0});near(flat.hydrostaticPsi,0);assert.ok(flat.bottomholePsia<1500);
});
test('constant turbulent factors and Darcy losses agree with independent Colebrook anchors',()=>{
 for(const rate of [1000,5000,10000]){
  const r=constant(rate),node=r.points[0],relative=0.0006/5;
  let f=0.02;for(let i=0;i<100;i++)f=1/(-2*Math.log10(relative/3.7+2.51/(node.reynolds*Math.sqrt(f))))**2;
  assert.ok(Math.abs(node.darcyFrictionFactor-f)/f<0.0001);
  near(r.frictionPsi,node.darcyFrictionFactor*(3500*0.3048/(5*0.0254))*1000*node.velocityMPerSecond**2/2/6894.757293168);
 }
});
test('source brine traverses preserve local mass, temperature endpoints and reversed boundary solution',()=>{
 const r=engine.traverseBrineWell({well,fluid,settings,rateStbd:5000,boundary:{location:'bottomhole',pressurePsia:3000}});
 const mass=r.points[0].massFlowKgPerSecond;
 for(const n of r.points){near(n.massFlowKgPerSecond,mass,1e-11);near(n.localFlowM3PerSecond,5000*n.bwRbPerStb*0.158987294928/86400,1e-12);near(n.densityKgPerM3*n.bwRbPerStb,r.points[0].densityKgPerM3*r.points[0].bwRbPerStb,1e-11);}
 near(r.points[0].temperatureF,80);near(r.points.at(-1).temperatureF,180);
 const forward=engine.traverseBrineWell({well,fluid,settings,rateStbd:5000,boundary:{location:'surface',pressurePsia:r.surfacePsia}});near(forward.bottomholePsia,3000,1e-8);
 near(r.surfacePsia,3000-r.hydrostaticPsi+r.frictionPsi,1e-10);
 assert.ok(r.maximumVelocityMPerSecond<5);assert.ok(r.maximumKineticHeadPsi>0);assert.match(r.diagnostics.join(' '),/acceleration|kinetic/i);
});
test('refinement converges and reports explicit numerical resolution',()=>{
 const request={well:{...well,innerDiameterInches:2},fluid,settings:{...settings,segments:8},rateStbd:2000,boundary:{location:'bottomhole',pressurePsia:3000}};
 const a=engine.traverseBrineWell(request),b=engine.traverseBrineWell({...request,settings:{...settings,segments:32}}),c=engine.traverseBrineWell({...request,settings:{...settings,segments:128}});
 assert.ok(Math.abs(b.surfacePsia-c.surfacePsia)<Math.abs(a.surfacePsia-c.surfacePsia)+1e-10);assert.ok(c.convergenceResidualPsi<=0.01);assert.ok(c.segmentsUsed>=128);
});
test('pressure domains, horizontal temperature ambiguity and velocity limit fail explicitly',()=>{
 assert.throws(()=>engine.traverseBrineWell({well:{...well,tvdFt:5000,measuredDepthFt:5500},fluid,settings,rateStbd:1,boundary:{location:'bottomhole',pressurePsia:2000}}),/domain|100/i);
 assert.throws(()=>engine.traverseBrineWell({well:{...well,tvdFt:0},fluid,settings,rateStbd:1000,boundary:{location:'bottomhole',pressurePsia:3000}}),/horizontal|temperature/i);
 assert.throws(()=>constant(100000),/velocity|5 m/i);
 for(const segments of [0,1.5,257])assert.throws(()=>engine.traverseBrineWell({well,fluid,settings:{...settings,segments},rateStbd:1000,boundary:{location:'bottomhole',pressurePsia:2500}}),/segments/i);
});
test('opt-in couples capacity with formation boundary and availability exactly once',()=>{
 const r=disposal.buildDisposalCase(input),a=r.base.wells[0],b=r.compared.wells[0];
 near(a.capacity.maximumStbd,7500);near(a.capacity.availableStbd,6750);near(b.capacity.availableStbd,6000);
 const point=a.curve.at(-1);near(point.bottomholePsia,3500);assert.ok(point.traverse.points.length>32);near(point.requiredSurfacePsia,point.traverse.surfacePsia);
 assert.equal(r.base.monthly[1].allocations[0].hydraulics.status,'shut-in');assert.equal(r.base.monthly[1].allocations[0].hydraulics.requiredSurfacePsia,null);
 assert.ok(r.methodVersion.includes('segmented'));assert.match(r.methods.fluid,/local|pressure.*temperature/i);assert.equal(r.provenance.pvt.liveMcpCall,false);
});
test('surface capacity is bounded by an actual valid pressure bracket',()=>{
 const r=disposal.buildDisposalCase({...input,wells:[{...well,innerDiameterInches:2,surfaceLimitPsia:1600}],comparison:{...input.comparison,innerDiameterInches:2}}),a=r.base.wells[0];
 assert.ok(a.capacity.maximumStbd>0&&a.capacity.maximumStbd<7500);near(a.curve.at(-1).requiredSurfacePsia,1600,1e-8);assert.ok(a.capacity.surfaceResidualPsi>=-1e-8);
});
test('unsupported low allocations remain explicit, and absence of a capacity anchor blocks the case',()=>{
 const r=disposal.buildDisposalCase({...input,wells:[{...well,tvdFt:5000,measuredDepthFt:5500}],demand:{...input.demand,monthly:[{month:'2028-02',demandBbl:29}]}}),a=r.base.monthly[0].allocations[0];
 assert.equal(a.operatingFeasible,false);assert.equal(a.hydraulics.status,'unsupported');assert.equal(a.hydraulics.requiredSurfacePsia,null);assert.match(a.reason,/domain|100|unsupported/i);
 assert.throws(()=>disposal.buildDisposalCase({...input,wells:[{...well,tvdFt:30000,measuredDepthFt:30000}]}),/anchor|domain|unsupported|capacity/i);
});
test('uniform omission remains identical and explicit zero capacities remain shut-in',()=>{
 const {hydraulics,...uniform}=input,a=disposal.buildDisposalCase(uniform);assert.equal(a.methodVersion,disposal.DISPOSAL_CASE_VERSION);assert.deepEqual(a.base.wells[0].curve[20],disposal.hydraulicPoint(well,pvt.brineAtPressure(2000,180,5),3750));
 const r=disposal.buildDisposalCase({...input,wells:[{...well,operatingCeilingStbd:0}]});near(r.base.totalAvailableStbd,0);assert.equal(r.base.wells[0].curve[0].status,'shut-in');
});
test('complete variable traverse is exported and checked by recomputation',()=>{
 const r=disposal.buildDisposalCase(input),csv=disposal.disposalCaseCsv(r);assert.ok(csv.includes('segmented'));assert.ok(csv.includes('massFlowKgPerSecond'));assert.ok(csv.includes(r.provenance.pvt.referenceFixture.sha256));
 const bad=structuredClone(r);bad.base.wells[0].curve[1].traverse.points[0].pressurePsia++;assert.throws(()=>disposal.disposalCaseCsv(bad),/changed|stale|match/i);
});
test('reused Nexus friction source identity and PVT lineage are retained separately',()=>{
 const r=disposal.buildDisposalCase(input),source=r.provenance.wellboreFrictionSource;
 assert.equal(source.sha256,createHash('sha256').update(readFileSync(new URL('../reference/nexus-wellbore/serghides.ts',import.meta.url))).digest('hex'));
 assert.match(source.conversion,/4|four/i);assert.match(r.methods.frictionFactor,/Serghides/);assert.equal(r.provenance.pvt.library,'pyResToolbox local source snapshot');
});
test('manufactured compressible fluid matches independent closed-form gravity-plus-laminar solution',()=>{
 const geometry={...well,measuredDepthFt:3000},c=0.0001,rho0=1000,q0=0.158987294928/86400,d=5*0.0254;
 const fluidAt=p=>{const density=rho0*(1+c*(p-1500));return {...props,densityKgPerM3:density,bwRbPerStb:rho0/density};};
 const a=9.80665/6894.757293168,b=128*0.001*q0*rho0/(Math.PI*d**4*6894.757293168);
 const squaredDensity=(rho0**2-b/a)*Math.exp(2*rho0*c*a*3000*0.3048)+b/a;
 const expected=1500+(Math.sqrt(squaredDensity)/rho0-1)/c;
 const r=engine.integrateWellbore({well:geometry,rateStbd:1,surfaceTemperatureF:80,bottomholeTemperatureF:80,segments:8,boundary:{location:'surface',pressurePsia:1500}},fluidAt);
 near(r.bottomholePsia,expected,1e-9);
});
test('variable PVT solver agrees with independent fine-step midpoint integration',()=>{
 const r=engine.traverseBrineWell({well,fluid,settings,rateStbd:5000,boundary:{location:'bottomhole',pressurePsia:3000}}),n=10000,h=well.measuredDepthFt*0.3048/n,d=well.innerDiameterInches*0.0254,area=Math.PI*d*d/4;
 const derivative=(md,p)=>{
  const local=pvt.brineAtPressure(p,80+100*md/(well.measuredDepthFt*0.3048),5),v=5000*local.bwRbPerStb*0.158987294928/86400/area,re=local.densityKgPerM3*v*d/(local.viscosityCp*0.001);
  let factor=0.02;for(let i=0;i<25;i++)factor=1/(-2*Math.log10(well.roughnessInches/well.innerDiameterInches/3.7+2.51/(re*Math.sqrt(factor))))**2;
  return (local.densityKgPerM3*9.80665*well.tvdFt/well.measuredDepthFt-factor*local.densityKgPerM3*v*v/(2*d))/6894.757293168;
 };
 let pressure=3000;
 for(let i=0;i<n;i++){const md=(n-i)*h,k=derivative(md,pressure);pressure-=h*derivative(md-h/2,pressure-h*k/2);}
 near(r.surfacePsia,pressure,1e-7);
});
test('coarse RK stage domain overshoot is refined before rejecting a valid pressure solution',()=>{
 const geometry={...well,tvdFt:0},q=0.158987294928/86400,d=5*0.0254,k=0.02;
 const viscosityCpPerPsi=k*Math.PI*d**4*6894.757293168/(128*q)*1000;
 const fluidAt=p=>({...props,viscosityCp:viscosityCpPerPsi*(p-100)});
 const r=engine.integrateWellbore({well:geometry,rateStbd:1,surfaceTemperatureF:80,bottomholeTemperatureF:80,segments:8,boundary:{location:'surface',pressurePsia:1500}},fluidAt);
 near(r.bottomholePsia,100+1400*Math.exp(-k*3500*0.3048),1e-7);assert.ok(r.segmentsUsed>=32);
});
test('velocity-limited joint upper rate cannot masquerade as a surface-limited capacity',()=>{
 assert.throws(()=>disposal.buildDisposalCase({...input,wells:[{...well,innerDiameterInches:2,surfaceLimitPsia:10000,limitPsia:10000,injectivityStbdPerPsi:100,operatingCeilingStbd:100000}],comparison:{...input.comparison,innerDiameterInches:2}}),/bracket|velocity|unsupported/i);
});
test('cancelling gravity and friction still require convergence of each pressure contribution',()=>{
 const geometry={...well,tvdFt:3000,measuredDepthFt:3000},q0=0.158987294928/86400,d=5*0.0254;
 const fluidAt=(p,t)=>{
  const rho=1000*(1+0.1*Math.sin(17*Math.PI*(t-80)/100));
  const mu=rho*rho*9.80665*Math.PI*d**4/(128*q0*1000);
  return {...props,densityKgPerM3:rho,bwRbPerStb:1000/rho,viscosityCp:mu*1000};
 };
 const r=engine.integrateWellbore({well:geometry,rateStbd:1,surfaceTemperatureF:80,bottomholeTemperatureF:180,segments:8,boundary:{location:'surface',pressurePsia:1500}},fluidAt);
 const expected=1000*9.80665*3000*0.3048/6894.757293168*(1+0.2/(17*Math.PI));
 near(r.bottomholePsia,1500);near(r.hydrostaticPsi,expected,1e-6);near(r.frictionPsi,expected,1e-6);assert.ok(r.segmentsUsed>16);
});
test('temperature-domain endpoints survive backward floating-point depth roundoff',()=>{
 const r=engine.traverseBrineWell({well:{...well,measuredDepthFt:100,tvdFt:80},fluid:{...fluid,temperatureF:250},settings:{...settings,surfaceTemperatureF:60,segments:8},rateStbd:100,boundary:{location:'bottomhole',pressurePsia:4000}});
 near(r.points[0].temperatureF,60);near(r.points.at(-1).temperatureF,250);for(const p of r.points)assert.ok(p.temperatureF>=60&&p.temperatureF<=250);
});
test('case and export reject evidence that JSON would erase or execute',()=>{
 const extended=[];extended.note='UNIQUE_PROVENANCE_MARKER';
 const sparse=Array(2),hidden={};Object.defineProperty(hidden,'note',{value:'hidden'});
 let reads=0;const accessor={};Object.defineProperty(accessor,'note',{get(){reads++;return 'getter';},enumerable:true});
 for(const evidence of [extended,sparse,hidden,accessor])assert.throws(()=>disposal.buildDisposalCase({...input,demand:{...input.demand,evidence}}),/JSON|evidence|arrays|accessors/i);
 assert.equal(reads,0);
 const r=disposal.buildDisposalCase(input);r.base.wells[0].curve.note='UNIQUE_PROVENANCE_MARKER';assert.throws(()=>disposal.disposalCaseCsv(r),/JSON|evidence|changed|tamper/i);
 const clean=disposal.buildDisposalCase(input);Object.defineProperty(clean,'secret',{value:'hidden'});assert.throws(()=>disposal.disposalCaseCsv(clean),/JSON|evidence|changed|tamper/i);
});
