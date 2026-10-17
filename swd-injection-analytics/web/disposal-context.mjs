import {presentationGates} from './workspace-state.mjs';
import {planningDetails} from '../dist/planningFixture.js';
import {freezeForecast} from '../dist/planning.js';
import {validateInjector} from '../dist/engineering.js';
// Optional JS properties become explicit null, so missing evidence is visible in JSON.
const evidenceSnapshot=value=>JSON.parse(JSON.stringify(value,(_,v)=>v===undefined?null:v));
// Each sample input derived from TRRC with a stated assumption (surface limit, datum), so exports name it directly.
const derivedInputs=sample=>sample.sample?.wells?sample.sample.wells.flatMap(w=>w.inputs.filter(i=>i.class==='derived-with-assumption').map(i=>({well:w.label,key:i.key,input:i.label,value:i.value,unit:i.unit,assumption:i.assumption,derivedFrom:i.derivedFrom??[]}))):null;
/** Read-only boundary. Never substitute demonstration demand into a user/public source. */
export function disposalContext({source,demo=null,imported=null,sample=null}){
 const blocked=(...reasons)=>({ready:false,reasons,demand:null,wells:[]});
 if(!source)return blocked('Select the synthetic demonstration or confirm user history and injector profiles in Data & imports.');
 if(source==='public')return blocked('RRC injection history alone does not provide produced-water demand, injectivity, compatible bottomhole pressures or well geometry. Choose user profiles or the separately identified demonstration.');
 if(source==='demo'){
  if(!demo?.inputs?.planningFixture)return blocked('The synthetic scenario is preparing or has invalid controls. Resolve the original planning inputs first.');
  try{
   const fixture=demo.inputs.planningFixture;
   const detail=planningDetails(fixture,freezeForecast(fixture.actuals,fixture.cutoff,fixture.actualsId));
   if(JSON.stringify(detail)!==JSON.stringify(demo.outputs.planningDetails))return blocked('Acceptance blocker: demonstration demand does not match its frozen history and schedules. Recalculate the original case.');
   demo.inputs.injectors.forEach(validateInjector);
   return {ready:true,reasons:[],demand:{id:fixture.id,origin:'synthetic',content:'synthetic histories + assumed schedules',monthly:detail.monthly.map(r=>({month:r.month,demandBbl:r.demandBbl})),evidence:evidenceSnapshot(demo)},wells:structuredClone(demo.inputs.injectors)};
  }catch(error){return blocked(`Synthetic input check: ${error.message}`);}
 }
 if(source==='sample'){
  if(!sample?.injectors?.length)return blocked('Load the sample case first (Start → Try it with sample data).');
  if(!demo?.inputs?.planningFixture)return blocked('The synthetic sample producers are preparing. Try again in a moment.');
  if(demo.inputs.planningFixtureSha256!==sample.producerFixtureSha256)return blocked('The synthetic producer schedule changed after the sample loaded. Reload the sample case to restore it.');
  try{
   const fixture=demo.inputs.planningFixture;
   const detail=planningDetails(fixture,freezeForecast(fixture.actuals,fixture.cutoff,fixture.actualsId));
   if(JSON.stringify(detail)!==JSON.stringify(demo.outputs.planningDetails))return blocked('Acceptance blocker: sample producer demand does not match its frozen history and schedules. Reload the sample case.');
   sample.injectors.forEach(validateInjector);
   return {ready:true,reasons:[],demand:{id:`${sample.caseId} · ${fixture.id}`,origin:'sample',content:'synthetic producer histories + assumed schedules',monthly:detail.monthly.map(r=>({month:r.month,demandBbl:r.demandBbl})),evidence:evidenceSnapshot({sampleCaseId:sample.caseId,sampleSha256:sample.sha256,derivedInputs:derivedInputs(sample),derivedInputsNote:'Values as loaded from the sample case. The values used are in inputs.wells; where they differ, the field was changed on the page and these assumptions do not apply.',planningFixtureSha256:demo.inputs.planningFixtureSha256,planningFixture:fixture,planningDetails:detail})},wells:structuredClone(sample.injectors)};
  }catch(error){return blocked(`Sample input check: ${error.message}`);}
 }
 if(source!=='user'||!imported)return blocked('Confirm user history and injector profiles, then apply a valid training cutoff and analysis period. Changes to a file, worksheet, mapping, units or period invalidate the case.');
 const gates=presentationGates(imported),reasons=[];
 if(!imported.inputs.history||!gates.forecast?.ready)reasons.push('Confirm a produced-water history with at least three positive training months per producer and a valid cutoff.',...(gates.forecast?.reasons??[]));
 for(const key of ['groupedPlanning','capacity'])if(!gates[key]?.ready)reasons.push(...gates[key].reasons);
 if(reasons.length)return blocked(...new Set(reasons));
 const profiles=[imported.inputs.history,imported.inputs.schedule,imported.inputs.injectors].filter(Boolean);
 const kinds=[...new Set(profiles.flatMap(p=>p.rows.map(r=>r.lineage.source.assertedKind)))];
 const wells=imported.inputs.injectorIds.map(id=>imported.inputs.injectors.rows.find(r=>r.disposition==='accepted'&&r.value?.profile==='injector'&&r.value.id===id)?.value);
 try{wells.forEach(validateInjector);}catch(error){return blocked(`Injector profile: ${error.message}`);}
 return {ready:true,reasons:[],demand:{id:profiles.map(p=>p.id).join(' + '),origin:'user',content:kinds.join(' + '),monthly:imported.monthly.map(r=>({month:r.month,demandBbl:r.demandBbl})),evidence:evidenceSnapshot(imported)},wells:structuredClone(wells)};
}
