import {type Injector,validateInjector} from './engineering.js';

/** Sample case contract: every value carries exactly one provenance class. No engineering method lives here. */
export const SAMPLE_CASE_VERSION='swd-sample-case/1';
export const ATMOSPHERIC_PSI=14.7;
export const VALUE_CLASSES=['trrc-public-record','calculated','derived-with-assumption','synthetic','raw-not-verified'] as const;
export type ValueClass=typeof VALUE_CLASSES[number];
export const CLASS_LABELS:Readonly<Record<ValueClass,string>>=Object.freeze({'trrc-public-record':'TRRC public record',calculated:'Calculated','derived-with-assumption':'Derived from TRRC with a stated assumption',synthetic:"Synthetic: you'd gather",'raw-not-verified':'Raw TRRC field, not verified'});
export const TOOL_LABELS:Readonly<Record<string,string>>=Object.freeze({publicTrends:'Injector history',history:'Histories',forecast:'Fit & forecast',comparison:'Capacity assessment',sensitivity:'Parameter sweeps',pvt:'Brine PVT',hydraulics:'Hydraulics',pressureSupport:'Pressure-support context'});
export type SampleValue=string|number|null;
export type SampleInput={key:string;label:string;value:SampleValue;unit:string|null;class:ValueClass;source:string;tools:string[];trrcField?:string;assumption?:string;derivedFrom?:string[]};
export type GatherItem={key:string;label:string;why:string;tools:string[]};
export type TrrcIdentity={origin:'pinned-explorer'|'explorer-package';artifactId:string;manifestSha256:string;normalizedSha256:string;firstMonth:string;lastMonth:string;package?:{path:string;sha256:string;bytes:number}};
export type SampleWell={id:string;label:string;trrc:TrrcIdentity;inputs:SampleInput[]};
export type SampleCase={version:string;caseId:string;name:string;producers:{fixtureId:string;class:'synthetic'};wells:SampleWell[];shared:SampleInput[];gatherOnly:GatherItem[]};
export type TrrcArtifact={artifactId:string;inventory:Record<string,unknown>[];injectionMonthly:{period_start:string;parent_key?:string}[]};
export type TrrcPin={manifestSha256?:string;normalizedSha256?:string};
export type ChecklistRow={item:string;well:string;class:string;source:string;units:string;neededBy:string};

const HASH=/^[a-f0-9]{64}$/;
const PRESSURE_RELABEL=/bottom\s*-?\s*hole|\bbhp\b|reservoir pressure/i;
const IDENTIFIER_FIELDS=new Set(['uic_number','api_no','operator_number','district_code','lease_number','well_no_display']);
const isObject=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);

export function deriveSurfaceLimitPsia(permitPsi:number):number{if(!Number.isFinite(permitPsi)||permitPsi<=0)throw Error('Permit pressure must be a positive finite number');return permitPsi+ATMOSPHERIC_PSI;}
export function deriveDatumTvdFt(permittedTopFt:number):number{if(!Number.isFinite(permittedTopFt)||permittedTopFt<=0)throw Error('Permitted top depth must be a positive finite number');return permittedTopFt;}

/** The well's inventory record is the one its monthly reports link to (TRRC parent key); API number is never a join key. */
export function trrcWellRecord(artifact:TrrcArtifact):Record<string,unknown>{
 const parents=new Set(artifact.injectionMonthly.map(r=>r.parent_key));
 const [parent]=parents;
 const matches=parents.size===1&&typeof parent==='string'?artifact.inventory.filter(r=>r.source_record_key===parent):[];
 if(matches.length!==1)throw Error('Monthly reports must link to exactly one TRRC inventory record');
 return matches[0];
}
/** Missing TRRC values stay null; identifiers keep their original string form. */
export function sourceValue(artifact:TrrcArtifact,field:string):SampleValue{
 if(field==='injectionMonthly.length')return artifact.injectionMonthly.length;
 const value=trrcWellRecord(artifact)[field];
 if(value===undefined||value===null||value==='')return null;
 if(typeof value==='string'||typeof value==='number')return value;
 throw Error(`TRRC field ${field} is not a scalar value`);
}

function checkInputs(inputs:unknown,where:string,issues:string[],sharedOnly:boolean){
 if(!Array.isArray(inputs)){issues.push(`${where}: inputs must be an array`);return;}
 const seen=new Map<string,Record<string,unknown>>();
 for(const input of inputs){
  if(!isObject(input)){issues.push(`${where}: each input must be an object`);continue;}
  const key=typeof input.key==='string'?input.key:'',at=`${where}.${key||'?'}`;
  if(!key)issues.push(`${where}: input key is required`);else if(seen.has(key))issues.push(`${at}: duplicate key`);else seen.set(key,input);
  if(!VALUE_CLASSES.includes(input.class as ValueClass))issues.push(`${at}: class must be exactly one of ${VALUE_CLASSES.join(', ')}`);
  if(sharedOnly&&input.class!=='synthetic')issues.push(`${at}: shared inputs are synthetic only`);
  if(!(input.value===null||typeof input.value==='string'||typeof input.value==='number'&&Number.isFinite(input.value)))issues.push(`${at}: value must be a string, a finite number or null`);
  if(typeof input.label!=='string'||!input.label)issues.push(`${at}: label is required`);
  if(typeof input.source!=='string'||!input.source)issues.push(`${at}: source is required`);
  if(!Array.isArray(input.tools)||!input.tools.length||input.tools.some(t=>!(String(t) in TOOL_LABELS)))issues.push(`${at}: tools must name known tools`);
  if(input.class==='trrc-public-record'){
   if(typeof input.trrcField!=='string'||!input.trrcField)issues.push(`${at}: TRRC values must name their source field`);
   if(PRESSURE_RELABEL.test(String(input.label))||PRESSURE_RELABEL.test(key))issues.push(`${at}: a TRRC value is never labelled as bottomhole or reservoir pressure`);
   if(IDENTIFIER_FIELDS.has(String(input.trrcField))&&input.value!==null&&typeof input.value!=='string')issues.push(`${at}: identifiers stay original strings`);
  }
  if(input.class==='derived-with-assumption'){
   if(typeof input.assumption!=='string'||!input.assumption.trim())issues.push(`${at}: derived values must name their assumption`);
   if(!Array.isArray(input.derivedFrom)||!input.derivedFrom.length)issues.push(`${at}: derived values must name their TRRC inputs`);
  }
 }
 for(const [key,input] of seen)if(input.class==='derived-with-assumption'&&Array.isArray(input.derivedFrom))for(const from of input.derivedFrom)if(seen.get(String(from))?.class!=='trrc-public-record')issues.push(`${where}.${key}: derived from ${String(from)}, which is not a TRRC public record in this well`);
}

export function validateSampleCase(raw:unknown):string[]{
 const issues:string[]=[];
 if(!isObject(raw))return ['Sample case must be a JSON object'];
 if(raw.version!==SAMPLE_CASE_VERSION)issues.push(`Unsupported sample case version ${String(raw.version)}`);
 if(typeof raw.caseId!=='string'||!raw.caseId)issues.push('caseId is required');
 if(!Array.isArray(raw.wells)||raw.wells.length!==2)issues.push('Exactly two wells are required');
 else raw.wells.forEach((well,i)=>{
  const where=`wells[${i}]`;
  if(!isObject(well)){issues.push(`${where} must be an object`);return;}
  if(typeof well.id!=='string'||!well.id||typeof well.label!=='string'||!well.label)issues.push(`${where}: id and label are required`);
  const t=well.trrc;
  if(!isObject(t)||typeof t.artifactId!=='string'||!HASH.test(String(t.manifestSha256))||!HASH.test(String(t.normalizedSha256)))issues.push(`${where}: TRRC identity requires artifactId and SHA-256 pins`);
  else if(t.origin==='explorer-package'&&(!isObject(t.package)||!HASH.test(String(t.package.sha256))||!Number.isSafeInteger(t.package.bytes)))issues.push(`${where}: package pin requires sha256 and bytes`);
  checkInputs(well.inputs,where,issues,false);
 });
 checkInputs(raw.shared,'shared',issues,true);
 if(!Array.isArray(raw.gatherOnly)||!raw.gatherOnly.length)issues.push('gatherOnly items are required');
 return issues;
}

export function checkTrrcValues(well:SampleWell,artifact:TrrcArtifact,pin:TrrcPin):string[]{
 const issues:string[]=[],at=well.label;
 if(artifact.artifactId!==well.trrc.artifactId)issues.push(`${at}: TRRC artifact ${artifact.artifactId} does not match ${well.trrc.artifactId}`);
 if(pin.manifestSha256!==well.trrc.manifestSha256)issues.push(`${at}: manifest SHA-256 differs from the sample pin`);
 if(pin.normalizedSha256!==well.trrc.normalizedSha256)issues.push(`${at}: normalized SHA-256 differs from the sample pin`);
 try{trrcWellRecord(artifact);}catch(error){issues.push(`${at}: ${(error as Error).message}`);return issues;}
 const months=artifact.injectionMonthly.map(r=>r.period_start).sort();
 if(months[0]?.slice(0,7)!==well.trrc.firstMonth||months.at(-1)?.slice(0,7)!==well.trrc.lastMonth)issues.push(`${at}: monthly coverage differs from the sample pin`);
 for(const input of well.inputs){
  if(input.class!=='trrc-public-record'||!input.trrcField)continue;
  let actual:SampleValue;
  try{actual=sourceValue(artifact,input.trrcField);}catch(error){issues.push(`${at}.${input.key}: ${(error as Error).message}`);continue;}
  if(actual!==input.value)issues.push(`${at}.${input.key}: sample value ${JSON.stringify(input.value)} differs from TRRC ${JSON.stringify(actual)}`);
 }
 return issues;
}

function numberOf(inputs:SampleInput[],key:string,where:string):number{
 const value=inputs.find(i=>i.key===key)?.value;
 if(typeof value!=='number'||!Number.isFinite(value))throw Error(`${where}: ${key} must be a finite number`);
 return value;
}
export function checkDerivedValues(well:SampleWell):string[]{
 try{
  const issues:string[]=[],n=(k:string)=>numberOf(well.inputs,k,well.label);
  if(n('surfaceLimitPsia')!==deriveSurfaceLimitPsia(n('permitPressurePsi')))issues.push(`${well.label}: surface limit is not permit pressure + ${ATMOSPHERIC_PSI} psi`);
  if(n('datumTvdFt')!==deriveDatumTvdFt(n('permittedTopFt')))issues.push(`${well.label}: datum is not the top of the permitted interval`);
  return issues;
 }catch(error){return [(error as Error).message];}
}
export function sampleInput(sample:SampleCase,wellIndex:number|'shared',key:string):SampleInput{
 const inputs=wellIndex==='shared'?sample.shared:sample.wells[wellIndex]?.inputs??[];
 const found=inputs.find(i=>i.key===key)??(wellIndex==='shared'?undefined:sample.shared.find(i=>i.key===key));
 if(!found)throw Error(`Sample input ${key} is not defined`);
 return found;
}
export function sampleInjector(well:SampleWell):Injector{
 const n=(k:string)=>numberOf(well.inputs,k,well.label),tvd=n('datumTvdFt');
 const datum=`Top of permitted interval, ${tvd} ft TVD (derived from TRRC; vertical-well assumption); synthetic bottomhole pressures`;
 const injector:Injector={id:well.id,reservoirPsia:n('reservoirPsia'),limitPsia:n('limitPsia'),injectivityStbdPerPsi:n('injectivityStbdPerPsi'),operatingCeilingStbd:n('operatingCeilingStbd'),availability:n('availability'),datum,reservoirDatum:datum,limitDatum:datum,reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute'};
 validateInjector(injector);
 return injector;
}
export function sampleGeometry(well:SampleWell){
 const n=(k:string)=>numberOf(well.inputs,k,well.label);
 return {tvdFt:n('datumTvdFt'),measuredDepthFt:n('measuredDepthFt'),innerDiameterInches:n('innerDiameterInches'),roughnessInches:n('roughnessInches'),surfaceLimitPsia:n('surfaceLimitPsia')};
}
export function sampleFluid(sample:SampleCase){
 const n=(k:string)=>numberOf(sample.shared,k,'shared');
 return {referencePressurePsia:n('referencePressurePsia'),temperatureF:n('temperatureF'),surfaceTemperatureF:n('surfaceTemperatureF'),salinityWtPercent:n('salinityWtPercent')};
}
export function gatherChecklist(sample:SampleCase):ChecklistRow[]{
 const tools=(t:string[])=>t.map(x=>TOOL_LABELS[x]??x).join('; ');
 const row=(input:SampleInput,well:string):ChecklistRow=>({item:input.label,well,class:CLASS_LABELS[input.class],source:input.class==='derived-with-assumption'?`${input.source}; assumption: ${input.assumption}`:input.source,units:input.unit??'',neededBy:tools(input.tools)});
 return [
  ...sample.wells.flatMap(w=>w.inputs.map(i=>row(i,w.label))),
  ...sample.shared.map(i=>row(i,'All wells')),
  ...sample.gatherOnly.map(g=>({item:g.label,well:'All wells',class:"Not in the sample: you'd gather",source:'You gather',units:'',neededBy:`${tools(g.tools)} — ${g.why}`})),
 ];
}
const csvCell=(v:string)=>/[",\r\n]/.test(v)?`"${v.replaceAll('"','""')}"`:v;
export function checklistCsv(rows:ChecklistRow[]):string{
 return ['Item,Well,Class,Source,Units and basis,Needed by',...rows.map(r=>[r.item,r.well,r.class,r.source,r.units,r.neededBy].map(csvCell).join(','))].join('\r\n')+'\r\n';
}
