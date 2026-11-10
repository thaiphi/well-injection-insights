import {buildDisposalCase,type DisposalCaseInput} from './disposalCase.js';
import {summarize} from './disposalSensitivity.js';
export const PERFORMANCE_CASES_VERSION='well-performance-cases/1';
export const CASE_LABEL='Assumed well-performance case';
export const FLAT_NOTE='End-of-period condition held for every month; not a pressure or decline forecast.';
export const FLUID_NOTE='Fluid reference pressure is unchanged in every case.';
export const ATTRIBUTION_NOTE='Single-factor runs; effects are not additive.';
export type PerformanceFactors={injectivityMultiplier:number;reservoirOffsetPsi:number;availabilityMultiplier:number};
export type PerformanceCasesSpec={pessimistic:PerformanceFactors;optimistic:PerformanceFactors};
export const NEUTRAL_FACTORS:Readonly<PerformanceFactors>=Object.freeze({injectivityMultiplier:1,reservoirOffsetPsi:0,availabilityMultiplier:1});
export type Headroom={wellId:string;reservoirPsia:number;limitPsia:number;headroomPsi:number};
export type CaseRun={label:'Pessimistic'|'Base'|'Optimistic';factors:PerformanceFactors;cappedWells:string[];noHeadroomWells:string[];
 summary:ReturnType<typeof summarize>;offsetPercentOfHeadroom:{wellId:string;percent:number|null}[];
 attribution:{factor:'injectivity'|'reservoir'|'availability';totalShortfallBbl:number;changeBbl:number}[]};
export type PerformanceCases={version:typeof PERFORMANCE_CASES_VERSION;inputs:{caseInput:DisposalCaseInput;spec:PerformanceCasesSpec};headroom:Headroom[];cases:CaseRun[];notes:string[]};
const bounds=[['injectivityMultiplier',0.01,10],['reservoirOffsetPsi',-5000,5000],['availabilityMultiplier',0,10]] as const;
export function validateFactors(f:PerformanceFactors,label:string):PerformanceFactors{
 if(!f||typeof f!=='object')throw Error(`${label} factors must be an object`);
 for(const [name,min,max] of bounds){const v=f[name];if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`${label} ${name} must be finite between ${min} and ${max}`);}
 return {injectivityMultiplier:f.injectivityMultiplier,reservoirOffsetPsi:f.reservoirOffsetPsi,availabilityMultiplier:f.availabilityMultiplier};
}
export function applyFactors(input:DisposalCaseInput,f:PerformanceFactors):{input:DisposalCaseInput;cappedWells:string[];noHeadroomWells:string[]}{
 const out=structuredClone(input),cappedWells:string[]=[],noHeadroomWells:string[]=[];
 for(const w of out.wells){
  w.injectivityStbdPerPsi*=f.injectivityMultiplier;
  w.reservoirPsia+=f.reservoirOffsetPsi;
  const a=w.availability*f.availabilityMultiplier;
  if(a>1)cappedWells.push(w.id);
  w.availability=Math.min(1,a);
  if(w.reservoirPsia>=w.limitPsia)noHeadroomWells.push(w.id);
 }
 const w0=out.wells[0];
 out.comparison={wellId:w0.id,injectivityMultiplier:1,innerDiameterInches:w0.innerDiameterInches,availability:w0.availability};
 return {input:out,cappedWells,noHeadroomWells};
}
export function buildPerformanceCases(input:DisposalCaseInput,spec:PerformanceCasesSpec):PerformanceCases{
 const factors={Pessimistic:validateFactors(spec.pessimistic,'Pessimistic'),Optimistic:validateFactors(spec.optimistic,'Optimistic')};
 const headroom:Headroom[]=input.wells.map(w=>({wellId:w.id,reservoirPsia:w.reservoirPsia,limitPsia:w.limitPsia,headroomPsi:w.limitPsia-w.reservoirPsia}));
 const run=(f:PerformanceFactors)=>{const a=applyFactors(input,f);return {a,summary:summarize(buildDisposalCase(a.input).base)};};
 const order=[['Pessimistic',factors.Pessimistic],['Base',{...NEUTRAL_FACTORS}],['Optimistic',factors.Optimistic]] as const;
 const runs=order.map(([label,f])=>({label,f,...run(f)}));
 const baseTotal=runs[1].summary.totalShortfallBbl;
 const cases:CaseRun[]=runs.map(r=>{
  const attribution:CaseRun['attribution']=r.label==='Base'?[]:([
   ['injectivity',{...NEUTRAL_FACTORS,injectivityMultiplier:r.f.injectivityMultiplier}],
   ['reservoir',{...NEUTRAL_FACTORS,reservoirOffsetPsi:r.f.reservoirOffsetPsi}],
   ['availability',{...NEUTRAL_FACTORS,availabilityMultiplier:r.f.availabilityMultiplier}],
  ] as const).map(([factor,sf])=>{const t=run(sf).summary.totalShortfallBbl;return {factor,totalShortfallBbl:t,changeBbl:t-baseTotal};});
  return {label:r.label,factors:{...r.f},cappedWells:r.a.cappedWells,noHeadroomWells:r.a.noHeadroomWells,summary:r.summary,
   offsetPercentOfHeadroom:headroom.map(h=>({wellId:h.wellId,percent:h.headroomPsi<=0?null:100*r.f.reservoirOffsetPsi/h.headroomPsi})),attribution};
 });
 return {version:PERFORMANCE_CASES_VERSION,inputs:{caseInput:structuredClone(input),spec:structuredClone(spec)},headroom,cases,notes:[CASE_LABEL,FLAT_NOTE,FLUID_NOTE,ATTRIBUTION_NOTE]};
}
