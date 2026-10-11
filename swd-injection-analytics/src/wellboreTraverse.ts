import {brineAtPressure} from './brinePvt.js';

export type SegmentedBrineSettings={model:'segmented-brine';surfaceTemperatureF:number;segments:number};
export type WellboreGeometry={tvdFt:number;measuredDepthFt:number;innerDiameterInches:number;roughnessInches:number;bottomholeTemperatureF?:number};
export type TraverseFluid={referencePressurePsia:number;temperatureF:number;salinityWtPercent:number};
export type TraverseBoundary={location:'surface'|'bottomhole';pressurePsia:number};
type Properties=ReturnType<typeof brineAtPressure>;
export type TraverseNode={measuredDepthFt:number;tvdFt:number;temperatureF:number;pressurePsia:number;bwRbPerStb:number;densityKgPerM3:number;viscosityCp:number;localFlowM3PerSecond:number;massFlowKgPerSecond:number;velocityMPerSecond:number;reynolds:number;darcyFrictionFactor:number;regime:'laminar'|'transition'|'turbulent'|'shut-in'};
export type WellboreTraverse={surfacePsia:number;bottomholePsia:number;hydrostaticPsi:number;frictionPsi:number;points:TraverseNode[];segmentsUsed:number;convergenceResidualPsi:number;maximumVelocityMPerSecond:number;maximumKineticHeadPsi:number;diagnostics:string[]};
export const SEGMENTED_BRINE_METHOD_VERSION='constant-j-segmented-brine-rk4-darcy-weisbach/1';
export const MAXIMUM_TRAVERSE_VELOCITY_M_PER_SECOND=5;
const PSI_PA=6894.757293168,FT_M=0.3048,IN_M=0.0254,STB_M3=0.158987294928,G=9.80665;
const CONVERGENCE_PSI=0.001,MAX_SEGMENTS=4096;
export class TraverseError extends Error{
 constructor(public readonly code:'pressure-low'|'pressure-high'|'velocity'|'numerical',message:string){super(message);this.name='TraverseError';}
}
function bounded(value:number,min:number,max:number,label:string){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(`${label} must be finite between ${min} and ${max}`);}
export function validateSegmentedSettings(settings:SegmentedBrineSettings,well:WellboreGeometry,bottomholeTemperatureF:number){
 if(settings.model!=='segmented-brine')throw Error('Unsupported wellbore hydraulics model');
 bounded(settings.surfaceTemperatureF,60,250,'Surface temperature (°F)');bounded(bottomholeTemperatureF,60,250,'Bottomhole temperature (°F)');
 bounded(settings.segments,8,256,'Traverse segments');if(!Number.isInteger(settings.segments))throw Error('Traverse segments must be an integer');
 if(well.tvdFt===0&&bottomholeTemperatureF!==settings.surfaceTemperatureF)throw Error('Horizontal well requires equal surface and bottomhole temperature for the prescribed TVD temperature profile');
}
function frictionFactor(re:number,roughness:number):{factor:number;regime:TraverseNode['regime']}{
 if(re===0)return {factor:0,regime:'shut-in'};
 if(re<=2000)return {factor:64/re,regime:'laminar'};
 // Owner-authorized Nexus serghides.ts snapshot, retained under
 // reference/nexus-wellbore/. Upstream returns Fanning; convert ×4 to Darcy.
 const turbulent=(r:number)=>{
  const a=-2*Math.log10(roughness/3.7+12/r),b=-2*Math.log10(roughness/3.7+2.51*a/r),c=-2*Math.log10(roughness/3.7+2.51*b/r),diff=c-2*b+a;
  const fanning=Math.abs(diff)<1e-30?1/(a*a)/4:Math.pow(a-(b-a)**2/diff,-2)/4;
  return 4*fanning;
 };
 if(re>=4000)return {factor:turbulent(re),regime:'turbulent'};
 const fraction=(re-2000)/2000;return {factor:(1-fraction)*64/2000+fraction*turbulent(4000),regime:'transition'};
}
type IntegrationInput={well:WellboreGeometry;rateStbd:number;surfaceTemperatureF:number;bottomholeTemperatureF:number;segments:number;boundary:TraverseBoundary};
/** Single-phase SI momentum integration. The property callback is the physical
 * constitutive model; the connected case supplies only the pinned brine model. */
export function integrateWellbore(input:IntegrationInput,fluidAt:(pressurePsia:number,temperatureF:number)=>Properties):WellboreTraverse{
 const {well,rateStbd,boundary}=input;
 bounded(well.tvdFt,0,50000,'TVD (ft)');bounded(well.measuredDepthFt,1,50000,'Measured depth (ft)');if(well.measuredDepthFt<well.tvdFt)throw Error('Measured depth must be at least TVD');
 bounded(well.innerDiameterInches,0.25,30,'Diameter (in)');bounded(well.roughnessInches,0,0.1,'Roughness (in)');if(well.roughnessInches/well.innerDiameterInches>0.05)throw Error('Relative roughness must not exceed 0.05');
 bounded(rateStbd,0,1e6,'Rate (STB/day)');validateSegmentedSettings({model:'segmented-brine',surfaceTemperatureF:input.surfaceTemperatureF,segments:input.segments},well,input.bottomholeTemperatureF);
 if(boundary.location!=='surface'&&boundary.location!=='bottomhole')throw Error('Boundary location must be surface or bottomhole');
 const length=well.measuredDepthFt*FT_M,diameter=well.innerDiameterInches*IN_M,slope=well.tvdFt/well.measuredDepthFt,area=Math.PI*diameter**2/4;
 const evaluate=(mdM:number,pressurePsia:number)=>{
  if(!Number.isFinite(pressurePsia))throw new TraverseError('numerical','Wellbore arithmetic returned non-finite pressure; no result is available');
  if(pressurePsia<100)throw new TraverseError('pressure-low',`Pressure domain exit below 100 psia at MD ${(mdM/FT_M).toFixed(2)} ft; unsupported flow-control state`);
  if(pressurePsia>10000)throw new TraverseError('pressure-high',`Pressure domain exit above 10000 psia at MD ${(mdM/FT_M).toFixed(2)} ft`);
  // RK coordinate roundoff may exceed an endpoint by a few ulps. Bound the
  // geometric interpolation only; physical pressure is never clamped.
  const fraction=Math.max(0,Math.min(1,mdM/length)),temperatureF=fraction===0?input.surfaceTemperatureF:fraction===1?input.bottomholeTemperatureF:Math.max(Math.min(input.surfaceTemperatureF,input.bottomholeTemperatureF),Math.min(Math.max(input.surfaceTemperatureF,input.bottomholeTemperatureF),input.surfaceTemperatureF+(input.bottomholeTemperatureF-input.surfaceTemperatureF)*fraction)),p=fluidAt(pressurePsia,temperatureF);
  if([p.bwRbPerStb,p.densityKgPerM3,p.viscosityCp].some(v=>!Number.isFinite(v)||v<=0))throw new TraverseError('numerical','Constitutive fluid model returned invalid properties');
  const localFlowM3PerSecond=rateStbd*p.bwRbPerStb*STB_M3/86400,velocityMPerSecond=localFlowM3PerSecond/area;
  if(velocityMPerSecond>MAXIMUM_TRAVERSE_VELOCITY_M_PER_SECOND)throw new TraverseError('velocity','Velocity exceeds the 5 m/s low-velocity model limit; acceleration omission is unsupported');
  const reynolds=p.densityKgPerM3*velocityMPerSecond*diameter/(p.viscosityCp*0.001),f=frictionFactor(reynolds,well.roughnessInches/well.innerDiameterInches);
  const gravity=p.densityKgPerM3*G*slope/PSI_PA,friction=f.factor*p.densityKgPerM3*velocityMPerSecond**2/(2*diameter*PSI_PA);
  const node:TraverseNode={measuredDepthFt:well.measuredDepthFt*fraction,tvdFt:well.tvdFt*fraction,temperatureF,pressurePsia,bwRbPerStb:p.bwRbPerStb,densityKgPerM3:p.densityKgPerM3,viscosityCp:p.viscosityCp,localFlowM3PerSecond,massFlowKgPerSecond:p.densityKgPerM3*localFlowM3PerSecond,velocityMPerSecond,reynolds,darcyFrictionFactor:f.factor,regime:f.regime};
  return {node,derivative:[gravity-friction,gravity,friction]};
 };
 const run=(segments:number)=>{
  const backwards=boundary.location==='bottomhole',step=length/segments*(backwards?-1:1),start=backwards?length:0;
  let pressure=boundary.pressurePsia,gravity=0,friction=0;
  const points:TraverseNode[]=[evaluate(start,pressure).node];
  for(let i=0;i<segments;i++){
   const md=start+i*step,a=evaluate(md,pressure).derivative,b=evaluate(md+step/2,pressure+step*a[0]/2).derivative,c=evaluate(md+step/2,pressure+step*b[0]/2).derivative,d=evaluate(md+step,pressure+step*c[0]).derivative;
   const weighted=(j:number)=>step*(a[j]+2*b[j]+2*c[j]+d[j])/6;
   pressure+=weighted(0);gravity+=weighted(1);friction+=weighted(2);
   points.push(evaluate(i===segments-1?(backwards?0:length):start+(i+1)*step,pressure).node);
  }
  if(backwards)points.reverse();
  return {surfacePsia:points[0].pressurePsia,bottomholePsia:points.at(-1)!.pressurePsia,hydrostaticPsi:gravity*(backwards?-1:1),frictionPsi:friction*(backwards?-1:1),points};
 };
 // An out-of-domain RK predictor is not a proven physical boundary crossing.
 // Retry the entire traverse on finer grids before reporting a domain exit.
 let n=input.segments,coarse:ReturnType<typeof run>|undefined,fine:ReturnType<typeof run>|undefined;
 while(!coarse||!fine){
  try{coarse=run(n);fine=run(n*2);}
  catch(error){
   if(!(error instanceof TraverseError)||!['pressure-low','pressure-high'].includes(error.code)||n>=MAX_SEGMENTS/2)throw error;
   n=Math.min(n*2,MAX_SEGMENTS/2);coarse=undefined;fine=undefined;
  }
 }
 const difference=(a:ReturnType<typeof run>,b:ReturnType<typeof run>)=>Math.max(Math.abs(a.surfacePsia-b.surfacePsia),Math.abs(a.bottomholePsia-b.bottomholePsia),Math.abs(a.hydrostaticPsi-b.hydrostaticPsi),Math.abs(a.frictionPsi-b.frictionPsi));
 let residual=difference(fine,coarse);n*=2;
 while(residual>CONVERGENCE_PSI&&n<MAX_SEGMENTS){coarse=fine;n=Math.min(n*2,MAX_SEGMENTS);fine=run(n);residual=difference(fine,coarse);}
 if(!Number.isFinite(residual)||residual>CONVERGENCE_PSI)throw new TraverseError('numerical',`Wellbore refinement failed to converge within ${MAX_SEGMENTS} segments`);
 const maximumVelocityMPerSecond=Math.max(...fine.points.map(p=>p.velocityMPerSecond)),maximumKineticHeadPsi=Math.max(...fine.points.map(p=>p.densityKgPerM3*p.velocityMPerSecond**2/(2*PSI_PA)));
 return {...fine,segmentsUsed:n,convergenceResidualPsi:residual,maximumVelocityMPerSecond,maximumKineticHeadPsi,diagnostics:['Steady single-phase gas-free brine; acceleration omitted under a hard 5 m/s local velocity limit.','Maximum kinetic head is an acceleration-omission screening diagnostic, not an acceleration correction or calibrated error bound.','Straight constant TVD/MD slope; temperature is prescribed linear in TVD, with no heat-transfer solution.']};
}
export function traverseBrineWell(input:{well:WellboreGeometry;fluid:TraverseFluid;settings:SegmentedBrineSettings;rateStbd:number;boundary:TraverseBoundary}):WellboreTraverse{
 const endTemperature=input.well.bottomholeTemperatureF??input.fluid.temperatureF;
 validateSegmentedSettings(input.settings,input.well,endTemperature);
 bounded(input.fluid.salinityWtPercent,0,20,'NaCl salinity (wt%)');
 return integrateWellbore({well:input.well,rateStbd:input.rateStbd,surfaceTemperatureF:input.settings.surfaceTemperatureF,bottomholeTemperatureF:endTemperature,segments:input.settings.segments,boundary:input.boundary},(p,t)=>brineAtPressure(p,t,input.fluid.salinityWtPercent));
}
