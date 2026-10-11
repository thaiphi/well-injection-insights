import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {brineProperties} from '../dist/engineering.js';

const reference=JSON.parse(readFileSync(new URL('../reference/pyrestoolbox-pvt/oracles.json',import.meta.url),'utf8'));
const close=(actual,expected,label)=>assert.ok(Math.abs(actual/expected-1)<1e-10,`${label}: ${actual} versus ${expected}`);

test('live adapter matches all 45 recorded source-library cases after mass ppm conversion',()=>{
 assert.equal(reference.cases.length,45);
 for(const expected of reference.cases){
  const row=brineProperties(expected.pressurePsia,expected.temperatureF,expected.salinityWtPercent*10000);
  for(const field of ['bwRbPerStb','viscosityCp','compressibilityPerPsi'])close(row[field],expected[field],field);
  close(row.densityLbPerFt3,expected.densityGPerCm3*1000/16.01846337396014,'density in lb/ft³');
 }
});

test('50000 NaCl mass ppm means five weight percent and retains explicit gas-free source identity',()=>{
 const row=brineProperties(3000,180,50000);
 assert.equal(row.pressurePsia,3000);assert.equal(row.temperatureF,180);assert.equal(row.salinityPpm,50000);assert.equal(row.salinityWtPercent,5);
 close(row.bwRbPerStb,1.022193888602115,'modern Bw anchor');close(row.viscosityCp,0.38886791322272063,'modern viscosity anchor');close(row.compressibilityPerPsi,0.000002771468936787059,'modern compressibility anchor');
 assert.match(row.salinityBasis,/NaCl.*mass.*ppm/i);assert.match(row.salinityBasis,/not mg\/L/i);assert.match(row.source,/pyResToolbox/i);assert.match(row.source,/gas.free/i);assert.match(row.source,/snapshot/i);
 for(const file of reference.provenance.files.filter(f=>f.name.endsWith('.py'))){assert.ok(row.source.includes(file.name));assert.ok(row.source.includes(file.sha256));}
 const fresh=brineProperties(3000,180,0),concentrated=brineProperties(3000,180,200000);
 assert.equal(fresh.salinityWtPercent,0);assert.equal(concentrated.salinityWtPercent,20);assert.ok(row.densityLbPerFt3>fresh.densityLbPerFt3);assert.ok(concentrated.densityLbPerFt3>row.densityLbPerFt3);
});

test('live brine compresses with increasing absolute pressure instead of the legacy reversed Bw trend',()=>{
 for(const salinity of [0,50000,200000]){
  const rows=[100,1000,3000,6000,10000].map(p=>brineProperties(p,180,salinity));
  for(let i=1;i<rows.length;i++){assert.ok(rows[i].bwRbPerStb<rows[i-1].bwRbPerStb);assert.ok(rows[i].densityLbPerFt3>rows[i-1].densityLbPerFt3);assert.ok(rows[i].compressibilityPerPsi>0);}
 }
});

test('adapter rejects unsupported ranges and numeric coercion while accepting every bounded corner',()=>{
 for(const [p,t,s]of [[99,180,50000],[10001,180,50000],[3000,59,50000],[3000,251,50000],[3000,180,-1],[3000,180,200001],[NaN,180,50000],[3000,Infinity,50000],[3000,180,NaN],['3000',180,50000],[3000,'180',50000],[3000,180,'50000']])assert.throws(()=>brineProperties(p,t,s),`${p}/${t}/${s}`);
 for(const p of [100,10000])for(const t of [60,250])for(const s of [0,200000]){
  const row=brineProperties(p,t,s);for(const field of ['bwRbPerStb','densityLbPerFt3','viscosityCp','compressibilityPerPsi'])assert.ok(Number.isFinite(row[field])&&row[field]>0,`${field} at ${p}/${t}/${s}`);
 }
});
