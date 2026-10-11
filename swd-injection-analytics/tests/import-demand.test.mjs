import test from 'node:test';
import assert from 'node:assert/strict';
import {createSource,parseCsv} from '../dist/importProfile.js';
import {validateImport} from '../dist/importValidation.js';
import {analyzeImports} from '../dist/importAnalysis.js';
import {syntheticActuals} from '../dist/planning.js';
import {presentationGates,exportEvidence,tableCsv} from '../web/workspace-state.mjs';

const mappings={
 history:{profile:'history',columns:{producerId:'p',groupId:'g',month:'m',water:'q'},units:{water:'STB/day'},timeBasis:'calendar-day'},
 schedule:{profile:'schedule',columns:{producerId:'p',groupId:'g',startDate:'d',initialRate:'q',monthlyDecline:'k',availability:'a'},units:{initialRate:'STB/day',monthlyDecline:'fraction/month',availability:'fraction'}},
 injector:{profile:'injector',columns:{id:'id',injectivity:'j',reservoirPressure:'p',limitPressure:'l',reservoirBasis:'rb',limitBasis:'lb',reservoirDatum:'rd',limitDatum:'ld',operatingCeiling:'c',availability:'a'},units:{injectivity:'STB/day/psi',reservoirPressure:'psia',limitPressure:'psia',operatingCeiling:'STB/day',availability:'fraction'}}
};
async function imported(profile,csv){return validateImport(parseCsv(csv),await createSource(new TextEncoder().encode(csv),profile+'.csv',{origin:'user',assertedKind:profile==='history'?'synthetic':'assumed',reference:'Controlled demand regression, fictional inputs'}),{...mappings[profile],version:'demand-regression/1',confirmed:true});}
const historyCsv='p,g,m,q\nOLD,EXISTING,2025-10,100\nOLD,EXISTING,2025-11,100\nOLD,EXISTING,2025-12,100';
const scheduleCsv='p,g,d,q,k,a\nNEW,ADDITIONS,2026-02-15,20,0,1';
const injectorCsv='id,j,p,l,rb,lb,rd,ld,c,a\nI,5,2000,3500,bottomhole-absolute,bottomhole-absolute,D,D,50,1';
const period={cutoff:'2025-12',first:'2026-01',last:'2026-03'};
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);

test('history-only planning retains each existing forecast, with group and calendar-rate totals',async()=>{
 const history=await imported('history',historyCsv);
 const result=analyzeImports({...period,history,producerIds:['OLD']});
 assert.equal(result.readiness.groupedPlanning.ready,true);
 for(const [index,volume]of [3100,2800,3100].entries()){
  close(result.monthly[index].demandBbl,volume);close(result.groups[index].volumeBbl,volume);
  close(result.producerMonths[index].calendarDayRateStbd,100);
 }
 assert.equal(result.producerMonths[0].contribution,'frozen-forecast');
 assert.equal(result.producerMonths[0].forecastId,result.frozen.id);
 assert.equal(result.producerMonths[0].sourceRowIds.length,3);
 assert.equal(presentationGates(result).groupedPlanning.ready,true);
});

test('scheduled-only demand preserves pre-start zero and exact mid-month proration',async()=>{
 const schedule=await imported('schedule',scheduleCsv),injectors=await imported('injector',injectorCsv);
 const result=analyzeImports({...period,schedule,planningProducerIds:['NEW'],injectors,injectorIds:['I']});
 assert.equal(result.readiness.groupedPlanning.ready,true);
 assert.deepEqual(result.monthly.map(r=>r.demandBbl),[0,280,620]);
 assert.deepEqual(result.monthly.map(r=>r.shortfallBbl),[0,0,0]);
 assert.equal(result.producerMonths[1].activeDays,14);close(result.producerMonths[1].calendarDayRateStbd,10);
 assert.equal(result.producerMonths[1].contribution,'assumed-schedule');
 assert.deepEqual(result.producerMonths[1].sourceRowIds,[schedule.rows[0].id]);
});

test('combined portfolio sums existing forecasts plus distinct additions before capacity deficits',async()=>{
 const history=await imported('history',historyCsv),schedule=await imported('schedule',scheduleCsv),injectors=await imported('injector',injectorCsv);
 const result=analyzeImports({...period,history,schedule,injectors,producerIds:['OLD'],planningProducerIds:['NEW'],injectorIds:['I']});
 for(const [index,volume]of [3100,3080,3720].entries()){
  close(result.monthly[index].demandBbl,volume);
  close(result.groups.filter(r=>r.month===result.monthly[index].month).reduce((s,r)=>s+r.volumeBbl,0),volume);
 }
 for(const [i,deficit]of [1550,1680,2170].entries())close(result.monthly[i].shortfallBbl,deficit);
 assert.equal(presentationGates(result).comparison.ready,true);
 const exported=exportEvidence(result);close(exported.monthly[0].demandBbl,3100);
 assert.equal(exported.inputs.history.rows[0].lineage.source.origin,'user');
 assert.equal(exported.inputs.history.rows[0].lineage.source.assertedKind,'synthetic');
 assert.equal(exported.inputs.schedule.rows[0].lineage.source.assertedKind,'assumed');
 assert.equal(result.producerMonths.length,6);
});

test('seed417 plus April NEW and 50 STB/day capacity includes original January demand',async()=>{
 const csv='p,g,m,q\n'+syntheticActuals().map(r=>`${r.producerId},G,${r.month},${r.rateStbd}`).join('\n');
 const history=await imported('history',csv),schedule=await imported('schedule','p,g,d,q,k,a\nNEW,G,2026-04-01,6000,0.025,1'),injectors=await imported('injector',injectorCsv);
 const result=analyzeImports({...period,last:'2026-04',history,schedule,injectors,producerIds:['FICTIONAL-PROD-01','FICTIONAL-PROD-02'],planningProducerIds:['NEW'],injectorIds:['I']});
 // Independent recorded OLS anchor, plus hand arithmetic: Jan 31*50; April 30*6000.
 close(result.monthly[0].forecastBbl,180697.6360618436);
 close(result.monthly[0].demandBbl,180697.6360618436);
 assert.equal(result.monthly[0].availableCapacityBbl,1550);
 close(result.monthly[0].shortfallBbl,179147.6360618436);
 close(result.monthly[3].demandBbl,346068.8130260831);
 close(result.monthly[3].shortfallBbl,344568.8130260831);
 assert.equal(presentationGates(result).comparison.ready,true);
});

test('an existing forecast ID cannot also become a schedule, before or after its scheduled start',async()=>{
 const history=await imported('history',historyCsv);
 for(const start of ['2025-12-01','2026-01-15','2026-04-01','2027-01-01']){
  const schedule=await imported('schedule',`p,g,d,q,k,a\nOLD,EXISTING,${start},20,0,1`);
  const result=analyzeImports({...period,history,schedule,producerIds:['OLD'],planningProducerIds:['OLD']});
  assert.equal(result.readiness.forecast.ready,true);
  assert.equal(result.readiness.groupedPlanning.ready,false,start);
  assert.match(result.readiness.groupedPlanning.reasons.join(' '),/OLD.*(both|overlap|existing)/i);
  assert.equal(result.monthly[0].demandBbl,null);assert.equal(result.producerMonths.length,0);
 }
});

test('incomplete existing forecasts or ambiguous groups block total demand without blocking valid schedules alone',async()=>{
 for(const csv of [historyCsv.split('\n').slice(0,3).join('\n'),historyCsv.replace('OLD,EXISTING,2025-11','OLD,OTHER,2025-11')]){
  const history=await imported('history',csv),schedule=await imported('schedule',scheduleCsv);
  const result=analyzeImports({...period,history,schedule,producerIds:['OLD'],planningProducerIds:['NEW']});
  assert.equal(result.readiness.groupedPlanning.ready,false);assert.equal(result.monthly[0].demandBbl,null);
  assert.equal(analyzeImports({...period,history,schedule,producerIds:[],planningProducerIds:['NEW']}).monthly[1].demandBbl,280);
 }
});

test('zero schedule demand remains zero while overflowing demand is withheld with its readiness reason',async()=>{
 for(const [rate,availability]of [[0,1],[100,0]]){
  const schedule=await imported('schedule',`p,g,d,q,k,a\nZERO,G,2026-01-01,${rate},0,${availability}`);
  const result=analyzeImports({...period,schedule,planningProducerIds:['ZERO']});
  assert.deepEqual(result.monthly.map(r=>r.demandBbl),[0,0,0]);assert.equal(presentationGates(result).groupedPlanning.ready,true);
 }
 const schedule=await imported('schedule','p,g,d,q,k,a\nHUGE,G,2026-01-01,1e308,0,1');
 const overflow=analyzeImports({...period,schedule,planningProducerIds:['HUGE']});
 assert.equal(overflow.readiness.groupedPlanning.ready,false);assert.match(overflow.readiness.groupedPlanning.reasons.join(' '),/HUGE.*volume.*finite number/i);
 assert.ok(overflow.monthly.every(row=>row.demandBbl===null));assert.deepEqual(overflow.producerMonths,[]);assert.deepEqual(overflow.groups,[]);
 const valid=await imported('schedule','p,g,d,q,k,a\nHUGE,G,2026-01-01,100,0,1');
 const result=analyzeImports({...period,schedule:valid,planningProducerIds:['HUGE']});
 result.monthly[0].demandBbl=Infinity;
 assert.equal(presentationGates(result).groupedPlanning.ready,false);
 assert.equal(exportEvidence(result).monthly[0].demandBbl,null);
});

test('schedule edits and future actuals never change existing frozen demand',async()=>{
 const history=await imported('history',historyCsv+'\nOLD,EXISTING,2026-01,9999');
 const shifted=await imported('schedule',scheduleCsv.replace('2026-02-15','2026-03-15'));
 const result=analyzeImports({...period,history,schedule:shifted,producerIds:['OLD'],planningProducerIds:['NEW']});
 close(result.monthly[0].demandBbl,3100);close(result.monthly[1].demandBbl,2800);close(result.monthly[2].demandBbl,3440);
 assert.equal(result.monthly[0].actualBbl,309969);
 const exportRows=result.monthly.map(r=>[r.month,r.demandBbl,r.availableCapacityBbl,r.shortfallBbl]);
 const csv=tableCsv({historyInputId:history.id,scheduleInputId:shifted.id},['Month','Demand (bbl)','Capacity (bbl)','Deficit (bbl)'],exportRows);
 const metadata=parseCsv(csv.split('\r\n').slice(0,2).join('\n'));
 assert.equal(metadata.headers[1],history.id);assert.equal(metadata.rows[0].values[1],shifted.id);
 assert.equal(parseCsv(csv.slice(csv.indexOf('"Month"'))).rows[1].values[1],String(result.monthly[1].demandBbl));
});

test('current method labels cannot bypass missing, duplicated or inconsistent producer reconciliation',async()=>{
 const history=await imported('history',historyCsv),schedule=await imported('schedule',scheduleCsv);
 const valid=analyzeImports({...period,history,schedule,producerIds:['OLD'],planningProducerIds:['NEW']});
 assert.equal(presentationGates(valid).groupedPlanning.ready,true);
 for(const corrupt of [
  b=>b.producerMonths.splice(0,1),
  b=>b.producerMonths.push(structuredClone(b.producerMonths[0])),
  b=>b.monthly[0].demandBbl=0,
  b=>b.groups[0].volumeBbl=0,
  b=>b.producerMonths[0].sourceRowIds=['unrelated-source-row'],
  b=>b.producerMonths[0].calendarDayRateStbd=1
 ]){
  const bad=structuredClone(valid);corrupt(bad);
  assert.equal(presentationGates(bad).groupedPlanning.ready,false);
  const exported=exportEvidence(bad);assert.equal(exported.monthly[0].demandBbl,null);
  assert.equal(exported.producerMonths.length,0);assert.equal(exported.inputs.history.id,history.id);
 }
});

test('implicit schedule selection cannot silently discard a quarantined addition',async()=>{
 const history=await imported('history',historyCsv);
 const schedule=await imported('schedule',scheduleCsv+'\nBROKEN,ADDITIONS,2026-01-01,-100,0,1');
 const inferred=analyzeImports({...period,history,schedule,producerIds:['OLD']});
 assert.equal(inferred.readiness.groupedPlanning.ready,false);
 assert.equal(inferred.monthly[0].demandBbl,null);
 const excluded=analyzeImports({...period,history,schedule,producerIds:['OLD'],planningProducerIds:[]});
 assert.equal(excluded.readiness.groupedPlanning.ready,true);close(excluded.monthly[0].demandBbl,3100);
});
