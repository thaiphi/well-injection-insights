import test from 'node:test';import assert from 'node:assert/strict';
import {syntheticActuals,freezeForecast} from '../dist/planning.js';
const f=await import('../dist/planningFixture.js').catch(()=>({}));
test('planning fixture preserves seed417 actuals and provides stable group and input identities',()=>{
 assert.equal(typeof f.planningFixture,'function');const fixture=f.planningFixture();
 assert.deepEqual(fixture.actuals,syntheticActuals());assert.equal(fixture.actualsId,'synthetic-water/seed-417/v1');assert.equal(fixture.generator.seed,417);
 assert.equal(new Set(fixture.producers.map(p=>p.id)).size,3);
});
test('declared ramp, decline, calendar volume and monthly downtime independently match anchors',()=>{
 const fixture=f.planningFixture('2026-01');fixture.schedules[0]={...fixture.schedules[0],initialRateStbd:1000,monthlyDecline:0,rampMonths:2,availabilityByMonth:{'2026-02':0.5}};
 const rows=f.planningDetails(fixture,freezeForecast(fixture.actuals),'2026-01','2026-03');
 const added=rows.producerMonths.filter(r=>r.producerId==='FICTIONAL-NEW-01');
 assert.deepEqual(added.map(r=>r.rateStbd),[500,500,1000]);assert.deepEqual(added.map(r=>r.volumeBbl),[15500,14000,31000]);
});
test('one producer start shifts only its demand; group totals and independent actuals remain correct',()=>{
 const early=f.planningFixture('2026-04'),late=f.planningFixture('2026-07'),frozen=freezeForecast(early.actuals);
 const a=f.planningDetails(early,frozen),b=f.planningDetails(late,frozen);
 for(const row of a.producerMonths.filter(r=>r.contribution==='frozen-forecast'))assert.deepEqual(row,b.producerMonths.find(x=>x.producerId===row.producerId&&x.month===row.month));
 assert.equal(b.producerMonths.find(r=>r.producerId==='FICTIONAL-NEW-01'&&r.month==='2026-04').rateStbd,0);
 for(const month of a.monthly){const sum=a.groups.filter(g=>g.month===month.month).reduce((s,g)=>s+g.volumeBbl,0);assert.ok(Math.abs(sum-month.demandBbl)<1e-8);}
 assert.deepEqual(a.monthly.map(r=>r.actualBbl),b.monthly.map(r=>r.actualBbl));
});
test('invalid/missing producer group identities, schedules and unknown models cannot drop demand',()=>{
 for(const change of [x=>x.producers[0].groupId='UNKNOWN',x=>x.producers.push(x.producers[0]),x=>x.schedules[0].rampMonths=0,x=>x.schedules[0].availabilityByMonth={'2026-01':2}]){
  const fixture=f.planningFixture();change(fixture);assert.throws(()=>f.planningDetails(fixture,freezeForecast(fixture.actuals)));
 }
 const fixture=f.planningFixture(),frozen=freezeForecast(fixture.actuals);assert.throws(()=>f.planningDetails(fixture,{...frozen,models:[...frozen.models,{producerId:'UNKNOWN',logRate:1,monthlySlope:0}]}));
});
