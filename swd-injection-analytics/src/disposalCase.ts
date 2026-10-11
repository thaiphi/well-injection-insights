import {type Injector, validateInjector} from './engineering.js';
import {brineAtPressure, buildBrineSweep} from './brinePvt.js';
import {daysInMonth, monthIndex} from './planning.js';
import {assertJsonEvidence} from './exhibitIntegrity.js';
import {type SegmentedBrineSettings,type WellboreTraverse,traverseBrineWell,TraverseError,SEGMENTED_BRINE_METHOD_VERSION,validateSegmentedSettings} from './wellboreTraverse.js';

export type FluidInput={referencePressurePsia:number;temperatureF:number;salinityWtPercent:number};
export type DisposalWell=Injector & {tvdFt:number;measuredDepthFt:number;innerDiameterInches:number;roughnessInches:number;surfaceLimitPsia:number;bottomholeTemperatureF?:number};
export type DisposalCaseInput={caseName:string;demand:{id:string;origin:string;content:string;monthly:{month:string;demandBbl:number}[];evidence:unknown};wells:DisposalWell[];fluid:FluidInput;hydraulics?:SegmentedBrineSettings;comparison:{wellId:string;injectivityMultiplier:number;innerDiameterInches:number;availability:number}};
export type FluidProperties=ReturnType<typeof brineAtPressure>;
export type HydraulicPoint={rateStbd:number;status:'shut-in'|'flowing'|'unsupported';bottomholePsia:number|null;hydrostaticPsi:number|null;frictionPsi:number|null;requiredSurfacePsia:number|null;localFlowM3PerSecond:number|null;velocityMPerSecond:number|null;reynolds:number|null;darcyFrictionFactor:number|null;regime:'shut-in'|'laminar'|'transition'|'turbulent';operatingFeasible:boolean;reasons:string[];traverse?:WellboreTraverse};
export const DISPOSAL_CASE_VERSION='constant-j-uniform-brine-darcy-weisbach/1';
export const MINIMUM_FLOWING_SURFACE_PSIA=100;
const MAX_RATE_STBD=1_000_000;
const PSI_PA=6894.757293168,FT_M=0.3048,IN_M=0.0254,STB_M3=0.158987294928,G=9.80665;
function bound(value:number,min:number,max:number,name:string){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(`${name} must be finite between ${min} and ${max}`);}
function text(value:string,name:string,max=200){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(`${name} requires 1–${max} characters`);}
function validateWell(well:DisposalWell){
 validateInjector(well);text(well.id,'Well ID');text(well.datum,'Pressure datum',500);
 bound(well.reservoirPsia,100,10000,'Reservoir pressure (psia)');bound(well.limitPsia,100,10000,'Bottomhole limit (psia)');
 bound(well.injectivityStbdPerPsi,0.000001,10000,'Injectivity (STB/day/psi)');bound(well.operatingCeilingStbd,0,MAX_RATE_STBD,'Operating ceiling (STB/day)');
 bound(well.tvdFt,0,50000,'True vertical depth (ft)');bound(well.measuredDepthFt,1,50000,'Measured depth (ft)');
 if(well.measuredDepthFt<well.tvdFt)throw Error('Measured depth must be at least true vertical depth');
 bound(well.innerDiameterInches,0.25,30,'Inner diameter (in)');bound(well.roughnessInches,0,0.1,'Absolute roughness (in)');
 if(well.roughnessInches/well.innerDiameterInches>0.05)throw Error('Relative roughness must not exceed 0.05');
 bound(well.surfaceLimitPsia,100,10000,'Surface limit (psia)');
}
function validateProperties(p:FluidProperties){
 bound(p.pressurePsia,100,10000,'Fluid reference pressure (psia)');bound(p.bwRbPerStb,0.1,3,'Brine Bw (rb/STB)');
 bound(p.densityKgPerM3,50,2000,'Brine density (kg/m³)');bound(p.viscosityCp,0.01,1000,'Brine viscosity (cP)');
 bound(p.densityLbPerFt3,1,200,'Brine density (lb/ft³)');bound(p.compressibilityPerPsi,Number.MIN_VALUE,0.1,'Brine compressibility (1/psi)');
}
function turbulentFactor(reynolds:number,relativeRoughness:number){return 0.25/Math.log10(relativeRoughness/3.7+5.74/reynolds**0.9)**2;}
/** Fixed uniform-property downward flow. TVD sets gravity gain; MD sets friction loss. */
export function hydraulicPoint(well:DisposalWell,fluidProperties:FluidProperties,rateStbd:number):HydraulicPoint{
 validateWell(well);validateProperties(fluidProperties);bound(rateStbd,0,MAX_RATE_STBD,'Rate (STB/day)');
 if(rateStbd===0)return {rateStbd,status:'shut-in',bottomholePsia:null,hydrostaticPsi:null,frictionPsi:null,requiredSurfacePsia:null,localFlowM3PerSecond:null,velocityMPerSecond:null,reynolds:null,darcyFrictionFactor:null,regime:'shut-in',operatingFeasible:true,reasons:[]};
 const p=fluidProperties,diameterM=well.innerDiameterInches*IN_M,localFlowM3PerSecond=rateStbd*p.bwRbPerStb*STB_M3/86400;
 const velocityMPerSecond=localFlowM3PerSecond/(Math.PI*diameterM**2/4),reynolds=p.densityKgPerM3*velocityMPerSecond*diameterM/(p.viscosityCp*0.001),relativeRoughness=well.roughnessInches/well.innerDiameterInches;
 let darcyFrictionFactor:number,regime:HydraulicPoint['regime'];
 if(reynolds<=2000){darcyFrictionFactor=64/reynolds;regime='laminar';}
 else if(reynolds>=4000){darcyFrictionFactor=turbulentFactor(reynolds,relativeRoughness);regime='turbulent';}
 else {const fraction=(reynolds-2000)/2000;darcyFrictionFactor=(1-fraction)*64/2000+fraction*turbulentFactor(4000,relativeRoughness);regime='transition';}
 const hydrostaticPsi=p.densityKgPerM3*G*well.tvdFt*FT_M/PSI_PA;
 const frictionPsi=darcyFrictionFactor*(well.measuredDepthFt*FT_M/diameterM)*p.densityKgPerM3*velocityMPerSecond**2/2/PSI_PA;
 const bottomholePsia=well.reservoirPsia+rateStbd/well.injectivityStbdPerPsi,requiredSurfacePsia=bottomholePsia-hydrostaticPsi+frictionPsi;
 if([localFlowM3PerSecond,velocityMPerSecond,reynolds,darcyFrictionFactor,hydrostaticPsi,frictionPsi,bottomholePsia,requiredSurfacePsia].some(v=>!Number.isFinite(v)))throw Error('Hydraulic arithmetic overflow; no result is available');
 const reasons:string[]=[];
 if(requiredSurfacePsia<MINIMUM_FLOWING_SURFACE_PSIA)reasons.push('Required flowing surface pressure is below 100 psia: gravity/low-pressure operation requires unmodeled flow control; this allocation is unsupported.');
 if(requiredSurfacePsia>well.surfaceLimitPsia+1e-8)reasons.push('Required surface pressure exceeds the declared surface maximum.');
 if(bottomholePsia>well.limitPsia+1e-8)reasons.push('Required bottomhole pressure exceeds the declared bottomhole maximum.');
 if(rateStbd>well.operatingCeilingStbd+1e-8)reasons.push('Onstream rate exceeds the declared operating ceiling.');
 return {rateStbd,status:'flowing',bottomholePsia,hydrostaticPsi,frictionPsi,requiredSurfacePsia,localFlowM3PerSecond,velocityMPerSecond,reynolds,darcyFrictionFactor,regime,operatingFeasible:reasons.length===0,reasons};
}
function wellEnvelope(well:DisposalWell,p:FluidProperties){
 const bottomholeLimitedStbd=Math.max(0,well.injectivityStbdPerPsi*(well.limitPsia-well.reservoirPsia));
 // Bracket the supported application rate interval, returning the feasible lower
 // endpoint after 80 iterations so a rounded root cannot exceed its constraint.
 const zeroSurfacePsia=well.reservoirPsia-p.densityKgPerM3*G*well.tvdFt*FT_M/PSI_PA;
 let surfaceLimitedStbd=0;
 if(zeroSurfacePsia<well.surfaceLimitPsia){
  if(hydraulicPoint(well,p,MAX_RATE_STBD).requiredSurfacePsia!<=well.surfaceLimitPsia)surfaceLimitedStbd=MAX_RATE_STBD;
  else {let low=0,high=MAX_RATE_STBD;for(let i=0;i<80;i++){const mid=low+(high-low)/2;if(hydraulicPoint(well,p,mid).requiredSurfacePsia!<=well.surfaceLimitPsia)low=mid;else high=mid;}surfaceLimitedStbd=low;}
 }
 const maximumStbd=Math.min(bottomholeLimitedStbd,surfaceLimitedStbd,well.operatingCeilingStbd),availableStbd=maximumStbd*well.availability;
 const limitingConstraints=([['bottomhole limit',bottomholeLimitedStbd],['surface limit',surfaceLimitedStbd],['operating ceiling',well.operatingCeilingStbd]] as const).filter(([,value])=>Math.abs(value-maximumStbd)<=1e-8*Math.max(1,maximumStbd)).map(([name])=>name);
 const maximumPoint=hydraulicPoint(well,p,maximumStbd);
 const curveMaximum=maximumStbd>0?maximumStbd:Math.min(10000,well.operatingCeilingStbd);
 const curve=Array.from({length:41},(_,i)=>hydraulicPoint(well,p,curveMaximum*i/40));
 return {well:structuredClone(well),capacity:{bottomholeLimitedStbd,surfaceLimitedStbd,maximumStbd,availableStbd,limitingConstraints,maximumOperatingFeasible:maximumPoint.operatingFeasible,maximumOperatingReasons:maximumPoint.reasons,surfaceResidualPsi:maximumStbd>0?well.surfaceLimitPsia-maximumPoint.requiredSurfacePsia!:null},curve};
}
/** Known formation pressure is the bottom boundary; never clamp a failed traverse. */
export function segmentedHydraulicPoint(well:DisposalWell,fluid:FluidInput,settings:SegmentedBrineSettings,rateStbd:number):HydraulicPoint{
 validateWell(well);bound(rateStbd,0,MAX_RATE_STBD,'Rate (STB/day)');validateSegmentedSettings(settings,well,well.bottomholeTemperatureF??fluid.temperatureF);
 const empty={rateStbd,bottomholePsia:null,hydrostaticPsi:null,frictionPsi:null,requiredSurfacePsia:null,localFlowM3PerSecond:null,velocityMPerSecond:null,reynolds:null,darcyFrictionFactor:null,regime:'shut-in' as const};
 if(rateStbd===0)return {...empty,status:'shut-in',operatingFeasible:true,reasons:[]};
 const bottomholePsia=well.reservoirPsia+rateStbd/well.injectivityStbdPerPsi;
 let traverse:WellboreTraverse;
 try{traverse=traverseBrineWell({well,fluid,settings,rateStbd,boundary:{location:'bottomhole',pressurePsia:bottomholePsia}});}
 catch(error){if(error instanceof TraverseError&&error.code!=='numerical')return {...empty,status:'unsupported',operatingFeasible:false,reasons:[error.message]};throw error;}
 const local=traverse.points[0],reasons:string[]=[];
 if(traverse.surfacePsia>well.surfaceLimitPsia+1e-8)reasons.push('Required surface pressure exceeds the declared surface maximum.');
 if(bottomholePsia>well.limitPsia+1e-8)reasons.push('Required bottomhole pressure exceeds the declared bottomhole maximum.');
 if(rateStbd>well.operatingCeilingStbd+1e-8)reasons.push('Onstream rate exceeds the declared operating ceiling.');
 return {rateStbd,status:'flowing',bottomholePsia,hydrostaticPsi:traverse.hydrostaticPsi,frictionPsi:traverse.frictionPsi,requiredSurfacePsia:traverse.surfacePsia,localFlowM3PerSecond:local.localFlowM3PerSecond,velocityMPerSecond:local.velocityMPerSecond,reynolds:local.reynolds,darcyFrictionFactor:local.darcyFrictionFactor,regime:local.regime,operatingFeasible:reasons.length===0,reasons,traverse};
}
/** Unified evaluator for displays and exports using the selected case model. */
export function caseHydraulicPoint(input:Pick<DisposalCaseInput,'fluid'|'hydraulics'>,well:DisposalWell,rateStbd:number):HydraulicPoint{
 return input.hydraulics?segmentedHydraulicPoint(well,input.fluid,input.hydraulics,rateStbd):hydraulicPoint(well,brineAtPressure(input.fluid.referencePressurePsia,input.fluid.temperatureF,input.fluid.salinityWtPercent),rateStbd);
}
function segmentedWellEnvelope(well:DisposalWell,fluid:FluidInput,settings:SegmentedBrineSettings){
 const bottomholeLimitedStbd=Math.max(0,well.injectivityStbdPerPsi*(well.limitPsia-well.reservoirPsia)),upper=Math.min(bottomholeLimitedStbd,well.operatingCeilingStbd,MAX_RATE_STBD);
 let maximumStbd=0,surfaceLimitedStbd=upper,surfaceBoundStatus='not-binding-within-joint-upper-rate';
 const classify=(rate:number)=>{
  try{
   const traverse=traverseBrineWell({well,fluid,settings,rateStbd:rate,boundary:{location:'bottomhole',pressurePsia:well.reservoirPsia+rate/well.injectivityStbdPerPsi}});
   return {kind:traverse.surfacePsia<=well.surfaceLimitPsia?'feasible' as const:'high' as const,pressure:traverse.surfacePsia};
  }catch(error){
   if(error instanceof TraverseError&&error.code!=='numerical')return {kind:error.code==='pressure-low'?'low' as const:'high-domain' as const,pressure:null};
   throw error;
  }
 };
 if(upper>0){
  const atUpper=classify(upper);
  if(atUpper.kind==='feasible')maximumStbd=upper;
  else{
   if(atUpper.kind==='low')throw Error(`Well ${well.id}: no supported capacity anchor before the joint upper rate; pressure domain is below 100 psia`);
   let low=0,high=upper,anchor:number|null=null;
   for(let i=0;i<60;i++){
    const mid=low+(high-low)/2,trial=classify(mid);
    if(trial.kind==='feasible'){low=mid;anchor=mid;}
    else if(trial.kind==='low'){
     if(anchor!==null)throw Error(`Well ${well.id}: non-ordered pressure-domain classification; capacity unsupported`);
     low=mid;
    }else high=mid;
   }
   const finalHigh=classify(high),finalLow=anchor===null?null:classify(anchor);
   if(anchor===null||finalHigh.kind!=='high'||finalLow?.kind!=='feasible'||well.surfaceLimitPsia-finalLow.pressure!>0.001)throw Error(`Well ${well.id}: could not establish a valid feasible capacity anchor and surface-pressure bracket; unsupported domain or velocity limit`);
   maximumStbd=anchor;surfaceLimitedStbd=anchor;surfaceBoundStatus='valid-feasible-and-surface-pressure-bracket';
  }
 }
 const maximumPoint=segmentedHydraulicPoint(well,fluid,settings,maximumStbd);
 if(!maximumPoint.operatingFeasible)throw Error(`Well ${well.id}: maximum capacity verification failed: ${maximumPoint.reasons.join(' ')}`);
 const limitingConstraints:string[]=[];
 if(Math.abs(bottomholeLimitedStbd-maximumStbd)<=1e-8*Math.max(1,maximumStbd))limitingConstraints.push('bottomhole limit');
 if(surfaceBoundStatus==='valid-feasible-and-surface-pressure-bracket'||maximumPoint.requiredSurfacePsia!==null&&Math.abs(maximumPoint.requiredSurfacePsia-well.surfaceLimitPsia)<=1e-8)limitingConstraints.push('surface limit');
 if(Math.abs(well.operatingCeilingStbd-maximumStbd)<=1e-8*Math.max(1,maximumStbd))limitingConstraints.push('operating ceiling');
 const curve=Array.from({length:41},(_,i)=>segmentedHydraulicPoint(well,fluid,settings,maximumStbd*i/40));
 return {well:structuredClone(well),capacity:{bottomholeLimitedStbd,surfaceLimitedStbd,maximumStbd,availableStbd:maximumStbd*well.availability,limitingConstraints,maximumOperatingFeasible:maximumPoint.operatingFeasible,maximumOperatingReasons:maximumPoint.reasons,surfaceResidualPsi:maximumStbd>0?well.surfaceLimitPsia-maximumPoint.requiredSurfacePsia!:null,surfaceBoundStatus},curve};
}
function scenario(label:string,wells:DisposalWell[],p:FluidProperties,demand:DisposalCaseInput['demand'],fluid?:FluidInput,settings?:SegmentedBrineSettings){
 const results=wells.map(w=>settings?segmentedWellEnvelope(w,fluid!,settings):wellEnvelope(w,p)),totalAvailableStbd=results.reduce((sum,r)=>sum+r.capacity.availableStbd,0);
 const monthly=[...demand.monthly].sort((a,b)=>a.month.localeCompare(b.month)).map(row=>{
  const days=daysInMonth(row.month),capacityBbl=totalAvailableStbd*days,servedStbd=Math.min(row.demandBbl/days,totalAvailableStbd);
  const allocations=results.map(r=>{
   const averageStbd=totalAvailableStbd===0?0:Math.min(r.capacity.availableStbd,servedStbd*r.capacity.availableStbd/totalAvailableStbd);
   const onstreamStbd=r.well.availability===0?0:Math.min(r.capacity.maximumStbd,averageStbd/r.well.availability),hydraulics=settings?segmentedHydraulicPoint(r.well,fluid!,settings,onstreamStbd):hydraulicPoint(r.well,p,onstreamStbd);
   return {wellId:r.well.id,averageStbd,onstreamStbd,allocatedBbl:averageStbd*days,hydraulics,operatingFeasible:hydraulics.operatingFeasible,reason:hydraulics.reasons.length?hydraulics.reasons.join(' '):null};
  });
  return {month:row.month,days,demandBbl:row.demandBbl,capacityBbl,headroomBbl:capacityBbl-row.demandBbl,shortfallBbl:Math.max(0,row.demandBbl-capacityBbl),operatingFeasible:allocations.every(a=>a.operatingFeasible),allocations};
 });
 return {label,wells:results,monthly,firstShortfallMonth:monthly.find(m=>m.shortfallBbl>0)?.month??null,totalShortfallBbl:monthly.reduce((sum,m)=>sum+m.shortfallBbl,0),totalAvailableStbd};
}
// Evidence is preserved as finite JSON data. Reject unsupported values rather
// than silently losing lineage during a download or recomputation check.
function validateEvidence(value:unknown,depth=0,seen=new Set<object>()){
 if(depth>15)throw Error('Evidence nesting exceeds 15 levels');
 if(value===null||typeof value==='string'||typeof value==='boolean')return;
 if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Evidence numbers must be finite');return;}
 if(typeof value!=='object'||seen.has(value))throw Error('Evidence must be finite acyclic JSON data');
 if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype)throw Error('Evidence must contain plain JSON objects');
 seen.add(value);for(const child of Object.values(value))validateEvidence(child,depth+1,seen);seen.delete(value);
}
/** Screening maximum envelopes, not calibrated or sustainable capacity. */
export function buildDisposalCase(input:DisposalCaseInput){
 assertJsonEvidence(input,'disposal case input');
 text(input.caseName,'Case name',100);text(input.demand.id,'Demand ID',200000);text(input.demand.origin,'Demand acquisition origin',500);text(input.demand.content,'Demand content assertion',500);validateEvidence(input.demand.evidence);
 if(!Array.isArray(input.wells)||input.wells.length<1||input.wells.length>20)throw Error('Select 1–20 disposal wells');
 input.wells.forEach(validateWell);if(new Set(input.wells.map(w=>w.id)).size!==input.wells.length)throw Error('Well IDs must be distinct');
 if(!Array.isArray(input.demand.monthly)||input.demand.monthly.length<1||input.demand.monthly.length>120)throw Error('Demand requires 1–120 explicit monthly volumes');
 for(const row of input.demand.monthly){monthIndex(row.month);bound(Number(row.month.slice(0,4)),1900,2200,'Reporting year');bound(row.demandBbl,0,1e10,'Monthly stock-tank demand (bbl)');}
 if(new Set(input.demand.monthly.map(m=>m.month)).size!==input.demand.monthly.length)throw Error('Demand months must be distinct');
 text(input.comparison.wellId,'Comparison well ID');if(!input.wells.some(w=>w.id===input.comparison.wellId))throw Error('Comparison must target one selected well ID');
 bound(input.comparison.injectivityMultiplier,0.01,10,'Injectivity multiplier');bound(input.comparison.innerDiameterInches,0.25,30,'Comparison inner diameter (in)');bound(input.comparison.availability,0,1,'Comparison availability');
 const inputs=structuredClone(input),fluidProperties=brineAtPressure(input.fluid.referencePressurePsia,input.fluid.temperatureF,input.fluid.salinityWtPercent);
 if(input.hydraulics)input.wells.forEach(w=>validateSegmentedSettings(input.hydraulics!,w,w.bottomholeTemperatureF??input.fluid.temperatureF));
 const comparedWells=inputs.wells.map(w=>w.id===inputs.comparison.wellId?{...w,injectivityStbdPerPsi:w.injectivityStbdPerPsi*inputs.comparison.injectivityMultiplier,innerDiameterInches:inputs.comparison.innerDiameterInches,availability:inputs.comparison.availability}:{...w});comparedWells.forEach(validateWell);
 const pvt=buildBrineSweep({caseName:input.caseName,minPressurePsia:100,maxPressurePsia:10000,temperatureF:input.fluid.temperatureF,salinityWtPercent:input.fluid.salinityWtPercent,points:2}).provenance;
 const result={schemaVersion:'connected-disposal-case/1',methodVersion:input.hydraulics?SEGMENTED_BRINE_METHOD_VERSION:DISPOSAL_CASE_VERSION,inputs,fluidProperties,
  units:{pressure:'psia absolute',pressureDifference:'psi',rate:'STB/day stock-tank',onstreamRate:'STB/day while available',demandAndCapacity:'stock-tank bbl per calendar month',injectivity:'STB/day/psi',tvd:'ft vertical depth below surface datum',measuredDepth:'ft flow-path length',diameterAndRoughness:'in',density:'kg/m³',viscosity:'cP',temperature:'°F',salinity:'NaCl wt%',bw:'rb/STB',availability:'fraction of calendar time',...(input.hydraulics?{localFlow:'m³/s at local pressure/temperature',massFlow:'kg/s',velocity:'m/s',reynolds:'dimensionless',darcyFrictionFactor:'dimensionless'}:{})},
  methods:{bottomhole:'P_bh = P_res + q_ST/J at each well declared common formation datum',localRate:'q_local [m³/s] = q_ST [STB/day] × Bw [rb/STB] × 0.158987294928 / 86400',hydrostatic:'rho × 9.80665 × TVD_ft × 0.3048 / 6894.757293168; positive downward pressure gain',friction:'Darcy-Weisbach f × (MD/D) × rho × v²/2, SI converted to psi; positive pressure loss',frictionFactor:'Darcy f=64/Re for Re≤2000; Swamee-Jain for Re≥4000; continuous linear interpolation of endpoint factors for 2000<Re<4000 (custom transition, not EPANET polynomial)',surface:'P_surface = P_bh − hydrostatic + friction; flowing P_surface must be at least 100 psia, without clamping',capacity:'Maximum=min(max(0,J×(P_bh_limit−P_res)),surface-bound,operating ceiling); surface bound uses 80 bounded bisection iterations in 0–1000000 STB/day; availability applied exactly once',allocation:'Demand allocated proportional to available maximum envelopes and capped at each envelope; onstream rate=calendar-average rate/availability; unserved demand remains shortfall',calendar:'Actual calendar days in each explicitly provided month; no interpolation across missing months',fluid:'One gas-free brine property state evaluated at explicit reference pressure and temperature; same fixed uniform properties used throughout each well and both scenarios'},
  provenance:{inputs:'Selected well core inputs retain source assertions; added geometry/fluid/comparison values are user-entered assumptions. Demand acquisition origin and unverified content assertion retained separately.',outputs:'calculated',demand:structuredClone(input.demand),pvt,hydraulicsReference:'https://usepa.github.io/EPANET2.2/12_analysis_algorithms.html',hydraulicsImplementation:'Custom SI Darcy-Weisbach/Swamee-Jain screening model; not an extracted or validated full EPANET/Nexus wellbore implementation',comparisonTarget:inputs.comparison.wellId,...(input.hydraulics?{wellboreFrictionSource:{name:'reference/nexus-wellbore/serghides.ts',sha256:'db934a2a0d850aa3375789e590ad1699fac9611157459a8bed1343da641bc4be',conversion:'Darcy friction factor = 4 × Nexus Fanning friction factor',reuse:'Owner-authorized local snapshot; source license not established; no full Nexus injection/VFP parity claimed'}}:{})},
  limitations:['Fictional/assumed engineering screening: maximum envelopes are not calibrated sustainable disposal-capacity predictions or operating recommendations.','Uniform fixed-reference density, viscosity and Bw: no pressure/temperature traverse, heat transfer, pressure-dependent integration, fittings or pump model.','Gas-free NaCl brine only; no multiphase, dissolved gas, mixed ions, layering, relative permeability, transient reservoir response or field calibration.','A positive maximum envelope does not prove a feasible low-flow allocation; surface pressure below 100 psia requires unmodeled gravity/flow control and is explicitly unsupported.','Availability is an assumed fraction applied once to maximum onstream capacity; allocation does not model a coordinated daily operating schedule.','Per-well reservoir and bottomhole constraints must share their declared datum; aggregate stock-tank volumes can combine different valid per-well datums. Surface pressures use each well surface datum and declared TVD.','Bounds are explicit application screening limits (20 wells, 120 months, years 1900–2200, 100–10000 psia, 0–50000 ft TVD, 1–50000 ft MD, 0.25–30 in ID, 0–0.1 in roughness and relative roughness≤0.05, ≤1000000 STB/day); they are not validation of every physical combination.','Source hashes and the carried PVT oracle identify the reused local library snapshot; no live MCP call was made.'],
  base:scenario('Base',inputs.wells,fluidProperties,inputs.demand,inputs.fluid,inputs.hydraulics),compared:scenario('Compared',comparedWells,fluidProperties,inputs.demand,inputs.fluid,inputs.hydraulics)};
 if(input.hydraulics){
  result.methods.hydrostatic='Integral of local rho(P,T) × g × dTVD/dMD over MD, SI converted to psi; positive downward gravity gain';
  result.methods.friction='Integral of local Darcy f × rho(P,T) × v(P,T)²/(2D) over MD, SI converted to psi; positive pressure loss';
  result.methods.frictionFactor='Darcy f=64/Re for Re≤2000; retained Nexus Serghides Fanning ×4 for Re≥4000; custom continuous linear interpolation of endpoint factors for 2000<Re<4000';
  result.methods.surface='Integrate dP/dMD = rho(P,T) × g × dTVD/dMD − f_D × rho(P,T) × v(P,T)²/(2D) backward from P_bh=P_res+q/J; RK4 step doubling requires ≤0.001 psi change in endpoint pressure AND integrated gravity/friction contributions, at most 4096 segments; no pressure clamping';
  result.methods.capacity='Joint upper rate U=min(max(0,J×(P_bh_limit−P_res)),operating ceiling,1000000); accept U only with a valid feasible traverse, otherwise 60 bisections require a feasible anchor and a valid surface-pressure bracket. No anchor/pressure bound or numerical failure blocks the case. surfaceLimitedStbd is U when surfaceBoundStatus says not binding within U, not an extrapolated surface-only capacity. Availability applied exactly once.';
  result.methods.fluid='Pinned gas-free NaCl brine evaluated at every local pressure and prescribed temperature; fixed salinity and stock-tank rate preserve rho × Bw and mass. Temperature linear over TVD between declared surface and bottomhole endpoints (per-well override or fluid.temperatureF); straight constant TVD/MD slope; horizontal endpoints must match. fluidProperties retains the explicit reference state for context only.';
  result.provenance.hydraulicsImplementation='Custom steady single-phase RK4 injection traverse and constant-J coupling with owner-authorized Nexus Serghides friction utility and pinned pyResToolbox local brine PVT; not an extracted or validated full Nexus VFP/nodal model';
  result.limitations[1]='Prescribed linear temperature and straight deviation only: no heat transfer, fittings or pump model. Local velocity above 5 m/s is unsupported; acceleration is omitted, and maximum kinetic head is only a screening diagnostic, not a calibrated error bound.';
  result.limitations[3]='A supported maximum envelope does not prove a feasible low-flow allocation; a traverse leaving 100–10000 psia or exceeding the velocity limit is explicitly unsupported with null pressures. Numerical solver failure blocks the case; no failed solve becomes zero capacity.';
 }
 return result;
}
export type DisposalCase=ReturnType<typeof buildDisposalCase>;
function canonical(value:unknown,ancestors=new Set<object>()):string{
 if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 if(typeof value!=='object'||ancestors.has(value))throw Error('Result changed or tampered: expected finite acyclic JSON data');
 if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype)throw Error('Result changed or tampered: expected plain JSON objects');
 ancestors.add(value);
 const result=Array.isArray(value)?'['+value.map(v=>canonical(v,ancestors)).join(',')+']':'{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>JSON.stringify(key)+':'+canonical(v,ancestors)).join(',')+'}';
 ancestors.delete(value);return result;
}
function csvCell(value:unknown){let raw=typeof value==='object'?JSON.stringify(value):String(value??'');if(typeof value==='string'&&(/^[\s]*[=+\-@]/.test(raw)||/^[\t\r\n]/.test(raw)))raw="'"+raw;return '"'+raw.replaceAll('"','""')+'"';}
/** A stale/tampered displayed bundle cannot silently become a contradictory exhibit. */
export function disposalCaseCsv(result:DisposalCase){
 try{assertJsonEvidence(result,'disposal case result');}catch(error){throw Error(`Result changed or tampered: ${error instanceof Error?error.message:String(error)}`);}
 const fresh=buildDisposalCase(result.inputs);if(canonical(fresh)!==canonical(result))throw Error('Result changed or stale: displayed bundle must match recomputed inputs before export');
 const rows:unknown[][]=[['section','scenario','well_or_month','field','value']];
 for(const [key,value] of Object.entries(result))if(key!=='base'&&key!=='compared')rows.push(['metadata','','',key,value]);
 rows.push(['metadata','','','caseName',result.inputs.caseName],['metadata','','','demandId',result.inputs.demand.id],['metadata','','','demandOrigin',result.inputs.demand.origin],['metadata','','','demandContent',result.inputs.demand.content]);
 for(const s of [result.base,result.compared]){
  for(const field of ['firstShortfallMonth','totalShortfallBbl','totalAvailableStbd'] as const)rows.push(['summary',s.label,'',field,s[field]]);
  for(const w of s.wells){for(const [field,value] of Object.entries(w.well))rows.push(['well-input',s.label,w.well.id,field,value]);for(const [field,value] of Object.entries(w.capacity))rows.push(['capacity',s.label,w.well.id,field,value]);for(const point of w.curve)for(const [field,value] of Object.entries(point))rows.push(['curve',s.label,w.well.id,`${point.rateStbd} STB/day: ${field}`,value]);}
  for(const m of s.monthly){for(const [field,value] of Object.entries(m))if(field!=='allocations')rows.push(['monthly',s.label,m.month,field,value]);for(const a of m.allocations){for(const [field,value] of Object.entries(a))if(field!=='hydraulics')rows.push(['allocation',s.label,`${m.month} ${a.wellId}`,field,value]);for(const [field,value] of Object.entries(a.hydraulics))rows.push(['allocation-hydraulics',s.label,`${m.month} ${a.wellId}`,field,value]);}}
 }
 return rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
