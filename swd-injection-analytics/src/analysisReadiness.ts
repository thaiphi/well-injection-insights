import {type ImportResult,type HistoryInput,type ScheduleInput,type InjectorInput,validMonth} from './importValidation.js';
export type Gate={ready:boolean;reasons:string[];inputIds:string[]};
export type ReadinessInput={history?:ImportResult;schedule?:ImportResult;injectors?:ImportResult;producerIds?:string[];planningProducerIds?:string[];injectorIds?:string[];cutoff?:string;model?:string;holdoutMonths?:string[]};
/** Unspecified selection includes invalid source identities so no addition is dropped. */
export function selectedScheduleIds(input:ReadinessInput):string[]{
  return input.planningProducerIds??[...new Set(input.schedule?.rows.map(r=>{
    if(r.value?.profile==='schedule')return r.value.producerId;
    const raw=r.lineage.originalValues[r.lineage.originalHeaders.indexOf(r.lineage.mapping.columns.producerId)];
    return typeof raw==='string'?raw:'';
  })??[])];
}
/** SWD-14 gates are separate. Public hash/contract verification and extended wellbore benchmarks
 * are deliberately not inferred from a generic import or an asserted content kind. */
export function analysisReadiness(input:ReadinessInput) {
  const gate=(reasons:string[],inputIds:string[]=[]):Gate=>({ready:reasons.length===0,reasons,inputIds});
  const ids=input.producerIds??[];
  const selected=(result:ImportResult|undefined,profile:string,selection:string[])=>result?.profile===profile?result.rows.filter(r=>{
    const v=r.value;
    if(v)return selection.includes('producerId' in v?v.producerId:v.id);
    const field=profile==='injector'?'id':'producerId';
    const col=r.lineage.mapping.columns[field];
    const raw=r.lineage.originalValues[r.lineage.originalHeaders.indexOf(col)];
    return typeof raw!=='string'||!raw.trim()||selection.includes(raw);
  }):[];
  const rows=selected(input.history,'history',ids);
  const usable=rows.filter(r=>r.disposition==='accepted'&&r.value?.profile==='history');
  const histories=usable.map(r=>r.value as HistoryInput);
  const common:string[]=[];
  if(!ids.length || new Set(ids).size!==ids.length || ids.some(id=>!id.trim()))common.push('Select distinct producer identities');
  if(rows.some(r=>r.disposition!=='accepted')||input.history?.errors.length)common.push('Resolve quarantined history rows and mapping errors');
  for(const id of ids)if(!histories.some(r=>r.producerId===id&&r.rateStbd!==null))common.push(`Missing usable history for ${id}`);
  const history=gate([...common],usable.map(r=>r.id));
  const fit=common.filter(reason=>!reason.startsWith('Resolve quarantined'));
  const cutoff=input.cutoff??'';
  if(!validMonth(cutoff))fit.push('Declare a valid YYYY-MM cutoff');
  if(input.model!=='exponential-log-fit/1')fit.push('Select supported exponential-log-fit/1 model');
  const training=usable.filter(r=>(r.value as HistoryInput).month<=cutoff);
  if(input.history?.errors.length || rows.some(r=>{
    if(r.disposition==='accepted')return false;
    const column=r.lineage.mapping.columns.month;
    const month=r.lineage.originalValues[r.lineage.originalHeaders.indexOf(column)];
    return typeof month!=='string'||!validMonth(month)||month<=cutoff;
  }))fit.push('Resolve invalid training rows/mapping before fitting');
  for(const id of ids) {
    const h=training.map(r=>r.value as HistoryInput).filter(r=>r.producerId===id);
    if(h.length<3 || h.some(r=>r.rateStbd===null||r.rateStbd<=0) || new Set(h.map(r=>r.month)).size!==h.length)fit.push(`${id}: need at least three distinct positive training observations through cutoff`);
  }
  const forecast=gate(fit,training.map(r=>r.id));
  const reconciliationReasons=fit.length?['Forecast training is not ready']:[];
  const holdout=input.holdoutMonths??[];
  if(!holdout.length || new Set(holdout).size!==holdout.length || holdout.some(m=>!validMonth(m)||m<=cutoff))reconciliationReasons.push('Select distinct holdout months strictly after cutoff');
  for(const id of ids)for(const month of holdout)if(!histories.some(r=>r.producerId===id&&r.month===month&&r.volumeBbl!==null))reconciliationReasons.push(`Missing independent actual ${id}/${month}`);
  const actualRows=usable.filter(r=>holdout.includes((r.value as HistoryInput).month));
  // Planning selections identify additions, not replacements for the fitted portfolio.
  const planningIds=selectedScheduleIds(input);
  const schedules=selected(input.schedule,'schedule',planningIds);
  const planningReasons:string[]=[];
  if(!ids.length&&!planningIds.length)planningReasons.push('Select existing producers with valid forecasts or explicit scheduled additions');
  if(new Set(planningIds).size!==planningIds.length||planningIds.some(id=>!id.trim()))planningReasons.push('Select distinct nonempty planning producer identities');
  if(ids.length&&!forecast.ready)planningReasons.push(...forecast.reasons.map(reason=>`Existing-producer forecast is not ready: ${reason}`));
  for(const id of ids)if(new Set(histories.filter(h=>h.producerId===id).map(h=>h.groupId)).size!==1)planningReasons.push(`Resolve the existing producer/group mapping for ${id}`);
  if(planningIds.length&&(input.schedule?.errors.length || schedules.some(r=>r.disposition!=='accepted')))planningReasons.push('Resolve schedule mapping/row errors');
  for(const id of planningIds) {
    const s=schedules.find(r=>r.disposition==='accepted'&&(r.value as ScheduleInput)?.producerId===id)?.value as ScheduleInput|undefined;
    if(!s)planningReasons.push(`Missing explicit group/start/curve/availability schedule for ${id}`);
    else if(ids.includes(id))planningReasons.push(`${id}: both an existing forecast and a schedule select this producer; overlapping demand is unsupported. Use a distinct new-producer identity or deselect its schedule.`);
  }
  const injectorIds=input.injectorIds??[];
  const injectorRows=selected(input.injectors,'injector',injectorIds);
  const capacityReasons:string[]=[];
  if(!injectorIds.length||new Set(injectorIds).size!==injectorIds.length)capacityReasons.push('Select distinct injector identities');
  if(input.injectors?.errors.length || injectorRows.some(r=>r.disposition!=='accepted'))capacityReasons.push('Resolve injector mapping/pressure/unit errors');
  for(const id of injectorIds)if(!injectorRows.some(r=>r.disposition==='accepted'&&(r.value as InjectorInput)?.id===id))capacityReasons.push(`Missing compatible constant-J injector ${id}`);
  return {history,forecast,reconciliation:gate(reconciliationReasons,[...forecast.inputIds,...actualRows.map(r=>r.id)]),groupedPlanning:gate(planningReasons,[...forecast.inputIds,...schedules.map(r=>r.id)]),capacity:gate(capacityReasons,injectorRows.map(r=>r.id)),publicTrends:gate(['Requires independently validated pinned Explorer artifact; generic import assertions do not establish public verification']),wellbore:gate(['SWD-10 geometry, fluids and injection-direction benchmarks are outside this foundation'])};
}


