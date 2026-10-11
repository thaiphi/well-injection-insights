import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {buildExhibit,exhibitCsv} from '../dist/exhibit.js';import {INJECTORS} from '../dist/engineering.js';import {syntheticActuals,freezeForecast,planningCase} from '../dist/planning.js';
import {readFile} from 'node:fs/promises';import {parseCsv} from '../scripts/artifact-files.mjs';
test('Exhibit preserves calculation outputs, assumptions, scenario identity and deterministic content hash',async()=>{
  const a=syntheticActuals(),f=freezeForecast(a),controls={newWellStart:'2026-04',expansionMonth:'2026-08',expansionStbd:2000},rows=planningCase(f,a,INJECTORS);
  const e=await buildExhibit({frozen:f,rows,injectors:INJECTORS,controls});
  assert.deepEqual(e.outputs.monthly,rows);assert.equal(e.inputs.cutoff,'2025-12');assert.ok(e.units.engineeringPressure.includes('bottomhole psia'));
  const {contentSha256,...body}=e;assert.equal(contentSha256,createHash('sha256').update(JSON.stringify(body)).digest('hex'));
  assert.equal((await buildExhibit({frozen:f,rows,injectors:INJECTORS,controls})).contentSha256,contentSha256);
  assert.ok(exhibitCsv(e).includes('Pres + rate/J'));assert.ok(exhibitCsv(e).includes('FICTIONAL-INJ-A'));
  await assert.rejects(buildExhibit({frozen:f,rows,injectors:INJECTORS,controls:{...controls,expansionStbd:1000}}),/contradict/);
  assert.notEqual((await buildExhibit({frozen:f,rows:planningCase(f,a,INJECTORS,'2026-04','2026-08',1000),injectors:INJECTORS,controls:{...controls,expansionStbd:1000}})).contentSha256,contentSha256);
});
test('CSV alone retains actual public parent identity, source definitions, dispositions and calculated/report units',async()=>{
  const publicArtifact=JSON.parse(await readFile('data/explorer/normalized.json','utf8')),a=syntheticActuals(),f=freezeForecast(a),controls={newWellStart:'2026-04',expansionMonth:'2026-08',expansionStbd:2000};
  const e=await buildExhibit({frozen:f,rows:planningCase(f,a,INJECTORS),injectors:INJECTORS,controls,publicArtifact}),csv=parseCsv(exhibitCsv(e));
  assert.ok(csv.some(r=>r.section==='public_inventory'&&r.field==='api_no'&&r.value==='38910201'));
  assert.ok(csv.some(r=>r.field==='data_dictionary'));assert.ok(csv.some(r=>r.field==='quality_report'));
  assert.ok(csv.some(r=>r.field==='calculated_calendar_day_avg_bpd'&&r.unit==='bbl/day'&&r.provenance==='calculated'));
  assert.ok(csv.some(r=>r.field==='injected_gas_mcf'&&r.unit==='MCF/month'));
});
test('versioned planning exhibit retains raw input tables, generator IDs, hashes and grouped outputs',async()=>{
 const {planningFixture,planningDetails}=await import('../dist/planningFixture.js');const fixture=planningFixture();const frozen=freezeForecast(fixture.actuals),controls={newWellStart:'2026-04',expansionMonth:'2026-08',expansionStbd:2000};
 const e=await buildExhibit({frozen,rows:planningCase(frozen,fixture.actuals,INJECTORS),injectors:INJECTORS,controls,planningFixture:fixture});
 assert.equal(e.schemaVersion,2);assert.deepEqual(e.inputs.planningFixture.actuals,fixture.actuals);assert.equal(e.inputs.planningFixture.actualsId,'synthetic-water/seed-417/v1');
 assert.equal(e.inputs.planningFixtureSha256,createHash('sha256').update(JSON.stringify(fixture)).digest('hex'));assert.deepEqual(e.outputs.planningDetails,planningDetails(fixture,frozen));
 const csv=parseCsv(exhibitCsv(e));assert.equal(csv.filter(r=>r.section==='planning_actuals'&&r.field==='month').length,48);assert.ok(csv.some(r=>r.section==='planning_producers'&&r.field==='groupId'));
});
test('shared-datum exhibit rejects contradictory chart declarations without blocking valid per-well capacity',async()=>{
 const a=syntheticActuals(),frozen=freezeForecast(a),other={...INJECTORS[1],datum:'other-depth',reservoirDatum:'other-depth',limitDatum:'other-depth'};
 await assert.rejects(buildExhibit({frozen,rows:planningCase(frozen,a,[INJECTORS[0],other]),injectors:[INJECTORS[0],other],controls:{newWellStart:'2026-04',expansionMonth:'2026-08',expansionStbd:2000}}));
});
