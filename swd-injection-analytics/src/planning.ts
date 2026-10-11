import { capacity, type Injector } from './engineering.js';

export const FIXTURE_ID='synthetic-water/seed-417/v1';
export const MODEL_VERSION='exponential-log-fit/1';
export const CUTOFF='2025-12';
export type WaterRow={producerId:string;month:string;rateStbd:number;volumeBbl:number;kind:'synthetic'};
export type FrozenForecast={id:string;cutoff:string;modelVersion:string;trainingMonths:readonly string[];models:readonly {producerId:string;logRate:number;monthlySlope:number}[]};
/** Validate calculation outputs at their boundary, without inspecting source metadata. */
export function finiteCalculation(value:number,label:string):number {
  if(!Number.isFinite(value))throw new Error(`${label} cannot be represented as a finite number`);
  return value;
}
export function sumFinite(values:readonly number[],label:string):number {
  return values.reduce((sum,value)=>finiteCalculation(sum+finiteCalculation(value,label),label),0);
}
/** Preserve normal multiplication order; rescale overflow, zero underflow or subnormal intermediates. */
export function finiteProduct(factors:readonly number[],label:string):number {
  for(const value of factors){finiteCalculation(value,label);if(value<0)throw new Error(`${label} factors must be nonnegative`);}
  if(factors.includes(0))return 0;
  let ordinary=1,subnormalIntermediate=false;
  for(const value of factors){ordinary*=value;if(ordinary!==0&&ordinary<2**-1022)subnormalIntermediate=true;}
  if(Number.isFinite(ordinary)&&ordinary!==0&&!subnormalIntermediate)return ordinary;
  // Binary mantissa/exponent accumulation avoids Infinity*small and premature
  // underflow without imposing physical caps or rounding through logarithms.
  let mantissa=1,exponent=0;
  for(const value of factors){
    const power=Math.min(1023,Math.floor(Math.log2(value)));
    mantissa*=value/2**power;exponent+=power;
    while(mantissa>=2){mantissa/=2;exponent++;}
    while(mantissa<1){mantissa*=2;exponent--;}
  }
  const result=exponent>=-1022?mantissa*2**exponent:(mantissa*2**(exponent+1074))*Number.MIN_VALUE;
  return finiteCalculation(result,label);
}
export function forecastModelRate(model:FrozenForecast['models'][number],elapsed:number):number {
  finiteCalculation(model.logRate,`Forecast ${model.producerId} log rate`);finiteCalculation(model.monthlySlope,`Forecast ${model.producerId} monthly slope`);finiteCalculation(elapsed,'Forecast elapsed months');
  return finiteCalculation(Math.exp(model.logRate+model.monthlySlope*elapsed),`Forecast ${model.producerId} rate (STB/day)`);
}
export function variancePercent(varianceBbl:number,forecastBbl:number):number|null {
  finiteCalculation(varianceBbl,'Reconciliation variance (bbl)');finiteCalculation(forecastBbl,'Reconciliation forecast (bbl)');
  if(forecastBbl===0)return null;
  const numerator=100*varianceBbl;
  return finiteCalculation(Number.isFinite(numerator)?numerator/forecastBbl:(varianceBbl/forecastBbl)*100,'Reconciliation variance percent');
}
export function monthIndex(month:string) {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error(`Invalid reporting month: ${month}`);
  const [year,number]=month.split('-').map(Number);return year*12+number-1;
}
export function monthAt(index:number) {return `${Math.floor(index/12)}-${String(index%12+1).padStart(2,'0')}`;}
export function daysInMonth(month:string) {const n=monthIndex(month);return new Date(Date.UTC(Math.floor(n/12),n%12+1,0)).getUTCDate();}
export function monthsBetween(first:string,last:string) {const a=monthIndex(first),b=monthIndex(last);if(b<a || b-a>1200) throw new Error('Invalid month range');return Array.from({length:b-a+1},(_,i)=>monthAt(a+i));}
function random(seed:number) {let s=seed>>>0;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};}
/** Independent fixed actual series is generated once and never rewritten by forecast/schedule controls. */
export function syntheticActuals(seed=417):WaterRow[] {
  const rng=random(seed),months=monthsBetween('2025-01','2026-12');
  return ['FICTIONAL-PROD-01','FICTIONAL-PROD-02'].flatMap((producerId,p)=>months.map((month,i)=>{
    const rateStbd=(p?3400:3800)*Math.exp(-0.016*i)*(1+(rng()-0.5)*0.12)*(i>=12?1.06:1);
    return {producerId,month,rateStbd,volumeBbl:rateStbd*daysInMonth(month),kind:'synthetic' as const};
  }));
}
export type ForecastObservation=Pick<WaterRow,'producerId'|'month'|'rateStbd'|'volumeBbl'>;
export function freezeForecast(actuals:ForecastObservation[],cutoff=CUTOFF,inputId=FIXTURE_ID):FrozenForecast {
  monthIndex(cutoff);
  const training=actuals.filter(r=>r.month<=cutoff);
  const models=[...new Set(training.map(r=>r.producerId))].sort().map(producerId=>{
    const rows=training.filter(r=>r.producerId===producerId).sort((a,b)=>a.month.localeCompare(b.month));
    if(rows.length<3 || rows.some(r=>!Number.isFinite(r.rateStbd)||r.rateStbd<=0) || new Set(rows.map(r=>r.month)).size!==rows.length) throw new Error('Forecast requires distinct positive training observations');
    const points=rows.map(r=>[monthIndex(r.month)-monthIndex(cutoff),Math.log(r.rateStbd)]);
    const n=points.length,sx=points.reduce((a,p)=>a+p[0],0),sy=points.reduce((a,p)=>a+p[1],0),sxx=points.reduce((a,p)=>a+p[0]*p[0],0),sxy=points.reduce((a,p)=>a+p[0]*p[1],0);
    const monthlySlope=(n*sxy-sx*sy)/(n*sxx-sx*sx);
    return Object.freeze({producerId,monthlySlope:finiteCalculation(monthlySlope,`Fitted ${producerId} monthly slope`),logRate:finiteCalculation((sy-monthlySlope*sx)/n,`Fitted ${producerId} log rate`)});
  });
  if(!models.length) throw new Error('No training observations');
  return Object.freeze({id:`forecast/${inputId}/${cutoff}/${MODEL_VERSION}`,cutoff,modelVersion:MODEL_VERSION,trainingMonths:Object.freeze([...new Set(training.map(r=>r.month))].sort()),models:Object.freeze(models)});
}
export function forecastRate(frozen:FrozenForecast,month:string) {
  const elapsed=monthIndex(month)-monthIndex(frozen.cutoff);
  return sumFinite(frozen.models.map(m=>forecastModelRate(m,elapsed)),'Aggregate forecast rate (STB/day)');
}
export function reconcile(forecastBbl:number,actualBbl:number) {
  if(!Number.isFinite(forecastBbl)||!Number.isFinite(actualBbl)||forecastBbl<0||actualBbl<0) throw new Error('Invalid reconciliation volumes');
  const varianceBbl=finiteCalculation(actualBbl-forecastBbl,'Reconciliation variance (bbl)');
  return {varianceBbl,variancePct:variancePercent(varianceBbl,forecastBbl)};
}
export function planningCase(frozen:FrozenForecast,actuals:WaterRow[],injectors:readonly Injector[],newWellStart='2026-04',expansionMonth='2026-08',expansionStbd=2000) {
  monthIndex(newWellStart);monthIndex(expansionMonth);
  if(!Number.isFinite(expansionStbd)||expansionStbd<0) throw new Error('Invalid assumed expansion');
  return monthsBetween('2026-01','2026-12').map(month=>{
    const days=daysInMonth(month),forecastStbd=forecastRate(frozen,month);
    const actualBbl=sumFinite(actuals.filter(r=>r.month===month).map(r=>r.volumeBbl),`${month} aggregate actual volume (bbl)`);
    const age=monthIndex(month)-monthIndex(newWellStart);
    const newDemandStbd=age<0?0:6000*Math.exp(-0.025*age);
    const demandStbd=finiteCalculation(forecastStbd+newDemandStbd,`${month} demand rate (STB/day)`);
    const baseCapacityStbd=sumFinite(injectors.map(i=>capacity(i).availableStbd),`${month} aggregate capacity (STB/day)`);
    // Expansion is an explicitly assumed additional AVAILABLE capacity after downtime.
    const availableStbd=finiteCalculation(baseCapacityStbd+(month>=expansionMonth?expansionStbd:0),`${month} available capacity (STB/day)`);
    const forecastBbl=finiteCalculation(forecastStbd*days,`${month} forecast volume (bbl)`),demandBbl=finiteCalculation(demandStbd*days,`${month} demand volume (bbl)`),capacityBbl=finiteCalculation(availableStbd*days,`${month} capacity volume (bbl)`);
    return {month,days,forecastStbd,forecastBbl,actualBbl,...reconcile(forecastBbl,actualBbl),newDemandStbd,demandStbd,demandBbl,availableStbd,capacityBbl,headroomBbl:finiteCalculation(capacityBbl-demandBbl,`${month} headroom (bbl)`),shortfallBbl:finiteCalculation(Math.max(0,demandBbl-capacityBbl),`${month} shortfall (bbl)`)};
  });
}

