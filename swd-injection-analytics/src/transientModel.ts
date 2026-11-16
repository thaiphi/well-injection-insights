// Transient pressure-rise unit responses and time superposition for #7 (subject wellbore) and #8 (offset wells).
// Units: q STB/day, B rb/STB, mu cP, k md, h ft, r ft, t hours, phi fraction, ct 1/psi. Computation uses C only (never DISPLAY).
// Infinite-acting: line source, dp = C.lineSource q B mu/(k h) E1(C.rinv phi mu ct r^2/(k t)).
// Closed circle: finite wellbore, closed outer boundary, constant rate (van Everdingen & Hurst 1949; Laplace form as in
// Ozkan & Raghavan / Stehfest 1970), pwD(s) = [K0(a)I1(b) + I0(a)K1(b)] / (s a [I1(b)K1(a) - K1(b)I1(a)]), a = sqrt(s), b = reD a,
// evaluated in ratio form from exponentially scaled Bessel functions (divide by e^(b-a); cross terms carry e^(-2(b-a))).
// Skin applies at r_w only: s >= 0 adds C.pressure B mu/(k h) s (for the closed circle, the exact inverse of s/s_L, added after inversion);
// s < 0 uses the effective radius r_wa = r_w e^(-s) with no added term. lineSourceRise and averageRiseClosed never include skin.
import {C,e1,besselI0e,besselI1e,besselK0e,besselK1e,stehfest} from './transientMath.js';

export const TRANSIENT_MODEL_VERSION='line-source-closed-circle-stehfest/1';
export type Rock={k:number;h:number;phi:number;ct:number;mu:number;B:number};            // ct total
export type Boundary={kind:'infinite'}|{kind:'closed';re:number};
export type Step={startHours:number;rateStbd:number};                                     // rate from startHours until next step

/** Stehfest N used for the closed circle. N=12 meets every benchmark (see tests/transient-model.test.mjs). */
export const CLOSED_STEHFEST_N=12;

const finiteTime=(t:number)=>{if(typeof t!=='number'||!Number.isFinite(t))throw Error('time must be a finite number of hours');};
const finitePositive=(x:number,label:string)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<=0)throw Error(`${label} must be a finite positive number`);};
function checkRock(rock:Rock){for(const key of ['k','h','phi','ct','mu','B'] as const)finitePositive(rock[key],`rock.${key}`);}

/** Dimensionless time t_D = C.tD k t/(phi mu ct r^2). */
export function tD(rock:Rock,r:number,tHours:number):number{
 checkRock(rock);finitePositive(r,'r');finiteTime(tHours);if(tHours<0)throw Error('time must be non-negative');
 return C.tD*rock.k*tHours/(rock.phi*rock.mu*rock.ct*r*r);
}

/** Radius of investigation sqrt(k t/(C.rinv phi mu ct)), ft. */
export function radiusOfInvestigation(rock:Rock,tHours:number):number{
 checkRock(rock);finiteTime(tHours);if(tHours<0)throw Error('time must be non-negative');
 return Math.sqrt(rock.k*tHours/(C.rinv*rock.phi*rock.mu*rock.ct));
}

const lineCoef=(rock:Rock)=>C.lineSource*rock.B*rock.mu/(rock.k*rock.h);
const pressureCoef=(rock:Rock)=>C.pressure*rock.B*rock.mu/(rock.k*rock.h);

/** Line-source unit response at distance r, psi per STB/day, no skin; 0 for t <= 0. */
export function lineSourceRise(rock:Rock,r:number,tHours:number):number{
 checkRock(rock);finitePositive(r,'r');finiteTime(tHours);
 if(tHours<=0)return 0;
 return lineCoef(rock)*e1(C.rinv*rock.phi*rock.mu*rock.ct*r*r/(rock.k*tHours));
}

// Dimensionless closed-circle wellbore pressure in Laplace space (ratio form, finite for any s>0 and large reD).
function pwDClosedCircleLaplace(sL:number,reD:number):number{
 const a=Math.sqrt(sL),b=reD*a,r=Math.exp(-2*(b-a));
 const num=besselK0e(a)*besselI1e(b)+besselI0e(a)*besselK1e(b)*r;
 const den=sL*a*(besselI1e(b)*besselK1e(a)-besselK1e(b)*besselI1e(a)*r);
 return num/den;
}

/** Wellbore unit response, psi per STB/day at r_w. s >= 0 additive; s < 0 effective radius r_wa. Closed circle via Stehfest. */
export function wellboreUnitRise(rock:Rock,b:Boundary,rw:number,skin:number,tHours:number):number{
 checkRock(rock);finitePositive(rw,'rw');
 if(typeof skin!=='number'||!Number.isFinite(skin))throw Error('skin must be a finite number');
 const rEff=skin<0?rw*Math.exp(-skin):rw,sAdd=skin<0?0:skin;
 if(b.kind==='closed'){
  finitePositive(b.re,'re');
  if(!(b.re>rEff))throw Error(skin<0?'closed boundary radius must exceed the effective wellbore radius r_w e^(-s)':'closed boundary radius must exceed r_w');
 }
 finiteTime(tHours);
 if(tHours<=0)return 0;
 if(b.kind==='infinite')return lineSourceRise(rock,rEff,tHours)+pressureCoef(rock)*sAdd;
 const reD=b.re/rEff;
 // Skin is added outside the inversion: L^-1[s/s_L] = s exactly, so this equals inverting p_wD + s/s_L without Stehfest round-off.
 return pressureCoef(rock)*(stehfest(sL=>pwDClosedCircleLaplace(sL,reD),tD(rock,rEff,tHours),CLOSED_STEHFEST_N)+sAdd);
}

/** Superposition in time: sum_j (q_j - q_{j-1}) unit(t - t_j), steps ordered by startHours, q_{-1} = 0. */
export function riseFromSteps(unit:(t:number)=>number,steps:readonly Step[],tHours:number):number{
 finiteTime(tHours);
 let prev=0,prevStart=-Infinity,sum=0;
 for(const step of steps){
  if(!Number.isFinite(step.startHours)||!Number.isFinite(step.rateStbd))throw Error('step start and rate must be finite');
  if(step.startHours<prevStart)throw Error('steps must be ordered by startHours');
  prevStart=step.startHours;
  const dq=step.rateStbd-prev;prev=step.rateStbd;
  if(dq!==0&&tHours>step.startHours)sum+=dq*unit(tHours-step.startHours);
 }
 return sum;
}

/** Average pressure rise in a closed circle by material balance (no skin): C.ft3PerBbl Q B/(ct pi (re^2 - rw^2) h phi). */
export function averageRiseClosed(rock:Rock,re:number,rw:number,cumulativeStb:number):number{
 checkRock(rock);finitePositive(rw,'rw');finitePositive(re,'re');
 if(!(re>rw))throw Error('closed boundary radius must exceed r_w');
 if(typeof cumulativeStb!=='number'||!Number.isFinite(cumulativeStb))throw Error('cumulative injection must be finite');
 return C.ft3PerBbl*cumulativeStb*rock.B/(rock.ct*Math.PI*(re*re-rw*rw)*rock.h*rock.phi);
}
