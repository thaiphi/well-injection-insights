import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDisposalCase} from '../dist/disposalCase.js';
import {brineAtPressure} from '../dist/brinePvt.js';
import {BANNED} from '../dist/caseSummary.js';
import {C} from '../dist/transientMath.js';
import {wellboreUnitRise,lineSourceRise,riseFromSteps,tD,averageRiseClosed} from '../dist/transientModel.js';
const tc=await import('../dist/transientCase.js').catch(()=>({}));

// Fictional data only (fictional wells FICTIONAL-A/B; no real well values).
const WELL={id:'FICTIONAL-A',reservoirPsia:2000,limitPsia:3500,injectivityStbdPerPsi:5,operatingCeilingStbd:10000,availability:0.9,datum:'formation',reservoirDatum:'formation',limitDatum:'formation',reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',tvdFt:3000,measuredDepthFt:3500,innerDiameterInches:5,roughnessInches:0.0006,surfaceLimitPsia:5000};
const caseInput=(over={})=>({caseName:'Fictional transient case',demand:{id:'synthetic-demand/1',origin:'synthetic',content:'fictional',monthly:[{month:'2028-01',demandBbl:60000},{month:'2028-02',demandBbl:90000},{month:'2028-04',demandBbl:30000}],evidence:{fixture:'fictional'}},
 wells:[WELL,{...WELL,id:'FICTIONAL-B',injectivityStbdPerPsi:2.5,bottomholeTemperatureF:200}],fluid:{referencePressurePsia:2000,temperatureF:180,salinityWtPercent:5},comparison:{wellId:'FICTIONAL-A',injectivityMultiplier:0.5,innerDiameterInches:5,availability:0.8},...over});
const CASE=buildDisposalCase(caseInput());
const months=(first,n)=>{const [y,m]=first.split('-').map(Number);return Array.from({length:n},(_,i)=>{const k=y*12+m-1+i;return `${Math.floor(k/12)}-${String(k%12+1).padStart(2,'0')}`;});};
const sched=(first,rates)=>({months:months(first,rates.length).map((month,i)=>({month,rateStbd:rates[i]})),origin:'typed'});
const ROCK={k:50,h:100,phi:0.15,cf:4e-6,rw:0.35,skin:2};
const input=(over={})=>({wellId:'FICTIONAL-A',rock:{...ROCK},boundary:{kind:'closed',re:3000},schedule:sched('2028-01',Array(24).fill(5000)),profileMonths:[],sensitivity:{},...over});
const rel=(a,b)=>Math.abs(a-b)/Math.max(1e-12,Math.abs(b));
const msgs=(inp,res=CASE)=>tc.validateTransientInput(res,inp);
const refused=(inp,pattern)=>{const m=msgs(inp);assert.ok(m.some(x=>pattern.test(x)),`expected ${pattern} in ${JSON.stringify(m)}`);assert.throws(()=>tc.buildTransientCase(CASE,inp),pattern);};

test('transient case module exists with fixed copy',()=>{
 assert.equal(typeof tc.buildTransientCase,'function');
 assert.equal(tc.TRANSIENT_CASE_VERSION,'transient-buildup/1');
 assert.equal(tc.CLOSING_7,'Screening estimate from assumed rock and fluid properties; not a calibrated or permitted pressure.');
 assert.equal(tc.HANDOFF_NOTE,'You may type this as an assumed reservoir-pressure offset in Well-performance cases. It is not applied automatically. That offset applies to every well in the case, not only this one.');
 assert.equal(tc.GUARD_TOO_SHORT,'the step is too short for this model (wellbore storage and early-time effects are not modelled)');
 assert.equal(tc.FICTIONAL_EXAMPLE_LABEL,'fictional example — not typical values');
 assert.deepEqual(tc.FICTIONAL_EXAMPLE,{k:50,h:100,phi:0.15,cf:4e-6,rw:0.35,skin:2,re:3000});
 assert.deepEqual(msgs(input()),[]);
});

test('benchmark 10: each bound is refused with the input named',()=>{
 refused(input({rock:{...ROCK,k:0.001}}),/permeability k/i);
 refused(input({rock:{...ROCK,h:0}}),/thickness h/i);
 refused(input({rock:{...ROCK,phi:0.5}}),/porosity/i);
 refused(input({rock:{...ROCK,cf:1e-3}}),/formation compressibility c_f/i);
 refused(input({rock:{...ROCK,rw:3}}),/wellbore radius r_w/i);
 refused(input({rock:{...ROCK,skin:-6}}),/skin s/i);
 refused(input({rock:{...ROCK,skin:51}}),/skin s/i);
 refused(input({boundary:{kind:'closed',re:50}}),/boundary radius r_e/i);
 refused(input({boundary:{kind:'closed',re:264001}}),/boundary radius r_e/i);
 refused(input({rock:{...ROCK,rw:0.35},boundary:{kind:'closed',re:30}}),/100 · r_w/);
 refused(input({rock:{...ROCK,rw:2},boundary:{kind:'closed',re:150}}),/100 · r_w/);       // isolates the 100·r_w rule (r_e passes the 100 ft floor)
 assert.ok(!msgs(input({rock:{...ROCK,rw:2},boundary:{kind:'closed',re:150}})).some(m=>/between 100 and 264,000/.test(m)));
 for(const bad of [NaN,Infinity,'5',null])refused(input({rock:{...ROCK,k:bad}}),/permeability k/i);
});

test('benchmark 10: negative skin effective radius, negative rate and schedule bounds',()=>{
 // r_wa = 0.35 e^5 = 51.9 ft >= 0.1 r_e (r_e 400): refused before the model can throw.
 const m=msgs(input({rock:{...ROCK,skin:-5},boundary:{kind:'closed',re:400}}));
 assert.ok(m.some(x=>/effective wellbore radius/.test(x)&&/0\.1 · r_e/.test(x)),JSON.stringify(m));
 assert.throws(()=>tc.buildTransientCase(CASE,input({rock:{...ROCK,skin:-5},boundary:{kind:'closed',re:400}})),/effective wellbore radius/);
 // The 1,000 ft rule cannot be reached within the bounds: the largest r_wa is 2·e^5 ≈ 297 ft, accepted here.
 assert.deepEqual(msgs(input({rock:{...ROCK,rw:2,skin:-5},boundary:{kind:'infinite',statedExtentFt:null}})),[]);
 refused(input({rock:{...ROCK,rw:2,skin:-5},boundary:{kind:'closed',re:5000}}),/100 · r_wa/);
 refused(input({schedule:sched('2028-01',[5000,-1,5000])}),/2028-02.*negative/i);
 refused(input({schedule:sched('2028-01',[5000,100001])}),/2028-02/);
 refused(input({schedule:sched('2028-01',[])}),/1–120/);
 refused(input({schedule:sched('2028-01',Array(121).fill(10))}),/1–120/);
 refused(input({schedule:{months:[{month:'2028-01',rateStbd:1},{month:'2028-03',rateStbd:1}],origin:'typed'}}),/consecutive/);
 refused(input({schedule:{months:[{month:'2028-13',rateStbd:1}],origin:'typed'}}),/month/i);
 refused(input({wellId:'NO-SUCH-WELL'}),/NO-SUCH-WELL/);
 refused(input({profileMonths:['2030-01']}),/profile month/i);
 refused(input({profileMonths:['2028-01','2028-02','2028-03','2028-04']}),/profile month/i);
 refused(input({sensitivity:{k:{low:0.001,high:100}}}),/sensitivity.*permeability k/i);
 refused(input({sensitivity:{skin:{low:-5,high:3}}}),/sensitivity.*skin/i);      // r_wa 51.9 vs r_e 3000: 100 · r_wa rule
 refused(input({boundary:{kind:'infinite',statedExtentFt:null},sensitivity:{re:{low:1000,high:5000}}}),/sensitivity.*r_e/i);
});

test('benchmark 10: datums must agree (validateInjector) and the case well must be valid',()=>{
 const bad=structuredClone(CASE);bad.base.wells[0].well.limitDatum='other';bad.inputs.wells[0].limitDatum='other';
 assert.ok(msgs(input(),bad).some(m=>/FICTIONAL-A/.test(m)&&/datum/i.test(m)),JSON.stringify(msgs(input(),bad)));
 const hot=structuredClone(CASE);hot.inputs.wells[0].bottomholeTemperatureF=400;hot.base.wells[0].well.bottomholeTemperatureF=400;
 assert.ok(msgs(input(),hot).some(m=>/temperature/i.test(m)));
});

test('review focus 1: a first month failing t_D >= 100 is blocked with GUARD_TOO_SHORT, never a number',()=>{
 const inp=input({rock:{k:0.01,h:100,phi:0.4,cf:1e-4,rw:2,skin:0},boundary:{kind:'closed',re:300},schedule:sched('2028-01',[1000,1000,1000]),profileMonths:['2028-02']});
 assert.deepEqual(msgs(inp),[]);
 const r=tc.buildTransientCase(CASE,inp);
 const td=tD({k:0.01,h:100,phi:0.4,ct:r.fluid.ct,mu:r.fluid.mu,B:r.fluid.B},2,31*24);
 assert.ok(td<100,`precondition t_D=${td}`);
 assert.equal(r.monthly[0].blocked,tc.GUARD_TOO_SHORT);
 for(const m of r.monthly){assert.equal(m.blocked,tc.GUARD_TOO_SHORT);assert.equal(m.bottomholePsia,null);}
 assert.equal(r.firstMonthAtLimit,null);assert.equal(r.endBottomholePsia,null);assert.equal(r.limitStatus,'not-determined');
 for(const m of r.monthly){assert.equal(m.risePsi,null);assert.equal(m.skinPsi,null);}
 assert.deepEqual(r.profiles[0].points,[]);
 assert.ok(r.warnings.some(w=>w.includes(tc.GUARD_TOO_SHORT)));
});

test('guard applies at each rate change: a later change failing t_D blocks that month onward only',()=>{
 // Find k so a 31-day step passes but a 28-day step (Feb 2029) fails.
 const base=input({rock:{k:0.05,h:100,phi:0.4,cf:1e-4,rw:2,skin:0},boundary:{kind:'closed',re:5000}});
 const r0=tc.buildTransientCase(CASE,{...base,schedule:sched('2029-01',[1000])});
 const rock=k=>({k,h:100,phi:0.4,ct:r0.fluid.ct,mu:r0.fluid.mu,B:r0.fluid.B});
 // choose k so that t_D(28 d) < 100 <= t_D(31 d)
 const k=100/tD(rock(1),2,30*24);
 assert.ok(tD(rock(k),2,28*24)<100&&tD(rock(k),2,31*24)>=100);
 const r=tc.buildTransientCase(CASE,{...base,rock:{...base.rock,k},schedule:sched('2029-01',[1,2,2])});
 assert.equal(r.monthly[0].blocked,null);assert.equal(typeof r.monthly[0].bottomholePsia,'number');
 assert.equal(r.monthly[1].blocked,tc.GUARD_TOO_SHORT);assert.equal(r.monthly[2].blocked,tc.GUARD_TOO_SHORT);
 // no rate change in Feb: not blocked
 const same=tc.buildTransientCase(CASE,{...base,rock:{...base.rock,k},schedule:sched('2029-01',[1,1,1])});
 assert.ok(same.monthly.every(m=>m.blocked===null));
});

test('negative skin: the guard uses r_wa; an unblocked s < 0 case gives a non-negative rise and a negative skin part',()=>{
 const probe=tc.buildTransientCase(CASE,input({schedule:sched('2028-01',[1])}));
 const rwa=0.35*Math.exp(5),rock=k=>({k,h:100,phi:0.15,ct:probe.fluid.ct,mu:probe.fluid.mu,B:probe.fluid.B});
 const k=50/tD(rock(1),rwa,31*24);
 assert.ok(k>=0.01&&tD(rock(k),0.35,31*24)>=100&&tD(rock(k),rwa,31*24)<100,'precondition');
 const inf={kind:'infinite',statedExtentFt:null},sch=sched('2028-01',[1,1]);
 const neg=tc.buildTransientCase(CASE,input({rock:{...ROCK,k,skin:-5},boundary:inf,schedule:sch}));
 assert.ok(neg.monthly.every(m=>m.blocked===tc.GUARD_TOO_SHORT&&m.bottomholePsia===null));
 const zero=tc.buildTransientCase(CASE,input({rock:{...ROCK,k,skin:0},boundary:inf,schedule:sch}));
 assert.ok(zero.monthly.every(m=>m.blocked===null&&typeof m.bottomholePsia==='number'));
 const ok=tc.buildTransientCase(CASE,input({rock:{...ROCK,skin:-2}}));
 const coef=C.pressure*ok.fluid.B*ok.fluid.mu/(ROCK.k*ROCK.h);
 for(const m of ok.monthly){assert.equal(m.blocked,null);assert.ok(m.risePsi>=0);assert.ok(m.skinPsi<0);assert.ok(Math.abs(m.skinPsi-coef*-2*5000)<1e-9*Math.abs(m.skinPsi));}
});

test('review focus 3: scheduleFromForecast fills the span with null for missing months; nothing defaults to 0',()=>{
 const s=tc.scheduleFromForecast(CASE,'FICTIONAL-A','2026-11-15');
 assert.deepEqual(s.months.map(m=>m.month),['2028-01','2028-02','2028-03','2028-04']);
 assert.equal(s.months[2].rateStbd,null);
 assert.deepEqual(s.origin,{copiedFrom:CASE.inputs.caseName,copiedAt:'2026-11-15'});
 const alloc=m=>CASE.base.monthly.find(x=>x.month===m).allocations.find(a=>a.wellId==='FICTIONAL-A').averageStbd;
 assert.equal(s.months[0].rateStbd,alloc('2028-01'));assert.equal(s.months[1].rateStbd,alloc('2028-02'));assert.equal(s.months[3].rateStbd,alloc('2028-04'));
 const m=msgs(input({schedule:s}));
 assert.ok(m.some(x=>x.includes('2028-03')&&/not in the disposal case: enter a rate \(0 = shut in\)/.test(x)),JSON.stringify(m));
 assert.throws(()=>tc.buildTransientCase(CASE,input({schedule:s})),/2028-03/);
 const filled={...s,months:s.months.map(x=>x.rateStbd===null?{...x,rateStbd:0}:x)};
 const r=tc.buildTransientCase(CASE,input({schedule:filled}));
 assert.equal(r.labels.schedule,'forecast (copied from disposal case, 2026-11-15)');
 assert.throws(()=>tc.scheduleFromForecast(CASE,'NO-SUCH-WELL','2026-11-15'),/NO-SUCH-WELL/);
 // M3: a well with no Base allocations is refused by name, never an empty schedule.
 const bare=structuredClone(CASE);for(const m of bare.base.monthly)m.allocations=m.allocations.filter(a=>a.wellId!=='FICTIONAL-A');
 assert.throws(()=>tc.scheduleFromForecast(bare,'FICTIONAL-A','2026-11-15'),/^Error: Well FICTIONAL-A has no Base forecast months to copy$/);
 // M4: copiedAt must be an ISO date (YYYY-MM-DD).
 for(const bad of ['15/11/2026','2026-02-30','2026-11-15T00:00:00Z','',null]){
  const m2=msgs(input({schedule:{...filled,origin:{copiedFrom:'case',copiedAt:bad}}}));
  assert.ok(m2.some(x=>/copiedAt/.test(x)||/copied from a disposal case/.test(x)),String(bad)+JSON.stringify(m2));
 }
 assert.ok(msgs(input({schedule:{...filled,origin:{copiedFrom:'case',copiedAt:'2026-02-30'}}})).some(x=>/ISO date \(YYYY-MM-DD\)/.test(x)));
 assert.deepEqual(msgs(input({schedule:{...filled,origin:{copiedFrom:'case',copiedAt:'2028-02-29'}}})),[]);
});

test('review focus 6: a month crossing 10,000 psia is blocked from there onward',()=>{
 const hp=buildDisposalCase(caseInput({wells:[{...WELL,reservoirPsia:9500,limitPsia:10000,surfaceLimitPsia:10000}],comparison:{wellId:'FICTIONAL-A',injectivityMultiplier:0.5,innerDiameterInches:5,availability:0.8}}));
 const r=tc.buildTransientCase(hp,input({rock:{...ROCK,k:5,h:20},schedule:sched('2028-01',[50,50,20000,20000,0])}));
 const PVT='outside the 100–10,000 psia range of the fluid model';
 assert.equal(r.monthly[0].blocked,null);assert.ok(r.monthly[0].bottomholePsia<=10000);
 const i=r.monthly.findIndex(m=>m.blocked!==null);assert.equal(i,2);
 for(const m of r.monthly.slice(i)){assert.equal(m.blocked,PVT);assert.equal(m.bottomholePsia,null);assert.equal(m.risePsi,null);assert.equal(m.skinPsi,null);}
 assert.equal(r.endBottomholePsia,null);
 // P > 10,000 >= limitPsia: the blocked month counts as the crossing.
 assert.equal(r.monthly[1].bottomholePsia<r.well.limitPsia,true);
 assert.equal(r.firstMonthAtLimit,'2028-03');assert.equal(r.limitStatus,'reached');
 for(const m of r.monthly.slice(0,i)){assert.equal(typeof m.risePsi,'number');assert.equal(typeof m.skinPsi,'number');}
});

test('first month at the limit: known month, equal to the first month with bottomholePsia >= limitPsia; unreachable gives null',()=>{
 const r=tc.buildTransientCase(CASE,input());
 const first=r.monthly.find(m=>m.bottomholePsia!==null&&m.bottomholePsia>=r.well.limitPsia);
 assert.equal(r.firstMonthAtLimit,first.month);
 // independent hand computation with the transient model directly
 const f=brineAtPressure(2000,180,5),rock={k:50,h:100,phi:0.15,ct:f.compressibilityPerPsi+4e-6,mu:f.viscosityCp,B:f.bwRbPerStb};
 let hours=0,expected=null;
 for(const m of months('2028-01',24)){hours+=new Date(Date.UTC(+m.slice(0,4),+m.slice(5),0)).getUTCDate()*24;if(2000+5000*wellboreUnitRise(rock,{kind:'closed',re:3000},0.35,2,hours)>=3500){expected=m;break;}}
 assert.equal(r.firstMonthAtLimit,expected);
 assert.equal(r.firstMonthAtLimit,'2028-04');
 assert.ok(r.warnings.some(w=>w.includes('2028-04')&&/limit/.test(w)));
 const low=tc.buildTransientCase(CASE,input({schedule:sched('2028-01',[100,100,100])}));
 assert.equal(r.limitStatus,'reached');
 assert.equal(low.firstMonthAtLimit,null);assert.equal(low.limitStatus,'not-reached');assert.equal(low.endBottomholePsia,low.monthly[2].bottomholePsia);
 assert.equal(r.well.reservoirPsia,2000);assert.equal(r.well.limitPsia,3500);assert.equal(r.well.datum,'formation');
});

test('skin part equals C.pressure·Bμ/(kh)·s·q_current and is the whole difference from s = 0',()=>{
 const rates=[5000,3000,0,4000];
 const r=tc.buildTransientCase(CASE,input({schedule:sched('2028-01',rates)}));
 const r0=tc.buildTransientCase(CASE,input({rock:{...ROCK,skin:0},schedule:sched('2028-01',rates)}));
 const coef=C.pressure*r.fluid.B*r.fluid.mu/(ROCK.k*ROCK.h);
 r.monthly.forEach((m,i)=>{
  assert.ok(Math.abs(m.skinPsi-coef*2*rates[i])<=1e-9*Math.max(1,coef*2*rates[i]));
  assert.ok(Math.abs((m.risePsi-r0.monthly[i].risePsi)-m.skinPsi)<=1e-6,`${m.month}`);
 });
 assert.equal(r.monthly[2].skinPsi,0);
 assert.equal(r0.monthly[0].skinPsi,0);
});

test('closed profiles: excludes skin, equals the wellbore response at r_w and the line source before the boundary is felt',()=>{
 const r=tc.buildTransientCase(CASE,input({profileMonths:['2028-01','2028-12']}));
 assert.equal(r.profiles.length,2);assert.equal(r.labels.profiles,'rise above initial; excludes skin');
 for(const p of r.profiles){
  assert.equal(p.points.length,25);
  assert.ok(Math.abs(p.points[0].rFt-0.7)<1e-12);assert.ok(Math.abs(p.points[24].rFt-3000)<1e-9);
  for(let i=1;i<25;i++){assert.ok(p.points[i].rFt>p.points[i-1].rFt);assert.ok(p.points[i].risePsi<=p.points[i-1].risePsi+1e-9);}
  // log spacing
  near(Math.log(p.points[1].rFt/p.points[0].rFt),Math.log(p.points[24].rFt/p.points[23].rFt));
 }
 // skin does not move the profile
 const r0=tc.buildTransientCase(CASE,input({rock:{...ROCK,skin:0},profileMonths:['2028-01','2028-12']}));
 assert.deepEqual(r.profiles,r0.profiles);
 // early time (t = 1 day): closed profile at moderate r equals line source
 const tiny=tc.buildTransientCase(CASE,input({rock:{...ROCK,k:0.5},boundary:{kind:'closed',re:30000},schedule:sched('2028-01',[1000]),profileMonths:['2028-01']}));
 const rock={k:0.5,h:100,phi:0.15,ct:tiny.fluid.ct,mu:tiny.fluid.mu,B:tiny.fluid.B};
 for(const pt of tiny.profiles[0].points.filter(p=>p.rFt>=5&&p.rFt<=200)){
  const ls=1000*lineSourceRise(rock,pt.rFt,31*24);assert.ok(rel(pt.risePsi,ls)<2e-3,`r=${pt.rFt} ${pt.risePsi} vs ${ls}`);}
});

test('closed profile at r_w with skin 0 equals the wellbore unit response (r_D = 1 identity)',()=>{
 assert.equal(typeof tc._closedRiseAt,'function');
 const rock={k:50,h:100,phi:0.15,ct:1e-5,mu:0.5,B:1.02};
 for(const t of [24,720,8760,87600])assert.ok(rel(tc._closedRiseAt(rock,3000,0.35,0.35,t),wellboreUnitRise(rock,{kind:'closed',re:3000},0.35,0,t))<1e-9);
 for(const t of [720,87600]){const a=tc._closedRiseAt(rock,3000,0.35,100,t),b=tc._closedRiseAt(rock,3000,0.35,1000,t);assert.ok(a>b&&b>0);}
});

test('M1: closed profiles at r_e = 264,000 ft are never negative and do not increase with r',()=>{
 const r=tc.buildTransientCase(CASE,input({boundary:{kind:'closed',re:264000},profileMonths:['2028-01','2028-12','2029-12']}));
 for(const p of r.profiles){assert.equal(p.points.length,25);
  p.points.forEach((pt,i)=>{assert.ok(pt.risePsi>=0,`${p.month} r=${pt.rFt} ${pt.risePsi}`);if(i)assert.ok(pt.risePsi<=p.points[i-1].risePsi,`${p.month} r=${pt.rFt}`);});}
});

test('M2: r_inv is measured from the first month with a non-zero rate; no warning before injection',()=>{
 const rates=[0,0,0,...Array(9).fill(5000)],sch=sched('2028-01',rates);
 const i=tc.buildTransientCase(CASE,input({boundary:{kind:'infinite',statedExtentFt:2000},schedule:sch,profileMonths:['2028-02','2028-06']}));
 const injStart=i.monthly[2].endHours,rinv=h=>Math.sqrt(ROCK.k*(h-injStart)/(C.rinv*ROCK.phi*i.fluid.mu*i.fluid.ct));
 const expected=i.monthly.find(m=>m.endHours>injStart&&rinv(m.endHours)>=2000).month;
 const fromStart=i.monthly.find(m=>Math.sqrt(ROCK.k*m.endHours/(C.rinv*ROCK.phi*i.fluid.mu*i.fluid.ct))>=2000).month;
 assert.notEqual(expected,fromStart);   // the fixture distinguishes the two time origins
 const w=i.warnings.filter(x=>/extent you stated/.test(x));assert.equal(w.length,1);assert.ok(w[0].endsWith(expected),w[0]);
 assert.deepEqual(i.profiles[0].points,[]);   // 2028-02: before injection, nothing to show
 assert.ok(rel(i.profiles[1].points[24].rFt,2*rinv(i.monthly[5].endHours))<1e-12);
 const c=tc.buildTransientCase(CASE,input({schedule:sch}));
 const ce=c.monthly.find(m=>m.endHours>injStart&&rinv(m.endHours)>=3000);
 const cw=c.warnings.filter(x=>/boundary reached/.test(x));
 if(ce){assert.equal(cw.length,1);assert.ok(cw[0].includes(ce.month));}else assert.equal(cw.length,0);
 const none=tc.buildTransientCase(CASE,input({boundary:{kind:'infinite',statedExtentFt:100},schedule:sched('2028-01',[0,0,0])}));
 assert.ok(!none.warnings.some(x=>/extent|boundary/.test(x)));
 const noneC=tc.buildTransientCase(CASE,input({schedule:sched('2028-01',[0,0,0])}));
 assert.ok(!noneC.warnings.some(x=>/boundary reached/.test(x)));
 assert.equal(noneC.limitStatus,'not-reached');
});

test('infinite profiles reach 2·r_inv; average rise and hand-off are closed only',()=>{
 const r=tc.buildTransientCase(CASE,input({boundary:{kind:'infinite',statedExtentFt:null},profileMonths:['2028-06']}));
 assert.equal(r.averageRise,null);assert.equal(r.handoff,null);
 const rinv=Math.sqrt(ROCK.k*r.monthly[5].endHours/(C.rinv*ROCK.phi*r.fluid.mu*r.fluid.ct));
 assert.ok(rel(r.profiles[0].points[24].rFt,2*rinv)<1e-12);
 const rock={k:50,h:100,phi:0.15,ct:r.fluid.ct,mu:r.fluid.mu,B:r.fluid.B};
 const pt=r.profiles[0].points[10];
 assert.ok(rel(pt.risePsi,riseFromSteps(t=>lineSourceRise(rock,pt.rFt,t),[{startHours:0,rateStbd:5000}],r.monthly[5].endHours))<1e-12);
 assert.ok(r.assumptions.some(a=>/line-source approximation at the wellbore/.test(a)));
 const c=tc.buildTransientCase(CASE,input());
 assert.ok(c.assumptions.some(a=>/line-source approximation at the wellbore/.test(a)));
 assert.equal(c.averageRise.length,24);
 let cum=0;c.monthly.forEach((m,i)=>{cum+=5000*m.endHours/24-(i?5000*c.monthly[i-1].endHours/24:0);});
 const rock2={k:50,h:100,phi:0.15,ct:c.fluid.ct,mu:c.fluid.mu,B:c.fluid.B};
 assert.ok(rel(c.averageRise[23].psi,averageRiseClosed(rock2,3000,0.35,cum))<1e-12);
 assert.deepEqual(c.handoff,{month:'2029-12',psi:c.averageRise[23].psi,note:tc.HANDOFF_NOTE});
});

test('warnings: boundary reached (closed) and stated extent passed (infinite)',()=>{
 const c=tc.buildTransientCase(CASE,input());
 const rinv=h=>Math.sqrt(ROCK.k*h/(C.rinv*ROCK.phi*c.fluid.mu*c.fluid.ct));
 const first=c.monthly.find(m=>rinv(m.endHours)>=3000).month;
 assert.ok(c.warnings.some(w=>/boundary reached/.test(w)&&w.includes(first)),JSON.stringify(c.warnings));
 const i=tc.buildTransientCase(CASE,input({boundary:{kind:'infinite',statedExtentFt:2000}}));
 const firstI=i.monthly.find(m=>rinv(m.endHours)>=2000).month;
 assert.ok(i.warnings.some(w=>w.includes('results assume no edge, but pressure has reached the extent you stated')&&w.includes(firstI)));
 const none=tc.buildTransientCase(CASE,input({boundary:{kind:'infinite',statedExtentFt:null}}));
 assert.ok(!none.warnings.some(w=>/extent/.test(w)));
 refused(input({boundary:{kind:'infinite',statedExtentFt:50}}),/stated extent/i);
});

test('sensitivity: one at a time, low/high present per requested factor; high k reaches the limit no earlier',()=>{
 const sens={k:{low:20,high:200},h:{low:50,high:200},cf:{low:2e-6,high:1e-5},skin:{low:0,high:10},re:{low:1500,high:6000}};
 const r=tc.buildTransientCase(CASE,input({sensitivity:sens}));
 assert.deepEqual(r.sensitivity.map(s=>s.factor),['k','h','cf','skin','re']);
 for(const s of r.sensitivity){for(const side of ['low','high']){assert.ok('firstMonthAtLimit' in s[side]&&'endBottomholePsia' in s[side]&&'limitStatus' in s[side]);}}
 assert.equal(r.labels.sensitivity,'one at a time; not additive');
 const order=m=>m===null?Infinity:m;
 const k=r.sensitivity[0];assert.ok(order(k.high.firstMonthAtLimit)>=order(k.low.firstMonthAtLimit));
 assert.ok(order(k.high.firstMonthAtLimit)>=order(r.firstMonthAtLimit));
 // each cell equals a full rebuild with that one factor changed (c_t recomputed from c_f)
 const one=(rock,boundary)=>tc.buildTransientCase(CASE,input({rock,boundary}));
 const cfHigh=one({...ROCK,cf:1e-5},{kind:'closed',re:3000});
 assert.equal(r.sensitivity[2].high.firstMonthAtLimit,cfHigh.firstMonthAtLimit);
 assert.ok(rel(r.sensitivity[2].high.endBottomholePsia??NaN,cfHigh.endBottomholePsia??NaN)<1e-12||(r.sensitivity[2].high.endBottomholePsia===null&&cfHigh.endBottomholePsia===null));
 assert.ok(rel(cfHigh.fluid.ct,cfHigh.fluid.cw+1e-5)===0);
 const hLow=one({...ROCK,h:50},{kind:'closed',re:3000}),reHigh=one(ROCK,{kind:'closed',re:6000}),sHigh=one({...ROCK,skin:10},{kind:'closed',re:3000});
 assert.deepEqual(r.sensitivity[1].low,{firstMonthAtLimit:hLow.firstMonthAtLimit,limitStatus:hLow.limitStatus,endBottomholePsia:hLow.endBottomholePsia});
 assert.deepEqual(r.sensitivity[4].high,{firstMonthAtLimit:reHigh.firstMonthAtLimit,limitStatus:reHigh.limitStatus,endBottomholePsia:reHigh.endBottomholePsia});
 assert.deepEqual(r.sensitivity[3].high,{firstMonthAtLimit:sHigh.firstMonthAtLimit,limitStatus:sHigh.limitStatus,endBottomholePsia:sHigh.endBottomholePsia});
 assert.deepEqual(tc.buildTransientCase(CASE,input()).sensitivity,[]);
});

test('runtime: closed circle, 120 distinct monthly rates, 5 factors x 2 finishes in seconds',()=>{
 const rates=Array.from({length:120},(_,i)=>1000+((i*37)%50)*20);
 const sens={k:{low:20,high:200},h:{low:50,high:200},cf:{low:2e-6,high:1e-5},skin:{low:0,high:10},re:{low:1500,high:6000}};
 const t0=performance.now();
 const r=tc.buildTransientCase(CASE,input({schedule:sched('2028-01',rates),sensitivity:sens,profileMonths:['2030-01','2035-01','2037-12']}));
 const ms=performance.now()-t0;
 assert.equal(r.monthly.length,120);assert.ok(ms<10000,`${ms} ms`);
});

test('determinism and evidence only: two builds deepEqual; the case result is unchanged',()=>{
 const before=structuredClone(CASE),inp=input({profileMonths:['2028-03'],sensitivity:{k:{low:20,high:200}}}),inpBefore=structuredClone(inp);
 const a=tc.buildTransientCase(CASE,inp),b=tc.buildTransientCase(CASE,inp);
 assert.deepEqual(a,b);assert.deepEqual(CASE,before);assert.deepEqual(inp,inpBefore);
 assert.deepEqual(a.inputs,inp);assert.notEqual(a.inputs,inp);
 assert.equal(JSON.stringify(JSON.parse(JSON.stringify(a))),JSON.stringify(a));   // finite JSON
});

test('banned words: CLOSING_7 verbatim; nothing else matches BANNED; skin is never tied to J',()=>{
 const results=[tc.buildTransientCase(CASE,input({sensitivity:{k:{low:20,high:200}}})),tc.buildTransientCase(CASE,input({boundary:{kind:'infinite',statedExtentFt:2000}})),
  tc.buildTransientCase(CASE,input({rock:{k:0.01,h:100,phi:0.4,cf:1e-4,rw:2,skin:0},boundary:{kind:'closed',re:300}}))];
 const texts=[tc.HANDOFF_NOTE,tc.FICTIONAL_EXAMPLE_LABEL,tc.GUARD_TOO_SHORT,...msgs(input({rock:{...ROCK,k:0.001,skin:-6},schedule:sched('2028-01',[-1])}))];
 for(const r of results){
  assert.equal(r.closing,tc.CLOSING_7);
  texts.push(...r.assumptions,...r.warnings,...Object.values(r.labels),...r.monthly.map(m=>m.blocked??''));
  if(r.handoff)texts.push(r.handoff.note);
 }
 for(const t of texts){assert.ok(!BANNED.test(t),t);assert.ok(!/J multiplier/i.test(t),t);assert.ok(!/\bJ\b/.test(t),t);assert.ok(!/injectivity/i.test(t),t);}
});

test('fluid: T from bottomholeTemperatureF when set, otherwise the case fluid; c_t = c_w + c_f exactly; assumptions',()=>{
 const a=tc.buildTransientCase(CASE,input());
 const fa=brineAtPressure(2000,180,5);
 assert.deepEqual(a.fluid,{mu:fa.viscosityCp,B:fa.bwRbPerStb,cw:fa.compressibilityPerPsi,cf:4e-6,ct:fa.compressibilityPerPsi+4e-6,temperatureF:180,salinityWtPercent:5});
 const b=tc.buildTransientCase(CASE,input({wellId:'FICTIONAL-B'}));
 const fb=brineAtPressure(2000,200,5);
 assert.equal(b.fluid.temperatureF,200);assert.equal(b.fluid.mu,fb.viscosityCp);assert.equal(b.fluid.ct,fb.compressibilityPerPsi+4e-6);
 const spec=['One vertical well, fully penetrating a single homogeneous, isotropic layer of uniform thickness.',
  'Single-phase, slightly compressible water. Viscosity, Bw and total compressibility are held constant at reference conditions.',
  'Darcy radial flow, with gravity ignored within the layer.',
  'The well is at the centre of the reservoir for the closed boundary.',
  'Initial pressure is uniform and equal to the well\'s declared reservoir pressure at the declared datum.'];
 for(const s of spec)assert.ok(a.assumptions.includes(s),s);
 assert.ok(a.assumptions.includes('reported/forecast rates are calendar-day averages (availability included)'));
 assert.ok(a.assumptions.some(x=>x.includes(fa.compressibilityPerPsi.toExponential(3))&&x.includes('4.000e-6')&&/c_w/.test(x)&&/c_t/.test(x)));
 assert.deepEqual(a.versions.transientCase,'transient-buildup/1');
 assert.equal(a.labels.rock,'assumed');assert.equal(a.labels.pressures,'calculated');assert.equal(a.labels.schedule,'synthetic/assumed');
});

function near(a,b,tol=1e-9){assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);}
