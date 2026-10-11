import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import * as XLSX from '../web/vendor/xlsx.mjs';
import {syntheticActuals} from '../dist/planning.js';
const adapter=await import('../web/import-file.mjs').catch(()=>({}));
const mapping={profile:'history',version:'xlsx-map/1',confirmed:true,columns:{producerId:'Producer',groupId:'Group',month:'Month',water:'Water'},units:{water:'STB/day'},timeBasis:'calendar-day'};
const cells=[['Producer','Group','Month','Water'],...syntheticActuals().map(r=>[r.producerId,'FICTIONAL-GROUP',r.month,r.rateStbd])];
function workbook(invalid=false) {
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Synthetic demonstration; no field calibration']]),'Notes');
 const sheet=XLSX.utils.aoa_to_sheet(cells);if(invalid) {sheet.D2={t:'n',f:'1+1'};sheet.D3={t:'n',f:'1+1',v:2};}
 XLSX.utils.book_append_sheet(book,sheet,'Water data');return XLSX.write(book,{type:'buffer',bookType:'xlsx',compression:true});
}
test('real XLSX bytes and equivalent CSV normalize equally with user synthetic assertion',async()=>{
 assert.equal(typeof adapter.readInputFile,'function');
 const bytes=workbook();writeFileSync(new URL('./fixtures/import/seed417-history.xlsx',import.meta.url),bytes);
 const parsed=await adapter.readInputFile(bytes,'seed417-history.xlsx','synthetic');
 assert.deepEqual(parsed.sheets.map(s=>s.name),['Notes','Water data']);
 assert.equal(parsed.source.origin,'user');assert.equal(parsed.source.assertedKind,'synthetic');assert.equal(parsed.source.verified,false);
 const result=adapter.validateSelected(parsed,'Water data',1,mapping);
 const csv=await adapter.readInputFile(readFileSync(new URL('./fixtures/import/seed417-history.csv',import.meta.url)),'seed417-history.csv','synthetic');
 const equivalent=adapter.validateSelected(csv,null,1,mapping);
 assert.deepEqual(result.rows.map(r=>r.value),equivalent.rows.map(r=>r.value));assert.equal(result.counts.accepted,48);
 assert.equal(result.rows[0].lineage.sheet,'Water data');
});
test('XLSX formulas never use cached values and malformed files are rejected',async()=>{
 const bytes=workbook(true);writeFileSync(new URL('./fixtures/import/invalid-formulas.xlsx',import.meta.url),bytes);
 const parsed=await adapter.readInputFile(bytes,'invalid.xlsx','synthetic');const result=adapter.validateSelected(parsed,'Water data',1,mapping);
 assert.equal(result.counts.quarantined,2);assert.equal(result.rows[0].errors[0].code,'formula');assert.equal(result.rows[1].errors[0].code,'formula');
 await assert.rejects(adapter.readInputFile(new TextEncoder().encode('p,g,m,q'),'fake.xlsx','synthetic'));
 await assert.rejects(adapter.readInputFile(new Uint8Array(10*1024*1024+1),'large.xlsx','synthetic'));
 assert.throws(()=>adapter.validateSelected(parsed,null,1,mapping));
});

