import {syntheticActuals,FIXTURE_ID,CUTOFF,monthIndex,monthsBetween,daysInMonth,finiteCalculation,finiteProduct,sumFinite,forecastModelRate,variancePercent,type WaterRow,type FrozenForecast} from './planning.js';
export type ProducerSchedule={producerId:string;groupId:string;cohortId:string;startMonth:string;initialRateStbd:number;monthlyDecline:number;rampMonths:number;availabilityByMonth:Record<string,number>;provenance:'assumed'};
export type PlanningFixture={schemaVersion:2;id:string;actualsId:string;generator:{seed:number;version:string};cutoff:string;groups:{id:string;label:string}[];producers:{id:string;groupId:string;cohortId:string;startMonth:string;kind:'synthetic'|'assumed'}[];actuals:WaterRow[];schedules:ProducerSchedule[]};
/** v2 adds inspectable metadata without replacing synthetic-water/seed-417/v1 actuals. */
export function planningFixture(newProducerStart='2026-04'):PlanningFixture {
 monthIndex(newProducerStart);
 return {schemaVersion:2,id:'planning/seed-417/v2',actualsId:FIXTURE_ID,generator:{seed:417,version:'seed-417/v1'},cutoff:CUTOFF,
  groups:[{id:'FICTIONAL-GROUP-A',label:'Fictional group A'},{id:'FICTIONAL-GROUP-B',label:'Fictional group B'}],
  producers:[{id:'FICTIONAL-PROD-01',groupId:'FICTIONAL-GROUP-A',cohortId:'FICTIONAL-EXISTING',startMonth:'2025-01',kind:'synthetic'},{id:'FICTIONAL-PROD-02',groupId:'FICTIONAL-GROUP-B',cohortId:'FICTIONAL-EXISTING',startMonth:'2025-01',kind:'synthetic'},{id:'FICTIONAL-NEW-01',groupId:'FICTIONAL-GROUP-A',cohortId:'FICTIONAL-DEVELOPMENT',startMonth:newProducerStart,kind:'assumed'}],actuals:syntheticActuals(),
  schedules:[{producerId:'FICTIONAL-NEW-01',groupId:'FICTIONAL-GROUP-A',cohortId:'FICTIONAL-DEVELOPMENT',startMonth:newProducerStart,initialRateStbd:6000,monthlyDecline:0.025,rampMonths:1,availabilityByMonth:{},provenance:'assumed'}]};
}
export function planningDetails(fixture:PlanningFixture,frozen:FrozenForecast,first='2026-01',last='2026-12') {
 const periods=monthsBetween(first,last),groupIds=new Set(fixture.groups.map(g=>g.id)),producers=new Map(fixture.producers.map(p=>[p.id,p]));
 if(groupIds.size!==fixture.groups.length||producers.size!==fixture.producers.length||fixture.producers.some(p=>!p.id||!p.groupId||!p.cohortId||!groupIds.has(p.groupId)))throw Error('Missing, duplicate or unknown producer/group identity');
 const modeled=new Set(frozen.models.map(m=>m.producerId));
 if(modeled.size!==frozen.models.length||frozen.models.some(m=>!producers.has(m.producerId)||!Number.isFinite(m.logRate)||!Number.isFinite(m.monthlySlope)))throw Error('Unknown or invalid fitted producer');
 const scheduled=new Set<string>();
 for(const s of fixture.schedules){
  monthIndex(s.startMonth);const p=producers.get(s.producerId);
  if(!p||p.groupId!==s.groupId||p.cohortId!==s.cohortId||modeled.has(s.producerId)||scheduled.has(s.producerId)||!Number.isFinite(s.initialRateStbd)||s.initialRateStbd<0||!Number.isFinite(s.monthlyDecline)||s.monthlyDecline<0||!Number.isInteger(s.rampMonths)||s.rampMonths<1)throw Error('Invalid or conflicting producer schedule');
  scheduled.add(s.producerId);
  for(const [m,v] of Object.entries(s.availabilityByMonth)){monthIndex(m);if(!Number.isFinite(v)||v<0||v>1)throw Error('Monthly availability must be a fraction');}
 }
 if(fixture.producers.some(p=>!modeled.has(p.id)&&!scheduled.has(p.id)))throw Error('Producer has no model or declared schedule; demand cannot be dropped');
 const producerMonths=periods.flatMap(month=>{
  const days=daysInMonth(month),base=frozen.models.map(model=>{
   const p=producers.get(model.producerId)!,observations=fixture.actuals.filter(r=>r.producerId===p.id&&r.month===month);
   if(observations.length>1)throw Error('Conflicting independent actuals');
   const actualBbl=observations.length?observations[0].volumeBbl:null;
   if(actualBbl!==null&&(!Number.isFinite(actualBbl)||actualBbl<0))throw Error('Invalid independent actual');
   const rateStbd=forecastModelRate(model,monthIndex(month)-monthIndex(frozen.cutoff));
   return {producerId:p.id,groupId:p.groupId,cohortId:p.cohortId,month,days,rateStbd,volumeBbl:finiteCalculation(rateStbd*days,`${month} ${p.id} forecast volume (bbl)`),actualBbl,contribution:'frozen-forecast' as const};
  });
  const added=fixture.schedules.map(s=>{
   const age=monthIndex(month)-monthIndex(s.startMonth),availability=s.availabilityByMonth[month]??1;
   const rateStbd=age<0||availability===0||s.initialRateStbd===0?0:finiteProduct([s.initialRateStbd,Math.exp(-s.monthlyDecline*age),Math.min(1,(age+1)/s.rampMonths),availability],`${month} ${s.producerId} schedule rate (STB/day)`);
   return {producerId:s.producerId,groupId:s.groupId,cohortId:s.cohortId,month,days,rateStbd,volumeBbl:finiteCalculation(rateStbd*days,`${month} ${s.producerId} schedule volume (bbl)`),actualBbl:null,contribution:'assumed-schedule' as const};
  });return [...base,...added];
 });
 const groups=periods.flatMap(month=>fixture.groups.map(g=>({groupId:g.id,month,volumeBbl:sumFinite(producerMonths.filter(r=>r.month===month&&r.groupId===g.id).map(r=>r.volumeBbl),`${month} group ${g.id} volume (bbl)`)})));
 let cumulativeVarianceBbl:number|null=0;
 const monthly=periods.map(month=>{
  const rows=producerMonths.filter(r=>r.month===month),base=rows.filter(r=>r.contribution==='frozen-forecast');
  const actualBbl=base.some(r=>r.actualBbl===null)?null:sumFinite(base.map(r=>r.actualBbl!),`${month} aggregate actual volume (bbl)`),forecastBbl=sumFinite(base.map(r=>r.volumeBbl),`${month} aggregate forecast volume (bbl)`),demandBbl=sumFinite(rows.map(r=>r.volumeBbl),`${month} aggregate demand volume (bbl)`);
  const varianceBbl=actualBbl===null?null:finiteCalculation(actualBbl-forecastBbl,`${month} variance (bbl)`);
  cumulativeVarianceBbl=cumulativeVarianceBbl===null||varianceBbl===null?null:finiteCalculation(cumulativeVarianceBbl+varianceBbl,`${month} cumulative variance (bbl)`);
  return {month,forecastBbl,actualBbl,demandBbl,varianceBbl,variancePct:varianceBbl===null?null:variancePercent(varianceBbl,forecastBbl),cumulativeVarianceBbl};
 });return {producerMonths,groups,monthly};
}
