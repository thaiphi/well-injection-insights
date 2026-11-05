import {traverseBrineWell,TraverseError,type SegmentedBrineSettings,type WellboreGeometry} from './wellboreTraverse.js';

/** Phase 2a shared well assumptions for the J estimate and the WHP/BHP reconciliation. Pure; no DOM. */
export const ATMOSPHERE_PSI=14.7;
export const MIN_TRAVERSE_PSIA=100;
export const MAX_REASON_LENGTH=200;
export const LIMIT_DATUM_TOLERANCE_FT=1;
export const SURFACE_BASIS_PROMPT='Confirm the H-10 and permit pressure basis in Well assumptions.';
export const DEPTH_STATEMENT='Vertical well declared; MD = TVD.';
export type Basis='psig'|'psia';
export type BasisConfirmation={value:Basis;reason:string};
export type Assumptions={innerDiameterInches:number;roughnessInches:number;surfaceTemperatureF:number;bottomholeTemperatureF:number;salinityWtPercent:number;segments:number};
export type WellAssumptions=Assumptions&{surfaceBasis:BasisConfirmation|null};
export type DeclaredLimit={psia:number;depthFt:number;reason:string};
export type Flowing={pwf:number;hydro:number;friction:number};
export const DEFAULT_ASSUMPTIONS:Readonly<Assumptions>=Object.freeze({innerDiameterInches:3.958,roughnessInches:0.0006,surfaceTemperatureF:70,bottomholeTemperatureF:100,salinityWtPercent:10,segments:32});
export const DEFAULT_WELL_ASSUMPTIONS:Readonly<WellAssumptions>=Object.freeze({...DEFAULT_ASSUMPTIONS,surfaceBasis:null});

export function reasonText(reason:unknown,label:string):string{const t=String(reason??'').trim();if(!t||t.length>MAX_REASON_LENGTH)throw new Error(`${label}: a reason of 1-${MAX_REASON_LENGTH} characters is required`);return t;}
function bound(v:number,min:number,max:number,label:string){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error(`${label} must be between ${min} and ${max}`);}
export function validateAssumptions(a:Assumptions):Assumptions{
  bound(a.innerDiameterInches,0.25,30,'Tubing inner diameter (in)');bound(a.roughnessInches,0,0.1,'Absolute roughness (in)');
  if(a.roughnessInches/a.innerDiameterInches>0.05)throw new Error('Relative roughness must not exceed 0.05');
  bound(a.surfaceTemperatureF,60,250,'Surface temperature (°F)');bound(a.bottomholeTemperatureF,60,250,'Bottomhole temperature (°F)');
  bound(a.salinityWtPercent,0,20,'NaCl salinity (wt%)');bound(a.segments,8,256,'Traverse segments');if(!Number.isInteger(a.segments))throw new Error('Traverse segments must be an integer');
  return pickAssumptions(a);
}
export function pickAssumptions(a:Assumptions):Assumptions{return {innerDiameterInches:a.innerDiameterInches,roughnessInches:a.roughnessInches,surfaceTemperatureF:a.surfaceTemperatureF,bottomholeTemperatureF:a.bottomholeTemperatureF,salinityWtPercent:a.salinityWtPercent,segments:a.segments};}
export function confirmBasisValue(value:unknown,reason:unknown,label:string):BasisConfirmation{
  if(value!=='psig'&&value!=='psia')throw new Error('The basis must be psig or psia');
  return {value,reason:reasonText(reason,label)};
}
export function confirmSurfaceBasis(w:WellAssumptions,value:Basis,reason:string):WellAssumptions{return {...pickAssumptions(w),surfaceBasis:confirmBasisValue(value,reason,'Surface basis')};}
export function setWellAssumptions(w:WellAssumptions,partial:Partial<Assumptions>):WellAssumptions{return {...validateAssumptions({...pickAssumptions(w),...partial}),surfaceBasis:w.surfaceBasis};}
export function validateDeclaredLimit(raw:{psia:unknown;depthFt:unknown;reason:unknown}):DeclaredLimit{
  const num=(v:unknown)=>typeof v==='number'?v:typeof v==='string'&&v.trim()!==''?Number(v):NaN;
  const psia=num(raw.psia),depthFt=num(raw.depthFt);
  bound(psia,100,10000,'Bottomhole limit (psia)');bound(depthFt,1,50000,'Limit depth (ft)');
  return {psia,depthFt,reason:reasonText(raw.reason,'Bottomhole limit')};
}
export const toAbsolute=(psi:number,basis:Basis)=>basis==='psig'?psi+ATMOSPHERE_PSI:psi;
export const otherBasis=(basis:Basis):Basis=>basis==='psig'?'psia':'psig';
export const unsupportedReason=(message:string)=>`Unsupported by the wellbore traverse: ${message}`;
export const traverseSettings=(a:Assumptions):SegmentedBrineSettings=>({model:'segmented-brine',surfaceTemperatureF:a.surfaceTemperatureF,segments:a.segments});
const geometry=(depth:number,a:Assumptions,id:number):WellboreGeometry=>({tvdFt:depth,measuredDepthFt:depth,innerDiameterInches:id,roughnessInches:a.roughnessInches,bottomholeTemperatureF:a.bottomholeTemperatureF});
/** Forward surface-boundary traverse: P_bh = P_wh + hydrostatic − friction. Domain and velocity exits become a reason; a numerical failure is rethrown. */
export function flowingAt(depthFt:number,a:Assumptions,rateStbd:number,surfacePsia:number,idOverride?:number):Flowing|{reason:string}{
  try{const t=traverseBrineWell({well:geometry(depthFt,a,idOverride??a.innerDiameterInches),fluid:{referencePressurePsia:surfacePsia,temperatureF:a.bottomholeTemperatureF,salinityWtPercent:a.salinityWtPercent},settings:traverseSettings(a),rateStbd,boundary:{location:'surface',pressurePsia:surfacePsia}});
    return {pwf:t.bottomholePsia,hydro:t.hydrostaticPsi,friction:t.frictionPsi};}
  catch(error){if(error instanceof TraverseError){if(error.code==='numerical')throw error;return {reason:unsupportedReason(error.message)};}return {reason:unsupportedReason(error instanceof Error?error.message:String(error))};}
}
