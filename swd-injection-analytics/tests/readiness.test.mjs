import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticActuals} from '../dist/planning.js';
const p=await import('../dist/importProfile.js').catch(()=>({}));
const v=await import('../dist/importValidation.js').catch(()=>({}));
const a=await import('../dist/analysisReadiness.js').catch(()=>({}));
const mapping={version:'m/1',confirmed:true,profile:'history',columns:{producerId:'p',groupId:'g',month:'m',water:'q'},units:{water:'STB/day'},timeBasis:'calendar-day'};
async function input(rows=syntheticActuals()) {
 const csv='p,g,m,q\n'+rows.map(r=>`${r.producerId},G,${r.month},${r.rateStbd??''}`).join('\n');
 return v.validateImport(p.parseCsv(csv),await p.createSource(new TextEncoder().encode(csv),'synthetic.csv',{origin:'synthetic',assertedKind:'synthetic',reference:'synthetic-water/seed-417/v1'}),mapping);
}
test('readiness API exists',()=>assert.equal(typeof a.analysisReadiness,'function'));
test('readiness separates forecast training, holdout completeness and public/engineering gates',async()=>{
 const result=await input();const options={producerIds:['FICTIONAL-PROD-01','FICTIONAL-PROD-02'],cutoff:'2025-12',model:'exponential-log-fit/1',holdoutMonths:['2026-01','2026-02']};
 const r=a.analysisReadiness({history:result,...options});
 assert.equal(r.history.ready,true);assert.equal(r.forecast.ready,true);assert.equal(r.reconciliation.ready,true);
 assert.equal(r.publicTrends.ready,false);assert.equal(r.capacity.ready,false);assert.equal(r.wellbore.ready,false);assert.equal(r.groupedPlanning.ready,true);
 const altered=await input(syntheticActuals().map(x=>x.month>'2025-12'?{...x,rateStbd:x.rateStbd*99}:x));
 const changed=a.analysisReadiness({history:altered,...options}).forecast; assert.equal(changed.ready,r.forecast.ready); assert.deepEqual(changed.reasons,r.forecast.reasons); assert.notDeepEqual(changed.inputIds,r.forecast.inputIds); assert.equal(changed.inputIds.length,24);
 const missing=await input(syntheticActuals().filter(x=>!(x.producerId==='FICTIONAL-PROD-02'&&x.month==='2026-02')));
 const incomplete=a.analysisReadiness({history:missing,...options});assert.equal(incomplete.forecast.ready,true);assert.equal(incomplete.reconciliation.ready,false);
 assert.ok(incomplete.reconciliation.reasons.some(s=>s.includes('FICTIONAL-PROD-02/2026-02')));
});
test('zeros remain descriptive but cannot meet positive exponential-fit minimum; missing actuals do not become zero',async()=>{
 const zero=await input([{producerId:'P',month:'2025-01',rateStbd:0},{producerId:'P',month:'2025-02',rateStbd:0},{producerId:'P',month:'2025-03',rateStbd:0}]);
 const r=a.analysisReadiness({history:zero,producerIds:['P'],cutoff:'2025-03',model:'exponential-log-fit/1',holdoutMonths:['2025-04']});
 assert.equal(r.history.ready,true);assert.equal(r.forecast.ready,false);assert.equal(r.reconciliation.ready,false);
});
test('unknown producers, invalid cutoff/model and unresolved duplicate rows block affected readiness',async()=>{
 const result=await input();
 assert.equal(a.analysisReadiness({history:result,producerIds:['UNKNOWN'],cutoff:'2025-12',model:'exponential-log-fit/1'}).forecast.ready,false);
 for(const options of [{cutoff:'12/2025',model:'exponential-log-fit/1'},{cutoff:'2025-12',model:'unknown'}]) assert.equal(a.analysisReadiness({history:result,producerIds:['FICTIONAL-PROD-01'],...options}).forecast.ready,false);
 const dup=await input([...syntheticActuals(),syntheticActuals()[0]]);
 assert.equal(a.analysisReadiness({history:dup,producerIds:['FICTIONAL-PROD-01'],cutoff:'2025-12',model:'exponential-log-fit/1'}).forecast.ready,false);
});

test('unrelated producer errors and invalid holdout do not block selected valid training',async()=>{
 const base=syntheticActuals();
 const result=await input([...base,{producerId:'UNRELATED',month:'2025-01',rateStbd:-1},{producerId:'FICTIONAL-PROD-01',month:'2027-01',rateStbd:-1}]);
 const r=a.analysisReadiness({history:result,producerIds:['FICTIONAL-PROD-01'],cutoff:'2025-12',model:'exponential-log-fit/1',holdoutMonths:['2027-01']});
 assert.equal(r.forecast.ready,true);assert.equal(r.reconciliation.ready,false);
});
test('constant-J readiness is independent of planning and preserves individually valid pressure datums',async()=>{
 const csv='id,j,p,l,rb,lb,rd,ld,c,a\nFICTIONAL-A,5,2000,3500,bottomhole-absolute,bottomhole-absolute,depth-A,depth-A,9000,0\nFICTIONAL-B,2.5,2000,3500,bottomhole-absolute,bottomhole-absolute,depth-B,depth-B,5000,1';
 const mapping={profile:'injector',version:'i/1',confirmed:true,columns:{id:'id',injectivity:'j',reservoirPressure:'p',limitPressure:'l',reservoirBasis:'rb',limitBasis:'lb',reservoirDatum:'rd',limitDatum:'ld',operatingCeiling:'c',availability:'a'},units:{injectivity:'STB/day/psi',reservoirPressure:'psia',limitPressure:'psia',operatingCeiling:'STB/day',availability:'fraction'}};
 const injectors=v.validateImport(p.parseCsv(csv),await p.createSource(new TextEncoder().encode(csv),'injectors.csv',{origin:'assumed',assertedKind:'assumed',reference:'fictional-presets'}),mapping);
 const r=a.analysisReadiness({injectors,injectorIds:['FICTIONAL-A','FICTIONAL-B']});assert.equal(r.capacity.ready,true);assert.equal(r.capacity.inputIds.length,2);assert.equal(r.forecast.ready,false);
 const invalid=v.validateImport(p.parseCsv(csv.replace('depth-A,depth-A','depth-A,wrong')),await p.createSource(new TextEncoder().encode(csv),'invalid.csv',{origin:'user',assertedKind:'assumed',reference:'malformed-preset'}),mapping);
 assert.equal(a.analysisReadiness({injectors:invalid,injectorIds:['FICTIONAL-A']}).capacity.ready,false);
 assert.equal(a.analysisReadiness({injectors:invalid,injectorIds:['FICTIONAL-B']}).capacity.ready,true);
});
test('grouped-planning readiness includes existing forecasts, requires selected additions and blocks identity overlap',async()=>{
 const h=await input();const csv='p,g,d,q,k,a\nNEW-01,G,2026-04-01,6000,0.025,0\nNEW-02,G,2026-07-01,4000,0.025,1';
 const mapping={profile:'schedule',version:'s/1',confirmed:true,columns:{producerId:'p',groupId:'g',startDate:'d',initialRate:'q',monthlyDecline:'k',availability:'a'},units:{initialRate:'STB/day',monthlyDecline:'fraction/month',availability:'fraction'}};
 const source=await p.createSource(new TextEncoder().encode(csv),'schedule.csv',{origin:'assumed',assertedKind:'assumed',reference:'fictional-schedule'});
 const schedule=v.validateImport(p.parseCsv(csv),source,mapping);
 const options={history:h,schedule,producerIds:['FICTIONAL-PROD-01','FICTIONAL-PROD-02'],planningProducerIds:['NEW-01','NEW-02'],cutoff:'2025-12',model:'exponential-log-fit/1'};
 assert.equal(a.analysisReadiness(options).groupedPlanning.ready,true);
 assert.equal(a.analysisReadiness({...options,planningProducerIds:['NEW-01','MISSING']}).groupedPlanning.ready,false);
 const conflict=v.validateImport(p.parseCsv(csv.replace('NEW-01,G','FICTIONAL-PROD-01,G')),source,mapping);
 assert.equal(a.analysisReadiness({...options,schedule:conflict,planningProducerIds:['FICTIONAL-PROD-01','NEW-02']}).groupedPlanning.ready,false);
});
