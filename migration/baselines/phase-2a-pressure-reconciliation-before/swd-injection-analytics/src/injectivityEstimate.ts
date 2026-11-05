import {segmentedHydraulicPoint,type DisposalWell} from './disposalCase.js';
import type {DiagnosticsState} from './h10Diagnostics.js';
import {DEPTH_TOLERANCE_FT,type TestRecord,type TestState} from './testRecords.js';
import {traverseBrineWell,TraverseError,type SegmentedBrineSettings,type WellboreGeometry} from './wellboreTraverse.js';

/** Phase 1c test-referenced J estimate. Pure; no DOM. Measured static P_res, modelled P_wf; presented only as an estimate. */
export const J_ESTIMATE_VERSION='test-referenced-j/1';
export const LABEL_J='Test-referenced J (estimate)';
export const BASIS_STATEMENT='Measured static reservoir pressure (BHP test); flowing bottomhole pressure modelled from H-10 surface pressure through the wellbore traverse; declared tubing and fluid assumptions; monthly calendar-day average rate.';
export const ATMOSPHERE_PSI=14.7;
export const ROUND_TRIP_TOLERANCE_PSI=0.5;
export const MIN_TRAVERSE_PSIA=100;
export const MAX_REASON_LENGTH=200;
export const TUBING_SENSITIVITY_IN=Object.freeze([3.958,4.892,6.276]);
export type Basis='psig'|'psia';
export type Shift=-1|0|1;
export type Assumptions={innerDiameterInches:number;roughnessInches:number;surfaceTemperatureF:number;bottomholeTemperatureF:number;salinityWtPercent:number;segments:number};
export const DEFAULT_ASSUMPTIONS:Readonly<Assumptions>=Object.freeze({innerDiameterInches:3.958,roughnessInches:0.0006,surfaceTemperatureF:70,bottomholeTemperatureF:100,salinityWtPercent:10,segments:32});
export const REASONS=Object.freeze({
  excluded:'Excluded in the Test records review.',noDate:'No valid test date.',noPressure:'No test pressure reported.',nonPositive:'Test pressure is not positive.',badDepth:'Test depth is outside 1-50000 ft; not usable.',noDepth:'No test depth reported.',
  depthTie:'No single reference depth among the tests; not comparable.',
  depthDiffers:(depth:number,ref:number)=>`Tested at ${depth} ft, not the reference depth ${ref} ft; not comparable.`,
  noH10:'No H-10 months to match.',before:'Dated before the H-10 range.',after:'Dated after the H-10 range.',
  gap:'The matched month has no H-10 report (gap).',monthExcluded:'The matched month is excluded in the H-10 review.',
  noRate:'The matched month has no positive rate.',noAvg:'The matched month has no average pressure.',
  basis:'Confirm the pressure basis first.',lowSurface:'Surface pressure is below 100 psia; outside the traverse domain.',
  unsupported:(message:string)=>`Unsupported by the wellbore traverse: ${message}`,
  notAbove:'Flowing pressure not above reservoir pressure; no J.'});
export const LIMITATIONS=Object.freeze([BASIS_STATEMENT,
  'The calendar-day rate understates the onstream rate whenever the well had downtime, so J reads low; no correction is made.',
  'The matched month contains the shut-in of at least 24 hours for the test.',
  'H-10 average pressure is a monthly figure, not a flowing pressure measured at the time of the test; it is treated as psig and 14.7 psi is added.',
  'Tubing size, roughness, temperatures and salinity are declared assumptions, not public records; the well is treated as vertical (MD = TVD = test depth).',
  'The basis of the BHP source field is unresolved in the source; the confirmed reading is the user\'s.',
  'No-friction check: P_wf = surface pressure + (test pressure / test depth) x test depth; it equals the fluid column only if the shut-in surface pressure was about zero.',
  'Rate in bbl/day is treated as STB/day.',
  'The BHP test is treated as a static shut-in reservoir pressure reading (RRC Permian guidance); the source record does not state the test type.']);
export type JInputs={h10:DiagnosticsState|null;tests:TestState};
export type EstimateState={version:typeof J_ESTIMATE_VERSION;inputs:JInputs;basis:{value:Basis;reason:string}|null;assumptions:Assumptions;
  shifts:Readonly<Record<string,{shift:Exclude<Shift,0>;reason:string;identity:string}>>;choice:{key:string;reason:string;identity:string}|null};
export type TubingJ={innerDiameterInches:number;j:number|null;reason:string|null};
export type TestEstimate={key:string;date:string|null;depthFt:number|null;reportedPsi:number|null;month:string|null;shift:Shift;shiftReason:string|null;
  status:'qualifies'|'unmatched'|'awaiting-basis'|'refused'|'unsupported';reason:string|null;
  rateStbd:number|null;surfacePsi:number|null;surfacePsia:number|null;pResPsia:number|null;pWfPsia:number|null;hydrostaticPsi:number|null;frictionPsi:number|null;deltaPsi:number|null;
  j:number|null;jNoFriction:number|null;jAlternateBasis:number|null;alternateBasis:Basis|null;jByTubing:TubingJ[]};
export type RoundTripRow={key:string;month:string;rateStbd:number;observedSurfacePsia:number;reproducedSurfacePsia:number|null;residualPsi:number|null;chosen:boolean;reason:string|null};
export type Estimate={version:typeof J_ESTIMATE_VERSION;label:typeof LABEL_J;basis:{value:Basis;reason:string}|null;assumptions:Assumptions;tests:TestEstimate[];qualifying:string[];
  chosenKey:string|null;choiceBy:'system'|'user'|null;choiceReason:string|null;choiceDropped:boolean;range:{min:number;max:number}|null;trend:{date:string;j:number}[]|null;
  roundTrip:RoundTripRow[];roundTripOk:boolean;readiness:string};
export type Permit={surfacePsi:number|null;volumeBpd:number|null};
export type Handoff={values:Record<string,string|number|null>;origins:Record<string,string>;sweep:{min:number;max:number}|null;notes:string[]};

function reasonText(reason:unknown,label:string){const t=String(reason??'').trim();if(!t||t.length>MAX_REASON_LENGTH)throw new Error(`${label}: a reason of 1-${MAX_REASON_LENGTH} characters is required`);return t;}
function bound(v:number,min:number,max:number,label:string){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error(`${label} must be between ${min} and ${max}`);}
export function validateAssumptions(a:Assumptions):Assumptions{
  bound(a.innerDiameterInches,0.25,30,'Tubing inner diameter (in)');bound(a.roughnessInches,0,0.1,'Absolute roughness (in)');
  if(a.roughnessInches/a.innerDiameterInches>0.05)throw new Error('Relative roughness must not exceed 0.05');
  bound(a.surfaceTemperatureF,60,250,'Surface temperature (°F)');bound(a.bottomholeTemperatureF,60,250,'Bottomhole temperature (°F)');
  bound(a.salinityWtPercent,0,20,'NaCl salinity (wt%)');bound(a.segments,8,256,'Traverse segments');if(!Number.isInteger(a.segments))throw new Error('Traverse segments must be an integer');
  return {innerDiameterInches:a.innerDiameterInches,roughnessInches:a.roughnessInches,surfaceTemperatureF:a.surfaceTemperatureF,bottomholeTemperatureF:a.bottomholeTemperatureF,salinityWtPercent:a.salinityWtPercent,segments:a.segments};
}
export function createEstimateState(inputs:JInputs):EstimateState{return {version:J_ESTIMATE_VERSION,inputs,basis:null,assumptions:{...DEFAULT_ASSUMPTIONS},shifts:Object.freeze({}),choice:null};}
export function withInputs(state:EstimateState,inputs:JInputs):EstimateState{
  const ids=new Map(inputs.tests.records.filter(r=>r.kind==='bhp').map(r=>[r.key,r.identity]));
  return {...state,inputs,shifts:Object.freeze(Object.fromEntries(Object.entries(state.shifts).filter(([k,v])=>ids.get(k)===v.identity))),choice:state.choice&&ids.get(state.choice.key)===state.choice.identity?state.choice:null};
}
export function confirmBasis(state:EstimateState,value:Basis,reason:string):EstimateState{
  if(value!=='psig'&&value!=='psia')throw new Error('The basis must be psig or psia');
  return {...state,basis:{value,reason:reasonText(reason,'Basis')}};
}
export function setAssumptions(state:EstimateState,partial:Partial<Assumptions>):EstimateState{return {...state,assumptions:validateAssumptions({...state.assumptions,...partial})};}
const bhpRecord=(state:EstimateState,key:string)=>{const r=state.inputs.tests.records.find(x=>x.key===key&&x.kind==='bhp');if(!r)throw new Error(`Not a BHP test: ${key}`);return r;};
export function moveMatch(state:EstimateState,key:string,shift:Shift,reason:string):EstimateState{
  const rec=bhpRecord(state,key);if(shift!==-1&&shift!==0&&shift!==1)throw new Error('A match can move only to the previous or next month');
  const next={...state.shifts};if(shift===0)delete next[key];else next[key]={shift,reason:reasonText(reason,'Moved match'),identity:rec.identity};
  return {...state,shifts:Object.freeze(next)};
}
export function chooseJ(state:EstimateState,key:string,reason:string):EstimateState{
  const text=reasonText(reason,'Chosen J');if(!estimate(state).qualifying.includes(key))throw new Error('Only a qualifying test can be chosen');
  return {...state,choice:{key,reason:text,identity:bhpRecord(state,key).identity}};
}
function shiftMonth(month:string,by:number){const d=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7))-1+by,1));return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;}
const settings=(a:Assumptions):SegmentedBrineSettings=>({model:'segmented-brine',surfaceTemperatureF:a.surfaceTemperatureF,segments:a.segments});
const geometry=(depth:number,a:Assumptions,id:number):WellboreGeometry=>({tvdFt:depth,measuredDepthFt:depth,innerDiameterInches:id,roughnessInches:a.roughnessInches,bottomholeTemperatureF:a.bottomholeTemperatureF});
function flowing(depth:number,a:Assumptions,id:number,rate:number,surfacePsia:number):{pwf:number;hydro:number;friction:number}|{reason:string}{
  try{const t=traverseBrineWell({well:geometry(depth,a,id),fluid:{referencePressurePsia:surfacePsia,temperatureF:a.bottomholeTemperatureF,salinityWtPercent:a.salinityWtPercent},settings:settings(a),rateStbd:rate,boundary:{location:'surface',pressurePsia:surfacePsia}});
    return {pwf:t.bottomholePsia,hydro:t.hydrostaticPsi,friction:t.frictionPsi};}
  catch(error){if(error instanceof TraverseError){if(error.code==='numerical')throw error;return {reason:REASONS.unsupported(error.message)};}return {reason:REASONS.unsupported(error instanceof Error?error.message:String(error))};}
}
const jFrom=(pwf:number,pres:number,q:number)=>pwf>pres?q/(pwf-pres):null;
function evaluate(state:EstimateState,r:TestRecord):TestEstimate{
  const s=state.shifts[r.key],shift:Shift=s?.shift??0,tests=state.inputs.tests,a=state.assumptions;
  const base:TestEstimate={key:r.key,date:r.date,depthFt:r.depthFt,reportedPsi:r.bhpPsia,month:null,shift,shiftReason:s?.reason??null,status:'refused',reason:null,rateStbd:null,surfacePsi:null,surfacePsia:null,
    pResPsia:null,pWfPsia:null,hydrostaticPsi:null,frictionPsi:null,deltaPsi:null,j:null,jNoFriction:null,jAlternateBasis:null,alternateBasis:null,jByTubing:[]};
  const stop=(status:TestEstimate['status'],reason:string,extra:Partial<TestEstimate>={}):TestEstimate=>({...base,...extra,status,reason});
  if(tests.decisions[r.key]?.include!==true)return stop('refused',REASONS.excluded);
  if(r.date===null)return stop('refused',REASONS.noDate);
  if(r.bhpPsia===null)return stop('refused',REASONS.noPressure);
  if(r.bhpPsia<=0)return stop('refused',REASONS.nonPositive);
  if(r.depthFt===null)return stop('refused',REASONS.noDepth);
  if(!Number.isFinite(r.depthFt)||r.depthFt<1||r.depthFt>50000)return stop('refused',REASONS.badDepth);
  if(tests.referenceTie)return stop('refused',REASONS.depthTie);
  if(tests.referenceDepthFt!==null&&Math.abs(r.depthFt-tests.referenceDepthFt)>DEPTH_TOLERANCE_FT)return stop('refused',REASONS.depthDiffers(r.depthFt,tests.referenceDepthFt));
  const h10=state.inputs.h10;if(!h10||!h10.months.length)return stop('unmatched',REASONS.noH10);
  const month=shiftMonth(r.date.slice(0,7),shift);
  if(month<h10.months[0].month)return stop('unmatched',REASONS.before,{month});
  if(month>h10.months[h10.months.length-1].month)return stop('unmatched',REASONS.after,{month});
  const m=h10.months.find(x=>x.month===month)!;
  if(m.gap)return stop('unmatched',REASONS.gap,{month});
  if(h10.decisions[month]?.include!==true)return stop('unmatched',REASONS.monthExcluded,{month});
  if(m.rateBpd===null||!Number.isFinite(m.rateBpd)||m.rateBpd<=0)return stop('unmatched',REASONS.noRate,{month});
  if(m.avgPsi===null||!Number.isFinite(m.avgPsi))return stop('unmatched',REASONS.noAvg,{month});
  const q=m.rateBpd,surfacePsi=m.avgPsi,surfacePsia=surfacePsi+ATMOSPHERE_PSI,matched={month,rateStbd:q,surfacePsi,surfacePsia};
  if(!state.basis)return stop('awaiting-basis',REASONS.basis,matched);
  if(surfacePsia<MIN_TRAVERSE_PSIA)return stop('refused',REASONS.lowSurface,matched);
  const psig=state.basis.value==='psig',pResPsia=psig?r.bhpPsia+ATMOSPHERE_PSI:r.bhpPsia,alternatePres=psig?r.bhpPsia:r.bhpPsia+ATMOSPHERE_PSI;
  const f=flowing(r.depthFt,a,a.innerDiameterInches,q,surfacePsia);
  if('reason' in f)return stop('unsupported',f.reason,{...matched,pResPsia});
  const pWfNoFriction=surfacePsia+(r.bhpPsia/r.depthFt)*r.depthFt;
  const jByTubing=TUBING_SENSITIVITY_IN.map((id):TubingJ=>{const t=flowing(r.depthFt!,a,id,q,surfacePsia);if('reason' in t)return {innerDiameterInches:id,j:null,reason:t.reason};const j=jFrom(t.pwf,pResPsia,q);return {innerDiameterInches:id,j,reason:j===null?REASONS.notAbove:null};});
  const values:Partial<TestEstimate>={...matched,pResPsia,pWfPsia:f.pwf,hydrostaticPsi:f.hydro,frictionPsi:f.friction,deltaPsi:f.pwf-pResPsia,
    jNoFriction:jFrom(pWfNoFriction,pResPsia,q),jAlternateBasis:jFrom(f.pwf,alternatePres,q),alternateBasis:psig?'psia':'psig',jByTubing};
  const j=jFrom(f.pwf,pResPsia,q);
  if(j===null)return stop('refused',REASONS.notAbove,values);
  return {...base,...values,j,status:'qualifies',reason:null};
}
export const datumFor=(t:TestEstimate)=>`Top of completed interval at ${t.depthFt} ft TVD (RRC guidance), from BHP test ${t.date}`;
function reproduce(a:Assumptions,t:TestEstimate,chosen:TestEstimate):RoundTripRow{
  const row={key:t.key,month:t.month!,rateStbd:t.rateStbd!,observedSurfacePsia:t.surfacePsia!,chosen:t.key===chosen.key};
  const datum=datumFor(chosen);
  const well:DisposalWell={id:'TEST-REFERENCED-J',reservoirPsia:chosen.pResPsia!,limitPsia:10000,injectivityStbdPerPsi:chosen.j!,operatingCeilingStbd:1_000_000,availability:1,datum,reservoirDatum:datum,limitDatum:datum,
    reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',tvdFt:chosen.depthFt!,measuredDepthFt:chosen.depthFt!,innerDiameterInches:a.innerDiameterInches,roughnessInches:a.roughnessInches,surfaceLimitPsia:10000,bottomholeTemperatureF:a.bottomholeTemperatureF};
  try{
    const p=segmentedHydraulicPoint(well,{referencePressurePsia:chosen.pResPsia!,temperatureF:a.bottomholeTemperatureF,salinityWtPercent:a.salinityWtPercent},settings(a),t.rateStbd!);
    if(p.status!=='flowing'||p.requiredSurfacePsia===null)return {...row,reproducedSurfacePsia:null,residualPsi:null,reason:p.reasons.join(' ')||'No flowing solution.'};
    return {...row,reproducedSurfacePsia:p.requiredSurfacePsia,residualPsi:p.requiredSurfacePsia-t.surfacePsia!,reason:null};
  }catch(error){return {...row,reproducedSurfacePsia:null,residualPsi:null,reason:error instanceof Error?error.message:String(error)};}
}
export function estimate(state:EstimateState):Estimate{
  const tests=state.inputs.tests.records.filter(r=>r.kind==='bhp').map(r=>evaluate(state,r));
  const q=tests.filter(t=>t.status==='qualifies').sort((x,y)=>x.date!<y.date!?-1:x.date!>y.date!?1:0);
  const user=state.choice&&q.some(t=>t.key===state.choice!.key)?state.choice:null,chosen=user?q.find(t=>t.key===user.key)!:q[q.length-1]??null;
  const js=q.map(t=>t.j!),roundTrip=chosen?q.map(t=>reproduce(state.assumptions,t,chosen)):[];
  const own=roundTrip.find(r=>r.chosen);
  const readiness=!tests.length?'No BHP test records for this well; no test-referenced J.':!state.basis?'Confirm the pressure basis to see test-referenced J.':
    !q.length?'No test qualifies for a test-referenced J. Reasons are listed per test.':`${q.length} of ${tests.length} BHP tests give a test-referenced J (estimate).`;
  return {version:J_ESTIMATE_VERSION,label:LABEL_J,basis:state.basis?{...state.basis}:null,assumptions:{...state.assumptions},tests,qualifying:q.map(t=>t.key),
    chosenKey:chosen?.key??null,choiceBy:chosen?(user?'user':'system'):null,choiceReason:user?.reason??null,choiceDropped:state.choice!==null&&user===null,
    range:q.length?{min:Math.min(...js),max:Math.max(...js)}:null,trend:q.length>=2?q.map(t=>({date:t.date!,j:t.j!})):null,
    roundTrip,roundTripOk:!!own&&own.residualPsi!==null&&Math.abs(own.residualPsi)<=ROUND_TRIP_TOLERANCE_PSI,readiness};
}
/** Hydraulics workspace field values (null = leave empty for the user to declare) with an origin label per field. */
export function handoff(state:EstimateState,est:Estimate,permit:Permit,estimateSha256:string):Handoff{
  const t=est.tests.find(x=>x.key===est.chosenKey);
  if(!t||t.j===null)throw new Error('No test-referenced J is chosen; nothing to hand off.');
  if(!est.roundTripOk)throw new Error('The round trip does not reproduce the chosen month within 0.5 psi; hand-off refused.');
  const a=state.assumptions,assumed='Declared assumption (test-referenced J estimate)',basis=state.basis!;
  const surface=permit.surfacePsi!==null&&permit.surfacePsi>0?permit.surfacePsi+ATMOSPHERE_PSI:null,volume=permit.volumeBpd!==null&&permit.volumeBpd>0?permit.volumeBpd:null;
  return {values:{model:'segmented-brine',caseName:LABEL_J,datum:datumFor(t),injectivityStbdPerPsi:t.j,reservoirPsia:t.pResPsia,referencePressurePsia:t.pResPsia,tvdFt:t.depthFt,measuredDepthFt:t.depthFt,
      innerDiameterInches:a.innerDiameterInches,roughnessInches:a.roughnessInches,temperatureF:a.bottomholeTemperatureF,surfaceTemperatureF:a.surfaceTemperatureF,salinityWtPercent:a.salinityWtPercent,segments:a.segments,
      rateStbd:t.rateStbd,curveMaximumStbd:Math.ceil(1.5*t.rateStbd!),surfaceLimitPsia:surface,operatingCeilingStbd:volume,limitPsia:null},
    origins:{injectivityStbdPerPsi:`${LABEL_J} from BHP test ${t.date} and H-10 ${t.month}; sealed estimate ${estimateSha256.slice(0,12)}`,
      reservoirPsia:`BHP test ${t.date}: ${basis.value} reading${basis.value==='psig'?' + 14.7 psi':''} (basis confirmed: ${basis.reason})`,referencePressurePsia:'Set to the reservoir pressure (fluid reference state, context only)',
      datum:'From the BHP test depth (RRC guidance: top of the completed disposal interval)',tvdFt:'BHP test depth; vertical well declared',measuredDepthFt:'BHP test depth; vertical well declared',
      innerDiameterInches:assumed,roughnessInches:assumed,temperatureF:assumed,surfaceTemperatureF:assumed,salinityWtPercent:assumed,segments:assumed,
      rateStbd:`H-10 ${t.month} calendar-day average rate`,curveMaximumStbd:'1.5 x the matched rate',
      surfaceLimitPsia:surface===null?'No permitted surface pressure in the inventory; declare it.':`Inventory permitted surface pressure ${permit.surfacePsi} psi + 14.7 psi (permit value)`,
      operatingCeilingStbd:volume===null?'No permitted volume in the inventory; declare it.':`Inventory permitted volume ${volume} bbl/day (permit value)`,
      limitPsia:'Not set from evidence; declare it.'},
    sweep:est.range?{...est.range}:null,
    notes:[est.range?`J range for sweeps: ${est.range.min.toPrecision(4)} to ${est.range.max.toPrecision(4)} STB/day/psi (enter it in Parameter sweeps).`:'',BASIS_STATEMENT].filter(Boolean)};
}
