import test from 'node:test';
import assert from 'node:assert/strict';
import {C,e1,stehfest,besselK0e} from '../dist/transientMath.js';
import {TRANSIENT_MODEL_VERSION,lineSourceRise,wellboreUnitRise,riseFromSteps,tD,radiusOfInvestigation,averageRiseClosed} from '../dist/transientModel.js';
import {radialFdWellbore} from './helpers/radial-fd.mjs';

// Synthetic, fictional rock and fluid (no real well values).
const ROCK=Object.freeze({k:50,h:40,phi:0.15,ct:1e-5,mu:0.6,B:1.02});
const RW=0.3;
const INF={kind:'infinite'};
const rel=(a,b)=>Math.abs(a-b)/Math.abs(b);
const coef=(rock=ROCK)=>C.pressure*rock.B*rock.mu/(rock.k*rock.h); // psi per STB/day per unit dimensionless pressure
const closed=re=>({kind:'closed',re});
const wb=(b,s,rock=ROCK)=>t=>wellboreUnitRise(rock,b,RW,s,t);
const errs={}; const note=(k,v)=>{errs[k]=Math.max(errs[k]??0,v);};
test.after(()=>{console.log('ACHIEVED_ERRORS '+JSON.stringify(errs));});

test('version string and basic definitions',()=>{
 assert.equal(TRANSIENT_MODEL_VERSION,'line-source-closed-circle-stehfest/1');
 assert.ok(rel(tD(ROCK,RW,10),C.tD*50*10/(0.15*0.6*1e-5*0.09))<1e-14);
 assert.ok(rel(radiusOfInvestigation(ROCK,100),Math.sqrt(50*100/(948.12*0.15*0.6*1e-5)))<1e-14);
 assert.equal(lineSourceRise(ROCK,100,0),0);assert.equal(lineSourceRise(ROCK,100,-5),0);
 assert.equal(wellboreUnitRise(ROCK,INF,RW,2,0),0);assert.equal(wellboreUnitRise(ROCK,closed(3000),RW,2,0),0);
 const x=C.rinv*0.15*0.6*1e-5*200**2/(50*720);
 assert.ok(rel(lineSourceRise(ROCK,200,720),C.lineSource*1.02*0.6/(50*40)*e1(x))<1e-14);
});

test('benchmark 2: skin is an additive shift at r_w (s>=0) and an effective radius (s<0)',()=>{
 for(const t of [720,8760]){const d=wb(INF,3)(t)-wb(INF,0)(t),want=coef()*3;note('b2_additive',rel(d,want));assert.ok(rel(d,want)<1e-9,`t=${t} rel=${rel(d,want)}`);}
 // lineSourceRise takes no skin parameter, so at r = 2 r_w it is the same whatever skin the wellbore uses.
 assert.equal(lineSourceRise.length,3);
 const at2rw=lineSourceRise(ROCK,2*RW,720);assert.ok(at2rw>0&&Number.isFinite(at2rw));
 // s<0: effective radius r_wa = r_w e^{-s}, no additive term; late-time difference tends to C.pressure Bmu/(kh) s.
 {const t=87600,d=wb(INF,-3)(t)-wb(INF,0)(t),want=coef()*-3;note('b2_negative_late',rel(d,want));assert.ok(rel(d,want)<1e-3,`rel=${rel(d,want)}`);
  assert.ok(rel(wb(INF,-3)(t),lineSourceRise(ROCK,RW*Math.exp(3),t))<1e-14,'s<0 is the line source at r_wa');}
 // s=-5: every rise is >= 0 for t_D(r_wa) >= 100, infinite and closed.
 const rwa=RW*Math.exp(5),t100=100/tD(ROCK,rwa,1);
 for(const f of [1,2,5,10,100,1e3,1e4,1e5]){const t=t100*f;assert.ok(tD(ROCK,rwa,t)>=100*(1-1e-12));
  assert.ok(wb(INF,-5)(t)>=0,`inf t=${t}`);assert.ok(wb(closed(30000),-5)(t)>=0,`closed t=${t}`);}
 // Closed circle: same additive shift for s>=0.
 for(const t of [1,720,8760]){const d=wb(closed(3000),3)(t)-wb(closed(3000),0)(t);note('b2_closed_additive',rel(d,coef()*3));assert.ok(rel(d,coef()*3)<1e-9,`closed t=${t} rel=${rel(d,coef()*3)}`);}
 assert.throws(()=>wellboreUnitRise(ROCK,closed(40),RW,-5,100),/effective/);
});

test('benchmark 3: two-rate superposition equals the hand sum',()=>{
 for(const b of [INF,closed(3000)]){const u=wb(b,2);
  const v=riseFromSteps(u,[{startHours:0,rateStbd:1000},{startHours:720,rateStbd:1500}],1440),want=1000*u(1440)+500*u(720);
  note('b3',rel(v,want));assert.ok(rel(v,want)<1e-12,`${b.kind} rel=${rel(v,want)}`);}
});

test('benchmark 4: falloff equals the Horner form, decays to zero and loses skin',()=>{
 const steps=[{startHours:0,rateStbd:1000},{startHours:2000,rateStbd:0}],u=wb(INF,3),u0=wb(INF,0);
 const peak=riseFromSteps(u,steps,2000);
 for(const dt of [1,24,720,8760,2e6]){const v=riseFromSteps(u,steps,2000+dt),want=1000*(u(2000+dt)-u(dt));
  note('b4_horner',Math.abs(v-want)/peak);assert.ok(Math.abs(v-want)<=1e-12*peak,`dt=${dt}`);
  const skinLeft=v-riseFromSteps(u0,steps,2000+dt);note('b4_skin_after_shutin',Math.abs(skinLeft)/peak);assert.ok(Math.abs(skinLeft)<1e-9*peak,`skin dt=${dt} ${skinLeft}`);}
 const late=riseFromSteps(u,steps,2000+2e6);note('b4_decay_fraction',late/peak);assert.ok(late>=0&&late<0.01*peak,`late/peak=${late/peak}`);
});

test('benchmark 5: closed circle late time matches material balance and the PSS intercept',()=>{
 for(const [re,s] of [[300,0],[3000,0],[3000,3]]){const u=wb(closed(re),s),reD=re/RW;
  const t1=reD**2/tD(ROCK,RW,1),t2=4*t1; // t_D/r_eD^2 = 1 and 4
  const slope=(u(t2)-u(t1))/(t2-t1),mb=C.ft3PerBbl*ROCK.B/(24*ROCK.ct*Math.PI*(re**2-RW**2)*ROCK.h*ROCK.phi);
  note('b5_slope',rel(slope,mb));assert.ok(rel(slope,mb)<1e-4,`re=${re} s=${s} slope rel=${rel(slope,mb)}`);
  const approx=C.pss*ROCK.B/(ROCK.phi*ROCK.ct*ROCK.h*re**2);assert.ok(rel(mb,approx)<1e-4,'r_e >> r_w form');
  const icpt=u(t1)-slope*t1,want=coef()*(Math.log(re/RW)-0.75+s);
  note('b5_intercept',rel(icpt,want));assert.ok(rel(icpt,want)<1e-3,`re=${re} s=${s} intercept rel=${rel(icpt,want)}`);
 }
 const Q=3.65e6,re=3000,want=5.6146*Q*ROCK.B/(ROCK.ct*Math.PI*(re*re-RW*RW)*ROCK.h*ROCK.phi);
 note('b5_average',rel(averageRiseClosed(ROCK,re,RW,Q),want));assert.ok(rel(averageRiseClosed(ROCK,re,RW,Q),want)<1e-9);
 assert.equal(averageRiseClosed(ROCK,re,RW,0),0);
});

test('benchmark 6: linearity and monotonicity',()=>{
 const steps=[{startHours:0,rateStbd:800},{startHours:500,rateStbd:1200},{startHours:1500,rateStbd:300}],dbl=steps.map(x=>({...x,rateStbd:2*x.rateStbd}));
 for(const b of [INF,closed(3000)]){const u=wb(b,2);
  for(const t of [100,700,2000]){const one=riseFromSteps(u,steps,t),two=riseFromSteps(u,dbl,t);assert.ok(rel(two,2*one)<1e-14,`double t=${t}`);
   const halves=riseFromSteps(u,[{startHours:0,rateStbd:900},{startHours:t/2,rateStbd:900}],t),single=riseFromSteps(u,[{startHours:0,rateStbd:900}],t);note('b6_halves',rel(halves,single));assert.ok(rel(halves,single)<1e-14);}
  let prev=-Infinity;for(let e=-2;e<=5;e+=0.25){const v=u(10**e);assert.ok(v>=prev,`${b.kind} non-decreasing at t=1e${e}`);prev=v;}
  const late=8760,base=u(late);
  for(const [key,f] of [['k',2],['h',2],['ct',2]]){const r={...ROCK,[key]:ROCK[key]*f};assert.ok(wellboreUnitRise(r,b,RW,2,late)<=base,`${b.kind} ${key}`);}
 }
});

test('benchmark 7: closed circle agrees with an independent radial finite-difference run, which converges',()=>{
 const reD=1000,re=RW*reD,perHour=tD(ROCK,RW,1),u=wb(closed(re),0);
 const tDs=[100,1e4,1e5,3e5,2e6]; // early (infinite-acting), transition, late (pseudo-steady state)
 const fd200=radialFdWellbore({reD,cells:200,outputs:tDs}),fd400=radialFdWellbore({reD,cells:400,outputs:tDs}),fd800=radialFdWellbore({reD,cells:800,outputs:tDs});
 tDs.forEach((x,i)=>{const model=u(x/perHour)/coef(),e200=rel(fd200[i],model),e400=rel(fd400[i],model);
  note('b7_fd200',e200);note('b7_fd400',e400);
  assert.ok(e200<5e-3&&e400<5e-3,`tD=${x} rel 200=${e200} 400=${e400}`);
  // Closer to the model only where the FD error dominates; at t_D >= 1e5 both runs sit on the model's Stehfest N=12 floor (~2e-6 to 8e-6).
  if(x<=1e4)assert.ok(e400<e200,`tD=${x} converges toward the model: ${e200} -> ${e400}`);
  // FD self-convergence at every t_D (second order: each refinement shrinks the change about 4x).
  const d1=Math.abs(fd400[i]-fd200[i]),d2=Math.abs(fd800[i]-fd400[i]);note('b7_self_convergence_ratio',d2/d1);assert.ok(d2<d1,`tD=${x} self-convergence ${d1} -> ${d2}`);});
 // Time-step check: halving the step ratio moves the 400-cell result far less than refining 200 -> 400 cells.
 const fdHalf=radialFdWellbore({reD,cells:400,outputs:tDs,stepRatio:1e-3});
 tDs.forEach((x,i)=>{const dtShift=Math.abs(fdHalf[i]-fd400[i]),dxShift=Math.abs(fd400[i]-fd200[i]);note('b7_dt_over_dx',dtShift/dxShift);assert.ok(dtShift<0.25*dxShift,`tD=${x} dt ${dtShift} vs dx ${dxShift}`);});
});

test('benchmark 8: closed equals infinite-acting before the boundary is felt',()=>{
 const re=3000,ub=wb(closed(re),2),ui=wb(INF,2);
 for(const tDw of [1e4,1e5,1e6,2e6]){const t=tDw/tD(ROCK,RW,1);assert.ok(radiusOfInvestigation(ROCK,t)<0.3*re);
  note('b8',rel(ub(t),ui(t)));assert.ok(rel(ub(t),ui(t))<1e-4,`tD=${tDw} rel=${rel(ub(t),ui(t))}`);}
});

test('#8 benchmark 6: line source equals a Stehfest-inverted point source for a multi-step schedule',()=>{
 const r=500,rD=r/RW,perHour=tD(ROCK,RW,1);
 const pointSource=t=>t<=0?0:C.lineSource*ROCK.B*ROCK.mu/(ROCK.k*ROCK.h)*stehfest(s=>{const x=rD*Math.sqrt(s);return 2*besselK0e(x)*Math.exp(-x)/s;},t*perHour);
 const steps=[{startHours:0,rateStbd:600},{startHours:720,rateStbd:1400},{startHours:1464,rateStbd:1000},{startHours:2208,rateStbd:2000}];
 for(const t of [500,1000,2000,3000,8760]){const a=riseFromSteps(t2=>lineSourceRise(ROCK,r,t2),steps,t),b=riseFromSteps(pointSource,steps,t);
  note('b8_6_point_source',rel(a,b));assert.ok(rel(a,b)<1e-5,`t=${t} rel=${rel(a,b)}`);}
});

test('#8 benchmarks 3-5: reciprocity, similarity and the late-time log difference',()=>{
 // Reciprocity. For a homogeneous line source the response depends only on the distance |x_A - x_B|, so no non-trivial
 // reciprocity exists beyond this: with wells at real coordinates, A's effect at B under schedule S equals B's effect at A
 // when the schedules are swapped (B carries S). Different schedule shapes are used so a mix-up of schedules would fail.
 const A={x:120,y:-340},Bw={x:-410,y:255},S1=[{startHours:0,rateStbd:1000},{startHours:300,rateStbd:1500}],S2=[{startHours:0,rateStbd:1800},{startHours:900,rateStbd:700}];
 const dist=(p,q)=>Math.hypot(q.x-p.x,q.y-p.y),effect=(from,at,S,t)=>riseFromSteps(t2=>lineSourceRise(ROCK,dist(from,at),t2),S,t);
 for(const t of [500,2000,8760]){
  assert.equal(effect(A,Bw,S1,t),effect(Bw,A,S1,t),`S1 swapped t=${t}`);assert.equal(effect(A,Bw,S2,t),effect(Bw,A,S2,t),`S2 swapped t=${t}`);
  assert.notEqual(effect(A,Bw,S1,t),effect(Bw,A,S2,t),'different schedules give different effects');}
 // The rise depends only on |r|: the same distance measured from either side, or in any direction, gives the same value.
 const r=dist(A,Bw);assert.equal(lineSourceRise(ROCK,dist(A,Bw),720),lineSourceRise(ROCK,dist(Bw,A),720));
 assert.ok(rel(lineSourceRise(ROCK,Math.hypot(r*0.6,r*0.8),720),lineSourceRise(ROCK,r,720))<1e-14);
 for(const [r,t] of [[100,10],[1000,500]]){const v1=lineSourceRise(ROCK,r,t),v2=lineSourceRise(ROCK,2*r,4*t);note('b8_4_similarity',rel(v2,v1));assert.ok(rel(v2,v1)<1e-14);}
 const r1=200,r2=1000,t=87600,diff=lineSourceRise(ROCK,r1,t)-lineSourceRise(ROCK,r2,t),want=coef()*Math.log(r2/r1);
 note('b8_5_log_difference',rel(diff,want));assert.ok(rel(diff,want)<1e-3,`rel=${rel(diff,want)}`);
});

test('fix round 1: non-finite or negative times throw; t <= 0 gives 0 for unit responses',()=>{
 for(const bad of [NaN,Infinity,-Infinity]){
  assert.throws(()=>lineSourceRise(ROCK,100,bad),/finite/);assert.throws(()=>wellboreUnitRise(ROCK,INF,RW,1,bad),/finite/);
  assert.throws(()=>wellboreUnitRise(ROCK,closed(3000),RW,1,bad),/finite/);assert.throws(()=>riseFromSteps(t=>t,[{startHours:0,rateStbd:1}],bad),/finite/);
  assert.throws(()=>tD(ROCK,RW,bad),/finite/);assert.throws(()=>radiusOfInvestigation(ROCK,bad),/finite/);}
 assert.throws(()=>tD(ROCK,RW,-1),/non-negative/);assert.throws(()=>radiusOfInvestigation(ROCK,-1),/non-negative/);
 assert.equal(tD(ROCK,RW,0),0);assert.equal(radiusOfInvestigation(ROCK,0),0);
 for(const t of [0,-1])assert.equal(lineSourceRise(ROCK,100,t),0);
 assert.equal(wellboreUnitRise(ROCK,closed(3000),RW,1,-1),0);assert.equal(riseFromSteps(t=>1,[{startHours:10,rateStbd:5}],5),0);
});
