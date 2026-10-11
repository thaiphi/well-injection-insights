import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {syntheticActuals} from '../dist/planning.js';
import {INJECTORS} from '../dist/engineering.js';
const p = await import('../dist/importProfile.js').catch(()=>({}));
const v = await import('../dist/importValidation.js').catch(()=>({}));
export const historyMapping = {version:'history-map/1',confirmed:true,profile:'history',columns:{producerId:'Producer',groupId:'Group',month:'Month',water:'Water'},units:{water:'STB/day'},timeBasis:'calendar-day'};
export async function history(csv, overrides={}) {
  const source=await p.createSource(new TextEncoder().encode(csv),'seed417.csv',{origin:'user',assertedKind:'synthetic',reference:'synthetic-water/seed-417/v1'});
  return v.validateImport(p.parseCsv(csv),source,{...historyMapping,...overrides});
}
test('import API exists before testing normalization',()=>{
  assert.equal(typeof p.parseCsv,'function');assert.equal(typeof v.validateImport,'function');
});
test('seed417 CSV round trip preserves values, calendar conversions and unverified user assertion',async()=>{
  const rows=syntheticActuals();const csv='Producer,Group,Month,Water\n'+rows.map(r=>`${r.producerId},FICTIONAL-GROUP,${r.month},${r.rateStbd}`).join('\n');
  const result=await history(csv);
  assert.equal(result.counts.accepted,48);assert.equal(result.counts.quarantined,0);
  assert.equal(result.rows[0].value.volumeBbl,rows[0].volumeBbl);
  assert.equal(result.rows[0].lineage.source.origin,'user');
  assert.equal(result.rows[0].lineage.source.assertedKind,'synthetic');
  assert.equal(result.rows[0].lineage.source.verified,false);
  assert.equal(result.rows[0].lineage.source.sha256,createHash('sha256').update(csv).digest('hex'));
  assert.equal(result.rows[0].lineage.originalRow,2);
  assert.equal(result.rows[0].lineage.originalValues[3],String(rows[0].rateStbd));
  assert.equal(result.rows[0].lineage.mapping.version,'history-map/1');
  assert.ok(result.rows[0].lineage.transformations.some(s=>s.includes('31')));
  const fixture=readFileSync(new URL('./fixtures/import/seed417-history.csv',import.meta.url),'utf8');
  assert.equal((await history(fixture)).rows[0].value.rateStbd,rows[0].rateStbd);
});
test('volume and hourly units normalize using actual leap-month days; zero differs from missing',async()=>{
  const csv='Producer,Group,Month,Water\nFICTIONAL-P,G,2024-02,2900\nFICTIONAL-P,G,2024-03,0\nFICTIONAL-P,G,2024-04,\n';
  const r=await history(csv,{units:{water:'STB'},timeBasis:'calendar-month'});
  assert.equal(r.rows[0].value.rateStbd,100);assert.equal(r.rows[0].value.volumeBbl,2900);
  assert.equal(r.rows[1].value.rateStbd,0);assert.equal(r.rows[2].value.rateStbd,null);
  const hourly=await history('Producer,Group,Month,Water\nP,G,2024-02,2',{units:{water:'STB/hour'},timeBasis:'calendar-hour'});
  assert.equal(hourly.rows[0].value.volumeBbl,1392);
});
test('explicit mapping rejects ambiguous units, numeric coercion, dates, identities and unconfirmed mapping',async()=>{
  const good='Producer,Group,Month,Water\nP,G,2024-02,10';
  for(const overrides of [{units:{water:'bbl'}},{timeBasis:'operating-day'},{confirmed:false},{columns:{month:'Month',water:'Water'}}]) {
    assert.ok((await history(good,overrides)).errors.length);
  }
  const bad=readFileSync(new URL('./fixtures/import/invalid-history.csv',import.meta.url),'utf8');
  const r=await history(bad);assert.equal(r.counts.accepted,0);assert.equal(r.counts.quarantined,5);
  assert.ok(r.rows.every(x=>x.errors.length));
});
test('duplicate identities quarantine every participant, including identical repeats',async()=>{
  for(const value of ['10','20']) {
    const r=await history(`Producer,Group,Month,Water\nP,G,2024-02,10\nP,G,2024-02,${value}`);
    assert.equal(r.counts.accepted,0);assert.equal(r.counts.quarantined,2);
    assert.ok(r.rows.every(x=>x.errors.some(e=>e.code==='duplicate')));
  }
});
test('CSV quoted multiline cells retain physical row identity; malformed grammar is rejected',()=>{
  const t=p.parseCsv('Producer,Group,Month,Water\r\n"P,1","G\nX",2024-02,0\r\nP2,G,2024-03,1');
  assert.equal(t.rows[0].values[0],'P,1');assert.equal(t.rows[1].originalRow,4);
  for(const csv of ['a,a\n1,2','a,b\n1','a\n"unterminated','a\n"x"junk','a\nx"y']) assert.throws(()=>p.parseCsv(csv));
});
test('parsed sheet boundary requires explicit selection and rejects formula cells even without caches',async()=>{
  const source=await p.createSource(new Uint8Array([1,2,3]),'boundary.xlsx',{origin:'synthetic',assertedKind:'synthetic',reference:'seed-417/v1'});
  const sheets=[{name:'Notes',rows:[['ignore']]},{name:'History',rows:[['Producer','Group','Month','Water'],['P','G','2024-02',0],['Q','G','2024-02',{formula:'1+1'}]]}];
  assert.throws(()=>p.selectSheet(sheets,undefined,1));
  const table=p.selectSheet(sheets,'History',1);const r=v.validateImport(table,source,historyMapping);
  assert.equal(r.counts.accepted,1);assert.equal(r.counts.quarantined,1);
  assert.equal(r.rows[1].errors[0].code,'formula');
  assert.equal(r.rows[0].lineage.sheet,'History');assert.equal(r.rows[0].lineage.headerRow,1);
});
test('injector presets retain per-injector absolute bottomhole pressure compatibility',async()=>{
  const columns={id:'id',injectivity:'j',reservoirPressure:'pres',limitPressure:'limit',reservoirBasis:'rb',limitBasis:'lb',reservoirDatum:'rd',limitDatum:'ld',operatingCeiling:'ceiling',availability:'availability'};
  const mapping={version:'injector-map/1',confirmed:true,profile:'injector',columns,units:{injectivity:'STB/day/psi',reservoirPressure:'psia',limitPressure:'psia',operatingCeiling:'STB/day',availability:'fraction'}};
  const header=Object.values(columns).join(',');
  const csv=header+'\n'+INJECTORS.map((i,n)=>`${i.id},${i.injectivityStbdPerPsi},${i.reservoirPsia},${i.limitPsia},bottomhole-absolute,bottomhole-absolute,depth-${n},depth-${n},${i.operatingCeilingStbd},${i.availability}`).join('\n');
  const source=await p.createSource(new TextEncoder().encode(csv),'presets.csv',{origin:'assumed',assertedKind:'assumed',reference:'src/engineering.ts/INJECTORS'});
  const result=v.validateImport(p.parseCsv(csv),source,mapping);assert.equal(result.counts.accepted,2);
  assert.equal(result.rows[0].value.injectivityStbdPerPsi,5);
  for(const bad of [csv.replace('bottomhole-absolute','surface-gauge'),csv.replace('depth-0,depth-0','depth-0,depth-1'),csv.replace(',5,2000',',0,2000')]) {
    assert.equal(v.validateImport(p.parseCsv(bad),source,mapping).rows[0].disposition,'quarantined');
  }
  assert.ok(v.validateImport(p.parseCsv(csv),source,{...mapping,units:{...mapping.units,reservoirPressure:'psi'}}).errors.length);
});
test('schedule requires explicit start dates, groups, decline and availability',async()=>{
  const csv='p,g,start,rate,decline,availability\nFICTIONAL-P,G,2026-04-01,6000,0.025,0\nFICTIONAL-Q,,2026-02-30,6000,0.025,1';
  const source=await p.createSource(new TextEncoder().encode(csv),'schedule.csv',{origin:'assumed',assertedKind:'assumed',reference:'src/planning.ts/planningCase'});
  const mapping={profile:'schedule',version:'schedule/1',confirmed:true,columns:{producerId:'p',groupId:'g',startDate:'start',initialRate:'rate',monthlyDecline:'decline',availability:'availability'},units:{initialRate:'STB/day',monthlyDecline:'fraction/month',availability:'fraction'}};
  const r=v.validateImport(p.parseCsv(csv),source,mapping);assert.equal(r.counts.accepted,1);assert.equal(r.rows[0].value.availability,0);assert.equal(r.counts.quarantined,1);
});
test('lineage snapshots include original headers and resist later caller mutation',async()=>{
 const csv='Producer,Group,Month,Water\nP,G,2024-02,1';
 const table=p.parseCsv(csv);const mapping=structuredClone(historyMapping);
 const source=await p.createSource(new TextEncoder().encode(csv),'test.csv',{origin:'user',assertedKind:'public-reported',reference:'assertion-only'});
 const r=v.validateImport(table,source,mapping);table.headers[0]='changed';mapping.units.water='invalid';source.assertedKind='measured';
 assert.equal(r.rows[0].lineage.originalHeaders[0],'Producer');assert.equal(r.rows[0].lineage.mapping.units.water,'STB/day');assert.equal(r.rows[0].lineage.source.assertedKind,'public-reported');
});
test('equivalent CSV and parsed-sheet samples normalize equally without claiming binary XLSX support',async()=>{
 const fixture=readFileSync(new URL('./fixtures/import/parsed-sheet-contract.json',import.meta.url),'utf8');
 const workbook=JSON.parse(fixture);const csv=readFileSync(new URL('./fixtures/import/seed417-history.csv',import.meta.url),'utf8');
 const source=await p.createSource(new TextEncoder().encode(fixture),'parsed-sheet-contract.json',{origin:'synthetic',assertedKind:'synthetic',reference:workbook.source});
 const sheet=v.validateImport(p.selectSheet(workbook.sheets,'History',1),source,historyMapping);
 assert.deepEqual(sheet.rows.map(r=>r.value),(await history(csv)).rows.map(r=>r.value));
 const invalid=v.validateImport(p.selectSheet(workbook.sheets,'Invalid formula',1),source,historyMapping);assert.equal(invalid.counts.quarantined,1);
});
test('normalization identities distinguish changed mappings and calculated fields keep source links',async()=>{
 const csv='Producer,Group,Month,Water\nP,G,2024-02,24';
 const daily=await history(csv);const hourly=await history(csv,{units:{water:'STB/hour'},timeBasis:'calendar-hour'});
 assert.notEqual(daily.id,hourly.id);assert.notEqual(daily.rows[0].id,hourly.rows[0].id);
 assert.deepEqual(daily.rows[0].lineage.calculatedFields,['volumeBbl']);
 assert.deepEqual(hourly.rows[0].lineage.calculatedFields,['rateStbd','volumeBbl']);
});
test('public sample remains observation-only and a user assertion does not verify acquisition',async()=>{
 const csv=readFileSync(new URL('./fixtures/import/public-reported-observations.csv',import.meta.url),'utf8');
 assert.equal(csv,readFileSync(new URL('../data/explorer/injection_monthly.csv',import.meta.url),'utf8'));
 const source=await p.createSource(new TextEncoder().encode(csv),'public.csv',{origin:'user',assertedKind:'public-reported',reference:'pinned-public-sample'});
 assert.equal(source.verified,false);assert.equal(source.origin,'user');
});
