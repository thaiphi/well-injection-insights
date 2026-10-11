import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const engineDir=process.env.NUMERICAL_ENGINE_DIR??'dist';
const load=name=>import(pathToFileURL(resolve(engineDir,name+'.js')));
const engineering=await load('engineering'),planning=await load('planning'),fixtureEngine=await load('planningFixture'),imports=await load('importAnalysis');
const {parseCsv}=await load('importProfile'),{validateImport}=await load('importValidation');
const MAX=Number.MAX_VALUE,MIN=Number.MIN_VALUE,well=engineering.INJECTORS[0];
const overflow=/finite|represent|overflow/i;
function frozen(models=[{producerId:'P',logRate:0,monthlySlope:0}]){return {id:'boundary-forecast',cutoff:'2025-12',modelVersion:'exponential-log-fit/1',trainingMonths:['2025-10','2025-11','2025-12'],models};}
function fixture(models=frozen().models){return {schemaVersion:2,id:'boundary-fixture',actualsId:'boundary-actuals',generator:{seed:417,version:'boundary-test'},cutoff:'2025-12',groups:[{id:'G',label:'Boundary group'}],producers:models.map(m=>({id:m.producerId,groupId:'G',cohortId:'C',startMonth:'2025-01',kind:'synthetic'})),actuals:[],schedules:[]};}
function finiteFields(value){if(typeof value==='number')assert.ok(Number.isFinite(value),`Nonfinite calculation: ${value}`);else if(value&&typeof value==='object')for(const child of Object.values(value))finiteFields(child);}
const source={name:'boundary.csv',sha256:'a'.repeat(64),origin:'user',assertedKind:'synthetic',reference:'Numerical boundary test; not field observations'};
function importedHistory(rates,actuals=[]){
 const rows=rates.flatMap((rate,p)=>['2025-10','2025-11','2025-12'].map((month,i)=>`P${p},G,${month},${Array.isArray(rate)?rate[i]:rate}`));
 const result=validateImport(parseCsv('p,g,m,q\n'+[...rows,...actuals].join('\n')),source,{profile:'history',version:'boundary/1',confirmed:true,columns:{producerId:'p',groupId:'g',month:'m',water:'q'},units:{water:'STB/day'},timeBasis:'calendar-day'});
 assert.equal(result.counts.quarantined,0);return result;
}
function importedSchedules(rows){const result=validateImport(parseCsv('p,g,d,q,k,a\n'+rows.join('\n')),source,{profile:'schedule',version:'boundary/1',confirmed:true,columns:{producerId:'p',groupId:'g',startDate:'d',initialRate:'q',monthlyDecline:'k',availability:'a'},units:{initialRate:'STB/day',monthlyDecline:'fraction/month',availability:'fraction'}});assert.equal(result.counts.quarantined,0);return result;}
const window={cutoff:'2025-12',first:'2026-01',last:'2026-01'};
test('finite q and tiny J cannot emit infinite BHP or overflow its final pressure sum',()=>{
 assert.throws(()=>engineering.bottomholePressure({...well,injectivityStbdPerPsi:MIN},1),overflow);
 assert.throws(()=>engineering.bottomholePressure({...well,reservoirPsia:MAX,injectivityStbdPerPsi:1},MAX),overflow);
});
test('public pressure-limited capacity rejects unrepresentable J times pressure difference',()=>{
 assert.throws(()=>engineering.capacity({...well,reservoirPsia:1,limitPsia:3,injectivityStbdPerPsi:MAX}),overflow);
 assert.equal(engineering.capacity({...well,reservoirPsia:3,limitPsia:1,injectivityStbdPerPsi:MAX}).pressureLimitedStbd,0);
});
test('live brine adapter rejects pressures outside its bounded source-checked domain',()=>{
 assert.throws(()=>engineering.brineProperties(MAX,180,0),/pressure|10000|10,000/i);
 finiteFields(engineering.brineProperties(2500,200,0));
});
test('large representable curve grid avoids premature max-rate times index overflow',()=>{
 const rows=engineering.pressureRateCurve({...well,reservoirPsia:1,limitPsia:2,injectivityStbdPerPsi:MAX,operatingCeilingStbd:MAX},MAX,40);
 finiteFields(rows);assert.equal(rows.at(-1).rateStbd,MAX);assert.equal(rows.at(-1).bottomholePsia,2);assert.equal(rows.length,41);
});
test('forecast rejects per-model exponential overflow and invalid parameters even if masked by exp underflow',()=>{
 for(const model of [{logRate:1000,monthlySlope:0},{logRate:-Infinity,monthlySlope:0},{logRate:0,monthlySlope:-Infinity},{logRate:0,monthlySlope:NaN}])assert.throws(()=>planning.forecastRate(frozen([{producerId:'P',...model}]),'2026-01'),overflow);
});
test('finite per-producer forecast rates cannot overflow an aggregate silently',()=>{
 assert.throws(()=>planning.forecastRate(frozen(['P','Q'].map(producerId=>({producerId,logRate:Math.log(MAX),monthlySlope:0}))),'2026-01'),overflow);
});
test('variance percentage keeps mathematically finite values near Number.MAX_VALUE',()=>{
 assert.deepEqual(planning.reconcile(MAX/2,MAX),{varianceBbl:MAX/2,variancePct:100});
 assert.deepEqual(planning.reconcile(MAX,MAX/2),{varianceBbl:-MAX/2,variancePct:-50});
 assert.throws(()=>planning.reconcile(MIN,MAX),overflow);assert.deepEqual(planning.reconcile(0,MAX),{varianceBbl:MAX,variancePct:null});
});
test('planningCase guards calendar volume, actual sums and aggregate well capacity',()=>{
 assert.throws(()=>planning.planningCase(frozen([{producerId:'P',logRate:Math.log(1e307),monthlySlope:0}]),[],[well]),overflow);
 assert.throws(()=>planning.planningCase(frozen(),[{producerId:'P',month:'2026-01',rateStbd:1,volumeBbl:MAX,kind:'synthetic'},{producerId:'Q',month:'2026-01',rateStbd:1,volumeBbl:MAX,kind:'synthetic'}],[well]),overflow);
 const huge={...well,reservoirPsia:1,limitPsia:2,injectivityStbdPerPsi:MAX,operatingCeilingStbd:MAX,availability:1};
 assert.throws(()=>planning.planningCase(frozen(),[],[huge,{...huge,id:'Q'}]),overflow);
});
test('planning details reject individual calendar volume overflow before grouping',()=>{
 const f=frozen([{producerId:'P',logRate:Math.log(1e307),monthlySlope:0}]);assert.throws(()=>fixtureEngine.planningDetails(fixture(f.models),f,'2026-01','2026-01'),overflow);
});
test('planning details reject group and portfolio sums of finite producer volumes',()=>{
 const f=frozen(['P','Q'].map(producerId=>({producerId,logRate:Math.log(3e306),monthlySlope:0}))),data=fixture(f.models);
 assert.throws(()=>fixtureEngine.planningDetails(data,f,'2026-01','2026-01'),overflow);
 data.groups.push({id:'H',label:'Other group'});data.producers[1].groupId='H';assert.throws(()=>fixtureEngine.planningDetails(data,f,'2026-01','2026-01'),overflow);
});
test('planning details reject cumulative variance overflow with finite monthly values',()=>{
 const f=frozen([{producerId:'P',logRate:Math.log(1e307/31),monthlySlope:0}]),data=fixture(f.models);
 data.actuals=['2026-01','2026-02'].map(month=>({producerId:'P',month,rateStbd:1,volumeBbl:1e308,kind:'synthetic'}));
 assert.throws(()=>fixtureEngine.planningDetails(data,f,'2026-01','2026-02'),/cumulative.*finite|cumulative.*represent|cumulative.*overflow/i);
});
test('planning schedule zero availability and before-start output remain zero at extreme finite inputs',()=>{
 const data=fixture([]),f=frozen([]);data.producers=[{id:'NEW',groupId:'G',cohortId:'C',startMonth:'2026-02',kind:'assumed'}];
 data.schedules=[{producerId:'NEW',groupId:'G',cohortId:'C',startMonth:'2026-02',initialRateStbd:MAX,monthlyDecline:MAX,rampMonths:1,availabilityByMonth:{'2026-02':0},provenance:'assumed'}];
 const result=fixtureEngine.planningDetails(data,f,'2026-01','2026-03');finiteFields(result);assert.deepEqual(result.monthly.map(m=>m.demandBbl),[0,0,0]);
});
test('import schedule suppresses unavailable or before-start flow without Infinity times zero',()=>{
 const schedule=importedSchedules([`ZERO,G,2026-01-01,${MAX},0,0`,`FUTURE,G,2026-02-01,${MAX},0,1`]);
 const result=imports.analyzeImports({...window,schedule,planningProducerIds:['ZERO','FUTURE']});finiteFields(result.producerMonths);finiteFields(result.monthly);assert.equal(result.monthly[0].demandBbl,0);
});
test('import schedule preserves finite availability-adjusted volume despite overflowing intermediate calendar product',()=>{
 const schedule=importedSchedules(['NEW,G,2026-01-01,1e307,0,0.1']),result=imports.analyzeImports({...window,schedule,planningProducerIds:['NEW']});
 assert.ok(Math.abs(result.monthly[0].demandBbl/3.1e307-1)<1e-12);finiteFields(result.monthly);
});
test('import analysis withholds unrepresentable schedule and fitted forecast volumes independently',()=>{
 const schedule=importedSchedules(['NEW,G,2026-01-01,1e307,0,1']),demand=imports.analyzeImports({...window,schedule,planningProducerIds:['NEW']});
 assert.equal(demand.readiness.groupedPlanning.ready,false);assert.match(demand.readiness.groupedPlanning.reasons.join(' '),/NEW.*volume.*finite/i);assert.equal(demand.monthly[0].demandBbl,null);assert.deepEqual(demand.producerMonths,[]);
 const history=importedHistory([[1e100,1e200,1e300]]),forecast=imports.analyzeImports({...window,history,producerIds:['P0']});
 assert.equal(forecast.readiness.history.ready,true);assert.equal(forecast.readiness.forecast.ready,false);assert.match(forecast.readiness.forecast.reasons.join(' '),/P0.*finite/i);assert.equal(forecast.monthly[0].forecastBbl,null);assert.equal(forecast.monthly[0].demandBbl,null);assert.equal(forecast.frozen,null);
});
test('import group and monthly totals cannot overflow from individually finite rows',()=>{
 const history=importedHistory([3e306,3e306]),result=imports.analyzeImports({...window,history,producerIds:['P0','P1']});
 assert.equal(result.readiness.forecast.ready,false);assert.match(result.readiness.forecast.reasons.join(' '),/aggregate forecast volume.*finite/i);assert.equal(result.readiness.groupedPlanning.ready,false);assert.equal(result.monthly[0].forecastBbl,null);assert.equal(result.monthly[0].demandBbl,null);assert.deepEqual(result.groups,[]);
});
test('import capacity aggregate and monthly volume reject overflow independently',()=>{
 const mapping={profile:'injector',version:'boundary/1',confirmed:true,columns:{id:'i',injectivity:'j',reservoirPressure:'p',limitPressure:'l',reservoirBasis:'rb',limitBasis:'lb',reservoirDatum:'rd',limitDatum:'ld',operatingCeiling:'c',availability:'a'},units:{injectivity:'STB/day/psi',reservoirPressure:'psia',limitPressure:'psia',operatingCeiling:'STB/day',availability:'fraction'}};
 const build=rows=>validateImport(parseCsv('i,j,p,l,rb,lb,rd,ld,c,a\n'+rows.join('\n')),source,mapping);
 const row=(id,rate,availability=1)=>`${id},${rate},1,2,bottomhole-absolute,bottomhole-absolute,D,D,${rate},${availability}`;
 const aggregate=build([row('A',MAX),row('B',MAX)]);assert.equal(aggregate.counts.quarantined,0);const sum=imports.analyzeImports({...window,injectors:aggregate,injectorIds:['A','B']});
 assert.equal(sum.readiness.capacity.ready,false);assert.match(sum.readiness.capacity.reasons.join(' '),/aggregate capacity.*finite/i);assert.equal(sum.monthly[0].availableCapacityBbl,null);assert.ok(sum.injectors.every(i=>i.ready));
 const monthly=build([row('A',1e307)]),volume=imports.analyzeImports({...window,injectors:monthly,injectorIds:['A']});assert.equal(volume.readiness.capacity.ready,false);assert.match(volume.readiness.capacity.reasons.join(' '),/capacity volume.*finite/i);assert.equal(volume.monthly[0].availableCapacityBbl,null);
 const unavailable=build([row('A',1e307,0)]);assert.equal(imports.analyzeImports({...window,injectors:unavailable,injectorIds:['A']}).monthly[0].availableCapacityBbl,0);
});
test('zero availability cannot mask non-finite calculated active calendar days',()=>{
 const schedule=importedSchedules(['ZERO,G,2026-01-01,100,0,0']);schedule.rows[0].value.startDate='2026-01-xx';
 const result=imports.analyzeImports({...window,schedule,planningProducerIds:['ZERO']});assert.equal(result.readiness.groupedPlanning.ready,false);assert.match(result.readiness.groupedPlanning.reasons.join(' '),/active.*finite|active.*represent/i);assert.equal(result.monthly[0].demandBbl,null);assert.deepEqual(result.producerMonths,[]);
});
test('unrelated source metadata is preserved without recursive numerical rejection',()=>{
 const history=importedHistory([100]);history.rows[0].lineage.source.diagnostic=Infinity;
 const result=imports.analyzeImports({...window,history,producerIds:['P0']});assert.equal(result.inputs.history.rows[0].lineage.source.diagnostic,Infinity);finiteFields(result.producerMonths);finiteFields(result.monthly);
});
test('import monthly reconciliation guards cumulative variance and preserves finite percent',()=>{
 const rate=1e307/31,history=importedHistory([rate],[`P0,G,2026-01,${1e308/31}`,`P0,G,2026-02,${1e308/28}`]);
 const one=imports.analyzeImports({...window,history,producerIds:['P0']});finiteFields(one.monthly);assert.ok(one.monthly[0].variancePct>800&&one.monthly[0].variancePct<1000);
 const result=imports.analyzeImports({...window,last:'2026-02',history,producerIds:['P0']});assert.equal(result.readiness.reconciliation.ready,false);assert.match(result.readiness.reconciliation.reasons.join(' '),/cumulative.*finite|cumulative.*represent|cumulative.*overflow/i);assert.equal(result.readiness.forecast.ready,true);assert.equal(result.readiness.groupedPlanning.ready,true);assert.ok(result.monthly.every(r=>r.varianceBbl===null&&r.cumulativeVarianceBbl===null));finiteFields(result.monthly);
});
test('shared finiteCalculation validates only the requested numeric output',()=>{
 assert.equal(typeof planning.finiteCalculation,'function');assert.equal(planning.finiteCalculation(MAX,'test output'),MAX);assert.throws(()=>planning.finiteCalculation(Infinity,'test output'),/test output.*finite|test output.*represent/i);
});
test('stable finite product rescues overflow and underflow intermediates without physical caps',()=>{
 assert.equal(planning.finiteProduct([MAX,2,0.5],'product'),MAX);
 assert.ok(Math.abs(planning.finiteProduct([MIN,0.5,MAX],'product')/(MIN*MAX/2)-1)<1e-12);
 assert.equal(planning.finiteProduct([MAX,31,0],'product'),0);
 assert.throws(()=>planning.finiteProduct([MAX,2],'product'),overflow);
});
test('stable product avoids precision loss in nonzero subnormal intermediates',()=>{
 const expected=(MIN*MAX)*1.5;
 assert.equal(planning.finiteProduct([MIN,1.5,MAX],'subnormal product'),expected);
});
test('ordinary engineering anchors, forecast, schedule and reconciliation remain finite',()=>{
 assert.equal(engineering.bottomholePressure(well,5000),3000);assert.equal(engineering.bottomholePressure({...well,injectivityStbdPerPsi:2.5},5000),4000);assert.equal(engineering.capacity(well).pressureLimitedStbd,7500);assert.equal(engineering.capacity({...well,injectivityStbdPerPsi:2.5}).pressureLimitedStbd,3750);
 const data=fixtureEngine.planningFixture(),f=planning.freezeForecast(data.actuals);finiteFields(planning.planningCase(f,data.actuals,engineering.INJECTORS));finiteFields(fixtureEngine.planningDetails(data,f));assert.deepEqual(planning.reconcile(100,120),{varianceBbl:20,variancePct:20});
});
