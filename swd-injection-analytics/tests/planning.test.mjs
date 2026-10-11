import test from 'node:test';import assert from 'node:assert/strict';
import {syntheticActuals,freezeForecast,daysInMonth,planningCase,reconcile} from '../dist/planning.js';
import {INJECTORS} from '../dist/engineering.js';
test('Seeded histories, independent future holdout and frozen forecast',()=>{
  const actuals=syntheticActuals();assert.deepEqual(actuals,syntheticActuals());
  const frozen=freezeForecast(actuals);
  const altered=actuals.map(r=>r.month>'2025-12'?{...r,rateStbd:r.rateStbd*9,volumeBbl:r.volumeBbl*9}:r);
  assert.deepEqual(freezeForecast(altered),frozen);
  assert.ok(frozen.trainingMonths.every(m=>m<='2025-12'));
  assert.ok(Object.isFrozen(frozen.models));
});
test('Calendar month volumes, leap year and actual-minus-forecast',()=>{
  assert.equal(daysInMonth('2024-02'),29);assert.equal(daysInMonth('2026-02'),28);
  assert.deepEqual(reconcile(100,120),{varianceBbl:20,variancePct:20});
  assert.deepEqual(reconcile(0,10),{varianceBbl:10,variancePct:null});
  const a=syntheticActuals(),rows=planningCase(freezeForecast(a),a,INJECTORS);
  for(const r of rows){assert.equal(r.forecastBbl,r.forecastStbd*r.days);assert.equal(r.demandBbl,r.demandStbd*r.days);assert.equal(r.capacityBbl,r.availableStbd*r.days);assert.equal(r.actualBbl,a.filter(x=>x.month===r.month).reduce((s,x)=>s+x.volumeBbl,0));}
});
test('Schedule edits shift new demand without rewriting frozen base forecast or actuals; expansion timing',()=>{
  const a=syntheticActuals(),f=freezeForecast(a),early=planningCase(f,a,INJECTORS,'2026-04'),late=planningCase(f,a,INJECTORS,'2026-07');
  assert.ok(early[3].newDemandStbd>0);assert.equal(late[3].newDemandStbd,0);assert.equal(late[6].newDemandStbd,6000);
  for(let i=0;i<12;i++){assert.equal(early[i].forecastBbl,late[i].forecastBbl);assert.equal(early[i].actualBbl,late[i].actualBbl);}
  assert.equal(early[7].availableStbd-early[6].availableStbd,2000);
  const none=planningCase(f,a,INJECTORS.map(i=>({...i,availability:0})),'2026-04','2026-08',0);
  assert.ok(none.every(r=>r.availableStbd===0 && r.shortfallBbl===r.demandBbl));
});
