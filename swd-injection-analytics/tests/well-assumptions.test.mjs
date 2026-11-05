import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULT_ASSUMPTIONS,DEFAULT_WELL_ASSUMPTIONS,toAbsolute,otherBasis,confirmSurfaceBasis,setWellAssumptions,validateDeclaredLimit,validateAssumptions,flowingAt,
 SURFACE_BASIS_PROMPT,LIMIT_DATUM_TOLERANCE_FT,ATMOSPHERE_PSI} from '../dist/wellAssumptions.js';
import {traverseBrineWell} from '../dist/wellboreTraverse.js';

const direct=(depth,surfacePsia,id=3.958,rate=10000)=>traverseBrineWell({well:{tvdFt:depth,measuredDepthFt:depth,innerDiameterInches:id,roughnessInches:0.0006,bottomholeTemperatureF:100},
 fluid:{referencePressurePsia:surfacePsia,temperatureF:100,salinityWtPercent:10},settings:{model:'segmented-brine',surfaceTemperatureF:70,segments:32},rateStbd:rate,boundary:{location:'surface',pressurePsia:surfacePsia}});

test('defaults are the 1c defaults and the surface basis starts unconfirmed',()=>{
 assert.deepEqual({...DEFAULT_ASSUMPTIONS},{innerDiameterInches:3.958,roughnessInches:0.0006,surfaceTemperatureF:70,bottomholeTemperatureF:100,salinityWtPercent:10,segments:32});
 assert.equal(DEFAULT_WELL_ASSUMPTIONS.surfaceBasis,null);assert.equal(SURFACE_BASIS_PROMPT,'Confirm the H-10 and permit pressure basis in Well assumptions.');assert.equal(LIMIT_DATUM_TOLERANCE_FT,1);
});
test('toAbsolute adds 14.7 psi only for psig; otherBasis flips',()=>{
 assert.equal(toAbsolute(900,'psig'),900+ATMOSPHERE_PSI);assert.equal(toAbsolute(900,'psia'),900);assert.equal(otherBasis('psig'),'psia');assert.equal(otherBasis('psia'),'psig');
});
test('surface basis confirmation needs a known value and a 1-200 character reason',()=>{
 assert.throws(()=>confirmSurfaceBasis(DEFAULT_WELL_ASSUMPTIONS,'bar','x'),/psig or psia/);
 assert.throws(()=>confirmSurfaceBasis(DEFAULT_WELL_ASSUMPTIONS,'psig',' '),/reason/);assert.throws(()=>confirmSurfaceBasis(DEFAULT_WELL_ASSUMPTIONS,'psig','x'.repeat(201)),/reason/);
 assert.deepEqual(confirmSurfaceBasis(DEFAULT_WELL_ASSUMPTIONS,'psig',' RRC reports gauge ').surfaceBasis,{value:'psig',reason:'RRC reports gauge'});
});
test('setWellAssumptions validates, never clamps, and keeps the surface basis',()=>{
 const w=confirmSurfaceBasis(DEFAULT_WELL_ASSUMPTIONS,'psig','x');
 const n=setWellAssumptions(w,{salinityWtPercent:12});assert.equal(n.salinityWtPercent,12);assert.deepEqual(n.surfaceBasis,w.surfaceBasis);
 for(const [k,v] of [['innerDiameterInches',0.1],['roughnessInches',0.2],['surfaceTemperatureF',50],['bottomholeTemperatureF',300],['salinityWtPercent',21],['segments',8.5]])
  assert.throws(()=>setWellAssumptions(w,{[k]:v}));
 assert.deepEqual(validateAssumptions({...DEFAULT_WELL_ASSUMPTIONS}),{...DEFAULT_ASSUMPTIONS});
});
test('declared limit: bounds and a reason; numbers parsed from text',()=>{
 assert.deepEqual(validateDeclaredLimit({psia:'4000',depthFt:'3310',reason:' design '}),{psia:4000,depthFt:3310,reason:'design'});
 assert.throws(()=>validateDeclaredLimit({psia:50,depthFt:3310,reason:'x'}),/Bottomhole limit/);assert.throws(()=>validateDeclaredLimit({psia:'',depthFt:3310,reason:'x'}),/Bottomhole limit/);
 assert.throws(()=>validateDeclaredLimit({psia:4000,depthFt:0,reason:'x'}),/Limit depth/);assert.throws(()=>validateDeclaredLimit({psia:4000,depthFt:3310,reason:''}),/reason/);
});
test('flowingAt equals a direct surface-boundary traverse and honours the ID override',()=>{
 const f=flowingAt(3310,DEFAULT_ASSUMPTIONS,10000,914.7),t=direct(3310,914.7);
 assert.equal(f.pwf,t.bottomholePsia);assert.equal(f.hydro,t.hydrostaticPsi);assert.equal(f.friction,t.frictionPsi);
 assert.equal(flowingAt(3310,DEFAULT_ASSUMPTIONS,10000,914.7,6.276).pwf,direct(3310,914.7,6.276).bottomholePsia);
 assert.ok(Math.abs(f.pwf-(914.7+f.hydro-f.friction))<1e-6,'P_bh = P_wh + hydro - friction');
});
test('flowingAt returns an unsupported reason for domain exits, never a clamp',()=>{
 const low=flowingAt(3310,DEFAULT_ASSUMPTIONS,10000,99.7);assert.match(low.reason,/^Unsupported by the wellbore traverse: /);
 const fast=flowingAt(3310,{...DEFAULT_ASSUMPTIONS,innerDiameterInches:2.441},10000,914.7);assert.match(fast.reason,/5 m\/s/);
});
test('flowingAt is the 1c helper moved, not rewritten: J still passes the same arguments',async()=>{
 const src=await readFile('src/injectivityEstimate.ts','utf8');assert.ok(!src.includes('function flowing('));assert.ok(src.includes("from './wellAssumptions.js'"));
});
