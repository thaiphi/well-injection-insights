import {analysisReadiness,selectedScheduleIds,type ReadinessInput} from './analysisReadiness.js';
import {type HistoryInput,type ScheduleInput,type InjectorInput} from './importValidation.js';
import {freezeForecast,monthIndex,monthsBetween,daysInMonth,finiteCalculation,finiteProduct,sumFinite,forecastModelRate,forecastRate,variancePercent} from './planning.js';
import {capacity,pressureRateCurve} from './engineering.js';
/** Calculations consume validated typed records, never content assertions as verification.
 * Demand includes frozen existing producers plus distinct scheduled additions.
 * Schedules never rewrite the fitted forecasts or independent actuals. */
export function analyzeImports(input:ReadinessInput&{first:string;last:string}) {
 const snapshot=structuredClone(input),periods=monthsBetween(input.first,input.last),cutoff=input.cutoff??'';
 monthIndex(cutoff);if(input.first<=cutoff)throw Error('Analysis periods must follow the declared training cutoff');
 const readiness=analysisReadiness({...snapshot,model:snapshot.model??'exponential-log-fit/1',holdoutMonths:periods});
 const ids=input.producerIds??[],planningIds=selectedScheduleIds(input);
 const histories=(input.history?.rows.flatMap(r=>r.value?.profile==='history'&&ids.includes(r.value.producerId)?[r.value]:[])??[]).sort((a,b)=>a.month.localeCompare(b.month)||a.producerId.localeCompare(b.producerId));
 const schedules=input.schedule?.rows.flatMap(r=>r.value?.profile==='schedule'&&planningIds.includes(r.value.producerId)?[r.value]:[])??[];
 const block=(key:keyof typeof readiness,reason:string)=>{readiness[key].ready=false;readiness[key].reasons.push(reason);};
 // Each calculation publishes all requested periods together. Failed calculations
 // retain input lineage and reasons, never earlier partial rows or totals.
 const calculate=<T>(key:keyof typeof readiness,label:string,operation:()=>T):T|null=>{
  try{return operation();}catch(error){block(key,`${label} calculation failed: ${error instanceof Error?error.message:String(error)}`);return null;}
 };
 const forecast=readiness.forecast.ready?calculate('forecast','Forecast',()=>{
  const frozen=freezeForecast(histories.filter(r=>r.month<=cutoff).map(r=>({producerId:r.producerId,month:r.month,rateStbd:r.rateStbd!,volumeBbl:r.volumeBbl!})),cutoff,input.history!.id);
  const volumes=periods.map(month=>finiteCalculation(forecastRate(frozen,month)*daysInMonth(month),`${month} aggregate forecast volume (bbl)`));
  return {frozen,volumes};
 }):null;
 const frozen=forecast?.frozen??null;
 if(!readiness.forecast.ready&&ids.length){
  const reason=readiness.forecast.reasons.join('; ');
  block('reconciliation',`Forecast is not ready: ${reason}`);
  block('groupedPlanning',`Existing-producer forecast is not ready: ${reason}`);
 }
 const planning=readiness.groupedPlanning.ready?calculate('groupedPlanning','Grouped planning',()=>{
 const producerMonths=periods.flatMap(month=>{
  const days=daysInMonth(month);
  const existing=(frozen?.models??[]).map(model=>{
   const training=input.history!.rows.filter(r=>r.disposition==='accepted'&&r.value?.profile==='history'&&r.value.producerId===model.producerId&&r.value.month<=cutoff);
   const groupId=(training[0].value as HistoryInput).groupId;
   const calendarDayRateStbd=forecastModelRate(model,monthIndex(month)-monthIndex(cutoff));
   return {producerId:model.producerId,groupId,month,activeDays:days,days,volumeBbl:finiteCalculation(calendarDayRateStbd*days,`${month} ${model.producerId} forecast volume (bbl)`),calendarDayRateStbd,contribution:'frozen-forecast' as const,forecastId:frozen!.id,sourceRowIds:training.map(r=>r.id)};
  });
  const added=schedules.map((s:ScheduleInput)=>{
  const age=monthIndex(month)-monthIndex(s.startDate.slice(0,7)),days=daysInMonth(month),activeDays=finiteCalculation(age<0?0:age===0?days-Number(s.startDate.slice(8))+1:days,`${month} ${s.producerId} active calendar days`);
  const volumeBbl=activeDays===0||s.availability===0||s.initialRateStbd===0?0:finiteProduct([s.initialRateStbd,Math.exp(-s.monthlyDecline*Math.max(0,age)),activeDays,s.availability],`${month} ${s.producerId} schedule volume (bbl)`);
  return {producerId:s.producerId,groupId:s.groupId,month,activeDays,days,volumeBbl,calendarDayRateStbd:finiteCalculation(volumeBbl/days,`${month} ${s.producerId} calendar rate (STB/day)`),contribution:'assumed-schedule' as const,forecastId:null,sourceRowIds:input.schedule!.rows.filter(r=>r.disposition==='accepted'&&r.value?.profile==='schedule'&&r.value.producerId===s.producerId).map(r=>r.id)};
  });
  return [...existing,...added];
 });
 const groupIds=[...new Set(producerMonths.map(r=>r.groupId))];
 const groups=periods.flatMap(month=>groupIds.map(groupId=>({groupId,month,volumeBbl:sumFinite(producerMonths.filter(r=>r.month===month&&r.groupId===groupId).map(r=>r.volumeBbl),`${month} group ${groupId} volume (bbl)`)})));
 const volumes=periods.map(month=>sumFinite(producerMonths.filter(r=>r.month===month).map(r=>r.volumeBbl),`${month} aggregate demand volume (bbl)`));
 return {producerMonths,groups,volumes};
 }):null;
 const producerMonths=planning?.producerMonths??[],groups=planning?.groups??[];
 const injectorResults=(input.injectorIds??[]).map(id=>{
  const row=input.injectors?.rows.find(r=>r.disposition==='accepted'&&r.value?.profile==='injector'&&r.value.id===id);
  if(!row||row.value?.profile!=='injector')return {id,ready:false,reason:'Resolve this injector mapping/pressure/unit/identity issue',capacity:null,curve:null,sourceRowId:null};
  const injector=row.value as InjectorInput;
  const result=calculate('capacity',`Injector ${id}`,()=>({capacity:capacity(injector),curve:pressureRateCurve(injector)}));
  return result?{id,ready:true,reason:null,...result,sourceRowId:row.id}:{id,ready:false,reason:readiness.capacity.reasons.at(-1)!,capacity:null,curve:null,sourceRowId:row.id};
 });
 const capacityVolumes=readiness.capacity.ready?calculate('capacity','Capacity timeline',()=>periods.map(month=>finiteCalculation(sumFinite(injectorResults.map(r=>r.capacity!.availableStbd),`${month} aggregate capacity (STB/day)`)*daysInMonth(month),`${month} capacity volume (bbl)`))):null;
 const reconciliation=calculate('reconciliation','Reconciliation',()=>{
 let cumulativeVarianceBbl:number|null=0;
 return periods.map((month,index)=>{
  const forecastBbl=forecast?.volumes[index]??null;
  const actuals=ids.map(id=>histories.find(r=>r.producerId===id&&r.month===month));
  const actualBbl=!ids.length||actuals.some(r=>!r||r.volumeBbl===null)?null:sumFinite(actuals.map(r=>r!.volumeBbl!),`${month} aggregate actual volume (bbl)`);
  const varianceBbl=actualBbl===null||forecastBbl===null?null:finiteCalculation(actualBbl-forecastBbl,`${month} variance (bbl)`);
  cumulativeVarianceBbl=cumulativeVarianceBbl===null||varianceBbl===null?null:finiteCalculation(cumulativeVarianceBbl+varianceBbl,`${month} cumulative variance (bbl)`);
  return {actualBbl,varianceBbl,variancePct:varianceBbl===null?null:variancePercent(varianceBbl,forecastBbl!),cumulativeVarianceBbl};
 });
 });
 const monthly=periods.map((month,index)=>{
  const days=daysInMonth(month),forecastBbl=forecast?.volumes[index]??null,demandBbl=planning?.volumes[index]??null,availableCapacityBbl=capacityVolumes?.[index]??null;
  const shortfallBbl=demandBbl===null||availableCapacityBbl===null?null:finiteCalculation(Math.max(0,demandBbl-availableCapacityBbl),`${month} shortfall (bbl)`);
  return {month,days,forecastBbl,...(reconciliation?.[index]??{actualBbl:null,varianceBbl:null,variancePct:null,cumulativeVarianceBbl:null}),demandBbl,availableCapacityBbl,shortfallBbl};
 });
 return {schemaVersion:1,methodVersion:'validated-import-analysis/2',inputs:{history:snapshot.history??null,schedule:snapshot.schedule??null,injectors:snapshot.injectors??null,producerIds:ids,planningProducerIds:planningIds,injectorIds:input.injectorIds??[],cutoff,first:input.first,last:input.last},provenance:{outputs:'calculated',inputs:'Acquisition origin and unverified content assertions retained separately in every source row',forecastTraining:'Only selected positive distinct observations through cutoff; future actuals excluded',schedule:'Existing demand uses frozen per-producer forecasts; distinct scheduled additions use declared curves, availability and active calendar days. Existing/scheduled identity overlap is blocked; no field calibration.',pressure:'Compatible absolute bottomhole pressures within each injector; no surface-pressure conversion'},readiness,descriptiveHistory:histories as HistoryInput[],frozen,producerMonths,groups,injectors:injectorResults,monthly};
}

