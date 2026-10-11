import {planningDetails,type PlanningFixture} from './planningFixture.js';
import { ENGINEERING_VERSION, brineProperties, pressureRateCurve, capacity, type Injector } from './engineering.js';
import {MODEL_VERSION,type FrozenForecast,planningCase,freezeForecast,forecastRate,monthsBetween,monthIndex,daysInMonth,reconcile} from './planning.js';
import type {PublicArtifact} from './publicArtifact.js';
import {assertJsonEvidence as evidence,verifiedExhibit} from './exhibitIntegrity.js';
export const NEXUS_SOURCE_COMMIT='de631ad2952bf42b80a6738ff980992975be4cdc';
export type Controls={newWellStart:string;expansionMonth:string;expansionStbd:number;[key:string]:unknown};
export type ExhibitInput={frozen:FrozenForecast;rows:ReturnType<typeof planningCase>;injectors:readonly Injector[];controls:Controls;publicArtifact?:PublicArtifact|null;planningFixture?:PlanningFixture};
const close=(a:number,b:number)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-12*Math.max(1,Math.abs(a),Math.abs(b));
function matches(actual:unknown,expected:unknown,path:string):void {
  if(typeof expected==='number'){if(typeof actual!=='number'||!close(actual,expected))throw Error(`${path}: contradicts calculated inputs`);return;}
  if(expected&&typeof expected==='object'){
    if(!actual||typeof actual!=='object'||Array.isArray(actual)!==Array.isArray(expected)||JSON.stringify(Object.keys(actual).sort())!==JSON.stringify(Object.keys(expected).sort()))throw Error(`${path}: inconsistent calculation structure`);
    for(const [key,value]of Object.entries(expected))matches((actual as Record<string,unknown>)[key],value,`${path}.${key}`);return;
  }
  if(actual!==expected)throw Error(`${path}: does not match declared inputs`);
}
function validateCalculation({frozen,rows,injectors,controls,planningFixture:fixture}:ExhibitInput){
  const periods=monthsBetween('2026-01','2026-12');
  monthIndex(frozen.cutoff);
  if(!frozen.id||frozen.modelVersion!==MODEL_VERSION||frozen.cutoff>='2026-01'||!frozen.models.length||new Set(frozen.models.map(m=>m.producerId)).size!==frozen.models.length||frozen.models.some(m=>!m.producerId)||!frozen.trainingMonths.length||new Set(frozen.trainingMonths).size!==frozen.trainingMonths.length)throw Error('Invalid or inconsistent frozen forecast identity/training metadata');
  for(const month of frozen.trainingMonths){monthIndex(month);if(month>frozen.cutoff)throw Error('Forecast training month exceeds cutoff');}
  if(rows.length!==periods.length||rows.some((r,i)=>r.month!==periods[i]))throw Error('Monthly exhibit requires the ordered January–December 2026 calendar');
  if(!injectors.length||new Set(injectors.map(i=>i.id)).size!==injectors.length||injectors.some(i=>!i.id||i.datum!==injectors[0].datum))throw Error('The shared-datum pressure chart/export requires unique injectors with matching datums; independent capacity sums remain supported separately');
  const baseCapacity=injectors.reduce((sum,i)=>sum+capacity(i).availableStbd,0);
  if(controls.availability!==undefined&&injectors.some(i=>i.availability!==controls.availability))throw Error('availability control contradicts selected injector inputs');
  if(controls.injectorAInjectivity!==undefined&&injectors.find(i=>i.id==='FICTIONAL-INJ-A')?.injectivityStbdPerPsi!==controls.injectorAInjectivity)throw Error('injectorAInjectivity control contradicts the named injector');
  monthIndex(controls.newWellStart);monthIndex(controls.expansionMonth);
  if(!Number.isFinite(controls.expansionStbd)||controls.expansionStbd<0)throw Error('Invalid assumed expansion control');
  let details:ReturnType<typeof planningDetails>|undefined;
  if(fixture){
    if(fixture.cutoff!==frozen.cutoff)throw Error('Fixture cutoff contradicts frozen forecast cutoff');
    const fitted=freezeForecast(fixture.actuals,fixture.cutoff,fixture.actualsId);matches(frozen,fitted,'Frozen forecast/raw history');
    const identities=new Set<string>();
    for(const row of fixture.actuals){monthIndex(row.month);const key=JSON.stringify([row.producerId,row.month]);if(identities.has(key)||!frozen.models.some(m=>m.producerId===row.producerId)||row.rateStbd<0||row.volumeBbl<0||!close(row.rateStbd*daysInMonth(row.month),row.volumeBbl))throw Error('Independent actual history has inconsistent identity, rate or calendar volume');identities.add(key);}
    if(fixture.schedules.length!==1)throw Error('Global new-well controls require one unambiguous declared schedule');
    const s=fixture.schedules[0],p=fixture.producers.find(p=>p.id===s.producerId);
    if(s.startMonth!==controls.newWellStart||p?.startMonth!==s.startMonth)throw Error('New-well start control contradicts schedule/producer input');
    if(controls.newWellRamp!==undefined&&s.rampMonths!==controls.newWellRamp)throw Error('New-well ramp control contradicts schedule input');
    if(controls.newWellAvailability!==undefined&&periods.some(m=>(s.availabilityByMonth[m]??1)!==controls.newWellAvailability))throw Error('New-well availability control contradicts schedule input');
    details=planningDetails(fixture,frozen);
  }else if(controls.newWellRamp!==undefined&&controls.newWellRamp!==1||controls.newWellAvailability!==undefined&&controls.newWellAvailability!==1)throw Error('Ramp/downtime controls require raw planning fixture inputs');
  const expected=periods.map((month,index)=>{
    const days=daysInMonth(month),forecastStbd=forecastRate(frozen,month),forecastBbl=forecastStbd*days;
    const actualBbl=details?details.monthly[index].actualBbl:rows[index].actualBbl;
    if(actualBbl===null||actualBbl<0||!Number.isFinite(actualBbl))throw Error(`Independent actuals missing or invalid for ${month}`);
    const age=monthIndex(month)-monthIndex(controls.newWellStart);
    const newDemandStbd=details?details.producerMonths.filter(r=>r.month===month&&r.contribution==='assumed-schedule').reduce((sum,r)=>sum+r.rateStbd,0):age<0?0:6000*Math.exp(-0.025*age);
    const demandStbd=forecastStbd+newDemandStbd,demandBbl=demandStbd*days,availableStbd=baseCapacity+(month>=controls.expansionMonth?controls.expansionStbd:0),capacityBbl=availableStbd*days;
    return {month,days,forecastStbd,forecastBbl,actualBbl,...reconcile(forecastBbl,actualBbl),newDemandStbd,demandStbd,demandBbl,availableStbd,capacityBbl,headroomBbl:capacityBbl-demandBbl,shortfallBbl:Math.max(0,demandBbl-capacityBbl)};
  });
  evidence(expected,'Calculated monthly exhibit');matches(rows,expected,'Monthly exhibit');
  return details;
}
async function sha256(value:unknown) {const data=new TextEncoder().encode(JSON.stringify(value));const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',data));return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function buildExhibit(input:ExhibitInput) {
  evidence(input);
  const {frozen,rows,injectors,controls,publicArtifact=null,planningFixture}=structuredClone(input);
  evidence({frozen,rows,injectors,controls,publicArtifact,...(planningFixture?{planningFixture}:{})});
  const details=validateCalculation({frozen,rows,injectors,controls,planningFixture});
  const inputs={...(planningFixture?{planningFixture,planningFixtureSha256:await sha256(planningFixture),dateRange:{first:planningFixture.actuals.map(r=>r.month).sort()[0],last:planningFixture.actuals.map(r=>r.month).sort().at(-1)}}:{declaredMonthlyActuals:rows.map(r=>({month:r.month,volumeBbl:r.actualBbl}))}),forecastEvidence:planningFixture?'Refitted and verified against retained raw history and source identity':'Supplied frozen forecast parameters; unverified against absent raw training history',fixtureId:planningFixture?.id??'legacy-declared-monthly-inputs',forecastId:frozen.id,cutoff:frozen.cutoff,trainingMonths:frozen.trainingMonths,forecastModels:frozen.models,newProducerTypeCurve:planningFixture?{initialRateStbd:planningFixture.schedules[0].initialRateStbd,monthlyExponentialDecline:planningFixture.schedules[0].monthlyDecline,rampMonths:planningFixture.schedules[0].rampMonths,availabilityByMonth:planningFixture.schedules[0].availabilityByMonth,formula:'q(age months) = q0 * exp(-D*age) * min(1,(age+1)/rampMonths) * availability(month); zero before start',provenance:'assumed fictional planning curve'}:{initialRateStbd:6000,monthlyExponentialDecline:0.025,formula:'q(age months) = 6000 * exp(-0.025 * age)',provenance:'assumed fictional planning curve'},injectors,controls,publicArtifactId:publicArtifact?.artifactId??null,nexusSourceCommit:NEXUS_SOURCE_COMMIT};
  const outputs={...(details?{planningDetails:details}:{}),monthly:rows,injectors:injectors.map(i=>({id:i.id,...capacity(i),curve:pressureRateCurve(i)})),brine:brineProperties(3000,180,50000)};
  const publicHistory=publicArtifact?{artifactId:publicArtifact.artifactId,inventory:publicArtifact.inventory,injectionMonthly:publicArtifact.injectionMonthly,manifest:publicArtifact.manifest,qualityReport:publicArtifact.qualityReport,dataDictionary:publicArtifact.dataDictionary}:null;
  const content={schemaVersion:planningFixture?2:1,modelVersions:{engineering:ENGINEERING_VERSION,forecast:MODEL_VERSION},inputs,outputs,publicHistory,
    units:{rate:'stock-tank bbl/day',monthlyVolume:'bbl/month',engineeringPressure:'bottomhole psia at shared formation reference depth',reportedPressure:'source-reported psi; basis unspecified; never used as bottomhole pressure',injectivity:'stock-tank bbl/day/psi'},
    formulas:{bottomholePressure:'Pres + rate/J',pressureCapacity:'max(0, J*(Plimit-Pres))',availableCapacity:'min(pressureCapacity, operatingCeiling)*availability + explicitly assumed available expansion',monthlyVolume:'calendar-day average rate * actual calendar days',variance:'actual volume - frozen forecast volume',percentVariance:'100*variance/forecast; null when forecast=0'},
    provenance:{producedWater:planningFixture?'synthetic seeded histories; fitted forecast verified against retained training rows; future actuals excluded from training':'Declared monthly aggregate actuals and supplied frozen forecast parameters; raw training history absent and unverified',injectors:'fictional assumed constant-J educational scenarios; no real-well calibration',pvt:'Gas-free NaCl brine browser method adapted from the retained local pyResToolbox source snapshot; 45-case property oracle; legacy Nexus/black-oil source retained separately; no live MCP call claimed',publicHistory:publicHistory?'public reported monthly liquid injection; calendar-day average calculated':'not loaded'},
    assumptions:[`Forecast frozen at ${frozen.cutoff}; new-well schedule edits do not change actuals or fitted forecast.`,'Injectivity is fixed with pressure and time; no fracture, transient, layered or calibrated well model.','Assumed pressure limit is bottomhole psia, not a copied surface permit maximum.','Additional expansion is available stock-tank capacity after downtime; no implicit availability multiplier.','Gas-free NaCl brine: assumed 3000 psia absolute, 180 F and 50000 NaCl mass ppm = 5 wt%, not mg/L TDS. Source-checked bounded method; methane saturation zero; no field calibration.','Public reported liquid injection is not assigned to synthetic producers or fictional injectors.'],
  };
  evidence(content);
  return {...content,contentSha256:await sha256(content)};
}
export type Exhibit=Awaited<ReturnType<typeof buildExhibit>>;
function csvCell(value:unknown) {if(value===null||value===undefined)return '';const s=typeof value==='object'?JSON.stringify(value):String(value);return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;}
/** A long-form exhibit keeps inputs, output tables, formulas and lineage together. */
export function exhibitCsv(input:Exhibit) {
  const exhibit=verifiedExhibit(input);
  const inputOrigin=exhibit.schemaVersion===2?'synthetic / assumed':'declared / assumed; raw history unverified';
  const outputOrigin=exhibit.schemaVersion===2?'calculated from synthetic / assumed':'calculated from declared inputs / assumptions';
  const rows:unknown[][]=[['section','record','field','value','unit','provenance'],['metadata','exhibit','content_sha256',exhibit.contentSha256,'SHA-256','calculated'],['metadata','source','nexus_commit',NEXUS_SOURCE_COMMIT,'Git commit','Nexus local main']];
  for(const [field,value] of Object.entries(exhibit.inputs)) if(field!=='injectors')rows.push(['inputs','planning',field,value,'',inputOrigin]);
  for(const i of exhibit.inputs.injectors)for(const [field,value] of Object.entries(i))rows.push(['inputs',i.id,field,value,field.endsWith('Psia')?'psia':field.endsWith('Stbd')?'stb/day':'','assumed']);
  for(const row of exhibit.outputs.monthly)for(const [field,value] of Object.entries(row))rows.push(['planning',row.month,field,value,field.endsWith('Bbl')?'bbl/month':field.endsWith('Stbd')?'stb/day':field.endsWith('Pct')?'percent':'',outputOrigin]);
  for(const i of exhibit.outputs.injectors)for(const p of i.curve)rows.push(['pressure_rate',i.id,'bottomholePsia',p.bottomholePsia,'psia',`calculated at ${p.rateStbd} stb/day`]);
  for(const [field,value] of Object.entries(exhibit.outputs.brine))rows.push(['pvt','Brine reference',field,value,'see field name','calculated']);
  for(const [field,value] of Object.entries(exhibit.formulas))rows.push(['method','formula',field,value,'','calculated definition']);
  for(const [n,value] of exhibit.assumptions.entries())rows.push(['method','assumption',n+1,value,'','assumed / limitation']);
  if('planningFixture' in exhibit.inputs&&exhibit.inputs.planningFixture){
    const fixture=exhibit.inputs.planningFixture;
    for(const [section,records] of [['planning_actuals',fixture.actuals],['planning_producers',fixture.producers],['planning_groups',fixture.groups],['planning_schedules',fixture.schedules]] as const)for(const [index,record] of records.entries())for(const [field,value] of Object.entries(record))rows.push([section,index+1,field,value,field==='volumeBbl'?'STB':field==='rateStbd'?'STB/day':'',section==='planning_actuals'?'synthetic':section==='planning_schedules'?'assumed':'fictional metadata']);
    for(const record of exhibit.outputs.planningDetails?.groups??[])rows.push(['grouped_demand',record.groupId,record.month,record.volumeBbl,'STB/month','calculated from synthetic / assumed']);
  }
  if(exhibit.publicHistory){
    const history=exhibit.publicHistory;
    rows.push(['public','artifact','manifest',history.manifest,'','public provenance'],['public','artifact','data_dictionary',history.dataDictionary,'','source definitions and units'],['public','artifact','quality_report',history.qualityReport,'','source dispositions and identity checks']);
    const fields=(history.dataDictionary.fields??{}) as Record<string,{units?:string;status?:string}>;
    for(const r of history.inventory)for(const [field,value] of Object.entries(r))rows.push(['public_inventory',r.source_record_key,field,value,fields[field]?.units??'',fields[field]?.status??'source metadata']);
    for(const r of history.injectionMonthly)for(const [field,value] of Object.entries(r))rows.push(['public_monthly',r.source_row_key,field,value,fields[field]?.units??'',fields[field]?.status??(field.startsWith('calculated_')?'calculated':'public reported / source metadata')]);
  }
  return rows.map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';
}


