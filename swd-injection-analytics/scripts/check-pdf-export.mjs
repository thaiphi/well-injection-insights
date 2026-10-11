import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {buildExhibit} from '../dist/exhibit.js';
import {INJECTORS} from '../dist/engineering.js';
import {freezeForecast,planningCase} from '../dist/planning.js';
import {planningFixture} from '../dist/planningFixture.js';

const python=process.argv[2];
if(!python)throw Error('Pass an explicit Python executable containing reportlab and pypdf; no bare Python launcher is used.');
await access(python);
const root='tmp/pdfs/checks';await mkdir(root,{recursive:true});
const original=JSON.parse(await readFile('exhibits/default.json','utf8'));
function rehash(exhibit){const {contentSha256,...body}=exhibit;return {...body,contentSha256:createHash('sha256').update(JSON.stringify(body)).digest('hex')};}
const inspect=`import json,sys;from pathlib import Path;from pypdf import PdfReader
r=PdfReader(sys.argv[1]);print(json.dumps({'pages':len(r.pages),'attachmentExact':r.attachments['swd-technical-exhibit.json'][0]==Path(sys.argv[2]).read_bytes(),'text':' '.join((' '.join(p.extract_text() or '' for p in r.pages)).split())}))`;
const currentFixture=planningFixture(),currentFrozen=freezeForecast(currentFixture.actuals);
const current=await buildExhibit({frozen:currentFrozen,rows:planningCase(currentFrozen,currentFixture.actuals,INJECTORS),injectors:INJECTORS,controls:{newWellStart:'2026-04',expansionMonth:'2026-08',expansionStbd:2000},planningFixture:currentFixture});
const declared=await buildExhibit({frozen:currentFrozen,rows:planningCase(currentFrozen,currentFixture.actuals,INJECTORS),injectors:INJECTORS,controls:{newWellStart:'2026-04',expansionMonth:'2026-08',expansionStbd:2000}});
for(const name of ['default','partial-missing','all-missing','no-public','current-schema2','current-declared-schema1']){
  const e=structuredClone(name==='current-schema2'?current:name==='current-declared-schema1'?declared:original);
  if(name==='partial-missing')e.publicHistory.injectionMonthly.slice(0,2).forEach(row=>{row.injected_liquid_bbl=null;row.calculated_calendar_day_avg_bpd=null;});
  if(name==='all-missing')e.publicHistory.injectionMonthly.forEach(row=>{row.injected_liquid_bbl=null;row.calculated_calendar_day_avg_bpd=null;});
  if(name==='no-public'){e.publicHistory=null;e.inputs.publicArtifactId=null;e.provenance.publicHistory='not loaded';}
  const fixture=rehash(e),input=`${root}/${name}.json`,output=`${root}/${name}.pdf`;
  await writeFile(input,JSON.stringify(fixture,null,2)+'\n');
  const run=spawnSync(python,['scripts/export-pdf.py',input,output],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr||run.error?.message);
  const parsed=spawnSync(python,['-c',inspect,output,input],{encoding:'utf8'});
  assert.equal(parsed.status,0,parsed.stderr);
  const evidence=JSON.parse(parsed.stdout);assert.equal(evidence.pages,4);assert.equal(evidence.attachmentExact,true);
  assert.ok(evidence.text.includes(fixture.contentSha256));assert.ok(evidence.text.includes('128,120 bbl'));
  assert.ok(evidence.text.includes('2026-01'));assert.ok(evidence.text.includes('180,698'));
  if(name==='default'){
    assert.ok(evidence.text.includes('432,198 bbl; 0 volume(s) not reported'));
    for(const row of e.publicHistory.injectionMonthly)assert.ok(evidence.text.includes(row.source_report_id),`Missing PDF report ID ${row.source_report_id}`);
  }
  if(name==='partial-missing')assert.ok(evidence.text.includes('397,098 bbl (partial sum); 2 volume(s) not reported'));
  if(name==='all-missing'){
    assert.ok(evidence.text.includes('sum of known liquid volumes: Not reported; 28 volume(s) not reported'));
    assert.ok(!evidence.text.includes('sum of known liquid volumes: 0'));
  }
  if(name==='no-public')assert.ok(evidence.text.includes('Public history was not loaded'));
  if(name==='current-schema2'){
    assert.equal(e.schemaVersion,2);
    assert.ok(evidence.text.includes(e.outputs.brine.salinityBasis));
    assert.ok(evidence.text.includes(e.outputs.brine.source));
    assert.ok(evidence.text.includes('Calculated brine reference'));
  }
  if(name==='current-declared-schema1'){
    assert.equal(e.schemaVersion,1);
    assert.ok(evidence.text.includes(e.inputs.forecastEvidence));
    assert.ok(evidence.text.includes('Declared actual'));
    assert.ok(!evidence.text.includes('Synthetic actual'));
  }
  console.log(`PASS ${name}: four pages, original JSON attachment and content/missingness evidence`);
}
const corrupt=structuredClone(original);corrupt.outputs.monthly[0].demandBbl+=1;
const input=`${root}/corrupt.json`,output=`${root}/corrupt.pdf`;
await writeFile(input,JSON.stringify(corrupt));
const rejected=spawnSync(python,['scripts/export-pdf.py',input,output],{encoding:'utf8'});
assert.notEqual(rejected.status,0);assert.ok(rejected.stderr.includes('SHA-256/schema verification'));
await assert.rejects(access(output));
console.log('PASS corrupt input: hash mismatch rejected before PDF write');
const overflow=rehash({...original,extraEvidence:null});
const overflowInput=`${root}/overflow.json`,overflowOutput=`${root}/overflow.pdf`;
await writeFile(overflowInput,JSON.stringify(overflow).replace('"extraEvidence":null','"extraEvidence":1e400'));
const overflowRejected=spawnSync(python,['scripts/export-pdf.py',overflowInput,overflowOutput],{encoding:'utf8'});
assert.notEqual(overflowRejected.status,0);assert.ok(overflowRejected.stderr.includes('SHA-256/schema verification'));
await assert.rejects(access(overflowOutput));
console.log('PASS raw numeric overflow: rejected before normalization or PDF write');
