import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv} from '../dist/importProfile.js';
import {validateImport} from '../dist/importValidation.js';
import {analyzeImports} from '../dist/importAnalysis.js';
import {presentationGates,exportEvidence} from '../web/workspace-state.mjs';

const source={name:'isolation.csv',sha256:'a'.repeat(64),origin:'user',assertedKind:'synthetic',reference:'Fictional numerical isolation regression'};
const mapping={
 history:{columns:{producerId:'p',groupId:'g',month:'m',water:'q'},units:{water:'STB/day'},timeBasis:'calendar-day'},
 schedule:{columns:{producerId:'p',groupId:'g',startDate:'d',initialRate:'q',monthlyDecline:'k',availability:'a'},units:{initialRate:'STB/day',monthlyDecline:'fraction/month',availability:'fraction'}},
 injector:{columns:{id:'i',injectivity:'j',reservoirPressure:'p',limitPressure:'l',reservoirBasis:'rb',limitBasis:'lb',reservoirDatum:'rd',limitDatum:'ld',operatingCeiling:'c',availability:'a'},units:{injectivity:'STB/day/psi',reservoirPressure:'psia',limitPressure:'psia',operatingCeiling:'STB/day',availability:'fraction'}}
};
function imported(profile,csv){const result=validateImport(parseCsv(csv),source,{...mapping[profile],profile,version:'isolation/1',confirmed:true});assert.equal(result.counts.quarantined,0);return result;}
const history=(rates=[100,100,100],actuals=['OLD,G,2026-01,110'])=>imported('history','p,g,m,q\n'+[...['2025-10','2025-11','2025-12'].map((month,i)=>`OLD,G,${month},${rates[i]}`),...actuals].join('\n'));
const schedule=rows=>imported('schedule','p,g,d,q,k,a\n'+rows.join('\n'));
const injectors=rows=>imported('injector','i,j,p,l,rb,lb,rd,ld,c,a\n'+rows.join('\n'));
const injector=(id,j=5,p=2000,l=3500,c=50)=>`${id},${j},${p},${l},bottomhole-absolute,bottomhole-absolute,D,D,${c},1`;
const period={cutoff:'2025-12',first:'2026-01',last:'2026-01'};
const close=(actual,want)=>assert.ok(Math.abs(actual-want)<1e-8,`${actual} != ${want}`);
const finite=value=>{if(typeof value==='number')assert.ok(Number.isFinite(value));else if(value&&typeof value==='object')Object.values(value).forEach(finite);};
function blocked(result,key,reason){assert.equal(result.readiness[key].ready,false);assert.match(result.readiness[key].reasons.join(' '),reason);}

test('schedule overflow withholds all demand while history, forecast, actuals and capacity survive',()=>{
 const result=analyzeImports({...period,history:history(),producerIds:['OLD'],schedule:schedule(['NEW,G,2026-01-01,1e307,0,1']),planningProducerIds:['NEW'],injectors:injectors([injector('I')]),injectorIds:['I']});
 blocked(result,'groupedPlanning',/NEW.*schedule volume.*finite/i);
 for(const key of ['history','forecast','reconciliation','capacity'])assert.equal(result.readiness[key].ready,true,key);
 assert.equal(result.descriptiveHistory.length,4);assert.ok(result.frozen);close(result.monthly[0].forecastBbl,3100);assert.equal(result.monthly[0].actualBbl,3410);close(result.monthly[0].varianceBbl,310);
 assert.equal(result.monthly[0].availableCapacityBbl,1550);assert.equal(result.monthly[0].demandBbl,null);assert.equal(result.monthly[0].shortfallBbl,null);assert.deepEqual(result.producerMonths,[]);assert.deepEqual(result.groups,[]);
 const exported=exportEvidence(result);close(exported.monthly[0].forecastBbl,3100);assert.equal(exported.monthly[0].demandBbl,null);finite(result.monthly);
});

test('later-month schedule overflow discards earlier partial demand and group totals',()=>{
 const result=analyzeImports({...period,last:'2026-03',schedule:schedule(['NEW,G,2026-02-15,1e307,0,1']),planningProducerIds:['NEW']});
 blocked(result,'groupedPlanning',/2026-03.*NEW.*finite/i);assert.deepEqual(result.monthly.map(r=>r.demandBbl),[null,null,null]);assert.deepEqual(result.producerMonths,[]);assert.deepEqual(result.groups,[]);
});

test('one numerical injector failure preserves other injector details and independent forecast demand',()=>{
 const result=analyzeImports({...period,history:history(),producerIds:['OLD'],injectors:injectors([injector('BAD',Number.MAX_VALUE,1,3),injector('GOOD')]),injectorIds:['BAD','GOOD']});
 blocked(result,'capacity',/BAD.*capacity.*finite/i);assert.equal(result.injectors[0].ready,false);assert.match(result.injectors[0].reason,/BAD.*finite/i);assert.equal(result.injectors[0].capacity,null);assert.equal(result.injectors[0].curve,null);
 assert.equal(result.injectors[1].ready,true);assert.equal(result.injectors[1].capacity.availableStbd,50);assert.equal(result.monthly[0].availableCapacityBbl,null);assert.equal(result.monthly[0].shortfallBbl,null);
 assert.equal(result.readiness.groupedPlanning.ready,true);close(result.monthly[0].demandBbl,3100);close(result.monthly[0].forecastBbl,3100);assert.equal(presentationGates(result).comparison.ready,false);finite(result.monthly);finite(result.injectors);
 const exported=exportEvidence(result);assert.ok(exported.injectors.every(i=>i.capacity===null&&i.curve===null));close(exported.monthly[0].demandBbl,3100);
});

test('reconciliation cumulative overflow preserves fitted forecast and complete demand',()=>{
 const rate=1e307/31,result=analyzeImports({...period,last:'2026-02',history:history([rate,rate,rate],[`OLD,G,2026-01,${1e308/31}`,`OLD,G,2026-02,${1e308/28}`]),producerIds:['OLD']});
 blocked(result,'reconciliation',/2026-02.*cumulative.*finite/i);assert.equal(result.readiness.forecast.ready,true);assert.equal(result.readiness.groupedPlanning.ready,true);assert.ok(result.frozen);
 for(const row of result.monthly){assert.ok(row.forecastBbl>0);assert.equal(row.demandBbl,row.forecastBbl);for(const key of ['actualBbl','varianceBbl','variancePct','cumulativeVarianceBbl'])assert.equal(row[key],null,key);}
 finite(result.monthly);const exported=exportEvidence(result);assert.ok(exported.monthly[0].demandBbl>0);assert.equal(exported.monthly[0].varianceBbl,null);
});

test('forecast overflow blocks selected existing demand without dropping it in favor of a valid schedule',()=>{
 const h=history([1e100,1e200,1e300],[]),s=schedule(['NEW,G,2026-01-01,20,0,1']);
 const result=analyzeImports({...period,history:h,producerIds:['OLD'],schedule:s,planningProducerIds:['NEW'],injectors:injectors([injector('I')]),injectorIds:['I']});
 blocked(result,'forecast',/OLD.*rate.*finite/i);blocked(result,'groupedPlanning',/Existing.*forecast.*finite/i);blocked(result,'reconciliation',/Forecast.*finite/i);
 assert.equal(result.readiness.history.ready,true);assert.equal(result.readiness.capacity.ready,true);assert.equal(result.frozen,null);assert.equal(result.monthly[0].forecastBbl,null);assert.equal(result.monthly[0].demandBbl,null);assert.deepEqual(result.producerMonths,[]);
 const independent=analyzeImports({...period,history:h,producerIds:[],schedule:s,planningProducerIds:['NEW']});assert.equal(independent.readiness.groupedPlanning.ready,true);assert.equal(independent.monthly[0].demandBbl,620);
});

test('finite individual schedule rows cannot leak overflowing group or portfolio totals',()=>{
 for(const group of ['G','H']){
  const result=analyzeImports({...period,history:history(),producerIds:['OLD'],schedule:schedule(['A,G,2026-01-01,3e306,0,1',`B,${group},2026-01-01,3e306,0,1`]),planningProducerIds:['A','B']});
  blocked(result,'groupedPlanning',/2026-01.*(group|aggregate demand).*finite/i);assert.equal(result.readiness.forecast.ready,true);assert.equal(result.readiness.reconciliation.ready,true);close(result.monthly[0].forecastBbl,3100);assert.equal(result.monthly[0].demandBbl,null);assert.deepEqual(result.producerMonths,[]);assert.deepEqual(result.groups,[]);finite(result.monthly);
 }
});

test('bad selected injector mapping never supplies partial aggregate capacity',()=>{
 const input=injectors([injector('GOOD')]);
 const result=analyzeImports({...period,history:history(),producerIds:['OLD'],injectors:input,injectorIds:['MISSING','GOOD']});
 blocked(result,'capacity',/MISSING/);assert.equal(result.injectors[0].ready,false);assert.equal(result.injectors[1].ready,true);assert.equal(result.monthly[0].availableCapacityBbl,null);close(result.monthly[0].demandBbl,3100);
});

test('curve overflow with finite injector capacity blocks only that injector and the capacity total',()=>{
 const result=analyzeImports({...period,history:history(),producerIds:['OLD'],injectors:injectors([injector('TINY-J',Number.MIN_VALUE),injector('GOOD')]),injectorIds:['TINY-J','GOOD']});
 blocked(result,'capacity',/TINY-J.*bottomhole pressure.*finite/i);assert.equal(result.injectors[0].capacity,null);assert.equal(result.injectors[0].curve,null);assert.equal(result.injectors[1].ready,true);assert.equal(result.monthly[0].availableCapacityBbl,null);assert.equal(result.readiness.forecast.ready,true);close(result.monthly[0].demandBbl,3100);finite(result.injectors);
});

test('later monthly capacity overflow withholds the earlier finite timeline without invalidating demand',()=>{
 const result=analyzeImports({...period,first:'2026-02',last:'2026-03',history:history(),producerIds:['OLD'],injectors:injectors([injector('I',6e306,1,2,6e306)]),injectorIds:['I']});
 blocked(result,'capacity',/2026-03.*capacity volume.*finite/i);assert.equal(result.injectors[0].ready,true);assert.deepEqual(result.monthly.map(r=>r.availableCapacityBbl),[null,null]);assert.deepEqual(result.monthly.map(r=>r.shortfallBbl),[null,null]);close(result.monthly[0].demandBbl,2800);close(result.monthly[1].demandBbl,3100);finite(result.monthly);
});

test('actual aggregate and variance percent overflow each preserve independent forecast and demand',()=>{
 const csv='p,g,m,q\n'+['OLD','OTHER'].flatMap(id=>['2025-10','2025-11','2025-12'].map(month=>`${id},G,${month},100`)).concat(['OLD','OTHER'].map(id=>`${id},G,2026-01,${1e308/31}`)).join('\n');
 const aggregate=analyzeImports({...period,history:imported('history',csv),producerIds:['OLD','OTHER']});
 blocked(aggregate,'reconciliation',/2026-01.*aggregate actual.*finite/i);close(aggregate.monthly[0].forecastBbl,6200);close(aggregate.monthly[0].demandBbl,6200);assert.equal(aggregate.monthly[0].actualBbl,null);assert.equal(aggregate.readiness.groupedPlanning.ready,true);
 const percent=analyzeImports({...period,history:history([1e-310,1e-310,1e-310]),producerIds:['OLD']});
 blocked(percent,'reconciliation',/variance percent.*finite/i);assert.equal(percent.readiness.forecast.ready,true);assert.equal(percent.readiness.groupedPlanning.ready,true);assert.ok(percent.monthly[0].forecastBbl>0);assert.equal(percent.monthly[0].actualBbl,null);assert.equal(percent.monthly[0].variancePct,null);finite(percent.monthly);
});
