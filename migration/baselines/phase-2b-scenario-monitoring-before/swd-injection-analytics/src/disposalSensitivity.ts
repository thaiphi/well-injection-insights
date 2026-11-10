import {buildDisposalCase,type DisposalCase,type DisposalCaseInput} from './disposalCase.js';
import {assertJsonEvidence} from './exhibitIntegrity.js';

export type DisposalSensitivityParameter='injectivityStbdPerPsi'|'innerDiameterInches'|'availability';
export type DisposalSensitivitySpec={wellId:string;parameter:DisposalSensitivityParameter;minimum:number;maximum:number;points:number};
export const DISPOSAL_SENSITIVITY_METHOD_VERSION='one-at-a-time-base-disposal/1';
const parameters={
 injectivityStbdPerPsi:{label:'Injectivity',unit:'STB/day/psi',minimum:0.000001,maximum:10000},
 innerDiameterInches:{label:'Inner diameter',unit:'in',minimum:0.25,maximum:30},
 availability:{label:'Availability',unit:'fraction of calendar time',minimum:0,maximum:1},
} as const;
function summarize(base:DisposalCase['base']){
 return {
  totalAvailableStbd:base.totalAvailableStbd,totalShortfallBbl:base.totalShortfallBbl,firstShortfallMonth:base.firstShortfallMonth,
  operatingFeasible:base.monthly.every(month=>month.operatingFeasible),
  wells:base.wells.map(w=>({wellId:w.well.id,maximumStbd:w.capacity.maximumStbd,availableStbd:w.capacity.availableStbd,limitingConstraints:structuredClone(w.capacity.limitingConstraints),maximumOperatingFeasible:w.capacity.maximumOperatingFeasible})),
  monthly:base.monthly.map(m=>({month:m.month,days:m.days,demandBbl:m.demandBbl,capacityBbl:m.capacityBbl,headroomBbl:m.headroomBbl,shortfallBbl:m.shortfallBbl,operatingFeasible:m.operatingFeasible,
   allocations:m.allocations.map(a=>({wellId:a.wellId,averageStbd:a.averageStbd,onstreamStbd:a.onstreamStbd,allocatedBbl:a.allocatedBbl,operatingFeasible:a.operatingFeasible,reasons:structuredClone(a.hydraulics.reasons),hydraulics:{status:a.hydraulics.status,bottomholePsia:a.hydraulics.bottomholePsia,requiredSurfacePsia:a.hydraulics.requiredSurfacePsia,hydrostaticPsi:a.hydraulics.hydrostaticPsi,frictionPsi:a.hydraulics.frictionPsi,regime:a.hydraulics.regime}})),
   unsupportedAllocations:m.allocations.filter(a=>!a.operatingFeasible).map(a=>({wellId:a.wellId,onstreamStbd:a.onstreamStbd,reasons:structuredClone(a.hydraulics.reasons)}))})),
 };
}
/** One selected parameter of one selected well, preserving the original case.
 * Each point is calculated atomically by the connected disposal case engine. */
export function buildDisposalSensitivity(caseInput:DisposalCaseInput,spec:DisposalSensitivitySpec){
 assertJsonEvidence(caseInput,'sensitivity case input');assertJsonEvidence(spec,'sensitivity specification');
 if(typeof spec.wellId!=='string'||!caseInput.wells.some(w=>w.id===spec.wellId))throw Error('Sensitivity well ID must identify one selected disposal well');
 if(typeof spec.parameter!=='string'||!Object.hasOwn(parameters,spec.parameter))throw Error('Sensitivity parameter must be injectivityStbdPerPsi, innerDiameterInches or availability');
 const parameter=parameters[spec.parameter];
 for(const [label,value] of [['minimum',spec.minimum],['maximum',spec.maximum]] as const)if(typeof value!=='number'||!Number.isFinite(value)||value<parameter.minimum||value>parameter.maximum)throw Error(`Sensitivity ${label} for ${parameter.label} must be finite between ${parameter.minimum} and ${parameter.maximum} ${parameter.unit}`);
 if(spec.minimum>=spec.maximum)throw Error('Sensitivity minimum must be less than maximum');
 if(!Number.isInteger(spec.points)||spec.points<3||spec.points>9)throw Error('Sensitivity requires 3–9 integer grid points');
 const baselineValue=caseInput.wells.find(w=>w.id===spec.wellId)![spec.parameter];
 if(baselineValue<spec.minimum||baselineValue>spec.maximum)throw Error('Sensitivity range must contain the exact original baseline value');
 const comparison=caseInput.comparison;
 if(!comparison||typeof comparison!=='object'||typeof comparison.wellId!=='string'||!caseInput.wells.some(w=>w.id===comparison.wellId))throw Error('Original comparison context must identify one selected well');
 for(const [label,value,min,max] of [['injectivity multiplier',comparison.injectivityMultiplier,0.01,10],['inner diameter',comparison.innerDiameterInches,0.25,30],['availability',comparison.availability,0,1]] as const)if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(`Original comparison ${label} must be finite between ${min} and ${max}`);
 const inputs={caseInput:structuredClone(caseInput),spec:structuredClone(spec)};
 // The connected engine calculates two scenarios. Give its unused Compared
 // branch an explicit identity so that branch cannot constrain a Base sweep.
 const evaluateBase=(value:number)=>{
  const modified=structuredClone(inputs.caseInput),selected=modified.wells.find(w=>w.id===spec.wellId)!;selected[spec.parameter]=value;
  modified.comparison={wellId:spec.wellId,injectivityMultiplier:1,innerDiameterInches:selected.innerDiameterInches,availability:selected.availability};
  return buildDisposalCase(modified);
 };
 const grid=Array.from({length:spec.points},(_,i)=>i===spec.points-1?spec.maximum:i===0?spec.minimum:spec.minimum+(spec.maximum-spec.minimum)*i/(spec.points-1));
 if(grid.some((value,i)=>i>0&&value<=grid[i-1]))throw Error('Sensitivity range is too narrow for distinct floating-point grid values; widen the range or reduce grid points');
 const baselineCase=evaluateBase(baselineValue),baselineSummary=summarize(baselineCase.base);
 const values=grid.includes(baselineValue)?grid:[...grid,baselineValue];values.sort((a,b)=>a-b);
 const points=values.map(value=>{
  try{
   const calculated=value===baselineValue?baselineCase:evaluateBase(value);
   return {value,isBaseline:value===baselineValue,isGridPoint:grid.includes(value),summary:summarize(calculated.base)};
  }catch(error){throw Error(`Sensitivity point failed: ${spec.wellId} ${spec.parameter}=${value} ${parameter.unit}. Entire sweep blocked. ${error instanceof Error?error.message:String(error)}`);}
 });
 const result={schemaVersion:'disposal-sensitivity/1',methodVersion:DISPOSAL_SENSITIVITY_METHOD_VERSION,inputs,
  parameter:{key:spec.parameter,label:parameter.label,unit:parameter.unit},baseline:{value:baselineValue,summary:baselineSummary},points,
  caseMethodVersion:baselineCase.methodVersion,caseMethods:structuredClone(baselineCase.methods),caseProvenance:{...structuredClone(baselineCase.provenance),sensitivity:{reportedScenario:'Base',originalComparison:structuredClone(inputs.caseInput.comparison),internalComparison:'Neutral identity of the currently varied selected well; Compared results are discarded'}},
  units:{parameter:parameter.unit,onstreamCapacity:'STB/day while available',availableCapacity:'STB/day calendar-average',monthlyVolume:'stock-tank bbl per calendar month',...structuredClone(baselineCase.units)},
  limitations:[
   'One-at-a-time assumed parameter sweep of the Base scenario only; the existing comparison is retained in the input but is not the sweep.',
   'Every Base point changes only the selected well parameter. The original comparison is retained as context and validated for field ranges; its unused calculated scenario is replaced internally by an explicit identity of the current selected well, so it cannot constrain the Base sweep. Compared results are discarded.',
   'Requested grid contains 3–9 evenly spaced points and both exact endpoints. The exact baseline is inserted when absent, producing at most 10 rows; isGridPoint distinguishes that inserted row.',
   'Failure of any calculation blocks the entire sweep. Unsupported monthly allocations remain explicit flags with reasons; they are not silently omitted or converted to feasible operation.',
   'Maximum envelopes and sensitivities are fictional/assumed engineering screening, not calibrated sustainable disposal predictions or operating recommendations.',
   ...structuredClone(baselineCase.limitations),
  ],
 };
 assertJsonEvidence(result,'calculated sensitivity');return result;
}
export type DisposalSensitivity=ReturnType<typeof buildDisposalSensitivity>;
function canonical(value:unknown):string{
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 return Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>JSON.stringify(key)+':'+canonical(item)).join(',')+'}';
}
/** Verify original evidence before cloning, then recompute every sweep point. */
export function verifiedDisposalSensitivity(result:DisposalSensitivity):DisposalSensitivity{
 try{
  assertJsonEvidence(result,'sensitivity export');
  const snapshot=structuredClone(result),fresh=buildDisposalSensitivity(snapshot.inputs.caseInput,snapshot.inputs.spec);
  if(canonical(snapshot)!==canonical(fresh))throw Error('Displayed result does not match recomputed original inputs and sweep');
  return snapshot;
 }catch(error){throw Error(`Sensitivity result changed or stale: ${error instanceof Error?error.message:String(error)}`);}
}
function csvCell(value:unknown){let raw=typeof value==='object'?JSON.stringify(value):String(value??'');if(typeof value==='string'&&(/^[\s]*[=+\-@]/.test(raw)||/^[\t\r\n]/.test(raw)))raw="'"+raw;return '"'+raw.replaceAll('"','""')+'"';}
export function disposalSensitivityCsv(result:DisposalSensitivity):string{
 const verified=verifiedDisposalSensitivity(result),rows:unknown[][]=[['section','parameter','unit','value','isBaseline','field','result']];
 for(const [field,value] of Object.entries(verified))if(field!=='points')rows.push(['metadata','','','','',field,value]);
 rows.push(['metadata','','','','','caseName',verified.inputs.caseInput.caseName],['metadata','','','','','demandId',verified.inputs.caseInput.demand.id]);
 for(const p of verified.points){
  const prefix=['point',verified.parameter.key,verified.parameter.unit,p.value,p.isBaseline];
  rows.push([...prefix,'isGridPoint',p.isGridPoint]);
  for(const [field,value] of Object.entries(p.summary))if(field!=='wells'&&field!=='monthly')rows.push([...prefix,field,value]);
  for(const w of p.summary.wells)for(const [field,value] of Object.entries(w))rows.push(['well',verified.parameter.key,verified.parameter.unit,p.value,p.isBaseline,`${w.wellId}: ${field}`,value]);
  for(const m of p.summary.monthly)for(const [field,value] of Object.entries(m))rows.push(['monthly',verified.parameter.key,verified.parameter.unit,p.value,p.isBaseline,`${m.month}: ${field}`,value]);
 }
 return rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
