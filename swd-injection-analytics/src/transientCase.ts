// #7 (ANA-E06) transient single-well buildup case: inputs, validation, guards, outputs and one-at-a-time sensitivity.
// Display only: reads a disposal case (well P_i, limit, datum, fluid temperature/salinity, Base forecast) and never feeds back into it.
// Units: q STB/day, B rb/STB, mu cP, k md, h ft, r ft, t hours, phi fraction, ct 1/psi. A month is its calendar days x 24 h.
// Skin applies at the subject wellbore only (s >= 0 additive; s < 0 effective radius r_wa = r_w e^(-s)); never in profiles or the average.
// The closed-circle distance profile (r > r_w, no skin) uses the finite-wellbore Laplace solution at r_D, inverted by Stehfest:
// pD(r_D,s) = [K0(r_D a)I1(b) + I0(r_D a)K1(b)] / (s a [I1(b)K1(a) - K1(b)I1(a)]), a = sqrt(s), b = r_eD a, in scaled ratio form.
import {C,TRANSIENT_MATH_VERSION,besselI0e,besselI1e,besselK0e,besselK1e,stehfest} from './transientMath.js';
import {TRANSIENT_MODEL_VERSION,CLOSED_STEHFEST_N,type Rock,type Boundary,type Step,lineSourceRise,wellboreUnitRise,riseFromSteps,tD,radiusOfInvestigation,averageRiseClosed} from './transientModel.js';
import {brineAtPressure} from './brinePvt.js';
import type {DisposalCase,DisposalWell} from './disposalCase.js';
import {validateInjector} from './engineering.js';
import {fmtNumber} from './caseSummary.js';
import {daysInMonth,monthIndex,monthAt} from './planning.js';
export const TRANSIENT_CASE_VERSION='transient-buildup/1';
export const CLOSING_7='Screening estimate from assumed rock and fluid properties; not a calibrated or permitted pressure.';
export const HANDOFF_NOTE='You may type this as an assumed reservoir-pressure offset in Well-performance cases. It is not applied automatically. That offset applies to every well in the case, not only this one.';
export const GUARD_TOO_SHORT='the step is too short for this model (wellbore storage and early-time effects are not modelled)';
export const FICTIONAL_EXAMPLE_LABEL='fictional example — not typical values';
export const PVT_BLOCK='outside the 100–10,000 psia range of the fluid model';
export const PROFILE_LABEL='rise above initial; excludes skin';
export const SENSITIVITY_LABEL='one at a time; not additive';
const MISSING_COPIED='not in the disposal case: enter a rate (0 = shut in)';
export type RockInput={k:number;h:number;phi:number;cf:number;rw:number;skin:number};
export type SensitivityFactor='k'|'h'|'cf'|'skin'|'re';
export type TransientInput={wellId:string;rock:RockInput;boundary:{kind:'infinite';statedExtentFt:number|null}|{kind:'closed';re:number};
 schedule:{months:{month:string;rateStbd:number|null}[];origin:'typed'|{copiedFrom:string;copiedAt:string}};   // null = not yet typed
 profileMonths:string[];                                   // up to 3 months for the distance curve
 sensitivity:{[K in SensitivityFactor]?:{low:number;high:number}}};
/** Fictional values for demonstration only; labelled FICTIONAL_EXAMPLE_LABEL. Not typical values. */
export const FICTIONAL_EXAMPLE:RockInput&{re:number}=Object.freeze({k:50,h:100,phi:0.15,cf:4e-6,rw:0.35,skin:2,re:3000});
export type LimitStatus='reached'|'not-reached'|'not-determined';
type Outcome={firstMonthAtLimit:string|null;limitStatus:LimitStatus;endBottomholePsia:number|null};
export type TransientResult={inputs:TransientInput;well:{id:string;reservoirPsia:number;limitPsia:number;datum:string};
 fluid:{mu:number;B:number;cw:number;cf:number;ct:number;temperatureF:number;salinityWtPercent:number};
 monthly:{month:string;endHours:number;risePsi:number|null;skinPsi:number|null;bottomholePsia:number|null;blocked:string|null}[];   // blocked rows: all three null
 firstMonthAtLimit:string|null;limitStatus:LimitStatus;endBottomholePsia:number|null;profiles:{month:string;points:{rFt:number;risePsi:number}[]}[];
 averageRise:{month:string;psi:number}[]|null;handoff:{month:string;psi:number;note:string}|null;
 warnings:string[];sensitivity:{factor:SensitivityFactor;low:Outcome;high:Outcome}[];
 assumptions:string[];closing:string;
 labels:{rock:string;boundary:string;distances:string;schedule:string;pressures:string;profiles:string;sensitivity:string};
 versions:Record<string,string>};
const FACTORS:readonly SensitivityFactor[]=['k','h','cf','skin','re'];
const FACTOR_LABEL:Record<SensitivityFactor,string>={k:'k',h:'h',cf:'c_f',skin:'skin',re:'r_e'};
const BOUNDS={
 k:{label:'Permeability k',min:0.01,max:10000,text:'0.01 and 10,000 md'},
 h:{label:'Thickness h',min:1,max:5000,text:'1 and 5,000 ft'},
 phi:{label:'Porosity φ',min:0.01,max:0.4,text:'0.01 and 0.40'},
 cf:{label:'Formation compressibility c_f',min:1e-7,max:1e-4,text:'1e-7 and 1e-4 /psi'},
 rw:{label:'Wellbore radius r_w',min:0.1,max:2,text:'0.1 and 2 ft'},
 skin:{label:'Skin s',min:-5,max:50,text:'−5 and 50'},
} as const;
const RE_BOUND={label:'Boundary radius r_e',min:100,max:264000,text:'100 and 264,000 ft'};
const EXTENT_BOUND={label:'Stated extent',min:100,max:264000,text:'100 and 264,000 ft'};
const MAX_RATE=100000;
const isNum=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const isObj=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const isIsoDate=(v:unknown)=>{
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
 const d=new Date(v+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;
};
const ft=(v:number)=>fmtNumber(v,v<10?2:0);
function range(out:string[],v:unknown,b:{label:string;min:number;max:number;text:string},prefix:string):boolean{
 if(!isNum(v)||v<b.min||v>b.max){out.push(`${prefix}${b.label} must be a number between ${b.text}`);return false;}
 return true;
}
const rEffOf=(rw:number,skin:number)=>skin<0?rw*Math.exp(-skin):rw;
function validateRockBoundary(out:string[],rock:unknown,boundary:unknown,prefix:string){
 if(!isObj(rock)){out.push(`${prefix}Rock inputs (k, h, φ, c_f, r_w, s) are required`);return;}
 let ok=true;
 for(const key of ['k','h','phi','cf','rw','skin'] as const)ok=range(out,rock[key],BOUNDS[key],prefix)&&ok;
 const kind=isObj(boundary)?boundary.kind:undefined;
 if(kind!=='infinite'&&kind!=='closed'){out.push(`${prefix}Boundary must be no edge (infinite-acting) or a closed circle`);return;}
 const b=boundary as Record<string,unknown>;
 if(kind==='closed')range(out,b.re,RE_BOUND,prefix);
 else if(b.statedExtentFt!==null)range(out,b.statedExtentFt,EXTENT_BOUND,prefix);
 if(!ok)return;
 const rw=rock.rw as number,skin=rock.skin as number,rwa=rEffOf(rw,skin);
 if(skin<0&&rwa>=1000)out.push(`${prefix}Skin s: the effective wellbore radius r_w·e^(−s) (${ft(rwa)} ft) must be below 1,000 ft`);
 if(kind==='closed'&&isNum(b.re)&&b.re>0){
  // The 100 · r_w rule is reported whenever r_e is a positive number, even if it also fails the 100–264,000 ft range.
  const re=b.re;
  if(re<100*rw)out.push(`${prefix}Boundary radius r_e must be at least 100 · r_w (${ft(100*rw)} ft)`);
  if(skin<0){
   if(rwa>=0.1*re)out.push(`${prefix}Skin s: the effective wellbore radius r_w·e^(−s) (${ft(rwa)} ft) must be below 0.1 · r_e (${ft(0.1*re)} ft)`);
   if(re<100*rwa)out.push(`${prefix}Boundary radius r_e must be at least 100 · r_wa, where r_wa = r_w·e^(−s) (${ft(100*rwa)} ft)`);
  }
 }
}
function caseWell(result:DisposalCase,wellId:unknown):DisposalWell|undefined{return result.inputs.wells.find(w=>w.id===wellId);}
const temperatureOf=(result:DisposalCase,well:DisposalWell)=>well.bottomholeTemperatureF??result.inputs.fluid.temperatureF;
/** Base allocation averageStbd (calendar-day average) for the well; fills the first..last month span, missing months rateStbd:null. */
export function scheduleFromForecast(result:DisposalCase,wellId:string,copiedAt:string):TransientInput['schedule']{
 if(!caseWell(result,wellId))throw Error(`Well ${wellId} is not in the disposal case`);
 const rates=new Map<string,number>();
 for(const m of result.base.monthly){const a=m.allocations.find(x=>x.wellId===wellId);if(a)rates.set(m.month,a.averageStbd);}
 if(rates.size===0)throw Error(`Well ${wellId} has no Base forecast months to copy`);
 const idx=[...rates.keys()].map(monthIndex),first=Math.min(...idx),last=Math.max(...idx);
 const months=Array.from({length:last-first+1},(_,i)=>{const month=monthAt(first+i);return {month,rateStbd:rates.has(month)?rates.get(month)!:null};});
 return {months,origin:{copiedFrom:result.inputs.caseName,copiedAt}};
}
/** [] when ready; otherwise messages naming each failing input. Never throws on user input. */
export function validateTransientInput(result:DisposalCase,input:TransientInput):string[]{
 const out:string[]=[];
 if(!isObj(input))return ['Transient inputs are required'];
 const well=caseWell(result,input.wellId);
 if(!well)out.push(`Well ${String(input.wellId)} is not in the disposal case`);
 else{
  let injectorOk=true;
  try{validateInjector(well);}catch(e){injectorOk=false;out.push(`Well ${well.id}: ${e instanceof Error?e.message:String(e)}`);}
  if(injectorOk){
   try{brineAtPressure(well.reservoirPsia,temperatureOf(result,well),result.inputs.fluid.salinityWtPercent);}
   catch(e){out.push(`Well ${well.id} fluid: ${e instanceof Error?e.message:String(e)}`);}
  }
 }
 const before=out.length;
 validateRockBoundary(out,input.rock,input.boundary,'');
 const rockOk=out.length===before;
 // Schedule
 const s=input.schedule,copied=isObj(s)&&isObj(s.origin);
 const schedMonths:string[]=[];
 if(!isObj(s)||!Array.isArray(s.months)||s.months.length<1||s.months.length>120)out.push('Rate schedule must have 1–120 consecutive months');
 else{
  if(!(s.origin==='typed'||(isObj(s.origin)&&typeof s.origin.copiedFrom==='string'&&s.origin.copiedFrom.trim()!==''&&typeof s.origin.copiedAt==='string')))
   out.push('Rate schedule origin must be typed or copied from a disposal case with a date');
  else if(isObj(s.origin)&&!isIsoDate(s.origin.copiedAt))out.push('Rate schedule copied date (copiedAt) must be an ISO date (YYYY-MM-DD)');
  let monthsOk=true;
  s.months.forEach((row,i)=>{
   const month=isObj(row)?row.month:undefined;
   let valid=false;try{if(typeof month==='string'){monthIndex(month);valid=true;}}catch{valid=false;}
   if(!valid){monthsOk=false;out.push(`Schedule month ${i+1} (${String(month)}) is not a valid YYYY-MM month`);return;}
   schedMonths.push(month as string);
   const rate=(row as Record<string,unknown>).rateStbd;
   if(rate===null||rate===undefined)out.push(`Rate for ${month} is not entered (${copied?MISSING_COPIED:'enter a rate (0 = shut in)'})`);
   else if(isNum(rate)&&rate<0)out.push(`Rate for ${month} must not be negative (injection only; production is not modelled)`);
   else if(!isNum(rate)||rate>MAX_RATE)out.push(`Rate for ${month} must be a number between 0 and 100,000 STB/day`);
  });
  if(monthsOk){
   const first=monthIndex(schedMonths[0]);
   if(schedMonths.some((m,i)=>monthIndex(m)!==first+i))out.push('Rate schedule months must be consecutive, in order, with no gaps or repeats');
  }
 }
 // Profile months
 if(!Array.isArray(input.profileMonths)||input.profileMonths.length>3)out.push('Profile months: choose up to 3 months');
 else{
  if(new Set(input.profileMonths).size!==input.profileMonths.length)out.push('Profile months must be distinct');
  for(const m of input.profileMonths)if(!schedMonths.includes(m as string))out.push(`Profile month ${String(m)} is not in the rate schedule`);
 }
 // Sensitivity (each low/high validated as a full rock/boundary input)
 if(!isObj(input.sensitivity))out.push('Sensitivity must be an object (it may be empty)');
 else for(const [key,value] of Object.entries(input.sensitivity)){
  if(!(FACTORS as readonly string[]).includes(key)){out.push(`Sensitivity ${key} is not a supported factor (k, h, c_f, skin, r_e)`);continue;}
  const f=key as SensitivityFactor,label=FACTOR_LABEL[f];
  if(!isObj(value)){out.push(`Sensitivity ${label} needs low and high values`);continue;}
  if(f==='re'&&isObj(input.boundary)&&input.boundary.kind!=='closed'){out.push(`Sensitivity r_e needs a closed boundary`);continue;}
  if(!rockOk)continue;
  for(const side of ['low','high'] as const){
   const v=variant(input,f,value[side] as number);
   validateRockBoundary(out,v.rock,v.boundary,`Sensitivity ${label} ${side}: `);
  }
 }
 return out;
}
function variant(input:TransientInput,f:SensitivityFactor,v:number):{rock:RockInput;boundary:TransientInput['boundary']}{
 if(f==='re')return {rock:{...input.rock},boundary:{kind:'closed',re:v}};
 return {rock:{...input.rock,[f]:v},boundary:{...input.boundary}};
}
// Closed-circle Laplace pressure at r_D (no skin), scaled ratio form; equals the wellbore form at r_D = 1.
function pDClosedCircleLaplace(sL:number,rD:number,reD:number):number{
 const a=Math.sqrt(sL),b=reD*a,x=rD*a;
 const num=besselK0e(x)*besselI1e(b)*Math.exp(-(rD-1)*a)+besselI0e(x)*besselK1e(b)*Math.exp((rD+1)*a-2*b);
 const den=sL*a*(besselI1e(b)*besselK1e(a)-besselK1e(b)*besselI1e(a)*Math.exp(-2*(b-a)));
 return num/den;
}
/** Closed-circle unit rise at distance r (r_w <= r <= r_e), psi per STB/day, no skin; 0 for t <= 0. Exported for tests. */
export function _closedRiseAt(rock:Rock,re:number,rw:number,r:number,tHours:number):number{
 if(!(rw>0&&re>rw&&r>=rw&&r<=re*(1+1e-12)))throw Error('distance must lie between r_w and r_e');
 if(!Number.isFinite(tHours))throw Error('time must be a finite number of hours');
 if(tHours<=0)return 0;
 const coef=C.pressure*rock.B*rock.mu/(rock.k*rock.h);
 return coef*stehfest(sL=>pDClosedCircleLaplace(sL,Math.min(r/rw,re/rw),re/rw),tD(rock,rw,tHours),CLOSED_STEHFEST_N);
}
type Timeline={months:string[];days:number[];startHours:number[];endHours:number[];rates:number[];steps:Step[]};
type Fluid={mu:number;B:number;cw:number};
type MonthRow=TransientResult['monthly'][number];
function memo(f:(t:number)=>number){const m=new Map<number,number>();return (t:number)=>{let v=m.get(t);if(v===undefined){v=f(t);m.set(t,v);}return v;};}
const rockOf=(r:RockInput,fluid:Fluid):Rock=>({k:r.k,h:r.h,phi:r.phi,ct:fluid.cw+r.cf,mu:fluid.mu,B:fluid.B});
const modelBoundary=(b:TransientInput['boundary']):Boundary=>b.kind==='closed'?{kind:'closed',re:b.re}:{kind:'infinite'};
/** Wellbore series for one rock/boundary: guard, absolute pressure, PVT block, first month at the limit. */
function wellboreSeries(tl:Timeline,rockIn:RockInput,boundary:TransientInput['boundary'],fluid:Fluid,pi:number,limit:number){
 const rock=rockOf(rockIn,fluid),rEff=rEffOf(rockIn.rw,rockIn.skin),b=modelBoundary(boundary);
 const unit=memo(t=>wellboreUnitRise(rock,b,rockIn.rw,rockIn.skin,t));
 const coef=C.pressure*rock.B*rock.mu/(rock.k*rock.h);
 let guardAt=tl.months.length;
 for(let i=0,prev=0;i<tl.months.length;i++){
  if(tl.rates[i]!==prev&&tD(rock,rEff,tl.days[i]*24)<100){guardAt=i;break;}
  prev=tl.rates[i];
 }
 const monthly:MonthRow[]=[];let pvtAt:number|null=null,pvtHigh=false;
 tl.months.forEach((month,i)=>{
  const endHours=tl.endHours[i];
  if(i>=guardAt){monthly.push({month,endHours,risePsi:null,skinPsi:null,bottomholePsia:null,blocked:GUARD_TOO_SHORT});return;}
  if(pvtAt!==null){monthly.push({month,endHours,risePsi:null,skinPsi:null,bottomholePsia:null,blocked:PVT_BLOCK});return;}
  const rise=riseFromSteps(unit,tl.steps,endHours),p=pi+rise;
  if(p<100||p>10000){pvtAt=i;pvtHigh=p>10000;monthly.push({month,endHours,risePsi:null,skinPsi:null,bottomholePsia:null,blocked:PVT_BLOCK});return;}
  monthly.push({month,endHours,risePsi:rise,skinPsi:coef*rockIn.skin*tl.rates[i]||0,bottomholePsia:p,blocked:null});
 });
 // A month blocked above 10,000 psia has P > 10,000 >= limitPsia, so the limit is crossed there (if not earlier).
 // A low-side (P < 100) block does not cross the limit. A guard block before any crossing leaves the answer undetermined.
 const firstIdx=monthly.findIndex((m,i)=>(m.bottomholePsia!==null&&m.bottomholePsia>=limit)||(i===pvtAt&&pvtHigh));
 const firstMonthAtLimit=firstIdx>=0?monthly[firstIdx].month:null;
 const limitStatus:LimitStatus=firstMonthAtLimit!==null?'reached':monthly.every(m=>m.blocked===null)?'not-reached':'not-determined';
 return {rock,monthly,guardAt,pvtAt,firstMonthAtLimit,limitStatus,endBottomholePsia:monthly[monthly.length-1].bottomholePsia};
}
/** Throws Error(messages.join('; ')) when validation fails. Pure and deterministic; the case result is not modified. */
export function buildTransientCase(result:DisposalCase,input:TransientInput):TransientResult{
 const messages=validateTransientInput(result,input);
 if(messages.length)throw Error(messages.join('; '));
 const inputs=structuredClone(input),well=caseWell(result,inputs.wellId)!;
 const temperatureF=temperatureOf(result,well),salinityWtPercent=result.inputs.fluid.salinityWtPercent;
 const brine=brineAtPressure(well.reservoirPsia,temperatureF,salinityWtPercent);
 const fluid:Fluid={mu:brine.viscosityCp,B:brine.bwRbPerStb,cw:brine.compressibilityPerPsi};
 const pi=well.reservoirPsia,limit=well.limitPsia;
 // Timeline: consecutive calendar months, each a constant-rate step.
 const months=inputs.schedule.months.map(m=>m.month),days=months.map(daysInMonth),rates=inputs.schedule.months.map(m=>m.rateStbd as number);
 const startHours:number[]=[],endHours:number[]=[];
 days.reduce((h,d,i)=>{startHours[i]=h;endHours[i]=h+d*24;return endHours[i];},0);
 const tl:Timeline={months,days,startHours,endHours,rates,steps:months.map((_,i)=>({startHours:startHours[i],rateStbd:rates[i]}))};
 const base=wellboreSeries(tl,inputs.rock,inputs.boundary,fluid,pi,limit),rock=base.rock;
 const blockedAt=Math.min(base.guardAt,base.pvtAt??Infinity);
 const closed=inputs.boundary.kind==='closed'?inputs.boundary:null;
 // r_inv is measured from the start of the first month with a non-zero rate (no pressure moves before injection starts).
 const firstInj=rates.findIndex(q=>q>0),injStart=firstInj>=0?startHours[firstInj]:Infinity;
 const rinvAt=(h:number)=>h>injStart?radiusOfInvestigation(rock,h-injStart):0;
 // Distance profiles: 25 log-spaced points from 2 r_w to r_e (closed) or 2 r_inv (infinite); no skin.
 const profiles=inputs.profileMonths.map(month=>{
  const i=months.indexOf(month),t=endHours[i];
  if(i>=blockedAt)return {month,points:[]};
  const rMin=2*inputs.rock.rw,rMax=closed?closed.re:2*rinvAt(t);
  if(!(rMax>rMin))return {month,points:[]};
  const points=Array.from({length:25},(_,j)=>{
   const rFt=j===24?rMax:rMin*Math.pow(rMax/rMin,j/24);
   const u=memo(dt=>closed?_closedRiseAt(rock,closed.re,inputs.rock.rw,rFt,dt):lineSourceRise(rock,rFt,dt));
   // Clamp at 0: ahead of the pressure front the Stehfest inversion of the closed circle can return about -1e-6 psi per STB/day of round-off.
   return {rFt,risePsi:Math.max(0,riseFromSteps(u,tl.steps,t))};
  });
  return {month,points};
 });
 // Average rise (closed only, material balance, no skin) and the manual hand-off.
 let averageRise:TransientResult['averageRise']=null,handoff:TransientResult['handoff']=null;
 if(closed){
  let cum=0;averageRise=[];
  for(let i=0;i<months.length;i++){cum+=rates[i]*days[i];if(i<blockedAt)averageRise.push({month:months[i],psi:averageRiseClosed(rock,closed.re,inputs.rock.rw,cum)});}
  const last=months.length-1;
  if(last<blockedAt)handoff={month:months[last],psi:averageRise[last].psi,note:HANDOFF_NOTE};
 }
 // Warnings
 const warnings:string[]=[];
 if(base.guardAt<months.length)warnings.push(`${months[base.guardAt]}: ${GUARD_TOO_SHORT}; results from this month on are not shown`);
 if(base.pvtAt!==null)warnings.push(`${months[base.pvtAt]}: bottomhole pressure is ${PVT_BLOCK}; results from this month on are not shown`);
 if(base.firstMonthAtLimit)warnings.push(`Bottomhole pressure reaches the limit (${fmtNumber(limit)} psia) in ${base.firstMonthAtLimit}`);
 const reachIdx=(extent:number)=>endHours.findIndex(h=>h>injStart&&rinvAt(h)>=extent);
 if(closed){const i=reachIdx(closed.re);if(i>=0)warnings.push(`boundary reached in ${months[i]}: the radius of investigation reaches the assumed boundary radius r_e (${fmtNumber(closed.re)} ft)`);}
 else if(inputs.boundary.kind==='infinite'&&inputs.boundary.statedExtentFt!==null){
  const i=reachIdx(inputs.boundary.statedExtentFt);
  if(i>=0)warnings.push(`results assume no edge, but pressure has reached the extent you stated (${fmtNumber(inputs.boundary.statedExtentFt)} ft) in ${months[i]}`);
 }
 // One-at-a-time sensitivity; c_t recomputed from c_f.
 const sensitivity=FACTORS.filter(f=>inputs.sensitivity[f]).map(f=>{
  const run=(v:number):Outcome=>{const x=variant(inputs,f,v),s=wellboreSeries(tl,x.rock,x.boundary,fluid,pi,limit);return {firstMonthAtLimit:s.firstMonthAtLimit,limitStatus:s.limitStatus,endBottomholePsia:s.endBottomholePsia};};
  return {factor:f,low:run(inputs.sensitivity[f]!.low),high:run(inputs.sensitivity[f]!.high)};
 });
 const ct=fluid.cw+inputs.rock.cf;
 const assumptions=[
  'One vertical well, fully penetrating a single homogeneous, isotropic layer of uniform thickness.',
  'Single-phase, slightly compressible water. Viscosity, Bw and total compressibility are held constant at reference conditions.',
  'Darcy radial flow, with gravity ignored within the layer.',
  'The well is at the centre of the reservoir for the closed boundary.',
  'Initial pressure is uniform and equal to the well\'s declared reservoir pressure at the declared datum.',
  'The no-edge option uses the line-source approximation at the wellbore.',
  `Total compressibility c_t = c_w + c_f = ${fluid.cw.toExponential(3)} + ${inputs.rock.cf.toExponential(3)} = ${ct.toExponential(3)} 1/psi (c_w from the brine model at ${fmtNumber(pi)} psia and ${fmtNumber(temperatureF)} °F; c_f assumed).`,
  'reported/forecast rates are calendar-day averages (availability included)',
  'Skin applies at the wellbore radius r_w only, never in the rock beyond it, in the average pressure or in the distance profiles; a negative skin uses the effective radius r_w·e^(−s).',
  'Pressures are psia, bottomhole-absolute, at the well\'s declared datum; the rise above initial pressure carries no basis.',
  'Not modelled: wellbore storage, partial penetration, layering, two-phase flow, thermal effects, geomechanics or fracturing.',
 ];
 const origin=inputs.schedule.origin;
 return {inputs,well:{id:well.id,reservoirPsia:pi,limitPsia:limit,datum:well.datum},
  fluid:{mu:fluid.mu,B:fluid.B,cw:fluid.cw,cf:inputs.rock.cf,ct,temperatureF,salinityWtPercent},
  monthly:base.monthly,firstMonthAtLimit:base.firstMonthAtLimit,limitStatus:base.limitStatus,endBottomholePsia:base.endBottomholePsia,profiles,averageRise,handoff,
  warnings,sensitivity,assumptions,closing:CLOSING_7,
  labels:{rock:'assumed',boundary:'assumed',distances:'assumed',schedule:origin==='typed'?'synthetic/assumed':`forecast (copied from disposal case, ${origin.copiedAt})`,pressures:'calculated',profiles:PROFILE_LABEL,sensitivity:SENSITIVITY_LABEL},
  versions:{transientCase:TRANSIENT_CASE_VERSION,transientModel:TRANSIENT_MODEL_VERSION,transientMath:TRANSIENT_MATH_VERSION,disposalCase:result.methodVersion}};
}
