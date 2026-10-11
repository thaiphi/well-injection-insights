import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PDFDocument,PDFName,PDFDict,PDFArray,PDFRawStream,decodePDFRawStream} from '../web/vendor/pdf-lib-1.17.1.mjs';
import {exhibitPdf} from '../web/exhibit-pdf.mjs';
import {buildExhibit} from '../dist/exhibit.js';
import {INJECTORS} from '../dist/engineering.js';
import {syntheticActuals,freezeForecast,planningCase} from '../dist/planning.js';

async function fixture({publicLoaded=true,changed=false}={}) {
  const actuals=syntheticActuals(),frozen=freezeForecast(actuals);
  const controls={newWellStart:changed?'2026-09':'2026-04',expansionMonth:changed?'2026-11':'2026-08',expansionStbd:changed?1200:2000};
  const injectors=INJECTORS.map(i=>({...i,availability:changed?0.7:i.availability,injectivityStbdPerPsi:changed?2.5:i.injectivityStbdPerPsi}));
  const publicArtifact=publicLoaded?JSON.parse(await readFile('data/explorer/normalized.json','utf8')):null;
  return buildExhibit({frozen,rows:planningCase(frozen,actuals,injectors,controls.newWellStart,controls.expansionMonth,controls.expansionStbd),injectors,controls,publicArtifact});
}
const rehash=e=>{const {contentSha256,...body}=e;e.contentSha256=createHash('sha256').update(JSON.stringify(body)).digest('hex');return e;};
function attachment(doc) {
  const names=doc.catalog.lookup(PDFName.of('Names'),PDFDict).lookup(PDFName.of('EmbeddedFiles'),PDFDict).lookup(PDFName.of('Names'),PDFArray);
  assert.equal(names.lookup(0).decodeText(),'swd-technical-exhibit.json');
  const file=names.lookup(1,PDFDict), stream=file.lookup(PDFName.of('EF'),PDFDict).lookup(PDFName.of('F'),PDFRawStream);
  return new TextDecoder().decode(decodePDFRawStream(stream).decode());
}
function text(doc) {
  return doc.getPages().map(page=>{
    const streams=page.node.lookup(PDFName.of('Contents'),PDFArray);
    return Array.from({length:streams.size()},(_,i)=>new TextDecoder().decode(decodePDFRawStream(streams.lookup(i,PDFRawStream)).decode())).join('\n')
      .replace(/<([a-f0-9]+)>/gi,(_,hex)=>Buffer.from(hex,'hex').toString('latin1'));
  }).join('\n');
}
test('Browser PDF is deterministic, four landscape Letter pages, exact attached exhibit and matching metadata',async()=>{
  const exhibit=await fixture(),bytes=await exhibitPdf(exhibit),again=await exhibitPdf(exhibit);
  assert.ok(bytes instanceof Uint8Array);
  assert.equal(new TextDecoder().decode(bytes.subarray(0,8)),'%PDF-1.7');
  assert.deepEqual(bytes,again);
  const doc=await PDFDocument.load(bytes,{updateMetadata:false});
  assert.equal(doc.getPageCount(),4);
  doc.getPages().forEach(p=>assert.deepEqual(p.getSize(),{width:792,height:612}));
  assert.equal(attachment(doc),JSON.stringify(exhibit,null,2)+'\n');
  assert.ok(doc.getSubject().includes(exhibit.contentSha256));
  assert.equal(doc.getCreationDate().toISOString(),'2000-01-01T00:00:00.000Z');
  const labels=text(doc);
  assert.ok(labels.includes('Declared actuals; raw history unverified'));
  assert.ok(labels.includes('Supplied frozen forecast parameters; unverified against absent raw training history'));
  assert.ok(!labels.includes('Synthetic actual'));
  for(const value of ['Annual unmet planned volume','Bottomhole psia','Availability','90%','2026-04','000020838','38910201','Snapshot SHA-256']) assert.ok(labels.includes(value),value);
  assert.ok(!labels.includes('unsupported glyphs become ?'));
  // Prose words wrap intact, while token wrapping remains available for URLs/hashes.
  assert.ok(labels.includes('claim is made.'));
  assert.ok(labels.includes('Exact unrounded values are attached.'));
  assert.ok(labels.includes('acquired source reports.'));
  for(const row of exhibit.publicHistory.injectionMonthly) assert.ok(labels.includes(String(row.source_report_id)));
  await mkdir('output/pdf',{recursive:true});await writeFile('output/pdf/browser-default-qa.pdf',bytes);
});
test('Modified scenario retains exact displayed outputs and has a different PDF hash and attachment',async()=>{
  const exhibit=await fixture({changed:true}),bytes=await exhibitPdf(exhibit),doc=await PDFDocument.load(bytes,{updateMetadata:false});
  assert.equal(doc.getPageCount(),4);
  assert.deepEqual(JSON.parse(attachment(doc)),exhibit);
  assert.ok(doc.getSubject().includes(exhibit.contentSha256));
  const labels=text(doc);for(const value of ['2026-09','70%','2.5','1,200'])assert.ok(labels.includes(value),value);
  assert.notEqual(createHash('sha256').update(bytes).digest('hex'),createHash('sha256').update(await exhibitPdf(await fixture())).digest('hex'));
  await writeFile('output/pdf/browser-changed-qa.pdf',bytes);
});
test('Tampered hash or data is rejected before creating a PDF',async()=>{
  const exhibit=await fixture();exhibit.outputs.monthly[0].demandBbl+=1;
  await assert.rejects(exhibitPdf(exhibit),/SHA-256 mismatch/);
  exhibit.contentSha256='0'.repeat(64);await assert.rejects(exhibitPdf(exhibit),/SHA-256 mismatch/);
});
test('No-public state remains four pages and explicitly labels absent evidence',async()=>{
  const exhibit=await fixture({publicLoaded:false}),doc=await PDFDocument.load(await exhibitPdf(exhibit),{updateMetadata:false});
  assert.equal(doc.getPageCount(),4);assert.ok(text(doc).includes('Public history not loaded'));
  assert.equal(JSON.parse(attachment(doc)).publicHistory,null);
});
test('Missing public values and zero stay distinct; unsupported glyphs preserve original Unicode in attachment',async()=>{
  const exhibit=await fixture(),row=exhibit.publicHistory.injectionMonthly[0];
  row.injected_liquid_bbl=null;row.reported_avg_injection_pressure_psi=null;row.reported_max_injection_pressure_psi=0;row.calculated_calendar_day_avg_bpd=null;
  exhibit.publicHistory.inventory[0].well_no_display='測試 🚰';
  exhibit.assumptions.push('Unicode display example 測試 🚰');
  const doc=await PDFDocument.load(await exhibitPdf(rehash(exhibit)),{updateMetadata:false}),labels=text(doc);
  assert.ok(labels.includes('Not reported'));assert.ok(labels.includes('never zero'));
  assert.ok(labels.includes('unsupported glyphs become ?'));
  assert.deepEqual(JSON.parse(attachment(doc)),exhibit);
  assert.equal(JSON.parse(attachment(doc)).publicHistory.injectionMonthly[0].reported_max_injection_pressure_psi,0);
});
test('Unexpected long content adds readable continuation pages without dropping text',async()=>{
  const exhibit=await fixture();exhibit.assumptions.push('continuation-check '.repeat(1800)+'END-OF-LONG-ASSUMPTION');
  const doc=await PDFDocument.load(await exhibitPdf(rehash(exhibit)),{updateMetadata:false});
  assert.ok(doc.getPageCount()>4);assert.ok(text(doc).includes('continued'));assert.ok(text(doc).includes('END-OF-LONG-ASSUMPTION'));
  assert.deepEqual(JSON.parse(attachment(doc)),exhibit);
});
test('Oversized source-report cells continue across pages and preserve the complete identifier',async()=>{
  const exhibit=await fixture();
  const identifier='SOURCE-REPORT-'.repeat(1600)+'END-OF-SOURCE-REPORT';
  exhibit.publicHistory.injectionMonthly[0].source_report_id=identifier;
  const doc=await PDFDocument.load(await exhibitPdf(rehash(exhibit)),{updateMetadata:false});
  assert.ok(doc.getPageCount()>4);assert.ok(text(doc).includes('END-OF-SOURCE-REPORT'));
  assert.equal(JSON.parse(attachment(doc)).publicHistory.injectionMonthly[0].source_report_id,identifier);
});
test('version2 PDF retains all raw planning inputs and exact attached exhibit',async()=>{
 const {planningFixture}=await import('../dist/planningFixture.js');const planning=planningFixture(),frozen=freezeForecast(planning.actuals),controls={newWellStart:'2026-04',expansionMonth:'2026-08',expansionStbd:2000};
 const e=await buildExhibit({frozen,rows:planningCase(frozen,planning.actuals,INJECTORS),injectors:INJECTORS,controls,planningFixture:planning});
 const bytes=await exhibitPdf(e),doc=await PDFDocument.load(bytes,{updateMetadata:false});assert.equal(attachment(doc),JSON.stringify(e,null,2)+'\n');
 assert.ok(text(doc).includes('Raw synthetic producer history'));assert.ok(text(doc).includes('FICTIONAL-PROD-01'));assert.ok(doc.getPageCount()>4);
});
