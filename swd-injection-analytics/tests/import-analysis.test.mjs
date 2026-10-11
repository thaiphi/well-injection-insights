import test from 'node:test';import assert from 'node:assert/strict';
import {createSource,parseCsv} from '../dist/importProfile.js';import {validateImport} from '../dist/importValidation.js';
const a=await import('../dist/importAnalysis.js').catch(()=>({}));
async function history(last='') {
 const csv='p,g,m,q\nP,G,2025-10,100\nP,G,2025-11,100\nP,G,2025-12,100'+last;
 const source=await createSource(new TextEncoder().encode(csv),'synthetic.csv',{origin:'user',assertedKind:'synthetic',reference:'fictional constant-rate educational sample'});
 return validateImport(parseCsv(csv),source,{profile:'history',version:'m/1',confirmed:true,columns:{producerId:'p',groupId:'g',month:'m',water:'q'},units:{water:'STB/day'},timeBasis:'calendar-day'});
}
test('imported analyses calculate independently without relabeling synthetic upload as measured',async()=>{
 assert.equal(typeof a.analyzeImports,'function');const input=await history('\nP,G,2026-01,110');const result=a.analyzeImports({history:input,producerIds:['P'],cutoff:'2025-12',first:'2026-01',last:'2026-02'});
 assert.ok(Math.abs(result.monthly[0].forecastBbl-3100)<1e-8);assert.equal(result.monthly[0].actualBbl,3410);assert.ok(Math.abs(result.monthly[0].varianceBbl-310)<1e-8);assert.equal(result.monthly[1].actualBbl,null);assert.equal(result.monthly[1].varianceBbl,null);
 assert.equal(result.provenance.outputs,'calculated');assert.equal(result.inputs.history.rows[0].lineage.source.origin,'user');assert.equal(result.inputs.history.rows[0].lineage.source.assertedKind,'synthetic');
});
test('insufficient history blocks fit only; valid descriptive rows remain inspectable',async()=>{
 const input=await history();input.rows=input.rows.slice(0,2);const result=a.analyzeImports({history:input,producerIds:['P'],cutoff:'2025-12',first:'2026-01',last:'2026-01'});
 assert.equal(result.readiness.forecast.ready,false);assert.equal(result.descriptiveHistory.length,2);assert.equal(result.monthly[0].forecastBbl,null);
});
test('explicit schedule start dates prorate calendar volumes and preserve zero availability',async()=>{
 const csv='p,g,d,q,k,a\nNEW,G,2026-02-15,100,0,1\nZERO,G,2026-02-01,100,0,0';
 const source=await createSource(new TextEncoder().encode(csv),'assumed.csv',{origin:'user',assertedKind:'assumed',reference:'fictional schedule'});
 const schedule=validateImport(parseCsv(csv),source,{profile:'schedule',version:'s/1',confirmed:true,columns:{producerId:'p',groupId:'g',startDate:'d',initialRate:'q',monthlyDecline:'k',availability:'a'},units:{initialRate:'STB/day',monthlyDecline:'fraction/month',availability:'fraction'}});
 const result=a.analyzeImports({schedule,planningProducerIds:['NEW','ZERO'],cutoff:'2025-12',first:'2026-02',last:'2026-02'});
 assert.equal(result.readiness.groupedPlanning.ready,true);assert.equal(result.monthly[0].demandBbl,1400);assert.equal(result.groups[0].volumeBbl,1400);assert.equal(result.producerMonths.find(r=>r.producerId==='ZERO').volumeBbl,0);
});

