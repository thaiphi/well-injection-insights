import test from 'node:test';import assert from 'node:assert/strict';
import {reconcile,reportDepth,RECON_REASONS as R,CAUSE_CHECKLIST,SCREENING_TEXT,FORMATION_TEXT,SRT_NOTE,LABEL_RECON,RECONCILIATION_VERSION,FORMULAS,LIMITATIONS,DIFFERENTIAL_LABEL,PERMIT_EQ_LABEL} from '../dist/pressureReconciliation.js';
import {createEstimateState,confirmBasis,setSurfaceBasis,setAssumptions,estimate} from '../dist/injectivityEstimate.js';
import {DEFAULT_WELL_ASSUMPTIONS,flowingAt} from '../dist/wellAssumptions.js';
import {TraverseError,traverseBrineWell} from '../dist/wellboreTraverse.js';
import {applyDecision} from '../dist/h10Diagnostics.js';
import {applyTestDecision} from '../dist/testRecords.js';
import {fixtureInputs,monthlyRow,bhpRow} from './helpers/injectivity-fixture.mjs';

const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const WELL={...DEFAULT_WELL_ASSUMPTIONS,surfaceBasis:{value:'psig',reason:'RRC H-10 reports gauge pressure'}};
const jFor=(inputs,well=WELL,bhp='psig')=>estimate(confirmBasis(setSurfaceBasis(setAssumptions(createEstimateState(inputs),well),well.surfaceBasis),bhp,'RRC Permian guidance'));
const rin=(o={})=>{const inputs=o.inputs??fixtureInputs(),well=o.well??WELL;
 return {h10:inputs.h10,tests:inputs.tests,well,j:'j' in o?o.j:jFor(inputs,well),permit:o.permit??{surfacePsi:1176,topDepthFt:3000},declaredLimit:o.declaredLimit??null};};
const row=(rec,m)=>rec.rows.find(r=>r.month===m);
const pwf=(depth,surfacePsia,id=3.958,rate=10000)=>traverseBrineWell({well:{tvdFt:depth,measuredDepthFt:depth,innerDiameterInches:id,roughnessInches:0.0006,bottomholeTemperatureF:100},
 fluid:{referencePressurePsia:surfacePsia,temperatureF:100,salinityWtPercent:10},settings:{model:'segmented-brine',surfaceTemperatureF:70,segments:32},rateStbd:rate,boundary:{location:'surface',pressurePsia:surfacePsia}});

test('identity and fixed wording',()=>{
 const rec=reconcile(rin());assert.equal(rec.version,RECONCILIATION_VERSION);assert.equal(rec.version,'pressure-reconciliation/1');assert.equal(rec.label,LABEL_RECON);assert.equal(rec.label,'WHP/BHP reconciliation (screening)');
 assert.equal(rec.screening,'Screening only: not a regulatory approval, compliance finding or safe-operating determination.');assert.equal(rec.formation,FORMATION_TEXT);assert.equal(FORMATION_TEXT,'Not evaluated in this phase');
 assert.doesNotMatch(JSON.stringify({rec,FORMULAS,LIMITATIONS,R}),new RegExp('calib'+'rated','i'));assert.ok(LIMITATIONS.includes(SCREENING_TEXT));
});
test('nothing is computed until the surface basis is confirmed',()=>{
 const rec=reconcile(rin({well:DEFAULT_WELL_ASSUMPTIONS,j:null}));
 assert.deepEqual(rec.rows,[]);assert.equal(rec.readiness,'Confirm the H-10 and permit pressure basis in Well assumptions.');assert.equal(rec.counts.months,0);
});
test('report depth: 1b reference depth, then permitted top (with tie note), then none',()=>{
 assert.deepEqual(reportDepth({referenceDepthFt:3310,referenceTie:false},3000),{depthFt:3310,source:'BHP test depth'});
 assert.deepEqual(reportDepth({referenceDepthFt:null,referenceTie:false},3000),{depthFt:3000,source:'permitted top of interval (RRC guidance)'});
 assert.deepEqual(reportDepth({referenceDepthFt:3310,referenceTie:true},3000),{depthFt:3000,source:'permitted top of interval (RRC guidance); BHP test depths tie'});
 assert.deepEqual(reportDepth({referenceDepthFt:null,referenceTie:false},null),{depthFt:null,source:'none'});
 assert.deepEqual(reportDepth({referenceDepthFt:null,referenceTie:false},0),{depthFt:null,source:'none'});
});
test('modelled flowing BHP: P_bh = P_wh + hydro - friction at the report depth, equal to a direct traverse',()=>{
 const r=row(reconcile(rin()),'2024-02'),t=pwf(3310,914.7);
 assert.equal(r.status,'included');near(r.surfacePsia,914.7);assert.equal(r.modelled.pwfPsia,t.bottomholePsia);assert.equal(r.modelled.hydroPsi,t.hydrostaticPsi);assert.equal(r.modelled.frictionPsi,t.frictionPsi);
 near(r.modelled.pwfPsia,914.7+r.modelled.hydroPsi-r.modelled.frictionPsi,1e-6);assert.equal(r.modelled.reason,null);
});
test('regulatory margin = permit - reported maximum on one basis; never the average',()=>{
 const r=row(reconcile(rin()),'2024-02');assert.equal(r.regulatory.marginPsi,1176-950);assert.equal(r.regulatory.abovePermit,false);
 const over=row(reconcile(rin({permit:{surfacePsi:900,topDepthFt:null}})),'2024-02');assert.equal(over.regulatory.marginPsi,-50);assert.equal(over.regulatory.abovePermit,true);
 const none=row(reconcile(rin({permit:{surfacePsi:null,topDepthFt:null}})),'2024-02');assert.equal(none.regulatory.marginPsi,null);assert.equal(none.regulatory.reason,R.noPermit);
 const rows=[monthlyRow('2024-01',10000,900),{...monthlyRow('2024-02',10000,900),reported_max_injection_pressure_psi:null}];
 const nm=row(reconcile(rin({inputs:fixtureInputs({monthly:rows})})),'2024-02');assert.equal(nm.regulatory.marginPsi,null);assert.equal(nm.regulatory.reason,R.noMax);assert.notEqual(nm.modelled.pwfPsia,null);
});
test('every month status and refusal, in order, with nothing zero-filled',()=>{
 const base=fixtureInputs();
 assert.equal(row(reconcile(rin()),'2024-05').status,'excluded');assert.equal(row(reconcile(rin()),'2024-05').modelled.reason,R.excluded);assert.equal(row(reconcile(rin()),'2024-05').regulatory.marginPsi,null);
 const gap=fixtureInputs({monthly:[monthlyRow('2024-01',10000,900),monthlyRow('2024-03',10000,900)]});const g=row(reconcile(rin({inputs:gap})),'2024-02');
 assert.equal(g.status,'gap');assert.equal(g.modelled.pwfPsia,null);assert.equal(g.regulatory.marginPsi,null);assert.equal(g.modelled.reason,R.gap);
 const zero=fixtureInputs({monthly:[monthlyRow('2024-01',10000,900),monthlyRow('2024-02',0,0)]});zero.h10=applyDecision(zero.h10,'2024-02',true);
 const z=row(reconcile(rin({inputs:zero})),'2024-02');assert.equal(z.modelled.reason,R.noInjection);assert.equal(z.regulatory.reason,R.notApplicable);assert.equal(z.regulatory.marginPsi,null);
 const noAvg={...base};noAvg.h10=applyDecision(base.h10,'2024-05',true);assert.equal(row(reconcile(rin({inputs:noAvg})),'2024-05').modelled.reason,R.noAvg);
 const low=row(reconcile(rin({inputs:fixtureInputs({avg:85})})),'2024-02');assert.equal(low.modelled.reason,R.floor);assert.equal(low.regulatory.marginPsi,1176-135);
 const fast=row(reconcile(rin({well:{...WELL,innerDiameterInches:2.441}})),'2024-02');assert.match(fast.modelled.reason,/^Unsupported by the wellbore traverse: .*5 m\/s/);assert.equal(fast.regulatory.marginPsi,226);
 const nodepth=row(reconcile(rin({inputs:fixtureInputs({bhp:[]}),permit:{surfacePsi:1176,topDepthFt:null}})),'2024-02');assert.equal(nodepth.modelled.reason,R.noDepth);assert.equal(nodepth.regulatory.marginPsi,226);
});
test('a numerical traverse failure becomes "Traverse did not converge", never an exception',()=>{
 const boom=()=>{throw new TraverseError('numerical','Wellbore refinement failed to converge');};
 const rec=reconcile(rin(),{flowingAt:boom});const r=row(rec,'2024-02');assert.equal(r.modelled.reason,R.notConverged);assert.equal(r.regulatory.marginPsi,226);
 assert.equal(rec.counts.refused[R.notConverged],7);
});
test('permit-equivalent BHP: same traverse from the permit pressure; margin = permit-equivalent - modelled',()=>{
 const r=row(reconcile(rin()),'2024-02');near(r.permitEquivalent.pwfPsia,pwf(3310,1190.7).bottomholePsia);near(r.permitEquivalent.marginPsi,r.permitEquivalent.pwfPsia-r.modelled.pwfPsia);
 assert.equal(row(reconcile(rin({permit:{surfacePsi:null,topDepthFt:null}})),'2024-02').permitEquivalent.reason,R.noPermit);
 assert.equal(row(reconcile(rin({inputs:fixtureInputs({avg:85})})),'2024-02').permitEquivalent.reason,R.noModel);
});
test('declared limit: compared within 1 ft of the report depth, blocked at 2 ft, "No limit declared" when unset',()=>{
 const at=row(reconcile(rin({declaredLimit:{psia:4000,depthFt:3311,reason:'design'}})),'2024-02');near(at.declared.marginPsi,4000-at.modelled.pwfPsia);
 const off=row(reconcile(rin({declaredLimit:{psia:4000,depthFt:3312,reason:'design'}})),'2024-02');assert.equal(off.declared.marginPsi,null);assert.equal(off.declared.reason,R.limitDatum);
 assert.equal(row(reconcile(rin()),'2024-02').declared.reason,R.noLimit);
});
test('test months: differential = modelled - static, equal to the J estimate delta; positive here',()=>{
 const inputs=fixtureInputs(),j=jFor(inputs),rec=reconcile(rin({inputs,j})),t=row(rec,'2024-02').tests[0],jt=j.tests.find(x=>x.key==='package:bhp:1');
 assert.equal(t.key,'package:bhp:1');near(t.pResPsia,1719.7);near(t.differentialPsi,jt.deltaPsi);assert.equal(t.negative,false);assert.deepEqual(t.checklist,[]);
 near(t.testGradientPsiFt,1705/3310);near(t.columnGradientPsiFt,row(rec,'2024-02').modelled.hydroPsi/3310);
 assert.equal(row(rec,'2024-05').tests.length,0,'an unmatched (excluded-month) test is not attached');
});
test('negative differential is flagged with the cause checklist',()=>{
 const inputs=fixtureInputs({bhp:[bhpRow(1,'2024-02-12',3000,3310)]}),rec=reconcile(rin({inputs})),t=row(rec,'2024-02').tests[0];
 assert.ok(t.differentialPsi<0);assert.equal(t.negative,true);assert.deepEqual(t.checklist,[...CAUSE_CHECKLIST]);assert.equal(CAUSE_CHECKLIST.length,4);assert.equal(rec.counts.negativeDifferentials,1);
});
test('no BHP basis in the J panel: differential waits with its reason',()=>{
 const inputs=fixtureInputs(),j=estimate(setSurfaceBasis(createEstimateState(inputs),WELL.surfaceBasis));
 const t=row(reconcile(rin({inputs,j})),'2024-02').tests[0];assert.equal(t.differentialPsi,null);assert.equal(t.reason,R.bhpBasis);
 const none=reconcile(rin({inputs,j:null}));assert.equal(row(none,'2024-02').tests.length,0);assert.notEqual(row(none,'2024-02').modelled.pwfPsia,null);
});
test('sensitivity band spans the other basis reading and the tubing sizes; larger ID gives a higher modelled BHP',()=>{
 const r=row(reconcile(rin()),'2024-02');
 near(r.modelled.band.min,pwf(3310,900).bottomholePsia);near(r.modelled.band.max,pwf(3310,914.7,6.276).bottomholePsia);
 assert.ok(pwf(3310,914.7,6.276).bottomholePsia>pwf(3310,914.7,4.892).bottomholePsia&&pwf(3310,914.7,4.892).bottomholePsia>pwf(3310,914.7,3.958).bottomholePsia);
 const t=row(reconcile(rin()),'2024-02').tests[0];near(t.band.min,r.modelled.band.min-1719.7);near(t.band.max,r.modelled.band.max-1719.7);
});
test('counts add up; summary takes the smallest margins; formation never evaluated; SRT note only with step-rate rows',()=>{
 const rec=reconcile(rin({declaredLimit:{psia:4000,depthFt:3310,reason:'design'}})),c=rec.counts;
 assert.equal(c.months,8);assert.equal(c.included,7);assert.equal(c.modelled+Object.values(c.refused).reduce((a,b)=>a+b,0),c.included);
 assert.equal(c.testMonths,2);assert.equal(c.abovePermit,0);assert.equal(rec.summary.minRegulatoryPsi,226);
 assert.equal(rec.summary.minDeclaredPsi,Math.min(...rec.rows.filter(r=>r.declared.marginPsi!==null).map(r=>r.declared.marginPsi)));
 assert.equal(rec.srtPresent,false);assert.ok(!rec.notes.includes(SRT_NOTE));
});
test('flowingAt is the shared helper (no second physics path)',()=>{
 const r=row(reconcile(rin()),'2024-02'),f=flowingAt(3310,WELL,10000,914.7);assert.equal(r.modelled.pwfPsia,f.pwf);
});
test('R2-1: an off-depth test within tolerance is traversed at its own depth and equals the J estimate delta',()=>{
 const inputs=fixtureInputs({bhp:[bhpRow(1,'2024-02-12',1705,3310),bhpRow(2,'2024-07-22',1731,3318)]}),j=jFor(inputs),rec=reconcile(rin({inputs,j}));
 const r=row(rec,'2024-07'),t=r.tests[0],jt=j.tests.find(x=>x.key==='package:bhp:2');
 assert.equal(rec.reportDepth.depthFt,3310);assert.equal(t.depthFt,3318);assert.ok(t.differentialPsi!==null,String(t.reason));
 near(t.differentialPsi,jt.deltaPsi);assert.ok(Math.abs(t.differentialPsi-(r.modelled.pwfPsia-t.pResPsia))>1e-6);
 near(t.columnGradientPsiFt,pwf(3318,914.7).hydrostaticPsi/3318);
 const on=row(rec,'2024-02').tests[0];near(on.differentialPsi,j.tests.find(x=>x.key==='package:bhp:1').deltaPsi);
});
test('RF-1: fixed labels are verbatim',()=>{
 assert.equal(DIFFERENTIAL_LABEL,'flowing minus static differential, not a model error');
 assert.equal(PERMIT_EQ_LABEL,'restates the permit limit at depth; not an independent constraint');
});
test('RF-1: a J test is attached only while the current tests input still includes it (stale J guard)',()=>{
 const inputs=fixtureInputs(),j=jFor(inputs);assert.ok(row(reconcile(rin({inputs,j})),'2024-02').tests.length>0);
 const stale={...inputs,tests:applyTestDecision(inputs.tests,'package:bhp:1',false,'excluded after the J estimate')};
 const rec=reconcile({...rin({inputs:stale,j}),tests:stale.tests});assert.equal(row(rec,'2024-02').tests.length,0);
});
