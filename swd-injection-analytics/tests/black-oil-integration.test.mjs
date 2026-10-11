import test from 'node:test';import assert from 'node:assert/strict';
import {generateBlackOilTable} from '../dist/vendor/nexus/components/black-oil-tables/engine/generateBlackOilTable.js';
import {buildPressureArray} from '../dist/vendor/nexus/components/black-oil-tables/engine/pressureArray.js';
import {reconcilePbRsb} from '../dist/vendor/nexus/components/black-oil-tables/engine/pbRsbReconciliation.js';
const inputs={temperature:200,api:35,gasGravity:0.7,totalGOR:500,pressureMin:500,pressureMax:4000,numRows:10};
const config={pbCorrelation:'vasquez-beggs',rsMethod:'vasquez-beggs',boMethod:'vasquez-beggs',zMethod:'dak',viscosityMethod:'beggs-robinson',salinity:50000};
test('Preserved Nexus black-oil integration: viscosity tuning leaves water unchanged; explicit Pb and sorted pressure grid',()=>{
  const base=generateBlackOilTable(inputs,config),tuned=generateBlackOilTable(inputs,config,{visFrac:0.5});
  assert.ok(base.rows.length>=10&&base.rows.length<=11);
  assert.ok(base.rows.some(r=>r.pressure===base.bubblePointPressure));
  for(let i=0;i<base.rows.length;i++){
    const a=base.rows[i],b=tuned.rows[i];
    if(i)assert.ok(a.pressure>base.rows[i-1].pressure);
    assert.equal(a.isSaturated,a.pressure<base.bubblePointPressure);
    assert.equal(b.oilViscosity,a.oilViscosity*0.5);assert.equal(b.gasViscosity,a.gasViscosity*0.5);assert.equal(b.waterViscosity,a.waterViscosity);
  }
  const grid=buildPressureArray(25,4000,20,2500);assert.equal(grid.length,21);assert.equal(grid[0],25);assert.equal(grid.at(-1),4000);assert.ok(grid.includes(2500));
  assert.equal(buildPressureArray(25,4000,20,25).length,20);
});
test('Preserved Nexus Pb/Rsb reconciliation: scale direction and zero-GOR atmosphere reference',()=>{
  const base=reconcilePbRsb(500,35,0.7,200,'vasquez-beggs');
  assert.equal(base.rsbScale,1);
  for(const scale of [0.8,1.2]){
    const x=reconcilePbRsb(500,35,0.7,200,'vasquez-beggs',base.pb*scale);
    assert.equal(x.pb,base.pb*scale);assert.equal(x.rsb,500);assert.ok(Math.abs(x.rsbScale-scale)<0.05);
  }
  assert.equal(reconcilePbRsb(0,35,0.7,200,'vasquez-beggs').pb,14.7);
});
