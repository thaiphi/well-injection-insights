import test from 'node:test';
import assert from 'node:assert/strict';
import {INJECTORS,bottomholePressure,capacity,brineProperties,pressureRateCurve} from '../dist/engineering.js';
import {calculateWaterFVF,calculateBubblePointPressure} from '../dist/vendor/nexus/utils/pvt/correlations.js';
import {generateBlackOilTable} from '../dist/vendor/nexus/components/black-oil-tables/engine/generateBlackOilTable.js';

test('Independent constant-J examples: positive injection pressure and half-J sensitivity',()=>{
  assert.equal(bottomholePressure(INJECTORS[0],5000),3000);
  assert.equal(bottomholePressure(INJECTORS[1],5000),4000);
  assert.equal(capacity(INJECTORS[0]).pressureLimitedStbd,7500);
  assert.equal(capacity(INJECTORS[1]).pressureLimitedStbd,3750);
  assert.equal(capacity({...INJECTORS[0],availability:0}).availableStbd,0);
  assert.equal(capacity({...INJECTORS[0],limitPsia:1900}).pressureLimitedStbd,0);
  assert.equal(capacity({...INJECTORS[0],operatingCeilingStbd:4000,availability:0.5}).availableStbd,2000);
  assert.equal(pressureRateCurve(INJECTORS[0])[0].bottomholePsia,2000);
  assert.throws(()=>bottomholePressure(INJECTORS[0],-1));
  assert.throws(()=>capacity({...INJECTORS[0],injectivityStbdPerPsi:0}));
});
test('Carried Nexus pyResToolbox water FVF reference pressure sweep (original correlations.test.ts:1343)',()=>{
  for(const [psig,expected] of [[485.3,1.039264],[985.3,1.039856],[1485.3,1.040583],[1985.3,1.041444],[2485.3,1.042441],[2985.3,1.043573],[3985.3,1.046242],[4985.3,1.049450]]) assert.ok(Math.abs(calculateWaterFVF(psig,200)-expected)<0.000005,`${psig} psig`);
});
test('live gas-free brine adapter uses the source-checked NaCl mass-based calculation',()=>{
  const brine=brineProperties(3000,180,50000);
  assert.ok(Math.abs(brine.bwRbPerStb/1.022193888602115-1)<1e-10);
  assert.ok(Math.abs(brine.viscosityCp/0.38886791322272063-1)<1e-10);
  assert.ok(Math.abs(brine.compressibilityPerPsi/0.000002771468936787059-1)<1e-10);
  assert.equal(brine.salinityWtPercent,5);assert.match(brine.salinityBasis,/NaCl.*mass.*ppm/i);
  assert.ok(brineProperties(3000,180,100000).densityLbPerFt3>brine.densityLbPerFt3);
  assert.throws(()=>brineProperties(0,180,50000));
});
test('Carried Nexus bubble-point spreadsheet reference and complete black-oil table',()=>{
  assert.ok(Math.abs(calculateBubblePointPressure(1067,41,0.7117,160,'vasquez-beggs')-3629.97)<0.5);
  const table=generateBlackOilTable({temperature:200,api:35,gasGravity:0.7,totalGOR:500,pressureMin:25,pressureMax:4000,numRows:10},{pbCorrelation:'standing',rsMethod:'standing',boMethod:'standing',zMethod:'hall-yarborough',salinity:0});
  assert.ok(table.rows.every(r=>Object.values(r).every(v=>typeof v!=='number'||Number.isFinite(v))));
  assert.ok(table.rows.some(r=>r.pressure===table.bubblePointPressure));
  // Original hardcoded pyRT MCP 2026-04-16 oracle row at 25 psia; source tolerances retained.
  const row=table.rows.find(r=>r.pressure===25);
  assert.ok(Math.abs(row.bw/1.0373996984069147-1)<0.05);
  assert.ok(Math.abs(row.bo/1.0699107242476416-1)<0.07);
  assert.ok(Math.abs(row.waterViscosity/0.3023671094550609-1)<0.1);
});
test('structured absolute bottomhole pressure bases and per-calculation datums are enforced',()=>{
 for(const change of [i=>i.reservoirPressureBasis='surface-gauge',i=>i.limitPressureBasis='bottomhole-gauge',i=>i.limitDatum='another-depth',i=>delete i.reservoirDatum]){
  const input=structuredClone(INJECTORS[0]);change(input);assert.throws(()=>capacity(input));assert.throws(()=>bottomholePressure(input,1000));
 }
 const other={...INJECTORS[1],datum:'another-depth',reservoirDatum:'another-depth',limitDatum:'another-depth'};
 assert.equal(capacity(INJECTORS[0]).availableStbd+capacity(other).availableStbd,10125);
});
