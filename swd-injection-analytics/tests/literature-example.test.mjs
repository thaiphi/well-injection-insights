import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const engine = await import(pathToFileURL(resolve(process.env.LITERATURE_ENGINE_DIR ?? 'dist','literatureExample.js'))).catch(()=>({}));
const fixturePath = new URL('../data/scenarios/literature-example.json',import.meta.url);
const fixture = ()=>fs.readFileSync(fixturePath,'utf8');
const inputs = {skin:5,selectedRateBblPerDay:5000};
const near=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<=tolerance*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('published radial example is available as a separate calculation',()=>assert.equal(typeof engine.buildLiteratureExample,'function'));
test('independent SI and field conversion anchors preserve literal published coefficient',()=>{
 const r=engine.buildLiteratureExample(fixture(),inputs),p=r.selected;
 near(p.rateM3PerSecond,0.009200653641666667);
 near(p.baselinePressurePsi,4036.8341031789294);
 near(p.comparedPressurePsi,4944.118930278199);
 near(p.penaltyPsi,907.2848270992693);
 // Independent SI Darcy law with exact Darcy conversion: published rounded coefficient is distinct.
 const q=0.009200653641666667,k=0.256*9.869233e-13,h=4.572,mu=0.001;
 const exactPa=q*mu*(8.138756755695992+5)/(2*Math.PI*h*k);
 near((p.comparedPressurePsi-2560)*6894.757293168/exactPa,0.9869233);
 near(r.provenance.conversions.footToMeter,0.3048);
 assert.equal(r.provenance.method.publishedCoefficient,2e-6);
 assert.equal(r.provenance.pressureBasis,'reported psi; absolute/gauge unspecified; common formation datum');
});
test('zero flow has no pressure penalty and pressure increases with rate and assumed skin',()=>{
 const at=(q,s)=>engine.literaturePressurePoint(q,s);
 near(at(0,50).comparedPressurePsi,2560);near(at(0,50).penaltyPsi,0);
 for(const q of [2000,5000,10000]){near(at(q,0).penaltyPsi,0);assert.ok(at(q,10).comparedPressurePsi>at(q,5).comparedPressurePsi);}
 assert.ok(at(10000,5).comparedPressurePsi>at(5000,5).comparedPressurePsi);
 near(at(10000,5).penaltyPsi,2*at(5000,5).penaltyPsi);
 const r=engine.buildLiteratureExample(fixture(),{skin:0,selectedRateBblPerDay:7000});
 assert.deepEqual(r.rows.map(x=>x.rateBblPerDay),[2000,5000,7000,10000]);assert.equal(r.curve.length,11);
});
test('invalid numbers and out of domain values block calculation and fixture changes block source identity',()=>{
 for(const skin of [NaN,Infinity,-1,50.01,'5',null])assert.throws(()=>engine.buildLiteratureExample(fixture(),{...inputs,skin}));
 for(const selectedRateBblPerDay of [NaN,Infinity,-1,0,1999,10001,'5000',null])assert.throws(()=>engine.buildLiteratureExample(fixture(),{...inputs,selectedRateBblPerDay}));
 for(const q of [-1,NaN,Infinity,10001])assert.throws(()=>engine.literaturePressurePoint(q,5));
 assert.throws(()=>engine.buildLiteratureExample(fixture()+' ',inputs),/fixture|hash/i);
 assert.throws(()=>engine.buildLiteratureExample('{}',inputs),/fixture|hash/i);
 assert.throws(()=>engine.buildLiteratureExample(fixture(),{...inputs,unexpected:true}));
});
test('JSON CSV and SVG retain exact fixture, assumptions, units, method and integrity provenance',()=>{
 const raw=fixture(),r=engine.buildLiteratureExample(raw,inputs),sha=createHash('sha256').update(raw).digest('hex');
 assert.equal(r.provenance.fixture.sha256,sha);assert.equal(r.provenance.fixture.exactText,raw);
 assert.equal(r.provenance.source.doi,'10.3390/en15062101');assert.equal(r.provenance.source.table,'Appendix A, Table A1, PDF page 18');
 assert.equal(r.inputs.skin,5);assert.equal(r.provenance.assumptions.baselineSkin,0);
 assert.match(r.provenance.units.rate,/reservoir/);assert.match(r.limitations.join(' '),/seismic|geomechan/i);
 for(const artifact of [engine.literatureExampleJson(r),engine.literatureExampleCsv(r),engine.literatureExampleSvg(r)]){
  assert.ok(artifact.includes(sha));assert.ok(artifact.includes('10.3390/en15062101'));assert.ok(artifact.includes('reported psi'));
  assert.ok(artifact.includes('907.2848270992693'));assert.ok(artifact.includes('2e-6')||artifact.includes('0.000002'));
 }
 const csv=engine.literatureExampleCsv(r);for(const row of r.rows)assert.ok(csv.includes(String(row.comparedPressurePsi)));
 assert.ok(engine.literatureExampleSvg(r).includes('<metadata>'));assert.ok(engine.literatureExampleSvg(r).includes('Published reference only'));
 const body={...r};delete body.contentSha256;assert.equal(r.contentSha256,createHash('sha256').update(JSON.stringify(body)).digest('hex'));
});
test('tampered inputs, outputs, provenance or recomputed integrity cannot be exported',()=>{
 const r=engine.buildLiteratureExample(fixture(),inputs);
 for(const mutate of [x=>x.inputs.skin++,x=>x.selected.penaltyPsi++,x=>x.rows[0].comparedPressurePsi++,x=>x.provenance.source.doi='changed',x=>x.provenance.fixture.exactText+=' ']){
  const bad=structuredClone(r);mutate(bad);
  for(const exportFn of [engine.literatureExampleJson,engine.literatureExampleCsv,engine.literatureExampleSvg])assert.throws(()=>exportFn(bad));
  const {contentSha256,...body}=bad;bad.contentSha256=createHash('sha256').update(JSON.stringify(body)).digest('hex');
  assert.throws(()=>engine.literatureExampleJson(bad),/match|changed|integrity|fixture|hash/i);
 }
 const bad=structuredClone(r);bad.selected.penaltyPsi=NaN;assert.throws(()=>engine.literatureExampleCsv(bad));
});
