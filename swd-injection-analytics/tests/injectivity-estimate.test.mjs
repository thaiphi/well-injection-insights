import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createEstimateState,withInputs,confirmBasis,setSurfaceBasis,setAssumptions,moveMatch,chooseJ,estimate,handoff,validateAssumptions,datumFor,
 REASONS,DEFAULT_ASSUMPTIONS,TUBING_SENSITIVITY_IN,ATMOSPHERE_PSI,LABEL_J,LIMITATIONS,BASIS_STATEMENT,J_ESTIMATE_VERSION} from '../dist/injectivityEstimate.js';
import {traverseBrineWell} from '../dist/wellboreTraverse.js';
import {applyDecision} from '../dist/h10Diagnostics.js';
import {applyTestDecision} from '../dist/testRecords.js';
import {applyHandoff} from '../web/hydraulics.mjs';
import {fixtureInputs,monthlyRow,bhpRow} from './helpers/injectivity-fixture.mjs';

const K=n=>`package:bhp:${n}`;
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const SURFACE_PSIG={value:'psig',reason:'RRC H-10 reports gauge pressure'};
const psig=s=>confirmBasis(setSurfaceBasis(s,SURFACE_PSIG),'psig','RRC Permian guidance');
const byKey=(est,n)=>est.tests.find(t=>t.key===K(n));
const pwf=(depth,surfacePsia,id=3.958,rate=10000)=>traverseBrineWell({well:{tvdFt:depth,measuredDepthFt:depth,innerDiameterInches:id,roughnessInches:0.0006,bottomholeTemperatureF:100},
 fluid:{referencePressurePsia:surfacePsia,temperatureF:100,salinityWtPercent:10},settings:{model:'segmented-brine',surfaceTemperatureF:70,segments:32},rateStbd:rate,boundary:{location:'surface',pressurePsia:surfacePsia}});

test('matches show before either basis is confirmed, with no J',()=>{
 const e0=estimate(createEstimateState(fixtureInputs())),t0=byKey(e0,1);
 assert.equal(t0.status,'awaiting-basis');assert.equal(t0.reason,REASONS.surfaceBasis);assert.equal(t0.month,'2024-02');assert.equal(t0.surfacePsi,900);assert.equal(t0.surfacePsia,null);
 assert.equal(e0.readiness,'Confirm the H-10 and permit pressure basis in Well assumptions.');
 const e=estimate(setSurfaceBasis(createEstimateState(fixtureInputs()),SURFACE_PSIG)),t1=byKey(e,1);
 assert.equal(t1.status,'awaiting-basis');assert.equal(t1.reason,REASONS.basis);assert.equal(t1.month,'2024-02');
 assert.equal(t1.rateStbd,10000);near(t1.surfacePsia,914.7);assert.equal(t1.j,null);assert.equal(e.chosenKey,null);
 assert.equal(e.readiness,'Confirm the pressure basis to see test-referenced J.');
});
test('psig basis: P_res = reported + 14.7; P_wf from the surface traverse; J = q/(P_wf - P_res)',()=>{
 const t1=byKey(estimate(psig(createEstimateState(fixtureInputs()))),1),t=pwf(3310,914.7);
 assert.equal(t1.status,'qualifies');near(t1.pResPsia,1705+ATMOSPHERE_PSI);near(t1.pWfPsia,t.bottomholePsia);
 near(t1.hydrostaticPsi,t.hydrostaticPsi);near(t1.frictionPsi,t.frictionPsi);near(t1.deltaPsi,t.bottomholePsia-1719.7);near(t1.j,10000/(t.bottomholePsia-1719.7));
});
test('no-friction check equals q over the gauge surface pressure (R4) and alternate basis uses the reported value',()=>{
 const t1=byKey(estimate(psig(createEstimateState(fixtureInputs()))),1),t=pwf(3310,914.7);
 near(t1.jNoFriction,10000/900);near(t1.jAlternateBasis,10000/(t.bottomholePsia-1705));assert.equal(t1.alternateBasis,'psia');
 const a=byKey(estimate(confirmBasis(setSurfaceBasis(createEstimateState(fixtureInputs()),SURFACE_PSIG),'psia','source field name')),1);
 near(a.pResPsia,1705);near(a.jAlternateBasis,10000/(t.bottomholePsia-1719.7));assert.equal(a.alternateBasis,'psig');
});
test('tubing sensitivity: larger ID, less friction, lower J (R5); first entry equals the default J',()=>{
 const t1=byKey(estimate(psig(createEstimateState(fixtureInputs()))),1);
 assert.deepEqual(t1.jByTubing.map(x=>x.innerDiameterInches),[...TUBING_SENSITIVITY_IN]);
 assert.ok(t1.jByTubing.every(x=>x.j!==null&&x.reason===null));near(t1.jByTubing[0].j,t1.j);
 assert.ok(t1.jByTubing[0].j>t1.jByTubing[1].j&&t1.jByTubing[1].j>t1.jByTubing[2].j);
 const fr=TUBING_SENSITIVITY_IN.map(id=>pwf(3310,914.7,id).frictionPsi);assert.ok(fr[0]>fr[1]&&fr[1]>fr[2]);
});
test('every refusal reason, with nothing clamped',()=>{
 const s=psig(createEstimateState(fixtureInputs()));let e=estimate(s);
 assert.equal(byKey(e,3).status,'refused');assert.equal(byKey(e,3).reason,REASONS.excluded);
 assert.equal(byKey(e,4).status,'unmatched');assert.equal(byKey(e,4).reason,REASONS.monthExcluded);assert.equal(byKey(e,4).month,'2024-05');
 const in3={...fixtureInputs()};in3.tests=applyTestDecision(in3.tests,K(3),true);
 assert.equal(byKey(estimate(psig(createEstimateState(in3))),3).reason,REASONS.depthDiffers(3100,3310));
 const in4={...fixtureInputs()};in4.h10=applyDecision(in4.h10,'2024-05',true);
 assert.equal(byKey(estimate(psig(createEstimateState(in4))),4).reason,REASONS.noAvg);
 const zero=fixtureInputs({monthly:['2024-01','2024-02','2024-03'].map(m=>monthlyRow(m,m==='2024-02'?0:10000,900))});zero.h10=applyDecision(zero.h10,'2024-02',true);
 assert.equal(byKey(estimate(psig(createEstimateState(zero))),1).reason,REASONS.noRate);
 const gap=fixtureInputs({monthly:[monthlyRow('2024-01',10000,900),monthlyRow('2024-03',10000,900)]});
 assert.equal(byKey(estimate(psig(createEstimateState(gap))),1).reason,REASONS.gap);
 const late=fixtureInputs({bhp:[bhpRow(1,'2025-01-05',1705,3310),bhpRow(2,'2023-06-01',1705,3310)]});const le=estimate(psig(createEstimateState(late)));
 assert.equal(byKey(le,1).reason,REASONS.after);assert.equal(byKey(le,2).reason,REASONS.before);
 assert.equal(byKey(estimate(psig(createEstimateState({...fixtureInputs(),h10:null}))),1).reason,REASONS.noH10);
 const low=byKey(estimate(psig(createEstimateState(fixtureInputs({avg:50})))),1);assert.equal(low.status,'refused');assert.equal(low.reason,REASONS.lowSurface);assert.equal(low.j,null);
 const fast=byKey(estimate(setAssumptions(s,{innerDiameterInches:2.441})),1);assert.equal(fast.status,'unsupported');assert.match(fast.reason,/^Unsupported by the wellbore traverse: .*5 m\/s/);assert.equal(fast.pWfPsia,null);
 const high=byKey(estimate(psig(createEstimateState(fixtureInputs({bhp:[bhpRow(1,'2024-02-12',3000,3310)]})))),1);
 assert.equal(high.status,'refused');assert.equal(high.reason,REASONS.notAbove);assert.equal(high.j,null);assert.ok(high.pWfPsia<high.pResPsia);
});
test('a test with no depth, no date or no pressure is refused before matching',()=>{
 const inputs=fixtureInputs({bhp:[bhpRow(1,'2024-02-12',1705,null),bhpRow(2,null,1705,3310),bhpRow(3,'2024-03-12',null,3310)]});
 for(const k of [1,2,3])inputs.tests=applyTestDecision(inputs.tests,K(k),true);
 const e=estimate(psig(createEstimateState(inputs)));
 assert.equal(byKey(e,1).reason,REASONS.noDepth);assert.equal(byKey(e,2).reason,REASONS.noDate);assert.equal(byKey(e,3).reason,REASONS.noPressure);
});
test('a moved match needs a reason, is recorded and changes the matched month',()=>{
 const s=psig(createEstimateState(fixtureInputs()));
 assert.throws(()=>moveMatch(s,K(4),-1,' '),/reason/);assert.throws(()=>moveMatch(s,K(4),2,'x'),/previous or next/);assert.throws(()=>moveMatch(s,'nope',1,'x'),/Not a BHP test/);
 const moved=moveMatch(s,K(4),-1,'shut-in spanned the month end'),t4=byKey(estimate(moved),4);
 assert.equal(t4.month,'2024-04');assert.equal(t4.shift,-1);assert.equal(t4.shiftReason,'shut-in spanned the month end');assert.equal(t4.status,'qualifies');
 assert.equal(byKey(estimate(moveMatch(moved,K(4),0,'')),4).month,'2024-05');
});
test('basis confirmation requires a reason and a known value',()=>{
 const s=createEstimateState(fixtureInputs());
 assert.throws(()=>confirmBasis(s,'psig',''),/reason/);assert.throws(()=>confirmBasis(s,'bar','x'),/psig or psia/);assert.throws(()=>confirmBasis(s,'psig','x'.repeat(201)),/reason/);
 assert.deepEqual(psig(s).basis,{value:'psig',reason:'RRC Permian guidance'});
});
test('choice: latest by default; a user choice needs a reason; a dropped choice falls back to the latest',()=>{
 const s=psig(createEstimateState(fixtureInputs())),e=estimate(s);
 assert.deepEqual(e.qualifying,[K(1),K(2)]);assert.equal(e.chosenKey,K(2));assert.equal(e.choiceBy,'system');assert.equal(e.choiceDropped,false);
 assert.throws(()=>chooseJ(s,K(1),''),/reason/);assert.throws(()=>chooseJ(s,K(4),'x'),/qualifying/);
 const c=chooseJ(s,K(1),'nearest to the planning period'),ce=estimate(c);assert.equal(ce.chosenKey,K(1));assert.equal(ce.choiceBy,'user');assert.equal(ce.choiceReason,'nearest to the planning period');
 const changed=fixtureInputs();changed.tests=applyTestDecision(changed.tests,K(1),false,'operator note');
 const de=estimate(withInputs(c,changed));assert.equal(de.chosenKey,K(2));assert.equal(de.choiceBy,'system');assert.equal(de.choiceDropped,true);
});
test('range, trend and readiness',()=>{
 const e=estimate(psig(createEstimateState(fixtureInputs()))),js=[byKey(e,1).j,byKey(e,2).j];
 assert.deepEqual(e.range,{min:Math.min(...js),max:Math.max(...js)});assert.deepEqual(e.trend,[{date:'2024-02-12',j:js[0]},{date:'2024-07-22',j:js[1]}]);
 assert.equal(e.readiness,'2 of 4 BHP tests give a test-referenced J (estimate).');
 const none=estimate(psig(createEstimateState(fixtureInputs({avg:50}))));assert.equal(none.range,null);assert.equal(none.trend,null);assert.equal(none.chosenKey,null);
 assert.equal(none.readiness,'No test qualifies for a test-referenced J. Reasons are listed per test.');
 assert.equal(estimate(createEstimateState(fixtureInputs({bhp:[]}))).readiness,'No BHP test records for this well; no test-referenced J.');
});
test('round trip: the scenario reproduces the chosen month within 0.5 psi; other months show their residual',()=>{
 const e=estimate(psig(createEstimateState(fixtureInputs())));assert.equal(e.roundTrip.length,2);
 const chosen=e.roundTrip.find(r=>r.chosen),other=e.roundTrip.find(r=>!r.chosen);
 assert.equal(chosen.key,K(2));assert.ok(Math.abs(chosen.residualPsi)<=0.5);near(chosen.observedSurfacePsia,914.7);assert.equal(e.roundTripOk,true);
 assert.equal(typeof other.residualPsi,'number');assert.equal(other.month,'2024-02');
});
test('withInputs keeps the basis, assumptions and moves for tests that still exist',()=>{
 const s=moveMatch(setAssumptions(psig(createEstimateState(fixtureInputs())),{salinityWtPercent:12}),K(4),-1,'reason');
 const next=withInputs(s,fixtureInputs({bhp:[bhpRow(1,'2024-02-12',1705,3310)]}));
 assert.deepEqual(next.basis,s.basis);assert.equal(next.assumptions.salinityWtPercent,12);assert.deepEqual(Object.keys(next.shifts),[]);assert.deepEqual(next.surfaceBasis,s.surfaceBasis);
});
test('assumptions are validated, never clamped',()=>{
 assert.deepEqual(validateAssumptions({...DEFAULT_ASSUMPTIONS}),{...DEFAULT_ASSUMPTIONS});
 for(const [k,v] of [['innerDiameterInches',0.1],['roughnessInches',0.2],['surfaceTemperatureF',50],['bottomholeTemperatureF',300],['salinityWtPercent',21],['segments',8.5]])
  assert.throws(()=>validateAssumptions({...DEFAULT_ASSUMPTIONS,[k]:v}));
 assert.throws(()=>setAssumptions(createEstimateState(fixtureInputs()),{innerDiameterInches:0.01}));
});
test('hand-off: exact fields and origins, bottomhole limit unset, permit values labelled',()=>{
 const s=psig(createEstimateState(fixtureInputs())),e=estimate(s),t2=byKey(e,2),h=handoff(s,e,{surfacePsi:1176,volumeBpd:30000},'ab'.repeat(32));
 assert.deepEqual(Object.keys(h.values).sort(),['caseName','curveMaximumStbd','datum','innerDiameterInches','injectivityStbdPerPsi','limitPsia','measuredDepthFt','model','operatingCeilingStbd','rateStbd','referencePressurePsia','reservoirPsia','roughnessInches','salinityWtPercent','segments','surfaceLimitPsia','surfaceTemperatureF','temperatureF','tvdFt'].sort());
 assert.equal(h.values.model,'segmented-brine');assert.equal(h.values.limitPsia,null);near(h.values.surfaceLimitPsia,1190.7);assert.equal(h.values.operatingCeilingStbd,30000);
 near(h.values.injectivityStbdPerPsi,t2.j);near(h.values.reservoirPsia,1745.7);assert.equal(h.values.tvdFt,3310);assert.equal(h.values.rateStbd,10000);assert.equal(h.values.curveMaximumStbd,15000);
 assert.equal(h.values.datum,datumFor(t2));assert.equal(h.values.datum,'Top of completed interval at 3310 ft TVD (RRC guidance), from BHP test 2024-07-22');
 assert.equal(h.origins.limitPsia,'Not set from evidence; declare it.');assert.match(h.origins.injectivityStbdPerPsi,/^Test-referenced J \(estimate\) from BHP test 2024-07-22 and H-10 2024-07; sealed estimate abab/);
 assert.equal(h.origins.surfaceLimitPsia,'Inventory permitted surface pressure 1176 psi + 14.7 psi (permit value)');
 assert.deepEqual(h.sweep,e.range);
 const bare=handoff(s,e,{surfacePsi:null,volumeBpd:null},'ab'.repeat(32));assert.equal(bare.values.surfaceLimitPsia,null);assert.equal(bare.values.operatingCeilingStbd,null);
 assert.equal(bare.origins.surfaceLimitPsia,'No permitted surface pressure in the inventory; declare it.');
 assert.throws(()=>handoff(createEstimateState(fixtureInputs()),estimate(createEstimateState(fixtureInputs())),{surfacePsi:null,volumeBpd:null},'x'),/No test-referenced J/);
 assert.throws(()=>handoff(s,{...e,roundTripOk:false},{surfacePsi:null,volumeBpd:null},'x'),/round trip/);
});
test('wording: the label is an estimate and no produced text uses the banned word',()=>{
 assert.equal(LABEL_J,'Test-referenced J (estimate)');
 const e=estimate(psig(createEstimateState(fixtureInputs())));
 assert.doesNotMatch(JSON.stringify({e,LIMITATIONS,BASIS_STATEMENT,REASONS:Object.values(REASONS).map(String)}),new RegExp('calib'+'rated','i'));
 const s=psig(createEstimateState(fixtureInputs())),h=handoff(s,estimate(s),{surfacePsi:1176,volumeBpd:30000},'ab'.repeat(32));
 assert.doesNotMatch(JSON.stringify({origins:h.origins,notes:h.notes,values:h.values}),new RegExp('calib'+'rated','i'));
});
test('fix round 1: bad depth and non-positive pressure are refused; plain traverse errors become unsupported',()=>{
 const inputs=fixtureInputs({bhp:[bhpRow(1,'2024-02-12',1705,0),bhpRow(2,'2024-07-22',1731,3310),bhpRow(3,'2024-03-12',0,3310),bhpRow(4,'2024-04-12',-5,3310),bhpRow(5,'2024-06-12',1705,60000)]});
 for(const k of [1,2,3,4,5])inputs.tests=applyTestDecision(inputs.tests,K(k),true);
 const e=estimate(psig(createEstimateState(inputs)));
 assert.equal(byKey(e,1).status,'refused');assert.equal(byKey(e,1).reason,REASONS.badDepth);assert.equal(byKey(e,5).reason,REASONS.badDepth);
 assert.equal(byKey(e,3).reason,REASONS.nonPositive);assert.equal(byKey(e,4).reason,REASONS.nonPositive);
 assert.equal(byKey(e,2).status,'qualifies');assert.deepEqual(e.qualifying,[K(2)]);
 const plain=byKey(estimate(psig(createEstimateState(fixtureInputs({rate:1e9})))),1);
 assert.equal(plain.status,'unsupported');assert.match(plain.reason,/^Unsupported by the wellbore traverse: Rate \(STB\/day\) must be finite/);assert.equal(plain.j,null);
});
test('final review M-1: a moved match and the chosen J follow the record identity, not the positional key',()=>{
 const s0=psig(createEstimateState(fixtureInputs())),s=chooseJ(moveMatch(moveMatch(s0,K(4),-1,'month end'),K(1),1,'next month'),K(2),'planning period');
 assert.equal(s.shifts[K(4)].identity,'bhp|4|9|1');assert.equal(s.choice.identity,'bhp|2|9|1');
 const same=withInputs(s,fixtureInputs());assert.deepEqual(Object.keys(same.shifts).sort(),[K(1),K(4)]);assert.equal(same.choice.key,K(2));
 const replaced=fixtureInputs({bhp:[bhpRow(9,'2024-02-12',1705,3310),bhpRow(8,'2024-07-22',1731,3310),bhpRow(3,'2023-11-07',1500,3100),bhpRow(4,'2024-05-10',1720,3310)]});
 const next=withInputs(s,replaced);assert.deepEqual(Object.keys(next.shifts),[K(4)]);assert.equal(next.choice,null);
 const e=estimate(next);assert.equal(e.choiceBy,'system');assert.equal(e.choiceDropped,false);
});
test('final review M-7: the BHP test-type limitation is listed',()=>{
 assert.ok(LIMITATIONS.includes('The BHP test is treated as a static shut-in reservoir pressure reading (RRC Permian guidance); the source record does not state the test type.'));
});
test('2a equivalence: with both bases psig and default assumptions, estimate and hand-off equal the 1c golden from 5bc1690',async()=>{
 const g=JSON.parse(await readFile('tests/fixtures/test-referenced-j-v1-golden.json','utf8'));assert.equal(g.sealed.schemaVersion,'test-referenced-j-export/1');
 const s=psig(createEstimateState(fixtureInputs())),e=JSON.parse(JSON.stringify(estimate(s)));
 for(const k of ['tests','qualifying','chosenKey','choiceBy','choiceReason','choiceDropped','range','trend','roundTrip','roundTripOk','readiness','basis','assumptions'])assert.deepEqual(e[k],g.sealed[k],k);
 const h=handoff(s,estimate(s),{surfacePsi:1176,volumeBpd:30000},g.sealed.contentSha256);
 assert.deepEqual(h.values,g.handoff.values);assert.deepEqual(h.origins,g.handoff.origins);assert.deepEqual(h.notes,g.handoff.notes);assert.deepEqual(h.sweep,g.handoff.sweep);
});
test('2a: a psia surface basis shifts the surface pressure and the permit by exactly -14.7 psi',()=>{
 const g=psig(createEstimateState(fixtureInputs())),a=confirmBasis(setSurfaceBasis(createEstimateState(fixtureInputs()),{value:'psia',reason:'reported as absolute'}),'psig','RRC Permian guidance');
 const ta=byKey(estimate(a),1),tg=byKey(estimate(g),1);near(ta.surfacePsia,900);near(ta.surfacePsia,tg.surfacePsia-14.7);
 const ha=handoff(a,estimate(a),{surfacePsi:1176,volumeBpd:null},'ab'.repeat(32));near(ha.values.surfaceLimitPsia,1176);
 assert.equal(ha.origins.surfaceLimitPsia,'Inventory permitted surface pressure 1176 psi, read as psia (permit value; basis confirmed: reported as absolute)');
});
test('2a: the surface basis needs a known value and a reason; null clears it; the estimate records it',()=>{
 const s=createEstimateState(fixtureInputs());
 assert.throws(()=>setSurfaceBasis(s,{value:'bar',reason:'x'}),/psig or psia/);assert.throws(()=>setSurfaceBasis(s,{value:'psig',reason:' '}),/reason/);
 assert.equal(setSurfaceBasis(setSurfaceBasis(s,SURFACE_PSIG),null).surfaceBasis,null);
 assert.deepEqual(estimate(psig(s)).surfaceBasis,SURFACE_PSIG);
 const e=estimate(psig(s));assert.throws(()=>handoff(setSurfaceBasis(psig(s),null),e,{surfacePsi:null,volumeBpd:null},'x'),/Confirm the H-10 and permit pressure basis/);
});
test('2a: a bottomhole limit declared within 1 ft of the J datum prefills the hand-off; 2 ft away does not',()=>{
 const s=psig(createEstimateState(fixtureInputs())),e=estimate(s),limit={psia:4000,depthFt:3311,reason:'operator design limit'};
 const h=handoff(s,e,{surfacePsi:1176,volumeBpd:30000},'ab'.repeat(32),limit);
 assert.equal(h.values.limitPsia,4000);assert.equal(h.origins.limitPsia,'Declared by the user in WHP/BHP reconciliation (operator design limit)');
 assert.equal(applyHandoff(h).fields.limitPsia,'4000');
 const far=handoff(s,e,{surfacePsi:1176,volumeBpd:30000},'ab'.repeat(32),{...limit,depthFt:3312});
 assert.equal(far.values.limitPsia,null);assert.equal(far.origins.limitPsia,'Not set from evidence; declare it.');
});
test('2a: version and the H-10 limitation refer to the confirmed surface basis',()=>{
 assert.equal(J_ESTIMATE_VERSION,'test-referenced-j/2');
 assert.equal(LIMITATIONS[3],'H-10 average pressure is a monthly figure, not a flowing pressure measured at the time of the test; it is converted on the user-confirmed surface basis.');
});
