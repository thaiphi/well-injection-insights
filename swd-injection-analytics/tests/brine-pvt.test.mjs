import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const engine=await import('../dist/brinePvt.js').catch(()=>({}));
const reference=JSON.parse(fs.readFileSync(new URL('../reference/pyrestoolbox-pvt/oracles.json',import.meta.url)));
const base={caseName:'Assumed NaCl brine',minPressurePsia:100,maxPressurePsia:10000,temperatureF:180,salinityWtPercent:5,points:5};
// Breaks caught: missing calculator, wrong port coefficients/units, silent range
// coercion, dropped endpoints, mutable input lineage and inconsistent exports.
test('brine sweep is an executable engineering feature',()=>assert.equal(typeof engine.buildBrineSweep,'function'));
test('browser brine calculation agrees with all four fresh installed-library property oracles',()=>{
 assert.equal(typeof engine.brineAtPressure,'function');
 for(const expected of reference.cases){
  const row=engine.brineAtPressure(expected.pressurePsia,expected.temperatureF,expected.salinityWtPercent);
  for(const field of ['bwRbPerStb','viscosityCp','compressibilityPerPsi'])assert.ok(Math.abs(row[field]/expected[field]-1)<1e-10,`${field}: ${JSON.stringify(expected)}`);
  assert.ok(Math.abs(row.densityKgPerM3/(expected.densityGPerCm3*1000)-1)<1e-10);
  assert.ok(Math.abs(row.densityLbPerFt3/(expected.densityGPerCm3*1000/16.01846337396014)-1)<1e-10);
 }
});
test('pressure grid includes both exact endpoints and pressure physically compresses gas-free brine',()=>{
 const result=engine.buildBrineSweep(base);
 assert.deepEqual(result.rows.map(r=>r.pressurePsia),[100,2575,5050,7525,10000]);
 assert.equal(result.rows.length,5);
 for(let i=1;i<result.rows.length;i++){
  assert.ok(result.rows[i].bwRbPerStb<result.rows[i-1].bwRbPerStb);
  assert.ok(result.rows[i].densityKgPerM3>result.rows[i-1].densityKgPerM3);
  assert.ok(result.rows[i].compressibilityPerPsi>0);
 }
});
test('temperature and salinity changes recalculate distinct fluid properties',()=>{
 const cold=engine.brineAtPressure(3000,60,0),hot=engine.brineAtPressure(3000,250,0),saline=engine.brineAtPressure(3000,250,20);
 assert.ok(cold.viscosityCp>hot.viscosityCp);assert.ok(saline.densityKgPerM3>hot.densityKgPerM3);assert.ok(saline.viscosityCp>hot.viscosityCp);
});
test('ambiguous or unsupported inputs never yield a sweep',()=>{
 for(const change of [{minPressurePsia:99},{maxPressurePsia:10001},{temperatureF:59},{temperatureF:251},{salinityWtPercent:-1},{salinityWtPercent:20.1},{points:1},{points:102},{points:2.5},{points:NaN},{temperatureF:Infinity},{temperatureF:'180'},{minPressurePsia:10000},{caseName:''}])assert.throws(()=>engine.buildBrineSweep({...base,...change}));
 assert.throws(()=>engine.brineAtPressure(0,180,5));
});
test('input assumptions, source hashes, units and actual source-snapshot identity accompany every result',()=>{
 const input={...base},result=engine.buildBrineSweep(input);input.temperatureF=250;
 assert.equal(result.inputs.temperatureF,180);assert.equal(result.provenance.inputOrigin,'user-entered assumptions');assert.equal(result.provenance.liveMcpCall,false);
 assert.equal(result.units.salinity,'NaCl wt%');assert.equal(result.units.pressure,'psia');
 assert.deepEqual(result.provenance.referenceFixture,{name:'oracles.json',sha256:createHash('sha256').update(fs.readFileSync(new URL('../reference/pyrestoolbox-pvt/oracles.json',import.meta.url))).digest('hex'),recordedAt:reference.provenance.recordedAt});
 for(const source of reference.provenance.files){
  const hash=createHash('sha256').update(fs.readFileSync(new URL('../reference/pyrestoolbox-pvt/'+source.name,import.meta.url))).digest('hex');
  assert.equal(hash,source.sha256);assert.equal(result.provenance.files.find(f=>f.name===source.name).sha256,hash);
 }
 assert.match(result.limitations.join(' '),/gas-free/i);assert.match(result.methods.compressibility,/Spivey/);
});
test('CSV export preserves every displayed value, input and source identity',()=>{
 const result=engine.buildBrineSweep(base),csv=engine.brineSweepCsv(result);
 assert.ok(csv.includes(result.provenance.files[0].sha256));assert.ok(csv.includes('NaCl wt%'));
 for(const row of result.rows)for(const value of Object.values(row))assert.ok(csv.includes(String(value)));
 const bad=structuredClone(result);bad.rows[0].bwRbPerStb=Infinity;assert.throws(()=>engine.brineSweepCsv(bad));
});

test('CSV case labels cannot become spreadsheet formulas and JSON retains the raw assumption',()=>{
 for(const caseName of ['=1+1','+1+1','-1+1','@SUM(1,2)','\t=1+1','\r=1+1','\n=1+1','  =1+1']){
  const result=engine.buildBrineSweep({...base,caseName}),csv=engine.brineSweepCsv(result);
  const escaped=caseName.replaceAll('"','""');
  assert.ok(csv.includes(`"metadata","case","'${escaped}"`));
  assert.equal(result.inputs.caseName,caseName);
  assert.equal(JSON.parse(JSON.stringify(result)).inputs.caseName,caseName);
 }
});
